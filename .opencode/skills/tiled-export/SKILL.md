---
name: tiled-export
description: Export, convert, and inspect TMX/TSX/JSON map and tileset files using the Tiled CLI. Use when reading map data, converting formats, or extracting tile/layer/wang information from Mana Seed or any Tiled project files.
license: MIT
compatibility: opencode
---

# Tiled CLI Export Skill

## Binary location
```
/opt/homebrew/bin/tiled
```

## Export a map to JSON
```bash
tiled --export-map input.tmx output.json
# or to lua:
tiled --export-map input.tmx output.lua
# minimized (no whitespace):
tiled --export-map --minimize input.tmx output.json
```

## Export a tileset to JSON
```bash
tiled --export-tileset input.tsx output.json
tiled --export-tileset --minimize input.tsx output.json
```

## List all supported export formats
```bash
tiled --export-formats
# Map formats: csv, gmx, js, json, lua, tmx, tscn, yy
# Tileset formats: json, lua, tsx
```

## Embed tilesets into the map export
```bash
tiled --embed-tilesets --export-map input.tmx output.json
```

## Resolve types and properties into the export
```bash
tiled --resolve-types-and-properties --export-map input.tmx output.json
```

## Detach templates
```bash
tiled --detach-templates --export-map input.tmx output.json
```

## Validate a file without exporting
```bash
tiled --quit input.tmx
```

## Export with a specific compatibility version
```bash
tiled --export-version 1.9 --export-map input.tmx output.json
```

---

## Parsing exported JSON maps

After `--export-map input.tmx output.json`, the JSON structure is:

```json
{
  "width": 40,        // map width in tiles
  "height": 30,       // map height in tiles
  "tilewidth": 16,
  "tileheight": 16,
  "tilesets": [
    {
      "firstgid": 1,        // GID offset for this tileset
      "name": "summer forest",
      "tilewidth": 16,
      "tileheight": 16,
      "columns": 32,
      "imagewidth": 512,
      "imageheight": 336,
      "source": "summer forest.tsx"  // if external
    }
  ],
  "layers": [
    {
      "name": "Under Sprite 1",
      "type": "tilelayer",
      "width": 40,
      "height": 30,
      "data": [0, 1, 2, ...]  // flat array, row-major, GIDs (1-based, 0=empty)
    },
    {
      "name": "Collision",
      "type": "tilelayer",
      "visible": false,
      "data": [...]
    },
    {
      "name": "Objects",
      "type": "objectgroup",
      "objects": [
        { "id": 1, "x": 64, "y": 128, "width": 16, "height": 16, "name": "spawn" }
      ]
    }
  ]
}
```

## Converting GID to local tile ID
```js
// GID is 1-based. Local ID = GID - tileset.firstgid
// To find which tileset a GID belongs to:
function getTilesetForGid(gid, tilesets) {
  // tilesets sorted by firstgid ascending
  for (let i = tilesets.length - 1; i >= 0; i--) {
    if (gid >= tilesets[i].firstgid) return tilesets[i];
  }
}
const localId = gid - tileset.firstgid;  // 0-based
const col = localId % tileset.columns;
const row = Math.floor(localId / tileset.columns);
```

## Tile at position (tileCol, tileRow) in a layer
```js
const gid = layer.data[tileRow * mapWidth + tileCol];
// 0 = empty tile
```

---

## Parsing exported JSON tilesets

After `--export-tileset input.tsx output.json`:

```json
{
  "name": "summer forest",
  "tilewidth": 16,
  "tileheight": 16,
  "columns": 32,
  "tilecount": 672,
  "imagewidth": 512,
  "imageheight": 336,
  "image": "../summer sheets/summer forest.png",
  "tiles": [
    {
      "id": 26,
      "animation": [
        { "tileid": 26, "duration": 100 },
        { "tileid": 27, "duration": 100 }
      ]
    }
  ],
  "wangsets": [
    {
      "name": "wang terrains",
      "type": "corner",
      "colors": [
        { "name": "dirt",          "tile": 128 },
        { "name": "light_grass",   "tile": 129 },
        { "name": "dark_grass",    "tile": 130 },
        { "name": "cobblestone",   "tile": 131 },
        { "name": "shallow_water", "tile": 132 },
        { "name": "deep_water",    "tile": 133 }
      ],
      "wangtiles": [
        { "tileid": 6, "wangid": [0,2,0,3,0,2,0,2] }
      ]
    }
  ]
}
```

## Wang ID format
`wangid` is an 8-element array: `[top, top-right, right, bottom-right, bottom, bottom-left, left, top-left]`
Each value is a color index (1-based, 0=unset).

---

## Workflow: extract all tile data from a Mana Seed pack

```bash
# 1. Export the map to JSON
tiled --export-map --embed-tilesets \
  "assets/20.04c - Summer Forest 4.3/sample map/summer forest sample map.tmx" \
  /tmp/summer-map.json

# 2. Export each tileset to JSON
tiled --export-tileset \
  "assets/20.04c - Summer Forest 4.3/sample map/TSX files/summer forest.tsx" \
  /tmp/summer-forest-tileset.json

tiled --export-tileset \
  "assets/20.04c - Summer Forest 4.3/sample map/TSX files/summer forest wang tiles.tsx" \
  /tmp/summer-wang-tileset.json

# 3. Parse with node
node -e "
const m = require('/tmp/summer-map.json');
console.log('layers:', m.layers.map(l => l.name));
console.log('tilesets:', m.tilesets.map(t => t.name + ' firstgid=' + t.firstgid));
"
```

## Workflow: inspect all wang terrain tiles

```bash
tiled --export-tileset \
  "assets/20.04c - Summer Forest 4.3/sample map/TSX files/summer forest wang tiles.tsx" \
  /tmp/wang.json

node -e "
const t = require('/tmp/wang.json');
const ws = t.wangsets[0];
console.log('terrains:', ws.colors.map(c => c.name));
// Print fill tiles
ws.colors.forEach((c,i) => console.log(c.name, '= tile', c.tile));
// Count transitions
console.log('wang tiles:', ws.wangtiles.length);
"
```
