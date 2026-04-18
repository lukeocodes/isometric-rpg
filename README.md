# 16Bit Online

A Pokemon GameBoy-style top-down multiplayer online RPG built with modern web technologies. Real-time multiplayer via WebRTC DataChannels, server-authoritative game logic, and hand-crafted Tiled maps — all running in a single browser tab.

## Tech Stack

| Layer | Technology | Purpose |
|-------|-----------|---------|
| Client Engine | [PixiJS v8](https://pixijs.com/) | 2D top-down rendering (WebGL-accelerated) |
| Client Bundler | [Vite](https://vitejs.dev/) | HMR dev server, tree-shaking, chunked builds |
| Client Runtime | [Bun](https://bun.sh/) | Package manager, Vite runner |
| Server Framework | [Fastify](https://fastify.dev/) | REST API, HTTP signaling |
| Server Runtime | [Node.js](https://nodejs.org/) + [tsx](https://github.com/privatenumber/tsx) | Required for werift's UDP/DTLS stack |
| WebRTC | [werift](https://github.com/nicely-tn/werift-webrtc) (server) / native (browser) | Unreliable DataChannels for positions, reliable for events |
| Database | [PostgreSQL](https://www.postgresql.org/) via [Drizzle ORM](https://orm.drizzle.team/) | Accounts, characters, world state |
| Cache | [Redis](https://redis.io/) via [ioredis](https://github.com/redis/ioredis) | Session state, world data |
| Auth | Dev login + game JWT sessions | Username/password, no external provider required |
| Audio | [Tone.js](https://tonejs.github.io/) + [Howler.js](https://howlerjs.com/) | Procedural music + sound effects |
| Maps | [Tiled](https://www.mapeditor.org/) JSON format | Hand-crafted tile worlds |
| Model Tool | [PixiJS v8](https://pixijs.com/) + Vite | Standalone visual model workbench |

## Architecture

```
┌──────────────────┐    HTTP POST      ┌─────────────────┐
│   Browser         │ ──── /offer ────► │    Fastify       │
│  (PixiJS v8)      │ ◄─── SDP ──────── │    (Node.js)     │
│                   │                   │                   │
│  DataChannel      │ ◄── positions ─── │   Game Loop       │
│  (unreliable)     │   20B/entity/tick  │   (20Hz tick)    │
│                   │                   │                   │
│  DataChannel      │ ◄──── events ───► │   Combat / NPC    │
│  (reliable)       │  binary + JSON    │   Systems         │
└──────────────────┘                   └────────┬──────────┘
                                                 │
                                       ┌─────────┴─────────┐
                                       │  PostgreSQL  Redis  │
                                       └───────────────────┘
```

### Key Design Decisions

- **Server-authoritative**: All combat, NPC behaviour, HP, and state live server-side. The client is a pure rendering and input layer.
- **WebRTC over WebSocket**: Position updates travel over unreliable/unordered DataChannels — lost packets are skipped rather than retransmitted, giving sub-100ms effective latency at the cost of occasional missed frames (invisible at 20Hz). `maxPacketLifeTime=200ms` drops stale packets automatically.
- **HTTP signaling only**: One `POST /api/rtc/offer` + `POST /api/rtc/answer` exchange replaces a persistent signaling connection entirely.
- **ECS on the client**: Entities are IDs, components are data, systems process them. Adding a feature is a new component + new system, not a change to existing code.
- **Binary for hot paths, JSON for everything else**: Position updates and combat events are binary-packed (20 bytes per entity, 12-byte damage events). Zone changes, chat, and quests use JSON. See [Performance](#performance) below.
- **Procedural entities, zero textures**: All character models and NPCs are drawn with PixiJS `Graphics` calls — no sprite sheets, no image loading, no VRAM for textures. Entity frames are pre-rendered into `RenderTexture` cache at startup.
- **Hand-crafted maps, tile batching**: Tiled JSON maps describe the world; PixiJS renders tiles through `@pixi/tilemap`'s GPU batching. The same tileset JSON drives both client rendering and server walkability/spawn logic.

---

## Performance

> **~200 MB browser tab** with a full game engine, 256×256 tile maps, 5 zones, animated entities, procedural music, and real-time multiplayer.

This is the result of deliberate decisions at every layer.

### Network bandwidth: ~3–8 KB/s per player in combat

| Message | Old format | New format | Saving |
|---------|-----------|-----------|--------|
| Position batch (10 nearby) | ~600B JSON | 202B binary | 66% |
| Damage event | ~80B JSON | 12B binary | 85% |
| Entity state (HP) | ~60B JSON per entity | 9B binary, delta-only | 90%+ |
| Death | ~50B JSON | 5B binary | 90% |

**Delta-only state broadcasts**: `broadcastState()` tracks last-sent `{ hp, maxHp }` per entity per connection. Skips sending if unchanged. In practice this eliminates ~95% of state messages when entities are idle.

**Stale packet drop**: `maxPacketLifeTime=200ms` on the unreliable channel means position packets older than 200ms never leave the kernel buffer. No queue buildup under load.

**Entity sleep**: Every entity with no player within 32 tiles skips combat ticks, wandering, and regen entirely. The awake set is pre-computed once per game tick via spatial grid — O(1) per entity.

### Memory: procedural rendering

**No textures in VRAM for entities.** Every character, NPC, and creature is drawn with `Graphics` commands (rectangles, ellipses, bezier curves). At startup, `WorkbenchSpriteSheet` pre-renders each entity type into a fixed set of `RenderTexture` frames — 8 directions × 8 walk phases = 64 frames per type. After that, sprites just swap textures from this cache; no per-frame re-rasterising.

Each `RenderTexture` frame is 192×256px at the default "High" quality level. 10 entity types × 64 frames × (192×256×4 bytes) ≈ **120 MB VRAM** at absolute maximum — in practice well below that because most entity types are never near the player simultaneously.

**Render quality tiers** (user-configurable in Settings → Graphics, persisted to `localStorage`):

| Tier | Render scale | Frame size | Use case |
|------|-------------|-----------|----------|
| Low | 2× | 96×128 | Low-end / low-zoom |
| Medium | 3× | 144×192 | Balanced |
| **High** (default) | 4× | 192×256 | Retina / 2× zoom |
| Ultra | 6× | 288×384 | 4K / 4× zoom |

Quality auto-detects from `devicePixelRatio` on first load.

### Map memory: chunks, not everything at once

Maps are 256×256 tiles but only a **3-chunk radius (96×96 tiles)** around the player is loaded. `TiledMapRenderer` destroys tile sprites as they scroll out. Decorations (trees, rocks, lamp posts) are spawned on scroll-in and destroyed on scroll-out — the decoration list never grows unbounded regardless of total world size.

### JS heap: zero-alloc hot paths

**Pre-allocated position broadcast buffer**: `world.ts` allocates one `Buffer` at startup. Every 20Hz broadcast reuses it, growing it only if entity count exceeds 64 (rare). No per-tick `Buffer.alloc()`.

**Zero-alloc iterators**: `EntityStore.iterNearbyEntities()` and `ConnectionManager.iterAll()` use generators that yield from pre-existing data structures — no intermediate arrays allocated per tick.

**Particle swap-and-pop removal**: Dead particles are removed by swapping with the last element and popping — O(1) removal with no array shifting.

**Spawn/death animations in the game loop**: Entity spawn fade-ins and death poof effects are stepped from `Loop.ts` game tick, not `requestAnimationFrame`. RAF callbacks accumulate and are not cancelled on scene unload; game loop callbacks are.

### Garbage collection: dirty flags everywhere

**HP bar dirty flags**: HP bar `Graphics` objects only redraw when HP actually changed. The `dirty` flag is set by `handleKill` and `packBinaryDamage` handlers. Idle entities never trigger a redraw.

**Respawn queue replaces `setTimeout` swarm**: Instead of `setTimeout(respawn, 5000)` for each NPC death, a single respawn queue is checked each tick. No timer heap growth during mass NPC fights.

**Delta state cache cleanup**: `clearHashCache()` sweeps the `lastBroadcastState` map when an entity despawns, preventing unbounded map growth over long sessions.

---

## Project Structure

```
isometric-rpg/
├── packages/
│   ├── client/                        # PixiJS v8 TypeScript game client
│   │   ├── src/
│   │   │   ├── main.ts               # Boot: WebRTC check, router, game lifecycle
│   │   │   ├── engine/
│   │   │   │   ├── Game.ts           # Orchestrator: connects all systems
│   │   │   │   ├── Loop.ts           # Fixed 20Hz tick + variable render loop
│   │   │   │   └── InputManager.ts   # WASD + click + Caps Lock handlers
│   │   │   ├── renderer/
│   │   │   │   ├── PixiApp.ts        # PixiJS Application wrapper
│   │   │   │   ├── IsoCamera.ts      # 2D isometric camera with smooth follow
│   │   │   │   ├── EntityRenderer.ts # Sprite-based entity rendering + effects
│   │   │   │   ├── TiledMapRenderer.ts  # Loads + renders Tiled JSON maps
│   │   │   │   ├── StructureRenderer.ts # Wall pieces, floors, stairs, windows
│   │   │   │   ├── TerrainRenderer.ts   # Procedural terrain fallback
│   │   │   │   └── IsometricRenderer.ts # Projection math (worldToScreen, screenToWorld)
│   │   │   ├── ecs/
│   │   │   │   ├── EntityManager.ts  # Entity store + spatial grid
│   │   │   │   ├── components/       # Position, Movement, Renderable, Identity, Stats, Combat
│   │   │   │   └── systems/          # Movement, Animation, Interpolation
│   │   │   ├── net/
│   │   │   │   ├── NetworkManager.ts # WebRTC connection via HTTP signaling
│   │   │   │   ├── StateSync.ts      # Server → client entity sync, hash mapping
│   │   │   │   └── Protocol.ts       # Opcodes, binary pack/unpack
│   │   │   ├── ui/
│   │   │   │   ├── Router.ts         # Screen state machine
│   │   │   │   ├── screens/          # Login, Onboarding, CharCreate, CharSelect, GameHUD
│   │   │   │   └── components/       # SettingsMenu (audio + graphics), minimap, action bar
│   │   │   ├── auth/                 # AuthManager, TokenStore
│   │   │   ├── state/               # SessionState, PlayerState, GameState
│   │   │   └── dev/
│   │   │       └── PlaywrightAPI.ts  # Dev-only window.__game testing interface
│   │   ├── public/
│   │   │   ├── maps/                 # Tiled JSON map files (starter, zones)
│   │   │   └── tilesets/            # Tileset images + TSJ descriptors
│   │   ├── index.html
│   │   └── vite.config.ts
│   │
│   ├── server/                        # Fastify TypeScript server
│   │   ├── src/
│   │   │   ├── index.ts              # Boot: Redis, zone maps, NPC spawn, game loop
│   │   │   ├── app.ts                # Fastify factory, CORS, route registration
│   │   │   ├── config.ts             # Env vars with defaults (works without .env)
│   │   │   ├── routes/
│   │   │   │   ├── rtc.ts            # WebRTC signaling, entity sync, disconnect
│   │   │   │   ├── auth.ts           # Dev login, JWT issue + refresh
│   │   │   │   └── characters.ts     # CRUD with validation (stats total 30, name unique)
│   │   │   ├── game/
│   │   │   │   ├── world.ts          # 20Hz loop: wander → combat → broadcast
│   │   │   │   ├── combat.ts         # Auto-attack, damage, wind-up, HP regen
│   │   │   │   ├── entities.ts       # EntityStore with spatial hash + sleep opt
│   │   │   │   ├── npc-templates.ts  # Inheritance: category → group → variant
│   │   │   │   ├── npcs.ts           # NPC init + respawn queue
│   │   │   │   ├── spawn-points.ts   # Spawn items: spawn/wander/death handling
│   │   │   │   ├── zones.ts          # Safe zone definitions
│   │   │   │   ├── zone-registry.ts  # Zone map: IDs, exits, level ranges, music
│   │   │   │   ├── tiled-map.ts      # Per-zone Tiled JSON: walkability + spawns
│   │   │   │   ├── dungeon.ts        # Instance generation + boss tracking
│   │   │   │   ├── quests.ts         # 5 kill quests + XP rewards
│   │   │   │   ├── inventory.ts      # Loot tables, item pickup, equip/unequip
│   │   │   │   ├── experience.ts     # XP formula, level-up, stat bonuses
│   │   │   │   ├── linger.ts         # 2-min linger on unsafe disconnect
│   │   │   │   └── protocol.ts       # Binary + JSON message packing
│   │   │   ├── db/
│   │   │   │   ├── schema.ts         # Drizzle table definitions
│   │   │   │   ├── postgres.ts       # postgres client
│   │   │   │   └── redis.ts          # ioredis client
│   │   │   └── ws/
│   │   │       └── connections.ts    # WebRTC peer + DataChannel tracking
│   │   └── drizzle.config.ts
│   │
│   └── shared/                        # Shared constants (JSON, no build step)
│       ├── constants.json            # Tile size, chunk size, tick rates, entity radii
│       ├── protocol.json             # Opcode enum — single source of truth
│       └── world-config.json         # World generation seed + parameters
│
├── tools/
│   └── model-workbench/              # Standalone visual model editor (see below)
│       ├── src/
│       │   ├── models/               # 72 model definitions (bodies, armor, weapons…)
│       │   └── ui/                   # Workbench panel, preview canvas
│       └── package.json
│
├── docker-compose.yml                # PostgreSQL (5433) + Redis (6379)
├── .env.example
├── package.json                      # Bun workspace root
└── AGENTS.md                         # Dev instructions + game state
```

---

## Getting Started

### Prerequisites

- [Bun](https://bun.sh/) — package manager and client dev runner
- [Node.js](https://nodejs.org/) 18+ — server runtime (werift requires Node's UDP stack)
- [Docker](https://www.docker.com/) — runs PostgreSQL and Redis

### Setup

```bash
# Clone and install all workspace dependencies
bun install

# Start PostgreSQL + Redis
docker compose up -d

# Push schema to the database (first time, or after schema changes)
cd packages/server
DATABASE_URL="postgresql://game:game_dev_password@localhost:5433/game" bunx drizzle-kit push

cp .env.example .env
```

### Running the Game

Open **three terminals**:

```bash
# Terminal 1 — Server (auto-reloads on file change)
cd packages/server
node --watch --import tsx src/index.ts

# Terminal 2 — Client (Vite HMR)
cd packages/client
bunx --bun vite
```

Open **http://localhost:5173** in Chrome. Use the dev login (any username, blank password).

> **Browser note**: Ungoogled Chromium blocks WebRTC. Use regular Chrome, Firefox, or Safari.

### Running the Model Workbench

The model workbench is a standalone visual editor for character and NPC models, separate from the main game.

```bash
cd tools/model-workbench
bunx vite
```

Open **http://localhost:5180** (or whichever port Vite picks). No backend required — runs entirely in the browser.

### Docker Services

| Service | Port | Credentials |
|---------|------|-------------|
| PostgreSQL | **5433** | `game` / `game_dev_password` / db `game` |
| Redis | 6379 | No auth |

Port 5433 avoids conflicting with a local PostgreSQL on 5432.

---

## Game Systems

### World & Zones

Five connected hand-crafted zones, each a 256×256 Tiled map. Zone transitions happen at designated exits; the server validates the exit, moves the entity, and sends the new map data to the client.

| Zone | Level Range | Theme |
|------|------------|-------|
| Human Meadows | 1–3 | Starter town, rabbits, goblins |
| Elf Grove | 1–3 | Forest, wisps |
| Orc Wastes | 1–3 | Barren, orcs |
| Crossroads | 4–6 | Convergence zone, dungeon entrance |
| Skeleton Wastes | 5–8 | Ruined fortress, undead |

A loading overlay with zone name fades in/out on transition. Each zone has its own procedural background music tag.

### Buildings & Structures

Buildings are composed from individual wall-piece tiles — UO-style — rather than pre-built sprites. Each piece is a separate Tiled object:

- **Wall types**: `wall_left`, `wall_right`, `wall_corner` (N/E/S/W orientations)
- **Variants**: solid, door (transparent frame), window (cut opening with reveals)
- **Materials**: stone, wood, plaster (each with distinct face/side/top shading)
- **Multi-storey**: `floor` pieces stack floors; `stair_left`/`stair_right` raise player elevation
- **Opacity**: Floors above the player fade to 10% so the player is always visible inside buildings

Wall pieces are rendered by `StructureRenderer` with per-direction shading (NW faces lit, NE faces shadowed) and subtle edge outlines. Windows use PixiJS `g.cut()` destination-out compositing to punch holes through both outer and inner wall faces, with sill/head/jam reveal geometry filling the wall thickness.

### Dungeon Instances

Entering the dungeon portal at the Crossroads spawns a private instance:
- Server generates a procedural room layout
- Client renders it with `TiledMapRenderer`
- Boss death spawns an exit portal
- All in the same zone/connection pipeline as normal zone changes

### Combat

- **Auto-attack**: Right-click enemy to engage; or select then Caps Lock to toggle
- **Abilities**: 5 ability slots (Defend, Heal, Fire, Ice, Shock) with cooldowns, element-coloured damage numbers, and HUD overlays
- **Retaliation**: NPCs auto-attack back when hit
- **Wind-up**: 500ms cancel window before damage resolves
- **Regen**: +1 HP every 0.5s when out of combat
- **Aggro**: Hostile NPCs detect players within 8 tiles and auto-engage

### NPC System

Template inheritance: `Category → Group → Variant`. Each variant defines **stat ranges**; individual NPCs get randomised stats on spawn.

Represented in world: rabbits (small, oval ears), skeletons (thin, rib cage), goblins (wide, pointed ears), imps (wings, horns), wolves, ogres, wraiths, bears — each drawn procedurally.

### Quests

5 kill quests available from the start (auto-accepted on login). Turn in for XP rewards. Quest UI on **J key**.

### Inventory & Equipment

Kill → loot drop (rolls from NPC loot table) → ground item spawn. Players pick up items, manage them via **I key**. Equipment slots: weapon, off-hand, helmet, chest, shoulders, gauntlets, legs, boots. Stat bonuses (damage, armour) applied in combat.

### Disconnect Handling

| Location | Behaviour |
|----------|-----------|
| Safe zone (8-tile radius, town origin) | Character removed instantly |
| Outside safe zone | Lingers 2 minutes, can still be attacked |
| Reconnect | Attaches to lingering character with current HP/position |

Position + XP/level saved to PostgreSQL every 30 seconds and on clean disconnect.

---

## Model Workbench

A standalone PixiJS v8 tool for authoring character and NPC models. **Does not require the game server.**

### Features

- **72 models**: 4 player races (human, elf, dwarf, gnome), 15 NPC types (rabbit, skeleton, goblin, imp, wolf, ogre, wraith, bear + boss variants), 32 armour pieces, 12 weapons, 5 off-hands, 6 hair styles, 6 headgear
- **8-direction animation preview** with walk cycle
- **Body customisation**: width (0.7–1.3×), height (0.85–1.15×)
- **Colour pickers**: skin, hair, primary armour colour (auto-propagates to all equipped pieces via palette system)
- **Composite view**: preview any combination of body + equipped items
- **Attachment system**: slots (`head-top`, `hand-R`, `hand-L`, `chest`, `shoulders`, `legs`, `boots`, `gauntlets`) with two-handed weapon blocking
- **Auto-discovery**: any new `.ts` file dropped in a category folder is auto-registered via `import.meta.glob` — no manual index updates
- **Game bridge**: exports composite configs compatible with `EntityRenderer.ts`

### Model Architecture

Each model is a TypeScript class implementing `Model`:

```typescript
interface Model {
  id: string;
  name: string;
  category: ModelCategory;
  slot: AttachmentSlot;
  isAnimated: boolean;
  getDrawCalls(ctx: RenderContext): DrawCall[];
  getAttachmentPoints(skeleton: Skeleton): Record<string, AttachmentPoint>;
}
```

`getDrawCalls()` returns depth-sorted draw commands. `RenderContext` passes the skeleton (joint positions), colour palette, and optional `PixiJS Texture` for skinning. The renderer executes all draw calls on a shared `Graphics` instance to produce a single `RenderTexture` frame.

### Render Quality

Same 4-tier system as the main game. Auto-detects from `window.devicePixelRatio`:

```
Low (2×) → Medium (3×) → High (4×, default) → Ultra (6×)
```

---

## Networking Protocol

### Position channel (unreliable, unordered)

Binary batched — one message per tick per player:

```
[count: u16LE]  N × [entityId: u32LE][x: f32LE][y: f32LE][z: f32LE][rotation: f32LE]
                     └──── 20 bytes per entity ────────────────────────────────────┘
```

Entity IDs are hashed to `u32` via `hashCode()`. The client maintains `numericIdMap: Map<u32, string>` populated on entity spawn.

### Reliable channel (ordered)

High-frequency messages use binary; low-frequency use JSON.

| Opcode | Name | Size | Fields |
|--------|------|------|--------|
| 50 | `DAMAGE_EVENT` | 12 B | attackerHash:u32, targetHash:u32, damage:u16, weaponType:u8 |
| 51 | `ENTITY_DEATH` | 5 B | entityHash:u32 |
| 52 | `ENTITY_STATE` | 9 B | entityHash:u32, hp:u16, maxHp:u16 |
| 53 | `COMBAT_STATE` | 11 B | entityHash:u32, flags:u8, targetHash:u32, hasTarget:u8 |
| 70 | `ENEMY_NEARBY` | 7+4N B | entityHash:u32, nearby:u8, count:u8, npcHash:u32×N |
| 32 | `ABILITY_COOLDOWN` | 6 B | abilityIdx:u8, remaining:f32 |
| 80 | `XP_GAIN` | 14 B | entityHash:u32, xpGained:u16, totalXp:u32, xpToNext:u16, level:u8 |
| 81 | `LEVEL_UP` | 8 B | level:u8, hpBonus:u16, manaBonus:u16, staminaBonus:u16 |
| 82 | `PLAYER_RESPAWN` | 21 B | entityHash:u32, x:f32, y:f32, z:f32, hp:u16, maxHp:u16 |

JSON messages (rare, variable-length): `ENTITY_SPAWN`, `ENTITY_DESPAWN`, `ZONE_CHANGE`, `DUNGEON_MAP`, `LOOT_DROP`, `INVENTORY_SYNC`, `QUEST_UPDATE`, `CHAT_MESSAGE`, `WORLD_READY`.

`protocol.json` in `packages/shared/` is the single source of truth for opcodes — both client and server tests assert their `Opcode` enums match it.

---

## Client ECS

### Components

| Component | Data |
|-----------|------|
| Position | x, y, z, rotation; remote interpolation targets |
| Movement | Current tile, target tile, progress, queued direction, A* path |
| Renderable | PixiJS `Container`, mesh type, skin/hair/body colours |
| Identity | Name, entity type, isLocal flag |
| Stats | HP, mana, stamina, STR/DEX/INT, level |
| Combat | Weapon type, auto-attack state, target, in-combat timer |

### Systems

| System | Runs | Responsibility |
|--------|------|---------------|
| MovementSystem | Every frame | Tile-to-tile interpolation, A* path following |
| InterpolationSystem | Every frame | Smooth remote entity position lerp |
| AnimationSystem | Every frame | Walk bob, idle breathe, damage flash |

Remote entities interpolate toward `remoteTargetX/Z` at `LERP_SPEED * dt` rather than snapping.

### Isometric Projection

```
screenX = (worldX - worldZ) * 32
screenY = (worldX + worldZ) * 16 - elevation * 16
```

WASD maps to compass directions: W=North, S=South, A=West, D=East.

---

## Testing

```bash
# Server
cd packages/server && bunx vitest run

# Client
cd packages/client && bunx vitest run

# Watch mode
cd packages/server && bunx vitest
cd packages/client && bunx vitest
```

### Coverage

| Package | Tests | Notes |
|---------|-------|-------|
| Server | 468 | All passing |
| Client ECS | 108 | All passing |
| Client audio | 350/371 | 21 pre-existing Tone.js mock failures |

Server coverage excludes only boot infrastructure (`index.ts`, `postgres.ts`, `redis.ts`). All game logic, routes, and WebRTC signaling are covered. Client percentages exclude untestable modules (PixiJS rendering, WebRTC networking, DOM UI screens).

### Cross-Package Contract Tests

Both packages assert their `Opcode` values match `shared/protocol.json` and that `hashCode()` produces identical `u32` mappings — ensuring binary position packets stay decodable when either side changes.

---

## Dev Tools

### Playwright API (`window.__game`)

Available in dev mode only. Exposed by `PlaywrightAPI.ts`.

```javascript
// Query
__game.getPlayerPosition()         // { x, y, z }
__game.getEntityList()             // [{ id, name, type, x, z, hp, maxHp }]
__game.getPlayerStats()            // { hp, maxHp, level, xp }
__game.isConnected()               // boolean

// Actions
__game.move("w")                   // Move one tile north (w/a/s/d = N/W/S/E)
__game.selectTarget("npc-id")
__game.toggleAutoAttack("npc-id")

// Async utilities
await __game.waitForEntity("id")
await __game.waitForHp("id", 5, "lt", 10000)
await __game.waitForCombatState(true)
```

Login credentials for automated tests: username `lukeocodes`, password blank.

### WebRTC Check

The client detects restricted browsers (ungoogled Chromium) at page load and shows a warning toast before the user attempts to connect.

---

## Key Constants

| Constant | Value | Where |
|----------|-------|-------|
| Map size | 256×256 tiles | Tiled maps |
| Chunk size | 32×32 tiles | `shared/constants.json` |
| Chunk load radius | 3 chunks (96×96 tiles visible) | client |
| Entity load radius | 32 tiles | server spatial grid |
| Server tick rate | 20Hz | `world.ts` |
| Client tick rate | 20Hz | `Loop.ts` |
| Position send rate | 15Hz | `NetworkManager.ts` |
| Position packet size | 20 bytes per entity | `protocol.ts` |
| Safe zone radius | 8 tiles (around world origin) | `zones.ts` |
| Linger duration | 2 minutes (outside safe zone) | `linger.ts` |
| NPC aggro radius | 8 tiles | `npcs.ts` |
| Enemy detection | 16 tiles (hysteresis clear at 22) | `world.ts` |
| Progress save interval | 30 seconds | `world.ts` |
| DataChannel stale drop | 200ms | `rtc.ts` |
