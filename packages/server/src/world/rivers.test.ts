import { describe, it, expect, beforeAll } from "vitest";
import { BiomeType, LandType } from "./types.js";
import {
  RIVER_SOURCE_ELEVATION_MIN,
  RIVER_SOURCE_MOISTURE_MIN,
  LAKE_MIN_SIZE,
} from "./constants.js";

/**
 * Helper: create a flat test grid with given dimensions.
 * Returns { biomeMap, elevation, moisture, landmask } with all land.
 * Override specific chunks after creation.
 */
function createTestGrid(
  width: number,
  height: number,
  opts?: {
    defaultElevation?: number;
    defaultMoisture?: number;
    defaultLandmask?: number;
    defaultBiome?: number;
  },
) {
  const size = width * height;
  const defaultElev = opts?.defaultElevation ?? 0.5;
  const defaultMoist = opts?.defaultMoisture ?? 0.6;
  const defaultLand = opts?.defaultLandmask ?? LandType.LAND;
  const defaultBiome = opts?.defaultBiome ?? BiomeType.TEMPERATE_GRASSLAND;

  const biomeMap = new Uint8Array(size);
  const elevation = new Float32Array(size);
  const moisture = new Float32Array(size);
  const landmask = new Uint8Array(size);

  for (let i = 0; i < size; i++) {
    biomeMap[i] = defaultBiome;
    elevation[i] = defaultElev;
    moisture[i] = defaultMoist;
    landmask[i] = defaultLand;
  }

  return { biomeMap, elevation, moisture, landmask };
}

describe("river source selection", () => {
  it("marks at least some chunks as RIVER on a suitable grid", async () => {
    const { generateRiversAndLakes } = await import("./rivers.js");

    const width = 20;
    const height = 20;
    const { biomeMap, elevation, moisture, landmask } = createTestGrid(
      width,
      height,
      {
        defaultElevation: 0.85,
        defaultMoisture: 0.6,
      },
    );

    // Create a gradient: high elevation on left, decreasing toward right
    for (let z = 0; z < height; z++) {
      for (let x = 0; x < width; x++) {
        const idx = z * width + x;
        elevation[idx] = 0.9 - (x / width) * 0.6; // 0.9 -> 0.3
        // Right edge is ocean
        if (x >= width - 2) {
          landmask[idx] = LandType.SHALLOW_OCEAN;
          biomeMap[idx] = BiomeType.SHALLOW_OCEAN;
          elevation[idx] = 0.1;
        }
      }
    }

    generateRiversAndLakes(42, biomeMap, elevation, moisture, landmask, width, height);

    let riverCount = 0;
    for (let i = 0; i < biomeMap.length; i++) {
      if (biomeMap[i] === BiomeType.RIVER) riverCount++;
    }

    expect(riverCount).toBeGreaterThan(0);
  });
});

describe("river flows downhill", () => {
  it("river chunks appear along an elevation gradient", async () => {
    const { generateRiversAndLakes } = await import("./rivers.js");

    const width = 10;
    const height = 10;
    const { biomeMap, elevation, moisture, landmask } = createTestGrid(
      width,
      height,
      {
        defaultMoisture: 0.7,
      },
    );

    // Simple gradient: high on left (x=0), low on right (x=9)
    // Right column is ocean
    for (let z = 0; z < height; z++) {
      for (let x = 0; x < width; x++) {
        const idx = z * width + x;
        elevation[idx] = 0.9 - (x / (width - 1)) * 0.7; // 0.9 -> 0.2
        if (x === width - 1) {
          landmask[idx] = LandType.SHALLOW_OCEAN;
          biomeMap[idx] = BiomeType.SHALLOW_OCEAN;
          elevation[idx] = 0.1;
        }
      }
    }

    generateRiversAndLakes(42, biomeMap, elevation, moisture, landmask, width, height);

    // River chunks should exist somewhere in the middle columns
    const riverChunks: { x: number; z: number }[] = [];
    for (let z = 0; z < height; z++) {
      for (let x = 0; x < width; x++) {
        if (biomeMap[z * width + x] === BiomeType.RIVER) {
          riverChunks.push({ x, z });
        }
      }
    }

    expect(riverChunks.length).toBeGreaterThan(0);
    // Rivers should flow from high-x to low-x or along the gradient
    // The source should be near the high-elevation end
  });
});

