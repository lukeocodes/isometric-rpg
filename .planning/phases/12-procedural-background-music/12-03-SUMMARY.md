---
phase: 12-procedural-background-music
plan: 03
subsystem: audio
tags: [tone.js, procedural-music, web-audio, tracks, combat, boss, exploration]

# Dependency graph
requires:
  - phase: 12-01
    provides: SampleCache LRU, scales module, types/InstrumentKey definitions
  - phase: 12-02
    provides: BaseTrack lifecycle, PhraseEngine, ProximityMixer, TrackRegistry
provides:
  - 16 music track definitions covering all game states (town, dungeon, exploration, combat, boss, enemy-nearby, victory)
  - registerAllTracks() function to bulk-register tracks with TrackRegistry
  - BossFightTrack with 3 HP-phase stem management
  - CombatTrack with enemy-count BPM scaling (130-155)
  - EnemyNearbyTrack with distance-based tension scaling
  - VictoryStinger one-shot fanfare
affects: [12-04-music-content-manager, audio-integration]

# Tech tracking
tech-stack:
  added: []
  patterns: [track-extends-basetrack, phrase-engine-per-stem, proximity-mixer-for-zone-stems, hp-phase-stem-management, bpm-ramp-scaling]

key-files:
  created:
    - packages/client/src/audio/music/tracks/HumanTownTrack.ts
    - packages/client/src/audio/music/tracks/ElfTownTrack.ts
    - packages/client/src/audio/music/tracks/DwarfTownTrack.ts
    - packages/client/src/audio/music/tracks/HumanCapitalTrack.ts
    - packages/client/src/audio/music/tracks/ElfCapitalTrack.ts
    - packages/client/src/audio/music/tracks/DwarfCapitalTrack.ts
    - packages/client/src/audio/music/tracks/SoloDungeonTrack.ts
    - packages/client/src/audio/music/tracks/GroupDungeonTrack.ts
    - packages/client/src/audio/music/tracks/GrasslandsTrack.ts
    - packages/client/src/audio/music/tracks/ForestTrack.ts
    - packages/client/src/audio/music/tracks/DesertTrack.ts
    - packages/client/src/audio/music/tracks/MountainsTrack.ts
    - packages/client/src/audio/music/tracks/CombatTrack.ts
    - packages/client/src/audio/music/tracks/BossFightTrack.ts
    - packages/client/src/audio/music/tracks/EnemyNearbyTrack.ts
    - packages/client/src/audio/music/tracks/VictoryStinger.ts
    - packages/client/src/audio/music/tracks/index.ts
    - packages/client/src/audio/__tests__/BossFightTrack.test.ts
  modified: []

key-decisions:
  - "BossFightTrack exposes getPhaseState() for testable phase inspection without accessing private gain nodes"
  - "EnemyNearbyTrack uses setInterval for heartbeat (game-logic timing) rather than Tone.Transport scheduling"
  - "VictoryStinger uses setTimeout for auto-stop (3s) since it is a one-shot, not a musical loop"

patterns-established:
  - "Track pattern: extends BaseTrack, accepts SampleCache in constructor, loads instruments in start(), creates PhraseEngines per stem"
  - "HP-phase pattern: updateBossPhase() uses linearRampToValueAtTime with 3-second duration for smooth stem transitions"
  - "BPM scaling pattern: updateEnemyCount() uses Transport.bpm.rampTo() with formula 130 + min(4, max(0, count-1)) * 6.25"

requirements-completed: [AUDIO-03]

# Metrics
duration: 8min
completed: 2026-03-20
---

# Phase 12 Plan 03: Track Definitions Summary

**16 procedural music tracks with race-specific instruments, biome-specific scales, combat BPM scaling, boss HP-phase stems, and proximity-based layers**

## Performance

- **Duration:** 8 min
- **Started:** 2026-03-20T13:22:19Z
- **Completed:** 2026-03-20T13:30:10Z
- **Tasks:** 2 (+ TDD red/green sub-commits)
- **Files modified:** 18

## Accomplishments
- Created 6 town tracks with race-specific instruments (guitar/flute for human, dulcimer/panFlute for elf, tuba/trombone for dwarf) and proximity stems for zone-specific ambience
- Created 2 dungeon tracks (solo: sparse cello over diminished scale; group: full percussion with chromatic brass)
- Created 4 exploration biome tracks with distinct scales (G Mixolydian grasslands, A Dorian forest, D Phrygian desert, E minor mountains)
- Created CombatTrack with enemy-count BPM scaling (130-155 range via Transport.bpm.rampTo)
- Created BossFightTrack with 3 HP-threshold phases (>60%, 30-60%, <30%) managing choir+distortion stem layers with 3-second gain ramps
- Created EnemyNearbyTrack with distance-based heartbeat rate/volume scaling
- Created VictoryStinger as one-shot Tone.Part ascending C Major arpeggio
- Created index.ts with registerAllTracks() registering all 16 tracks with correct MusicState and zoneTag
- Elf tracks use variable phrase lengths (7-bar for ElfTown, 9-bar for ElfCapital)

