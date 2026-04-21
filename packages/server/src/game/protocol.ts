export const Opcode = {
  POSITION_UPDATE: 1,
  ENTITY_SPAWN: 2,
  ENTITY_DESPAWN: 3,
  ENTITY_MOVE: 4,
  TARGET_SELECT: 40,
  AUTO_ATTACK_TOGGLE: 41,
  AUTO_ATTACK_CANCEL: 42,
  CHAT_MESSAGE: 20,
  SYSTEM_MESSAGE: 21,
  DAMAGE_EVENT: 50,
  ENTITY_DEATH: 51,
  ENTITY_STATE: 52,
  COMBAT_STATE: 53,
  SPAWN_POINT: 60,
  ENEMY_NEARBY: 70,
  ZONE_MUSIC_TAG: 71,
  XP_GAIN: 80,
  LEVEL_UP: 81,
  PLAYER_RESPAWN: 82,
  CHUNK_REQUEST: 10,
  CHUNK_DATA: 11,
  ACTION_USE: 30,
  ABILITY_COOLDOWN: 32,
  LOOT_DROP: 35,
  INVENTORY_SYNC: 36,
  EQUIP_ITEM: 37,
  UNEQUIP_ITEM: 38,
  USE_ITEM: 39,
  WORLD_ITEMS_SYNC: 45,
  WORLD_ITEM_SPAWN: 46,
  WORLD_ITEM_DESPAWN: 47,
  ITEM_PICKUP_REQUEST: 48,
  DUNGEON_ENTER: 85,
  DUNGEON_MAP: 86,
  DUNGEON_EXIT: 87,
  ZONE_CHANGE_REQUEST: 90,
  ZONE_CHANGE: 91,
  // 101 SAVED_MODELS_SYNC — removed with the model-workbench deletion (2026-04-21).
  //                        Orthographic 2D client uses Mana Seed sheets directly.
  WORLD_READY: 100,
  // --- World builder (client -> server, server -> client) ---
  BUILDER_NEW_MAP: 200,        // C->S: { name, width, height }
  BUILDER_PLACE_TILE: 201,     // C->S: { layer, x, y, tileset, tileId, rotation, flipH, flipV }
  BUILDER_REMOVE_TILE: 202,    // C->S: { layer, x, y }
  BUILDER_MAP_SNAPSHOT: 203,   // S->C: { mapId, width, height, tiles: [...] }
  BUILDER_TILE_PLACED: 204,    // S->C: placement (broadcast to same-zone builders)
  BUILDER_TILE_REMOVED: 205,   // S->C: removal  (broadcast to same-zone builders)
  BUILDER_LIST_MAPS: 206,      // C->S: request map list
  BUILDER_MAPS_LIST: 207,      // S->C: { maps: [{ id, numericId, name, width, height }] }
  BUILDER_GOTO_MAP: 208,       // C->S: { numericId }  teleport builder to another user map / heaven
  BUILDER_ERROR: 209,          // S->C: { reason }
  BUILDER_PLACE_BLOCK: 210,    // C->S: { x, y }    place a 1-cell collision block
  BUILDER_REMOVE_BLOCK: 211,   // C->S: { x, y }    remove a collision block
  BUILDER_BLOCK_PLACED: 212,   // S->C broadcast: block added
  BUILDER_BLOCK_REMOVED: 213,  // S->C broadcast: block removed
  PING: 253,
  PONG: 254,
} as const;

export function packReliable(opcode: number, data: Record<string, any>): string {
  return JSON.stringify({ op: opcode, ...data });
}

export function packEntitySpawn(
  entityId: string, name: string, x: number, y: number, z: number,
  entityType = "player", hp = 50, maxHp = 50,
  bodyColor = "#4466aa", skinColor = "#e8c4a0", weaponType = "melee",
): string {
  return packReliable(Opcode.ENTITY_SPAWN, {
    entityId, name, entityType, x, y, z, hp, maxHp, bodyColor, skinColor, weaponType,
  });
}

