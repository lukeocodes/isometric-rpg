import * as Tone from "tone";
import { MusicState, CROSSFADE_DURATIONS } from "./types";
import type { GainBus } from "./GainBus";

export interface PendingTransition {
  from: MusicState;
  to: MusicState;
  duration: number;
  scheduledId: number;
}

export class CrossfadeManager {
  private musicBus: GainBus;
  private crossFade: Tone.CrossFade;
  private pending: PendingTransition | null = null;
  private testSynthA: Tone.Synth | null = null;
  private testSynthB: Tone.Synth | null = null;
  private currentSide: "a" | "b" = "a"; // which CrossFade input is active

  constructor(musicBus: GainBus) {
    this.musicBus = musicBus;

    // CrossFade routes between two inputs (a and b)
    // fade=0 means only A is heard, fade=1 means only B
    this.crossFade = new Tone.CrossFade(0);

    // Connect CrossFade output to music bus
    // Use Tone.connect to bridge Tone node -> Web Audio node
    Tone.connect(this.crossFade, this.musicBus.node);
  }

  /**
   * Schedule a crossfade transition quantized to the next bar boundary.
   * The transition fades from the current active side to the other side.
   */
  transition(from: MusicState, to: MusicState): void {
    // Cancel any pending transition first
    this.cancelPending();

    // Look up duration
    const key = `${from}_to_${to}`;
    const duration = CROSSFADE_DURATIONS[key] ?? CROSSFADE_DURATIONS["default"];

    // Target fade value: if currently on A (fade=0), fade to B (fade=1), and vice versa
    const targetFade = this.currentSide === "a" ? 1 : 0;

    const transport = Tone.getTransport();
    console.log(`[CrossfadeManager] Scheduling crossfade ${from}->${to}: side ${this.currentSide}->${targetFade === 1 ? "b" : "a"}, duration=${duration}s, waiting for next bar...`);
    const scheduledId = transport.schedule((time: number) => {
      console.log(`[CrossfadeManager] Crossfade firing now: fade ${this.crossFade.fade.value} -> ${targetFade} over ${duration}s`);
      this.crossFade.fade.linearRampTo(targetFade, duration, time);
      // Flip active side after scheduling
      this.currentSide = targetFade === 1 ? "b" : "a";
      this.pending = null;
    }, "@1m"); // Quantize to next measure boundary

    this.pending = { from, to, duration, scheduledId };
  }

  getScheduledTransition(): PendingTransition | null {
    return this.pending;
  }

  cancelPending(): void {
    if (this.pending) {
      Tone.getTransport().clear(this.pending.scheduledId);
      this.pending = null;
    }
  }

  getCrossFade(): Tone.CrossFade {
    return this.crossFade;
  }

  getCurrentSide(): "a" | "b" {
    return this.currentSide;
  }

  /**
   * Start a test tone on one side of the CrossFade for verification.
   * Side "a" plays 440Hz, side "b" plays 330Hz.
   * Tones connect to their respective CrossFade inputs so crossfade
   * transitions audibly blend between them.
   * Call forceState() to trigger a crossfade and hear the blend.
   *
   * To hear a tone immediately regardless of crossfade position,
   * start the tone on the CURRENT side: getCrossfadeManager().getCurrentSide()
   */
  startTestTone(side: "a" | "b"): void {
    // Stop existing tone on this side first
    this.stopTestTone(side);

    const synth = new Tone.Synth({
      oscillator: { type: "sine" },
      envelope: { attack: 0.1, decay: 0.2, sustain: 0.5, release: 0.5 },
    });

    if (side === "a") {
      synth.connect(this.crossFade.a);
      this.testSynthA = synth;
      synth.triggerAttack(440); // A4
    } else {
      synth.connect(this.crossFade.b);
      this.testSynthB = synth;
      synth.triggerAttack(330); // E4
    }
  }

  stopTestTone(side: "a" | "b"): void {
    if (side === "a" && this.testSynthA) {
      this.testSynthA.triggerRelease();
      this.testSynthA.dispose();
      this.testSynthA = null;
    } else if (side === "b" && this.testSynthB) {
      this.testSynthB.triggerRelease();
      this.testSynthB.dispose();
      this.testSynthB = null;
    }
  }

  dispose(): void {
    this.cancelPending();
    this.stopTestTone("a");
    this.stopTestTone("b");
    this.crossFade.dispose();
  }
}
