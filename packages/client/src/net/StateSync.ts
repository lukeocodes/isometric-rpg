import { EntityManager } from "../ecs/EntityManager";
import { createPosition } from "../ecs/components/Position";
import { createMovement } from "../ecs/components/Movement";
import { createRenderable } from "../ecs/components/Renderable";
import { createIdentity } from "../ecs/components/Identity";
import { createStats } from "../ecs/components/Stats";
import { createCombat } from "../ecs/components/Combat";
import type { PositionComponent } from "../ecs/components/Position";
import type { StatsComponent } from "../ecs/components/Stats";
import type { CombatComponent } from "../ecs/components/Combat";
import { Opcode, unpackReliable } from "./Protocol";

export type DamageCallback = (attackerId: string, targetId: string, damage: number, weaponType: string) => void;
export type DeathCallback = (entityId: string) => void;
export type CombatStateCallback = (entityId: string, inCombat: boolean, autoAttacking: boolean, targetId: string | null) => void;
export type EnemyNearbyCallback = (entityIds: string[], nearby: boolean) => void;
export type ZoneMusicTagCallback = (musicState: string) => void;
export type XpGainCallback = (xpGained: number, totalXp: number, xpToNext: number, level: number) => void;
export type LevelUpCallback = (newLevel: number, hpBonus: number, manaBonus: number, staminaBonus: number) => void;
export type RespawnCallback = (x: number, y: number, z: number, hp: number, maxHp: number) => void;
export type ChatCallback = (senderId: string, senderName: string, text: string) => void;
export type ZoneChangeCallback = (zoneId: string, zoneName: string, mapFile: string, spawnX: number, spawnZ: number, levelRange: [number, number], musicTag: string) => void;
export type AbilityCooldownCallback = (abilityId: string, remaining: number) => void;
export type ChunkDataCallback = (cx: number, cz: number, heights: Float32Array) => void;
export type LootDropCallback = (items: Array<{ itemId: string; name: string; icon: string; qty: number }>) => void;
export type InventorySyncCallback = (items: Array<{ id: string; itemId: string; name: string; icon: string; type: string; quantity: number; equipped: boolean; slot: string | null }>) => void;
export type DungeonMapCallback = (data: { instanceId: string; width: number; height: number; ground: number[]; collision: number[]; spawnX: number; spawnZ: number }) => void;
export type DungeonExitCallback = (exitX: number, exitZ: number, message: string) => void;

export class StateSync {
  private entityManager: EntityManager;
  private localEntityId: string | null = null;
  private numericIdMap = new Map<number, string>(); // hash → entityId

  private onDamage: DamageCallback | null = null;
  private onDeath: DeathCallback | null = null;
  private onCombatState: CombatStateCallback | null = null;
  private onEnemyNearby: EnemyNearbyCallback | null = null;
  private onZoneMusicTag: ZoneMusicTagCallback | null = null;
  private onXpGain: XpGainCallback | null = null;
  private onLevelUp: LevelUpCallback | null = null;
  private onRespawn: RespawnCallback | null = null;
  private onChat: ChatCallback | null = null;
  private onZoneChange: ZoneChangeCallback | null = null;
  private onAbilityCooldown: AbilityCooldownCallback | null = null;
  private onChunkDataCb: ChunkDataCallback | null = null;
  private onLootDrop: LootDropCallback | null = null;
  private onInventorySync: InventorySyncCallback | null = null;
  private onDungeonMap: DungeonMapCallback | null = null;
  private onDungeonExit: DungeonExitCallback | null = null;
  private terrainYResolver: ((x: number, z: number) => number) | null = null;

  // Spawn points (for dev mode rendering)
  public spawnPoints: Array<{ id: string; x: number; z: number; distance: number; npcIds: string[]; maxCount: number; frequency: number }> = [];

  constructor(entityManager: EntityManager) {
    this.entityManager = entityManager;
  }

