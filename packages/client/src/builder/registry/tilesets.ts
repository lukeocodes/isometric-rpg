/**
 * Comprehensive tileset registry.
 *
 * Every TSX file shipped in `packages/client/public/maps/` (and subfolders)
 * is declared here with rich metadata:
 *
 *   - id             stable slug used for lookup
 *   - file           path relative to /maps/ (may contain subfolders)
 *   - name           display name shown in the picker
 *   - category       default category for every tile in the set
 *   - tags           extra search terms (hit by the picker search box)
 *   - seasonal       "summer" | "autumn" | "spring" | "winter" (optional)
 *   - blocks         whole-tileset collision flag (trees, walls, buildings)
 *   - defaultLayer   layer the picker should auto-switch to when brushing
 *   - subRegions     tile-id ranges that override the above for a subset
 *                    of tiles in the sheet (lets a mixed sheet split into
 *                    e.g. Containers / Lights / Furniture)
 *
 * Adding a new TSX: append here. Sub-region ranges can be filled in as we
 * visually identify which tile ids correspond to which category.
 */

import type { CategoryId } from "./categories.js";
import type { LayerId }    from "./layers.js";

export type Season = "summer" | "autumn" | "spring" | "winter";

/** A contiguous block of tile IDs inside a tileset that overrides the
 *  tileset's default category/flags. Tile IDs are the raw linear index
 *  (row * columns + col). Later regions win when overlapping. */
export interface SubRegion {
  category:     CategoryId;
  /** Inclusive start tile id. */
  from:         number;
  /** Inclusive end tile id. */
  to:           number;
  blocks?:      boolean;
  defaultLayer?: LayerId;
  /** Short label shown alongside the tile in the picker. Optional. */
  label?:       string;
}

export interface TilesetDef {
  id:            string;
  file:          string;          // relative to /maps/
  name:          string;          // display name
  category:      CategoryId;
  tags?:         string[];
  seasonal?:     Season;
  blocks?:       boolean;
  defaultLayer?: LayerId;
  subRegions?:   SubRegion[];
  /** True → still loaded for rendering, but not shown in the picker. */
  hidden?:       boolean;
  /** Free-form notes for authors. */
  notes?:        string;
}

// ---------------------------------------------------------------------------
// Summer (top-level — the default packs for Heaven)
// ---------------------------------------------------------------------------

const SUMMER: TilesetDef[] = [
  {
    id:       "summer-forest-wang",
    file:     "summer forest wang tiles.tsx",
    name:     "Summer Forest — Wang Terrain",
    category: "terrain",
    tags:     ["wang", "grass", "dirt", "sand", "water", "path"],
    seasonal: "summer",
    defaultLayer: "ground",
  },
  {
    id:       "summer-forest-wang-alt",
    file:     "summer-forest-wang-tiles.tsx",
    name:     "Summer Forest — Wang Terrain (alt)",
    category: "terrain",
    tags:     ["wang"],
    seasonal: "summer",
    defaultLayer: "ground",
    hidden:   true, // duplicate of summer-forest-wang; kept loaded for backward compat
  },
  {
    id:       "summer-forest",
    file:     "summer forest.tsx",
    name:     "Summer Forest — Decor Sheet",
    category: "forest",
    tags:     ["bush", "log", "stump", "flower", "mushroom", "rock"],
    seasonal: "summer",
    defaultLayer: "decor",
    // TODO: fill sub-regions for plants/containers/lights once tile-ids are identified.
  },
  {
    id:       "summer-forest-alt",
    file:     "summer-forest.tsx",
    name:     "Summer Forest — Decor Sheet (alt)",
    category: "forest",
    seasonal: "summer",
    defaultLayer: "decor",
    hidden:   true,
  },
  {
    id:       "summer-tree-wall",
    file:     "summer-forest-tree-wall.tsx",
    name:     "Summer Tree — Trunks (solid)",
    category: "trees",
    tags:     ["tree", "wall", "trunk", "bark"],
    seasonal: "summer",
    blocks:   true,
    defaultLayer: "walls",
  },
  {
    id:       "summer-tree-canopy",
    file:     "summer-forest-tree-wall-canopy.tsx",
    name:     "Summer Tree — Canopies",
    category: "trees",
    tags:     ["tree", "canopy", "leaves"],
    seasonal: "summer",
    defaultLayer: "canopy",
  },
  {
    id:       "summer-trees-80x112",
    file:     "summer trees 80x112.tsx",
    name:     "Summer — Standalone Trees",
    category: "trees",
    tags:     ["tree", "large"],
    seasonal: "summer",
    blocks:   true,
    defaultLayer: "walls",
  },
  {
    id:       "summer-water-sparkles",
    file:     "summer water sparkles.tsx",
    name:     "Summer Water — Sparkles (animated)",
    category: "water",
    tags:     ["water", "animated", "sparkle"],
    seasonal: "summer",
    defaultLayer: "decor",
  },
  {
    id:       "summer-waterfall",
    file:     "summer waterfall B.tsx",
    name:     "Summer Waterfall (animated)",
    category: "water",
    tags:     ["water", "waterfall", "animated"],
    seasonal: "summer",
    defaultLayer: "ground",
  },
  {
    id:       "summer-16x32",
    file:     "summer 16x32.tsx",
    name:     "Summer — Tall Plants (16×32)",
    category: "plants",
    tags:     ["tall", "grass", "flower", "bush", "berry"],
    seasonal: "summer",
    defaultLayer: "decor",
    notes:    "Tall grass + bushes with/without berries. All plants.",
  },
  {
    id:       "summer-32x32",
    file:     "summer 32x32.tsx",
    name:     "Summer — Medium Props (32×32)",
    category: "props",
    tags:     ["bush", "rock", "boulder", "log", "pile"],
    seasonal: "summer",
    defaultLayer: "decor",
    subRegions: [
      { from: 0, to: 1, category: "plants",   label: "Bush" },
      { from: 2, to: 3, category: "props",    label: "Rock/Boulder" },
      { from: 4, to: 5, category: "forest",   label: "Log pile" },
      { from: 6, to: 6, category: "plants",   label: "Lily pad cluster" },
    ],
  },
];

