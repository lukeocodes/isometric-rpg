export const Opcode = {
  POSITION_UPDATE: 1,
  ENTITY_SPAWN: 2,
  ENTITY_DESPAWN: 3,
  ENTITY_MOVE: 4,
  TARGET_SELECT: 40,
  AUTO_ATTACK_TOGGLE: 41,
  AUTO_ATTACK_CANCEL: 42,
  DAMAGE_EVENT: 50,
  ENTITY_DEATH: 51,
  ENTITY_STATE: 52,
  COMBAT_STATE: 53,
  SPAWN_POINT: 60,
  WORLD_READY: 100,
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
