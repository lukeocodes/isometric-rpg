import { existsSync } from "fs";
import { resolve, dirname } from "path";
import { fileURLToPath } from "url";
import { buildApp } from "./app.js";
import { config } from "./config.js";
import { connectRedis, disconnectRedis } from "./db/redis.js";
import { spawnInitialNpcs, cleanup as cleanupNpcs } from "./game/npcs.js";
import { startGameLoop, stopGameLoop } from "./game/world.js";
import { initWorldMap, cacheWorldMapToRedis } from "./world/queries.js";
import { loadZoneMap, getZoneMapItems } from "./world/tiled-map.js";
import { getAllZones } from "./game/zone-registry.js";
import { loadMapItems, loadDbItems } from "./game/world-items.js";
import { loadAllUserMaps } from "./game/user-maps.js";
import { loadNpcTemplates } from "./game/npc-templates.js";
import { loadItems, loadLootTables } from "./game/items.js";
import { loadQuests } from "./game/quests.js";

const __dirname = dirname(fileURLToPath(import.meta.url));

async function main() {
  const app = await buildApp();

  await connectRedis();

  // Register heaven (and any other user-built maps) as zones. There are no
  // static/shipped zones — every zone is a user map. `loadAllUserMaps` seeds
  // the heaven row in the DB if missing and registers it with the in-memory
  // zone registry.
  await loadAllUserMaps();

  // Load server-side Tiled data for every registered zone.
  //   - `zone.mapFile` (always `<numericId>-<slug>.tmx`) is what the CLIENT
  //     fetches via `/api/maps/<mapFile>` — it's XML and not what
  //     `parseTiledMap` reads.
  //   - Server-side parser expects Tiled JSON at the `.json` twin of the
  //     same filename (produced by `tools/freeze-map.ts` or `paint-map`).
  //     DB-only zones with no frozen JSON are skipped; their runtime
  //     walkability / spawns / items either don't exist or come from other
  //     sources.
  const mapsDir = resolve(__dirname, "../../client/public/maps");
  for (const zone of getAllZones()) {
    try {
      if (zone.id.startsWith("user:")) continue;
      const jsonFile = zone.mapFile.replace(/\.tmx$/, ".json");
      const jsonPath = resolve(mapsDir, jsonFile);
      if (!existsSync(jsonPath)) continue;            // DB-only zone — nothing to load
      loadZoneMap(zone.id, jsonPath);
      loadMapItems(zone.id, getZoneMapItems(zone.id));
      await loadDbItems(zone.id);
    } catch (e) {
      console.warn(`[Boot] Could not load zone "${zone.id}":`, (e as Error).message);
    }
  }

  // Generate world map from seed (deterministic, ~100-500ms)
  initWorldMap(config.world.seed);
  await cacheWorldMapToRedis();

  // Populate gameplay-data caches from the DB so spawner / combat / quests
  // have synchronous access. Must happen BEFORE spawnInitialNpcs().
  await loadNpcTemplates();
  await loadItems();
  await loadLootTables();
  await loadQuests();

  spawnInitialNpcs();
  startGameLoop();

  await app.listen({ host: config.server.host, port: config.server.port });

  const shutdown = async () => {
    stopGameLoop();
    cleanupNpcs();
    await disconnectRedis();
    await app.close();
    process.exit(0);
  };

  process.on("SIGINT", shutdown);
  process.on("SIGTERM", shutdown);
}

main().catch((err) => {
  console.error("Failed to start server:", err);
  process.exit(1);
});
