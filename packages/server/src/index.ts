import { buildApp } from "./app.js";
import { config } from "./config.js";
import { connectRedis, disconnectRedis } from "./db/redis.js";
import { spawnInitialNpcs, cleanup as cleanupNpcs } from "./game/npcs.js";
import { startGameLoop, stopGameLoop } from "./game/world.js";

async function main() {
  const app = await buildApp();

  await connectRedis();
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
