# DB-migration — completed 2026-04-21

Historical record of the "move all data from code into the database" migration. The architectural rule now lives in `docs/data-policy.md`; this file is the receipt.

> **Update (later the same day):** The migrated gameplay data (10 NPC templates, 17 items, 27 loot entries, 5 quests + objectives + rewards, 10 zones) was **wiped** from the DB and the one-shot seed scripts below (`tools/seed-npc-templates.ts`, `tools/seed-items.ts`, `tools/seed-quests.ts`, `tools/seed-zones.ts`, `tools/seed-map-items.ts`) were deleted with it. The initial `tools/seed-tile-registry.ts` was already superseded by `tools/ingest-tilesets.ts` before this wipe. References to any `seed-*.ts` script below are kept for historical accuracy — **the files no longer exist**. The DB schemas + runtime cache loaders stay in place for when real gameplay is designed; an admin UI or a new CLI will populate them then. See `AGENTS.game.md` for current state.
>
> **Update (2026-04-21, heaven-only pass):** The `zones` DB table and `loadStaticZones()` were **dropped entirely** along with the starter-area + 9 test-zone Tiled maps, `tools/import-test-zones.ts`, `tools/generate-starter-area.js`, and the 1-9 teleport keybinds in the client. Heaven (`HEAVEN_NUMERIC_ID = 500`) is now the only zone — it lives in `user_maps` like any builder map. The `characters` table gained a `role` column (`'main'` | `'game-master'` | null) so `index.html` and `builder.html` can pick the right dev character from the same account. The `loadStaticZones` row in the table below is kept for historical accuracy but no longer exists in code.

## Phase 1 — Builder metadata ✅

| # | Old code/storage | DB table | Rows | Status |
|---|---|---|---|---|
| 1 | localStorage `builder.tile.overrides` | `tile_overrides` (PK: `tileset_file, tile_id`) | 0 (grows with authoring) | ✅ `POST /api/builder/overrides`, GET in registry bootstrap |
| 2 | `registry/tilesets.ts` (777 lines) | `tilesets` + `tileset_sub_regions` | 118 + 159 sub-regions | ✅ structural ingested from TSX; metadata writable via `tile_overrides` |
| 3 | `registry/categories.ts` | `tile_categories` | 20 | ✅ |
| 4 | `registry/layers.ts` | `map_layers` | 4 | ✅ |
| 5 | `registry/empty-tiles.json` | `tile_empty_flags` | 5,276 | ✅ JSON file deleted |
| 6 | TSX `<animation>` parsed in client | `tile_animations` | 732 frames | ✅ ingested by seed |

**Implementation notes:**
- Schema in `packages/server/src/db/schema.ts` (lines below `character_inventory`).
- Seed: `tools/seed-tile-registry.ts` (later replaced by `tools/ingest-tilesets.ts`).
- Server endpoints in `packages/server/src/routes/builder-registry.ts`:
  - `GET /api/builder/registry` — full bootstrap (categories + layers + tilesets + sub-regions + empty-flags + animations + overrides) in one fetch.
  - `POST /api/builder/overrides` — upsert (or auto-clear if all fields null).
  - `DELETE /api/builder/overrides/:file/:id` — clear.
  - `GET /api/builder/overrides` — list (debug).
- Client `registry/store.ts` is the single read API; `registry/{categories,layers,tilesets,overrides}.ts` are now types-only + re-exports from `store`.
- `TilesetIndex.doLoad()` calls `loadRegistry()` first, then fetches PNGs via `def.imageUrl` directly (no more TSX parsing on the client). Empty tiles + animations come straight from the DB.
- Two builders editing metadata still need a page reload to see each other's edits — live WebRTC broadcast is a Phase 1b follow-up.

## Phase 2 — Gameplay data ✅

