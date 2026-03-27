import type { Graphics } from "pixi.js";

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

export interface AttachmentPoint {
  position: V;
  /** Angle in radians for attached model orientation */
  angle: number;
  /** Perspective width factor at this point */
  wf: number;
  /** Default slot rendering parameters — equipment reads these to scale correctly */
  params: SlotParams;
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
