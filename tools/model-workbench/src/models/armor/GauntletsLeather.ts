import type { Graphics } from "pixi.js";
import type { Model, RenderContext, DrawCall, AttachmentPoint, FitmentCorners } from "../types";
import { DEPTH_FAR_LIMB, DEPTH_NEAR_LIMB } from "../types";
import { darken } from "../palette";
import { drawCornerQuad, quadPoint, sideCorners } from "../draw-helpers";

/**
 * Leather Bracers — hardened leather forearm guards with wrist plate and fingerless glove.
 *
 * CORNER-BASED: Uses fitmentCorners (gauntlets slot) split per-side.
 */
export class GauntletsLeather implements Model {
  readonly id = "gauntlets-leather";
  readonly name = "Leather Bracers";
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
        draw: (g, s) => this.drawBracer(g, j, palette, s, farSide, fc, sz, wf, false),
      },
      {
        depth: facingCamera ? DEPTH_NEAR_LIMB + 6 : DEPTH_FAR_LIMB + 11,
        draw: (g, s) => this.drawBracer(g, j, palette, s, nearSide, fc, sz, wf, true),
      },
    ];
  }

  private drawBracer(
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
    const color  = isNear ? p.body    : darken(p.body, 0.12);
    const accent = isNear ? p.accent  : darken(p.accent, 0.1);

    // Leather bracer body
    drawCornerQuad(g, sc, 0, color, p.outline, 0.4, s);

    // Wrist guard — accent band at bottom 25%
    const guardTL = quadPoint(sc, 0.0, 0.72);
    const guardTR = quadPoint(sc, 1.0, 0.72);
    const guardBL = quadPoint(sc, 0.0, 1.0);
    const guardBR = quadPoint(sc, 1.0, 1.0);
    const guardFC: FitmentCorners = { tl: guardTL, tr: guardTR, bl: guardBL, br: guardBR };
    drawCornerQuad(g, guardFC, 0, accent, p.accentDk, 0.4, s);

    // Buckle on bracer (1/3 from elbow)
    const buckle = quadPoint(sc, 0.5, 0.3);
    g.rect((buckle.x - 0.9 * sz) * s, (buckle.y - 0.6 * sz) * s, 1.8 * sz * s, 1.2 * sz * s);
    g.fill(p.accentDk);

    // Stitching lines
    const stL_t = quadPoint(sc, 0.12, 0.08);
    const stL_b = quadPoint(sc, 0.12, 0.68);
    const stR_t = quadPoint(sc, 0.88, 0.08);
    const stR_b = quadPoint(sc, 0.88, 0.68);
    g.moveTo(stL_t.x * s, stL_t.y * s); g.lineTo(stL_b.x * s, stL_b.y * s);
    g.moveTo(stR_t.x * s, stR_t.y * s); g.lineTo(stR_b.x * s, stR_b.y * s);
    g.stroke({ width: s * 0.3, color: p.accentDk, alpha: 0.28 });

    // Fingerless glove
    const handR = Math.abs(sc.br.x - sc.bl.x) * 0.58;
    g.circle(wrist.x * s, wrist.y * s, handR * s);
    g.fill(color);
    g.circle(wrist.x * s, wrist.y * s, handR * s);
    g.stroke({ width: s * 0.3, color: p.outline, alpha: 0.28 });
  }

  getAttachmentPoints(): Record<string, AttachmentPoint> { return {}; }
}
