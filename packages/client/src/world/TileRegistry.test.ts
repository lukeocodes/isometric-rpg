import { describe, it, expect } from "vitest";
import { getAllTileTypes, getTileType } from "./TileRegistry";

describe("TileRegistry", () => {
  it("has exactly 18 tile types", () => {
    expect(getAllTileTypes()).toHaveLength(18);
  });

  it("tile IDs are contiguous 0-17", () => {
    const tiles = getAllTileTypes();
    for (let i = 0; i < 18; i++) {
      expect(tiles[i].id).toBe(i);
    }
  });

  it("blocking biomes have walkable: false", () => {
    const blocking = [0, 1, 8, 16, 17]; // deep_ocean, shallow_ocean, snow_peak, river, lake
    for (const id of blocking) {
      expect(getTileType(id).walkable).toBe(false);
    }
  });

  it("walkable biomes have walkable: true", () => {
    const walkable = [2, 3, 4, 5, 6, 7, 9, 10, 11, 12, 13, 14, 15];
    for (const id of walkable) {
      expect(getTileType(id).walkable).toBe(true);
    }
  });

  it("all tile types have distinct non-empty names", () => {
    const names = getAllTileTypes().map(t => t.name);
    expect(new Set(names).size).toBe(18);
    for (const name of names) {
      expect(name.length).toBeGreaterThan(0);
    }
  });

  it("river tile is id 16", () => {
    expect(getTileType(16).name).toBe("river");
    expect(getTileType(16).walkable).toBe(false);
  });

  it("lake tile is id 17", () => {
    expect(getTileType(17).name).toBe("lake");
    expect(getTileType(17).walkable).toBe(false);
  });

  it("unknown tile ID falls back to deep_ocean (id 0)", () => {
    expect(getTileType(999).id).toBe(0);
    expect(getTileType(-1).id).toBe(0);
  });
});