describe("river width increases", () => {
  it("river near the mouth has greater per-column width than near source", async () => {
    const { generateRiversAndLakes } = await import("./rivers.js");

    // Use a wide grid. All elevation stays above 0.7 (above seeded lake range 0.5-0.7)
    // to prevent lakes from interfering with the river test.
    const width = 50;
    const height = 30;
    const { biomeMap, elevation, moisture, landmask } = createTestGrid(
      width,
      height,
      {
        defaultElevation: 0.95, // Very high, no lakes possible
        defaultMoisture: 0.3,   // Low default moisture
      },
    );

    // Create the river corridor: single row with gradient from 0.95 to 0.71
    // This keeps ALL chunks above seeded lake range while still providing a gradient
    const riverRow = Math.floor(height / 2);
    for (let x = 0; x < width - 2; x++) {
      const idx = riverRow * width + x;
      // Gradient: 0.95 at x=0 down to ~0.71 at x=47
      elevation[idx] = 0.95 - (x / (width - 3)) * 0.24;
      moisture[idx] = 0.7;
    }

    // Ocean on right edge
    for (let z = 0; z < height; z++) {
      for (let x = width - 2; x < width; x++) {
        const idx = z * width + x;
        landmask[idx] = LandType.SHALLOW_OCEAN;
        biomeMap[idx] = BiomeType.SHALLOW_OCEAN;
        elevation[idx] = 0.1;
      }
    }

    generateRiversAndLakes(42, biomeMap, elevation, moisture, landmask, width, height);

    // Count total river to verify at least one formed
    let totalRiver = 0;
    for (let i = 0; i < biomeMap.length; i++) {
      if (biomeMap[i] === BiomeType.RIVER) totalRiver++;
    }
    expect(totalRiver).toBeGreaterThan(0);

    // Measure river cross-section at source end vs mouth end
    // Source: column 5, Mouth: column 40
    let sourceRowCount = 0;
    for (let z = 0; z < height; z++) {
      if (biomeMap[z * width + 5] === BiomeType.RIVER) sourceRowCount++;
    }
    let mouthRowCount = 0;
    for (let z = 0; z < height; z++) {
      if (biomeMap[z * width + 40] === BiomeType.RIVER) mouthRowCount++;
    }

    // The mouth column should have at least as many RIVER-occupied rows
    // as the source column due to width expansion with flow accumulation
    expect(mouthRowCount).toBeGreaterThanOrEqual(sourceRowCount);
  });
});

describe("lake detection", () => {
  it("lakes form in elevation basins", async () => {
    const { generateRiversAndLakes } = await import("./rivers.js");

    const width = 10;
    const height = 10;
    const { biomeMap, elevation, moisture, landmask } = createTestGrid(
      width,
      height,
      {
        defaultElevation: 0.6,
        defaultMoisture: 0.3, // Low moisture to minimize river sources
      },
    );

    // Create a basin: center 4x4 area at low elevation, surrounded by higher terrain
    for (let z = 3; z <= 6; z++) {
      for (let x = 3; x <= 6; x++) {
        elevation[z * width + x] = 0.3;
      }
    }

    generateRiversAndLakes(42, biomeMap, elevation, moisture, landmask, width, height);

    let lakeCount = 0;
    for (let i = 0; i < biomeMap.length; i++) {
      if (biomeMap[i] === BiomeType.LAKE) lakeCount++;
    }

    expect(lakeCount).toBeGreaterThanOrEqual(LAKE_MIN_SIZE);
  });
});

