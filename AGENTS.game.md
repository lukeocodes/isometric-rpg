# 16Bit Online — Game Development State

Read this file at the start of each conversation. Update after significant work.

## Current state (2026-04-19)

Top-down Pokemon-style RPG. Excalibur v0.30 + plugin-tiled. Server auth with Fastify + Drizzle. WebRTC for gameplay traffic. Mana Seed art (Seliel the Shaper).

**Map system:** Two ways to author maps:
1. **Data-driven painter** (`tools/paint-map/`): Scene specs in `maps-src/*.json` → painter emits TMX (for client rendering) + JSON (for server collision/spawn logic).
2. **In-game world builder** (`packages/client/builder.html`): Walk around, open an HTML tile picker, click to place / pickup / rotate / erase tiles live. Stored in DB (`user_maps` + `user_map_tiles`) and can be frozen to TMX + JSON via `bun tools/freeze-map.ts <numericId | zoneId | all>`.

**Current playable map:** `starter-area` (48×32, human-meadows zone). Grass base, dark-grass patches, cobblestone path, dirt clearing, small water pond, forest border.

## World builder (2026-04-19)

Separate Vite entry at `/builder.html`. Uses the same WebRTC connection as the game but signals the server via `{builder: true}` on the `/api/rtc/offer` body so the session is flagged `isBuilder`. Builder sessions land in the "heaven" zone (numericId 500, `heaven.tmx` — an empty grass map) by default and cannot be entered by regular game clients.

### Commands (in-game)
- `B` — toggle tile picker (HTML modal with search + categories + animated previews). Picking a tile auto-closes the modal.
- `E` — toggle erase mode. In erase mode, clicks delete the topmost tile at that cell across all layers.
- `R` — rotate the currently-selected tile in place (or rotate brush if nothing is selected).
- `Delete` / `Backspace` — remove the currently-selected tile.
- `/` — open command bar. Commands: `/newmap W H [name]`, `/goto <id|heaven>`, `/maps`, `/layer <ground|decor|walls|canopy>`, `/help`
- `Esc` — clear selection > clear brush > close picker (in that priority order).
- **Click on an empty cell with a brush** → place the brush tile.
- **Click on a placed tile (no brush)** → select it in place (cyan highlight). Then `R` rotates that tile, `Delete` removes it, and clicking another cell MOVES the selected tile there (preserving rotation).
- **Click on a placed tile (with brush)** → overwrite with the brush.
- **Shift-click on a placed tile** → lift it into the brush (pickup-and-move workflow, destroys the original).

### Protocol (opcodes 200–210, all JSON on reliable channel)
- 200 `BUILDER_NEW_MAP` C→S `{ name, width, height }` — creates map, teleports creator
- 201 `BUILDER_PLACE_TILE` C→S `{ layer, x, y, tileset, tileId, rotation, flipH, flipV }`
- 202 `BUILDER_REMOVE_TILE` C→S `{ layer, x, y }`
- 203 `BUILDER_MAP_SNAPSHOT` S→C full overlay tile list (sent on join + zone change)
- 204 `BUILDER_TILE_PLACED` S→C broadcast to other builders in same zone
- 205 `BUILDER_TILE_REMOVED` S→C broadcast
- 206 `BUILDER_LIST_MAPS` C→S
- 207 `BUILDER_MAPS_LIST` S→C
- 208 `BUILDER_GOTO_MAP` C→S `{ numericId }` — teleport to heaven or a user map
- 209 `BUILDER_ERROR` S→C `{ reason }`

### Zone numeric IDs
- 1-99: hand-authored zones (human-meadows etc.)
- 100-199: Mana Seed test zones (keys 1-9)
- **500: heaven** (world-builder hub, in-memory overlay only, NOT persisted)
- **1000+: user-built maps** (persisted in `user_maps` + `user_map_tiles`)

