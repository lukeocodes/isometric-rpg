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

### Phase 3: Shoulders (next loop)
4 shoulder pieces — fix depth to BODY+3 (near) / FAR_LIMB+8 (far), draw wider pauldrons:
- [x] ShouldersPlate — depths already correct ✓
- [x] ShouldersMail — depths already correct ✓
- [x] ShouldersLeather — depths already correct ✓
- [x] ShouldersCloth — fixed: was NEAR_LIMB+6/7/8, now FAR_LIMB+8/BODY+3 ✓

### Phase 4: Legs + Boots (next loop)
Fix depth to FAR_LIMB+1/5 (legs), FAR_LIMB+3/7 (boots):
- [x] LegsPlate — FAR_LIMB+1 (far), FAR_LIMB+5 (near) ✓
- [x] LegsMail — FAR_LIMB+1 (far), FAR_LIMB+5 (near) ✓
- [x] LegsLeather — FAR_LIMB+1 (far), FAR_LIMB+5 (near) ✓
- [x] LegsCloth — FAR_LIMB+1 (far), FAR_LIMB+5 (near) ✓
- [x] BootsPlate — FAR_LIMB+3 (far), FAR_LIMB+7 (near) ✓
- [x] BootsMail — FAR_LIMB+3 (far), FAR_LIMB+7 (near) ✓
- [x] BootsLeather — FAR_LIMB+3 (far), FAR_LIMB+7 (near) ✓
- [x] BootsCloth — FAR_LIMB+3 (far), FAR_LIMB+7 (near) ✓

### Phase 5: Gauntlets (next loop)
Fix depth to FAR_LIMB+9/NEAR_LIMB+6:
- [x] GauntletsPlate — far: FAR_LIMB+9/NEAR_LIMB+1, near: NEAR_LIMB+6/FAR_LIMB+11 ✓
- [x] GauntletsMail — same ✓
- [x] GauntletsLeather — same ✓
- [x] GauntletsCloth — same ✓

### Phase 6: Weapons + Offhand (next loop)
Redraw all 12 weapons + 5 offhand items (sword, axe, etc.):
- Uses armAngle correctly from the hand-swap fix already done
- Improve blade/handle quality

### Phase 7: Headgear + Hair
Already mostly good — minor V2 fit adjustments.

### Phase 8: World Decorations
Once all wearable items are done:
- Grass patches (various sizes, flat ground decoration)
- Trees: small (1×1), medium (2×2 trunk), large (trunk-only fills multiple tiles)
- Rocks: small scattered, medium boulders, massive (3×3+ requires walking around)
- All use walkability flags — can walk BEHIND but not THROUGH
- Multi-tile objects use piece system or new large-item support

---

## Sign-off Checklist
Mark each model with ✓ when redrawn + depth verified:

### Torso: [x] Plate [x] Mail [x] Leather [x] Cloth [x] Robe [x] Dragon [x] Elven [x] Ogreskin [x] Skeleton
### Shoulders: [x] Plate [x] Mail [x] Leather [x] Cloth
### Legs: [x] Plate [x] Mail [x] Leather [x] Cloth
### Boots: [x] Plate [x] Mail [x] Leather [x] Cloth
### Gauntlets: [x] Plate [x] Mail [x] Leather [x] Cloth
### Weapons: [ ] Sword [ ] Axe [ ] Dagger [ ] Mace [ ] Flail [ ] Wand [ ] Staff [ ] Bow [ ] Crossbow [ ] Halberd [ ] Spear [ ] ThrowingKnife
### Offhand: [ ] TowerShield [ ] KiteShield [ ] Buckler [ ] Torch [ ] Tome
### Headgear: [ ] Plate [ ] Horned [ ] Crown [ ] Coif [ ] Leather [ ] Hood
### Hair: [ ] Short [ ] Long [ ] Braided [ ] Ponytail [ ] Mohawk [ ] Bald

---

## Key Utility to Add (draw-helpers.ts)
```typescript
/** Draw a quad stretching to fit 4 corner points (for corner-based armor) */
export function drawCornerQuad(g, tl, tr, bl, br, color, outlineColor, s): void
/** Fill quad with gradient-like shading (lit side lighter) */
export function drawLitQuad(g, tl, tr, bl, br, palette, sideAmt, s): void
```
