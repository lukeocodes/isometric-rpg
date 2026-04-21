# Testing — index

Integration testing uses Playwright MCP + the dev-only `window.__game` / `window.__builder` hooks. Unit tests use Vitest in `packages/server` (37 test files at last count). The client package currently has no unit-test setup.

## Supplemental docs

- [`docs/testing-playwright.md`](docs/testing-playwright.md) — current reality vs aspirational API, builder-testing path, combat loop (aspirational), multi-tab patterns, cron loop, known constraints.

## At-a-glance

- Dev login is hard-coded in `main.ts` as `lukeocodes` / `password` — no login screen; just navigate to `http://localhost:5173`.
- `window.__game` is the raw Excalibur `Engine` for now (the old helper API isn't re-ported).
- `window.__builder = { game, net, scene, tiles }` on `/builder.html` is the working test surface right now.
- Prefer installed Chrome over Playwright's bundled Chromium — DataChannel negotiation is flaky in the bundled browser.
- Ungoogled Chromium blocks WebRTC entirely.
- Server tests: `cd packages/server && bunx vitest run`.
