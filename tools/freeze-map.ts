/**
 * freeze-map — dump a user-built map from the database into a TMX + server
 * JSON pair, ready to be shipped as a static zone.
 *
 * Usage:
 *   bun tools/freeze-map.ts <numericId | zoneId | all> [outDir]
 *
 * Examples:
 *   bun tools/freeze-map.ts 1000
 *   bun tools/freeze-map.ts user:a8594ae4c34d
 *   bun tools/freeze-map.ts all
 *
 * Default outDir is `packages/client/public/maps/user-maps/`.
 *
 * For each map, emits:
 *   <outDir>/<slug>.tmx   — client-renderable Tiled map (one sub-layer per
 *                           (logical-layer, tileset) pair since TMX layers
 *                           can only reference a single tileset)
 *   <outDir>/<slug>.json  — server map (bounds + collision + spawn objects)
 *
 * Collision rule: tiles placed on the "walls" layer are marked as collision
 * in the server JSON; everything else is walkable.
 */
import { mkdirSync, writeFileSync } from "node:fs";
import { resolve, dirname } from "node:path";
import { fileURLToPath } from "node:url";
import postgres from "postgres";

// --- Config -----------------------------------------------------------------

const DB_URL = process.env.DATABASE_URL
  || "postgresql://game:game_dev_password@localhost:5433/game";

const REPO_ROOT = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const DEFAULT_OUT_DIR = resolve(REPO_ROOT, "packages/client/public/maps");

const TILE_WIDTH  = 16;
const TILE_HEIGHT = 16;

// --- Types ------------------------------------------------------------------

interface MapRow {
  id:        string;
  numeric_id: number;
  zone_id:   string;
  name:      string;
  width:     number;
  height:    number;
}

interface TileRow {
  layer:    string;
  x:        number;
  y:        number;
  tileset:  string;
  tile_id:  number;
  rotation: number;
  flip_h:   boolean;
  flip_v:   boolean;
}

interface BlockRow {
  x: number;
  y: number;
}

interface TsxInfo {
  tilecount: number;
  columns:   number;
}

// --- TSX parsing (just the header attributes) ------------------------------

async function parseTsxHeader(tsxUrl: string): Promise<TsxInfo> {
  const res = await fetch(tsxUrl);
  if (!res.ok) throw new Error(`Failed to fetch TSX: ${tsxUrl} (${res.status})`);
  const xml = await res.text();
  const head = xml.match(/<tileset\b([^>]*)>/);
  if (!head) throw new Error(`No <tileset> element in ${tsxUrl}`);
  const body = head[1];
  const attr = (k: string) => body.match(new RegExp(`\\b${k}="([^"]*)"`))?.[1];
  const tilecount = +(attr("tilecount") ?? 0);
  const columns   = +(attr("columns") ?? 0);
  if (!tilecount || !columns) throw new Error(`Invalid tileset header: ${tsxUrl}`);
  return { tilecount, columns };
}

// Cache TSX info per tileset file so we don't fetch repeatedly.
const tsxCache = new Map<string, TsxInfo>();

async function getTsxInfo(file: string): Promise<TsxInfo> {
  let info = tsxCache.get(file);
  if (!info) {
    // TSX files live in packages/client/public/maps/ on disk.
    // We read directly from the filesystem, not over HTTP.
    const path = resolve(REPO_ROOT, "packages/client/public/maps", file);
    const { readFile } = await import("node:fs/promises");
    const xml = await readFile(path, "utf-8");
    const head = xml.match(/<tileset\b([^>]*)>/);
    if (!head) throw new Error(`No <tileset> in ${file}`);
    const body = head[1];
    const attr = (k: string) => body.match(new RegExp(`\\b${k}="([^"]*)"`))?.[1];
    info = {
      tilecount: +(attr("tilecount") ?? 0),
      columns:   +(attr("columns") ?? 0),
    };
    tsxCache.set(file, info);
  }
  return info;
}

// --- TMX writer -------------------------------------------------------------

/** Tiled flip-flags applied to a tile's gid for rotation/mirror. */
const FLIP_H = 0x80000000;
const FLIP_V = 0x40000000;
const FLIP_D = 0x20000000;

/** Encode a 90° rotation as Tiled flip flags on top of the base gid. */
function applyRotation(gid: number, rotation: number, flipH: boolean, flipV: boolean): number {
  let flags = 0;
  const r = ((rotation % 360) + 360) % 360;
  switch (r) {
    case 0:   break;
    case 90:  flags = FLIP_D | FLIP_H;            break;
    case 180: flags = FLIP_H | FLIP_V;            break;
    case 270: flags = FLIP_D | FLIP_V;            break;
  }
  if (flipH) flags ^= FLIP_H;
  if (flipV) flags ^= FLIP_V;
  // Tiled stores the result as a 32-bit unsigned integer; JavaScript
  // bitwise ops produce signed, but the CSV output uses unsigned so we
  // coerce via >>> 0.
  return (gid | flags) >>> 0;
}

const LAYER_ORDER = ["ground", "decor", "walls", "canopy"];

