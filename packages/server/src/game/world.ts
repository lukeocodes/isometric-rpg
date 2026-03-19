import { tick as combatTick, getCombatState } from "./combat.js";
import { entityStore } from "./entities.js";
import { handleNpcDeath, tickWandering } from "./npcs.js";
import { connectionManager } from "../ws/connections.js";
import {
  packPosition, packDamageEvent, packEntityDeath,
  packEntityDespawn, packEntityState, packCombatState,
} from "./protocol.js";

const TICK_RATE = 20;
const TICK_INTERVAL = 1000 / TICK_RATE;
const STATE_BROADCAST_INTERVAL = 500;

let timer: ReturnType<typeof setInterval> | null = null;
let stateBroadcastAccum = 0;

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

  // Periodic state broadcast
  stateBroadcastAccum += TICK_INTERVAL;
  if (stateBroadcastAccum >= STATE_BROADCAST_INTERVAL) {
    stateBroadcastAccum = 0;
    broadcastState();
  }

  // Position broadcast
  broadcastPositions();
}

// Batched position format:
// [count:u16LE] then N * 20 bytes: [entityId:u32LE][x:f32LE][y:f32LE][z:f32LE][rotation:f32LE]
const ENTRY_SIZE = 20;

function broadcastPositions() {
  for (const conn of connectionManager.getAll()) {
    const self = entityStore.get(conn.entityId);
    if (!self) continue;

    // Collect nearby entities via spatial grid
    const nearbyEntities = entityStore.getNearbyEntities(self.x, self.z);
    const nearby: Array<{ id: number; x: number; y: number; z: number; r: number }> = [];
    for (const other of nearbyEntities) {
      if (other.entityId === conn.entityId) continue;
      nearby.push({
        id: hashCode(other.entityId) >>> 0,
        x: other.x, y: other.y, z: other.z, r: other.rotation,
      });
    }

    if (nearby.length === 0) continue;

    // Pack all positions into one buffer
    const buf = Buffer.alloc(2 + nearby.length * ENTRY_SIZE);
    buf.writeUInt16LE(nearby.length, 0);
    for (let i = 0; i < nearby.length; i++) {
      const offset = 2 + i * ENTRY_SIZE;
      buf.writeUInt32LE(nearby[i].id, offset);
      buf.writeFloatLE(nearby[i].x, offset + 4);
      buf.writeFloatLE(nearby[i].y, offset + 8);
      buf.writeFloatLE(nearby[i].z, offset + 12);
      buf.writeFloatLE(nearby[i].r, offset + 16);
    }

    connectionManager.sendPosition(conn.entityId, buf);
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

    // Nearby entity states via spatial grid
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
