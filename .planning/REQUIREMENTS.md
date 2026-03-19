# Requirements: Isometric MMO — World & Exploration

**Defined:** 2026-03-19
**Core Value:** Players can freely explore a vast, dangerous world where every region they discover is permanently shaped by their presence

## v1 Requirements

Requirements for this milestone. Each maps to roadmap phases.

### World Structure & Geography

- [x] **WORLD-01**: World map defines three continents (Human, Elf, Dwarf) with ocean separation, each containing distinct biome regions
- [x] **WORLD-02**: Terrain biome classification system expands tile types from 7 to 15-20 (forest, mountain, swamp, desert, snow, deep water, shallow water, cliff, etc.)
- [x] **WORLD-03**: Water bodies (ocean, rivers, lakes) exist as impassable or boundary terrain between and within continents
- [ ] **WORLD-04**: Safe zone hierarchy with cities (2-3 min walk across), towns (1-2 min), and settlements (1 min) pre-generated on the world map
- [x] **WORLD-05**: Movement blocking based on terrain type (water, cliffs, steep mountains) prevents player traversal
- [ ] **WORLD-06**: Region entry notifications display region name, discoverer, and notes when a player crosses into a new region
- [ ] **WORLD-07**: Cross-continent minority settlements — small outposts of each race on the other two continents
- [ ] **WORLD-08**: Biome-specific ambient systems — heat shimmer in deserts, denser shadows in forests, fog in swamps

### Exploration & Discovery

- [ ] **DISC-01**: Procedural region seeding triggers when the first player enters an unexplored region, generating tiles, decorations, trees, and wildlife from biome rules
- [ ] **DISC-02**: Seeded regions persist permanently in PostgreSQL — all future players see the same generated content
- [ ] **DISC-03**: Region discoverer attribution stored and displayed (character name + discovery date)
- [ ] **DISC-04**: Procedural region names generated deterministically from world seed + region coordinates on first exploration
- [ ] **DISC-05**: Wildlife encounters spawn in wilderness regions with biome-appropriate creatures (wolves in forests, scorpions in deserts, etc.)
- [ ] **DISC-06**: Creature difficulty scales with distance from nearest safe zone — harder creatures farther from civilization
- [ ] **DISC-07**: Player notes on discovered regions — discoverer can leave a text note (120 chars) visible to all future visitors
- [ ] **DISC-08**: Progressive fog of war on world map — players only see areas they have personally explored, unknown areas rendered as fog

### PvP & Safety

- [ ] **PVP-01**: Criminal flagging system — attacking a non-flagged player in wilderness sets criminal (grey) status with timed duration (2-5 min)
- [ ] **PVP-02**: Safe zone enforcement — combat actions rejected when attacker or target is in a city, town, or settlement
- [ ] **PVP-03**: Murder count tracked persistently — 5+ kills marks player as murderer (red name) until worked off
- [ ] **PVP-04**: Visual indicators for player status — innocent (blue name), criminal (grey name), murderer (red name) visible to all nearby players

### Technical Foundation

- [x] **TECH-01**: World map data layer defines continental outlines, elevation, biome classification, and settlement locations above the existing chunk system
- [x] **TECH-02**: Hierarchical spatial system — Continent > Region > Chunk > Tile — with region as the unit of discovery and seeding
- [ ] **TECH-03**: Server-side chunk generation replaces client-side generation — chunk data streamed via existing CHUNK_REQUEST/CHUNK_DATA protocol opcodes (10-13)
- [ ] **TECH-04**: Region-aware spawn system — wildlife spawn points created dynamically per region based on biome rules, extending existing SpawnPoint infrastructure
- [ ] **TECH-05**: Chunk storage uses binary format (bytea) instead of JSONB for 5-10x storage efficiency at world scale
- [ ] **TECH-06**: Seedable PRNG (alea) used for all procedural generation to guarantee deterministic region reproduction
- [ ] **TECH-07**: Async region seeding — region generation runs off the main game loop thread to prevent freezing all connected players
- [ ] **TECH-08**: Server-side spatial indexing for entities — replace O(n) entity iteration with spatial grid for position broadcasts at world scale

### Procedural Audio

- [ ] **AUDIO-01**: Core audio engine with AudioContext lifecycle, separate gain buses (music, SFX, weather, ambient), and master intensity variable
- [ ] **AUDIO-02**: Music state machine with states (Exploring, Town, Dungeon, Enemy Nearby, Combat, Boss) and beat-quantized crossfade transitions
- [ ] **AUDIO-03**: Procedural background music using Tone.js with layered stems per location type (towns, dungeons, biomes) and procedural melodic variation
- [ ] **AUDIO-04**: Combat, movement, and progression sound effects with spatial positioning via Web Audio API PannerNode
- [ ] **AUDIO-05**: Weather audio synthesis (rain/wind) with 3 intensity layers, separate audio graph from music, and acoustic dampening of music bus
- [ ] **AUDIO-06**: Ambient creature and NPC sounds with stochastic triggers, spatial positioning, and biome-appropriate selection
- [ ] **AUDIO-07**: Acoustic occlusion system — indoor/outdoor low-pass filtering, 4 reverb profiles (dry/room/hall/cave), zone acoustic tags driving all buses