// ---------------------------------------------------------------------------
// Seasonal test-zone packs (every one of these lives under test-zones/<zone>/)
// ---------------------------------------------------------------------------

const AUTUMN: TilesetDef[] = [
  { id: "autumn-forest-wang", file: "test-zones/autumn-forest/autumn forest wang tiles.tsx",
    name: "Autumn Forest — Wang", category: "terrain", seasonal: "autumn", defaultLayer: "ground" },
  { id: "autumn-forest",      file: "test-zones/autumn-forest/autumn forest (leaves).tsx",
    name: "Autumn Forest — Decor", category: "forest", seasonal: "autumn", defaultLayer: "decor" },
  { id: "autumn-trees",       file: "test-zones/autumn-forest/autumn trees (leaves) 80x112.tsx",
    name: "Autumn Trees", category: "trees", seasonal: "autumn", blocks: true, defaultLayer: "walls" },
  { id: "autumn-16x32",       file: "test-zones/autumn-forest/autumn 16x32.tsx",
    name: "Autumn — Tall Plants", category: "plants", seasonal: "autumn", defaultLayer: "decor",
    tags: ["tall", "grass", "flower", "bush"] },
  { id: "autumn-32x32",       file: "test-zones/autumn-forest/autumn 32x32.tsx",
    name: "Autumn — Medium Props", category: "props", seasonal: "autumn", defaultLayer: "decor",
    subRegions: [
      { from: 0, to: 1, category: "plants", label: "Bush" },
      { from: 2, to: 3, category: "props",  label: "Rock" },
      { from: 4, to: 5, category: "forest", label: "Log pile" },
      { from: 6, to: 6, category: "plants", label: "Lily pad" },
    ] },
  { id: "autumn-water",       file: "test-zones/autumn-forest/autumn water sparkles.tsx",
    name: "Autumn Water Sparkles", category: "water", seasonal: "autumn", defaultLayer: "decor" },
  { id: "autumn-waterfall",   file: "test-zones/autumn-forest/autumn waterfall B.tsx",
    name: "Autumn Waterfall", category: "water", seasonal: "autumn", defaultLayer: "ground" },
];

const SPRING: TilesetDef[] = [
  { id: "spring-forest-wang", file: "test-zones/spring-forest/spring forest wang tiles.tsx",
    name: "Spring Forest — Wang", category: "terrain", seasonal: "spring", defaultLayer: "ground" },
  { id: "spring-forest",      file: "test-zones/spring-forest/spring forest.tsx",
    name: "Spring Forest — Decor", category: "forest", seasonal: "spring", defaultLayer: "decor" },
  { id: "spring-trees",       file: "test-zones/spring-forest/spring trees 80x112.tsx",
    name: "Spring Trees", category: "trees", seasonal: "spring", blocks: true, defaultLayer: "walls" },
  { id: "spring-16x32",       file: "test-zones/spring-forest/spring 16x32.tsx",
    name: "Spring — Tall Plants", category: "plants", seasonal: "spring", defaultLayer: "decor",
    tags: ["tall", "grass", "flower", "bush"] },
  { id: "spring-32x32",       file: "test-zones/spring-forest/spring 32x32.tsx",
    name: "Spring — Medium Props", category: "props", seasonal: "spring", defaultLayer: "decor",
    subRegions: [
      { from: 0, to: 1, category: "plants", label: "Bush" },
      { from: 2, to: 3, category: "props",  label: "Rock" },
      { from: 4, to: 5, category: "forest", label: "Log pile" },
      { from: 6, to: 6, category: "plants", label: "Lily pad" },
    ] },
  { id: "spring-water",       file: "test-zones/spring-forest/spring water sparkles.tsx",
    name: "Spring Water Sparkles", category: "water", seasonal: "spring", defaultLayer: "decor" },
  { id: "spring-waterfall",   file: "test-zones/spring-forest/spring waterfall B.tsx",
    name: "Spring Waterfall", category: "water", seasonal: "spring", defaultLayer: "ground" },
];

