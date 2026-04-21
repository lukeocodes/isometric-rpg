/**
 * User-built maps (world builder).
 *
 * In-memory cache of user-authored maps + their tile placements. Backed by the
 * `user_maps` + `user_map_tiles` Postgres tables.
 *
 * Each user map registers as a zone via the zone registry so normal movement,
 * entity tracking, and zone-change opcodes all work transparently.
 */
import { eq, sql } from "drizzle-orm";
import { db } from "../db/postgres.js";
import { userMaps, userMapTiles, userMapBlocks } from "../db/schema.js";
import { registerZone, type ZoneDefinition } from "./zone-registry.js";

/** Heaven — the GM's permanent hub. 32×32 grass canvas, frozen to disk at
 *  `packages/client/public/maps/heaven.tmx`. Its numericId is a hardcoded
 *  constant so GMs always spawn here post-launch to test things. The DB
 *  copy stays so the builder can edit it and re-freeze. */
export const HEAVEN_NUMERIC_ID = 500;
export const HEAVEN_ZONE_ID    = "heaven";

/** Races that get a seeded starter map on a fresh install. Add an entry
 *  here when you introduce a new playable race and you want
 *  `ensureStarterRowForRace()` to paint them a first-spawn area. */
const SEEDED_STARTER_RACES: readonly string[] = ["human"];

/** Tileset + local tile id used for the auto-seeded grass floor. Matches
 *  heaven.tmx (GID 130 with firstgid=1 → local id 129). */
const GRASS_TILESET    = "summer-forest-wang-tiles.tsx";
const GRASS_TILE_LOCAL = 129;

/** Lowest numericId allocated to user-authored maps. */
const USER_MAP_NUMERIC_BASE = 1000;

export interface UserTile {
  layer:    string;   // "ground" | "walls" | "decor" | "canopy"
  x:        number;
  y:        number;
  tileset:  string;   // TSX filename, e.g. "summer forest.tsx"
  tileId:   number;
  rotation: number;   // 0 | 90 | 180 | 270
  flipH:    boolean;
  flipV:    boolean;
}

/** A collision "block" — a 1-cell no-walk marker. Invisible in play mode,
 *  rendered as a blue outline in builder mode. Decoupled from tile
 *  placements so the author can describe per-cell collision independently
 *  of tile sprite footprints. */
export interface UserBlock {
  x: number;
  y: number;
}

export interface UserMap {
  id:          string;        // uuid
  numericId:   number;
  zoneId:      string;        // "heaven" | "starter-human" | "user:<uuid>" | ...
  name:        string;
  /** Map taxonomy — `heaven` (constant hub), `starter` (per-race first-spawn
   *  area), `adventure` (anything else). Non-null; defaults to `adventure`
   *  on arbitrary user-created maps. */
  type:        string;
  /** Associated race for starter maps. `null` for heaven + adventure maps
   *  that aren't race-gated. */
  race:        string | null;
  width:       number;
  height:      number;
  /** keyed by `${layer}:${x},${y}` */
  tiles:       Map<string, UserTile>;
  /** keyed by `${x},${y}` */
  blocks:      Map<string, UserBlock>;
  createdBy:   string | null;
}

// -----------------------------------------------------------------------------
// In-memory cache
// -----------------------------------------------------------------------------

const byId        = new Map<string, UserMap>();
const byZoneId    = new Map<string, UserMap>();
const byNumericId = new Map<number, UserMap>();
/** Index of maps keyed by `${type}:${race ?? ""}` — lets callers find the
 *  human starter, elf starter, etc. without knowing numeric ids. */
const byTypeRace  = new Map<string, UserMap>();

function typeRaceKey(type: string, race: string | null): string {
  return `${type}:${race ?? ""}`;
}

function tileKey(t: { layer: string; x: number; y: number }): string {
  return `${t.layer}:${t.x},${t.y}`;
}

