// Summer Forest Tree Wall — Tile Relationship Map
// =================================================
// Sheet: summer forest tree wall 128x128.png
//   768×512px, 6 cols × 4 rows, each tile 128×128px (= 8×8 grid of 16px subtiles)
//
// This is a corner-based autotile. Each 128×128 tile represents a specific
// position in a forest edge. Compose them by checking which of the 4 cardinal
// neighbours (N, E, S, W) are also forest.
//
// The sheet has TWO layers:
//   1. tree wall 128x128.png         — full tile (trunks + canopy + ground)
//   2. tree wall (canopy only) 128x128.png — canopy only (render ABOVE player)
//
// Usage:
//   - Layer 0 (under player): full tree wall tile
//   - Layer 1 (over player):  canopy-only tile at same position
//   - Collision: block the tile entirely (or just the trunk area)
//
// ─── TILE INDEX LAYOUT (col, row) ──────────────────────────────────────────
//
// Reading the autotile setup image (red boxes = tile boundaries):
//
//  Col:  0          1          2          3          4          5
//  Row 0: CORNER_TL  EDGE_T     INNER_TR   CORNER_TR  EDGE_T_ALT CORNER_TR_ALT
//  Row 1: EDGE_L     FILL       EDGE_R     INNER_TL   INNER_BR   INNER_BL
//  Row 2: CORNER_BL  EDGE_B     INNER_BR   CORNER_BR  EDGE_B_ALT CORNER_BR_ALT
//  Row 3: CONCAVE_TL CONCAVE_TR CONCAVE_BL CONCAVE_BR (2 more variants)
//
// Simplified naming for game use:
//   CORNER_TL = forest occupies N and W neighbours but NOT NW diagonal
//   EDGE_T    = forest N, not S  (top straight edge)
//   EDGE_L    = forest W, not E  (left straight edge)
//   EDGE_R    = forest E, not W  (right straight edge)
//   EDGE_B    = forest S, not N  (bottom straight edge)
//   CORNER_TR = forest N and E, not inside
//   CORNER_BR = forest S and E, not inside
//   CORNER_BL = forest S and W, not inside
//   INNER_*   = concave inner corner (forest on 3 sides, gap in one diagonal)
//   FILL      = forest on all 4 sides (solid interior)

export const WALL_COLS = 6;
export const WALL_ROWS = 4;
export const WALL_FRAME_PX = 128; // px per tile
export const WALL_SUBTILE_PX = 16; // each tile = 8×8 of these

// Tile positions as [col, row] in the 128×128 sheet
export const WALL_TILE = {
  CORNER_TL:   [0, 0] as [number, number], // top-left outer corner
  EDGE_T:      [1, 0] as [number, number], // top straight edge
  CORNER_TR:   [5, 0] as [number, number], // top-right outer corner
  EDGE_L:      [0, 1] as [number, number], // left straight edge
  FILL:        [1, 1] as [number, number], // solid interior (forest on all sides)
  EDGE_R:      [2, 1] as [number, number], // right straight edge
  INNER_TR:    [2, 0] as [number, number], // inner concave top-right
  INNER_TL:    [3, 1] as [number, number], // inner concave top-left
  INNER_BR:    [4, 1] as [number, number], // inner concave bottom-right (was 2,2)
  INNER_BL:    [5, 1] as [number, number], // inner concave bottom-left
  CORNER_BL:   [0, 2] as [number, number], // bottom-left outer corner
  EDGE_B:      [1, 2] as [number, number], // bottom straight edge
  CORNER_BR:   [5, 2] as [number, number], // bottom-right outer corner
  CONCAVE_TL:  [0, 3] as [number, number], // concave corner variants
  CONCAVE_TR:  [1, 3] as [number, number],
  CONCAVE_BL:  [2, 3] as [number, number],
  CONCAVE_BR:  [3, 3] as [number, number],
} as const;

// ─── NEIGHBOUR BITMASK ──────────────────────────────────────────────────────
// Encode which of the 8 neighbours are forest:
//   bit 0 = N, bit 1 = NE, bit 2 = E, bit 3 = SE
//   bit 4 = S, bit 5 = SW, bit 6 = W, bit 7 = NW
//
// For the 4-cardinal neighbours that matter most:
//   N=1, E=4, S=16, W=64
// Diagonal NE=2, SE=8, SW=32, NW=128