  setTerrainYResolver(resolver: (x: number, z: number) => number) {
    this.terrainYResolver = resolver;
  }

  private hashCode(str: string): number {
    let hash = 0;
    for (let i = 0; i < str.length; i++) {
      hash = ((hash << 5) - hash + str.charCodeAt(i)) | 0;
    }
    return hash >>> 0;
  }

  setLocalEntityId(id: string) {
    this.localEntityId = id;
  }

  setOnDamage(handler: DamageCallback) { this.onDamage = handler; }
  setOnDeath(handler: DeathCallback) { this.onDeath = handler; }
  setOnCombatState(handler: CombatStateCallback) { this.onCombatState = handler; }
  setOnEnemyNearby(handler: EnemyNearbyCallback) { this.onEnemyNearby = handler; }
  setOnZoneMusicTag(handler: ZoneMusicTagCallback) { this.onZoneMusicTag = handler; }
  setOnXpGain(handler: XpGainCallback) { this.onXpGain = handler; }
  setOnLevelUp(handler: LevelUpCallback) { this.onLevelUp = handler; }
  setOnRespawn(handler: RespawnCallback) { this.onRespawn = handler; }
  setOnZoneChange(handler: ZoneChangeCallback) { this.onZoneChange = handler; }
  setOnAbilityCooldown(handler: AbilityCooldownCallback) { this.onAbilityCooldown = handler; }
  setOnChat(handler: ChatCallback) { this.onChat = handler; }
  setOnChunkData(handler: ChunkDataCallback) { this.onChunkDataCb = handler; }
  setOnLootDrop(handler: LootDropCallback) { this.onLootDrop = handler; }
  setOnInventorySync(handler: InventorySyncCallback) { this.onInventorySync = handler; }
  setOnDungeonMap(handler: DungeonMapCallback) { this.onDungeonMap = handler; }
  setOnDungeonExit(handler: DungeonExitCallback) { this.onDungeonExit = handler; }

  handleChunkData(data: ArrayBuffer): void {
    // Format: [opcode:u8] [cx:i16LE] [cz:i16LE] [heights:2048 bytes Float16]
    if (data.byteLength < 2053) return;
    const view = new DataView(data);
    const cx = view.getInt16(1, true);
    const cz = view.getInt16(3, true);

    // Decode Float16 heights to Float32 for client use
    const heights = new Float32Array(1024);
    for (let i = 0; i < 1024; i++) {
      const offset = 5 + i * 2;
      const h = view.getUint16(offset, true);
      // IEEE 754 half-precision decode
      const sign = (h >> 15) & 1;
      const exp = (h >> 10) & 0x1f;
      const frac = h & 0x3ff;
      let val: number;
      if (exp === 0) {
        val = (sign ? -1 : 1) * 2 ** -14 * (frac / 1024);
      } else if (exp === 0x1f) {
        val = frac === 0 ? (sign ? -Infinity : Infinity) : NaN;
      } else {
        val = (sign ? -1 : 1) * 2 ** (exp - 15) * (1 + frac / 1024);
      }
      heights[i] = val;
    }

    if (this.onChunkDataCb) {
      this.onChunkDataCb(cx, cz, heights);
    }
  }

  handlePositionMessage(data: ArrayBuffer) {
    // Batched format: [count:u16LE] then N * 20 bytes: [entityId:u32LE][x:f32LE][y:f32LE][z:f32LE][rotation:f32LE]
    const view = new DataView(data);
    if (data.byteLength < 2) return;

    const count = view.getUint16(0, true);
    const ENTRY_SIZE = 20;

    for (let i = 0; i < count; i++) {
      const offset = 2 + i * ENTRY_SIZE;
      if (offset + ENTRY_SIZE > data.byteLength) break;

      const numericId = view.getUint32(offset, true);
      const entityId = this.numericIdMap.get(numericId);
      if (!entityId || entityId === this.localEntityId) continue;

      const x = view.getFloat32(offset + 4, true);
      const y = view.getFloat32(offset + 8, true);
      const z = view.getFloat32(offset + 12, true);
      const rotation = view.getFloat32(offset + 16, true);

      const pos = this.entityManager.getComponent<PositionComponent>(entityId, "position");
      if (pos) {
        pos.remoteTargetX = x;
        pos.remoteTargetY = this.terrainYResolver ? this.terrainYResolver(x, z) : y;
        pos.remoteTargetZ = z;
        pos.remoteTargetRotation = rotation;
        pos.isRemote = true;
      }
    }
  }

