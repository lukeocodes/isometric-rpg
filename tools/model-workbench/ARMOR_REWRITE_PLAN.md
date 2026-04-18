# Armor & Equipment Rewrite Plan
*Project lead review — started 2026-04-03*

## Root Cause Findings

### 1. Depth Conflicts (armor renders BELOW body parts)
- `GauntletsPlate` far arm: `facingCamera ? FAR_LIMB+4 : NEAR_LIMB+0` — **same depth as arm body**
- `LegsPlate`/`BootsPlate`: `FAR_LIMB+0, FAR_LIMB+2` — **same depth as leg/foot body parts**
- `ShouldersPlate` far shoulder: `FAR_LIMB+8=48` renders **below** torso at `BODY+0=50`

### 2. Body Part Spacing Too Tight
FAR_LIMB range (old: 40–49, 10 slots) contained 6 body parts + tried to host 6 equipment slots — impossible.

### 3. V1 Body Proportions
All armor was drawn for the V1 HumanBody skeleton. V2 has wider shoulders, deltoid caps, different torso proportions. Armor needs complete redraw.

### 4. No Fitment / Race Adaptation
Armor uses hardcoded dimensions (e.g., `w = 7.5 * sz`). A Dwarf torso vs Elf torso has completely different joint positions — armor should stretch to fit by reading the 4 bounding corners of each attachment slot.

---

## Architecture Changes

### Depth Tier Expansion (DONE ✓)
Updated `types.ts`:
```
DEPTH_FAR_LIMB  = 40  (was 40, range now 40–89 = 50 slots)
DEPTH_BODY      = 90  (was 50)
DEPTH_COLLAR    = 108 (was 58)
DEPTH_HEAD      = 110 (was 60)
DEPTH_NEAR_LIMB = 130 (was 70)
```

**Spacing rule**: Body parts at even offsets, equipment at odd offsets +1 above each body part.

### Body Model Leg/Foot Offset Update (TODO)
Change from single-step (+0,+1,+2,+3) to two-step (+0,+2,+4,+6) to leave room for equipment:
- Far leg body: FAR_LIMB + 0  → armor: FAR_LIMB + 1
- Far foot body: FAR_LIMB + 2  → armor: FAR_LIMB + 3
- Near leg body: FAR_LIMB + 4  → armor: FAR_LIMB + 5
- Near foot body: FAR_LIMB + 6 → armor: FAR_LIMB + 7
- Far arm (facingCamera): FAR_LIMB + 8  → armor: FAR_LIMB + 9
- Near arm (!facingCamera): FAR_LIMB + 10 → armor: FAR_LIMB + 11
- Far arm (!facingCamera): NEAR_LIMB + 0 → armor: NEAR_LIMB + 1
- Near arm (facingCamera): NEAR_LIMB + 5 → armor: NEAR_LIMB + 6

**Files to update**: HumanBodyV2, ElfBody, DwarfBody, GnomeBody + all 15 NPC body models.

### FitmentCorners System (TODO)
Add to `types.ts`:
```typescript
export interface FitmentCorners {
  tl: V; tr: V; bl: V; br: V;
}
// Add to AttachmentPoint: corners?: FitmentCorners
// Add to RenderContext: fitmentCorners?: FitmentCorners
```

**Corners per slot** (skeleton joints):
- `torso`: tl=shoulderL, tr=shoulderR, bl=hipL, br=hipR
- `shoulders`: tl/tr=shoulder joints, bl/br=elbow joints (approximate)
- `gauntlets`: tl/tr=elbow, bl/br=wrist (per side)
- `legs`: tl/tr=hip, bl/br=ankle (per side)
- `feet-L/R`: tl/tr=ankle, bl/br=toe
- `head-top`: derived from head joint + wf scaling

**Composite renderer**: pass `fitmentCorners: bodyAP.corners` into child context.

---

## Rewrite Order

