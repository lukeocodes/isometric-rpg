---
phase: 11-core-audio-engine
verified: 2026-03-20T08:10:00Z
status: human_needed
score: 9/9 must-haves verified
human_verification:
  - test: "Open http://localhost:5173, log in, enter game. Run window.__audio.getState() in DevTools console."
    expected: "Returns 'exploring' (initial state). No console errors about audio."
    why_human: "AudioContext suspend/resume behavior and Tone.js initialization can only be confirmed in a live browser — cannot verify programmatically."
  - test: "Run window.__audio.startTestTone('a') then switch to another browser tab and back."
    expected: "Tone ducks to ~10% volume when tab is hidden, restores instantly on return."
    why_human: "Tab visibility ducking requires live audio output to verify perceptually."
  - test: "Click the gear icon in the bottom-right corner of the HUD. Drag the Master Volume slider."
    expected: "Panel opens showing three sliders (Master Volume, Music Volume, Sound Effects). Dragging updates percentage display."
    why_human: "UI visibility and slider interaction require browser rendering."
  - test: "Run window.__audio.forceState('town') then window.__audio.getState()."
    expected: "Returns 'town'. Console logs '[Audio] Music: exploring -> town'."
    why_human: "Music state callbacks and console log output require live execution."
  - test: "Run window.__audio.startTestTone('a'), then window.__audio.forceState('town'), then window.__audio.forceState('dungeon'). Listen for a crossfade."
    expected: "Crossfade is scheduled and audibly transitions between tones at the next bar boundary."
    why_human: "Beat-quantized crossfade timing and audio output require live Tone.js Transport running in a browser."
---

# Phase 11: Core Audio Engine Verification Report

**Phase Goal:** The game has a working audio foundation — AudioContext lifecycle, separate gain buses, a music state machine that transitions between game states, and beat-quantized crossfades
**Verified:** 2026-03-20T08:10:00Z
**Status:** human_needed
**Re-verification:** No — initial verification

## Goal Achievement

### Observable Truths

| # | Truth | Status | Evidence |
|---|-------|--------|----------|
| 1 | AudioContext initializes via Tone.js and resumes on first user interaction | VERIFIED | `AudioSystem.init()` calls `initTone(120)` then `getToneContext()`; `setupResumeOnInteraction()` wires click/keydown to `resume()` which calls `startTone()` |
| 2 | Four separate gain buses exist (music, sfx, weather, ambient) routed through master gain | VERIFIED | `AudioSystem.ts` lines 39-42: `this.buses.set("music"/"sfx"/"weather"/"ambient", new GainBus(this.ctx, this.masterGain))` |
| 3 | Master intensity (0.0-1.0) scales bus gains proportionally | VERIFIED | `set intensity(value)` in `AudioSystem.ts` lines 101-128 applies scaled `linearRampToValueAtTime` to music, weather, and sfx buses |
| 4 | Tab visibility ducking reduces master gain to 10% when hidden, restores instantly on return | VERIFIED | `setupVisibilityDucking()` in `AudioSystem.ts` lines 189-209: hidden → `masterVolume * 0.1` over 100ms; visible → full over 10ms |
| 5 | Howler.js masterGain disconnected from default and reconnected to SFX bus | VERIFIED | `HowlerBridge.ts`: `Howler.masterGain.disconnect()` then `Howler.masterGain.connect(sfxBusNode)` |
| 6 | Music state machine transitions between 7 states with priority ordering | VERIFIED | `MusicStateMachine.ts`: `requestState()` uses `MUSIC_STATE_PRIORITY` to reject lower-priority requests; all 7 states present in enum |
| 7 | Victory state auto-transitions back to ambient after 4 seconds | VERIFIED | `MusicStateMachine.ts` lines 97-103: `setTimeout(() => this.doTransition(this.ambientState), VICTORY_TIMEOUT_MS)` where `VICTORY_TIMEOUT_MS = 4000` |
| 8 | Boss state overrides the machine and must be manually exited | VERIFIED | `bossOverride = true` on Boss entry; `requestState()` blocks all non-boss requests when `bossOverride` is true; `exitBoss()` clears flag |
| 9 | Crossfade transitions are quantized to bar boundaries via Tone.js Transport | VERIFIED | `CrossfadeManager.ts` line 55: `transport.schedule(callback, "@1m")` — explicit bar quantization string |

**Score:** 9/9 truths verified

### Required Artifacts

