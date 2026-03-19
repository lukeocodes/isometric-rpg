import alea from "alea";
import { BiomeType, LandType } from "./types.js";
import {
  RIVER_SOURCE_ELEVATION_MIN,
  RIVER_SOURCE_MOISTURE_MIN,
  RIVER_MAX_STEPS,
  RIVER_WIDTH_FACTOR,
  LAKE_MIN_SIZE,
  LAKE_MAX_FILL_DEPTH,
  NUM_RIVER_SOURCES,
} from "./constants.js";

// Cardinal directions: [dx, dz]
const CARDINALS: [number, number][] = [
  [-1, 0],
  [1, 0],
  [0, -1],
  [0, 1],
];

// 8 neighbors: cardinal + diagonal
const NEIGHBORS_8: [number, number][] = [
  [-1, -1],
  [-1, 0],
  [-1, 1],
  [0, -1],
  [0, 1],
  [1, -1],
  [1, 0],
  [1, 1],
];

/**
 * Generate rivers and lakes on the world map.
 * Modifies biomeMap in place, adding RIVER and LAKE biome values.
 * Also sets RIVER_VALLEY on walkable land chunks adjacent to rivers.
 *
 * Algorithm:
 * 1. Detect lake basins (local elevation minima) and flood-fill
 * 2. Select river source candidates (high elevation + high moisture)
 * 3. Trace each river downhill to ocean or lake
 * 4. Mark river-adjacent land chunks as RIVER_VALLEY
 */
export function generateRiversAndLakes(
  seed: number,
  biomeMap: Uint8Array,
  elevation: Float32Array,
  moisture: Float32Array,
  landmask: Uint8Array,
  width: number,
  height: number,
): void {
  // --- Phase 1: Lake detection ---
  detectAndFillLakes(seed, biomeMap, elevation, landmask, width, height);

  // --- Phase 2: River tracing ---
  traceRivers(seed, biomeMap, elevation, moisture, landmask, width, height);

  // --- Phase 3: River valley post-processing ---
  markRiverValleys(biomeMap, landmask, width, height);
}

// Number of seeded lake placements to attempt when natural basins are insufficient
const SEEDED_LAKE_ATTEMPTS = 15;
// Elevation range for seeded lake candidates (mid-range land, not too low or too high)
const SEEDED_LAKE_ELEV_MIN = 0.5;
const SEEDED_LAKE_ELEV_MAX = 0.7;

/**
 * Detect elevation basins and flood-fill them as lakes.
 * Uses two strategies:
 * 1. Natural basin detection: land chunks where all 4 cardinal neighbors have higher elevation
 * 2. Seeded placement: for smooth noise terrain where natural basins are rare,
 *    place lakes at suitable low-elevation land locations
 */
