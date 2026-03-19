import { createNoise2D } from "simplex-noise";
import alea from "alea";
import type { WorldConfig, ContinentDef } from "./types.js";
import { LandType } from "./types.js";
import {
  CONTINENT_OFFSET,
  CONTINENT_RADIUS,
  CONTINENT_NOISE_SCALE,
  COAST_NOISE_SCALE,
  CONTINENT_NOISE_OCTAVES,
  COAST_NOISE_OCTAVES,
  NOISE_CONTRIBUTION,
  COAST_CONTRIBUTION,
  LAND_THRESHOLD,
  SHALLOW_THRESHOLD,
  ELEVATION_NOISE_SCALE,
  ELEVATION_OCTAVES,
  MOISTURE_NOISE_SCALE,
  MOISTURE_OCTAVES,
  TEMPERATURE_NOISE_SCALE,
  TEMPERATURE_OCTAVES,
  TEMPERATURE_LATITUDE_WEIGHT,
  ISLAND_CLUSTER_RADIUS,
  ISLAND_NOISE_SCALE,
  ISLANDS_PER_PAIR,
} from "./constants.js";

/**
 * Fractal Brownian Motion - layers multiple octaves of noise for natural terrain.
 * Returns a value in [-1, 1].
 */
function fbm(
  noise2D: ReturnType<typeof createNoise2D>,
  x: number,
  y: number,
  octaves: number = 6,
  lacunarity: number = 2.0,
  gain: number = 0.5,
): number {
  let value = 0;
  let amplitude = 1.0;
  let frequency = 1.0;
  let maxValue = 0;

  for (let i = 0; i < octaves; i++) {
    value += amplitude * noise2D(x * frequency, y * frequency);
    maxValue += amplitude;
    amplitude *= gain;
    frequency *= lacunarity;
  }

  return value / maxValue;
}

/**
 * Place 3 continents in a triangular layout within the world grid.
 * Returns ContinentDef array with positions in array-index space (0-based).
 */
export function placeContinents(
  width: number,
  height: number,
): ContinentDef[] {
  const cx = width / 2;
  const cz = height / 2;

  return [
    {
      id: "elf",
      name: "Faerwood",
      race: "elf",
      centerX: cx,
      centerZ: cz - CONTINENT_OFFSET,
      radius: CONTINENT_RADIUS,
    },
    {
      id: "dwarf",
      name: "Khazrath",
      race: "dwarf",
      centerX: cx - CONTINENT_OFFSET * Math.cos(Math.PI / 6),
      centerZ: cz + CONTINENT_OFFSET * Math.sin(Math.PI / 6),
      radius: CONTINENT_RADIUS,
    },
    {
      id: "human",
      name: "Aethermere",
      race: "human",
      centerX: cx + CONTINENT_OFFSET * Math.cos(Math.PI / 6),
      centerZ: cz + CONTINENT_OFFSET * Math.sin(Math.PI / 6),
      radius: CONTINENT_RADIUS,
    },
  ];
}

/**
 * Compute island cluster centers between each pair of continents.
 * Returns an array of { cx, cz, radius } for each island cluster.
 */
function computeIslandClusters(
  continentDefs: ContinentDef[],
  seed: number,
  width: number,
  height: number,
): { cx: number; cz: number; radius: number }[] {
  const clusters: { cx: number; cz: number; radius: number }[] = [];
  const islandPrng = alea(`${seed}-islands`);

  for (let i = 0; i < continentDefs.length; i++) {
    for (let j = i + 1; j < continentDefs.length; j++) {
      const a = continentDefs[i];
      const b = continentDefs[j];

      // Midpoint between the two continents
      const midX = (a.centerX + b.centerX) / 2;
      const midZ = (a.centerZ + b.centerZ) / 2;

      // Direction perpendicular to the line between the two continents
      const dx = b.centerX - a.centerX;
      const dz = b.centerZ - a.centerZ;
      const len = Math.sqrt(dx * dx + dz * dz);
      const perpX = -dz / len;
      const perpZ = dx / len;

      for (let k = 0; k < ISLANDS_PER_PAIR; k++) {
        // Spread islands along the midline with some offset
        const t = (k / (ISLANDS_PER_PAIR - 1) - 0.5) * 0.6;
        const offsetScale = (islandPrng() - 0.5) * 60;

        const clusterX = midX + perpX * t * len * 0.4 + perpX * offsetScale;
        const clusterZ = midZ + perpZ * t * len * 0.4 + perpZ * offsetScale;

        // Ensure within world bounds
        if (
          clusterX >= 0 &&
          clusterX < width &&
          clusterZ >= 0 &&
          clusterZ < height
        ) {
          clusters.push({
            cx: clusterX,
            cz: clusterZ,
            radius: ISLAND_CLUSTER_RADIUS * (0.5 + islandPrng() * 0.5),
          });
        }
      }
    }
  }

  return clusters;
}

