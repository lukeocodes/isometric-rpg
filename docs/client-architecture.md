# Client architecture

Bun + Vite for dev (`bunx --bun vite` on port 5173). Vite proxies `/api` to `http://localhost:8000`.

## Rendering engine — Excalibur.js v0.30

The client uses **[Excalibur.js](https://excaliburjs.com/) v0.30** for 2D top-down rendering. NOT PixiJS, NOT Babylon.js. All rendering types come from the `excalibur` package.

```typescript
import { Engine, Scene, Actor, Sprite, Animation, ImageSource, SpriteSheet, Vector, Color } from "excalibur";
```

Tiled maps are loaded via `@excaliburjs/plugin-tiled`.

### Key concepts

- **Engine** — the root (`main.ts` constructs one with `DisplayMode.FillScreen`, `pixelArt: true`, `antialiasing: false`). The builder entry uses a separate Engine.
- **Scene** — container for actors; switched via `game.goToScene(name)`. Two scenes today:
  - `GameScene` (`src/scenes/GameScene.ts`) — gameplay + combat.
  - `BuilderScene` (`src/builder/BuilderScene.ts`) — world builder.
- **Actor** — anything that draws + has position. `actor.graphics.use(sprite | animation)` attaches graphics; `actor.graphics.opacity` controls alpha (0-1).
- **z-index** — `actor.z` determines draw order within a scene. Layer z values come from the DB (`ground=10`, `decor=20`, `walls=60`, `canopy=200`); the player is at `PLAYER_Z=50` (constant in `src/builder/registry/layers.ts`), so decor + ground draw below and walls + canopy draw above.
- **Coordinate system** — top-down 2D orthographic. Actor `x` is world-space pixel X; Actor `y` is world-space pixel Y (south-increasing). `TILE=16` world px per tile (`src/tile.ts`). No `z` axis in the renderer.
- **Sprite / Animation** — constructed from a `SpriteSheet` via `TilesetIndex.makeGraphic(tileset, tileId)`.
- **Camera** — `scene.camera.strategy.lockToActor(player)` for follow.

## File map

- `src/main.ts` — boot: auth, create Engine, add scenes, start.
- `src/tile.ts` — `TILE_SIZE` constant + helpers.
- `src/scenes/GameScene.ts` — gameplay scene: TMX loading, player movement, combat render.
- `src/actors/PlayerActor.ts` — local player actor.
- `src/actors/RemotePlayerActor.ts` — interpolated remote players.
- `src/net/NetworkManager.ts` — WebRTC signalling + DataChannels (NO WebSocket).
- `src/builder/main.ts` — builder scene boot.
- `src/builder/BuilderScene.ts` — world builder scene (tile placement, block drawing, camera).
- `src/builder/BuilderHud.ts` — builder HUD overlays.
- `src/builder/TilePicker.ts` — the big tile library modal (categories, grid, metadata editor, multi-select, bulk edit, source-sheet viewer).
- `src/builder/TileOverlay.ts` — Excalibur Actor that owns every placed tile in the user map; draws ghosts + selection highlights.
- `src/builder/BlockOverlay.ts` — renders collision blocks (red tint in debug mode).
- `src/builder/TilesetIndex.ts` — loads DB registry + tileset PNGs + builds `SpriteSheet`s; `makeGraphic(tileset, tileId)` returns a ready `Sprite | Animation`.
- `src/builder/registry/` — type contracts + `store.ts` (fetches the registry from `/api/builder/registry` on boot).

`PixiApp.ts`, `IsoCamera.ts`, `EntityRenderer.ts`, `TerrainRenderer.ts`, `IsometricRenderer.ts`, `TiledMapRenderer.ts`, `StructureRenderer.ts`, `Router.ts`, `GameHUD.ts`, `Loop.ts`, `InputManager.ts`, `src/ecs/*`, `src/ui/*`, `src/engine/*`, `src/renderer/*`, `src/state/*`, `src/auth/*`, `src/dev/PlaywrightAPI.ts` — **none of these exist any more**. They were part of the old PixiJS/ECS architecture from the isometric 3D era. The current client is a flat set of directories (`actors/`, `builder/`, `net/`, `scenes/`) plus `main.ts` + `tile.ts`. Auth is handled server-side; dev login posts to `/api/auth/dev-login` directly from `main.ts`.

## Tiled map system

Maps are hand-crafted in Tiled (TMX files) or painted programmatically by `tools/paint-map/`. The Excalibur `plugin-tiled` loads TMX files and turns them into Excalibur layers + object layers (spawn points, safe zones) automatically. Tileset TSX files live in `packages/client/public/maps/<cat>/` and their PNG images in `packages/client/public/assets/tilesets/<cat>/`, both published by `tools/ingest-mana-seed.ts` (which also populates DB rows).

See [`docs/world-builder.md`](world-builder.md) for the in-game builder + [`docs/tile-library.md`](tile-library.md) for the tile picker + [`docs/paint-map.md`](paint-map.md) for the scene-spec painter.

## Adding an actor

```typescript
const actor = new Actor({ x, y, z: layerZ, rotation });
actor.graphics.use(tilesetIndex.makeGraphic(tileset, tileId)!);
scene.add(actor);
```

To make a tile fade when the player walks behind it: `actor.graphics.opacity = 0.5`.

## Adding UI screens

HTML + CSS + DOM event handlers (not an Excalibur UI kit). Example: `packages/client/builder.html` + `src/builder/TilePicker.ts` wires `<button>` / `<select>` / `<input>` refs directly. No router framework — screens are shown/hidden by toggling a root `<div>`'s visibility.

## Remote player interpolation

`RemotePlayerActor` (~29 lines) stores a target position from network updates and lerps toward it on Excalibur's `onPreUpdate` tick at 200 px/s. Currently a placeholder coloured square — sprite + nameplate + proper interpolation with numeric hash-map decoding are on the blocker list (see `AGENTS.game.md`).

## Dev hooks

- `window.__builder = { game, net, scene, tiles }` — exposed by `src/builder/main.ts` for Playwright / manual inspection.
- `window.__game = game` — the Excalibur `Engine` instance, exposed by `src/main.ts`. Note: the `getPlayerPosition` / `move` / `selectTarget` / `toggleAutoAttack` helper API from the old client has NOT been re-ported yet. See [`docs/testing-playwright.md`](testing-playwright.md).
