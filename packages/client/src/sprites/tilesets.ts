// Mana Seed Tileset Registry
// ==========================
// Maps terrain types, tile indices, transitions, and animation data
// sourced directly from the Mana Seed TSX files.
//
// IMPORTANT: The TSX files in /public/assets/tilesets/tsx/ are the
// authoritative source for wang tile IDs and transition rules.
// This file provides a typed, runtime-usable summary.
//
// ─── COORDINATE SYSTEM ─────────────────────────────────────────────────────
// All tile indices (id) are 0-based within their sheet.
// id = row * cols + col   (cols = sheet width / frameW)
// Summer forest sheet: 32 cols × 21 rows, 16×16px = 672 tiles total.
//
// ─── TWO TILESET SYSTEMS ───────────────────────────────────────────────────
// 1. WANG TILES (summer forest wang tiles.png, 1024×512, 64 cols × 32 rows)
//    These are the CORRECT system for autotiling terrain transitions.
//    Use these for: grass↔dirt, grass↔water, grass↔dark grass, cobblestone.
//    The wang tile system supports 6 terrain types, all pairwise.
//
// 2. NON-WANG TILES (summer forest.png, 512×336, 32 cols × 21 rows)
//    These are corner-based autotile sets — easier for manual placement.
//    The TSX defines 9 transition sets for these.
//    Use these for: water↔shallow, undergrowth, stone path, etc.
//
// Both systems exist in each seasonal variant with identical terrain slots.

// ─────────────────────────────────────────────────────────────────────────────
// TERRAIN TYPES
// These names are consistent across all seasons (summer/spring/autumn/winter).
// ─────────────────────────────────────────────────────────────────────────────

export type TerrainType =
  | "light_grass"     // Primary walkable ground — most of the map
  | "dark_grass"      // Accent grass, denser/darker
  | "dirt"            // Bare earth, paths, farm plots
  | "stone_path"      // Cobblestone / paved paths
  | "shallow_water"   // Wading depth, walkable (slow)
  | "deep_water"      // Impassable water
  | "undergrowth"     // Dense foliage overlay, walk-through
  | "cobblestone";    // Town/dungeon floors (wang system name)

// ─────────────────────────────────────────────────────────────────────────────
// WANG TILE TERRAIN INDICES
// From: summer forest wang tiles.tsx
// Sheet: summer forest wang tiles.png (1024×512, 64 cols × 32 rows, 16×16)
// Wang type: corner (each corner of a tile has a terrain value 1-6)
//
// Terrain ID mapping (wang color index → terrain name):
//   1 = dirt          (tile 128 = pure dirt fill)
//   2 = light_grass   (tile 129 = pure light grass fill)
//   3 = dark_grass    (tile 130 = pure dark grass fill)
//   4 = cobblestone   (tile 131 = pure cobblestone fill)
//   5 = shallow_water (tile 132 = pure shallow water fill)
//   6 = deep_water    (tile 133 = pure deep water fill)
// ─────────────────────────────────────────────────────────────────────────────

export const WANG_TERRAIN_FILLS: Record<TerrainType, number> = {
  dirt:          128, // wang color 1
  light_grass:   129, // wang color 2
  dark_grass:    130, // wang color 3
  cobblestone:   131, // wang color 4
  shallow_water: 132, // wang color 5
  deep_water:    133, // wang color 6
  undergrowth:   46,  // non-wang only (summer forest.png)
  stone_path:    10,  // non-wang only (summer forest.png)
};

// Valid terrain transitions (which pairs have autotile wang data)
// All 6 wang terrains can transition with each other.
export const WANG_TRANSITIONS: Array<[TerrainType, TerrainType]> = [
  ["light_grass",   "dark_grass"],
  ["light_grass",   "dirt"],
  ["light_grass",   "cobblestone"],
  ["light_grass",   "shallow_water"],
  ["light_grass",   "deep_water"],
  ["dark_grass",    "dirt"],
  ["dark_grass",    "cobblestone"],
  ["dark_grass",    "shallow_water"],
  ["dark_grass",    "deep_water"],
  ["dirt",          "cobblestone"],
  ["dirt",          "shallow_water"],
  ["dirt",          "deep_water"],
  ["cobblestone",   "shallow_water"],
  ["cobblestone",   "deep_water"],
  ["shallow_water", "deep_water"],
];

