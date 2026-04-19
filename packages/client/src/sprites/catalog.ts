// Mana Seed Sprite Catalog
// ========================
// Single source of truth for every sprite sheet in the game.
// All paths are relative to /public/assets/.
//
// ─── TILE SYSTEM ───────────────────────────────────────────────────────────
// Ground tile size: 16×16 world units (see src/tile.ts)
// Character standard: 1 tile wide × 2 tiles tall = 16×32 px
//
// ─── FRAME GRID RULES ──────────────────────────────────────────────────────
// NPC pack characters     : 128×256, 32×32 frames, 4 cols × 8 rows
//   row 0 = walk down  | row 1 = walk left
//   row 2 = walk right | row 3 = walk up
//   rows 4-7 = NPC-specific extras (sit, wave, dance, etc.)
//
// Farmer base (paperdoll) : 1024×1024, 64×64 frames, 16 cols × 16 rows
//   Layer order (bottom→top): 00undr→01body→02sock→03fot1→04lwr1→05shrt
//   →06lwr2→07fot2→08lwr3→09hand→10outr→11neck→12face→13hair→14head→15over
//
// Summer forest tileset   : 512×336, 16×16 frames, 32 cols × 21 rows
// Crops (per-crop)        : 160×32, 16×32 frames, 10 cols × 1 row (growth stages)
//   col 0=seed, 1=sprout, 2=growing, 3=nearly ripe, 4=ripe, 5-9=harvest variants
// Fruit trees             : 336×512, 48×64 frames, 7 cols × 8 rows
// Growable trees          : 480×768, variable (see notes)
// Hardy horse             : 1024×512 per sheet, 64×64 frames, 16 cols × 8 rows
// Friendly foal           : 512×256 per sheet, 64×64 frames, 8 cols × 4 rows
// Delicate deer           : 512×640 per sheet, 64×64 frames, 8 cols × 10 rows

export type SpriteCategory =
  | "tileset"
  | "character-base"
  | "npc"
  | "livestock"
  | "animal"
  | "decoration"
  | "building"
  | "prop"
  | "crop"
  | "tree"
  | "effect"
  | "weather"
  | "font"
  | "reference"
  | "palette";

export interface SpriteSheet {
  /** Path relative to /public/assets/ */
  path: string;
  category: SpriteCategory;
  width: number;
  height: number;
  frameW: number;
  frameH: number;
  cols: number;
  rows: number;
  notes: string;
}

// ─────────────────────────────────────────────────────────────────────────────
// TILESETS — Ground / Terrain
// ─────────────────────────────────────────────────────────────────────────────

export const TILESETS = {
  // Summer (primary)
  SUMMER_FOREST:        { path: "tilesets/summer forest.png",                        category: "tileset", width: 512,  height: 336, frameW: 16, frameH: 16,  cols: 32, rows: 21, notes: "Primary summer forest ground/terrain. Col 4 row 0 = solid grass." },
  SUMMER_16x32:         { path: "tilesets/summer 16x32.png",                         category: "tileset", width: 96,   height: 32,  frameW: 16, frameH: 32,  cols: 6,  rows: 1,  notes: "Tall thin objects: grass tufts, reeds." },
  SUMMER_32x32:         { path: "tilesets/summer 32x32.png",                         category: "tileset", width: 224,  height: 32,  frameW: 32, frameH: 32,  cols: 7,  rows: 1,  notes: "Decorations: bushes, rocks, logs." },
  SUMMER_48x32:         { path: "tilesets/summer 48x32.png",                         category: "tileset", width: 144,  height: 32,  frameW: 48, frameH: 32,  cols: 3,  rows: 1,  notes: "Wide objects." },
  SUMMER_WANG:          { path: "tilesets/summer forest wang tiles.png",              category: "tileset", width: 1024, height: 512, frameW: 16, frameH: 16,  cols: 64, rows: 32, notes: "Wang autotile for ground/water/terrain transitions." },
  SUMMER_TREES:         { path: "tilesets/summer trees 80x112.png",                  category: "tileset", width: 240,  height: 112, frameW: 80, frameH: 112, cols: 3,  rows: 1,  notes: "Large trees: birch, chestnut, maple. Each 5×7 tiles." },
  SUMMER_TREE_WALL:     { path: "tilesets/summer forest tree wall 128x128.png",       category: "tileset", width: 768,  height: 512, frameW: 128,frameH: 128, cols: 6,  rows: 4,  notes: "Tree wall autotile with trunk and canopy." },
  SUMMER_TREE_WALL_CAP: { path: "tilesets/summer forest tree wall canopy 128x128.png",category: "tileset", width: 768,  height: 512, frameW: 128,frameH: 128, cols: 6,  rows: 4,  notes: "Canopy-only layer. Render above characters." },
  BRIDGE:               { path: "tilesets/bonus bridge.png",                          category: "tileset", width: 64,   height: 48,  frameW: 16, frameH: 16,  cols: 4,  rows: 3,  notes: "Wooden bridge tiles." },
  SHADOWS:              { path: "tilesets/bonus shadows.png",                         category: "tileset", width: 128,  height: 128, frameW: 16, frameH: 16,  cols: 8,  rows: 8,  notes: "Drop shadows for trees/objects." },

  // Seasonal variants — same layout as summer forest (512×336, 16×16, 32×21)
  SPRING_FOREST:        { path: "tilesets/seasonal/spring-spring forest.png",         category: "tileset", width: 512,  height: 336, frameW: 16, frameH: 16,  cols: 32, rows: 21, notes: "Spring forest ground/terrain variant." },
  AUTUMN_FOREST_CLEAN:  { path: "tilesets/seasonal/autumn-autumn forest (clean).png", category: "tileset", width: 512,  height: 336, frameW: 16, frameH: 16,  cols: 32, rows: 21, notes: "Autumn forest — no fallen leaves." },
  AUTUMN_FOREST_LEAVES: { path: "tilesets/seasonal/autumn-autumn forest (leaves).png",category: "tileset", width: 512,  height: 336, frameW: 16, frameH: 16,  cols: 32, rows: 21, notes: "Autumn forest — with fallen leaves." },
  AUTUMN_FOREST_BARE:   { path: "tilesets/seasonal/autumn-autumn forest (bare).png",  category: "tileset", width: 512,  height: 336, frameW: 16, frameH: 16,  cols: 32, rows: 21, notes: "Autumn forest — bare trees." },
  WINTER_FOREST_CLEAN:  { path: "tilesets/seasonal/winter-winter forest (clean).png", category: "tileset", width: 512,  height: 336, frameW: 16, frameH: 16,  cols: 32, rows: 21, notes: "Winter forest — clear ground." },
  WINTER_FOREST_SNOWY:  { path: "tilesets/seasonal/winter-winter forest (snowy).png", category: "tileset", width: 512,  height: 336, frameW: 16, frameH: 16,  cols: 32, rows: 21, notes: "Winter forest — snow-covered." },
  WINTER_FOREST_LEAVES: { path: "tilesets/seasonal/winter-winter forest (leaves).png",category: "tileset", width: 512,  height: 336, frameW: 16, frameH: 16,  cols: 32, rows: 21, notes: "Winter forest — with leaf litter." },
} as const satisfies Record<string, SpriteSheet>;

// ─────────────────────────────────────────────────────────────────────────────
// EFFECTS & WEATHER
// ─────────────────────────────────────────────────────────────────────────────

