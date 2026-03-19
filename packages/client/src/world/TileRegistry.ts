import { Color3 } from "@babylonjs/core/Maths/math.color";

export interface TileType {
  id: number;
  name: string;
  color: Color3;
  walkable: boolean;
}

const TILE_TYPES: TileType[] = [
  { id: 0, name: "void", color: new Color3(0, 0, 0), walkable: false },
  { id: 1, name: "grass", color: new Color3(0.15, 0.35, 0.15), walkable: true },
  { id: 2, name: "dirt", color: new Color3(0.35, 0.25, 0.15), walkable: true },
  { id: 3, name: "stone", color: new Color3(0.4, 0.4, 0.42), walkable: true },
  { id: 4, name: "water", color: new Color3(0.1, 0.2, 0.5), walkable: false },
  { id: 5, name: "sand", color: new Color3(0.6, 0.55, 0.35), walkable: true },
  { id: 6, name: "wood", color: new Color3(0.4, 0.28, 0.15), walkable: true },
];

const tileMap = new Map<number, TileType>();
for (const tile of TILE_TYPES) tileMap.set(tile.id, tile);

export function getTileType(id: number): TileType { return tileMap.get(id) || TILE_TYPES[0]; }
export function getAllTileTypes(): readonly TileType[] { return TILE_TYPES; }
