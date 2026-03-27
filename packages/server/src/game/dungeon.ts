/**
 * Dungeon Instance System
 *
 * Procedurally generated instanced zones. Each dungeon is a unique map
 * created for a player/party, with rooms, corridors, enemies, and a boss.
 *
 * Architecture:
 * - Player enters dungeon entrance (zone_exit with type "dungeon")
 * - Server generates a small map (64x64) with rooms + corridors
 * - Instance gets a unique mapId, spawn points registered, NPCs spawned
 * - Player is moved to the instance
 * - When player leaves or disconnects, instance is destroyed
 */

import { entityStore } from "./entities.js";
import { registerEntity, unregisterEntity } from "./combat.js";
import { connectionManager } from "../ws/connections.js";
import { packEntitySpawn, packEntityDespawn, packReliable, Opcode } from "./protocol.js";
import { NPC_TEMPLATES, rollStat } from "./npc-templates.js";

const DUNGEON_W = 64;
const DUNGEON_H = 64;
const ROOM_MIN = 5;
const ROOM_MAX = 9;
const NUM_ROOMS = 8;
const TILE_STONE = 3;
const TILE_PATH = 11;
const TILE_WATER = 5;

export interface DungeonInstance {
  instanceId: string;
  mapId: number;
  ownerId: string; // entity ID of the player who created it
  ground: number[];
  collision: number[];
  rooms: Array<{ x: number; z: number; w: number; h: number }>;
  spawnedNpcs: string[];
  bossId: string | null;
  bossDefeated: boolean;
  exitX: number;  // Exit portal location (boss room center)
  exitZ: number;
  createdAt: number;
}

const instances = new Map<string, DungeonInstance>();
const playerInstance = new Map<string, string>(); // entityId -> instanceId
let nextMapId = 1000; // Start dungeon map IDs high to avoid collision

let seed = Date.now();
function rand(): number {
  seed = (seed * 1103515245 + 12345) & 0x7fffffff;
  return seed / 0x7fffffff;
}

function randInt(min: number, max: number): number {
  return min + Math.floor(rand() * (max - min + 1));
}