export function packEntityDespawn(entityId: string): string {
  return packReliable(Opcode.ENTITY_DESPAWN, { entityId });
}

export function packDamageEvent(attackerId: string, targetId: string, damage: number, weaponType: string): string {
  return packReliable(Opcode.DAMAGE_EVENT, { attackerId, targetId, damage, weaponType });
}

export function packEntityDeath(entityId: string): string {
  return packReliable(Opcode.ENTITY_DEATH, { entityId });
}

export function packEntityState(entityId: string, hp: number, maxHp: number): string {
  return packReliable(Opcode.ENTITY_STATE, { entityId, hp, maxHp });
}

export function packSpawnPoint(id: string, x: number, z: number, distance: number, npcIds: string[], maxCount: number, frequency: number): string {
  return packReliable(Opcode.SPAWN_POINT, { id, x, z, distance, npcIds, maxCount, frequency });
}

export function packCombatState(entityId: string, inCombat: boolean, autoAttacking: boolean, targetId: string | null): string {
  return packReliable(Opcode.COMBAT_STATE, { entityId, inCombat, autoAttacking, targetId });
}

export function packEnemyNearby(playerId: string, entityIds: string[], nearby: boolean): string {
  return packReliable(Opcode.ENEMY_NEARBY, { playerId, entityIds, nearby });
}

export function packZoneMusicTag(playerId: string, musicState: string): string {
  return packReliable(Opcode.ZONE_MUSIC_TAG, { playerId, musicState });
}

export function packXpGain(playerId: string, xpGained: number, totalXp: number, xpToNext: number, level: number): string {
  return packReliable(Opcode.XP_GAIN, { playerId, xpGained, totalXp, xpToNext, level });
}

export function packLevelUp(playerId: string, newLevel: number, hpBonus: number, manaBonus: number, staminaBonus: number): string {
  return packReliable(Opcode.LEVEL_UP, { playerId, newLevel, hpBonus, manaBonus, staminaBonus });
}

export function packPlayerRespawn(entityId: string, x: number, y: number, z: number, hp: number, maxHp: number): string {
  return packReliable(Opcode.PLAYER_RESPAWN, { entityId, x, y, z, hp, maxHp });
}

// Binary position: 24 bytes
const POSITION_SIZE = 24;

export function packPosition(entityId: number, x: number, y: number, z: number, rotation: number): Buffer {
  const buf = Buffer.alloc(POSITION_SIZE);
  buf.writeUInt8(Opcode.POSITION_UPDATE, 0);
  buf.writeUInt8(0, 1); // flags
  buf.writeUInt16LE(0, 2); // sequence
  buf.writeUInt32LE(entityId, 4);
  buf.writeFloatLE(x, 8);
  buf.writeFloatLE(y, 12);
  buf.writeFloatLE(z, 16);
  buf.writeFloatLE(rotation, 20);
  return buf;
}

export function unpackPosition(buf: Buffer): { entityId: number; x: number; y: number; z: number; rotation: number } {
  return {
    entityId: buf.readUInt32LE(4),
    x: buf.readFloatLE(8),
    y: buf.readFloatLE(12),
    z: buf.readFloatLE(16),
    rotation: buf.readFloatLE(20),
  };
}

// --- Binary combat messages (high-frequency, replaces JSON for perf) ---

const WEAPON_TYPE_MAP: Record<string, number> = { melee: 0, ranged: 1, magic: 2, fire: 3, ice: 4, shock: 5 };
const WEAPON_TYPE_REV = ["melee", "ranged", "magic", "fire", "ice", "shock"];

export function hashEntityId(str: string): number {
  let hash = 0;
  for (let i = 0; i < str.length; i++) {
    hash = ((hash << 5) - hash + str.charCodeAt(i)) | 0;
  }
  return hash >>> 0;
}

