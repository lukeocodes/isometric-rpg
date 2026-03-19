# Roadmap: Isometric MMO — World & Exploration

## Overview

This milestone transforms the existing flat, empty world into a massive three-continent explorable landscape. The journey starts with the world map data layer (the static truth about where everything is), builds up through server-side terrain generation and region discovery, layers on settlements and PvP rules, and finishes with wildlife population and visual atmosphere. The result: players can explore a vast, dangerous world where every region they discover is permanently shaped by their presence.

## Phases

**Phase Numbering:**
- Integer phases (1, 2, 3): Planned milestone work
- Decimal phases (2.1, 2.2): Urgent insertions (marked with INSERTED)

Decimal phases appear between their surrounding integers in numeric order.

- [ ] **Phase 1: World Map Data Layer** - Define the static world map with three continents, regions, and the spatial hierarchy that everything else queries
- [ ] **Phase 2: Terrain Classification & Biomes** - Expand tile types to 15-20 biomes with water bodies and movement blocking
- [ ] **Phase 3: Server-Side Chunk Generation** - Replace client-side generation with server-authoritative deterministic terrain pipeline using binary storage
- [ ] **Phase 4: Region Discovery System** - Implement regions as discoverable units with atomic seeding, persistence, procedural naming, and explorer attribution
- [ ] **Phase 5: Safe Zones & Settlements** - Pre-generate cities, towns, and settlements as safe zones with cross-continent minority outposts
- [ ] **Phase 6: Region Interaction & Fog of War** - Player notes on regions, fog of war on world map, and region entry notifications
- [ ] **Phase 7: Wildlife & Region-Aware Spawning** - Populate wilderness with biome-appropriate creatures that scale in difficulty by distance from safety
- [ ] **Phase 8: PvP Flagging & Combat Rules** - Criminal/murderer flagging system with safe zone enforcement and visual status indicators
- [ ] **Phase 9: Biome Atmosphere & Rendering** - Biome-specific ambient visual systems (heat shimmer, dense shadows, fog)
- [ ] **Phase 10: World-Scale Performance** - Server-side spatial indexing to replace O(n) entity iteration for position broadcasts
- [ ] **Phase 11: Core Audio Engine** - Web Audio API context, bus architecture, music state machine, and crossfade system (PARALLEL — no world map dependency)
- [ ] **Phase 12: Procedural Background Music** - Tone.js synthesis with layered stems for towns, dungeons, combat, and exploration biomes
- [ ] **Phase 13: Sound Effects** - Combat, movement, weather, and progression SFX with spatial audio positioning
- [ ] **Phase 14: Ambient Audio & Acoustic Occlusion** - Creature/NPC ambient sounds, indoor/outdoor filtering, reverb profiles, zone acoustic tags

## Phase Details

### Phase 1: World Map Data Layer
**Goal**: The game knows the shape of the world — where continents are, what regions exist, and how the spatial hierarchy (Continent > Region > Chunk > Tile) is structured
**Depends on**: Nothing (first phase, critical path)
**Requirements**: TECH-01, TECH-02, WORLD-01
**Success Criteria** (what must be TRUE):
  1. A world map data file defines three distinct continental landmasses (Human, Elf, Dwarf) separated by ocean
  2. The spatial hierarchy Continent > Region > Chunk > Tile is queryable — given any chunk coordinate, the server can determine which region and continent it belongs to
  3. Each region has a biome classification derived from the world map (even if biome rendering is not yet implemented)
  4. The world map is loadable by the server at startup and can be queried during gameplay without blocking the game loop
**Plans**: 3 plans

Plans:
- [ ] 01-01-PLAN.md — Types, constants, dependencies, and continent generation with noise-based landmask
- [ ] 01-02-PLAN.md — Voronoi region system, biome classification, and complete worldgen pipeline
- [ ] 01-03-PLAN.md — Server startup integration, query API, and WORLD_SEED configuration

### Phase 2: Terrain Classification & Biomes
**Goal**: The world has diverse terrain — forests, mountains, deserts, swamps, water bodies — with rules that govern what players can walk on
**Depends on**: Phase 1
**Requirements**: WORLD-02, WORLD-03, WORLD-05
**Success Criteria** (what must be TRUE):
  1. Tile type palette expanded from 7 to 15-20 types covering forest, mountain, swamp, desert, snow, deep water, shallow water, cliff, and other biome-appropriate terrain
  2. Water bodies (ocean between continents, rivers within continents, lakes) exist as distinct terrain types in the world map
  3. Players cannot walk through water, cliffs, or steep mountain terrain — movement is blocked server-side with appropriate client feedback
  4. Biome classification rules (elevation + moisture + temperature) deterministically assign terrain types to regions
