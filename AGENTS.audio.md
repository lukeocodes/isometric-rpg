# Audio

**Status: design, not yet implemented in the current client.** The old Babylon.js client had a working audio stack (4-bus gain, 7-state music machine, procedural melody engine, account-level preferences); its source lives in `packages/client-old/src/audio/` as salvage reference. The current Excalibur.js client has no audio code yet.

No server-side audio work is needed — audio is purely a client concern. Server just emits events (`ENEMY_NEARBY`, `ZONE_MUSIC_TAG`) that drive the client's music state machine.

## Deep-dive

- [`docs/audio.md`](docs/audio.md) — full blueprint covering:
  - **Tech stack** — Tone.js for synthesis + Web Audio API for mixing/spatial + Howler.js for one-shots.
  - **Background music** — per-town / capital / dungeon / biome / combat designs with scale/mode, instruments, stems, procedural variation rules.
  - **SFX** — weather (rain/wind noise synthesis), combat (3 intensity tiers per category), movement (per-surface footsteps), progression stingers.
  - **Ambient** — stochastic creature / NPC / monster sounds per biome with `PannerNode` spatial positioning.
  - **Acoustic occlusion** — 4 reverb profiles (dry / room / hall / cave), per-bus low-pass occlusion filter driven by zone acoustic tags, smooth transitions on door crossings.
  - **Music state machine** — Exploring → Enemy Nearby → Combat → Victory Stinger. Boss fight overrides state machine.
  - **Implementation notes** — Tone.Transport for BPM, beat-quantised crossfades, separate audio graph for weather, master intensity variable.

## Rules (once implemented)

- Tone.js owns the AudioContext. Howler.js routes through Tone's context.
- All volume changes use AudioParam automation (no clicks/pops).
- Server-authoritative triggers — zone tags + combat state + enemy proximity all flow from server events.
- Per-account audio preferences stored as JSONB.
- Crossfades quantised to beat boundaries via `Tone.Transport`.
