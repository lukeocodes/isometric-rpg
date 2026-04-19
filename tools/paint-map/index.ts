// paint-map CLI
//
// Usage:
//   bun tools/paint-map/index.ts <scene.json> [<output.tmx>]
//
// If output is omitted, derives it as:
//   maps-src/foo.json → packages/client/public/maps/foo.tmx

import { readFileSync, writeFileSync, mkdirSync } from "node:fs";
import { resolve, dirname, basename, join } from "node:path";
import { parseTsx, getWangSet, colorId } from "./tsx.js";
import { makeCornerGrid, fillCorners, resolveWangTiles, findSolidTile } from "./wang.js";
import { paintTreeWallBorder, paintTreeWallCollision } from "./tree-wall.js";
import { renderTmx, type TmxMap, type TmxTilesetRef, type TmxLayer, type TmxObjectGroup } from "./tmx.js";
import { buildServerJson } from "./server-json.js";
import type { SceneSpec } from "./scene.js";

const TREE_WALL_SCALE = 8; // 128/16

function defaultOutputPath(scenePath: string): string {
  const name = basename(scenePath, ".json");
  return resolve(process.cwd(), "packages/client/public/maps", `${name}.tmx`);
}

function coerceType(v: boolean | number | string): { value: boolean | number | string; type: "bool" | "int" | "float" | "string" } {
  if (typeof v === "boolean") return { value: v, type: "bool" };
  if (typeof v === "number") return { value: v, type: Number.isInteger(v) ? "int" : "float" };
  return { value: v, type: "string" };
}