const WINTER: TilesetDef[] = [
  { id: "winter-forest-wang", file: "test-zones/winter-forest/winter forest wang tiles (snowy).tsx",
    name: "Winter Forest — Wang (snowy)", category: "terrain", seasonal: "winter", defaultLayer: "ground" },
  { id: "winter-forest",      file: "test-zones/winter-forest/winter forest (snowy).tsx",
    name: "Winter Forest — Decor", category: "forest", seasonal: "winter", defaultLayer: "decor" },
  { id: "winter-trees",       file: "test-zones/winter-forest/winter trees (snowy) 80x112.tsx",
    name: "Winter Trees (snowy)", category: "trees", seasonal: "winter", blocks: true, defaultLayer: "walls" },
  { id: "winter-16x32",       file: "test-zones/winter-forest/winter (snowy) 16x32.tsx",
    name: "Winter — Tall Plants (snowy)", category: "plants", seasonal: "winter", defaultLayer: "decor",
    tags: ["tall", "grass", "snow"] },
  { id: "winter-32x32",       file: "test-zones/winter-forest/winter (snowy) 32x32.tsx",
    name: "Winter — Medium Props (snowy)", category: "props", seasonal: "winter", defaultLayer: "decor",
    subRegions: [
      { from: 0, to: 1, category: "plants", label: "Bush (snowy)" },
      { from: 2, to: 3, category: "props",  label: "Rock (snowy)" },
      { from: 4, to: 5, category: "forest", label: "Log pile (snowy)" },
      { from: 6, to: 6, category: "plants", label: "Lily pad" },
    ] },
  { id: "winter-water",       file: "test-zones/winter-forest/winter water sparkles B 16x16.tsx",
    name: "Winter Water Sparkles", category: "water", seasonal: "winter", defaultLayer: "decor" },
  { id: "winter-waterfall",   file: "test-zones/winter-forest/winter waterfall B 16x16.tsx",
    name: "Winter Waterfall", category: "water", seasonal: "winter", defaultLayer: "ground" },
];

const SUMMER_WATERFALL: TilesetDef[] = [
  { id: "sw-48x32", file: "test-zones/summer-waterfall/summer 48x32.tsx",
    name: "Summer — Wide Forest Decor (48×32)", category: "forest", seasonal: "summer", defaultLayer: "decor",
    tags: ["stump", "log", "driftwood"] },
  { id: "sw-tree-wall", file: "test-zones/summer-waterfall/summer forest, tree wall.tsx",
    name: "Summer Tree — Wall (alt)", category: "trees", seasonal: "summer", blocks: true, defaultLayer: "walls", hidden: true },
  { id: "sw-tree-canopy", file: "test-zones/summer-waterfall/summer forest, tree wall (canopy only).tsx",
    name: "Summer Tree — Canopy (alt)", category: "trees", seasonal: "summer", defaultLayer: "canopy", hidden: true },
];

// ---------------------------------------------------------------------------
// Buildings — home interior packs (4 variants)
// ---------------------------------------------------------------------------

// Home interior sheets are 32-column grids. The Mana Seed layout is:
//   cols 0-5   = flooring (dark → brighter → brightest stripe vertically)
//   cols 6-21  = wall tops, wall fronts, inside/outside corners
//   cols 22-27 = doorways + door frames
//   cols 28-31 = windows (+ "windows from below" row)
//
// The helper below builds a consistent sub-region set that we apply to all 4
// interior variants (thatch / timber / half-timber / stonework).

function homeInteriorSubRegions(): SubRegion[] {
  const C = 32; // columns in every home interior sheet
  const regions: SubRegion[] = [];

  // 16 rows × cols 0-5 = floor tiles (walkable; default layer should be "ground")
  for (let row = 0; row < 16; row++) {
    regions.push({
      from: row * C + 0, to: row * C + 5,
      category: "terrain", defaultLayer: "ground", blocks: false,
      label: "Floor",
    });
  }
  // rows 0-5 × cols 22-27 = doorway + door frames
  for (let row = 0; row < 6; row++) {
    regions.push({
      from: row * C + 22, to: row * C + 27,
      category: "doors", defaultLayer: "walls", blocks: false,
      label: "Doorway / frame",
    });
  }
  // rows 0-5 × cols 28-31 = windows (+ "windows from below" row 5)
  for (let row = 0; row < 6; row++) {
    regions.push({
      from: row * C + 28, to: row * C + 31,
      category: "windows", defaultLayer: "walls", blocks: true,
      label: "Window",
    });
  }
  // rows 8-11 × cols 22-31 = additional door panels ("Door Goes Here" zone)
  for (let row = 8; row < 12; row++) {
    regions.push({
      from: row * C + 22, to: row * C + 31,
      category: "doors", defaultLayer: "walls", blocks: false,
      label: "Door panel",
    });
  }
  return regions;
}

