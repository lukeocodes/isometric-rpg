# Procedural audio — design blueprint

**Status: design, not yet implemented in the current client.** Prior Babylon.js client had partial implementation of this plan (Phase 11 core engine + Phase 12 music tracks shipped before the pivot); reference code survives in `packages/client-old/src/audio/` for salvage. The current Excalibur.js client has zero audio code. When audio work resumes, this document is the target architecture.

The audio stack is engine-agnostic (Tone.js + Howler.js + Web Audio API). None of it is Excalibur-specific, so the blueprint carries over cleanly from the old codebase.

## Tech stack
- **Tone.js** — synthesis, sequencing, effects chains.
- **Web Audio API** — low-level mixing, spatial audio, dynamic gain.
- **Howler.js** (optional) — one-shot SFX samples where synthesis is overkill.
- All music is **layered stems** — individual instrument tracks that can be muted/faded independently for dynamic transitions.

---

## Background music

### Design philosophy
Each location has a **base layer** (always playing) + **overlay stems** (added/removed based on context like time of day, player activity, population density). Procedural variation comes from:
- Randomised melodic motifs drawn from a scale/mode pool.
- Slight BPM drift (±2–4 BPM) per session.
- Randomly selected ornamental phrases injected at phrase boundaries.

---

### Towns & cities

#### Human Town
- **Mood:** Warm, busy, grounded
- **Scale/Mode:** C Major / Mixolydian
- **Instruments:** Acoustic guitar (fingerpicked), light flute melody, hand drum, distant crowd murmur
- **Stems:** Add lute/tavern fiddle stem when near an inn; add market bustle stem when near traders
- **Procedural:** Melodic motif randomised every 2 loops from a pool of 6 phrases; rhythm section stays constant

#### Elf Town
- **Mood:** Ethereal, natural, unhurried
- **Scale/Mode:** D Dorian / Lydian
- **Instruments:** Hammered dulcimer, breathy pan flute, soft string pads, distant water sounds
- **Stems:** Add choral aah pad near temples; reduce percussion entirely for sacred areas
- **Procedural:** Melody uses generative arpeggios from pentatonic subset; phrase length varies (7 or 9 bars) to avoid mechanical repetition

#### Dwarf Town
- **Mood:** Sturdy, rhythmic, underground warmth
- **Scale/Mode:** A Dorian / minor with raised 6th
- **Instruments:** Low brass (tuba/trombone stabs), bodhran drum, anvil percussion hits, bagpipe-style drone
- **Stems:** Increase anvil/industrial stem near forges; add deep cave reverb stem when underground
- **Procedural:** Rhythmic pattern randomised from a set of polyrhythmic grids (3-against-4); melody stays within fixed 4-bar phrases

---

#### Human Capital City
- **Mood:** Grand, regal, cosmopolitan
- **Scale/Mode:** G Major / Ionian with orchestral colour
- **Instruments:** Full string section, brass fanfare accents, oboe melody, snare march underpinning
- **Stems:** Add full orchestral swell near palace/castle; reduce to chamber music in residential quarters
- **Procedural:** Counter-melody randomly selected from pool and layered against main theme; slight orchestration variation per visit

#### Elf Capital City
- **Mood:** Ancient, celestial, vast
- **Scale/Mode:** E Lydian / whole-tone accents
- **Instruments:** Harp, choir (wordless soprano), string ensemble, crystal bell textures
- **Stems:** Add full choir near the great tree/throne; remove percussion entirely for a floating feel
- **Procedural:** Chord progression follows a slowly drifting cycle; melodic fragments are generated algorithmically and fade in/out

#### Dwarf Capital City
- **Mood:** Monumental, proud, echoing halls
- **Scale/Mode:** D minor / Phrygian dominant
- **Instruments:** Low choir, war drums, deep horns, stone-resonance bass drones
- **Stems:** Add triumphant brass as player nears the throne hall; reduce to drone only in the mines below
- **Procedural:** Drum pattern density scales with "activity level" variable; horn phrases drawn randomly from a 4-phrase pool

---

### Dungeons

#### Instance Solo Dungeon
- **Mood:** Tense, lonely, creeping dread
- **Scale/Mode:** B diminished / chromatic clusters
- **Instruments:** Solo cello, sparse piano stabs, low synth drone, distant drip FX blended in
- **Stems:** Tension stem added when enemies are nearby; silence stem (almost nothing) for safe rooms
- **Procedural:** Cello motif is generated from a random walk algorithm over diminished scale; intervals shift slightly each loop

#### Static Group Dungeon
- **Mood:** Epic tension, coordinated danger
- **Scale/Mode:** F# minor / Aeolian with chromatic passing tones
- **Instruments:** Full percussion ensemble, low brass, distorted string textures, choir stabs
- **Stems:** Momentum stem added during active exploration; pulls back during puzzle sections
- **Procedural:** Rhythm section adds/removes layers based on group activity; melodic themes repeat but are reharmonised each pass

