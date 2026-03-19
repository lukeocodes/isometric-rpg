# Server Agent Guide

## Runtime
- Node.js + tsx (not Bun — werift needs Node's UDP stack)
- `node --watch --import tsx src/index.ts`
- Fastify on port 8000

## File Map
- `src/index.ts` — boot, Redis connect, NPC spawn, game loop start
- `src/app.ts` — Fastify app factory, CORS, route registration
- `src/config.ts` — env vars with defaults (works without .env)
- `src/routes/rtc.ts` — WebRTC signaling (offer/answer), entity sync, disconnect handling
- `src/routes/auth.ts` — OAuth2 callback, dev-login, JWT refresh
- `src/routes/characters.ts` — CRUD with validation (stats total 30, 3 skills, name unique)
- `src/game/world.ts` — 20Hz game loop: wander → combat → broadcast damage/death → broadcast state → broadcast positions
- `src/game/combat.ts` — Auto-attack tick, wind-up, damage, retaliation, HP regen
- `src/game/npc-templates.ts` — Inheritance-based NPC type system (category → group → variant)
- `src/game/spawn-points.ts` — Spawn point items: spawn, respawn, wander, death handling
- `src/game/entities.ts` — Entity store with `isAwake()` sleep optimization
- `src/game/zones.ts` — Safe zone definitions (town = 8-tile radius at origin)
- `src/game/linger.ts` — 2-min character linger on unsafe disconnect
- `src/game/protocol.ts` — Binary position packing, JSON reliable message encoding
- `src/ws/connections.ts` — WebRTC peer connection + DataChannel tracking

## Adding NPCs
1. Add template in `npc-templates.ts` using `template(GROUP_BASE, { ...overrides })`
2. Add to a spawn point's `npcIds` array in `npcs.ts`
3. Server auto-spawns from the template with randomized stats

## Adding Spawn Points
```typescript
addSpawnPoint({
  id: "sp-unique-id",
  x: 10, z: 20, mapId: 1,
  npcIds: ["skeleton-warrior", "skeleton-archer"],
  distance: 8,    // spawn/wander radius
  maxCount: 4,    // alive cap
  frequency: 5,   // respawn seconds
});
```

## Position Broadcast Format
Batched binary: `[count:u16LE]` then N × 20 bytes: `[entityId:u32LE][x:f32LE][y:f32LE][z:f32LE][rotation:f32LE]`

Entity IDs are hashed to u32 via `hashCode()` — client maintains a reverse map.
