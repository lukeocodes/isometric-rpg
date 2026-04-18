import type { Graphics } from "pixi.js";
import type { Model, RenderContext, DrawCall, AttachmentPoint, FitmentCorners } from "../types";
import { DEPTH_FAR_LIMB, DEPTH_BODY } from "../types";
import { darken } from "../palette";
import { drawCornerQuad, quadPoint, sideCorners } from "../draw-helpers";

/**
 * Mail Chausses — chain mail covering the full leg with a hip skirt.
 *
 * CORNER-BASED: Uses fitmentCorners (legs slot) split per-side.
 */
export class LegsMail implements Model {
  readonly id = "legs-mail";
  readonly name = "Mail Chausses";
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

    calls.push({ depth: DEPTH_FAR_LIMB + 1, draw: (g, s) => this.drawChausse(g, j, palette, s, farSide,  fc, sz, false) });
    calls.push({ depth: DEPTH_FAR_LIMB + 5, draw: (g, s) => this.drawChausse(g, j, palette, s, nearSide, fc, sz, true)  });

    // Hip mail skirt at BODY+3
    calls.push({
      depth: DEPTH_BODY + 3,
      draw: (g, s) => {
        const { hipL, hipR, crotch } = j;
        const skirtY = crotch.y + 1.5 * sz;
        g.moveTo((hipL.x - 0.5) * s, hipL.y * s);
        g.lineTo((hipL.x - 1) * s, skirtY * s);
        g.lineTo((hipR.x + 1) * s, skirtY * s);
        g.lineTo((hipR.x + 0.5) * s, hipR.y * s);
        g.closePath();
        g.fill(palette.body);
        g.stroke({ width: s * 0.35, color: palette.outline, alpha: 0.28 });

        // Chain rows on skirt
        const span = hipR.x - hipL.x + 2;
        for (let row = 0; row < 2; row++) {
          const ry = hipL.y + (skirtY - hipL.y) * ((row + 0.5) / 2);
          for (let col = 0; col < 4; col++) {
            const rx = hipL.x - 0.5 + span * (col + 0.5) / 4;
            g.circle(rx * s, ry * s, 0.45 * s);
            g.stroke({ width: s * 0.18, color: palette.bodyLt, alpha: 0.28 });
          }
        }
      },
    });

    return calls;
  }

  private drawChausse(
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
    const bodyLt = isNear ? p.bodyLt : darken(p.bodyLt, 0.12);

    // Mail fill
    drawCornerQuad(g, sc, 0, color, p.outline, 0.38, s);

    // Ring rows (4 horizontal rows)
    for (let i = 0; i < 4; i++) {
      const t = 0.08 + i * 0.22;
      const rowL = quadPoint(sc, 0.04, t);
      const rowR = quadPoint(sc, 0.96, t);
      g.moveTo(rowL.x * s, rowL.y * s); g.lineTo(rowR.x * s, rowR.y * s);
      g.stroke({ width: s * 0.4, color: bodyLt, alpha: 0.28 });
    }

    // Ring dots on 2nd and 4th rows
    for (const t of [0.3, 0.74]) {
      for (let col = 0; col < 3; col++) {
        const u = 0.15 + col * 0.35;
        const pt = quadPoint(sc, u, t);
        g.circle(pt.x * s, pt.y * s, 0.45 * s);
        g.stroke({ width: s * 0.18, color: bodyLt, alpha: 0.25 });
      }
    }

    // Padded knee cap
    g.ellipse(knee.x * s, knee.y * s, Math.abs(sc.tr.x - sc.tl.x) * 0.72 * s, 2.6 * sz * s);
    g.fill(darken(color, 0.06));
    g.ellipse(knee.x * s, knee.y * s, Math.abs(sc.tr.x - sc.tl.x) * 0.72 * s, 2.6 * sz * s);
    g.stroke({ width: s * 0.4, color: p.outline, alpha: 0.3 });
  }

  getAttachmentPoints(): Record<string, AttachmentPoint> { return {}; }
}