async function renderTmx(map: MapRow, tiles: TileRow[]): Promise<string> {
  // Unique tilesets used by this map, in encounter order.
  const tilesetList: string[] = [];
  const tilesetIndex = new Map<string, number>();
  for (const t of tiles) {
    if (!tilesetIndex.has(t.tileset)) {
      tilesetIndex.set(t.tileset, tilesetList.length);
      tilesetList.push(t.tileset);
    }
  }

  // Assign firstgids to each tileset.
  const firstgids: number[] = [];
  let gid = 1;
  for (const file of tilesetList) {
    firstgids.push(gid);
    const info = await getTsxInfo(file);
    gid += info.tilecount;
  }

  // Group tiles by (logical layer, tileset). Each group becomes one TMX
  // <layer> referencing a single tileset (CSV gids mixing multiple tilesets
  // is allowed by Tiled but the existing painter's writer doesn't support it,
  // and splitting is easier to read in Tiled).
  interface LayerBucket {
    name:         string;
    tilesetFile:  string;
    tilesetGid:   number;
    cells:        number[];  // length = width*height, 0 = empty
  }
  const buckets = new Map<string, LayerBucket>();
  for (const t of tiles) {
    const key = `${t.layer}::${t.tileset}`;
    let b = buckets.get(key);
    if (!b) {
      const tsIdx = tilesetIndex.get(t.tileset)!;
      b = {
        name:        `${t.layer}-${t.tileset.replace(/\.tsx$/, "").replace(/[^a-z0-9]/gi, "_")}`,
        tilesetFile: t.tileset,
        tilesetGid:  firstgids[tsIdx],
        cells:       new Array(map.width * map.height).fill(0),
      };
      buckets.set(key, b);
    }
    const baseGid = b.tilesetGid + t.tile_id;
    const enc = applyRotation(baseGid, t.rotation, t.flip_h, t.flip_v);
    b.cells[t.y * map.width + t.x] = enc;
  }

  // Order buckets by logical layer (ground → canopy).
  const ordered = Array.from(buckets.values()).sort((a, b) => {
    const al = LAYER_ORDER.findIndex((l) => a.name.startsWith(l + "-"));
    const bl = LAYER_ORDER.findIndex((l) => b.name.startsWith(l + "-"));
    return al - bl;
  });

  // Compose XML manually (mirrors tools/paint-map/tmx.ts style).
  const lines: string[] = [];
  lines.push(`<?xml version="1.0" encoding="UTF-8"?>`);
  const nextLayerId = ordered.length + 2;
  lines.push(
    `<map version="1.10" tiledversion="1.10.2" orientation="orthogonal" renderorder="right-down" ` +
    `width="${map.width}" height="${map.height}" tilewidth="${TILE_WIDTH}" tileheight="${TILE_HEIGHT}" ` +
    `infinite="0" nextlayerid="${nextLayerId}" nextobjectid="2">`,
  );

  for (let i = 0; i < tilesetList.length; i++) {
    // TSX refs are absolute `/maps/<file>.tsx`. Matches the server-synth
    // renderer in `packages/server/src/game/tmx-render.ts`, so frozen TMX
    // and live-synth TMX are byte-compatible from the browser's POV:
    // plugin-tiled fetches TSX at `/maps/...` regardless of whether the TMX
    // itself came from `/api/maps/...` (frozen) or `/api/maps/...` (synth).
    lines.push(` <tileset firstgid="${firstgids[i]}" source="/maps/${tilesetList[i]}"/>`);
  }

  let layerId = 0;
  for (const b of ordered) {
    layerId++;
    lines.push(
      ` <layer id="${layerId}" name="${b.name}" width="${map.width}" height="${map.height}">`,
    );
    lines.push(`  <data encoding="csv">`);
    const rows: string[] = [];
    for (let y = 0; y < map.height; y++) {
      const row: number[] = [];
      for (let x = 0; x < map.width; x++) row.push(b.cells[y * map.width + x]);
      const isLast = y === map.height - 1;
      rows.push(row.join(",") + (isLast ? "" : ","));
    }
    lines.push(rows.join("\n"));
    lines.push(`  </data>`);
    lines.push(` </layer>`);
  }

  // Objects: a single player-spawn at the map centre. The scene spec format
  // used by paint-map wires this through as a point object with a "name";
  // we mirror that here.
  layerId++;
  lines.push(` <objectgroup id="${layerId}" name="spawns">`);
  const cx = (Math.floor(map.width  / 2) + 0.5) * TILE_WIDTH;
  const cy = (Math.floor(map.height / 2) + 0.5) * TILE_HEIGHT;
  lines.push(
    `  <object id="1" name="player-spawn" type="player-spawn" x="${cx}" y="${cy}"><point/></object>`,
  );
  lines.push(` </objectgroup>`);

  lines.push(`</map>`);
  return lines.join("\n") + "\n";
}

// --- Server JSON writer ----------------------------------------------------