export const EFFECTS = {
  TALL_GRASS:     { path: "effects/summer tall grass 32x32.png",    category: "effect",  width: 160, height: 32,  frameW: 32, frameH: 32, cols: 5, rows: 1, notes: "Tall grass rustle. 5 frames, trigger on walk-through." },
  WATER_SPARKLE:  { path: "effects/summer water sparkles 16x16.png",category: "effect",  width: 64,  height: 48,  frameW: 16, frameH: 16, cols: 4, rows: 3, notes: "Water sparkle. Multiple variants." },
  WATERFALL:      { path: "effects/summer waterfall 16x16.png",     category: "effect",  width: 128, height: 160, frameW: 16, frameH: 16, cols: 8, rows: 10,notes: "Waterfall cascade. Looping." },
} as const satisfies Record<string, SpriteSheet>;

export const WEATHER = {
  RAIN_HEAVY:       { path: "weather/weather effects, rain heavy anim 32x128.png",    category: "weather", width: 256, height: 128, frameW: 32,  frameH: 128, cols: 8,  rows: 1, notes: "Heavy rain. 8 frames looping." },
  RAIN_LIGHT:       { path: "weather/weather effects, rain light anim 32x128.png",    category: "weather", width: 256, height: 128, frameW: 32,  frameH: 128, cols: 8,  rows: 1, notes: "Light rain." },
  RAIN_IMPACT:      { path: "weather/weather effects, rain impact anim 16x16.png",    category: "weather", width: 64,  height: 16,  frameW: 16,  frameH: 16,  cols: 4,  rows: 1, notes: "Rain splash on ground." },
  SNOW_COVER:       { path: "weather/weather effects, snow cover autotile 16x16.png", category: "weather", width: 48,  height: 128, frameW: 16,  frameH: 16,  cols: 3,  rows: 8, notes: "Snow cover autotile." },
  CLOUD_COVER:      { path: "weather/weather effects, cloud cover autotile 16x16.png",category: "weather", width: 48,  height: 128, frameW: 16,  frameH: 16,  cols: 3,  rows: 8, notes: "Cloud/overcast autotile." },
  LIGHTNING_FULL:   { path: "weather/weather effects, lightning full 32x128.png",     category: "weather", width: 64,  height: 128, frameW: 32,  frameH: 128, cols: 2,  rows: 1, notes: "Full lightning bolt." },
  LIGHTNING_IMPACT: { path: "weather/weather effects, lightning impact 32x48.png",    category: "weather", width: 64,  height: 48,  frameW: 32,  frameH: 48,  cols: 2,  rows: 1, notes: "Lightning ground impact flash." },
} as const satisfies Record<string, SpriteSheet>;

// ─────────────────────────────────────────────────────────────────────────────
// BUILDINGS
// All home sheets are 512×512 — composed of multiple sized tile elements.
// Use as static sprites or slice manually for parts.
// ─────────────────────────────────────────────────────────────────────────────

export const BUILDINGS = {
  THATCH_V1:       { path: "buildings/thatch/home exteriors, thatch roof v1.png",    category: "building", width: 512, height: 512, frameW: 512, frameH: 512, cols: 1, rows: 1, notes: "Thatch roof home exterior variant 1. Full sheet." },
  THATCH_V2:       { path: "buildings/thatch/home exteriors, thatch roof v2.png",    category: "building", width: 512, height: 512, frameW: 512, frameH: 512, cols: 1, rows: 1, notes: "Thatch roof home exterior variant 2." },
  THATCH_V3:       { path: "buildings/thatch/home exteriors, thatch roof v3.png",    category: "building", width: 512, height: 512, frameW: 512, frameH: 512, cols: 1, rows: 1, notes: "Thatch roof home exterior variant 3." },
  THATCH_INT_V1:   { path: "buildings/thatch/home interiors, thatch roof v1.png",    category: "building", width: 512, height: 512, frameW: 512, frameH: 512, cols: 1, rows: 1, notes: "Thatch roof home interior variant 1." },
  THATCH_INT_V2:   { path: "buildings/thatch/home interiors, thatch roof v2.png",    category: "building", width: 512, height: 512, frameW: 512, frameH: 512, cols: 1, rows: 1, notes: "Thatch roof home interior variant 2." },
  TIMBER_V1:       { path: "buildings/timber/home exteriors, timber roof v1.png",    category: "building", width: 512, height: 512, frameW: 512, frameH: 512, cols: 1, rows: 1, notes: "Timber roof home exterior variant 1." },
  TIMBER_V2:       { path: "buildings/timber/home exteriors, timber roof v2.png",    category: "building", width: 512, height: 512, frameW: 512, frameH: 512, cols: 1, rows: 1, notes: "Timber roof home exterior variant 2." },
  HALF_TIMBER_V1:  { path: "buildings/half-timber/home exteriors, half-timber v1.png",category: "building",width: 512, height: 512, frameW: 512, frameH: 512, cols: 1, rows: 1, notes: "Half-timber home exterior variant 1." },
  HALF_TIMBER_V2:  { path: "buildings/half-timber/home exteriors, half-timber v2.png",category: "building",width: 512, height: 512, frameW: 512, frameH: 512, cols: 1, rows: 1, notes: "Half-timber home exterior variant 2." },
  STONEWORK_V1:    { path: "buildings/stonework/home exteriors, stonework v1.png",   category: "building", width: 512, height: 512, frameW: 512, frameH: 512, cols: 1, rows: 1, notes: "Stonework home exterior variant 1." },
  STONEWORK_V2:    { path: "buildings/stonework/home exteriors, stonework v2.png",   category: "building", width: 512, height: 512, frameW: 512, frameH: 512, cols: 1, rows: 1, notes: "Stonework home exterior variant 2." },
} as const satisfies Record<string, SpriteSheet>;

// ─────────────────────────────────────────────────────────────────────────────
// PROPS — Fences, Furniture, Candles, Camp, Smithing, Fishing
// ─────────────────────────────────────────────────────────────────────────────

