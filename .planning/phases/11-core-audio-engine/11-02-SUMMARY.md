---
phase: 11-core-audio-engine
plan: 02
subsystem: audio
tags: [music-state-machine, crossfade, tone.js, vitest, finite-state-machine]

# Dependency graph
requires:
  - phase: 11-01
    provides: AudioSystem, GainBus, ToneSetup, types (MusicState enum, CROSSFADE_DURATIONS, VICTORY_TIMEOUT_MS)
provides:
  - MusicStateMachine class with 7-state priority-based FSM, boss override, and Victory auto-timeout
  - CrossfadeManager class with bar-quantized transition scheduling via Tone.js Transport
  - Test tone support (440Hz/330Hz sine) for crossfade verification
affects: [11-03, 11-04, 12]

# Tech tracking
tech-stack:
  added: []
  patterns: [priority-based-fsm, bar-quantized-crossfade, tone-transport-scheduling, function-constructor-mocks]

key-files:
  created:
    - packages/client/src/audio/MusicStateMachine.ts
    - packages/client/src/audio/CrossfadeManager.ts
    - packages/client/src/audio/__tests__/MusicStateMachine.test.ts
    - packages/client/src/audio/__tests__/CrossfadeManager.test.ts
  modified: []

key-decisions:
  - "MusicStateMachine is pure state logic with no audio dependencies, enabling clean unit testing without mocking Tone.js"
  - "CrossfadeManager uses function() constructors in vi.mock for Tone.js classes to support new operator in tests"
  - "Victory state uses setTimeout (not Tone.Transport) since 4s timeout is game logic, not musical timing"

patterns-established:
  - "FSM pattern: priority-based requestState() with forceState() escape hatch for server-authoritative overrides"
  - "Tone.js mock pattern: function() constructors with Object.assign for class mocks, import * for spy assertions"
  - "CrossFade A/B side tracking: currentSide flips on each transition to alternate between inputs"

requirements-completed: [AUDIO-02]

# Metrics
duration: 4min
completed: 2026-03-20
---

# Phase 11 Plan 02: Music State Machine and Crossfade Manager Summary

**7-state priority FSM with boss override and Victory timeout, plus bar-quantized Tone.js CrossFade scheduling with test tones**

## Performance

- **Duration:** 4 min
- **Started:** 2026-03-20T00:48:35Z
- **Completed:** 2026-03-20T00:52:36Z
- **Tasks:** 2
- **Files modified:** 4 (4 created, 0 modified)

## Accomplishments
- Built MusicStateMachine with 7 states (Exploring, Town, Dungeon, EnemyNearby, Combat, Boss, Victory) and strict priority ordering
- Implemented boss override that blocks all non-boss requests until manually exited via exitBoss()
- Victory state auto-transitions back to stored ambient state after 4000ms timeout
- Built CrossfadeManager with Tone.js Transport "@1m" bar-quantized scheduling
- Crossfade duration lookup by transition key (e.g., "exploring_to_town" = 3.0s) with "default" fallback
- Test tone support at 440Hz (side A) and 330Hz (side B) for verification in Phase 12
- All 51 unit tests passing (32 MusicStateMachine + 19 CrossfadeManager)

## Task Commits

Each task was committed atomically:

1. **Task 1 RED: Failing MusicStateMachine tests** - `737d364` (test)
2. **Task 1 GREEN: Implement MusicStateMachine** - `8e4f101` (feat)
3. **Task 2 RED: Failing CrossfadeManager tests** - `0920169` (test)
4. **Task 2 GREEN: Implement CrossfadeManager** - `d3d6706` (feat)

_Note: TDD tasks have separate test and implementation commits._

## Files Created/Modified
- `packages/client/src/audio/MusicStateMachine.ts` - 7-state FSM with priority ordering, boss override, Victory timeout, forceState for server overrides
- `packages/client/src/audio/CrossfadeManager.ts` - Bar-quantized crossfade via Tone.js Transport, A/B side tracking, test tone synths
- `packages/client/src/audio/__tests__/MusicStateMachine.test.ts` - 32 tests covering transitions, priority, boss, victory timeout, ambient tracking, callbacks
- `packages/client/src/audio/__tests__/CrossfadeManager.test.ts` - 19 tests covering scheduling, duration lookup, cancel, test tones, dispose

## Decisions Made
- MusicStateMachine is pure state logic with zero audio dependencies, enabling clean unit testing with only vi.useFakeTimers() for the Victory timeout
- CrossfadeManager test mocks use function() constructors (not arrow functions) for Tone.js classes because vi.fn with arrow functions cannot be used with the `new` operator
- Victory timeout uses setTimeout (game logic timing) rather than Tone.Transport.scheduleOnce (musical timing), since the 4s delay is a game design constant not a musical value

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 1 - Bug] Fixed Tone.js mock constructors in CrossfadeManager tests**
- **Found during:** Task 2 (TDD GREEN phase)
- **Issue:** vi.fn(() => ({...})) arrow functions cannot be used with `new` operator, causing "is not a constructor" error
- **Fix:** Changed to vi.fn(function(this) { Object.assign(this, ...); }) pattern for CrossFade and Synth mocks
- **Files modified:** packages/client/src/audio/__tests__/CrossfadeManager.test.ts
- **Verification:** All 19 CrossfadeManager tests pass
- **Committed in:** d3d6706 (Task 2 GREEN commit)

**2. [Rule 1 - Bug] Fixed require("tone") spy detection in CrossfadeManager tests**
- **Found during:** Task 2 (TDD GREEN phase)
- **Issue:** Using require("tone") to access mocked constructors lost spy metadata; toHaveBeenCalled() failed
- **Fix:** Changed to import * as Tone from "tone" and used Tone.CrossFade / Tone.Synth directly in assertions
- **Files modified:** packages/client/src/audio/__tests__/CrossfadeManager.test.ts
- **Verification:** All 19 CrossfadeManager tests pass
- **Committed in:** d3d6706 (Task 2 GREEN commit)

---

**Total deviations:** 2 auto-fixed (2 bugs in test mocking)
**Impact on plan:** Both fixes were necessary for test mock compatibility with vitest's module mocking system. No scope creep.

## Issues Encountered
None beyond the mock constructor issues documented above.

## User Setup Required
None - no external service configuration required.

## Next Phase Readiness
- MusicStateMachine and CrossfadeManager are complete and tested
- Ready for Plan 11-03: Settings menu UI with volume sliders and server-side preferences persistence
- Ready for Plan 11-04: Game.ts wiring to connect FSM to StateSync events and CrossfadeManager to music bus

## Self-Check: PASSED

All 4 created files verified present. All 4 commits verified in git log.

---
*Phase: 11-core-audio-engine*
*Completed: 2026-03-20*