const BUILDINGS: TilesetDef[] = [
  {
    id:       "home-thatch",
    file:     "test-zones/thatch-home/home interiors, thatch roof v1.tsx",
    name:     "Home — Thatch Interior",
    category: "buildings",
    tags:     ["home", "thatch", "wall", "floor", "door", "window"],
    blocks:   true,
    defaultLayer: "walls",
    subRegions: homeInteriorSubRegions(),
  },
  {
    id:       "home-timber",
    file:     "test-zones/timber-home/home interiors, timber roof.tsx",
    name:     "Home — Timber Interior",
    category: "buildings",
    tags:     ["home", "timber", "wall", "floor", "door", "window"],
    blocks:   true,
    defaultLayer: "walls",
    subRegions: homeInteriorSubRegions(),
  },
  {
    id:       "home-half-timber",
    file:     "test-zones/half-timber-home/home interiors, half-timber.tsx",
    name:     "Home — Half-Timber Interior",
    category: "buildings",
    tags:     ["home", "half-timber", "wall", "floor", "door", "window"],
    blocks:   true,
    defaultLayer: "walls",
    subRegions: homeInteriorSubRegions(),
  },
  {
    id:       "home-stonework",
    file:     "test-zones/stonework-home/home interiors, stonework.tsx",
    name:     "Home — Stonework Interior",
    category: "buildings",
    tags:     ["home", "stonework", "stone", "castle", "wall", "floor", "door", "window"],
    blocks:   true,
    defaultLayer: "walls",
    subRegions: homeInteriorSubRegions(),
  },
];

// ---------------------------------------------------------------------------
// Bridges
// ---------------------------------------------------------------------------

const BRIDGES: TilesetDef[] = [
  {
    id:       "bonus-bridge",
    file:     "bonus bridge.tsx",
    name:     "Bridges — Bonus",
    category: "bridges",
    tags:     ["wooden", "stone"],
    defaultLayer: "decor",
  },
];

// ---------------------------------------------------------------------------
// Generic terrain / trees packs (multi-season or top-level misc)
// ---------------------------------------------------------------------------

const MISC: TilesetDef[] = [
  {
    id:       "terrain",
    file:     "terrain.tsx",
    name:     "Terrain (generic)",
    category: "terrain",
    defaultLayer: "ground",
  },
  {
    id:       "trees",
    file:     "trees.tsx",
    name:     "Trees (generic)",
    category: "trees",
    blocks:   true,
    defaultLayer: "walls",
  },
];

// ---------------------------------------------------------------------------
// Furniture — Cozy Furnishings pack
// ---------------------------------------------------------------------------

const FURNITURE: TilesetDef[] = [
  { id: "cozy-16x16", file: "furniture/cozy furnishings 16x16.tsx",
    name: "Cozy — Small (16×16)",     category: "furniture", defaultLayer: "decor",
    tags: ["cozy", "candle", "cup", "plate", "book", "mirror", "small"],
    notes: "Single-tile accessories: candles, cups, plates, books, vases, mirrors." },
  { id: "cozy-16x32", file: "furniture/cozy furnishings 16x32.tsx",
    name: "Cozy — Tall (16×32)",      category: "furniture", defaultLayer: "decor",
    tags: ["cozy", "lantern", "vase", "barrel", "sack", "urn", "basket", "tall"],
    subRegions: [
      // First row contains barrels, sacks, baskets, urns — all containers.
      { from: 0,  to: 17, category: "containers", label: "Barrel / sack / basket" },
      { from: 19, to: 22, category: "containers", label: "Cabinet / bookshelf" },
    ] },
  { id: "cozy-16x48", file: "furniture/cozy furnishings 16x48.tsx",
    name: "Cozy — Floor Lamp (16×48)", category: "furniture", defaultLayer: "decor",
    tags: ["cozy", "lamp", "tall"] },
  { id: "cozy-32x32", file: "furniture/cozy furnishings 32x32.tsx",
    name: "Cozy — Medium (32×32)",    category: "furniture", defaultLayer: "decor",
    tags: ["cozy", "chair", "table", "stool", "chest", "trunk", "barrel", "crate"],
    subRegions: [
      // Row 1: wicker basket, barrel, trough, crate
      { from: 16, to: 20, category: "containers", label: "Basket / barrel / trough" },
      { from: 23, to: 23, category: "containers", label: "Crate with books" },
      // Row 3: three chest variants
      { from: 56, to: 58, category: "containers", label: "Chest" },
      // Row 4: large trunks
      { from: 64, to: 65, category: "containers", label: "Trunk" },
    ] },
  { id: "cozy-32x48", file: "furniture/cozy furnishings 32x48.tsx",
    name: "Cozy — Shelf (32×48)",     category: "furniture", defaultLayer: "decor",
    tags: ["cozy", "shelf", "bookshelf", "cabinet"] },
  { id: "cozy-32x80", file: "furniture/cozy furnishings 32x80.tsx",
    name: "Cozy — Wardrobe (32×80)",  category: "furniture", defaultLayer: "decor",
    tags: ["cozy", "wardrobe", "armoire"] },
  { id: "cozy-48x32", file: "furniture/cozy furnishings 48x32.tsx",
    name: "Cozy — Wide (48×32)",      category: "furniture", defaultLayer: "decor",
    tags: ["cozy", "table", "couch", "bench", "counter"] },
  { id: "cozy-48x80", file: "furniture/cozy furnishings 48x80.tsx",
    name: "Cozy — Bed (48×80)",       category: "furniture", defaultLayer: "decor",
    tags: ["cozy", "bed"] },
  { id: "cozy-anim", file: "furniture/cozy furnishings anim 32x32.tsx",
    name: "Cozy — Animated (32×32)",  category: "furniture", defaultLayer: "decor",
    tags: ["cozy", "fireplace", "stove", "animated"],
    subRegions: [
      // Fireplaces/stoves emit light -> categorise those rows as lights.
      { from: 0,  to: 4,  category: "lights", label: "Fireplace" },
      { from: 5,  to: 9,  category: "lights", label: "Stove/oven" },
    ] },
  { id: "thatch-table",    file: "furniture/thatch roof table 48x48.tsx",
    name: "Thatch Home — Dining Table", category: "furniture", defaultLayer: "decor",
    tags: ["table", "thatch", "dining"] },
  { id: "stonework-table", file: "furniture/stonework table 48x48.tsx",
    name: "Stonework Home — Dining Table", category: "furniture", defaultLayer: "decor",
    tags: ["table", "stonework", "dining"] },
  { id: "cooking-pot",     file: "furniture/animated cooking pot 32x32.tsx",
    name: "Animated Cooking Pot (32×32)",  category: "lights", defaultLayer: "decor",
    tags: ["fire", "cook", "pot", "animated"] },
];