export const PROPS = {
  // Fences & Walls
  FENCES_V1:           { path: "props/fences/fences & walls v1.png",              category: "prop", width: 256, height: 384, frameW: 16, frameH: 16, cols: 16, rows: 24, notes: "Fences and walls tileset variant 1." },
  FENCES_V2:           { path: "props/fences/fences & walls v2.png",              category: "prop", width: 256, height: 384, frameW: 16, frameH: 16, cols: 16, rows: 24, notes: "Fences and walls variant 2." },
  FENCES_V3:           { path: "props/fences/fences & walls v3.png",              category: "prop", width: 256, height: 384, frameW: 16, frameH: 16, cols: 16, rows: 24, notes: "Fences and walls variant 3." },
  FENCES_V4:           { path: "props/fences/fences & walls v4.png",              category: "prop", width: 256, height: 384, frameW: 16, frameH: 16, cols: 16, rows: 24, notes: "Fences and walls variant 4." },
  HIGH_STONE_WALL:     { path: "props/fences/high stone wall 32x96.png",          category: "prop", width: 160, height: 384, frameW: 32, frameH: 96, cols: 5,  rows: 4,  notes: "High stone wall. 32×96 per tile." },
  IRON_DOOR:           { path: "props/fences/door, wrought iron 32x32.png",       category: "prop", width: 64,  height: 31,  frameW: 32, frameH: 31, cols: 2,  rows: 1,  notes: "Wrought iron door. 32×32 (approx)." },

  // Village accessories (multiple sizes)
  VILLAGE_16x16:       { path: "props/village/village accessories 16x16.png",     category: "prop", width: 256, height: 64,  frameW: 16, frameH: 16, cols: 16, rows: 4,  notes: "Small village props: barrels, crates, signs etc." },
  VILLAGE_16x32:       { path: "props/village/village accessories 16x32.png",     category: "prop", width: 256, height: 96,  frameW: 16, frameH: 32, cols: 16, rows: 3,  notes: "Tall village props." },
  VILLAGE_32x32:       { path: "props/village/village accessories 32x32.png",     category: "prop", width: 128, height: 160, frameW: 32, frameH: 32, cols: 4,  rows: 5,  notes: "Medium village props." },
  VILLAGE_32x64:       { path: "props/village/village accessories 32x64.png",     category: "prop", width: 128, height: 128, frameW: 32, frameH: 64, cols: 4,  rows: 2,  notes: "Large village props." },
  SIGNPOSTS:           { path: "props/village/signposts.png",                     category: "prop", width: 128, height: 64,  frameW: 32, frameH: 32, cols: 4,  rows: 2,  notes: "Signpost variants." },

  // Animated candles (palette variants v01-v04, two sizes)
  CANDLES_16x16_V1:    { path: "props/candles/animated candles anim 16x16 v01.png",category: "prop", width: 80, height: 192, frameW: 16, frameH: 16, cols: 5, rows: 12, notes: "Animated candle 16×16, palette v01. 5-frame flicker." },
  CANDLES_16x16_V2:    { path: "props/candles/animated candles anim 16x16 v02.png",category: "prop", width: 80, height: 192, frameW: 16, frameH: 16, cols: 5, rows: 12, notes: "Animated candle palette v02." },
  CANDLES_16x16_V3:    { path: "props/candles/animated candles anim 16x16 v03.png",category: "prop", width: 80, height: 192, frameW: 16, frameH: 16, cols: 5, rows: 12, notes: "Animated candle palette v03." },
  CANDLES_16x16_V4:    { path: "props/candles/animated candles anim 16x16 v04.png",category: "prop", width: 80, height: 192, frameW: 16, frameH: 16, cols: 5, rows: 12, notes: "Animated candle palette v04." },
  CANDLES_16x32_V1:    { path: "props/candles/animated candles anim 16x32 v01.png",category: "prop", width: 80, height: 192, frameW: 16, frameH: 32, cols: 5, rows: 6,  notes: "Tall candle 16×32, palette v01." },

  // Cozy furnishings (interior decor)
  FURNISHINGS_16x16:   { path: "props/furnishings/cozy furnishings 16x16.png",    category: "prop", width: 512, height: 64,  frameW: 16, frameH: 16,  cols: 32, rows: 4,  notes: "Small interior furnishings." },
  FURNISHINGS_16x32:   { path: "props/furnishings/cozy furnishings 16x32.png",    category: "prop", width: 512, height: 256, frameW: 16, frameH: 32,  cols: 32, rows: 8,  notes: "Medium height furnishings." },
  FURNISHINGS_32x32:   { path: "props/furnishings/cozy furnishings 32x32.png",    category: "prop", width: 512, height: 256, frameW: 32, frameH: 32,  cols: 16, rows: 8,  notes: "Standard furnishings." },
  FURNISHINGS_32x48:   { path: "props/furnishings/cozy furnishings 32x48.png",    category: "prop", width: 512, height: 336, frameW: 32, frameH: 48,  cols: 16, rows: 7,  notes: "Tall furnishings." },
  FURNISHINGS_32x80:   { path: "props/furnishings/cozy furnishings 32x80.png",    category: "prop", width: 512, height: 336, frameW: 32, frameH: 80,  cols: 16, rows: 4,  notes: "Very tall furnishings (wardrobes, shelves)." },
  FURNISHINGS_48x32:   { path: "props/furnishings/cozy furnishings 48x32.png",    category: "prop", width: 512, height: 256, frameW: 48, frameH: 32,  cols: 10, rows: 8,  notes: "Wide furnishings." },

  // Traveler's camp
  CAMP_32x32:          { path: "props/camp/travelers camp 32x32.png",             category: "prop", width: 160, height: 96,  frameW: 32, frameH: 32,  cols: 5, rows: 3, notes: "Camp items: fire pit, bedroll, pack etc." },
  CAMP_TENT_16x16:     { path: "props/camp/travelers camp tent 16x16.png",        category: "prop", width: 48,  height: 16,  frameW: 16, frameH: 16,  cols: 3, rows: 1, notes: "Tent tiles at 16×16." },
  CAMP_TENT_64x64:     { path: "props/camp/travelers camp tent 64x64.png",        category: "prop", width: 128, height: 64,  frameW: 64, frameH: 64,  cols: 2, rows: 1, notes: "Tent sprite at 64×64." },

  // Smithing gear
  SMITHING_16x16:      { path: "props/smithing/blacksmithing 16x16.png",          category: "prop", width: 128, height: 16,  frameW: 16, frameH: 16,  cols: 8,  rows: 1, notes: "Small smithing items." },
  SMITHING_16x32:      { path: "props/smithing/blacksmithing 16x32.png",          category: "prop", width: 128, height: 32,  frameW: 16, frameH: 32,  cols: 8,  rows: 1, notes: "Tall smithing items." },
  SMITHING_32x48:      { path: "props/smithing/blacksmithing 32x48.png",          category: "prop", width: 128, height: 48,  frameW: 32, frameH: 48,  cols: 4,  rows: 1, notes: "Large smithing items." },
  SMITHING_FORGE:      { path: "props/smithing/blacksmithing forge.png",           category: "prop", width: 64,  height: 96,  frameW: 64, frameH: 96,  cols: 1,  rows: 1, notes: "Forge — single large sprite." },

  // Fishing gear
  FISHING_ANIM:        { path: "props/fishing/fishing anim 32x32.png",            category: "prop", width: 128, height: 32,  frameW: 32, frameH: 32,  cols: 4, rows: 1, notes: "Fishing bobber animation. 4 frames." },
  FISHING_OBJECTS:     { path: "props/fishing/fishing objects 32x32.png",         category: "prop", width: 128, height: 32,  frameW: 32, frameH: 32,  cols: 4, rows: 1, notes: "Fishing props: rods, tackle." },
  FISHING_OBJECTS_tall:{ path: "props/fishing/fishing objects 16x32.png",         category: "prop", width: 48,  height: 32,  frameW: 16, frameH: 32,  cols: 3, rows: 1, notes: "Tall fishing props." },

  // Livestock accessories
  LIVESTOCK_ACC_16x16: { path: "props/livestock-accessories/livestock accessories 16x16.png", category: "prop", width: 128, height: 64, frameW: 16, frameH: 16, cols: 8, rows: 4, notes: "Small livestock accessories: food bowls, nesting boxes." },
  LIVESTOCK_ACC_48x32: { path: "props/livestock-accessories/livestock accessories 48x32.png", category: "prop", width: 144, height: 32, frameW: 48, frameH: 32, cols: 3, rows: 1, notes: "Large livestock accessories: hay bale, trough." },
  HAY_PILE:            { path: "props/livestock-accessories/hay pile 48x48.png",             category: "prop", width: 48,  height: 48,  frameW: 48, frameH: 48, cols: 1, rows: 1, notes: "Hay pile — single sprite." },
} as const satisfies Record<string, SpriteSheet>;

// ─────────────────────────────────────────────────────────────────────────────
// CROPS — 16×32 frames, 10 cols × 1 row per crop sheet
// col 0=seed, 1=sprout, 2-3=growing, 4=nearly ripe, 5=ripe, 6-9=harvest stages
// ─────────────────────────────────────────────────────────────────────────────