### Files
- Server: `packages/server/src/game/user-maps.ts` (in-memory + DB layer), `packages/server/src/routes/rtc.ts` (`handleBuilderOp`, `broadcastBuilderEvent`, `sendBuilderSnapshot`)
- Client: `packages/client/src/builder/{main,BuilderScene,TileOverlay,TilePicker,TilesetIndex,BuilderHud}.ts`, `packages/client/builder.html`
- DB: `packages/server/src/db/schema.ts` (`userMaps`, `userMapTiles`)
- Freeze CLI: `tools/freeze-map.ts` — dumps DB map → `packages/client/public/maps/user-maps/<id>-<slug>.{tmx,json}`

### Rendering
- Heaven `.tmx` serves as the visual backdrop for ALL user maps (they reuse it until frozen). User-placed tiles render as one Excalibur Actor per cell on top (`TileOverlay`). Animated tiles use `Animation`, static use `Sprite`. Rotation via `actor.rotation`. Z layers: ground=10, decor=20, player=50, walls=60, canopy=200.

### Known limits (v1)
- `heaven` tile placements are in-memory only (not persisted across server restarts) — heaven IS the sandbox.
- Each user map reuses `heaven.tmx` as the backdrop, so a 20×14 user map shows heaven's 32×32 grass beyond its bounds. Visible "out of bounds" area will be dark. Freeze produces a correctly-sized TMX for that map.
- Tile picker modal shows `<AN>` badge for animated tiles. Animations play in the picker, brush preview, and on-map placement.
- No multi-tile brush, no fill bucket, no wang autotile. These are v2 features.

### Tile categories (`packages/client/src/builder/registry/`)
~16,000 tiles across ~120 TSX files, filtered into 20 categories. Every category is advertised in the picker sidebar even if empty; counts beside the label show tile availability.

| Category | Source packs | Notes |
|---|---|---|
| Terrain    | summer/autumn/spring/winter wang + home interior floors | includes 8-corner wang sets for all seasons |
| Forest     | summer/seasonal `forest.png` decor sheets, bridges, logs | default category for mixed-decor sheets |
| Trees      | summer/seasonal tree walls + canopies (autotile), standalone 80×112 trees | `blocks:true` on walls |
| Plants     | summer/seasonal `16x32` tall-plant sheets + `32x32` sub-regions | bushes, flowers, berries, lily pads |
| Crops      | Mana Seed Farming Crops #1 + #2 (A/B/C + A/B) + extras | ~580 tiles (growth stages + icons + signs) |
| Water      | summer/seasonal water sparkles + waterfalls | animated |
| Bridges    | `bonus bridge.tsx` | |
| Buildings  | 4 home-interior variants (thatch/timber/half-timber/stonework) | sub-regions carve out doors, windows, floors |
| Roofs      | thatch / timber / stonework sliceable packs (16×16 / 16×32 / 32×32 / 32×48 + posts + chimneys) | default layer: canopy |
| Doors      | home-interior sub-regions (rows 0-5 cols 22-27 + rows 8-11 cols 22-31) | |
| Windows    | home-interior sub-regions (rows 0-5 cols 28-31) | `blocks:true` |
| Furniture  | Cozy Furnishings pack (9 sheet variants) + dining tables | |
| Containers | sub-regions of Cozy 16×32 (barrels/sacks/baskets) + Cozy 32×32 (chests/trunks) + Village 32×32 (crates/urns/wood piles) | |
| Lights     | Animated Candles v01 (16×16 / 16×32 / 16×48) + Cozy anim fireplace/stove + cooking pot | 5-frame animations |
| Signs      | Village Accessories: wooden shop signs, cloth pendants, signposts, notice boards, laundry lines | |
| Characters | *(empty)* | reserved for NPC-spawn map-items (future) |
| Livestock  | *(empty)* | reserved for animated livestock map-items (future) |
| Effects    | Weather Effects: rain/snow/lightning/cloud cover/autotile snow | mostly canopy layer |
| Props      | summer 32×32 (rocks, misc), village 32×32 wells/wheels, misc 48×80 carts | catch-all for decor that isn't specifically plants/forest |
| Uncategorised | *(should always be 0)* | means every TSX has a category assignment |

