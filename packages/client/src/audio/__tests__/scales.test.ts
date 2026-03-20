// @vitest-environment happy-dom
import { describe, it, expect } from "vitest";
import {
  getScaleNotes,
  getScaleNotesInOctave,
  getScaleNotesInRange,
  type ScaleType,
} from "../music/scales";
import {
  GM_INSTRUMENTS,
  SOUNDFONT_BASE,
  type InstrumentKey,
  type TrackDefinition,
  type StemDefinition,
} from "../music/types";

describe("scales", () => {
  describe("getScaleNotes", () => {
    it("returns correct notes for C major", () => {
      expect(getScaleNotes("c_major")).toEqual([
        "C",
        "D",
        "E",
        "F",
        "G",
        "A",
        "B",
      ]);
    });

    it("returns correct notes for D dorian", () => {
      expect(getScaleNotes("d_dorian")).toEqual([
        "D",
        "E",
        "F",
        "G",
        "A",
        "B",
        "C",
      ]);
    });

    it("returns correct notes for D phrygian dominant", () => {
      // D Phrygian Dominant: D Eb F# G A Bb C (flat notation: Gb for F#)
      expect(getScaleNotes("d_phrygian_dominant")).toEqual([
        "D",
        "Eb",
        "Gb",
        "G",
        "A",
        "Bb",
        "C",
      ]);
    });

    it("returns correct notes for E lydian", () => {
      // E Lydian: E F# G# A# B C# D# (flat notation: Gb Ab Bb Db Eb)
      expect(getScaleNotes("e_lydian")).toEqual([
        "E",
        "Gb",
        "Ab",
        "Bb",
        "B",
        "Db",
        "Eb",
      ]);
    });

    it("returns correct notes for C mixolydian", () => {
      expect(getScaleNotes("c_mixolydian")).toEqual([
        "C",
        "D",
        "E",
        "F",
        "G",
        "A",
        "Bb",
      ]);
    });

    it("returns correct notes for A dorian", () => {
      expect(getScaleNotes("a_dorian")).toEqual([
        "A",
        "B",
        "C",
        "D",
        "E",
        "Gb",
        "G",
      ]);
    });

    it("returns correct notes for G major", () => {
      expect(getScaleNotes("g_major")).toEqual([
        "G",
        "A",
        "B",
        "C",
        "D",
        "E",
        "Gb",
      ]);
    });

    it("returns correct notes for B diminished", () => {
      const notes = getScaleNotes("b_diminished");
      expect(notes).toEqual([
        "B",
        "C",
        "D",
        "Eb",
        "F",
        "Gb",
        "Ab",
        "A",
      ]);
    });

    it("returns atonal tension subset", () => {
      expect(getScaleNotes("atonal_tension")).toEqual([
        "C",
        "Db",
        "E",
        "Gb",
        "A",
        "Bb",
      ]);
    });

    it("never uses sharp notation in any scale", () => {
      const allScaleTypes: ScaleType[] = [
        "c_major",
        "c_mixolydian",
        "d_dorian",
        "d_lydian",
        "a_dorian",
        "g_major",
        "g_mixolydian",
        "g_ionian",
        "e_lydian",
        "d_minor",
        "d_phrygian_dominant",
        "b_diminished",
        "f_sharp_minor",
        "e_minor",
        "c_sharp_minor",
        "atonal_tension",
      ];
      for (const scale of allScaleTypes) {
        const notes = getScaleNotes(scale);
        for (const note of notes) {
          expect(note).not.toContain("#");
        }
      }
    });
  });

  describe("getScaleNotesInOctave", () => {
    it("returns notes with octave numbers for C major octave 4", () => {
      expect(getScaleNotesInOctave("c_major", 4)).toEqual([
        "C4",
        "D4",
        "E4",
        "F4",
        "G4",
        "A4",
        "B4",
      ]);
    });

    it("returns notes with octave numbers for D dorian octave 3", () => {
      expect(getScaleNotesInOctave("d_dorian", 3)).toEqual([
        "D3",
        "E3",
        "F3",
        "G3",
        "A3",
        "B3",
        "C3",
      ]);
    });
  });

  describe("getScaleNotesInRange", () => {
    it("returns notes across multiple octaves", () => {
      const notes = getScaleNotesInRange("c_major", 4, 5);
      expect(notes).toEqual([
        "C4",
        "D4",
        "E4",
        "F4",
        "G4",
        "A4",
        "B4",
        "C5",
        "D5",
        "E5",
        "F5",
        "G5",
        "A5",
        "B5",
      ]);
    });

    it("returns single octave when start equals end", () => {
      const notes = getScaleNotesInRange("c_major", 4, 4);
      expect(notes).toEqual([
        "C4",
        "D4",
        "E4",
        "F4",
        "G4",
        "A4",
        "B4",
      ]);
    });
  });
});

describe("types", () => {
  it("GM_INSTRUMENTS maps all needed instrument keys", () => {
    const expectedKeys: InstrumentKey[] = [
      "acousticGuitar",
      "flute",
      "cello",
      "harp",
      "oboe",
      "panFlute",
      "dulcimer",
      "bagpipe",
      "choirAahs",
      "trumpet",
      "trombone",
      "tuba",
      "frenchHorn",
      "violin",
      "marimba",
      "sitar",
      "shanai",
      "pennywhistle",
    ];
    for (const key of expectedKeys) {
      expect(GM_INSTRUMENTS[key]).toBeDefined();
      expect(typeof GM_INSTRUMENTS[key]).toBe("string");
    }
  });

  it("GM_INSTRUMENTS maps to valid GM soundfont directory names", () => {
    expect(GM_INSTRUMENTS.acousticGuitar).toBe("acoustic_guitar_nylon");
    expect(GM_INSTRUMENTS.flute).toBe("flute");
    expect(GM_INSTRUMENTS.cello).toBe("cello");
    expect(GM_INSTRUMENTS.harp).toBe("orchestral_harp");
    expect(GM_INSTRUMENTS.pennywhistle).toBe("piccolo");
    expect(GM_INSTRUMENTS.shanai).toBe("shanai");
    expect(GM_INSTRUMENTS.bagpipe).toBe("bagpipe");
  });

  it("SOUNDFONT_BASE is the correct CDN URL", () => {
    expect(SOUNDFONT_BASE).toBe(
      "https://gleitz.github.io/midi-js-soundfonts/FluidR3_GM/"
    );
  });

  it("TrackDefinition interface can be used to define a track", () => {
    // This is a type-level test — if the interface is wrong, this won't compile
    const _track: TrackDefinition = {
      id: "test",
      state: "exploring" as any,
      baseBPM: 120,
      bpmDrift: 2,
      scaleType: "c_major",
      phraseLength: 4,
      stems: [],
      phrasePool: [["C4", "D4", "E4"]],
      hasProximityStems: false,
    };
    expect(_track.id).toBe("test");
  });

  it("StemDefinition interface can be used to define a stem", () => {
    const _stem: StemDefinition = {
      name: "guitar",
      instrumentKeys: ["acousticGuitar"],
    };
    expect(_stem.name).toBe("guitar");
  });
});
