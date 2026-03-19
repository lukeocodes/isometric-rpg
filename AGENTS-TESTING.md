# Testing Agent Guide

## Playwright Automated Testing Strategy

This project uses Playwright MCP tools for autonomous integration testing. The `PlaywrightAPI` (`window.__game`) provides programmatic access to game internals without pixel-clicking on 3D meshes.

### Setup
1. Both servers must be running (server on 8000, client on 5173)
2. Use **regular Chrome** — ungoogled Chromium blocks WebRTC
3. The API is only available in dev mode (`import.meta.env.DEV`)

### Login Flow
```
browser_navigate → http://localhost:5173
browser_fill_form → username
browser_click → "Sign In"
browser_click → "Continue" (×3 for onboarding, skip if returning user)
browser_click → "Create Character" or "Play"
```

### Combat Test Loop (proven stable for 50+ rounds)
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
    if (!api.getEntityById(target.id)) break; // Dead + despawned
  }

  return api.getPlayerStats(); // Verify HP, check combat state
}
```

### Multi-Player Testing
- Use `browser_tabs` action "select" to switch between tabs (index 0 and 1)
- Each tab is a separate player with its own WebRTC connection
- Verify cross-client visibility: `api.getEntityList().filter(e => e.type === "player")`
- Both players should see each other's updated positions

### Cron Loop Testing
Use `/loop 5m <prompt>` to schedule recurring Playwright test rounds. Cancel with `CronDelete <id>`.

### What to Verify Each Round
1. `api.isConnected()` — WebRTC still alive
2. `api.getEntityList()` — NPCs present (should be 4)
3. Kill an NPC — HP drops to 0, entity despawns
4. Wait 5-8s — NPC respawns at random position
5. `api.getPlayerStats()` — HP stable (47+ after regen)
6. Both tabs see each other's positions

### Known Testing Constraints
- Ungoogled Chromium: WebRTC blocked, zero ICE candidates
- `keyboard.press('w')` sends instant keydown+keyup — use `api.move("w")` instead
- Scene picking requires `@babylonjs/core/Culling/ray` import (side effect)
- Entity IDs use hash mapping — check `numericIdMap` if positions don't update
