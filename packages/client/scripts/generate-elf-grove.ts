/**
 * Generate the Elf Grove zone (256x256 tiles).
 * Run: bun run scripts/generate-elf-grove.ts
 *
 * Theme: Ancient forest with towering trees, mushroom circles, crystal pools,
 * and a central elven village on a hilltop. Levels 1-5.
 *
 * Tile IDs (1-indexed for Tiled):
 * 1:grass 2:dirt 3:stone 4:sand 5:water 6:deep_water
 * 7:forest_floor 8:snow 9:swamp 10:mountain 11:path 12:grass_dark
 */

import { writeFileSync } from "fs";
import { resolve } from "path";

const MAP_W = 256;
const MAP_H = 256;
const CX = MAP_W / 2;
const CZ = MAP_H / 2;

const ground = new Array(MAP_W * MAP_H).fill(7); // forest_floor default
const collision = new Array(MAP_W * MAP_H).fill(0);

function set(x: number, z: number, tileId: number, blocked = false) {
  if (x < 0 || x >= MAP_W || z < 0 || z >= MAP_H) return;
  ground[z * MAP_W + x] = tileId;
  if (blocked) collision[z * MAP_W + x] = 1;
}

function dist(x1: number, z1: number, x2: number, z2: number): number {
  return Math.sqrt((x1 - x2) ** 2 + (z1 - z2) ** 2);
}

let seed = 42;
function rand(): number {
  seed = (seed * 1103515245 + 12345) & 0x7fffffff;
  return seed / 0x7fffffff;
}

// --- Terrain features ---

// Elven village at center — stone paths and clearings
for (let x = CX - 20; x <= CX + 20; x++) {
  for (let z = CZ - 20; z <= CZ + 20; z++) {
    const d = dist(x, z, CX, CZ);
    if (d < 12) set(x, z, 1); // Grass clearing
    else if (d < 15) set(x, z, 11); // Stone path ring
    else if (d < 20) set(x, z, 1); // Outer grass
  }
}
// Cross paths from village
for (let i = -40; i <= 40; i++) {
  for (let w = -1; w <= 1; w++) {
    set(CX + i, CZ + w, 11); // East-west path
    set(CX + w, CZ + i, 11); // North-south path
  }
}

// Crystal pools (3 locations)
const pools = [
  { x: CX - 50, z: CZ - 40 },
  { x: CX + 60, z: CZ + 30 },
  { x: CX - 30, z: CZ + 55 },
];
for (const pool of pools) {
  for (let dx = -6; dx <= 6; dx++) {
    for (let dz = -6; dz <= 6; dz++) {
      const d = dist(0, 0, dx, dz);
      if (d < 3) set(pool.x + dx, pool.z + dz, 6); // Deep water center
      else if (d < 5) set(pool.x + dx, pool.z + dz, 5); // Water edge
      else if (d < 7) set(pool.x + dx, pool.z + dz, 1); // Grass shore
    }
  }
}

// Dense forest patches (unwalkable) scattered around
const forestCenters = [];
for (let i = 0; i < 25; i++) {
  const fx = 20 + Math.floor(rand() * (MAP_W - 40));
  const fz = 20 + Math.floor(rand() * (MAP_H - 40));
  if (dist(fx, fz, CX, CZ) < 25) continue; // Not in village
  forestCenters.push({ x: fx, z: fz, r: 4 + Math.floor(rand() * 6) });
}
for (const fc of forestCenters) {
  for (let dx = -fc.r; dx <= fc.r; dx++) {
    for (let dz = -fc.r; dz <= fc.r; dz++) {
      if (dist(0, 0, dx, dz) < fc.r) {
        set(fc.x + dx, fc.z + dz, 12, true); // grass_dark + blocked (dense forest)
      }
    }
  }
}

// Mushroom circles (clearings in forest)
const mushrooms = [
  { x: CX + 40, z: CZ - 50, r: 8 },
  { x: CX - 60, z: CZ + 20, r: 6 },
  { x: CX + 30, z: CZ + 60, r: 7 },
  { x: CX - 45, z: CZ - 55, r: 5 },
];
for (const m of mushrooms) {
  for (let dx = -m.r; dx <= m.r; dx++) {
    for (let dz = -m.r; dz <= m.r; dz++) {
      if (dist(0, 0, dx, dz) < m.r) set(m.x + dx, m.z + dz, 1); // Grass clearing
    }
  }
}

// Mountain ridges along south edge
for (let x = 0; x < MAP_W; x++) {
  for (let z = MAP_H - 15; z < MAP_H; z++) {
    const edgeDist = MAP_H - z;
    if (edgeDist < 5) set(x, z, 10, true); // Mountain
    else if (edgeDist < 10 && rand() > 0.4) set(x, z, 10, true);
    else if (edgeDist < 15 && rand() > 0.7) set(x, z, 3); // Stone approach
  }
}

// Swamp in northeast corner
for (let x = MAP_W - 50; x < MAP_W - 5; x++) {
  for (let z = 5; z < 50; z++) {
    const d = dist(x, z, MAP_W - 25, 25);
    if (d < 15) set(x, z, 9); // Swamp
    else if (d < 20 && rand() > 0.5) set(x, z, 9);
  }
}