**Plans**: TBD

Plans:
- [ ] 02-01: TBD
- [ ] 02-02: TBD

### Phase 3: Server-Side Chunk Generation
**Goal**: Terrain is generated on the server from deterministic seeds and streamed to clients — no more client-side chunk generation
**Depends on**: Phase 2
**Requirements**: TECH-03, TECH-05, TECH-06
**Success Criteria** (what must be TRUE):
  1. Clients receive chunk terrain data from the server via the existing CHUNK_REQUEST/CHUNK_DATA protocol opcodes (10-13) instead of generating terrain locally
  2. Generated chunks are stored in PostgreSQL using binary format (bytea) and cached in Redis for fast retrieval
  3. All terrain generation uses a seedable PRNG (alea) so the same seed always produces identical terrain — deterministic reproduction is guaranteed
  4. A player requesting the same chunk at different times always receives identical terrain data
**Plans**: TBD

Plans:
- [ ] 03-01: TBD
- [ ] 03-02: TBD

### Phase 4: Region Discovery System
**Goal**: When a player is the first to enter an unexplored region, that region is permanently seeded — tiles, decorations, and trees generated from biome rules, the discoverer is recorded, and a procedural name is assigned forever
**Depends on**: Phase 3
**Requirements**: DISC-01, DISC-02, DISC-03, DISC-04, TECH-07
**Success Criteria** (what must be TRUE):
  1. Entering an unexplored region triggers server-side generation of all chunks within that region (tiles, decorations, trees) based on biome rules
  2. Region seeding runs asynchronously — other connected players experience no freeze or lag during generation
  3. Once seeded, the region's generated content persists permanently in PostgreSQL and all future players see the same terrain
  4. Each seeded region receives a procedurally generated name (deterministic from world seed + coordinates) and records the discoverer's character name and discovery date
  5. A second player entering the same region sees the already-seeded content without triggering regeneration
**Plans**: TBD

Plans:
- [ ] 04-01: TBD
- [ ] 04-02: TBD

### Phase 5: Safe Zones & Settlements
**Goal**: The world has pre-generated cities, towns, and settlements that serve as safe havens — players can find civilization with predictable spacing across all three continents
**Depends on**: Phase 1 (needs world map locations), Phase 3 (needs chunk generation pipeline)
**Requirements**: WORLD-04, WORLD-07
**Success Criteria** (what must be TRUE):
  1. Cities (2-3 min walk across), towns (1-2 min), and settlements (1 min) exist as pre-generated safe zones on each continent
  2. Wilderness regions between safe zones require 5-10 minutes of walking to traverse, creating genuine danger in the spaces between civilization
  3. Each continent has small minority outposts of the other two races (e.g., a small Elf settlement on the Human continent)
  4. Safe zones are visually distinguishable from wilderness — players know when they are in a protected area
**Plans**: TBD

Plans:
- [ ] 05-01: TBD
- [ ] 05-02: TBD

### Phase 6: Region Interaction & Fog of War
**Goal**: Players have a relationship with the regions they discover — they can leave notes for others, see only explored areas on the world map, and receive notifications when entering named regions
**Depends on**: Phase 4 (needs region discovery and naming)
**Requirements**: WORLD-06, DISC-07, DISC-08
**Success Criteria** (what must be TRUE):
  1. When a player crosses into a new region, they see a notification showing the region name, who discovered it, and any note left by the discoverer
  2. The region discoverer can leave a text note (up to 120 characters) that all future visitors see on entry
  3. The world map shows only areas the player has personally explored — unexplored areas are rendered as fog
  4. As a player explores, their personal fog of war progressively reveals the world map
**Plans**: TBD

Plans:
- [ ] 06-01: TBD
- [ ] 06-02: TBD

