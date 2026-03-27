/**
 * Structure Renderer — draws individual wall pieces, doors, windows, and
 * furniture on the isometric tile grid.
 *
 * UO-style: each wall occupies one tile position. A house is built from
 * many wall tiles forming a floor plan. Wall pieces are:
 * - 1 tile wide along their facing direction
 * - Thin (~0.2 tiles deep)
 * - Taller than the player (~48px screen height = "one story")
 *
 * Wall orientations: "n" (NW→SE edge), "e" (NE→SW edge)
 * Combined: "ne" corner piece
 */

import { Container, Graphics } from "pixi.js";
import { worldToScreen, TILE_WIDTH_HALF, TILE_HEIGHT_HALF } from "./IsometricRenderer";

// Wall dimensions in screen pixels
const WALL_HEIGHT = 48;   // Taller than player (~40px)
const WALL_THICKNESS = 4;  // Thin in depth direction

export type WallFacing = "n" | "e" | "ne" | "se" | "nw" | "sw";
export type WallMaterial = "stone" | "wood" | "plaster";

export interface WallPiece {
  tileX: number;
  tileZ: number;
  facing: WallFacing;
  material: WallMaterial;
  variant: string; // "wall", "door", "window", "pillar", "half"
}

export class StructureRenderer {
  public container: Container;
  private pieces: Container[] = [];

  constructor() {
    this.container = new Container();
    this.container.sortableChildren = true;
  }

  loadWalls(walls: WallPiece[]): void {
    this.clear();
    for (const wall of walls) {
      const piece = drawWallPiece(wall);
      if (!piece) continue;
      const { sx, sy } = worldToScreen(wall.tileX, wall.tileZ, 0);
      piece.position.set(sx, sy);
      // Walls sort above ground tiles but below entities walking in front
      piece.zIndex = (wall.tileX + wall.tileZ) * 10 + 2;
      this.container.addChild(piece);
      this.pieces.push(piece);
    }
  }

  clear(): void {
    for (const p of this.pieces) p.destroy({ children: true });
    this.pieces = [];
  }

  dispose(): void {
    this.clear();
    this.container.destroy();
  }
}

// Material color palettes
const PALETTES: Record<WallMaterial, { face: number; side: number; top: number; trim: number }> = {
  stone: { face: 0x888888, side: 0x666666, top: 0x999999, trim: 0x555555 },
  wood:  { face: 0x8B6914, side: 0x6B5314, top: 0x9B7924, trim: 0x5a4510 },
  plaster: { face: 0xd4c4a0, side: 0xb4a480, top: 0xe4d4b0, trim: 0x8B7B58 },
};

function drawWallPiece(wall: WallPiece): Container | null {
  const c = new Container();
  const pal = PALETTES[wall.material] ?? PALETTES.stone;

  if (wall.variant === "pillar") {
    drawPillar(c, pal);
  } else if (wall.facing === "n" || wall.facing === "nw" || wall.facing === "sw") {
    drawNorthWall(c, pal, wall.variant);
  } else if (wall.facing === "e" || wall.facing === "ne" || wall.facing === "se") {
    drawEastWall(c, pal, wall.variant);
  }

  // Corner: draw both walls
  if (wall.facing === "ne") {
    drawNorthWall(c, pal, wall.variant);
    drawEastWall(c, pal, wall.variant);
  }

  return c;
}

/**
 * North-facing wall: runs along the NW→SE edge of the tile diamond.
 * In isometric, this is the LEFT edge of the diamond.
 *
 * The wall face is a parallelogram going from top-left to bottom-right,
 * with height extending upward.
 */
