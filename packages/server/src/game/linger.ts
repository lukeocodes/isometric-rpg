/**
 * Lingering system — when a player disconnects outside a safe zone,
 * their character stays on the map for LINGER_DURATION and can still
 * be attacked. After the timer expires, the character is removed.
 */

import { entityStore } from "./entities.js";
import { unregisterEntity, disengage } from "./combat.js";
import { connectionManager } from "../ws/connections.js";
import { packEntityDespawn } from "./protocol.js";

const LINGER_DURATION = 2 * 60 * 1000; // 2 minutes

interface LingeringCharacter {
  entityId: string;
  characterId: string;
  disconnectTime: number;
  timer: ReturnType<typeof setTimeout>;
}

const lingering = new Map<string, LingeringCharacter>(); // entityId -> LingeringCharacter

export function startLingering(entityId: string, characterId: string) {
  // If already lingering (reconnect then disconnect again), reset timer
  const existing = lingering.get(entityId);
  if (existing) {
    clearTimeout(existing.timer);
    lingering.delete(entityId);
  }

  console.log(`[Linger] ${entityId} lingering for ${LINGER_DURATION / 1000}s`);

  const timer = setTimeout(() => {
    removeLingering(entityId);
  }, LINGER_DURATION);

  lingering.set(entityId, {
    entityId,
    characterId,
    disconnectTime: Date.now(),
    timer,
  });
}

export function cancelLingering(entityId: string): boolean {
  const entry = lingering.get(entityId);
  if (!entry) return false;

  clearTimeout(entry.timer);
  lingering.delete(entityId);
  console.log(`[Linger] ${entityId} reconnected, linger cancelled`);
  return true;
}

export function isLingering(entityId: string): boolean {
  return lingering.has(entityId);
}

function removeLingering(entityId: string) {
  const entry = lingering.get(entityId);
  if (!entry) return;

  console.log(`[Linger] ${entityId} linger expired, removing from world`);

  disengage(entityId);
  unregisterEntity(entityId);

  if (entityStore.get(entityId)) {
    connectionManager.broadcastReliable(packEntityDespawn(entityId));
    entityStore.remove(entityId);
  }

  lingering.delete(entityId);
}

export function cleanup() {
  for (const entry of lingering.values()) {
    clearTimeout(entry.timer);
  }
  lingering.clear();
}
