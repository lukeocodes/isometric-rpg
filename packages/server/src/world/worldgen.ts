import type { WorldConfig, WorldMap, Continent } from "./types.js";
import { WORLD_WIDTH, WORLD_HEIGHT } from "./constants.js";
import {
  generateContinents,
  generateElevation,
  generateMoisture,
  generateTemperature,
} from "./continents.js";
import {
  generateRegions,
  buildRegionLookup,
  generateRegionNames,
} from "./regions.js";
import { classifyBiomes, getRegionBiome } from "./biomes.js";

/**
 * Complete world generation pipeline.
 * Takes a seed and optional config overrides, produces a fully populated WorldMap.
 *
 * Pipeline:
 * 1. Generate continental landmask and continent assignment
 * 2. Generate elevation, moisture, temperature noise grids
 * 3. Generate Voronoi regions via Poisson disk sampling
 * 4. Build chunk-to-region lookup table
 * 5. Classify biomes with continental modifiers
 * 6. Assign region biomes by majority vote
 * 7. Generate region names
 * 8. Build continent summary objects
 *
 * The entire pipeline is deterministic from the seed.
 */
export function generateWorld(
  seed: number,
  config?: Partial<WorldConfig>,
): WorldMap {
  const startTime = performance.now();

  const fullConfig: WorldConfig = {
    seed,
    width: config?.width ?? WORLD_WIDTH,
    height: config?.height ?? WORLD_HEIGHT,
  };
  const { width, height } = fullConfig;

  // Step 1: Generate continental shapes
  const { landmask, continentMap, continentDefs } = generateContinents(
    seed,
    fullConfig,
  );

  // Step 2: Generate noise layers
  const elevation = generateElevation(seed, fullConfig, landmask);
  const moisture = generateMoisture(seed, fullConfig, landmask);
  const temperature = generateTemperature(seed, fullConfig, landmask);

  // Step 3: Generate Voronoi regions
  const regions = generateRegions(
    seed,
    fullConfig,
    landmask,
    continentMap,
    continentDefs,
  );

  // Step 4: Build chunk-to-region lookup (also updates region chunkCounts)
  const regionMap = buildRegionLookup(regions, width, height);

  // Step 5: Classify biomes
  const biomeMap = classifyBiomes(
    seed,
    elevation,
    moisture,
    temperature,
    landmask,
    continentMap,
    continentDefs,
    width,
    height,
  );

  // Step 6: Assign each region's biome by majority chunk vote
  for (const region of regions) {
    region.biome = getRegionBiome(region.id, regionMap, biomeMap, width, height);
  }

  // Step 7: Generate region names
  generateRegionNames(regions, seed);

  // Step 8: Build continent summary objects with chunk counts
  const continents: Continent[] = continentDefs.map((def) => {
    let chunkCount = 0;
    const contIdx =
      continentDefs.indexOf(def) + 1; // 1-indexed in continentMap
    for (let i = 0; i < continentMap.length; i++) {
      if (continentMap[i] === contIdx) {
        chunkCount++;
      }
    }
    return {
      id: def.id,
      name: def.name,
      race: def.race,
      centerX: def.centerX,
      centerZ: def.centerZ,
      radius: def.radius,
      chunkCount,
    };
  });

  const elapsed = performance.now() - startTime;
  console.log(
    `[World] Generated in ${elapsed.toFixed(0)}ms: ${regions.length} regions, ${continents.length} continents`,
  );

  return {
    seed,
    width,
    height,
    continents,
    regions,
    landmask,
    elevation,
    moisture,
    temperature,
    regionMap,
    continentMap,
    biomeMap,
  };
}
