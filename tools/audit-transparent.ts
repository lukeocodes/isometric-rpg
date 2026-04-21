/**
 * Transparent-tile audit — verifies that no runtime database row
 * (override or sub-region) references a tile that is actually
 * fully-transparent, and cleans up any that do.
 *
 * Runs after `ingest-tilesets.ts` (which re-scans PNG alpha and refreshes
 * `tile_empty_flags`). Any `tile_overrides` or `tileset_sub_regions` rows
 * pointing exclusively at transparent cells are dead metadata — the
 * runtime skips empty tiles BEFORE overrides/sub-regions apply, so those
 * rows never fire. Delete them to keep the DB honest.
 *
 *   DATABASE_URL=… bun tools/audit-transparent.ts          # dry-run report
 *   DATABASE_URL=… bun tools/audit-transparent.ts --fix    # delete dead rows
 *
 * See AGENTS.md "Data in the Database" and AGENTS.game.md Phase 1+2.
 */
import postgres from "postgres";

const DATABASE_URL = process.env.DATABASE_URL
  ?? "postgresql://game:game_dev_password@localhost:5433/game";
const FIX = process.argv.includes("--fix");

const sql = postgres(DATABASE_URL);

async function main() {
  console.log(
    `[audit] connecting to DB: ${DATABASE_URL.replace(/:[^:@]+@/, ":***@")}  (${FIX ? "FIX mode" : "dry-run"})`,
  );

  // ---------------------------------------------------------------------
  // 1. Total transparent tiles in DB (baseline)
  // ---------------------------------------------------------------------
  const [{ total: emptyTotal }] = await sql<{ total: number }[]>`
    SELECT COUNT(*)::int AS total FROM tile_empty_flags
  `;
  console.log(`\n[audit] tile_empty_flags: ${emptyTotal} row(s) — these tiles are deleted from the picker entirely`);

  // ---------------------------------------------------------------------
  // 2. Redundant tile_overrides — rows where (tileset_file, tile_id)
  //    matches a transparent tile. These overrides can never take effect.
  // ---------------------------------------------------------------------
  const redundantOverrides = await sql<
    { tilesetFile: string; tileId: number }[]
  >`
    SELECT o.tileset_file AS "tilesetFile", o.tile_id AS "tileId"
    FROM tile_overrides o
    JOIN tile_empty_flags e ON e.tileset_file = o.tileset_file AND e.tile_id = o.tile_id
    ORDER BY o.tileset_file, o.tile_id
  `;
  console.log(`\n[audit] redundant tile_overrides: ${redundantOverrides.length} row(s)`);
  for (const r of redundantOverrides.slice(0, 10)) {
    console.log(`  ${r.tilesetFile} #${r.tileId}`);
  }
  if (redundantOverrides.length > 10) console.log(`  (+${redundantOverrides.length - 10} more)`);

  // ---------------------------------------------------------------------
  // 3. Sub-regions whose entire range is transparent. They apply no
  //    real metadata because every tile inside them is already gone.
  // ---------------------------------------------------------------------
  const deadSubs = await sql<
    {
      id: string;
      tilesetFile: string;
      fromTileId: number;
      toTileId: number;
      label: string | null;
      categoryId: string | null;
    }[]
  >`
    SELECT sr.id, sr.tileset_file AS "tilesetFile",
           sr.from_tile_id AS "fromTileId",
           sr.to_tile_id   AS "toTileId",
           sr.label, sr.category_id AS "categoryId"
    FROM tileset_sub_regions sr
    LEFT JOIN tile_empty_flags e
      ON e.tileset_file = sr.tileset_file
     AND e.tile_id BETWEEN sr.from_tile_id AND sr.to_tile_id
    GROUP BY sr.id, sr.tileset_file, sr.from_tile_id, sr.to_tile_id, sr.label, sr.category_id
    HAVING COUNT(e.tile_id) = (MAX(sr.to_tile_id) - MIN(sr.from_tile_id) + 1)
    ORDER BY sr.tileset_file, sr.from_tile_id
  `;
  console.log(`\n[audit] fully-empty sub-regions: ${deadSubs.length} row(s)`);
  for (const s of deadSubs.slice(0, 10)) {
    console.log(
      `  ${s.tilesetFile} [${s.fromTileId}..${s.toTileId}]  ` +
      `${s.categoryId ?? "-"}  ${s.label ?? ""}`,
    );
  }
  if (deadSubs.length > 10) console.log(`  (+${deadSubs.length - 10} more)`);

  // ---------------------------------------------------------------------
  // 4. Partial-empty sub-regions — informational (we don't delete these;
  //    they might legitimately cover a mix of real + empty cells).
  // ---------------------------------------------------------------------
  const partialSubs = await sql<{ total: number }[]>`
    SELECT COUNT(*)::int AS total FROM (
      SELECT sr.id
      FROM tileset_sub_regions sr
      JOIN tile_empty_flags e
        ON e.tileset_file = sr.tileset_file
       AND e.tile_id BETWEEN sr.from_tile_id AND sr.to_tile_id
      GROUP BY sr.id, sr.from_tile_id, sr.to_tile_id
      HAVING COUNT(e.tile_id) > 0
         AND COUNT(e.tile_id) < (MAX(sr.to_tile_id) - MIN(sr.from_tile_id) + 1)
    ) x
  `;
  console.log(`\n[audit] sub-regions covering SOME transparent tiles (informational): ${partialSubs[0].total} row(s)`);

  // ---------------------------------------------------------------------
  // 5. Fix mode — delete redundant rows.
  // ---------------------------------------------------------------------
  if (FIX) {
    if (redundantOverrides.length > 0) {
      const del = await sql`
        DELETE FROM tile_overrides o
        USING tile_empty_flags e
        WHERE o.tileset_file = e.tileset_file AND o.tile_id = e.tile_id
        RETURNING o.tileset_file
      `;
      console.log(`\n[fix] deleted ${del.length} redundant tile_override(s)`);
    }
    if (deadSubs.length > 0) {
      const ids = deadSubs.map((s) => s.id);
      const del = await sql`
        DELETE FROM tileset_sub_regions WHERE id IN ${sql(ids)}
      `;
      console.log(`[fix] deleted ${del.count ?? ids.length} fully-empty sub-region(s)`);
    }
    if (redundantOverrides.length === 0 && deadSubs.length === 0) {
      console.log(`\n[fix] nothing to delete — DB is consistent`);
    }
  } else if (redundantOverrides.length > 0 || deadSubs.length > 0) {
    console.log(`\n[audit] re-run with --fix to delete the ${redundantOverrides.length + deadSubs.length} dead row(s)`);
  }

  await sql.end();
}

main().catch((err) => {
  console.error("[audit] FAILED:", err);
  process.exit(1);
});