function drawNorthWall(c: Container, pal: typeof PALETTES.stone, variant: string): void {
  const g = new Graphics();
  const hw = TILE_WIDTH_HALF;
  const hh = TILE_HEIGHT_HALF;

  // Wall face (left edge of diamond, extruded upward)
  // Bottom-left of tile diamond = (-hw, 0), top of diamond = (0, -hh)
  // Wall runs from (-hw, 0) to (0, -hh), extruded up by WALL_HEIGHT
  g.poly([
    { x: -hw, y: 0 },                    // bottom-left ground
    { x: 0, y: -hh },                     // top ground
    { x: 0, y: -hh - WALL_HEIGHT },       // top wall-top
    { x: -hw, y: -WALL_HEIGHT },          // bottom-left wall-top
  ]);
  g.fill(pal.face);
  g.stroke({ width: 1, color: pal.trim, alpha: 0.5 });

  // Top face (thin depth visible from above)
  g.poly([
    { x: -hw, y: -WALL_HEIGHT },
    { x: -hw + WALL_THICKNESS, y: -WALL_HEIGHT + WALL_THICKNESS / 2 },
    { x: WALL_THICKNESS, y: -hh - WALL_HEIGHT + WALL_THICKNESS / 2 },
    { x: 0, y: -hh - WALL_HEIGHT },
  ]);
  g.fill(pal.top);

  // Window cutout
  if (variant === "window") {
    const wx = -hw * 0.55;
    const wy = -WALL_HEIGHT * 0.55;
    g.rect(wx, wy, 12, 10);
    g.fill(0x88bbdd);
    g.stroke({ width: 0.5, color: pal.trim });
  }

  // Door cutout
  if (variant === "door") {
    g.poly([
      { x: -hw * 0.65, y: 0 },
      { x: -hw * 0.35, y: -hh * 0.3 },
      { x: -hw * 0.35, y: -hh * 0.3 - 28 },
      { x: -hw * 0.65, y: -28 },
    ]);
    g.fill(0x3a2510);
  }

  // Brick/plank detail lines
  if (pal === PALETTES.stone) {
    for (let i = 1; i < 4; i++) {
      const y = -WALL_HEIGHT * (i / 4);
      g.moveTo(-hw, y);
      g.lineTo(0, y - hh);
      g.stroke({ width: 0.5, color: pal.trim, alpha: 0.2 });
    }
  }

  c.addChild(g);
}

/**
 * East-facing wall: runs along the NE→SW edge of the tile diamond.
 * This is the RIGHT edge of the diamond.
 */
function drawEastWall(c: Container, pal: typeof PALETTES.stone, variant: string): void {
  const g = new Graphics();
  const hw = TILE_WIDTH_HALF;
  const hh = TILE_HEIGHT_HALF;

  // Wall face (right edge of diamond, extruded upward)
  // Top of diamond = (0, -hh), bottom-right = (hw, 0)
  g.poly([
    { x: 0, y: -hh },                     // top ground
    { x: hw, y: 0 },                      // bottom-right ground
    { x: hw, y: -WALL_HEIGHT },           // bottom-right wall-top
    { x: 0, y: -hh - WALL_HEIGHT },       // top wall-top
  ]);
  g.fill(pal.side); // Slightly darker for depth
  g.stroke({ width: 1, color: pal.trim, alpha: 0.5 });

  // Top face
  g.poly([
    { x: 0, y: -hh - WALL_HEIGHT },
    { x: -WALL_THICKNESS, y: -hh - WALL_HEIGHT + WALL_THICKNESS / 2 },
    { x: hw - WALL_THICKNESS, y: -WALL_HEIGHT + WALL_THICKNESS / 2 },
    { x: hw, y: -WALL_HEIGHT },
  ]);
  g.fill(pal.top);

  // Window cutout
  if (variant === "window") {
    const wx = hw * 0.3;
    const wy = -WALL_HEIGHT * 0.55;
    g.rect(wx, wy, 12, 10);
    g.fill(0x88bbdd);
    g.stroke({ width: 0.5, color: pal.trim });
  }

  // Door cutout
  if (variant === "door") {
    g.poly([
      { x: hw * 0.35, y: -hh * 0.3 },
      { x: hw * 0.65, y: 0 },
      { x: hw * 0.65, y: -28 },
      { x: hw * 0.35, y: -hh * 0.3 - 28 },
    ]);
    g.fill(0x3a2510);
  }

  // Detail lines
  if (pal === PALETTES.stone) {
    for (let i = 1; i < 4; i++) {
      const y = -WALL_HEIGHT * (i / 4);
      g.moveTo(0, y - hh);
      g.lineTo(hw, y);
      g.stroke({ width: 0.5, color: pal.trim, alpha: 0.2 });
    }
  }

  c.addChild(g);
}

