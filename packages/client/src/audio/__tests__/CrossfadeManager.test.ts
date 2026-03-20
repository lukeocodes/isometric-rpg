import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";

// Mock tone module
const mockSchedule = vi.fn(() => 42);
const mockClear = vi.fn();
const mockTransport = {
  schedule: mockSchedule,
  clear: mockClear,
};

const mockLinearRampTo = vi.fn();
const mockCrossFadeDispose = vi.fn();
const mockCrossFade = {
  fade: { linearRampTo: mockLinearRampTo, value: 0 },
  a: { name: "crossfade-a" },
  b: { name: "crossfade-b" },
  dispose: mockCrossFadeDispose,
};

const mockSynthConnect = vi.fn();
const mockSynthTriggerAttack = vi.fn();
const mockSynthTriggerRelease = vi.fn();
const mockSynthDispose = vi.fn();

const mockConnect = vi.fn();

vi.mock("tone", () => {
  return {
    CrossFade: vi.fn(() => ({ ...mockCrossFade })),
    getTransport: vi.fn(() => mockTransport),
    connect: vi.fn((...args: unknown[]) => mockConnect(...args)),
    Synth: vi.fn(() => ({
      connect: mockSynthConnect,
      triggerAttack: mockSynthTriggerAttack,
      triggerRelease: mockSynthTriggerRelease,
      dispose: mockSynthDispose,
    })),
  };
});

import { CrossfadeManager } from "../CrossfadeManager";
import { MusicState, CROSSFADE_DURATIONS } from "../types";
import type { GainBus } from "../GainBus";

function createMockGainBus(): GainBus {
  return {
    node: { name: "mock-music-bus" } as unknown as GainNode,
    volume: 1.0,
    setVolume: vi.fn(),
    mute: vi.fn(),
    unmute: vi.fn(),
    fadeTo: vi.fn(),
    disconnect: vi.fn(),
  } as unknown as GainBus;
}

