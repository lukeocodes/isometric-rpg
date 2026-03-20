import { tick as combatTick, getCombatState } from "./combat.js";
import { entityStore } from "./entities.js";
import { handleNpcDeath, tickWandering } from "./npcs.js";
import { connectionManager } from "../ws/connections.js";
import {
  packPosition, packDamageEvent, packEntityDeath,
  packEntityDespawn, packEntityState, packCombatState,
  packEnemyNearby,
} from "./protocol.js";

const ENEMY_DETECTION_RADIUS = 16;
const TICK_RATE = 20;
const TICK_INTERVAL = 1000 / TICK_RATE;
const STATE_BROADCAST_INTERVAL = 500;

let timer: ReturnType<typeof setInterval> | null = null;
let stateBroadcastAccum = 0;

// Track per-player enemy-nearby state (playerId -> wasNearby)
const enemyNearbyState = new Map<string, boolean>();

// Pre-allocated position broadcast buffer (resized if needed)
const MAX_ENTITIES_PER_BATCH = 64;
const ENTRY_SIZE = 20;
let posBuf = Buffer.alloc(2 + MAX_ENTITIES_PER_BATCH * ENTRY_SIZE);

// Cache entity ID → u32 hash (immutable per entity lifetime)
const hashCache = new Map<string, number>();

function getHash(entityId: string): number {
  let h = hashCache.get(entityId);
  if (h === undefined) {
    h = hashCode(entityId) >>> 0;
    hashCache.set(entityId, h);
  }
  return h;
}

export function clearHashCache(entityId: string) {
  hashCache.delete(entityId);
  enemyNearbyState.delete(entityId);
}

export function startGameLoop() {
  timer = setInterval(() => gameTick(), TICK_INTERVAL);
  console.log("Game loop started (20Hz)");
}

export function stopGameLoop() {
  if (timer) { clearInterval(timer); timer = null; }
}

function gameTick() {
  const dt = TICK_INTERVAL / 1000;

  // NPC wandering
  tickWandering(dt);

  // Combat
  const { damage, deaths } = combatTick(dt);

  for (const event of damage) {
    const msg = packDamageEvent(event.attackerId, event.targetId, event.damage, event.weaponType);
    connectionManager.broadcastReliable(msg);
  }

  for (const event of deaths) {
    connectionManager.broadcastReliable(packEntityDeath(event.entityId));
    connectionManager.broadcastReliable(packEntityDespawn(event.entityId));
    handleNpcDeath(event.entityId);
  }

  // Enemy proximity detection (fires on state change only)
  checkEnemyProximity();

  // Periodic state broadcast
  stateBroadcastAccum += TICK_INTERVAL;
  if (stateBroadcastAccum >= STATE_BROADCAST_INTERVAL) {
    stateBroadcastAccum = 0;
    broadcastState();
  }

  // Position broadcast
  broadcastPositions();
}

function checkEnemyProximity() {
  for (const conn of connectionManager.getAll()) {
    const player = entityStore.get(conn.entityId);
    if (!player) continue;

    // Find NPC entities within detection radius (Manhattan distance)
    const nearbyEntities = entityStore.getNearbyEntities(player.x, player.z, ENEMY_DETECTION_RADIUS);
    const nearbyNpcIds: string[] = [];

    for (const entity of nearbyEntities) {
      if (entity.entityType !== "npc") continue;
      const manhattan = Math.abs(entity.x - player.x) + Math.abs(entity.z - player.z);
      if (manhattan <= ENEMY_DETECTION_RADIUS) {
        nearbyNpcIds.push(entity.entityId);
      }
    }

    const isNearby = nearbyNpcIds.length > 0;
    const wasNearby = enemyNearbyState.get(conn.entityId) ?? false;

    if (isNearby !== wasNearby) {
      enemyNearbyState.set(conn.entityId, isNearby);
      connectionManager.sendReliable(
        conn.entityId,
        packEnemyNearby(conn.entityId, isNearby ? nearbyNpcIds : [], isNearby),
      );
    }
  }
}

function broadcastPositions() {
  for (const conn of connectionManager.getAll()) {
    const self = entityStore.get(conn.entityId);
    if (!self) continue;

    // Write directly into pre-allocated buffer — no intermediate array
    const nearbyEntities = entityStore.getNearbyEntities(self.x, self.z);
    let count = 0;

    for (const other of nearbyEntities) {
      if (other.entityId === conn.entityId) continue;

      // Grow buffer if needed (rare — only if >64 entities nearby)
      if (count >= MAX_ENTITIES_PER_BATCH && 2 + (count + 1) * ENTRY_SIZE > posBuf.length) {
        posBuf = Buffer.alloc(2 + (count + 16) * ENTRY_SIZE);
      }

      const offset = 2 + count * ENTRY_SIZE;
      posBuf.writeUInt32LE(getHash(other.entityId), offset);
      posBuf.writeFloatLE(other.x, offset + 4);
      posBuf.writeFloatLE(other.y, offset + 8);
      posBuf.writeFloatLE(other.z, offset + 12);
      posBuf.writeFloatLE(other.rotation, offset + 16);
      count++;
    }

    if (count === 0) continue;

    posBuf.writeUInt16LE(count, 0);
    // Send only the used portion
    connectionManager.sendPosition(conn.entityId, posBuf.subarray(0, 2 + count * ENTRY_SIZE));
  }
}

function broadcastState() {
  for (const conn of connectionManager.getAll()) {
    const self = entityStore.get(conn.entityId);
    if (!self) continue;

    // Own combat state
    const ownCombat = getCombatState(conn.entityId);
    if (ownCombat) {
      connectionManager.sendReliable(conn.entityId,
        packCombatState(conn.entityId, ownCombat.inCombat, ownCombat.autoAttacking, ownCombat.targetId));
      connectionManager.sendReliable(conn.entityId,
        packEntityState(conn.entityId, ownCombat.hp, ownCombat.maxHp));
    }

    // Nearby entity states
    for (const other of entityStore.getNearbyEntities(self.x, self.z)) {
      if (other.entityId === conn.entityId) continue;

      const combat = getCombatState(other.entityId);
      if (combat) {
        connectionManager.sendReliable(conn.entityId,
          packEntityState(other.entityId, combat.hp, combat.maxHp));
      }
    }
  }
}

function hashCode(str: string): number {
  let hash = 0;
  for (let i = 0; i < str.length; i++) {
    hash = ((hash << 5) - hash + str.charCodeAt(i)) | 0;
  }
  return hash;
}
