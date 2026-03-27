import { Application, Graphics, RenderTexture, Container } from "pixi.js";
import type { Direction, ModelPalette, CompositeConfig } from "./types";
import { FRAME_W, FRAME_H, DIRECTION_COUNT } from "./types";
import { renderComposite, renderModel } from "./composite";
import { computePalette } from "./palette";
import { registry } from "./registry";

/**
 * GameBridge — renders workbench models into RenderTextures for use in the game client.
 *
 * This bridges the gap between the workbench's DrawCall-based rendering system
 * and the game's sprite sheet texture system. The game client can call:
 *
 *   const textures = bridge.generateSpriteSheet("skeleton-body");
 *
 * ...to get an array of 8 directional RenderTextures that can be used exactly
 * like EntitySpriteSheet's generated frames.
 *
 * Usage in the game client:
 * 1. Import all model barrel files (bodies, weapons, armor, etc.)
 * 2. Create a GameBridge instance with the PixiJS app
 * 3. Call generateSpriteSheet() to get textures per entity type
 * 4. Feed textures into EntitySpriteSheet's cache or use directly
 */
export class GameBridge {
  private app: Application;
  private cache = new Map<string, RenderTexture[]>();

  constructor(app: Application) {
    this.app = app;
  }

  /**
   * Generate 8-directional sprite textures for a single model (NPC body, weapon, etc).
   * Returns array of 8 RenderTextures indexed by direction.
   */
  generateSpriteSheet(
    modelId: string,
    palette?: ModelPalette,
    frameW: number = FRAME_W,
    frameH: number = FRAME_H,
    scale: number = 1
  ): RenderTexture[] {
    const cacheKey = `${modelId}:${scale}`;
    if (this.cache.has(cacheKey)) return this.cache.get(cacheKey)!;

    const defaultPalette = palette ?? computePalette(0xf0c8a0, 0x5c3a1e, 0x334455, 0x4466aa, 0x886633, "none");
    const textures: RenderTexture[] = [];

    for (let dir = 0; dir < DIRECTION_COUNT; dir++) {
      const container = new Container();
      const g = new Graphics();
      container.addChild(g);

      // Position graphics at center of frame
      g.position.set(frameW / 2, frameH - 4);

      renderModel(g, modelId, defaultPalette, dir, 0, scale, false);

      const rt = RenderTexture.create({ width: frameW, height: frameH });
      this.app.renderer.render({ container, target: rt });
      textures.push(rt);

      container.destroy();
    }

    this.cache.set(cacheKey, textures);
    return textures;
  }

  /**
   * Generate 8-directional sprite textures for a composite character
   * (body + equipped items). Use for player characters.
   */
  generateCompositeSpriteSheet(
    config: CompositeConfig,
    frameW: number = FRAME_W,
    frameH: number = FRAME_H,
    scale: number = 1
  ): RenderTexture[] {
    const textures: RenderTexture[] = [];

    for (let dir = 0; dir < DIRECTION_COUNT; dir++) {
      const container = new Container();
      const g = new Graphics();
      container.addChild(g);

      g.position.set(frameW / 2, frameH - 4);

      renderComposite(g, config, dir, 0, scale);

      const rt = RenderTexture.create({ width: frameW, height: frameH });
      this.app.renderer.render({ container, target: rt });
      textures.push(rt);

      container.destroy();
    }

    return textures;
  }

  /**
   * Generate walk cycle frames for a model (8 directions × N walk phases).
   * Returns a 2D array: walkFrames[direction][phase].
   */
  generateWalkCycle(
    modelId: string,
    palette?: ModelPalette,
    phases: number = 8,
    frameW: number = FRAME_W,
    frameH: number = FRAME_H,
    scale: number = 1
  ): RenderTexture[][] {
    const defaultPalette = palette ?? computePalette(0xf0c8a0, 0x5c3a1e, 0x334455, 0x4466aa, 0x886633, "none");
    const result: RenderTexture[][] = [];

    for (let dir = 0; dir < DIRECTION_COUNT; dir++) {
      const dirFrames: RenderTexture[] = [];
      for (let p = 0; p < phases; p++) {
        const walkPhase = (p / phases) * Math.PI * 2;
        const container = new Container();
        const g = new Graphics();
        container.addChild(g);

        g.position.set(frameW / 2, frameH - 4);

        renderModel(g, modelId, defaultPalette, dir, walkPhase, scale, false);

        const rt = RenderTexture.create({ width: frameW, height: frameH });
        this.app.renderer.render({ container, target: rt });
        dirFrames.push(rt);

        container.destroy();
      }
      result.push(dirFrames);
    }

    return result;
  }

  /**
   * Check if a model exists in the registry.
   */
  hasModel(id: string): boolean {
    return registry.has(id);
  }

  /**
   * List all available model IDs by category.
   */
  listModels(category?: string): string[] {
    return registry.list(category as any).map((m) => m.id);
  }

  /**
   * Clear the texture cache (call when disposing).
   */
  clearCache(): void {
    for (const textures of this.cache.values()) {
      for (const t of textures) t.destroy();
    }
    this.cache.clear();
  }
}