function detectAndFillLakes(
  seed: number,
  biomeMap: Uint8Array,
  elevation: Float32Array,
  landmask: Uint8Array,
  width: number,
  height: number,
): void {
  const prng = alea(`${seed}-lakes`);
  const processed = new Set<number>();
  let lakesCreated = 0;

  // Strategy 1: Natural basin detection
  for (let z = 1; z < height - 1; z++) {
    for (let x = 1; x < width - 1; x++) {
      const idx = z * width + x;

      if (landmask[idx] < LandType.LAND) continue;
      if (processed.has(idx)) continue;

      const elev = elevation[idx];

      // Check if this is a basin: all 4 cardinal neighbors have elevation >= this chunk,
      // and at least one neighbor has elevation significantly higher.
      const MIN_BASIN_RIM_HEIGHT = 0.03;
      let isBasin = true;
      let hasHighRim = false;
      for (const [dx, dz] of CARDINALS) {
        const nIdx = (z + dz) * width + (x + dx);
        if (elevation[nIdx] < elev) {
          isBasin = false;
          break;
        }
        if (elevation[nIdx] >= elev + MIN_BASIN_RIM_HEIGHT) {
          hasHighRim = true;
        }
      }
      if (!hasHighRim) isBasin = false;

      if (!isBasin) continue;

      const lakeChunks = floodFillLake(
        idx,
        elevation,
        landmask,
        biomeMap,
        width,
        height,
        elev + LAKE_MAX_FILL_DEPTH,
      );

      for (const ci of lakeChunks) {
        processed.add(ci);
      }

      if (lakeChunks.length >= LAKE_MIN_SIZE) {
        for (const ci of lakeChunks) {
          biomeMap[ci] = BiomeType.LAKE;
        }
        lakesCreated++;
      }
    }
  }

  // Strategy 2: Seeded lake placement (for worlds with smooth terrain)
  // Collect candidate chunks at moderate elevation on land
  const lakeCandidates: number[] = [];
  for (let z = 2; z < height - 2; z++) {
    for (let x = 2; x < width - 2; x++) {
      const idx = z * width + x;
      if (landmask[idx] < LandType.LAND) continue;
      if (processed.has(idx)) continue;
      if (biomeMap[idx] === BiomeType.LAKE) continue;
      const elev = elevation[idx];
      if (elev >= SEEDED_LAKE_ELEV_MIN && elev <= SEEDED_LAKE_ELEV_MAX) {
        lakeCandidates.push(idx);
      }
    }
  }

  // Shuffle and take some candidates for lake placement
  for (let i = lakeCandidates.length - 1; i > 0; i--) {
    const j = Math.floor(prng() * (i + 1));
    [lakeCandidates[i], lakeCandidates[j]] = [lakeCandidates[j], lakeCandidates[i]];
  }

  const seededAttempts = Math.min(SEEDED_LAKE_ATTEMPTS, lakeCandidates.length);
  for (let a = 0; a < seededAttempts; a++) {
    const idx = lakeCandidates[a];
    if (processed.has(idx)) continue;
    if (biomeMap[idx] === BiomeType.LAKE || biomeMap[idx] === BiomeType.RIVER) continue;

    const elev = elevation[idx];
    const lakeChunks = floodFillLake(
      idx,
      elevation,
      landmask,
      biomeMap,
      width,
      height,
      elev + LAKE_MAX_FILL_DEPTH,
    );

    for (const ci of lakeChunks) {
      processed.add(ci);
    }

    if (lakeChunks.length >= LAKE_MIN_SIZE) {
      for (const ci of lakeChunks) {
        biomeMap[ci] = BiomeType.LAKE;
      }
      lakesCreated++;
    }
  }
}

// Maximum number of chunks a single lake can fill (prevents massive lakes)
const MAX_LAKE_FILL = 200;

/**
 * Flood-fill from a basin center, adding neighbors whose elevation
 * is <= maxElevation. Returns the set of chunk indices that would be flooded.
 */
function floodFillLake(
  startIdx: number,
  elevation: Float32Array,
  landmask: Uint8Array,
  biomeMap: Uint8Array,
  width: number,
  height: number,
  maxElevation: number,
): number[] {
  const filled: number[] = [];
  const visited = new Set<number>();
  const queue: number[] = [startIdx];
  visited.add(startIdx);

  while (queue.length > 0 && filled.length < MAX_LAKE_FILL) {
    const idx = queue.shift()!;
    filled.push(idx);

    const x = idx % width;
    const z = Math.floor(idx / width);

    for (const [dx, dz] of CARDINALS) {
      const nx = x + dx;
      const nz = z + dz;

      if (nx < 0 || nx >= width || nz < 0 || nz >= height) continue;

      const nIdx = nz * width + nx;
      if (visited.has(nIdx)) continue;
      visited.add(nIdx);

      // Only flood into land chunks within the elevation threshold
      if (landmask[nIdx] < LandType.LAND) continue;
      if (biomeMap[nIdx] === BiomeType.LAKE) continue; // already a lake
      if (elevation[nIdx] <= maxElevation) {
        queue.push(nIdx);
      }
    }
  }

  return filled;
}

/**
 * Trace rivers from high-elevation source points downhill to ocean or lake.
 */