// ---------------------------------------------------------------------------
// Lights — Animated Candles pack (5-frame animations)
// ---------------------------------------------------------------------------

const LIGHTS: TilesetDef[] = [
  { id: "candles-16x16-v01", file: "lights/animated candles anim 16x16 v01.tsx",
    name: "Candles — Small (16×16)",  category: "lights", defaultLayer: "decor",
    tags: ["candle", "flame", "animated", "small"] },
  { id: "candles-16x32-v01", file: "lights/animated candles anim 16x32 v01.tsx",
    name: "Candles — Tall (16×32)",   category: "lights", defaultLayer: "decor",
    tags: ["candle", "flame", "animated"] },
  { id: "candles-16x48-v01", file: "lights/animated candles anim 16x48 v01.tsx",
    name: "Candles — Candelabra (16×48)", category: "lights", defaultLayer: "decor",
    tags: ["candelabra", "tall", "animated"] },
];

// ---------------------------------------------------------------------------
// Crops — Farming Crops #1 + #2 packs
// ---------------------------------------------------------------------------
//
// Per-sheet layout (10 columns × 16 rows; one crop per row):
//   col 0: inventory icon        col 1: seedbag icon       col 2: seeds scatter
//   col 3: growth stage 1        col 4: stage 2            col 5: stage 3
//   col 6: stage 4               col 7: stage 5 (harvest)  col 8: sign icon
//   col 9: sign object
// We expose all tiles for now; authors typically only place stage 5 (col 7) on
// gardens, and place col 9 signs next to them.
//
// Tag every sheet with the crop list so search "corn"/"wheat"/etc. finds them.

const CROPS: TilesetDef[] = [
  { id: "crops-1a", file: "crops/farming crops 1-A 16x32.tsx",
    name: "Farming Crops 1-A", category: "crops", defaultLayer: "decor",
    tags: ["beetroot","cabbage","carrot","corn","onion","potato","peas","beans","tomato","wheat","cucumber","spinach","strawberries","grapes","pumpkin","broccoli"] },
  { id: "crops-1b", file: "crops/farming crops 1-B 16x32.tsx",
    name: "Farming Crops 1-B (recolors)", category: "crops", defaultLayer: "decor",
    tags: ["crop","recolor"], hidden: true },
  { id: "crops-1c", file: "crops/farming crops 1-C 16x32.tsx",
    name: "Farming Crops 1-C", category: "crops", defaultLayer: "decor",
    tags: ["barley","rye","grapes","cauliflower","cotton-candy-pumpkin"] },
  { id: "crops-2a", file: "crops/farming crops 2-A 16x32.tsx",
    name: "Farming Crops 2-A", category: "crops", defaultLayer: "decor",
    tags: ["artichoke","bell-pepper","blueberries","celery","watermelon","leek","garlic","chili","oats","raspberry","eggplant","radish","lettuce","sweet-potato","turnip","zucchini"] },
  { id: "crops-2b", file: "crops/farming crops 2-B 16x32.tsx",
    name: "Farming Crops 2-B (recolors)", category: "crops", defaultLayer: "decor",
    tags: ["crop","recolor"], hidden: true },
  { id: "crops-extras-16x16", file: "crops/farming crops extras 16x16.tsx",
    name: "Farming Crops — Weeds & Pollen (16×16)", category: "crops", defaultLayer: "decor",
    tags: ["weeds","pollen","particles"] },
  { id: "crops-extras-16x32", file: "crops/farming crops extras 16x32.tsx",
    name: "Farming Crops — Dead & Signs (16×32)", category: "crops", defaultLayer: "decor",
    tags: ["dead","withered","sign","post","seedbag"] },
];

// ---------------------------------------------------------------------------
// Signs — Village Accessories pack
// ---------------------------------------------------------------------------

