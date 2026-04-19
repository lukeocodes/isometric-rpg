---
name: tiled-scripting
description: Write and run Tiled JavaScript scripts via --evaluate for batch map/tileset manipulation, reading layer data, wang sets, tile properties, collision shapes, and generating map files programmatically.
license: MIT
compatibility: opencode
---

# Tiled Scripting Skill

Tiled has a full JavaScript API accessible via `--evaluate script.js`. The UI is not instantiated — only file I/O and asset manipulation work.

## Run a script
```bash
tiled --evaluate script.js
tiled --evaluate script.js arg1 arg2   # args available as tiled.scriptArguments
tiled -e script.js                      # shorthand
```

## Script modules (.mjs)
```bash
tiled --evaluate script.mjs   # loaded as ES module, can use import/export
# NOTE: modules are loaded only once — don't re-evaluate the same .mjs
```

---

## Key API objects

### `tiled` global
```js
tiled.version          // "1.10.2"
tiled.platform         // "macos"
tiled.scriptArguments  // array of extra CLI args
tiled.mapFormats       // list of readable map format names
tiled.tilesetFormats   // list of readable tileset format names

// Load assets
const map     = tiled.openMap("path/to/map.tmx");
const tileset = tiled.openTileset("path/to/tileset.tsx");

// Save assets
map.save("path/to/output.tmx");
tileset.save("path/to/output.tsx");

// Export assets (to other formats)
tiled.exportMap(map, "output.json", "json");
tiled.exportTileset(tileset, "output.json", "json");

// Log
tiled.log("hello");
tiled.error("something went wrong");
```

### `TileMap` (map object)
```js
map.width          // cols
map.height         // rows
map.tileWidth
map.tileHeight
map.layerCount
map.tilesetCount

// Iterate layers
for (let i = 0; i < map.layerCount; i++) {
  const layer = map.layerAt(i);
  tiled.log(layer.name + " type=" + layer.layerType);
}

// Find layer by name
const layer = map.layerAt(map.indexOfLayer("Under Sprite 1"));
```

### `TileLayer`
```js
layer.name
layer.width
layer.height
layer.layerType   // 1 = TileLayer, 2 = ObjectGroup, 3 = ImageLayer, 4 = GroupLayer

// Read a tile GID at position
const cell = layer.cellAt(col, row);
cell.tileId        // local ID within its tileset (-1 if empty)
cell.tileset       // Tileset object or null
cell.flippedHorizontally
cell.flippedVertically
cell.rotatedHexagonal120

// Edit layer tiles
const edit = layer.edit();
edit.setTile(col, row, tileset, tileId);
edit.apply();   // MUST call apply() to commit changes
```

### `ObjectGroup`
```js
layer.objectCount
const obj = layer.objectAt(0);
obj.name
obj.x; obj.y; obj.width; obj.height
obj.shape   // MapObject.Rectangle, Polygon, Polyline, Ellipse, Text, Point
obj.polygon // array of {x,y} points if polygon/polyline
```

### `Tileset`
```js
tileset.name
tileset.tileWidth; tileset.tileHeight
tileset.columnCount
tileset.tileCount

// Get a tile
const tile = tileset.tile(localId);
tile.id
tile.imageRect   // {x, y, width, height} within the sheet

// Tile animation
if (tile.animated) {
  tile.frames   // array of {tileid, duration}
}

// Tile properties
tile.property("myProp")
tile.setProperty("myProp", "value")

// Wang sets
tileset.wangSetCount
const ws = tileset.wangSet(0);
ws.name
ws.type   // "corner", "edge", "mixed"
ws.colorCount
const color = ws.colorAt(1);  // 1-indexed
color.name
color.tile   // representative tile ID
ws.wangTileCount
const wt = ws.wangTile(0);
wt.tileId
wt.wangId   // 8-element array [T, TR, R, BR, B, BL, L, TL]
```

---

## Example scripts

