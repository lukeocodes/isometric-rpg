# 16Bit Online Game

## Context Hygiene (IMPORTANT)
Keep API request size small. Context bloat causes failures. Follow these rules strictly:
- **Read files with offset+limit** — never read an entire large file. Read only the 20-50 lines you need.
- **Use grep/glob first** — find the exact line numbers, then read only that range.
- **Pipe bash output through `| tail -N` or `| head -N`** — never dump full command output. 5-15 lines is usually enough.
- **Don't echo file contents back** — after reading a file, note what you learned, don't quote it back.
- **Avoid redundant reads** — if you already read a section, don't re-read it. Take notes in your response.
- **Minimize screenshot frequency** — one screenshot to verify, not one per change.
- **Prefer Edit over Write** — sends only the diff, not the whole file.
- **Suppress noisy output** — `2>&1 | grep -v "warning" | tail -5` for builds/tests.
- **Update AGENTS.game.md** instead of building up conversation context. Future sessions read the file, not the thread.

## Game State
- @AGENTS.game.md — **Read first.** Development progress, current state, what to work on next. Update after significant work.

## Agent Guides
- @AGENTS.md — General guidelines, Playwright testing, architecture rules, common issues
- @AGENTS-SERVER.md — Server file map, adding NPCs/spawn points, protocol format
- @AGENTS-CLIENT.md — Client file map, PixiJS rendering, ECS patterns, UI screens
- @AGENTS-TESTING.md — Playwright automated testing strategy, combat test loop, multi-tab testing
- @AGENTS-PERFORMANCE.md — Binary protocol rules, message format reference, how to add new binary messages

## Project Structure
Bun workspace monorepo with three packages:
- `packages/client` — PixiJS v8 TypeScript client (Vite bundler)
- `packages/server` — Fastify TypeScript server (runs with Node via tsx; werift needs Node's UDP stack)
- `packages/shared` — Shared constants and protocol definitions (JSON)

## Commands

### Development
```bash
docker compose up -d                          # Start PostgreSQL + Redis
cd packages/server && node --watch --import tsx src/index.ts  # Start backend
cd packages/client && bunx --bun vite         # Start frontend with HMR
```

### Database
```bash
cd packages/server && bunx drizzle-kit push   # Push schema to DB
cd packages/server && bunx drizzle-kit generate  # Generate migration
cd packages/server && bunx drizzle-kit migrate   # Run migrations
```

## Architecture
- **Auth**: OAuth2 PKCE with id.dx.deepgram.com + dev login, game JWT for sessions
- **Networking**: WebRTC DataChannels via werift (unreliable for positions, reliable for events), HTTP POST for signaling
- **Database**: PostgreSQL via Drizzle ORM + Redis via ioredis
- **Client**: PixiJS v8 2D top-down rendering, ECS architecture, Tiled editor maps
- **Server**: Authoritative game loop (combat, NPCs, HP, state) at 20Hz
- **Protocol**: Binary (24-byte) for position updates, JSON for reliable messages
- **Coordinate system**: Top-down x,y (was isometric x,y,z)

## Key Constants
- Chunk size: 32x32 tiles
- Entity load radius: 32 tiles
- Chunk load radius: 3 chunks
- Server tick rate: 20Hz
- Client tick rate: 20Hz
- Position send rate: 15Hz
- Docker PostgreSQL port: 5433 (local PG on 5432)

## Git
- Use conventional commits
- Never include Co-Authored-By

---

## Server Changes
After modifying server files, the `--watch` flag auto-reloads. If port 8000 is stuck: `lsof -ti:8000 | xargs kill -9`

## Client Changes
Vite HMR picks up most changes instantly. Full reload needed for: vite.config.ts, new dependencies, index.html.

## Testing with Playwright
Use the Playwright MCP tools to drive the game. The dev-only `window.__game` API provides programmatic access to game internals.

### Quick test flow:
1. Navigate to http://localhost:5173
2. Click "Play" on character select (or create one first)
3. Use `window.__game` API via `browser_evaluate`:
   - `__game.getEntityList()` — see all entities
   - `__game.move("w")` — move one tile
   - `__game.selectTarget("npc-id")` + `__game.toggleAutoAttack("npc-id")` — attack
   - `__game.waitForHp("npc-id", 1, "lt", 10000)` — wait for kill

### Combat test pattern:
```javascript
const api = window.__game;
const npcs = api.getEntityList().filter(e => e.type === "npc");
const target = npcs[0];
api.selectTarget(target.id);
api.toggleAutoAttack(target.id);
// Walk toward target, wait for kill, verify respawn
```

### Multi-tab testing:
Use `browser_tabs` to switch between tabs. Each tab is a separate player session. Both should see each other's position updates.

## Architecture Rules
- **Server-authoritative**: Never add game logic (combat, HP, spawning) to the client. Client only renders.
- **No WebSocket**: All game data flows over WebRTC DataChannels. HTTP POST for signaling only.
- **ECS pattern**: New features = new components + systems. Don't put logic in Game.ts.
- **PixiJS rendering**: Client uses PixiJS v8 for 2D isometric. No Babylon.js.
- **Tiled maps**: World is hand-crafted in Tiled editor format. Maps in `public/maps/`, tilesets in `public/tilesets/`.
- **Memory**: Clean up Maps/Sets on entity removal. Destroy PixiJS display objects.
- **Sleep optimization**: All entities sleep when no player is within 32 tiles.

## Common Issues
- **DataChannel timeout**: Check server is running. Check browser (ungoogled Chromium blocks WebRTC).
- **NPCs not spawning**: Check spawn-points.ts. Server logs show `[SpawnPoint]` on spawn.
- **Position not syncing**: Check numericIdMap in StateSync — hash mismatch between server/client.
- **Port 8000 stuck**: `lsof -ti:8000 | xargs kill -9`
- **Drizzle schema changes**: `cd packages/server && DATABASE_URL="..." bunx drizzle-kit push`