## v2 Requirements

Deferred to future milestones. Tracked but not in current roadmap.

### Death & Resurrection

- **DEATH-01**: Ghost form on player death with limited visibility and movement
- **DEATH-02**: Respawn at nearest safe zone or resurrection shrine
- **DEATH-03**: Stat/skill loss penalty on PvP death

### World Polish

- **WPOL-01**: Day/night cycle with client-side lighting changes on server-synced timer
- **WPOL-02**: Minimap terrain data feed with fog of war for undiscovered areas
- **WPOL-03**: Procedural points of interest (ruins, cave entrances, ancient trees) within regions
- **WPOL-04**: Region reputation / danger rating based on aggregate player death counts

### Economy Foundation

- **ECON-01**: Resource node metadata tagged during region seeding for future gathering systems
- **ECON-02**: Racial economic competition framework between continental factions

## Out of Scope

Explicitly excluded. Documented to prevent scope creep.

| Feature | Reason |
|---------|--------|
| Player housing / land claims | Requires stable world, economy, and anti-grief systems first |
| Interior spaces / dungeons | Massive scope — separate map instances, camera changes, pathfinding |
| Naval travel / boats | Entire subsystem — ocean is impassable for now |
| NPC merchants / quest givers | Requires inventory, economy, and dialogue systems |
| Skills affecting exploration | Requires skill progression system |
| Resource gathering (mining, lumber) | Requires inventory and crafting systems |
| Weather system (visual/gameplay) | Atmospheric but no gameplay impact without survival systems (audio weather SFX covered by AUDIO-05) |
| Guard NPCs in towns | Safe zones prevent combat directly — simpler and equally effective |
| Faction warfare mechanics | Racial identity established via continents, mechanical warfare deferred |
| Chat and social features | Deferred to social milestone |
| Inventory and item system | Deferred to economy milestone |
| Crafting system | Requires inventory system first |
| Race selection at character creation | All players same race for now |

## Traceability

Which phases cover which requirements. Updated during roadmap creation.

| Requirement | Phase | Status |
|-------------|-------|--------|
| WORLD-01 | Phase 1: World Map Data Layer | Complete |
| WORLD-02 | Phase 2: Terrain Classification & Biomes | Complete |
| WORLD-03 | Phase 2: Terrain Classification & Biomes | Complete |
| WORLD-04 | Phase 5: Safe Zones & Settlements | Pending |
| WORLD-05 | Phase 2: Terrain Classification & Biomes | Complete |
| WORLD-06 | Phase 6: Region Interaction & Fog of War | Pending |
| WORLD-07 | Phase 5: Safe Zones & Settlements | Pending |
| WORLD-08 | Phase 9: Biome Atmosphere & Rendering | Pending |
| DISC-01 | Phase 4: Region Discovery System | Pending |
| DISC-02 | Phase 4: Region Discovery System | Pending |
| DISC-03 | Phase 4: Region Discovery System | Pending |
| DISC-04 | Phase 4: Region Discovery System | Pending |
| DISC-05 | Phase 7: Wildlife & Region-Aware Spawning | Pending |
| DISC-06 | Phase 7: Wildlife & Region-Aware Spawning | Pending |
| DISC-07 | Phase 6: Region Interaction & Fog of War | Pending |
| DISC-08 | Phase 6: Region Interaction & Fog of War | Pending |
| PVP-01 | Phase 8: PvP Flagging & Combat Rules | Pending |
| PVP-02 | Phase 8: PvP Flagging & Combat Rules | Pending |
| PVP-03 | Phase 8: PvP Flagging & Combat Rules | Pending |
| PVP-04 | Phase 8: PvP Flagging & Combat Rules | Pending |
| TECH-01 | Phase 1: World Map Data Layer | Complete |
| TECH-02 | Phase 1: World Map Data Layer | Complete |
| TECH-03 | Phase 3: Server-Side Chunk Generation | Pending |
| TECH-04 | Phase 7: Wildlife & Region-Aware Spawning | Pending |
| TECH-05 | Phase 3: Server-Side Chunk Generation | Pending |
| TECH-06 | Phase 3: Server-Side Chunk Generation | Pending |
| TECH-07 | Phase 4: Region Discovery System | Pending |
| TECH-08 | Phase 10: World-Scale Performance | Pending |

| AUDIO-01 | Phase 11: Core Audio Engine | Pending |
| AUDIO-02 | Phase 11: Core Audio Engine | Pending |
| AUDIO-03 | Phase 12: Procedural Background Music | Pending |
| AUDIO-04 | Phase 13: Sound Effects | Pending |
| AUDIO-05 | Phase 13: Sound Effects | Pending |
| AUDIO-06 | Phase 14: Ambient Audio & Acoustic Occlusion | Pending |
| AUDIO-07 | Phase 14: Ambient Audio & Acoustic Occlusion | Pending |

**Coverage:**
- v1 requirements: 35 total
- Mapped to phases: 35
- Unmapped: 0

---
*Requirements defined: 2026-03-19*
*Last updated: 2026-03-19 after roadmap creation*
