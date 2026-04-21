import { pgTable, uuid, varchar, boolean, timestamp, integer, real, jsonb, primaryKey, customType, text, uniqueIndex } from "drizzle-orm/pg-core";
import { sql } from "drizzle-orm";

export const accounts = pgTable("accounts", {
  id: uuid("id").primaryKey().defaultRandom(),
  oauthSub: varchar("oauth_sub", { length: 255 }).notNull().unique(),
  oauthIssuer: varchar("oauth_issuer", { length: 255 }).notNull(),
  email: varchar("email", { length: 255 }).notNull(),
  displayName: varchar("display_name", { length: 100 }).notNull(),
  isOnboarded: boolean("is_onboarded").default(false).notNull(),
  preferences: jsonb("preferences").default({}).notNull(),
  createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
});

export const characters = pgTable("characters", {
  id: uuid("id").primaryKey().defaultRandom(),
  accountId: uuid("account_id").notNull().references(() => accounts.id),
  name: varchar("name", { length: 20 }).notNull().unique(),
  race: varchar("race", { length: 20 }).notNull(),
  gender: varchar("gender", { length: 10 }).notNull(),
  bodyType: varchar("body_type", { length: 20 }).notNull().default("default"),
  hairStyle: integer("hair_style").default(0).notNull(),
  hairColor: integer("hair_color").default(0).notNull(),
  skinTone: integer("skin_tone").default(0).notNull(),
  outfit: integer("outfit").default(0).notNull(),
  str: integer("str").notNull(),
  dex: integer("dex").notNull(),
  intStat: integer("int_stat").notNull(),
  skills: jsonb("skills").notNull().default([]),
  hp: integer("hp").default(50).notNull(),
  mana: integer("mana").default(50).notNull(),
  stamina: integer("stamina").default(50).notNull(),
  posX: real("pos_x").default(0).notNull(),
  posY: real("pos_y").default(0).notNull(),
  posZ: real("pos_z").default(0).notNull(),
  mapId: integer("map_id").default(500).notNull(),  // 500 = HEAVEN_NUMERIC_ID
  level: integer("level").default(1).notNull(),
  xp: integer("xp").default(0).notNull(),
  /** Dev-account role. `main` = index.html player, `game-master` = builder.html
   *  player. Null for normal player-created characters. Used by the client to
   *  pick which character to load for each entry point. */
  role: varchar("role", { length: 20 }),
  createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
  lastPlayed: timestamp("last_played", { withTimezone: true }),
});

export const worldMaps = pgTable("world_maps", {
  id: integer("id").primaryKey().generatedAlwaysAsIdentity(),
  name: varchar("name", { length: 100 }).notNull().unique(),
  widthChunks: integer("width_chunks").notNull(),
  heightChunks: integer("height_chunks").notNull(),
  zLevels: integer("z_levels").default(1).notNull(),
});

export const chunkData = pgTable("chunk_data", {
  mapId: integer("map_id").notNull(),
  chunkX: integer("chunk_x").notNull(),
  chunkY: integer("chunk_y").notNull(),
  chunkZ: integer("chunk_z").notNull().default(0),
  tileData: jsonb("tile_data").notNull(), // tile IDs as array
  heightData: jsonb("height_data"),
  staticEntities: jsonb("static_entities"),
}, (table) => [
  primaryKey({ columns: [table.mapId, table.chunkX, table.chunkY, table.chunkZ] }),
]);

// World items — items sitting on the ground in a zone
export const worldItems = pgTable("world_items", {
  id: uuid("id").primaryKey().defaultRandom(),
  zoneId: varchar("zone_id", { length: 50 }).notNull(),
  tileX: integer("tile_x").notNull(),
  tileZ: integer("tile_z").notNull(),
  itemId: varchar("item_id", { length: 50 }).notNull(),
  quantity: integer("quantity").default(1).notNull(),
  source: varchar("source", { length: 10 }).notNull().default("drop"), // "map" | "drop"
  createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
  expiresAt: timestamp("expires_at", { withTimezone: true }), // null = permanent
});

