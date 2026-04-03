import type { Graphics } from "pixi.js";
import type { Model, RenderContext, DrawCall, AttachmentPoint, V } from "../types";
import { DEPTH_FAR_LIMB, DEPTH_NEAR_LIMB } from "../types";
import { darken } from "../palette";
import { drawTaperedLimb } from "../draw-helpers";

/**
 * Leather gauntlets — hardened leather bracers with wrist guard and fingerless gloves.
 */
export class GauntletsLeather implements Model {
  readonly id = "gauntlets-leather";
  readonly name = "Leather Bracers";
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
    const armDk = isNear ? p.bodyDk : darken(p.bodyDk, 0.1);
    const accentColor = isNear ? p.accent : darken(p.accent, 0.1);

    // Leather bracer covering forearm
    drawTaperedLimb(g, elbow, wrist, 4 * sz, 3.5 * sz, armColor, armDk, p.outline, s);

    // Wrist guard (wider band)
    const dx = wrist.x - elbow.x;
    const dy = wrist.y - elbow.y;
    const len = Math.sqrt(dx * dx + dy * dy) || 1;
    const px = -dy / len;
    const py = dx / len;

    const guardX = wrist.x - dx / len * 2;
    const guardY = wrist.y - dy / len * 2;
    g.roundRect((guardX - 2.5) * s, (guardY - 1.5) * s, 5 * s, 3 * s, 1 * s);
    g.fill(accentColor);
    g.roundRect((guardX - 2.5) * s, (guardY - 1.5) * s, 5 * s, 3 * s, 1 * s);
    g.stroke({ width: s * 0.4, color: p.accentDk, alpha: 0.4 });

    // Buckle on bracer
    const buckleX = elbow.x + dx * 0.3;
    const buckleY = elbow.y + dy * 0.3;
    g.rect((buckleX - 0.8) * s, (buckleY - 0.6) * s, 1.6 * s, 1.2 * s);
    g.fill(p.accentDk);

    // Leather glove
    g.circle(wrist.x * s, wrist.y * s, 2.6 * s);
    g.fill(armColor);
    g.circle(wrist.x * s, wrist.y * s, 2.6 * s);
    g.stroke({ width: s * 0.3, color: p.outline, alpha: 0.3 });
  }

  getAttachmentPoints(): Record<string, AttachmentPoint> { return {}; }
}
