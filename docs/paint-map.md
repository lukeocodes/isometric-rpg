# Paint-map workflow

**Never hand-edit TMX.** Edit the scene spec JSON and re-run the painter. The painter emits both the TMX (for client rendering) and the server JSON (bounds + collision + spawn objects).

## Core workflow

The only active scene spec right now is `maps-src/heaven.json` (the 32×32 grass canvas used for the builder).

```bash
# Edit the scene
vim maps-src/heaven.json

# Re-run the painter
bun tools/paint-map/index.ts maps-src/heaven.json

# Outputs:
#   packages/client/public/maps/heaven.tmx  (client render)
#   packages/client/public/maps/heaven.json (server bounds + collision + spawn)

# Restart server to pick up new JSON:
pkill -f "node.*src/index.ts" && \
  (cd packages/server && nohup node --import tsx src/index.ts > /tmp/server.log 2>&1 &)
```

## Preview without running the game

```bash
/Applications/Tiled.app/Contents/MacOS/tmxrasterizer --scale 2 --no-smoothing \
  packages/client/public/maps/heaven.tmx /tmp/preview.png
```

## Painter architecture

- `tools/paint-map/tsx.ts` — TSX parser (extracts tileset metadata + wangsets; zero-dep regex).
- `tools/paint-map/wang.ts` — corner-fill algorithm; maps (wangid[8] corner colours) → tileid lookups.
- `tools/paint-map/tree-wall.ts` — positional autotile for 128×128 tree-wall tiles + small-tile collision mask.
- `tools/paint-map/tmx.ts` — TMX XML writer.
- `tools/paint-map/server-json.ts` — server-format Tiled JSON writer; auto-marks water as collision.
- `tools/paint-map/scene.ts` — types for the JSON scene spec.
- `tools/paint-map/index.ts` — CLI orchestrator.

## Scene spec gotchas

- `wangset` string must match the TSX wangset name **exactly**, including punctuation.  
  Example: `"wang terrains (won't work with non-wang terrains)"`
- Wang colour names (e.g. `"light grass"`, `"deep water"`) are case/space sensitive.
- Regions apply in order — later regions overwrite earlier corners.
- Tree-wall `rect` is in **large-tile units** (128×128), not small tiles.
- Map dimensions should be divisible by 8 if using tree walls (so the large-tile grid aligns).

## Adding new terrain colours

The wang tileset (`summer forest wang tiles.tsx`) ships with 6 colours: dirt, light grass, dark grass, cobblestone, shallow water, deep water. To add more, define them in Tiled's Wang Set editor, save the TSX, then re-run the painter.

## Adding collision terrains

`server-json.ts` auto-marks tiles as collision when all 4 corners match a name in `collisionColorKeywords` (default: `["water"]`). To block more terrains, pass extra keywords in `buildServerJson` params (currently hardcoded — add a CLI flag if this gets used more).
