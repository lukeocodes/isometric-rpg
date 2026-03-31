export type BinaryMessageHandler = (data: ArrayBuffer) => void;
export type TextMessageHandler = (data: string) => void;

export interface WorldMapData {
  seed: number; width: number; height: number;
  biomeMap: Uint8Array; elevationBands: Uint8Array;
  regionMap: Uint16Array; regionBiomes: Uint8Array;
}

export class NetworkManager {
  private pc: RTCPeerConnection | null = null;
  private positionChannel: RTCDataChannel | null = null;
  private reliableChannel: RTCDataChannel | null = null;
  private connected = false;

  private onPositionMessage: BinaryMessageHandler | null = null;
  private onReliableMessage: TextMessageHandler | null = null;
  private onChunkData: ((data: ArrayBuffer) => void) | null = null;
  private onBinaryReliable: ((data: ArrayBuffer) => void) | null = null;
  private onDisconnect: ((reason: string) => void) | null = null;
  private worldReadyResolve: (() => void) | null = null;
  public spawnPosition: { x: number; y: number; z: number; mapId: number } = { x: 0, y: 0, z: 0, mapId: 1 };
  public worldData: WorldMapData | null = null;

  constructor() {}

  setOnPositionMessage(handler: BinaryMessageHandler) { this.onPositionMessage = handler; }
  setOnReliableMessage(handler: TextMessageHandler) { this.onReliableMessage = handler; }
  setOnChunkData(handler: (data: ArrayBuffer) => void) { this.onChunkData = handler; }
  setOnBinaryReliable(handler: (data: ArrayBuffer) => void) { this.onBinaryReliable = handler; }
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

    // Parse world map from server response
    if (offer.worldMap) {
      this.worldData = await this.parseWorldMap(offer.worldMap);
      console.log(`[WebRTC] World map received: ${this.worldData.width}x${this.worldData.height}, seed=${this.worldData.seed}`);
    }

    // Phase 2: Create peer connection, receive server's DataChannels
    // Use ICE servers from server response (includes STUN + TURN if configured)
    const iceServers = offer.iceServers ?? [{ urls: "stun:stun.l.google.com:19302" }];
    this.pc = new RTCPeerConnection({ iceServers });

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
            // Binary messages — route by opcode byte
            if (e.data instanceof ArrayBuffer && e.data.byteLength >= 5) {
              const firstByte = new Uint8Array(e.data)[0];
              if (firstByte === 11) { // CHUNK_DATA
                if (this.onChunkData) this.onChunkData(e.data);
                return;
              }
              // Binary reliable messages: combat (50-52), combat state (53), enemy nearby (70),
              // ability cooldown (32), xp/level (80-81), respawn (82)
              if (firstByte === 50 || firstByte === 51 || firstByte === 52 ||
                  firstByte === 53 || firstByte === 70 || firstByte === 32 ||
                  firstByte === 80 || firstByte === 81 || firstByte === 82) {
                if (this.onBinaryReliable) this.onBinaryReliable(e.data);
                return;
              }
            }
            const str = typeof e.data === "string" ? e.data : new TextDecoder().decode(e.data);
            try {
              const parsed = JSON.parse(str);
              if (parsed.op === 100) { // WORLD_READY
                // Server sends authoritative spawn position — override the offer value
                if (parsed.spawnX != null) {
                  this.spawnPosition = { x: parsed.spawnX, y: parsed.spawnY ?? 0, z: parsed.spawnZ, mapId: this.spawnPosition.mapId };
                }
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

  async parseWorldMap(base64Data: string): Promise<WorldMapData> {
    // Decode base64
    const binary = Uint8Array.from(atob(base64Data), c => c.charCodeAt(0));

    // Decompress gzip via DecompressionStream
    const ds = new DecompressionStream("gzip");
    const writer = ds.writable.getWriter();
    writer.write(binary);
    writer.close();
    const reader = ds.readable.getReader();
    const chunks: Uint8Array[] = [];
    while (true) {
      const { done, value } = await reader.read();
      if (done) break;
      chunks.push(value);
    }
    const totalLen = chunks.reduce((n, c) => n + c.length, 0);
    const decompressed = new Uint8Array(totalLen);
    let pos = 0;
    for (const c of chunks) { decompressed.set(c, pos); pos += c.length; }

    // Parse header (28 bytes)
    const view = new DataView(decompressed.buffer, decompressed.byteOffset, decompressed.byteLength);
    let offset = 0;
    const magic = view.getUint32(offset, true); offset += 4;
    if (magic !== 0x574D4150) throw new Error("Invalid world map magic");
    const seed = view.getUint32(offset, true); offset += 4;
    const width = view.getUint16(offset, true); offset += 2;
    const height = view.getUint16(offset, true); offset += 2;
    const biomeLen = view.getUint32(offset, true); offset += 4;
    const elevLen = view.getUint32(offset, true); offset += 4;
    const regionLen = view.getUint32(offset, true); offset += 4;
    const regionBiomesLen = view.getUint32(offset, true); offset += 4;

    // Extract arrays (copy to ensure proper alignment)
    const biomeMap = new Uint8Array(decompressed.buffer, decompressed.byteOffset + offset, biomeLen); offset += biomeLen;
    const elevationBands = new Uint8Array(decompressed.buffer, decompressed.byteOffset + offset, elevLen); offset += elevLen;
    // Uint16Array needs aligned buffer -- slice to copy
    const regionMapBytes = decompressed.slice(offset, offset + regionLen);
    const regionMap = new Uint16Array(regionMapBytes.buffer, regionMapBytes.byteOffset, regionLen / 2);
    offset += regionLen;
    const regionBiomes = new Uint8Array(decompressed.buffer, decompressed.byteOffset + offset, regionBiomesLen);

    return { seed, width, height, biomeMap, elevationBands, regionMap, regionBiomes };
  }

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
