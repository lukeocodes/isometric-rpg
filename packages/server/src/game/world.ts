import { tick as combatTick, getCombatState } from "./combat.js";
import { entityStore } from "./entities.js";
import { handleNpcDeath, tickWandering, tickRespawns, getNpcTemplate } from "./npcs.js";
import { connectionManager } from "../ws/connections.js";
import {
  packPosition, packDamageEvent, packEntityDeath,
  packEntityDespawn, packEntityState, packCombatState,
  packEnemyNearby, packXpGain, packLevelUp, packPlayerRespawn,
  packBinaryDamage, packBinaryDeath, packBinaryState,
} from "./protocol.js";
import { xpForKill, processXpGain, xpToNextLevel, totalXpForLevel } from "./experience.js";
import { rollAndGiveLoot } from "./inventory.js";
import { onDungeonNpcDeath } from "./dungeon.js";
import { config } from "../config.js";

/**
 * Handle a kill event — awards XP, broadcasts death, schedules respawn.
 * Called from both combatTick and ability handlers.
 */
export function handleKill(killerId: string, deadEntityId: string) {
  connectionManager.broadcastBinary(packBinaryDeath(deadEntityId));
  connectionManager.broadcastReliable(packEntityDespawn(deadEntityId));

  const killerEntity = entityStore.get(killerId);
  const deadEntity = entityStore.get(deadEntityId);

  // Award XP
  if (killerEntity?.entityType === "player" && deadEntity?.entityType === "npc") {
    const prog = playerProgress.get(killerId);
    if (prog) {
      const npcCombat = getCombatState(deadEntityId);
      const npcMaxHp = npcCombat?.maxHp ?? 10;
      const npcDmg = npcCombat?.weaponDamage ?? 2;
      const npcLevel = 1;
      const xpGained = xpForKill(npcMaxHp, npcDmg, npcLevel);
      const result = processXpGain(prog.xp, xpGained, prog.level);
      prog.xp = result.newXp;
      prog.level = result.newLevel;

      const xpNeeded = xpToNextLevel(prog.level);
      const xpIntoLevel = prog.xp - totalXpForLevel(prog.level);
      connectionManager.sendReliable(killerId, packXpGain(killerId, xpGained, xpIntoLevel, xpNeeded, prog.level));

      for (const lu of result.levelUps) {
        connectionManager.sendReliable(killerId, packLevelUp(killerId, lu.newLevel, lu.hpBonus, lu.manaBonus, lu.staminaBonus));
        const killerCombat = getCombatState(killerId);
        if (killerCombat) {
          killerCombat.maxHp += lu.hpBonus;
          killerCombat.hp = killerCombat.maxHp;
        }
      }
    }
  }

  // NPC death → loot drop + remove + schedule respawn
  if (deadEntity?.entityType === "npc") {
    if (killerEntity?.entityType === "player") {
      rollAndGiveLoot(killerId, deadEntityId);
    }
    // Check if this is a dungeon NPC (boss check)
    onDungeonNpcDeath(deadEntityId);
    handleNpcDeath(deadEntityId);
  }

  // Player death → respawn at town after 3s
  if (deadEntity?.entityType === "player") {
    const playerId = deadEntityId;
    setTimeout(() => {
      const entity = entityStore.get(playerId);
      const combat = getCombatState(playerId);
      if (!entity || !combat) return;
      entity.x = config.world.spawnX;
      entity.z = config.world.spawnZ;
      entity.y = 0;
      combat.hp = combat.maxHp;
      combat.inCombat = false;
      combat.autoAttacking = false;
      combat.targetId = null;
      combat.combatTimer = 0;
      connectionManager.sendReliable(playerId, packPlayerRespawn(playerId, entity.x, 0, entity.z, combat.hp, combat.maxHp));
      connectionManager.broadcastBinary(packBinaryState(playerId, combat.hp, combat.maxHp), playerId);
      console.log(`[Respawn] Player ${playerId} respawned at town`);
    }, 3000);
  }
}

const ENEMY_DETECTION_RADIUS = 16;
const ENEMY_CLEAR_RADIUS = 22; // Hysteresis: must be further away to clear enemy_nearby
const TICK_RATE = 20;
const TICK_INTERVAL = 1000 / TICK_RATE;
const STATE_BROADCAST_INTERVAL = 500;

let timer: ReturnType<typeof setInterval> | null = null;
let stateBroadcastAccum = 0;
let tickCounter = 0;