/** Corner pillar — sits at a tile intersection */
function drawPillar(c: Container, pal: typeof PALETTES.stone): void {
  const g = new Graphics();
  const s = 4; // Pillar half-size
  g.poly([
    { x: 0, y: -s },
    { x: s, y: 0 },
    { x: 0, y: s },
    { x: -s, y: 0 },
  ]);
  g.fill(pal.face);
  // Extrude upward
  g.rect(-s, -WALL_HEIGHT - s, s * 2, WALL_HEIGHT);
  g.fill(pal.face);
  g.stroke({ width: 1, color: pal.trim, alpha: 0.3 });
  // Cap
  g.poly([
    { x: 0, y: -WALL_HEIGHT - s * 2 },
    { x: s + 1, y: -WALL_HEIGHT - s },
    { x: 0, y: -WALL_HEIGHT },
    { x: -s - 1, y: -WALL_HEIGHT - s },
  ]);
  g.fill(pal.top);
  c.addChild(g);
}

/**
 * Helper: generate wall pieces for a rectangular building floor plan.
 * Returns an array of WallPiece definitions.
 */
export function generateBuildingWalls(
  originX: number, originZ: number,
  width: number, depth: number,
  material: WallMaterial = "stone",
  doorSide: "n" | "e" | "s" | "w" = "s",
  doorPos: number = Math.floor(width / 2),
): WallPiece[] {
  const walls: WallPiece[] = [];

  // North wall (top-left edge, running east)
  for (let i = 0; i < width; i++) {
    const isDoor = doorSide === "n" && i === doorPos;
    walls.push({
      tileX: originX + i, tileZ: originZ,
      facing: "n", material,
      variant: isDoor ? "door" : (i % 3 === 1 ? "window" : "wall"),
    });
  }

  // South wall
  for (let i = 0; i < width; i++) {
    const isDoor = doorSide === "s" && i === doorPos;
    walls.push({
      tileX: originX + i, tileZ: originZ + depth,
      facing: "n", material,
      variant: isDoor ? "door" : (i % 3 === 1 ? "window" : "wall"),
    });
  }

  // West wall (left edge, running south)
  for (let j = 0; j < depth; j++) {
    const isDoor = doorSide === "w" && j === Math.floor(depth / 2);
    walls.push({
      tileX: originX, tileZ: originZ + j,
      facing: "e", material,
      variant: isDoor ? "door" : (j % 3 === 1 ? "window" : "wall"),
    });
  }

  // East wall
  for (let j = 0; j < depth; j++) {
    const isDoor = doorSide === "e" && j === Math.floor(depth / 2);
    walls.push({
      tileX: originX + width, tileZ: originZ + j,
      facing: "e", material,
      variant: isDoor ? "door" : (j % 3 === 1 ? "window" : "wall"),
    });
  }

  // Corner pillars
  walls.push({ tileX: originX, tileZ: originZ, facing: "ne", material, variant: "pillar" });
  walls.push({ tileX: originX + width, tileZ: originZ, facing: "ne", material, variant: "pillar" });
  walls.push({ tileX: originX, tileZ: originZ + depth, facing: "ne", material, variant: "pillar" });
  walls.push({ tileX: originX + width, tileZ: originZ + depth, facing: "ne", material, variant: "pillar" });

  return walls;
}