### Registry files
- `packages/client/src/builder/registry/categories.ts` — 20 canonical categories (IDs immutable, display name + order + description)
- `packages/client/src/builder/registry/layers.ts` — 4 layers (ground / decor / walls / canopy). Layers no longer imply collision; use per-cell Blocks for that.
- `packages/client/src/builder/registry/tilesets.ts` — the big one. Groups: SUMMER, AUTUMN, SPRING, WINTER, SUMMER_WATERFALL, BUILDINGS, BRIDGES, MISC, FURNITURE, LIGHTS, CROPS, SIGNS, EFFECTS, ROOFS. Each `TilesetDef` has `id`, `file`, `name`, `category`, `defaultLayer`, optional `tags[]`, `blocks`, `hidden`, `subRegions[]`, `notes`.
- `packages/client/src/builder/registry/map-items.ts` — stubs for container/light/door/sign/npc-spawn (interactive entities, deferred).
- `packages/client/src/builder/registry/empty-tiles.json` — committed manifest of fully-transparent tile IDs per TSX. ~5,300 tiles across 50 sheets are skipped entirely at load (no `TileEntry` allocation). Sheets not in the manifest fall back to a one-off runtime pixel scan. Regenerate with `__builder.dumpEmptyTiles()` in the browser console after importing new packs; paste the clipboard output into this file.
- `packages/client/src/builder/registry/overrides.ts` — localStorage-backed per-tile metadata overrides. The picker detail pane's **Save**/**Delete**/**Revert** buttons update this; **Export overrides** dumps the full set as JSON for baking into `tilesets.ts` (typically as `SubRegion` entries). Precedence: `TilesetDef` → `SubRegion` → override.

### Asset layout
```
packages/client/public/maps/
├── <top-level summer TSX>.tsx            ← base packs + images in ../assets/tilesets/
├── test-zones/<zone>/*.tsx               ← seasonal + home interiors (image next to TSX)
├── furniture/<cozy sheet>.tsx            ← Cozy Furnishings
├── lights/<candles sheet>.tsx            ← Animated Candles
├── crops/<farming sheet>.tsx             ← Farming Crops 1+2
├── signs/<village sheet>.tsx             ← Village Accessories
├── effects/<weather sheet>.tsx           ← Weather Effects
├── roofs/<roof sheet>.tsx                ← home exterior sliceable packs
└── user-maps/<numericId>-<slug>.{tmx,json}  ← frozen user builds
```
Every TSX in these subfolders uses `<image source="images/<same name>.png"/>` — PNGs live in a sibling `images/` folder.

### Adding a new tileset
1. Drop `foo.png` in `packages/client/public/maps/<category>/images/foo.png` (cell size in filename: `foo 32x32.png`)
2. Run `bun tools/generate-tsx.ts` — emits `foo.tsx` with correct `tilecount`/`columns`. Animations via the `ANIM_SPECS` table in that tool.
3. Append a `TilesetDef` entry in `registry/tilesets.ts` with id/category/defaultLayer. Reload the builder; the TilesetIndex picks it up and populates the picker.

### Debug inspector
The one-off `packages/client/public/inspect.html` tool (temporary, not committed) renders any PNG at 4× scale with tile-id overlay — invaluable for identifying `subRegions` ranges when carving a mixed sheet. Rebuild it from the generator script if you need to re-inspect.

**Debug teleport keys (1-9):** Press 1-9 to teleport to a Mana Seed sample map for art preview. Server-validated ZONE_CHANGE_REQUEST with `{ targetZoneId }`. See `tools/import-test-zones.ts` + `packages/server/src/game/zone-registry.ts` for the zone table.