// Combined sheets (all crops of a set on one sheet)
export const CROP_SHEETS = {
  CROPS1_A: { path: "crops/sheets/farming crops 1-A 16x32.png", category: "crop", width: 160, height: 512, frameW: 16, frameH: 32, cols: 10, rows: 16, notes: "Farming Crops #1, sheet A — 16 crop types, 10 growth frames each." },
  CROPS1_B: { path: "crops/sheets/farming crops 1-B 16x32.png", category: "crop", width: 160, height: 512, frameW: 16, frameH: 32, cols: 10, rows: 16, notes: "Farming Crops #1, sheet B." },
  CROPS1_C: { path: "crops/sheets/farming crops 1-C 16x32.png", category: "crop", width: 160, height: 512, frameW: 16, frameH: 32, cols: 10, rows: 16, notes: "Farming Crops #1, sheet C." },
  CROPS2_A: { path: "crops/sheets/farming crops 2-A 16x32.png", category: "crop", width: 160, height: 512, frameW: 16, frameH: 32, cols: 10, rows: 16, notes: "Farming Crops #2, sheet A." },
  CROPS2_B: { path: "crops/sheets/farming crops 2-B 16x32.png", category: "crop", width: 160, height: 32,  frameW: 16, frameH: 32, cols: 10, rows: 1,  notes: "Farming Crops #2, sheet B." },
} as const satisfies Record<string, SpriteSheet>;

// Individual crop sheets (160×32, 16×32, 10 cols × 1 row)
const CROP = (name: string): SpriteSheet => ({
  path: `crops/by-crop/farming crops (${name}) 16x32.png`,
  category: "crop", width: 160, height: 32, frameW: 16, frameH: 32, cols: 10, rows: 1,
  notes: `${name} — 10 growth stages (seed→harvest).`,
});

export const CROPS = {
  // Farming Crops #1
  BARLEY: CROP("barley"), BEANS_BLACK: CROP("beansblack"), BEANS_KIDNEY: CROP("beanskidney"),
  BEANS_PINTO: CROP("beanspinto"), BEETROOT: CROP("beetroot"), BEETROOT_GOLDEN: CROP("beetrootgolden"),
  BEETROOT_WHITE: CROP("beetrootwhite"), BROCCOLI: CROP("broccoli"), CABBAGE: CROP("cabbage"),
  CABBAGE_RED: CROP("cabbagered"), CARROT: CROP("carrot"), CAULIFLOWER: CROP("cauliflower"),
  CORN_BLUE: CROP("cornblue"), CORN_RED: CROP("cornred"), CORN_WHITE: CROP("cornwhite"),
  CORN_YELLOW: CROP("cornyellow"), CUCUMBER: CROP("cucumber"),
  GRAPES_BLUE: CROP("grapesblue"), GRAPES_GREEN: CROP("grapesgreen"), GRAPES_RED: CROP("grapesred"),
  ONION_RED: CROP("onionred"), ONION_YELLOW: CROP("onionyellow"), PARSNIP: CROP("parsnip"),
  PEAS_GREEN: CROP("peasgreen"), POTATO_BROWN: CROP("potatobrown"), POTATO_PURPLE: CROP("potatopurple"),
  POTATO_RED: CROP("potatored"), POTATO_WHITE: CROP("potatowhite"), PUMPKIN: CROP("pumpkin"),
  PUMPKIN_CANDY: CROP("pumpkincottoncandy"), RYE: CROP("rye"), SPINACH: CROP("spinach"),
  STRAWBERRY: CROP("strawberry"), TOMATO: CROP("tomato"), TOMATO_GOLDEN: CROP("tomatogolden"),
  TOMATO_GREEN: CROP("tomatogreen"), TOMATO_ORANGE: CROP("tomatoorange"), WHEAT: CROP("wheat"),
  // Farming Crops #2
  ARTICHOKE: CROP("artichoke"), BELL_PEPPER_GREEN: CROP("bellpeppergreen"),
  BELL_PEPPER_ORANGE: CROP("bellpepperorange"), BELL_PEPPER_RED: CROP("bellpepperred"),
  BELL_PEPPER_YELLOW: CROP("bellpepperyellow"), BLACKBERRIES: CROP("blackberries"),
  BLACK_CURRANTS: CROP("blackcurrants"), BLUEBERRIES: CROP("blueberries"),
  BOYSENBERRIES: CROP("boysenberries"), CELERY: CROP("celery"),
  CHILI_GREEN: CROP("chilipeppergreen"), CHILI_RED: CROP("chilipepperred"),
  CRANBERRIES: CROP("cranberries"), EGGPLANT: CROP("eggplant"), EGGPLANT_WHITE: CROP("eggplantwhite"),
  GARLIC: CROP("garlic"), KALE: CROP("kale"), LEEK: CROP("leek"), LETTUCE: CROP("lettuce"),
  OATS: CROP("oats"), RADISH: CROP("radish"), RASPBERRIES: CROP("raspberries"),
  RHUBARB: CROP("rhubarb"), RUTABAGA: CROP("rutabega"), SUMMER_SQUASH: CROP("summersquash"),
  SWEET_POTATO: CROP("sweetpotato"), TURNIP: CROP("turnip"), WATERMELON: CROP("watermelon"),
  YAM: CROP("yam"), ZUCCHINI: CROP("zucchini"),
} as const;

// ─────────────────────────────────────────────────────────────────────────────
// TREES
// ─────────────────────────────────────────────────────────────────────────────

export const TREES = {
  // Growable trees — 480×768, multi-stage growth sheets
  BIRCH:          { path: "trees/growable/growable tree (birch).png",           category: "tree", width: 480, height: 768, frameW: 96, frameH: 96, cols: 5, rows: 8, notes: "Growable birch — growth stages top to bottom." },
  CHESTNUT:       { path: "trees/growable/growable tree (chestnut).png",        category: "tree", width: 480, height: 768, frameW: 96, frameH: 96, cols: 5, rows: 8, notes: "Growable chestnut." },
  MAPLE:          { path: "trees/growable/growable tree (maple).png",           category: "tree", width: 480, height: 768, frameW: 96, frameH: 96, cols: 5, rows: 8, notes: "Growable maple." },
  BIRCH_NOSHADOW: { path: "trees/growable/growable tree (birch) no shadow.png", category: "tree", width: 480, height: 768, frameW: 96, frameH: 96, cols: 5, rows: 8, notes: "Growable birch — no drop shadow variant." },
  CHESTNUT_NOSHADOW:{ path: "trees/growable/growable tree (chestnut) no shadow.png", category: "tree", width: 480, height: 768, frameW: 96, frameH: 96, cols: 5, rows: 8, notes: "Growable chestnut no shadow." },
  MAPLE_NOSHADOW: { path: "trees/growable/growable tree (maple) no shadow.png", category: "tree", width: 480, height: 768, frameW: 96, frameH: 96, cols: 5, rows: 8, notes: "Growable maple no shadow." },

  // Fruit trees — 336×512, 48×64 frames, 7 cols × 8 rows
  // Rows = growth stages, cols = animation frames
  APPLE_RED:      { path: "trees/fruit/fruit trees (apple, red) 48x64.png",    category: "tree", width: 336, height: 512, frameW: 48, frameH: 64, cols: 7, rows: 8, notes: "Red apple tree — growth + harvest stages." },
  APPLE_GREEN:    { path: "trees/fruit/fruit trees (apple, green) 48x64.png",  category: "tree", width: 336, height: 512, frameW: 48, frameH: 64, cols: 7, rows: 8, notes: "Green apple tree." },
  APPLE_YELLOW:   { path: "trees/fruit/fruit trees (apple, yellow) 48x64.png", category: "tree", width: 336, height: 512, frameW: 48, frameH: 64, cols: 7, rows: 8, notes: "Yellow apple tree." },
  APRICOT:        { path: "trees/fruit/fruit trees (apricot) 48x64.png",       category: "tree", width: 336, height: 512, frameW: 48, frameH: 64, cols: 7, rows: 8, notes: "Apricot tree." },
  ORANGE:         { path: "trees/fruit/fruit trees (orange) 48x64.png",        category: "tree", width: 336, height: 512, frameW: 48, frameH: 64, cols: 7, rows: 8, notes: "Orange tree." },
  PEACH:          { path: "trees/fruit/fruit trees (peach) 48x64.png",         category: "tree", width: 336, height: 512, frameW: 48, frameH: 64, cols: 7, rows: 8, notes: "Peach tree." },
  PEAR:           { path: "trees/fruit/fruit trees (pear) 48x64.png",          category: "tree", width: 336, height: 512, frameW: 48, frameH: 64, cols: 7, rows: 8, notes: "Pear tree." },
  PLUM:           { path: "trees/fruit/fruit trees (plum) 48x64.png",          category: "tree", width: 336, height: 512, frameW: 48, frameH: 64, cols: 7, rows: 8, notes: "Plum tree." },
} as const satisfies Record<string, SpriteSheet>;

