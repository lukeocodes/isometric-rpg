/**
 * Server-side Tiled map loader.
 * Reads the same Tiled JSON files as the client to provide authoritative
 * walkability, spawn points, and safe zones.
 */
import { readFileSync } from "fs";
import { resolve, dirname } from "path";

// Tiled JSON types (subset we need)
interface TiledMap {
  width: number;
  height: number;
  tilewidth: number;
  tileheight: number;
  layers: TiledLayer[];
  tilesets: TiledTilesetRef[];
}

type TiledLayer = TiledTileLayer | TiledObjectGroup;

interface TiledTileLayer {
  name: string;
  type: "tilelayer";
  width: number;
  height: number;
  data: number[];
}

interface TiledObjectGroup {
  name: string;
  type: "objectgroup";
  objects: TiledObject[];
}

interface TiledObject {
  name: string;
  type: string;
  x: number;
  y: number;
  width: number;
  height: number;
  properties?: TiledProperty[];
}

interface TiledProperty {
  name: string;
  type: string;
  value: string | number | boolean;
}

interface TiledTilesetRef {
  firstgid: number;
  source: string;
}

interface TiledTileset {
  tiles?: Array<{
    id: number;
    properties?: TiledProperty[];
  }>;
}

export interface TiledSpawnPoint {
  name: string;
  tileX: number;
  tileZ: number;
  npcIds: string[];
  maxCount: number;
  distance: number;
  frequency: number;
}

export interface TiledSafeZone {
  name: string;
  tileX: number;
  tileZ: number;
  tileWidth: number;
  tileHeight: number;
  zoneName: string;
  musicTag: string;
}

// Per-zone map data
interface ZoneMapData {
  width: number;
  height: number;
  groundData: number[];
  collisionData: number[];
  tileWalkable: Map<number, boolean>;
  spawnPoints: TiledSpawnPoint[];
  safeZones: TiledSafeZone[];
  playerSpawn: { x: number; z: number };
  mapItems: Array<{ tileX: number; tileZ: number; itemId: string; quantity: number }>;
  /** Tiles blocked by decoration obstacles (trees, rocks placed in object layer) */
  obstacleSet: Set<string>;
}

const zoneMaps = new Map<string, ZoneMapData>();
let defaultZoneId = "";

// Legacy module state — delegates to default zone
let mapWidth = 0;
let mapHeight = 0;
let groundData: number[] = [];
let collisionData: number[] = [];
let tileWalkable = new Map<number, boolean>();
let spawnPoints: TiledSpawnPoint[] = [];
let safeZones: TiledSafeZone[] = [];
let playerSpawn = { x: 64, z: 64 };
let obstacleSet = new Set<string>();
let loaded = false;

/**
 * Load a Tiled map for a specific zone.
 * Returns the parsed zone data. Also stores it in the zone registry.
 */
export function loadZoneMap(zoneId: string, mapPath: string): ZoneMapData {
  const data = parseTiledMap(mapPath);
  zoneMaps.set(zoneId, data);
  console.log(
    `[TiledMap] Zone "${zoneId}" loaded: ${data.width}x${data.height}, ` +
    `${data.spawnPoints.length} spawns, ${data.safeZones.length} safe zones`,
  );
  return data;
}

/** Get parsed data for a zone */
export function getZoneMapData(zoneId: string): ZoneMapData | undefined {
  return zoneMaps.get(zoneId);
}

/** Get spawn points for a specific zone */
export function getZoneSpawnPoints(zoneId: string): TiledSpawnPoint[] {
  return zoneMaps.get(zoneId)?.spawnPoints ?? [];
}

export function getZoneMapItems(zoneId: string): Array<{ tileX: number; tileZ: number; itemId: string; quantity: number }> {
  return zoneMaps.get(zoneId)?.mapItems ?? [];
}

/** Check walkability in a specific zone */
export function isZoneWalkable(zoneId: string, tileX: number, tileZ: number): boolean {
  const data = zoneMaps.get(zoneId);
  if (!data) return false;
  if (tileX < 0 || tileX >= data.width || tileZ < 0 || tileZ >= data.height) return false;
  const gid = data.groundData[tileZ * data.width + tileX];
  if (gid === 0) return false;
  const walkable = data.tileWalkable.get(gid);
  if (walkable === false) return false;
  if (data.collisionData.length > 0 && data.collisionData[tileZ * data.width + tileX] !== 0) return false;
  // Decoration obstacles block movement
  if (data.obstacleSet.has(`${tileX},${tileZ}`)) return false;
  return true;
}

/**
 * Load a Tiled map as the default (legacy API — backward compatible).
 */
export function loadTiledMap(mapPath: string): void {
  const data = parseTiledMap(mapPath);

  // Store as default zone
  defaultZoneId = "default";
  zoneMaps.set(defaultZoneId, data);

  // Populate legacy module state
  mapWidth = data.width;
  mapHeight = data.height;
  groundData = data.groundData;
  collisionData = data.collisionData;
  tileWalkable = data.tileWalkable;
  spawnPoints = data.spawnPoints;
  safeZones = data.safeZones;
  playerSpawn = data.playerSpawn;
  obstacleSet = data.obstacleSet;
  loaded = true;

  console.log(
    `[TiledMap] Loaded: ${mapWidth}x${mapHeight}, ` +
      `${spawnPoints.length} spawns, ${safeZones.length} safe zones, ` +
      `player spawn at (${playerSpawn.x}, ${playerSpawn.z})`,
  );
}

