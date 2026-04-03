import type { Graphics } from "pixi.js";
import type { Model, RenderContext, DrawCall, AttachmentPoint, V } from "../types";
import { DEPTH_FAR_LIMB, DEPTH_BODY } from "../types";
import { darken } from "../palette";
import { drawTaperedLimb } from "../draw-helpers";

/**
 * Mail leg armor — chain mail chausses covering thighs and calves.
 * Metallic sheen, ring pattern detail, padded underneath.
 */
export class LegsMail implements Model {
  readonly id = "legs-mail";
  readonly name = "Mail Chausses";
  readonly category = "legs" as const;
  readonly slot = "legs" as const;

  getDrawCalls(ctx: RenderContext): DrawCall[] {
    const { skeleton, palette, farSide, nearSide } = ctx;
    const j = skeleton.joints;
    const calls: DrawCall[] = [];

    const sz = ctx.slotParams.size;
    // Far leg: darker; near leg: base color
    calls.push({ depth: DEPTH_FAR_LIMB + 1, draw: (g, s) => this.drawLeg(g, j, palette, s, farSide, sz, false) });
    calls.push({ depth: DEPTH_FAR_LIMB + 5, draw: (g, s) => this.drawLeg(g, j, palette, s, nearSide, sz, true) });

    // Waist mail skirt
    calls.push({
      depth: DEPTH_BODY + 3,
      draw: (g, s) => {
        const { hipL, hipR, crotch } = j;
        const skirtY = crotch.y + 1;
        g.moveTo(hipL.x * s, hipL.y * s);
        g.lineTo((hipL.x - 0.5) * s, skirtY * s);
        g.lineTo((hipR.x + 0.5) * s, skirtY * s);
        g.lineTo(hipR.x * s, hipR.y * s);
        g.closePath();
        g.fill(palette.body);
        g.moveTo(hipL.x * s, hipL.y * s);
        g.lineTo((hipL.x - 0.5) * s, skirtY * s);
        g.lineTo((hipR.x + 0.5) * s, skirtY * s);
        g.lineTo(hipR.x * s, hipR.y * s);
        g.closePath();
        g.stroke({ width: s * 0.4, color: palette.outline, alpha: 0.3 });

        // Chain pattern on skirt
        for (let i = 0; i < 3; i++) {
          const y = hipL.y + (skirtY - hipL.y) * ((i + 0.5) / 3);
          const w = (hipR.x - hipL.x) * (0.8 + i * 0.05);
          for (let jj = 0; jj < 4; jj++) {
            const x = hipL.x + w * ((jj + 0.5) / 4);
            g.circle(x * s, y * s, 0.6 * s);
            g.stroke({ width: s * 0.25, color: palette.bodyLt, alpha: 0.3 });
          }
        }
      },
    });

    return calls;
  }

  private drawLeg(g: Graphics, j: Record<string, V>, p: any, s: number, side: "L" | "R", sz = 1, isNear = false): void {
    const hip = j[`hip${side}`];
    const knee = j[`knee${side}`];
    const ankle = j[`ankle${side}`];
    const legTop: V = { x: hip.x * 0.5, y: hip.y };

    // Near leg uses base color, far leg darkened 10%
    const legColor = isNear ? p.body : darken(p.body, 0.1);
    const legDk = isNear ? p.bodyDk : darken(p.bodyDk, 0.1);
    const legLt = isNear ? p.bodyLt : darken(p.bodyLt, 0.1);

    // Mail-covered thigh
    drawTaperedLimb(g, legTop, knee, 6.5 * sz, 5 * sz, legColor, legDk, p.outline, s);

    // Knee cop (metal plate over mail)
    g.roundRect((knee.x - 3 * sz) * s, (knee.y - 2 * sz) * s, 6 * sz * s, 4 * sz * s, 1.5 * s);
    g.fill(legLt);
    g.roundRect((knee.x - 3) * s, (knee.y - 2) * s, 6 * s, 4 * s, 1.5 * s);
    g.stroke({ width: s * 0.4, color: p.outline, alpha: 0.4 });

    // Mail-covered calf
    drawTaperedLimb(g, knee, ankle, 5 * sz, 3.8 * sz, legColor, legDk, p.outline, s);

    // Ring pattern (small circles along the thigh)
    for (let i = 0; i < 3; i++) {
      const t = (i + 1) / 4;
      const rx = legTop.x + (knee.x - legTop.x) * t;
      const ry = legTop.y + (knee.y - legTop.y) * t;
      g.circle(rx * s, ry * s, 0.5 * s);
      g.stroke({ width: s * 0.2, color: legLt, alpha: 0.25 });
    }
  }

  getAttachmentPoints(): Record<string, AttachmentPoint> { return {}; }
}
