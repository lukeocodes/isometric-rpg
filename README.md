# 16Bit Online

A Pokémon GameBoy-style **top-down 2D orthographic** multiplayer online RPG built with modern web technologies. Real-time multiplayer via WebRTC DataChannels, server-authoritative game logic, and hand-crafted Tiled maps painted with the Mana Seed tileset.

## Tech stack

| Layer | Technology | Purpose |
|-------|-----------|---------|
| Client engine | [Excalibur.js v0.30](https://excaliburjs.com/) | 2D top-down rendering |
| Tiled plugin | [`@excaliburjs/plugin-tiled`](https://github.com/excaliburjs/excalibur-tiled) | TMX map loading, tile layers, object layers |
| Client bundler | [Vite](https://vitejs.dev/) | HMR dev server, tree-shaking, chunked builds |
| Client runtime | [Bun](https://bun.sh/) | Package manager + Vite runner |
| Server framework | [Fastify](https://fastify.dev/) | REST API + HTTP signaling for WebRTC |
| Server runtime | [Node.js](https://nodejs.org/) + [tsx](https://github.com/privatenumber/tsx) | Required for `werift`'s UDP/DTLS stack (Bun unsupported) |
| WebRTC | [werift](https://github.com/shinyoshiaki/werift-webrtc) (server) + native (browser) | Unreliable DataChannels for positions, reliable for events |
| Database | [PostgreSQL 16](https://www.postgresql.org/) via [Drizzle ORM](https://orm.drizzle.team/) | Authoritative store for everything queryable — see `docs/data-policy.md` |
| Cache | [Redis 7](https://redis.io/) via [ioredis](https://github.com/redis/ioredis) | Chunk cache + ephemeral session state |
| Auth | OAuth2 PKCE (ATProto / `bsky.social`) + dev login | Game JWT for session tokens |
| Maps | [Tiled](https://www.mapeditor.org/) TMX + TSX format | Hand-crafted tile worlds; loaded by `plugin-tiled` |
| Art | [Mana Seed](https://seliel-the-shaper.itch.io/) (Seliel the Shaper) | Licensed retro sprite packs — characters, terrain, props |
| Audio | (design-only — see `AGENTS.audio.md`) | Tone.js + Web Audio blueprint for when audio lands |

## Architecture

```
┌──────────────────┐    HTTP POST      ┌─────────────────┐
│   Browser         │ ──── /offer ────► │    Fastify       │
│  (Excalibur v0.30)│ ◄─── SDP ──────── │    (Node + tsx)  │
│                   │                   │                   │
│  DataChannel      │ ◄── positions ─── │   Game loop       │
│  (unreliable)     │   20B/entity/tick │   (20Hz tick)    │
│                   │                   │                   │
│  DataChannel      │ ◄──── events ───► │   Combat / NPC    │
│  (reliable)       │  binary + JSON    │   systems         │
└──────────────────┘                   └────────┬──────────┘
                                                 │
                                      ┌──────────┴──────────┐
                                      │  PostgreSQL   Redis  │
                                      └──────────────────────┘
```

### Key design decisions

- **Server-authoritative** — all combat, NPC behaviour, HP, and state live server-side. The client is a pure rendering + input layer.
- **WebRTC over WebSocket** — position updates flow over unreliable/unordered DataChannels; lost packets drop rather than retransmit. `maxPacketLifeTime=200ms` prevents queue buildup.
- **HTTP signalling only** — a single `POST /api/rtc/offer` + `POST /api/rtc/answer` exchange replaces any persistent signalling connection.
- **Binary on hot paths, JSON on rare paths** — position packets + combat events + state broadcasts are binary; zone changes + chat + quests + spawn/despawn stay JSON. See `docs/binary-protocol.md`.
- **Data in the database, not in code** — only logic + PNG/TSX files outside the DB. Tile metadata, NPC templates, items, quests, zones — all DB-backed. See `docs/data-policy.md`. **Non-negotiable.**
- **Top-down 2D** — `x, y` world coordinates in pixels; `Actor.z` controls draw order per layer (ground=10, decor=20, player=50, walls=60, canopy=200).
- **Tiled maps, no procedural terrain in-game** — worlds are hand-painted by designers or emitted by `tools/paint-map/` from scene-spec JSON. `tools/ingest-tilesets.ts` parses TSX files into DB rows at build time.
- **Mana Seed sprites, no procedural characters** — characters are Mana Seed 32×32 animation frames on a 16×16 world tile grid (1 tile wide × 2 tiles tall). No runtime procedural sprite composition.

## Current state

Gameplay hasn't started yet. Focus is the **in-game world builder** (`packages/client/builder.html`). The sandbox zone is **heaven** (`numericId: 500`, in-memory, no persistence). Zones / NPCs / items / quests tables exist in the DB with **0 rows** — runtime loaders are wired up but load nothing. Seed scripts from the earlier hardcoded data were wiped along with the placeholder data; future gameplay will seed via admin UI or new tools.

Read `AGENTS.game.md` for the up-to-date status + known blockers.

## Project structure

```
16bit-online/
├── packages/
│   ├── client/                         # Excalibur.js TypeScript client (Vite)
│   │   ├── src/
│   │   │   ├── main.ts                 # Boot: dev login → Engine → GameScene
│   │   │   ├── tile.ts                 # TILE=16, CHAR_W=16, CHAR_H=32 constants
│   │   │   ├── actors/
│   │   │   │   ├── PlayerActor.ts      # Local player (Mana Seed 4-dir walk)
│   │   │   │   └── RemotePlayerActor.ts  # Interpolated remote players
│   │   │   ├── scenes/
│   │   │   │   └── GameScene.ts        # Gameplay scene — TMX load, input, zone change
│   │   │   ├── net/
│   │   │   │   └── NetworkManager.ts   # WebRTC signaling + DataChannels (NO WebSocket)
│   │   │   └── builder/                # World-builder scene (separate Vite entry)
│   │   │       ├── main.ts
│   │   │       ├── BuilderScene.ts
│   │   │       ├── BuilderHud.ts
│   │   │       ├── TilePicker.ts       # Tile library modal
│   │   │       ├── TileOverlay.ts      # Placed-tile actor
│   │   │       ├── BlockOverlay.ts     # Collision block rendering
│   │   │       ├── TilesetIndex.ts     # Loads DB registry + PNG SpriteSheets
│   │   │       └── registry/           # Type contracts + store.ts (single source of truth)
│   │   ├── public/
│   │   │   └── maps/                   # TMX + TSX + PNG assets (ingested into DB at build time)
│   │   ├── index.html                  # Game entry
│   │   └── builder.html                # Builder entry
│   │
│   ├── server/                         # Fastify TypeScript server
│   │   ├── src/
│   │   │   ├── index.ts                # Boot order (see docs/server-architecture.md)
│   │   │   ├── app.ts                  # Fastify factory + route registration
│   │   │   ├── config.ts               # Env vars with dev-safe defaults
│   │   │   ├── auth/                   # JWT + ATProto OAuth + auth middleware
│   │   │   ├── routes/                 # auth, characters, rtc, world, world-builder, builder-registry
│   │   │   ├── game/                   # Game loop, combat, entities, NPCs, quests, items, zones, user-maps, linger, protocol
│   │   │   ├── world/                  # Procedural terrain noise, biomes, regions, chunk generator/cache
│   │   │   ├── db/                     # schema.ts (Drizzle), postgres.ts, redis.ts
│   │   │   └── ws/                     # WebRTC connection manager
│   │   └── drizzle.config.ts
│   │
│   ├── shared/                         # Shared constants (JSON, no build step)
│   │   ├── constants.json              # CHUNK_SIZE, TILE_SIZE, tick rates, entity radii
│   │   └── protocol.json               # Opcode enum — client + server tests assert they match
│   │
│   └── client-old/                     # Dead reference code from the Babylon.js era
│                                       # Salvage source only; not compiled or served.
│
├── tools/
│   ├── ingest-tilesets.ts              # Walk public/maps/**/*.tsx → UPSERT DB rows
│   ├── audit-transparent.ts            # Report/fix stale overrides + all-empty sub-regions
│   ├── generate-tsx.ts                 # Build TSX files from PNGs named "foo WxH.png"
│   ├── freeze-map.ts                   # Dump DB user-map → TMX + JSON in public/maps/user-maps/
│   ├── generate-map.ts                 # Programmatic map generator (legacy)
│   ├── generate-starter-area.js        # Starter-area skeleton generator (legacy)
│   ├── import-test-zones.ts            # Import Mana Seed sample maps as test zones
│   └── paint-map/                      # Scene-spec → TMX + server JSON painter
│
├── docs/                               # Deep-dive documentation (indexed by AGENTS.*.md files)
├── assets/                             # Upstream Mana Seed raw packs (source, not served)
├── docker-compose.yml                  # PostgreSQL (5433) + Redis (6379)
├── AGENTS.md                           # Agent-facing rules (dev instructions + context hygiene)
└── AGENTS.*.md                         # Topic indexes: game, client, server, performance, testing, identity, audio
```

## Getting started

### Prerequisites

- [Bun](https://bun.sh/) — package manager + client dev runner
- [Node.js](https://nodejs.org/) 18+ — server runtime (`werift` needs Node's UDP stack)
- [Docker](https://www.docker.com/) — PostgreSQL + Redis

### Setup

```bash
# Install workspace dependencies
bun install

# Start PostgreSQL + Redis
docker compose up -d

# Push schema (first time or after schema changes)
cd packages/server
DATABASE_URL="postgresql://game:game_dev_password@localhost:5433/game" bunx drizzle-kit push

# Ingest tileset metadata from disk into the DB
cd ../..
DATABASE_URL="postgresql://game:game_dev_password@localhost:5433/game" bun tools/ingest-tilesets.ts

cp packages/server/.env.example packages/server/.env
```

### Running

Two terminals:

```bash
# Terminal 1 — server (auto-reload)
cd packages/server
node --watch --import tsx src/index.ts

# Terminal 2 — client (Vite HMR)
cd packages/client
bunx --bun vite
```

Open:
- **http://localhost:5173** — game client. `packages/client/src/main.ts` hard-codes the dev login as `lukeocodes` / `password` and auto-connects. To use a different username, edit `main.ts` (dev login accepts any username; password is ignored). A character must exist for that account or the boot will fail with "No character found — seed the database first".
- **http://localhost:5173/builder.html** — world builder (separate Vite entry; same dev-login flow).

> **Browser note:** ungoogled Chromium blocks WebRTC. Use regular Chrome, Firefox, or Safari.

### Docker services

| Service | Port | Credentials |
|---------|------|-------------|
| PostgreSQL | **5433** | `game` / `game_dev_password` / db `game` |
| Redis | 6379 | no auth |

Port 5433 avoids colliding with a local PostgreSQL on 5432.

## Game systems

Almost none are live yet — gameplay data is empty on purpose. The architecture exists; the data doesn't. See `AGENTS.game.md` for the working surface and `docs/` for the deep dives.

- **World builder** (live) — paint tiles live, draw collision blocks, persist to DB, freeze to TMX. See `docs/world-builder.md` + `docs/tile-library.md`.
- **Maps** — hand-crafted TMX files in `packages/client/public/maps/` loaded via `@excaliburjs/plugin-tiled`, or painted from scene-specs via `tools/paint-map/`. See `docs/paint-map.md`.
- **Test zones** — 9 debug teleport zones for art preview (press `1`-`9`). See `docs/test-zones.md`.
- **Combat / NPC AI** (code live, data empty) — server-authoritative auto-attack, wander, respawn, HP regen, enemy detection. Spawn-point system wired up but no spawn-points in DB.
- **Quests / items / loot** (code live, data empty) — types + algorithms + runtime caches exist; tables are empty.
- **Zone ownership / houses / guilds** (design-only) — see `AGENTS.identity.md` + `docs/identity-zones.md`.
- **Audio** (design-only) — see `AGENTS.audio.md` + `docs/audio.md`. Prior implementation in `packages/client-old/src/audio/` as salvage.

## Networking protocol

### Position channel (unreliable, unordered)

Batched binary — one message per tick per player:

```
[count: u16LE]  N × [entityIdHash: u32LE][x: f32LE][y: f32LE][z: f32LE][rotation: f32LE]
                     └──── 20 bytes per entity ────────────────────────────────────────┘
```

Entity IDs are hashed to `u32` via `hashEntityId()`; the client maintains `numericIdMap: Map<u32, string>` populated on entity spawn.

The `z` field is a **legacy holdover** from the original isometric architecture — the new client uses `x, y` only and ignores `z` on render. Wire + server code still carry it; cost is 4 B/entity + untouched code paths. Will be removed when the protocol gets its next breaking revision.

### Reliable channel (ordered)

Hot paths binary, rare paths JSON. Full table + "adding a new binary opcode" walkthrough in `docs/binary-protocol.md`.

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

JSON messages (rare, variable-length): `ENTITY_SPAWN`, `ENTITY_DESPAWN`, `ZONE_CHANGE`, `DUNGEON_MAP`, `LOOT_DROP`, `INVENTORY_SYNC`, `QUEST_UPDATE`, `CHAT_MESSAGE`, `WORLD_READY`, all `BUILDER_*` opcodes (200-213).

`packages/shared/protocol.json` is the single source of truth; `packages/server/src/shared-contract.test.ts` asserts the server's `Opcode` enum matches it.

## Performance

### Network bandwidth — ~3–8 KB/s per player in combat

- Position broadcast: 2 B header + 20 B × nearby-entity-count, at 15 Hz.
- Combat events use binary (12 B damage, 5 B death, 9 B state) — 75-90 % cheaper than JSON equivalents.
- Delta-only state broadcasts: `broadcastState()` tracks last-sent `{ hp, maxHp }` per entity per connection; sends nothing if unchanged.
- Stale-packet drop: `maxPacketLifeTime=200ms` on the unreliable channel drops packets older than 200 ms at the transport layer.

### Server tick budget — 50 ms per tick at 20 Hz

- **Entity sleep** — every entity with no player within 32 tiles skips combat, wander, and regen entirely. Awake set precomputed once per tick.
- **Zero-alloc iterators** — `EntityStore.iterNearbyEntities()` + `ConnectionManager.iterAll()` yield from pre-existing structures; no per-tick allocations.
- **Pre-allocated broadcast buffer** — `world.ts` owns one `Buffer`, grown only if rare entity spikes exceed 64 nearby.
- **Respawn queue** — one shared scheduler replaces per-NPC `setTimeout`, no timer-heap growth during mass fights.

### Memory

- **Sprite-based rendering** — Mana Seed PNGs loaded once per tileset and shared via Excalibur `SpriteSheet`. No procedural sprite generation, no per-entity `RenderTexture` cache.
- **Scroll-out cleanup** — decoration actors are `kill()`-ed when they leave the camera viewport; nothing grows unbounded with world size.
- **HP bar dirty flags** — redraw only when HP actually changes.
- **Delta cache sweep** — `lastBroadcastState` purges entries when entities despawn.

Full performance rules in `docs/performance-rules.md`.

## Testing

```bash
# Server unit tests (37 test files, Vitest)
cd packages/server
bunx vitest run              # one-shot
bunx vitest                  # watch mode
```

Client has no unit tests — integration testing is done via **Playwright MCP** against `window.__game` (gameplay) / `window.__builder` (builder) dev hooks. See `docs/testing-playwright.md` for login flow, combat loop, multi-tab patterns, and known constraints.

Server tests cover game logic, routes, auth, WebRTC signalling, chunk generation, terrain noise, regions, rivers, biomes, zones, quests, items, spawn points, linger, combat, and world-helpers. `shared-contract.test.ts` asserts cross-package opcode + constants alignment.

## Dev hooks

### `window.__game` (gameplay)

Exposed by `packages/client/src/main.ts`:

```javascript
window.__game    // the Excalibur Engine instance
```

Currently only the engine object is exposed; the `getPlayerPosition` / `move` / `selectTarget` / `toggleAutoAttack` API from the old client hasn't been re-ported. See `docs/testing-playwright.md` for the full aspirational API + current reality.

### `window.__builder` (builder)

Exposed by `packages/client/src/builder/main.ts`:

```javascript
window.__builder = { game, net, scene, tiles }
```

### WebRTC compatibility check

The client logs `[WebRTC]` warnings if the browser blocks UDP/DTLS — mainly an issue with ungoogled Chromium + some privacy browsers. Regular Chrome, Firefox, Safari work.

## Key constants

| Constant | Value | Where |
|----------|-------|-------|
| `TILE` (world px per tile) | 16 | `packages/client/src/tile.ts` |
| Character sprite size | 1 tile W × 2 tiles H (16×32 px) | `tile.ts` |
| Chunk size | 32×32 tiles | `packages/shared/constants.json` |
| Chunk load radius | 3 chunks | `constants.json` |
| Entity load radius | 32 tiles | server spatial grid |
| Server tick rate | 20 Hz | `game/world.ts` |
| Client tick rate | 20 Hz | Excalibur engine |
| Position send rate | 15 Hz | `NetworkManager` |
| Position packet per-entity size | 20 bytes | `game/protocol.ts` |
| DataChannel stale-packet drop | 200 ms | `routes/rtc.ts` |
| Max characters per account | 5 | `constants.json` |
| Max player speed | 5.0 tiles/s (server-authoritative) | `constants.json` |

## Git

- Conventional Commits.
- Never include `Co-Authored-By` footers.
- SSH auth via 1Password agent socket: `export SSH_AUTH_SOCK="$HOME/Library/Group Containers/2BUA8C4S2C.com.1password/t/agent.sock"` before `git push`.

## Further reading

Every agent-facing doc is indexed from `AGENTS.md`:

- `AGENTS.game.md` — current state + known issues + blockers.
- `AGENTS.client.md` — client runtime overview → `docs/client-architecture.md`.
- `AGENTS.server.md` — server runtime overview → `docs/server-architecture.md`.
- `AGENTS.performance.md` → `docs/performance-rules.md` + `docs/binary-protocol.md`.
- `AGENTS.testing.md` → `docs/testing-playwright.md`.
- `AGENTS.identity.md` → `docs/identity-zones.md` (design-only; ATProto + zone ownership + row signatures + mail).
- `AGENTS.audio.md` → `docs/audio.md` (design-only; Tone.js + Web Audio blueprint).

Supplemental (no AGENTS front door):

- `docs/data-policy.md` — "Data in the Database, NOT in Code" rule + rationale + workflows.
- `docs/world-builder.md` — in-game builder commands, opcodes 200-213, limits.
- `docs/tile-library.md` — 20-category taxonomy, multi-select + bulk-edit, adding a tileset.
- `docs/paint-map.md` — scene-spec painter workflow + architecture.
- `docs/test-zones.md` — debug teleport keys 1-9.
- `docs/history/db-migration-2026-04.md` — archived record of the code → DB migration (gameplay data later wiped).
