import { describe, it, expect, beforeEach, vi, afterEach } from "vitest";
import { checkWebRTCSupport } from "./WebRTCCheck";

describe("WebRTCCheck", () => {
  afterEach(() => {
    vi.restoreAllMocks();
  });

  it("returns false when RTCPeerConnection is not available", async () => {
    vi.stubGlobal("window", {});

    const result = await checkWebRTCSupport();
    expect(result).toBe(false);
  });

  it("returns true when ICE candidate is generated", async () => {
    vi.useFakeTimers();

    class MockPeerConnection {
      onicecandidate: ((e: any) => void) | null = null;
      createDataChannel = vi.fn();
      close = vi.fn();
      async createOffer() { return { type: "offer", sdp: "mock" }; }
      async setLocalDescription() {
        setTimeout(() => {
          this.onicecandidate?.({ candidate: { candidate: "mock" } });
        }, 10);
      }
    }

    vi.stubGlobal("window", { RTCPeerConnection: MockPeerConnection });
    vi.stubGlobal("RTCPeerConnection", MockPeerConnection);

    const promise = checkWebRTCSupport();
    await vi.advanceTimersByTimeAsync(50);
    const result = await promise;

    expect(result).toBe(true);
    vi.useRealTimers();
  });

  it("returns false when no ICE candidates appear", async () => {
    vi.useFakeTimers();

    class MockPeerConnection {
      onicecandidate: ((e: any) => void) | null = null;
      createDataChannel = vi.fn();
      close = vi.fn();
      async createOffer() { return { type: "offer", sdp: "mock" }; }
      async setLocalDescription() {
        setTimeout(() => {
          this.onicecandidate?.({ candidate: null });
        }, 10);
      }
    }

    vi.stubGlobal("window", { RTCPeerConnection: MockPeerConnection });
    vi.stubGlobal("RTCPeerConnection", MockPeerConnection);

    const promise = checkWebRTCSupport();
    await vi.advanceTimersByTimeAsync(50);
    const result = await promise;

    expect(result).toBe(false);
    vi.useRealTimers();
  });

  it("returns false when createOffer throws", async () => {
    const mockPC = {
      createDataChannel: vi.fn(),
      createOffer: vi.fn().mockRejectedValue(new Error("not supported")),
      close: vi.fn(),
    };

    vi.stubGlobal("window", {
      RTCPeerConnection: vi.fn(() => mockPC),
    });
    vi.stubGlobal("RTCPeerConnection", vi.fn(() => mockPC));

    const result = await checkWebRTCSupport();
    expect(result).toBe(false);
  });
});
