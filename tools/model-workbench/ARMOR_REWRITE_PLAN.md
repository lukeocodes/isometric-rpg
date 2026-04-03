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

### Phase 2: Torso Armor (next 2–3 loops)
Redraw all 9 torso pieces using corner-based quad geometry:
- [ ] ArmorPlate (breastplate + pauldrons)
- [ ] ArmorMail (chain shirt)
- [ ] ArmorLeather (leather vest)
- [ ] ArmorCloth (cloth tunic)
- [ ] RobeCloth (full robe)
- [ ] ArmorDragon
- [ ] ArmorElven
- [ ] ArmorOgreskin
- [ ] ArmorSkeleton

### Phase 3: Shoulders (next loop)
4 shoulder pieces — fix depth to BODY+3 (near) / FAR_LIMB+8 (far), draw wider pauldrons:
- [ ] ShouldersPlate, ShouldersMail, ShouldersLeather, ShouldersCloth

### Phase 4: Legs + Boots (next loop)
Fix depth to FAR_LIMB+1/5 (legs), FAR_LIMB+3/7 (boots):
- [ ] LegsPlate, LegsMail, LegsLeather, LegsCloth
- [ ] BootsPlate, BootsMail, BootsLeather, BootsCloth

### Phase 5: Gauntlets (next loop)
Fix depth to FAR_LIMB+9/NEAR_LIMB+6:
- [ ] GauntletsPlate, GauntletsMail, GauntletsLeather, GauntletsCloth

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

### Torso: [ ] Plate [ ] Mail [ ] Leather [ ] Cloth [ ] Robe [ ] Dragon [ ] Elven [ ] Ogreskin [ ] Skeleton
### Shoulders: [ ] Plate [ ] Mail [ ] Leather [ ] Cloth
### Legs: [ ] Plate [ ] Mail [ ] Leather [ ] Cloth
### Boots: [ ] Plate [ ] Mail [ ] Leather [ ] Cloth
### Gauntlets: [ ] Plate [ ] Mail [ ] Leather [ ] Cloth
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
