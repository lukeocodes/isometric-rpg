# Game state

Read this file at the start of each conversation. Update after significant work.

## Current state (2026-04-21)

Top-down Pokemon-style RPG. Excalibur.js v0.30 + `@excaliburjs/plugin-tiled`. Server auth via Fastify + Drizzle. WebRTC for gameplay traffic. Mana Seed art (Seliel the Shaper).

**Focus right now:** the world builder. Gameplay hasn't started — no NPCs, items, quests, or static zones yet.

**Two seeded maps at boot** (both live in `user_maps`; a new row type selects):

| zone_id          | numeric_id | type      | race    | size  | storage                                        |
| ---------------- | ---------- | --------- | ------- | ----- | ---------------------------------------------- |
| `heaven`         | `500` (const) | `heaven`  | null    | 32×32 | frozen `public/maps/500-heaven.tmx` on disk    |
| `starter-human`  | DB-assigned   | `starter` | `human` | 64×64 | DB-only (synth-on-fetch via `/api/maps/*.tmx`) |

`HEAVEN_NUMERIC_ID = 500` is the **only** hardcoded map id. Starters are assigned via `nextNumericId()` and located by `(type, race)` pair. Expand by adding races to `SEEDED_STARTER_RACES` in `packages/server/src/game/user-maps.ts`.

Both client entry points land on role-matched maps, coords computed from DB `width/height` (no literal `16,16` anywhere):

- `index.html` plays as the `Main` character (`characters.role = 'main'`) — spawns on the human starter.
- `builder.html` plays as the `Game Master` character (`characters.role = 'game-master'`) — spawns in heaven.

Both characters live on the dev `lukeocodes` account and are auto-seeded by `dev-login`. The starter-area + 9 test-zones maps and the old `zones` DB table are gone.

**Map delivery** — `GET /api/maps/:filename.tmx` is the unified endpoint (TMX only — TSX tilesets are Vite static at `/maps/<cat>/<slug>.tsx`). Disk wins: if `public/maps/<filename>.tmx` exists it's served (cache 60 s), else the server synthesizes TMX from `user_maps` + `user_map_tiles` via `src/game/tmx-render.ts` (cache `no-store`). Freeze with `bun tools/freeze-map.ts <numericId | zoneId | all>` to promote a DB map into a disk snapshot.

**Tileset library** — 1204 tilesets across 17 categories, published canonically by `bun tools/ingest-mana-seed.ts` from the `assets/` Mana Seed packs. TSX live at `public/maps/<cat>/<slug>.tsx`, PNG at `public/assets/tilesets/<cat>/<slug>.png`. See [`docs/tile-library.md`](docs/tile-library.md) for the ingest workflow and [`docs/data-policy.md`](docs/data-policy.md) for the "add a new asset pack" procedure.

**Gameplay data = empty on purpose.** All six gameplay-data tables (`npc_templates`, `item_templates`, `loot_entries`, `quests`, `quest_objectives`, `quest_rewards`) have **0 rows**. The runtime code is wired in and ready, but loads 0 rows at boot and nothing spawns. The old hardcoded placeholder data + the `tools/seed-*.ts` scripts + the static-`zones` table that populated them have all been wiped — when gameplay is designed, an admin UI or new CLI will populate the remaining tables. See [`docs/history/db-migration-2026-04.md`](docs/history/db-migration-2026-04.md) for the migration history.

**Map system — two ways to author maps:**

1. **In-game world builder** (`packages/client/builder.html`) — the current focus. Walk around heaven as `Game Master`, open the tile picker, click to place / pickup / rotate / erase tiles live. Stored in the DB (`user_maps` + `user_map_tiles`) and can be frozen to TMX + JSON via `bun tools/freeze-map.ts <numericId | zoneId | all>`. See [world builder](docs/world-builder.md).
2. **Data-driven painter** (`tools/paint-map/`) — legacy path, used to generate `heaven.json` originally. Scene specs in `maps-src/*.json` → painter emits TMX + server JSON. Hardly used now — heaven is hand-tweaked in Tiled and user maps go through the builder. See [paint-map workflow](docs/paint-map.md).

## Known issues

1. **WebRTC DataChannel timeout in Playwright Chromium** — pre-existing. Real browsers connect fine. Do not use Playwright for live gameplay testing.
2. **No NPC spawn points in heaven** — heaven is a pure building sandbox. Server JSON schema supports NPC spawns but heaven doesn't author any, and the painter doesn't emit them either.
3. **Mana Seed tree-wall tiles have transparent lower halves** — visually correct per the art but means the "canvas" below the bottom tree row shows grass. Collision layer covers the full 128×128 footprint regardless.