/** Binary DAMAGE_EVENT: 12 bytes [op:u8][attackerHash:u32][targetHash:u32][damage:u16][weaponType:u8] */
export function packBinaryDamage(attackerId: string, targetId: string, damage: number, weaponType: string): Buffer {
  const buf = Buffer.alloc(12);
  buf.writeUInt8(Opcode.DAMAGE_EVENT, 0);
  buf.writeUInt32LE(hashEntityId(attackerId), 1);
  buf.writeUInt32LE(hashEntityId(targetId), 5);
  buf.writeUInt16LE(Math.min(65535, damage), 9);
  buf.writeUInt8(WEAPON_TYPE_MAP[weaponType] ?? 0, 11);
  return buf;
}

/** Binary ENTITY_STATE: 9 bytes [op:u8][entityHash:u32][hp:u16][maxHp:u16] */
export function packBinaryState(entityId: string, hp: number, maxHp: number): Buffer {
  const buf = Buffer.alloc(9);
  buf.writeUInt8(Opcode.ENTITY_STATE, 0);
  buf.writeUInt32LE(hashEntityId(entityId), 1);
  buf.writeUInt16LE(Math.min(65535, hp), 5);
  buf.writeUInt16LE(Math.min(65535, maxHp), 7);
  return buf;
}

/** Binary ENTITY_DEATH: 5 bytes [op:u8][entityHash:u32] */
export function packBinaryDeath(entityId: string): Buffer {
  const buf = Buffer.alloc(5);
  buf.writeUInt8(Opcode.ENTITY_DEATH, 0);
  buf.writeUInt32LE(hashEntityId(entityId), 1);
  return buf;
}

const ABILITY_ID_MAP: Record<string, number> = { defend: 0, heal: 1, fire: 2, ice: 3, shock: 4 };
export const ABILITY_ID_REV = ["defend", "heal", "fire", "ice", "shock"];

/** Binary ABILITY_COOLDOWN: 6 bytes [op:u8][abilityId:u8][remaining:f32LE] */
export function packBinaryAbilityCooldown(abilityId: string, remaining: number): Buffer {
  const buf = Buffer.alloc(6);
  buf.writeUInt8(Opcode.ABILITY_COOLDOWN, 0);
  buf.writeUInt8(ABILITY_ID_MAP[abilityId] ?? 255, 1);
  buf.writeFloatLE(remaining, 2);
  return buf;
}

/** Binary XP_GAIN: 18 bytes [op:u8][entityHash:u32][xpGained:u16][totalXp:u32][xpToNext:u16][level:u8] */
export function packBinaryXpGain(entityId: string, xpGained: number, totalXp: number, xpToNext: number, level: number): Buffer {
  const buf = Buffer.alloc(14);
  buf.writeUInt8(Opcode.XP_GAIN, 0);
  buf.writeUInt32LE(hashEntityId(entityId), 1);
  buf.writeUInt16LE(Math.min(65535, xpGained), 5);
  buf.writeUInt32LE(Math.min(0xffffffff, totalXp), 7);
  buf.writeUInt16LE(Math.min(65535, xpToNext), 11);
  buf.writeUInt8(Math.min(255, level), 13);
  return buf;
}

/** Binary LEVEL_UP: 10 bytes [op:u8][level:u8][hpBonus:u16][manaBonus:u16][staminaBonus:u16][pad:u8] */
export function packBinaryLevelUp(newLevel: number, hpBonus: number, manaBonus: number, staminaBonus: number): Buffer {
  const buf = Buffer.alloc(8);
  buf.writeUInt8(Opcode.LEVEL_UP, 0);
  buf.writeUInt8(Math.min(255, newLevel), 1);
  buf.writeUInt16LE(Math.min(65535, hpBonus), 2);
  buf.writeUInt16LE(Math.min(65535, manaBonus), 4);
  buf.writeUInt16LE(Math.min(65535, staminaBonus), 6);
  return buf;
}

