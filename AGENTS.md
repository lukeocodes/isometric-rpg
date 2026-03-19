# Agent Guidelines

## Server Changes
After modifying server files, the `--watch` flag auto-reloads. If port 8000 is stuck: `lsof -ti:8000 | xargs kill -9`

## Client Changes
Vite HMR picks up most changes instantly. Full reload needed for: vite.config.ts, new dependencies, index.html.

## Testing with Playwright
Use the Playwright MCP tools to drive the game. The dev-only `window.__game` API avoids fragile pixel-clicking on 3D meshes.

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
- **Deep imports**: Always use `@babylonjs/core/Specific/Path`, never `@babylonjs/core`.
- **Memory**: Clean up Maps/Sets on entity removal. Dispose Babylon materials + meshes.
- **Sleep optimization**: All entities sleep when no player is within 32 tiles.

## Common Issues
- **DataChannel timeout**: Check server is running. Check browser (ungoogled Chromium blocks WebRTC).
- **NPCs not spawning**: Check spawn-points.ts. Server logs show `[SpawnPoint]` on spawn.
- **Position not syncing**: Check numericIdMap in StateSync — hash mismatch between server/client.
- **Port 8000 stuck**: `lsof -ti:8000 | xargs kill -9`
- **Drizzle schema changes**: `cd packages/server && DATABASE_URL="..." bunx drizzle-kit push`
