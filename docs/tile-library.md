# Tile library

~16,000 tiles across ~150 TSX files, filtered into 20 categories. Every category is advertised in the picker sidebar even if empty; counts beside the label show tile availability.

## Categories

| Category | Source packs | Notes |
|---|---|---|
| Terrain | summer/autumn/spring/winter wang + home interior floors | includes 8-corner wang sets for all seasons |
| Forest | summer/seasonal `forest.png` decor sheets, bridges, logs | default category for mixed-decor sheets |
| Trees | summer/seasonal tree walls + canopies (autotile), standalone 80×112 trees | `blocks:true` on walls |
| Plants | summer/seasonal `16x32` tall-plant sheets + `32x32` sub-regions | bushes, flowers, berries, lily pads |
| Crops | Mana Seed Farming Crops #1 + #2 (A/B/C + A/B) + extras | ~580 tiles (growth stages + icons + signs) |
| Water | summer/seasonal water sparkles + waterfalls | animated |
| Bridges | `bonus bridge.tsx` | |
| Buildings | 4 home-interior variants (thatch/timber/half-timber/stonework) | sub-regions carve out doors, windows, floors |
| Roofs | thatch / timber / stonework sliceable packs (16×16 / 16×32 / 32×32 / 32×48 + posts + chimneys) | default layer: canopy |
| Doors | home-interior sub-regions (rows 0-5 cols 22-27 + rows 8-11 cols 22-31) | |
| Windows | home-interior sub-regions (rows 0-5 cols 28-31) | `blocks:true` |
| Furniture | Cozy Furnishings pack (9 sheet variants) + dining tables | |
| Containers | sub-regions of Cozy 16×32 (barrels/sacks/baskets) + Cozy 32×32 (chests/trunks) + Village 32×32 (crates/urns/wood piles) + Treasure Chests + Breakable Pots | |
| Lights | Animated Candles v01 (16×16 / 16×32 / 16×48) + Cozy anim fireplace/stove + cooking pot | 5-frame animations |
| Signs | Village Accessories: wooden shop signs, cloth pendants, signposts, notice boards, laundry lines | |
| Characters | *(empty)* | reserved for NPC-spawn map-items (future) |
| Livestock | *(empty)* | reserved for animated livestock map-items (future) |
| Effects | Weather Effects: rain/snow/lightning/cloud cover/autotile snow | mostly canopy layer |
| Props | summer 32×32 (rocks, misc), village 32×32 wells/wheels, misc 48×80 carts | catch-all for decor that isn't specifically plants/forest |
| Uncategorised | *(new packs land here)* | use the builder UI's bulk-edit to assign a real category |

## Multi-select + bulk edit

In the picker:

- **Plain click** — select one tile (single-detail pane).
- **⌘/Ctrl+click** — toggle selection of this tile.
- **Shift-click** — range select from the anchor to the current tile in the grid's filtered order.
- **⌘/Ctrl+A** — select every visible tile under the current filter.
- **Escape** with a selection clears it; a second Escape closes the picker.
- **Delete / Backspace** routes to single-delete (if 1 selected) or bulk-delete (2+).

When 2+ tiles are selected, the bulk-edit panel replaces the single-tile detail view. Category / Layer / Blocks / Hide dropdowns default to "(no change)"; only touched fields get written. Apply loops per-tile `POST /api/builder/overrides`. Delete All sets `hide=true` on every selected tile.

## Source-spritesheet viewer

Select any tile → the detail pane shows the full parent PNG at 1×/2×/4× zoom with a dashed cyan outline around the selected cell. Auto-scrolls for large sheets. Lets a reviewer see the tile in its original context when categorizing.

## Registry data

All tile metadata lives in the database. Runtime reads from `/api/builder/registry`. See `docs/data-policy.md` for the architecture and `docs/history/db-migration-2026-04.md` for the completed migration record.

Type contracts (client-side):
- `packages/client/src/builder/registry/categories.ts` — `CategoryId` union + `CategoryDef`
- `packages/client/src/builder/registry/layers.ts` — `LayerId` union + `LayerDef` + `PLAYER_Z`
- `packages/client/src/builder/registry/tilesets.ts` — `TilesetDef`, `SubRegion`, `Season`
- `packages/client/src/builder/registry/overrides.ts` — `TileOverride`
- `packages/client/src/builder/registry/map-items.ts` — `MapItemKind` + `MapItemTypeDef`
- `packages/client/src/builder/registry/store.ts` — single source of truth (fetches DB on boot, exposes synchronous getters + async writers)

## Workflow: adding a new tileset

1. Drop a Mana Seed asset pack into `assets/<pack-dir>/` (e.g. `assets/20.01b - Thatch Roof Home 4.1/`).
2. Add the pack to the `PACKS` config in `tools/ingest-mana-seed.ts` with its category slug (`thatch-roof-home`), optional `seasonal`, `defaultTileSize`, `hidden`.
3. Run `bun tools/ingest-mana-seed.ts` (or `--reset` for a full rebuild). The tool:
   - Walks `assets/<pack-dir>/` recursively (skipping `_supporting files/`, `_old stuff (deprecated)/`, `sample map/`, reference/help/guide PNGs).
   - For each PNG, derives tile size from the matching TSX in `<pack>/sample map/TSX files/` if present, else from the filename's `NxM` suffix, else the pack's `defaultTileSize`, else 16×16.
   - Copies PNG to `packages/client/public/assets/tilesets/<cat>/<slug>.png`.
   - Writes a canonical TSX at `packages/client/public/maps/<cat>/<slug>.tsx` (image src = `../../assets/tilesets/<cat>/<slug>.png`).
   - UPSERTs into `tilesets` + `tile_animations` + `tile_empty_flags` with auto-derived `default_category_id` (heuristic keyword match on filename).
4. (Optional) `bun tools/audit-transparent.ts --fix` — removes stale override / sub-region rows pointing at now-transparent tiles.
5. Reload the builder; new tilesets appear under their auto-assigned category. Use multi-select + bulk edit to refine.

## Asset layout on disk

```
assets/                                          ← raw Mana Seed packs (source of truth)
├── 18.10a - Fences & Walls 3.0/
├── 20.01b - Thatch Roof Home 4.1/
├── 20.04c - Summer Forest 4.3/
└── …                                            (36 included packs, many excluded)

packages/client/public/maps/                     ← canonical TSX published by ingest
├── 500-heaven.tmx + 500-heaven.json             ← frozen zones
├── summer-forest/<slug>.tsx
├── fences-walls/<slug>.tsx
├── thatch-roof-home/<slug>.tsx
└── …                                            (one subdir per pack category)

packages/client/public/assets/tilesets/          ← canonical PNG published by ingest
├── summer-forest/<slug>.png
├── fences-walls/<slug>.png
└── …                                            (matches TSX layout 1:1)
```

Each TSX references its PNG via `<image source="../../assets/tilesets/<cat>/<slug>.png"/>` — PNG and TSX live in parallel category subdirs, one hop up-and-across.
