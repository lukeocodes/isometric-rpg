/**
 * Spawn Point System
 *
 * Invisible map items that spawn NPCs in an area.
 * Each spawn point has:
 *   - position (x, z)
 *   - npcIds: which NPC templates can spawn here
 *   - distance: radius NPCs can spawn/wander within
 *   - maxCount: max alive NPCs from this spawn
 *   - frequency: seconds between respawns after death
 */

import { entityStore, type ServerEntity } from "./entities.js";
import { registerEntity, unregisterEntity, disengage, engageTarget, getCombatState } from "./combat.js";
import { connectionManager } from "../ws/connections.js";
import { packEntitySpawn, packEntityDespawn } from "./protocol.js";
import { NPC_TEMPLATES, rollStat, type NPCTemplate } from "./npc-templates.js";
import { isWalkable } from "../world/terrain.js";

export interface SpawnPoint {
  id: string;
  x: number;
  z: number;
  mapId: number;
  npcIds: string[];       // template IDs that can spawn here
  distance: number;       // spawn/wander radius
  maxCount: number;       // max alive NPCs from this point
  frequency: number;      // seconds between respawns
}

interface SpawnedNPC {
  entityId: string;
  spawnPointId: string;
  templateId: string;
  alive: boolean;
  deathTime: number;      // timestamp of death (0 if alive)
}

const spawnPoints = new Map<string, SpawnPoint>();
const spawnedNPCs = new Map<string, SpawnedNPC>(); // entityId -> SpawnedNPC
const spawnPointNPCs = new Map<string, Set<string>>(); // spawnPointId -> Set<entityId>

// Respawn queue replaces individual setTimeout calls — checked once per game tick
interface RespawnEntry { entityId: string; spawnPointId: string; respawnAt: number }
const respawnQueue: RespawnEntry[] = [];

let nextEntityId = 0;

// --- Public API ---

export function addSpawnPoint(point: SpawnPoint) {
  spawnPoints.set(point.id, point);
  spawnPointNPCs.set(point.id, new Set());

  // Initial spawn
  for (let i = 0; i < point.maxCount; i++) {
    spawnNPCForPoint(point);
  }
}

export function removeSpawnPoint(id: string) {
  const npcs = spawnPointNPCs.get(id);
  if (npcs) {
    for (const entityId of npcs) {
      despawnNPC(entityId);
    }
  }
  spawnPointNPCs.delete(id);
  spawnPoints.delete(id);
}

export function handleNPCDeath(entityId: string) {
  const spawned = spawnedNPCs.get(entityId);
  if (!spawned) return;

  spawned.alive = false;
  spawned.deathTime = Date.now();

  // Clean up entity
  disengage(entityId);
  unregisterEntity(entityId);
  entityStore.remove(entityId);

  const point = spawnPoints.get(spawned.spawnPointId);
  if (!point) return;

  // Queue respawn — processed by tickRespawns() in game loop
  respawnQueue.push({
    entityId,
    spawnPointId: spawned.spawnPointId,
    respawnAt: Date.now() + point.frequency * 1000,
  });
}

export function getSpawnPointTemplate(entityId: string): NPCTemplate | undefined {
  const spawned = spawnedNPCs.get(entityId);
  if (!spawned) return undefined;
  return NPC_TEMPLATES[spawned.templateId];
}

export function getAllSpawnPoints(): SpawnPoint[] {
  return Array.from(spawnPoints.values());
}

export function isSpawnedNPC(entityId: string): boolean {
  return spawnedNPCs.has(entityId);
}

/** Process respawn queue — call once per game tick */
export function tickRespawns(): void {
  const now = Date.now();
  let i = 0;
  while (i < respawnQueue.length) {
    const entry = respawnQueue[i];
    if (now < entry.respawnAt) { i++; continue; }

    // Remove from queue (swap-and-pop)
    const last = respawnQueue.length - 1;
    if (i < last) respawnQueue[i] = respawnQueue[last];
    respawnQueue.length = last;

    // Clean up dead NPC tracking
    spawnedNPCs.delete(entry.entityId);
    spawnPointNPCs.get(entry.spawnPointId)?.delete(entry.entityId);

    // Spawn replacement
    const point = spawnPoints.get(entry.spawnPointId);
    if (point) {
      const aliveCount = countAlive(entry.spawnPointId);
      if (aliveCount < point.maxCount) {
        spawnNPCForPoint(point);
      }
    }
  }
}

const AGGRO_RADIUS = 8;
let tickCounter = 0;

