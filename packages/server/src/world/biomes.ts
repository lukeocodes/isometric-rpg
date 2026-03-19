import alea from "alea";
import { BiomeType, LandType } from "./types.js";
import type { ContinentDef } from "./types.js";

/**
 * Classify a single chunk's biome based on elevation, moisture, temperature,
 * and continent identity.
 *
 * Continental modifiers shift the noise values before classification:
 * - Elf: +moisture, +temperature -> favors forests
 * - Dwarf: +elevation, -temperature -> favors mountains/tundra
 * - Human: no modifiers -> most diverse
 * - Ocean: returns DEEP/SHALLOW_OCEAN based on elevation
 */
export function classifyBiome(
  elevation: number,
  moisture: number,
  temperature: number,
  continentId: string,
): BiomeType {
  // Ocean shortcut
  if (continentId === "ocean") {
    return elevation < 0.15
      ? BiomeType.DEEP_OCEAN
      : BiomeType.SHALLOW_OCEAN;
  }

  // Apply continental modifiers
  let elevMod = 0;
  let moistMod = 0;
  let tempMod = 0;

  switch (continentId) {
    case "elf":
      moistMod = 0.15;
      tempMod = 0.1;
      break;
    case "dwarf":
      elevMod = 0.15;
      tempMod = -0.15;
      break;
    case "human":
      break; // No modifiers -- most diverse
  }

  const e = Math.min(1, Math.max(0, elevation + elevMod));
  const m = Math.min(1, Math.max(0, moisture + moistMod));
  const t = Math.min(1, Math.max(0, temperature + tempMod));

  // Classification rules (ordered, first match wins)
  // Thresholds calibrated for actual land elevation range (~0.3-1.0)
  // since generateElevation boosts land by +0.3
  if (e > 0.95) return BiomeType.SNOW_PEAK;
  if (e > 0.9) return BiomeType.MOUNTAIN;
  if (e > 0.85) return m > 0.5 ? BiomeType.HIGHLAND : BiomeType.TUNDRA;
  if (t < 0.2) return BiomeType.TUNDRA;
  if (t < 0.35) return m > 0.5 ? BiomeType.BOREAL_FOREST : BiomeType.TUNDRA;
  if (m < 0.15 && t > 0.6) return BiomeType.DESERT;
  if (m < 0.3) return BiomeType.SCRUBLAND;
  if (m > 0.75 && e < 0.5) return BiomeType.SWAMP;
  if (m > 0.6) return BiomeType.DENSE_FOREST;
  if (m > 0.4) return BiomeType.TEMPERATE_FOREST;
  if (e < 0.35) return BiomeType.BEACH;
  return BiomeType.TEMPERATE_GRASSLAND;
}

/**
 * Classify biomes for the entire world grid.
 *
 * For each chunk:
 * - Ocean chunks get DEEP_OCEAN or SHALLOW_OCEAN
 * - Land chunks get classified based on elevation/moisture/temperature + continental modifiers
 * - Wild zones (~5% of each continent) get inverted modifiers for unexpected biome pockets
 *
 * Returns a Uint8Array indexed by [z * width + x] with BiomeType values.
 */
export function classifyBiomes(
  seed: number,
  elevation: Float32Array,
  moisture: Float32Array,
  temperature: Float32Array,
  landmask: Uint8Array,
  continentMap: Uint8Array,
  continentDefs: ContinentDef[],
  width: number,
  height: number,
): Uint8Array {
  const biomeMap = new Uint8Array(width * height);

  // Precompute wild zone centers for each continent
  const wildPrng = alea(`${seed}-wildzone`);
  const wildZones: Array<{
    contIdx: number;
    cx: number;
    cz: number;
    radius: number;
  }> = [];

  for (let ci = 0; ci < continentDefs.length; ci++) {
    const def = continentDefs[ci];
    // Place 2-3 wild zone centers per continent
    const numWild = 2 + Math.floor(wildPrng() * 2);
    for (let w = 0; w < numWild; w++) {
      const angle = wildPrng() * Math.PI * 2;
      const dist = wildPrng() * def.radius * 0.6;
      const cx = def.centerX + Math.cos(angle) * dist;
      const cz = def.centerZ + Math.sin(angle) * dist;
      // Radius covers ~5% of continent area per wild zone
      const radius = def.radius * 0.15 + wildPrng() * def.radius * 0.1;
      wildZones.push({ contIdx: ci + 1, cx, cz, radius });
    }
  }

  for (let cz = 0; cz < height; cz++) {
    for (let cx = 0; cx < width; cx++) {
      const idx = cz * width + cx;

      // Ocean chunks
      if (landmask[idx] < LandType.LAND) {
        if (landmask[idx] === LandType.DEEP_OCEAN) {
          biomeMap[idx] = BiomeType.DEEP_OCEAN;
        } else {
          biomeMap[idx] = BiomeType.SHALLOW_OCEAN;
        }
        continue;
      }

      // Land chunks
      const contIdx = continentMap[idx];
      let continentId = "ocean";
      if (contIdx > 0 && contIdx <= continentDefs.length) {
        continentId = continentDefs[contIdx - 1].id;
      }

      // Check if this chunk is in a wild zone
      let isWild = false;
      for (const wz of wildZones) {
        if (wz.contIdx === contIdx) {
          const dx = cx - wz.cx;
          const dz = cz - wz.cz;
          if (dx * dx + dz * dz < wz.radius * wz.radius) {
            isWild = true;
            break;
          }
        }
      }

      if (isWild) {
        // Apply extreme inverted modifiers for contrasting wild zone biomes
        biomeMap[idx] = classifyWildZoneBiome(
          elevation[idx],
          moisture[idx],
          temperature[idx],
          continentId,
        );
      } else {
        biomeMap[idx] = classifyBiome(
          elevation[idx],
          moisture[idx],
          temperature[idx],
          continentId,
        );
      }
    }
  }

  return biomeMap;
}

