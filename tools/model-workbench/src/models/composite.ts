import type { Graphics } from "pixi.js";
import type {
  CompositeConfig,
  Direction,
  DrawCall,
  ModelPalette,
  RenderContext,
  SlotParams,
} from "./types";
import { DEFAULT_SLOT_PARAMS } from "./types";
import { computeHumanoidSkeleton } from "./skeleton";
import { registry } from "./registry";

/**
 * Build a base render context (for the body model itself — neutral slot params).
 */
function buildBaseContext(
  skeleton: ReturnType<typeof computeHumanoidSkeleton>,
  palette: ModelPalette
): RenderContext {
  const iso = skeleton.iso;
  const leftIsFar = iso.x >= 0;
  return {
    skeleton,
    palette,
    farSide: leftIsFar ? "L" : "R",
    nearSide: leftIsFar ? "R" : "L",
    facingCamera: iso.y > 0,
    slotParams: DEFAULT_SLOT_PARAMS,
  };
}

/**
 * Merge body-defined attachment params with any per-slot user overrides.
 */
function resolveSlotParams(
  bodyParams: SlotParams,
  overrides?: Partial<SlotParams>
): SlotParams {
  if (!overrides) return bodyParams;
  return {
    size: overrides.size ?? bodyParams.size,
    ratio: overrides.ratio ?? bodyParams.ratio,
    offset: overrides.offset ?? bodyParams.offset,
  };
}

/**
 * Render a composite entity — a base model with attached child models.
 * Each child receives slot params derived from the body's attachment point
 * definitions, merged with any per-slot overrides in the config.
 */
export function renderComposite(
  g: Graphics,
  config: CompositeConfig,
  dir: Direction | number,
  walkPhase: number,
  scale: number,
  combatPhase: number = 0
): void {
  const skeleton = computeHumanoidSkeleton(dir as Direction, walkPhase, config.build ?? 1, config.height ?? 1, combatPhase);
  const baseCtx = buildBaseContext(skeleton, config.palette);
  const baseModel = registry.get(config.baseModelId);

  // Get body's attachment points (with its body-specific params)
  const bodyAttachments = baseModel?.getAttachmentPoints(skeleton) ?? skeleton.attachments;

  const calls: DrawCall[] = [];

  // Base body draw calls (neutral slot params)
  if (baseModel) {
    calls.push(...baseModel.getDrawCalls(baseCtx));
  }

  // Attached model draw calls — each gets resolved slot params
  for (const att of config.attachments) {
    const childModel = registry.get(att.modelId);
    if (!childModel) continue;

    // Look up the body's attachment point for this slot
    const bodyAP = bodyAttachments[att.slot];
    const bodyParams = bodyAP?.params ?? DEFAULT_SLOT_PARAMS;

    // Merge with any per-slot overrides from the config
    const resolvedParams = resolveSlotParams(bodyParams, att.overrides);

    const childCtx: RenderContext = { ...baseCtx, slotParams: resolvedParams };
    calls.push(...childModel.getDrawCalls(childCtx));
  }

  // Sort by depth and execute
  calls.sort((a, b) => a.depth - b.depth);
  for (const call of calls) {
    call.draw(g, scale);
  }
}

/**
 * Render a single model in isolation (for the individual model view).
 * For non-root models, optionally renders on a ghost body for context.
 */
export function renderModel(
  g: Graphics,
  modelId: string,
  palette: ModelPalette,
  dir: Direction | number,
  walkPhase: number,
  scale: number,
  showGhostBody: boolean = false
): void {
  const skeleton = computeHumanoidSkeleton(dir as Direction, walkPhase);
  const ctx = buildBaseContext(skeleton, palette);

  const calls: DrawCall[] = [];

  // Ghost body (faint silhouette for context)
  if (showGhostBody) {
    const bodyModel = registry.get("human-body");
    if (bodyModel) {
      // We'll draw the body calls but they'll appear as-is
      // A proper ghost effect would need alpha, but for now it provides context
      calls.push(...bodyModel.getDrawCalls(ctx));
    }
  }

  // The actual model
  const model = registry.get(modelId);
  if (model) {
    calls.push(...model.getDrawCalls(ctx));
  }

  calls.sort((a, b) => a.depth - b.depth);
  for (const call of calls) {
    call.draw(g, scale);
  }
}