/** Tick wandering + aggro for all alive NPCs */
export function tickWandering(dt: number) {
  tickCounter++;
  for (const [entityId, spawned] of spawnedNPCs) {
    if (!spawned.alive) continue;

    const entity = entityStore.get(entityId);
    if (!entity) continue;

    const template = NPC_TEMPLATES[spawned.templateId];
    if (!template) continue;

    const combat = getCombatState(entityId);

    // Aggro: aggressive NPCs target nearby players (stagger by entity hash to spread load)
    const aggroThisTick = template.aggressive && !combat?.autoAttacking &&
      ((entity.x * 7 + entity.z * 13 + tickCounter) % 10 === 0);
    if (aggroThisTick) {
      for (const other of entityStore.iterNearbyEntities(entity.x, entity.z, AGGRO_RADIUS)) {
        if (other.entityType !== "player") continue;
        if (other.mapId !== entity.mapId) continue;
        const d = Math.max(Math.abs(entity.x - other.x), Math.abs(entity.z - other.z));
        if (d <= AGGRO_RADIUS) {
          // Engage the player
          engageTarget(entityId, other.entityId);
          break;
        }
      }
    }

    if (!template.wanders) continue;

    // Don't wander if in combat
    if (combat?.inCombat) continue;

    const point = spawnPoints.get(spawned.spawnPointId);
    if (!point) continue;

    // Per-NPC wander chance from template, jittered ±25% for variety
    const baseChance = template.wanderChance ?? 0.02;
    const wanderChance = baseChance * (0.75 + Math.random() * 0.5);
    if (Math.random() > wanderChance) continue;

    // Pick a random tile within spawn distance
    const angle = Math.random() * Math.PI * 2;
    const dist = Math.random() * point.distance;
    const targetX = Math.round(point.x + Math.cos(angle) * dist);
    const targetZ = Math.round(point.z + Math.sin(angle) * dist);

    // Phase 2: Check walkability of target wander destination
    if (!isWalkable(targetX, targetZ)) continue;

    // Move up to wanderSteps tiles toward target, jittered ±1
    const baseSteps = template.wanderSteps ?? 1;
    const maxSteps = Math.max(1, baseSteps + Math.floor(Math.random() * 3) - 1);
    for (let step = 0; step < maxSteps; step++) {
      const dx = targetX - Math.round(entity.x);
      const dz = targetZ - Math.round(entity.z);
      if (dx === 0 && dz === 0) break;

      if (Math.abs(dx) > Math.abs(dz)) {
        const nextX = entity.x + Math.sign(dx);
        const nextZ = entity.z;
        if (isWalkable(Math.round(nextX), Math.round(nextZ))) {
          entityStore.updatePosition(entityId, nextX, nextZ);
        } else break;
      } else {
        const nextX = entity.x;
        const nextZ = entity.z + Math.sign(dz);
        if (isWalkable(Math.round(nextX), Math.round(nextZ))) {
          entityStore.updatePosition(entityId, nextX, nextZ);
        } else break;
      }
    }
  }
}

// --- Internal ---

function spawnNPCForPoint(point: SpawnPoint) {
  if (point.npcIds.length === 0) return;

  // Pick random template from allowed list
  const templateId = point.npcIds[Math.floor(Math.random() * point.npcIds.length)];
  const template = NPC_TEMPLATES[templateId];
  if (!template) {
    console.error(`[SpawnPoint] Unknown NPC template: ${templateId}`);
    return;
  }

  // Roll stats from ranges
  const hp = rollStat(template.hp);
  const weaponDamage = rollStat(template.weaponDamage);
  const attackSpeed = rollStat(template.attackSpeed) + Math.random(); // add fractional variation

  // Random position within spawn distance
  let spawnAngle = Math.random() * Math.PI * 2;
  let spawnDist = Math.random() * point.distance;
  let x = Math.round(point.x + Math.cos(spawnAngle) * spawnDist);
  let z = Math.round(point.z + Math.sin(spawnAngle) * spawnDist);

  // Phase 2: Don't spawn on blocked tiles, retry with new position
  if (!isWalkable(x, z)) {
    let attempts = 0;
    while (!isWalkable(x, z) && attempts < 5) {
      spawnAngle = Math.random() * Math.PI * 2;
      spawnDist = Math.random() * point.distance;
      x = Math.round(point.x + Math.cos(spawnAngle) * spawnDist);
      z = Math.round(point.z + Math.sin(spawnAngle) * spawnDist);
      attempts++;
    }
    if (!isWalkable(x, z)) return; // Give up, don't spawn on blocked tile
  }

  const entityId = `npc-${point.id}-${nextEntityId++}`;

  const entity: ServerEntity = {
    entityId,
    characterId: "",
    accountId: "",
    name: template.name,
    entityType: "npc",
    x, y: 0, z,
    rotation: 0,
    mapId: point.mapId,
    lastUpdate: Date.now(),
  };

  entityStore.add(entity);
  registerEntity(entityId, template.weaponType, weaponDamage, attackSpeed, hp, hp);

  // Track
  const spawned: SpawnedNPC = {
    entityId,
    spawnPointId: point.id,
    templateId,
    alive: true,
    deathTime: 0,
  };
  spawnedNPCs.set(entityId, spawned);
  spawnPointNPCs.get(point.id)?.add(entityId);

  // Broadcast to connected players
  connectionManager.broadcastReliable(
    packEntitySpawn(entityId, template.name, x, 0, z, "npc", hp, hp,
      template.bodyColor, template.skinColor, template.weaponType)
  );

  console.log(`[SpawnPoint] ${template.name} (${entityId}) spawned at (${x},${z}) from ${point.id} — HP:${hp} DMG:${weaponDamage}`);
}

function despawnNPC(entityId: string) {
  disengage(entityId);
  unregisterEntity(entityId);
  entityStore.remove(entityId);
  connectionManager.broadcastReliable(packEntityDespawn(entityId));
  spawnedNPCs.delete(entityId);
}

function countAlive(spawnPointId: string): number {
  const npcs = spawnPointNPCs.get(spawnPointId);
  if (!npcs) return 0;
  let count = 0;
  for (const entityId of npcs) {
    const spawned = spawnedNPCs.get(entityId);
    if (spawned?.alive) count++;
  }
  return count;
}

export function cleanup() {
  respawnQueue.length = 0;
  spawnedNPCs.clear();
  spawnPointNPCs.clear();
  spawnPoints.clear();
}
