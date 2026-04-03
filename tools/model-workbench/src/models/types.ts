import type { Graphics } from "pixi.js";

// ─── Structural plane depth bases (walls, floors) ────────────────────
// Assign face depths as DEPTH_X + 0, +1, +2 … (max 9 faces per direction).
// E < N < S < W ensures correct layering when models share a tile (corners).
// Range 0–39. Body/character depths start above this range.
export const DEPTH_E = 0;   // east-facing planes  — furthest from camera
export const DEPTH_N = 10;  // north-facing planes
export const DEPTH_S = 20;  // south-facing planes
export const DEPTH_W = 30;  // west-facing planes  — closest to camera

// ─── Character composite depth layers ────────────────────────────────
// Starts at 40 so bodies always render above structural elements.
//
// SPACING RULES:
//   Body parts use EVEN offsets from their tier base.
//   Equipment (armor/weapons) uses the ODD offset immediately above its body part.
//
//   FAR_LIMB tier  (40–89, 50 slots):
//     +0  far leg body        +1  far leg armor
//     +2  far foot body       +3  far boot armor
//     +4  near leg body       +5  near leg armor
//     +6  near foot body      +7  near boot armor
//     +8  far arm body        +9  far gauntlet armor
//     +10 near arm body*      +11 near gauntlet armor*
//     (* when !facingCamera — near arm swaps to FAR_LIMB range)
//
//   BODY tier (90–109):
//     +0  torso, pelvis, glutes    +3  torso armor
//
//   HEAD tier (110–129):
//     +0  head body                +1  hair / headgear
//
//   NEAR_LIMB tier (130–159):
//     +0  far arm body*            +1  far gauntlet armor*
//     +5  near arm body            +6  near gauntlet armor
//     (* when !facingCamera — far arm swaps to NEAR_LIMB range)
//
// For direction-conditional arm depth:
//   far arm:  facingCamera ? DEPTH_FAR_LIMB  + 8 : DEPTH_NEAR_LIMB + 0
//   near arm: facingCamera ? DEPTH_NEAR_LIMB + 5 : DEPTH_FAR_LIMB  + 10
export const DEPTH_SHADOW    =   0;  // ground shadow
export const DEPTH_FAR_LIMB  =  40;  // limbs/appendages away from camera (range 40–89)
export const DEPTH_BODY      =  90;  // torso, pelvis, core               (range 90–109)
export const DEPTH_COLLAR    = 108;  // neck/collar — behind face, above torso armor
export const DEPTH_HEAD      = 110;  // head                              (range 110–129)
export const DEPTH_NEAR_LIMB = 130;  // limbs/appendages toward camera    (range 130–159)

// ─── Primitives ─────────────────────────────────────────────────────

export interface V {
  x: number;
  y: number;
}

export type Direction = 0 | 1 | 2 | 3 | 4 | 5 | 6 | 7;

export const DIRECTION_COUNT = 8;
export const DIRECTION_NAMES = ["S", "SW", "W", "NW", "N", "NE", "E", "SE"];
export const FRAME_W = 48;
export const FRAME_H = 64;

export const ISO_OFFSETS: V[] = [
  { x: 0, y: 0.5 },
  { x: -0.4, y: 0.3 },
  { x: -0.5, y: 0 },
  { x: -0.4, y: -0.3 },
  { x: 0, y: -0.5 },
  { x: 0.4, y: -0.3 },
  { x: 0.5, y: 0 },
  { x: 0.4, y: 0.3 },
];

// ─── Skeleton ───────────────────────────────────────────────────────

/**
 * Attachment parameters — define how a model placed at this connection point
 * should be scaled, stretched, and positioned. Body models set these as
 * defaults; composites can override them per-slot.
 */
export interface SlotParams {
  /** Uniform scale multiplier (1 = native size). Dwarf head-top = 1.25, Elf = 0.85. */
  size: number;
  /** Axis-independent stretch. { x:1.25, y:1 } = 25% wider only. */
  ratio: V;
  /** Relative position offset in model-space units for fine-tuning placement. */
  offset: V;
}

/**
 * Four-corner fitment region for an attachment slot.
 * Derived from skeleton joints so armor automatically stretches to fit
 * any body type (dwarf, elf, gnome, ogre, etc.).
 *
 *   tl ─── tr
 *   │         │
 *   bl ─── br
 *
 * Equipment models should use these corners to draw their outline shape
 * instead of hardcoded widths/heights.
 */
