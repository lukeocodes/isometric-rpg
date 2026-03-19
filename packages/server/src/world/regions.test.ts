import { describe, it, expect, beforeAll } from "vitest";
import {
  generateRegions,
  buildRegionLookup,
  generateRegionNames,
} from "./regions.js";
import { generateContinents } from "./continents.js";
import type { WorldConfig, Region } from "./types.js";
import { WORLD_WIDTH, WORLD_HEIGHT } from "./constants.js";

const config: WorldConfig = {
  seed: 42,
  width: WORLD_WIDTH,
  height: WORLD_HEIGHT,
};

describe("regions", () => {
  let landmask: Uint8Array;
  let continentMap: Uint8Array;
  let continentDefs: ReturnType<typeof generateContinents>["continentDefs"];
  let regions: Region[];

  beforeAll(() => {
    const result = generateContinents(42, config);
    landmask = result.landmask;
    continentMap = result.continentMap;
    continentDefs = result.continentDefs;
    regions = generateRegions(42, config, landmask, continentMap, continentDefs);
  });

  describe("generateRegions", () => {
    it("produces 20-30 land regions per continent", () => {
      const elfRegions = regions.filter(
        (r) => r.isLand && r.continentId === "elf",
      );
      const dwarfRegions = regions.filter(
        (r) => r.isLand && r.continentId === "dwarf",
      );
      const humanRegions = regions.filter(
        (r) => r.isLand && r.continentId === "human",
      );

      expect(elfRegions.length).toBeGreaterThanOrEqual(20);
      expect(elfRegions.length).toBeLessThanOrEqual(30);
      expect(dwarfRegions.length).toBeGreaterThanOrEqual(20);
      expect(dwarfRegions.length).toBeLessThanOrEqual(30);
      expect(humanRegions.length).toBeGreaterThanOrEqual(20);
      expect(humanRegions.length).toBeLessThanOrEqual(30);
    });

    it("produces ocean regions", () => {
      const oceanRegions = regions.filter((r) => !r.isLand);
      expect(oceanRegions.length).toBeGreaterThanOrEqual(15);
    });

    it("has evenly distributed region seed points (Poisson disk property)", () => {
      const landRegions = regions.filter((r) => r.isLand);
      const MIN_DISTANCE = 30; // no two land region centers within 30 chunks
      for (let i = 0; i < landRegions.length; i++) {
        for (let j = i + 1; j < landRegions.length; j++) {
          const dx = landRegions[i].centerX - landRegions[j].centerX;
          const dz = landRegions[i].centerZ - landRegions[j].centerZ;
          const dist = Math.sqrt(dx * dx + dz * dz);
          expect(dist).toBeGreaterThanOrEqual(MIN_DISTANCE);
        }
      }
    });

    it("places POIs in land regions only", () => {
      const landRegions = regions.filter((r) => r.isLand);
      const oceanRegions = regions.filter((r) => !r.isLand);

      // Each land region has 0-3 POIs
      for (const region of landRegions) {
        expect(region.pois.length).toBeGreaterThanOrEqual(0);
        expect(region.pois.length).toBeLessThanOrEqual(3);
      }

      // No POIs in ocean regions
      for (const region of oceanRegions) {
        expect(region.pois.length).toBe(0);
      }
    });

    it("is deterministic", () => {
      const regions2 = generateRegions(
        42,
        config,
        landmask,
        continentMap,
        continentDefs,
      );
      expect(regions.length).toBe(regions2.length);
      for (let i = 0; i < regions.length; i++) {
        expect(regions[i].centerX).toBe(regions2[i].centerX);
        expect(regions[i].centerZ).toBe(regions2[i].centerZ);
        expect(regions[i].continentId).toBe(regions2[i].continentId);
        expect(regions[i].isLand).toBe(regions2[i].isLand);
      }
    });
  });

  describe("buildRegionLookup", () => {
    let regionMap: Uint16Array;

    beforeAll(() => {
      regionMap = buildRegionLookup(regions, config.width, config.height);
    });

    it("produces O(1) lookup as Uint16Array of correct length", () => {
      expect(regionMap).toBeInstanceOf(Uint16Array);
      expect(regionMap.length).toBe(config.width * config.height);
    });

    it("assigns every entry a valid region ID", () => {
      let allValid = true;
      for (let i = 0; i < regionMap.length; i++) {
        if (regionMap[i] >= regions.length) {
          allValid = false;
          break;
        }
      }
      expect(allValid).toBe(true);
    });

    it("is consistent with chunk-to-continent mapping", () => {
      // For every land chunk, the region's continentId should match
      // the continentMap entry
      let inconsistencies = 0;
      for (let cz = 0; cz < config.height; cz++) {
        for (let cx = 0; cx < config.width; cx++) {
          const idx = cz * config.width + cx;
          const contIdx = continentMap[idx]; // 0=ocean, 1-3=continent
          if (contIdx === 0) continue; // skip ocean chunks

          const regionId = regionMap[idx];
          const region = regions[regionId];
          const expectedContId = continentDefs[contIdx - 1].id;

          if (region.continentId !== expectedContId) {
            inconsistencies++;
          }
        }
      }
      // Allow up to 10% inconsistency for boundary spillover where
      // a region center is on one continent but its Voronoi cell spills
      // across the boundary into an adjacent continent
      const totalLandChunks = Array.from(continentMap).filter(
        (v) => v > 0,
      ).length;
      const inconsistencyRate = inconsistencies / totalLandChunks;
      expect(inconsistencyRate).toBeLessThan(0.1);
    });
  });

  describe("generateRegionNames", () => {
    it("produces unique names for all regions", () => {
      const namedRegions = [...regions];
      generateRegionNames(namedRegions, 42);

      const names = namedRegions.map((r) => r.name);
      const uniqueNames = new Set(names);

      // Every region has a non-empty name
      for (const name of names) {
        expect(name.length).toBeGreaterThan(0);
      }

      // All names are unique
      expect(uniqueNames.size).toBe(names.length);
    });

    it("is deterministic", () => {
      const regionsA = [...regions];
      const regionsB = [...regions];
      generateRegionNames(regionsA, 42);
      generateRegionNames(regionsB, 42);
      for (let i = 0; i < regionsA.length; i++) {
        expect(regionsA[i].name).toBe(regionsB[i].name);
      }
    });
  });
});