function parseTiledMap(mapPath: string): ZoneMapData {
  const mapJson: TiledMap = JSON.parse(readFileSync(mapPath, "utf-8"));
  const mapDir = dirname(mapPath);

  const data: ZoneMapData = {
    width: mapJson.width,
    height: mapJson.height,
    groundData: [],
    collisionData: [],
    tileWalkable: new Map(),
    spawnPoints: [],
    safeZones: [],
    playerSpawn: { x: 64, z: 64 },
    mapItems: [],
    obstacleSet: new Set(),
  };

  // Load tileset(s) for walkability properties
  for (const tsRef of mapJson.tilesets) {
    const tsjPath = resolve(mapDir, tsRef.source);
    const tileset: TiledTileset = JSON.parse(readFileSync(tsjPath, "utf-8"));

    if (tileset.tiles) {
      for (const tile of tileset.tiles) {
        const walkProp = tile.properties?.find((p) => p.name === "walkable");
        if (walkProp !== undefined) {
          data.tileWalkable.set(tsRef.firstgid + tile.id, walkProp.value as boolean);
        }
      }
    }
  }

  // Parse layers
  for (const layer of mapJson.layers) {
    if (layer.type === "tilelayer") {
      if (layer.name === "terrain" || layer.name === "ground") {
        data.groundData = layer.data;
      } else if (layer.name === "collision") {
        data.collisionData = layer.data;
      }
    } else if (layer.type === "objectgroup") {
      if (layer.name === "objects" || layer.name === "spawn_points" || layer.name === "zone_exits") {
        parseObjectsInto(data, layer.objects, mapJson.tilewidth, mapJson.tileheight);
      }
    }
  }

  return data;
}

function parseObjectsInto(data: ZoneMapData, objects: TiledObject[], tileW: number, tileH: number): void {
  for (const obj of objects) {
    const props: Record<string, string | number | boolean> = {};
    if (obj.properties) {
      for (const p of obj.properties) props[p.name] = p.value;
    }
    const tileX = Math.round(obj.x / tileW);
    const tileZ = Math.round(obj.y / tileH);

    if (obj.type === "spawn") {
      if (props.spawnType === "player") {
        data.playerSpawn = { x: tileX, z: tileZ };
      } else if (props.spawnType === "npc") {
        const npcIds = typeof props.npcIds === "string" ? props.npcIds.split(",") : [];
        data.spawnPoints.push({
          name: obj.name, tileX, tileZ, npcIds,
          maxCount: typeof props.maxCount === "number" ? props.maxCount : 3,
          distance: typeof props.distance === "number" ? props.distance : 8,
          frequency: typeof props.frequency === "number" ? props.frequency : 10,
        });
      }
    } else if (obj.type === "item") {
      const itemId = props.itemId as string;
      const quantity = typeof props.quantity === "number" ? props.quantity : 1;
      if (itemId) data.mapItems.push({ tileX, tileZ, itemId, quantity });
    } else if (obj.type === "safe_zone") {
      data.safeZones.push({
        name: obj.name, tileX, tileZ,
        tileWidth: Math.round(obj.width / tileW),
        tileHeight: Math.round(obj.height / tileH),
        zoneName: (props.zoneName as string) ?? obj.name,
        musicTag: (props.musicTag as string) ?? "town",
      });
    } else if (obj.type === "obstacle" || obj.type === "tree" || obj.type === "rock") {
      // Decoration obstacles — block walkability at their tile footprint
      const w = Math.max(1, Math.round((obj.width || tileW) / tileW));
      const h = Math.max(1, Math.round((obj.height || tileH) / tileH));
      for (let dz = 0; dz < h; dz++) {
        for (let dx = 0; dx < w; dx++) {
          data.obstacleSet.add(`${tileX + dx},${tileZ + dz}`);
        }
      }
    }
  }
}

// Keep the old parseObjects for backward compatibility (unused now but harmless)
function parseObjects(objects: TiledObject[], tileW: number, tileH: number): void {
  const tempData: ZoneMapData = {
    width: 0, height: 0, groundData: [], collisionData: [],
    tileWalkable: new Map(), spawnPoints, safeZones, playerSpawn,
  };
  parseObjectsInto(tempData, objects, tileW, tileH);
  // Results already written to module-level via shared references
  console.log(
    `[TiledMap] Legacy parse: ${spawnPoints.length} spawns`,
  );
}

// --- Query API ---

export function isTiledMapLoaded(): boolean {
  return loaded;
}

export function getTiledMapSize(): { width: number; height: number } {
  return { width: mapWidth, height: mapHeight };
}

/** Check if a tile is within the Tiled map bounds */
export function isInTiledMap(tileX: number, tileZ: number): boolean {
  return loaded && tileX >= 0 && tileX < mapWidth && tileZ >= 0 && tileZ < mapHeight;
}

/** Server-authoritative walkability check using Tiled map data */
export function isTiledWalkable(tileX: number, tileZ: number): boolean {
  if (!loaded) return false;
  if (tileX < 0 || tileX >= mapWidth || tileZ < 0 || tileZ >= mapHeight) return false;

  const gid = groundData[tileZ * mapWidth + tileX];
  if (gid === 0) return false; // Empty tile

  // Check tileset walkability property
  const walkable = tileWalkable.get(gid);
  if (walkable === false) return false;

  // Check collision layer
  if (collisionData.length > 0) {
    const colGid = collisionData[tileZ * mapWidth + tileX];
    if (colGid !== 0) return false;
  }

  // Decoration obstacles
  if (obstacleSet.has(`${tileX},${tileZ}`)) return false;

  return true;
}

export function getTiledSpawnPoints(): TiledSpawnPoint[] {
  return spawnPoints;
}

export function getTiledSafeZones(): TiledSafeZone[] {
  return safeZones;
}

export function getTiledPlayerSpawn(): { x: number; z: number } {
  return playerSpawn;
}
