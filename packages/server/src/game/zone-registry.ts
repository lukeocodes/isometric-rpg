/**
 * Zone registry — in-memory cache of zone metadata, populated at boot from:
 *   1. The `zones` DB table (static/shipped zones — human-meadows + test
 *      zones 1-9). See tools/seed-zones.ts for the one-time migration.
 *   2. The `user_maps` DB table via `loadAllUserMaps()` + `registerZone()`
 *      (user-authored builder maps).
 *
 * Static zone data lives in the DB (see AGENTS.md "Data in the Database");
 * this file only holds the type contract + cache + lookups + the
 * `registerZone` helper that user-maps uses at boot to add its rows to the
 * shared in-memory registry.
 */
import { db } from "../db/postgres.js";
import { zones as zonesTable } from "../db/schema.js";

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
/** Test-zone slot (1-9) → zone id. Populated by `loadStaticZones` from the
 *  `zones.test_slot` column; used by the keyboard shortcut in rtc.ts. */
const testSlots        = new Map<number, string>();

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

export function getTestZoneBySlot(slot: number): ZoneDefinition | undefined {
  const id = testSlots.get(slot);
  return id ? getZone(id) : undefined;
}

/** The client TMX path for a zone (co-located with its JSON). */
export function getClientMapFile(zone: ZoneDefinition): string {
  return zone.mapFile.replace(/\.json$/, ".tmx");
}

// ---------------------------------------------------------------------------
// Loader
// ---------------------------------------------------------------------------

/** Populate the in-memory cache from the `zones` DB table. Call once at
 *  server boot, before anything that needs zone metadata (map loading,
 *  NPC spawning, RTC signalling). User-authored maps are loaded separately
 *  by `loadAllUserMaps()` which calls `registerZone` for each row. */
export async function loadStaticZones(): Promise<void> {
  const rows = await db.select().from(zonesTable);
  testSlots.clear();
  for (const r of rows) {
    registerZone({
      id:         r.id,
      numericId:  r.numericId,
      name:       r.name,
      mapFile:    r.mapFile,
      levelRange: [r.levelMin, r.levelMax],
      musicTag:   r.musicTag,
      exits:      r.exits ?? {},
    });
    if (r.testSlot != null) testSlots.set(r.testSlot, r.id);
  }
  console.log(`[zones] Loaded ${rows.length} static zone(s) from DB`);
}

/** @internal Test-only helper — seeds the in-memory cache with fixtures
 *  and clears any previously-loaded zones. */
export function _setZonesForTest(fixtures: ZoneDefinition[]): void {
  zones.clear();
  zonesByNumericId.clear();
  testSlots.clear();
  for (const z of fixtures) registerZone(z);
}
