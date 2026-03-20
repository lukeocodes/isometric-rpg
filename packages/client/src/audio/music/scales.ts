/** All scale types used across the 16 tracks */
export type ScaleType =
  | "c_major"
  | "c_mixolydian"
  | "d_dorian"
  | "d_lydian"
  | "a_dorian"
  | "g_major"
  | "g_mixolydian"
  | "g_ionian"
  | "e_lydian"
  | "d_minor"
  | "d_phrygian_dominant"
  | "b_diminished"
  | "f_sharp_minor"
  | "e_minor"
  | "c_sharp_minor"
  | "atonal_tension";

/** Chromatic notes using flat notation (matches FluidR3_GM sample file naming) */
const CHROMATIC_NOTES = [
  "C",
  "Db",
  "D",
  "Eb",
  "E",
  "F",
  "Gb",
  "G",
  "Ab",
  "A",
  "Bb",
  "B",
] as const;

/** Interval patterns (semitone offsets from root) */
const INTERVALS = {
  major: [0, 2, 4, 5, 7, 9, 11],
  dorian: [0, 2, 3, 5, 7, 9, 10],
  phrygian: [0, 1, 3, 5, 7, 8, 10],
  lydian: [0, 2, 4, 6, 7, 9, 11],
  mixolydian: [0, 2, 4, 5, 7, 9, 10],
  aeolian: [0, 2, 3, 5, 7, 8, 10],
  locrian: [0, 1, 3, 5, 6, 8, 10],
  phrygian_dominant: [0, 1, 4, 5, 7, 8, 10],
  diminished: [0, 1, 3, 4, 6, 7, 9, 10],
} as const;

/** Root note index in CHROMATIC_NOTES for each scale type */
interface ScaleSpec {
  root: number;
  intervals: readonly number[];
}

const SCALE_SPECS: Record<ScaleType, ScaleSpec | null> = {
  c_major: { root: 0, intervals: INTERVALS.major },
  c_mixolydian: { root: 0, intervals: INTERVALS.mixolydian },
  d_dorian: { root: 2, intervals: INTERVALS.dorian },
  d_lydian: { root: 2, intervals: INTERVALS.lydian },
  a_dorian: { root: 9, intervals: INTERVALS.dorian },
  g_major: { root: 7, intervals: INTERVALS.major },
  g_mixolydian: { root: 7, intervals: INTERVALS.mixolydian },
  g_ionian: { root: 7, intervals: INTERVALS.major },
  e_lydian: { root: 4, intervals: INTERVALS.lydian },
  d_minor: { root: 2, intervals: INTERVALS.aeolian },
  d_phrygian_dominant: { root: 2, intervals: INTERVALS.phrygian_dominant },
  b_diminished: { root: 11, intervals: INTERVALS.diminished },
  f_sharp_minor: { root: 6, intervals: INTERVALS.aeolian },
  e_minor: { root: 4, intervals: INTERVALS.aeolian },
  c_sharp_minor: { root: 1, intervals: INTERVALS.aeolian },
  atonal_tension: null, // Special case
};

/** Tritone-heavy dissonant subset for atonal tension */
const ATONAL_TENSION_NOTES = ["C", "Db", "E", "Gb", "A", "Bb"];

/**
 * Returns note names (flat notation) for the given scale type.
 * Never uses sharp notation — all accidentals are flats.
 */
export function getScaleNotes(scaleType: ScaleType): string[] {
  if (scaleType === "atonal_tension") {
    return [...ATONAL_TENSION_NOTES];
  }

  const spec = SCALE_SPECS[scaleType];
  if (!spec) {
    throw new Error(`Unknown scale type: ${scaleType}`);
  }

  return spec.intervals.map(
    (interval) => CHROMATIC_NOTES[(spec.root + interval) % 12]
  );
}

/**
 * Returns note names with octave numbers for the given scale in a single octave.
 * E.g., getScaleNotesInOctave("c_major", 4) => ["C4", "D4", "E4", "F4", "G4", "A4", "B4"]
 */
export function getScaleNotesInOctave(
  scaleType: ScaleType,
  octave: number
): string[] {
  const notes = getScaleNotes(scaleType);
  return notes.map((note) => `${note}${octave}`);
}

/**
 * Returns all scale notes across an octave range (inclusive).
 * E.g., getScaleNotesInRange("c_major", 4, 5) => ["C4", "D4", ..., "B4", "C5", "D5", ..., "B5"]
 */
export function getScaleNotesInRange(
  scaleType: ScaleType,
  startOctave: number,
  endOctave: number
): string[] {
  const result: string[] = [];
  for (let oct = startOctave; oct <= endOctave; oct++) {
    result.push(...getScaleNotesInOctave(scaleType, oct));
  }
  return result;
}