| Key | Zone | Notes |
|-----|------|-------|
| 1 | Summer Forest sample | 32×32 |
| 2 | Summer Waterfall demo | 22×13 |
| 3 | Spring Forest sample | 32×32 |
| 4 | Autumn Forest sample | 32×32 |
| 5 | Winter Forest sample | 32×32 |
| 6 | Thatch Roof Home | 15×14 |
| 7 | Timber Roof Home | 15×14 |
| 8 | Half-Timber Home | 15×14 |
| 9 | Stonework Home | 15×14 |

Test zones are walk-anywhere (no collision layer). They have no NPCs / items / exits. Use them purely to inspect art at different seasons + interior tilesets.

## Paint-map workflow (do not hand-edit TMX)

```bash
# Edit the scene
vim maps-src/starter-area.json

# Re-run the painter
bun tools/paint-map/index.ts maps-src/starter-area.json

# Outputs:
#   packages/client/public/maps/starter-area.tmx  (client render)
#   packages/client/public/maps/starter-area.json (server bounds+collision+spawn)

# Restart server to pick up new JSON:
pkill -f "node.*src/index.ts" && \
  (cd packages/server && nohup node --import tsx src/index.ts > /tmp/server.log 2>&1 &)
```

Preview without running the game:
```bash
/Applications/Tiled.app/Contents/MacOS/tmxrasterizer --scale 2 --no-smoothing \
  packages/client/public/maps/starter-area.tmx /tmp/preview.png
```

### Importing test zones from Mana Seed sample maps

```bash
bun tools/import-test-zones.ts
```

Reads `assets/20.xxx/sample map/*.tmx`, copies TMX + referenced TSX files + image PNGs into `packages/client/public/maps/test-zones/<slug>/` as a self-contained bundle. Also emits a minimal `map.json` (all-walkable, centre spawn) for server-side bounds. Run this if you edit the zone list in `zone-registry.ts` or update the source samples.

### Painter architecture
- `tsx.ts` — TSX parser (extracts tileset metadata + wangsets; zero-dep regex)
- `wang.ts` — corner-fill algorithm; maps (wangid[8] corner colours) → tileid lookups
- `tree-wall.ts` — positional autotile for 128×128 tree-wall tiles (+ small-tile collision mask)
- `tmx.ts` — TMX XML writer
- `server-json.ts` — server-format Tiled JSON writer; auto-marks water as collision
- `scene.ts` — types for the JSON scene spec
- `index.ts` — CLI orchestrator

### Scene spec gotchas
- `wangset` string must match the TSX wangset name **exactly**, including punctuation.
  Example: `"wang terrains (won't work with non-wang terrains)"`
- Wang colour names (e.g. `"light grass"`, `"deep water"`) are case/space sensitive.
- Regions apply in order — later regions overwrite earlier corners.
- Tree-wall `rect` is in **large-tile units** (128×128), not small tiles.
- Map dimensions should be divisible by 8 if using tree walls (so large-tile grid aligns).

### Adding new terrain colours
The wang tileset (`summer forest wang tiles.tsx`) ships with 6 colours:
dirt, light grass, dark grass, cobblestone, shallow water, deep water.
To add more, define them in Tiled's Wang Set editor and save the TSX, then
re-run the painter.

### Adding collision terrains
The `server-json.ts` auto-marks tiles as collision when all 4 corners match
a name in `collisionColorKeywords` (default: `["water"]`). To block more
terrains, pass extra keywords in `buildServerJson` params (currently hardcoded).

## Client architecture

- `src/scenes/GameScene.ts` — loads TMX via `TiledResource`, spawns player
- `src/actors/PlayerActor.ts` — local player, NPC sprite, 4-dir walk
- `src/actors/RemotePlayerActor.ts` — stub, needs sprite + nameplate
- `src/net/NetworkManager.ts` — WebRTC; `handlePositionUpdate()` is stubbed
- `src/main.ts` — dev-login as "lukeocodes", starts engine
- `src/tile.ts` — TILE=16, CHAR_W=16, CHAR_H=32

Collision check: `isPassable(worldX, worldY)` queries `wall` layer (invisible
16×16 collision grid) via `tiledMap.getTileByPoint`.

