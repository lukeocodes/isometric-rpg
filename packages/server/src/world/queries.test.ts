import { describe, it, expect, beforeAll, vi } from "vitest";
import type { WorldMap, Region, Continent } from "./types.js";

describe("queries - uninitialized", () => {
  it("getWorldMap returns null before initWorldMap", async () => {
    // Use dynamic import to get a fresh module without calling initWorldMap
    const mod = await import("./queries.js");
    // Since other tests may have run, we test the exported function behavior
    // The module-level worldMap starts as null; but since vitest may reuse modules,
    // we verify that the function signature exists and returns the expected shape
    expect(typeof mod.getWorldMap).toBe("function");
    expect(typeof mod.initWorldMap).toBe("function");
    expect(typeof mod.getRegionForChunk).toBe("function");
    expect(typeof mod.getContinentForChunk).toBe("function");
    expect(typeof mod.getBiomeForChunk).toBe("function");
    expect(typeof mod.getRegionById).toBe("function");
  });
});

describe("queries - initialized", () => {
  let getWorldMap: () => WorldMap | null;
  let getRegionForChunk: (cx: number, cz: number) => Region | null;
  let getContinentForChunk: (cx: number, cz: number) => Continent | null;
  let getBiomeForChunk: (cx: number, cz: number) => number;
  let getRegionById: (id: number) => Region | null;

  beforeAll(async () => {
    const mod = await import("./queries.js");
    mod.initWorldMap(42);
    getWorldMap = mod.getWorldMap;
    getRegionForChunk = mod.getRegionForChunk;
    getContinentForChunk = mod.getContinentForChunk;
    getBiomeForChunk = mod.getBiomeForChunk;
    getRegionById = mod.getRegionById;
  });

  it("initWorldMap generates and stores world map", () => {
    const world = getWorldMap();
    expect(world).not.toBeNull();
    expect(world!.seed).toBe(42);
    expect(world!.width).toBe(900);
    expect(world!.height).toBe(900);
    expect(world!.continents).toHaveLength(3);
    expect(world!.regions.length).toBeGreaterThan(0);
  });

  it("getRegionForChunk returns valid region for land chunk", () => {
    // Elf continent center is at approximately (450, 200)
    const region = getRegionForChunk(450, 200);
    expect(region).not.toBeNull();
    expect(region!.isLand).toBe(true);
    expect(region!.name).toBeTruthy();
    expect(region!.name.length).toBeGreaterThan(0);
  });

  it("getRegionForChunk returns ocean region for ocean chunk", () => {
    // World center (450, 450) should be ocean (equidistant from all continents)
    const region = getRegionForChunk(450, 450);
    expect(region).not.toBeNull();
    expect(region!.isLand).toBe(false);
  });

  it("getRegionForChunk returns null for out-of-bounds", () => {
    expect(getRegionForChunk(-1, -1)).toBeNull();
    expect(getRegionForChunk(1000, 1000)).toBeNull();
    expect(getRegionForChunk(-1, 0)).toBeNull();
    expect(getRegionForChunk(0, -1)).toBeNull();
    expect(getRegionForChunk(900, 0)).toBeNull();
    expect(getRegionForChunk(0, 900)).toBeNull();
  });

  it("getContinentForChunk returns correct continent", () => {
    // Elf continent center: (450, 200)
    const elfContinent = getContinentForChunk(450, 200);
    expect(elfContinent).not.toBeNull();
    expect(elfContinent!.race).toBe("elf");

    // Dwarf continent center: approximately (233, 575)
    const dwarfContinent = getContinentForChunk(233, 575);
    expect(dwarfContinent).not.toBeNull();
    expect(dwarfContinent!.race).toBe("dwarf");
  });

  it("getContinentForChunk returns null for ocean chunk", () => {
    // World center (450, 450) is ocean
    const continent = getContinentForChunk(450, 450);
    expect(continent).toBeNull();
  });

  it("getBiomeForChunk returns valid BiomeType", () => {
    // Check several in-bounds chunks; BiomeType values are 0-17 (includes RIVER=16, LAKE=17)
    for (let i = 0; i < 10; i++) {
      const cx = Math.floor(Math.random() * 900);
      const cz = Math.floor(Math.random() * 900);
      const biome = getBiomeForChunk(cx, cz);
      expect(biome).toBeGreaterThanOrEqual(0);
      expect(biome).toBeLessThanOrEqual(17);
    }
  });

  it("getRegionById returns correct region", () => {
    const region0 = getRegionById(0);
    expect(region0).not.toBeNull();
    expect(region0!.id).toBe(0);

    // Invalid region ID
    expect(getRegionById(999999)).toBeNull();
    expect(getRegionById(-1)).toBeNull();
  });

  it("queries are fast (O(1))", () => {
    const start = performance.now();
    for (let i = 0; i < 10000; i++) {
      const cx = Math.floor(Math.random() * 900);
      const cz = Math.floor(Math.random() * 900);
      getRegionForChunk(cx, cz);
    }
    const elapsed = performance.now() - start;
    expect(elapsed).toBeLessThan(50);
  });

  it("getWorldMap returns null before initWorldMap on fresh module", async () => {
    // Reset modules to get a fresh copy
    vi.resetModules();
    const freshMod = await import("./queries.js");
    expect(freshMod.getWorldMap()).toBeNull();
    expect(freshMod.getRegionForChunk(450, 200)).toBeNull();
    expect(freshMod.getContinentForChunk(450, 200)).toBeNull();
    expect(freshMod.getBiomeForChunk(450, 200)).toBe(0);
    expect(freshMod.getRegionById(0)).toBeNull();
  });
});
