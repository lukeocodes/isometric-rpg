import type { Graphics } from "pixi.js";
import type { Model, RenderContext, DrawCall, AttachmentPoint, FitmentCorners } from "../types";
import { DEPTH_FAR_LIMB, DEPTH_NEAR_LIMB } from "../types";
import { darken } from "../palette";
import { drawCornerQuad, quadPoint, sideCorners } from "../draw-helpers";

/**
 * Cloth Wrappings — linen wrap bands and fingerless cloth gloves.
 *
 * CORNER-BASED: Uses fitmentCorners (gauntlets slot) split per-side.
 */
export class GauntletsCloth implements Model {
  readonly id = "gauntlets-cloth";
  readonly name = "Cloth Wrappings";
  readonly category = "gauntlets" as const;
  readonly slot = "gauntlets" as const;

  getDrawCalls(ctx: RenderContext): DrawCall[] {
    const { skeleton, palette, farSide, nearSide, facingCamera, fitmentCorners } = ctx;
    const j  = skeleton.joints;
    const sz = ctx.slotParams.size;
    const wf = skeleton.wf;

    const fc: FitmentCorners = fitmentCorners ?? {
      tl: { x: j.elbowL.x, y: j.elbowL.y },
      tr: { x: j.elbowR.x, y: j.elbowR.y },
      bl: { x: j.wristL.x, y: j.wristL.y },
      br: { x: j.wristR.x, y: j.wristR.y },
    };

    return [
      {
        depth: facingCamera ? DEPTH_FAR_LIMB + 9 : DEPTH_NEAR_LIMB + 1,
        draw: (g, s) => this.drawWrap(g, j, palette, s, farSide, fc, sz, wf, false),
      },
      {
        depth: facingCamera ? DEPTH_NEAR_LIMB + 6 : DEPTH_FAR_LIMB + 11,
        draw: (g, s) => this.drawWrap(g, j, palette, s, nearSide, fc, sz, wf, true),
      },
    ];
  }

  private drawWrap(
    g: Graphics,
    j: Record<string, any>,
    p: any,
    s: number,
    side: "L" | "R",
    fc: FitmentCorners,
    sz: number,
    wf: number,
    isNear: boolean,
  ): void {
    const sc    = sideCorners(fc, side);
    const elbow = j[`elbow${side}`];
    const wrist = j[`wrist${side}`];
    const color = isNear ? p.body   : darken(p.body, 0.12);
    const dark  = isNear ? p.bodyDk : darken(p.bodyDk, 0.12);

    // Base cloth wrap fill
    drawCornerQuad(g, sc, 0, color, p.outline, 0.32, s);

    // Wrap bands — 3 diagonal-ish horizontal lines
    for (let i = 0; i < 3; i++) {
      const t = 0.15 + i * 0.27;
      const bandL = quadPoint(sc, 0.04, t);
      const bandR = quadPoint(sc, 0.96, t);
      g.moveTo(bandL.x * s, bandL.y * s); g.lineTo(bandR.x * s, bandR.y * s);
      g.stroke({ width: s * 0.5, color: dark, alpha: 0.28 });
    }

    // Accent colour end-tuck line at wrist
    const tuckL = quadPoint(sc, 0.06, 0.86);
    const tuckR = quadPoint(sc, 0.94, 0.86);
    g.moveTo(tuckL.x * s, tuckL.y * s); g.lineTo(tuckR.x * s, tuckR.y * s);
    g.stroke({ width: s * 0.7, color: p.accent, alpha: 0.55 });

    // Cloth hand (fingerless — slightly wider circle)
    const handR = Math.abs(sc.br.x - sc.bl.x) * 0.6;
    g.circle(wrist.x * s, wrist.y * s, handR * s);
    g.fill(color);
    g.circle(wrist.x * s, wrist.y * s, handR * s);
    g.stroke({ width: s * 0.3, color: p.outline, alpha: 0.25 });

    // Knuckle line on hand
    const dx = wrist.x - elbow.x;
    const dy = wrist.y - elbow.y;
    const len = Math.sqrt(dx * dx + dy * dy) || 1;
    g.moveTo((wrist.x + dx / len * (handR - 0.4)) * s, (wrist.y + dy / len * (handR - 0.4)) * s);
    g.lineTo((wrist.x + dx / len * handR) * s, (wrist.y + dy / len * handR) * s);
    g.stroke({ width: s * 1.2, color: dark, alpha: 0.2 });
  }

  getAttachmentPoints(): Record<string, AttachmentPoint> { return {}; }
}
