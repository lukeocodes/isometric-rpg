import type { Graphics } from "pixi.js";
import type { Model, RenderContext, DrawCall, AttachmentPoint, V } from "../types";
import { DEPTH_FAR_LIMB, DEPTH_BODY } from "../types";
import { darken } from "../palette";
import { drawTaperedLimb } from "../draw-helpers";

/**
 * Cloth leg armor — loose trousers/robes covering the legs.
 * Flows loosely, slightly wider than limbs.
 */
export class LegsCloth implements Model {
  readonly id = "legs-cloth";
  readonly name = "Cloth Trousers";
  readonly category = "legs" as const;
  readonly slot = "legs" as const;

  getDrawCalls(ctx: RenderContext): DrawCall[] {
    const { skeleton, palette, farSide, nearSide } = ctx;
    const j = skeleton.joints;
    const calls: DrawCall[] = [];

    const sz = ctx.slotParams.size;
    // Far leg: darker and slightly wider; near leg: base color
    calls.push({ depth: DEPTH_FAR_LIMB + 1, draw: (g, s) => this.drawLeg(g, j, palette.body, palette.bodyDk, palette.outline, s, farSide, sz, false) });
    calls.push({ depth: DEPTH_FAR_LIMB + 5, draw: (g, s) => this.drawLeg(g, j, palette.body, palette.bodyDk, palette.outline, s, nearSide, sz, true) });

    // Waist sash
    calls.push({
      depth: DEPTH_BODY + 3,
      draw: (g, s) => {
        const { hipL, hipR, crotch } = j;
        g.moveTo(hipL.x * s, hipL.y * s);
        g.quadraticCurveTo(
          (hipL.x - 0.5) * s, ((hipL.y + crotch.y) / 2) * s,
          ((hipL.x + crotch.x) / 2) * s, crotch.y * s
        );
        g.quadraticCurveTo(
          crotch.x * s, (crotch.y + 1) * s,
          ((hipR.x + crotch.x) / 2) * s, crotch.y * s
        );
        g.quadraticCurveTo(
          (hipR.x + 0.5) * s, ((hipR.y + crotch.y) / 2) * s,
          hipR.x * s, hipR.y * s
        );
        g.closePath();
        g.fill(palette.body);
        g.moveTo(hipL.x * s, hipL.y * s);
        g.quadraticCurveTo(
          (hipL.x - 0.5) * s, ((hipL.y + crotch.y) / 2) * s,
          ((hipL.x + crotch.x) / 2) * s, crotch.y * s
        );
        g.quadraticCurveTo(
          crotch.x * s, (crotch.y + 1) * s,
          ((hipR.x + crotch.x) / 2) * s, crotch.y * s
        );
        g.quadraticCurveTo(
          (hipR.x + 0.5) * s, ((hipR.y + crotch.y) / 2) * s,
          hipR.x * s, hipR.y * s
        );
        g.closePath();
        g.stroke({ width: s * 0.4, color: palette.outline, alpha: 0.3 });
      },
    });

    return calls;
  }

  private drawLeg(
    g: Graphics,
    j: Record<string, V>,
    color: number,
    dk: number,
    outline: number,
    s: number,
    side: "L" | "R",
    sz = 1,
    isNear = false
  ): void {
    const hip = j[`hip${side}`];
    const knee = j[`knee${side}`];
    const ankle = j[`ankle${side}`];
    const legTop: V = { x: hip.x * 0.5, y: hip.y };

    // Near leg uses base color; far leg darkened 10% and slightly wider for loose cloth effect
    const legColor = isNear ? color : darken(color, 0.1);
    const legDk = isNear ? dk : darken(dk, 0.1);
    const thighW = isNear ? 7 * sz : 7.3 * sz;
    const calfW  = isNear ? 5.5 * sz : 5.7 * sz;

    // Loose cloth over thigh
    drawTaperedLimb(g, legTop, knee, thighW, calfW * 0.94, legColor, legDk, outline, s);

    // Cloth over calf — flows wider
    drawTaperedLimb(g, knee, ankle, calfW, 5 * sz, legColor, legDk, outline, s);

    // Hem at ankle
    g.ellipse(ankle.x * s, ankle.y * s, 3 * s, 1.5 * s);
    g.fill(legDk);
  }

  getAttachmentPoints(): Record<string, AttachmentPoint> { return {}; }
}