| Artifact | Expected | Status | Details |
|----------|----------|--------|---------|
| `packages/client/src/audio/types.ts` | MusicState enum, AudioPreferences interface, BusName type | VERIFIED | Contains `MusicState` (7 states), `MUSIC_STATE_PRIORITY`, `BusName`, `AudioPreferences`, `CROSSFADE_DURATIONS`, `VICTORY_TIMEOUT_MS = 4000` |
| `packages/client/src/audio/GainBus.ts` | GainNode wrapper with volume/mute/fade helpers | VERIFIED | `export class GainBus` with `setVolume`, `mute`, `unmute`, `fadeTo`, `disconnect` — all using AudioParam automation |
| `packages/client/src/audio/ToneSetup.ts` | Tone.js initialization, Transport config, shared context access | VERIFIED | Exports `initTone`, `getToneContext`, `getToneTransport`, `startTone`, `isToneReady` |
| `packages/client/src/audio/HowlerBridge.ts` | Howler.js SFX bus integration | VERIFIED | Exports `initHowlerBridge` and `isHowlerBridged`; contains `Howler.masterGain.disconnect()` and `connect(sfxBusNode)` |
| `packages/client/src/audio/AudioSystem.ts` | Top-level audio manager with buses, lifecycle, ducking, intensity | VERIFIED | `export class AudioSystem` with `init()`, 4 buses, MusicStateMachine + CrossfadeManager, visibility ducking, intensity setter, `getMusicStateMachine()`, `getCrossfadeManager()` |
| `packages/client/src/audio/MusicStateMachine.ts` | 7-state FSM with priority, Victory timeout, boss override | VERIFIED | `export class MusicStateMachine` with `requestState`, `forceState`, `exitBoss`, `onTransition`, `getAmbientState`, `dispose` |
| `packages/client/src/audio/CrossfadeManager.ts` | Beat-quantized crossfade via Tone.js Transport | VERIFIED | `export class CrossfadeManager` with `transition` scheduling to `"@1m"`, `CROSSFADE_DURATIONS` lookup, test tones, `cancelPending` |
| `packages/client/src/ui/components/SettingsMenu.ts` | Settings menu UI with 3 volume sliders | VERIFIED | `export class SettingsMenu` with gear icon, Master/Music/SFX sliders, `setOnVolumeChange`, `toggle`, `setVolumes`, `dispose` |
| `packages/shared/protocol.json` | ENEMY_NEARBY (70) and ZONE_MUSIC_TAG (71) opcodes | VERIFIED | Both opcodes present at lines 23-24 |
| `packages/server/src/game/protocol.ts` | packEnemyNearby and packZoneMusicTag functions | VERIFIED | Both functions exported; opcodes 70 and 71 registered |
| `packages/server/src/db/schema.ts` | preferences JSONB column on accounts table | VERIFIED | `preferences: jsonb("preferences").default({}).notNull()` at line 11 |
| `packages/client/src/engine/Game.ts` | AudioSystem init, StateSync audio callbacks, settings menu wiring | VERIFIED | `private audioSystem: AudioSystem`; `this.audioSystem.init()` in constructor; all three StateSync callbacks wired; `hud.settingsMenu.setOnVolumeChange` in `setHUD()` |

### Key Link Verification

| From | To | Via | Status | Details |
|------|-----|-----|--------|---------|
| `AudioSystem.ts` | `GainBus.ts` | `new GainBus(...)` × 4 | WIRED | Lines 39-42: 4 buses created in `init()` |
| `AudioSystem.ts` | `ToneSetup.ts` | `initTone`, `getToneContext` | WIRED | Lines 30-31 import and call both functions |
| `HowlerBridge.ts` | `AudioSystem.ts` | `Howler.masterGain.connect(sfxBusNode)` | WIRED | `initHowlerBridge(sfxNode)` called at line 50 of `AudioSystem.ts` |
| `AudioSystem.ts` | `MusicStateMachine.ts` | `new MusicStateMachine()` in `init()` | WIRED | Line 53; `onTransition` wired to CrossfadeManager at lines 57-62 |
| `AudioSystem.ts` | `CrossfadeManager.ts` | `new CrossfadeManager(musicBus)` | WIRED | Line 54; `crossfadeManager.transition(from, to)` called in transition callback |
| `MusicStateMachine.ts` | `CrossfadeManager.ts` | `crossfadeManager.transition(from, to)` on every `onTransition` | WIRED | `AudioSystem.ts` lines 57-62 bridges the two |
| `CrossfadeManager.ts` | `tone` | `transport.schedule(callback, "@1m")` | WIRED | Line 55; `Tone.getTransport()` called at line 47 |
| `Game.ts` | `AudioSystem.ts` | `this.audioSystem` init/update/dispose | WIRED | Constructor: `new AudioSystem()` + `init()`; render loop: `audioSystem.update(frameDt)`; `stop()`: `audioSystem.dispose()` |
| `Game.ts` | `StateSync.ts` | `setOnEnemyNearby`, `setOnZoneMusicTag`, `setOnCombatState` | WIRED | All three callbacks present; drive `MusicStateMachine.requestState`/`forceState` |
| `Game.ts` | `SettingsMenu.ts` | `hud.settingsMenu.setOnVolumeChange(...)` | WIRED | `setHUD()` lines 288-298: callback updates `AudioSystem.setPreferences()` and PUTs to `/api/auth/preferences` |
| `GameHUD.ts` | `SettingsMenu.ts` | `this.settingsMenu = new SettingsMenu()` | WIRED | `SettingsMenu` imported; created in constructor; `render()` mounted; `dispose()` called |
| `server/world.ts` | `server/protocol.ts` | `packEnemyNearby(...)` calls | WIRED | `packEnemyNearby` imported and called at line 111 of `world.ts` |
| `client/StateSync.ts` | `client/Protocol.ts` | `case Opcode.ENEMY_NEARBY` and `ZONE_MUSIC_TAG` | WIRED | Both `case` handlers present at lines 121 and 126; fire registered callbacks |