export const N  = 1 << 0;
export const NE = 1 << 1;
export const E  = 1 << 2;
export const SE = 1 << 3;
export const S  = 1 << 4;
export const SW = 1 << 5;
export const W  = 1 << 6;
export const NW = 1 << 7;

// Given a bitmask of which neighbours are forest, return which wall tile to use.
// Returns [col, row] into the 128×128 sheet, or null if this tile should be open ground.
export function getWallTile(mask: number): [number, number] | null {
  const n  = !!(mask & N);
  const e  = !!(mask & E);
  const s  = !!(mask & S);
  const w  = !!(mask & W);
  const ne = !!(mask & NE);
  const se = !!(mask & SE);
  const sw = !!(mask & SW);
  const nw = !!(mask & NW);

  // Solid interior — forest on all 4 cardinal sides
  if (n && e && s && w) return WALL_TILE.FILL;

  // Straight edges — one open side
  if ( n && !e && !s &&  w) return WALL_TILE.CORNER_TL;
  if ( n && !e && !s && !w) return WALL_TILE.EDGE_T;
  if ( n &&  e && !s && !w) return WALL_TILE.CORNER_TR;
  if (!n && !e && !s &&  w) return WALL_TILE.EDGE_L;
  if (!n &&  e && !s && !w) return WALL_TILE.EDGE_R;
  if (!n && !e &&  s &&  w) return WALL_TILE.CORNER_BL;
  if (!n && !e &&  s && !w) return WALL_TILE.EDGE_B;
  if (!n &&  e &&  s && !w) return WALL_TILE.CORNER_BR;

  // Three cardinal neighbours (concave inner corners)
  if ( n &&  e &&  s && !w) return nw ? WALL_TILE.INNER_TL : WALL_TILE.CONCAVE_TL;
  if ( n &&  e && !s &&  w) return se ? WALL_TILE.INNER_TR : WALL_TILE.CONCAVE_TR;
  if (!n &&  e &&  s &&  w) return ne ? WALL_TILE.INNER_BL : WALL_TILE.CONCAVE_BL;
  if ( n && !e &&  s &&  w) return sw ? WALL_TILE.INNER_BR : WALL_TILE.CONCAVE_BR;

  // Isolated or degenerate — use fill as fallback
  return WALL_TILE.FILL;
}

// ─── STARTER AREA BORDER ───────────────────────────────────────────────────
// Given map dimensions and a border thickness, compute the forest tile
// for each border position.
//
// Returns a 2D array [row][col] of [sheetCol, sheetRow] or null (open ground).
// Each entry corresponds to one 128×128 tile slot.
// At 16px per subtile, one wall tile covers 8×8 ground tiles.

export interface WallPlacement {
  /** position in 128×128 tile grid */
  tileCol: number;
  tileRow: number;
  /** which sheet tile to use [sheetCol, sheetRow] */
  wallTile: [number, number];
  /** true = impassable */
  solid: boolean;
}

/**
 * Given a grid of boolean values (true = forest), compute wall tile placements.
 * `isForest(col, row)` returns true if that cell should be forest.
 */
export function computeWallPlacements(
  cols: number,
  rows: number,
  isForest: (col: number, row: number) => boolean,
): WallPlacement[] {
  const results: WallPlacement[] = [];

  for (let r = 0; r < rows; r++) {
    for (let c = 0; c < cols; c++) {
      if (!isForest(c, r)) continue;

      const get = (dc: number, dr: number) => isForest(c + dc, r + dr);

      let mask = 0;
      if (get( 0, -1)) mask |= N;
      if (get( 1, -1)) mask |= NE;
      if (get( 1,  0)) mask |= E;
      if (get( 1,  1)) mask |= SE;
      if (get( 0,  1)) mask |= S;
      if (get(-1,  1)) mask |= SW;
      if (get(-1,  0)) mask |= W;
      if (get(-1, -1)) mask |= NW;

      const wallTile = getWallTile(mask);
      if (wallTile) {
        results.push({ tileCol: c, tileRow: r, wallTile, solid: true });
      }
    }
  }

  return results;
}
