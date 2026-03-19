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
import { registerEntity, unregisterEntity, disengage, getCombatState } from "./combat.js";
import { connectionManager } from "../ws/connections.js";
import { packEntitySpawn, packEntityDespawn } from "./protocol.js";
import { NPC_TEMPLATES, rollStat, type NPCTemplate } from "./npc-templates.js";

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
const pendingTimers = new Set<ReturnType<typeof setTimeout>>();
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

  // Schedule respawn
  const timer = setTimeout(() => {
    pendingTimers.delete(timer);
    // Remove dead NPC tracking
    spawnedNPCs.delete(entityId);
    spawnPointNPCs.get(spawned.spawnPointId)?.delete(entityId);

    // Spawn replacement if point still exists
    const currentPoint = spawnPoints.get(spawned.spawnPointId);
    if (currentPoint) {
      const aliveCount = countAlive(spawned.spawnPointId);
      if (aliveCount < currentPoint.maxCount) {
        spawnNPCForPoint(currentPoint);
      }
    }
  }, point.frequency * 1000);
  pendingTimers.add(timer);
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

/** Tick wandering for all alive NPCs */
export function tickWandering(dt: number) {
  for (const [entityId, spawned] of spawnedNPCs) {
    if (!spawned.alive) continue;

    const entity = entityStore.get(entityId);
    if (!entity) continue;

    const template = NPC_TEMPLATES[spawned.templateId];
    if (!template?.wanders) continue;

    // Don't wander if in combat
    const combat = getCombatState(entityId);
    if (combat?.inCombat) continue;

    const point = spawnPoints.get(spawned.spawnPointId);
    if (!point) continue;

    // Random chance to start wandering each tick
    if (Math.random() > 0.02) continue; // ~2% per tick = wander every ~2.5s at 20Hz

    // Pick a random tile within spawn distance
    const angle = Math.random() * Math.PI * 2;
    const dist = Math.random() * point.distance;
    const targetX = Math.round(point.x + Math.cos(angle) * dist);
    const targetZ = Math.round(point.z + Math.sin(angle) * dist);

    // Move one tile toward target
    const dx = targetX - Math.round(entity.x);
    const dz = targetZ - Math.round(entity.z);
    if (dx === 0 && dz === 0) continue;

    if (Math.abs(dx) > Math.abs(dz)) {
      entityStore.updatePosition(entityId, entity.x + Math.sign(dx), entity.z);
    } else {
      entityStore.updatePosition(entityId, entity.x, entity.z + Math.sign(dz));
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
  const angle = Math.random() * Math.PI * 2;
  const dist = Math.random() * point.distance;
  const x = Math.round(point.x + Math.cos(angle) * dist);
  const z = Math.round(point.z + Math.sin(angle) * dist);

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
  for (const t of pendingTimers) clearTimeout(t);
  pendingTimers.clear();
  spawnedNPCs.clear();
  spawnPointNPCs.clear();
  spawnPoints.clear();
}