function main(): void {
  const [, , scenePath, outputPathArg] = process.argv;
  if (!scenePath) {
    console.error("usage: bun tools/paint-map/index.ts <scene.json> [<output.tmx>]");
    process.exit(1);
  }

  const scenePathAbs = resolve(scenePath);
  const outputPathAbs = outputPathArg ? resolve(outputPathArg) : defaultOutputPath(scenePathAbs);
  const outputDir = dirname(outputPathAbs);
  const serverJsonPath = outputPathAbs.replace(/\.tmx$/, ".json");

  console.log(`[paint-map] scene:       ${scenePathAbs}`);
  console.log(`[paint-map] output TMX:  ${outputPathAbs}`);
  console.log(`[paint-map] output JSON: ${serverJsonPath}`);

  const spec = JSON.parse(readFileSync(scenePathAbs, "utf-8")) as SceneSpec;

  const tilewidth = spec.tilewidth ?? 16;
  const tileheight = spec.tileheight ?? 16;
  const { w: mapW, h: mapH } = spec.size;

  // Load tilesets (they live next to the output TMX file)
  const tilesetRefs: TmxTilesetRef[] = [];
  const tilesetIndex: Record<string, number> = {};

  const addTileset = (key: "ground" | "wall" | "canopy", source: string): void => {
    const tsxPath = join(outputDir, source);
    const ts = parseTsx(tsxPath);
    tilesetIndex[key] = tilesetRefs.length;
    tilesetRefs.push({ source, tileset: ts });
    console.log(`[paint-map] loaded tileset '${key}' <- ${source} (${ts.tilecount} tiles, ${ts.wangsets.length} wangset(s))`);
  };

  addTileset("ground", spec.tilesets.ground);
  if (spec.walls && spec.tilesets.wall) addTileset("wall", spec.tilesets.wall);
  if (spec.walls && spec.tilesets.canopy) addTileset("canopy", spec.tilesets.canopy);

  const layers: TmxLayer[] = [];

  // Preserved for server-JSON emission at the end
  const groundTs = tilesetRefs[tilesetIndex.ground].tileset;
  const wangset = getWangSet(groundTs, spec.ground.wangset);
  const corners = makeCornerGrid(mapW, mapH);
  let wallCollision: Int32Array | null = null;

  // --- Ground layer (wang-painted) ---
  {
    for (const region of spec.ground.regions) {
      const cId = colorId(wangset, region.fill);
      fillCorners(corners, region.x, region.y, region.w, region.h, cId);
    }

    // Fallback: if a tile is entirely one of the used colours and lookup misses,
    // use the solid tile for that colour.
    const { tileIds, unresolved } = resolveWangTiles(corners, wangset, mapW, mapH);

    if (unresolved.length > 0) {
      console.warn(`[paint-map] ground: ${unresolved.length} unresolved tile(s)`);
      // Try to recover: for each unresolved tile, pick the most-common corner colour
      // and use that colour's solid tile as a fallback.
      for (const u of unresolved) {
        const counts = new Map<number, number>();
        for (const c of u.corners) counts.set(c, (counts.get(c) ?? 0) + 1);
        let best = 0;
        let bestN = 0;
        for (const [c, n] of counts) if (n > bestN && c !== 0) { best = c; bestN = n; }
        const solid = findSolidTile(wangset, best);
        if (solid !== undefined) {
          tileIds[u.y * mapW + u.x] = solid;
        }
      }
      // Show a sample of what couldn't be resolved, helpful for debugging wangset coverage
      const sample = unresolved.slice(0, 5);
      for (const u of sample) {
        console.warn(`  tile (${u.x},${u.y}) corners [NW=${u.corners[0]} NE=${u.corners[1]} SE=${u.corners[2]} SW=${u.corners[3]}]`);
      }
    }

    layers.push({
      name: "ground",
      width: mapW,
      height: mapH,
      tileIds,
      tilesetIndex: tilesetIndex.ground,
    });
  }

  // --- Wall collision layer (invisible, 16x16 grid, solid) ---
  //     Covers every small-tile cell under the tree-wall's 128x128 visual tiles
  //     so the player can't walk through trees. Uses the ground tileset with
  //     an arbitrary non-zero tileid; layer is hidden from rendering.
  if (spec.walls) {
    wallCollision = paintTreeWallCollision(
      spec.walls.rect,
      TREE_WALL_SCALE,
      mapW,
      mapH,
      /* tileid */ 0,
    );
    layers.push({
      name: "wall",
      width: mapW,
      height: mapH,
      tileIds: wallCollision,
      tilesetIndex: tilesetIndex.ground,
      visible: false,
      properties: {
        solid: { value: true, type: "bool" },
      },
    });
  }

  // --- Wall visual layer (128x128 tree tiles on 16x16 grid, not solid) ---
  if (spec.walls && tilesetIndex.wall !== undefined) {
    const wallIds = paintTreeWallBorder(spec.walls.rect, TREE_WALL_SCALE, mapW, mapH);
    layers.push({
      name: "wall-visual",
      width: mapW,
      height: mapH,
      tileIds: wallIds,
      tilesetIndex: tilesetIndex.wall,
      properties: {
        zindex: { value: 1, type: "int" },
      },
    });
  }

  // --- Canopy layer (same placement as wall, rendered above player) ---
  if (spec.walls && tilesetIndex.canopy !== undefined) {
    const canopyIds = paintTreeWallBorder(spec.walls.rect, TREE_WALL_SCALE, mapW, mapH);
    layers.push({
      name: "canopy",
      width: mapW,
      height: mapH,
      tileIds: canopyIds,
      tilesetIndex: tilesetIndex.canopy,
      properties: {
        zindex: { value: 10, type: "int" },
      },
    });
  }

  // --- Object groups ---
  const objectGroups: TmxObjectGroup[] = [];
  if (spec.objects) {
    for (const [groupName, objects] of Object.entries(spec.objects)) {
      const group: TmxObjectGroup = { name: groupName, objects: [] };
      for (const o of objects) {
        const ax = o.anchor?.x ?? 0.5;
        const ay = o.anchor?.y ?? 0.5;
        const px = (o.tile.x + ax) * tilewidth;
        const py = (o.tile.y + ay) * tileheight;
        const properties: TmxObjectGroup["objects"][number]["properties"] = {};
        if (o.properties) {
          for (const [k, v] of Object.entries(o.properties)) {
            properties[k] = coerceType(v);
          }
        }
        group.objects.push({
          type: o.type,
          name: o.name,
          x: px,
          y: py,
          properties: Object.keys(properties).length > 0 ? properties : undefined,
        });
      }
      objectGroups.push(group);
    }
  }

  // --- Assemble & write ---
  const map: TmxMap = {
    width: mapW,
    height: mapH,
    tilewidth,
    tileheight,
    tilesets: tilesetRefs,
    layers,
    objectGroups,
  };

  mkdirSync(outputDir, { recursive: true });
  writeFileSync(outputPathAbs, renderTmx(map));
  console.log(
    `[paint-map] wrote ${basename(outputPathAbs)} (${mapW}x${mapH}, ${layers.length} layer(s), ${objectGroups.length} object group(s))`,
  );

  // --- Server JSON ---
  //     Emitted alongside the TMX. Contains map bounds + collision layer + player
  //     spawn object, sufficient for server-side pathfinding and spawn logic.
  //     Water (wangset colour name containing "water") is auto-marked as collision.
  const playerSpawnObj = spec.objects?.spawns?.find((o) => o.type === "player-spawn");
  const playerSpawn = playerSpawnObj
    ? { x: playerSpawnObj.tile.x, y: playerSpawnObj.tile.y }
    : { x: Math.floor(mapW / 2), y: Math.floor(mapH / 2) };

  const serverJson = buildServerJson({
    width: mapW,
    height: mapH,
    tilewidth,
    tileheight,
    corners,
    wangset,
    wallCollision,
    playerSpawn,
  });
  writeFileSync(serverJsonPath, JSON.stringify(serverJson, null, 2) + "\n");
  console.log(`[paint-map] wrote ${basename(serverJsonPath)} (server map, player spawn at ${playerSpawn.x},${playerSpawn.y})`);
}

main();