// ─────────────────────────────────────────────────────────────────────────────
// ANIMALS
// ─────────────────────────────────────────────────────────────────────────────

export const ANIMALS = {
  // Delicate Deer — 512×640, 64×64 frames, 8 cols × 10 rows
  DEER_V1: { path: "animals/deer/delicate dear v01.png", category: "animal", width: 512, height: 640, frameW: 64, frameH: 64, cols: 8, rows: 10, notes: "Deer palette v01. Row layout: idle, walk, run, eat, sleep." },
  DEER_V2: { path: "animals/deer/delicate dear v02.png", category: "animal", width: 512, height: 640, frameW: 64, frameH: 64, cols: 8, rows: 10, notes: "Deer palette v02." },
  DEER_V3: { path: "animals/deer/delicate dear v03.png", category: "animal", width: 512, height: 640, frameW: 64, frameH: 64, cols: 8, rows: 10, notes: "Deer palette v03." },
  DEER_V4: { path: "animals/deer/delicate dear v04.png", category: "animal", width: 512, height: 640, frameW: 64, frameH: 64, cols: 8, rows: 10, notes: "Deer palette v04." },

  // Hardy Horse — 1024×512 per sheet (bottom/top layers), 64×64 frames, 16×8
  // Composed of two layers: bottom (legs) + top (body/head)
  HORSE_BOTTOM_V00: { path: "animals/horse/hardy horse bottom v00.png", category: "animal", width: 1024, height: 512, frameW: 64, frameH: 64, cols: 16, rows: 8, notes: "Horse bottom layer (legs) palette v00." },
  HORSE_BOTTOM_V01: { path: "animals/horse/hardy horse bottom v01.png", category: "animal", width: 1024, height: 512, frameW: 64, frameH: 64, cols: 16, rows: 8, notes: "Horse bottom layer palette v01." },
  HORSE_BOTTOM_V02: { path: "animals/horse/hardy horse bottom v02.png", category: "animal", width: 1024, height: 512, frameW: 64, frameH: 64, cols: 16, rows: 8, notes: "Horse bottom layer palette v02." },
  HORSE_BOTTOM_V03: { path: "animals/horse/hardy horse bottom v03.png", category: "animal", width: 1024, height: 512, frameW: 64, frameH: 64, cols: 16, rows: 8, notes: "Horse bottom layer palette v03." },
  HORSE_BOTTOM_V04: { path: "animals/horse/hardy horse bottom v04.png", category: "animal", width: 1024, height: 512, frameW: 64, frameH: 64, cols: 16, rows: 8, notes: "Horse bottom layer palette v04." },

  // Friendly Foal — 512×256, 64×64 frames, 8 cols × 4 rows
  FOAL_V00: { path: "animals/foal/foal v00.png", category: "animal", width: 512, height: 256, frameW: 64, frameH: 64, cols: 8, rows: 4, notes: "Foal palette v00. Rows: walk, trot, idle, sleep." },
  FOAL_V01: { path: "animals/foal/foal v01.png", category: "animal", width: 512, height: 256, frameW: 64, frameH: 64, cols: 8, rows: 4, notes: "Foal palette v01." },
  FOAL_V02: { path: "animals/foal/foal v02.png", category: "animal", width: 512, height: 256, frameW: 64, frameH: 64, cols: 8, rows: 4, notes: "Foal palette v02." },
  FOAL_V03: { path: "animals/foal/foal v03.png", category: "animal", width: 512, height: 256, frameW: 64, frameH: 64, cols: 8, rows: 4, notes: "Foal palette v03." },
  FOAL_V04: { path: "animals/foal/foal v04.png", category: "animal", width: 512, height: 256, frameW: 64, frameH: 64, cols: 8, rows: 4, notes: "Foal palette v04." },
} as const satisfies Record<string, SpriteSheet>;

// ─────────────────────────────────────────────────────────────────────────────
// FARMER BASE SYSTEM — paperdoll, 1024×1024, 64×64 cells, 16×16 grid
// ─────────────────────────────────────────────────────────────────────────────

const FB: Omit<SpriteSheet, "path" | "notes"> = { category: "character-base", width: 1024, height: 1024, frameW: 64, frameH: 64, cols: 16, rows: 16 };
const fb = (path: string, notes: string): SpriteSheet => ({ ...FB, path, notes });

