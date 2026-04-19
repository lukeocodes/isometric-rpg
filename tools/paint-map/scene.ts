// Scene spec schema — the human-authored JSON that drives the painter.

export type Region = {
  /** Tile-grid coordinates (top-left corner). */
  x: number;
  y: number;
  /** Width/height in tiles. */
  w: number;
  h: number;
  /** Wang colour name, resolved against the layer's wangset. */
  fill: string;
};

export type GroundSpec = {
  /** Name of the wangset inside the ground tileset. */
  wangset: string;
  /** Regions applied in order; later regions overwrite earlier corners. */
  regions: Region[];
};

export type WallsSpec = {
  /** Rectangle of the tree-wall border in LARGE-tile coordinates. */
  rect: { x: number; y: number; w: number; h: number };
};

export type ObjectSpec = {
  type: string;
  /** Optional display name. */
  name?: string;
  /** Position in tile coordinates (origin = top-left). */
  tile: { x: number; y: number };
  /** Tile-centre offset in pixels (defaults to 0.5, 0.5 = tile centre). */
  anchor?: { x: number; y: number };
  /** Extra Tiled properties. */
  properties?: Record<string, boolean | number | string>;
};

export type SceneSpec = {
  size: { w: number; h: number };
  tilewidth?: number; // defaults to 16
  tileheight?: number; // defaults to 16

  /** Map of logical name → TSX filename (relative to TMX output dir). */
  tilesets: {
    /** Required: wang tileset used by ground layer. */
    ground: string;
    /** Required for walls: tree-wall wall tileset. */
    wall?: string;
    /** Optional: canopy tileset rendered above player. */
    canopy?: string;
  };

  ground: GroundSpec;
  walls?: WallsSpec;
  objects?: {
    /** Name of the object group → array of objects */
    [groupName: string]: ObjectSpec[];
  };
};
