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

## Current State (2026-03-27, session 15)

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
- [x] Gnome Body — small (0.8x width), big head relative to body, small pointed ears, large bright eyes with highlights, button nose, thin limbs. Playable race.

#### Hair
- [x] Short hair
- [x] Long hair — flowing back section reaching mid-back, curtain bangs, sways with walk bob
- [x] Ponytail — tied back with sway physics, swept bangs, tie band detail
- [x] Mohawk — tall ridge fin, shaved sides (fuzz), profile shows front-to-back ridge
- [x] Braided — two braids over shoulders with cross-hatch detail, center part, tie ends

#### Headgear
- [x] Plate helmet
- [x] Mail coif
- [x] Cloth Hood — pointed hood with face opening shadow, back drape over shoulders
- [x] Leather Cap — rounded dome with brim band, earflaps, top button
- [x] Crown — gold band with 5 pointed tines, gemstones (red/blue), ball tips
- [x] Horned Helm — metal dome with nose guard, eye slit, curved horns with ridges, rivets

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
- [x] Crossbow — stock + prod arms + string + loaded bolt + trigger mechanism
- [x] Iron Flail — handle + chain (5 links, walk-sway) + spiked ball (8 radial spikes)
- [x] Halberd — long shaft + axe blade + back hook + top spike + langet straps + butt spike
- [x] Throwing Knife — slim tapered blade + small crossguard + wrapped grip + ring pommel

#### Off-hand
- [x] Kite Shield
- [x] Tower Shield — tall rectangular, metal rim, center boss, corner rivets, cross bands
- [x] Buckler — small round, inner ring, center boss, 6 decorative edge rivets
- [x] Spell Tome — open book with cream pages, cover emblem with glow, bookmark ribbon, corner clasps
- [x] Torch — wooden handle with wrapped grip, charred top, animated flickering flame (orange/yellow/white layers), glow halo

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
- [x] Bald — DONE. Subtle scalp sheen highlight

#### Armor pieces beyond torso (MEDIUM)
- [x] Leg armor (cloth/leather/mail/plate) — DONE
- [x] Boot armor (cloth/leather/mail/plate) — DONE
- [x] Gauntlet armor (cloth/leather/mail/plate) — DONE
- [x] Shoulder armor (cloth/leather/mail/plate) — DONE

#### Armor race/theme variants (LOW)
- [x] Dragon armor (Dragonscale Plate) — DONE. Dark crimson, scale pattern, fiery orange dragon crest, gold trim, fire gem buckle
- [x] Skeleton armor (Bone Armor) — DONE. Bone-white, rib-plate ridges, spine ridge, skull emblem with eye sockets, grey metal belt
- [x] Ogre skin armor (Ogre Hide Vest) — DONE. Greenish-brown hide, irregular patches, crude cross-stitching, bone toggles, fur trim neckline, rope belt with bone charm
- [x] Elven armor (Elven Leafweave) — DONE. Forest green, gold filigree vine pattern, leaf ornaments, central leaf emblem, silver sash, elegant V-neckline

#### Additional weapons/offhand (LOW)
- [x] Tower shield — DONE
- [x] Buckler — DONE
- [x] Tome (offhand) — DONE
- [x] Torch (offhand) — DONE

#### NPC/Monster models (MEDIUM)
- [x] Imp — DONE. Dark red body, bat wings with flap animation, curved horns, glowing yellow slit-pupil eyes, arrow-tipped tail with sway, fangs. Can hold weapons.
- [x] Ogre — DONE. Massive grey-green body (1.5x width), barrel torso, tree-trunk limbs, heavy brow, tusks, warts, beady eyes. Can hold weapons.
- [x] Wraith — DONE. Ethereal hooded figure, translucent dark robe fading into tattered wisps, glowing cyan eyes with halo, trailing shadow tendrils, hovering float animation, spectral arms, ground mist. Can hold weapons.
- [x] Wolf — DONE. Four-legged grey predator, snout, pointed ears, amber eyes, bushy tail with sway, shoulder hump, trotting gait. No weapon slots.
- [x] Bear — DONE. Large brown four-legged, shoulder hump, lighter muzzle, rounded ears, black nose, dark eyes, thick clawed legs, stubby tail, lumbering gait with body roll. No weapon slots.
- [x] King Rabbit — DONE. 1.4x scale, golden-white fur, tiny crown with 3 tines + red gem, gold aura, regal bearing
- [x] Skeleton Lord — DONE. Larger bones, bone crown (5 tines), purple glowing eyes with halos, dark aura, wider ribs
- [x] Alpha Wolf — DONE. 1.3x scale, dark grey fur, battle scars (body + face), bared fangs, bright amber glowing eyes, boss aura
- [x] Goblin Chieftain — DONE. 1.35x width, war-painted face, feathered headdress (3 feathers), bigger tusks, bigger pointed ears
- [x] Imp Overlord — DONE. 1.3x scale, deeper red, bigger wings, crown of 4 horns, flaming tail tip, fire aura, fire glow around eyes
- [x] Elder Bear — DONE. 1.35x scale, darker brown, silver-tipped shoulder fur, battle scars (body + face), torn ear, glowing amber eyes
- [x] Witch — DONE. Robed spellcaster, pointed hat with brim/buckle, pale greenish skin, glowing green eyes, hooked nose, long robe skirt with tattered hem, flared sleeves, green amulet pendant, magic aura. Can hold weapons.

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
9. ~~Additional offhand items~~ — DONE (tower shield, buckler, tome, torch)
10. ~~Ogre NPC~~ — DONE
11. ~~Wraith + Bear NPCs~~ — DONE
12. ~~Armor race variants~~ — DONE (Dragonscale Plate, Bone Armor, Ogre Hide Vest, Elven Leafweave)
13. ~~Bald hair~~ — DONE
14. ~~Body customisation sliders~~ — DONE (Build 0.7-1.3 width, Height 0.85-1.15 scale, live preview)
15. ~~More headgear~~ — DONE (Cloth Hood, Leather Cap, Crown, Horned Helm)
16. ~~Boss variants~~ — DONE (King Rabbit, Skeleton Lord, Alpha Wolf)
17. ~~Export/Import JSON~~ — DONE (Copy JSON button + Import from clipboard)
18. ~~Game integration bridge~~ — DONE (GameBridge.ts + manifest.ts + manifest export button)
19. ~~More boss variants~~ — DONE (Goblin Chieftain, Imp Overlord, Elder Bear)
20. ~~Wire GameBridge into game client~~ — DONE (WorkbenchSpriteSheet adapter, barrel export, INTEGRATION.md guide)
21. ~~More weapon types~~ — DONE (crossbow, flail, halberd, throwing knife)
22. ~~UI polish~~ — DONE (fixed NPC label formatting, added model count to nav header)

## Status: COMPLETE

All goals from the original spec have been implemented and exceeded. The workbench is production-ready with 72 models (4 races, 15 NPCs, 32 armor pieces, 12 weapons, 5 offhands, 6 hair, 6 headgear), full game integration adapter, JSON export/import, and comprehensive documentation. Every creature type mentioned in the spec (skeletons, goblins, gnomes, ogres, wraiths, witches) is now implemented.