/** Generate a procedural dungeon and return the instance */
export function createDungeonInstance(ownerId: string, difficulty: number = 1): DungeonInstance {
  const instanceId = `dungeon-${ownerId}-${Date.now()}`;
  const mapId = nextMapId++;

  const ground = new Array(DUNGEON_W * DUNGEON_H).fill(0); // 0 = void/wall
  const collision = new Array(DUNGEON_W * DUNGEON_H).fill(1); // All blocked by default

  // Generate rooms
  const rooms: DungeonInstance["rooms"] = [];
  for (let i = 0; i < NUM_ROOMS * 3 && rooms.length < NUM_ROOMS; i++) {
    const w = randInt(ROOM_MIN, ROOM_MAX);
    const h = randInt(ROOM_MIN, ROOM_MAX);
    const x = randInt(2, DUNGEON_W - w - 2);
    const z = randInt(2, DUNGEON_H - h - 2);

    // Check overlap
    const overlaps = rooms.some(r =>
      x < r.x + r.w + 2 && x + w + 2 > r.x &&
      z < r.z + r.h + 2 && z + h + 2 > r.z
    );
    if (overlaps) continue;

    rooms.push({ x, z, w, h });

    // Carve room
    for (let rx = x; rx < x + w; rx++) {
      for (let rz = z; rz < z + h; rz++) {
        ground[rz * DUNGEON_W + rx] = TILE_STONE;
        collision[rz * DUNGEON_W + rx] = 0;
      }
    }
  }

  // Connect rooms with corridors (connect each room to the next)
  for (let i = 0; i < rooms.length - 1; i++) {
    const a = rooms[i];
    const b = rooms[i + 1];
    const ax = Math.floor(a.x + a.w / 2);
    const az = Math.floor(a.z + a.h / 2);
    const bx = Math.floor(b.x + b.w / 2);
    const bz = Math.floor(b.z + b.h / 2);

    // L-shaped corridor
    let cx = ax;
    while (cx !== bx) {
      ground[az * DUNGEON_W + cx] = TILE_PATH;
      collision[az * DUNGEON_W + cx] = 0;
      // Widen corridor
      if (az > 0) { ground[(az - 1) * DUNGEON_W + cx] = TILE_PATH; collision[(az - 1) * DUNGEON_W + cx] = 0; }
      cx += cx < bx ? 1 : -1;
    }
    let cz = az;
    while (cz !== bz) {
      ground[cz * DUNGEON_W + bx] = TILE_PATH;
      collision[cz * DUNGEON_W + bx] = 0;
      if (bx > 0) { ground[cz * DUNGEON_W + (bx - 1)] = TILE_PATH; collision[cz * DUNGEON_W + (bx - 1)] = 0; }
      cz += cz < bz ? 1 : -1;
    }
  }

  // Add water pools in some rooms
  for (let i = 2; i < rooms.length - 1; i++) {
    if (rand() > 0.3) continue;
    const r = rooms[i];
    const px = r.x + Math.floor(r.w / 2);
    const pz = r.z + Math.floor(r.h / 2);
    ground[pz * DUNGEON_W + px] = TILE_WATER;
    collision[pz * DUNGEON_W + px] = 1; // Water is unwalkable
  }

  // Boss room center (for exit portal)
  const bossRoom = rooms.length >= 2 ? rooms[rooms.length - 1] : rooms[0];
  const exitX = bossRoom ? bossRoom.x + Math.floor(bossRoom.w / 2) : 32;
  const exitZ = bossRoom ? bossRoom.z + Math.floor(bossRoom.h / 2) : 32;

  const instance: DungeonInstance = {
    instanceId, mapId, ownerId,
    ground, collision, rooms,
    spawnedNpcs: [],
    bossId: null,
    bossDefeated: false,
    exitX, exitZ,
    createdAt: Date.now(),
  };

  instances.set(instanceId, instance);
  playerInstance.set(ownerId, instanceId);

  // Spawn enemies in rooms (skip first room = spawn, last room = boss)
  const npcTypes = difficulty >= 3
    ? ["skeleton-warrior", "skeleton-mage", "skeleton-lord"]
    : difficulty >= 2
      ? ["skeleton-warrior", "skeleton-archer", "goblin-grunt"]
      : ["goblin-grunt", "imp", "skeleton-warrior"];

  for (let i = 1; i < rooms.length - 1; i++) {
    const room = rooms[i];
    const count = randInt(2, 4);
    for (let j = 0; j < count; j++) {
      const templateId = npcTypes[randInt(0, npcTypes.length - 1)];
      const template = NPC_TEMPLATES[templateId];
      if (!template) continue;

      const npcId = `${instanceId}-npc-${i}-${j}`;
      const nx = room.x + randInt(1, room.w - 2);
      const nz = room.z + randInt(1, room.h - 2);

      entityStore.add({
        entityId: npcId,
        characterId: "",
        accountId: "",
        name: template.name,
        entityType: "npc",
        x: nx, y: 0, z: nz,
        rotation: 0,
        mapId,
        lastUpdate: Date.now(),
      });

      const hp = rollStat(template.hp);
      const dmg = rollStat(template.weaponDamage);
      const spd = rollStat(template.attackSpeed);
      registerEntity(npcId, template.weaponType, dmg, spd, hp, hp);
      instance.spawnedNpcs.push(npcId);

      // Broadcast spawn to the dungeon owner
      connectionManager.sendReliable(ownerId, packEntitySpawn(
        npcId, template.name, nx, 0, nz, "npc", hp, hp,
        template.bodyColor, template.skinColor, template.weaponType,
      ));
    }
  }

  // Spawn boss in last room
  if (rooms.length >= 2) {
    const bossRoom = rooms[rooms.length - 1];
    const bossTemplate = NPC_TEMPLATES["skeleton-lord"] ?? NPC_TEMPLATES["skeleton-warrior"];
    if (bossTemplate) {
      const bossId = `${instanceId}-boss`;
      const bx = bossRoom.x + Math.floor(bossRoom.w / 2);
      const bz = bossRoom.z + Math.floor(bossRoom.h / 2);

      entityStore.add({
        entityId: bossId,
        characterId: "",
        accountId: "",
        name: `${bossTemplate.name} (Boss)`,
        entityType: "npc",
        x: bx, y: 0, z: bz,
        rotation: 0,
        mapId,
        lastUpdate: Date.now(),
      });

      // Boss has 3x stats
      const hp = rollStat(bossTemplate.hp) * 3;
      const dmg = rollStat(bossTemplate.weaponDamage) * 2;
      const spd = rollStat(bossTemplate.attackSpeed) * 0.8;
      registerEntity(bossId, bossTemplate.weaponType, dmg, spd, hp, hp);
      instance.spawnedNpcs.push(bossId);
      instance.bossId = bossId;

      connectionManager.sendReliable(ownerId, packEntitySpawn(
        bossId, `${bossTemplate.name} (Boss)`, bx, 0, bz, "npc", hp, hp,
        bossTemplate.bodyColor, bossTemplate.skinColor, bossTemplate.weaponType,
      ));
    }
  }

  console.log(`[Dungeon] Created instance ${instanceId} (mapId=${mapId}) for ${ownerId}: ${rooms.length} rooms, ${instance.spawnedNpcs.length} NPCs`);
  return instance;
}

