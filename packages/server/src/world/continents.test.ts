import { describe, it, expect } from "vitest";
import {
  placeContinents,
  generateContinents,
  generateElevation,
  generateMoisture,
  generateTemperature,
} from "./continents.js";
import type { WorldConfig, ContinentDef } from "./types.js";
import { LandType } from "./types.js";
import { CONTINENT_RADIUS } from "./constants.js";

const TEST_CONFIG: WorldConfig = { seed: 42, width: 900, height: 900 };

/**
 * BFS flood fill to find connected land groups in a landmask.
 * Returns an array of groups (each group is a Set of chunk indices),
 * sorted descending by size.
 */
function findConnectedLandGroups(
  landmask: Uint8Array,
  width: number,
  height: number,
  minLandValue = 2,
): Set<number>[] {
  const visited = new Uint8Array(width * height);
  const groups: Set<number>[] = [];

  for (let i = 0; i < width * height; i++) {
    if (landmask[i] >= minLandValue && !visited[i]) {
      const group = new Set<number>();
      const queue: number[] = [i];
      visited[i] = 1;

      while (queue.length > 0) {
        const idx = queue.pop()!;
        group.add(idx);

        const cx = idx % width;
        const cz = Math.floor(idx / width);

        // 4-directional adjacency
        const neighbors = [
          cz > 0 ? idx - width : -1,
          cz < height - 1 ? idx + width : -1,
          cx > 0 ? idx - 1 : -1,
          cx < width - 1 ? idx + 1 : -1,
        ];

        for (const n of neighbors) {
          if (n >= 0 && !visited[n] && landmask[n] >= minLandValue) {
            visited[n] = 1;
            queue.push(n);
          }
        }
      }

      groups.push(group);
    }
  }

  // Sort descending by size
  groups.sort((a, b) => b.size - a.size);
  return groups;
}

describe("placeContinents", () => {
  it("returns 3 continent definitions", () => {
    const defs = placeContinents(900, 900);
    expect(defs).toHaveLength(3);
  });

  it("has races human, elf, and dwarf", () => {
    const defs = placeContinents(900, 900);
    const races = defs.map((d) => d.race).sort();
    expect(races).toEqual(["dwarf", "elf", "human"]);
  });

  it("has distinct centers for each continent", () => {
    const defs = placeContinents(900, 900);
    for (let i = 0; i < defs.length; i++) {
      for (let j = i + 1; j < defs.length; j++) {
        const dist = Math.sqrt(
          (defs[i].centerX - defs[j].centerX) ** 2 +
            (defs[i].centerZ - defs[j].centerZ) ** 2,
        );
        expect(dist).toBeGreaterThan(100); // They should be far apart
      }
    }
  });

  it("uses the expected radius", () => {
    const defs = placeContinents(900, 900);
    for (const def of defs) {
      expect(def.radius).toBe(CONTINENT_RADIUS);
    }
  });
});