function renderServerJson(map: MapRow, _tiles: TileRow[], blocks: BlockRow[]): object {
  // Collision is driven entirely by placed blocks — decoupled from tile
  // sprite footprints so, e.g., a 5×7 tree sprite can have a 1-cell trunk.
  const collisionData: number[] = new Array(map.width * map.height).fill(0);
  for (const b of blocks) {
    if (b.x < 0 || b.x >= map.width || b.y < 0 || b.y >= map.height) continue;
    collisionData[b.y * map.width + b.x] = 1;
  }
  // Ground layer: every in-bounds cell is walkable, gid 1.
  const groundData: number[] = new Array(map.width * map.height).fill(1);

  const spawnX = Math.floor(map.width  / 2);
  const spawnY = Math.floor(map.height / 2);

  return {
    width:        map.width,
    height:       map.height,
    tilewidth:    TILE_WIDTH,
    tileheight:   TILE_HEIGHT,
    infinite:     false,
    orientation:  "orthogonal",
    renderorder:  "right-down",
    type:         "map",
    version:      "1.10",
    tiledversion: "1.11.0",
    tilesets:     [],
    layers: [
      { id: 1, name: "ground",    type: "tilelayer",   width: map.width, height: map.height,
        data: groundData,    visible: true,  opacity: 1, x: 0, y: 0 },
      { id: 2, name: "collision", type: "tilelayer",   width: map.width, height: map.height,
        data: collisionData, visible: false, opacity: 1, x: 0, y: 0 },
      { id: 3, name: "objects",   type: "objectgroup", draworder: "topdown",
        objects: [{
          id: 1, name: "player-spawn", type: "spawn",
          x: spawnX * TILE_WIDTH, y: spawnY * TILE_HEIGHT,
          width: 0, height: 0, rotation: 0, visible: true,
          properties: [{ name: "spawnType", type: "string", value: "player" }],
        }],
      },
    ],
  };
}

// --- DB ---------------------------------------------------------------------

async function loadMaps(sql: postgres.Sql, selector: string): Promise<MapRow[]> {
  if (selector === "all") {
    return sql`SELECT id, numeric_id, zone_id, name, width, height FROM user_maps ORDER BY numeric_id`
      .then((r) => r as unknown as MapRow[]);
  }
  if (selector.startsWith("user:")) {
    return sql`SELECT id, numeric_id, zone_id, name, width, height FROM user_maps WHERE zone_id = ${selector}`
      .then((r) => r as unknown as MapRow[]);
  }
  const n = Number(selector);
  if (Number.isFinite(n)) {
    return sql`SELECT id, numeric_id, zone_id, name, width, height FROM user_maps WHERE numeric_id = ${n}`
      .then((r) => r as unknown as MapRow[]);
  }
  throw new Error(`Unknown selector: ${selector}`);
}

async function loadTiles(sql: postgres.Sql, mapId: string): Promise<TileRow[]> {
  return sql`SELECT layer, x, y, tileset, tile_id, rotation, flip_h, flip_v
             FROM user_map_tiles WHERE map_id = ${mapId}
             ORDER BY layer, y, x`
    .then((r) => r as unknown as TileRow[]);
}

async function loadBlocks(sql: postgres.Sql, mapId: string): Promise<BlockRow[]> {
  return sql`SELECT x, y FROM user_map_blocks WHERE map_id = ${mapId} ORDER BY y, x`
    .then((r) => r as unknown as BlockRow[]);
}

// --- Main -------------------------------------------------------------------

function slug(name: string): string {
  return name.trim().toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-+|-+$/g, "") || "untitled";
}

async function main(): Promise<void> {
  const [, , selector, outArg] = process.argv;
  if (!selector) {
    console.error("usage: bun tools/freeze-map.ts <numericId | zoneId | all> [outDir]");
    process.exit(1);
  }
  const outDir = resolve(outArg ?? DEFAULT_OUT_DIR);
  mkdirSync(outDir, { recursive: true });

  const sql = postgres(DB_URL);
  try {
    const maps = await loadMaps(sql, selector);
    if (maps.length === 0) {
      console.error(`[freeze] No maps matched: ${selector}`);
      process.exit(1);
    }

    for (const m of maps) {
      const tiles  = await loadTiles(sql, m.id);
      const blocks = await loadBlocks(sql, m.id);
      console.log(`[freeze] ${m.name} (${m.zone_id}, ${m.width}x${m.height}) → ${tiles.length} tile(s), ${blocks.length} block(s)`);

      const fileSlug = `${m.numeric_id}-${slug(m.name)}`;
      const tmxPath  = resolve(outDir, `${fileSlug}.tmx`);
      const jsonPath = resolve(outDir, `${fileSlug}.json`);

      const tmx = await renderTmx(m, tiles);
      writeFileSync(tmxPath, tmx);

      const json = renderServerJson(m, tiles, blocks);
      writeFileSync(jsonPath, JSON.stringify(json, null, 2) + "\n");

      console.log(`  wrote ${tmxPath}`);
      console.log(`  wrote ${jsonPath}`);
    }
  } finally {
    await sql.end();
  }
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