  private static WEAPON_TYPES = ["melee", "ranged", "magic", "fire", "ice", "shock"];

  /** Handle binary combat messages (opcodes 50, 51, 52) */
  handleBinaryReliable(data: ArrayBuffer): void {
    const view = new DataView(data);
    const op = view.getUint8(0);

    if (op === Opcode.DAMAGE_EVENT && data.byteLength >= 12) {
      const attackerHash = view.getUint32(1, true);
      const targetHash = view.getUint32(5, true);
      const damage = view.getUint16(9, true);
      const weaponIdx = view.getUint8(11);
      const attackerId = this.numericIdMap.get(attackerHash) ?? "";
      const targetId = this.numericIdMap.get(targetHash) ?? "";
      const weaponType = StateSync.WEAPON_TYPES[weaponIdx] ?? "melee";
      if (this.onDamage && targetId) {
        this.onDamage(attackerId, targetId, damage, weaponType);
      }
    } else if (op === Opcode.ENTITY_DEATH && data.byteLength >= 5) {
      const entityHash = view.getUint32(1, true);
      const entityId = this.numericIdMap.get(entityHash) ?? "";
      if (this.onDeath && entityId) {
        this.onDeath(entityId);
      }
    } else if (op === Opcode.ENTITY_STATE && data.byteLength >= 9) {
      const entityHash = view.getUint32(1, true);
      const hp = view.getUint16(5, true);
      const maxHp = view.getUint16(7, true);
      const entityId = this.numericIdMap.get(entityHash) ?? "";
      if (entityId) {
        this.updateEntityState({ entityId, hp, maxHp });
      }
    }
  }