| # | Old code | DB table(s) | Rows | Status |
|---|---|---|---|---|
| 6 | `game/npc-templates.ts` (`NPC_TEMPLATES` record + composition) | `npc_templates` (flat; inheritance resolved at seed time) | 10 | ✅ Phase 2a |
| 7 | `game/items.ts` (`ITEMS` + `LOOT_TABLES`) | `item_templates` + `loot_entries` | 17 + 27 | ✅ Phase 2b |
| 8 | `game/quests.ts` (`QUESTS`) | `quests` + `quest_objectives` + `quest_rewards` | 5 + 5 + 5 | ✅ Phase 2b |
| 9 | `game/zone-registry.ts` (`registerZone` calls + `TEST_ZONES` array) | `zones` (exits stored as jsonb) | 10 | ✅ Phase 2b |
| 10 | `shared/world-config.json` | — | — | ✅ deleted (dead code; unused at runtime) |

### Phase 2a — NPC templates

- Schema: `npc_templates` (25 columns, flat). Group inheritance (`WILDLIFE_BASE` / `MONSTER_BASE` / `INTERACTIVE_BASE` + per-group colour bases) happens in the seed script at migration time, then writes fully-resolved rows. Keeps SQL simple; re-run seed to rematerialise group-wide changes.
- Seed: `tools/seed-npc-templates.ts` — self-contained, owns the hand-coded data (~150 lines). Migration tooling, not runtime.
- Runtime `game/npc-templates.ts` is types + `rollStat` algorithm + mutable cache populated by `loadNpcTemplates()` at boot.
- Tests use `_setNpcTemplatesForTest(fixtures)` escape hatch.

### Phase 2b — Items / quests / zones / world-config

- Schemas: `item_templates` (18 cols), `loot_entries` (FK to `npc_templates` + `item_templates`, cascade), `quests`/`quest_objectives`/`quest_rewards` (cascade), `zones` (`numeric_id` unique, `exits` as jsonb, `test_slot` for the 1-9 keybind).
- Seeds: `tools/seed-items.ts`, `tools/seed-quests.ts`, `tools/seed-zones.ts` — each self-contained with its own hard-coded data for the one-time migration.
- Runtime files (`items.ts`, `quests.ts`, `zone-registry.ts`) follow the same pattern as NPC templates: types + algorithms + mutable cache populated at boot by `loadItems` / `loadLootTables` / `loadQuests` / `loadStaticZones` (the last one since removed). Getters stay synchronous.
- Quest per-player progress (objective counts, completion state) stays in memory — that's runtime state, not authorable data.
- Zone registry still exposes `registerZone()` — used by `loadAllUserMaps()` at boot to add user-authored maps to the same in-memory lookup. Static zones come from DB first, then user maps.
- `shared/world-config.json` was never imported at runtime (grepping the repo confirmed this); the server already reads `WORLD_SEED` from env with default `"42"`, and `client-old` is the only consumer of the other fields. Deleted the file rather than migrate to a `worlds` table.
- Boot order (`index.ts` at the time): `connectRedis` → `loadStaticZones` → `loadAllUserMaps` → map loaders → `loadNpcTemplates` → `loadItems` → `loadLootTables` → `loadQuests` → `spawnInitialNpcs` → game loop. (Current boot order — post heaven-only pass — has no `loadStaticZones`.)

### Phase 2c — Map-items stub + disk-walking ingest + dead-code cleanup