/**
 * Classify a wild zone chunk with inverted/extreme modifiers
 * to create contrasting biome pockets on each continent.
 *
 * Elf (wet forests) -> dry/hot modifiers -> DESERT/SCRUBLAND pockets
 * Dwarf (cold mountains) -> wet/warm modifiers -> SWAMP/DENSE_FOREST pockets
 * Human (diverse) -> cold modifiers -> SNOW_PEAK/TUNDRA pockets
 */
function classifyWildZoneBiome(
  elevation: number,
  moisture: number,
  temperature: number,
  continentId: string,
): BiomeType {
  let e = elevation;
  let m = moisture;
  let t = temperature;

  switch (continentId) {
    case "elf":
      // Force dry and hot: creates DESERT/SCRUBLAND pockets in forests
      m = Math.max(0, m - 0.5);
      t = Math.min(1, t + 0.2);
      e = Math.max(0, e - 0.2);
      break;
    case "dwarf":
      // Force wet and warm: creates SWAMP/DENSE_FOREST pockets in mountains
      m = Math.min(1, m + 0.5);
      t = Math.min(1, t + 0.3);
      e = Math.max(0, e - 0.3);
      break;
    case "human":
      // Force cold and high: creates SNOW_PEAK/TUNDRA pockets
      t = Math.max(0, t - 0.4);
      e = Math.min(1, e + 0.2);
      break;
  }

  e = Math.min(1, Math.max(0, e));
  m = Math.min(1, Math.max(0, m));
  t = Math.min(1, Math.max(0, t));

  if (e > 0.95) return BiomeType.SNOW_PEAK;
  if (e > 0.9) return BiomeType.MOUNTAIN;
  if (e > 0.85) return m > 0.5 ? BiomeType.HIGHLAND : BiomeType.TUNDRA;
  if (t < 0.2) return BiomeType.TUNDRA;
  if (t < 0.35) return m > 0.5 ? BiomeType.BOREAL_FOREST : BiomeType.TUNDRA;
  if (m < 0.15 && t > 0.6) return BiomeType.DESERT;
  if (m < 0.3) return BiomeType.SCRUBLAND;
  if (m > 0.75 && e < 0.5) return BiomeType.SWAMP;
  if (m > 0.6) return BiomeType.DENSE_FOREST;
  if (m > 0.4) return BiomeType.TEMPERATE_FOREST;
  if (e < 0.35) return BiomeType.BEACH;
  return BiomeType.TEMPERATE_GRASSLAND;
}

/**
 * Determine a region's biome by majority vote among its chunk biomes.
 * Counts all biome types among chunks assigned to this region and
 * returns the most common one (plurality).
 */
export function getRegionBiome(
  regionId: number,
  regionMap: Uint16Array,
  biomeMap: Uint8Array,
  width: number,
  height: number,
): BiomeType {
  const biomeCounts = new Map<number, number>();

  for (let i = 0; i < regionMap.length; i++) {
    if (regionMap[i] === regionId) {
      const biome = biomeMap[i];
      biomeCounts.set(biome, (biomeCounts.get(biome) || 0) + 1);
    }
  }

  let maxCount = 0;
  let majorityBiome: BiomeType = BiomeType.TEMPERATE_GRASSLAND;
  for (const [biome, count] of biomeCounts) {
    if (count > maxCount) {
      maxCount = count;
      majorityBiome = biome as BiomeType;
    }
  }

  return majorityBiome;
}
