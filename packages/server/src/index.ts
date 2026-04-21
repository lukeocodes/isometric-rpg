import { resolve, dirname } from "path";
import { fileURLToPath } from "url";
import { buildApp } from "./app.js";
import { config } from "./config.js";
import { connectRedis, disconnectRedis } from "./db/redis.js";
import { spawnInitialNpcs, cleanup as cleanupNpcs } from "./game/npcs.js";
import { startGameLoop, stopGameLoop } from "./game/world.js";
import { initWorldMap, cacheWorldMapToRedis } from "./world/queries.js";
import { loadTiledMap, loadZoneMap, getZoneMapItems } from "./world/tiled-map.js";
import { getAllZones } from "./game/zone-registry.js";
import { loadMapItems, loadDbItems } from "./game/world-items.js";
import { loadSavedModelsFromDB } from "./game/model-registry.js";
import { loadAllUserMaps } from "./game/user-maps.js";
import { loadNpcTemplates } from "./game/npc-templates.js";
import { loadItems, loadLootTables } from "./game/items.js";
import { loadQuests } from "./game/quests.js";
import { loadStaticZones } from "./game/zone-registry.js";

const __dirname = dirname(fileURLToPath(import.meta.url));

async function main() {
  const app = await buildApp();

  await connectRedis();

  // Populate static-zone registry from DB first. User-authored maps
  // (including heaven) are appended next via loadAllUserMaps().
  await loadStaticZones();

  // Register heaven + all user-built maps as zones before loading map files.
  // loadAllUserMaps seeds the heaven row in DB if missing and registers every
  // user map (including heaven) with the zone registry.
  await loadAllUserMaps();

  // Load Tiled maps for all registered zones
  const mapsDir = resolve(__dirname, "../../client/public/maps");
  const defaultMapPath = resolve(mapsDir, "starter-area.json");
  loadTiledMap(defaultMapPath); // Legacy default (backward compatible)
  for (const zone of getAllZones()) {
    try {
      // User-built maps don't have a map file on disk — their tile data is
      // streamed via BUILDER_MAP_SNAPSHOT. Skip the loader for them.
      if (zone.id.startsWith("user:")) continue;
      loadZoneMap(zone.id, resolve(mapsDir, zone.mapFile));
      loadMapItems(zone.id, getZoneMapItems(zone.id));
      await loadDbItems(zone.id);
    } catch (e) {
      console.warn(`[Boot] Could not load zone "${zone.id}" (${zone.mapFile}):`, (e as Error).message);
    }
  }

  // Generate world map from seed (deterministic, ~100-500ms)
  initWorldMap(config.world.seed);
  await cacheWorldMapToRedis();

  // Load workbench saved models into memory (non-fatal if DB not yet migrated)
  await loadSavedModelsFromDB();

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
