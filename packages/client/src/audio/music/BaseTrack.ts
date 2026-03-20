/**
 * BaseTrack provides the standard lifecycle (start/stop/connect/dispose) that
 * all music tracks extend. It manages sampler, sequence, and synth disposal
 * automatically. Tracks with proximity-based stems create a ProximityMixer.
 */
import * as Tone from "tone";
import { ProximityMixer } from "./ProximityMixer";

export abstract class BaseTrack {
  readonly id: string;
  protected output: GainNode;
  protected ctx: AudioContext;
  protected isPlaying: boolean = false;
  protected proximityMixer: ProximityMixer | null = null;
  protected samplers: Tone.Sampler[] = [];
  protected sequences: Tone.Sequence[] = [];
  protected synthNodes: Tone.ToneAudioNode[] = [];

  constructor(id: string, ctx: AudioContext) {
    this.id = id;
    this.ctx = ctx;
    this.output = ctx.createGain();
    this.output.gain.value = 1.0;
  }

  /**
   * Connect this track's output to a destination (e.g., CrossFade side).
   * Uses Tone.connect to bridge Web Audio GainNode to Tone InputNode.
   */
  connect(destination: Tone.InputNode): void {
    Tone.connect(this.output, destination);
  }

  /**
   * Subclasses create samplers, synths, sequences, connect to output, and
   * start sequences. Must set isPlaying = true when done.
   */
  abstract start(): Promise<void>;

  /**
   * Stop all sequences and release all samplers/synths.
   * Sets isPlaying to false.
   */
  stop(): void {
    for (const seq of this.sequences) {
      try {
        seq.stop();
      } catch {
        // Sequence may not be started
      }
    }

    for (const sampler of this.samplers) {
      try {
        sampler.releaseAll();
      } catch {
        // Sampler may already be disposed
      }
    }

    for (const synth of this.synthNodes) {
      try {
        if ("releaseAll" in synth && typeof synth.releaseAll === "function") {
          (synth as Tone.PolySynth).releaseAll();
        } else if (
          "triggerRelease" in synth &&
          typeof synth.triggerRelease === "function"
        ) {
          (synth as Tone.Synth).triggerRelease();
        }
      } catch {
        // Synth may already be disposed
      }
    }

    this.isPlaying = false;
  }

  /**
   * Full cleanup: stop playback, dispose all Tone nodes, disconnect output,
   * dispose proximity mixer.
   */
  dispose(): void {
    this.stop();

    for (const sampler of this.samplers) {
      try {
        sampler.dispose();
      } catch {
        // Already disposed
      }
    }
    this.samplers = [];

    for (const seq of this.sequences) {
      try {
        seq.dispose();
      } catch {
        // Already disposed
      }
    }
    this.sequences = [];

    for (const synth of this.synthNodes) {
      try {
        synth.dispose();
      } catch {
        // Already disposed
      }
    }
    this.synthNodes = [];

    try {
      this.output.disconnect();
    } catch {
      // Already disconnected
    }

    this.proximityMixer?.dispose();
    this.proximityMixer = null;
  }

  /**
   * Update proximity-based stem fading if this track has a ProximityMixer.
   */
  updateProximity(
    playerPos: { x: number; z: number },
    poi: { x: number; z: number },
  ): void {
    this.proximityMixer?.update(playerPos, poi);
  }

  /**
   * Returns the output GainNode for this track.
   */
  getOutput(): GainNode {
    return this.output;
  }

  /**
   * Returns whether this track is currently playing.
   */
  isActive(): boolean {
    return this.isPlaying;
  }
}