- `map_item_types` table added. `registry/map-items.ts` now types + re-exports from `store.ts`; server `GET /api/builder/registry` returns `mapItemTypes`. Seeds 7 stubs (container / light / door / sign / npc-spawn / teleporter / crop-plot) via `tools/seed-map-items.ts`. All `implemented: false` — each becomes `true` as the runtime lands.
- **`tools/ingest-tilesets.ts` replaces `tools/seed-tile-registry.ts`**: walks `packages/client/public/maps/**/*.tsx`, parses each TSX manifest, scans PNG alpha via `sharp` for empty cells, and UPSERTs into `tilesets` + `tile_animations` + `tile_empty_flags`. Preserves builder-authored metadata columns (`default_category_id`, `default_layer_id`, `default_blocks`, `tags`, `seasonal`, `hidden`, `auto_hide_labels`, `notes`) via `COALESCE(tilesets.col, EXCLUDED.col)` on conflict. New tilesets default to `category='uncategorised'`, `defaultLayer='ground'`. TSX files whose PNG is missing on disk are skipped (e.g. Tiled debug `collision & alpha.tsx` helpers).
- **Workflow for adding a new asset pack**: drop PNG(s) + TSX into `packages/client/public/maps/<category>/` → run `bun tools/ingest-tilesets.ts` → DB updated → reload builder → categorize uncategorised tiles via the picker detail pane.
- **Workflow for cleaning up stale DB rows**: `bun tools/audit-transparent.ts` reports transparency-related inconsistencies. Add `--fix` to delete dead overrides / sub-regions. Run after `ingest-tilesets.ts` whenever PNG content changes.
- **Source-spritesheet viewer** added to picker detail pane: shows the full PNG at 1×/2×/4× zoom with a dashed cyan outline around the selected tile's source cell.
- **Multi-select + bulk edit** added to picker: shift-click / ⌘-click / Cmd+A select multiple tiles; bulk-edit panel applies category / layer / blocks / hide / tags to all selected at once.
- **Deleted**: `packages/client/src/sprites/catalog.ts` (511 lines, dead), `packages/client/src/sprites/tilesets.ts` (309 lines, dead), `tools/seed-tile-registry.ts` (replaced by ingest).
- **Added packs** (2026-04-21 zips): Gentle Forest 3.0a ($0 palettes — 9 TSX), Treasure Chests 1.2a (30 tiles), Breakable Pots 1.1a (80 tiles). All ingested as uncategorised; pending manual categorization.

## End state

NO data in code. The only hard-coded gameplay data left in the repo lives in `tools/seed-*.ts` (one-time migration tooling) or `*.test.ts` fixtures (test-only). Runtime reads everything from the database; assets are added by dropping PNG/TSX onto disk and re-running ingest.

**Final DB totals (2026-04-21):** 20 tile categories · 4 layers · 151 tilesets · ~230 sub-regions · 6,552 empty-tile flags · ~990 animation frames · 7 map-item types · 10 NPC templates · 17 items · 27 loot entries · 5 quests · 10 zones.

## Still to come

### Phase 1b (Builder live-updates)

WebRTC `BUILDER_OVERRIDE_SET` / `BUILDER_OVERRIDE_CLEAR` opcodes so two builders see each other's metadata edits without a page reload.

### Phase 3 (design-later)

| # | Source | Target tables |
|---|---|---|
| 11 | XP curve constants in `experience.ts` | `level_progression` (level, xp_required, hp/mana/stamina per level) — only if designers want live tuning |
| 12 | `stamps` / `stamp_tiles` tables for TMX-derived building prefabs | Parse `assets/**/sample map/*.tmx` into reusable multi-tile brushes |

## Explicitly stays outside the DB

- **PNG + TSX files** in `public/maps/` — raw-asset manifests. TSX gets ingested into `tilesets` + `tile_animations` at boot but stays on disk as upstream source-of-truth.
- `packages/shared/protocol.json`, `protocol.ts` REV arrays — wire-format opcodes, deployed with code.
- `packages/shared/constants.json` (CHUNK_SIZE, TILE_SIZE, tick rates) — engine-wide invariants, protocol-adjacent.
- `maps-src/*.json` — build-time scene specs, input to `tools/paint-map` compiler.
- `tools/paint-map/*`, `tools/generate-map.ts`, `tools/freeze-map.ts` — algorithms.
- `packages/server/src/game/experience.ts` — XP formulas (algorithms).
- `localStorage['builder.picker.size']` — per-device UI state (picker zoom).
