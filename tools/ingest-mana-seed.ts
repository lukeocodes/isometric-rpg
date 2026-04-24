/**
 * Mana Seed ingest — walks `assets/**\/*.png` in the raw Mana Seed asset
 * packs, publishes canonical TSX + PNG pairs to the public tree, and upserts
 * into the `tilesets` / `tile_animations` / `tile_empty_flags` tables.
 *
 * Replaces the old `tools/ingest-tilesets.ts` (which walked
 * `public/maps/**\/*.tsx` — still fine but required manual copying from
 * source packs first).
 *
 * Canonical publishing layout:
 *   PNG → packages/client/public/assets/tilesets/<cat>/<slug>.png
 *   TSX → packages/client/public/maps/<cat>/<slug>.tsx
 *   TSX image src = `../../assets/tilesets/<cat>/<slug>.png`
 *   DB `tilesets.file` = `<cat>/<slug>.tsx`
 *   DB `tilesets.image_url` = `/assets/tilesets/<cat>/<slug>.png`
 *
 *   <cat> is the packSlug (`summer-forest`, `fences-walls`, `thatch-roof-home`, …).
 *   <slug> is the dashed-lowercase basename (`home-exteriors-thatch-roof-v1`).
 *
 * Source-of-truth priority for tile size + animations:
 *   1. Adjacent TSX in `<pack>/sample map/TSX files/<basename>.tsx` — parse
 *      tilewidth/tileheight/columns/animations; rewrite image src; emit.
 *   2. Filename NxM suffix (e.g. `low stone wall 16x16.png` → 16×16,
 *      `high stone wall 32x96.png` → 32×96).
 *   3. Per-pack `defaultTileSize` (64×64 for farmer/char/npc, etc.).
 *   4. Fallback 16×16.
 *
 * Flags:
 *   --reset       TRUNCATE tilesets (CASCADEs tile_overrides, tile_animations,
 *                 tile_empty_flags, tileset_sub_regions) before ingesting.
 *   --dry-run     Log what would happen, don't write files or touch DB.
 *   --pack=<name> Ingest only the given pack dir (e.g.
 *                 `--pack="20.01b - Thatch Roof Home 4.1"`). Repeatable.
 *
 * Usage:
 *   DATABASE_URL=… bun tools/ingest-mana-seed.ts [--reset] [--dry-run] [--pack=…]
 */
import { readFileSync, readdirSync, statSync, existsSync, mkdirSync, copyFileSync } from "node:fs";
import { resolve, dirname, basename, relative, join } from "node:path";
import postgres from "postgres";
import sharp from "sharp";

const REPO_ROOT       = resolve(import.meta.dirname, "..");
const ASSETS_DIR      = resolve(REPO_ROOT, "assets");
const PUBLIC_MAPS_DIR = resolve(REPO_ROOT, "packages/client/public/maps");
const PUBLIC_PNGS_DIR = resolve(REPO_ROOT, "packages/client/public/assets/tilesets");
const DATABASE_URL    = process.env.DATABASE_URL
  ?? "postgresql://game:game_dev_password@localhost:5433/game";

// ---------------------------------------------------------------------------
// CLI flags
// ---------------------------------------------------------------------------

const RESET    = process.argv.includes("--reset");
const DRY      = process.argv.includes("--dry-run");
const PACK_ARGS = process.argv.filter(a => a.startsWith("--pack=")).map(a => a.slice(7));

// ---------------------------------------------------------------------------
// Pack configuration — which packs to ingest, their category slug, optional
// per-pack defaults. Anything not in this set is ignored.
// ---------------------------------------------------------------------------

interface PackConfig {
  slug:             string;             // e.g. "summer-forest"
  seasonal?:        string;             // "summer"|"spring"|"autumn"|"winter" for seasonal flag in DB
  defaultTileSize?: [number, number];   // fallback if filename has no NxM
  hidden?:          boolean;            // hide from builder picker (actors, etc.)
}