const SIGNS: TilesetDef[] = [
  { id: "village-signs-16x16", file: "signs/village accessories 16x16.tsx",
    name: "Wooden Shop Signs (16×16)", category: "signs", defaultLayer: "decor",
    tags: ["sign","shop","wooden","blacksmith","alchemy","bakery","tavern"] },
  { id: "village-pendants-16x32", file: "signs/village accessories 16x32.tsx",
    name: "Cloth Pendants (16×32)", category: "signs", defaultLayer: "decor",
    tags: ["cloth","pendant","banner","hanging"] },
  { id: "village-accessories-16x48", file: "signs/village accessories 16x48.tsx",
    name: "Village Accessories (16×48)", category: "props", defaultLayer: "decor",
    tags: ["banner","tall"] },
  { id: "village-accessories-32x32", file: "signs/village accessories 32x32.tsx",
    name: "Village Accessories (32×32)", category: "props", defaultLayer: "decor",
    tags: ["well", "crate", "woodpile", "urn", "kettle", "plank"],
    subRegions: [
      { from: 0, to: 1, category: "props",      label: "Village well" },
      { from: 2, to: 3, category: "containers", label: "Wood pile" },
      { from: 4, to: 5, category: "containers", label: "Crate" },
      { from: 6, to: 6, category: "props",      label: "Cart wheel / barrel" },
      { from: 8, to: 9, category: "containers", label: "Urn / kettle" },
      { from: 10, to: 11, category: "props",    label: "Pedestal" },
      { from: 12, to: 19, category: "containers", label: "Supply stack" },
    ] },
  { id: "village-accessories-32x64", file: "signs/village accessories 32x64.tsx",
    name: "Village Accessories (32×64)", category: "props", defaultLayer: "decor",
    tags: ["tall","post"] },
  { id: "village-accessories-48x80", file: "signs/village accessories 48x80.tsx",
    name: "Village Signposts — Banner (48×80)", category: "signs", defaultLayer: "decor",
    tags: ["signpost","banner","large"] },
  { id: "village-accessories-80x96", file: "signs/village accessories 80x96.tsx",
    name: "Village Accessories — Large (80×96)", category: "props", defaultLayer: "decor",
    tags: ["wagon","cart","large"] },
  { id: "village-anim",        file: "signs/village anim 16x48.tsx",
    name: "Village — Hanging Sign (anim)", category: "signs", defaultLayer: "decor",
    tags: ["animated","sway","hanging"] },
  { id: "village-notice",      file: "signs/village notice boards 48x64.tsx",
    name: "Village — Notice Boards", category: "signs", defaultLayer: "decor",
    tags: ["notice","board","bulletin"] },
  { id: "village-signposts",   file: "signs/village signposts 48x64.tsx",
    name: "Village — Signposts Library", category: "signs", defaultLayer: "decor",
    tags: ["signpost","arrow","directional"] },
  { id: "village-laundry-alley-angle",    file: "signs/village laundry, alley angle 48x64.tsx",
    name: "Village — Laundry Alley Angle", category: "props", defaultLayer: "canopy",
    tags: ["laundry","clothesline","rope"] },
  { id: "village-laundry-alley-straight", file: "signs/village laundry, alley straight 64x48.tsx",
    name: "Village — Laundry Alley Straight", category: "props", defaultLayer: "canopy",
    tags: ["laundry","clothesline","rope"] },
  { id: "village-laundry-post-angle",     file: "signs/village laundry, post angle 48x64.tsx",
    name: "Village — Laundry Post Angle", category: "props", defaultLayer: "canopy",
    tags: ["laundry","clothesline","post"] },
  { id: "village-laundry-post-straight",  file: "signs/village laundry, post straight 64x48.tsx",
    name: "Village — Laundry Post Straight", category: "props", defaultLayer: "canopy",
    tags: ["laundry","clothesline","post"] },
];

// ---------------------------------------------------------------------------
// Effects — Weather Effects pack
// ---------------------------------------------------------------------------

const EFFECTS: TilesetDef[] = [
  { id: "weather-cloud-autotile", file: "effects/weather effects, cloud cover autotile 16x16.tsx",
    name: "Weather — Cloud Cover (autotile)", category: "effects", defaultLayer: "canopy",
    tags: ["cloud","shadow","overlay"] },
  { id: "weather-snow-autotile",  file: "effects/weather effects, snow cover autotile 16x16.tsx",
    name: "Weather — Snow Cover (autotile)", category: "effects", defaultLayer: "decor",
    tags: ["snow","ground","cover","autotile"] },
  { id: "weather-rain-light",     file: "effects/weather effects, rain light anim 32x128.tsx",
    name: "Weather — Light Rain", category: "effects", defaultLayer: "canopy",
    tags: ["rain","light","animated","overlay"] },
  { id: "weather-rain-heavy",     file: "effects/weather effects, rain heavy anim 32x128.tsx",
    name: "Weather — Heavy Rain", category: "effects", defaultLayer: "canopy",
    tags: ["rain","heavy","animated","overlay"] },
  { id: "weather-snow-light",     file: "effects/weather effects, snow light anim 32x128.tsx",
    name: "Weather — Light Snow", category: "effects", defaultLayer: "canopy",
    tags: ["snow","light","animated","overlay"] },
  { id: "weather-snow-heavy",     file: "effects/weather effects, snow heavy anim 32x128.tsx",
    name: "Weather — Heavy Snow", category: "effects", defaultLayer: "canopy",
    tags: ["snow","heavy","animated","overlay"] },
  { id: "weather-rain-impact",    file: "effects/weather effects, rain impact anim 16x16.tsx",
    name: "Weather — Rain Impact", category: "effects", defaultLayer: "decor",
    tags: ["rain","splash","impact"] },
  { id: "weather-snow-impact",    file: "effects/weather effects, snow impact anim 16x16.tsx",
    name: "Weather — Snow Impact", category: "effects", defaultLayer: "decor",
    tags: ["snow","sprinkle","impact"] },
  { id: "weather-lightning-full", file: "effects/weather effects, lightning full 32x128.tsx",
    name: "Weather — Lightning Full", category: "effects", defaultLayer: "canopy",
    tags: ["lightning","bolt","storm"] },
  { id: "weather-lightning-rep",  file: "effects/weather effects, lightning repeatable 32x80.tsx",
    name: "Weather — Lightning Repeatable", category: "effects", defaultLayer: "canopy",
    tags: ["lightning","bolt","storm","tileable"] },
  { id: "weather-lightning-imp",  file: "effects/weather effects, lightning impact 32x48.tsx",
    name: "Weather — Lightning Impact", category: "effects", defaultLayer: "canopy",
    tags: ["lightning","impact","strike"] },
];

