import { Application, Graphics, RenderTexture, Container, Texture } from "pixi.js";
import type { Direction, ModelPalette, CompositeConfig } from "./types";
import { DIRECTION_COUNT } from "./types";
import { renderComposite, renderModel } from "./composite";
import { computePalette } from "./palette";
import { registry } from "./registry";

/**
 * WorkbenchSpriteSheet — drop-in replacement for the game client's EntitySpriteSheet.
 *
 * Implements the same API as EntitySpriteSheet:
 *   - getFrame(entityType: string, direction: number): Texture
 *   - has(entityType: string): boolean
 *   - dispose(): void
 *
 * But renders frames using the workbench model registry instead of hardcoded
 * draw functions. This means all 74+ workbench models are available in-game.
 *
 * Usage in game client:
 * ```typescript
 * // Import workbench model barrels
 * import "model-workbench/src/models/bodies/index";
 * import "model-workbench/src/models/weapons/index";
 * // ... etc
 *
 * // Create adapter
 * const spriteSheet = new WorkbenchSpriteSheet(app);
 *
 * // Use exactly like EntitySpriteSheet
 * entityRenderer.setSpriteSheet(spriteSheet);
 * ```
 *
 * Entity name → model mapping:
 * The game uses entity names like "Rabbit Burrow", "Skeleton Warrior" etc.
 * This class maps those names to workbench model IDs using substring matching,
 * falling back to "human-body" for unknown types.
 */

// Render at 2× the workbench's native frame so lines stay crisp at game scale.
// The sprite is displayed at displayScale (0.5) to keep the visual size consistent.
const RENDER_SCALE = 2;
const WALK_PHASES = 8;
const FRAME_W_RENDER = 48 * RENDER_SCALE;  // 96
const FRAME_H_RENDER = 64 * RENDER_SCALE;  // 128

/**
 * Maps game entity names (substring) to workbench model IDs.
 * Order matters — first match wins.
 */
const NAME_TO_MODEL: [string, string][] = [
  // Boss variants (check first — more specific)
  ["king rabbit", "king-rabbit"],
  ["skeleton lord", "skeleton-lord"],
  ["alpha wolf", "alpha-wolf"],
  ["goblin chieftain", "goblin-chieftain"],
  ["imp overlord", "imp-overlord"],
  ["elder bear", "elder-bear"],

  // Base NPCs
  ["rabbit", "rabbit-body"],
  ["skeleton", "skeleton-body"],
  ["goblin", "goblin-body"],
  ["imp", "imp-body"],
  ["wolf", "wolf-body"],
  ["ogre", "ogre-body"],
  ["wraith", "wraith-body"],
  ["bear", "bear-body"],
];

/**
 * Default palettes per NPC type (matches the game's existing entity colors).
 */
const NPC_PALETTES: Record<string, ModelPalette> = {};

function getNpcPalette(modelId: string): ModelPalette {
  if (!NPC_PALETTES[modelId]) {
    // Default NPC palette — models use their own hardcoded colors anyway
    NPC_PALETTES[modelId] = computePalette(0xf0c8a0, 0x5c3a1e, 0x334455, 0x4466aa, 0x886633, "none");
  }
  return NPC_PALETTES[modelId];
}

/**
 * Resolve a game entity name to a workbench model ID.
 */
function resolveModelId(entityName: string): string {
  const lower = entityName.toLowerCase();
  for (const [pattern, modelId] of NAME_TO_MODEL) {
    if (lower.includes(pattern)) return modelId;
  }
  return "human-body"; // fallback for players
}

type EntityFrames = Texture[];

export class WorkbenchSpriteSheet {
  private app: Application;
  private cache = new Map<string, EntityFrames>();

  /** Scale sprites by this when adding to the scene to get correct visual size. */
  readonly displayScale = 1 / RENDER_SCALE;
  /** Number of walk animation frames per direction. */
  readonly walkPhases = WALK_PHASES;

  constructor(app: Application) {
    this.app = app;
  }

