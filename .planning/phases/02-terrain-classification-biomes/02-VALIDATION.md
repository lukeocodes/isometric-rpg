---
phase: 02
slug: terrain-classification-biomes
status: draft
nyquist_compliant: true
wave_0_complete: false
created: 2026-03-19
---

# Phase 02 — Validation Strategy

> Per-phase validation contract for feedback sampling during execution.

---

## Test Infrastructure

| Property | Value |
|----------|-------|
| **Framework** | vitest |
| **Config file** | packages/server/vitest.config.ts (server), packages/client/vitest.config.ts (client, created in Plan 02) |
| **Quick run command** | `cd packages/server && npx vitest run --reporter=verbose` |
| **Full suite command** | `cd packages/server && npx vitest run --reporter=verbose && cd ../client && npx vitest run --reporter=verbose` |
| **Estimated runtime** | ~15 seconds |

---

## Sampling Rate

- **After every task commit:** Run `cd packages/server && npx vitest run --reporter=verbose`
- **After Plan 02 Task 2:** Also run `cd packages/client && npx vitest run src/world/TileRegistry.test.ts --reporter=verbose`
- **After every plan wave:** Run full suite (server + client)
- **Before `/gsd:verify-work`:** Full suite must be green
- **Max feedback latency:** 15 seconds

---

## Per-Task Verification Map

| Task ID | Plan | Wave | Requirement | Test Type | Automated Command | File Exists | Status |
|---------|------|------|-------------|-----------|-------------------|-------------|--------|
| 02-01-01 | 01 | 1 | WORLD-02 | unit (TDD) | `npx vitest run src/world/terrain.test.ts` | TDD self-creates | pending |
| 02-01-02 | 01 | 1 | WORLD-03 | unit (TDD) | `npx vitest run src/world/rivers.test.ts` | TDD self-creates | pending |
| 02-02-01 | 02 | 2 | WORLD-05 | integration | `npx vitest run` (server) | existing tests | pending |
| 02-02-02 | 02 | 2 | WORLD-02 | unit | `npx vitest run src/world/TileRegistry.test.ts` (client) | created in task | pending |
| 02-03-01 | 03 | 3 | WORLD-02 | compilation | `npx tsc --noEmit` (client) | N/A | pending |
| 02-03-02 | 03 | 3 | WORLD-02/05 | manual | visual checkpoint | N/A | pending |

*Status: pending -- green -- red -- flaky*

---

## Wave 0 Requirements

Plan 01 tasks are TDD (`tdd="true"`) and self-create their test files as part of the RED-GREEN-REFACTOR cycle:
- `packages/server/src/world/terrain.test.ts` -- created in 02-01 Task 1 (terrain utilities)
- `packages/server/src/world/rivers.test.ts` -- created in 02-01 Task 2 (river/lake generation)

Plan 02 Task 2 creates its own test file:
- `packages/client/src/world/TileRegistry.test.ts` -- created in 02-02 Task 2 (18 biome tile types)

No separate Wave 0 scaffolding needed -- all test files are created by the tasks that need them.

---

## Manual-Only Verifications

| Behavior | Requirement | Why Manual | Test Instructions |
|----------|-------------|------------|-------------------|
| Stepped elevation renders correctly in isometric view | WORLD-02 | Visual rendering in Babylon.js | Load client, navigate to mountain region, verify 7 discrete height levels with vertical cliff faces |
| Biome tile colors distinguish all 18 types | WORLD-02 | Visual color distinction | Load client, pan across continent, verify each biome type has visually distinct color |
| Movement blocked at terrain boundaries feels right | WORLD-05 | UX feel (silent rejection) | Walk into water/mountain tiles, verify player stops without animation glitch |

---

## Validation Sign-Off

- [x] All tasks have `<automated>` verify or self-create tests (TDD tasks)
- [x] Sampling continuity: no 3 consecutive tasks without automated verify
- [x] No separate Wave 0 needed -- TDD tasks self-create test files
- [x] No watch-mode flags
- [x] Feedback latency < 15s
- [x] `nyquist_compliant: true` set in frontmatter

**Approval:** pending