function blockKey(b: { x: number; y: number }): string {
  return `${b.x},${b.y}`;
}

/** Register the map as a zone so the rest of the engine treats it normally.
 *
 *  `mapFile` is just `<zoneId>.tmx` — the client first tries a static
 *  file at `/maps/<mapFile>` (a frozen TMX) and falls back to
 *  `/api/maps/<mapFile>` which synthesizes a TMX from DB tiles on demand.
 *  Heaven is already frozen to disk; starter is not (yet). Both serve the
 *  same URL contract. */
function registerAsZone(m: UserMap): void {
  const def: ZoneDefinition = {
    id:         m.zoneId,
    numericId:  m.numericId,
    name:       m.name,
    mapFile:    `${m.zoneId}.tmx`,
    levelRange: [1, 99],
    musicTag:   "peaceful",
    exits:      {},
  };
  registerZone(def);
}

/** Paint a full `width × height` grass floor into `user_map_tiles` for the
 *  given map. Idempotent: if the map already has any tiles on the `ground`
 *  layer we assume the floor was painted already and skip. */
async function seedGrassFloor(mapRowId: string, width: number, height: number): Promise<void> {
  const [{ count: existing }] = await db
    .select({ count: sql<number>`count(*)::int` })
    .from(userMapTiles)
    .where(sql`${userMapTiles.mapId} = ${mapRowId} AND ${userMapTiles.layer} = 'ground'`);
  if (existing > 0) return;

  const rows: Array<{
    mapId: string; layer: string; x: number; y: number;
    tileset: string; tileId: number; rotation: number;
    flipH: boolean; flipV: boolean; placedBy: string | null;
  }> = [];
  for (let y = 0; y < height; y++) {
    for (let x = 0; x < width; x++) {
      rows.push({
        mapId:    mapRowId,
        layer:    "ground",
        x, y,
        tileset:  GRASS_TILESET,
        tileId:   GRASS_TILE_LOCAL,
        rotation: 0,
        flipH:    false,
        flipV:    false,
        placedBy: null,
      });
    }
  }
  // Postgres limit ~65k params per statement; 4096 × 10 cols is well under.
  await db.insert(userMapTiles).values(rows);
  console.log(`[UserMaps] Painted ${rows.length} grass tile(s) into map row ${mapRowId}`);
}

/** Ensure the heaven row exists in the database. Heaven is the only map
 *  with a hardcoded numericId (HEAVEN_NUMERIC_ID) because GMs always spawn
 *  here post-launch to test things — it's a constant entry point. The
 *  on-disk `heaven.tmx` is the frozen render; the DB row is kept so the
 *  builder can edit it and re-freeze. */
async function ensureHeavenRow(): Promise<void> {
  let [row] = await db
    .select()
    .from(userMaps)
    .where(eq(userMaps.zoneId, HEAVEN_ZONE_ID));
  if (!row) {
    [row] = await db.insert(userMaps).values({
      numericId: HEAVEN_NUMERIC_ID,
      zoneId:    HEAVEN_ZONE_ID,
      name:      "Heaven",
      type:      "heaven",
      race:      null,
      width:     32,
      height:    32,
      createdBy: null,
    }).returning();
    console.log(`[UserMaps] Seeded heaven row (numericId=${HEAVEN_NUMERIC_ID})`);
  } else if (row.type !== "heaven") {
    // Legacy heaven rows seeded before the type column existed get a patch.
    await db.update(userMaps)
      .set({ type: "heaven", race: null })
      .where(eq(userMaps.id, row.id));
    row.type = "heaven";
    row.race = null;
  }
  await seedGrassFloor(row.id, row.width, row.height);
}

/** Ensure a seeded starter map exists for the given race — a 64×64 empty
 *  grass canvas, DB-only (no frozen TMX on disk). Located by the
 *  `(type='starter', race=...)` pair, so multiple races can each have
 *  their own starter area with a DB-assigned numericId. */
