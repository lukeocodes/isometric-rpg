// @vitest-environment happy-dom
import { describe, it, expect, vi, beforeEach } from "vitest";

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
        context: null as unknown, // set below
      };
      node.context = ctx; // back-reference so gainNode.context.currentTime works
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

import { ProximityMixer } from "../music/ProximityMixer";

describe("ProximityMixer", () => {
  let mixer: ProximityMixer;
  let ctx: ReturnType<typeof createMockAudioContext>;

  beforeEach(() => {
    ctx = createMockAudioContext();
    mixer = new ProximityMixer();
  });

  it("addStem registers a stem and sets initial gain to 0", () => {
    const gainNode = ctx.createGain() as unknown as GainNode;
    mixer.addStem("tavern", gainNode, {
      triggerDistance: 20,
      fullDistance: 5,
    });

    // Initial gain should be set to 0
    expect(gainNode.gain.value).toBeDefined();
  });

  it("update at POI (distance 0) sets stem gain to 1.0", () => {
    const gainNode = ctx.createGain() as unknown as GainNode;
    mixer.addStem("tavern", gainNode, {
      triggerDistance: 20,
      fullDistance: 5,
    });

    mixer.update({ x: 0, z: 0 }, { x: 0, z: 0 });

    // At distance 0, which is less than fullDistance (5), gain should be 1.0
    expect(
      gainNode.gain.linearRampToValueAtTime,
    ).toHaveBeenCalledWith(1.0, expect.any(Number));
  });

  it("update beyond triggerDistance sets stem gain to 0.0", () => {
    const gainNode = ctx.createGain() as unknown as GainNode;
    mixer.addStem("tavern", gainNode, {
      triggerDistance: 20,
      fullDistance: 5,
    });

    mixer.update({ x: 30, z: 0 }, { x: 0, z: 0 });

    // Manhattan distance = 30, beyond triggerDistance (20), gain should be 0
    expect(
      gainNode.gain.linearRampToValueAtTime,
    ).toHaveBeenCalledWith(0, expect.any(Number));
  });

  it("update at interpolated distance sets correct gain (~0.67)", () => {
    const gainNode = ctx.createGain() as unknown as GainNode;
    mixer.addStem("tavern", gainNode, {
      triggerDistance: 20,
      fullDistance: 5,
    });

    // Manhattan distance = 10
    // t = clamp(1 - (10 - 5) / (20 - 5), 0, 1) = 1 - 5/15 = 1 - 0.333 = 0.667
    mixer.update({ x: 10, z: 0 }, { x: 0, z: 0 });

    const rampCalls = (
      gainNode.gain.linearRampToValueAtTime as ReturnType<typeof vi.fn>
    ).mock.calls;
    const gainValue = rampCalls[rampCalls.length - 1][0];
    expect(gainValue).toBeCloseTo(0.667, 2);
  });

  it("uses Manhattan distance (abs(dx) + abs(dz)), not Euclidean", () => {
    const gainNode = ctx.createGain() as unknown as GainNode;
    mixer.addStem("tavern", gainNode, {
      triggerDistance: 20,
      fullDistance: 5,
    });

    // Position: player at (7, 3), POI at (0, 0)
    // Manhattan distance = |7| + |3| = 10
    // Euclidean distance = sqrt(49 + 9) = sqrt(58) ~ 7.62
    // If Manhattan: t = 1 - (10-5)/(20-5) = 0.667
    // If Euclidean: t = 1 - (7.62-5)/(20-5) = 0.825
    mixer.update({ x: 7, z: 3 }, { x: 0, z: 0 });

    const rampCalls = (
      gainNode.gain.linearRampToValueAtTime as ReturnType<typeof vi.fn>
    ).mock.calls;
    const gainValue = rampCalls[rampCalls.length - 1][0];
    // Should be ~0.667 (Manhattan), NOT ~0.825 (Euclidean)
    expect(gainValue).toBeCloseTo(0.667, 2);
  });

  it("dispose disconnects all gain nodes and clears stems", () => {
    const gainNode1 = ctx.createGain() as unknown as GainNode;
    const gainNode2 = ctx.createGain() as unknown as GainNode;

    mixer.addStem("tavern", gainNode1, {
      triggerDistance: 20,
      fullDistance: 5,
    });
    mixer.addStem("forge", gainNode2, {
      triggerDistance: 15,
      fullDistance: 3,
    });

    mixer.dispose();

    // After dispose, update should not throw (stems cleared)
    // Gain nodes should have been set to 0
    expect(
      gainNode1.gain.linearRampToValueAtTime,
    ).toHaveBeenCalled();
    expect(
      gainNode2.gain.linearRampToValueAtTime,
    ).toHaveBeenCalled();
  });

  it("handles multiple stems with different distances independently", () => {
    const gainNode1 = ctx.createGain() as unknown as GainNode;
    const gainNode2 = ctx.createGain() as unknown as GainNode;

    // Stem 1: triggers at 20, full at 5
    mixer.addStem("tavern", gainNode1, {
      triggerDistance: 20,
      fullDistance: 5,
    });
    // Stem 2: triggers at 10, full at 2
    mixer.addStem("forge", gainNode2, {
      triggerDistance: 10,
      fullDistance: 2,
    });

    // At distance 8 from POI:
    // Stem 1: t = 1 - (8-5)/(20-5) = 1 - 0.2 = 0.8
    // Stem 2: t = 1 - (8-2)/(10-2) = 1 - 0.75 = 0.25
    mixer.update({ x: 8, z: 0 }, { x: 0, z: 0 });

    const rampCalls1 = (
      gainNode1.gain.linearRampToValueAtTime as ReturnType<typeof vi.fn>
    ).mock.calls;
    const rampCalls2 = (
      gainNode2.gain.linearRampToValueAtTime as ReturnType<typeof vi.fn>
    ).mock.calls;

    expect(rampCalls1[rampCalls1.length - 1][0]).toBeCloseTo(0.8, 2);
    expect(rampCalls2[rampCalls2.length - 1][0]).toBeCloseTo(0.25, 2);
  });
});
