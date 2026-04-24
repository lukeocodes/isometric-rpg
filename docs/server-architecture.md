# Server architecture

Node.js + tsx (not Bun — `werift` needs Node's UDP stack). Fastify on port 8000. PostgreSQL 16 on 5433 via Drizzle ORM. Redis 7 on 6379 via ioredis.

## Running

```bash
cd packages/server && node --watch --import tsx src/index.ts
```

Tests:

```bash
cd packages/server && bunx vitest run        # one-shot
cd packages/server && bunx vitest            # watch mode
```

## Boot order (`src/index.ts`)

```
buildApp()                  # Fastify factory + route registration
connectRedis()
  → loadAllUserMaps()       # user_maps → in-memory zone registry;
                            #   seeds heaven (numericId=500, type='heaven')
                            #   seeds per-race starters (type='starter', one row per race
                            #   in SEEDED_STARTER_RACES, grass-floored)
  → for each registered zone (skip `user:*`):
      loadZoneMap(zone.id, zone.mapFile)         # plugin-tiled JSON parse
      loadMapItems(zone.id, extractedItems)      # map-items from object layers
      loadDbItems(zone.id)                       # DB-authored world items
  → initWorldMap(worldSeed)  # deterministic biome / region / river gen (~100–500 ms)
  → cacheWorldMapToRedis()
  → loadNpcTemplates()       # npc_templates → in-memory cache (currently 0 rows)
  → loadItems()              # item_templates → in-memory cache (currently 0 rows)
  → loadLootTables()         # loot_entries  → in-memory cache (currently 0 rows)
  → loadQuests()             # quests / quest_objectives / quest_rewards → in-memory (currently 0 rows)
  → spawnInitialNpcs()       # seeds `entities` + `combat state` from spawn-points (currently 0)
  → startGameLoop()          # 20 Hz setInterval
  → app.listen(8000)
```

Registered zones right now: **heaven** (frozen TMX on disk) + one **`starter-<race>`** per seeded race (DB-only, synth-on-fetch). Every zone is a `user_maps` row; the `type` column distinguishes `heaven` / `starter` / `adventure`. The old static-`zones` DB table + `loadStaticZones()` were removed.

**Two independent map delivery paths:**

- **Client** fetches `GET /api/maps/<zoneId>.tmx` — the server prefers the disk snapshot (`public/maps/<zoneId>.tmx`) and falls back to synthesizing TMX from `user_maps` + `user_map_tiles`.
- **Server-side Tiled data** (walkability, `player-spawn` objects, mapItems) is parsed from `public/maps/<zoneId>.json` (Tiled JSON produced by `tools/paint-map`). Zones with no `<zoneId>.json` on disk are skipped at boot — their runtime walkability falls through to the procedural `isWalkable`, spawn coords come from `user_maps.(width, height)` via `centreOf`, and there are no per-zone spawn points.

All the `load*()` calls are synchronous-read-friendly after boot: each populates a module-level cache that every downstream getter reads without awaiting.

## File map

### Entry + framework

- `src/index.ts` — boot order (see above).
- `src/app.ts` — Fastify factory, CORS, route registration (all six route modules below), static-file fallback for built client.
- `src/config.ts` — env vars with dev-safe defaults (`.env` optional).

### Auth

- `src/auth/oauth.ts` — ATProto OAuth2 PKCE flow + userinfo fetch.
- `src/auth/jwt.ts` — game JWT issue / verify (HS256).
- `src/auth/middleware.ts` — `requireAuth` Fastify hook (bearer token → `request.account`).

### Routes

- `src/routes/auth.ts` — `POST /api/auth/dev-login`, OAuth callback exchange, JWT refresh.
- `src/routes/characters.ts` — character CRUD (stats total 30, 3 starting skills, name unique).
- `src/routes/rtc.ts` — `POST /api/rtc/offer` + `POST /api/rtc/answer` for WebRTC signalling, peer+DataChannel setup, linger tracking, per-connection message dispatch (including all 200-213 `BUILDER_*` opcodes).
- `src/routes/world.ts` — legacy procedural-terrain chunk stream endpoints (pre-plugin-tiled).
- `src/routes/world-builder.ts` — world-builder adjacency endpoints (map list, create, rename, etc. — complements the WebRTC builder ops).
- `src/routes/builder-registry.ts` — `GET /api/builder/registry` (full bootstrap bundle: categories + layers + tilesets + sub-regions + empty-tile flags + animations + tile overrides + map-item types) and `POST|DELETE /api/builder/overrides`.
- `src/routes/maps.ts` — `GET /api/maps/:filename.tmx` (unified map delivery: disk snapshot first via `public/maps/<filename>.tmx` with `cache-control: public, max-age=60`, else synth from DB via `renderMapTmx` with `cache-control: no-store`; 404 if neither).

### Game loop + simulation

- `src/game/world.ts` — 20 Hz game loop: wander → combat → `broadcastDamage` → `broadcastState` → `broadcastPositions` → `broadcastEnemyNearby`. Pre-allocated position buffer; delta-only HP broadcasts.
- `src/game/combat.ts` — auto-attack state machine, wind-up timer, damage resolution, retaliation, HP regen.
- `src/game/entities.ts` — `entityStore` with spatial grid and `isAwake()` sleep optimisation.
- `src/game/npcs.ts` — NPC spawn + respawn queue; respawn-on-timer.
- `src/game/npc-templates.ts` — types + `rollStat` algorithm + in-memory cache populated by `loadNpcTemplates()`.
- `src/game/spawn-points.ts` — spawn-point data model + activation / deactivation based on player proximity.
- `src/game/items.ts` — types + cache + `rollLoot` algorithm for items / loot tables.
- `src/game/inventory.ts` — player inventory store; pickup / drop / equip / unequip.
- `src/game/quests.ts` — types + cache + per-player quest progress (ephemeral runtime state).
- `src/game/experience.ts` — XP curve + level-up stat bonuses.
- `src/game/zone-registry.ts` — in-memory zone lookup; `registerZone()` helper (used by `loadAllUserMaps`).
- `src/game/zones.ts` — safe-zone radius helpers (still used for PvP-off enforcement even though no gameplay PvP exists yet).
- `src/game/dungeon.ts` — dungeon instance generation + boss tracking.
- `src/game/linger.ts` — 2-minute character linger on unsafe disconnect (client can reconnect to their already-in-combat character).
- `src/game/protocol.ts` — binary + JSON pack / unpack. Position (24 B single-entity or 20 B/entity batched), plus all binary combat / state / XP / respawn / enemy-nearby / zone-music opcodes. See [`binary-protocol.md`](binary-protocol.md).
- `src/game/user-maps.ts` — world-builder user-map storage: in-memory tile grid + DB persistence + snapshot serialization for `BUILDER_MAP_SNAPSHOT`. Also owns the heaven + starter seeding (`ensureHeavenRow`, `ensureStarterRowForRace`, `SEEDED_STARTER_RACES`) and spawn helpers (`getHeavenSpawn`, `getStarterSpawnForRace`, `getFirstStarterSpawn`, `centreOf`) that compute coords from each row's `width/height`.
- `src/game/tmx-render.ts` — renders a `user_maps` row + its `user_map_tiles` into a Tiled-compatible TMX string. Buckets tiles by `(layer, tileset)`, resolves firstgids from TSX headers, applies rotation / flip flags. Shared by the `/api/maps/:filename.tmx` synth path; `tools/freeze-map.ts` has a near-identical inline renderer (candidate for unification).
- `src/game/world-items.ts` — ground-spawned items (loot drops, map-item containers).

### Procedural world

- `src/world/constants.ts` — `CHUNK_SIZE`, world bounds.
- `src/world/types.ts` — shared types for continents, regions, biomes.
- `src/world/terrain-noise.ts` — stateless simplex noise utilities.
- `src/world/terrain.ts` — tile-level height + walkability queries.
- `src/world/biomes.ts` — biome classification from elevation + moisture + temperature.
- `src/world/continents.ts` — continent shape generation.
- `src/world/regions.ts` — Voronoi-ish region assignment + level ranges.
- `src/world/rivers.ts` — river tracing over terrain.
- `src/world/worldgen.ts` — orchestrates continents → regions → rivers → biomes.
- `src/world/chunk-generator.ts` — Float16 per-tile heights per chunk.
- `src/world/chunk-cache.ts` — Redis-backed chunk cache.
- `src/world/queries.ts` — `initWorldMap`, `cacheWorldMapToRedis`, `getWorldMap()`.
- `src/world/tiled-map.ts` — Tiled JSON loader; extracts walkability + spawn objects + map-items.

### Database + transport

- `src/db/schema.ts` — Drizzle table definitions (accounts, characters, zones, npc_templates, item_templates, loot_entries, quests + objectives + rewards, tilesets, tile_overrides, tile_animations, tile_empty_flags, tile_categories, map_layers, tileset_sub_regions, user_maps, user_map_tiles, user_map_blocks, map_item_types, etc.). Full taxonomy in [`data-policy.md`](data-policy.md).
- `src/db/postgres.ts` — Drizzle `postgres` client.
- `src/db/redis.ts` — ioredis client.
- `src/ws/connections.ts` — WebRTC peer + DataChannel manager; `connectionManager` singleton; `sendReliable` / `sendPosition` / `sendBinary` / `broadcastReliable` / `broadcastBinary` / `iterAll`.

### Tests

30+ `*.test.ts` files alongside source, plus `src/app.test.ts`, `src/config.test.ts`, `src/shared-contract.test.ts` (asserts opcodes + constants match `packages/shared/protocol.json`+`constants.json`).

## Adding NPCs

**Note: the data-seeding workflow needs designing.** The old `tools/seed-npc-templates.ts` was deleted when the initial placeholder data was wiped. Until an admin UI (or new CLI tool) lands, add NPC template rows with raw SQL or a one-off Drizzle insert script.

The schema:

```sql
INSERT INTO npc_templates (id, name, category, weapon_type, hp_base, hp_variance, ...)
VALUES ('skeleton-warrior', 'Skeleton Warrior', 'monster', 'melee', 40, 10, ...);
```

1. Insert the row(s).
2. Insert a spawn-point row pointing at the template id.
3. Restart the server — `loadNpcTemplates()` + `spawnInitialNpcs()` pick them up at boot.
4. Template fields + defaults are defined by `src/game/npc-templates.ts` (types) and `src/db/schema.ts` (columns).

## Adding a spawn point

Currently in the DB (`spawn_points` table); the old in-code `addSpawnPoint()` call from `spawn-points.ts` is still exported for tests but the production path is DB-row → `loadSpawnPoints()` at boot.

```sql
INSERT INTO spawn_points (id, x, z, zone_id, npc_ids, distance, max_count, frequency_s)
VALUES ('sp-unique-id', 10, 20, 'heaven',
        ARRAY['skeleton-warrior','skeleton-archer'], 8, 4, 5);
```

(Heaven + per-race starters are the only zones right now, so spawn points here only make sense for testing. Real zones return when gameplay lands.)

## Position broadcast format

Batched binary on the unreliable channel: `[count:u16LE]` then N × 20 bytes per entity — `[entityIdHash:u32LE][x:f32LE][y:f32LE][z:f32LE][rotation:f32LE]`.

Entity IDs are hashed to `u32` via `hashEntityId(str)`; the client maintains `numericIdMap` in `StateSync`.

The `z` field on the wire is a **legacy remnant** of the earlier isometric architecture. The top-down client uses `x, y` only and ignores `z` on render. Server simulation still carries a `z` field on every entity (zero-valued in practice). When the protocol gets its next breaking revision, `z` is a candidate for removal.

The single-entity variant (`packPosition` in `protocol.ts`) is 24 B and includes an opcode / flags / sequence header — used only for legacy code paths; `broadcastPositions` uses the batched 20-B-per-entity format.

For the full wire protocol including binary opcodes 32-82 and the "adding a new binary message" walkthrough, see [`binary-protocol.md`](binary-protocol.md).
