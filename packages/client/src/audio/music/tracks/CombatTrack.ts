/**
 * Generic combat track — urgent, driving, adrenaline.
 * Scale: e_minor | BPM: 140 (base) | Instruments: violin + trumpet
 * Synths: aggressive percussion, bass pulse (square wave)
 * Special: updateEnemyCount() scales BPM 130-155 via bpm.rampTo()
 * No proximity stems.
 */
import * as Tone from "tone";
import { BaseTrack } from "../BaseTrack";
import { SampleCache } from "../SampleCache";
import { PhraseEngine } from "../PhraseEngine";

/** Fast eighth-note ostinato patterns from E minor — 2 bars each */
const PHRASE_POOL: (string | null)[][] = [
  // Phrase 1: Driving ascending run then hammering resolution
  ["E4", "G4", "B4", "E5", null, "D5", "B4", "G4", "E4", "Gb4", "G4", "B4", "D5", "E5", "D5", "B4"],
  // Phrase 2: Aggressive broken arpeggios with rests for impact
  ["B4", null, "E5", "D5", null, "B4", "G4", "E4", null, "G4", "B4", "D5", "E5", null, "D5", "B4"],
  // Phrase 3: Chromatic tension builder
  ["G4", "Gb4", "G4", "B4", "D5", "E5", null, "D5", "B4", "G4", "Gb4", "E4", null, "G4", "B4", "E5"],
  // Phrase 4: Syncopated stabs between runs
  ["E4", null, null, "G4", "B4", "E5", "D5", null, "B4", null, null, "G4", "E4", "Gb4", "G4", "B4"],
  // Phrase 5: Relentless sixteenth-feel with high point
  ["D5", "B4", "G4", "E4", "G4", "B4", "D5", "E5", "Gb5", "E5", "D5", "B4", "G4", "E4", "G4", "E4"],
  // Phrase 6: Dark descent with chromatic color
  ["E5", "D5", "B4", "G4", "Gb4", "E4", "G4", "Gb4", "E4", null, "G4", "B4", "D5", null, "E5", "D5"],
];

export class CombatTrack extends BaseTrack {
  private sampleCache: SampleCache;
  private phraseEngines: PhraseEngine[] = [];
  private savedBPM: number = 0;

  constructor(ctx: AudioContext, sampleCache: SampleCache) {
    super("combat", ctx);
    this.sampleCache = sampleCache;
  }

  async start(): Promise<void> {
    if (this.isPlaying) return;

    // Save original BPM to restore on stop
    this.savedBPM = Tone.getTransport().bpm.value;

    // Load instruments
    const violin = await this.sampleCache.loadInstrument("violin");
    const trumpet = await this.sampleCache.loadInstrument("trumpet");
    this.samplers.push(violin, trumpet);

    // Stem gain nodes
    const ostinatoStem = this.ctx.createGain();
    ostinatoStem.gain.value = 0.7;
    ostinatoStem.connect(this.output);

    const brassStem = this.ctx.createGain();
    brassStem.gain.value = 0.5;
    brassStem.connect(this.output);

    const percStem = this.ctx.createGain();
    percStem.gain.value = 0.55;
    percStem.connect(this.output);

    const bassStem = this.ctx.createGain();
    bassStem.gain.value = 0.4;
    bassStem.connect(this.output);

    // Fast violin ostinato
    const violinEngine = new PhraseEngine(PHRASE_POOL, "8n");
    this.phraseEngines.push(violinEngine);
    const violinSeq = violinEngine.createSequence(violin, 0.75);
    Tone.connect(violin, ostinatoStem);
    this.sequences.push(violinSeq);

    // Trumpet brass hits
    const trumpetPool: (string | null)[][] = [
      ["E5", null, null, "B4", null, null, "E5", null],
      [null, "G5", null, null, "E5", null, null, "B4"],
    ];
    const trumpetEngine = new PhraseEngine(trumpetPool, "8n");
    this.phraseEngines.push(trumpetEngine);
    const trumpetSeq = trumpetEngine.createSequence(trumpet, 0.65);
    Tone.connect(trumpet, brassStem);
    this.sequences.push(trumpetSeq);

    // Aggressive percussion: kick, snare, hihat (double time)
    const kick = new Tone.MembraneSynth({
      pitchDecay: 0.05,
      octaves: 5,
      envelope: { attack: 0.001, decay: 0.25, sustain: 0, release: 0.15 },
      volume: -6,
    });
    Tone.connect(kick, percStem);
    this.synthNodes.push(kick);

    const snare = new Tone.NoiseSynth({
      noise: { type: "white" },
      envelope: { attack: 0.001, decay: 0.1, sustain: 0, release: 0.04 },
      volume: -10,
    });
    Tone.connect(snare, percStem);
    this.synthNodes.push(snare);

    const hihat = new Tone.NoiseSynth({
      noise: { type: "white" },
      envelope: { attack: 0.001, decay: 0.02, sustain: 0, release: 0.01 },
      volume: -18,
    });
    Tone.connect(hihat, percStem);
    this.synthNodes.push(hihat);

    const percSeq = new Tone.Sequence(
      (time, step) => {
        if (step === 0 || step === 4) kick.triggerAttackRelease("C1", "8n", time);
        if (step === 2 || step === 6) snare.triggerAttackRelease("16n", time);
        hihat.triggerAttackRelease("32n", time); // every beat = double time feel
      },
      [0, 1, 2, 3, 4, 5, 6, 7],
      "8n"
    );
    percSeq.loop = true;
    this.sequences.push(percSeq);

    // Bass pulse (square wave)
    const bass = new Tone.Synth({
      oscillator: { type: "square" },
      envelope: { attack: 0.01, decay: 0.2, sustain: 0.3, release: 0.3 },
      volume: -14,
    });
    Tone.connect(bass, bassStem);
    this.synthNodes.push(bass);

    const bassSeq = new Tone.Sequence(
      (time, step) => {
        if (step === 0) bass.triggerAttackRelease("E2", "4n", time, 0.6);
        if (step === 4) bass.triggerAttackRelease("B1", "4n", time, 0.5);
      },
      [0, 1, 2, 3, 4, 5, 6, 7],
      "8n"
    );
    bassSeq.loop = true;
    this.sequences.push(bassSeq);

    // No proximity stems
    // hasProximityStems: false

    // Start all sequences
    for (const seq of this.sequences) {
      seq.start(0);
    }

    this.isPlaying = true;
  }

  /**
   * Scale BPM based on enemy count.
   * Range: 130 BPM (1 enemy) to 155 BPM (5+ enemies).
   * Formula: 130 + Math.min(4, Math.max(0, count - 1)) * 6.25
   */
  updateEnemyCount(count: number): void {
    const targetBPM = 130 + Math.min(4, Math.max(0, count - 1)) * 6.25;
    Tone.getTransport().bpm.rampTo(targetBPM, 2);
  }

  /**
   * Override stop to restore original Transport BPM.
   */
  stop(): void {
    super.stop();
    if (this.savedBPM > 0) {
      Tone.getTransport().bpm.rampTo(this.savedBPM, 1);
    }
  }
}