async function ensureStarterRowForRace(race: string): Promise<void> {
  let [row] = await db
    .select()
    .from(userMaps)
    .where(sql`${userMaps.type} = 'starter' AND ${userMaps.race} = ${race}`);
  if (!row) {
    const numericId = await nextNumericId();
    const zoneId    = `starter-${race}`;
    const raceName  = race.charAt(0).toUpperCase() + race.slice(1);
    [row] = await db.insert(userMaps).values({
      numericId,
      zoneId,
      name:      `${raceName} Starter`,
      type:      "starter",
      race,
      width:     64,
      height:    64,
      createdBy: null,
    }).returning();
    console.log(`[UserMaps] Seeded ${raceName} starter row (numericId=${numericId})`);
  }
  await seedGrassFloor(row.id, row.width, row.height);
}

/** A place on a map — `mapId` + tile-unit (x, z) picked from the map's
 *  actual dimensions in the DB, not hardcoded. */
export interface MapSpawn {
  mapId: number;
  posX:  number;
  posZ:  number;
}

/** The centre tile of a map, rounded down. */
function centreOf(m: UserMap): MapSpawn {
  return {
    mapId: m.numericId,
    posX:  Math.floor(m.width  / 2),
    posZ:  Math.floor(m.height / 2),
  };
}

/** Spawn at the centre of the starter map for a given race. `undefined` if
 *  that race's starter isn't seeded. */
export function getStarterSpawnForRace(race: string): MapSpawn | undefined {
  const m = byTypeRace.get(typeRaceKey("starter", race));
  return m ? centreOf(m) : undefined;
}

/** Spawn at the centre of the heaven map. `undefined` before boot. */
export function getHeavenSpawn(): MapSpawn | undefined {
  const m = byNumericId.get(HEAVEN_NUMERIC_ID);
  return m ? centreOf(m) : undefined;
}

/** Spawn at the centre of the lowest-numericId starter map. Default landing
 *  for characters that were added manually (e.g. via raw SQL) and don't
 *  have a valid saved position. At seed there's only the human starter. */
export function getFirstStarterSpawn(): MapSpawn | undefined {
  let best: UserMap | undefined;
  for (const m of byTypeRace.values()) {
    if (m.type !== "starter") continue;
    if (!best || m.numericId < best.numericId) best = m;
  }
  return best ? centreOf(best) : undefined;
}

/** Allocate the next numericId above all currently-registered user maps. */
async function nextNumericId(): Promise<number> {
  const row = await db
    .select({ maxId: sql<number>`coalesce(max(${userMaps.numericId}), ${USER_MAP_NUMERIC_BASE - 1})` })
    .from(userMaps);
  return Math.max(USER_MAP_NUMERIC_BASE, (row[0]?.maxId ?? 0) + 1);
}

// -----------------------------------------------------------------------------
// Loading / bootstrapping
// -----------------------------------------------------------------------------

/**
 * Load every user map from the database into memory and register each as a
 * zone. Before loading, seed the built-in maps (heaven + per-race starters)
 * so they're always present with a grass floor.
 *
 * Call once at server boot.
 */
