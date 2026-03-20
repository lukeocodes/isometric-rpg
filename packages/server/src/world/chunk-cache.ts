/**
 * Redis binary caching for world map and chunk heights.
 * Uses seed-embedded Redis keys for automatic invalidation on seed change.
 *
 * World map: serialized to binary with WMAP magic header, gzipped, stored at worldmap:seed:{seed}
 * Chunk heights: raw Float16 buffers stored at chunk:seed:{seed}:{cx}:{cz}
 */

import { redis } from "../db/redis.js";
import { gzipSync } from "node:zlib";
import { generateChunkHeights } from "./chunk-generator.js";
import type { WorldMap } from "./types.js";

// --- Elevation band quantization ---

/** Thresholds matching client ChunkManager.getElevationBand() */
const ELEVATION_THRESHOLDS = [0.15, 0.30, 0.45, 0.60, 0.75, 0.90, 1.01];

/**
 * Quantize continuous elevation values (0.0-1.0) to discrete bands (0-6).
 * Uses the same 7-level thresholds as the client ChunkManager.
 */
export function computeElevationBands(elevation: Float32Array): Uint8Array {
  const bands = new Uint8Array(elevation.length);
  for (let i = 0; i < elevation.length; i++) {
    const val = elevation[i];
    let band = 6;
    for (let t = 0; t < ELEVATION_THRESHOLDS.length; t++) {
      if (val < ELEVATION_THRESHOLDS[t]) {
        band = t;
        break;
      }
    }
    bands[i] = band;
  }
  return bands;
}

// --- Binary serialization ---

/** Magic bytes: "WMAP" as little-endian u32 */
const WMAP_MAGIC = 0x574D4150;

/** Header size: 4(magic) + 4(seed) + 2(width) + 2(height) + 4*4(lengths) = 28 bytes */
const HEADER_SIZE = 28;

/**
 * Serialize a WorldMap into a binary Buffer.
 *
 * Format: [magic:u32LE] [seed:u32LE] [width:u16LE] [height:u16LE]
 *         [biomeMapLen:u32LE] [elevBandsLen:u32LE] [regionMapLen:u32LE] [regionBiomesLen:u32LE]
 *         [biomeMap bytes] [elevationBands bytes] [regionMap bytes] [regionBiomes bytes]
 */
export function serializeWorldMap(worldMap: WorldMap, seed: number): Buffer {
  // Compute derived arrays
  const elevationBands = computeElevationBands(worldMap.elevation);
  const regionBiomes = new Uint8Array(worldMap.regions.length);
  for (let i = 0; i < worldMap.regions.length; i++) {
    regionBiomes[i] = worldMap.regions[i].biome;
  }

  // Raw byte representations
  const biomeMapBytes = worldMap.biomeMap;
  const elevBandsBytes = elevationBands;
  const regionMapBytes = new Uint8Array(
    worldMap.regionMap.buffer,
    worldMap.regionMap.byteOffset,
    worldMap.regionMap.byteLength,
  );
  const regionBiomesBytes = regionBiomes;

  // Payload lengths
  const biomeMapLen = biomeMapBytes.length;
  const elevBandsLen = elevBandsBytes.length;
  const regionMapLen = regionMapBytes.length;
  const regionBiomesLen = regionBiomesBytes.length;

  const totalSize = HEADER_SIZE + biomeMapLen + elevBandsLen + regionMapLen + regionBiomesLen;
  const buf = Buffer.alloc(totalSize);

  // Write header
  buf.writeUInt32LE(WMAP_MAGIC, 0);
  buf.writeUInt32LE(seed >>> 0, 4);
  buf.writeUInt16LE(worldMap.width, 8);
  buf.writeUInt16LE(worldMap.height, 10);
  buf.writeUInt32LE(biomeMapLen, 12);
  buf.writeUInt32LE(elevBandsLen, 16);
  buf.writeUInt32LE(regionMapLen, 20);
  buf.writeUInt32LE(regionBiomesLen, 24);

  // Write payloads
  let offset = HEADER_SIZE;
  buf.set(biomeMapBytes, offset);
  offset += biomeMapLen;
  buf.set(elevBandsBytes, offset);
  offset += elevBandsLen;
  buf.set(regionMapBytes, offset);
  offset += regionMapLen;
  buf.set(regionBiomesBytes, offset);

  return buf;
}

