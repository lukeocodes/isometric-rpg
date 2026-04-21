# Binary wire protocol

All gameplay data flows over WebRTC DataChannels. The reliable channel carries two classes of messages:

| Message type | Use binary if... | Use JSON if... |
|---|---|---|
| Combat / state | sent every tick or on every player action | — |
| XP / level / respawn | sent on game events (kills, death) | — |
| Zone change, dungeon map | — | rare, contains variable-length strings |
| Chat, quests, inventory | — | rare, variable structure |
| Entity spawn | — | variable fields (name, colors, type) |

**Default to binary for anything sent more than once per second or during combat.**

## Format

All binary reliable messages start with a 1-byte opcode, then fixed-width fields (little-endian byte order). No length prefix needed — byteLength check gates the handler.

```
[op: u8] [fields...]
```

Entity references are transmitted as u32 hashes via `hashEntityId(str)`. The client maintains `numericIdMap: Map<u32, string>` populated on entity spawn.

## Existing binary messages

| Opcode | Name | Size | Fields after op |
|---|---|---|---|
| 32 | ABILITY_COOLDOWN | 6 B | abilityIdx:u8, remaining:f32 |
| 50 | DAMAGE_EVENT | 12 B | attackerHash:u32, targetHash:u32, damage:u16, weaponType:u8 |
| 51 | ENTITY_DEATH | 5 B | entityHash:u32 |
| 52 | ENTITY_STATE | 9 B | entityHash:u32, hp:u16, maxHp:u16 |
| 53 | COMBAT_STATE | 11 B | entityHash:u32, flags:u8 (bit0=inCombat, bit1=autoAttacking), targetHash:u32, hasTarget:u8 |
| 70 | ENEMY_NEARBY | 7+4N B | entityHash:u32, nearby:u8, count:u8, npcHash:u32×N |
| 80 | XP_GAIN | 14 B | entityHash:u32, xpGained:u16, totalXp:u32, xpToNext:u16, level:u8 |
| 81 | LEVEL_UP | 8 B | level:u8, hpBonus:u16, manaBonus:u16, staminaBonus:u16 |
| 82 | PLAYER_RESPAWN | 21 B | entityHash:u32, x:f32, y:f32, z:f32 (legacy, unused on 2D render), hp:u16, maxHp:u16 |

## Still JSON (intentional)

- `ENTITY_SPAWN` — variable string fields
- `ENTITY_DESPAWN` — rare
- `CHAT_MESSAGE` / `SYSTEM_MESSAGE` — rare
- `ZONE_CHANGE` — rare, carries zone name / file strings
- `DUNGEON_MAP` — rare, carries room layout object
- `LOOT_DROP` / `INVENTORY_SYNC` — rare, carries item array
- `QUEST_UPDATE` — rare, carries quest array
- `WORLD_READY` — once per connection
- All `BUILDER_*` opcodes (200-209) — see `docs/world-builder.md`

## Adding a new binary message

### 1. Server — `packages/server/src/game/protocol.ts`

```typescript
/** Binary MY_MSG: 7 bytes [op:u8][entityHash:u32][value:u16] */
export function packBinaryMyMsg(entityId: string, value: number): Buffer {
  const buf = Buffer.alloc(7); // 1 + 4 + 2
  buf.writeUInt8(Opcode.MY_MSG, 0);
  buf.writeUInt32LE(hashEntityId(entityId), 1);
  buf.writeUInt16LE(Math.min(65535, value), 5);
  return buf;
}
```

Add the opcode to the `Opcode` const at the top of the file.

### 2. Server — send site (`world.ts` or `rtc.ts`)

```typescript
connectionManager.sendReliable(entityId, packBinaryMyMsg(entityId, value));
// or for broadcast:
connectionManager.broadcastBinary(packBinaryMyMsg(entityId, value));
```

### 3. Client — routing (`NetworkManager.ts`)

Add the opcode byte value to the binary routing check:

```typescript
if (firstByte === 50 || firstByte === 51 || /* ... */ || firstByte === MY_OPCODE) {
  if (this.onBinaryReliable) this.onBinaryReliable(e.data);
  return;
}
```

### 4. Client — decode (`StateSync.ts` → `handleBinaryReliable`)

```typescript
} else if (op === Opcode.MY_MSG && data.byteLength >= 7) {
  const entityHash = view.getUint32(1, true);
  const value = view.getUint16(5, true);
  const entityId = this.numericIdMap.get(entityHash) ?? "";
  if (entityId && this.onMyMsg) this.onMyMsg(entityId, value);
}
```

Also stub out any JSON fallback in `handleReliableMessage`:

```typescript
case Opcode.MY_MSG: break; // handled in handleBinaryReliable
```

## Position broadcast (unreliable channel)

Batched binary: `[count:u16LE]` + N × 20 bytes per entity, where each entry is `[entityIdHash:u32LE][x:f32LE][y:f32LE][z:f32LE][rotation:f32LE]`. **Never send positions over the reliable channel** — positions can drop without retransmit; delivery is best-effort by design.

### The `z` field is vestigial

The protocol keeps a `z` float on `POSITION_UPDATE` and `PLAYER_RESPAWN` from the earlier isometric architecture. The top-down 2D client uses `x, y` only; server simulation carries `z` on entities but it stays at zero in practice. The field is documented on the wire for honesty's sake — don't build on it, and don't remove it without coordinating a breaking wire change with every connected client (binary message sizes are byte-exact).

### Single-entity vs batched

- **Single-entity `packPosition`** (`protocol.ts:122`): 24 bytes — `[op:u8][flags:u8][seq:u16LE][entityIdHash:u32LE][x:f32LE][y:f32LE][z:f32LE][rotation:f32LE]`. Historical code path; not used by the current broadcast.
- **Batched `broadcastPositions`** (`world.ts`): 2-byte count header + N × 20-byte entries (no per-entity opcode). This is what ships at 15 Hz on the unreliable channel.