The old client at `packages/client-old/` is reference material. Delete once
parity is reached.

## Server architecture

- `src/world/tiled-map.ts` — parses the server JSON (not TMX). Reads ground,
  collision, objects. Walkability derived from collision layer.
- `src/game/zone-registry.ts` — maps zone IDs to JSON filenames.
- `src/routes/rtc.ts` — WebRTC signaling + DataChannel handlers.

Server runs from `packages/server`:
```bash
node --import tsx src/index.ts   # no --watch to avoid duplicate processes
```

## Known issues

1. **WebRTC DataChannel timeout in Playwright Chromium** — pre-existing. Real
   browsers connect fine. Do not use Playwright for live gameplay testing.
2. **No NPC spawn points in new map** — the painter only emits the player
   spawn. Server JSON schema supports NPC spawns but the painter doesn't yet.
3. **Mana Seed tree-wall tiles have transparent lower halves** — visually
   correct per the art but means the "canvas" below the bottom tree row shows
   grass. Collision layer covers the full 128×128 footprint regardless.

## Blockers to "fully playable"

In rough order:

1. Port binary position-update decoder (`handlePositionUpdate` currently stub)
2. Wire TMX `player-spawn` object via `entityClassNameFactories` (remove hardcoded 20,15)
3. Wire TMX `camera` object via `entityClassNameFactories`
4. Add NPC spawn objects to the scene spec schema + painter
5. Port `RemotePlayerActor` from `client-old` (sprite, nameplate, interpolation)
6. Port combat visuals (damage numbers, HP bars, attack swings)
7. UI: HP bar, inventory, chat, dialog — all missing from new client

## DB-migration plan: move all data out of code (2026-04-21)

**Rule** (see AGENTS.md "Data in the Database"): only logic and image data live outside the DB. Everything else — categorizations, tile metadata, NPC stats, quests, items, zones — must be DB-backed so authors can edit live and two devs never race on a `tilesets.ts` diff.

Survey complete (grep+glob; no file reads over 50 lines). **Nine high/medium-priority files + one JSON manifest + one localStorage key need to migrate.** Priority-ordered:

### Phase 1 — Builder metadata ✅ COMPLETE (2026-04-21)
| # | Old code/storage | DB table | Rows | Status |
|---|---|---|---|---|
| 1 | localStorage `builder.tile.overrides` | `tile_overrides` (PK: `tileset_file, tile_id`) | 0 (grows with authoring) | ✅ POST `/api/builder/overrides`, GET in registry bootstrap |
| 2 | `registry/tilesets.ts` (777 lines) | `tilesets` + `tileset_sub_regions` | 118 + 159 sub-regions | ✅ structural ingested from TSX; metadata writable via `tile_overrides` |
| 3 | `registry/categories.ts` | `tile_categories` | 20 | ✅ |
| 4 | `registry/layers.ts` | `map_layers` | 4 | ✅ |
| 5 | `registry/empty-tiles.json` | `tile_empty_flags` | 5,276 | ✅ JSON file deleted |
| 6 | TSX `<animation>` parsed in client | `tile_animations` | 732 frames | ✅ ingested by seed |

**Implementation notes:**
- Schema in `packages/server/src/db/schema.ts` (lines below `character_inventory`).
- Seed: `tools/seed-tile-registry.ts` reads `registry/*.ts` + `empty-tiles.json` + parses each TSX → upserts into DB. Idempotent. Run with `DATABASE_URL=… bun tools/seed-tile-registry.ts`.
- Server endpoints in `packages/server/src/routes/builder-registry.ts`:
  - `GET /api/builder/registry` — full bootstrap (categories + layers + tilesets + sub-regions + empty-flags + animations + overrides) in one fetch.
  - `POST /api/builder/overrides` — upsert (or auto-clear if all fields null).
  - `DELETE /api/builder/overrides/:file/:id` — clear.
  - `GET /api/builder/overrides` — list (debug).
