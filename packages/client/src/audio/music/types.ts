import { MusicState } from "../types";
import type { ScaleType } from "./scales";

/** All instrument keys used across tracks */
export type InstrumentKey =
  | "acousticGuitar"
  | "flute"
  | "cello"
  | "harp"
  | "oboe"
  | "panFlute"
  | "dulcimer"
  | "bagpipe"
  | "choirAahs"
  | "trumpet"
  | "trombone"
  | "tuba"
  | "frenchHorn"
  | "violin"
  | "marimba"
  | "sitar"
  | "shanai"
  | "pennywhistle";

/** Maps InstrumentKey to FluidR3_GM soundfont directory names */
export const GM_INSTRUMENTS: Record<InstrumentKey, string> = {
  acousticGuitar: "acoustic_guitar_nylon",
  flute: "flute",
  cello: "cello",
  harp: "orchestral_harp",
  oboe: "oboe",
  panFlute: "pan_flute",
  dulcimer: "dulcimer",
  bagpipe: "bagpipe",
  choirAahs: "choir_aahs",
  trumpet: "trumpet",
  trombone: "trombone",
  tuba: "tuba",
  frenchHorn: "french_horn",
  violin: "violin",
  marimba: "marimba",
  sitar: "sitar",
  shanai: "shanai",
  pennywhistle: "piccolo",
};

/** Base URL for the FluidR3_GM soundfont CDN */
export const SOUNDFONT_BASE =
  "https://gleitz.github.io/midi-js-soundfonts/FluidR3_GM/";

/** Definition for a single stem layer within a track */
export interface StemDefinition {
  name: string;
  instrumentKeys: InstrumentKey[];
  synthType?:
    | "pad"
    | "drone"
    | "kick"
    | "snare"
    | "hihat"
    | "cymbal"
    | "bass";
  triggerDistance?: number;
  fullDistance?: number;
  alwaysOn?: boolean;
}

/** Complete definition for a music track */
export interface TrackDefinition {
  id: string;
  state: MusicState;
  zoneTag?: string;
  baseBPM: number;
  bpmDrift: number;
  scaleType: ScaleType;
  phraseLength: number;
  stems: StemDefinition[];
  phrasePool: string[][];
  hasProximityStems: boolean;
}
