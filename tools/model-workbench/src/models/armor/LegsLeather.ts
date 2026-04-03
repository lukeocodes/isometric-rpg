import type { Graphics } from "pixi.js";
import type { Model, RenderContext, DrawCall, AttachmentPoint, V } from "../types";
import { DEPTH_FAR_LIMB, DEPTH_BODY } from "../types";
import { darken } from "../palette";
import { drawTaperedLimb } from "../draw-helpers";

/**
 * Leather leg armor — fitted leather trousers with knee pads.
 * Snug fit, stitching details, reinforced knees.
 */
export class LegsLeather implements Model {
  readonly id = "legs-leather";
  readonly name = "Leather Leggings";
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

    // Belt/waist panel
    calls.push({
      depth: DEPTH_BODY + 3,
      draw: (g, s) => {
        const { hipL, hipR, crotch } = j;
        g.moveTo(hipL.x * s, hipL.y * s);
        g.lineTo(((hipL.x + crotch.x) / 2 - 0.3) * s, crotch.y * s);
        g.lineTo(((hipR.x + crotch.x) / 2 + 0.3) * s, crotch.y * s);
        g.lineTo(hipR.x * s, hipR.y * s);
        g.closePath();
        g.fill(palette.body);
        g.moveTo(hipL.x * s, hipL.y * s);
        g.lineTo(((hipL.x + crotch.x) / 2 - 0.3) * s, crotch.y * s);
        g.lineTo(((hipR.x + crotch.x) / 2 + 0.3) * s, crotch.y * s);
        g.lineTo(hipR.x * s, hipR.y * s);
        g.closePath();
        g.stroke({ width: s * 0.5, color: palette.outline, alpha: 0.35 });
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
    const accentColor = isNear ? p.accent : darken(p.accent, 0.1);

    // Fitted leather thigh
    drawTaperedLimb(g, legTop, knee, 6.2 * sz, 4.8 * sz, legColor, legDk, p.outline, s);

    // Knee pad (reinforced)
    g.ellipse(knee.x * s, knee.y * s, 3.5 * sz * s, 2.2 * sz * s);
    g.fill(accentColor);
    g.ellipse(knee.x * s, knee.y * s, 3.5 * s, 2.2 * s);
    g.stroke({ width: s * 0.4, color: p.accentDk, alpha: 0.4 });

    // Rivet on knee
    g.circle(knee.x * s, knee.y * s, 0.8 * s);
    g.fill(p.accentDk);

    // Fitted leather calf
    drawTaperedLimb(g, knee, ankle, 5 * sz, 3.8 * sz, legColor, legDk, p.outline, s);

    // Stitching line down the side
    g.moveTo((legTop.x + 2.5) * s, legTop.y * s);
    g.lineTo((knee.x + 2) * s, knee.y * s);
    g.stroke({ width: s * 0.3, color: p.accentDk, alpha: 0.3 });
  }

  getAttachmentPoints(): Record<string, AttachmentPoint> { return {}; }
}
