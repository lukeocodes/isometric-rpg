/**
 * Map-serving route.
 *
 *   GET /api/maps/:filename
 *
 * Filename is the zone's canonical client-facing name, e.g. `heaven.tmx` or
 * `starter.tmx`. Resolution order:
 *
 *   1. If `packages/client/public/maps/<filename>` exists on disk, stream it
 *      verbatim with a long cache header. This is the "frozen" path — fast,
 *      no DB roundtrip, browser-cacheable.
 *   2. Otherwise look up the user map by zoneId (filename minus extension)
 *      and synthesize a TMX from `user_map_tiles`. This is the "live" path —
 *      used while authoring a map that hasn't been committed to disk yet.
 *   3. Neither present → 404.
 *
 * The contract is the same either way: the client hands the response to
 * `@excaliburjs/plugin-tiled` as a TMX document.
 */
import type { FastifyInstance } from "fastify";
import { existsSync } from "node:fs";
import { readFile } from "node:fs/promises";
import { resolve, dirname } from "node:path";
import { fileURLToPath } from "node:url";
import { eq } from "drizzle-orm";
import { db } from "../db/postgres.js";
import { userMaps, userMapTiles } from "../db/schema.js";
import { renderMapTmx, type DbMap, type DbTile } from "../game/tmx-render.js";

const __dirname = dirname(fileURLToPath(import.meta.url));
const MAPS_DIR = resolve(__dirname, "../../../client/public/maps");

/** Filenames like `heaven.tmx`, `starter.tmx`. Reject anything else to keep
 *  the attack surface small — no `..`, no subdirectories, no query strings. */
const FILENAME_RE = /^[a-z0-9][a-z0-9_-]*\.tmx$/;

export async function mapsRoutes(app: FastifyInstance) {
  app.get<{ Params: { filename: string } }>(
    "/:filename",
    async (request, reply) => {
      const { filename } = request.params;
      if (!FILENAME_RE.test(filename)) {
        return reply.status(400).send({ detail: "Invalid map filename" });
      }

      const zoneId   = filename.replace(/\.tmx$/, "");
      const diskPath = resolve(MAPS_DIR, filename);

      // --- 1. Frozen TMX on disk ---
      if (existsSync(diskPath)) {
        const xml = await readFile(diskPath, "utf-8");
        reply.header("content-type", "text/xml; charset=utf-8");
        // Frozen files are effectively immutable until the next freeze; a
        // short cache saves roundtrips without making stale edits stick for
        // long.
        reply.header("cache-control", "public, max-age=60");
        return reply.send(xml);
      }

      // --- 2. Synthesize from DB ---
      const [mapRow] = await db
        .select({
          id:        userMaps.id,
          width:     userMaps.width,
          height:    userMaps.height,
          name:      userMaps.name,
          zoneId:    userMaps.zoneId,
        })
        .from(userMaps)
        .where(eq(userMaps.zoneId, zoneId));

      if (!mapRow) {
        return reply.status(404).send({ detail: `No map named ${zoneId}` });
      }

      const tileRows = await db
        .select({
          layer:    userMapTiles.layer,
          x:        userMapTiles.x,
          y:        userMapTiles.y,
          tileset:  userMapTiles.tileset,
          tileId:   userMapTiles.tileId,
          rotation: userMapTiles.rotation,
          flipH:    userMapTiles.flipH,
          flipV:    userMapTiles.flipV,
        })
        .from(userMapTiles)
        .where(eq(userMapTiles.mapId, mapRow.id));

      const map:   DbMap   = {
        width:  mapRow.width,
        height: mapRow.height,
        name:   mapRow.name,
        zoneId: mapRow.zoneId,
      };
      const tiles: DbTile[] = tileRows.map((t) => ({
        layer:    t.layer,
        x:        t.x,
        y:        t.y,
        tileset:  t.tileset,
        tileId:   t.tileId,
        rotation: t.rotation,
        flipH:    t.flipH,
        flipV:    t.flipV,
      }));

      const xml = await renderMapTmx(map, tiles, MAPS_DIR);
      reply.header("content-type", "text/xml; charset=utf-8");
      // Live DB maps change on every tile placement; don't cache.
      reply.header("cache-control", "no-store");
      return reply.send(xml);
    },
  );
}