---

### Combat music

#### Generic Fight Music
- **Mood:** Urgent, driving, adrenaline
- **Scale/Mode:** E minor / natural minor
- **Instruments:** Fast string ostinato, aggressive percussion, brass hits, electric bass pulse
- **Stems:** Intensity stem added if multiple enemies; eases back if only 1 enemy remains
- **Procedural:** Percussion pattern randomised per encounter; string ostinato speed scales with enemy count (BPM: 130–155)
- **Transition:** Crossfades from ambient track in ~2 seconds on enemy aggro; fades back on combat end

#### Boss Fight Music
- **Mood:** Cinematic dread, escalating intensity
- **Scale/Mode:** C# minor / Locrian accents
- **Instruments:** Full orchestra, epic choir, 808-style low drum, distorted synth undertones
- **Stems:** Phase 1 (full theme); Phase 2 (add choir + distortion); Phase 3 / enrage (everything at max + tempo shift)
- **Procedural:** Phase transitions triggered by boss HP thresholds; each phase crossfades in ~3 seconds
- **Special:** Short silence + bass drop "stinger" plays at fight start to set tone

#### Enemy Nearby / Detection Music
- **Mood:** Suspense, heartbeat tension
- **Scale/Mode:** Atonal / sustained dissonance
- **Instruments:** Low strings tremolo, heartbeat bass pulse, high pitched bowed metal texture
- **Design:** This is a **transitional state** — not a full track. It plays between ambient and combat states.
- **Procedural:** Pulse tempo matches a "danger proximity" variable; the closer the enemy, the faster and louder it gets
- **Transition:** Crossfades to combat music on enemy aggro; fades back to ambient if player escapes detection range

---

### Open world exploration

#### Grasslands
- **Mood:** Open, free, peaceful adventure
- **Scale/Mode:** G Major / Mixolydian
- **Instruments:** Acoustic guitar, penny whistle, light percussion, breeze ambience
- **Procedural:** Melody randomised from folk-style pentatonic phrases; instrument layers added at dawn/dusk

#### Forest
- **Mood:** Mysterious, alive, slightly magical
- **Scale/Mode:** A Dorian / minor pentatonic
- **Instruments:** Marimba, flute fragments, soft synth pads, bird/insect ambience woven in
- **Procedural:** Melodic phrases triggered stochastically (not a fixed loop); silence gaps allowed to breathe

#### Desert
- **Mood:** Vast, lonely, ancient
- **Scale/Mode:** D Phrygian / Phrygian dominant (Arabic feel)
- **Instruments:** Duduk/ney flute, hand percussion (darbuka), sparse sitar plucks, wind ambience
- **Procedural:** Melodic ornaments (trills, glides) added randomly; silence between phrases increases in emptier zones

#### Mountains
- **Mood:** Imposing, cold, majestic
- **Scale/Mode:** E minor / Aeolian
- **Instruments:** Low brass, bowed cello drones, distant horn calls, howling wind texture
- **Procedural:** Horn call phrases triggered at random intervals (not looped); tension stem added at high altitude zones

---

## Sound effects

### Weather — rain & wind

| Effect | Design | Intensity Layers |
|---|---|---|
| **Rain** | White/pink noise shaped with a low-pass filter | Light drizzle → steady rain → heavy downpour (3 gain stages, crossfaded) |
| **Wind** | Bandpass-filtered noise with slow LFO pitch wobble | Gentle breeze → gusting wind → storm gale (3 layers) |
| **Rain + Wind together** | Both channels mixed; wind LFO synced to rain intensity variable | Combined intensity parameter drives both simultaneously |

- All weather is **additive** — layered over music via a separate gain bus, never replacing it.
- Intensity driven by a `weatherIntensity` float (0.0–1.0) that can be set per zone or per weather event.
- A subtle low-pass filter is applied to the music bus during heavy rain/wind to simulate acoustic dampening.

---

### Combat sound effects

Each category has **3 intensity tiers** (light / medium / heavy) to match hit power or attack type.

