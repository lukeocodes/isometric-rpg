---
phase: 12
slug: procedural-background-music
status: draft
nyquist_compliant: false
wave_0_complete: false
created: 2026-03-20
---

# Phase 12 — Validation Strategy

> Per-phase validation contract for feedback sampling during execution.

---

## Test Infrastructure

| Property | Value |
|----------|-------|
| **Framework** | vitest (existing) |
| **Config file** | packages/client/vitest.config.ts |
| **Quick run command** | `cd packages/client && npx vitest run src/audio/__tests__/ --reporter=verbose` |
| **Full suite command** | `cd packages/client && npx vitest run` |
| **Estimated runtime** | ~8 seconds |

---

## Sampling Rate

- **After every task commit:** Run `cd packages/client && npx vitest run src/audio/__tests__/ --reporter=verbose`
- **After every plan wave:** Run `cd packages/client && npx vitest run`
- **Before `/gsd:verify-work`:** Full suite must be green
- **Max feedback latency:** 8 seconds

---

## Per-Task Verification Map

| Task ID | Plan | Wave | Requirement | Test Type | Automated Command | File Exists | Status |
|---------|------|------|-------------|-----------|-------------------|-------------|--------|
| 12-01-01 | 01 | 1 | AUDIO-03 | unit | `vitest run src/audio/__tests__/TrackRegistry.test.ts` | ❌ W0 | ⬜ pending |
| 12-01-02 | 01 | 1 | AUDIO-03 | unit | `vitest run src/audio/__tests__/SampleCache.test.ts` | ❌ W0 | ⬜ pending |
| 12-02-01 | 02 | 2 | AUDIO-03 | unit | `vitest run src/audio/__tests__/ProceduralTrack.test.ts` | ❌ W0 | ⬜ pending |
| 12-03-01 | 03 | 3 | AUDIO-03 | unit | `vitest run src/audio/__tests__/CombatMusic.test.ts` | ❌ W0 | ⬜ pending |

*Status: ⬜ pending · ✅ green · ❌ red · ⚠️ flaky*

---

## Wave 0 Requirements

- [ ] `packages/client/src/audio/__tests__/TrackRegistry.test.ts` — stubs for track registration, lookup
- [ ] `packages/client/src/audio/__tests__/SampleCache.test.ts` — stubs for LRU cache, eviction
- [ ] `packages/client/src/audio/__tests__/ProceduralTrack.test.ts` — stubs for phrase selection, BPM drift
- [ ] `packages/client/src/audio/__tests__/CombatMusic.test.ts` — stubs for BPM scaling, boss phases
- [ ] Mock for Tone.Sampler (extends existing tone mock from Phase 11)

---

## Manual-Only Verifications

| Behavior | Requirement | Why Manual | Test Instructions |
|----------|-------------|------------|-------------------|
| Town music sounds warm with correct instruments | AUDIO-03 | Perceptual quality | Enter town zone, listen for acoustic guitar/flute per AUDIO-PLAN |
| Exploration biomes sound distinct | AUDIO-03 | Perceptual quality | Walk between biomes, verify audible difference in scale/instruments |
| Combat BPM scales with enemy count | AUDIO-03 | Real-time tempo perception | Aggro 1 enemy vs 3, verify tempo increase |
| Boss HP phase transitions | AUDIO-03 | Audio phase change perception | Trigger boss state, simulate HP thresholds |
| Crossfade between states is smooth | AUDIO-03 | Perceptual quality | Force state transitions, verify no jarring cuts |
| Procedural variation audible between visits | AUDIO-03 | Perceptual quality | Enter same zone twice, verify melody differs |

---

## Validation Sign-Off

- [ ] All tasks have `<automated>` verify or Wave 0 dependencies
- [ ] Sampling continuity: no 3 consecutive tasks without automated verify
- [ ] Wave 0 covers all MISSING references
- [ ] No watch-mode flags
- [ ] Feedback latency < 8s
- [ ] `nyquist_compliant: true` set in frontmatter

**Approval:** pending
