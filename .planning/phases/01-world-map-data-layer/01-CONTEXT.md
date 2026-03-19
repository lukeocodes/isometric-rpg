# Phase 1: World Map Data Layer - Context

**Gathered:** 2026-03-19
**Status:** Ready for planning

<domain>
## Phase Boundary

Define the static world map with three continents, regions, and the spatial hierarchy (Continent > Region > Chunk > Tile) that everything else queries. The world map is the data layer — it describes where things ARE, not how they look. Terrain classification (biome per region) is included so downstream phases know what kind of terrain to generate, but visual rendering and tile expansion are Phase 2+.

</domain>

<decisions>
## Implementation Decisions

### Continental Arrangement
- Three continents arranged in a **triangular layout**, roughly equidistant from each other
- Continental shapes must be **organic and irregular** — not geometric blobs. Complex coastlines with bays, peninsulas, fjords, and inlets
- All continents are **strictly ocean-separated** — no land bridges or connections
- **Roughly equal in size** — no race gets a larger homeland
- **Small neutral/unclaimed islands** scattered between continents (stepping stones, future exploration rewards)
- **World origin (0,0) is in the ocean center** — continents are offset from the origin
- **Hard edges** — finite world with deep ocean at boundaries, no wrapping
- **Lakes and rivers** exist within continents (data layer marks where inland water features go; Phase 2 details terrain types)

### Ocean Structure
- **Basic depth zones** — distinguish coastal shallows from deep ocean in the data layer
- **Mark natural passages/straits** between island chains — tagged for future naval traversal, no gameplay effect now
- **Ocean areas divided into named regions** — just like land, ocean has named zones for future naval discovery

### Continental Personality (Biome Themes)
- Each continent has a **dominant biome theme** reflecting its race, with secondary biomes for variety:
  - **Elf continent**: Ancient forests & rivers — dense old-growth forests, winding rivers, meadows. Tolkien's elven lands (Lothlorien, Rivendell). Green and lush.
  - **Dwarf continent**: Mountains & tundra — rugged mountain ranges, snowy peaks, cold tundra lowlands. Classic dwarven homeland.
  - **Human continent**: Temperate & diverse — plains, farmland, rolling hills, some forest and coast. Britannia feel. Most varied biome distribution.
- **One contrasting "wild zone" per continent** — an unexpected biome pocket (e.g., desert on Elf continent, swamp on Dwarf continent). Creates exploration surprises.
- **Island groups have distinct biomes** per their ocean location — not generic sandy islands. Islands between Elf-Human differ from islands between Dwarf-Human.
- **Minority outposts match local continent terrain** — an Elf settlement on Human continent is surrounded by temperate land, not transplanted forest.

### World Generation
- World map is **procedurally generated from a seed** using noise functions + rules (continent placement, elevation, biome zones)
- **World seed is configurable per server** — different servers can generate different worlds. Supports testing and potential multi-shard future.
- **Elevation data included in Phase 1** — noise-based elevation per chunk/region drives biome assignment (mountains at high elevation, swamps in lowlands)

### Region System
- **Voronoi regions** — organic, natural-looking boundaries generated from seed points. Not a rectangular grid.
- **20-30 regions per continent** (~80 total land regions, plus ocean regions). Province-scale. Each region takes 5-10 minutes to cross.
- **Poisson disk sampling** for seed point placement — evenly spaced with randomness, no extreme size variation
- **Pure Voronoi boundaries** — mathematical edges, not snapped to terrain features. Simple and deterministic.
- **POI markers in data layer** — regions can contain tagged point-of-interest locations (future ruins, cave entrances) with no gameplay effect now
- **Chunk-to-region lookup** precomputed at startup — given any chunk coordinate, server can determine region in O(1)

### World Scale
- **30-45 minutes real time** to walk across a continent (at current player speed of 5 tiles/sec)
- **5-10 minutes** between safe zones — meaningful danger without punishing death walks
- **World size derived from travel time**, not arbitrary chunk count — the math determines dimensions
- **Ocean gaps ~half a continent width** (~15-20 minutes) — significant barrier, continents feel separate

