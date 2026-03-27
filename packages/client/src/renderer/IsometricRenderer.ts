import { Container, Graphics } from "pixi.js";

// Standard isometric tile dimensions (2:1 ratio)
export const TILE_WIDTH = 64;
export const TILE_HEIGHT = 32;
export const TILE_WIDTH_HALF = TILE_WIDTH / 2;
export const TILE_HEIGHT_HALF = TILE_HEIGHT / 2;

// How many pixels one unit of elevation offsets a tile upward
export const ELEVATION_PX = 16;

/**
 * Convert world tile coords + elevation to screen pixel coords.
 * Integer tile coords map to the CENTRE of that tile's diamond.
 * (tile 0,0 centre = screen origin; tile 1,0 centre = +32,+16; etc.)
 */
export function worldToScreen(
  tileX: number,
  tileZ: number,
  elevation = 0,
): { sx: number; sy: number } {
  return {
    sx: (tileX - tileZ) * TILE_WIDTH_HALF,
    sy: (tileX + tileZ + 1) * TILE_HEIGHT_HALF - elevation * ELEVATION_PX,
  };
}

/** Convert screen pixel coords to world tile coords (at elevation 0) */
export function screenToWorld(
  sx: number,
  sy: number,
): { tileX: number; tileZ: number } {
  // Inverse: adjust for the +TILE_HEIGHT_HALF centre offset then un-project
  const adjustedSy = sy - TILE_HEIGHT_HALF;
  const tileX = (sx / TILE_WIDTH_HALF + adjustedSy / TILE_HEIGHT_HALF) / 2;
  const tileZ = (adjustedSy / TILE_HEIGHT_HALF - sx / TILE_WIDTH_HALF) / 2;
  return { tileX, tileZ };
}

/** Biome color palette for the PoC (matches existing TileRegistry roughly) */
const BIOME_COLORS: Record<number, number> = {
  0: 0x0a1a3a, // DEEP_OCEAN
  1: 0x1a3a5a, // SHALLOW_OCEAN
  2: 0xd4c090, // BEACH
  3: 0x4a8c3f, // TEMPERATE_GRASSLAND
  4: 0x2d6e2d, // TEMPERATE_FOREST
  5: 0x1a5a1a, // DENSE_FOREST
  6: 0x3a6e4a, // BOREAL_FOREST
  7: 0x7a7a7a, // MOUNTAIN
  8: 0xd8d8e8, // SNOW_PEAK
  9: 0x8a9a8a, // TUNDRA
  10: 0xc8a848, // DESERT
  11: 0x9a8a4a, // SCRUBLAND
  12: 0x4a6a3a, // SWAMP
  13: 0x6a7a5a, // HIGHLAND
  14: 0x5a9a4a, // MEADOW
  15: 0x3a6a8a, // RIVER_VALLEY
  16: 0x2a5a7a, // RIVER
  17: 0x2a4a6a, // LAKE
};

export interface TileData {
  x: number;
  z: number;
  elevation: number;
  biome: number;
}

/**
 * Renders an isometric tile grid using PixiJS Graphics.
 * For the PoC we draw diamond-shaped colored tiles.
 * In production this will use @pixi/tilemap with sprite atlases.
 */
export class IsometricRenderer {
  public container: Container;
  private tileGraphics = new Map<string, Graphics>();

  constructor() {
    this.container = new Container();
    this.container.sortableChildren = true;
  }

  /** Render a set of tiles. Clears previous tiles. */
  renderTiles(tiles: TileData[]): void {
    this.clear();

    for (const tile of tiles) {
      const g = new Graphics();
      const color = BIOME_COLORS[tile.biome] ?? 0x888888;
      const { sx, sy } = worldToScreen(tile.x, tile.z, tile.elevation);

      // Draw isometric diamond (top face)
      g.poly([
        { x: 0, y: -TILE_HEIGHT_HALF },          // top
        { x: TILE_WIDTH_HALF, y: 0 },             // right
        { x: 0, y: TILE_HEIGHT_HALF },             // bottom
        { x: -TILE_WIDTH_HALF, y: 0 },             // left
      ]);
      g.fill(color);

      // Draw left face (darker shade) for elevation
      if (tile.elevation > 0) {
        const faceHeight = tile.elevation * ELEVATION_PX;
        const darkColor = darkenColor(color, 0.6);
        g.poly([
          { x: -TILE_WIDTH_HALF, y: 0 },
          { x: 0, y: TILE_HEIGHT_HALF },
          { x: 0, y: TILE_HEIGHT_HALF + faceHeight },
          { x: -TILE_WIDTH_HALF, y: faceHeight },
        ]);
        g.fill(darkColor);

        // Right face (medium shade)
        const medColor = darkenColor(color, 0.8);
        g.poly([
          { x: TILE_WIDTH_HALF, y: 0 },
          { x: 0, y: TILE_HEIGHT_HALF },
          { x: 0, y: TILE_HEIGHT_HALF + faceHeight },
          { x: TILE_WIDTH_HALF, y: faceHeight },
        ]);
        g.fill(medColor);
      }

      // Tile outline
      g.poly([
        { x: 0, y: -TILE_HEIGHT_HALF },
        { x: TILE_WIDTH_HALF, y: 0 },
        { x: 0, y: TILE_HEIGHT_HALF },
        { x: -TILE_WIDTH_HALF, y: 0 },
      ]);
      g.stroke({ width: 1, color: 0x000000, alpha: 0.15 });

      g.position.set(sx, sy);
      // Z-sort: tiles further from camera (higher x+z) render first,
      // then elevation pushes them up in sort order
      g.zIndex = (tile.x + tile.z) * 10 + tile.elevation;

      this.container.addChild(g);
      this.tileGraphics.set(`${tile.x},${tile.z}`, g);
    }
  }

  clear(): void {
    for (const g of this.tileGraphics.values()) {
      g.destroy();
    }
    this.tileGraphics.clear();
  }

  dispose(): void {
    this.clear();
    this.container.destroy();
  }
}

/** Darken a hex color by a factor (0-1) */
function darkenColor(color: number, factor: number): number {
  const r = Math.floor(((color >> 16) & 0xff) * factor);
  const g = Math.floor(((color >> 8) & 0xff) * factor);
  const b = Math.floor((color & 0xff) * factor);
  return (r << 16) | (g << 8) | b;
}