function traceRivers(
  seed: number,
  biomeMap: Uint8Array,
  elevation: Float32Array,
  moisture: Float32Array,
  landmask: Uint8Array,
  width: number,
  height: number,
): void {
  const prng = alea(`${seed}-rivers`);

  // Collect river source candidates
  const candidates: number[] = [];
  for (let z = 0; z < height; z++) {
    for (let x = 0; x < width; x++) {
      const idx = z * width + x;
      if (landmask[idx] < LandType.LAND) continue;
      if (biomeMap[idx] === BiomeType.LAKE) continue;
      if (
        elevation[idx] > RIVER_SOURCE_ELEVATION_MIN &&
        moisture[idx] > RIVER_SOURCE_MOISTURE_MIN
      ) {
        candidates.push(idx);
      }
    }
  }

  // Shuffle candidates deterministically using Fisher-Yates
  for (let i = candidates.length - 1; i > 0; i--) {
    const j = Math.floor(prng() * (i + 1));
    [candidates[i], candidates[j]] = [candidates[j], candidates[i]];
  }

  // Take first NUM_RIVER_SOURCES candidates
  const sources = candidates.slice(0, NUM_RIVER_SOURCES);

  // Global flow accumulation map (shared across all rivers)
  const flowAccMap = new Float32Array(width * height);

  // Trace each river
  for (const sourceIdx of sources) {
    traceOneRiver(
      sourceIdx,
      biomeMap,
      elevation,
      landmask,
      flowAccMap,
      width,
      height,
    );
  }
}

/**
 * Trace a single river from source downhill.
 */
