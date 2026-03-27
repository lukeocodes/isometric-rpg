/**
 * Structure Renderer — 3D wall pieces and corner posts.
 *
 * COORDINATE SYSTEM:
 *   Tile anchor at (0,0). NW face runs from (-hw,0)→(0,-hh). NE face from (0,-hh)→(hw,0).
 *   "Depth" = how far the inner face sits behind the outer face (in screen px).
 *
 * DEPTH DIRECTIONS (screen space, per wall orientation):
 *   West wall  (wall_left,  interior toward +x):  (+L_DX, +L_DY) = (+4, +2)
 *   East wall  (wall_left,  interior toward -x):  (-L_DX, -L_DY) = (-4, -2)  ← flip=true
 *   North wall (wall_right, interior toward +z):  (+R_DX, +R_DY) = (-4, +2)
 *   South wall (wall_right, interior toward -z):  (-R_DX, -R_DY) = (+4, -2)  ← flip=true
 *
 * CORNER CONNECTIVITY:
 *   NW corner: west(flipL=F) + north(flipR=F)
 *   NE corner: east(flipL=T) + north(flipR=F)
 *   SW corner: west(flipL=F) + south(flipR=T)
 *   SE corner: east(flipL=T) + south(flipR=T)
 *
 * Corners use full tile width so walls connect without gaps. The L-shaped top
 * cap and center ridge make them read as posts, not flat blocks.
 */

import { Container, Graphics } from "pixi.js";
import { worldToScreen, TILE_WIDTH_HALF, TILE_HEIGHT_HALF } from "./IsometricRenderer";

const WALL_H    = 78;  // 52 * 1.5 — one storey height
const WALL_DEPTH = 4;

export const FLOOR_ELEVATION = WALL_H / 16; // = 3.25 — world units per storey

// Base depth vectors (flip to reverse interior direction)
const L_DX =  WALL_DEPTH, L_DY = WALL_DEPTH / 2;  // left-wall depth (+x world)
const R_DX = -WALL_DEPTH, R_DY = WALL_DEPTH / 2;  // right-wall depth (-x world; for north wall flip gives +z→south)

const hw = TILE_WIDTH_HALF;   // 32
const hh = TILE_HEIGHT_HALF;  // 16

export interface WallPiece {
  tileX: number;
  tileZ: number;
  type: "wall_left" | "wall_right" | "wall_corner"
      | "wall_left_door"  | "wall_right_door"
      | "wall_left_win"   | "wall_right_win"
      | "stair_left" | "stair_right" | "floor";
  material: "stone" | "wood" | "plaster";
  /** Floor index: 0 = ground floor, 1 = second floor */
  elevation?: number;
  /** Reverse the depth direction (east walls and south walls need this) */
  flip?:  boolean;
  /** For wall_corner: flip depth of left face (east-side corners) */
  flipL?: boolean;
  /** For wall_corner: flip depth of right face (south-side corners) */
  flipR?: boolean;
}

const PALETTES = {
  stone:   { face: 0x8a8a8a, inner: 0x757575, side: 0x636363, top: 0xb0b0b0, trim: 0x3a3a3a, mortar: 0x555555 },
  wood:    { face: 0x7a5c1e, inner: 0x6a4c0e, side: 0x5a3c0e, top: 0x9a7c2e, trim: 0x3a2010, mortar: 0x4a3010 },
  plaster: { face: 0xcfbc96, inner: 0xbfac86, side: 0xaf9c76, top: 0xdfcc96, trim: 0x7a6848, mortar: 0x8a7848 },
};
type Pal = typeof PALETTES.stone;

// ─── Public class ─────────────────────────────────────────────────────────────

export class StructureRenderer {
  public container: Container;
  private pieces: Container[] = [];
  private pieceFloors: number[] = [];  // parallel to pieces — floor index (0, 1, …)

  constructor() {
    this.container = new Container();
    this.container.sortableChildren = true;
  }

  loadWalls(walls: WallPiece[]): void {
    this.clear();
    for (const w of walls) {
      const piece = buildPiece(w);
      if (!piece) continue;
      const elev = (w.elevation ?? 0) * FLOOR_ELEVATION;
      const { sx, sy } = worldToScreen(w.tileX, w.tileZ, elev);
      piece.position.set(sx, sy);
      piece.zIndex = (w.tileX + w.tileZ) * 10 + (w.elevation ?? 0) * 1000 + 3;
      this.container.addChild(piece);
      this.pieces.push(piece);
      this.pieceFloors.push(w.elevation ?? 0);
    }
  }

