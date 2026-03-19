import Fastify from "fastify";
import cors from "@fastify/cors";
import { authRoutes } from "./routes/auth.js";
import { characterRoutes } from "./routes/characters.js";
import { worldRoutes } from "./routes/world.js";
import { rtcRoutes } from "./routes/rtc.js";

export async function buildApp() {
  const app = Fastify({ logger: true });

  await app.register(cors, { origin: "http://localhost:5173", credentials: true });

  await app.register(authRoutes, { prefix: "/api/auth" });
  await app.register(characterRoutes, { prefix: "/api/characters" });
  await app.register(worldRoutes, { prefix: "/api/world" });
  await app.register(rtcRoutes, { prefix: "/api/rtc" });

  return app;
}