### Phase 1: Foundation (COMPLETE ✓)
- [x] Depth constants updated (types.ts): BODY=90, COLLAR=108, HEAD=110, NEAR_LIMB=130
- [x] FitmentCorners interface added to types.ts
- [x] AttachmentPoint.corners added to types.ts
- [x] RenderContext.fitmentCorners added to types.ts
- [x] composite.ts passes fitmentCorners from attachment point
- [x] skeleton.ts defines corners for all 8 slots (head-top, hand-R/L, torso, torso-back, shoulders, gauntlets, legs, feet-L/R)
- [x] draw-helpers.ts: drawCornerQuad() + quadPoint() utilities added
- [x] HumanBodyV2 leg/foot offset 2-step fix (+0,+2,+4,+6,+8,+10)
- [x] ElfBody, DwarfBody, GnomeBody same fix
- [x] All 9 humanoid NPC bodies same fix
- [x] All TypeScript compiling clean

### Phase 2: Torso Armor
- [x] ArmorPlate — corner quad, pauldrons, gorget, facing-aware ✓
- [x] ArmorMail — corner quad, ring rows, mail skirt ✓
- [x] ArmorLeather — corner stitching, belt/buckle, shoulder straps ✓
- [x] ArmorCloth — hem extension, sash, corner collar ✓
- [x] RobeCloth — animated skirt, V-neck chest panel, sash knot ✓
- [x] ArmorDragon — scale rows + gold crest/belt (front), spine bumps (back) ✓
- [x] ArmorElven — leaf motifs + vine diagonals + silver sash (front), mail rows (back) ✓
- [x] ArmorOgreskin — jagged hide, cross-stitch seams, bone toggles, fur trim, hanging charm ✓
- [x] ArmorSkeleton — ribcage arcs, skull emblem, pelvis buckle (front), vertebrae column (back) ✓

### Phase 3: Shoulders — COMPLETE ✓ (2026-04-03)
All 4 shoulder models redrawn with fitmentCorners (sideCorners per-side):
- [x] ShouldersPlate — drawCornerQuad pauldrons + segmentation lines + rivets ✓
- [x] ShouldersMail — drawCornerQuad mantlet + ring rows + leather hem ✓
- [x] ShouldersLeather — drawCornerQuad spaulder + studs + stitching arc ✓
- [x] ShouldersCloth — drawCornerQuad per drape + yoke panel ✓

### Phase 4: Legs + Boots — COMPLETE ✓ (2026-04-03)
All 8 leg/boot models redrawn with fitmentCorners:
- [x] LegsPlate — sideCorners thigh+greave quads + knee cop + tassets ✓
- [x] LegsMail — sideCorners + ring rows + padded knee + hip skirt ✓
- [x] LegsLeather — sideCorners + stitching + knee pad + ankle cuff ✓
- [x] LegsCloth — sideCorners + loose expand + gather crease + hem ✓
- [x] BootsPlate — fitmentCorners scale hints, armoured shaft, toe plates ✓
- [x] BootsMail — fitmentCorners scale, short shaft, ring pattern ✓
- [x] BootsLeather — fitmentCorners scale, mid-calf shaft, buckle ✓
- [x] BootsCloth — fitmentCorners scale, wrap bands ✓
- [x] EntityRenderer.ts feet-R duplicate removed (was drawing boots 4x) ✓

### Phase 5: Gauntlets — COMPLETE ✓ (2026-04-03)
All 4 gauntlet models redrawn with fitmentCorners (sideCorners per-side):
- [x] GauntletsPlate — drawCornerQuad vambrace + elbow cop + finger plates ✓
- [x] GauntletsMail — drawCornerQuad + ring rows + padded cuff + mitten ✓
- [x] GauntletsLeather — drawCornerQuad + wrist guard + buckle + glove ✓
- [x] GauntletsCloth — drawCornerQuad + wrap bands + hand ✓

