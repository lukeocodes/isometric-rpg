/**
 * Zone registry — in-memory cache of zone metadata.
 *
 * There is currently only one zone: `heaven` (a user-authored map in the
 * `user_maps` table, HEAVEN_NUMERIC_ID = 500). Heaven is registered at boot by
 * `loadAllUserMaps()` which calls `registerZone()`. This file just holds the
 * type contract + the lookups + the `registerZone` helper.
 *
 * The old static-zones DB table + `loadStaticZones()` + `testSlots` +
 * `getTestZoneBySlot` were removed along with the 9 hand-crafted test zones
 * and `human-meadows`. If static shipped zones come back, re-add the table
 * and a loader. Until then, every zone is a user map.
 */

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export interface ZoneDefinition {
  id:         string;
  /** Stable numeric ID written to `entity.mapId` and DB `characters.map_id`. */
  numericId:  number;
  name:       string;
  mapFile:    string;
  levelRange: [number, number];
  musicTag:   string;
  exits:      Record<string, { targetZone: string; spawnX: number; spawnZ: number }>;
}

// ---------------------------------------------------------------------------
// In-memory cache
// ---------------------------------------------------------------------------

const zones            = new Map<string, ZoneDefinition>();
const zonesByNumericId = new Map<number, ZoneDefinition>();

export function registerZone(zone: ZoneDefinition): void {
  zones.set(zone.id, zone);
  zonesByNumericId.set(zone.numericId, zone);
}

export function getZone(id: string): ZoneDefinition | undefined {
  return zones.get(id);
}

export function getZoneByNumericId(numericId: number): ZoneDefinition | undefined {
  return zonesByNumericId.get(numericId);
}

export function getAllZones(): ZoneDefinition[] {
  return Array.from(zones.values());
}

export function getZoneByMapFile(mapFile: string): ZoneDefinition | undefined {
  for (const zone of zones.values()) {
    if (zone.mapFile === mapFile) return zone;
  }
  return undefined;
}

/** The client TMX path for a zone (co-located with its JSON). */
export function getClientMapFile(zone: ZoneDefinition): string {
  return zone.mapFile.replace(/\.json$/, ".tmx");
}

/** @internal Test-only helper — seeds the in-memory cache with fixtures
 *  and clears any previously-loaded zones. */
export function _setZonesForTest(fixtures: ZoneDefinition[]): void {
  zones.clear();
  zonesByNumericId.clear();
  for (const z of fixtures) registerZone(z);
}
