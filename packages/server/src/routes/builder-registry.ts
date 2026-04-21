/**
 * Builder registry routes — the DB-backed replacement for the client-side
 * `registry/*.ts` files + `empty-tiles.json`. See AGENTS.md "Data in the
 * Database".
 *
 * Endpoints:
 *   GET    /api/builder/registry            — dump categories + layers + tilesets
 *                                             + sub-regions + empty-flags +
 *                                             animations in one go (client bootstrap)
 *   POST   /api/builder/overrides           — upsert a per-tile override
 *   DELETE /api/builder/overrides/:file/:id — clear a per-tile override
 *   GET    /api/builder/overrides           — list all overrides (cheap; tiny table)
 *
 * No auth middleware yet — builder-only sessions will be enforced by the
 * existing `isBuilder` check on the WebRTC signalling. HTTP endpoints are
 * only reachable from the same origin during dev.
 */
import type { FastifyInstance } from "fastify";
import { db } from "../db/postgres.js";
import {
  tileCategories,
  mapLayers,
  tilesets,
  tilesetSubRegions,
  tileOverrides,
  tileEmptyFlags,
  tileAnimations,
  mapItemTypes,
} from "../db/schema.js";
import { and, eq } from "drizzle-orm";

export async function builderRegistryRoutes(app: FastifyInstance) {
  // -------------------------------------------------------------------------
  // Bootstrap — everything the client needs to render the picker + overlay
  // -------------------------------------------------------------------------
  app.get("/registry", async () => {
    const [
      categoriesRows,
      layersRows,
      tilesetsRows,
      subRegionsRows,
      emptyFlagsRows,
      animationsRows,
      overridesRows,
      mapItemTypesRows,
    ] = await Promise.all([
      db.select().from(tileCategories),
      db.select().from(mapLayers),
      db.select().from(tilesets),
      db.select().from(tilesetSubRegions),
      db.select().from(tileEmptyFlags),
      db.select().from(tileAnimations),
      db.select().from(tileOverrides),
      db.select().from(mapItemTypes),
    ]);

    // Reshape so the client consumes similar to the old registry structure.
    // Categories/layers sorted by display_order for stable picker ordering.
    const categories = categoriesRows
      .sort((a, b) => a.displayOrder - b.displayOrder)
      .map((c) => ({
        id:           c.id,
        name:         c.name,
        description:  c.description,
        order:        c.displayOrder,
        preview:      c.previewTileset && c.previewTileId != null
                        ? { tileset: c.previewTileset, tileId: c.previewTileId }
                        : undefined,
        related:      c.related,
      }));

    const layers = layersRows
      .sort((a, b) => a.displayOrder - b.displayOrder)
      .map((l) => ({
        id:              l.id,
        name:            l.name,
        description:     l.description,
        z:               l.z,
        collides:        l.collides,
        aboveCharacter:  l.aboveCharacter,
        order:           l.displayOrder,
      }));

    // Group sub-regions / empty flags / animations by tileset file so the
    // client can look them up in O(1).
    const subsByFile = new Map<string, typeof subRegionsRows>();
    for (const s of subRegionsRows) {
      const arr = subsByFile.get(s.tilesetFile) ?? [];
      arr.push(s);
      subsByFile.set(s.tilesetFile, arr);
    }
    const emptyByFile = new Map<string, number[]>();
    for (const e of emptyFlagsRows) {
      const arr = emptyByFile.get(e.tilesetFile) ?? [];
      arr.push(e.tileId);
      emptyByFile.set(e.tilesetFile, arr);
    }
    const animsByFile = new Map<string, typeof animationsRows>();
    for (const a of animationsRows) {
      const arr = animsByFile.get(a.tilesetFile) ?? [];
      arr.push(a);
      animsByFile.set(a.tilesetFile, arr);
    }

    const tilesetsOut = tilesetsRows.map((t) => {
      const subs = (subsByFile.get(t.file) ?? [])
        .sort((a, b) => a.displayOrder - b.displayOrder)
        .map((s) => ({
          from:          s.fromTileId,
          to:            s.toTileId,
          category:      s.categoryId,
          defaultLayer:  s.layerId,
          blocks:        s.blocks,
          label:         s.label,
          hide:          s.hide,
        }));
      const frames = animsByFile.get(t.file) ?? [];
      // Group animation frames by head tile id.
      const animByHead = new Map<number, Array<{ tileId: number; duration: number; idx: number }>>();
      for (const f of frames) {
        const arr = animByHead.get(f.headTileId) ?? [];
        arr.push({ tileId: f.frameTileId, duration: f.durationMs, idx: f.frameIdx });
        animByHead.set(f.headTileId, arr);
      }
      const animations: Record<number, Array<{ tileId: number; duration: number }>> = {};
      for (const [headId, list] of animByHead) {
        list.sort((a, b) => a.idx - b.idx);
        animations[headId] = list.map(({ tileId, duration }) => ({ tileId, duration }));
      }
      return {
        file:            t.file,
        slug:            t.slug,
        name:            t.name,
        tilewidth:       t.tilewidth,
        tileheight:      t.tileheight,
        columns:         t.columns,
        tilecount:       t.tilecount,
        imageUrl:        t.imageUrl,
        imageWidth:      t.imageWidth,
        imageHeight:     t.imageHeight,
        category:        t.defaultCategoryId,
        defaultLayer:    t.defaultLayerId,
        blocks:          t.defaultBlocks,
        tags:            t.tags,
        seasonal:        t.seasonal,
        hidden:          t.hidden,
        autoHideLabels:  t.autoHideLabels,
        notes:           t.notes,
        subRegions:      subs,
        emptyTiles:      emptyByFile.get(t.file) ?? [],
        animations,
      };
    });

    // Overrides keyed for direct client consumption.
    const overrides: Record<string, {
      category?:     string;
      name?:         string;
      tags?:         string[];
      defaultLayer?: string;
      blocks?:       boolean;
      hide?:         boolean;
    }> = {};
    for (const o of overridesRows) {
      const key = `${o.tilesetFile}:${o.tileId}`;
      const ov: Record<string, unknown> = {};
      if (o.categoryId   != null) ov.category     = o.categoryId;
      if (o.name         != null) ov.name         = o.name;
      if (o.tags         != null) ov.tags         = o.tags;
      if (o.layerId      != null) ov.defaultLayer = o.layerId;
      if (o.blocks       != null) ov.blocks       = o.blocks;
      if (o.hide         != null) ov.hide         = o.hide;
      if (Object.keys(ov).length > 0) overrides[key] = ov;
    }

    const mapItemTypesOut = mapItemTypesRows
      .sort((a, b) => a.displayOrder - b.displayOrder)
      .map((m) => ({
        kind:        m.kind,
        name:        m.name,
        description: m.description,
        blocks:      m.blocks,
        implemented: m.implemented,
        preview:     m.previewTileset && m.previewTileId != null
                       ? { tileset: m.previewTileset, tileId: m.previewTileId }
                       : undefined,
      }));

    return {
      categories,
      layers,
      tilesets: tilesetsOut,
      overrides,
      mapItemTypes: mapItemTypesOut,
    };
  });

  // -------------------------------------------------------------------------
  // Overrides CRUD
  // -------------------------------------------------------------------------
  app.post<{
    Body: {
      tileset:      string;
      tileId:       number;
      category?:    string | null;
      name?:        string | null;
      tags?:        string[] | null;
      defaultLayer?: string | null;
      blocks?:      boolean | null;
      hide?:        boolean | null;
    };
  }>("/overrides", async (req, reply) => {
    const b = req.body;
    if (!b.tileset || typeof b.tileId !== "number") {
      reply.status(400);
      return { error: "tileset and tileId required" };
    }
    // If every non-key field is null/undefined, delete the row.
    const keys = ["category", "name", "tags", "defaultLayer", "blocks", "hide"] as const;
    const anySet = keys.some((k) => b[k] != null);
    if (!anySet) {
      await db.delete(tileOverrides).where(
        and(
          eq(tileOverrides.tilesetFile, b.tileset),
          eq(tileOverrides.tileId, b.tileId),
        ),
      );
      return { cleared: true };
    }
    await db.insert(tileOverrides).values({
      tilesetFile: b.tileset,
      tileId:      b.tileId,
      categoryId:  b.category ?? null,
      name:        b.name ?? null,
      tags:        b.tags ?? null,
      layerId:     b.defaultLayer ?? null,
      blocks:      b.blocks ?? null,
      hide:        b.hide ?? null,
    }).onConflictDoUpdate({
      target: [tileOverrides.tilesetFile, tileOverrides.tileId],
      set: {
        categoryId:  b.category ?? null,
        name:        b.name ?? null,
        tags:        b.tags ?? null,
        layerId:     b.defaultLayer ?? null,
        blocks:      b.blocks ?? null,
        hide:        b.hide ?? null,
        updatedAt:   new Date(),
      },
    });
    return { ok: true };
  });

  app.delete<{ Params: { file: string; id: string } }>(
    "/overrides/:file/:id",
    async (req) => {
      const file = decodeURIComponent(req.params.file);
      const id = +req.params.id;
      await db.delete(tileOverrides).where(
        and(
          eq(tileOverrides.tilesetFile, file),
          eq(tileOverrides.tileId, id),
        ),
      );
      return { cleared: true };
    },
  );

  app.get("/overrides", async () => {
    const rows = await db.select().from(tileOverrides);
    return { overrides: rows };
  });
}