// ─────────────────────────────────────────────────────────────────────────────
// NON-WANG TILE INDICES (summer forest.png — 32 cols × 21 rows)
// These are manually placed corner-autotile sets, not wang tiles.
// Each terrain transition occupies a fixed block of 13 tiles:
//   row N, cols 0-3: TL corner, T edge, TR corner, full fill
//   row N, cols 0-3: L edge, inner TL, inner TR, full fill
//   ... etc.
// The TSX wangset "non-wang terrains" defines which tile goes where.
// ─────────────────────────────────────────────────────────────────────────────

// Key individual tile IDs from summer forest.png (0-based, cols 0-31)
// id = row*32 + col
export const TILE = {
  // Row 0 — grass / terrain fills
  LIGHT_GRASS:      4,   // col 4, row 0 — solid light grass (primary ground)
  DARK_GRASS_FILL:  36,  // col 4, row 1 — solid dark grass
  DIRT_FILL:        8,   // col 8, row 0 — dirt fill
  STONE_PATH_FILL:  12,  // col 12, row 0 — stone path fill

  // Water tiles (row 16-20 area)
  DEEP_WATER_FILL:   539, // col 11, row 16 — deep water
  SHALLOW_WATER_FILL:542, // col 14, row 16 — shallow water

  // Animated water (tiles 26-31 = 6-frame animation, row 0 col 26-31)
  WATER_ANIM_START: 26,   // first frame of animated water tile
  WATER_ANIM_END:   31,   // last frame (6 frames total, 100ms each)

  // Animated water row 2 (tiles 58-63)
  WATER2_ANIM_START: 58,
  WATER2_ANIM_END:   63,

  // Undergrowth / tall grass overlay
  UNDERGROWTH_FILL: 46,

  // Transition tile blocks — top-left corner tile of each 4×3 block:
  // Dark grass → Light grass
  DG_ON_LG_START:   1,   // tiles 1-3 (top edge transitions)
  // Dirt → Light grass
  DIRT_ON_LG_START:  5,
  // Stone path → Light grass
  STONE_ON_LG_START: 9,
  // Deep water → Light grass
  DW_ON_LG_START:   538, // col 10, row 16
  // Shallow water → Light grass
  SW_ON_LG_START:   541,
  // Deep water → Dirt
  DW_ON_DIRT_START: 532,
  // Shallow water → Dirt
  SW_ON_DIRT_START: 535,
  // Deep water → Shallow water
  DW_ON_SW_START:   529,
} as const;

// Animated tiles defined in summer forest.tsx (tile id → frame list)
export const ANIMATED_TILES: Record<number, { frames: number[]; durationMs: number }> = {
  26:  { frames: [26, 27, 28, 29, 30, 31],       durationMs: 100 }, // water row 1
  58:  { frames: [58, 59, 60, 61, 62, 63],       durationMs: 100 }, // water row 2
  90:  { frames: [90, 91, 92, 93, 94, 95],       durationMs: 100 }, // water row 3
  122: { frames: [122,123,124,125,126,127],       durationMs: 100 }, // water row 4
  154: { frames: [154,155,156,157,158,159],       durationMs: 100 },
  186: { frames: [186,187,188,189,190,191],       durationMs: 100 },
  218: { frames: [218,219,220,221,222,223],       durationMs: 100 },
  250: { frames: [250,251,252,253,254,255],       durationMs: 100 },
  282: { frames: [282,283,284,285,286,287],       durationMs: 100 },
  314: { frames: [314,315,316,317,318,319],       durationMs: 100 },
};

// ─────────────────────────────────────────────────────────────────────────────
// SEASONAL TILESET REGISTRY
// Each season uses identical terrain slot IDs and tile indices.
// Swap the sheet image path to change the season — no logic changes needed.
// ─────────────────────────────────────────────────────────────────────────────

export type Season = "summer" | "spring" | "autumn_clean" | "autumn_leaves" | "autumn_bare"
  | "winter_clean" | "winter_snowy" | "winter_leaves";

