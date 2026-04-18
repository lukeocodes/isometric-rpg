/**
 * Zone registry — maps zone IDs to metadata.
 * Simplified to just one starter zone with a house.
 */

export interface ZoneDefinition {
  id: string;
  name: string;
  mapFile: string;
  levelRange: [number, number];
  musicTag: string;
  exits: Record<string, { targetZone: string; spawnX: number; spawnZ: number }>;
}

const zones = new Map<string, ZoneDefinition>();

export function registerZone(zone: ZoneDefinition): void {
  zones.set(zone.id, zone);
}

export function getZone(id: string): ZoneDefinition | undefined {
  return zones.get(id);
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

// Single starter zone with a house
registerZone({
  id: "human-meadows",
  name: "Starter Meadows",
  mapFile: "starter-area.json",
  levelRange: [1, 5],
  musicTag: "town",
  exits: {},
});