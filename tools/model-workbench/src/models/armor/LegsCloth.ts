import type { Graphics } from "pixi.js";
import type { Model, RenderContext, DrawCall, AttachmentPoint, FitmentCorners } from "../types";
import { DEPTH_FAR_LIMB, DEPTH_BODY } from "../types";
import { darken } from "../palette";
import { drawCornerQuad, quadPoint, sideCorners } from "../draw-helpers";

/**
 * Cloth Trousers — loose fabric leg covering with ankle hem and waist sash.
 *
 * CORNER-BASED: Uses fitmentCorners (legs slot) split per-side.
 * Wider than body to give a flowing loose look.
 */
export class LegsCloth implements Model {
  readonly id = "legs-cloth";
  readonly name = "Cloth Trousers";
  readonly category = "legs" as const;
  readonly slot = "legs" as const;

  getDrawCalls(ctx: RenderContext): DrawCall[] {
    const { skeleton, palette, farSide, nearSide, fitmentCorners } = ctx;
    const j  = skeleton.joints;
    const sz = ctx.slotParams.size;

    const fc: FitmentCorners = fitmentCorners ?? {
      tl: { x: j.hipL.x,   y: j.hipL.y   },
      tr: { x: j.hipR.x,   y: j.hipR.y   },
      bl: { x: j.ankleL.x, y: j.ankleL.y },
      br: { x: j.ankleR.x, y: j.ankleR.y },
    };

    const calls: DrawCall[] = [];

    calls.push({ depth: DEPTH_FAR_LIMB + 1, draw: (g, s) => this.drawTrouserLeg(g, j, palette, s, farSide,  fc, sz, false) });
    calls.push({ depth: DEPTH_FAR_LIMB + 5, draw: (g, s) => this.drawTrouserLeg(g, j, palette, s, nearSide, fc, sz, true)  });

    // Waist sash at BODY+3
    calls.push({
      depth: DEPTH_BODY + 3,
      draw: (g, s) => {
        const { hipL, hipR, crotch } = j;
        const sashTL = { x: hipL.x - 1.5 * sz, y: hipL.y };
        const sashTR = { x: hipR.x + 1.5 * sz, y: hipR.y };
        const sashBL = { x: (hipL.x + crotch.x) / 2 - 0.5, y: crotch.y + 0.5 };
        const sashBR = { x: (hipR.x + crotch.x) / 2 + 0.5, y: crotch.y + 0.5 };
        const sashFC: FitmentCorners = { tl: sashTL, tr: sashTR, bl: sashBL, br: sashBR };
        drawCornerQuad(g, sashFC, 0, palette.body, palette.outline, 0.3, s);
        // Sash tie knot at centre
        const knot = { x: (hipL.x + hipR.x) / 2, y: (hipL.y + hipR.y) / 2 + 1 };
        g.circle(knot.x * s, knot.y * s, 1.2 * sz * s); g.fill(palette.accent);
        g.circle(knot.x * s, knot.y * s, 1.2 * sz * s); g.stroke({ width: s * 0.3, color: palette.accentDk, alpha: 0.35 });
      },
    });

    return calls;
  }

  private drawTrouserLeg(
    g: Graphics,
    j: Record<string, any>,
    p: any,
    s: number,
    side: "L" | "R",
    fc: FitmentCorners,
    sz: number,
    isNear: boolean,
  ): void {
    const sc    = sideCorners(fc, side);
    const knee  = j[`knee${side}`];
    const ankle = j[`ankle${side}`];
    const color = isNear ? p.body : darken(p.body, 0.1);
    const dark  = isNear ? p.bodyDk : darken(p.bodyDk, 0.1);

    // Looser cloth: expand sc outward slightly for loose trouser look
    const looseFC: FitmentCorners = {
      tl: { x: sc.tl.x - 1.5 * sz, y: sc.tl.y },
      tr: { x: sc.tr.x + 1.5 * sz, y: sc.tr.y },
      bl: { x: sc.bl.x - 1 * sz,   y: sc.bl.y },
      br: { x: sc.br.x + 1 * sz,   y: sc.br.y },
    };

    // Cloth fill
    drawCornerQuad(g, looseFC, 0, color, p.outline, 0.3, s);

    // Knee gather crease
    const creaseL = quadPoint(looseFC, 0.12, 0.46);
    const creaseR = quadPoint(looseFC, 0.88, 0.46);
    g.moveTo(creaseL.x * s, creaseL.y * s);
    g.quadraticCurveTo(
      quadPoint(looseFC, 0.5, 0.5).x * s, quadPoint(looseFC, 0.5, 0.5).y * s,
      creaseR.x * s, creaseR.y * s,
    );
    g.stroke({ width: s * 0.45, color: dark, alpha: 0.25 });

    // Ankle hem
    const hemL = quadPoint(looseFC, 0.05, 0.9);
    const hemR = quadPoint(looseFC, 0.95, 0.9);
    g.moveTo(hemL.x * s, hemL.y * s); g.lineTo(hemR.x * s, hemR.y * s);
    g.stroke({ width: s * 1.0, color: p.accent, alpha: 0.5 });
  }

  getAttachmentPoints(): Record<string, AttachmentPoint> { return {}; }
}