// Placed objects — world builder pieces placed or overridden per zone
export const placedObjects = pgTable("placed_objects", {
  id: uuid("id").primaryKey().defaultRandom(),
  zoneId: varchar("zone_id", { length: 50 }).notNull(),
  tileX: integer("tile_x").notNull(),
  tileZ: integer("tile_z").notNull(),
  pieceType: varchar("piece_type", { length: 30 }).notNull(),
  material: varchar("material", { length: 20 }).notNull().default("stone"),
  elevation: integer("elevation").default(0).notNull(),
  flip: boolean("flip").default(false).notNull(),
  flipL: boolean("flip_l").default(false).notNull(),
  flipR: boolean("flip_r").default(false).notNull(),
  /** "placed" = new object added by player; "tiled_tombstone" = tiled object deleted by player */
  source: varchar("source", { length: 20 }).notNull().default("placed"),
  placedBy: uuid("placed_by"),
  createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
});

// World-builder maps — user-authored maps created via the builder client.
// numericId >= 1000, used in characters.map_id like any other zone.
// `zoneId` is the string handle ("user:<uuid>") used by the zone registry.
export const userMaps = pgTable("user_maps", {
  id: uuid("id").primaryKey().defaultRandom(),
  numericId: integer("numeric_id").notNull().unique(),
  zoneId: varchar("zone_id", { length: 64 }).notNull().unique(),
  name: varchar("name", { length: 100 }).notNull(),
  width: integer("width").notNull(),
  height: integer("height").notNull(),
  createdBy: uuid("created_by").references(() => accounts.id),
  createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).defaultNow().notNull(),
});

// Per-cell collision markers ("blocks"). Decoupled from visual tile
// placements so a 5×7 tree sprite can have a 1-cell-wide trunk footprint,
// a platform can be walk-through, a door cell can toggle, etc.
// One block per cell enforced by the unique index.
export const userMapBlocks = pgTable("user_map_blocks", {
  id: uuid("id").primaryKey().defaultRandom(),
  mapId: uuid("map_id").notNull().references(() => userMaps.id, { onDelete: "cascade" }),
  x: integer("x").notNull(),
  y: integer("y").notNull(),
  placedBy: uuid("placed_by").references(() => accounts.id),
  createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
}, (t) => ({
  mapPos: uniqueIndex("user_map_blocks_pos_uniq").on(t.mapId, t.x, t.y),
}));

// Individual tile placements on a user_map. (layer, x, y) is unique per map so
// placing a tile on an already-placed cell overwrites via upsert.
export const userMapTiles = pgTable("user_map_tiles", {
  id: uuid("id").primaryKey().defaultRandom(),
  mapId: uuid("map_id").notNull().references(() => userMaps.id, { onDelete: "cascade" }),
  layer: varchar("layer", { length: 32 }).notNull(),
  x: integer("x").notNull(),
  y: integer("y").notNull(),
  /** TSX filename (relative to /maps/), e.g. "summer forest.tsx" */
  tileset: varchar("tileset", { length: 128 }).notNull(),
  /** Local tile id inside the TSX. */
  tileId: integer("tile_id").notNull(),
  /** 0, 90, 180, 270. We encode as Tiled flip flags at freeze time. */
  rotation: integer("rotation").default(0).notNull(),
  flipH: boolean("flip_h").default(false).notNull(),
  flipV: boolean("flip_v").default(false).notNull(),
  placedBy: uuid("placed_by").references(() => accounts.id),
  createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
}, (t) => ({
  mapLayerPos: uniqueIndex("user_map_tiles_layerpos_uniq").on(t.mapId, t.layer, t.x, t.y),
}));

// Character inventory — items owned by a character
export const characterInventory = pgTable("character_inventory", {
  id: uuid("id").primaryKey().defaultRandom(),
  characterId: uuid("character_id").notNull().references(() => characters.id),
  itemId: varchar("item_id", { length: 50 }).notNull(),
  quantity: integer("quantity").default(1).notNull(),
  equipped: boolean("equipped").default(false).notNull(),
  slot: varchar("slot", { length: 20 }),
  createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
});

// ---------------------------------------------------------------------------
// Builder registry (Phase 1 DB migration — see AGENTS.md "Data in the DB")
// ---------------------------------------------------------------------------
// Tables below replace the client-side `registry/*.ts` + `empty-tiles.json`
// + localStorage overrides. Client fetches on boot; two builders editing
// metadata see each other's edits live over WebRTC.
//
// Natural PKs (slugs for categories/layers, filename for tilesets) mirror
// the wire format already used in `user_map_tiles.tileset` / `.layer`, so
// FKs between placed tiles and their definitions stay trivially joinable.
// ---------------------------------------------------------------------------

