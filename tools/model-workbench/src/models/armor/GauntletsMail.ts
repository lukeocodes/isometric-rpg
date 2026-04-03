import type { Graphics } from "pixi.js";
import type { Model, RenderContext, DrawCall, AttachmentPoint, V } from "../types";
import { DEPTH_FAR_LIMB, DEPTH_NEAR_LIMB } from "../types";
import { darken } from "../palette";
import { drawTaperedLimb } from "../draw-helpers";

/**
 * Mail gauntlets — chain mail mitten gloves with padded forearm.
 */
export class GauntletsMail implements Model {
  readonly id = "gauntlets-mail";
  readonly name = "Mail Mittens";
  readonly category = "gauntlets" as const;
  readonly slot = "gauntlets" as const;

  getDrawCalls(ctx: RenderContext): DrawCall[] {
    const { skeleton, palette, farSide, nearSide, facingCamera } = ctx;
    const j = skeleton.joints;
    const calls: DrawCall[] = [];

    const sz = ctx.slotParams.size;
    // Far arm (isNear=false) darkened 10%; near arm (isNear=true) base color
    calls.push({
      depth: facingCamera ? DEPTH_FAR_LIMB + 9 : DEPTH_NEAR_LIMB + 1,
      draw: (g, s) => this.drawGauntlet(g, j, palette, s, farSide, sz, false),
    });
    calls.push({
      depth: facingCamera ? DEPTH_NEAR_LIMB + 6 : DEPTH_FAR_LIMB + 11,
      draw: (g, s) => this.drawGauntlet(g, j, palette, s, nearSide, sz, true),
    });

    return calls;
  }

  private drawGauntlet(
    g: Graphics,
    j: Record<string, V>,
    p: any,
    s: number,
    side: "L" | "R",
    sz = 1,
    isNear = false
  ): void {
    const elbow = j[`elbow${side}`];
    const wrist = j[`wrist${side}`];

    // Near arm uses base color, far arm darkened 10%
    const armColor = isNear ? p.body : darken(p.body, 0.1);
    const armLt = isNear ? p.bodyLt : darken(p.bodyLt, 0.1);

    // Mail-covered forearm
    drawTaperedLimb(g, elbow, wrist, 4 * sz, 3.5 * sz, armColor, isNear ? p.bodyDk : darken(p.bodyDk, 0.1), p.outline, s);

    // Ring pattern along forearm
    const dx = wrist.x - elbow.x;
    const dy = wrist.y - elbow.y;
    const len = Math.sqrt(dx * dx + dy * dy) || 1;

    for (let i = 0; i < 3; i++) {
      const t = (i + 0.5) / 3.5;
      const rx = elbow.x + dx * t;
      const ry = elbow.y + dy * t;
      g.circle(rx * s, ry * s, 0.5 * s);
      g.stroke({ width: s * 0.2, color: armLt, alpha: 0.3 });
    }

    // Padded cuff at elbow
    g.ellipse(elbow.x * s, elbow.y * s, 2.5 * s, 1.8 * s);
    g.fill(p.accent);
    g.ellipse(elbow.x * s, elbow.y * s, 2.5 * s, 1.8 * s);
    g.stroke({ width: s * 0.3, color: p.accentDk, alpha: 0.3 });

    // Mail mitten hand
    g.circle(wrist.x * s, wrist.y * s, 2.8 * s);
    g.fill(armColor);
    g.circle(wrist.x * s, wrist.y * s, 2.8 * s);
    g.stroke({ width: s * 0.4, color: p.outline, alpha: 0.3 });

    // Finger ring pattern on hand
    g.circle((wrist.x + dx / len * 1) * s, (wrist.y + dy / len * 1) * s, 0.4 * s);
    g.stroke({ width: s * 0.2, color: armLt, alpha: 0.25 });
  }

  getAttachmentPoints(): Record<string, AttachmentPoint> { return {}; }
}
