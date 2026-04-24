/**
 * Map-serving route.
 *
 *   GET /api/maps/:filename.tmx
 *
 * Filename is `<numericId>-<slug>.tmx` (the canonical output of
 * `mapFileName()` and `tools/freeze-map.ts`). Resolution order:
 *
 *   1. If `packages/client/public/maps/<filename>` exists on disk, stream
 *      it verbatim with a short cache header (frozen path).
 *   2. Else synth a TMX from `user_maps` + `user_map_tiles` — look up the
 *      row by numeric prefix (`<digits>-…`), or by full `zoneId` as a
 *      fallback for legacy filenames.
 *   3. Neither present → 404.
 *
 * TSX tilesets are NOT served through this route. Both the frozen path
 * (`tools/freeze-map.ts`) and the synth path (`tmx-render.ts`) emit
 * absolute `<tileset source="/maps/<file>.tsx"/>` refs, which plugin-tiled
 * fetches from Vite's static serving of `public/maps/` directly.
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

/** Filenames like `500-heaven.tmx` or `1000-human-starter.tmx`. Reject
 *  anything else to keep the attack surface small — no `..`, no
 *  subdirectories, no query strings, no alternate extensions. */
const FILENAME_RE = /^[a-z0-9][a-z0-9_-]*\.tmx$/;

export async function mapsRoutes(app: FastifyInstance) {
  app.get<{ Params: { filename: string } }>(
    "/:filename",
    async (request, reply) => {
      const { filename } = request.params;
      if (!FILENAME_RE.test(filename)) {
        return reply.status(400).send({ detail: "Invalid map filename" });
      }

      const diskPath = resolve(MAPS_DIR, filename);

      // --- 1. Frozen TMX on disk ---
      if (existsSync(diskPath)) {
        const xml = await readFile(diskPath, "utf-8");
        reply.header("content-type", "text/xml; charset=utf-8");
        // Disk files are effectively immutable until the next freeze; a
        // short cache saves roundtrips without making stale edits stick for
        // long.
        reply.header("cache-control", "public, max-age=60");
        return reply.send(xml);
      }

      // --- 2. Synthesize TMX from DB ---
      // Filenames are `<numericId>-<slug>.tmx` (the canonical form produced
      // by `registerAsZone` and `tools/freeze-map.ts`). Parse the numeric
      // prefix for the DB lookup. We also accept a plain `<zoneId>.tmx` for
      // backwards-compat with any lingering client references.
      const stem = filename.replace(/\.tmx$/, "");
      const numericMatch = stem.match(/^(\d+)-/);
      const mapRows = await (numericMatch
        ? db.select({
            id:     userMaps.id,
            width:  userMaps.width,
            height: userMaps.height,
            name:   userMaps.name,
            zoneId: userMaps.zoneId,
          }).from(userMaps).where(eq(userMaps.numericId, Number(numericMatch[1])))
        : db.select({
            id:     userMaps.id,
            width:  userMaps.width,
            height: userMaps.height,
            name:   userMaps.name,
            zoneId: userMaps.zoneId,
          }).from(userMaps).where(eq(userMaps.zoneId, stem)));

      const [mapRow] = mapRows;
      if (!mapRow) {
        return reply.status(404).send({ detail: `No map matching ${filename}` });
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
