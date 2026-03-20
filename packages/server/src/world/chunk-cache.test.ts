import { describe, it, expect, vi, beforeEach } from "vitest";
import { BiomeType } from "./types.js";
import type { WorldMap } from "./types.js";

// Mock redis before importing chunk-cache
vi.mock("../db/redis.js", () => {
  const store = new Map<string, Buffer>();
  return {
    redis: {
      setBuffer: vi.fn(async (key: string, buf: Buffer) => {
        store.set(key, Buffer.from(buf));
        return "OK";
      }),
      getBuffer: vi.fn(async (key: string): Promise<Buffer | null> => {
        return store.get(key) ?? null;
      }),
      // Expose store for test inspection
      __store: store,
    },
  };
});

import {
  computeElevationBands,
  serializeWorldMap,
  deserializeWorldMap,
  gzipWorldMap,
  cacheWorldMap,
  getCachedWorldMap,
  cacheChunkHeights,
  getCachedChunkHeights,
  getOrGenerateChunkHeights,
} from "./chunk-cache.js";
import { redis } from "../db/redis.js";
import { initServerNoise } from "./terrain-noise.js";

/** Create a minimal WorldMap for testing */
function createTestWorldMap(opts?: {
  seed?: number;
  width?: number;
  height?: number;
}): WorldMap {
  const width = opts?.width ?? 4;
  const height = opts?.height ?? 4;
  const size = width * height;

  const regions = [
    { id: 0, name: "R0", continentId: "elf", centerX: 0, centerZ: 0, biome: BiomeType.TEMPERATE_GRASSLAND, isLand: true, pois: [], chunkCount: 4 },
    { id: 1, name: "R1", continentId: "human", centerX: 2, centerZ: 2, biome: BiomeType.MOUNTAIN, isLand: true, pois: [], chunkCount: 4 },
    { id: 2, name: "R2", continentId: "ocean", centerX: 3, centerZ: 3, biome: BiomeType.DEEP_OCEAN, isLand: false, pois: [], chunkCount: 4 },
  ];

  const elevation = new Float32Array(size);
  // Set some known elevation values for band testing
  elevation[0] = 0.1;   // band 0
  elevation[1] = 0.2;   // band 1
  elevation[2] = 0.35;  // band 2
  elevation[3] = 0.5;   // band 3
  elevation[4] = 0.65;  // band 4
  elevation[5] = 0.8;   // band 5
  elevation[6] = 0.95;  // band 6
  elevation[7] = 1.0;   // band 6

  const biomeMap = new Uint8Array(size);
  biomeMap[0] = BiomeType.TEMPERATE_GRASSLAND;
  biomeMap[1] = BiomeType.MOUNTAIN;
  biomeMap[2] = BiomeType.DEEP_OCEAN;

  const regionMap = new Uint16Array(size);
  regionMap[0] = 0;
  regionMap[1] = 1;
  regionMap[2] = 2;

  return {
    seed: opts?.seed ?? 42,
    width,
    height,
    continents: [],
    regions,
    landmask: new Uint8Array(size),
    elevation,
    moisture: new Float32Array(size),
    temperature: new Float32Array(size),
    regionMap,
    continentMap: new Uint8Array(size),
    biomeMap,
  };
}

