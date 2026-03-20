import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";

// Mock tone module
vi.mock("tone", () => {
  const mockTransport = {
    bpm: { value: 120 },
    timeSignature: 4,
    state: "stopped",
    start: vi.fn(() => {
      mockTransport.state = "started";
    }),
  };

  const mockContext = {
    rawContext: null as unknown, // Will be set in beforeEach
    state: "suspended",
  };

  return {
    getTransport: vi.fn(() => mockTransport),
    getContext: vi.fn(() => mockContext),
    start: vi.fn(async () => {
      mockContext.state = "running";
    }),
    __mockTransport: mockTransport,
    __mockContext: mockContext,
  };
});

// Mock howler module
vi.mock("howler", () => ({
  Howler: {
    ctx: {},
    masterGain: {
      disconnect: vi.fn(),
      connect: vi.fn(),
    },
  },
}));

// Import after mocks
import { AudioSystem } from "../AudioSystem";
import * as Tone from "tone";

function createMockAudioContext() {
  const gainNodes: Array<{
    gain: {
      value: number;
      setValueAtTime: ReturnType<typeof vi.fn>;
      linearRampToValueAtTime: ReturnType<typeof vi.fn>;
    };
    connect: ReturnType<typeof vi.fn>;
    disconnect: ReturnType<typeof vi.fn>;
  }> = [];

  const ctx = {
    currentTime: 0,
    createGain() {
      const node = {
        gain: {
          value: 1,
          setValueAtTime: vi.fn(),
          linearRampToValueAtTime: vi.fn(),
        },
        connect: vi.fn(),
        disconnect: vi.fn(),
      };
      gainNodes.push(node);
      return node;
    },
    destination: { name: "destination" },
    _gainNodes: gainNodes,
  };

  return ctx;
}

describe("AudioSystem", () => {
  let system: AudioSystem;
  let mockCtx: ReturnType<typeof createMockAudioContext>;

  beforeEach(() => {
    vi.clearAllMocks();
    mockCtx = createMockAudioContext();
    // Wire mock context into Tone mock
    const toneMock = Tone as unknown as {
      __mockContext: { rawContext: unknown };
    };
    toneMock.__mockContext.rawContext = mockCtx;

    system = new AudioSystem();
    system.init();
  });

  afterEach(() => {
    system.dispose();
  });

  it("init() creates 4 gain buses (music, sfx, weather, ambient) + 1 master gain", () => {
    // 1 master gain + 4 bus gains = 5 createGain calls
    expect(mockCtx._gainNodes.length).toBe(5);

    // Verify all 4 buses are accessible
    expect(system.getBus("music")).toBeDefined();
    expect(system.getBus("sfx")).toBeDefined();
    expect(system.getBus("weather")).toBeDefined();
    expect(system.getBus("ambient")).toBeDefined();
  });

  it("getBus('music') returns the music GainBus instance", () => {
    const musicBus = system.getBus("music");
    expect(musicBus).toBeDefined();
    expect(musicBus.node).toBeDefined();
  });

  it("getBus('sfx') returns the sfx GainBus instance", () => {
    const sfxBus = system.getBus("sfx");
    expect(sfxBus).toBeDefined();
    expect(sfxBus.node).toBeDefined();
  });

  it("intensity setter (0.7) scales music bus gain", () => {
    system.intensity = 0.7;
    // Music bus gain node is index 1 (after master at 0)
    const musicGainNode = mockCtx._gainNodes[1];
    expect(
      musicGainNode.gain.linearRampToValueAtTime,
    ).toHaveBeenCalledWith(expect.any(Number), expect.any(Number));
    expect(system.intensity).toBe(0.7);
  });

  it("intensity setter clamps to 0.0-1.0 range", () => {
    system.intensity = 1.5;
    expect(system.intensity).toBe(1.0);

    system.intensity = -0.3;
    expect(system.intensity).toBe(0.0);
  });

  it("handles visibility change: hidden -> master gain ramps to ~10%", () => {
    // Simulate tab hidden
    Object.defineProperty(document, "hidden", {
      value: true,
      writable: true,
      configurable: true,
    });
    document.dispatchEvent(new Event("visibilitychange"));

    // Master gain is index 0
    const masterGainNode = mockCtx._gainNodes[0];
    const rampCalls = masterGainNode.gain.linearRampToValueAtTime.mock.calls;
    // Should ramp to masterVolume * 0.1 = 0.8 * 0.1 = 0.08
    const lastRampTarget = rampCalls[rampCalls.length - 1]?.[0];
    expect(lastRampTarget).toBeCloseTo(0.08, 2);
  });

  it("handles visibility change: visible -> master gain restores", () => {
    // First hide
    Object.defineProperty(document, "hidden", {
      value: true,
      writable: true,
      configurable: true,
    });
    document.dispatchEvent(new Event("visibilitychange"));

    // Then show
    Object.defineProperty(document, "hidden", {
      value: false,
      writable: true,
      configurable: true,
    });
    document.dispatchEvent(new Event("visibilitychange"));

    const masterGainNode = mockCtx._gainNodes[0];
    const rampCalls = masterGainNode.gain.linearRampToValueAtTime.mock.calls;
    // Should restore to masterVolume = 0.8
    const lastRampTarget = rampCalls[rampCalls.length - 1]?.[0];
    expect(lastRampTarget).toBeCloseTo(0.8, 2);
  });

  it("resume() calls Tone.start() to resume AudioContext", async () => {
    await system.resume();
    expect(Tone.start).toHaveBeenCalled();
    expect(system.isResumed()).toBe(true);
  });

  it("dispose() disconnects all buses and cleans up", () => {
    system.dispose();
    // All 5 gain nodes (master + 4 buses) should have disconnect called
    // 4 bus nodes via GainBus.disconnect() + 1 master node directly
    const disconnectCount = mockCtx._gainNodes.filter(
      (n) => n.disconnect.mock.calls.length > 0,
    ).length;
    expect(disconnectCount).toBe(5);
  });

  it("getBus throws for unknown bus name", () => {
    expect(() => system.getBus("invalid" as never)).toThrow("Unknown bus");
  });
});