// Tile category taxonomy — replaces client/src/builder/registry/categories.ts
export const tileCategories = pgTable("tile_categories", {
  id: varchar("id", { length: 32 }).primaryKey(),           // slug — "terrain", "trees", …
  name: varchar("name", { length: 64 }).notNull(),          // display name
  description: text("description").notNull().default(""),
  displayOrder: integer("display_order").notNull(),         // sidebar order
  previewTileset: varchar("preview_tileset", { length: 256 }),
  previewTileId: integer("preview_tile_id"),
  related: jsonb("related").$type<string[]>().default([]).notNull(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).defaultNow().notNull(),
});

// Render layers — replaces client/src/builder/registry/layers.ts.
// IDs are wire-format (already stored in user_map_tiles.layer).
export const mapLayers = pgTable("map_layers", {
  id: varchar("id", { length: 32 }).primaryKey(),           // "ground" | "decor" | "walls" | "canopy"
  name: varchar("name", { length: 64 }).notNull(),
  description: text("description").notNull().default(""),
  z: integer("z").notNull(),                                // render order (Excalibur Actor.z)
  collides: boolean("collides").notNull(),
  aboveCharacter: boolean("above_character").notNull(),
  displayOrder: integer("display_order").notNull(),         // toolbar order
  updatedAt: timestamp("updated_at", { withTimezone: true }).defaultNow().notNull(),
});

// Tileset registry — replaces client/src/builder/registry/tilesets.ts.
// Structural columns (tilewidth, columns, image_url, etc.) are ingested
// from TSX files at boot; metadata columns (category/tags/defaultLayer)
// are builder-authored and live here.
export const tilesets = pgTable("tilesets", {
  file: varchar("file", { length: 256 }).primaryKey(),      // "summer forest.tsx" — matches user_map_tiles.tileset
  slug: varchar("slug", { length: 64 }).notNull().unique(), // stable id like "summer-forest-wang"
  name: varchar("name", { length: 128 }).notNull(),         // display name from <tileset name="">

  // Structural (ingested from TSX; do not hand-edit):
  tilewidth: integer("tilewidth").notNull(),
  tileheight: integer("tileheight").notNull(),
  columns: integer("columns").notNull(),
  tilecount: integer("tilecount").notNull(),
  imageUrl: varchar("image_url", { length: 512 }).notNull(),
  imageWidth: integer("image_width").notNull(),
  imageHeight: integer("image_height").notNull(),

  // Builder-authored metadata (default for every tile in the sheet, unless
  // overridden by a sub-region or per-tile override):
  defaultCategoryId: varchar("default_category_id", { length: 32 })
    .notNull()
    .references(() => tileCategories.id),
  defaultLayerId: varchar("default_layer_id", { length: 32 })
    .references(() => mapLayers.id),
  defaultBlocks: boolean("default_blocks").default(false).notNull(),
  tags: jsonb("tags").$type<string[]>().default([]).notNull(),
  seasonal: varchar("seasonal", { length: 16 }),            // "summer" | "autumn" | "spring" | "winter"
  hidden: boolean("hidden").default(false).notNull(),        // loaded for rendering but hidden from picker
  autoHideLabels: boolean("auto_hide_labels").default(false).notNull(),
  notes: text("notes"),
  updatedAt: timestamp("updated_at", { withTimezone: true }).defaultNow().notNull(),
});

// Sub-regions — contiguous tile-id ranges inside a tileset that override
// the tileset's defaults. NULL means "inherit from tileset default".
// Later regions (higher display_order) win when ranges overlap.
export const tilesetSubRegions = pgTable("tileset_sub_regions", {
  id: uuid("id").primaryKey().defaultRandom(),
  tilesetFile: varchar("tileset_file", { length: 256 })
    .notNull()
    .references(() => tilesets.file, { onDelete: "cascade" }),
  fromTileId: integer("from_tile_id").notNull(),            // inclusive
  toTileId: integer("to_tile_id").notNull(),                // inclusive
  categoryId: varchar("category_id", { length: 32 })
    .references(() => tileCategories.id),
  layerId: varchar("layer_id", { length: 32 })
    .references(() => mapLayers.id),
  blocks: boolean("blocks"),                                 // NULL = inherit
  tags: jsonb("tags").$type<string[]>(),                    // NULL = inherit tileset tags
  label: varchar("label", { length: 128 }),
  hide: boolean("hide"),                                     // NULL = inherit (default false)
  displayOrder: integer("display_order").default(0).notNull(),
  notes: text("notes"),
  updatedAt: timestamp("updated_at", { withTimezone: true }).defaultNow().notNull(),
});

