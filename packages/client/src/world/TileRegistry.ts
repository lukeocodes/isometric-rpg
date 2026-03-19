import { Color3 } from "@babylonjs/core/Maths/math.color";

export interface TileType {
  id: number;        // Maps 1:1 to BiomeType enum value
  name: string;
  color: Color3;
  walkable: boolean;
}

// Tile types matching BiomeType enum (0-17)
// Colors chosen for visual distinctness at flat-color rendering
const TILE_TYPES: TileType[] = [
  { id: 0,  name: "deep_ocean",          color: new Color3(0.05, 0.10, 0.30), walkable: false },
  { id: 1,  name: "shallow_ocean",       color: new Color3(0.10, 0.20, 0.45), walkable: false },
  { id: 2,  name: "beach",               color: new Color3(0.76, 0.70, 0.50), walkable: true },
  { id: 3,  name: "temperate_grassland",  color: new Color3(0.30, 0.50, 0.20), walkable: true },
  { id: 4,  name: "temperate_forest",    color: new Color3(0.15, 0.40, 0.15), walkable: true },
  { id: 5,  name: "dense_forest",        color: new Color3(0.08, 0.28, 0.08), walkable: true },
  { id: 6,  name: "boreal_forest",       color: new Color3(0.12, 0.30, 0.18), walkable: true },
  { id: 7,  name: "mountain",            color: new Color3(0.45, 0.42, 0.40), walkable: true },
  { id: 8,  name: "snow_peak",           color: new Color3(0.90, 0.90, 0.92), walkable: false },
  { id: 9,  name: "tundra",              color: new Color3(0.55, 0.58, 0.50), walkable: true },
  { id: 10, name: "desert",              color: new Color3(0.78, 0.68, 0.40), walkable: true },
  { id: 11, name: "scrubland",           color: new Color3(0.55, 0.50, 0.30), walkable: true },
  { id: 12, name: "swamp",               color: new Color3(0.25, 0.30, 0.15), walkable: true },
  { id: 13, name: "highland",            color: new Color3(0.40, 0.45, 0.30), walkable: true },
  { id: 14, name: "meadow",              color: new Color3(0.40, 0.55, 0.25), walkable: true },
  { id: 15, name: "river_valley",        color: new Color3(0.30, 0.42, 0.20), walkable: true },
  { id: 16, name: "river",               color: new Color3(0.15, 0.25, 0.50), walkable: false },
  { id: 17, name: "lake",                color: new Color3(0.12, 0.22, 0.48), walkable: false },
];

const tileMap = new Map<number, TileType>();
for (const tile of TILE_TYPES) tileMap.set(tile.id, tile);

export function getTileType(id: number): TileType { return tileMap.get(id) || TILE_TYPES[0]; }
export function getAllTileTypes(): readonly TileType[] { return TILE_TYPES; }
