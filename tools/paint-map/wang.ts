// Wang corner-fill algorithm
// Given a grid of corner colours, resolve each tile's GID by matching its
// 4 corners against a wangset's <wangtile> entries.
//
// Wang corner layout per Tiled spec (wangid[8]):
//   indices: [0=edge_N, 1=corner_NE, 2=edge_E, 3=corner_SE, 4=edge_S, 5=corner_SW, 6=edge_W, 7=corner_NW]
// For corner-type wangsets, edges (even indices) are always 0 and ignored.
//
// A tile at (tx, ty) has 4 corners:
//   NW = corners[ty  ][tx  ]
//   NE = corners[ty  ][tx+1]
//   SE = corners[ty+1][tx+1]
//   SW = corners[ty+1][tx  ]
// For a WxH tile grid, corners is (W+1) x (H+1).

import type { WangSet } from "./tsx.js";

export type CornerGrid = {
  width: number; // corner grid width (tiles+1)
  height: number; // corner grid height (tiles+1)
  data: Uint8Array; // colour id per corner; 0 = unset
};

export function makeCornerGrid(tilesW: number, tilesH: number): CornerGrid {
  const w = tilesW + 1;
  const h = tilesH + 1;
  return { width: w, height: h, data: new Uint8Array(w * h) };
}

/** Fill a rectangle of corners with a colour. Inclusive on both sides. */
export function fillCorners(
  grid: CornerGrid,
  x: number,
  y: number,
  w: number,
  h: number,
  colour: number,
): void {
  // w, h are tile counts; this fills corners from (x, y) to (x+w, y+h) inclusive
  const x0 = Math.max(0, x);
  const y0 = Math.max(0, y);
  const x1 = Math.min(grid.width - 1, x + w);
  const y1 = Math.min(grid.height - 1, y + h);
  for (let cy = y0; cy <= y1; cy++) {
    for (let cx = x0; cx <= x1; cx++) {
      grid.data[cy * grid.width + cx] = colour;
    }
  }
}

/** Get a single corner colour. Returns 0 if out of bounds. */
export function getCorner(grid: CornerGrid, x: number, y: number): number {
  if (x < 0 || y < 0 || x >= grid.width || y >= grid.height) return 0;
  return grid.data[y * grid.width + x];
}

export type FillResult = {
  /** tile grid of local tileids (pre-firstgid) */
  tileIds: Int32Array;
  /** Corners that couldn't be resolved. Useful for debugging. */
  unresolved: Array<{ x: number; y: number; corners: [number, number, number, number] }>;
};

/**
 * Resolve every tile in a rectangular region to a wangset tileid.
 * Tiles outside the region are left as -1 (caller treats as empty).
 */
export function resolveWangTiles(
  corners: CornerGrid,
  ws: WangSet,
  tilesW: number,
  tilesH: number,
  opts: { fallback?: number } = {},
): FillResult {
  const out = new Int32Array(tilesW * tilesH).fill(-1);
  const unresolved: FillResult["unresolved"] = [];

  for (let ty = 0; ty < tilesH; ty++) {
    for (let tx = 0; tx < tilesW; tx++) {
      const nw = getCorner(corners, tx, ty);
      const ne = getCorner(corners, tx + 1, ty);
      const se = getCorner(corners, tx + 1, ty + 1);
      const sw = getCorner(corners, tx, ty + 1);

      // Skip entirely-unset tiles (all 4 corners = 0)
      if (nw === 0 && ne === 0 && se === 0 && sw === 0) continue;

      // Key order matches cornerLookup: NE, SE, SW, NW
      const key = `${ne},${se},${sw},${nw}`;
      const matches = ws.cornerLookup.get(key);
      if (matches && matches.length > 0) {
        // For now: always pick the first match. TODO: probability weighting.
        out[ty * tilesW + tx] = matches[0];
      } else if (opts.fallback !== undefined) {
        out[ty * tilesW + tx] = opts.fallback;
        unresolved.push({ x: tx, y: ty, corners: [nw, ne, se, sw] });
      } else {
        unresolved.push({ x: tx, y: ty, corners: [nw, ne, se, sw] });
      }
    }
  }

  return { tileIds: out, unresolved };
}

/** Find a solid-colour tile (all 4 corners = colour) for use as a fallback. */
export function findSolidTile(ws: WangSet, colour: number): number | undefined {
  const key = `${colour},${colour},${colour},${colour}`;
  return ws.cornerLookup.get(key)?.[0];
}
