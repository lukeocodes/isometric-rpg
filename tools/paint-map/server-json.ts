// Emit server-format Tiled JSON map.
//
// The server reads a Tiled-JSON file to know map bounds, walkability, and
// spawn points. This emitter produces a minimal JSON sufficient for the
// server's needs (no tileset files required — collision is represented
// entirely via a collision tile layer).

import type { CornerGrid } from "./wang.js";
import { getCorner } from "./wang.js";
import type { WangSet } from "./tsx.js";

export type ServerJsonInput = {
  width: number;
  height: number;
  tilewidth: number;
  tileheight: number;
  /** Corner grid used for the ground layer — scanned to auto-detect water collision. */
  corners: CornerGrid;
  /** Wangset that drove the ground fill, so we can resolve colour names. */
  wangset: WangSet;
  /** Collision tile IDs from the tree-wall collision layer. -1 = empty. Length = width*height. */
  wallCollision: Int32Array | null;
  /** Player spawn in tile coords. */
  playerSpawn: { x: number; y: number };
  /** Colour names (case-insensitive substring match) that should count as collision. */
  collisionColorKeywords?: string[];
};

/** Build the server JSON. Returns an object ready for JSON.stringify. */
export function buildServerJson(input: ServerJsonInput): object {
  const { width, height, tilewidth, tileheight, corners, wangset, wallCollision, playerSpawn } = input;
  const kws = (input.collisionColorKeywords ?? ["water"]).map((s) => s.toLowerCase());

  // Identify collision colours from the wangset by name match
  const collisionColors = new Set<number>();
  for (const c of wangset.colors) {
    const lower = c.name.toLowerCase();
    if (kws.some((kw) => lower.includes(kw))) collisionColors.add(c.id);
  }

  // Build collision layer: 1 where any of (wall-cell, all-4-corners-water), else 0
  const collisionData: number[] = new Array(width * height).fill(0);

  // Walls
  if (wallCollision) {
    for (let i = 0; i < collisionData.length; i++) {
      if (wallCollision[i] >= 0) collisionData[i] = 1;
    }
  }

  // Water: tile is collision if ALL 4 corners are water colours
  if (collisionColors.size > 0) {
    for (let ty = 0; ty < height; ty++) {
      for (let tx = 0; tx < width; tx++) {
        const nw = getCorner(corners, tx, ty);
        const ne = getCorner(corners, tx + 1, ty);
        const se = getCorner(corners, tx + 1, ty + 1);
        const sw = getCorner(corners, tx, ty + 1);
        if (
          collisionColors.has(nw) &&
          collisionColors.has(ne) &&
          collisionColors.has(se) &&
          collisionColors.has(sw)
        ) {
          collisionData[ty * width + tx] = 1;
        }
      }
    }
  }

  // Ground: mark all in-bounds cells as walkable (gid 1); 0 = out of bounds
  const groundData: number[] = new Array(width * height).fill(1);

  return {
    width,
    height,
    tilewidth,
    tileheight,
    infinite: false,
    orientation: "orthogonal",
    renderorder: "right-down",
    type: "map",
    version: "1.10",
    tiledversion: "1.11.0",
    tilesets: [],
    layers: [
      {
        id: 1,
        name: "ground",
        type: "tilelayer",
        width,
        height,
        data: groundData,
        visible: true,
        opacity: 1,
        x: 0,
        y: 0,
      },
      {
        id: 2,
        name: "collision",
        type: "tilelayer",
        width,
        height,
        data: collisionData,
        visible: false,
        opacity: 1,
        x: 0,
        y: 0,
      },
      {
        id: 3,
        name: "objects",
        type: "objectgroup",
        draworder: "topdown",
        objects: [
          {
            id: 1,
            name: "player-spawn",
            type: "spawn",
            // Server uses Math.round(obj.x / tileW) to recover tile index.
            // Emit integer pixel positions so rounding returns the intended tile.
            x: playerSpawn.x * tilewidth,
            y: playerSpawn.y * tileheight,
            width: 0,
            height: 0,
            rotation: 0,
            visible: true,
            properties: [{ name: "spawnType", type: "string", value: "player" }],
          },
        ],
      },
    ],
  };
}
