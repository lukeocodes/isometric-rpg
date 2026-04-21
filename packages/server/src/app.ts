import Fastify from "fastify";
import fastifyStatic from "@fastify/static";
import cors from "@fastify/cors";
import { existsSync } from "fs";
import { resolve, dirname } from "path";
import { fileURLToPath } from "url";
import { authRoutes } from "./routes/auth.js";
import { characterRoutes } from "./routes/characters.js";
import { worldRoutes } from "./routes/world.js";
import { rtcRoutes } from "./routes/rtc.js";
import { worldBuilderRoutes } from "./routes/world-builder.js";
import { builderRegistryRoutes } from "./routes/builder-registry.js";
import { mapsRoutes } from "./routes/maps.js";
import { config } from "./config.js";

export async function buildApp() {
  const app = Fastify({ logger: true });

  const allowedOrigins = [...config.cors.origins, "http://localhost:8000"];
  await app.register(cors, {
    origin: (origin, cb) => {
      // Allow requests with no origin (same-origin, curl, etc.)
      if (!origin) return cb(null, true);
      if (allowedOrigins.includes("*") || allowedOrigins.includes(origin)) {
        return cb(null, true);
      }
      cb(new Error("Not allowed by CORS"), false);
    },
    credentials: true,
  });

  await app.register(authRoutes, { prefix: "/api/auth" });
  await app.register(characterRoutes, { prefix: "/api/characters" });
  await app.register(worldRoutes, { prefix: "/api/world" });
  await app.register(rtcRoutes, { prefix: "/api/rtc" });
  await app.register(worldBuilderRoutes, { prefix: "/api/world-builder" });
  await app.register(builderRegistryRoutes, { prefix: "/api/builder" });
  await app.register(mapsRoutes, { prefix: "/api/maps" });

  // Serve built client if available (for ngrok / production)
  const __dirname = dirname(fileURLToPath(import.meta.url));
  const clientDist = resolve(__dirname, "../../../packages/client/dist");
  if (existsSync(clientDist)) {
    await app.register(fastifyStatic, { root: clientDist, prefix: "/" });
    // SPA fallback: serve index.html for non-API routes
    app.setNotFoundHandler((request, reply) => {
      if (request.url.startsWith("/api/")) {
        return reply.status(404).send({ detail: "Not found" });
      }
      return reply.sendFile("index.html");
    });
    app.log.info(`Serving client from ${clientDist}`);
  }

  return app;
}
