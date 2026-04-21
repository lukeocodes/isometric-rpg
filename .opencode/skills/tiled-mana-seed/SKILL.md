---
name: tiled-mana-seed
description: Comprehensive guide for working with Mana Seed Tiled assets in this project — TMX/TSX file locations, slicing rules, wang terrain IDs, layer conventions, tree wall autotile setup, crop cell references, farmer sprite system layers, NPC palette conventions, livestock animation layout, and how to use the @excaliburjs/plugin-tiled plugin to load maps into the game engine.
license: MIT
compatibility: opencode
---

# Mana Seed + Tiled + Excalibur Skill

## Asset locations
```
assets/20.04c - Summer Forest 4.3/   — summer tileset + tree wall + sample maps
assets/20.05c - Spring Forest 4.3/   — spring tileset
assets/20.06a - Autumn Forest 4.3/   — autumn tileset (clean/leaves/bare variants)
assets/20.07a - Winter Forest 4.3/   — winter tileset (clean/snowy/leaves variants)
packages/client/public/assets/       — copied assets served by Vite
packages/client/public/maps/         — TMX/TSX map files served by Vite
```

## Sample maps (open in Tiled to inspect)
```
assets/20.04c - Summer Forest 4.3/sample map/summer forest sample map.tmx
assets/20.04c - Summer Forest 4.3/sample map/summer forest, usage guide.tmx
assets/20.04c - Summer Forest 4.3/sample map/summer forest waterfall demo.tmx
```

---

## Slicing rules (from slicing instructions.txt)
- Slice each sheet AT the size in the filename: `32x32.png` → 32×32 cells
- Keep your MAP EDITOR at 16×16 tiles always
- Larger cells (32×32, 64×64, 128×128) overlap multiple 16×16 map slots
- Example: a 32×32 object placed on a 16×16 map occupies a 2×2 tile area

---

## Summer forest tileset (summer forest.png)
- Sheet: 512×336px, 32 cols × 21 rows, 16×16 per tile = 672 tiles total
- Tile index: `id = row * 32 + col` (0-based)
- Key tiles:
  - id=4  (col 4, row 0) = solid light grass (primary ground fill)
  - id=36 (col 4, row 1) = solid dark grass
  - id=8  (col 8, row 0) = dirt fill
  - id=12 (col 12, row 0) = stone path fill
  - id=539 (col 11, row 16) = deep water fill
  - id=542 (col 14, row 16) = shallow water fill
  - ids 26-31 = 6-frame animated water (100ms/frame)
  - ids 58-63, 90-95, etc = more animated water rows

## Wang tileset (summer forest wang tiles.png)
- Sheet: 1024×512px, 64 cols × 32 rows, 16×16 per tile
- 6 terrain types (wang color index → name → fill tile):
  - 1 = dirt          → tile 128
  - 2 = light_grass   → tile 129
  - 3 = dark_grass    → tile 130
  - 4 = cobblestone   → tile 131
  - 5 = shallow_water → tile 132
  - 6 = deep_water    → tile 133
- All 6 terrains transition seamlessly with all others
- Wang ID format: [T, TR, R, BR, B, BL, L, TL] (8 corners, 1-indexed color, 0=unset)
- Using wang tiles in code: look up tile by matching wang ID corners

## Tree wall autotile (summer forest tree wall 128x128.png)
- Sheet: 768×512px, 6 cols × 4 rows, 128×128 per tile (= 8×8 of 16px subtiles)
- TWO sheets: full (trunks+canopy+ground) and canopy-only (render above player)
- Tile layout — what the tile looks like and when to use it:

  ```
  Col:  0          1          2          3          4          5
  Row 0: CLEAR_TL   CLEAR_T    INNER_TR   CLEAR_TR   (path)     (variant)
  Row 1: CLEAR_L    FILL       CLEAR_R    INNER_TL   INNER_BR   INNER_BL
  Row 2: CLEAR_BL   CLEAR_B    (variant)  CLEAR_BR   (path)     (variant)
  Row 3: CONCAVE_TL CONCAVE_TR CONCAVE_BL CONCAVE_BR  -          -
  ```