  /**
   * When the player is under cover (inside a building with floors above),
   * fade all pieces above playerFloor to 10% opacity so the player is visible.
   */
  updateFloorVisibility(playerFloor: number, isUnderCover: boolean): void {
    for (let i = 0; i < this.pieces.length; i++) {
      this.pieces[i].alpha = (isUnderCover && this.pieceFloors[i] > playerFloor) ? 0.1 : 1.0;
    }
  }

  clear(): void {
    for (const p of this.pieces) p.destroy({ children: true });
    this.pieceFloors = [];
    this.pieces = [];
  }

  dispose(): void { this.clear(); this.container.destroy(); }
}

// ─── Piece builder ────────────────────────────────────────────────────────────

function buildPiece(w: WallPiece): Container {
  const c   = new Container();
  const pal = PALETTES[w.material] ?? PALETTES.stone;
  switch (w.type) {
    case "wall_left":      case "wall_left_door":  case "wall_left_win":
      drawLeft(c, pal, w.type, !!w.flip); break;
    case "wall_right":     case "wall_right_door": case "wall_right_win":
      drawRight(c, pal, w.type, !!w.flip); break;
    case "wall_corner":
      drawCorner(c, pal, !!w.flipL, !!w.flipR); break;
    case "stair_left":  drawStair(c, pal, "stair_left");  break;
    case "stair_right": drawStair(c, pal, "stair_right"); break;
    case "floor":       drawFloor(c, pal); break;
  }
  return c;
}

// ─── NW-face wall ─────────────────────────────────────────────────────────────

function drawLeft(c: Container, pal: Pal, type: string, flip: boolean) {
  const g = new Graphics();
  // Depth direction: +x world (west wall) or -x world (east wall, flip=true)
  const dx = flip ? -L_DX : L_DX;
  const dy = flip ? -L_DY : L_DY;

  if (type === "wall_left_door") {
    const fw = 3;
    g.poly([{ x: -hw, y: 0 },    { x: -hw+fw, y: -fw*.5 }, { x: -hw+fw, y: -WALL_H }, { x: -hw, y: -WALL_H }]); g.fill(pal.face);
    g.poly([{ x: -fw*2, y: -hh+fw }, { x: 0, y: -hh },    { x: 0, y: -WALL_H }, { x: -fw*2, y: -WALL_H+fw }]); g.fill(pal.face);
    g.poly([{ x: -hw, y: -WALL_H }, { x: 0, y: -hh-WALL_H }, { x: 0, y: -hh-WALL_H+fw*2 }, { x: -hw, y: -WALL_H+fw*2 }]); g.fill(pal.face);
    topLeft(g, pal, dx, dy);
    c.addChild(g); return;
  }

  if (type === "wall_left_win") {
    const wT = WALL_H * .6, wB = WALL_H * .25, wL = .3, wR = .7;
    const lx = (t: number) => -hw + hw * t, ly = (t: number) => -hh * t;
    g.poly([{ x: -hw, y: 0 },    { x: 0, y: -hh },       { x: 0, y: -hh-wB },    { x: -hw, y: -wB    }]); g.fill(pal.face);
    g.poly([{ x: -hw, y: -wT },  { x: 0, y: -hh-wT },    { x: 0, y: -hh-WALL_H },{ x: -hw, y: -WALL_H}]); g.fill(pal.face);
    g.poly([{ x: -hw, y: -wB },  { x: lx(wL), y: ly(wL)-wB }, { x: lx(wL), y: ly(wL)-wT }, { x: -hw, y: -wT }]); g.fill(pal.face);
    g.poly([{ x: lx(wR), y: ly(wR)-wB }, { x: 0, y: -hh-wB }, { x: 0, y: -hh-wT }, { x: lx(wR), y: ly(wR)-wT }]); g.fill(pal.face);
    g.moveTo(lx(wL), ly(wL)-wB); g.lineTo(lx(wR), ly(wR)-wB); g.lineTo(lx(wR), ly(wR)-wT); g.lineTo(lx(wL), ly(wL)-wT); g.lineTo(lx(wL), ly(wL)-wB);
    g.stroke({ width: 1.5, color: pal.trim });
    topLeft(g, pal, dx, dy);
    detail(g, pal, "left");
    c.addChild(g); return;
  }

  // Solid 3D wall
  // Outer face
  g.poly([{ x: -hw, y: 0 }, { x: 0, y: -hh }, { x: 0, y: -hh-WALL_H }, { x: -hw, y: -WALL_H }]);
  g.fill(pal.face);
  // Top face (depth strip, going toward interior)
  topLeft(g, pal, dx, dy);
  // Inner face (visible from inside the building)
  g.poly([{ x: -hw+dx, y: dy }, { x: dx, y: -hh+dy }, { x: dx, y: -hh-WALL_H+dy }, { x: -hw+dx, y: -WALL_H+dy }]);
  g.fill(pal.inner);
  // Outer edge
  g.moveTo(-hw, 0); g.lineTo(0, -hh); g.lineTo(0, -hh-WALL_H); g.lineTo(-hw, -WALL_H); g.lineTo(-hw, 0);
  g.stroke({ width: 1, color: pal.trim, alpha: 0.5 });
  detail(g, pal, "left");
  c.addChild(g);
}

