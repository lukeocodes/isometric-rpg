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

  // Load the Tiled JSON for every registered zone. Heaven has a hand-authored
  // `heaven.json` on disk; other user maps stream their tile overlay via
  // BUILDER_MAP_SNAPSHOT and are skipped here.
  const mapsDir = resolve(__dirname, "../../client/public/maps");
  for (const zone of getAllZones()) {
    try {
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