export async function loadAllUserMaps(): Promise<void> {
  await ensureHeavenRow();
  for (const race of SEEDED_STARTER_RACES) {
    await ensureStarterRowForRace(race);
  }
  const rows = await db.select().from(userMaps);
  for (const row of rows) {
    const tileRows = await db
      .select()
      .from(userMapTiles)
      .where(eq(userMapTiles.mapId, row.id));
    const blockRows = await db
      .select()
      .from(userMapBlocks)
      .where(eq(userMapBlocks.mapId, row.id));

    const tiles = new Map<string, UserTile>();
    for (const t of tileRows) {
      tiles.set(tileKey(t), {
        layer:    t.layer,
        x:        t.x,
        y:        t.y,
        tileset:  t.tileset,
        tileId:   t.tileId,
        rotation: t.rotation,
        flipH:    t.flipH,
        flipV:    t.flipV,
      });
    }
    const blocks = new Map<string, UserBlock>();
    for (const b of blockRows) {
      blocks.set(blockKey(b), { x: b.x, y: b.y });
    }

    const m: UserMap = {
      id:        row.id,
      numericId: row.numericId,
      zoneId:    row.zoneId,
      name:      row.name,
      type:      row.type,
      race:      row.race,
      width:     row.width,
      height:    row.height,
      tiles,
      blocks,
      createdBy: row.createdBy,
    };
    byId.set(m.id, m);
    byZoneId.set(m.zoneId, m);
    byNumericId.set(m.numericId, m);
    byTypeRace.set(typeRaceKey(m.type, m.race), m);
    registerAsZone(m);
  }
  console.log(`[UserMaps] Loaded ${rows.length} user map(s)`);
}

// -----------------------------------------------------------------------------
// Queries
// -----------------------------------------------------------------------------

export function getUserMapByNumericId(numericId: number): UserMap | undefined {
  return byNumericId.get(numericId);
}

export function getUserMapByZoneId(zoneId: string): UserMap | undefined {
  return byZoneId.get(zoneId);
}

export function listUserMaps(): UserMap[] {
  return Array.from(byId.values()).sort((a, b) => a.numericId - b.numericId);
}

export function getTilesFor(map: UserMap): UserTile[] {
  return Array.from(map.tiles.values());
}

export function getBlocksFor(map: UserMap): UserBlock[] {
  return Array.from(map.blocks.values());
}

/** True if a zone numericId belongs to a user-editable map (heaven + user maps).
 *  Heaven is registered at boot via ensureHeavenRow so it's just another row. */
export function isBuilderZone(numericId: number): boolean {
  return byNumericId.has(numericId);
}

// -----------------------------------------------------------------------------
// Mutations
// -----------------------------------------------------------------------------

export interface CreateMapArgs {
  name:      string;
  width:     number;
  height:    number;
  createdBy: string | null;
}

export async function createUserMap(args: CreateMapArgs): Promise<UserMap> {
  const numericId = await nextNumericId();
  const zoneId    = `user:${cryptoId()}`;

  const [row] = await db
    .insert(userMaps)
    .values({
      numericId,
      zoneId,
      name:      args.name.slice(0, 100),
      // User-created maps default to the "adventure" taxonomy. Starter /
      // heaven rows get their type via the boot seed; user maps can be
      // reclassified later via an admin tool.
      type:      "adventure",
      race:      null,
      width:     Math.max(1, Math.min(256, Math.floor(args.width))),
      height:    Math.max(1, Math.min(256, Math.floor(args.height))),
      createdBy: args.createdBy,
    })
    .returning();

  const m: UserMap = {
    id:        row.id,
    numericId: row.numericId,
    zoneId:    row.zoneId,
    name:      row.name,
    type:      row.type,
    race:      row.race,
    width:     row.width,
    height:    row.height,
    tiles:     new Map(),
    blocks:    new Map(),
    createdBy: row.createdBy,
  };
  byId.set(m.id, m);
  byZoneId.set(m.zoneId, m);
  byNumericId.set(m.numericId, m);
  byTypeRace.set(typeRaceKey(m.type, m.race), m);
  registerAsZone(m);
  console.log(`[UserMaps] Created ${m.name} (${m.width}x${m.height}) zoneId=${m.zoneId} numericId=${m.numericId}`);
  return m;
}