// ─── NE-face wall ─────────────────────────────────────────────────────────────

function drawRight(c: Container, pal: Pal, type: string, flip: boolean) {
  const g = new Graphics();
  // Depth direction: -x world (north wall) or +z→-z world (south wall, flip=true)
  const dx = flip ? -R_DX : R_DX;  // flip: -(-4)=+4   no-flip: -4
  const dy = flip ? -R_DY : R_DY;  // flip: -(+2)=-2   no-flip: +2

  if (type === "wall_right_door") {
    const fw = 3;
    g.poly([{ x: 0, y: -hh }, { x: fw*2, y: -hh+fw }, { x: fw*2, y: -WALL_H+fw }, { x: 0, y: -WALL_H }]); g.fill(pal.side);
    g.poly([{ x: hw-fw, y: -fw*.5 }, { x: hw, y: 0 }, { x: hw, y: -WALL_H }, { x: hw-fw, y: -WALL_H }]); g.fill(pal.side);
    g.poly([{ x: 0, y: -hh-WALL_H }, { x: hw, y: -WALL_H }, { x: hw, y: -WALL_H+fw*2 }, { x: 0, y: -hh-WALL_H+fw*2 }]); g.fill(pal.side);
    topRight(g, pal, dx, dy);
    c.addChild(g); return;
  }

  if (type === "wall_right_win") {
    const wT = WALL_H * .6, wB = WALL_H * .25, wL = .3, wR = .7;
    const lx = (t: number) => hw * t, ly = (t: number) => -hh * t;
    g.poly([{ x: 0, y: -hh }, { x: hw, y: 0 }, { x: hw, y: -wB }, { x: 0, y: -hh-wB }]); g.fill(pal.side);
    g.poly([{ x: 0, y: -hh-wT }, { x: hw, y: -wT }, { x: hw, y: -WALL_H }, { x: 0, y: -hh-WALL_H }]); g.fill(pal.side);
    g.poly([{ x: 0, y: -hh-wB }, { x: lx(wL), y: ly(wL)-wB }, { x: lx(wL), y: ly(wL)-wT }, { x: 0, y: -hh-wT }]); g.fill(pal.side);
    g.poly([{ x: lx(wR), y: ly(wR)-wB }, { x: hw, y: -wB }, { x: hw, y: -wT }, { x: lx(wR), y: ly(wR)-wT }]); g.fill(pal.side);
    g.moveTo(lx(wL), ly(wL)-wB); g.lineTo(lx(wR), ly(wR)-wB); g.lineTo(lx(wR), ly(wR)-wT); g.lineTo(lx(wL), ly(wL)-wT); g.lineTo(lx(wL), ly(wL)-wB);
    g.stroke({ width: 1.5, color: pal.trim });
    topRight(g, pal, dx, dy);
    detail(g, pal, "right");
    c.addChild(g); return;
  }

  // Solid 3D wall
  g.poly([{ x: 0, y: -hh }, { x: hw, y: 0 }, { x: hw, y: -WALL_H }, { x: 0, y: -hh-WALL_H }]);
  g.fill(pal.side);
  topRight(g, pal, dx, dy);
  g.poly([{ x: dx, y: -hh+dy }, { x: hw+dx, y: dy }, { x: hw+dx, y: -WALL_H+dy }, { x: dx, y: -hh-WALL_H+dy }]);
  g.fill(pal.inner);
  g.moveTo(0, -hh); g.lineTo(hw, 0); g.lineTo(hw, -WALL_H); g.lineTo(0, -hh-WALL_H); g.lineTo(0, -hh);
  g.stroke({ width: 1, color: pal.trim, alpha: 0.5 });
  detail(g, pal, "right");
  c.addChild(g);
}