/**
 * Generate the continental landmask and continent assignment map.
 * Uses radial gradients + fBm noise for organic coastlines, plus island clusters.
 *
 * Returns:
 * - landmask: Uint8Array of LandType values
 * - continentMap: Uint8Array mapping each chunk to continent index (0=ocean, 1-3)
 * - continentDefs: The ContinentDef array used
 */
export function generateContinents(
  seed: number,
  config: WorldConfig,
): {
  landmask: Uint8Array;
  continentMap: Uint8Array;
  continentDefs: ContinentDef[];
} {
  const { width, height } = config;
  const continentDefs = placeContinents(width, height);

  // Create distinct noise functions with unique seeds
  const landNoise = createNoise2D(alea(`${seed}-land`));
  const coastNoise = createNoise2D(alea(`${seed}-coast`));
  const islandNoise = createNoise2D(alea(`${seed}-island-shape`));

  // Compute island cluster positions
  const islandClusters = computeIslandClusters(
    continentDefs,
    seed,
    width,
    height,
  );

  const landmask = new Uint8Array(width * height);
  const continentMap = new Uint8Array(width * height);

  for (let cz = 0; cz < height; cz++) {
    for (let cx = 0; cx < width; cx++) {
      const idx = cz * width + cx;

      let maxLandValue = -Infinity;
      let nearestContinent = 0; // 0 = ocean
      let minContDist = Infinity;

      // Evaluate each continent's contribution
      for (let ci = 0; ci < continentDefs.length; ci++) {
        const cont = continentDefs[ci];
        const dx = cx - cont.centerX;
        const dz = cz - cont.centerZ;
        const dist = Math.sqrt(dx * dx + dz * dz);
        const normalizedDist = dist / cont.radius;

        // Track nearest continent for assignment
        if (dist < minContDist) {
          minContDist = dist;
          nearestContinent = ci + 1; // 1-indexed
        }

        // Radial gradient: 1.0 at center, 0.0 at radius edge
        const gradient = Math.max(0, 1.0 - normalizedDist);

        // Multi-octave noise for organic shape
        const n =
          fbm(
            landNoise,
            cx * CONTINENT_NOISE_SCALE,
            cz * CONTINENT_NOISE_SCALE,
            CONTINENT_NOISE_OCTAVES,
          ) *
            0.5 +
          0.5;

        // High-frequency coastal detail
        const coastDetail =
          fbm(
            coastNoise,
            cx * COAST_NOISE_SCALE,
            cz * COAST_NOISE_SCALE,
            COAST_NOISE_OCTAVES,
          ) * COAST_CONTRIBUTION;

        const landValue =
          gradient + n * NOISE_CONTRIBUTION + coastDetail - LAND_THRESHOLD;
        maxLandValue = Math.max(maxLandValue, landValue);
      }

      // Check island clusters
      for (const cluster of islandClusters) {
        const dx = cx - cluster.cx;
        const dz = cz - cluster.cz;
        const dist = Math.sqrt(dx * dx + dz * dz);
        const normalizedDist = dist / cluster.radius;

        if (normalizedDist < 1.5) {
          const gradient = Math.max(0, 1.0 - normalizedDist);
          const n =
            fbm(
              islandNoise,
              cx * ISLAND_NOISE_SCALE,
              cz * ISLAND_NOISE_SCALE,
              4,
            ) *
              0.5 +
            0.5;
          const islandValue = gradient * 0.8 + n * 0.4 - 0.55;
          maxLandValue = Math.max(maxLandValue, islandValue);
        }
      }

      // Classify chunk
      if (maxLandValue > 0.1) {
        landmask[idx] = LandType.LAND;
      } else if (maxLandValue > SHALLOW_THRESHOLD) {
        landmask[idx] = LandType.SHALLOW_OCEAN;
      } else {
        landmask[idx] = LandType.DEEP_OCEAN;
      }

      // Assign continent (only for land chunks)
      if (landmask[idx] >= LandType.LAND) {
        continentMap[idx] = nearestContinent;
      }
      // Ocean chunks remain 0
    }
  }

  return { landmask, continentMap, continentDefs };
}