export const FARMER_BASE = {
  // Layer 00 — underclothes (bottom-most visible layer)
  CLOAK_PLAIN:             fb("characters/farmer/00undr/fbas_00undr_cloakplain_00d.png",            "00undr — plain cloak undergarment."),
  CLOAK_MANTLE_PLAIN:      fb("characters/farmer/00undr/fbas_00undr_cloakwithmantleplain_00b.png",  "00undr — cloak with mantle undergarment."),
  // Layer 01 — base body
  BODY_HUMAN:              fb("characters/farmer/01body/fbas_01body_human_00.png",                  "01body — human body base, universal skin."),
  BODY_HUMAN_NOLEGS:       fb("characters/farmer/01body/fbas_01body_humannolegs_00.png",            "01body — body without legs (for long robes)."),
  // Layer 02 — socks
  SOCKS_HIGH:              fb("characters/farmer/02sock/fbas_02sock_sockshigh_00a.png",             "02sock — high socks."),
  SOCKS_LOW:               fb("characters/farmer/02sock/fbas_02sock_sockslow_00a.png",              "02sock — low socks."),
  STOCKINGS:               fb("characters/farmer/02sock/fbas_02sock_stockings_00a.png",             "02sock — stockings."),
  // Layer 03 — footwear under pants
  BOOTS:                   fb("characters/farmer/03fot1/fbas_03fot1_boots_00a.png",                 "03fot1 — boots."),
  SANDALS:                 fb("characters/farmer/03fot1/fbas_03fot1_sandals_00a.png",               "03fot1 — sandals."),
  SHOES:                   fb("characters/farmer/03fot1/fbas_03fot1_shoes_00a.png",                 "03fot1 — shoes."),
  // Layer 04 — lower body 1 (pants/skirts)
  LONG_PANTS:              fb("characters/farmer/04lwr1/fbas_04lwr1_longpants_00a.png",             "04lwr1 — long pants."),
  ONEPIECE:                fb("characters/farmer/04lwr1/fbas_04lwr1_onepiece_00a.png",              "04lwr1 — one-piece outfit."),
  ONEPIECE_BOOBS:          fb("characters/farmer/04lwr1/fbas_04lwr1_onepieceboobs_00a.png",         "04lwr1 — one-piece, chest shape variant."),
  SHORTS:                  fb("characters/farmer/04lwr1/fbas_04lwr1_shorts_00a.png",                "04lwr1 — shorts."),
  UNDIES:                  fb("characters/farmer/04lwr1/fbas_04lwr1_undies_00a.png",                "04lwr1 — underwear."),
  // Layer 05 — shirt/top
  BRA:                     fb("characters/farmer/05shrt/fbas_05shrt_bra_00a.png",                   "05shrt — bra."),
  LONG_SHIRT:              fb("characters/farmer/05shrt/fbas_05shrt_longshirt_00a.png",             "05shrt — long shirt."),
  LONG_SHIRT_BOOBS:        fb("characters/farmer/05shrt/fbas_05shrt_longshirtboobs_00a.png",        "05shrt — long shirt, chest shape variant."),
  SHORT_SHIRT:             fb("characters/farmer/05shrt/fbas_05shrt_shortshirt_00a.png",            "05shrt — short shirt."),
  SHORT_SHIRT_BOOBS:       fb("characters/farmer/05shrt/fbas_05shrt_shortshirtboobs_00a.png",       "05shrt — short shirt, chest shape variant."),
  TANK_TOP:                fb("characters/farmer/05shrt/fbas_05shrt_tanktop_00a.png",               "05shrt — tank top."),
  TANK_TOP_BOOBS:          fb("characters/farmer/05shrt/fbas_05shrt_tanktopboobs_00a.png",          "05shrt — tank top, chest shape variant."),
  // Layer 06 — lower body 2 (overalls, skirts)
  OVERALLS:                fb("characters/farmer/06lwr2/fbas_06lwr2_overalls_00a.png",              "06lwr2 — overalls."),
  OVERALLS_BOOBS:          fb("characters/farmer/06lwr2/fbas_06lwr2_overallsboobs_00a.png",         "06lwr2 — overalls, chest shape variant."),
  SHORTALLS:               fb("characters/farmer/06lwr2/fbas_06lwr2_shortalls_00a.png",             "06lwr2 — shortalls."),
  SHORTALLS_BOOBS:         fb("characters/farmer/06lwr2/fbas_06lwr2_shortallsboobs_00a.png",        "06lwr2 — shortalls, chest shape variant."),
  // Layer 07 — footwear over pants
  CUFFED_BOOTS:            fb("characters/farmer/07fot2/fbas_07fot2_cuffedboots_00a.png",           "07fot2 — cuffed boots (over pants)."),
  CURLY_TOE_SHOES:         fb("characters/farmer/07fot2/fbas_07fot2_curlytoeshoes_00a.png",         "07fot2 — curly toe shoes."),
  // Layer 08 — lower body 3 (dresses/long skirts)
  FRILLY_DRESS:            fb("characters/farmer/08lwr3/fbas_08lwr3_frillydress_00a.png",           "08lwr3 — frilly dress."),
  FRILLY_DRESS_BOOBS:      fb("characters/farmer/08lwr3/fbas_08lwr3_frillydressboobs_00a.png",      "08lwr3 — frilly dress, chest variant."),
  FRILLY_SKIRT:            fb("characters/farmer/08lwr3/fbas_08lwr3_frillyskirt_00a.png",           "08lwr3 — frilly skirt."),
  LONG_DRESS:              fb("characters/farmer/08lwr3/fbas_08lwr3_longdress_00a.png",             "08lwr3 — long dress."),
  LONG_DRESS_BOOBS:        fb("characters/farmer/08lwr3/fbas_08lwr3_longdressboobs_00a.png",        "08lwr3 — long dress, chest variant."),
  LONG_SKIRT:              fb("characters/farmer/08lwr3/fbas_08lwr3_longskirt_00a.png",             "08lwr3 — long skirt."),
  // Layer 09 — hand/gloves
  GLOVES:                  fb("characters/farmer/09hand/fbas_09hand_gloves_00a.png",                "09hand — gloves."),
  // Layer 10 — outer layer (vest, suspenders)
  SUSPENDERS:              fb("characters/farmer/10outr/fbas_10outr_suspenders_00a.png",            "10outr — suspenders."),
  VEST:                    fb("characters/farmer/10outr/fbas_10outr_vest_00a.png",                  "10outr — vest."),
  // Layer 11 — neck/collar (cloaks, scarves)
  NECK_CLOAK:              fb("characters/farmer/11neck/fbas_11neck_cloakplain_00d.png",            "11neck — plain cloak."),
  NECK_CLOAK_MANTLE:       fb("characters/farmer/11neck/fbas_11neck_cloakwithmantleplain_00b.png",  "11neck — cloak with mantle."),
  MANTLE:                  fb("characters/farmer/11neck/fbas_11neck_mantleplain_00b.png",           "11neck — mantle only."),
  SCARF:                   fb("characters/farmer/11neck/fbas_11neck_scarf_00b.png",                 "11neck — scarf."),
  // Layer 12 — face accessories
  GLASSES:                 fb("characters/farmer/12face/fbas_12face_glasses_00a.png",               "12face — glasses."),
  SHADES:                  fb("characters/farmer/12face/fbas_12face_shades_00a.png",                "12face — sunglasses."),
  // Layer 13 — hair
  HAIR_AFRO:               fb("characters/farmer/13hair/fbas_13hair_afro_00.png",                   "13hair — afro."),
  HAIR_AFRO_PUFFS:         fb("characters/farmer/13hair/fbas_13hair_afropuffs_00.png",              "13hair — afro puffs."),
  HAIR_BOB1:               fb("characters/farmer/13hair/fbas_13hair_bob1_00.png",                   "13hair — bob style 1."),
  HAIR_BOB2:               fb("characters/farmer/13hair/fbas_13hair_bob2_00.png",                   "13hair — bob style 2."),
  HAIR_BUSHY:              fb("characters/farmer/13hair/fbas_13hair_bushy_00.png",                  "13hair — bushy hair."),
  HAIR_DAPPER:             fb("characters/farmer/13hair/fbas_13hair_dapper_00.png",                 "13hair — dapper/slicked back."),
  HAIR_FLAT_TOP:           fb("characters/farmer/13hair/fbas_13hair_flattop_00.png",                "13hair — flat top."),
  HAIR_LONG_BOUND:         fb("characters/farmer/13hair/fbas_13hair_longbound_00.png",              "13hair — long bound/ponytail low."),
  HAIR_LONG_BOUND_CLASPED: fb("characters/farmer/13hair/fbas_13hair_longboundclasped_00f.png",      "13hair — long bound with clasp."),
  HAIR_LONG_WAVY:          fb("characters/farmer/13hair/fbas_13hair_longwavy_00.png",               "13hair — long wavy."),
  HAIR_MOHAWK:             fb("characters/farmer/13hair/fbas_13hair_mohawk_00_e.png",               "13hair — mohawk."),
  HAIR_PONYTAIL:           fb("characters/farmer/13hair/fbas_13hair_ponytail1_00.png",              "13hair — ponytail."),
  HAIR_SPIKY1:             fb("characters/farmer/13hair/fbas_13hair_spiky1_00.png",                 "13hair — spiky style 1."),
  HAIR_SPIKY2:             fb("characters/farmer/13hair/fbas_13hair_spiky2_00.png",                 "13hair — spiky style 2."),
  HAIR_TOP_KNOT:           fb("characters/farmer/13hair/fbas_13hair_topknot_00f.png",               "13hair — top knot."),
  HAIR_TWIN_TAIL:          fb("characters/farmer/13hair/fbas_13hair_twintail_00.png",               "13hair — twin tails."),
  HAIR_TWISTS:             fb("characters/farmer/13hair/fbas_13hair_twists_00.png",                 "13hair — twists/locs."),
  // Layer 14 — head (hats)
  HAT_BANDANA:             fb("characters/farmer/14head/fbas_14head_bandana_00b_e.png",             "14head — bandana."),
  HAT_BOATER:              fb("characters/farmer/14head/fbas_14head_boaterhat_00d.png",             "14head — boater hat palette 00d."),
  HAT_BOATER_01:           fb("characters/farmer/14head/fbas_14head_boaterhat_01.png",              "14head — boater hat palette 01."),
  HAT_COWBOY:              fb("characters/farmer/14head/fbas_14head_cowboyhat_00d.png",             "14head — cowboy hat palette 00d."),
  HAT_COWBOY_01:           fb("characters/farmer/14head/fbas_14head_cowboyhat_01.png",              "14head — cowboy hat palette 01."),
  HAT_FLOPPY:              fb("characters/farmer/14head/fbas_14head_floppyhat_00d.png",             "14head — floppy hat."),
  HAT_HEADSCARF:           fb("characters/farmer/14head/fbas_14head_headscarf_00b_e.png",           "14head — headscarf."),
  HAT_MUSHROOM1:           fb("characters/farmer/14head/fbas_14head_mushroom1_00d.png",             "14head — mushroom hat palette 00d."),
  HAT_STRAW:               fb("characters/farmer/14head/fbas_14head_strawhat_00d.png",              "14head — straw hat."),
} as const satisfies Record<string, SpriteSheet>;