// ---------------------------------------------------------------------------
// Roofs — Home exterior sliceable packs (thatch / timber / stonework)
// ---------------------------------------------------------------------------

const ROOFS: TilesetDef[] = [
  // Thatch ----------------------------------------------------------------
  { id: "thatch-roof-16x16", file: "roofs/thatch roof 16x16.tsx",
    name: "Thatch Roof — 16×16 Tileable", category: "roofs", defaultLayer: "canopy",
    tags: ["thatch","straw","roof"] },
  { id: "thatch-roof-16x32", file: "roofs/thatch roof 16x32.tsx",
    name: "Thatch Roof — 16×32", category: "roofs", defaultLayer: "canopy",
    tags: ["thatch","roof","eave"] },
  { id: "thatch-roof-32x32", file: "roofs/thatch roof 32x32.tsx",
    name: "Thatch Roof — 32×32 Peak", category: "roofs", defaultLayer: "canopy",
    tags: ["thatch","roof","peak","corner"] },
  { id: "thatch-roof-32x48", file: "roofs/thatch roof 32x48.tsx",
    name: "Thatch Roof — 32×48 Ridge", category: "roofs", defaultLayer: "canopy",
    tags: ["thatch","roof","ridge"] },
  { id: "thatch-chimney-v1", file: "roofs/thatch roof chimney 32x48 v1.tsx",
    name: "Thatch Roof — Chimney v1", category: "roofs", defaultLayer: "canopy",
    tags: ["chimney","thatch"] },
  { id: "thatch-chimney-v2", file: "roofs/thatch roof chimney 32x48 v2.tsx",
    name: "Thatch Roof — Chimney v2", category: "roofs", defaultLayer: "canopy",
    tags: ["chimney","thatch"], hidden: true },
  { id: "thatch-chimney-v3", file: "roofs/thatch roof chimney 32x48 v3.tsx",
    name: "Thatch Roof — Chimney v3", category: "roofs", defaultLayer: "canopy",
    tags: ["chimney","thatch"], hidden: true },
  { id: "thatch-posts-v1",   file: "roofs/thatch roof posts 16x32 v1.tsx",
    name: "Thatch Roof — Posts v1", category: "roofs", defaultLayer: "walls",
    tags: ["post","support","thatch"], blocks: true },
  { id: "thatch-posts-v2",   file: "roofs/thatch roof posts 16x32 v2.tsx",
    name: "Thatch Roof — Posts v2", category: "roofs", defaultLayer: "walls",
    tags: ["post","thatch"], blocks: true, hidden: true },
  { id: "thatch-posts-v3",   file: "roofs/thatch roof posts 16x32 v3.tsx",
    name: "Thatch Roof — Posts v3", category: "roofs", defaultLayer: "walls",
    tags: ["post","thatch"], blocks: true, hidden: true },

  // Timber ----------------------------------------------------------------
  { id: "timber-roof-16x16", file: "roofs/timber roof 16x16.tsx",
    name: "Timber Roof — 16×16 Tileable", category: "roofs", defaultLayer: "canopy",
    tags: ["timber","wood","roof"] },
  { id: "timber-roof-16x32", file: "roofs/timber roof 16x32.tsx",
    name: "Timber Roof — 16×32", category: "roofs", defaultLayer: "canopy",
    tags: ["timber","roof","eave"] },
  { id: "timber-roof-32x16", file: "roofs/timber roof 32x16.tsx",
    name: "Timber Roof — 32×16", category: "roofs", defaultLayer: "canopy",
    tags: ["timber","roof","ridge"] },
  { id: "timber-chimney-v1", file: "roofs/timber roof chimney 32x48 v1.tsx",
    name: "Timber Roof — Chimney v1", category: "roofs", defaultLayer: "canopy",
    tags: ["chimney","timber"] },
  { id: "timber-chimney-v2", file: "roofs/timber roof chimney 32x48 v2.tsx",
    name: "Timber Roof — Chimney v2", category: "roofs", defaultLayer: "canopy",
    tags: ["chimney","timber"], hidden: true },
  { id: "timber-chimney-v3", file: "roofs/timber roof chimney 32x48 v3.tsx",
    name: "Timber Roof — Chimney v3", category: "roofs", defaultLayer: "canopy",
    tags: ["chimney","timber"], hidden: true },
  { id: "timber-posts-v1",   file: "roofs/timber roof posts 16x32 v1.tsx",
    name: "Timber Roof — Posts v1", category: "roofs", defaultLayer: "walls",
    tags: ["post","support","timber"], blocks: true },
  { id: "timber-posts-v2",   file: "roofs/timber roof posts 16x32 v2.tsx",
    name: "Timber Roof — Posts v2", category: "roofs", defaultLayer: "walls",
    tags: ["post","timber"], blocks: true, hidden: true },
  { id: "timber-posts-v3",   file: "roofs/timber roof posts 16x32 v3.tsx",
    name: "Timber Roof — Posts v3", category: "roofs", defaultLayer: "walls",
    tags: ["post","timber"], blocks: true, hidden: true },

  // Stonework -------------------------------------------------------------
  { id: "stonework-16x32", file: "roofs/stonework 16x32.tsx",
    name: "Stonework Roof — 16×32", category: "roofs", defaultLayer: "canopy",
    tags: ["stonework","stone","roof"] },
  { id: "stonework-16x64", file: "roofs/stonework 16x64.tsx",
    name: "Stonework Roof — 16×64", category: "roofs", defaultLayer: "canopy",
    tags: ["stonework","stone","roof","tall"] },
  { id: "stonework-32x32", file: "roofs/stonework 32x32.tsx",
    name: "Stonework Roof — 32×32", category: "roofs", defaultLayer: "canopy",
    tags: ["stonework","stone","peak"] },
  { id: "stonework-48x32", file: "roofs/stonework 48x32.tsx",
    name: "Stonework Roof — 48×32", category: "roofs", defaultLayer: "canopy",
    tags: ["stonework","stone","wide"] },
  { id: "stonework-chimney-v1", file: "roofs/stonework chimney 32x48 v1.tsx",
    name: "Stonework — Chimney v1", category: "roofs", defaultLayer: "canopy",
    tags: ["chimney","stonework"] },
  { id: "stonework-chimney-v2", file: "roofs/stonework chimney 32x48 v2.tsx",
    name: "Stonework — Chimney v2", category: "roofs", defaultLayer: "canopy",
    tags: ["chimney","stonework"], hidden: true },
  { id: "stonework-chimney-v3", file: "roofs/stonework chimney 32x48 v3.tsx",
    name: "Stonework — Chimney v3", category: "roofs", defaultLayer: "canopy",
    tags: ["chimney","stonework"], hidden: true },
  { id: "stonework-posts-v1",   file: "roofs/stonework posts 16x32 v1.tsx",
    name: "Stonework — Posts v1", category: "roofs", defaultLayer: "walls",
    tags: ["post","support","stone"], blocks: true },
  { id: "stonework-posts-v2",   file: "roofs/stonework posts 16x32 v2.tsx",
    name: "Stonework — Posts v2", category: "roofs", defaultLayer: "walls",
    tags: ["post","stone"], blocks: true, hidden: true },
  { id: "stonework-posts-v3",   file: "roofs/stonework posts 16x32 v3.tsx",
    name: "Stonework — Posts v3", category: "roofs", defaultLayer: "walls",
    tags: ["post","stone"], blocks: true, hidden: true },
];

