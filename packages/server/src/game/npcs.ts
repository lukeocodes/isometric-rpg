/**
 * NPC initialization — reads spawn points from the Tiled map.
 * All NPC management is handled by spawn-points.ts.
 */

import { addSpawnPoint, cleanup as cleanupSpawnPoints, handleNPCDeath as spHandleDeath, getSpawnPointTemplate, isSpawnedNPC, tickWandering, tickRespawns, getAllSpawnPoints, type SpawnPoint } from "./spawn-points.js";
import type { NPCTemplate } from "./npc-templates.js";
import { getZoneSpawnPoints } from "../world/tiled-map.js";
import { getAllZones } from "./zone-registry.js";

export function spawnInitialNpcs() {
  // Spawn NPCs from each registered zone's Tiled spawn-point objects. Uses
  // the zone's own numericId so spawn points live in the right zone. Heaven
  // has no spawn objects, so this is effectively a no-op until zones with
  // NPCs are authored.
  let totalPoints = 0;
  for (const zone of getAllZones()) {
    const zoneSpawns = getZoneSpawnPoints(zone.id);
    for (let i = 0; i < zoneSpawns.length; i++) {
      const sp = zoneSpawns[i];
      addSpawnPoint({
        id: `sp-${zone.id}-${sp.name || `spawn-${i}`}`,
        x: sp.tileX,
        z: sp.tileZ,
        mapId: zone.numericId,
        npcIds: sp.npcIds,
        distance: sp.distance,
        maxCount: sp.maxCount,
        frequency: sp.frequency,
      });
      totalPoints++;
    }
  }

  console.log(`[NPCs] Spawn points initialized: ${getAllSpawnPoints().length} points across ${getAllZones().length} zones`);
}

export function handleNpcDeath(entityId: string) {
  spHandleDeath(entityId);
}

export function getNpcTemplate(entityId: string): NPCTemplate | undefined {
  return getSpawnPointTemplate(entityId);
}

export function getNpcIds(): string[] {
  return []; // No longer tracked globally
}

export { isSpawnedNPC, tickWandering, tickRespawns };

export function cleanup() {
  cleanupSpawnPoints();
}