// Farmer effects/animations/weapons (from farmer sprite system)
export const FARMER_EFFECTS = {
  ANIMATIONS_32: { path: "characters/farmer/farmer-system/farmer animations 32x32 v00.png", category: "character-base", width: 192,  height: 512, frameW: 32, frameH: 32, cols: 6, rows: 16, notes: "Farmer animation sheet 32×32 — effect overlays." },
  ANIMATIONS_64: { path: "characters/farmer/farmer-system/farmer animations 64x64 v00.png", category: "character-base", width: 512,  height: 512, frameW: 64, frameH: 64, cols: 8, rows: 8,  notes: "Farmer animation sheet 64×64." },
  PROPS_32:      { path: "characters/farmer/farmer-system/farmer props 32x32 v00.png",      category: "character-base", width: 256,  height: 256, frameW: 32, frameH: 32, cols: 8, rows: 8,  notes: "Farmer held props (tools, items) 32×32." },
  SLASH_EFFECTS: { path: "characters/farmer/farmer-system/farmer slash effects 64x64.png",  category: "effect",          width: 512,  height: 512, frameW: 64, frameH: 64, cols: 8, rows: 8,  notes: "Combat slash effect animations." },
  TOOL_1:        { path: "characters/farmer/farmer-system/farmer tool 001 v00.png",         category: "character-base", width: 224,  height: 32,  frameW: 32, frameH: 32, cols: 7, rows: 1,  notes: "Tool overlay sheet 1 (hoe/axe)." },
  TOOL_2:        { path: "characters/farmer/farmer-system/farmer tool 002 v00.png",         category: "character-base", width: 224,  height: 32,  frameW: 32, frameH: 32, cols: 7, rows: 1,  notes: "Tool overlay sheet 2." },
  TOOL_3:        { path: "characters/farmer/farmer-system/farmer tool 003 v00.png",         category: "character-base", width: 224,  height: 32,  frameW: 32, frameH: 32, cols: 7, rows: 1,  notes: "Tool overlay sheet 3." },
  BOW_1:         { path: "characters/farmer/farmer-system/farmer bow 001 32x32 v00.png",    category: "character-base", width: 128,  height: 32,  frameW: 32, frameH: 32, cols: 4, rows: 1,  notes: "Bow weapon overlay." },
  ARROW:         { path: "characters/farmer/farmer-system/farmer arrow 001 16x16 v00.png",  category: "character-base", width: 80,   height: 32,  frameW: 16, frameH: 16, cols: 5, rows: 2,  notes: "Arrow sprite sheet." },
  ICONS:         { path: "characters/farmer/farmer-system/farmer icons 16x16 v00.png",      category: "character-base", width: 128,  height: 256, frameW: 16, frameH: 16, cols: 8, rows: 16, notes: "Farmer UI icons 16×16." },
} as const satisfies Record<string, SpriteSheet>;

// ─────────────────────────────────────────────────────────────────────────────
// NPC PACK #1 — 128×256, 32×32, 4 cols × 8 rows
// ─────────────────────────────────────────────────────────────────────────────

const NPC: Omit<SpriteSheet, "path" | "notes"> = { category: "npc", width: 128, height: 256, frameW: 32, frameH: 32, cols: 4, rows: 8 };
const npc = (path: string, notes: string): SpriteSheet => ({ ...NPC, path, notes });
const npcV = (name: string, label: string, maxV: number, extra = "") =>
  Object.fromEntries(Array.from({ length: maxV + 1 }, (_, i) => {
    const v = String(i).padStart(2, "0");
    return [`v${v}`, npc(`characters/npc/${name} v${v}.png`, `${label} palette v${v}.${extra ? " " + extra : ""}`)];
  })) as Record<string, SpriteSheet>;

export const NPCS = {
  BABY_A:      npcV("npc baby A",      "Baby A",      4),
  BABY_B:      npcV("npc baby B",      "Baby B",      4),
  BARD_A:      npcV("npc bard A",      "Bard A",      4, "Holds instrument."),
  BARD_B:      npcV("npc bard B",      "Bard B",      4),
  DANCER_A:    npcV("npc dancer A",    "Dancer A",    4, "Dance rows 4-7."),
  DANCER_B:    npcV("npc dancer B",    "Dancer B",    4),
  KING_A:      npcV("npc king A",      "King A",      4, "Crown and robe."),
  MERCHANT_A:  npcV("npc merchant A",  "Merchant A",  3),
  MERCHANT_B:  npcV("npc merchant B",  "Merchant B",  3),
  MERCHANT_C:  npcV("npc merchant C",  "Merchant C",  3),
  MERCHANT_D:  npcV("npc merchant D",  "Merchant D",  3),
  MYSTIC_A:    npcV("npc mystic A",    "Mystic A",    3, "Fortune-teller."),
  OLD_MAN_A:   npcV("npc old man A",   "Old Man A",   4),
  OLD_MAN_B:   npcV("npc old man B",   "Old Man B",   4),
  OLD_WOMAN_A: npcV("npc old woman A", "Old Woman A", 4),
  OLD_WOMAN_B: npcV("npc old woman B", "Old Woman B", 4),
  OLD_WOMAN_C: npcV("npc old woman C", "Old Woman C", 4),
  QUEEN_A:     npcV("npc queen A",     "Queen A",     4, "Crown, royal dress."),
  WOMAN_A:     npcV("npc woman A",     "Woman A",     4),
  WOMAN_B:     npcV("npc woman B",     "Woman B",     4),
} as const;

// ─────────────────────────────────────────────────────────────────────────────
// NPC PACK #2 — same format (128×256, 32×32, 4×8)
// ─────────────────────────────────────────────────────────────────────────────

export const NPCS2 = {
  BOY:     npcV("npc boy",    "Boy",    4),
  CAT:     npcV("npc cat",    "Cat",    5, "Animal NPC. Row 4+ = unique actions."),
  CHEF:    npcV("npc chef",   "Chef",   4),
  DANDY:   npcV("npc dandy",  "Dandy",  5),
  DOG:     npcV("npc dog",    "Dog",    5, "Animal NPC."),
  GIRL:    npcV("npc girl",   "Girl",   4),
  GUARD:   npcV("npc guard",  "Guard",  6, "Armed guard."),
  KNIGHT:  npcV("npc knight", "Knight", 6, "Full armour."),
  MAN_A:   npcV("npc man A",  "Man A",  4),
  MAN_B:   npcV("npc man B",  "Man B",  4),
  NUN:     npcV("npc nun",    "Nun",    4),
} as const;

// ─────────────────────────────────────────────────────────────────────────────
// LIVESTOCK — from the Animated Livestock pack + extracted folders
// ─────────────────────────────────────────────────────────────────────────────

