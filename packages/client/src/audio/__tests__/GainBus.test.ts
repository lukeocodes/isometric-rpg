import { describe, it, expect, vi, beforeEach } from "vitest";
import { GainBus } from "../GainBus";

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

  return ctx as unknown as AudioContext & {
    _gainNodes: typeof gainNodes;
  };
}

describe("GainBus", () => {
  let ctx: ReturnType<typeof createMockAudioContext>;
  let destination: AudioNode;

  beforeEach(() => {
    ctx = createMockAudioContext();
    destination = { name: "master" } as unknown as AudioNode;
  });

  it("creates a GainNode connected to the provided destination", () => {
    const bus = new GainBus(ctx as unknown as AudioContext, destination);
    expect(ctx._gainNodes.length).toBe(1);
    expect(ctx._gainNodes[0].connect).toHaveBeenCalledWith(destination);
    expect(bus.node).toBeDefined();
  });

  it("setVolume(0.5) sets gain value via linearRampToValueAtTime", () => {
    const bus = new GainBus(ctx as unknown as AudioContext, destination);
    bus.setVolume(0.5);
    const gainParam = ctx._gainNodes[0].gain;
    expect(gainParam.setValueAtTime).toHaveBeenCalled();
    expect(gainParam.linearRampToValueAtTime).toHaveBeenCalledWith(
      0.5,
      expect.any(Number),
    );
    expect(bus.volume).toBe(0.5);
  });

  it("mute() sets gain to 0", () => {
    const bus = new GainBus(ctx as unknown as AudioContext, destination);
    bus.setVolume(0.7);
    bus.mute();
    const gainParam = ctx._gainNodes[0].gain;
    expect(gainParam.linearRampToValueAtTime).toHaveBeenCalledWith(
      0,
      expect.any(Number),
    );
  });

  it("unmute() restores previous volume", () => {
    const bus = new GainBus(ctx as unknown as AudioContext, destination);
    bus.setVolume(0.7);
    bus.mute();
    bus.unmute();
    const gainParam = ctx._gainNodes[0].gain;
    // The last ramp call should restore to 0.7
    const rampCalls = gainParam.linearRampToValueAtTime.mock.calls;
    const lastCall = rampCalls[rampCalls.length - 1];
    expect(lastCall[0]).toBe(0.7);
  });

  it("fadeTo(targetVol, durationSec) schedules a linear ramp", () => {
    ctx.currentTime = 1.0;
    const bus = new GainBus(ctx as unknown as AudioContext, destination);
    bus.fadeTo(0.3, 2.0);
    const gainParam = ctx._gainNodes[0].gain;
    expect(gainParam.linearRampToValueAtTime).toHaveBeenCalledWith(0.3, 3.0);
    expect(bus.volume).toBe(0.3);
  });

  it("setVolume clamps values to 0.0-1.0 range", () => {
    const bus = new GainBus(ctx as unknown as AudioContext, destination);
    bus.setVolume(1.5);
    expect(bus.volume).toBe(1.0);
    bus.setVolume(-0.5);
    expect(bus.volume).toBe(0.0);
  });

  it("disconnect() disconnects the gain node", () => {
    const bus = new GainBus(ctx as unknown as AudioContext, destination);
    bus.disconnect();
    expect(ctx._gainNodes[0].disconnect).toHaveBeenCalled();
  });
});
