import { describe, it, expect } from "vitest";
import {
  initServerNoise,
  noise2d,
  generateTileHeight,
  CONTINENTAL_SCALE,
  BIOME_TERRAIN_PROFILES,
  DEFAULT_TERRAIN_PROFILE,
} from "./terrain-noise.js";
import { BiomeType } from "./types.js";

describe("terrain-noise", () => {
  describe("initServerNoise", () => {
    it("returns a 512-element Uint8Array", () => {
      const perm = initServerNoise(42);
      expect(perm).toBeInstanceOf(Uint8Array);
      expect(perm.length).toBe(512);
    });

    it("is deterministic — same seed produces identical permutation table", () => {
      const a = initServerNoise(42);
      const b = initServerNoise(42);
      expect(a).toEqual(b);
    });

    it("different seeds produce different permutation tables", () => {
      const a = initServerNoise(42);
      const b = initServerNoise(99);
      // Arrays should differ somewhere
      let differs = false;
      for (let i = 0; i < 512; i++) {
        if (a[i] !== b[i]) { differs = true; break; }
      }
      expect(differs).toBe(true);
    });

    it("second half mirrors first half (perm[i] === perm[i & 255])", () => {
      const perm = initServerNoise(42);
      for (let i = 256; i < 512; i++) {
        expect(perm[i]).toBe(perm[i - 256]);
      }
    });
  });

  describe("noise2d", () => {
    it("returns values approximately in [-1, 1]", () => {
      const perm = initServerNoise(42);
      const values: number[] = [];
      for (let x = 0; x < 100; x++) {
        for (let y = 0; y < 100; y++) {
          values.push(noise2d(x * 0.1, y * 0.1, perm));
        }
      }
      const min = Math.min(...values);
      const max = Math.max(...values);
      expect(min).toBeGreaterThanOrEqual(-1.1);
      expect(max).toBeLessThanOrEqual(1.1);
      // Should have actual variation (not all zeros)
      expect(max - min).toBeGreaterThan(0.5);
    });

    it("is deterministic — same inputs produce same output", () => {
      const perm = initServerNoise(42);
      const a = noise2d(10.5, 20.3, perm);
      const b = noise2d(10.5, 20.3, perm);
      expect(a).toBe(b);
    });
  });

  describe("CONTINENTAL_SCALE", () => {
    it("equals 8.0", () => {
      expect(CONTINENTAL_SCALE).toBe(8.0);
    });
  });

  describe("BIOME_TERRAIN_PROFILES", () => {
    it("has entries for all 18 biome types (0-17)", () => {
      for (let i = 0; i <= 17; i++) {
        expect(BIOME_TERRAIN_PROFILES[i]).toBeDefined();
        expect(BIOME_TERRAIN_PROFILES[i].amplitude).toBeTypeOf("number");
        expect(BIOME_TERRAIN_PROFILES[i].frequency).toBeTypeOf("number");
        expect(BIOME_TERRAIN_PROFILES[i].octaves).toBeTypeOf("number");
      }
    });

    it("mountains have amplitude 3.5", () => {
      expect(BIOME_TERRAIN_PROFILES[BiomeType.MOUNTAIN].amplitude).toBe(3.5);
    });

    it("snow peaks have amplitude 4.5 and frequency 0.14", () => {
      expect(BIOME_TERRAIN_PROFILES[BiomeType.SNOW_PEAK].amplitude).toBe(4.5);
      expect(BIOME_TERRAIN_PROFILES[BiomeType.SNOW_PEAK].frequency).toBe(0.14);
    });

    it("grassland amplitude is gentle (0.7)", () => {
      expect(BIOME_TERRAIN_PROFILES[BiomeType.TEMPERATE_GRASSLAND].amplitude).toBe(0.7);
    });

    it("water biomes stay nearly flat", () => {
      expect(BIOME_TERRAIN_PROFILES[BiomeType.DEEP_OCEAN].amplitude).toBeLessThanOrEqual(0.1);
      expect(BIOME_TERRAIN_PROFILES[BiomeType.SHALLOW_OCEAN].amplitude).toBeLessThanOrEqual(0.15);
      expect(BIOME_TERRAIN_PROFILES[BiomeType.RIVER].amplitude).toBeLessThanOrEqual(0.1);
      expect(BIOME_TERRAIN_PROFILES[BiomeType.LAKE].amplitude).toBeLessThanOrEqual(0.15);
    });

    it("swamp and beach are low amplitude", () => {
      expect(BIOME_TERRAIN_PROFILES[BiomeType.SWAMP].amplitude).toBeLessThanOrEqual(0.2);
      expect(BIOME_TERRAIN_PROFILES[BiomeType.BEACH].amplitude).toBeLessThanOrEqual(0.2);
    });
  });

  describe("DEFAULT_TERRAIN_PROFILE", () => {
    it("is a reasonable fallback", () => {
      expect(DEFAULT_TERRAIN_PROFILE.amplitude).toBe(0.3);
      expect(DEFAULT_TERRAIN_PROFILE.frequency).toBe(0.06);
      expect(DEFAULT_TERRAIN_PROFILE.octaves).toBe(2);
    });
  });

  describe("generateTileHeight", () => {
    it("returns positive values for land biomes with positive elevation", () => {
      const perm = initServerNoise(42);
      const height = generateTileHeight(100, 100, 0.5, BiomeType.TEMPERATE_GRASSLAND, perm);
      expect(height).toBeGreaterThan(0);
    });

    it("is deterministic — same inputs produce same output", () => {
      const perm = initServerNoise(42);
      const a = generateTileHeight(50, 75, 0.6, BiomeType.MOUNTAIN, perm);
      const b = generateTileHeight(50, 75, 0.6, BiomeType.MOUNTAIN, perm);
      expect(a).toBe(b);
    });

    it("continental base scales with CONTINENTAL_SCALE", () => {
      const perm = initServerNoise(42);
      // At zero tile position, noise should be small, so height is approximately continentalElev * 8
      const h1 = generateTileHeight(0, 0, 0.5, BiomeType.DEEP_OCEAN, perm);
      const h2 = generateTileHeight(0, 0, 1.0, BiomeType.DEEP_OCEAN, perm);
      // Difference should be approximately 0.5 * CONTINENTAL_SCALE = 4.0
      expect(h2 - h1).toBeCloseTo(0.5 * CONTINENTAL_SCALE, 0);
    });

    it("mountain biome produces higher variation than grassland", () => {
      const perm = initServerNoise(42);
      const elev = 0.5;
      const mountainHeights: number[] = [];
      const grassHeights: number[] = [];
      for (let x = 0; x < 50; x++) {
        for (let z = 0; z < 50; z++) {
          mountainHeights.push(generateTileHeight(x, z, elev, BiomeType.MOUNTAIN, perm));
          grassHeights.push(generateTileHeight(x, z, elev, BiomeType.TEMPERATE_GRASSLAND, perm));
        }
      }
      const mRange = Math.max(...mountainHeights) - Math.min(...mountainHeights);
      const gRange = Math.max(...grassHeights) - Math.min(...grassHeights);
      expect(mRange).toBeGreaterThan(gRange);
    });

    it("uses fallback profile for unknown biome IDs", () => {
      const perm = initServerNoise(42);
      // Should not throw for an unknown biome ID
      const height = generateTileHeight(10, 10, 0.5, 999, perm);
      expect(height).toBeTypeOf("number");
      expect(height).toBeGreaterThan(0);
    });
  });
});