  handleReliableMessage(message: string) {
    const data = unpackReliable(message);

    switch (data.op) {
      case Opcode.ENTITY_SPAWN:
        this.spawnEntity(data);
        break;
      case Opcode.ENTITY_DESPAWN:
        this.despawnEntity(data.entityId);
        break;
      case Opcode.ENTITY_STATE:
        this.updateEntityState(data);
        break;
      case Opcode.DAMAGE_EVENT:
        if (this.onDamage) {
          this.onDamage(data.attackerId, data.targetId, data.damage, data.weaponType);
        }
        break;
      case Opcode.ENTITY_DEATH:
        if (this.onDeath) {
          this.onDeath(data.entityId);
        }
        break;
      case Opcode.COMBAT_STATE:
        this.updateCombatState(data);
        if (this.onCombatState) {
          this.onCombatState(data.entityId, data.inCombat, data.autoAttacking, data.targetId);
        }
        break;
      case Opcode.ENEMY_NEARBY:
        if (this.onEnemyNearby) {
          this.onEnemyNearby(data.entityIds || [], data.nearby);
        }
        break;
      case Opcode.ZONE_MUSIC_TAG:
        if (this.onZoneMusicTag) {
          this.onZoneMusicTag(data.musicState);
        }
        break;
      case Opcode.PLAYER_RESPAWN:
        if (this.onRespawn) {
          this.onRespawn(data.x, data.y, data.z, data.hp, data.maxHp);
        }
        break;
      case Opcode.XP_GAIN:
        if (this.onXpGain) {
          this.onXpGain(data.xpGained, data.totalXp, data.xpToNext, data.level);
        }
        break;
      case Opcode.LEVEL_UP:
        if (this.onLevelUp) {
          this.onLevelUp(data.newLevel, data.hpBonus, data.manaBonus, data.staminaBonus);
        }
        break;
      case Opcode.SPAWN_POINT:
        this.spawnPoints.push({
          id: data.id, x: data.x, z: data.z,
          distance: data.distance, npcIds: data.npcIds,
          maxCount: data.maxCount, frequency: data.frequency,
        });
        break;
      case Opcode.CHAT_MESSAGE:
        if (this.onChat && data.senderName && data.text) {
          this.onChat(data.senderId, data.senderName, data.text);
        }
        break;
      case Opcode.SYSTEM_MESSAGE:
        console.log("[System]", data.message);
        break;
      case Opcode.ABILITY_COOLDOWN:
        if (this.onAbilityCooldown) {
          this.onAbilityCooldown(data.abilityId, data.remaining);
        }
        break;
      case Opcode.ZONE_CHANGE:
        if (this.onZoneChange) {
          this.onZoneChange(data.zoneId, data.zoneName, data.mapFile, data.spawnX, data.spawnZ, data.levelRange, data.musicTag);
        }
        break;
      case Opcode.LOOT_DROP:
        if (this.onLootDrop && data.items) {
          this.onLootDrop(data.items);
        }
        break;
      case Opcode.INVENTORY_SYNC:
        if (this.onInventorySync && data.items) {
          this.onInventorySync(data.items);
        }
        break;
      case Opcode.DUNGEON_MAP:
        if (this.onDungeonMap) {
          this.onDungeonMap(data as any);
        }
        break;
      case Opcode.DUNGEON_EXIT:
        if (this.onDungeonExit) {
          this.onDungeonExit(data.exitX, data.exitZ, data.message);
        }
        break;
    }
  }

  private spawnEntity(data: any) {
    const id = data.entityId;
    if (id === this.localEntityId) return;
    if (this.entityManager.getEntity(id)) return;

    // Register numeric hash → string ID mapping for position updates
    this.numericIdMap.set(this.hashCode(id), id);

    this.entityManager.addEntity(id);
    this.entityManager.addComponent(id, createIdentity(id, data.name || "Unknown", data.entityType || "player"));
    const spawnX = data.x || 0;
    const spawnZ = data.z || 0;
    const spawnY = this.terrainYResolver ? this.terrainYResolver(spawnX, spawnZ) : (data.y || 0);
    const pos = createPosition(spawnX, spawnY, spawnZ);
    pos.isRemote = true;
    this.entityManager.addComponent(id, pos);
    this.entityManager.addComponent(id, createMovement(0, data.x || 0, data.z || 0));
    this.entityManager.addComponent(id, createRenderable(
      data.entityType || "player",
      data.bodyColor || "#aa4444",
      data.skinColor || "#e8c4a0",
      data.hairColor || "#2c1b0e",
    ));

    const stats = createStats(8, 8, 8);
    stats.hp = data.hp ?? 50;
    stats.maxHp = data.maxHp ?? 50;
    this.entityManager.addComponent(id, stats);

    this.entityManager.addComponent(id, createCombat(data.weaponType || "melee"));
  }

  private despawnEntity(entityId: string) {
    if (entityId === this.localEntityId) return;
    this.numericIdMap.delete(this.hashCode(entityId));
    this.entityManager.removeEntity(entityId);
  }

  private updateEntityState(data: any) {
    const id = data.entityId;
    const stats = this.entityManager.getComponent<StatsComponent>(id, "stats");
    if (stats) {
      stats.hp = data.hp;
      stats.maxHp = data.maxHp;
    }
  }

  private updateCombatState(data: any) {
    const id = data.entityId;
    const combat = this.entityManager.getComponent<CombatComponent>(id, "combat");
    if (combat) {
      combat.inCombat = data.inCombat;
      combat.autoAttacking = data.autoAttacking;
      combat.targetEntityId = data.targetId;
    }
  }
}