export interface SeasonalTileset {
  season: Season;
  /** Main 16×16 ground sheet — path relative to /public/assets/ */
  groundSheet: string;
  /** Wang tile sheet for autotile transitions */
  wangSheet: string;
  /** TSX file path (relative to /public/assets/) for full tile definitions */
  tsxGround: string;
  tsxWang: string;
  /** 16×32 tall objects sheet */
  sheet16x32: string;
  /** 32×32 decoration sheet */
  sheet32x32: string;
  /** Trees sheet (80×112) */
  treesSheet: string;
  /** Tree wall sheet (128×128) */
  treeWallSheet: string;
  treeWallCanopySheet: string;
}

export const SEASONAL_TILESETS: Record<Season, SeasonalTileset> = {
  summer: {
    season: "summer",
    groundSheet:       "tilesets/summer forest.png",
    wangSheet:         "tilesets/summer forest wang tiles.png",
    tsxGround:         "tilesets/tsx/summer forest.tsx",
    tsxWang:           "tilesets/tsx/summer forest wang tiles.tsx",
    sheet16x32:        "tilesets/summer 16x32.png",
    sheet32x32:        "tilesets/summer 32x32.png",
    treesSheet:        "tilesets/summer trees 80x112.png",
    treeWallSheet:     "tilesets/summer forest tree wall 128x128.png",
    treeWallCanopySheet:"tilesets/summer forest tree wall canopy 128x128.png",
  },
  spring: {
    season: "spring",
    groundSheet:       "tilesets/seasonal/spring-spring forest.png",
    wangSheet:         "tilesets/seasonal/spring-spring forest wang tiles.png",
    tsxGround:         "tilesets/tsx/spring-spring forest.tsx",
    tsxWang:           "tilesets/tsx/spring-spring forest wang tiles.tsx",
    sheet16x32:        "tilesets/seasonal/spring-spring 16x32.png",
    sheet32x32:        "tilesets/seasonal/spring-spring 32x32.png",
    treesSheet:        "tilesets/seasonal/spring-spring trees 80x112.png",
    treeWallSheet:     "tilesets/seasonal/spring-spring forest, tree wall.png",
    treeWallCanopySheet:"tilesets/seasonal/spring-spring forest, tree wall (canopy only).png",
  },
  autumn_clean: {
    season: "autumn_clean",
    groundSheet:       "tilesets/seasonal/autumn-autumn forest (clean).png",
    wangSheet:         "tilesets/seasonal/autumn-autumn forest wang tiles.png",
    tsxGround:         "tilesets/tsx/autumn-autumn forest (clean).tsx",
    tsxWang:           "tilesets/tsx/autumn-autumn forest wang tiles.tsx",
    sheet16x32:        "tilesets/seasonal/autumn-autumn 16x32.png",
    sheet32x32:        "tilesets/seasonal/autumn-autumn 32x32.png",
    treesSheet:        "tilesets/seasonal/autumn-autumn trees (clean) 80x112.png",
    treeWallSheet:     "tilesets/seasonal/autumn-autumn forest, tree wall (clean).png",
    treeWallCanopySheet:"tilesets/seasonal/autumn-autumn forest, tree wall (canopy only).png",
  },
  autumn_leaves: {
    season: "autumn_leaves",
    groundSheet:       "tilesets/seasonal/autumn-autumn forest (leaves).png",
    wangSheet:         "tilesets/seasonal/autumn-autumn forest wang tiles.png",
    tsxGround:         "tilesets/tsx/autumn-autumn forest (leaves).tsx",
    tsxWang:           "tilesets/tsx/autumn-autumn forest wang tiles.tsx",
    sheet16x32:        "tilesets/seasonal/autumn-autumn 16x32.png",
    sheet32x32:        "tilesets/seasonal/autumn-autumn 32x32.png",
    treesSheet:        "tilesets/seasonal/autumn-autumn trees (leaves) 80x112.png",
    treeWallSheet:     "tilesets/seasonal/autumn-autumn forest, tree wall (leaves).png",
    treeWallCanopySheet:"tilesets/seasonal/autumn-autumn forest, tree wall (canopy only).png",
  },
  autumn_bare: {
    season: "autumn_bare",
    groundSheet:       "tilesets/seasonal/autumn-autumn forest (bare).png",
    wangSheet:         "tilesets/seasonal/autumn-autumn forest wang tiles.png",
    tsxGround:         "tilesets/tsx/autumn-autumn forest (bare).tsx",
    tsxWang:           "tilesets/tsx/autumn-autumn forest wang tiles.tsx",
    sheet16x32:        "tilesets/seasonal/autumn-autumn 16x32.png",
    sheet32x32:        "tilesets/seasonal/autumn-autumn 32x32.png",
    treesSheet:        "tilesets/seasonal/autumn-autumn trees (bare) 80x112.png",
    treeWallSheet:     "tilesets/seasonal/autumn-autumn forest, tree wall (bare).png",
    treeWallCanopySheet:"tilesets/seasonal/autumn-autumn forest, tree wall (bare canopy only).png",
  },
  winter_clean: {
    season: "winter_clean",
    groundSheet:       "tilesets/seasonal/winter-winter forest (clean).png",
    wangSheet:         "tilesets/seasonal/winter-winter forest wang tiles (clean).png",
    tsxGround:         "tilesets/tsx/winter-winter forest (clean).tsx",
    tsxWang:           "tilesets/tsx/winter-winter forest wang tiles (clean).tsx",
    sheet16x32:        "tilesets/seasonal/winter-winter (clean) 16x32.png",
    sheet32x32:        "tilesets/seasonal/winter-winter (clean) 32x32.png",
    treesSheet:        "tilesets/seasonal/winter-winter trees (clean) 80x112.png",
    treeWallSheet:     "tilesets/seasonal/winter-winter forest (clean).png",
    treeWallCanopySheet:"tilesets/seasonal/winter-winter forest (clean).png",
  },
  winter_snowy: {
    season: "winter_snowy",
    groundSheet:       "tilesets/seasonal/winter-winter forest (snowy).png",
    wangSheet:         "tilesets/seasonal/winter-winter forest wang tiles (snowy).png",
    tsxGround:         "tilesets/tsx/winter-winter forest (snowy).tsx",
    tsxWang:           "tilesets/tsx/winter-winter forest wang tiles (snowy).tsx",
    sheet16x32:        "tilesets/seasonal/winter-winter (snowy) 16x32.png",
    sheet32x32:        "tilesets/seasonal/winter-winter (snowy) 32x32.png",
    treesSheet:        "tilesets/seasonal/winter-winter trees (snowy) 80x112.png",
    treeWallSheet:     "tilesets/seasonal/winter-winter forest (snowy).png",
    treeWallCanopySheet:"tilesets/seasonal/winter-winter forest (snowy).png",
  },
  winter_leaves: {
    season: "winter_leaves",
    groundSheet:       "tilesets/seasonal/winter-winter forest (leaves).png",
    wangSheet:         "tilesets/seasonal/winter-winter forest wang tiles (clean).png",
    tsxGround:         "tilesets/tsx/winter-winter forest (leaves).tsx",
    tsxWang:           "tilesets/tsx/winter-winter forest wang tiles (clean).tsx",
    sheet16x32:        "tilesets/seasonal/winter-winter (leaves) 32x32.png",
    sheet32x32:        "tilesets/seasonal/winter-winter (leaves) 32x32.png",
    treesSheet:        "tilesets/seasonal/winter-winter trees (leaves) 80x112.png",
    treeWallSheet:     "tilesets/seasonal/winter-winter forest (leaves).png",
    treeWallCanopySheet:"tilesets/seasonal/winter-winter forest (leaves).png",
  },
};

// ─────────────────────────────────────────────────────────────────────────────
// WALKABILITY
// Derived from collision & alpha.tsx — which terrain types are walkable.
// ─────────────────────────────────────────────────────────────────────────────

export const TERRAIN_WALKABLE: Record<TerrainType, boolean> = {
  light_grass:   true,
  dark_grass:    true,
  dirt:          true,
  stone_path:    true,
  cobblestone:   true,
  undergrowth:   true,   // slow, but walkable
  shallow_water: true,   // walkable (slow)
  deep_water:    false,  // impassable
};

export const TERRAIN_SPEED_MODIFIER: Record<TerrainType, number> = {
  light_grass:   1.0,
  dark_grass:    0.9,
  dirt:          1.0,
  stone_path:    1.1,  // slightly faster
  cobblestone:   1.0,
  undergrowth:   0.7,  // slow
  shallow_water: 0.5,  // wading
  deep_water:    0.0,  // blocked
};
