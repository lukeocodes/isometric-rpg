/**
 * TMX-from-DB renderer — synthesizes a Tiled TMX XML document from the
 * database representation of a user map (`user_maps` + `user_map_tiles` +
 * `user_map_blocks`).
 *
 * The client's `@excaliburjs/plugin-tiled` consumes the output verbatim. No
 * map file needs to live on disk; the game and builder both fetch
 * `/api/maps/:zoneId.tmx` and let plugin-tiled render it.
 *
 * `tools/freeze-map.ts` produces the same shape when "committing" a map to
 * disk; if a zone is later served from disk instead of the API, plugin-tiled
 * still sees the same XML.
 */
import { readFile } from "node:fs/promises";
import { resolve } from "node:path";

const TILE_WIDTH  = 16;
const TILE_HEIGHT = 16;

/** Tiled flip-flags applied to a tile's gid for rotation/mirror. */
const FLIP_H = 0x80000000;
const FLIP_V = 0x40000000;
const FLIP_D = 0x20000000;

const LAYER_ORDER = ["ground", "decor", "walls", "canopy"] as const;

export interface DbTile {
  layer:    string;
  x:        number;
  y:        number;
  tileset:  string;
  tileId:   number;
  rotation: number;
  flipH:    boolean;
  flipV:    boolean;
}

export interface DbMap {
  width:  number;
  height: number;
  name:   string;
  zoneId: string;
}

interface TsxInfo {
  tilecount: number;
  columns:   number;
}

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
  return (gid | flags) >>> 0;
}

/** TSX header cache — we only ever read tilecount + columns per file. */
const tsxCache = new Map<string, TsxInfo>();

/** Read the `<tileset>` header from a TSX file on disk. */
async function readTsxHeader(tsxPath: string): Promise<TsxInfo> {
  const xml  = await readFile(tsxPath, "utf-8");
  const head = xml.match(/<tileset\b([^>]*)>/);
  if (!head) throw new Error(`No <tileset> in ${tsxPath}`);
  const body = head[1];
  const attr = (k: string): string | undefined =>
    body.match(new RegExp(`\\b${k}="([^"]*)"`))?.[1];
  return {
    tilecount: Number(attr("tilecount") ?? 0),
    columns:   Number(attr("columns") ?? 0),
  };
}

/**
 * Synthesize a TMX XML document for the given DB map + its tiles.
 *
 * `mapsDir` is the on-disk directory containing TSX files (typically
 * `packages/client/public/maps/`). We read TSX headers only to derive
 * `firstgid` offsets per tileset.
 *
 * Tile data is written as CSV inside one `<layer>` per (logical-layer,
 * tileset) pair. Plugin-tiled and Tiled both accept multiple layers sharing
 * the same `name`, but we make the name unique to keep Excalibur's actor
 * naming sensible.
 */
export async function renderMapTmx(
  map: DbMap,
  tiles: DbTile[],
  mapsDir: string,
): Promise<string> {
  // Unique tilesets used by this map, in encounter order.
  const tilesetList: string[] = [];
  const tilesetIndex = new Map<string, number>();
  for (const t of tiles) {
    if (!tilesetIndex.has(t.tileset)) {
      tilesetIndex.set(t.tileset, tilesetList.length);
      tilesetList.push(t.tileset);
    }
  }

  // Assign firstgids. Empty maps still render — just no <tileset>/<layer>.
  const firstgids: number[] = [];
  let gid = 1;
  for (const file of tilesetList) {
    firstgids.push(gid);
    let info = tsxCache.get(file);
    if (!info) {
      info = await readTsxHeader(resolve(mapsDir, file));
      tsxCache.set(file, info);
    }
    gid += info.tilecount;
  }

  // Bucket tiles by (logical layer, tileset). One TMX <layer> per bucket.
  interface LayerBucket {
    name:        string;
    tilesetFile: string;
    tilesetGid:  number;
    cells:       number[];  // length = width*height, 0 = empty
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
    const baseGid = b.tilesetGid + t.tileId;
    b.cells[t.y * map.width + t.x] = applyRotation(baseGid, t.rotation, t.flipH, t.flipV);
  }

  // Order buckets ground → canopy.
  const ordered = Array.from(buckets.values()).sort((a, b) => {
    const al = LAYER_ORDER.findIndex((l) => a.name.startsWith(l + "-"));
    const bl = LAYER_ORDER.findIndex((l) => b.name.startsWith(l + "-"));
    return al - bl;
  });

  // --- Compose XML ---
  const lines: string[] = [];
  lines.push(`<?xml version="1.0" encoding="UTF-8"?>`);
  const nextLayerId = ordered.length + 2;
  lines.push(
    `<map version="1.10" tiledversion="1.10.2" orientation="orthogonal" renderorder="right-down" ` +
    `width="${map.width}" height="${map.height}" tilewidth="${TILE_WIDTH}" tileheight="${TILE_HEIGHT}" ` +
    `infinite="0" nextlayerid="${nextLayerId}" nextobjectid="2">`,
  );

  // TSX files are served by Vite statically at `/maps/<file>.tsx`. Absolute
  // path means plugin-tiled doesn't have to resolve relative to the TMX URL
  // (which is `/api/maps/<zone>.tmx` under the API prefix).
  for (let i = 0; i < tilesetList.length; i++) {
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

  // Player-spawn object at map centre. GameScene ignores it for now (the
  // spawn coordinates come from SPAWN_ACCEPTED), but keeping the object in
  // the TMX lines up with what the frozen / hand-authored TMX would have.
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