- Naming: CLEAR_XX = "clearing edge" — forest is on the XX side, open on opposite
  - CLEAR_TL: forest N+W, open S+E (use at top-left corner of a clearing)
  - CLEAR_T:  forest N,   open S   (use along top edge of a clearing)
  - CLEAR_TR: forest N+E, open S+W (top-right corner)
  - CLEAR_L:  forest W,   open E   (left edge)
  - FILL:     forest all sides     (solid interior, never borders clearing)
  - CLEAR_R:  forest E,   open W   (right edge)
  - CLEAR_BL: forest S+W, open N+E (bottom-left corner)
  - CLEAR_B:  forest S,   open N   (bottom edge)
  - CLEAR_BR: forest S+E, open N+W (bottom-right corner)
  - INNER_*:  3 sides forest, 1 open (concave inner corner)
  - CONCAVE_*: alternative concave corners (row 3)

- Z-ordering: wall ground layer z=1 (above grass z=0), canopy z=10 (above player)
- Each 128px wall tile covers 8×8 ground tiles (16px each)
- The TSX has no wangset — tile selection is positional (use grid position, not masking)

---

## Farming Crops (farming crops 1-A/B/C 16x32.png, farming crops 2-A/B 16x32.png)
- Actual sheet size: 144×512px (NOT 160×512 — slice at 16×32 = 9 cols × 16 rows)
  Wait — the readme says "144x512 designed to be sliced at 16x32"
  But actual file is 160×512. Use 160px width / 16px = 10 cols.
- Layout per row (one crop per row, 10 cols):
  - col 0: inventory icon
  - col 1: seedbag icon
  - col 2: seeds (scatter on ground when planting)
  - col 3: growth stage 1
  - col 4: growth stage 2
  - col 5: growth stage 3
  - col 6: growth stage 4
  - col 7: growth stage 5 (harvest)
  - col 8: sign icon
  - col 9: map sign object
- Multi-harvest crops (reset to stage 4 after harvest, not deleted):
  corn, peas, beans, tomatoes, cucumber, strawberries, grapes (pack 1)
  bell peppers, blueberries, chili peppers, raspberries, eggplant, zucchini (pack 2)
- Bell pepper special: green→yellow→orange→red progression across stages

## Crops cell reference (crops 1-A, row 0 = crop index 0):
- Pack 1-A: Beetroot(0) Cabbage(9) Carrot(19) Yellow Corn(29) Yellow Onion(39)
  Brown Potato(49) Green Peas(59) Pinto Beans(69) Tomato(79) Wheat(89)
  Cucumber(99) Spinach(109) Strawberries(119) Blue Grapes(129) Pumpkin(139) Broccoli(140)
- Pack 1-B: recolors of above
- Pack 1-C: Barley(0) Rye(9) Green/Red Grapes(19/29) Cotton Candy Pumpkin(39) Cauliflower(49)
- Pack 2-A: Artichoke(0) Red Bell Pepper(9) Blueberries(19) Celery(29) Watermelon(39)
  Leek(49) Garlic(59) Red Chili(69) Oats(79) Raspberry(89) Eggplant(99)
  Radish(109) Lettuce(119) Sweet Potato(129) Turnip(139) Zucchini(140)
- Pack 2-B: recolors of above

---

## Farmer Sprite System (1024×1024, 64×64 cells, 16 cols × 16 rows)
- Layer order bottom to top (MUST composite in this order):
  00undr → 01body → 02sock → 03fot1 → 04lwr1 → 05shrt → 06lwr2
  → 07fot2 → 08lwr3 → 09hand → 10outr → 11neck → 12face → 13hair
  → 14head → 15over
- Cell reference: see `_supporting files/farmer base cell reference.png`
- Animation guide: see `_supporting files/farmer base animation guide.png`
- Filename convention: `fbas_<layer>_<name>_<version><palette>[_e]`
  - palette: 00a=3-color, 00b=4-color, 00c=two 3-color, 00d=4+3-color, 00f=4+hair-color
  - `_e` suffix = hat cannot coexist with hair (hide hair layer when equipped)
- Walk animation uses specific non-sequential cells with flips — see animation guide
- Effects sheets (32x32 or 64x64): slice at size in filename, position per animation guide

## Hardy Horse (1024×512, 64×64, 16 cols × 8 rows)
- TWO layers: `hardy horse bottom vXX` (main) + `hardy horse top vXX` (head over rider)
- Render order: shadow (32x32) → bottom → rider sprite → top
- Version = horse color breed (v00=wild bay, v01=chestnut, v11=black, v17=white, etc)
- Match version numbers between top and bottom layers
- Shadow from `hardy horse extras 32x32`: 4 cells (0-3), centred in bottom-middle 32×32 of the 64×64 cell
- Animation guide has purple=cell ref, yellow=timing(ms), green=shadow cell, blue=rider offset