  /**
   * Get a directional + walk-phase texture frame for an entity type.
   * walkPhaseIndex 0..WALK_PHASES-1 (defaults to 0 = idle pose).
   */
  getFrame(entityType: string, direction: number, walkPhaseIndex = 0): Texture {
    if (!this.cache.has(entityType)) {
      this.cache.set(entityType, this.generateFrames(entityType));
    }
    const frames = this.cache.get(entityType)!;
    const dir = direction % DIRECTION_COUNT;
    const phase = walkPhaseIndex % WALK_PHASES;
    return frames[dir * WALK_PHASES + phase] ?? frames[0];
  }

  /**
   * Check if frames exist (or can be generated) for an entity type.
   */
  has(entityType: string): boolean {
    // We can always generate — resolve the name to a model
    const modelId = resolveModelId(entityType);
    return registry.has(modelId);
  }

  /**
   * Get a directional texture for a composite character (player with equipment).
   */
  getCompositeFrame(config: CompositeConfig, direction: number, walkPhaseIndex = 0): Texture {
    const key = this.compositeKey(config);
    if (!this.cache.has(key)) {
      this.cache.set(key, this.generateCompositeFrames(config));
    }
    const frames = this.cache.get(key)!;
    const dir = direction % DIRECTION_COUNT;
    const phase = walkPhaseIndex % WALK_PHASES;
    return frames[dir * WALK_PHASES + phase] ?? frames[0];
  }

  /**
   * Invalidate composite cache when equipment changes.
   */
  invalidateComposite(config: CompositeConfig): void {
    const key = this.compositeKey(config);
    const frames = this.cache.get(key);
    if (frames) {
      for (const f of frames) {
        if (f instanceof RenderTexture) f.destroy();
      }
      this.cache.delete(key);
    }
  }

  /**
   * Destroy all cached textures.
   */
  dispose(): void {
    for (const frames of this.cache.values()) {
      for (const f of frames) {
        if (f instanceof RenderTexture) f.destroy();
      }
    }
    this.cache.clear();
  }

  // ─── Private ─────────────────────────────────────────────────────

  private generateFrames(entityType: string): EntityFrames {
    const modelId = resolveModelId(entityType);
    const palette = getNpcPalette(modelId);
    const frames: Texture[] = [];

    for (let dir = 0; dir < DIRECTION_COUNT; dir++) {
      for (let p = 0; p < WALK_PHASES; p++) {
        const walkPhase = (p / WALK_PHASES) * Math.PI * 2;
        const container = new Container();
        const g = new Graphics();
        container.addChild(g);

        g.position.set(FRAME_W_RENDER / 2, FRAME_H_RENDER - 4 * RENDER_SCALE);
        renderModel(g, modelId, palette, dir, walkPhase, RENDER_SCALE, false);

        const rt = RenderTexture.create({ width: FRAME_W_RENDER, height: FRAME_H_RENDER });
        this.app.renderer.render({ container, target: rt });
        frames.push(rt);
        container.destroy();
      }
    }

    return frames;
  }

  private generateCompositeFrames(config: CompositeConfig): EntityFrames {
    const frames: Texture[] = [];

    for (let dir = 0; dir < DIRECTION_COUNT; dir++) {
      for (let p = 0; p < WALK_PHASES; p++) {
        const walkPhase = (p / WALK_PHASES) * Math.PI * 2;
        const container = new Container();
        const g = new Graphics();
        container.addChild(g);

        g.position.set(FRAME_W_RENDER / 2, FRAME_H_RENDER - 4 * RENDER_SCALE);
        renderComposite(g, config, dir, walkPhase, RENDER_SCALE);

        const rt = RenderTexture.create({ width: FRAME_W_RENDER, height: FRAME_H_RENDER });
        this.app.renderer.render({ container, target: rt });
        frames.push(rt);
        container.destroy();
      }
    }

    return frames;
  }

  private compositeKey(config: CompositeConfig): string {
    const parts = [
      config.baseModelId,
      `b${config.build ?? 1}h${config.height ?? 1}`,
      ...config.attachments.map((a) => `${a.slot}:${a.modelId}`).sort(),
    ];
    return `composite:${parts.join("|")}`;
  }
}
