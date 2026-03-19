export type BinaryMessageHandler = (data: ArrayBuffer) => void;
export type TextMessageHandler = (data: string) => void;

export class NetworkManager {
  private pc: RTCPeerConnection | null = null;
  private positionChannel: RTCDataChannel | null = null;
  private reliableChannel: RTCDataChannel | null = null;
  private connected = false;

  private onPositionMessage: BinaryMessageHandler | null = null;
  private onReliableMessage: TextMessageHandler | null = null;
  private onDisconnect: ((reason: string) => void) | null = null;
  private worldReadyResolve: (() => void) | null = null;
  public spawnPosition: { x: number; y: number; z: number; mapId: number } = { x: 0, y: 0, z: 0, mapId: 1 };

  constructor() {}

  setOnPositionMessage(handler: BinaryMessageHandler) { this.onPositionMessage = handler; }
  setOnReliableMessage(handler: TextMessageHandler) { this.onReliableMessage = handler; }
  setOnDisconnect(handler: (reason: string) => void) { this.onDisconnect = handler; }

  async connect(token: string, characterId: string): Promise<void> {
    // Phase 1: Ask server to create offer
    const offerRes = await fetch("/api/rtc/offer", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${token}`,
      },
      body: JSON.stringify({ characterId }),
    });

    if (!offerRes.ok) {
      const err = await offerRes.json().catch(() => ({ detail: "Connection failed" }));
      throw new Error(err.detail || "RTC offer failed");
    }

    const offer = await offerRes.json();
    if (offer.spawn) this.spawnPosition = offer.spawn;

    // Phase 2: Create peer connection, receive server's DataChannels
    this.pc = new RTCPeerConnection({
      iceServers: [{ urls: "stun:stun.l.google.com:19302" }],
    });

    const channelsReady = new Promise<void>((resolve) => {
      let posOpen = false;
      let relOpen = false;
      const check = () => { if (posOpen && relOpen) resolve(); };

      this.pc!.ondatachannel = (event) => {
        const channel = event.channel;

        if (channel.label === "position") {
          this.positionChannel = channel;
          channel.binaryType = "arraybuffer";
          channel.onmessage = (e) => {
            if (this.onPositionMessage) this.onPositionMessage(e.data);
          };
          channel.onopen = () => { posOpen = true; check(); };
        } else if (channel.label === "reliable") {
          this.reliableChannel = channel;
          channel.binaryType = "arraybuffer";
          channel.onmessage = (e) => {
            const str = typeof e.data === "string" ? e.data : new TextDecoder().decode(e.data);
            try {
              const parsed = JSON.parse(str);
              if (parsed.op === 100) { // WORLD_READY
                if (this.worldReadyResolve) this.worldReadyResolve();
                return;
              }
            } catch {}
            if (this.onReliableMessage) this.onReliableMessage(str);
          };
          channel.onopen = () => { relOpen = true; check(); };
        }
      };
    });

    this.pc.onconnectionstatechange = () => {
      const state = this.pc?.connectionState;
      if (state === "failed" || state === "closed" || state === "disconnected") {
        this.connected = false;
        if (this.onDisconnect) this.onDisconnect(state);
      }
    };

    // Set up ICE candidate collection before descriptions
    const iceDone = new Promise<void>((resolve) => {
      this.pc!.onicecandidate = (event) => {
        if (!event.candidate) resolve();
      };
      setTimeout(resolve, 3000);
    });

    // Set server's offer, create answer
    await this.pc.setRemoteDescription(
      new RTCSessionDescription({ sdp: offer.sdp, type: offer.type })
    );
    const answer = await this.pc.createAnswer();
    await this.pc.setLocalDescription(answer);
    await iceDone;

    // Phase 3: Send answer to server
    const answerRes = await fetch("/api/rtc/answer", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${token}`,
      },
      body: JSON.stringify({
        characterId,
        sdp: this.pc.localDescription!.sdp,
      }),
    });

    if (!answerRes.ok) throw new Error("Failed to send answer");

    // Wait for DataChannels to open
    await Promise.race([
      channelsReady,
      new Promise<void>((_, reject) =>
        setTimeout(() => reject(new Error("DataChannel timeout")), 10000)
      ),
    ]);

    this.connected = true;
    console.log("[WebRTC] Connected — position: unreliable, reliable: ordered");
  }

  private worldReadyTimer: ReturnType<typeof setTimeout> | null = null;

  waitForWorldReady(): Promise<void> {
    return new Promise((resolve) => {
      this.worldReadyResolve = () => {
        if (this.worldReadyTimer) clearTimeout(this.worldReadyTimer);
        resolve();
      };
      this.worldReadyTimer = setTimeout(() => {
        this.worldReadyResolve = null;
        resolve();
      }, 5000);
    });
  }

  sendPosition(data: ArrayBuffer) {
    if (this.positionChannel?.readyState === "open") this.positionChannel.send(data);
  }

  sendReliable(data: string) {
    if (this.reliableChannel?.readyState === "open") this.reliableChannel.send(data);
  }

  isConnected(): boolean { return this.connected; }

  disconnect() {
    if (this.worldReadyTimer) { clearTimeout(this.worldReadyTimer); this.worldReadyTimer = null; }
    this.worldReadyResolve = null;
    if (this.pc) {
      this.pc.ondatachannel = null;
      this.pc.onconnectionstatechange = null;
      this.pc.onicecandidate = null;
    }
    this.positionChannel?.close();
    this.reliableChannel?.close();
    this.positionChannel = null;
    this.reliableChannel = null;
    this.pc?.close();
    this.pc = null;
    this.connected = false;
  }
}