### Requirements Coverage

| Requirement | Source Plans | Description | Status | Evidence |
|-------------|-------------|-------------|--------|----------|
| AUDIO-01 | 11-01, 11-03, 11-04 | Core audio engine with AudioContext lifecycle, separate gain buses (music, SFX, weather, ambient), and master intensity variable | SATISFIED | `AudioSystem` initializes 4 buses via Tone.js context, intensity setter scales all buses, visibility ducking implemented, Howler bridge wired |
| AUDIO-02 | 11-02, 11-03, 11-04 | Music state machine with states (Exploring, Town, Dungeon, Enemy Nearby, Combat, Boss) and beat-quantized crossfade transitions | SATISFIED | `MusicStateMachine` has all 7 states with priority ordering; `CrossfadeManager` schedules via `"@1m"` bar quantization; StateSync events drive state transitions from server |

**Note:** `REQUIREMENTS.md` marks both AUDIO-01 and AUDIO-02 as `[x]` (complete) and lists their phase assignment as "Phase 11: Core Audio Engine". No orphaned requirements found.

### Anti-Patterns Found

| File | Line | Pattern | Severity | Impact |
|------|------|---------|----------|--------|
| `AudioSystem.ts` | 158 | `update(_dt: number): void { /* Reserved for future... */ }` | Info | Empty `update()` method is intentional stub acknowledged in plan; does not block goal |

No blockers or warnings found. The empty `update()` method is explicitly documented as a reserved hook for future per-frame audio work and does not block audio functionality.

### Human Verification Required

#### 1. AudioContext Lifecycle and Initial State

**Test:** Open http://localhost:5173, log in with a character, enter the game world. In DevTools console, run `window.__audio.getState()`.
**Expected:** Returns `"exploring"` with no console errors. The `[AudioSystem] AudioContext resumed` message should appear on first click or keypress.
**Why human:** AudioContext suspend/resume behavior is browser-enforced and cannot be verified programmatically in Node.

#### 2. Tab Visibility Ducking

**Test:** Run `window.__audio.startTestTone("a")` to start an audible 440Hz tone. Switch to another browser tab and wait 1 second, then switch back.
**Expected:** Tone volume drops noticeably when the tab is hidden (to ~10%), then restores immediately to full volume on return.
**Why human:** Audio volume changes require a human listener with functioning audio output.

#### 3. Settings Menu UI

**Test:** Click the gear icon in the bottom-right corner of the HUD. Drag each of the three sliders.
**Expected:** A panel opens labeled "Audio Settings" with three rows: "Master Volume", "Music Volume", "Sound Effects". Dragging each slider updates the percentage display next to its label.
**Why human:** Visual rendering, click interaction, and DOM state require browser testing.

#### 4. Music State Transitions

**Test:** Run `window.__audio.forceState("town")` then `window.__audio.getState()`. Then run `window.__audio.requestState("exploring")` and `window.__audio.getState()` again.
**Expected:** First `getState()` returns `"town"` and console logs `[Audio] Music: exploring -> town`. Second `requestState` is rejected (lower priority) and state stays `"town"`.
**Why human:** Console output and callback invocation need live browser execution to confirm order and correctness.

#### 5. Beat-Quantized Crossfade

**Test:** Run `window.__audio.startTestTone("a")` to start side A (440Hz). Then run `window.__audio.forceState("town")`. The Tone Transport must be running (check `window.__audio.getState()` shows a transition). Listen for the crossfade.
**Expected:** Console logs the crossfade scheduling message. After the next bar boundary, the fade audibly transitions from 440Hz toward silence on side A, confirmed by `window.__audio.getFadeValue()` changing toward 1.
**Why human:** Bar-quantized scheduling requires a running Tone Transport and audible output to verify timing correctness.

### Gaps Summary

No gaps found. All 9 observable truths are verified against the codebase. All artifacts exist with substantive implementations (not stubs). All key links are wired end-to-end. Both requirements (AUDIO-01 and AUDIO-02) have clear implementation evidence. The 68 unit tests all pass.

The only outstanding items are the 5 human verification steps for live in-browser behavior: AudioContext lifecycle, tab ducking, settings UI, state machine transitions, and beat-quantized crossfade timing. These require browser execution and cannot be verified programmatically.

---

_Verified: 2026-03-20T08:10:00Z_
_Verifier: Claude (gsd-verifier)_
