/**
 * Tileset ingest — walks packages/client/public/maps/**\/*.tsx, parses each
 * TSX manifest, scans the referenced PNG alpha channel for fully-transparent
 * cells, and upserts into the DB.
 *
 * Replaces the old `tools/seed-tile-registry.ts` which pulled from a
 * hand-maintained `registry/tilesets.ts` — that registry is now redundant
 * because the DB is the source of truth and this tool scans disk directly.
 * Drop a new PNG + TSX onto disk, run this tool, done.
 *
 * Idempotent:
 *   - `tilesets` row — upserted by file path. Structural columns (tilewidth,
 *     columns, image_*, animations) always refreshed from TSX/PNG. Metadata
 *     columns (default_category_id, default_layer_id, default_blocks, tags,
 *     seasonal, hidden, auto_hide_labels, notes) are PRESERVED if the row
 *     already exists (so categorizations done via the builder UI aren't
 *     overwritten) and default to sensible values for new rows.
 *   - `tile_animations` — replaced per tileset (DELETE + INSERT).
 *   - `tile_empty_flags` — replaced per tileset (DELETE + INSERT).
 *   - `tileset_sub_regions`, `tile_overrides` — NOT touched by this tool;
 *     those are builder-authored and only ever change via the builder UI.
 *
 * Usage:
 *   DATABASE_URL=… bun tools/ingest-tilesets.ts
 *
 * See AGENTS.md "Data in the Database" and AGENTS.game.md Phase 1+2.
 */
import { readFileSync, readdirSync, statSync, existsSync } from "node:fs";
import { resolve, dirname, relative, posix } from "node:path";
import postgres from "postgres";
import sharp from "sharp";

const REPO_ROOT = resolve(import.meta.dirname, "..");
const MAPS_DIR  = resolve(REPO_ROOT, "packages/client/public/maps");
const DATABASE_URL = process.env.DATABASE_URL
  ?? "postgresql://game:game_dev_password@localhost:5433/game";

const sql = postgres(DATABASE_URL);

// ---------------------------------------------------------------------------
// TSX parsing (same regex approach as TilesetIndex.ts / seed-tile-registry)
// ---------------------------------------------------------------------------

interface ParsedTsx {
  name:        string;
  tilewidth:   number;
  tileheight:  number;
  columns:     number;
  tilecount:   number;
  imageUrl:    string;      // /maps/... URL the client fetches
  imageAbs:    string;      // absolute path on disk, for alpha scan
  imageWidth:  number;
  imageHeight: number;
  animations:  Array<{ headTileId: number; frames: Array<{ tileId: number; duration: number }> }>;
}

function attr(src: string, key: string): string | undefined {
  return src.match(new RegExp(`\\b${key}="([^"]*)"`))?.[1];
}
function requireAttr(src: string, key: string, where: string): string {
  const v = attr(src, key);
  if (v === undefined) throw new Error(`${where}: missing attribute '${key}'`);
  return v;
}

function parseTsx(xml: string, tsxRelPath: string, tsxAbsPath: string): ParsedTsx {
  const tsHead = xml.match(/<tileset\b([^>]*)>/);
  if (!tsHead) throw new Error(`${tsxRelPath}: no <tileset>`);
  const imgMatch = xml.match(/<image\b([^>]*?)\/>/);
  if (!imgMatch) throw new Error(`${tsxRelPath}: no <image>`);

  const imgSrcRaw = requireAttr(imgMatch[1], "source", `${tsxRelPath} <image>`);

  // Resolve PNG path both as /maps/... URL and as absolute disk path.
  const tsxDirUrl = dirname(`/maps/${tsxRelPath}`);
  const imageUrl = resolveRelUrl(tsxDirUrl, imgSrcRaw);
  const imageAbs = resolve(dirname(tsxAbsPath), imgSrcRaw);

  // Animations.
  const animations: ParsedTsx["animations"] = [];
  const tileRe = /<tile\b([^>]*)>([\s\S]*?)<\/tile>/g;
  let m: RegExpExecArray | null;
  while ((m = tileRe.exec(xml)) !== null) {
    const headId = +requireAttr(m[1], "id", `${tsxRelPath} <tile>`);
    const animMatch = m[2].match(/<animation>([\s\S]*?)<\/animation>/);
    if (!animMatch) continue;
    const frames: Array<{ tileId: number; duration: number }> = [];
    const frameRe = /<frame\b([^/]*)\/>/g;
    let fm: RegExpExecArray | null;
    while ((fm = frameRe.exec(animMatch[1])) !== null) {
      frames.push({
        tileId:   +requireAttr(fm[1], "tileid",   `${tsxRelPath} <frame>`),
        duration: +requireAttr(fm[1], "duration", `${tsxRelPath} <frame>`),
      });
    }
    if (frames.length > 0) animations.push({ headTileId: headId, frames });
  }

  return {
    name:        requireAttr(tsHead[1], "name",       `${tsxRelPath} <tileset>`),
    tilewidth:   +requireAttr(tsHead[1], "tilewidth",  `${tsxRelPath} <tileset>`),
    tileheight:  +requireAttr(tsHead[1], "tileheight", `${tsxRelPath} <tileset>`),
    columns:     +requireAttr(tsHead[1], "columns",    `${tsxRelPath} <tileset>`),
    tilecount:   +requireAttr(tsHead[1], "tilecount",  `${tsxRelPath} <tileset>`),
    imageUrl,
    imageAbs,
    imageWidth:  +requireAttr(imgMatch[1], "width",  `${tsxRelPath} <image>`),
    imageHeight: +requireAttr(imgMatch[1], "height", `${tsxRelPath} <image>`),
    animations,
  };
}

