# Client — index

Bun + Vite (port 5173). Excalibur.js v0.30 for rendering. `@excaliburjs/plugin-tiled` for TMX maps.

## Supplemental docs

- [`docs/client-architecture.md`](docs/client-architecture.md) — engine concepts, full file map, how to add an actor / UI screen, dev hooks.
- [`docs/world-builder.md`](docs/world-builder.md) — in-game world builder commands, protocol, limits.
- [`docs/tile-library.md`](docs/tile-library.md) — picker taxonomy, multi-select + bulk edit, source-sheet viewer, adding a tileset.
- [`docs/data-policy.md`](docs/data-policy.md) — client has no persistent data; all metadata is DB-backed.

## At-a-glance

- Engine: Excalibur `Engine` with `DisplayMode.FillScreen`, `pixelArt: true`, `antialiasing: false`. Two scenes: `GameScene`, `BuilderScene`.
- No JSON manifests, no `const FOO: Def[]` registries, no `localStorage.setItem` except per-device UI state (picker zoom, camera pos).
- `actor.graphics.use(sprite)` to attach graphics. `actor.graphics.opacity` for fade. `actor.z` for depth.
- `TilesetIndex.makeGraphic(tileset, tileId)` returns a ready `Sprite` or `Animation`.
- Tiled maps loaded via `@excaliburjs/plugin-tiled`. UI screens are HTML + DOM event handlers.
