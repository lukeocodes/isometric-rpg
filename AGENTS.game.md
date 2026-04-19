# 16Bit Online — Game Development State

Read this file at the start of each conversation. Update after significant work.

## Current state (2026-04-19)

Top-down Pokemon-style RPG. Excalibur v0.30 + plugin-tiled. Server auth with Fastify + Drizzle. WebRTC for gameplay traffic. Mana Seed art (Seliel the Shaper).

**Map system:** Data-driven via `tools/paint-map/`. Scene specs in `maps-src/*.json` → painter emits TMX (for client rendering) + JSON (for server collision/spawn logic).

**Current playable map:** `starter-area` (48×32, human-meadows zone). Grass base, dark-grass patches, cobblestone path, dirt clearing, small water pond, forest border.

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

## Architecture rules

- **Server-authoritative** — never put game logic (combat, HP, spawning) in the client
- **No WebSocket** — all gameplay over WebRTC DataChannels; HTTP POST is only for signaling
- **Data-driven maps** — edit `maps-src/*.json`, run the painter. Never hand-edit TMX.
- **ECS pattern** — new features = new components + systems. Don't bloat `GameScene.ts`.
- **Clean up** — destroy PixiJS display objects, clear Maps/Sets on entity removal