// ---------------------------------------------------------------------------
// Excluded (kept unregistered to avoid picker clutter)
// ---------------------------------------------------------------------------
//
// "collision & alpha.tsx" — visualisation helper emitted by Tiled for editing
// collision shapes in-editor. Never a tileable game tile.

// ---------------------------------------------------------------------------
// Merged list
// ---------------------------------------------------------------------------

export const TILESETS: TilesetDef[] = [
  ...SUMMER,
  ...AUTUMN,
  ...SPRING,
  ...WINTER,
  ...SUMMER_WATERFALL,
  ...BUILDINGS,
  ...BRIDGES,
  ...MISC,
  ...FURNITURE,
  ...LIGHTS,
  ...CROPS,
  ...SIGNS,
  ...EFFECTS,
  ...ROOFS,
];

// -------- Lookup helpers ---------------------------------------------------

const byFile = new Map(TILESETS.map((t) => [t.file, t]));
const byId   = new Map(TILESETS.map((t) => [t.id, t]));

export function getTilesetDef(file: string): TilesetDef | undefined {
  return byFile.get(file);
}
export function getTilesetDefById(id: string): TilesetDef | undefined {
  return byId.get(id);
}
export function listTilesets(): TilesetDef[] {
  return TILESETS;
}

/** Find the sub-region (if any) that a given tile-id within a tileset
 *  belongs to. Returns undefined when no override applies. */
export function matchSubRegion(def: TilesetDef, tileId: number): SubRegion | undefined {
  if (!def.subRegions) return undefined;
  // Iterate in reverse so later entries win on overlap.
  for (let i = def.subRegions.length - 1; i >= 0; i--) {
    const r = def.subRegions[i];
    if (tileId >= r.from && tileId <= r.to) return r;
  }
  return undefined;
}