// --- Objects layer ---
const objects: any[] = [];

// Player spawn (center of village)
objects.push({
  id: 1, name: "player_spawn", type: "player_spawn",
  x: CX * 64, y: CZ * 32, width: 64, height: 32,
  properties: [{ name: "x", type: "int", value: CX }, { name: "z", type: "int", value: CZ }],
});

// Safe zone — village area
objects.push({
  id: 2, name: "Eldergrove Village", type: "safe_zone",
  x: (CX - 15) * 64, y: (CZ - 15) * 32, width: 30 * 64, height: 30 * 32,
  properties: [
    { name: "x", type: "int", value: CX },
    { name: "z", type: "int", value: CZ },
    { name: "radius", type: "int", value: 15 },
  ],
});

// NPC spawn points
const spawns = [
  { id: "sp-elf-rabbit-1", x: CX - 40, z: CZ - 30, npcIds: ["rabbit"], maxCount: 3, distance: 8, frequency: 8 },
  { id: "sp-elf-rabbit-2", x: CX + 35, z: CZ + 45, npcIds: ["rabbit"], maxCount: 3, distance: 8, frequency: 8 },
  { id: "sp-elf-goblin-1", x: CX + 50, z: CZ - 60, npcIds: ["goblin-grunt"], maxCount: 3, distance: 10, frequency: 6 },
  { id: "sp-elf-goblin-2", x: CX - 65, z: CZ + 40, npcIds: ["goblin-grunt", "goblin-shaman"], maxCount: 4, distance: 10, frequency: 6 },
  { id: "sp-elf-imp-1", x: CX - 55, z: CZ - 60, npcIds: ["imp"], maxCount: 3, distance: 8, frequency: 7 },
];

let objId = 10;
for (const sp of spawns) {
  objects.push({
    id: objId++, name: sp.id, type: "spawn_point",
    x: sp.x * 64, y: sp.z * 32, width: 64, height: 32,
    properties: [
      { name: "x", type: "int", value: sp.x },
      { name: "z", type: "int", value: sp.z },
      { name: "npcIds", type: "string", value: sp.npcIds.join(",") },
      { name: "maxCount", type: "int", value: sp.maxCount },
      { name: "distance", type: "int", value: sp.distance },
      { name: "frequency", type: "int", value: sp.frequency },
    ],
  });
}

// Discovery zones
const zones = [
  { name: "Mushroom Circle", x: CX + 40, z: CZ - 50, r: 10 },
  { name: "Crystal Pool", x: CX - 50, z: CZ - 40, r: 8 },
  { name: "Goblin Camp", x: CX + 50, z: CZ - 60, r: 12 },
  { name: "Dark Hollow", x: CX - 65, z: CZ + 40, r: 12 },
  { name: "Imp Nest", x: CX - 55, z: CZ - 60, r: 10 },
];
for (const zone of zones) {
  objects.push({
    id: objId++, name: zone.name, type: "zone",
    x: (zone.x - zone.r) * 64, y: (zone.z - zone.r) * 32,
    width: zone.r * 2 * 64, height: zone.r * 2 * 32,
    properties: [
      { name: "x", type: "int", value: zone.x },
      { name: "z", type: "int", value: zone.z },
      { name: "radius", type: "int", value: zone.r },
    ],
  });
}

// Zone exit — south edge leads to crossroads (future)
objects.push({
  id: objId++, name: "exit-to-crossroads", type: "zone_exit",
  x: (CX - 3) * 64, y: (MAP_H - 18) * 32, width: 6 * 64, height: 3 * 32,
  properties: [
    { name: "targetZone", type: "string", value: "crossroads" },
    { name: "spawnX", type: "int", value: 128 },
    { name: "spawnZ", type: "int", value: 20 },
  ],
});

// --- Build Tiled JSON ---
const tilesetPath = "../tilesets/terrain.tsj";

const map = {
  compressionlevel: -1,
  height: MAP_H,
  width: MAP_W,
  infinite: false,
  orientation: "isometric",
  renderorder: "right-down",
  tilewidth: 64,
  tileheight: 32,
  tiledversion: "1.11.0",
  type: "map",
  version: "1.10",
  nextlayerid: 4,
  nextobjectid: objId + 1,
  tilesets: [{ firstgid: 1, source: tilesetPath }],
  layers: [
    {
      id: 1, name: "ground", type: "tilelayer",
      x: 0, y: 0, width: MAP_W, height: MAP_H,
      data: ground, visible: true, opacity: 1,
    },
    {
      id: 2, name: "collision", type: "tilelayer",
      x: 0, y: 0, width: MAP_W, height: MAP_H,
      data: collision, visible: false, opacity: 1,
    },
    {
      id: 3, name: "objects", type: "objectgroup",
      objects, visible: true, opacity: 1,
      x: 0, y: 0,
    },
  ],
};

const outPath = resolve(import.meta.dir, "../public/maps/elf-grove.json");
writeFileSync(outPath, JSON.stringify(map));
console.log(`Generated Elf Grove zone: ${MAP_W}x${MAP_H} → ${outPath}`);
console.log(`  Spawns: ${spawns.length}, Zones: ${zones.length}, Pools: ${pools.length}`);
