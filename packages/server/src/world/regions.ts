import PoissonDiskSampling from "fast-2d-poisson-disk-sampling";
import alea from "alea";
import type { WorldConfig, ContinentDef, Region, POI, POIType } from "./types.js";
import { LandType } from "./types.js";

const POI_TYPES: POIType[] = ["ruin", "cave", "landmark", "resource"];

/**
 * Generate Voronoi-like regions via Poisson disk sampling.
 * Produces land regions (one per continent) and ocean regions.
 *
 * Each region center is placed using Poisson disk sampling for even distribution.
 * Land points fall on land chunks; ocean points fall on ocean chunks.
 * Supplemental points are added if a continent has fewer than 20 regions.
 */
export function generateRegions(
  seed: number,
  config: WorldConfig,
  landmask: Uint8Array,
  continentMap: Uint8Array,
  continentDefs: ContinentDef[],
): Region[] {
  const { width, height } = config;
  const regions: Region[] = [];
  let nextId = 0;

  // --- Land regions via Poisson disk sampling ---
  const landPrng = alea(`${seed}-regions`);
  const landPds = new PoissonDiskSampling(
    {
      shape: [width, height],
      radius: 40,
      tries: 30,
    },
    landPrng,
  );
  const landPoints = landPds.fill();

  // Filter: only keep points on land
  const filteredLandPoints: Array<{ x: number; z: number; contIdx: number }> =
    [];
  for (const point of landPoints) {
    const cx = Math.round(point[0]);
    const cz = Math.round(point[1]);
    if (cx < 0 || cx >= width || cz < 0 || cz >= height) continue;
    const idx = cz * width + cx;
    if (landmask[idx] >= LandType.LAND) {
      const contIdx = continentMap[idx];
      if (contIdx > 0) {
        filteredLandPoints.push({ x: cx, z: cz, contIdx });
      }
    }
  }

  // Check per-continent counts, add supplemental points if needed
  const continentRegionCounts = new Map<number, number>();
  for (const pt of filteredLandPoints) {
    continentRegionCounts.set(
      pt.contIdx,
      (continentRegionCounts.get(pt.contIdx) || 0) + 1,
    );
  }

  const supplementalPrng = alea(`${seed}-regions-supplement`);
  for (let ci = 1; ci <= continentDefs.length; ci++) {
    const count = continentRegionCounts.get(ci) || 0;
    if (count < 20) {
      const def = continentDefs[ci - 1];
      let attempts = 0;
      const maxAttempts = 2000;
      let added = 0;
      const needed = 20 - count;

      while (added < needed && attempts < maxAttempts) {
        attempts++;
        const angle = supplementalPrng() * Math.PI * 2;
        const dist = supplementalPrng() * def.radius * 0.8;
        const cx = Math.round(def.centerX + Math.cos(angle) * dist);
        const cz = Math.round(def.centerZ + Math.sin(angle) * dist);
        if (cx < 0 || cx >= width || cz < 0 || cz >= height) continue;
        const idx = cz * width + cx;
        if (landmask[idx] < LandType.LAND) continue;
        if (continentMap[idx] !== ci) continue;

        // Check minimum distance from existing land points
        let tooClose = false;
        for (const pt of filteredLandPoints) {
          const dx = pt.x - cx;
          const dz = pt.z - cz;
          if (dx * dx + dz * dz < 30 * 30) {
            tooClose = true;
            break;
          }
        }
        if (tooClose) continue;

        filteredLandPoints.push({ x: cx, z: cz, contIdx: ci });
        continentRegionCounts.set(
          ci,
          (continentRegionCounts.get(ci) || 0) + 1,
        );
        added++;
      }
    }
  }

  // Create land Region objects
  const poiPrng = alea(`${seed}-pois`);
  for (const pt of filteredLandPoints) {
    const continentId = continentDefs[pt.contIdx - 1].id;
    const pois = generatePOIs(
      poiPrng,
      pt.x,
      pt.z,
      width,
      height,
      landmask,
    );
    regions.push({
      id: nextId++,
      name: "",
      continentId,
      centerX: pt.x,
      centerZ: pt.z,
      biome: 0, // Assigned later by biome classification
      isLand: true,
      pois,
      chunkCount: 0,
    });
  }

  // --- Ocean regions via Poisson disk sampling ---
  const oceanPrng = alea(`${seed}-regions-ocean`);
  const oceanPds = new PoissonDiskSampling(
    {
      shape: [width, height],
      radius: 80,
      tries: 30,
    },
    oceanPrng,
  );
  const oceanPoints = oceanPds.fill();

  for (const point of oceanPoints) {
    const cx = Math.round(point[0]);
    const cz = Math.round(point[1]);
    if (cx < 0 || cx >= width || cz < 0 || cz >= height) continue;
    const idx = cz * width + cx;
    if (landmask[idx] < LandType.LAND) {
      regions.push({
        id: nextId++,
        name: "",
        continentId: "ocean",
        centerX: cx,
        centerZ: cz,
        biome: 0, // Assigned later
        isLand: false,
        pois: [],
        chunkCount: 0,
      });
    }
  }

  return regions;
}

/**
 * Generate 0-3 POIs for a land region using seeded random.
 * POIs are placed within 15 chunks of the region center.
 */
