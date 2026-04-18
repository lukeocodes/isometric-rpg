import type { Graphics } from "pixi.js";
import type { Model, RenderContext, DrawCall, AttachmentPoint, FitmentCorners } from "../types";
import { DEPTH_FAR_LIMB, DEPTH_BODY, DEPTH_NEAR_LIMB } from "../types";
import { darken } from "../palette";
import { drawCornerQuad, quadPoint, sideCorners } from "../draw-helpers";

/**
 * Mail Mantlets — chain-mail shoulder drapes.
 *
 * CORNER-BASED: Uses fitmentCorners (shoulders slot) split per-side via sideCorners().
 * Ring rows and leather hem adapt to any body width.
 */
export class ShouldersMail implements Model {
  readonly id = "shoulders-mail";
  readonly name = "Mail Mantlets";
  readonly category = "shoulders" as const;
  readonly slot = "shoulders" as const;

  getDrawCalls(ctx: RenderContext): DrawCall[] {
    const { skeleton, palette, farSide, nearSide, facingCamera, fitmentCorners } = ctx;
    const j  = skeleton.joints;
    const sz = ctx.slotParams.size;
    const wf = skeleton.wf;

    const fc: FitmentCorners = fitmentCorners ?? {
      tl: { x: j.shoulderL.x - 3 * wf, y: j.shoulderL.y - 2 },
      tr: { x: j.shoulderR.x + 3 * wf, y: j.shoulderR.y - 2 },
      bl: { x: j.elbowL.x, y: j.elbowL.y },
      br: { x: j.elbowR.x, y: j.elbowR.y },
    };

    return [
      {
        depth: facingCamera ? DEPTH_FAR_LIMB + 9 : DEPTH_NEAR_LIMB + 1,
        draw: (g, s) => this.drawMantlet(g, palette, s, farSide, fc, sz, false, facingCamera),
      },
      {
        depth: facingCamera ? DEPTH_BODY + 3 : DEPTH_FAR_LIMB + 11,
        draw: (g, s) => this.drawMantlet(g, palette, s, nearSide, fc, sz, true, facingCamera),
      },
    ];
  }

  private drawMantlet(
    g: Graphics,
    p: any,
    s: number,
    side: "L" | "R",
    fc: FitmentCorners,
    sz: number,
    isNear: boolean,
    facingCamera: boolean,
  ): void {
    const sc = sideCorners(fc, side);
    const fillColor = isNear ? p.body : darken(p.body, 0.12);
    const alpha = facingCamera ? 1 : 0.88;

    // Mantlet fill — slightly inset so outer edge shows as drape shadow
    drawCornerQuad(g, sc, 0, darken(fillColor, facingCamera ? 0 : 0.06), p.outline, 0.38 * alpha, s);

    // Ring rows — 3 horizontal lines spaced evenly
    for (let row = 0; row < 3; row++) {
      const t = 0.15 + row * 0.28;
      const rowL = quadPoint(sc, 0.05, t);
      const rowR = quadPoint(sc, 0.95, t);
      g.moveTo(rowL.x * s, rowL.y * s); g.lineTo(rowR.x * s, rowR.y * s);
      g.stroke({ width: s * 0.45, color: p.bodyLt, alpha: (facingCamera ? 0.32 : 0.2) });
    }

    // Ring circles along the middle row
    for (let i = 0; i < 3; i++) {
      const u = 0.2 + i * 0.3;
      const pt = quadPoint(sc, u, 0.43);
      g.circle(pt.x * s, pt.y * s, 0.55 * sz * s);
      g.stroke({ width: s * 0.25, color: p.bodyLt, alpha: 0.28 * alpha });
    }

    // Leather hem along bottom edge
    const hemL = quadPoint(sc, 0.0, 0.9);
    const hemR = quadPoint(sc, 1.0, 0.9);
    g.moveTo(hemL.x * s, hemL.y * s); g.lineTo(hemR.x * s, hemR.y * s);
    g.stroke({ width: s * 1.4, color: p.accent, alpha: 0.55 * alpha });
    g.moveTo(hemL.x * s, hemL.y * s); g.lineTo(hemR.x * s, hemR.y * s);
    g.stroke({ width: s * 0.35, color: p.accentDk, alpha: 0.35 * alpha });
  }

  getAttachmentPoints(): Record<string, AttachmentPoint> { return {}; }
}
