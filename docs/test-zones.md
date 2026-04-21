# Test zones (debug teleport keys 1–9)

Press `1`-`9` in-game to teleport to a Mana Seed sample map for art preview. Server-validated `ZONE_CHANGE_REQUEST` with `{ targetZoneId }`. See `tools/import-test-zones.ts` + the `zones` DB table (`test_slot` column) for the zone table.

| Key | Zone | Numeric ID | Size | Notes |
|---|---|---|---|---|
| 1 | Summer Forest sample    | 101 | 32×32 | |
| 2 | Summer Waterfall demo   | 102 | 22×13 | animated water |
| 3 | Spring Forest sample    | 103 | 32×32 | |
| 4 | Autumn Forest sample    | 104 | 32×32 | |
| 5 | Winter Forest sample    | 105 | 32×32 | |
| 6 | Thatch Roof Home        | 106 | 15×14 | interior |
| 7 | Timber Roof Home        | 107 | 15×14 | interior |
| 8 | Half-Timber Home        | 108 | 15×14 | interior |
| 9 | Stonework Home          | 109 | 15×14 | interior |

Test zones are walk-anywhere (no collision layer). They have no NPCs / items / exits. Use them purely to inspect art at different seasons + interior tilesets.

## Import / update

```bash
bun tools/import-test-zones.ts
```

Reads `assets/20.xxx/sample map/*.tmx`, copies TMX + referenced TSX files + image PNGs into `packages/client/public/maps/test-zones/<slug>/` as a self-contained bundle. Also emits a minimal `map.json` (all-walkable, centre spawn) for server-side bounds.

Run this after updating the Mana Seed source samples. The zone rows themselves live in the `zones` DB table (unique `numeric_id`, `test_slot` for the 1-9 keybind); add or edit rows directly (admin UI or raw SQL) — the old `tools/seed-zones.ts` script was deleted along with its placeholder gameplay data.
