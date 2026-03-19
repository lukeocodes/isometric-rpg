---
phase: 02
slug: terrain-classification-biomes
status: draft
nyquist_compliant: false
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
| **Config file** | packages/server/vitest.config.ts |
| **Quick run command** | `cd packages/server && npx vitest run --reporter=verbose` |
| **Full suite command** | `cd packages/server && npx vitest run --reporter=verbose` |
| **Estimated runtime** | ~10 seconds |

---

## Sampling Rate

- **After every task commit:** Run `cd packages/server && npx vitest run --reporter=verbose`
- **After every plan wave:** Run `cd packages/server && npx vitest run --reporter=verbose`
- **Before `/gsd:verify-work`:** Full suite must be green
- **Max feedback latency:** 10 seconds

---

## Per-Task Verification Map

| Task ID | Plan | Wave | Requirement | Test Type | Automated Command | File Exists | Status |
|---------|------|------|-------------|-----------|-------------------|-------------|--------|
| 02-01-01 | 01 | 1 | WORLD-02 | unit | `npx vitest run` | ❌ W0 | ⬜ pending |
| 02-01-02 | 01 | 1 | WORLD-03 | unit | `npx vitest run` | ❌ W0 | ⬜ pending |
| 02-02-01 | 02 | 1 | WORLD-05 | unit | `npx vitest run` | ❌ W0 | ⬜ pending |

*Status: ⬜ pending · ✅ green · ❌ red · ⚠️ flaky*

---

## Wave 0 Requirements

- [ ] `packages/server/src/world/__tests__/rivers.test.ts` — stubs for WORLD-03 river generation
- [ ] `packages/server/src/world/__tests__/lakes.test.ts` — stubs for WORLD-03 lake generation
- [ ] `packages/server/src/world/__tests__/walkability.test.ts` — stubs for WORLD-05 movement blocking
- [ ] `packages/server/src/world/__tests__/tile-types.test.ts` — stubs for WORLD-02 tile expansion

*Existing vitest infrastructure covers framework needs — only test files needed.*

---

## Manual-Only Verifications

| Behavior | Requirement | Why Manual | Test Instructions |
|----------|-------------|------------|-------------------|
| Stepped elevation renders correctly in isometric view | WORLD-02 | Visual rendering in Babylon.js | Load client, navigate to mountain region, verify 7 discrete height levels with vertical cliff faces |
| Biome tile colors distinguish all 16+ types | WORLD-02 | Visual color distinction | Load client, pan across continent, verify each biome type has visually distinct color |
| Movement blocked at terrain boundaries feels right | WORLD-05 | UX feel (silent rejection) | Walk into water/mountain tiles, verify player stops without animation glitch |

---

## Validation Sign-Off

- [ ] All tasks have `<automated>` verify or Wave 0 dependencies
- [ ] Sampling continuity: no 3 consecutive tasks without automated verify
- [ ] Wave 0 covers all MISSING references
- [ ] No watch-mode flags
- [ ] Feedback latency < 10s
- [ ] `nyquist_compliant: true` set in frontmatter

**Approval:** pending
