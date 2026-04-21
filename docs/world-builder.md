# World builder

Separate Vite entry at `/builder.html`. Uses the same WebRTC connection as the game but signals the server via `{builder: true}` on the `/api/rtc/offer` body so the session is flagged `isBuilder`. Builder sessions land in the "heaven" zone (numericId 500, `heaven.tmx` — an empty grass map) by default and cannot be entered by regular game clients.

## Commands (in-game)

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

## Tile library picker

See `docs/tile-library.md` for multi-select, bulk edit, source-spritesheet viewer, and the 20 category taxonomy.

## Protocol (opcodes 200–213, all JSON on reliable channel)

| Opcode | Name | Dir | Payload |
|---|---|---|---|
| 200 | `BUILDER_NEW_MAP` | C→S | `{ name, width, height }` — creates map, teleports creator |
| 201 | `BUILDER_PLACE_TILE` | C→S | `{ layer, x, y, tileset, tileId, rotation, flipH, flipV }` |
| 202 | `BUILDER_REMOVE_TILE` | C→S | `{ layer, x, y }` |
| 203 | `BUILDER_MAP_SNAPSHOT` | S→C | Full overlay tile list (sent on join + zone change) |
| 204 | `BUILDER_TILE_PLACED` | S→C | Broadcast to other builders in same zone |
| 205 | `BUILDER_TILE_REMOVED` | S→C | Broadcast |
| 206 | `BUILDER_LIST_MAPS` | C→S | |
| 207 | `BUILDER_MAPS_LIST` | S→C | `{ maps: [{ id, numericId, name, width, height }] }` |
| 208 | `BUILDER_GOTO_MAP` | C→S | `{ numericId }` — teleport to heaven or a user map |
| 209 | `BUILDER_ERROR` | S→C | `{ reason }` |
| 210 | `BUILDER_PLACE_BLOCK` | C→S | `{ x, y }` — place a 1-cell collision block |
| 211 | `BUILDER_REMOVE_BLOCK` | C→S | `{ x, y }` — remove a collision block |
| 212 | `BUILDER_BLOCK_PLACED` | S→C | Broadcast: block added |
| 213 | `BUILDER_BLOCK_REMOVED` | S→C | Broadcast: block removed |

## Zone numeric IDs

- `1`-`99` — hand-authored zones (human-meadows etc.)
- `100`-`199` — Mana Seed test zones (keys 1-9)
- `500` — **heaven** (world-builder hub, in-memory overlay only, NOT persisted)
- `1000+` — user-built maps (persisted in `user_maps` + `user_map_tiles`)

## Files

- Server: `packages/server/src/game/user-maps.ts` (in-memory + DB layer), `packages/server/src/routes/rtc.ts` (`handleBuilderOp`, `broadcastBuilderEvent`, `sendBuilderSnapshot`)
- Client: `packages/client/src/builder/{main,BuilderScene,TileOverlay,TilePicker,TilesetIndex,BuilderHud}.ts`, `packages/client/builder.html`
- DB: `packages/server/src/db/schema.ts` (`userMaps`, `userMapTiles`)
- Freeze CLI: `tools/freeze-map.ts` — dumps DB map → `packages/client/public/maps/user-maps/<id>-<slug>.{tmx,json}`

## Rendering

Heaven `.tmx` serves as the visual backdrop for ALL user maps (they reuse it until frozen). User-placed tiles render as one Excalibur Actor per cell on top (`TileOverlay`). Animated tiles use `Animation`, static use `Sprite`. Rotation via `actor.rotation`. Z layers: ground=10, decor=20, player=50, walls=60, canopy=200.

## Known limits (v1)

- `heaven` tile placements are in-memory only (not persisted across server restarts) — heaven IS the sandbox.
- Each user map reuses `heaven.tmx` as the backdrop, so a 20×14 user map shows heaven's 32×32 grass beyond its bounds. Visible "out of bounds" area will be dark. Freeze produces a correctly-sized TMX for that map.
- Tile picker modal shows `<AN>` badge for animated tiles. Animations play in the picker, brush preview, and on-map placement.
- No multi-tile brush, no fill bucket, no wang autotile. These are v2 features (see `docs/stamps.md` when designed).

## Debug inspector

The one-off `packages/client/public/inspect.html` tool (temporary, not committed) renders any PNG at 4× scale with tile-id overlay — invaluable for identifying `subRegions` ranges when carving a mixed sheet. Rebuild it from the generator script if you need to re-inspect.
