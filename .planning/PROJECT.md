# Isometric MMO — UO-Inspired

## What This Is

A browser-based 3D isometric MMORPG inspired by Ultima Online's early 2000s era, built from memory of how the game looked and worked. Three racial continents (Human, Elf, Dwarf) with massive explorable wilderness, procedurally-seeded regions, and a flagging PvP system. Players discover and name regions, encounter wildlife, and compete economically through racial factions.

## Core Value

Players can freely explore a vast, dangerous world where every region they discover is permanently shaped by their presence — the sandbox freedom, social danger, and atmospheric world feel of classic UO.

## Requirements

### Validated

<!-- Shipped and confirmed valuable. -->

- ✓ OAuth2 PKCE authentication with dev login fallback — existing
- ✓ Character creation and selection screen — existing
- ✓ WebRTC multiplayer with binary position sync (15Hz) and reliable JSON events — existing
- ✓ Server-authoritative combat with auto-attack, HP, damage, and death — existing
- ✓ NPC spawning with wander AI and sleep optimization — existing
- ✓ Client ECS architecture (entities, components, systems) — existing
- ✓ Chunk-based world with spatial grid indexing — existing
- ✓ Isometric orthographic 3D rendering via Babylon.js — existing
- ✓ Linger system for disconnect/reconnect recovery — existing

### Active

<!-- Current scope. Building toward these. -->

- [x] Multi-continent world map with three racial continents (Human, Elf, Dwarf) — Validated in Phase 1: World Map Data Layer
- [x] Pre-determined terrain classification across the world map (biomes, elevation, water) — Validated in Phase 1: World Map Data Layer
- [ ] Cities (2-3 min walk across), towns (1-2 min), settlements (1 min) pre-generated as safe zones
- [ ] Cross-continent minority settlements (small presence of each race on other continents)
- [ ] Wilderness regions with 5-10 minute walking distances between safe zones
- [ ] Procedural region seeding on first player exploration (tiles, decoration, trees, wildlife)
- [ ] Permanent persistence of seeded regions for all future players
- [ ] Procedurally generated region names on discovery
- [ ] Player notes on discovered regions visible to all who enter
- [ ] Region entry notification (region name + discoverer's note)
- [ ] Wildlife encounters in wilderness regions
- [ ] PvP flagging system (criminal flag for attacking non-flagged players outside safe zones)
- [ ] Safe zone enforcement in cities, towns, and settlements
- [ ] Continent/ocean/river/lake geography separating landmasses

### Out of Scope

<!-- Explicit boundaries. Includes reasoning to prevent re-adding. -->

- Buildings and interior spaces — deferred, focus on outdoor world first
- NPCs in cities (merchants, quest givers) — beyond wildlife, deferred to future milestone
- Skills and progression system — important but world comes first
- Inventory and item system — deferred to post-world milestone
- Crafting — requires inventory system first
- Chat and social features — deferred to social milestone
- Guilds and player organizations — deferred to social milestone
- Trading and economy mechanics — deferred, though racial economic competition is a future goal
- Race selection at character creation — deferred, all players same race for now
- Player housing — UO signature feature but requires stable world first
- Naval/ocean travel — continents exist but traversal deferred

## Context

- Spiritual successor to Ultima Online, built entirely from memory — no assets or code copied
- Existing codebase has solid networking (WebRTC), combat, and ECS foundation
- World map data layer complete (Phase 1) — 900x900 chunk world with 3 continents, Voronoi regions, biome classification, O(1) spatial queries
- Target audience: serious project aiming for real player base ("as big as it gets")
- World design takes inspiration from famous fantasy world maps for multi-continent layout
- Terrain classification is deterministic (pre-set), but visual detail is procedurally generated on first exploration
- Scale is deliberately massive — wilderness should feel dangerous and lonely between settlements

## Constraints

- **Tech stack**: Bun monorepo, Babylon.js client, Fastify/Node server, PostgreSQL + Redis — expand, don't replace
- **Rendering**: Isometric orthographic camera — world design must work from this perspective
- **Networking**: WebRTC DataChannels (unreliable for positions, reliable for events) — new systems must use this transport
- **Server authority**: All game state changes must be server-authoritative — region seeding included
- **Chunk system**: Existing 32x32 tile chunks must accommodate or evolve for the larger world
- **Performance**: NPC sleep system pattern (only tick near players) must extend to wildlife and region systems

## Key Decisions

<!-- Decisions that constrain future work. Add throughout project lifecycle. -->

| Decision | Rationale | Outcome |
|----------|-----------|---------|
| Procedural + curated world | Terrain classification pre-set, details seeded on first exploration | — Pending |
| Three racial continents | Human, Elf, Dwarf — races compete economically, not via PvP | — Pending |
| PvP flagging system | Criminal flag for attacking non-flagged players — danger without grief | — Pending |
| Permanent region seeding | First explorer shapes the region forever — exploration has lasting impact | — Pending |
| Region discovery with notes | Procedural names + player notes create shared world narrative | — Pending |
| Expand existing foundation | Don't refactor what works — build new systems on top of solid base | — Pending |

---
*Last updated: 2026-03-19 after Phase 1 completion*