| Category | Sound Design Notes |
|---|---|
| **Unarmed (hits)** | Dull thud + flesh impact; light = quick jab, heavy = bone crunch wet thud |
| **Unarmed (swing)** | Whoosh with low body movement air; short and tight |
| **Melee (swing)** | Metallic whoosh; blade weight reflected in pitch/duration |
| **Melee (hit — flesh)** | Wet thud + metal ring; heavier weapons = lower pitch, longer decay |
| **Melee (hit — block/parry)** | Sharp metallic clang; varies by weapon type (sword vs axe vs shield) |
| **Bow (draw)** | Slow creak + string tension; pitch rises as draw completes |
| **Bow (release)** | Snap + string vibration + arrow whoosh (doppler if fast) |
| **Bow (hit)** | Thunk in wood/flesh; metal armour hit = higher-pitched clank |
| **Magic (cast — small)** | Soft shimmer + harmonic hum; element-tinted (fire crackle, ice crystal, etc.) |
| **Magic (cast — large)** | Deep resonant charge-up + explosive release; sub-bass component |
| **Magic (hit)** | Element-specific: fire = burst + crackle, ice = shatter, lightning = crack + sizzle, arcane = reverb whomp |

---

### Movement sound effects

| Type | Design Notes |
|---|---|
| **Walking** | Footstep pairs (L/R), 4–6 variants per surface type (grass, stone, wood, sand, cave dirt, snow) |
| **Running** | Same surface variants but faster cadence, slightly heavier impact, light breathing layer |
| **Horseback** | Hoof clopping (4-beat pattern), varies by surface; gallop = faster cadence + saddle creak |

- Surface detection feeds the correct footstep sample set based on tile type.
- Slight random pitch variation (±5%) per step prevents repetition fatigue.

---

### Progression & event sound effects

| Event | Sound Design Notes |
|---|---|
| **Rank Level Up** | Rising orchestral swell + choir "aah" hit + radiant shimmer tail; triumphant and weighty |
| **Skill Level Up** | Shorter, lighter version — bright chime sequence + soft synth swell; satisfying but not overwhelming |
| **Special Event Start** | Deep cinematic boom + brass stab + reverb tail; attention-grabbing "something important is happening" signature |

---

### Ambient creature & NPC sounds

All creature sounds play **stochastically** — triggered randomly within a distance radius from the entity, not looped.

#### Wildlife (grasslands / forest)
| Creature | Sound Notes |
|---|---|
| Birds | Chirping calls, varied species sounds; more active at dawn/dusk |
| Insects | Crickets (night), cicadas (day/desert); low-volume bed layer |
| Small animals (rabbit, deer) | Rustling in grass + light footsteps; startle sound if player gets close |
| Wolves | Distant howls (far), growls/snarls (close); howl more frequent at night |
| Bears | Deep grunt + heavy footfall; roar variant for aggro |

#### Desert wildlife
| Creature | Sound Notes |
|---|---|
| Vultures | Harsh caws, wing flap sounds overhead |
| Snakes | Dry rattle + hiss |
| Scorpions | Light chittering + claw scrape on stone |

#### Mountain wildlife
| Creature | Sound Notes |
|---|---|
| Eagles | Piercing cry + wing rush |
| Mountain goats | Hoof clatter on rock + occasional bleat |

#### Monsters
| Type | Sound Notes |
|---|---|
| Undead / Skeletons | Bone rattle, dry groan, jaw clatter |
| Goblins | High-pitched chittering, sneaky shuffling, screech on aggro |
| Trolls / Giants | Deep guttural rumble, heavy ground impacts, slow heavy breathing |
| Slimes / Oozes | Wet squelch, bubbling idle, splatter on hit |
| Dragons | Wing thunder, deep roar with harmonic distortion, flame breath hiss + roar |

#### NPC ambient voices
- **Human towns:** Generic chatter, merchant calls ("Fresh bread!"), children laughing, blacksmith hammer.
- **Elf towns:** Soft singing, quiet conversation, wind chimes.
- **Dwarf towns:** Boisterous laughter, mug clanking, hammering, gruff shouting across halls.
- All NPC ambient sounds are **positional audio** — volume and direction based on player proximity via Web Audio API's `PannerNode`.

---

## Acoustic occlusion — indoor / outdoor context

### Player acoustic states
At any point the player is in one of three acoustic environments:
- **Outdoors** — full presence, no filtering.
- **Indoors (near exterior)** — muffled outside world bleeds in, interior sounds are clear.
- **Indoors (deep / underground)** — outside world nearly inaudible, heavy reverb.

Transitions between states are **gradual**, driven by an `occlusionFactor` float (0.0 = fully outdoors → 1.0 = deep indoors), interpolated smoothly as the player crosses zone boundaries.

---

### What occlusion affects

#### Weather
| Context | Treatment |
|---|---|
| Outdoors | Full volume, no filtering |
| Just inside a door | Low-pass ~800Hz, volume −40%; roof patter layer added (tight reverb, high-freq taps) |
| Deep indoors / stone | Low-pass ~300Hz, volume −85%; mostly a distant rumble; roof patter fades out |
| Underground | Weather inaudible; replaced with drip ambience |

The **rain on roof** layer is a separate synthesised sound — dense high-frequency taps with very short decay. It only plays indoors and inversely mirrors the outdoor rain volume reduction.

