/**
 * NPC initialization — sets up spawn points for the game world.
 * All NPC management is now handled by spawn-points.ts.
 */

import { addSpawnPoint, cleanup as cleanupSpawnPoints, handleNPCDeath as spHandleDeath, getSpawnPointTemplate, isSpawnedNPC, tickWandering, getAllSpawnPoints, type SpawnPoint } from "./spawn-points.js";
import type { NPCTemplate } from "./npc-templates.js";

export function spawnInitialNpcs() {
  // Skeleton spawn point near origin
  addSpawnPoint({
    id: "sp-skeletons-1",
    x: 0,
    z: 0,
    mapId: 1,
    npcIds: ["skeleton-warrior", "skeleton-archer", "skeleton-mage", "skeleton-lord"],
    distance: 8,
    maxCount: 4,
    frequency: 5,
  });

  console.log(`[NPCs] Spawn points initialized: ${getAllSpawnPoints().length} points`);
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

export { isSpawnedNPC, tickWandering };

export function cleanup() {
  cleanupSpawnPoints();
}
