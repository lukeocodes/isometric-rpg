// @vitest-environment happy-dom
import { describe, it, expect, vi, beforeEach } from "vitest";

// Mock tone module
vi.mock("tone", () => {
  class MockSampler {
    urls: Record<string, string>;
    baseUrl: string;
    triggerAttackRelease = vi.fn();
    releaseAll = vi.fn();
    dispose = vi.fn();
    connect = vi.fn(() => this);
    toDestination = vi.fn(() => this);

    constructor(opts: {
      urls: Record<string, string>;
      baseUrl: string;
      onload?: () => void;
      onerror?: (err: Error) => void;
    }) {
      this.urls = opts.urls;
      this.baseUrl = opts.baseUrl;
      if (opts.onload) opts.onload();
    }
  }

  class MockSequence {
    callback: (time: number, stepIndex: number) => void;
    events: number[];
    subdivision: string;
    loop = false;
    start = vi.fn(() => this);
    stop = vi.fn(() => this);
    dispose = vi.fn();

    constructor(
      callback: (time: number, stepIndex: number) => void,
      events: number[],
      subdivision: string
    ) {
      this.callback = callback;
      this.events = events;
      this.subdivision = subdivision;
    }
  }

  class MockSynth {
    triggerAttackRelease = vi.fn();
    triggerRelease = vi.fn();
    dispose = vi.fn();
    connect = vi.fn(() => this);
    volume = { value: 0 };
    constructor(_opts?: any) {}
  }

  class MockFMSynth extends MockSynth {}
  class MockMembraneSynth extends MockSynth {}
  class MockNoiseSynth extends MockSynth {
    triggerAttackRelease = vi.fn();
  }
  class MockPolySynth extends MockSynth {
    releaseAll = vi.fn();
    constructor(_Voice?: any, _opts?: any) {
      super(_opts);
    }
  }
  class MockMetalSynth extends MockSynth {}

  const mockTransport = {
    bpm: {
      value: 135,
      rampTo: vi.fn(),
    },
  };

  return {
    Sampler: MockSampler,
    Sequence: MockSequence,
    Synth: MockSynth,
    FMSynth: MockFMSynth,
    MembraneSynth: MockMembraneSynth,
    NoiseSynth: MockNoiseSynth,
    PolySynth: MockPolySynth,
    MetalSynth: MockMetalSynth,
    connect: vi.fn(),
    getTransport: () => mockTransport,
    Part: class MockPart {
      callback: any;
      loop = false;
      start = vi.fn(() => this);
      stop = vi.fn(() => this);
      dispose = vi.fn();
      constructor(callback: any, _events?: any) {
        this.callback = callback;
      }
    },
  };
});

import { BossFightTrack } from "../music/tracks/BossFightTrack";
import { SampleCache } from "../music/SampleCache";

describe("BossFightTrack", () => {
  let track: BossFightTrack;
  let sampleCache: SampleCache;
  let ctx: AudioContext;

  beforeEach(async () => {
    vi.clearAllMocks();

    // Create a minimal AudioContext mock for happy-dom
    ctx = {
      currentTime: 0,
      createGain: () => ({
        gain: {
          value: 1.0,
          setValueAtTime: vi.fn(),
          linearRampToValueAtTime: vi.fn(),
        },
        connect: vi.fn(),
        disconnect: vi.fn(),
      }),
    } as unknown as AudioContext;

    sampleCache = new SampleCache(12);
    track = new BossFightTrack(ctx, sampleCache);
  });

  it("constructor sets up with boss-fight id", () => {
    expect(track.id).toBe("boss-fight");
  });

  it("has updateBossPhase method", () => {
    expect(typeof track.updateBossPhase).toBe("function");
  });

  describe("after start()", () => {
    beforeEach(async () => {
      await track.start();
    });

    it("is active after starting", () => {
      expect(track.isActive()).toBe(true);
    });

    it("updateBossPhase(0.8) keeps only phase 1 stems active (orchestra + drums)", () => {
      track.updateBossPhase(0.8);
      // Phase 1: HP > 60% — orchestra + drums at full, choir + distortion at 0
      const phases = track.getPhaseState();
      expect(phases.currentPhase).toBe(1);
      expect(phases.choirGain).toBe(0);
      expect(phases.distortionGain).toBe(0);
    });

    it("updateBossPhase(0.45) activates phase 2 stems (adds choir + distortion)", () => {
      track.updateBossPhase(0.45);
      // Phase 2: HP 30-60% — choir and distortion fade in
      const phases = track.getPhaseState();
      expect(phases.currentPhase).toBe(2);
      expect(phases.choirGain).toBeGreaterThan(0);
      expect(phases.distortionGain).toBeGreaterThan(0);
    });

    it("updateBossPhase(0.15) activates phase 3 (all + enrage tempo)", () => {
      track.updateBossPhase(0.15);
      // Phase 3: HP < 30% — all stems max + tempo shift
      const phases = track.getPhaseState();
      expect(phases.currentPhase).toBe(3);
      expect(phases.choirGain).toBeGreaterThan(0);
      expect(phases.distortionGain).toBeGreaterThan(0);
    });

    it("phase transitions use 3-second ramp on stem gain nodes", () => {
      track.updateBossPhase(0.45);
      // The gains should have been set using ramp calls with 3s duration
      const phases = track.getPhaseState();
      expect(phases.rampDuration).toBe(3);
    });

    it("3 HP threshold phases are defined (>0.6, 0.3-0.6, <0.3)", () => {
      // Phase 1 at > 60%
      track.updateBossPhase(0.7);
      expect(track.getPhaseState().currentPhase).toBe(1);

      // Phase 2 at 30-60%
      track.updateBossPhase(0.5);
      expect(track.getPhaseState().currentPhase).toBe(2);

      // Phase 3 at < 30%
      track.updateBossPhase(0.2);
      expect(track.getPhaseState().currentPhase).toBe(3);
    });

    it("phase 3 triggers BPM ramp to 160", () => {
      const Tone = require("tone");
      const transport = Tone.getTransport();
      track.updateBossPhase(0.15);
      expect(transport.bpm.rampTo).toHaveBeenCalledWith(160, 3);
    });
  });
});