function resolveRelUrl(baseDir: string, rel: string): string {
  const parts = baseDir.split("/").filter(Boolean);
  for (const seg of rel.split("/")) {
    if (seg === "..")      parts.pop();
    else if (seg !== ".")  parts.push(seg);
  }
  return "/" + parts.join("/");
}

// ---------------------------------------------------------------------------
// PNG alpha scan via sharp — returns sorted array of empty tile IDs.
// ---------------------------------------------------------------------------

async function scanEmptyTiles(parsed: ParsedTsx): Promise<number[]> {
  const { imageAbs, tilewidth: tw, tileheight: th, columns, tilecount } = parsed;
  const img = sharp(imageAbs).ensureAlpha();
  const { data, info } = await img.raw().toBuffer({ resolveWithObject: true });
  if (info.channels !== 4) {
    throw new Error(`${imageAbs}: expected 4 channels after ensureAlpha, got ${info.channels}`);
  }
  const { width: w, height: h } = info;
  const empties: number[] = [];

  // For each tile cell, check if every pixel has alpha < 4.
  for (let i = 0; i < tilecount; i++) {
    const col = i % columns;
    const row = Math.floor(i / columns);
    const sx = col * tw;
    const sy = row * th;
    if (sx + tw > w || sy + th > h) continue;  // grid overflow — skip silently
    let allTransparent = true;
    for (let y = 0; y < th && allTransparent; y++) {
      const rowStart = (sy + y) * w * 4 + sx * 4;
      for (let x = 0; x < tw; x++) {
        // Alpha byte is at offset 3 of each RGBA pixel.
        if (data[rowStart + x * 4 + 3] >= 4) { allTransparent = false; break; }
      }
    }
    if (allTransparent) empties.push(i);
  }
  return empties;
}

// ---------------------------------------------------------------------------
// Walk public/maps for every *.tsx
// ---------------------------------------------------------------------------

function walkTsxFiles(dir: string, acc: string[] = []): string[] {
  for (const entry of readdirSync(dir)) {
    const full = resolve(dir, entry);
    const s = statSync(full);
    if (s.isDirectory()) walkTsxFiles(full, acc);
    else if (s.isFile() && entry.endsWith(".tsx")) acc.push(full);
  }
  return acc;
}

// ---------------------------------------------------------------------------
// Ingest one tileset (UPSERT + replace animations/empty_flags).
// ---------------------------------------------------------------------------