const PACKS: Record<string, PackConfig> = {
  "18.10a - Fences & Walls 3.0":           { slug: "fences-walls" },
  "18.10b - Village Accessories 2.2":      { slug: "village-accessories" },
  "19.03a - Animated Candles 4.1":         { slug: "animated-candles" },
  "19.04b - Cozy Furnishings 2.2":         { slug: "cozy-furnishings" },
  "19.07a - Gentle Forest 3.0a ($0 palettes)": { slug: "gentle-forest" },
  "19.07c - Treasure Chests 1.2a":         { slug: "treasure-chests" },
  "20.01b - Thatch Roof Home 4.1":         { slug: "thatch-roof-home" },
  "20.02a - Farming Crops #1 3.1":         { slug: "farming-crops-1" },
  "20.03a - Traveler's Camp 2.0":          { slug: "travelers-camp" },
  "20.04c - Summer Forest 4.3":            { slug: "summer-forest", seasonal: "summer" },
  "20.05a - Timber Roof Home 4.2":         { slug: "timber-roof-home" },
  "20.05b - Breakable Pots 1.1a":          { slug: "breakable-pots" },
  "20.05c - Spring Forest 4.3":            { slug: "spring-forest", seasonal: "spring" },
  "20.06a - Autumn Forest 4.3":            { slug: "autumn-forest", seasonal: "autumn" },
  "20.07a - Winter Forest 4.3":            { slug: "winter-forest", seasonal: "winter" },
  "20.07b - Weather Effects 2.0":          { slug: "weather-effects" },
  "20.08a - Delicate Deer 3.0":            { slug: "delicate-deer",       defaultTileSize: [64, 64], hidden: true },
  "20.09a - Animated Livestock 4.0":       { slug: "animated-livestock",  defaultTileSize: [32, 32], hidden: true },
  "20.12a - NPC Pack #1 3.0":              { slug: "npc-pack-1",          defaultTileSize: [64, 64], hidden: true },
  "21.04a - Half-Timber Home 4.2":         { slug: "half-timber-home" },
  "22.02a - Growable Trees 1.2":           { slug: "growable-trees" },
  "22.04a - NPC Pack #2 1.2b":             { slug: "npc-pack-2",          defaultTileSize: [64, 64], hidden: true },
  "22.05a Farming Crops #2 2.1":           { slug: "farming-crops-2" },
  "22.08b - Smithing Gear 2.0":            { slug: "smithing-gear" },
  "22.09a - Stonework Home 3.2":           { slug: "stonework-home" },
  "22.10a - Mana Seed Farmer Sprite System v1.6": { slug: "farmer-sprite-system", defaultTileSize: [64, 64], hidden: true },
  "23.09a - Fishing Gear 2.0":             { slug: "fishing-gear" },
  "23.11a - Livestock Accessories":        { slug: "livestock-accessories" },
  "24.04a - Hardy Horse 1.1":              { slug: "hardy-horse",         defaultTileSize: [64, 64], hidden: true },
  "25.02a - Friendly Foal 1.1":            { slug: "friendly-foal",       defaultTileSize: [64, 64], hidden: true },
  "25.09a - Growable Fruit Trees 1.0":     { slug: "growable-fruit-trees" },
  "char_a_p1":                             { slug: "char-a-p1",           defaultTileSize: [64, 64], hidden: true },
  "char_a_pONE1":                          { slug: "char-a-pone1",        defaultTileSize: [64, 64], hidden: true },
  "char_a_pONE2":                          { slug: "char-a-pone2",        defaultTileSize: [64, 64], hidden: true },
  "char_a_pONE3":                          { slug: "char-a-pone3",        defaultTileSize: [64, 64], hidden: true },
  "weapon sprites":                        { slug: "weapon-sprites",      defaultTileSize: [64, 64], hidden: true },
};

// ---------------------------------------------------------------------------
// Exclusion rules (applied inside an included pack)
// ---------------------------------------------------------------------------

/** Subdirectory names to skip recursing into. */
const SKIP_SUBDIR_RE = /(^|\/)(_supporting files|_old stuff \(deprecated\)|old stuff \(deprecated\)|old versions? \(deprecated\)|old version \(unsupported\)|sample map|mockups|map samples|usage guides|v00 only|guides|tree wall\/autotile guide|no shadow versions|baked-in shadows[^/]*)(\/|$)/i;