// ─── Corner post ─────────────────────────────────────────────────────────────
// Full tile width so walls connect flush. Distinguished from flat wall panels
// by showing BOTH faces, an L-shaped top cap, and a center ridge line.

function drawCorner(c: Container, pal: Pal, flipL: boolean, flipR: boolean) {
  const g = new Graphics();
  const ldx = flipL ? -L_DX : L_DX;
  const ldy = flipL ? -L_DY : L_DY;
  const rdx = flipR ? -R_DX : R_DX;
  const rdy = flipR ? -R_DY : R_DY;

  // Left face (NW)
  g.poly([{ x: -hw, y: 0 }, { x: 0, y: -hh }, { x: 0, y: -hh-WALL_H }, { x: -hw, y: -WALL_H }]);
  g.fill(pal.face);

  // Right face (NE)
  g.poly([{ x: 0, y: -hh }, { x: hw, y: 0 }, { x: hw, y: -WALL_H }, { x: 0, y: -hh-WALL_H }]);
  g.fill(pal.side);

  // L-shaped top cap: left arm + right arm meeting at (0, -hh-WALL_H)
  // Left arm
  g.poly([
    { x: -hw,     y: -WALL_H      }, { x: 0,       y: -hh-WALL_H     },
    { x: ldx,     y: -hh-WALL_H+ldy }, { x: -hw+ldx, y: -WALL_H+ldy   },
  ]); g.fill(pal.top);
  // Right arm
  g.poly([
    { x: 0,       y: -hh-WALL_H     }, { x: hw,      y: -WALL_H      },
    { x: hw+rdx,  y: -WALL_H+rdy    }, { x: rdx,     y: -hh-WALL_H+rdy },
  ]); g.fill(pal.top);

  // Perimeter + center ridge (distinguishes this as a corner, not a flat wall)
  g.moveTo(-hw, 0); g.lineTo(0, -hh); g.lineTo(hw, 0);
  g.moveTo(-hw, -WALL_H); g.lineTo(0, -hh-WALL_H); g.lineTo(hw, -WALL_H);
  g.moveTo(-hw, 0); g.lineTo(-hw, -WALL_H);
  g.moveTo(hw, 0);  g.lineTo(hw, -WALL_H);
  g.moveTo(0, -hh); g.lineTo(0, -hh-WALL_H);  // center ridge
  g.stroke({ width: 1.5, color: pal.trim });

  c.addChild(g);
}

// ─── Shared helpers ───────────────────────────────────────────────────────────

function topLeft(g: Graphics, pal: Pal, dx: number, dy: number) {
  g.poly([
    { x: -hw,    y: -WALL_H     }, { x: 0,    y: -hh-WALL_H     },
    { x: dx,     y: -hh-WALL_H+dy }, { x: -hw+dx, y: -WALL_H+dy   },
  ]);
  g.fill(pal.top);
}

function topRight(g: Graphics, pal: Pal, dx: number, dy: number) {
  g.poly([
    { x: 0,     y: -hh-WALL_H   }, { x: hw,     y: -WALL_H      },
    { x: hw+dx, y: -WALL_H+dy   }, { x: dx,     y: -hh-WALL_H+dy },
  ]);
  g.fill(pal.top);
}

function detail(g: Graphics, pal: Pal, side: "left" | "right") {
  if (pal === PALETTES.stone) {
    for (let i = 1; i <= 3; i++) {
      const y = -(WALL_H * i) / 4;
      if (side === "left") { g.moveTo(-hw, y); g.lineTo(0, y - hh); }
      else                 { g.moveTo(0, y - hh); g.lineTo(hw, y); }
      g.stroke({ width: 0.5, color: pal.mortar, alpha: 0.4 });
    }
  } else if (pal === PALETTES.wood) {
    for (let i = 1; i <= 3; i++) {
      const x = side === "left" ? -hw + (hw * i) / 4 : (hw * i) / 4;
      g.moveTo(x, 0); g.lineTo(x, -WALL_H);
      g.stroke({ width: 0.5, color: pal.mortar, alpha: 0.4 });
    }
  }
}