// Track per-player enemy-nearby state (playerId -> wasNearby)
const enemyNearbyState = new Map<string, boolean>();

// In-memory player XP/level state (synced to DB on disconnect)
interface PlayerProgress {
  xp: number;
  level: number;
  characterId: string;
}
const playerProgress = new Map<string, PlayerProgress>();

export function initPlayerProgress(entityId: string, characterId: string, xp: number, level: number) {
  playerProgress.set(entityId, { xp, level, characterId });
}

export function getPlayerProgress(entityId: string): PlayerProgress | undefined {
  return playerProgress.get(entityId);
}

export function removePlayerProgress(entityId: string): PlayerProgress | undefined {
  const prog = playerProgress.get(entityId);
  playerProgress.delete(entityId);
  return prog;
}

// Delta-only state broadcast: track last-sent hp/maxHp per entity per connection
// Key: "connectionEntityId:targetEntityId" → { hp, maxHp }
const lastBroadcastState = new Map<string, { hp: number; maxHp: number }>();

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

  // Clean up delta-state tracking for this entity (as target or connection)
  for (const key of lastBroadcastState.keys()) {
    if (key.startsWith(entityId + ":") || key.endsWith(":" + entityId)) {
      lastBroadcastState.delete(key);
    }
  }
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
  tickCounter++;

  // Pre-compute awake set once per tick (avoids O(N*cells) per NPC)
  entityStore.refreshAwakeSet(tickCounter);

  // NPC respawns + wandering
  tickRespawns();
  tickWandering(dt);

  // Combat
  const { damage, deaths } = combatTick(dt);

  for (const event of damage) {
    connectionManager.broadcastBinary(packBinaryDamage(event.attackerId, event.targetId, event.damage, event.weaponType));
  }

  for (const event of deaths) {
    handleKill(event.killerId, event.entityId);
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
    // Use hysteresis: detect at ENEMY_DETECTION_RADIUS, clear at ENEMY_CLEAR_RADIUS
    const wasNearby = enemyNearbyState.get(conn.entityId) ?? false;
    const checkRadius = wasNearby ? ENEMY_CLEAR_RADIUS : ENEMY_DETECTION_RADIUS;
    const nearbyNpcIds: string[] = [];

    for (const entity of entityStore.iterNearbyEntities(player.x, player.z, checkRadius)) {
      if (entity.entityType !== "npc") continue;
      const manhattan = Math.abs(entity.x - player.x) + Math.abs(entity.z - player.z);
      if (manhattan <= checkRadius) {
        nearbyNpcIds.push(entity.entityId);
      }
    }

    const isNearby = nearbyNpcIds.length > 0;

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

    // Write directly into pre-allocated buffer — iterator avoids array allocation
    let count = 0;

    for (const other of entityStore.iterNearbyEntities(self.x, self.z)) {
      if (other.entityId === conn.entityId) continue;
      if (other.mapId !== self.mapId) continue; // Only same-zone entities

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

    // Own combat state (always send — lightweight, important for UI)
    const ownCombat = getCombatState(conn.entityId);
    if (ownCombat) {
      connectionManager.sendReliable(conn.entityId,
        packCombatState(conn.entityId, ownCombat.inCombat, ownCombat.autoAttacking, ownCombat.targetId));

      // Delta check for own entity state
      const ownKey = conn.entityId + ":" + conn.entityId;
      const ownLast = lastBroadcastState.get(ownKey);
      if (!ownLast || ownLast.hp !== ownCombat.hp || ownLast.maxHp !== ownCombat.maxHp) {
        connectionManager.sendBinary(conn.entityId,
          packBinaryState(conn.entityId, ownCombat.hp, ownCombat.maxHp));
        lastBroadcastState.set(ownKey, { hp: ownCombat.hp, maxHp: ownCombat.maxHp });
      }
    }

    // Nearby entity states — only send if hp/maxHp changed
    for (const other of entityStore.iterNearbyEntities(self.x, self.z)) {
      if (other.entityId === conn.entityId) continue;

      const combat = getCombatState(other.entityId);
      if (combat) {
        const stateKey = conn.entityId + ":" + other.entityId;
        const last = lastBroadcastState.get(stateKey);
        if (!last || last.hp !== combat.hp || last.maxHp !== combat.maxHp) {
          connectionManager.sendBinary(conn.entityId,
            packBinaryState(other.entityId, combat.hp, combat.maxHp));
          lastBroadcastState.set(stateKey, { hp: combat.hp, maxHp: combat.maxHp });
        }
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
