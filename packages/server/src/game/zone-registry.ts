/**
 * Zone registry — maps zone IDs to metadata.
 * Each zone is a separate Tiled map with its own spawn points, level range, and music.
 */

export interface ZoneDefinition {
  id: string;
  name: string;
  mapFile: string; // Tiled JSON filename (relative to maps/)
  levelRange: [number, number];
  musicTag: string;
  /** Connections to other zones: exitId → { targetZone, spawnX, spawnZ } */
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

// --- Zone definitions ---
// 3 starter race lines (human, elf, orc) each with their own 1-5 zone.
// Zones converge at level 5-10 crossroads.

// Human starter
registerZone({
  id: "human-meadows",
  name: "Starter Meadows",
  mapFile: "starter.json", // Current map
  levelRange: [1, 5],
  musicTag: "town",
  exits: {
    "exit-to-crossroads": {
      targetZone: "crossroads",
      spawnX: 20,
      spawnZ: 128,
    },
  },
});

// Skeleton Wastes — level 5-10 zone
registerZone({
  id: "skeleton-wastes",
  name: "Skeleton Wastes",
  mapFile: "skeleton-wastes.json",
  levelRange: [5, 10],
  musicTag: "dungeon",
  exits: {
    "exit-to-starter": {
      targetZone: "human-meadows",
      spawnX: 240,
      spawnZ: 128,
    },
  },
});

// Elf starter
registerZone({
  id: "elf-grove",
  name: "Eldergrove",
  mapFile: "elf-grove.json",
  levelRange: [1, 5],
  musicTag: "forest",
  exits: {
    "exit-to-crossroads": { targetZone: "crossroads", spawnX: 128, spawnZ: 20 },
  },
});

// Orc starter (placeholder)
// registerZone({
//   id: "orc-wastes",
//   name: "Bloodstone Wastes",
//   mapFile: "orc-wastes.json",
//   levelRange: [1, 5],
//   musicTag: "desert",
//   exits: { "exit-to-crossroads": { targetZone: "crossroads", spawnX: 236, spawnZ: 128 } },
// });

// Crossroads — all races converge here at level 5
// registerZone({
//   id: "crossroads",
//   name: "The Crossroads",
//   mapFile: "crossroads.json",
//   levelRange: [5, 10],
//   musicTag: "exploring",
//   exits: {
//     "exit-to-human": { targetZone: "human-meadows", spawnX: 236, spawnZ: 128 },
//     "exit-to-elf": { targetZone: "elf-grove", spawnX: 128, spawnZ: 236 },
//     "exit-to-orc": { targetZone: "orc-wastes", spawnX: 20, spawnZ: 128 },
//     "exit-to-depths": { targetZone: "shadow-depths", spawnX: 128, spawnZ: 20 },
//   },
// });