/** Upsert a tile placement. Returns the new tile record. */
export async function placeTile(
  map: UserMap,
  t: UserTile,
  placedBy: string | null,
): Promise<UserTile> {
  // Clamp + sanitise.
  const clean: UserTile = {
    layer:    String(t.layer || "ground").slice(0, 32),
    x:        Math.floor(t.x),
    y:        Math.floor(t.y),
    tileset:  String(t.tileset || "").slice(0, 128),
    tileId:   Math.max(0, Math.floor(t.tileId)),
    rotation: ((Math.floor(t.rotation || 0) % 360) + 360) % 360,
    flipH:    !!t.flipH,
    flipV:    !!t.flipV,
  };
  if (!clean.tileset) throw new Error("tileset required");
  if (clean.x < 0 || clean.x >= map.width) throw new Error("x out of bounds");
  if (clean.y < 0 || clean.y >= map.height) throw new Error("y out of bounds");

  await db
    .insert(userMapTiles)
    .values({ mapId: map.id, ...clean, placedBy })
    .onConflictDoUpdate({
      target: [userMapTiles.mapId, userMapTiles.layer, userMapTiles.x, userMapTiles.y],
      set: {
        tileset:  clean.tileset,
        tileId:   clean.tileId,
        rotation: clean.rotation,
        flipH:    clean.flipH,
        flipV:    clean.flipV,
        placedBy,
      },
    });

  map.tiles.set(tileKey(clean), clean);
  return clean;
}

export async function removeTile(
  map: UserMap,
  layer: string,
  x: number,
  y: number,
): Promise<boolean> {
  const key = tileKey({ layer, x, y });
  if (!map.tiles.has(key)) return false;
  await db
    .delete(userMapTiles)
    .where(
      sql`${userMapTiles.mapId} = ${map.id}
      AND ${userMapTiles.layer} = ${layer}
      AND ${userMapTiles.x} = ${x}
      AND ${userMapTiles.y} = ${y}`,
    );
  map.tiles.delete(key);
  return true;
}

// ---------------------------------------------------------------------------
// Block mutations
// ---------------------------------------------------------------------------

/** Add a collision block at (x, y). No-op if one is already there. */
export async function placeBlock(
  map: UserMap,
  x: number, y: number,
  placedBy: string | null,
): Promise<UserBlock> {
  const xi = Math.floor(x), yi = Math.floor(y);
  if (xi < 0 || xi >= map.width)  throw new Error("x out of bounds");
  if (yi < 0 || yi >= map.height) throw new Error("y out of bounds");

  const key = blockKey({ x: xi, y: yi });
  if (map.blocks.has(key)) return map.blocks.get(key)!;

  await db
    .insert(userMapBlocks)
    .values({ mapId: map.id, x: xi, y: yi, placedBy })
    .onConflictDoNothing({ target: [userMapBlocks.mapId, userMapBlocks.x, userMapBlocks.y] });

  const b: UserBlock = { x: xi, y: yi };
  map.blocks.set(key, b);
  return b;
}

export async function removeBlock(
  map: UserMap,
  x: number, y: number,
): Promise<boolean> {
  const xi = Math.floor(x), yi = Math.floor(y);
  const key = blockKey({ x: xi, y: yi });
  if (!map.blocks.has(key)) return false;
  await db
    .delete(userMapBlocks)
    .where(
      sql`${userMapBlocks.mapId} = ${map.id}
      AND ${userMapBlocks.x} = ${xi}
      AND ${userMapBlocks.y} = ${yi}`,
    );
  map.blocks.delete(key);
  return true;
}

/** Look up a mutable user map by numericId. Heaven is just a regular user
 *  map with the reserved HEAVEN_NUMERIC_ID, so a single lookup covers it. */
export function getBuilderMapByNumericId(numericId: number): UserMap | undefined {
  return byNumericId.get(numericId);
}

// -----------------------------------------------------------------------------
// Helpers
// -----------------------------------------------------------------------------

function cryptoId(): string {
  // Short 8-char id (collision-resistant enough for handle; the DB has a real uuid too)
  const bytes = new Uint8Array(6);
  (globalThis.crypto ?? require("node:crypto").webcrypto).getRandomValues(bytes);
  return Array.from(bytes).map((b) => b.toString(16).padStart(2, "0")).join("");
}