### Phase 6: Weapons + Offhand (COMPLETE ✓)
All 12 weapons + 5 offhand items verified:
- All weapons: `side = facingCamera ? nearSide : farSide`, depth `facingCamera ? NEAR_LIMB+3 : FAR_LIMB+3` ✓
- All shields: `side = facingCamera ? farSide : nearSide`, depth `facingCamera ? FAR_LIMB+3 : NEAR_LIMB+3` ✓
- Torch + Tome: `side = facingCamera ? farSide : nearSide`, depth `facingCamera ? FAR_LIMB+2 : NEAR_LIMB+2` ✓

### Phase 7: Headgear + Hair (COMPLETE ✓)
All headgear at DEPTH_HEAD+1, HoodCloth back drape `facingCamera ? FAR_LIMB-5 : BODY+6` ✓
All hair at DEPTH_HEAD+1, back-flow hair `facingCamera ? FAR_LIMB-5 : BODY+6` ✓

### Phase 8: World Decorations (COMPLETE ✓)
New `decorations/` category registered in main.ts barrel:
- GrassPatch (grass-patch-small) — 7 blade groups, DEPTH_E+2 ✓
- GrassPatchLarge (grass-patch-large) — 10 blade groups with sway, DEPTH_E+2 ✓
- TreeSmall (tree-small) — trunk DEPTH_S+2, canopy DEPTH_W+2 ✓
- TreeMedium (tree-medium) — root flares, 4-layer canopy DEPTH_W+2/+3 ✓
- TreeLarge (tree-large) — full-frame trunk, moss, DEPTH_W+2 ✓
- RockSmall (rock-small) — 3 pebble ellipses, DEPTH_E+3 ✓
- RockMedium (rock-medium) — organic polygon, directional shading, cracks, DEPTH_S+3 ✓
- RockBoulder (rock-boulder) — 20pt polygon, lichen patches, DEPTH_W+3 ✓
- MossyLog (mossy-log) — cylinder with wood grain + moss top, DEPTH_N+2 ✓
- MushroomCluster (mushroom-cluster) — 3 mushrooms with spots, DEPTH_E+4 ✓

---

## Sign-off Checklist
Mark each model with ✓ when redrawn + depth verified:

### Torso: [x] Plate [x] Mail [x] Leather [x] Cloth [x] Robe [x] Dragon [x] Elven [x] Ogreskin [x] Skeleton
### Shoulders: [x] Plate [x] Mail [x] Leather [x] Cloth
### Legs: [x] Plate [x] Mail [x] Leather [x] Cloth
### Boots: [x] Plate [x] Mail [x] Leather [x] Cloth
### Gauntlets: [x] Plate [x] Mail [x] Leather [x] Cloth
### Weapons: [x] Sword [x] Axe [x] Dagger [x] Mace [x] Flail [x] Wand [x] Staff [x] Bow [x] Crossbow [x] Halberd [x] Spear [x] ThrowingKnife
### Offhand: [x] TowerShield [x] KiteShield [x] Buckler [x] Torch [x] Tome
### Headgear: [x] Plate [x] Horned [x] Crown [x] Coif [x] Leather [x] Hood
### Hair: [x] Short [x] Long [x] Braided [x] Ponytail [x] Mohawk [x] Bald
### Decorations: [x] GrassPatch [x] GrassPatchLarge [x] TreeSmall [x] TreeMedium [x] TreeLarge [x] RockSmall [x] RockMedium [x] RockBoulder [x] MossyLog [x] MushroomCluster

---

## Key Utility to Add (draw-helpers.ts)
```typescript
/** Draw a quad stretching to fit 4 corner points (for corner-based armor) */
export function drawCornerQuad(g, tl, tr, bl, br, color, outlineColor, s): void
/** Fill quad with gradient-like shading (lit side lighter) */
export function drawLitQuad(g, tl, tr, bl, br, palette, sideAmt, s): void
```