function generatePOIs(
  prng: () => number,
  centerX: number,
  centerZ: number,
  width: number,
  height: number,
  landmask: Uint8Array,
): POI[] {
  const count = Math.floor(prng() * 4); // 0-3
  const pois: POI[] = [];

  for (let i = 0; i < count; i++) {
    const offsetX = Math.round((prng() - 0.5) * 30); // within 15 chunks
    const offsetZ = Math.round((prng() - 0.5) * 30);
    const x = Math.max(0, Math.min(width - 1, centerX + offsetX));
    const z = Math.max(0, Math.min(height - 1, centerZ + offsetZ));
    const type = POI_TYPES[Math.floor(prng() * POI_TYPES.length)];
    pois.push({ type, x, z });
  }

  return pois;
}

/**
 * Build a precomputed chunk-to-region lookup table.
 * For each chunk, finds the nearest region center (Voronoi assignment).
 * Also updates each region's chunkCount.
 *
 * Returns Uint16Array indexed by [z * width + x], values are region IDs.
 * This provides O(1) runtime lookup for any chunk coordinate.
 */
export function buildRegionLookup(
  regions: Region[],
  width: number,
  height: number,
): Uint16Array {
  const map = new Uint16Array(width * height);

  // Reset chunk counts
  for (const region of regions) {
    region.chunkCount = 0;
  }

  for (let cz = 0; cz < height; cz++) {
    for (let cx = 0; cx < width; cx++) {
      let minDist = Infinity;
      let nearestRegion = 0;

      for (let i = 0; i < regions.length; i++) {
        const dx = cx - regions[i].centerX;
        const dz = cz - regions[i].centerZ;
        const distSq = dx * dx + dz * dz;
        if (distSq < minDist) {
          minDist = distSq;
          nearestRegion = regions[i].id;
        }
      }

      const idx = cz * width + cx;
      map[idx] = nearestRegion;
      regions[nearestRegion].chunkCount++;
    }
  }

  return map;
}

// --- Name generation ---

const LAND_PREFIXES = [
  "Thorn",
  "Ash",
  "Crystal",
  "Shadow",
  "Iron",
  "Silver",
  "Storm",
  "Frost",
  "Ember",
  "Golden",
  "Moss",
  "Raven",
  "Hollow",
  "Bright",
  "Dusk",
  "Dawn",
  "Copper",
  "Jade",
  "Obsidian",
  "Crimson",
  "Ancient",
  "Wild",
  "Lost",
  "Pale",
  "Dark",
  "White",
  "Grey",
  "Stone",
  "Wind",
  "Moon",
];

const LAND_SUFFIXES = [
  "wood",
  "ridge",
  "peak",
  "vale",
  "hollow",
  "march",
  "moor",
  "field",
  "glen",
  "fall",
  "reach",
  "haven",
  "crest",
  "dale",
  "shire",
  "ford",
  "gate",
  "watch",
  "hold",
  "keep",
  "rest",
  "cross",
  "bridge",
  "meadow",
  "heath",
  "grove",
  "thicket",
  "cliff",
  "bend",
  "pass",
];

const OCEAN_PREFIXES = [
  "Northern",
  "Southern",
  "Eastern",
  "Western",
  "Central",
  "Deep",
  "Storm",
  "Calm",
  "Dark",
  "Bright",
  "Frozen",
  "Endless",
];

const OCEAN_SUFFIXES = [
  "Sea",
  "Passage",
  "Straits",
  "Channel",
  "Deep",
  "Expanse",
  "Waters",
  "Gulf",
  "Reach",
  "Abyss",
];

/**
 * Assign unique thematic names to all regions.
 * Land regions get terrain-flavored names; ocean regions get directional names.
 * Names are deterministic from the seed.
 */
export function generateRegionNames(regions: Region[], seed: number): void {
  const prng = alea(`${seed}-names`);
  const usedNames = new Set<string>();

  for (const region of regions) {
    let name: string;
    if (region.isLand) {
      const prefix =
        LAND_PREFIXES[Math.floor(prng() * LAND_PREFIXES.length)];
      const suffix =
        LAND_SUFFIXES[Math.floor(prng() * LAND_SUFFIXES.length)];
      name = `${prefix}${suffix}`;
    } else {
      const prefix =
        OCEAN_PREFIXES[Math.floor(prng() * OCEAN_PREFIXES.length)];
      const suffix =
        OCEAN_SUFFIXES[Math.floor(prng() * OCEAN_SUFFIXES.length)];
      name = `${prefix} ${suffix}`;
    }

    // Ensure uniqueness
    if (usedNames.has(name)) {
      let counter = 2;
      while (usedNames.has(`${name} ${toRoman(counter)}`)) {
        counter++;
      }
      name = `${name} ${toRoman(counter)}`;
    }

    usedNames.add(name);
    region.name = name;
  }
}

/** Convert small integers to Roman numerals for name suffixes. */
function toRoman(n: number): string {
  const numerals: [number, string][] = [
    [10, "X"],
    [9, "IX"],
    [5, "V"],
    [4, "IV"],
    [1, "I"],
  ];
  let result = "";
  let remaining = n;
  for (const [value, numeral] of numerals) {
    while (remaining >= value) {
      result += numeral;
      remaining -= value;
    }
  }
  return result;
}
