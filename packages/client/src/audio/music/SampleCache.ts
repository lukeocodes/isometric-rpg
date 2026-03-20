import * as Tone from "tone";
import { GM_INSTRUMENTS, SOUNDFONT_BASE, type InstrumentKey } from "./types";

/**
 * Sparse note set for memory efficiency.
 * Tone.Sampler interpolates between loaded samples,
 * so loading every major 3rd gives full chromatic coverage.
 */
const SPARSE_NOTES = ["C", "E", "Ab"];
// Note: FluidR3_GM uses "Ab" in its note names, which matches our sparse set
const OCTAVE_RANGE = [2, 3, 4, 5, 6];

function isSparseNote(noteName: string): boolean {
  for (const oct of OCTAVE_RANGE) {
    for (const note of SPARSE_NOTES) {
      if (noteName === `${note}${oct}`) return true;
    }
  }
  return false;
}

interface CacheEntry {
  sampler: Tone.Sampler;
  lastUsed: number;
}

/**
 * LRU cache for Tone.Sampler instances loaded from FluidR3_GM CDN.
 * Fetches the soundfont JS file (contains base64 data URIs for all notes),
 * picks sparse notes for memory efficiency, and creates Tone.Samplers.
 * Evicts least-recently-used instruments when exceeding max count.
 */
export class SampleCache {
  private cache = new Map<string, CacheEntry>();
  private inflight = new Map<string, Promise<Tone.Sampler>>();
  private maxInstruments: number;
  private accessCounter = 0;

  constructor(maxInstruments: number = 8) {
    this.maxInstruments = maxInstruments;
  }

  async loadInstrument(key: InstrumentKey): Promise<Tone.Sampler> {
    const cached = this.cache.get(key);
    if (cached) {
      cached.lastUsed = ++this.accessCounter;
      return cached.sampler;
    }

    const existing = this.inflight.get(key);
    if (existing) {
      return existing;
    }

    const promise = this.createSampler(key);
    this.inflight.set(key, promise);

    try {
      const sampler = await promise;

      if (this.cache.size >= this.maxInstruments) {
        this.evictLRU();
      }

      this.cache.set(key, {
        sampler,
        lastUsed: ++this.accessCounter,
      });

      return sampler;
    } finally {
      this.inflight.delete(key);
    }
  }

  getLoadedCount(): number {
    return this.cache.size;
  }

  isLoaded(key: InstrumentKey): boolean {
    return this.cache.has(key);
  }

  evictLRU(): void {
    let oldest: string | null = null;
    let oldestTime = Infinity;

    for (const [key, entry] of this.cache) {
      if (entry.lastUsed < oldestTime) {
        oldestTime = entry.lastUsed;
        oldest = key;
      }
    }

    if (oldest) {
      const entry = this.cache.get(oldest);
      if (entry) {
        entry.sampler.dispose();
      }
      this.cache.delete(oldest);
    }
  }

  disposeAll(): void {
    for (const [, entry] of this.cache) {
      entry.sampler.dispose();
    }
    this.cache.clear();
    this.inflight.clear();
  }

  private async createSampler(key: InstrumentKey): Promise<Tone.Sampler> {
    const gmName = GM_INSTRUMENTS[key];
    const jsUrl = `${SOUNDFONT_BASE}${gmName}-mp3.js`;

    // Fetch the soundfont JS file containing base64 data URIs
    const response = await fetch(jsUrl);
    if (!response.ok) {
      throw new Error(`Failed to load soundfont: ${jsUrl} (${response.status})`);
    }
    const jsText = await response.text();

    // Parse the JS: format is MIDI.Soundfont.instrument_name = { "C4": "data:audio/mp3;base64,...", ... }
    const allNotes = this.parseSoundfontJS(jsText);

    // Pick sparse notes for memory efficiency
    const urls: Record<string, string> = {};
    for (const [noteName, dataUri] of Object.entries(allNotes)) {
      if (isSparseNote(noteName)) {
        urls[noteName] = dataUri;
      }
    }

    // Fallback: if no sparse notes matched (unlikely), take first 15
    if (Object.keys(urls).length === 0) {
      const entries = Object.entries(allNotes);
      for (let i = 0; i < Math.min(15, entries.length); i++) {
        urls[entries[i][0]] = entries[i][1];
      }
    }

    return new Promise<Tone.Sampler>((resolve, reject) => {
      const sampler = new Tone.Sampler({
        urls,
        onload: () => resolve(sampler),
        onerror: (err: Error) => reject(err),
      });
    });
  }

  /**
   * Parse the soundfont JS file format:
   * `MIDI.Soundfont.instrument_name = { "C4": "data:audio/...", ... }`
   * Returns a Record<noteName, dataURI>.
   */
  private parseSoundfontJS(jsText: string): Record<string, string> {
    // Find the object literal between { and the final }
    const startIdx = jsText.indexOf("{");
    const endIdx = jsText.lastIndexOf("}");
    if (startIdx === -1 || endIdx === -1) {
      throw new Error("Invalid soundfont JS format");
    }

    const objText = jsText.slice(startIdx, endIdx + 1);

    // Use Function constructor to safely evaluate the object literal
    // (it's a simple key-value map of strings, no executable code)
    try {
      const parsed = new Function(`return ${objText}`)();
      return parsed as Record<string, string>;
    } catch {
      throw new Error("Failed to parse soundfont JS object");
    }
  }
}