/**
 * Generate elevation noise grid for the world.
 * Land chunks get boosted elevation, ocean chunks get reduced.
 * Returns Float32Array with values in [0.0, 1.0].
 */
export function generateElevation(
  seed: number,
  config: WorldConfig,
  landmask: Uint8Array,
): Float32Array {
  const { width, height } = config;
  const noise = createNoise2D(alea(`${seed}-elevation`));
  const elevation = new Float32Array(width * height);

  for (let cz = 0; cz < height; cz++) {
    for (let cx = 0; cx < width; cx++) {
      const idx = cz * width + cx;

      // Base elevation from fBm noise, normalized to [0, 1]
      const raw =
        fbm(
          noise,
          cx * ELEVATION_NOISE_SCALE,
          cz * ELEVATION_NOISE_SCALE,
          ELEVATION_OCTAVES,
        ) *
          0.5 +
        0.5;

      if (landmask[idx] >= LandType.LAND) {
        // Land chunks get boosted elevation
        elevation[idx] = Math.min(1.0, raw + 0.3);
      } else {
        // Ocean chunks get reduced elevation
        elevation[idx] = raw * 0.3;
      }
    }
  }

  return elevation;
}

/**
 * Generate moisture noise grid for the world.
 * Coastal chunks (land adjacent to ocean) get a moisture boost.
 * Returns Float32Array with values in [0.0, 1.0].
 */
export function generateMoisture(
  seed: number,
  config: WorldConfig,
  landmask: Uint8Array,
): Float32Array {
  const { width, height } = config;
  const noise = createNoise2D(alea(`${seed}-moisture`));
  const moisture = new Float32Array(width * height);

  for (let cz = 0; cz < height; cz++) {
    for (let cx = 0; cx < width; cx++) {
      const idx = cz * width + cx;

      // Base moisture from fBm noise, normalized to [0, 1]
      const raw =
        fbm(
          noise,
          cx * MOISTURE_NOISE_SCALE,
          cz * MOISTURE_NOISE_SCALE,
          MOISTURE_OCTAVES,
        ) *
          0.5 +
        0.5;

      let value = raw;

      // Coastal moisture boost for land chunks adjacent to ocean
      if (landmask[idx] >= LandType.LAND) {
        const neighbors = [
          cz > 0 ? landmask[idx - width] : 255,
          cz < height - 1 ? landmask[idx + width] : 255,
          cx > 0 ? landmask[idx - 1] : 255,
          cx < width - 1 ? landmask[idx + 1] : 255,
        ];
        const isCoastal = neighbors.some((n) => n < LandType.LAND);
        if (isCoastal) {
          value = Math.min(1.0, value + 0.1);
        }
      }

      moisture[idx] = Math.min(1.0, Math.max(0.0, value));
    }
  }

  return moisture;
}

/**
 * Generate temperature noise grid for the world.
 * Temperature is influenced by latitude (vertical position) and noise.
 * Returns Float32Array with values in [0.0, 1.0].
 */
export function generateTemperature(
  seed: number,
  config: WorldConfig,
  landmask: Uint8Array,
): Float32Array {
  const { width, height } = config;
  const noise = createNoise2D(alea(`${seed}-temperature`));
  const temperature = new Float32Array(width * height);

  for (let cz = 0; cz < height; cz++) {
    for (let cx = 0; cx < width; cx++) {
      const idx = cz * width + cx;

      // Latitude influence: warmer near vertical center, cooler at edges
      const latitudeFactor =
        1.0 - (Math.abs(cz - height / 2) / (height / 2)) * TEMPERATURE_LATITUDE_WEIGHT;

      // Noise variation
      const noiseValue =
        fbm(
          noise,
          cx * TEMPERATURE_NOISE_SCALE,
          cz * TEMPERATURE_NOISE_SCALE,
          TEMPERATURE_OCTAVES,
        ) *
          0.5 +
        0.5;

      // Combine latitude and noise
      const value =
        latitudeFactor * (1 - TEMPERATURE_LATITUDE_WEIGHT) +
        noiseValue * TEMPERATURE_LATITUDE_WEIGHT +
        (1 - TEMPERATURE_LATITUDE_WEIGHT) * 0.3;

      temperature[idx] = Math.min(1.0, Math.max(0.0, value));
    }
  }

  return temperature;
}