describe("chunk-cache", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    (redis as any).__store.clear();
  });

  describe("computeElevationBands", () => {
    it("quantizes known elevation values to correct bands", () => {
      const elevation = new Float32Array([0.1, 0.2, 0.35, 0.5, 0.65, 0.8, 0.95, 1.0]);
      const bands = computeElevationBands(elevation);

      expect(bands).toBeInstanceOf(Uint8Array);
      expect(bands.length).toBe(8);

      expect(bands[0]).toBe(0);  // 0.10 < 0.15 → band 0
      expect(bands[1]).toBe(1);  // 0.20 < 0.30 → band 1
      expect(bands[2]).toBe(2);  // 0.35 < 0.45 → band 2
      expect(bands[3]).toBe(3);  // 0.50 < 0.60 → band 3
      expect(bands[4]).toBe(4);  // 0.65 < 0.75 → band 4
      expect(bands[5]).toBe(5);  // 0.80 < 0.90 → band 5
      expect(bands[6]).toBe(6);  // 0.95 < 1.01 → band 6
      expect(bands[7]).toBe(6);  // 1.00 < 1.01 → band 6
    });

    it("returns all zeros for ocean-level elevation", () => {
      const elevation = new Float32Array([0.0, 0.05, 0.14]);
      const bands = computeElevationBands(elevation);
      expect(bands[0]).toBe(0);
      expect(bands[1]).toBe(0);
      expect(bands[2]).toBe(0);
    });
  });

  describe("serializeWorldMap / deserializeWorldMap roundtrip", () => {
    it("roundtrips all fields correctly", () => {
      const worldMap = createTestWorldMap({ seed: 42, width: 4, height: 4 });
      const buf = serializeWorldMap(worldMap, 42);
      expect(buf).toBeInstanceOf(Buffer);

      const result = deserializeWorldMap(buf);

      expect(result.seed).toBe(42);
      expect(result.width).toBe(4);
      expect(result.height).toBe(4);

      // biomeMap roundtrip
      expect(result.biomeMap).toBeInstanceOf(Uint8Array);
      expect(result.biomeMap.length).toBe(worldMap.biomeMap.length);
      for (let i = 0; i < worldMap.biomeMap.length; i++) {
        expect(result.biomeMap[i]).toBe(worldMap.biomeMap[i]);
      }

      // regionMap roundtrip
      expect(result.regionMap).toBeInstanceOf(Uint16Array);
      expect(result.regionMap.length).toBe(worldMap.regionMap.length);
      for (let i = 0; i < worldMap.regionMap.length; i++) {
        expect(result.regionMap[i]).toBe(worldMap.regionMap[i]);
      }

      // regionBiomes roundtrip
      expect(result.regionBiomes).toBeInstanceOf(Uint8Array);
      expect(result.regionBiomes.length).toBe(worldMap.regions.length);
      expect(result.regionBiomes[0]).toBe(BiomeType.TEMPERATE_GRASSLAND);
      expect(result.regionBiomes[1]).toBe(BiomeType.MOUNTAIN);
      expect(result.regionBiomes[2]).toBe(BiomeType.DEEP_OCEAN);

      // elevationBands roundtrip
      expect(result.elevationBands).toBeInstanceOf(Uint8Array);
      expect(result.elevationBands.length).toBe(worldMap.elevation.length);
      expect(result.elevationBands[0]).toBe(0);  // 0.1 → band 0
      expect(result.elevationBands[5]).toBe(5);  // 0.8 → band 5
    });

    it("writes magic bytes 0x574D4150 (WMAP) at offset 0", () => {
      const worldMap = createTestWorldMap();
      const buf = serializeWorldMap(worldMap, 42);
      const magic = buf.readUInt32LE(0);
      expect(magic).toBe(0x574D4150);
    });

    it("throws on wrong magic bytes during deserialization", () => {
      const worldMap = createTestWorldMap();
      const buf = serializeWorldMap(worldMap, 42);
      // Corrupt magic
      buf.writeUInt32LE(0xDEADBEEF, 0);
      expect(() => deserializeWorldMap(buf)).toThrow();
    });
  });

  describe("gzipWorldMap", () => {
    it("produces a buffer", () => {
      const worldMap = createTestWorldMap();
      const gzipped = gzipWorldMap(worldMap, 42);
      expect(gzipped).toBeInstanceOf(Buffer);
      expect(gzipped.length).toBeGreaterThan(0);
    });

    it("produces smaller output than raw serialization for larger data", () => {
      // Use a larger world map to get meaningful compression
      const worldMap = createTestWorldMap({ width: 100, height: 100 });
      // Fill with compressible data
      worldMap.biomeMap.fill(BiomeType.TEMPERATE_GRASSLAND);
      worldMap.elevation.fill(0.5);

      const raw = serializeWorldMap(worldMap, 42);
      const gzipped = gzipWorldMap(worldMap, 42);
      expect(gzipped.length).toBeLessThan(raw.length);
    });
  });

  describe("Redis caching", () => {
    describe("cacheWorldMap / getCachedWorldMap", () => {
      it("stores and retrieves world map buffer", async () => {
        const worldMap = createTestWorldMap();
        const gzipped = gzipWorldMap(worldMap, 42);

        await cacheWorldMap(42, gzipped);
        expect(redis.setBuffer).toHaveBeenCalledWith("worldmap:seed:42", gzipped);

        const result = await getCachedWorldMap(42);
        expect(result).toBeInstanceOf(Buffer);
        expect(result!.length).toBe(gzipped.length);
      });

      it("returns null for uncached seed", async () => {
        const result = await getCachedWorldMap(999);
        expect(result).toBeNull();
      });

      it("uses seed-based key pattern", async () => {
        const worldMap = createTestWorldMap();
        const gzipped = gzipWorldMap(worldMap, 123);
        await cacheWorldMap(123, gzipped);
        expect(redis.setBuffer).toHaveBeenCalledWith("worldmap:seed:123", gzipped);
      });
    });

    describe("cacheChunkHeights / getCachedChunkHeights", () => {
      it("stores and retrieves chunk buffer", async () => {
        const buf = Buffer.alloc(2048, 0x42);
        await cacheChunkHeights(42, 10, 20, buf);
        expect(redis.setBuffer).toHaveBeenCalledWith("chunk:seed:42:10:20", buf);

        const result = await getCachedChunkHeights(42, 10, 20);
        expect(result).toBeInstanceOf(Buffer);
        expect(result!.length).toBe(2048);
      });

      it("returns null for uncached chunk", async () => {
        const result = await getCachedChunkHeights(42, 99, 99);
        expect(result).toBeNull();
      });

      it("different seeds produce different Redis keys", async () => {
        const buf = Buffer.alloc(2048);
        await cacheChunkHeights(42, 5, 5, buf);
        await cacheChunkHeights(99, 5, 5, buf);

        expect(redis.setBuffer).toHaveBeenCalledWith("chunk:seed:42:5:5", buf);
        expect(redis.setBuffer).toHaveBeenCalledWith("chunk:seed:99:5:5", buf);

        // They should be stored separately
        expect((redis as any).__store.has("chunk:seed:42:5:5")).toBe(true);
        expect((redis as any).__store.has("chunk:seed:99:5:5")).toBe(true);
      });
    });

    describe("getOrGenerateChunkHeights", () => {
      it("returns cached buffer on hit", async () => {
        const cachedBuf = Buffer.alloc(2048, 0xFF);
        await cacheChunkHeights(42, 1, 1, cachedBuf);

        const worldMap = createTestWorldMap();
        const perm = initServerNoise(42);

        const result = await getOrGenerateChunkHeights(42, 1, 1, worldMap, perm);
        expect(result).toBeInstanceOf(Buffer);
        expect(result.length).toBe(2048);
        // Should match cached data
        expect(result[0]).toBe(0xFF);
      });

      it("generates and caches on miss", async () => {
        const worldMap = createTestWorldMap();
        const perm = initServerNoise(42);

        // Clear store to ensure miss
        (redis as any).__store.clear();

        const result = await getOrGenerateChunkHeights(42, 0, 0, worldMap, perm);
        expect(result).toBeInstanceOf(Buffer);
        expect(result.length).toBe(2048);

        // Should have been cached
        expect(redis.setBuffer).toHaveBeenCalledWith(
          "chunk:seed:42:0:0",
          expect.any(Buffer),
        );
      });
    });
  });
});