export const LIVESTOCK = {
  // Chicken: 192×48, 48×48 frames, 4 cols × 1 row
  CHICKEN_AAA_V00: { path: "livestock/chicken/livestock_chicken_AAA_v00.png", category: "livestock", width: 192, height: 48, frameW: 48, frameH: 48, cols: 4, rows: 1, notes: "Chicken — body A, spot A, wattle A, palette v00." },
  CHICKEN_AAA_V01: { path: "livestock/chicken/livestock_chicken_AAA_v01.png", category: "livestock", width: 192, height: 48, frameW: 48, frameH: 48, cols: 4, rows: 1, notes: "Chicken AAA palette v01." },
  CHICKEN_AAA_V02: { path: "livestock/chicken/livestock_chicken_AAA_v02.png", category: "livestock", width: 192, height: 48, frameW: 48, frameH: 48, cols: 4, rows: 1, notes: "Chicken AAA palette v02." },
  CHICKEN_AAB_V00: { path: "livestock/chicken/livestock_chicken_AAB_v00.png", category: "livestock", width: 192, height: 48, frameW: 48, frameH: 48, cols: 4, rows: 1, notes: "Chicken — body A, spot A, wattle B." },
  CHICKEN_AAB_V01: { path: "livestock/chicken/livestock_chicken_AAB_v01.png", category: "livestock", width: 192, height: 48, frameW: 48, frameH: 48, cols: 4, rows: 1, notes: "Chicken AAB palette v01." },
  CHICKEN_ABA_V00: { path: "livestock/chicken/livestock_chicken_ABA_v00.png", category: "livestock", width: 192, height: 48, frameW: 48, frameH: 48, cols: 4, rows: 1, notes: "Chicken — body A, spot B, wattle A." },
  CHICKEN_ABB_V00: { path: "livestock/chicken/livestock_chicken_ABB_v00.png", category: "livestock", width: 192, height: 48, frameW: 48, frameH: 48, cols: 4, rows: 1, notes: "Chicken — body A, spot B, wattle B." },
  CHICKEN_BAA_V00: { path: "livestock/chicken/livestock_chicken_BAA_v00.png", category: "livestock", width: 192, height: 48, frameW: 48, frameH: 48, cols: 4, rows: 1, notes: "Chicken — body B, spot A, wattle A." },
  // Cattle: 384×96, 96×96 frames, 4 cols × 1 row
  COW_AA_V00: { path: "livestock/cattle/livestock_cattle_AA_v00.png", category: "livestock", width: 384, height: 96, frameW: 96, frameH: 96, cols: 4, rows: 1, notes: "Cow — body A, spot A, palette v00." },
  COW_AA_V01: { path: "livestock/cattle/livestock_cattle_AA_v01.png", category: "livestock", width: 384, height: 96, frameW: 96, frameH: 96, cols: 4, rows: 1, notes: "Cow AA palette v01." },
  COW_AB_V00: { path: "livestock/cattle/livestock_cattle_AB_v00.png", category: "livestock", width: 384, height: 96, frameW: 96, frameH: 96, cols: 4, rows: 1, notes: "Cow — body A, spot B." },
  COW_BA_V00: { path: "livestock/cattle/livestock_cattle_BA_v00.png", category: "livestock", width: 384, height: 96, frameW: 96, frameH: 96, cols: 4, rows: 1, notes: "Cow — body B, spot A." },
  COW_BB_V00: { path: "livestock/cattle/livestock_cattle_BB_v00.png", category: "livestock", width: 384, height: 96, frameW: 96, frameH: 96, cols: 4, rows: 1, notes: "Cow — body B, spot B." },
  // Pig: 256×64, 64×64 frames, 4 cols × 1 row
  PIG_A_V00: { path: "livestock/pig/livestock_pig_A_v00.png", category: "livestock", width: 256, height: 64, frameW: 64, frameH: 64, cols: 4, rows: 1, notes: "Pig — body A, palette v00." },
  PIG_A_V01: { path: "livestock/pig/livestock_pig_A_v01.png", category: "livestock", width: 256, height: 64, frameW: 64, frameH: 64, cols: 4, rows: 1, notes: "Pig body A palette v01." },
  PIG_B_V00: { path: "livestock/pig/livestock_pig_B_v00.png", category: "livestock", width: 256, height: 64, frameW: 64, frameH: 64, cols: 4, rows: 1, notes: "Pig — body B." },
  // Duck: 192×48, 48×48 frames, 4 cols × 1 row
  DUCK_A_V00: { path: "livestock/duck/livestock_duck_A_v00.png", category: "livestock", width: 192, height: 48, frameW: 48, frameH: 48, cols: 4, rows: 1, notes: "Duck — body A, palette v00." },
  DUCK_A_V01: { path: "livestock/duck/livestock_duck_A_v01.png", category: "livestock", width: 192, height: 48, frameW: 48, frameH: 48, cols: 4, rows: 1, notes: "Duck body A palette v01." },
  DUCK_B_V00: { path: "livestock/duck/livestock_duck_B_v00.png", category: "livestock", width: 192, height: 48, frameW: 48, frameH: 48, cols: 4, rows: 1, notes: "Duck — body B." },
  // Chick: 128×32, 32×32 frames, 4 cols × 1 row
  CHICK_A_V00: { path: "livestock/chick/livestock_chick_A_v00.png", category: "livestock", width: 128, height: 32, frameW: 32, frameH: 32, cols: 4, rows: 1, notes: "Baby chick — body A." },
  CHICK_B_V00: { path: "livestock/chick/livestock_chick_B_v00.png", category: "livestock", width: 128, height: 32, frameW: 32, frameH: 32, cols: 4, rows: 1, notes: "Baby chick — body B." },
} as const satisfies Record<string, SpriteSheet>;

// ─────────────────────────────────────────────────────────────────────────────
// FONTS
// ─────────────────────────────────────────────────────────────────────────────

export const FONTS = {
  BODY:       { path: "fonts/Mana Seed Body Font.png",       category: "font", width: 128, height: 48, frameW: 8, frameH: 8, cols: 16, rows: 6, notes: "Body text font. 8×8 monospace bitmap." },
  CHAT_BUBBLE:{ path: "fonts/Mana Seed chat bubble.png",     category: "font", width: 64,  height: 32, frameW: 8, frameH: 8, cols: 8,  rows: 4, notes: "Chat bubble UI element." },
  FLAVOR:     { path: "fonts/Mana Seed Flavor Font.png",     category: "font", width: 128, height: 48, frameW: 8, frameH: 8, cols: 16, rows: 6, notes: "Flavor/italic text font. 8×8." },
} as const satisfies Record<string, SpriteSheet>;

// ─────────────────────────────────────────────────────────────────────────────
// FLAT CATALOG — every non-reference sheet, for preloading
// ─────────────────────────────────────────────────────────────────────────────

export const ALL_SHEETS: SpriteSheet[] = [
  ...Object.values(TILESETS),
  ...Object.values(EFFECTS),
  ...Object.values(WEATHER),
  ...Object.values(BUILDINGS),
  ...Object.values(PROPS),
  ...Object.values(CROP_SHEETS),
  ...Object.values(CROPS),
  ...Object.values(TREES),
  ...Object.values(ANIMALS),
  ...Object.values(FARMER_BASE),
  ...Object.values(FARMER_EFFECTS),
  ...Object.values(FONTS),
  ...Object.values(LIVESTOCK),
  // NPC pack 1 + 2 (nested by character type)
  ...Object.values(NPCS).flatMap(v => Object.values(v) as SpriteSheet[]),
  ...Object.values(NPCS2).flatMap(v => Object.values(v) as SpriteSheet[]),
];