### Phase 7: Wildlife & Region-Aware Spawning
**Goal**: Wilderness regions are populated with biome-appropriate creatures — wolves in forests, scorpions in deserts — that get harder the farther you venture from civilization
**Depends on**: Phase 4 (wildlife placed during region seeding), Phase 5 (needs safe zones for distance calculation)
**Requirements**: DISC-05, DISC-06, TECH-04
**Success Criteria** (what must be TRUE):
  1. Seeded wilderness regions contain wildlife spawn points with biome-appropriate creature types (wolves in forests, scorpions in deserts, etc.)
  2. Creature difficulty (HP, damage) scales with distance from the nearest safe zone — creatures near towns are weak, deep wilderness creatures are dangerous
  3. Wildlife spawns use the existing SpawnPoint infrastructure extended with region and biome awareness
  4. Wildlife uses the existing sleep optimization pattern — creatures far from all players do not tick
**Plans**: TBD

Plans:
- [ ] 07-01: TBD
- [ ] 07-02: TBD

### Phase 8: PvP Flagging & Combat Rules
**Goal**: Players can fight in the wilderness with meaningful consequences — attacking innocent players marks you as a criminal, repeated kills brand you a murderer, and safe zones prevent all combat
**Depends on**: Phase 5 (needs safe zone boundaries for enforcement)
**Requirements**: PVP-01, PVP-02, PVP-03, PVP-04
**Success Criteria** (what must be TRUE):
  1. Attacking a non-flagged player in wilderness sets the attacker's status to criminal (grey) for a timed duration (2-5 minutes)
  2. Combat actions are rejected by the server when attacker or target is inside a safe zone (city, town, or settlement)
  3. Killing 5 or more players persistently marks the killer as a murderer (red status) until worked off over time
  4. All nearby players see visual name color indicators: blue for innocent, grey for criminal, red for murderer
**Plans**: TBD

Plans:
- [ ] 08-01: TBD
- [ ] 08-02: TBD

### Phase 9: Biome Atmosphere & Rendering
**Goal**: Each biome feels distinct through ambient visual effects — deserts shimmer with heat, forests cast dense shadows, swamps roll with fog
**Depends on**: Phase 2 (needs biome types), Phase 3 (needs server-streamed terrain)
**Requirements**: WORLD-08
**Success Criteria** (what must be TRUE):
  1. Desert biomes display heat shimmer or haze effects
  2. Forest biomes have denser, darker ambient shadows compared to open terrain
  3. Swamp biomes feature visible fog or mist effects
  4. Biome atmosphere transitions smoothly as a player moves between regions of different types
**Plans**: TBD

Plans:
- [ ] 09-01: TBD

### Phase 10: World-Scale Performance
**Goal**: The server can handle many players spread across the world without degrading tick rate — position broadcasts are efficient at scale
**Depends on**: Phase 3 (needs world with content to stress-test)
**Requirements**: TECH-08
**Success Criteria** (what must be TRUE):
  1. Server-side spatial indexing replaces O(n) entity iteration for position broadcasts — only nearby entities are considered
  2. Server tick rate remains stable at 20Hz with players distributed across multiple continents and regions
  3. Adding more players in distant parts of the world does not degrade performance for players in other areas
**Plans**: TBD

Plans:
- [ ] 10-01: TBD

### Phase 11: Core Audio Engine
**Goal**: The game has a working audio foundation — AudioContext lifecycle, separate gain buses, a music state machine that transitions between game states, and beat-quantized crossfades
**Depends on**: Nothing (client-only, runs in parallel with world map phases)
**Requirements**: AUDIO-01, AUDIO-02
**Success Criteria** (what must be TRUE):
  1. AudioContext initializes on first user interaction and resumes correctly after browser suspension
  2. Separate gain buses exist for music, SFX, weather, and ambient — each independently controllable
  3. Music state machine transitions between states (Exploring, Town, Dungeon, Enemy Nearby, Combat, Boss) driven by game events
  4. Crossfades between music states are quantized to beat boundaries via Tone.js Transport for seamless transitions
  5. A master intensity variable (0.0–1.0) globally influences stem density, SFX volume, and weather presence
**Plans**: TBD

Plans:
- [ ] 11-01: TBD
- [ ] 11-02: TBD

