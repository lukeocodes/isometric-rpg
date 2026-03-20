// Opcodes matching shared/protocol.json
export const Opcode = {
  POSITION_UPDATE: 1,
  ENTITY_SPAWN: 2,
  ENTITY_DESPAWN: 3,
  ENTITY_MOVE: 4,
  CHUNK_REQUEST: 10,
  CHUNK_DATA: 11,
  CHUNK_SUBSCRIBE: 12,
  CHUNK_UNSUBSCRIBE: 13,
  CHAT_MESSAGE: 20,
  SYSTEM_MESSAGE: 21,
  ACTION_USE: 30,
  STATS_UPDATE: 31,
  TARGET_SELECT: 40,
  AUTO_ATTACK_TOGGLE: 41,
  AUTO_ATTACK_CANCEL: 42,
  DAMAGE_EVENT: 50,
  ENTITY_DEATH: 51,
  ENTITY_STATE: 52,
  COMBAT_STATE: 53,
  SPAWN_POINT: 60,
  ENEMY_NEARBY: 70,
  ZONE_MUSIC_TAG: 71,
  WORLD_READY: 100,
  PING: 253,
  PONG: 254,
  ERROR: 255,
} as const;

// Binary position update: 24 bytes
// [opcode: u8] [flags: u8] [sequence: u16] [entityId: u32] [x: f32] [y: f32] [z: f32] [rotation: f32]
const POSITION_SIZE = 24;

export function packPosition(
  entityId: number,
  x: number,
  y: number,
  z: number,
  rotation: number,
  sequence = 0,
  flags = 0,
): ArrayBuffer {
  const buffer = new ArrayBuffer(POSITION_SIZE);
  const view = new DataView(buffer);
  view.setUint8(0, Opcode.POSITION_UPDATE);
  view.setUint8(1, flags);
  view.setUint16(2, sequence, true);
  view.setUint32(4, entityId, true);
  view.setFloat32(8, x, true);
  view.setFloat32(12, y, true);
  view.setFloat32(16, z, true);
  view.setFloat32(20, rotation, true);
  return buffer;
}

export function unpackPosition(buffer: ArrayBuffer): {
  opcode: number;
  flags: number;
  sequence: number;
  entityId: number;
  x: number;
  y: number;
  z: number;
  rotation: number;
} {
  const view = new DataView(buffer);
  return {
    opcode: view.getUint8(0),
    flags: view.getUint8(1),
    sequence: view.getUint16(2, true),
    entityId: view.getUint32(4, true),
    x: view.getFloat32(8, true),
    y: view.getFloat32(12, true),
    z: view.getFloat32(16, true),
    rotation: view.getFloat32(20, true),
  };
}

export function packReliable(opcode: number, data: Record<string, any>): string {
  return JSON.stringify({ op: opcode, ...data });
}

export function unpackReliable(message: string): Record<string, any> {
  return JSON.parse(message);
}
