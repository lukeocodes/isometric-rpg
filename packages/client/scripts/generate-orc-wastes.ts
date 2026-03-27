/**
 * Generate the Orc Wastes zone (256x256 tiles).
 * Run: bun run scripts/generate-orc-wastes.ts
 *
 * Theme: Harsh desert/volcanic wasteland with lava rivers, sandstone mesas,
 * iron mines, and a central orc stronghold. Levels 1-5.
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

const ground = new Array(MAP_W * MAP_H).fill(4); // sand default (desert)
const collision = new Array(MAP_W * MAP_H).fill(0);

function set(x: number, z: number, tileId: number, blocked = false) {
  if (x < 0 || x >= MAP_W || z < 0 || z >= MAP_H) return;
  ground[z * MAP_W + x] = tileId;
  if (blocked) collision[z * MAP_W + x] = 1;
}

function dist(x1: number, z1: number, x2: number, z2: number): number {
  return Math.sqrt((x1 - x2) ** 2 + (z1 - z2) ** 2);
}

let seed = 999;
function rand(): number {
  seed = (seed * 1103515245 + 12345) & 0x7fffffff;
  return seed / 0x7fffffff;
}

// --- Terrain features ---

// Orc stronghold at center — dirt with stone walls
for (let x = CX - 18; x <= CX + 18; x++) {
  for (let z = CZ - 18; z <= CZ + 18; z++) {
    const d = dist(x, z, CX, CZ);
    if (d < 10) set(x, z, 2); // Dirt interior
    else if (d < 12) set(x, z, 3); // Stone walls
    else if (d < 18) set(x, z, 2); // Outer dirt
  }
}
// Cross paths from stronghold
for (let i = -45; i <= 45; i++) {
  for (let w = -1; w <= 1; w++) {
    set(CX + i, CZ + w, 11); // East-west path
    set(CX + w, CZ + i, 11); // North-south path
  }
}

// Lava rivers (deep_water = lava visually in desert context)
// River 1: northwest to southeast diagonal
for (let i = 0; i < 120; i++) {
  const rx = 30 + i;
  const rz = 20 + Math.floor(i * 0.8 + Math.sin(i * 0.1) * 5);
  for (let w = -2; w <= 2; w++) {
    const d = Math.abs(w);
    if (d < 2) set(rx, rz + w, 6, true); // Deep water (lava)
    else set(rx, rz + w, 2); // Scorched dirt
  }
}
// River 2: northeast curve
for (let i = 0; i < 80; i++) {
  const rx = MAP_W - 40 - Math.floor(i * 0.5);
  const rz = 60 + i;
  for (let w = -1; w <= 1; w++) {
    set(rx + w, rz, 6, true);
  }
}

// Sandstone mesas (mountain patches)
const mesas = [
  { x: CX + 55, z: CZ - 50, r: 12 },
  { x: CX - 60, z: CZ - 45, r: 10 },
  { x: CX - 50, z: CZ + 55, r: 14 },
  { x: CX + 45, z: CZ + 65, r: 8 },
];
for (const m of mesas) {
  for (let dx = -m.r; dx <= m.r; dx++) {
    for (let dz = -m.r; dz <= m.r; dz++) {
      const d = dist(0, 0, dx, dz);
      if (d < m.r * 0.6) set(m.x + dx, m.z + dz, 10, true); // Mountain core
      else if (d < m.r * 0.8) set(m.x + dx, m.z + dz, 3); // Stone edge
      else if (d < m.r) set(m.x + dx, m.z + dz, 2); // Dirt approach
    }
  }
}

// Scrub grass patches
for (let i = 0; i < 30; i++) {
  const px = 15 + Math.floor(rand() * (MAP_W - 30));
  const pz = 15 + Math.floor(rand() * (MAP_H - 30));
  if (dist(px, pz, CX, CZ) < 20) continue;
  const r = 3 + Math.floor(rand() * 4);
  for (let dx = -r; dx <= r; dx++) {
    for (let dz = -r; dz <= r; dz++) {
      if (dist(0, 0, dx, dz) < r) set(px + dx, pz + dz, 12); // grass_dark (scrub)
    }
  }
}

// Mountain border on north edge
for (let x = 0; x < MAP_W; x++) {
  for (let z = 0; z < 12; z++) {
    if (z < 4) set(x, z, 10, true);
    else if (z < 8 && rand() > 0.3) set(x, z, 10, true);
    else if (z < 12 && rand() > 0.6) set(x, z, 3);
  }
}

// --- Objects layer ---
const objects: any[] = [];

// Player spawn (center of stronghold)
objects.push({
  id: 1, name: "player_spawn", type: "player_spawn",
  x: CX * 64, y: CZ * 32, width: 64, height: 32,
  properties: [{ name: "x", type: "int", value: CX }, { name: "z", type: "int", value: CZ }],
});

// Safe zone — stronghold
objects.push({
  id: 2, name: "Bloodstone Stronghold", type: "safe_zone",
  x: (CX - 12) * 64, y: (CZ - 12) * 32, width: 24 * 64, height: 24 * 32,
  properties: [
    { name: "x", type: "int", value: CX },
    { name: "z", type: "int", value: CZ },
    { name: "radius", type: "int", value: 12 },
  ],
});

// NPC spawn points
const spawns = [
  { id: "sp-orc-rabbit-1", x: CX + 30, z: CZ - 25, npcIds: ["rabbit"], maxCount: 2, distance: 8, frequency: 8 },
  { id: "sp-orc-skeleton-1", x: CX - 45, z: CZ - 35, npcIds: ["skeleton-warrior", "skeleton-archer"], maxCount: 4, distance: 10, frequency: 5 },
  { id: "sp-orc-skeleton-2", x: CX + 55, z: CZ + 40, npcIds: ["skeleton-warrior"], maxCount: 3, distance: 8, frequency: 6 },
  { id: "sp-orc-imp-1", x: CX - 35, z: CZ + 50, npcIds: ["imp"], maxCount: 4, distance: 8, frequency: 6 },
  { id: "sp-orc-goblin-1", x: CX + 40, z: CZ - 55, npcIds: ["goblin-grunt"], maxCount: 3, distance: 10, frequency: 7 },
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
  { name: "Lava Crossing", x: 80, z: 80, r: 12 },
  { name: "Sandstone Mesa", x: CX + 55, z: CZ - 50, r: 14 },
  { name: "Iron Mines", x: CX - 60, z: CZ - 45, r: 12 },
  { name: "Scorched Hollow", x: CX - 50, z: CZ + 55, r: 14 },
  { name: "Goblin Outpost", x: CX + 40, z: CZ - 55, r: 12 },
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

// Zone exit — east edge to crossroads
objects.push({
  id: objId++, name: "exit-to-crossroads", type: "zone_exit",
  x: (MAP_W - 18) * 64, y: (CZ - 3) * 32, width: 6 * 64, height: 6 * 32,
  properties: [
    { name: "targetZone", type: "string", value: "crossroads" },
    { name: "spawnX", type: "int", value: 20 },
    { name: "spawnZ", type: "int", value: 128 },
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

const outPath = resolve(import.meta.dir, "../public/maps/orc-wastes.json");
writeFileSync(outPath, JSON.stringify(map));
console.log(`Generated Orc Wastes zone: ${MAP_W}x${MAP_H} → ${outPath}`);
console.log(`  Spawns: ${spawns.length}, Zones: ${zones.length}, Mesas: ${mesas.length}`);
