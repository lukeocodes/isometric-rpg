import type { Graphics } from "pixi.js";
import type { Model, RenderContext, DrawCall, AttachmentPoint, FitmentCorners } from "../types";
import { DEPTH_FAR_LIMB, DEPTH_BODY } from "../types";
import { darken, lighten } from "../palette";
import { drawCornerQuad, quadPoint, sideCorners } from "../draw-helpers";

/**
 * Plate Greaves — full plate cuisses, knee cops, and greaves.
 *
 * CORNER-BASED: Uses fitmentCorners (legs slot) split per-side.
 * Hip→ankle quad adapts to leg length and body width of any race.
 */
export class LegsPlate implements Model {
  readonly id = "legs-plate";
  readonly name = "Plate Greaves";
  readonly category = "legs" as const;
  readonly slot = "legs" as const;

  getDrawCalls(ctx: RenderContext): DrawCall[] {
    const { skeleton, palette, farSide, nearSide, facingCamera, fitmentCorners } = ctx;
    const j  = skeleton.joints;
    const sz = ctx.slotParams.size;

    const fc: FitmentCorners = fitmentCorners ?? {
      tl: { x: j.hipL.x,   y: j.hipL.y   },
      tr: { x: j.hipR.x,   y: j.hipR.y   },
      bl: { x: j.ankleL.x, y: j.ankleL.y },
      br: { x: j.ankleR.x, y: j.ankleR.y },
    };

    const calls: DrawCall[] = [];

    calls.push({ depth: DEPTH_FAR_LIMB + 1, draw: (g, s) => this.drawLeg(g, j, palette, s, farSide,  fc, sz, false, facingCamera) });
    calls.push({ depth: DEPTH_FAR_LIMB + 5, draw: (g, s) => this.drawLeg(g, j, palette, s, nearSide, fc, sz, true,  facingCamera) });

    // Tassets (plate hip flaps) at BODY+3
    calls.push({
      depth: DEPTH_BODY + 3,
      draw: (g, s) => {
        const { hipL, hipR, crotch } = j;
        const tassetY = crotch.y + 2 * sz;
        const tassetLFC: FitmentCorners = {
          tl: { x: hipL.x - 1, y: hipL.y },
          tr: { x: (hipL.x + crotch.x) / 2, y: hipL.y },
          bl: { x: hipL.x - 0.5, y: tassetY },
          br: { x: crotch.x - 1, y: tassetY },
        };
        const tassetRFC: FitmentCorners = {
          tl: { x: (hipR.x + crotch.x) / 2, y: hipR.y },
          tr: { x: hipR.x + 1, y: hipR.y },
          bl: { x: crotch.x + 1, y: tassetY },
          br: { x: hipR.x + 0.5, y: tassetY },
        };
        drawCornerQuad(g, tassetLFC, 0, palette.body, palette.outline, 0.4, s);
        drawCornerQuad(g, tassetRFC, 0, palette.body, palette.outline, 0.4, s);

        if (facingCamera) {
          // Highlight on near tasset
          const highlightFC = nearSide === "L" ? tassetLFC : tassetRFC;
          const hl = quadPoint(highlightFC, 0.3, 0.3);
          g.circle(hl.x * s, hl.y * s, 1.4 * sz * s); g.fill({ color: palette.bodyLt, alpha: 0.2 });
        }
      },
    });

    return calls;
  }

  private drawLeg(
    g: Graphics,
    j: Record<string, any>,
    p: any,
    s: number,
    side: "L" | "R",
    fc: FitmentCorners,
    sz: number,
    isNear: boolean,
    facingCamera: boolean,
  ): void {
    const sc    = sideCorners(fc, side);
    const hip   = j[`hip${side}`];
    const knee  = j[`knee${side}`];
    const ankle = j[`ankle${side}`];

    const color  = isNear ? p.body   : darken(p.body, 0.12);
    const bodyLt = isNear ? p.bodyLt : darken(p.bodyLt, 0.12);

    // Split the quad: thigh (top half) and greave (bottom half)
    const midTL = quadPoint(sc, 0.0, 0.5);
    const midTR = quadPoint(sc, 1.0, 0.5);
    const thighFC: FitmentCorners = { tl: sc.tl, tr: sc.tr, bl: midTL, br: midTR };
    const greaveFC: FitmentCorners = { tl: midTL, tr: midTR, bl: sc.bl, br: sc.br };

    // Thigh plate (cuisse)
    drawCornerQuad(g, thighFC, 0, color, p.outline, 0.42, s);
    // Shin plate (greave)
    drawCornerQuad(g, greaveFC, 0, color, p.outline, 0.38, s);

    // Highlight on cuisse
    const cuisseLit = quadPoint(thighFC, isNear ? 0.15 : 0.8, 0.3);
    g.ellipse(cuisseLit.x * s, cuisseLit.y * s, Math.abs(sc.tr.x - sc.tl.x) * 0.3 * s, 2.5 * sz * s);
    g.fill({ color: bodyLt, alpha: 0.15 });

    // Knee cop at joint
    g.ellipse(knee.x * s, knee.y * s, Math.abs(sc.tr.x - sc.tl.x) * 0.7 * s, 2.8 * sz * s);
    g.fill(bodyLt);
    g.ellipse(knee.x * s, knee.y * s, Math.abs(sc.tr.x - sc.tl.x) * 0.7 * s, 2.8 * sz * s);
    g.stroke({ width: s * 0.5, color: p.outline, alpha: 0.45 });
    // Cop articulation
    g.moveTo((knee.x - Math.abs(sc.tr.x - sc.tl.x) * 0.35) * s, knee.y * s);
    g.lineTo((knee.x + Math.abs(sc.tr.x - sc.tl.x) * 0.35) * s, knee.y * s);
    g.stroke({ width: s * 0.4, color: p.outline, alpha: 0.28 });
    // Cop rivet
    g.circle(knee.x * s, (knee.y - 1) * s, 0.7 * s); g.fill(p.accent);

    // Shin ridge
    const ridgeT = quadPoint(greaveFC, 0.5, 0.08);
    const ridgeB = quadPoint(greaveFC, 0.5, 0.88);
    g.moveTo(ridgeT.x * s, ridgeT.y * s); g.lineTo(ridgeB.x * s, ridgeB.y * s);
    g.stroke({ width: s * 0.6, color: bodyLt, alpha: 0.22 });
  }

  getAttachmentPoints(): Record<string, AttachmentPoint> { return {}; }
}