- Client `registry/store.ts` is the single read API; `registry/{categories,layers,tilesets,overrides}.ts` are now types-only + re-exports from `store`.
- `TilesetIndex.doLoad()` calls `loadRegistry()` first, then fetches PNGs via `def.imageUrl` directly (no more TSX parsing on the client). Empty tiles + animations come straight from the DB.
- The legacy `__builder.dumpEmptyTiles()` is gone (replaced by the seed pass).
- Two builders editing metadata still need a page reload to see each other's edits — Phase 1b adds WebRTC broadcast for live updates.

### Phase 2 — Gameplay data ✅ COMPLETE (2026-04-21)
| # | Old code | DB table(s) | Rows | Status |
|---|---|---|---|---|
| 6 | `game/npc-templates.ts` (`NPC_TEMPLATES` record + composition) | `npc_templates` (flat; inheritance resolved at seed time) | 10 | ✅ Phase 2a |
| 7 | `game/items.ts` (`ITEMS` + `LOOT_TABLES`) | `item_templates` + `loot_entries` | 17 + 27 | ✅ Phase 2b |
| 8 | `game/quests.ts` (`QUESTS`) | `quests` + `quest_objectives` + `quest_rewards` | 5 + 5 + 5 | ✅ Phase 2b |
| 9 | `game/zone-registry.ts` (`registerZone` calls + `TEST_ZONES` array) | `zones` (exits stored as jsonb) | 10 | ✅ Phase 2b |
| 10 | `shared/world-config.json` | — | — | ✅ deleted (dead code; unused at runtime) |

**Phase 2a (NPC templates) notes:**
- Schema: `npc_templates` (25 columns, flat). Group inheritance (`WILDLIFE_BASE`/`MONSTER_BASE`/`INTERACTIVE_BASE` + per-group colour bases) happens in the seed script at migration time, then writes fully-resolved rows. Keeps SQL simple; re-run seed to rematerialise group-wide changes.
- Seed: `tools/seed-npc-templates.ts` — self-contained, owns the hand-coded data (~150 lines). Migration tooling, not runtime.
- Runtime `game/npc-templates.ts` is types + `rollStat` algorithm + mutable cache populated by `loadNpcTemplates()` at boot.
- Tests use `_setNpcTemplatesForTest(fixtures)` escape hatch.

**Phase 2b (items / quests / zones / world-config) notes:**
- Schemas: `item_templates` (18 cols), `loot_entries` (FK to `npc_templates` + `item_templates`, cascade), `quests`/`quest_objectives`/`quest_rewards` (cascade), `zones` (`numeric_id` unique, `exits` as jsonb, `test_slot` for the 1-9 keybind).
- Seeds: `tools/seed-items.ts`, `tools/seed-quests.ts`, `tools/seed-zones.ts` — each self-contained with its own hard-coded data for the one-time migration.
- Runtime files (`items.ts`, `quests.ts`, `zone-registry.ts`) follow the same pattern as NPC templates: types + algorithms + mutable cache populated at boot by `loadItems`/`loadLootTables`/`loadQuests`/`loadStaticZones`. Getters stay synchronous.
- Quest per-player progress (objective counts, completion state) stays in memory — that's runtime state, not authorable data.
- Zone registry still exposes `registerZone()` — used by `loadAllUserMaps()` at boot to add user-authored maps to the same in-memory lookup. Static zones come from DB first, then user maps.
- `shared/world-config.json` was never imported at runtime (grepping the repo confirms this); the server already reads `WORLD_SEED` from env with default `"42"`, and client-old is the only consumer of the other fields. Deleted the file rather than migrate to a `worlds` table.
- Boot order (`index.ts`): `connectRedis` → `loadStaticZones` → `loadAllUserMaps` → map loaders → `loadNpcTemplates` → `loadItems` → `loadLootTables` → `loadQuests` → `spawnInitialNpcs` → game loop.