async function ingestOne(tsxAbsPath: string): Promise<{ ok: boolean; emptyCount: number; animCount: number }> {
  const tsxRel = posix.normalize(relative(MAPS_DIR, tsxAbsPath).split("\\").join("/"));
  const xml = readFileSync(tsxAbsPath, "utf8");

  let parsed: ParsedTsx;
  try {
    parsed = parseTsx(xml, tsxRel, tsxAbsPath);
  } catch (err) {
    console.warn(`  [parse] ${tsxRel}: ${(err as Error).message}`);
    return { ok: false, emptyCount: 0, animCount: 0 };
  }

  // Skip TSX files whose PNG is missing. These are usually Tiled debug
  // artifacts ("collision & alpha.tsx") shipped with sample maps that
  // reference paths we don't vendor. No point creating a DB row for
  // something the client can't load.
  if (!existsSync(parsed.imageAbs)) {
    console.warn(`  [skip] ${tsxRel}: referenced PNG not on disk (${parsed.imageAbs})`);
    return { ok: false, emptyCount: 0, animCount: 0 };
  }

  // Default slug from filename (strip extension, replace spaces/special with '-').
  const defaultSlug = tsxRel
    .replace(/\.tsx$/, "")
    .replace(/[^a-zA-Z0-9/]/g, "-")
    .replace(/\/+/g, "-")
    .replace(/-+/g, "-")
    .replace(/^-|-$/g, "")
    .toLowerCase();

  // UPSERT: preserve builder-authored metadata columns on conflict (COALESCE
  // with the existing row). Only structural + image columns overwrite.
  await sql`
    INSERT INTO tilesets (
      file, slug, name,
      tilewidth, tileheight, columns, tilecount,
      image_url, image_width, image_height,
      default_category_id, default_layer_id, default_blocks,
      tags, seasonal, hidden, auto_hide_labels, notes, updated_at
    ) VALUES (
      ${tsxRel}, ${defaultSlug}, ${parsed.name},
      ${parsed.tilewidth}, ${parsed.tileheight}, ${parsed.columns}, ${parsed.tilecount},
      ${parsed.imageUrl}, ${parsed.imageWidth}, ${parsed.imageHeight},
      ${"uncategorised"}, ${"ground"}, ${false},
      ${sql.json([])}, ${null}, ${false}, ${false}, ${null}, NOW()
    )
    ON CONFLICT (file) DO UPDATE SET
      -- Structural (from TSX, always refresh):
      name                = EXCLUDED.name,
      tilewidth           = EXCLUDED.tilewidth,
      tileheight          = EXCLUDED.tileheight,
      columns             = EXCLUDED.columns,
      tilecount           = EXCLUDED.tilecount,
      image_url           = EXCLUDED.image_url,
      image_width         = EXCLUDED.image_width,
      image_height        = EXCLUDED.image_height,
      -- Metadata (keep existing, fall back to defaults only on first insert):
      slug                = COALESCE(tilesets.slug, EXCLUDED.slug),
      default_category_id = COALESCE(tilesets.default_category_id, EXCLUDED.default_category_id),
      default_layer_id    = COALESCE(tilesets.default_layer_id,    EXCLUDED.default_layer_id),
      -- default_blocks is non-nullable; keep existing value explicitly.
      default_blocks      = tilesets.default_blocks,
      tags                = tilesets.tags,
      seasonal            = tilesets.seasonal,
      hidden              = tilesets.hidden,
      auto_hide_labels    = tilesets.auto_hide_labels,
      notes               = tilesets.notes,
      updated_at          = NOW()
  `;

  // Replace animations.
  await sql`DELETE FROM tile_animations WHERE tileset_file = ${tsxRel}`;
  let animCount = 0;
  for (const a of parsed.animations) {
    for (let idx = 0; idx < a.frames.length; idx++) {
      const f = a.frames[idx];
      await sql`
        INSERT INTO tile_animations
          (tileset_file, head_tile_id, frame_idx, frame_tile_id, duration_ms)
        VALUES
          (${tsxRel}, ${a.headTileId}, ${idx}, ${f.tileId}, ${f.duration})
      `;
      animCount++;
    }
  }

  // Scan PNG alpha + replace empty flags.
  let emptyCount = 0;
  try {
    const empties = await scanEmptyTiles(parsed);
    await sql`DELETE FROM tile_empty_flags WHERE tileset_file = ${tsxRel}`;
    if (empties.length > 0) {
      const rows = empties.map((tileId) => ({ tileset_file: tsxRel, tile_id: tileId }));
      await sql`INSERT INTO tile_empty_flags ${sql(rows, "tileset_file", "tile_id")}`;
      emptyCount = empties.length;
    }
  } catch (err) {
    console.warn(`  [alpha] ${tsxRel}: ${(err as Error).message}`);
  }

  return { ok: true, emptyCount, animCount };
}

// ---------------------------------------------------------------------------
// Main
// ---------------------------------------------------------------------------

async function main() {
  console.log("[ingest] connecting to DB:", DATABASE_URL.replace(/:[^:@]+@/, ":***@"));
  const t0 = Date.now();

  const files = walkTsxFiles(MAPS_DIR).sort();
  console.log(`[ingest] walking ${MAPS_DIR}`);
  console.log(`[ingest] found ${files.length} TSX file(s)`);

  let ok = 0, failed = 0, totalEmpty = 0, totalAnim = 0;
  try {
    for (const f of files) {
      const res = await ingestOne(f);
      if (res.ok) { ok++; totalEmpty += res.emptyCount; totalAnim += res.animCount; }
      else        { failed++; }
    }
  } finally {
    await sql.end();
  }

  const dt = ((Date.now() - t0) / 1000).toFixed(1);
  console.log(`[ingest] ${ok} ingested, ${failed} failed; ${totalEmpty} empty tile(s), ${totalAnim} animation frame(s) in ${dt}s`);
}

main().catch((err) => {
  console.error("[ingest] FAILED:", err);
  process.exit(1);
});
