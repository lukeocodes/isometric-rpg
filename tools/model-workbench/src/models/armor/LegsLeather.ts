import type { Graphics } from "pixi.js";
import type { Model, RenderContext, DrawCall, AttachmentPoint, FitmentCorners } from "../types";
import { DEPTH_FAR_LIMB, DEPTH_BODY } from "../types";
import { darken } from "../palette";
import { drawCornerQuad, quadPoint, sideCorners } from "../draw-helpers";

/**
 * Leather Leggings — fitted leather trousers with reinforced knees and belt panel.
 *
 * CORNER-BASED: Uses fitmentCorners (legs slot) split per-side.
 */
export class LegsLeather implements Model {
  readonly id = "legs-leather";
  readonly name = "Leather Leggings";
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

    calls.push({ depth: DEPTH_FAR_LIMB + 1, draw: (g, s) => this.drawLegging(g, j, palette, s, farSide,  fc, sz, false) });
    calls.push({ depth: DEPTH_FAR_LIMB + 5, draw: (g, s) => this.drawLegging(g, j, palette, s, nearSide, fc, sz, true)  });

    // Waist belt panel at BODY+3
    calls.push({
      depth: DEPTH_BODY + 3,
      draw: (g, s) => {
        const { hipL, hipR, crotch } = j;
        const beltTL = { x: hipL.x - 0.5, y: hipL.y };
        const beltTR = { x: hipR.x + 0.5, y: hipR.y };
        const beltBL = { x: (hipL.x + crotch.x) / 2 - 0.3, y: crotch.y };
        const beltBR = { x: (hipR.x + crotch.x) / 2 + 0.3, y: crotch.y };
        const beltFC: FitmentCorners = { tl: beltTL, tr: beltTR, bl: beltBL, br: beltBR };
        drawCornerQuad(g, beltFC, 0, palette.body, palette.outline, 0.38, s);
      },
    });

    return calls;
  }

  private drawLegging(
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
    const color = isNear ? p.body : darken(p.body, 0.12);
    const accent = isNear ? p.accent : darken(p.accent, 0.1);

    // Leather fill — slightly inset for a fitted look
    drawCornerQuad(g, sc, 0.5, color, p.outline, 0.42, s);

    // Stitching lines down the sides
    const stLt = quadPoint(sc, 0.1, 0.08);
    const stLb = quadPoint(sc, 0.1, 0.88);
    const stRt = quadPoint(sc, 0.9, 0.08);
    const stRb = quadPoint(sc, 0.9, 0.88);
    g.moveTo(stLt.x * s, stLt.y * s); g.lineTo(stLb.x * s, stLb.y * s);
    g.moveTo(stRt.x * s, stRt.y * s); g.lineTo(stRb.x * s, stRb.y * s);
    g.stroke({ width: s * 0.4, color: p.accentDk, alpha: 0.32 });

    // Reinforced knee pad
    const kneePadW = Math.abs(sc.tr.x - sc.tl.x) * 0.75;
    g.roundRect((knee.x - kneePadW * 0.5) * s, (knee.y - 2 * sz) * s, kneePadW * s, 4 * sz * s, 1.5 * s);
    g.fill(accent);
    g.roundRect((knee.x - kneePadW * 0.5) * s, (knee.y - 2 * sz) * s, kneePadW * s, 4 * sz * s, 1.5 * s);
    g.stroke({ width: s * 0.4, color: p.accentDk, alpha: 0.35 });

    // Knee pad rivet
    g.circle(knee.x * s, (knee.y - 0.5 * sz) * s, 0.65 * s); g.fill(p.accentDk);

    // Ankle cuff
    const anklePt = quadPoint(sc, 0.5, 0.9);
    const cuffW = Math.abs(sc.br.x - sc.bl.x) * 0.8;
    g.moveTo((anklePt.x - cuffW * 0.5) * s, anklePt.y * s);
    g.lineTo((anklePt.x + cuffW * 0.5) * s, anklePt.y * s);
    g.stroke({ width: s * 1.2, color: p.accent, alpha: 0.55 });
  }

  getAttachmentPoints(): Record<string, AttachmentPoint> { return {}; }
}
