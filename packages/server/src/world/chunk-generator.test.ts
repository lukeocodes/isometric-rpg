import { describe, it, expect } from "vitest";
import { generateChunkHeights } from "./chunk-generator.js";
import { initServerNoise } from "./terrain-noise.js";
import { CHUNK_SIZE } from "./constants.js";
import { BiomeType } from "./types.js";
import type { WorldMap } from "./types.js";

/** Create a minimal WorldMap stub for testing */
function createMockWorldMap(opts?: {
  elevation?: number;
  biome?: BiomeType;
  width?: number;
  height?: number;
}): WorldMap {
  const width = opts?.width ?? 10;
  const height = opts?.height ?? 10;
  const size = width * height;
  const elevation = new Float32Array(size).fill(opts?.elevation ?? 0.5);
  const biomeMap = new Uint8Array(size).fill(opts?.biome ?? BiomeType.TEMPERATE_GRASSLAND);

  return {
    seed: 42,
    width,
    height,
    continents: [],
    regions: [],
    landmask: new Uint8Array(size),
    elevation,
    moisture: new Float32Array(size),
    temperature: new Float32Array(size),
    regionMap: new Uint16Array(size),
    continentMap: new Uint8Array(size),
    biomeMap,
  };
}

describe("chunk-generator", () => {
  describe("generateChunkHeights", () => {
    it("returns a buffer of exactly CHUNK_SIZE * CHUNK_SIZE * 2 bytes (2048)", () => {
      const perm = initServerNoise(42);
      const worldMap = createMockWorldMap();
      const buf = generateChunkHeights(1, 1, worldMap, perm);
      expect(buf).toBeInstanceOf(Buffer);
      expect(buf.length).toBe(CHUNK_SIZE * CHUNK_SIZE * 2);
      expect(buf.length).toBe(2048);
    });

    it("is deterministic — same inputs produce bit-identical output", () => {
      const perm = initServerNoise(42);
      const worldMap = createMockWorldMap();
      const a = generateChunkHeights(3, 5, worldMap, perm);
      const b = generateChunkHeights(3, 5, worldMap, perm);
      expect(Buffer.compare(a, b)).toBe(0);
    });

    it("Float16 values are readable via DataView.getFloat16", () => {
      const perm = initServerNoise(42);
      const worldMap = createMockWorldMap({ elevation: 0.5, biome: BiomeType.TEMPERATE_GRASSLAND });
      const buf = generateChunkHeights(1, 1, worldMap, perm);
      const view = new DataView(buf.buffer, buf.byteOffset, buf.byteLength);

      // Read first and last Float16 values
      const first = view.getFloat16(0, true);
      const last = view.getFloat16((CHUNK_SIZE * CHUNK_SIZE - 1) * 2, true);
      expect(first).toBeTypeOf("number");
      expect(last).toBeTypeOf("number");
      expect(Number.isFinite(first)).toBe(true);
      expect(Number.isFinite(last)).toBe(true);
    });

    it("all Float16 values are finite numbers", () => {
      const perm = initServerNoise(42);
      const worldMap = createMockWorldMap();
      const buf = generateChunkHeights(2, 2, worldMap, perm);
      const view = new DataView(buf.buffer, buf.byteOffset, buf.byteLength);

      for (let i = 0; i < CHUNK_SIZE * CHUNK_SIZE; i++) {
        const val = view.getFloat16(i * 2, true);
        expect(Number.isFinite(val)).toBe(true);
      }
    });

    it("different biomes produce different height ranges", () => {
      const perm = initServerNoise(42);
      const grassMap = createMockWorldMap({ elevation: 0.5, biome: BiomeType.TEMPERATE_GRASSLAND });
      const mountainMap = createMockWorldMap({ elevation: 0.5, biome: BiomeType.MOUNTAIN });

      const grassBuf = generateChunkHeights(1, 1, grassMap, perm);
      const mountainBuf = generateChunkHeights(1, 1, mountainMap, perm);

      // Read all heights and compute range
      const readHeights = (buf: Buffer): number[] => {
        const view = new DataView(buf.buffer, buf.byteOffset, buf.byteLength);
        const heights: number[] = [];
        for (let i = 0; i < CHUNK_SIZE * CHUNK_SIZE; i++) {
          heights.push(view.getFloat16(i * 2, true));
        }
        return heights;
      };

      const grassHeights = readHeights(grassBuf);
      const mountainHeights = readHeights(mountainBuf);

      const grassRange = Math.max(...grassHeights) - Math.min(...grassHeights);
      const mountainRange = Math.max(...mountainHeights) - Math.min(...mountainHeights);

      // Mountains should have larger height variation
      expect(mountainRange).toBeGreaterThan(grassRange);
    });

    it("different chunk coordinates produce different buffers", () => {
      const perm = initServerNoise(42);
      const worldMap = createMockWorldMap();
      const a = generateChunkHeights(0, 0, worldMap, perm);
      const b = generateChunkHeights(5, 5, worldMap, perm);
      // Buffers should differ (different tile coordinates = different noise)
      expect(Buffer.compare(a, b)).not.toBe(0);
    });
  });
});