/** PNG filenames to skip — help sheets, reference images, demos, setup guides. */
function isReferencePng(fileName: string): boolean {
  const lc = fileName.toLowerCase();
  return (
    /(^|[\s(,\-])(help|reference|setup|preview|tutorial|demo|mockup|demonstration)(\s|\.|\)|$)/.test(lc) ||
    /autotile (setup|guide)/.test(lc) ||
    /animation guide/.test(lc) ||
    /palette reference/.test(lc) ||
    /paper doll/.test(lc) ||
    /coop samples/.test(lc) ||
    /^seasonal sample/.test(lc) ||
    /color ramps/.test(lc) ||
    /^tutorial page/.test(lc) ||
    /^if it isn't working/.test(lc) ||
    /mana seed font collection demo/.test(lc) ||
    /^sample \d/.test(lc)
  );
}

// ---------------------------------------------------------------------------
// Category heuristics (filename + path → tile_categories.id)
// ---------------------------------------------------------------------------

function categorize(path: string, packSlug: string, hidden: boolean): string {
  const p = path.toLowerCase();
  if (hidden) {
    if (/livestock|chicken|pig|cattle|duck|chick|horse|foal|deer|school of fish/.test(p)) return "livestock";
    return "characters";
  }
  // Most specific first.
  if (/tree wall/.test(p))                                                  return "trees";
  if (/waterfall|water sparkles|water anim/.test(p))                        return "water";
  if (/tall grass effect|grass effect/.test(p))                             return "plants";
  if (/weather effects/.test(p))                                            return "effects";
  if (/shadow|collision|alpha/.test(p))                                     return "effects";
  if (/\bbridge\b/.test(p))                                                 return "bridges";
  if (/candle|fireplace|lantern/.test(p))                                   return "lights";
  if (/\bpots?\b|\bchests?\b|\bchest\b/.test(p))                            return "containers";
  if (/\bdoor\b/.test(p))                                                   return "doors";
  if (/fence|gate|stone wall|iron wall|fort wall|fort catwalk/.test(p))     return "walls";
  if (/home exterior|home interior|camp tent|camp 32x32|camp tent interior/.test(p)) return "buildings";
  // Stonework / half-timber / timber / thatch standalone pieces (no "home")
  // are wall/facade sliceables — grouped under "roofs" to match the existing
  // DB convention where roof + chimney + posts + facade bits all live together.
  if (/roof|chimney|\bposts?\b|^stonework [\d]|\bstonework \d/.test(p))     return "roofs";
  if (/furnishings|wooden deck|wooden stairs|table|home extras|hay pile/.test(p)) return "furniture";
  if (/\bcrop|crops\b|giant veggies|giant pumpkin/.test(p))                 return "crops";
  if (/signpost|notice board|\bsigns?\b/.test(p))                           return "signs";
  if (/accessory|accessories|laundry/.test(p))                              return "props";
  if (/school of fish/.test(p))                                             return "livestock";
  if (/smithing|fishing|mining icons|village anim/.test(p))                 return "props";
  if (/growable tree|fruit tree|\btrees? \d|gentle trees|forest, tree/.test(p)) return "trees";
  if (/trees? \(/.test(p))                                                  return "trees"; // autumn-trees-bare, winter-trees-snowy, etc.
  if (/forest wang tiles/.test(p))                                          return "terrain";
  // Ground transitions: bonus grass-to-dirt, cobblestone-to-dirt, plank-floor-to-dirt.
  if (/grass and dirt|cobblestone to dirt|plank floor to dirt/.test(p))     return "terrain";
  // Gentle forest sheets + resize variants.
  if (/gentle forest|gentle \d|gentle animations/.test(p))                  return "terrain";
  // "summer forest.png" / "winter forest (clean).png" — the primary base sheet.
  if (/(summer|spring|autumn|winter|gentle) forest( \(.+\))?\./.test(p))    return "terrain";
  // Base plains grids: "summer 16x16.png", "autumn 48x32.png".
  if (/(summer|spring|autumn|winter)( \(.+\))? \d+x\d+/.test(p))            return "terrain";
  return "uncategorised";
}

// ---------------------------------------------------------------------------
// Slugify: dashed-lowercase, strip punctuation, collapse dashes.
// ---------------------------------------------------------------------------

function slugify(s: string): string {
  return s
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");
}

// ---------------------------------------------------------------------------
// TSX parsing (reused from old tool, slightly condensed)
// ---------------------------------------------------------------------------

interface Animation { headTileId: number; frames: Array<{ tileId: number; duration: number }>; }

interface ParsedTsx {
  name:        string;
  tilewidth:   number;
  tileheight:  number;
  columns:     number;
  tilecount:   number;
  imageWidth:  number;
  imageHeight: number;
  animations:  Animation[];
  /** Raw `<tile id="...">…</tile>` blocks that aren't pure animation blocks — we re-emit them verbatim inside our published TSX so per-tile properties survive. */
  tileBlocks:  string;
}

function attr(src: string, key: string): string | undefined {
  return src.match(new RegExp(`\\b${key}="([^"]*)"`))?.[1];
}

function parseSourceTsx(tsxAbs: string): ParsedTsx | null {
  if (!existsSync(tsxAbs)) return null;
  const xml = readFileSync(tsxAbs, "utf8");
  const head = xml.match(/<tileset\b([^>]*)>/);
  const img  = xml.match(/<image\b([^>]*?)\/>/);
  if (!head || !img) return null;
  const animations: Animation[] = [];
  const tileRe = /<tile\b([^>]*)>([\s\S]*?)<\/tile>/g;
  let m: RegExpExecArray | null;
  let tileBlocks = "";
  while ((m = tileRe.exec(xml)) !== null) {
    const headId = +(attr(m[1], "id") ?? NaN);
    if (Number.isNaN(headId)) continue;
    const animMatch = m[2].match(/<animation>([\s\S]*?)<\/animation>/);
    if (animMatch) {
      const frames: Animation["frames"] = [];
      const frameRe = /<frame\b([^/]*)\/>/g;
      let fm: RegExpExecArray | null;
      while ((fm = frameRe.exec(animMatch[1])) !== null) {
        const tid = +(attr(fm[1], "tileid") ?? NaN);
        const dur = +(attr(fm[1], "duration") ?? NaN);
        if (!Number.isNaN(tid) && !Number.isNaN(dur)) frames.push({ tileId: tid, duration: dur });
      }
      if (frames.length > 0) animations.push({ headTileId: headId, frames });
    }
    // Always preserve the raw <tile>…</tile> block (properties + animations) so
    // published TSX keeps per-tile metadata.
    tileBlocks += `  ${m[0]}\n`;
  }
  return {
    name:        attr(head[1], "name") ?? basename(tsxAbs, ".tsx"),
    tilewidth:   +(attr(head[1], "tilewidth")  ?? NaN),
    tileheight:  +(attr(head[1], "tileheight") ?? NaN),
    columns:     +(attr(head[1], "columns")    ?? NaN),
    tilecount:   +(attr(head[1], "tilecount")  ?? NaN),
    imageWidth:  +(attr(img[1],  "width")      ?? NaN),
    imageHeight: +(attr(img[1],  "height")     ?? NaN),
    animations,
    tileBlocks,
  };
}

// ---------------------------------------------------------------------------
// Tile-size derivation
// ---------------------------------------------------------------------------

function parseTileSizeFromName(fileName: string): [number, number] | null {
  const m = fileName.match(/(\d+)x(\d+)/);
  if (!m) return null;
  return [+m[1], +m[2]];
}

async function pngDims(absPath: string): Promise<{ width: number; height: number }> {
  const meta = await sharp(absPath).metadata();
  if (!meta.width || !meta.height) throw new Error(`${absPath}: missing width/height`);
  return { width: meta.width, height: meta.height };
}

// ---------------------------------------------------------------------------
// Alpha scan for empty tiles (reused)
// ---------------------------------------------------------------------------

async function scanEmptyTiles(params: {
  imageAbs: string; tilewidth: number; tileheight: number; columns: number; tilecount: number;
}): Promise<number[]> {
  const { imageAbs, tilewidth: tw, tileheight: th, columns, tilecount } = params;
  const img = sharp(imageAbs).ensureAlpha();
  const { data, info } = await img.raw().toBuffer({ resolveWithObject: true });
  if (info.channels !== 4) throw new Error(`${imageAbs}: expected 4 channels after ensureAlpha`);
  const { width: w, height: h } = info;
  const empties: number[] = [];
  for (let i = 0; i < tilecount; i++) {
    const col = i % columns;
    const row = Math.floor(i / columns);
    const sx = col * tw;
    const sy = row * th;
    if (sx + tw > w || sy + th > h) continue;
    let allTransparent = true;
    for (let y = 0; y < th && allTransparent; y++) {
      const rowStart = (sy + y) * w * 4 + sx * 4;
      for (let x = 0; x < tw; x++) {
        if (data[rowStart + x * 4 + 3] >= 4) { allTransparent = false; break; }
      }
    }
    if (allTransparent) empties.push(i);
  }
  return empties;
}

// ---------------------------------------------------------------------------
// TSX emission
// ---------------------------------------------------------------------------

function emitTsx(params: {
  name: string; tilewidth: number; tileheight: number; columns: number; tilecount: number;
  imageSrc: string; imageWidth: number; imageHeight: number; tileBlocks: string;
}): string {
  const { name, tilewidth, tileheight, columns, tilecount, imageSrc, imageWidth, imageHeight, tileBlocks } = params;
  const trailingBlocks = tileBlocks.trim().length > 0 ? `\n${tileBlocks.trimEnd()}\n` : "";
  return `<?xml version="1.0" encoding="UTF-8"?>
<tileset version="1.10" tiledversion="1.11.0" name="${escapeXml(name)}" tilewidth="${tilewidth}" tileheight="${tileheight}" tilecount="${tilecount}" columns="${columns}">
 <image source="${escapeXml(imageSrc)}" width="${imageWidth}" height="${imageHeight}"/>${trailingBlocks}</tileset>
`;
}

function escapeXml(s: string): string {
  return s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");
}

// ---------------------------------------------------------------------------
// Walk pack for candidate PNGs
// ---------------------------------------------------------------------------

interface Candidate {
  pack:       string;           // pack dir name
  packConfig: PackConfig;
  pngAbs:     string;           // absolute path to source PNG
  pngRel:     string;           // path relative to pack dir (display)
  tsxAbs:     string | null;    // absolute path to sibling TSX in `sample map/TSX files/`, or null
}

function walkPack(packDir: string, packName: string, cfg: PackConfig, out: Candidate[]): void {
  const tsxMap = new Map<string, string>();
  const tsxDir = resolve(packDir, "sample map", "TSX files");
  if (existsSync(tsxDir) && statSync(tsxDir).isDirectory()) {
    for (const f of readdirSync(tsxDir)) {
      if (f.endsWith(".tsx")) tsxMap.set(basename(f, ".tsx"), resolve(tsxDir, f));
    }
  }
  const walk = (dir: string): void => {
    for (const entry of readdirSync(dir)) {
      const full = resolve(dir, entry);
      const rel = relative(packDir, full);
      if (SKIP_SUBDIR_RE.test(rel) || SKIP_SUBDIR_RE.test(rel + "/")) continue;
      const s = statSync(full);
      if (s.isDirectory()) {
        walk(full);
      } else if (s.isFile() && entry.toLowerCase().endsWith(".png")) {
        if (isReferencePng(entry)) continue;
        const stem = basename(entry, ".png");
        out.push({
          pack:       packName,
          packConfig: cfg,
          pngAbs:     full,
          pngRel:     rel,
          tsxAbs:     tsxMap.get(stem) ?? null,
        });
      }
    }
  };
  walk(packDir);
}

// ---------------------------------------------------------------------------
// Main ingest pipeline
// ---------------------------------------------------------------------------

interface PublishedTileset {
  file:        string;        // `<cat>/<slug>.tsx`
  slug:        string;
  name:        string;
  tilewidth:   number;
  tileheight:  number;
  columns:     number;
  tilecount:   number;
  imageUrl:    string;        // `/assets/tilesets/<cat>/<slug>.png`
  imageWidth:  number;
  imageHeight: number;
  category:    string;
  seasonal:    string | null;
  hidden:      boolean;
  animations:  Animation[];
  pngAbs:      string;        // where to scan for empties (published target)
}

async function processCandidate(c: Candidate): Promise<PublishedTileset | null> {
  const packCat  = c.packConfig.slug;
  const stem     = basename(c.pngAbs, ".png");
  const stemSlug = slugify(stem);
  // Slug must be globally unique (DB constraint). Prefix with pack category so
  // "bonus-shadows" in summer-forest vs autumn-forest don't collide.
  const slug     = `${packCat}-${stemSlug}`;
  const fileCat  = categorize(c.pngRel + " " + stem, packCat, !!c.packConfig.hidden);

  // Tile-size derivation
  let tw: number, th: number;
  let columns: number, tilecount: number;
  let name: string  = stem;
  let animations: Animation[] = [];
  let tileBlocks   = "";

  const srcTsx = c.tsxAbs ? parseSourceTsx(c.tsxAbs) : null;
  if (srcTsx
      && Number.isFinite(srcTsx.tilewidth)
      && Number.isFinite(srcTsx.tileheight)
      && Number.isFinite(srcTsx.columns)
      && Number.isFinite(srcTsx.tilecount)) {
    tw         = srcTsx.tilewidth;
    th         = srcTsx.tileheight;
    columns    = srcTsx.columns;
    tilecount  = srcTsx.tilecount;
    name       = srcTsx.name;
    animations = srcTsx.animations;
    tileBlocks = srcTsx.tileBlocks;
  } else {
    const fromName = parseTileSizeFromName(stem);
    const [dw, dh] = fromName
      ?? c.packConfig.defaultTileSize
      ?? [16, 16];
    tw = dw;
    th = dh;
  }

  // Read actual PNG dims
  const { width: imgW, height: imgH } = await pngDims(c.pngAbs);

  // If we didn't get columns/tilecount from TSX, compute from PNG dims.
  if (!Number.isFinite(columns!) || !columns! || !Number.isFinite(tilecount!) || !tilecount!) {
    columns   = Math.floor(imgW / tw);
    const rows = Math.floor(imgH / th);
    tilecount = columns * rows;
    if (tilecount <= 0) {
      console.warn(`  [skip] ${c.pack}/${c.pngRel}: PNG ${imgW}x${imgH} too small for ${tw}x${th} tiles`);
      return null;
    }
  }

  // Canonical destinations — file names use the un-prefixed stem slug inside
  // the category subdir (the dir is the namespace). DB `slug` column uses the
  // prefixed form for global uniqueness.
  const file     = `${packCat}/${stemSlug}.tsx`;
  const imageUrl = `/assets/tilesets/${packCat}/${stemSlug}.png`;
  const pngDest  = resolve(PUBLIC_PNGS_DIR, packCat, `${stemSlug}.png`);
  const tsxDest  = resolve(PUBLIC_MAPS_DIR, packCat, `${stemSlug}.tsx`);

  if (!DRY) {
    mkdirSync(dirname(pngDest), { recursive: true });
    mkdirSync(dirname(tsxDest), { recursive: true });
    copyFileSync(c.pngAbs, pngDest);
    const tsxXml = emitTsx({
      name, tilewidth: tw, tileheight: th, columns, tilecount,
      imageSrc: `../../assets/tilesets/${packCat}/${stemSlug}.png`,
      imageWidth: imgW, imageHeight: imgH, tileBlocks,
    });
    // Write atomically via tmp rename to avoid partial reads during dev.
    const tmp = tsxDest + ".tmp";
    require("node:fs").writeFileSync(tmp, tsxXml, "utf8");
    require("node:fs").renameSync(tmp, tsxDest);
  }

  return {
    file, slug, name,
    tilewidth: tw, tileheight: th, columns, tilecount,
    imageUrl, imageWidth: imgW, imageHeight: imgH,
    category: fileCat,
    seasonal: c.packConfig.seasonal ?? null,
    hidden: !!c.packConfig.hidden,
    animations,
    pngAbs: pngDest,
  };
}

// ---------------------------------------------------------------------------
// DB upsert
// ---------------------------------------------------------------------------

async function upsertOne(sql: postgres.Sql, t: PublishedTileset): Promise<number> {
  // UPSERT tileset row (we've cascade-truncated already if --reset).
  await sql`
    INSERT INTO tilesets (
      file, slug, name,
      tilewidth, tileheight, columns, tilecount,
      image_url, image_width, image_height,
      default_category_id, default_layer_id, default_blocks,
      tags, seasonal, hidden, auto_hide_labels, notes, updated_at
    ) VALUES (
      ${t.file}, ${t.slug}, ${t.name},
      ${t.tilewidth}, ${t.tileheight}, ${t.columns}, ${t.tilecount},
      ${t.imageUrl}, ${t.imageWidth}, ${t.imageHeight},
      ${t.category}, ${null}, ${false},
      ${sql.json([])}, ${t.seasonal}, ${t.hidden}, ${false}, ${null}, NOW()
    )
    ON CONFLICT (file) DO UPDATE SET
      slug                = EXCLUDED.slug,
      name                = EXCLUDED.name,
      tilewidth           = EXCLUDED.tilewidth,
      tileheight          = EXCLUDED.tileheight,
      columns             = EXCLUDED.columns,
      tilecount           = EXCLUDED.tilecount,
      image_url           = EXCLUDED.image_url,
      image_width         = EXCLUDED.image_width,
      image_height        = EXCLUDED.image_height,
      default_category_id = EXCLUDED.default_category_id,
      seasonal            = EXCLUDED.seasonal,
      hidden              = EXCLUDED.hidden,
      updated_at          = NOW()
  `;

  await sql`DELETE FROM tile_animations WHERE tileset_file = ${t.file}`;
  for (const a of t.animations) {
    for (let idx = 0; idx < a.frames.length; idx++) {
      const f = a.frames[idx];
      await sql`
        INSERT INTO tile_animations (tileset_file, head_tile_id, frame_idx, frame_tile_id, duration_ms)
        VALUES (${t.file}, ${a.headTileId}, ${idx}, ${f.tileId}, ${f.duration})
      `;
    }
  }

  // Alpha scan (run on published PNG so we're definitely reading what the
  // client will fetch).
  let emptyCount = 0;
  try {
    const empties = await scanEmptyTiles({
      imageAbs: t.pngAbs, tilewidth: t.tilewidth, tileheight: t.tileheight,
      columns: t.columns, tilecount: t.tilecount,
    });
    await sql`DELETE FROM tile_empty_flags WHERE tileset_file = ${t.file}`;
    if (empties.length > 0) {
      const rows = empties.map(tileId => ({ tileset_file: t.file, tile_id: tileId }));
      await sql`INSERT INTO tile_empty_flags ${sql(rows, "tileset_file", "tile_id")}`;
      emptyCount = empties.length;
    }
  } catch (err) {
    console.warn(`  [alpha] ${t.file}: ${(err as Error).message}`);
  }
  return emptyCount;
}

// ---------------------------------------------------------------------------
// Main
// ---------------------------------------------------------------------------

async function main() {
  console.log(`[ingest-mana-seed] DB: ${DATABASE_URL.replace(/:[^:@]+@/, ":***@")}`);
  console.log(`[ingest-mana-seed] RESET=${RESET} DRY=${DRY}`);

  // Collect candidates from every enabled pack.
  const selected = Object.entries(PACKS).filter(([name]) =>
    PACK_ARGS.length === 0 || PACK_ARGS.includes(name)
  );

  const candidates: Candidate[] = [];
  for (const [packName, cfg] of selected) {
    const dir = resolve(ASSETS_DIR, packName);
    if (!existsSync(dir)) {
      console.warn(`  [missing] ${packName}`);
      continue;
    }
    walkPack(dir, packName, cfg, candidates);
  }

  console.log(`[ingest-mana-seed] ${candidates.length} PNG candidate(s) from ${selected.length} pack(s)`);

  // Connect + (optionally) reset.
  const sql = postgres(DATABASE_URL);
  try {
    if (RESET && !DRY) {
      console.log(`[ingest-mana-seed] TRUNCATE tilesets CASCADE …`);
      await sql`TRUNCATE tilesets CASCADE`;
    }

    let published = 0;
    let totalEmpty = 0;
    const byCat = new Map<string, number>();
    const uncatSamples: string[] = [];
    for (const c of candidates) {
      const t = await processCandidate(c);
      if (!t) continue;
      published++;
      byCat.set(t.category, (byCat.get(t.category) ?? 0) + 1);
      if (t.category === "uncategorised" && uncatSamples.length < 40) uncatSamples.push(t.file);
      if (!DRY) {
        totalEmpty += await upsertOne(sql, t);
      }
    }

    console.log(`[ingest-mana-seed] ${published} tileset(s) published${DRY ? " (dry-run, not written)" : ""}`);
    console.log(`[ingest-mana-seed] category breakdown:`);
    const rows = [...byCat.entries()].sort((a, b) => b[1] - a[1]);
    for (const [cat, n] of rows) console.log(`  ${cat.padEnd(14)} ${n}`);
    if (uncatSamples.length > 0) {
      console.log(`[ingest-mana-seed] uncategorised samples (first ${uncatSamples.length}):`);
      for (const f of uncatSamples) console.log(`  ${f}`);
    }
    if (!DRY) console.log(`[ingest-mana-seed] ${totalEmpty} empty tile flags across all tilesets`);
  } finally {
    await sql.end();
  }
}

main().catch(err => {
  console.error("[ingest-mana-seed] FAILED:", err);
  process.exit(1);
});