### Phase 12: Procedural Background Music
**Goal**: Every location in the game has distinctive procedural music — towns sound warm and busy, dungeons feel tense, wilderness biomes each have their own character, and combat drives adrenaline
**Depends on**: Phase 11 (needs audio engine and state machine)
**Requirements**: AUDIO-03
**Success Criteria** (what must be TRUE):
  1. Town music plays layered stems with procedural melodic variation — motifs randomized from phrase pools, rhythm sections constant
  2. Exploration biome music (grasslands, forest, desert, mountains) uses distinct scales/modes and instruments per biome type
  3. Combat music crossfades in on enemy aggro with intensity scaling by enemy count; boss music has HP-threshold phase transitions
  4. Enemy detection state plays a transitional tension track with proximity-driven pulse tempo
  5. Music never loops identically — procedural variation (BPM drift, phrase selection, ornamental injection) ensures each session sounds fresh
**Plans**: TBD

Plans:
- [ ] 12-01: TBD
- [ ] 12-02: TBD

### Phase 13: Sound Effects
**Goal**: Player actions and world events have audio feedback — weapon swings, footsteps on different surfaces, weather atmosphere, and progression fanfares
**Depends on**: Phase 11 (needs audio buses and spatial audio setup)
**Requirements**: AUDIO-04, AUDIO-05
**Success Criteria** (what must be TRUE):
  1. Combat SFX plays for melee swings/hits, bow draw/release/impact, and magic cast/hit with 3 intensity tiers and weapon-type variation
  2. Footstep sounds vary by surface type (grass, stone, wood, sand, snow) with random pitch variation (±5%) to prevent repetition
  3. Weather synthesis produces rain (noise-shaped) and wind (bandpass-filtered) with 3 crossfaded intensity layers on a separate audio graph
  4. Progression stingers play for rank/skill level ups and special events
  5. All positional SFX uses Web Audio API PannerNode for spatial audio based on entity distance from player
**Plans**: TBD

Plans:
- [ ] 13-01: TBD
- [ ] 13-02: TBD

### Phase 14: Ambient Audio & Acoustic Occlusion
**Goal**: The world sounds alive and physically grounded — creatures call in the distance, NPCs chatter in towns, and walking indoors muffles the outside world with appropriate reverb
**Depends on**: Phase 11 (needs audio buses), Phase 12 (music buses for occlusion filtering), Phase 13 (SFX buses for reverb)
**Requirements**: AUDIO-06, AUDIO-07
**Success Criteria** (what must be TRUE):
  1. Biome-appropriate creature sounds play stochastically near wildlife entities (wolves howl in forests, scorpions chititer in deserts)
  2. NPC ambient voices are race-specific (human market calls, elf singing, dwarf laughter) and spatially positioned
  3. Zone acoustic tags (outdoors/indoorWood/indoorStone/underground) drive a per-bus low-pass occlusion filter with smooth interpolation on zone transitions
  4. Four reverb profiles (dry ~0.1s, room ~0.6s, hall ~1.5s, cave ~3.0s+) apply to SFX based on acoustic environment
  5. Weather audio is muffled/silenced indoors with a separate rain-on-roof synthesis layer for indoor spaces
**Plans**: TBD

Plans:
- [ ] 14-01: TBD
- [ ] 14-02: TBD

## Progress

**Execution Order:**
- World phases: 1 > 2 > 3 > 4 > 5 > 6 > 7 > 8 > 9 > 10 (sequential, phases 8-10 can overlap)
- Audio phases: 11 > 12/13 > 14 (11 first, then 12 & 13 in parallel, then 14)
- Audio phases (11-14) run **independently** of world phases (1-10) — no cross-dependencies

| Phase | Plans Complete | Status | Completed |
|-------|----------------|--------|-----------|
| 1. World Map Data Layer | 0/3 | Planning complete | - |
| 2. Terrain Classification & Biomes | 0/0 | Not started | - |
| 3. Server-Side Chunk Generation | 0/0 | Not started | - |
| 4. Region Discovery System | 0/0 | Not started | - |
| 5. Safe Zones & Settlements | 0/0 | Not started | - |
| 6. Region Interaction & Fog of War | 0/0 | Not started | - |
| 7. Wildlife & Region-Aware Spawning | 0/0 | Not started | - |
| 8. PvP Flagging & Combat Rules | 0/0 | Not started | - |
| 9. Biome Atmosphere & Rendering | 0/0 | Not started | - |
| 10. World-Scale Performance | 0/0 | Not started | - |
| 11. Core Audio Engine | 0/0 | Not started | - |
| 12. Procedural Background Music | 0/0 | Not started | - |
| 13. Sound Effects | 0/0 | Not started | - |
| 14. Ambient Audio & Acoustic Occlusion | 0/0 | Not started | - |
