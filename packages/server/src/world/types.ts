// LandType enum (stored in Uint8Array landmask)
export const enum LandType {
  DEEP_OCEAN = 0,
  SHALLOW_OCEAN = 1,
  LAND = 2,
  LAKE = 3,
}

// BiomeType enum (stored in Uint8Array biomeMap)
export const enum BiomeType {
  DEEP_OCEAN = 0,
  SHALLOW_OCEAN = 1,
  BEACH = 2,
  TEMPERATE_GRASSLAND = 3,
  TEMPERATE_FOREST = 4,
  DENSE_FOREST = 5,
  BOREAL_FOREST = 6,
  MOUNTAIN = 7,
  SNOW_PEAK = 8,
  TUNDRA = 9,
  DESERT = 10,
  SCRUBLAND = 11,
  SWAMP = 12,
  HIGHLAND = 13,
  MEADOW = 14,
  RIVER_VALLEY = 15,
}

// POI type taxonomy
export type POIType =
  | "ruin"
  | "cave"
  | "landmark"
  | "resource"
  | "settlement"
  | "strait";

export interface POI {
  type: POIType;
  x: number; // chunk coordinate
  z: number; // chunk coordinate
  subtype?: string;
  connects?: [number, number]; // for straits: [regionIdA, regionIdB]
}

export type RaceType = "human" | "elf" | "dwarf";

export interface ContinentDef {
  id: string;
  name: string;
  race: RaceType;
  centerX: number; // chunk coordinate (array-index space, 0-based)
  centerZ: number; // chunk coordinate (array-index space, 0-based)
  radius: number; // base radius in chunks
}

export interface Continent {
  id: string;
  name: string;
  race: RaceType;
  centerX: number;
  centerZ: number;
  radius: number;
  chunkCount: number; // total land chunks in this continent
}

export interface Region {
  id: number;
  name: string;
  continentId: string; // 'elf', 'dwarf', 'human', 'ocean'
  centerX: number; // chunk coordinate
  centerZ: number; // chunk coordinate
  biome: BiomeType;
  isLand: boolean;
  pois: POI[];
  chunkCount: number; // computed after region assignment
}

export interface WorldConfig {
  seed: number;
  width: number; // in chunks
  height: number; // in chunks
}

export interface WorldMap {
  seed: number;
  width: number;
  height: number;
  continents: Continent[];
  regions: Region[];
  landmask: Uint8Array; // indexed by [z * width + x], values are LandType
  elevation: Float32Array; // indexed by [z * width + x], range 0.0-1.0
  moisture: Float32Array; // indexed by [z * width + x], range 0.0-1.0
  temperature: Float32Array; // indexed by [z * width + x], range 0.0-1.0
  regionMap: Uint16Array; // indexed by [z * width + x], values are region IDs
  continentMap: Uint8Array; // indexed by [z * width + x], values: 0=ocean, 1-3=continent index
  biomeMap: Uint8Array; // indexed by [z * width + x], values are BiomeType
}
