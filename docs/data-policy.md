# Data in the Database, NOT in Code (CRITICAL — non-negotiable)

The **only** things that live outside the database are:

1. **Logic code** — TypeScript source, shaders, algorithms, protocol definitions
2. **Image data** — PNG files (and WAV/OGG when audio lands)

**Everything else is data and belongs in the database.** Full stop. This includes anything you might be tempted to put in a `*.ts` registry file, a `*.json` manifest, `localStorage`, or a hand-maintained array literal.

Concrete examples (all of these MUST be DB-backed):
- Tile categories, layers, tileset metadata (category / defaultLayer / blocks / tags / hidden / notes)
- Sub-regions (tile-id predicates that override tileset defaults)
- Per-tile overrides authored in the builder
- Empty-tile flags (fully-transparent cells auto-deleted from the picker)
- Tile animations ingested from TSX
- Map-item schemas (containers, lights, doors, signs, NPC spawns)
- NPC definitions, spawn-point definitions, loot tables
- Zone metadata, zone-to-numericId mappings
- Quest/dialogue/trade data (when those land)
- UI config that designers touch (tutorial text, shop layouts, etc.)

## TSX files are an edge case

TSX files are produced by the Tiled editor and are the upstream source-of-truth for structural data (tilewidth, tileheight, columns, animation frames). They stay on disk as raw-asset manifests but an **ingestion pass** parses them and upserts into the DB at import time. At runtime the DB is the source-of-truth; TSX is build-time input.

## Why this is non-negotiable

- Two builders editing tile metadata simultaneously must see each other's changes live (impossible with localStorage / JSON files + git round-trip).
- "Export overrides → bake into source → commit → deploy" is an **anti-pattern** that conflates authoring with deploying. Authors edit, deploys ship code, data flows freely between them.
- Data migrations (`ALTER TABLE`) are safer and easier than code migrations (edit 100 array literals).
- Runtime introspection becomes trivial — query the DB to answer "how many tiles in category X" or "which tilesets have no layer default."
- Server-authoritative games require server-side access to this data anyway; duplicating it in client code creates drift.

## Workflows

### Adding a new metadata field

1. Drizzle migration — add the column.
2. Update the typed server API / WebRTC opcode.
3. Client fetches on boot (or via WebRTC for live updates).
4. **Never** write `const foo: Def[] = [...]` in a client registry file.

### Importing a new asset pack

1. Drop the raw Mana Seed pack into `assets/<pack-dir>/`.
2. Add the pack to `PACKS` in `tools/ingest-mana-seed.ts` (category slug, seasonal, defaults).
3. Run `bun tools/ingest-mana-seed.ts` — walks `assets/`, publishes canonical TSX + PNG into `public/maps/<cat>/` + `public/assets/tilesets/<cat>/`, upserts structural data + animations + empty flags into DB.
4. Refine categorization in the builder UI (changes persist to DB overrides).
5. Commit the published TSX/PNG files + the `PACKS` config change. **Do not commit the DB rows** — they're re-derivable by re-running the ingest tool.

### Cleaning up stale DB rows after a re-ingest

`bun tools/audit-transparent.ts` reports transparency-related inconsistencies (overrides pointing at fully-transparent tiles, sub-regions whose whole range is transparent, sub-regions that partially cover transparent tiles for info). Add `--fix` to delete the first two classes.

## Red flags

If you find yourself writing `localStorage.setItem(...)` or `import foo from './*.json'` for anything that isn't image data or purely local UI state (picker zoom, camera position, etc.), **stop and question it**. Almost certainly belongs in the DB.