**Phase 2c (map-items stub + disk-walking ingest + dead-code cleanup) notes (2026-04-21):**
- `map_item_types` table added. `registry/map-items.ts` now types + re-exports from `store.ts`; server `GET /api/builder/registry` returns `mapItemTypes`. Seeds 7 stubs (container/light/door/sign/npc-spawn/teleporter/crop-plot) via `tools/seed-map-items.ts`. All `implemented: false` — each becomes `true` as the runtime lands.
- **`tools/ingest-tilesets.ts` replaces `tools/seed-tile-registry.ts`**: walks `packages/client/public/maps/**/*.tsx`, parses each TSX manifest, scans PNG alpha via `sharp` for empty cells, and UPSERTs into `tilesets` + `tile_animations` + `tile_empty_flags`. Preserves builder-authored metadata columns (`default_category_id`, `default_layer_id`, `default_blocks`, `tags`, `seasonal`, `hidden`, `auto_hide_labels`, `notes`) via `COALESCE(tilesets.col, EXCLUDED.col)` on conflict. New tilesets default to `category='uncategorised'`, `defaultLayer='ground'`. TSX files whose PNG is missing on disk are skipped (e.g. Tiled debug `collision & alpha.tsx` helpers).
- **Workflow for adding a new asset pack**: drop PNG(s) + TSX into `packages/client/public/maps/<category>/` → run `bun tools/ingest-tilesets.ts` → DB updated → reload builder → categorize uncategorised tiles via the picker detail pane (category dropdown / tags field / Save button persists to `tile_overrides`).
- **Workflow for cleaning up stale DB rows**: `bun tools/audit-transparent.ts` reports transparency-related inconsistencies (overrides pointing at fully-transparent tiles, sub-regions whose whole range is transparent, sub-regions that partially cover transparent tiles for info). Add `--fix` to delete the first two classes. Run it after `ingest-tilesets.ts` whenever PNG content changes.
- **Source-spritesheet viewer** added to picker detail pane: shows the full PNG at 1×/2×/4× zoom with a dashed cyan outline around the selected tile's source cell. Lets a reviewer see the tile in the sheet's original context when categorizing. Auto-scrolls the viewer to keep the highlight visible for large sheets.
- **Deleted**: `packages/client/src/sprites/catalog.ts` (511 lines, dead), `packages/client/src/sprites/tilesets.ts` (309 lines, dead), `tools/seed-tile-registry.ts` (replaced by ingest), `packages/client/src/sprites/` (empty dir).
- **Added packs** (2026-04-21 zips): Gentle Forest 3.0a ($0 palettes — 3 palette variants × 3 sheets = 9 TSX), Treasure Chests 1.2a (1 sheet, 30 tiles), Breakable Pots 1.1a (5 variants × 16 tiles = 80 tiles). All ingested as uncategorised; pending manual categorization.

**End state of the migration:** NO data in code. The only hard-coded gameplay data left in the repo lives in `tools/seed-*.ts` (one-time migration tooling) or `*.test.ts` fixtures (test-only). Runtime reads everything from the database; assets are added by dropping PNG/TSX onto disk and re-running ingest.

**Current DB totals (2026-04-21):** 20 tile categories · 4 layers · **151 tilesets** · ~230 sub-regions · 6,552 empty-tile flags · ~990 animation frames · 7 map-item types · 10 NPC templates · 17 items · 27 loot entries · 5 quests · 10 zones.

### Next: multi-tile stamps / templates (pending)
Once the data-migration is fully bedded in, revisit the Mana Seed `assets/**/sample map/*.tmx` files to extract **building stamps** (prefabs) — multi-tile layouts that can be placed as a single brush stroke. The world builder gains a "stamp" mode that pastes a whole thatch home / timber home / etc. as a 10×10 block of tiles + blocks + map-items, all persisted normally via existing `user_map_tiles` / `user_map_blocks`. Schema addition: `stamps` + `stamp_tiles` (or jsonb blob on `stamps`). Source: parse the TMX layers into JSON once at import, store in DB. See `AGENTS-CLIENT.md` for the builder architecture.

