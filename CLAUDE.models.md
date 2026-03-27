# Model Workbench Development State

Read this file at the start of each model workbench session. Update after significant work.

## Location
`tools/model-workbench/` — standalone Vite app on port 5180 (`cd tools/model-workbench && npx vite`)

## Architecture
- **Model registry** — singleton `registry` in `models/registry.ts`. Models self-register via barrel imports.
- **Skeleton system** — `computeHumanoidSkeleton(dir, walkPhase)` returns named joints + attachment points. All humanoid models share this skeleton.
- **DrawCall pattern** — models return `DrawCall[]` (depth-sorted draw functions). Composite renderer collects all calls, sorts by depth, executes.
- **Palette** — `computePalette(skin, hair, eyes, primary, secondary, armorType)` generates full color set from base colors + armor material.
- **Attachment slots** — `root`, `head-top`, `hand-R`, `hand-L`, `torso`, `torso-back`, `legs`, `feet-L`, `feet-R`

## Current State (2026-03-27, session 5)

### Workbench UI
- [x] 3-panel layout: left nav (model browser), center (PixiJS canvas), right (config panel)
- [x] 8-direction grid preview (clickable to select direction)
- [x] Walk cycle strip (8 frames)
- [x] Main preview (5x scale)
- [x] Composite view (body + all equipped slots)
- [x] Individual model view (single model, optional ghost body)
- [x] Color pickers (skin, hair, eyes, primary, secondary)
- [x] Armor type radio selector (none/cloth/leather/mail/plate)
- [x] Slot dropdowns (head, weapon, offhand)
- [x] Animation controls (play/pause, speed slider)
- [x] `window.__workbench` API for programmatic control

### Models Implemented

#### Bodies
- [x] Human Body — full humanoid with torso, pelvis, glutes, legs, feet, arms, head, eyes, ears, mouth, eyebrows. Walk cycle with arm swing, leg stride, bob.
- [x] Elf Body — slimmer (0.85x width), pointed ears with inner detail, almond eyes, angular jaw, longer neck, delicate limbs
- [x] Dwarf Body — wider (1.25x width), barrel chest, thick limbs, prominent brow ridge, broad nose, round ears, bigger head, knobbly knees

#### Hair
- [x] Short hair
- [x] Long hair — flowing back section reaching mid-back, curtain bangs, sways with walk bob
- [x] Ponytail — tied back with sway physics, swept bangs, tie band detail
- [x] Mohawk — tall ridge fin, shaved sides (fuzz), profile shows front-to-back ridge
- [x] Braided — two braids over shoulders with cross-hatch detail, center part, tie ends

#### Headgear
- [x] Plate helmet
- [x] Mail coif

#### Armor — Torso
- [x] Cloth robe
- [x] Leather vest
- [x] Mail hauberk
- [x] Plate cuirass

#### Armor — Legs
- [x] Cloth Trousers — loose flowing, hem at ankle, waist sash
- [x] Leather Leggings — fitted with knee pads, rivets, stitching detail
- [x] Mail Chausses — chain ring pattern, metal knee cop, mail skirt waist
- [x] Plate Greaves — full plate cuisses + greaves, articulated knee cop, tasset plates, shin ridge

#### Armor — Shoulders
- [x] Cloth Mantle — flowing cloth drape over shoulder, edge stitch
- [x] Leather Spaulders — rounded hardened leather, studs, stitching, edge band
- [x] Mail Mantlets — chain mail drape, ring pattern, leather edge band
- [x] Plate Pauldrons — layered plates, raised rim, segmentation lines, center rivet

#### Armor — Gauntlets
- [x] Cloth Wrappings — wrapped forearm bands, wrapped hand
- [x] Leather Bracers — wrist guard, buckle strap, leather glove
- [x] Mail Mittens — chain ring forearm, padded elbow cuff, mail mitten
- [x] Plate Gauntlets — articulated vambrace, elbow cop with rivet, plate hand with finger plates, wrist flare