### Claude's Discretion
- Exact noise function parameters for continent generation
- Voronoi relaxation iterations (Lloyd's algorithm)
- Specific biome assignment thresholds from elevation/moisture
- Data file format and structure for the world map
- POI type taxonomy for the data layer
- Ocean region count and sizing strategy

</decisions>

<canonical_refs>
## Canonical References

**Downstream agents MUST read these before planning or implementing.**

### World structure requirements
- `.planning/REQUIREMENTS.md` — TECH-01 (world map data layer), TECH-02 (spatial hierarchy), WORLD-01 (three continents with ocean separation)
- `.planning/ROADMAP.md` — Phase 1 success criteria: queryable spatial hierarchy, biome classification per region, server-loadable at startup

### Existing codebase (integration points)
- `packages/shared/constants.json` — CHUNK_SIZE (32), TILE_SIZE (1.0), CHUNK_LOAD_RADIUS (3), MAX_PLAYER_SPEED (5.0)
- `packages/shared/protocol.json` — CHUNK_REQUEST/CHUNK_DATA opcodes (10-13) for future chunk streaming
- `packages/client/src/world/TileRegistry.ts` — Current 7 tile types (void, grass, dirt, stone, water, sand, wood)
- `packages/client/src/world/ChunkManager.ts` — Client chunk system with mapId, local generation to be replaced
- `packages/client/src/world/WorldConstants.ts` — Chunk constants (duplicated from shared)
- `packages/server/src/db/schema.ts` — Existing worldMaps and chunkData tables
- `packages/server/src/game/zones.ts` — SafeZone system (hardcoded, will need world-map integration)

### Research
- `.planning/research/ARCHITECTURE.md` — Spatial hierarchy design, chunk-to-region mapping strategies
- `.planning/research/FEATURES.md` — Region discovery, biome classification approaches
- `.planning/research/STACK.md` — simplex-noise + alea dependency recommendations
- `.planning/research/PITFALLS.md` — Scale validation concerns, async seeding complexity

</canonical_refs>

<code_context>
## Existing Code Insights

### Reusable Assets
- `worldMaps` DB table: Already defines map dimensions in chunks with z-levels — can store world map metadata
- `chunkData` DB table: Has mapId/chunkX/chunkY composite key — chunk-to-region mapping can use these coordinates
- `SafeZone` interface in zones.ts: Pattern for named locations with radius — reusable for settlement placement data
- `TileRegistry`: Extensible tile type system — biome types can be registered here in Phase 2

### Established Patterns
- `mapId` used throughout client and server (characters, chunks, safe zones) — world map can define which mapId each continent uses, or use a single mapId with spatial partitioning
- Chunk key format `${mapId}:${chunkX}:${chunkY}:${chunkZ}` — region lookup will extend this
- Server loads game data at startup in `index.ts` (Redis connect, NPC spawn) — world map loading fits this pattern
- `@shared/*` path alias for cross-package imports — world map constants belong in shared package

### Integration Points
- `packages/server/src/index.ts` — World map loads here at startup, before game loop starts
- `packages/server/src/game/world.ts` — Game tick can query region data for entity behaviors
- `packages/shared/` — World map seed, region definitions, biome enum belong here
- `packages/server/src/db/schema.ts` — New tables for regions, continents, world generation state

</code_context>

<specifics>
## Specific Ideas

- "Odd enough in shape it doesn't just look like a triangle" — continental arrangement should feel organic, like a real fantasy world map, not a geometric exercise
- UO Britannia is the reference for Human continent feel — familiar, diverse, explorable
- Tolkien elven lands (Lothlorien, Rivendell) for Elf continent atmosphere — ancient, green, river-threaded
- Islands between continents are future exploration rewards — not filler, each group has character
- Straits and passages tagged in data layer show forward-thinking about naval travel

</specifics>

<deferred>
## Deferred Ideas

- Rivers and lakes as distinct terrain types — Phase 2 (WORLD-03)
- Movement blocking for water/terrain — Phase 2 (WORLD-05)
- Naval/ocean traversal mechanics — Out of scope (noted in PROJECT.md)
- Interior spaces in settlements — Out of scope
- Minimap terrain data — v2 requirement (WPOL-02)

</deferred>

---

*Phase: 01-world-map-data-layer*
*Context gathered: 2026-03-19*