### Phase 3 — Design-later
| # | Current code | Target tables |
|---|---|---|
| 11 | (Future) XP curve constants in `experience.ts` | `level_progression` (level, xp_required, hp_per_level, mana_per_level, stamina_per_level) — only if designers want live tuning |
| 12 | (Future) `stamps` / `stamp_tiles` tables for TMX-derived building prefabs (see "Next" above) |

### Explicitly stays outside the DB
- **PNG files + TSX files** in `public/maps/` — raw-asset manifests. TSX gets **ingested** at boot (tilewidth/tileheight/columns/animations → `tilesets` + `tile_animations` tables) but stays on disk as upstream source-of-truth for structural data.
- `packages/shared/protocol.json`, `protocol.ts` REV arrays — wire-format opcodes, deployed with code.
- `packages/shared/constants.json` (CHUNK_SIZE, TILE_SIZE, tick rates) — engine-wide invariants, protocol-adjacent.
- `maps-src/*.json` — build-time scene specs, input to `tools/paint-map` compiler. Code-like.
- `tools/paint-map/*`, `tools/generate-map.ts`, `tools/freeze-map.ts` — algorithms.
- `packages/server/src/game/experience.ts` — XP formulas (algorithms).
- `localStorage['builder.picker.size']` — per-device UI state (picker zoom).

### Dead code deleted during migration (2026-04-21)
- ~~`packages/client/src/sprites/catalog.ts`~~ (511 lines) ✅ deleted
- ~~`packages/client/src/sprites/tilesets.ts`~~ (309 lines) ✅ deleted
- `packages/client-old/**` entire dir (legacy) — still present, defer until its components are re-ported

### Ingestion pass (new tool)
A `bun tools/ingest-tilesets.ts` script needs to:
1. Walk every TSX in `packages/client/public/maps/**/*.tsx`.
2. Parse `<tileset>` attrs + `<image>` attrs + `<tile id="N"><animation>...` → `tilesets` + `tile_animations`.
3. Decode the referenced PNG with `sharp` / `canvas` → detect fully-transparent cells → `tile_empty_flags`.
4. Idempotent upserts keyed on `tileset_file`.

Re-run this whenever new TSX is added. Replaces `__builder.dumpEmptyTiles()` + manual JSON paste.

### Implementation order
1. **Schema first** — draft all Phase-1 Drizzle migrations in one PR, run against dev DB, verify.
2. **Seed script** — `tools/migrate-registry-to-db.ts` reads the current `.ts` + `.json` files, writes rows into DB. One-shot, commit.
3. **Server endpoints** — HTTP `GET /api/builder/registry` + WebRTC `BUILDER_OVERRIDE_SET` / `BUILDER_OVERRIDE_CLEAR` opcodes that broadcast to other builders.
4. **Client refactor** — `TilesetIndex.load()` fetches from server; `overrides.ts` proxies to WebRTC. Keep type defs (`TilesetDef`, `CategoryDef`, `LayerDef`) in client code — those are type contracts, not data.
5. **Delete the source arrays** — after client fetches cleanly, remove `TILESETS/CATEGORIES/LAYERS` array literals and `empty-tiles.json`.
6. **Phase 2/3 follow** — NPC templates, items, quests, zones on the same pattern.

## Architecture rules

- **Server-authoritative** — never put game logic (combat, HP, spawning) in the client
- **No WebSocket** — all gameplay over WebRTC DataChannels; HTTP POST is only for signaling
- **Data-driven maps** — edit `maps-src/*.json`, run the painter. Never hand-edit TMX.
- **ECS pattern** — new features = new components + systems. Don't bloat `GameScene.ts`.
- **Clean up** — destroy PixiJS display objects, clear Maps/Sets on entity removal
- **Data in DB, not code** — see AGENTS.md "Data in the Database" and the DB-migration plan above. Only logic + PNGs outside the DB. Everything queryable is a table.
