# Playwright automated testing

Playwright MCP drives autonomous integration testing against the live client + server. Tests read / drive the game through dev-only hooks on `window` to avoid pixel-clicking canvas elements.

## Current reality check

- **WebRTC DataChannel doesn't come up reliably in Playwright-launched Chromium.** Regular Chrome, Firefox, and Safari work fine; Playwright's bundled Chromium frequently stalls on ICE. AGENTS.game.md blocker — do not rely on Playwright for live-gameplay loops right now.
- **Gameplay data is empty.** NPC templates, items, loot tables, quests, and spawn-points all have **0 rows**. The combat-test loop below assumes an NPC-populated world — it will find zero targets until gameplay data is seeded.
- **The dev helper API on `window.__game` isn't fully re-ported.** Current `packages/client/src/main.ts` exposes only `window.__game = game` (the raw Excalibur `Engine`). The richer `getPlayerPosition` / `move` / `selectTarget` / `toggleAutoAttack` / `waitForEntity` surface from the old PixiJS client has not been rebuilt yet. The rest of this document is aspirational; match it up against current code before writing new tests.
- **Builder testing works today** via `window.__builder` — that's the safe path for Playwright right now.

## Setup

1. Services running: PostgreSQL 5433 + Redis 6379 + server on 8000 + Vite on 5173.
2. Regular Chrome (or whatever Playwright MCP launches — prefer installed Chrome over bundled Chromium).
3. `packages/client/src/main.ts` exposes `window.__game` only in dev builds (default for `vite`).

## Login flow

The current client has **no login UI** — `packages/client/src/main.ts` hard-codes a dev login as `lukeocodes` / `password` and fetches its first character automatically on boot. Just navigate and wait:

```
browser_navigate → http://localhost:5173
browser_wait_for → window.__game !== undefined
```

The loading overlay disappears once the Excalibur engine has started and the WebRTC DataChannel has negotiated. If `window.__game` is still undefined after ~10 seconds, DataChannel negotiation has stalled (see "Known constraints" below).

If you need a different username: edit `devLogin()` in `main.ts`, or re-introduce a proper login screen when the UI work lands (see `AGENTS.game.md` blockers).

## Builder testing (current, working path)

Navigate to `http://localhost:5173/builder.html`. After login, `window.__builder = { game, net, scene, tiles }` is available.

```javascript
async () => {
  const b = window.__builder;
  // Tile picker, tile placement, multi-select are all reachable via DOM events
  // or by calling scene methods directly. See TilePicker.ts for API surface.
  return { ready: !!b.scene, tilesetsLoaded: b.tiles.listTilesets().length };
}
```

## Gameplay combat loop (aspirational — requires API re-port + seeded data)

This is the target shape once `window.__game` grows back its helper API AND the DB has NPC templates / spawn-points to populate the world:

```javascript
async () => {
  const api = window.__game;
  const moveToward = async (tx, tz) => {
    const pos = api.getPlayerPosition();
    const dx = tx - Math.round(pos.x), dz = tz - Math.round(pos.z);
    if (dx === 0 && dz === 0) return;
    api.move(Math.abs(dx) > Math.abs(dz) ? (dx > 0 ? "d" : "a") : (dz > 0 ? "w" : "s"));
    await new Promise(r => setTimeout(r, 400));
  };

  // Find and attack closest NPC
  const npcs = api.getEntityList().filter(e => e.type === "npc" && (e.hp ?? 0) > 0);
  if (npcs.length === 0) return { ok: false, reason: "no NPCs — seed DB first" };

  const pos = api.getPlayerPosition();
  const target = npcs.sort((a, b) =>
    (Math.abs(a.x - pos.x) + Math.abs(a.z - pos.z)) -
    (Math.abs(b.x - pos.x) + Math.abs(b.z - pos.z))
  )[0];

  api.selectTarget(target.id);
  api.toggleAutoAttack(target.id);

  // Walk into melee range
  for (let i = 0; i < 25; i++) {
    const p = api.getPlayerPosition();
    if (Math.max(Math.abs(p.x - target.x), Math.abs(p.z - target.z)) <= 1) break;
    await moveToward(target.x, target.z);
  }

  // Wait for kill
  for (let i = 0; i < 20; i++) {
    await new Promise(r => setTimeout(r, 500));
    if (!api.getEntityById(target.id)) break;
  }

  return api.getPlayerStats();
}
```

Note: in the code above `x` / `z` are the legacy-named axis pair — on the 2D top-down client, `z` maps to the screen `y` axis. Will get cleaned up when the API gets re-ported.

## Multi-player testing

- Use `browser_tabs` action `select` to switch between tabs (index 0 and 1).
- Each tab is a separate player with its own WebRTC connection.
- Verify cross-client visibility once spawn broadcasts work: `api.getEntityList().filter(e => e.type === "player")`.
- Both players should see each other's updated positions.

## Cron loop

`/loop 5m <prompt>` schedules recurring Playwright test rounds. Cancel with `CronDelete <id>`. Historic stability: 50+ combat rounds without server crash on the old PixiJS client; unverified on the new Excalibur client.

## What to verify each round (once gameplay is live)

1. `api.isConnected()` — WebRTC still alive.
2. `api.getEntityList()` — NPCs present (count depends on zone + seed data).
3. Kill an NPC — HP drops to 0, entity despawns.
4. Wait 5–8 s — NPC respawns at a nearby position.
5. `api.getPlayerStats()` — HP stable (regen recovers out of combat).
6. Both tabs see each other's positions.

## Known constraints

- **Ungoogled Chromium:** WebRTC blocked, zero ICE candidates → DataChannel never opens.
- **Playwright bundled Chromium:** DataChannel stalls intermittently. Prefer launching installed Chrome via Playwright channels.
- **`keyboard.press('w')`** sends instant keydown+keyup which the input buffer misses. Use `api.move("w")` once the helper API is back; until then, `api.move()` isn't available.
- **Entity IDs** use u32 hash mapping — if positions aren't updating, check `numericIdMap` in `StateSync` for hash collisions or missing spawns. Note that `handlePositionUpdate` in `GameScene` is still a stub.
- **MCP sandbox flag:** Playwright MCP config lives at `~/.config/opencode/playwright-mcp.json`; set `chromiumSandbox: true` to avoid the `--no-sandbox` performance penalty.