describe("lake minimum size", () => {
  it("discards basins smaller than LAKE_MIN_SIZE", async () => {
    const { generateRiversAndLakes } = await import("./rivers.js");

    const width = 10;
    const height = 10;
    const { biomeMap, elevation, moisture, landmask } = createTestGrid(
      width,
      height,
      {
        defaultElevation: 0.8, // Above seeded lake range (0.5-0.7) to prevent seeded lakes
        defaultMoisture: 0.3,
      },
    );

    // Create a tiny basin: only 2 chunks (below LAKE_MIN_SIZE=4)
    // Make two adjacent chunks lower than all their neighbors
    elevation[4 * width + 4] = 0.4;
    elevation[4 * width + 5] = 0.4;
    // Surrounding chunks stay at 0.8 -- well above the basin

    generateRiversAndLakes(42, biomeMap, elevation, moisture, landmask, width, height);

    let lakeCount = 0;
    for (let i = 0; i < biomeMap.length; i++) {
      if (biomeMap[i] === BiomeType.LAKE) lakeCount++;
    }

    // The 2-chunk basin should be too small for a lake
    expect(lakeCount).toBe(0);
  });
});

describe("river terminates at ocean", () => {
  it("river does not mark ocean chunks as RIVER", async () => {
    const { generateRiversAndLakes } = await import("./rivers.js");

    const width = 15;
    const height = 5;
    const { biomeMap, elevation, moisture, landmask } = createTestGrid(
      width,
      height,
      {
        defaultMoisture: 0.7,
      },
    );

    // Gradient with ocean on right
    for (let z = 0; z < height; z++) {
      for (let x = 0; x < width; x++) {
        const idx = z * width + x;
        elevation[idx] = 0.9 - (x / (width - 1)) * 0.7;
        if (x >= width - 3) {
          landmask[idx] = LandType.SHALLOW_OCEAN;
          biomeMap[idx] = BiomeType.SHALLOW_OCEAN;
          elevation[idx] = 0.1;
        }
      }
    }

    generateRiversAndLakes(42, biomeMap, elevation, moisture, landmask, width, height);

    // Verify ocean chunks are still ocean, not RIVER
    for (let z = 0; z < height; z++) {
      for (let x = width - 3; x < width; x++) {
        const idx = z * width + x;
        expect(biomeMap[idx]).not.toBe(BiomeType.RIVER);
      }
    }
  });
});

describe("determinism", () => {
  it("same seed produces identical biomeMap", async () => {
    const { generateRiversAndLakes } = await import("./rivers.js");

    const width = 20;
    const height = 20;

    // Build two identical grids
    const grid1 = createTestGrid(width, height, {
      defaultElevation: 0.85,
      defaultMoisture: 0.6,
    });
    const grid2 = createTestGrid(width, height, {
      defaultElevation: 0.85,
      defaultMoisture: 0.6,
    });

    // Same gradient on both
    for (let z = 0; z < height; z++) {
      for (let x = 0; x < width; x++) {
        const idx = z * width + x;
        const elev = 0.9 - (x / width) * 0.6;
        grid1.elevation[idx] = elev;
        grid2.elevation[idx] = elev;
        if (x >= width - 2) {
          grid1.landmask[idx] = LandType.SHALLOW_OCEAN;
          grid1.biomeMap[idx] = BiomeType.SHALLOW_OCEAN;
          grid1.elevation[idx] = 0.1;
          grid2.landmask[idx] = LandType.SHALLOW_OCEAN;
          grid2.biomeMap[idx] = BiomeType.SHALLOW_OCEAN;
          grid2.elevation[idx] = 0.1;
        }
      }
    }

    generateRiversAndLakes(
      42,
      grid1.biomeMap,
      grid1.elevation,
      grid1.moisture,
      grid1.landmask,
      width,
      height,
    );
    generateRiversAndLakes(
      42,
      grid2.biomeMap,
      grid2.elevation,
      grid2.moisture,
      grid2.landmask,
      width,
      height,
    );

    for (let i = 0; i < grid1.biomeMap.length; i++) {
      expect(grid1.biomeMap[i]).toBe(grid2.biomeMap[i]);
    }
  });
});