describe("generateContinents", () => {
  it("produces landmask with three distinct landmasses", () => {
    const { landmask } = generateContinents(42, TEST_CONFIG);
    const groups = findConnectedLandGroups(landmask, 900, 900);

    // Should have at least 3 major land groups (continents), each > 1000 chunks
    const majorGroups = groups.filter((g) => g.size > 1000);
    expect(majorGroups.length).toBe(3);
  });

  it("continents are strictly ocean-separated", () => {
    const { landmask, continentDefs } = generateContinents(42, TEST_CONFIG);
    const groups = findConnectedLandGroups(landmask, 900, 900);
    const majorGroups = groups.filter((g) => g.size > 1000);

    // For each major group, find the nearest continent center
    const groupContinents = majorGroups.map((group) => {
      // Sample a point from the group near the center-of-mass
      let sumX = 0,
        sumZ = 0,
        count = 0;
      for (const idx of group) {
        sumX += idx % 900;
        sumZ += Math.floor(idx / 900);
        count++;
      }
      const avgX = sumX / count;
      const avgZ = sumZ / count;

      // Which continent center is closest?
      let closest = "";
      let minDist = Infinity;
      for (const def of continentDefs) {
        const dist = Math.sqrt(
          (avgX - def.centerX) ** 2 + (avgZ - def.centerZ) ** 2,
        );
        if (dist < minDist) {
          minDist = dist;
          closest = def.id;
        }
      }
      return closest;
    });

    // Each major group should belong to a DIFFERENT continent
    const uniqueContinents = new Set(groupContinents);
    expect(uniqueContinents.size).toBe(3);
  });

  it("continental shapes are not circular", () => {
    const { landmask } = generateContinents(42, TEST_CONFIG);
    const groups = findConnectedLandGroups(landmask, 900, 900);
    const majorGroups = groups.filter((g) => g.size > 1000);

    for (const group of majorGroups) {
      // Count perimeter chunks (land chunks adjacent to at least one non-land chunk)
      let perimeter = 0;
      for (const idx of group) {
        const cx = idx % 900;
        const cz = Math.floor(idx / 900);
        const neighbors = [
          cz > 0 ? idx - 900 : -1,
          cz < 899 ? idx + 900 : -1,
          cx > 0 ? idx - 1 : -1,
          cx < 899 ? idx + 1 : -1,
        ];
        for (const n of neighbors) {
          if (n < 0 || landmask[n] < 2) {
            perimeter++;
            break;
          }
        }
      }

      const area = group.size;
      // For a perfect circle: perimeter/area ratio = 2*sqrt(pi/area) / 1
      // The actual shape ratio should exceed a circle by 1.2x
      const circleRatio = (2 * Math.sqrt(Math.PI * area)) / area;
      const actualRatio = perimeter / area;
      expect(actualRatio / circleRatio).toBeGreaterThan(1.2);
    }
  });

  it("determinism - same seed produces identical landmask", () => {
    const result1 = generateContinents(42, TEST_CONFIG);
    const result2 = generateContinents(42, TEST_CONFIG);

    // Byte-identical landmask
    expect(result1.landmask.length).toBe(result2.landmask.length);
    for (let i = 0; i < result1.landmask.length; i++) {
      expect(result1.landmask[i]).toBe(result2.landmask[i]);
    }

    // Byte-identical continentMap
    for (let i = 0; i < result1.continentMap.length; i++) {
      expect(result1.continentMap[i]).toBe(result2.continentMap[i]);
    }
  });

  it("world contains island clusters between continent pairs", () => {
    const { landmask } = generateContinents(42, TEST_CONFIG);
    const groups = findConnectedLandGroups(landmask, 900, 900);

    // Filter for small land groups (islands: 10-200 chunks)
    const islands = groups.filter((g) => g.size >= 10 && g.size <= 200);
    expect(islands.length).toBeGreaterThanOrEqual(3); // at least some islands
  });
});

describe("generateElevation", () => {
  it("elevation grid has valid range", () => {
    const { landmask } = generateContinents(42, TEST_CONFIG);
    const elevation = generateElevation(42, TEST_CONFIG, landmask);

    expect(elevation.length).toBe(900 * 900);

    for (let i = 0; i < elevation.length; i++) {
      expect(elevation[i]).toBeGreaterThanOrEqual(0.0);
      expect(elevation[i]).toBeLessThanOrEqual(1.0);
    }
  });

  it("land chunks have higher average elevation than ocean chunks", () => {
    const { landmask } = generateContinents(42, TEST_CONFIG);
    const elevation = generateElevation(42, TEST_CONFIG, landmask);

    let landSum = 0,
      landCount = 0;
    let oceanSum = 0,
      oceanCount = 0;
    for (let i = 0; i < elevation.length; i++) {
      if (landmask[i] >= 2) {
        landSum += elevation[i];
        landCount++;
      } else {
        oceanSum += elevation[i];
        oceanCount++;
      }
    }

    const landAvg = landSum / landCount;
    const oceanAvg = oceanSum / oceanCount;
    expect(landAvg).toBeGreaterThan(oceanAvg);
  });
});

describe("generateMoisture", () => {
  it("moisture grid has valid range", () => {
    const { landmask } = generateContinents(42, TEST_CONFIG);
    const moisture = generateMoisture(42, TEST_CONFIG, landmask);

    expect(moisture.length).toBe(900 * 900);

    for (let i = 0; i < moisture.length; i++) {
      expect(moisture[i]).toBeGreaterThanOrEqual(0.0);
      expect(moisture[i]).toBeLessThanOrEqual(1.0);
    }
  });
});

describe("generateTemperature", () => {
  it("temperature grid has valid range", () => {
    const { landmask } = generateContinents(42, TEST_CONFIG);
    const temperature = generateTemperature(42, TEST_CONFIG, landmask);

    expect(temperature.length).toBe(900 * 900);

    for (let i = 0; i < temperature.length; i++) {
      expect(temperature[i]).toBeGreaterThanOrEqual(0.0);
      expect(temperature[i]).toBeLessThanOrEqual(1.0);
    }
  });
});

describe("performance", () => {
  it("generation completes in under 2 seconds", () => {
    const start = performance.now();

    const { landmask } = generateContinents(42, TEST_CONFIG);
    generateElevation(42, TEST_CONFIG, landmask);
    generateMoisture(42, TEST_CONFIG, landmask);
    generateTemperature(42, TEST_CONFIG, landmask);

    const elapsed = performance.now() - start;
    expect(elapsed).toBeLessThan(2000);
  });
});