function traceOneRiver(
  sourceIdx: number,
  biomeMap: Uint8Array,
  elevation: Float32Array,
  landmask: Uint8Array,
  flowAccMap: Float32Array,
  width: number,
  height: number,
): void {
  const visited = new Set<number>();
  let currentIdx = sourceIdx;
  let flowAccumulation = 1;
  let prevDx = 0;
  let prevDz = 1; // Default flow direction

  for (let step = 0; step < RIVER_MAX_STEPS; step++) {
    const cx = currentIdx % width;
    const cz = Math.floor(currentIdx / width);

    // Bounds check
    if (cx < 0 || cx >= width || cz < 0 || cz >= height) break;

    // Check termination conditions
    if (landmask[currentIdx] < LandType.LAND) break; // Reached ocean
    if (biomeMap[currentIdx] === BiomeType.LAKE && step > 0) break; // Reached lake
    if (visited.has(currentIdx)) break; // Loop detected

    visited.add(currentIdx);

    // Accumulate flow
    flowAccMap[currentIdx] += 1;

    // Mark current chunk as RIVER
    biomeMap[currentIdx] = BiomeType.RIVER;

    // Calculate river width based on this river's flow accumulation
    // (not total flow from all rivers, to avoid excessive widening)
    const riverWidth = Math.min(
      8,
      Math.max(1, Math.floor(flowAccumulation / RIVER_WIDTH_FACTOR)),
    );

    // Expand width perpendicular to flow direction
    if (riverWidth > 1) {
      const halfWidth = Math.floor(riverWidth / 2);

      // Perpendicular expansion
      for (let w = 1; w <= halfWidth; w++) {
        // If flow is primarily in X direction, expand in Z
        // If flow is primarily in Z direction, expand in X
        let nx1: number, nz1: number, nx2: number, nz2: number;

        if (Math.abs(prevDx) >= Math.abs(prevDz)) {
          // Flow in X direction, expand in Z
          nx1 = cx;
          nz1 = cz - w;
          nx2 = cx;
          nz2 = cz + w;
        } else {
          // Flow in Z direction, expand in X
          nx1 = cx - w;
          nz1 = cz;
          nx2 = cx + w;
          nz2 = cz;
        }

        // Mark expansion chunks if valid
        if (
          nx1 >= 0 &&
          nx1 < width &&
          nz1 >= 0 &&
          nz1 < height
        ) {
          const eIdx1 = nz1 * width + nx1;
          if (landmask[eIdx1] >= LandType.LAND && biomeMap[eIdx1] !== BiomeType.LAKE) {
            biomeMap[eIdx1] = BiomeType.RIVER;
          }
        }

        if (
          nx2 >= 0 &&
          nx2 < width &&
          nz2 >= 0 &&
          nz2 < height
        ) {
          const eIdx2 = nz2 * width + nx2;
          if (landmask[eIdx2] >= LandType.LAND && biomeMap[eIdx2] !== BiomeType.LAKE) {
            biomeMap[eIdx2] = BiomeType.RIVER;
          }
        }
      }
    }

    // Find the neighbor with the lowest elevation (not visited)
    let bestIdx = -1;
    let bestElev = Infinity;
    let bestDx = 0;
    let bestDz = 0;

    for (const [dx, dz] of CARDINALS) {
      const nx = cx + dx;
      const nz = cz + dz;

      if (nx < 0 || nx >= width || nz < 0 || nz >= height) continue;

      const nIdx = nz * width + nx;
      if (visited.has(nIdx)) continue;

      // Allow moving to ocean (termination) or lower elevation
      const nElev = elevation[nIdx];
      if (nElev < bestElev) {
        bestElev = nElev;
        bestIdx = nIdx;
        bestDx = dx;
        bestDz = dz;
      }
    }

    // If no unvisited neighbor is lower, terminate (stuck in local minimum)
    if (bestIdx === -1 || bestElev >= elevation[currentIdx]) {
      // Try to find ANY unvisited neighbor (even if not lower)
      // to avoid getting stuck -- pick the lowest elevation regardless
      let anyBestIdx = -1;
      let anyBestElev = Infinity;
      let anyBestDx = 0;
      let anyBestDz = 0;

      for (const [dx, dz] of CARDINALS) {
        const nx = cx + dx;
        const nz = cz + dz;
        if (nx < 0 || nx >= width || nz < 0 || nz >= height) continue;

        const nIdx = nz * width + nx;
        if (visited.has(nIdx)) continue;

        if (elevation[nIdx] < anyBestElev) {
          anyBestElev = elevation[nIdx];
          anyBestIdx = nIdx;
          anyBestDx = dx;
          anyBestDz = dz;
        }
      }

      if (anyBestIdx === -1) break; // Truly stuck, all neighbors visited

      bestIdx = anyBestIdx;
      bestDx = anyBestDx;
      bestDz = anyBestDz;
    }

    prevDx = bestDx;
    prevDz = bestDz;
    flowAccumulation++;
    currentIdx = bestIdx;
  }
}

/**
 * Mark land chunks adjacent to rivers as RIVER_VALLEY.
 * Scans the biomeMap for RIVER chunks and sets their 8-connected
 * land neighbors (that aren't already RIVER or LAKE) to RIVER_VALLEY.
 */
function markRiverValleys(
  biomeMap: Uint8Array,
  landmask: Uint8Array,
  width: number,
  height: number,
): void {
  // Collect all river chunk positions first (to avoid modifying while iterating)
  const riverIndices: number[] = [];
  for (let i = 0; i < biomeMap.length; i++) {
    if (biomeMap[i] === BiomeType.RIVER) {
      riverIndices.push(i);
    }
  }

  for (const idx of riverIndices) {
    const x = idx % width;
    const z = Math.floor(idx / width);

    for (const [dx, dz] of NEIGHBORS_8) {
      const nx = x + dx;
      const nz = z + dz;
      if (nx < 0 || nx >= width || nz < 0 || nz >= height) continue;

      const nIdx = nz * width + nx;
      if (landmask[nIdx] < LandType.LAND) continue;
      if (biomeMap[nIdx] === BiomeType.RIVER) continue;
      if (biomeMap[nIdx] === BiomeType.LAKE) continue;

      biomeMap[nIdx] = BiomeType.RIVER_VALLEY;
    }
  }
}