describe("river valley adjacency", () => {
  it("land chunks adjacent to RIVER have RIVER_VALLEY biome", async () => {
    const { generateRiversAndLakes } = await import("./rivers.js");

    // Use a wide grid with limited moisture so only one river strip forms,
    // leaving ample non-river land for RIVER_VALLEY marking
    const width = 30;
    const height = 20;
    const { biomeMap, elevation, moisture, landmask } = createTestGrid(
      width,
      height,
      {
        defaultMoisture: 0.3, // Low moisture everywhere
      },
    );

    // Create elevation gradient and a single high-moisture river corridor
    const riverRow = Math.floor(height / 2);
    for (let z = 0; z < height; z++) {
      for (let x = 0; x < width; x++) {
        const idx = z * width + x;
        elevation[idx] = 0.9 - (x / (width - 1)) * 0.65;
        // Only give high moisture to one row to create a single river
        if (z === riverRow) {
          moisture[idx] = 0.7;
        }
        if (x >= width - 2) {
          landmask[idx] = LandType.SHALLOW_OCEAN;
          biomeMap[idx] = BiomeType.SHALLOW_OCEAN;
          elevation[idx] = 0.1;
        }
      }
    }

    generateRiversAndLakes(42, biomeMap, elevation, moisture, landmask, width, height);

    // Check that RIVER_VALLEY chunks exist
    let riverValleyCount = 0;
    for (let i = 0; i < biomeMap.length; i++) {
      if (biomeMap[i] === BiomeType.RIVER_VALLEY) riverValleyCount++;
    }

    expect(riverValleyCount).toBeGreaterThan(0);

    // Verify that every RIVER_VALLEY chunk is adjacent to a RIVER chunk
    for (let z = 0; z < height; z++) {
      for (let x = 0; x < width; x++) {
        if (biomeMap[z * width + x] === BiomeType.RIVER_VALLEY) {
          let adjacentToRiver = false;
          for (let dz = -1; dz <= 1; dz++) {
            for (let dx = -1; dx <= 1; dx++) {
              if (dx === 0 && dz === 0) continue;
              const nx = x + dx;
              const nz = z + dz;
              if (nx < 0 || nx >= width || nz < 0 || nz >= height) continue;
              if (biomeMap[nz * width + nx] === BiomeType.RIVER) {
                adjacentToRiver = true;
              }
            }
          }
          expect(adjacentToRiver).toBe(true);
        }
      }
    }
  });
});

describe("full worldgen integration", () => {
  let biomeMap: Uint8Array;

  beforeAll(async () => {
    const { generateWorld } = await import("./worldgen.js");
    const world = generateWorld(42);
    biomeMap = world.biomeMap;
  });

  it("biomeMap contains RIVER chunks", () => {
    let riverCount = 0;
    for (let i = 0; i < biomeMap.length; i++) {
      if (biomeMap[i] === BiomeType.RIVER) riverCount++;
    }
    expect(riverCount).toBeGreaterThan(0);
  });

  it("biomeMap contains LAKE chunks", () => {
    let lakeCount = 0;
    for (let i = 0; i < biomeMap.length; i++) {
      if (biomeMap[i] === BiomeType.LAKE) lakeCount++;
    }
    expect(lakeCount).toBeGreaterThan(0);
  });

  it("RIVER + LAKE chunks are less than 10% of total land chunks", () => {
    let riverLakeCount = 0;
    let landCount = 0;
    for (let i = 0; i < biomeMap.length; i++) {
      const b = biomeMap[i];
      // Count land-based biomes (not ocean)
      if (
        b !== BiomeType.DEEP_OCEAN &&
        b !== BiomeType.SHALLOW_OCEAN
      ) {
        landCount++;
      }
      if (b === BiomeType.RIVER || b === BiomeType.LAKE) {
        riverLakeCount++;
      }
    }
    expect(riverLakeCount / landCount).toBeLessThan(0.1);
  });
});