## Chick (NOT 32×32 — actually 16×16 cells, 8 cols × 8 rows per sheet)
- Row 1: idle(1) hop/move(2) idle-up(3) hop-up(4) cheep×2(5-6) rest(7) alt-cheep(8)
- Row 2: same but eggshell-on-head variant
- Row 3: egg hatch — pingpong(1-3)=rocking, crack(4-5), cheep-in-shell(6-7), empty-shell(8)

## NPC Pack palette convention
- v00 = universal ugly palette for runtime color swapping — don't use visually
- v01+ = real character colors
- Use `bonus NPC palette reference.png` to find palette swap values from v00

---

## @excaliburjs/plugin-tiled usage

### Basic setup
```typescript
import { TiledResource } from '@excaliburjs/plugin-tiled';
import { Engine, Loader } from 'excalibur';

const game = new Engine({ ... });
const tiledMap = new TiledResource('/maps/heaven.tmx', {
  useTilemapCameraStrategy: true,  // keeps camera inside map bounds
  useMapBackgroundColor: true,     // uses Tiled background color
  pathMap: [
    // remap TSX paths since Vite renames .tsx files
    { path: /(.*\.tsx$)/, output: '/maps/[match]' },
    { path: /(.*\.png$)/, output: '/assets/tilesets/[match]' },
  ]
});

const loader = new Loader([tiledMap]);
game.start(loader).then(() => {
  tiledMap.addToScene(game.currentScene);
});
```

### Vite config (required — .tsx collision with React)
```typescript
// vite.config.ts
const tiledPlugin = () => ({
  name: 'tiled-tileset-plugin',
  resolveId: {
    order: 'pre' as const,
    handler(sourceId: string) {
      if (!sourceId.endsWith('.tsx')) return;
      return { id: 'tileset:' + sourceId, external: 'relative' as const };
    }
  }
});

export default defineConfig({
  plugins: [tiledPlugin()],
  build: { assetsInlineLimit: 0 }
});
```

### Solid collision layers
In Tiled, add custom boolean property `solid = true` to a tile layer.
Any non-empty tile on that layer becomes a solid collider.

### Entity factories (spawn points → game entities)
```typescript
const tiledMap = new TiledResource('./map.tmx', {
  entityClassNameFactories: {
    'player-spawn': (props) => new Player({ pos: props.worldPos }),
    'npc': (props) => new NPC({ pos: props.worldPos, ...props.properties }),
    'chest': (props) => new Chest({ pos: props.worldPos }),
  }
});
```

### Camera control via Tiled object properties
Add a Point object to an object layer in Tiled with:
- custom property `camera = true`
- custom property `zoom = 3.0`
Plugin wires this to Excalibur's camera automatically.

### Querying map data at runtime
```typescript
// Get tile info at a world position
const tile = tiledMap.getTileByPoint('ground', ex.vec(320, 240));
console.log(tile.tiledTile, tile.exTile);

// Get objects by class
const spawns = tiledMap.getObjectsByClassName('player-spawn');
const enemies = tiledMap.getObjectsByClassName('enemy');

// Get tileset for a GID
const tileset = tiledMap.getTilesetForTileGid(42);
const sprite = tileset.getSpriteForGid(42);
const animation = tileset.getAnimationForGid(42);
const colliders = tileset.getCollidersForGid(42);
```

### Headless mode (server-side)
```typescript
const tiledMap = new TiledResource('./map.tmx', {
  headless: true,
  fileLoader: async (path, contentType) => { /* custom loader */ }
});
```

---

## Tiled CLI quick reference (for map generation/inspection)
```bash
# Export map to JSON (inspect all layer data)
tiled --export-map --embed-tilesets map.tmx output.json

# Export tileset to JSON (inspect wang sets, animations, colliders)
tiled --export-tileset tileset.tsx output.json

# Run a script headlessly
tiled -e script.js path/to/map.tmx

# List export formats
tiled --export-formats
```

## Weather effects timing (from using these effects.txt)
- Rain light: 50ms/frame  | Rain heavy: 100ms/frame
- Snow light: 175ms/frame | Snow heavy: 100ms/frame
- Rain impact: 75ms/frame | Snow impact: 150ms/frame
- Lightning: flash briefly, alternate both bolts rapidly for continuous flow
- Cloud/snow cover: autotiles painted with terrain brush, move slowly across map