export interface FitmentCorners {
  tl: V;  // top-left
  tr: V;  // top-right
  bl: V;  // bottom-left
  br: V;  // bottom-right
}

export interface AttachmentPoint {
  position: V;
  /** Angle in radians for attached model orientation */
  angle: number;
  /** Perspective width factor at this point */
  wf: number;
  /** Default slot rendering parameters — equipment reads these to scale correctly */
  params: SlotParams;
  /**
   * Bounding corners for this attachment slot, derived from skeleton joints.
   * Equipment should stretch to fit these rather than using hardcoded dimensions.
   * Automatically adapts to different body proportions (race, build, height).
   */
  corners?: FitmentCorners;
}

export interface Skeleton {
  joints: Record<string, V>;
  attachments: Record<string, AttachmentPoint>;
  bob: number;
  /** Perspective width factor (1 = front, ~0.65 = side) */
  wf: number;
  iso: V;
  direction: Direction;
  walkPhase: number;
}

// ─── Palette ────────────────────────────────────────────────────────

export interface ModelPalette {
  skin: number;
  hair: number;
  eyes: number;
  primary: number;
  secondary: number;
  body: number;
  bodyDk: number;
  bodyLt: number;
  accent: number;
  accentDk: number;
  outline: number;
}

// ─── Draw call ──────────────────────────────────────────────────────

export interface DrawCall {
  depth: number;
  draw: (g: Graphics, scale: number) => void;
}

// ─── Render context ─────────────────────────────────────────────────

export interface RenderContext {
  skeleton: Skeleton;
  palette: ModelPalette;
  farSide: "L" | "R";
  nearSide: "L" | "R";
  facingCamera: boolean;
  /**
   * Resolved slot parameters for this model instance.
   * Set by the composite renderer from the body's attachment point defaults,
   * merged with any per-slot overrides in CompositeConfig.
   * Equipment models use this for all scaling — never hardcode dimensions.
   */
  slotParams: SlotParams;
  /**
   * Fitment corners for the attachment slot, passed from the body model's
   * attachment point definition. Equipment should draw itself to fit these
   * 4 corners so it automatically adapts to any body type.
   * May be undefined for old/simple equipment that ignores corners.
   */
  fitmentCorners?: FitmentCorners;
  /** Optional texture for construction models (PixiJS Texture, typed as unknown to avoid import) */
  texture?: unknown;
}

/** Convenience: neutral slot params (no scaling, no offset) */
export const DEFAULT_SLOT_PARAMS: SlotParams = {
  size: 1,
  ratio: { x: 1, y: 1 },
  offset: { x: 0, y: 0 },
};

// ─── Model ──────────────────────────────────────────────────────────

export type ModelCategory =
  | "body"
  | "hair"
  | "armor"
  | "weapon"
  | "offhand"
  | "headgear"
  | "legs"
  | "feet"
  | "shoulders"
  | "gauntlets"
  | "npc"
  | "construction";

export type AttachmentSlot =
  | "root"
  | "hand-R"
  | "hand-L"
  | "head-top"
  | "torso"
  | "torso-back"
  | "shoulders"
  | "gauntlets"
  | "legs"
  | "feet-L"
  | "feet-R";

export interface Model {
  readonly id: string;
  readonly name: string;
  readonly category: ModelCategory;
  readonly slot: AttachmentSlot;
  /** False for props/structures that are never animated. Defaults to true. */
  readonly isAnimated?: boolean;
  /** Two-handed weapons occupy both hands — the offhand slot is blocked. */
  readonly twoHanded?: boolean;
  getDrawCalls(ctx: RenderContext): DrawCall[];
  getAttachmentPoints(skeleton: Skeleton): Record<string, AttachmentPoint>;
}

// ─── Composite config ───────────────────────────────────────────────

export interface CompositeSlot {
  slot: AttachmentSlot;
  modelId: string;
  /** Per-slot overrides — merged on top of the body's attachment point defaults */
  overrides?: Partial<SlotParams>;
}

export interface CompositeConfig {
  baseModelId: string;
  attachments: CompositeSlot[];
  palette: ModelPalette;
  /** Body width multiplier (0.7 = slim, 1.0 = normal, 1.3 = heavy) */
  build: number;
  /** Body height multiplier (0.85 = short, 1.0 = normal, 1.15 = tall) */
  height: number;
}