#### Combat & ability SFX
| Context | Reverb Treatment |
|---|---|
| Outdoors | Dry, short natural tail |
| Wood building | Medium room reverb — hits feel punchier, magic echoes briefly |
| Stone hall / castle | Long reverb tail — sword clangs ring out, magic booms |
| Cave / dungeon | Very long reverb + comb filtering — everything feels vast and ominous |

#### Footsteps
Surface type sets the sample; environment sets the reverb tail:
- Outdoors grass → almost no reverb
- Outdoors cobble → light short reverb
- Indoors wood → medium room reverb
- Stone dungeon → long cave reverb

#### Creature & NPC sounds
| Scenario | Treatment |
|---|---|
| Wolf howl heard from indoors | Heavy low-pass + volume cut; distant and muffled |
| NPC chatter outside while you're inside | Low-pass filtered, positional panning still works |
| Tavern sounds heard while outside | Faint muffled music + laughter bleed through walls |

---

### Reverb profiles

Four profiles used across all SFX buses:

| Profile | Decay | Use Case |
|---|---|---|
| `dry` | ~0.1s | Outdoors, open fields |
| `room` | ~0.6s | Wood buildings, small interiors |
| `hall` | ~1.5s | Stone castles, large human/dwarf halls |
| `cave` | ~3.0s+ | Dungeons, underground dwarf city, mines |

---

### Zone acoustic tags

Each map zone carries an acoustic descriptor used to drive all of the above:

```javascript
const zoneAcoustics = {
  outdoors:    { occlusionFactor: 0.0, reverb: "dry",  weatherVolume: 1.0 },
  indoorWood:  { occlusionFactor: 0.5, reverb: "room", weatherVolume: 0.4 },
  indoorStone: { occlusionFactor: 0.7, reverb: "hall", weatherVolume: 0.2 },
  underground: { occlusionFactor: 1.0, reverb: "cave", weatherVolume: 0.0 },
};
```

### Web Audio API — dynamic occlusion filter

Each audio bus (weather, ambient creatures, combat SFX, NPC chatter) gets its own low-pass filter node, tuned independently:

```javascript
const occlusionFilter = audioContext.createBiquadFilter();
occlusionFilter.type = "lowpass";

// occlusionFactor: 0.0 (outside) → 1.0 (deep inside)
function setOcclusion(occlusionFactor) {
  const minFreq = 300;
  const maxFreq = 20000;
  // Exponential curve feels more natural than linear
  const freq = maxFreq * Math.pow(minFreq / maxFreq, occlusionFactor);
  occlusionFilter.frequency.linearRampToValueAtTime(
    freq, audioContext.currentTime + 0.5
  );
}
```

Zone boundary crossings interpolate `occlusionFactor` and crossfade the reverb profile over ~0.5–1 second — transition feels like walking through a door, not teleporting.

---

## Music state machine (overview)

```
[Exploring Ambient]
      ↓ enemy enters radius
[Enemy Nearby — tension loop]
      ↓ enemy aggros
[Combat Music]
      ↓ all enemies dead / fled
[Victory Stinger → fade back to Ambient]

[Ambient] ←→ [Town] ←→ [Dungeon]
        all crossfade over 2–4 seconds
```

Boss fight overrides the state machine entirely and must be manually exited on boss death.

---

## Implementation notes

- Use **Tone.js Transport** to keep all music synced to a master BPM clock.
- Crossfades between states should happen **on beat boundaries** to avoid jarring cuts — quantise transitions to the nearest bar.
- Weather SFX runs on a completely **separate audio graph** from music so it never interferes with music ducking/fading.
- Combat SFX should use a **short attack, short release compressor** to keep hits punchy without clipping.
- Footsteps, creature sounds, and NPC voices should use **Web Audio API spatial panning** for immersion.
- Consider a **master "intensity" variable** (0.0–1.0) that globally feeds into music stem density, SFX volume, and weather presence simultaneously for cohesive atmosphere control.

## Prior-implementation reference

The deleted Babylon.js client (see `packages/client-old/src/audio/AudioSystem.ts`) had a working implementation of:
- 4-bus gain architecture (music, SFX, weather, ambient).
- 7-state music state machine with beat-quantized crossfades via `Tone.Transport`.
- Procedural melody generation from scale/mode pools + phrase engine.
- Proximity-based stem mixing (Manhattan distance).
- Settings menu with server-persisted per-account audio preferences.
- Server-authoritative triggers via `ENEMY_NEARBY` + `ZONE_MUSIC_TAG` opcodes.

When the new client gets audio, salvage from that implementation — the logic is engine-independent, only the integration points (wiring to game events, UI) need rewriting for the Excalibur/current-scene architecture.