describe("CrossfadeManager", () => {
  let manager: CrossfadeManager;
  let mockBus: GainBus;

  beforeEach(() => {
    vi.clearAllMocks();
    mockBus = createMockGainBus();
    manager = new CrossfadeManager(mockBus);
  });

  afterEach(() => {
    manager.dispose();
  });

  describe("constructor", () => {
    it("creates a CrossFade node and connects it to the music bus", () => {
      // CrossFade was instantiated
      const Tone = require("tone");
      expect(Tone.CrossFade).toHaveBeenCalledWith(0);
      // connect was called to bridge CrossFade output to music bus
      expect(Tone.connect).toHaveBeenCalled();
    });
  });

  describe("transition", () => {
    it("schedules a crossfade quantized to the next bar boundary (@1m)", () => {
      manager.transition(MusicState.Exploring, MusicState.Town);

      expect(mockSchedule).toHaveBeenCalledWith(expect.any(Function), "@1m");
    });

    it("uses CROSSFADE_DURATIONS to look up duration by key", () => {
      manager.transition(MusicState.Exploring, MusicState.Town);

      const pending = manager.getScheduledTransition();
      expect(pending).not.toBeNull();
      expect(pending!.from).toBe(MusicState.Exploring);
      expect(pending!.to).toBe(MusicState.Town);
      expect(pending!.duration).toBe(CROSSFADE_DURATIONS["exploring_to_town"]);
    });

    it("falls back to default duration for unknown transition keys", () => {
      manager.transition(MusicState.Dungeon, MusicState.Boss);

      const pending = manager.getScheduledTransition();
      expect(pending).not.toBeNull();
      expect(pending!.duration).toBe(CROSSFADE_DURATIONS["default"]);
    });

    it("stores the scheduledId from Transport.schedule", () => {
      manager.transition(MusicState.Exploring, MusicState.Town);

      const pending = manager.getScheduledTransition();
      expect(pending).not.toBeNull();
      expect(pending!.scheduledId).toBe(42);
    });

    it("cancels any previous pending transition before scheduling new one", () => {
      manager.transition(MusicState.Exploring, MusicState.Town);
      manager.transition(MusicState.Town, MusicState.Combat);

      // First transition scheduled then cleared, second scheduled
      expect(mockClear).toHaveBeenCalledWith(42);
      expect(mockSchedule).toHaveBeenCalledTimes(2);
    });
  });

  describe("getScheduledTransition", () => {
    it("returns null when no transition is pending", () => {
      expect(manager.getScheduledTransition()).toBeNull();
    });

    it("returns pending transition info after scheduling", () => {
      manager.transition(MusicState.EnemyNearby, MusicState.Combat);

      const pending = manager.getScheduledTransition();
      expect(pending).not.toBeNull();
      expect(pending!.from).toBe(MusicState.EnemyNearby);
      expect(pending!.to).toBe(MusicState.Combat);
      expect(pending!.duration).toBe(CROSSFADE_DURATIONS["enemy_nearby_to_combat"]);
    });
  });

  describe("cancelPending", () => {
    it("cancels a scheduled but not-yet-started transition", () => {
      manager.transition(MusicState.Exploring, MusicState.Town);
      manager.cancelPending();

      expect(mockClear).toHaveBeenCalledWith(42);
      expect(manager.getScheduledTransition()).toBeNull();
    });

    it("is a no-op when no transition is pending", () => {
      manager.cancelPending();
      expect(mockClear).not.toHaveBeenCalled();
    });
  });

  describe("getCrossFade", () => {
    it("returns the Tone.CrossFade node", () => {
      const crossFade = manager.getCrossFade();
      expect(crossFade).toBeDefined();
      expect(crossFade.a).toBeDefined();
      expect(crossFade.b).toBeDefined();
    });
  });

  describe("getCurrentSide", () => {
    it("starts on side 'a'", () => {
      expect(manager.getCurrentSide()).toBe("a");
    });
  });

  describe("test tone", () => {
    it("startTestTone('a') creates a synth connected to crossFade.a", () => {
      manager.startTestTone("a");

      const Tone = require("tone");
      expect(Tone.Synth).toHaveBeenCalled();
      expect(mockSynthConnect).toHaveBeenCalled();
      expect(mockSynthTriggerAttack).toHaveBeenCalledWith(440);
    });

    it("startTestTone('b') creates a synth connected to crossFade.b at 330Hz", () => {
      manager.startTestTone("b");

      expect(mockSynthTriggerAttack).toHaveBeenCalledWith(330);
    });

    it("stopTestTone('a') releases and disposes the synth", () => {
      manager.startTestTone("a");
      manager.stopTestTone("a");

      expect(mockSynthTriggerRelease).toHaveBeenCalled();
      expect(mockSynthDispose).toHaveBeenCalled();
    });

    it("stopTestTone('b') when no synth exists is a no-op", () => {
      manager.stopTestTone("b");
      expect(mockSynthTriggerRelease).not.toHaveBeenCalled();
    });
  });

  describe("dispose", () => {
    it("cancels pending transitions", () => {
      manager.transition(MusicState.Exploring, MusicState.Town);
      manager.dispose();

      expect(mockClear).toHaveBeenCalledWith(42);
    });

    it("stops any active test tones", () => {
      manager.startTestTone("a");
      manager.startTestTone("b");
      manager.dispose();

      // Both synths should be released and disposed
      expect(mockSynthTriggerRelease).toHaveBeenCalledTimes(2);
      expect(mockSynthDispose).toHaveBeenCalledTimes(2);
    });

    it("disposes the CrossFade node", () => {
      manager.dispose();

      // The dispose method is called on the CrossFade instance
      const crossFade = manager.getCrossFade();
      expect(crossFade.dispose).toHaveBeenCalled();
    });
  });
});