// ─── Stairs ───────────────────────────────────────────────────────────────────

function drawStair(c: Container, pal: Pal, type: "stair_left" | "stair_right") {
  const g = new Graphics();
  const N = 4;
  const stepH = WALL_H / N; // 13px per step

  for (let i = 0; i < N; i++) {
    const t0 = i / N, t1 = (i + 1) / N;
    const h0 = i * stepH, h1 = (i + 1) * stepH;

    if (type === "stair_left") {
      // Steps along NW diagonal, ascending from right/bottom to left/top
      const x0 = -hw + hw * t0, y0 = -hh * t0;
      const x1 = -hw + hw * t1, y1 = -hh * t1;

      // Riser (front face of this step)
      g.poly([{ x: x0, y: y0 - h0 }, { x: x1, y: y1 - h0 }, { x: x1, y: y1 - h1 }, { x: x0, y: y0 - h1 }]);
      g.fill(pal.face);

      // Tread (top horizontal surface at h1)
      g.poly([{ x: x0, y: y0 - h1 }, { x: x1, y: y1 - h1 }, { x: x1 + L_DX, y: y1 - h1 + L_DY }, { x: x0 + L_DX, y: y0 - h1 + L_DY }]);
      g.fill(pal.top);

      // Outline
      g.moveTo(x0, y0 - h0); g.lineTo(x1, y1 - h0); g.lineTo(x1, y1 - h1); g.lineTo(x0, y0 - h1); g.lineTo(x0, y0 - h0);
      g.stroke({ width: 0.5, color: pal.trim, alpha: 0.7 });
    } else {
      // stair_right: steps along NE diagonal, ascending from left/bottom to right/top
      const x0 = hw * t0, y0 = -hh * t0;
      const x1 = hw * t1, y1 = -hh * t1;

      // Riser (front face of this step)
      g.poly([{ x: x0, y: y0 - h0 }, { x: x1, y: y1 - h0 }, { x: x1, y: y1 - h1 }, { x: x0, y: y0 - h1 }]);
      g.fill(pal.side);

      // Tread (top horizontal surface at h1)
      g.poly([{ x: x0, y: y0 - h1 }, { x: x1, y: y1 - h1 }, { x: x1 + R_DX, y: y1 - h1 + R_DY }, { x: x0 + R_DX, y: y0 - h1 + R_DY }]);
      g.fill(pal.top);

      // Outline
      g.moveTo(x0, y0 - h0); g.lineTo(x1, y1 - h0); g.lineTo(x1, y1 - h1); g.lineTo(x0, y0 - h1); g.lineTo(x0, y0 - h0);
      g.stroke({ width: 0.5, color: pal.trim, alpha: 0.7 });
    }
  }
  c.addChild(g);
}

// ─── Floor panel ──────────────────────────────────────────────────────────────

function drawFloor(c: Container, pal: Pal) {
  const g = new Graphics();
  // Full tile diamond top surface
  g.poly([{ x: -hw, y: 0 }, { x: 0, y: -hh }, { x: hw, y: 0 }, { x: 0, y: hh }]);
  g.fill(pal.top);
  g.moveTo(-hw, 0); g.lineTo(0, -hh); g.lineTo(hw, 0); g.lineTo(0, hh); g.lineTo(-hw, 0);
  g.stroke({ width: 0.5, color: pal.trim, alpha: 0.3 });
  c.addChild(g);
}

// ─── Building factory ─────────────────────────────────────────────────────────