// Per-tile metadata overrides — replaces client-side localStorage overrides.
// When present, fields with non-NULL values beat sub-region defaults beat
// tileset defaults. Precedence: TilesetDef → SubRegion → Override (last wins).
export const tileOverrides = pgTable("tile_overrides", {
  tilesetFile: varchar("tileset_file", { length: 256 })
    .notNull()
    .references(() => tilesets.file, { onDelete: "cascade" }),
  tileId: integer("tile_id").notNull(),
  categoryId: varchar("category_id", { length: 32 })
    .references(() => tileCategories.id),
  layerId: varchar("layer_id", { length: 32 })
    .references(() => mapLayers.id),
  blocks: boolean("blocks"),
  tags: jsonb("tags").$type<string[]>(),
  name: varchar("name", { length: 128 }),
  hide: boolean("hide"),
  updatedBy: uuid("updated_by").references(() => accounts.id),
  updatedAt: timestamp("updated_at", { withTimezone: true }).defaultNow().notNull(),
}, (t) => [
  primaryKey({ columns: [t.tilesetFile, t.tileId] }),
]);

// Fully-transparent tile cells — replaces registry/empty-tiles.json.
// Auto-populated by the ingest pass (scans PNG alpha channel).
// Tiles flagged here are deleted from the picker entirely (no TileEntry
// allocation, can't be revealed via overrides).
export const tileEmptyFlags = pgTable("tile_empty_flags", {
  tilesetFile: varchar("tileset_file", { length: 256 })
    .notNull()
    .references(() => tilesets.file, { onDelete: "cascade" }),
  tileId: integer("tile_id").notNull(),
}, (t) => [
  primaryKey({ columns: [t.tilesetFile, t.tileId] }),
]);

// Tile animations ingested from TSX <tile id="N"><animation><frame .../>.
// One row per (tileset, head tile, frame). head_tile_id is the animation
// "owner" in Tiled parlance; frame_tile_id points at each frame's source cell.
export const tileAnimations = pgTable("tile_animations", {
  id: uuid("id").primaryKey().defaultRandom(),
  tilesetFile: varchar("tileset_file", { length: 256 })
    .notNull()
    .references(() => tilesets.file, { onDelete: "cascade" }),
  headTileId: integer("head_tile_id").notNull(),
  frameIdx: integer("frame_idx").notNull(),                 // 0-based
  frameTileId: integer("frame_tile_id").notNull(),
  durationMs: integer("duration_ms").notNull(),
}, (t) => [
  uniqueIndex("tile_animations_uniq").on(t.tilesetFile, t.headTileId, t.frameIdx),
]);

// ---------------------------------------------------------------------------
// NPC templates (Phase 2 DB migration — see AGENTS.md "Data in the DB")
// ---------------------------------------------------------------------------
// Replaces the hand-maintained NPC_TEMPLATES record in
// `packages/server/src/game/npc-templates.ts`. Stat blocks live as flat
// rows keyed by stable template id (e.g. "skeleton-warrior"). Group-level
// bases (skeleton/imp/rabbit/goblin) and category-level defaults
// (wildlife/monster/interactive) are resolved into each row at seed time
// — no inheritance chain in SQL. When a designer tweaks a group-wide
// colour or behaviour, the seed script re-materialises affected rows.
// ---------------------------------------------------------------------------

// ---------------------------------------------------------------------------
// Items + loot (Phase 2b)
// ---------------------------------------------------------------------------
// Replaces `ITEMS` + `LOOT_TABLES` in `packages/server/src/game/items.ts`.
// `item_templates` is the catalogue (weapons, armour, consumables, materials);
// `loot_entries` is the NPC → item drop table with chance + quantity ranges.

