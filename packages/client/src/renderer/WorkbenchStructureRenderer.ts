import { Application, Container, Graphics, RenderTexture, Sprite } from "pixi.js";
import "../../../../tools/model-workbench/src/models/structures/index";
import { renderModel } from "../../../../tools/model-workbench/src/models/composite";
import { computePalette } from "../../../../tools/model-workbench/src/models/palette";
import type { WallPiece } from "./StructureRenderer";
import { worldToScreen, TILE_WIDTH_HALF, TILE_HEIGHT_HALF } from "./IsometricRenderer";

/**
 * WorkbenchStructureRenderer — replaces StructureRenderer with workbench wall sprites.
 *
 * Scale correction: workbench wall models use T=22, H2=11 as their tile dimensions.
 * The game tile is TILE_WIDTH_HALF=32, TILE_HEIGHT_HALF=16. We scale models by
 * TILE_SCALE = 32/22 so wall faces align exactly with tile diamond edges.
 *
 * Quality: render at 2× for crispness, display at 0.5× to keep visual size.
 *
 * Corners: workbench has no corner model. We render wall-n + wall-w overlaid at
 * the corner tile to produce a convincing L-shaped post.
 */

// Workbench wall geometry constants (from WallN/WallW source)
const T       = 22;   // half tile width in model coords
const H2      = T / 2; // half tile height = 11
const STORY_H = 3 * T; // wall height = 66

// Scale so model geometry matches game tile dimensions exactly
const TILE_SCALE    = TILE_WIDTH_HALF / T;          // 32/22 ≈ 1.4545
const QUALITY       = 2;                              // 2× render quality
const MODEL_SCALE   = TILE_SCALE * QUALITY;           // ≈ 2.909
const DISPLAY_SCALE = 1 / QUALITY;                   // 0.5

// Frame dimensions at MODEL_SCALE (walls at TILE_SCALE fit exactly, × QUALITY for crisp textures)
const FRAME_W  = Math.ceil(T * 2 * MODEL_SCALE + 24);            // ~152px — full tile width + depth margin
const FRAME_H  = Math.ceil((H2 + STORY_H) * MODEL_SCALE + 24);  // ~248px — full wall height + margins
const ORIGIN_Y = Math.ceil(STORY_H * MODEL_SCALE + 12);          // y in texture where tile-centre sits

// Sprite anchor: tile centre is at (FRAME_W/2, ORIGIN_Y) in the texture
const ANCHOR_X = 0.5;
const ANCHOR_Y = ORIGIN_Y / FRAME_H;

// Material → workbench palette primary colour
const MATERIAL_PRIMARY: Record<string, number> = {
  stone:   0x8a8a8a,
  wood:    0x7a5c1e,
  plaster: 0xcfbc96,
};

// WallPiece type → one or two workbench model IDs to render at that tile
function modelsForPiece(type: WallPiece["type"]): string[] {
  switch (type) {
    case "wall_left":
    case "wall_left_door":
    case "wall_left_win":
      return ["wall-n"];          // NW diamond edge (left → top)
    case "wall_right":
    case "wall_right_door":
    case "wall_right_win":
      return ["wall-e"];          // NE diamond edge (top → right)
    case "wall_corner":
      // Render both faces to create an L-shaped corner post
      return ["wall-n", "wall-e"];
    case "floor":
      return ["floor-tile"];
    default:
      return []; // stair_left, stair_right — no workbench model yet
  }
}

interface WallSprite {
  sprite: Sprite;
  elevation: number;
}

export class WorkbenchStructureRenderer {
  public container: Container;

  private app: Application;
  private textureCache = new Map<string, RenderTexture>();
  private wallSprites: WallSprite[] = [];

  constructor(app: Application) {
    this.app = app;
    this.container = new Container();
    this.container.sortableChildren = true;
  }

  loadWalls(pieces: WallPiece[]): void {
    for (const piece of pieces) {
      const models = modelsForPiece(piece.type);
      if (models.length === 0) continue;

      const elevation = piece.elevation ?? 0;
      const { sx, sy } = worldToScreen(piece.tileX, piece.tileZ, elevation);
      const zBase = (piece.tileX + piece.tileZ) * 10 + elevation * 1000 + 3;

      for (const modelId of models) {
        const texture = this.getTexture(modelId, piece.material);
        const sprite = new Sprite(texture);
        sprite.anchor.set(ANCHOR_X, ANCHOR_Y);
        sprite.scale.set(DISPLAY_SCALE);
        sprite.position.set(sx, sy);
        sprite.zIndex = zBase;

        this.container.addChild(sprite);
        this.wallSprites.push({ sprite, elevation });
      }
    }
  }

  /** Match StructureRenderer API: fade upper-floor walls when player is on ground floor. */
  updateFloorVisibility(playerFloor: number, _underCover: boolean): void {
    for (const { sprite, elevation } of this.wallSprites) {
      sprite.alpha = elevation === 0 || playerFloor >= elevation ? 1 : 0.1;
    }
  }

  dispose(): void {
    for (const rt of this.textureCache.values()) rt.destroy();
    this.textureCache.clear();
    this.container.destroy({ children: true });
  }

  // ─── Private ─────────────────────────────────────────────────────

  private getTexture(modelId: string, material: WallPiece["material"]): RenderTexture {
    const key = `${modelId}:${material}`;
    if (this.textureCache.has(key)) return this.textureCache.get(key)!;

    const primary = MATERIAL_PRIMARY[material] ?? MATERIAL_PRIMARY.stone;
    const palette = computePalette(primary, primary, primary, primary, primary, "none");

    const g = new Graphics();
    g.position.set(FRAME_W / 2, ORIGIN_Y);
    // dir=0 (S): iso.y=0.5 > 0, shows outer face; iso.x=0, shows both edges
    renderModel(g, modelId, palette, 0, 0, MODEL_SCALE, false);

    const tempContainer = new Container();
    tempContainer.addChild(g);

    const rt = RenderTexture.create({ width: FRAME_W, height: FRAME_H });
    this.app.renderer.render({ container: tempContainer, target: rt });
    tempContainer.destroy();

    this.textureCache.set(key, rt);
    return rt;
  }
}