export function makeHouse(
  x0: number, z0: number,
  w: number, d: number,
  mat: WallPiece["material"] = "stone",
  doorWall: "n" | "e" | "s" | "w" = "s",
  doorTile = Math.floor(w / 2),
  floors: 1 | 2 = 1,
): WallPiece[] {
  const pieces: WallPiece[] = [];
  const x1 = x0 + w - 1;
  const z1 = z0 + d - 1;

  // North wall — wall_right, interior toward south (+z) — no flip
  for (let x = x0; x <= x1; x++) {
    const isDoor = doorWall === "n" && x === x0 + doorTile;
    pieces.push({ tileX: x, tileZ: z0-1, material: mat,
      type: isDoor ? "wall_right_door" : "wall_right" });
  }

  // South wall — wall_right, interior toward north (-z) — flip
  for (let x = x0; x <= x1; x++) {
    const isDoor = doorWall === "s" && x === x0 + doorTile;
    const isWin  = !isDoor && x % 2 === 1;
    pieces.push({ tileX: x, tileZ: z0+d, material: mat, flip: true,
      type: isDoor ? "wall_right_door" : isWin ? "wall_right_win" : "wall_right" });
  }

  // West wall — wall_left, interior toward east (+x) — no flip
  for (let z = z0; z <= z1; z++) {
    const isDoor = doorWall === "w" && z === z0 + Math.floor(d/2);
    const isWin  = !isDoor && z % 2 === 0;
    pieces.push({ tileX: x0-1, tileZ: z, material: mat,
      type: isDoor ? "wall_left_door" : isWin ? "wall_left_win" : "wall_left" });
  }

  // East wall — wall_left, interior toward west (-x) — flip
  for (let z = z0; z <= z1; z++) {
    const isDoor = doorWall === "e" && z === z0 + Math.floor(d/2);
    const isWin  = !isDoor && z % 2 === 0;
    pieces.push({ tileX: x0+w, tileZ: z, material: mat, flip: true,
      type: isDoor ? "wall_left_door" : isWin ? "wall_left_win" : "wall_left" });
  }

  // Corners — full tile, L-shaped top, flip matches adjacent walls
  pieces.push({ tileX: x0-1, tileZ: z0-1, material: mat, type: "wall_corner", flipL: false, flipR: false }); // NW
  pieces.push({ tileX: x0+w, tileZ: z0-1, material: mat, type: "wall_corner", flipL: true,  flipR: false }); // NE
  pieces.push({ tileX: x0-1, tileZ: z0+d, material: mat, type: "wall_corner", flipL: false, flipR: true  }); // SW
  pieces.push({ tileX: x0+w, tileZ: z0+d, material: mat, type: "wall_corner", flipL: true,  flipR: true  }); // SE

  if (floors === 2) {
    // Second-floor walls (no door, with windows, elevation=1)
    // North wall
    for (let x = x0; x <= x1; x++) {
      const isWin = x % 2 === 1;
      pieces.push({ tileX: x, tileZ: z0-1, material: mat, type: isWin ? "wall_right_win" : "wall_right", elevation: 1 });
    }
    // South wall
    for (let x = x0; x <= x1; x++) {
      const isWin = x % 2 === 1;
      pieces.push({ tileX: x, tileZ: z0+d, material: mat, type: isWin ? "wall_right_win" : "wall_right", elevation: 1, flip: true });
    }
    // West wall
    for (let z = z0; z <= z1; z++) {
      const isWin = z % 2 === 0;
      pieces.push({ tileX: x0-1, tileZ: z, material: mat, type: isWin ? "wall_left_win" : "wall_left", elevation: 1 });
    }
    // East wall
    for (let z = z0; z <= z1; z++) {
      const isWin = z % 2 === 0;
      pieces.push({ tileX: x0+w, tileZ: z, material: mat, type: isWin ? "wall_left_win" : "wall_left", elevation: 1, flip: true });
    }
    // Second-floor corners
    pieces.push({ tileX: x0-1, tileZ: z0-1, material: mat, type: "wall_corner", elevation: 1, flipL: false, flipR: false });
    pieces.push({ tileX: x0+w, tileZ: z0-1, material: mat, type: "wall_corner", elevation: 1, flipL: true,  flipR: false });
    pieces.push({ tileX: x0-1, tileZ: z0+d, material: mat, type: "wall_corner", elevation: 1, flipL: false, flipR: true  });
    pieces.push({ tileX: x0+w, tileZ: z0+d, material: mat, type: "wall_corner", elevation: 1, flipL: true,  flipR: true  });

    // Second-floor floor panels for every interior tile
    for (let x = x0; x <= x1; x++) {
      for (let z = z0; z <= z1; z++) {
        pieces.push({ tileX: x, tileZ: z, material: mat, type: "floor", elevation: 1 });
      }
    }

    // Stair at NW interior corner (x0, z0), ascending in +z direction
    pieces.push({ tileX: x0, tileZ: z0, material: mat, type: "stair_left", elevation: 0 });
  }

  return pieces;
}