### Dump all layer names and types from a map
```js
// dump-layers.js
const map = tiled.openMap(tiled.scriptArguments[0]);
for (let i = 0; i < map.layerCount; i++) {
  const l = map.layerAt(i);
  tiled.log(`${i}: "${l.name}" type=${l.layerType} visible=${l.visible}`);
}
```
```bash
tiled -e dump-layers.js "path/to/map.tmx"
```

### Export all wang terrain fill tiles from a tileset
```js
// dump-wang.js
const ts = tiled.openTileset(tiled.scriptArguments[0]);
for (let w = 0; w < ts.wangSetCount; w++) {
  const ws = ts.wangSet(w);
  tiled.log(`WangSet "${ws.name}" type=${ws.type}`);
  for (let c = 1; c <= ws.colorCount; c++) {
    const color = ws.colorAt(c);
    const tile = ts.tile(color.tile);
    const col = color.tile % ts.columnCount;
    const row = Math.floor(color.tile / ts.columnCount);
    tiled.log(`  color ${c} "${color.name}" = tile ${color.tile} (col=${col} row=${row})`);
  }
}
```
```bash
tiled -e dump-wang.js "path/to/tileset.tsx"
```

### Find all animated tiles in a tileset
```js
// dump-animations.js
const ts = tiled.openTileset(tiled.scriptArguments[0]);
for (let i = 0; i < ts.tileCount; i++) {
  const tile = ts.tile(i);
  if (tile && tile.animated) {
    const frames = tile.frames.map(f => `${f.tileid}@${f.duration}ms`).join(", ");
    tiled.log(`tile ${i}: [${frames}]`);
  }
}
```

### Collect all non-empty tile IDs used in a layer
```js
// used-tiles.js
const map = tiled.openMap(tiled.scriptArguments[0]);
const layerName = tiled.scriptArguments[1];
const idx = map.indexOfLayer(layerName);
const layer = map.layerAt(idx);
const used = new Set();
for (let r = 0; r < layer.height; r++) {
  for (let c = 0; c < layer.width; c++) {
    const cell = layer.cellAt(c, r);
    if (cell.tileId >= 0) used.add(cell.tileId);
  }
}
tiled.log("Used tile IDs: " + [...used].sort((a,b)=>a-b).join(", "));
```
```bash
tiled -e used-tiles.js "map.tmx" "Over Sprite 1"
```

### Read collision shapes from a tileset
```js
// dump-collision.js
const ts = tiled.openTileset(tiled.scriptArguments[0]);
for (let i = 0; i < ts.tileCount; i++) {
  const tile = ts.tile(i);
  if (!tile) continue;
  const objGroup = tile.objectGroup;
  if (!objGroup || objGroup.objectCount === 0) continue;
  tiled.log(`tile ${i} has ${objGroup.objectCount} collision object(s):`);
  for (let o = 0; o < objGroup.objectCount; o++) {
    const obj = objGroup.objectAt(o);
    tiled.log(`  shape=${obj.shape} x=${obj.x} y=${obj.y} w=${obj.width} h=${obj.height}`);
  }
}
```

### Create a new map programmatically
```js
// create-map.js
const map = new TileMap();
map.width = 40;
map.height = 30;
map.tileWidth = 16;
map.tileHeight = 16;

const ts = tiled.openTileset("summer forest.tsx");
map.addTileset(ts);

const layer = new TileLayer();
layer.name = "Ground";
layer.width = 40;
layer.height = 30;

const edit = layer.edit();
for (let r = 0; r < 30; r++)
  for (let c = 0; c < 40; c++)
    edit.setTile(c, r, ts, 4);  // tile 4 = solid grass
edit.apply();

map.addLayer(layer);
map.save("output.tmx");
tiled.log("Saved output.tmx");
```

---

## Extensions directory (macOS)
```
~/Library/Preferences/Tiled/extensions/
```
Place `.js` or `.mjs` files here — they load automatically on Tiled startup and can add menu items, tools, and map format handlers.

## TypeScript definitions
```bash
npm install --save-dev @mapeditor/tiled-api
```
Use for autocomplete when writing scripts.