## Task Commits

Each task was committed atomically:

1. **Task 1: Town and dungeon tracks** - `5fc4095` (feat)
2. **Task 2 RED: Failing BossFightTrack test** - `cac87c2` (test)
3. **Task 2 GREEN: All remaining tracks + index + test passing** - `f331599` (feat)

## Files Created/Modified
- `packages/client/src/audio/music/tracks/HumanTownTrack.ts` - C Mixolydian folk with guitar+flute, tavern fiddle + market bustle proximity
- `packages/client/src/audio/music/tracks/ElfTownTrack.ts` - D Dorian ethereal with dulcimer+panFlute, 7-bar phrases, choral proximity
- `packages/client/src/audio/music/tracks/DwarfTownTrack.ts` - A Dorian rhythmic with tuba+trombone, anvil MetalSynth proximity
- `packages/client/src/audio/music/tracks/HumanCapitalTrack.ts` - G Ionian grand with violin+oboe+trumpet, orchestral swell proximity
- `packages/client/src/audio/music/tracks/ElfCapitalTrack.ts` - E Lydian celestial with harp+choir, 9-bar phrases, full choir proximity
- `packages/client/src/audio/music/tracks/DwarfCapitalTrack.ts` - D Phrygian dominant with choir+horn, triumphant brass proximity
- `packages/client/src/audio/music/tracks/SoloDungeonTrack.ts` - B diminished tense with solo cello, sparse FMSynth stabs
- `packages/client/src/audio/music/tracks/GroupDungeonTrack.ts` - F# minor epic with trombone+choir, full percussion
- `packages/client/src/audio/music/tracks/GrasslandsTrack.ts` - G Mixolydian folk with guitar+pennywhistle
- `packages/client/src/audio/music/tracks/ForestTrack.ts` - A Dorian mysterious with marimba+flute, null silence gaps
- `packages/client/src/audio/music/tracks/DesertTrack.ts` - D Phrygian dominant Arabic with shanai+sitar, darbuka percussion
- `packages/client/src/audio/music/tracks/MountainsTrack.ts` - E minor majestic with frenchHorn+cello, wide intervals
- `packages/client/src/audio/music/tracks/CombatTrack.ts` - E minor combat with violin+trumpet, BPM scales 130-155
- `packages/client/src/audio/music/tracks/BossFightTrack.ts` - C# minor boss with 3 HP phases, bass drop stinger
- `packages/client/src/audio/music/tracks/EnemyNearbyTrack.ts` - Atonal tension with heartbeat pulse by distance
- `packages/client/src/audio/music/tracks/VictoryStinger.ts` - One-shot C Major fanfare via Tone.Part
- `packages/client/src/audio/music/tracks/index.ts` - Re-exports all 16 tracks + registerAllTracks()
- `packages/client/src/audio/__tests__/BossFightTrack.test.ts` - 9 tests for HP phase logic

## Decisions Made
- BossFightTrack exposes getPhaseState() for testable phase inspection without needing to mock or access private AudioParam nodes
- EnemyNearbyTrack uses setInterval for heartbeat timing (game-logic pacing, not musical beat alignment) since the heartbeat rate varies dynamically
- VictoryStinger uses setTimeout(3000) for auto-stop since it is a transient one-shot, not a looping musical sequence

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 1 - Bug] Fixed test mock for Tone.getTransport()**
- **Found during:** Task 2 (BossFightTrack test GREEN phase)
- **Issue:** Test used `require("tone")` which returns a different module instance than vitest mock, causing transport.bpm.rampTo to be undefined
- **Fix:** Changed to `import * as Tone from "tone"` and used `Tone.getTransport()` directly
- **Files modified:** packages/client/src/audio/__tests__/BossFightTrack.test.ts
- **Verification:** All 9 tests pass
- **Committed in:** f331599

---

**Total deviations:** 1 auto-fixed (1 bug)
**Impact on plan:** Minor test import fix, no scope creep.

## Issues Encountered
None beyond the test mock issue documented above.

## User Setup Required
None - no external service configuration required.

## Next Phase Readiness
- All 16 track definitions complete and registered via registerAllTracks()
- Ready for Plan 04 (MusicContentManager) to instantiate tracks based on game state transitions
- TrackRegistry can look up any track by MusicState + zoneTag
- Combat/Boss/EnemyNearby tracks expose update methods for dynamic behavior

## Self-Check: PASSED

All 18 created files verified present. All 3 task commits verified in git log.

---
*Phase: 12-procedural-background-music*
*Completed: 2026-03-20*
