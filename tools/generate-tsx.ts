#!/usr/bin/env bun
/**
 * Generate TSX files for every PNG in packages/client/public/maps/<category>/images/
 * using tile dimensions parsed from the filename (e.g. "16x32", "32x32").
 *
 * Animations can be added per-pack in the ANIM_SPECS table below.
 *
 * Usage:  bun tools/generate-tsx.ts
 */
import fs from "node:fs";
import path from "node:path";
import { execSync } from "node:child_process";

const ROOT = path.resolve(import.meta.dir, "..");
const MAPS = path.join(ROOT, "packages/client/public/maps");

// Extract W×H from filename (e.g. "cozy furnishings 16x32.png" => {tw:16,th:32}).
function parseCellSize(name: string): { tw: number; th: number } | null {
  const m = name.match(/(\d+)x(\d+)(?!\d)/);
  if (!m) return null;
  return { tw: +m[1], th: +m[2] };
}

function pixelSize(file: string): { w: number; h: number } {
  const out = execSync(`sips -g pixelWidth -g pixelHeight "${file}"`).toString();
  const w = +(out.match(/pixelWidth:\s*(\d+)/)?.[1] ?? 0);
  const h = +(out.match(/pixelHeight:\s*(\d+)/)?.[1] ?? 0);
  return { w, h };
}

interface AnimSpec {
  /** First frame tileId in each animation row. */
  stride:    number;
  /** Frames per animation (in one row). */
  frames:    number;
  /** Number of distinct animation rows in the sheet. */
  count:     number;
  /** Starting tileId for the first animation (default 0). */
  startId?:  number;
  /** Duration per frame in ms. */
  duration:  number;
}

/** Map TSX filename → animation spec. */
const ANIM_SPECS: Record<string, AnimSpec> = {
  // Animated candles: 5 cols (5-frame anim) × N rows per sheet
  "lights/animated candles anim 16x16 v01.tsx": { stride: 5, frames: 5, count: 12, duration: 150 },
  "lights/animated candles anim 16x32 v01.tsx": { stride: 5, frames: 5, count: 6,  duration: 150 },
  "lights/animated candles anim 16x48 v01.tsx": { stride: 5, frames: 5, count: 4,  duration: 150 },

  // Cozy furnishings animated (fireplace/stove/cooking-pot): 5 frames × 8 rows = 40 tiles
  "furniture/cozy furnishings anim 32x32.tsx": { stride: 5, frames: 5, count: 8,  duration: 200 },
  // Thatch-home animated cooking pot: 5 frames × 1 row
  "furniture/animated cooking pot 32x32.tsx":  { stride: 5, frames: 5, count: 1,  duration: 200 },

  // Village accessories anim (hanging-sign sway): 5 frames × 1 row = 5 tiles
  "signs/village anim 16x48.tsx": { stride: 5, frames: 5, count: 1, duration: 200 },

  // Weather: 8-frame animations stacked vertically, each frame = 2 tiles wide.
  // The picker only needs one "first-frame" entry to show the animation.
  // For rain/snow the sheets are 2 cols × 8 rows = 16 tiles, but each tile cell
  // has dimensions 32×128 (meaning one tile IS the whole 32×128 frame). So 8 rows
  // of 2 cols are actually 2 columns of 8 frames. But ANIM_SPECS for a 32×128
  // grid would fire every 32×128 cell frame index — for rain this is tiles 0-7
  // (col 0 column as 8 frames is a stretch; the sheet is really 32×128 per tile).
  // Skip animation for now — registered as static tiles.
};

function generateAnimationBlock(spec: AnimSpec): string {
  const out: string[] = [];
  const start = spec.startId ?? 0;
  for (let i = 0; i < spec.count; i++) {
    const first = start + i * spec.stride;
    const frames: string[] = [];
    for (let f = 0; f < spec.frames; f++) {
      frames.push(`   <frame tileid="${first + f}" duration="${spec.duration}"/>`);
    }
    out.push(` <tile id="${first}">\n  <animation>\n${frames.join("\n")}\n  </animation>\n </tile>`);
  }
  return out.join("\n");
}

function generateTsx(
  tsxPath: string,          // absolute path
  tsxRelPath: string,       // category/name.tsx
  imageFile: string,        // absolute PNG path
  imageRelPath: string,     // images/name.png
): { tw: number; th: number; cols: number; rows: number; name: string } {
  const base = path.basename(imageFile, ".png");
  const size = parseCellSize(base);
  if (!size) throw new Error(`No WxH in filename: ${base}`);
  const { tw, th } = size;
  const { w, h } = pixelSize(imageFile);
  if (w === 0 || h === 0) throw new Error(`Failed to read ${imageFile}`);
  if (w % tw !== 0 || h % th !== 0) {
    throw new Error(`Bad grid: ${base} is ${w}x${h}, cells ${tw}x${th}`);
  }
  const cols = w / tw;
  const rows = h / th;
  const tilecount = cols * rows;

  const name = base;
  const animSpec = ANIM_SPECS[tsxRelPath];
  const animBlock = animSpec ? "\n" + generateAnimationBlock(animSpec) : "";
  const selfClose = animBlock ? "" : "";

  const xml =
`<?xml version="1.0" encoding="UTF-8"?>
<tileset version="1.10" tiledversion="1.10.2" name="${name}" tilewidth="${tw}" tileheight="${th}" tilecount="${tilecount}" columns="${cols}">
 <image source="${imageRelPath}" width="${w}" height="${h}"/>${animBlock}
</tileset>
`;
  fs.writeFileSync(tsxPath, xml);
  return { tw, th, cols, rows, name };
}

function processCategory(category: string): void {
  const imagesDir = path.join(MAPS, category, "images");
  if (!fs.existsSync(imagesDir)) return;
  const files = fs.readdirSync(imagesDir).filter((f) => f.endsWith(".png"));
  console.log(`\n== ${category} (${files.length} png) ==`);
  for (const f of files) {
    const imageAbs   = path.join(imagesDir, f);
    const baseName   = f.replace(/\.png$/, "");
    const tsxAbs     = path.join(MAPS, category, baseName + ".tsx");
    const tsxRel     = `${category}/${baseName}.tsx`;
    const imageRel   = `images/${f}`;
    try {
      const info = generateTsx(tsxAbs, tsxRel, imageAbs, imageRel);
      console.log(`  ${baseName}.tsx  ${info.tw}×${info.th}  grid ${info.cols}×${info.rows} = ${info.cols * info.rows} tiles${ANIM_SPECS[tsxRel] ? "  ⟳" : ""}`);
    } catch (e) {
      console.warn(`  ✗ ${baseName}: ${(e as Error).message}`);
    }
  }
}

const CATEGORIES = ["furniture", "lights", "crops", "signs", "effects", "roofs"];
for (const c of CATEGORIES) processCategory(c);

console.log("\nDone.");
