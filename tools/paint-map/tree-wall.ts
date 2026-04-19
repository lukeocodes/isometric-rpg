// Tree-wall positional autotile
//
// The Mana Seed tree-wall tileset (128x128 tiles, 6 cols x 4 rows = 24 tiles)
// does not ship with a wangset. We place tiles positionally based on whether
// each "large cell" (8x8 ground tiles = 128x128 px) is on the border of a
// rectangular enclosed area.
//
// Tile index layout (verified against sheet + sample map):
//   TL=0 T=1 TR=3     (row 0)
//   L=6 FILL=7 R=8    (row 1)
//   BL=12 B=13 BR=15  (row 2)
// Row 3 contains extra variations (inner corners etc.), unused for v1.

export const TREE_WALL_TILES = {
  TL: 0,
  T: 1,
  TR: 3,
  L: 6,
  FILL: 7,
  R: 8,
  BL: 12,
  B: 13,
  BR: 15,
} as const;

/** Large-tile wall spec: a rectangular ring around (x, y) with width w and height h (all in LARGE tile units). */
export type WallRect = {
  x: number; // large-tile grid position
  y: number;
  w: number; // width in large tiles (minimum 2 for a border to make sense)
  h: number; // height in large tiles (minimum 2)
};

/**
 * Paint a rectangular tree-wall border onto a sparse tile layer.
 *
 * @param rect    Wall rectangle in large-tile coordinates
 * @param scale   How many small tiles per large tile (typically 8 for 128/16)
 * @param tilesW  Full map width in small tiles
 * @param tilesH  Full map height in small tiles
 * @returns       Sparse tile grid of local tileids; -1 means empty
 */
export function paintTreeWallBorder(
  rect: WallRect,
  scale: number,
  tilesW: number,
  tilesH: number,
): Int32Array {
  const out = new Int32Array(tilesW * tilesH).fill(-1);

  const putLarge = (lx: number, ly: number, tileId: number): void => {
    const px = lx * scale;
    const py = ly * scale;
    if (px < 0 || py < 0 || px >= tilesW || py >= tilesH) return;
    out[py * tilesW + px] = tileId;
  };

  const { x, y, w, h } = rect;
  if (w < 2 || h < 2) {
    throw new Error(`WallRect must be at least 2x2 large tiles, got ${w}x${h}`);
  }

  // Top row
  putLarge(x, y, TREE_WALL_TILES.TL);
  for (let i = 1; i < w - 1; i++) putLarge(x + i, y, TREE_WALL_TILES.T);
  putLarge(x + w - 1, y, TREE_WALL_TILES.TR);

  // Middle rows
  for (let j = 1; j < h - 1; j++) {
    putLarge(x, y + j, TREE_WALL_TILES.L);
    putLarge(x + w - 1, y + j, TREE_WALL_TILES.R);
  }

  // Bottom row
  putLarge(x, y + h - 1, TREE_WALL_TILES.BL);
  for (let i = 1; i < w - 1; i++) putLarge(x + i, y + h - 1, TREE_WALL_TILES.B);
  putLarge(x + w - 1, y + h - 1, TREE_WALL_TILES.BR);

  return out;
}

/**
 * Paint a per-small-tile collision mask for a tree-wall border.
 *
 * The 128x128 wall tiles only register collision at their origin cell in the
 * map's 16x16 grid. This function fills every small-tile cell that's *visually*
 * covered by a border wall tile with the given tileid, so an invisible
 * collision layer can stop the player from walking through the trees.
 *
 * @param rect      Wall rectangle in large-tile coordinates
 * @param scale     Small tiles per large tile (typically 8)
 * @param tilesW    Map width in small tiles
 * @param tilesH    Map height in small tiles
 * @param tileid    Local tileid to place (any non-(-1) value; not rendered)
 */
export function paintTreeWallCollision(
  rect: WallRect,
  scale: number,
  tilesW: number,
  tilesH: number,
  tileid: number,
): Int32Array {
  const out = new Int32Array(tilesW * tilesH).fill(-1);

  const fillLargeCell = (lx: number, ly: number): void => {
    const sx = lx * scale;
    const sy = ly * scale;
    for (let dy = 0; dy < scale; dy++) {
      for (let dx = 0; dx < scale; dx++) {
        const px = sx + dx;
        const py = sy + dy;
        if (px >= 0 && py >= 0 && px < tilesW && py < tilesH) {
          out[py * tilesW + px] = tileid;
        }
      }
    }
  };

  const { x, y, w, h } = rect;
  // Top and bottom rows (full)
  for (let i = 0; i < w; i++) {
    fillLargeCell(x + i, y);
    fillLargeCell(x + i, y + h - 1);
  }
  // Left and right columns (middle only)
  for (let j = 1; j < h - 1; j++) {
    fillLargeCell(x, y + j);
    fillLargeCell(x + w - 1, y + j);
  }

  return out;
}
