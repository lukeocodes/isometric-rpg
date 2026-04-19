// Tiled script: generate starter-area.tmx as raw XML
// Run: tiled --evaluate tools/generate-starter-area.js
//
// Map: 40x30 tiles at 16x16px = 640x480 world pixels
// Tilesets (firstgid order):
//   1   : summer forest.tsx         (16x16 tiles, 32 cols)
//   673 : summer forest tree wall.tsx       (128x128, 6 cols x 4 rows)
//   697 : summer forest tree wall canopy.tsx (128x128, 6 cols x 4 rows)
//
// Layer layout:
//   "ground"  — all grass (tile gid = 1 + 4 = 5)
//   "wall"    — tree wall base, solid=true, zindex=1
//   "canopy"  — tree wall canopy only, zindex=10
//   "spawns"  — object layer: player-spawn + camera points

const OUT = "/Users/lukeocodes/Projects/lukeocodes/16bit-online/packages/client/public/maps/starter-area.tmx";

const MAP_W   = 40;
const MAP_H   = 30;
const TILE_PX = 16;
const WALL_PX = 128;
const WALL_GT = WALL_PX / TILE_PX;  // 8
const SPAWN_COL = 20;
const SPAWN_ROW = 15;

// Tileset firstgids — these are fixed by insertion order
// summer forest: 32 cols x 21 rows = 672 tiles → next = 673
// tree wall: 6 cols x 4 rows = 24 tiles → next = 697
const FG_SF  = 1;
const FG_TW  = 673;
const FG_TWC = 697;

// Tile IDs (localId + firstgid = gid)
const GID_GRASS = FG_SF + 4;  // summer forest tile 4 = solid light grass

// Tree wall local IDs (row*6 + col in 6-col sheet)
const TW = {
  CLEAR_TL: 0,   // col 0 row 0
  CLEAR_T:  1,   // col 1 row 0
  CLEAR_TR: 3,   // col 3 row 0
  CLEAR_L:  6,   // col 0 row 1
  CLEAR_R:  8,   // col 2 row 1
  CLEAR_BL: 12,  // col 0 row 2
  CLEAR_B:  13,  // col 1 row 2
  CLEAR_BR: 15,  // col 3 row 2
};

// ── Build layer data ──────────────────────────────────────────────────────────

// Ground: all grass
const groundData = new Array(MAP_W * MAP_H).fill(GID_GRASS);

// Wall grid: ceil(40/8)=5 cols, ceil(30/8)=4 rows
const wCols = Math.ceil(MAP_W / WALL_GT);
const wRows = Math.ceil(MAP_H / WALL_GT);

function wallId(wc, wr) {
  const top = wr === 0, bot = wr === wRows-1, lft = wc === 0, rgt = wc === wCols-1;
  if (!top && !bot && !lft && !rgt) return -1;
  if (top && lft)  return TW.CLEAR_TL;
  if (top && rgt)  return TW.CLEAR_TR;
  if (bot && lft)  return TW.CLEAR_BL;
  if (bot && rgt)  return TW.CLEAR_BR;
  if (top)         return TW.CLEAR_T;
  if (bot)         return TW.CLEAR_B;
  if (lft)         return TW.CLEAR_L;
  return TW.CLEAR_R;
}

const wallData   = new Array(MAP_W * MAP_H).fill(0);
const canopyData = new Array(MAP_W * MAP_H).fill(0);

for (let wr = 0; wr < wRows; wr++) {
  for (let wc = 0; wc < wCols; wc++) {
    const id = wallId(wc, wr);
    if (id < 0) continue;
    const gc = wc * WALL_GT;
    const gr = wr * WALL_GT;
    if (gc < MAP_W && gr < MAP_H) {
      wallData[gr * MAP_W + gc]   = FG_TW  + id;
      canopyData[gr * MAP_W + gc] = FG_TWC + id;
    }
  }
}

// Spawn world position
const spawnX = SPAWN_COL * TILE_PX + TILE_PX / 2;  // 328
const spawnY = SPAWN_ROW * TILE_PX + TILE_PX / 2;  // 248

// ── Write TMX XML ─────────────────────────────────────────────────────────────

function csvChunks(data, cols) {
  var rows = [];
  for (var r = 0; r < data.length / cols; r++) {
    rows.push(data.slice(r * cols, r * cols + cols).join(","));
  }
  return rows.join(",\n");
}

var xml = '<?xml version="1.0" encoding="UTF-8"?>\n';
xml += '<map version="1.10" tiledversion="1.12.1" orientation="orthogonal" renderorder="right-down" ';
xml += 'width="' + MAP_W + '" height="' + MAP_H + '" ';
xml += 'tilewidth="' + TILE_PX + '" tileheight="' + TILE_PX + '" ';
xml += 'infinite="0" nextlayerid="6" nextobjectid="3">\n';

// Tilesets — paths relative to the TMX file location (public/maps/)
xml += ' <tileset firstgid="' + FG_SF + '" source="summer-forest.tsx"/>\n';
xml += ' <tileset firstgid="' + FG_TW + '" source="summer-forest-tree-wall.tsx"/>\n';
xml += ' <tileset firstgid="' + FG_TWC + '" source="summer-forest-tree-wall-canopy.tsx"/>\n';

// Ground layer
xml += ' <layer id="1" name="ground" width="' + MAP_W + '" height="' + MAP_H + '">\n';
xml += '  <data encoding="csv">\n';
xml += csvChunks(groundData, MAP_W) + '\n';
xml += '  </data>\n';
xml += ' </layer>\n';

// Wall layer (solid + zindex)
xml += ' <layer id="2" name="wall" width="' + MAP_W + '" height="' + MAP_H + '">\n';
xml += '  <properties>\n';
xml += '   <property name="solid" type="bool" value="true"/>\n';
xml += '   <property name="zindex" type="int" value="1"/>\n';
xml += '  </properties>\n';
xml += '  <data encoding="csv">\n';
xml += csvChunks(wallData, MAP_W) + '\n';
xml += '  </data>\n';
xml += ' </layer>\n';

// Canopy layer (zindex=10)
xml += ' <layer id="3" name="canopy" width="' + MAP_W + '" height="' + MAP_H + '">\n';
xml += '  <properties>\n';
xml += '   <property name="zindex" type="int" value="10"/>\n';
xml += '  </properties>\n';
xml += '  <data encoding="csv">\n';
xml += csvChunks(canopyData, MAP_W) + '\n';
xml += '  </data>\n';
xml += ' </layer>\n';

// Spawns object layer
xml += ' <objectgroup id="4" name="spawns">\n';
xml += '  <object id="1" name="player-spawn" type="player-spawn" x="' + spawnX + '" y="' + spawnY + '">\n';
xml += '   <point/>\n';
xml += '  </object>\n';
xml += '  <object id="2" name="camera" type="camera" x="' + spawnX + '" y="' + spawnY + '">\n';
xml += '   <properties>\n';
xml += '    <property name="camera" type="bool" value="true"/>\n';
xml += '    <property name="zoom" type="float" value="3"/>\n';
xml += '   </properties>\n';
xml += '   <point/>\n';
xml += '  </object>\n';
xml += ' </objectgroup>\n';

xml += '</map>\n';

var f = new TextFile(OUT, TextFile.WriteOnly);
f.write(xml);
f.close();

tiled.log("Saved " + OUT);
tiled.log("Wall grid: " + wCols + "x" + wRows + " (" + (wCols*wRows - (wCols-2)*(wRows-2)) + " border tiles)");