#### Armor — Boots
- [x] Cloth Wraps — ankle wraps, cross-bands
- [x] Leather Boots — mid-calf shaft, buckle strap, fold top, thick sole
- [x] Mail Sabatons — chain ring pattern, metal top rim, shorter shaft
- [x] Plate Sabatons — armored shin guard, articulated toe plates, top flare, thick sole

#### Weapons
- [x] Iron Sword
- [x] Battle Axe
- [x] War Mace
- [x] Long Spear
- [x] Hunting Bow
- [x] Oak Staff
- [x] Crystal Wand
- [x] Steel Dagger

#### Off-hand
- [x] Kite Shield

### Missing (priority order)

#### Bodies (HIGH)
- [x] Elf Body — DONE
- [x] Dwarf Body — DONE
- [x] Skeleton NPC — DONE. Rib cage, skull with eye sockets + red glow, bony limbs with dual forearm bones, finger bones, pelvic bone, vertebrae. Can hold weapons.
- [x] Goblin NPC — DONE. Green skin, wide potbelly, pointed triangular ears, red/yellow eyes, underbite fangs, clawed hands/feet, broad nose. Can hold weapons.
- [x] Rabbit NPC — DONE. Non-humanoid oval body, tall ears with pink inner, cheek puffs, whiskers, cotton tail, big eyes, hopping walk. No weapon slots.

#### Hair (MEDIUM)
- [x] Long hair — DONE
- [x] Ponytail — DONE
- [x] Braided — DONE
- [x] Mohawk — DONE
- [ ] Bald (placeholder/none)

#### Armor pieces beyond torso (MEDIUM)
- [x] Leg armor (cloth/leather/mail/plate) — DONE
- [x] Boot armor (cloth/leather/mail/plate) — DONE
- [x] Gauntlet armor (cloth/leather/mail/plate) — DONE
- [x] Shoulder armor (cloth/leather/mail/plate) — DONE

#### Armor race/theme variants (LOW)
- [ ] Dragon armor set
- [ ] Skeleton armor set
- [ ] Ogre skin armor set
- [ ] Elven armor set

#### Additional weapons/offhand (LOW)
- [ ] Tower shield
- [ ] Buckler
- [ ] Tome (offhand)
- [ ] Torch (offhand)

#### NPC/Monster models (MEDIUM)
- [x] Imp — DONE. Dark red body, bat wings with flap animation, curved horns, glowing yellow slit-pupil eyes, arrow-tipped tail with sway, fangs. Can hold weapons.
- [ ] Ogre — large, bulky
- [ ] Wraith — ethereal, translucent
- [x] Wolf — DONE. Four-legged grey predator, snout, pointed ears, amber eyes, bushy tail with sway, shoulder hump, trotting gait. No weapon slots.
- [ ] Bear — large four-legged
- [ ] Boss variants (King Rabbit, Skeleton Lord, etc.)

### Legacy Files
- ~~`src/CharacterModel.ts`~~ — DELETED
- ~~`src/Controls.ts`~~ — DELETED

## What to Work on Next
Priority for each session (tackle 1-2 items per run):
1. ~~Elf + Dwarf body models~~ — DONE
2. ~~More hair styles (5 total)~~ — DONE
3. ~~NPC body models (skeleton, goblin, rabbit)~~ — DONE
4. ~~Armor leg/boot pieces~~ — DONE (8 models: 4 legs + 4 boots)
5. ~~Clean up legacy files~~ — DONE (CharacterModel.ts, Controls.ts deleted)
6. ~~Gauntlet + shoulder armor~~ — DONE (8 models: 4 shoulders + 4 gauntlets). Full armor sets complete!
7. ~~More NPC models (imp, wolf)~~ — DONE (2 new NPCs)
8. ~~Auto-equip matching armor set~~ — DONE (clicking armor type equips full set: head, shoulders, torso, gauntlets, legs, boots)
9. Remaining NPC models (ogre, wraith, bear, boss variants)
10. Additional offhand items (tower shield, buckler, tome, torch)
11. Armor race variants (dragon, skeleton, ogre, elven)
