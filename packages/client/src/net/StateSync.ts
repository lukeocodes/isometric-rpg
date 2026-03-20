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

export class StateSync {
  private entityManager: EntityManager;
  private localEntityId: string | null = null;
  private numericIdMap = new Map<number, string>(); // hash → entityId

  private onDamage: DamageCallback | null = null;
  private onDeath: DeathCallback | null = null;
  private onCombatState: CombatStateCallback | null = null;
  private onEnemyNearby: EnemyNearbyCallback | null = null;
  private onZoneMusicTag: ZoneMusicTagCallback | null = null;
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
      case Opcode.SPAWN_POINT:
        this.spawnPoints.push({
          id: data.id, x: data.x, z: data.z,
          distance: data.distance, npcIds: data.npcIds,
          maxCount: data.maxCount, frequency: data.frequency,
        });
        break;
      case Opcode.SYSTEM_MESSAGE:
        console.log("[System]", data.message);
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
