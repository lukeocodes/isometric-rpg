---
phase: 11-core-audio-engine
plan: 04
subsystem: audio
tags: [tone.js, web-audio-api, game-integration, state-machine, settings-ui]

requires:
  - phase: 11-core-audio-engine/01
    provides: AudioSystem, GainBus, ToneSetup, HowlerBridge, types
  - phase: 11-core-audio-engine/02
    provides: MusicStateMachine, CrossfadeManager
  - phase: 11-core-audio-engine/03
    provides: ENEMY_NEARBY/ZONE_MUSIC_TAG opcodes, StateSync callbacks, SettingsMenu, audio preferences API
provides:
  - Full audio engine integration in Game.ts lifecycle
  - StateSync combat/enemy/zone callbacks driving music state machine
  - Settings menu volume changes persisted to server
  - Dev __audio console API for testing
affects: [phase-12-procedural-music, phase-13-sfx, phase-14-ambient-occlusion]

tech-stack:
  added: []
  patterns: [game-system-integration, statesync-callback-wiring, dev-api-pattern]

key-files:
  created: []
  modified:
    - packages/client/src/engine/Game.ts
    - packages/client/src/main.ts
    - packages/client/src/audio/AudioSystem.ts
    - packages/client/src/audio/CrossfadeManager.ts

key-decisions:
  - "Combat music only triggers on state changes (wasInCombat transition), not on every repeated COMBAT_STATE message"
  - "JWT key is gameJwt not game_jwt as plan specified"

patterns-established:
  - "Audio callback wiring: StateSync callbacks -> MusicStateMachine.requestState/forceState"
  - "Dev __audio API pattern for browser console testing"

requirements-completed: [AUDIO-01, AUDIO-02]

duration: 8min
completed: 2026-03-20
---

# Plan 11-04: Game Integration Summary

**AudioSystem wired into Game.ts with StateSync combat/enemy/zone callbacks driving 7-state music machine, settings menu persistence, and dev console API**

## Performance

- **Duration:** 8 min
- **Started:** 2026-03-20
- **Completed:** 2026-03-20
- **Tasks:** 2
- **Files modified:** 4

## Accomplishments
- AudioSystem initializes in Game constructor, disposes on stop
- StateSync combat state callback drives MusicStateMachine (Combat on aggro, Victory on combat end)
- Enemy nearby and zone music tag callbacks wired to state machine
- Settings menu volume changes update AudioSystem and persist to server via PUT /api/auth/preferences
- Dev `window.__audio` API exposes getState, forceState, requestState, startTestTone, stopTestTone, setIntensity
- AudioSystem.update() called on render loop

## Task Commits

1. **Task 1: Integrate AudioSystem into Game.ts lifecycle** - `eefee59` (feat)
2. **Task 2: Browser verification checkpoint** - `7ef68f1` (fix: combat state flapping + crossfade debug logging)

## Files Created/Modified
- `packages/client/src/engine/Game.ts` — AudioSystem init/dispose, StateSync callback wiring, settings menu volume handler
- `packages/client/src/main.ts` — Dev `__audio` API with getCurrentSide/getFadeValue helpers
- `packages/client/src/audio/AudioSystem.ts` — getMusicStateMachine/getCrossfadeManager accessors
- `packages/client/src/audio/CrossfadeManager.ts` — Debug logging on crossfade schedule/fire, stopTestTone before restart

## Decisions Made
- Combat/Victory music only triggers on actual state changes (wasInCombat bool comparison) — prevents flapping from repeated COMBAT_STATE messages
- JWT storage key corrected from plan's `game_jwt` to actual codebase `gameJwt`

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 1 - Bug] Combat state flapping between exploring and victory**
- **Found during:** Task 2 (browser verification)
- **Issue:** Server sends COMBAT_STATE with inCombat:false on every tick, causing Victory to trigger repeatedly. Victory auto-transitions to Exploring, then next false triggers Victory again.
- **Fix:** Only trigger Combat on false→true transition, Victory on true→false transition. Compare wasInCombat before updating combat component.
- **Files modified:** packages/client/src/engine/Game.ts
- **Verification:** State stays in "exploring" without flapping
- **Committed in:** 7ef68f1

---

**Total deviations:** 1 auto-fixed (1 bug)
**Impact on plan:** Essential bugfix for correct music state behavior. No scope creep.

## Issues Encountered
- Test tone on side A was inaudible because prior flapping had moved crossfade fade value to 1 (side B). Expected behavior — crossfade position persists across state transitions.

## User Setup Required
None - no external service configuration required.

## Next Phase Readiness
- Audio engine foundation complete — all 4 buses, 7-state music machine, crossfade manager, settings UI
- Phase 12 (Procedural Background Music) can plug Tone.js synths into CrossfadeManager sides
- Phase 13 (Sound Effects) can use Howler.js through the SFX gain bus
- Phase 14 (Ambient/Occlusion) can use weather and ambient buses

---
*Phase: 11-core-audio-engine*
*Completed: 2026-03-20*
