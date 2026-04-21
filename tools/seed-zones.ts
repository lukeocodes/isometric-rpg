/**
 * Phase-2b seed — static zones.
 *
 * One-time migration from the `registerZone(…)` calls + `TEST_ZONES[]`
 * array in `packages/server/src/game/zone-registry.ts`. User-authored maps
 * continue to live in `user_maps` (they populate the same in-memory
 * registry at boot) — this seed only handles the shipped/static zones.
 *
 * Idempotent (UPSERT by `id`).
 *
 *   DATABASE_URL=… bun tools/seed-zones.ts
 *
 * See AGENTS.md "Data in the Database".
 */
import postgres from "postgres";

// ---------------------------------------------------------------------------
// Data (copied from the former game/zone-registry.ts)
// ---------------------------------------------------------------------------

interface ZoneSeed {
  id:        string;
  numericId: number;
  name:      string;
  mapFile:   string;
  levelMin:  number;
  levelMax:  number;
  musicTag:  string;
  exits:     Record<string, { targetZone: string; spawnX: number; spawnZ: number }>;
  testSlot:  number | null;
}

const ZONES: ZoneSeed[] = [
  {
    id: "human-meadows", numericId: 1, name: "Starter Meadows",
    mapFile: "starter-area.json",
    levelMin: 1, levelMax: 5, musicTag: "town", exits: {}, testSlot: null,
  },

  // Test zones (Mana Seed sample maps). numericId = 100 + slot.
  { id: "test-1-summer-forest",    numericId: 101, name: "Summer Forest",
    mapFile: "test-zones/summer-forest/map.json",    levelMin: 1, levelMax: 99,
    musicTag: "field", exits: {}, testSlot: 1 },
  { id: "test-2-summer-waterfall", numericId: 102, name: "Summer Waterfall",
    mapFile: "test-zones/summer-waterfall/map.json", levelMin: 1, levelMax: 99,
    musicTag: "field", exits: {}, testSlot: 2 },
  { id: "test-3-spring-forest",    numericId: 103, name: "Spring Forest",
    mapFile: "test-zones/spring-forest/map.json",    levelMin: 1, levelMax: 99,
    musicTag: "field", exits: {}, testSlot: 3 },
  { id: "test-4-autumn-forest",    numericId: 104, name: "Autumn Forest",
    mapFile: "test-zones/autumn-forest/map.json",    levelMin: 1, levelMax: 99,
    musicTag: "field", exits: {}, testSlot: 4 },
  { id: "test-5-winter-forest",    numericId: 105, name: "Winter Forest",
    mapFile: "test-zones/winter-forest/map.json",    levelMin: 1, levelMax: 99,
    musicTag: "field", exits: {}, testSlot: 5 },
  { id: "test-6-thatch-home",      numericId: 106, name: "Thatch Roof Home",
    mapFile: "test-zones/thatch-home/map.json",      levelMin: 1, levelMax: 99,
    musicTag: "town",  exits: {}, testSlot: 6 },
  { id: "test-7-timber-home",      numericId: 107, name: "Timber Roof Home",
    mapFile: "test-zones/timber-home/map.json",      levelMin: 1, levelMax: 99,
    musicTag: "town",  exits: {}, testSlot: 7 },
  { id: "test-8-half-timber-home", numericId: 108, name: "Half-Timber Home",
    mapFile: "test-zones/half-timber-home/map.json", levelMin: 1, levelMax: 99,
    musicTag: "town",  exits: {}, testSlot: 8 },
  { id: "test-9-stonework-home",   numericId: 109, name: "Stonework Home",
    mapFile: "test-zones/stonework-home/map.json",   levelMin: 1, levelMax: 99,
    musicTag: "town",  exits: {}, testSlot: 9 },
];

// ---------------------------------------------------------------------------
// Seed
// ---------------------------------------------------------------------------

const DATABASE_URL = process.env.DATABASE_URL
  ?? "postgresql://game:game_dev_password@localhost:5433/game";
const sql = postgres(DATABASE_URL);

async function main() {
  console.log("[seed] connecting to DB:", DATABASE_URL.replace(/:[^:@]+@/, ":***@"));
  const t0 = Date.now();
  console.log(`[seed] zones — ${ZONES.length} rows`);

  try {
    for (const z of ZONES) {
      await sql`
        INSERT INTO zones (
          id, numeric_id, name, map_file,
          level_min, level_max, music_tag,
          exits, test_slot, updated_at
        ) VALUES (
          ${z.id}, ${z.numericId}, ${z.name}, ${z.mapFile},
          ${z.levelMin}, ${z.levelMax}, ${z.musicTag},
          ${sql.json(z.exits)}, ${z.testSlot}, NOW()
        )
        ON CONFLICT (id) DO UPDATE SET
          numeric_id  = EXCLUDED.numeric_id,
          name        = EXCLUDED.name,
          map_file    = EXCLUDED.map_file,
          level_min   = EXCLUDED.level_min,
          level_max   = EXCLUDED.level_max,
          music_tag   = EXCLUDED.music_tag,
          exits       = EXCLUDED.exits,
          test_slot   = EXCLUDED.test_slot,
          updated_at  = NOW()
      `;
    }
  } finally {
    await sql.end();
  }

  const dt = ((Date.now() - t0) / 1000).toFixed(2);
  console.log(`[seed] done in ${dt}s`);
}

main().catch((err) => {
  console.error("[seed] FAILED:", err);
  process.exit(1);
});
