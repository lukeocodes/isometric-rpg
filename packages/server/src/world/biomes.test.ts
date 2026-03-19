import { describe, it, expect, beforeAll } from "vitest";
import { classifyBiomes, classifyBiome, getRegionBiome } from "./biomes.js";
import {
  generateContinents,
  generateElevation,
  generateMoisture,
  generateTemperature,
} from "./continents.js";
import { generateRegions, buildRegionLookup } from "./regions.js";
import { BiomeType } from "./types.js";
import type { WorldConfig, Region } from "./types.js";
import { WORLD_WIDTH, WORLD_HEIGHT } from "./constants.js";

const config: WorldConfig = {
  seed: 42,
  width: WORLD_WIDTH,
  height: WORLD_HEIGHT,
};

describe("biomes", () => {
  let landmask: Uint8Array;
  let continentMap: Uint8Array;
  let continentDefs: ReturnType<typeof generateContinents>["continentDefs"];
  let elevation: Float32Array;
  let moisture: Float32Array;
  let temperature: Float32Array;
  let biomeMap: Uint8Array;
  let regions: Region[];
  let regionMap: Uint16Array;

  beforeAll(() => {
    const result = generateContinents(42, config);
    landmask = result.landmask;
    continentMap = result.continentMap;
    continentDefs = result.continentDefs;

    elevation = generateElevation(42, config, landmask);
    moisture = generateMoisture(42, config, landmask);
    temperature = generateTemperature(42, config, landmask);

    biomeMap = classifyBiomes(
      42,
      elevation,
      moisture,
      temperature,
      landmask,
      continentMap,
      continentDefs,
      config.width,
      config.height,
    );

    regions = generateRegions(42, config, landmask, continentMap, continentDefs);
    regionMap = buildRegionLookup(regions, config.width, config.height);
  });

  it("Elf continent has majority forest biomes", () => {
    const elfContIdx = continentDefs.findIndex((c) => c.id === "elf") + 1;
    let elfLandCount = 0;
    let elfForestCount = 0;

    for (let i = 0; i < landmask.length; i++) {
      if (continentMap[i] === elfContIdx && landmask[i] >= 2) {
        elfLandCount++;
        const biome = biomeMap[i];
        if (
          biome === BiomeType.DENSE_FOREST ||
          biome === BiomeType.TEMPERATE_FOREST ||
          biome === BiomeType.BOREAL_FOREST
        ) {
          elfForestCount++;
        }
      }
    }

    const forestRatio = elfForestCount / elfLandCount;
    expect(forestRatio).toBeGreaterThan(0.4);
  });

  it("Dwarf continent has majority mountain/tundra biomes", () => {
    const dwarfContIdx = continentDefs.findIndex((c) => c.id === "dwarf") + 1;
    let dwarfLandCount = 0;
    let dwarfMountainCount = 0;

    for (let i = 0; i < landmask.length; i++) {
      if (continentMap[i] === dwarfContIdx && landmask[i] >= 2) {
        dwarfLandCount++;
        const biome = biomeMap[i];
        if (
          biome === BiomeType.MOUNTAIN ||
          biome === BiomeType.SNOW_PEAK ||
          biome === BiomeType.TUNDRA ||
          biome === BiomeType.HIGHLAND
        ) {
          dwarfMountainCount++;
        }
      }
    }

    const mountainRatio = dwarfMountainCount / dwarfLandCount;
    expect(mountainRatio).toBeGreaterThan(0.3);
  });

  it("Human continent has most diverse biome distribution", () => {
    const humanContIdx = continentDefs.findIndex((c) => c.id === "human") + 1;
    const biomeSet = new Set<number>();

    for (let i = 0; i < landmask.length; i++) {
      if (continentMap[i] === humanContIdx && landmask[i] >= 2) {
        biomeSet.add(biomeMap[i]);
      }
    }

    expect(biomeSet.size).toBeGreaterThanOrEqual(6);
  });

  it("each continent has at least one contrasting wild zone", () => {
    const elfContIdx = continentDefs.findIndex((c) => c.id === "elf") + 1;
    const dwarfContIdx = continentDefs.findIndex((c) => c.id === "dwarf") + 1;
    const humanContIdx = continentDefs.findIndex((c) => c.id === "human") + 1;

    let elfHasContrast = false;
    let dwarfHasContrast = false;
    let humanHasContrast = false;

    for (let i = 0; i < landmask.length; i++) {
      if (landmask[i] < 2) continue;

      const biome = biomeMap[i];
      if (continentMap[i] === elfContIdx) {
        if (biome === BiomeType.DESERT || biome === BiomeType.SCRUBLAND) {
          elfHasContrast = true;
        }
      }
      if (continentMap[i] === dwarfContIdx) {
        if (biome === BiomeType.SWAMP || biome === BiomeType.DENSE_FOREST) {
          dwarfHasContrast = true;
        }
      }
      if (continentMap[i] === humanContIdx) {
        if (biome === BiomeType.SNOW_PEAK || biome === BiomeType.TUNDRA) {
          humanHasContrast = true;
        }
      }
    }

    expect(elfHasContrast).toBe(true);
    expect(dwarfHasContrast).toBe(true);
    expect(humanHasContrast).toBe(true);
  });

  it("ocean chunks are classified as DEEP_OCEAN or SHALLOW_OCEAN", () => {
    let allOceanValid = true;
    for (let i = 0; i < landmask.length; i++) {
      if (landmask[i] < 2) {
        const biome = biomeMap[i];
        if (
          biome !== BiomeType.DEEP_OCEAN &&
          biome !== BiomeType.SHALLOW_OCEAN
        ) {
          allOceanValid = false;
          break;
        }
      }
    }
    expect(allOceanValid).toBe(true);
  });

  it("biome classification is deterministic", () => {
    const biomeMap2 = classifyBiomes(
      42,
      elevation,
      moisture,
      temperature,
      landmask,
      continentMap,
      continentDefs,
      config.width,
      config.height,
    );

    let identical = true;
    for (let i = 0; i < biomeMap.length; i++) {
      if (biomeMap[i] !== biomeMap2[i]) {
        identical = false;
        break;
      }
    }
    expect(identical).toBe(true);
  });
});