/** Binary PLAYER_RESPAWN: 21 bytes [op:u8][entityHash:u32][x:f32][y:f32][z:f32][hp:u16][maxHp:u16] */
export function packBinaryRespawn(entityId: string, x: number, y: number, z: number, hp: number, maxHp: number): Buffer {
  const buf = Buffer.alloc(21);
  buf.writeUInt8(Opcode.PLAYER_RESPAWN, 0);
  buf.writeUInt32LE(hashEntityId(entityId), 1);
  buf.writeFloatLE(x, 5);
  buf.writeFloatLE(y, 9);
  buf.writeFloatLE(z, 13);
  buf.writeUInt16LE(Math.min(65535, hp), 17);
  buf.writeUInt16LE(Math.min(65535, maxHp), 19);
  return buf;
}

/** Binary COMBAT_STATE: 15 bytes [op:u8][entityHash:u32][flags:u8][targetHash:u32][pad:u40] */
export function packBinaryCombatState(entityId: string, inCombat: boolean, autoAttacking: boolean, targetId: string | null): Buffer {
  const buf = Buffer.alloc(11);
  buf.writeUInt8(Opcode.COMBAT_STATE, 0);
  buf.writeUInt32LE(hashEntityId(entityId), 1);
  buf.writeUInt8((inCombat ? 1 : 0) | (autoAttacking ? 2 : 0), 5);
  buf.writeUInt32LE(targetId ? hashEntityId(targetId) : 0, 6);
  buf.writeUInt8(targetId ? 1 : 0, 10); // hasTarget flag
  return buf;
}

/** Binary ENEMY_NEARBY: 7+4N bytes [op:u8][entityHash:u32][nearby:u8][count:u8][npcHash:u32 × N] */
export function packBinaryEnemyNearby(entityId: string, npcIds: string[], nearby: boolean): Buffer {
  const buf = Buffer.alloc(7 + npcIds.length * 4);
  buf.writeUInt8(Opcode.ENEMY_NEARBY, 0);
  buf.writeUInt32LE(hashEntityId(entityId), 1);
  buf.writeUInt8(nearby ? 1 : 0, 5);
  buf.writeUInt8(Math.min(255, npcIds.length), 6);
  for (let i = 0; i < npcIds.length; i++) {
    buf.writeUInt32LE(hashEntityId(npcIds[i]), 7 + i * 4);
  }
  return buf;
}

/** Binary ZONE_MUSIC_TAG: 6 bytes [op:u8][entityHash:u32][tag:u8] */
const MUSIC_TAG_MAP: Record<string, number> = { town: 0, field: 1, dungeon: 2, battle: 3, boss: 4, peaceful: 5 };
export const MUSIC_TAG_REV = ["town", "field", "dungeon", "battle", "boss", "peaceful"];
export function packBinaryZoneMusicTag(entityId: string, musicState: string): Buffer {
  const buf = Buffer.alloc(6);
  buf.writeUInt8(Opcode.ZONE_MUSIC_TAG, 0);
  buf.writeUInt32LE(hashEntityId(entityId), 1);
  buf.writeUInt8(MUSIC_TAG_MAP[musicState] ?? 255, 5);
  return buf;
}

/**
 * Pack chunk height data into a binary buffer for DataChannel delivery.
 * Format: [opcode:u8 = CHUNK_DATA] [chunkX:i16LE] [chunkZ:i16LE] [heightData: Float16 bytes]
 * Total: 5 + heightData.length bytes (typically 2053 for 32x32 chunk)
 */
export function packChunkData(cx: number, cz: number, heightData: Buffer): Buffer {
  const HEADER = 5; // opcode(1) + cx(2) + cz(2)
  const buf = Buffer.alloc(HEADER + heightData.length);
  buf.writeUInt8(Opcode.CHUNK_DATA, 0);
  buf.writeInt16LE(cx, 1);
  buf.writeInt16LE(cz, 3);
  heightData.copy(buf, HEADER);
  return buf;
}