export const itemTemplates = pgTable("item_templates", {
  id: varchar("id", { length: 64 }).primaryKey(),            // "rusty-sword"
  name: varchar("name", { length: 100 }).notNull(),
  itemType: varchar("item_type", { length: 16 }).notNull(),  // "weapon"|"armor"|"consumable"|"material"
  slot: varchar("slot", { length: 16 }),                     // "weapon"|"head"|... null for non-equipment
  weaponSubtype: varchar("weapon_subtype", { length: 16 }),  // "sword"|"axe"|"bow"|"staff"|"dagger"
  armorWeight: varchar("armor_weight", { length: 16 }),      // "light"|"medium"|"heavy"
  icon: varchar("icon", { length: 8 }).notNull(),            // emoji placeholder until sprites land
  description: text("description").notNull().default(""),
  level: integer("level").notNull().default(1),              // minimum level to equip
  bonusStr:    integer("bonus_str").notNull().default(0),
  bonusDex:    integer("bonus_dex").notNull().default(0),
  bonusInt:    integer("bonus_int").notNull().default(0),
  bonusHp:     integer("bonus_hp").notNull().default(0),
  bonusDamage: integer("bonus_damage").notNull().default(0),
  bonusArmor:  integer("bonus_armor").notNull().default(0),
  healAmount:  integer("heal_amount").notNull().default(0),   // consumables
  stackLimit:  integer("stack_limit").notNull().default(1),
  value:       integer("value").notNull().default(0),         // gold
  updatedAt: timestamp("updated_at", { withTimezone: true }).defaultNow().notNull(),
});

// One row per (NPC template, item) drop. FK to npc_templates + item_templates
// with ON DELETE CASCADE so renaming / removing a template cleans up loot.
export const lootEntries = pgTable("loot_entries", {
  id: uuid("id").primaryKey().defaultRandom(),
  npcTemplateId: varchar("npc_template_id", { length: 64 })
    .notNull().references(() => npcTemplates.id, { onDelete: "cascade" }),
  itemId: varchar("item_id", { length: 64 })
    .notNull().references(() => itemTemplates.id, { onDelete: "cascade" }),
  chance: real("chance").notNull(),                           // 0.0 – 1.0
  minQty: integer("min_qty").notNull().default(1),
  maxQty: integer("max_qty").notNull().default(1),
}, (t) => [
  uniqueIndex("loot_entries_npc_item_uniq").on(t.npcTemplateId, t.itemId),
]);

// ---------------------------------------------------------------------------
// Quests (Phase 2b)
// ---------------------------------------------------------------------------
// Replaces `QUESTS` in `packages/server/src/game/quests.ts`. Quest template +
// its objectives + its item rewards are split across three tables so
// designers can tweak individual objective counts / reward qtys without
// re-encoding the whole quest.

export const quests = pgTable("quests", {
  id: varchar("id", { length: 64 }).primaryKey(),             // "kill-rabbits"
  name: varchar("name", { length: 100 }).notNull(),
  description: text("description").notNull(),
  zone: varchar("zone", { length: 64 }).notNull(),            // zone id where the quest is available
  levelMin: integer("level_min").notNull().default(1),
  rewardXp: integer("reward_xp").notNull().default(0),
  updatedAt: timestamp("updated_at", { withTimezone: true }).defaultNow().notNull(),
});

// Each quest can have multiple ordered objectives. Today all are
// `{ type: "kill", targetGroup, count }` but the type column gives us room
// to grow (collect, talk-to, escort, …).
export const questObjectives = pgTable("quest_objectives", {
  id: uuid("id").primaryKey().defaultRandom(),
  questId: varchar("quest_id", { length: 64 })
    .notNull().references(() => quests.id, { onDelete: "cascade" }),
  objectiveOrder: integer("objective_order").notNull().default(0),
  objectiveType:  varchar("objective_type", { length: 16 }).notNull().default("kill"),
  targetGroup:    varchar("target_group", { length: 64 }).notNull(),
  count:          integer("count").notNull(),
}, (t) => [
  uniqueIndex("quest_objectives_order_uniq").on(t.questId, t.objectiveOrder),
]);