/** Get the Tiled-compatible map data for a dungeon instance */
export function getDungeonMapData(instanceId: string) {
  const inst = instances.get(instanceId);
  if (!inst) return null;

  return {
    width: DUNGEON_W,
    height: DUNGEON_H,
    tilewidth: 64,
    tileheight: 32,
    ground: inst.ground,
    collision: inst.collision,
    spawnX: inst.rooms[0] ? inst.rooms[0].x + Math.floor(inst.rooms[0].w / 2) : 32,
    spawnZ: inst.rooms[0] ? inst.rooms[0].z + Math.floor(inst.rooms[0].h / 2) : 32,
  };
}

/** Destroy a dungeon instance and clean up all entities */
export function destroyDungeonInstance(instanceId: string): void {
  const inst = instances.get(instanceId);
  if (!inst) return;

  // Remove all NPCs
  for (const npcId of inst.spawnedNpcs) {
    unregisterEntity(npcId);
    connectionManager.broadcastReliable(packEntityDespawn(npcId));
    entityStore.remove(npcId);
  }

  playerInstance.delete(inst.ownerId);
  instances.delete(instanceId);
  console.log(`[Dungeon] Destroyed instance ${instanceId}`);
}

/** Get instance for a player */
export function getPlayerDungeon(entityId: string): DungeonInstance | undefined {
  const instId = playerInstance.get(entityId);
  return instId ? instances.get(instId) : undefined;
}

/** Check if a position is walkable in a dungeon */
export function isDungeonWalkable(instanceId: string, x: number, z: number): boolean {
  const inst = instances.get(instanceId);
  if (!inst) return false;
  if (x < 0 || x >= DUNGEON_W || z < 0 || z >= DUNGEON_H) return false;
  return inst.collision[z * DUNGEON_W + x] === 0;
}

/** Called when an NPC dies in a dungeon — checks if it's the boss */
export function onDungeonNpcDeath(npcId: string): void {
  // Find which instance this NPC belongs to
  for (const inst of instances.values()) {
    if (inst.bossId === npcId) {
      inst.bossDefeated = true;
      console.log(`[Dungeon] Boss defeated in ${inst.instanceId}!`);

      // Notify player: exit portal opened
      connectionManager.sendReliable(inst.ownerId,
        packReliable(Opcode.DUNGEON_EXIT, {
          exitX: inst.exitX,
          exitZ: inst.exitZ,
          message: "The boss has been defeated! An exit portal has appeared.",
        }));
      return;
    }
    // Remove dead NPC from tracking
    const idx = inst.spawnedNpcs.indexOf(npcId);
    if (idx !== -1) {
      inst.spawnedNpcs.splice(idx, 1);
      return;
    }
  }
}

/** Check if a player is at the dungeon exit portal */
export function isAtDungeonExit(entityId: string, x: number, z: number): boolean {
  const inst = getPlayerDungeon(entityId);
  if (!inst || !inst.bossDefeated) return false;
  return Math.abs(x - inst.exitX) <= 1 && Math.abs(z - inst.exitZ) <= 1;
}

/** Clean up dungeons for disconnected players */
export function cleanupPlayerDungeon(entityId: string): void {
  const instId = playerInstance.get(entityId);
  if (instId) destroyDungeonInstance(instId);
}
