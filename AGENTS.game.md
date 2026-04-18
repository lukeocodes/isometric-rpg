# 16Bit Online - Game Development State

Read this file at the start of each conversation to understand where the project is and what to work on next. Update it after completing significant work.

## Pivot: Top-Down RPG (2026-04-18)

Changing from isometric to top-down Pokemon GameBoy-style. All rendering now uses orthographic 1:1 projection.

### Completed (this session)

**Asset Pipeline:**
- Copied sprite assets to client public folder
- Created terrain.tsx tileset (224 tiles from summer forest)
- Created trees.tsx tileset (30 tiles from summer trees 80x112)
- Updated starter-area.json map with real tile data (all grass tiles GID 1)
- Added spawn_points and objects layers to map
- Build passes cleanly

**Rendering Updates:**
- TiledMapRenderer updated for top-down: anchor (0.5, 1), worldToScreen(tx, ty)
- OrthographicRenderer provides TILE_WIDTH=32, TILE_HEIGHT=32
- Map load changed from starter.json to starter-area.json

**TypeScript Status:**
- Client builds clean (vite build passes)
- Tests: run with `bun test`

### Assets Available

`~/Projects/lukeocodes/isometric-rpg/assets/` contains:
- **NPC Pack #1** (v00-v04 animations): old man, merchant, king, queen, etc.
- **Livestock**: chicken, cow, pig, duck (various color variants)
- **Forest tilesets**: summer 32x32.png, summer forest.png (672 tiles), summer trees 80x112
- **Many more packs** (furniture, buildings, weather, etc.)

### What's Changed

- `worldToScreen(x, y)` now: sx = x * 32, sy = y * 32 (was isometric diamond)
- No elevation in rendering
- Tiles render as squares, not diamonds
- Entities z-ordered by y*1000 + x (simple top-down)
- Pathfinding: 4-directional only (no diagonals)
- Movement: grid-based tile snapping

### New Art Pipeline

1. **Tilesets**: Use TSX files (terrain.tsx, trees.tsx) - already created
2. **Entities**: WorkbenchSpriteSheet generates from models - can swap to load PNG textures later
3. **Map**: JSON files reference tilesets by firstgid

### Next Steps

1. Test end-to-end rendering (run client)
2. Add more map detail (flowers, paths, buildings)
3. Wire up entity sprite textures for NPCs
4. Wild encounters system already in place

### Features Preserved (from previous)

- Real-time combat (NOT turn-based)
- MMORPG networking (WebRTC)
- Multi-zone transitions
- Quest/inventory/equipment systems
- Database/Auth