// Quest rewards — items granted on turn-in (XP lives on the quest row itself).
export const questRewards = pgTable("quest_rewards", {
  id: uuid("id").primaryKey().defaultRandom(),
  questId: varchar("quest_id", { length: 64 })
    .notNull().references(() => quests.id, { onDelete: "cascade" }),
  itemId:  varchar("item_id", { length: 64 })
    .notNull().references(() => itemTemplates.id),
  quantity: integer("quantity").notNull().default(1),
}, (t) => [
  uniqueIndex("quest_rewards_item_uniq").on(t.questId, t.itemId),
]);

// ---------------------------------------------------------------------------
// Map-item types (stub — full behaviour for container/light/door/sign/etc
// is designed as those features land). Replaces
// `packages/client/src/builder/registry/map-items.ts` MAP_ITEM_TYPES array.
// ---------------------------------------------------------------------------

export const mapItemTypes = pgTable("map_item_types", {
  kind:         varchar("kind", { length: 32 }).primaryKey(),   // "container" | "light" | "door" | "sign" | "npc-spawn" | "teleporter" | "crop-plot"
  name:         varchar("name", { length: 64 }).notNull(),
  description:  text("description").notNull().default(""),
  blocks:       boolean("blocks").notNull().default(true),
  previewTileset: varchar("preview_tileset", { length: 256 }),
  previewTileId:  integer("preview_tile_id"),
  /** True once the full behaviour (runtime state + interact protocol) is
   *  implemented end-to-end. Today everything is false. */
  implemented:  boolean("implemented").notNull().default(false),
  displayOrder: integer("display_order").notNull().default(0),
  updatedAt:    timestamp("updated_at", { withTimezone: true }).defaultNow().notNull(),
});

// ---------------------------------------------------------------------------
// Zones — no longer a table.
// ---------------------------------------------------------------------------
// The old `zones` table (static/shipped zones like human-meadows + the 9 test
// zones) has been removed. The only map that exists is `heaven`, which lives
// in `user_maps` (HEAVEN_NUMERIC_ID = 500). All zone lookups now go through
// user-maps.ts. If/when static shipped zones return, this table comes back.

// ---------------------------------------------------------------------------
// NPC templates (Phase 2a — table definition must stay BELOW this comment
// because loot_entries + quest_rewards FK into it.)
// ---------------------------------------------------------------------------

export const npcTemplates = pgTable("npc_templates", {
  id: varchar("id", { length: 64 }).primaryKey(),            // "skeleton-warrior"
  name: varchar("name", { length: 100 }).notNull(),          // "Skeleton Warrior"
  groupId: varchar("group_id", { length: 64 }).notNull(),    // "skeleton" | "goblin" | …
  category: varchar("category", { length: 32 }).notNull(),   // "wildlife" | "monster" | "interactive"

  // Appearance
  bodyColor: varchar("body_color", { length: 16 }).notNull(),
  skinColor: varchar("skin_color", { length: 16 }).notNull(),

  // Combat
  weaponType: varchar("weapon_type", { length: 16 }).notNull(), // "melee" | "ranged" | "magic" | "none"
  weaponDamageMin: integer("weapon_damage_min").notNull(),
  weaponDamageMax: integer("weapon_damage_max").notNull(),
  attackSpeedMin: real("attack_speed_min").notNull(),
  attackSpeedMax: real("attack_speed_max").notNull(),
  hpMin: integer("hp_min").notNull(),
  hpMax: integer("hp_max").notNull(),

  // Base stats
  strMin: integer("str_min").notNull(),
  strMax: integer("str_max").notNull(),
  dexMin: integer("dex_min").notNull(),
  dexMax: integer("dex_max").notNull(),
  intMin: integer("int_min").notNull(),
  intMax: integer("int_max").notNull(),

  // Behaviour
  aggressive: boolean("aggressive").notNull(),
  flees: boolean("flees").notNull(),
  wanders: boolean("wanders").notNull(),
  canTalk: boolean("can_talk").notNull(),

  // Movement
  speedModifier: real("speed_modifier").notNull(),
  wanderChance: real("wander_chance").notNull(),
  wanderSteps: integer("wander_steps").notNull(),

  notes: text("notes"),
  updatedAt: timestamp("updated_at", { withTimezone: true }).defaultNow().notNull(),
});