## What we're NOT doing yet

Gameplay systems exist as code but have **zero data**:

- **No NPCs.** `npc_templates` = 0 rows. `spawn-points` system wired up but nothing to spawn.
- **No items, loot, inventory.** `item_templates` = 0 rows, `loot_entries` = 0 rows.
- **No quests.** `quests` / `quest_objectives` / `quest_rewards` = 0 rows. Quest code + per-player progress tracking exist but nobody can accept anything.
- **No static zones.** The `zones` DB table was dropped. Only heaven (numericId 500) + per-race starters (`user_maps.type='starter'`) + user-built maps exist.
- **No gameplay scene.** `packages/client/src/scenes/GameScene.ts` exists and loads TMX, but the actual "you are playing the game" UX hasn't been built. Focus is the builder.

When gameplay is designed: populate the tables via an admin UI or a new CLI tool that writes straight to the DB (the original `tools/seed-<topic>.ts` scripts were deleted along with their placeholder data). The runtime caches (`NPC_TEMPLATES`, `ITEMS`, `QUESTS`, `zones` map) re-populate on boot.

## Blockers to "fully playable" (kept as roadmap)

In rough order, for when gameplay lands:

1. Port binary position-update decoder (`handlePositionUpdate` currently stub).
2. Wire TMX `player-spawn` object via `entityClassNameFactories` on the client (server-side spawn already computes from DB `width/height`).
3. Wire TMX `camera` object via `entityClassNameFactories`.
4. Add NPC spawn objects to the scene-spec schema + painter.
5. Port `RemotePlayerActor` from `client-old` (sprite, nameplate, interpolation).
6. Port combat visuals (damage numbers, HP bars, attack swings).
7. UI: HP bar, inventory, chat, dialog — all missing from the new client.
8. Seed initial NPC / item / quest data once designed.

## Supplemental docs

- [`docs/world-builder.md`](docs/world-builder.md) — Builder commands, protocol opcodes 200–213, rendering model, v1 limits.
- [`docs/tile-library.md`](docs/tile-library.md) — The 20-category taxonomy, multi-select + bulk edit, source-spritesheet viewer, workflow for adding a new tileset.
- [`docs/paint-map.md`](docs/paint-map.md) — Scene-spec painter workflow, painter architecture, scene-spec gotchas, adding wang terrains / collision.
- [`docs/data-policy.md`](docs/data-policy.md) — "Data in the Database, NOT in Code" rule + workflows.
- [`docs/history/db-migration-2026-04.md`](docs/history/db-migration-2026-04.md) — Completed migration record (Phase 1 + Phase 2), remaining Phase 1b / Phase 3 sketches.

## Forward-looking design (not yet implemented)

Design docs that will drive gameplay systems when they land. No code yet; these are the specs the eventual implementations follow.

- [`AGENTS.identity.md`](AGENTS.identity.md) + [`docs/identity-zones.md`](docs/identity-zones.md) — ATProto identity model (`player_ref` HMAC, DID never stored), zone taxonomy (server / procedural / player-owned / shared-guild), house deed item, row-level integrity signatures (`SERVER_SECRET + DID + player_ref`), tier-B deferred-countersign mail system. Replaces the current simplified OAuth stand-in.
- [`AGENTS.audio.md`](AGENTS.audio.md) + [`docs/audio.md`](docs/audio.md) — Tone.js + Web Audio audio stack, 4-bus gain architecture, music state machine (Exploring / Town / Dungeon / Enemy Nearby / Combat / Boss / Victory), acoustic occlusion (dry / room / hall / cave). Working implementation exists in `packages/client-old/src/audio/` as salvage for when audio lands in the new client.

## Architecture rules (recap — full rationale in `docs/data-policy.md` and AGENTS.md)

- **Server-authoritative** — never put game logic (combat, HP, spawning) in the client.
- **No WebSocket** — all gameplay over WebRTC DataChannels; HTTP POST is only for signalling.
- **Data-driven maps** — edit `maps-src/*.json`, run the painter. Never hand-edit TMX.
- **Clean up** — call `actor.kill()` on Excalibur actors, clear Maps/Sets on entity removal.
- **Data in the DB, not code** — only logic + PNGs outside the DB. Everything queryable is a table.