/**
 * Deserialize a binary Buffer back into world map components.
 * Validates magic bytes. Throws on invalid data.
 */
export function deserializeWorldMap(buf: Buffer): {
  seed: number;
  width: number;
  height: number;
  biomeMap: Uint8Array;
  elevationBands: Uint8Array;
  regionMap: Uint16Array;
  regionBiomes: Uint8Array;
} {
  // Validate magic
  const magic = buf.readUInt32LE(0);
  if (magic !== WMAP_MAGIC) {
    throw new Error(
      `Invalid world map magic: expected 0x${WMAP_MAGIC.toString(16)}, got 0x${magic.toString(16)}`,
    );
  }

  // Read header
  const seed = buf.readUInt32LE(4);
  const width = buf.readUInt16LE(8);
  const height = buf.readUInt16LE(10);
  const biomeMapLen = buf.readUInt32LE(12);
  const elevBandsLen = buf.readUInt32LE(16);
  const regionMapLen = buf.readUInt32LE(20);
  const regionBiomesLen = buf.readUInt32LE(24);

  // Extract payloads
  let offset = HEADER_SIZE;

  const biomeMap = new Uint8Array(biomeMapLen);
  biomeMap.set(buf.subarray(offset, offset + biomeMapLen));
  offset += biomeMapLen;

  const elevationBands = new Uint8Array(elevBandsLen);
  elevationBands.set(buf.subarray(offset, offset + elevBandsLen));
  offset += elevBandsLen;

  // regionMap is Uint16Array — copy bytes into an aligned buffer
  const regionMapBuf = new ArrayBuffer(regionMapLen);
  const regionMapU8 = new Uint8Array(regionMapBuf);
  regionMapU8.set(buf.subarray(offset, offset + regionMapLen));
  const regionMap = new Uint16Array(regionMapBuf);
  offset += regionMapLen;

  const regionBiomes = new Uint8Array(regionBiomesLen);
  regionBiomes.set(buf.subarray(offset, offset + regionBiomesLen));

  return { seed, width, height, biomeMap, elevationBands, regionMap, regionBiomes };
}

/**
 * Serialize and gzip a WorldMap for compact storage/transfer.
 */
export function gzipWorldMap(worldMap: WorldMap, seed: number): Buffer {
  const raw = serializeWorldMap(worldMap, seed);
  return gzipSync(raw);
}

// --- Redis caching ---

/**
 * Cache a gzipped world map buffer in Redis.
 * Key pattern: worldmap:seed:{seed}
 * No TTL — persists until seed changes (different key).
 */
export async function cacheWorldMap(seed: number, gzippedBuf: Buffer): Promise<void> {
  await redis.setBuffer(`worldmap:seed:${seed}`, gzippedBuf);
}

/**
 * Retrieve a cached gzipped world map from Redis.
 * Returns null on cache miss.
 */
export async function getCachedWorldMap(seed: number): Promise<Buffer | null> {
  return await redis.getBuffer(`worldmap:seed:${seed}`);
}

/**
 * Cache a chunk height buffer in Redis.
 * Key pattern: chunk:seed:{seed}:{cx}:{cz}
 */
export async function cacheChunkHeights(
  seed: number,
  cx: number,
  cz: number,
  buf: Buffer,
): Promise<void> {
  await redis.setBuffer(`chunk:seed:${seed}:${cx}:${cz}`, buf);
}

/**
 * Retrieve a cached chunk height buffer from Redis.
 * Returns null on cache miss.
 */
export async function getCachedChunkHeights(
  seed: number,
  cx: number,
  cz: number,
): Promise<Buffer | null> {
  return await redis.getBuffer(`chunk:seed:${seed}:${cx}:${cz}`);
}

/**
 * Get chunk heights from cache, or generate + cache on miss.
 * This is the primary entry point for chunk height data.
 */
export async function getOrGenerateChunkHeights(
  seed: number,
  cx: number,
  cz: number,
  worldMap: WorldMap,
  perm: Uint8Array,
): Promise<Buffer> {
  const cached = await getCachedChunkHeights(seed, cx, cz);
  if (cached) return cached;

  const buf = generateChunkHeights(cx, cz, worldMap, perm);
  await cacheChunkHeights(seed, cx, cz, buf);
  return buf;
}
