import type { Graphics } from "pixi.js";
import type { Model, RenderContext, DrawCall, AttachmentPoint, V } from "../types";
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

    calls.push({
      depth: facingCamera ? 21 : 46,
      draw: (g, s) => this.drawGauntlet(g, j, palette, s, farSide),
    });
    calls.push({
      depth: facingCamera ? 60 : 24,
      draw: (g, s) => this.drawGauntlet(g, j, palette, s, nearSide),
    });

    return calls;
  }

  private drawGauntlet(g: Graphics, j: Record<string, V>, p: any, s: number, side: "L" | "R"): void {
    const elbow = j[`elbow${side}`];
    const wrist = j[`wrist${side}`];

    // Leather bracer covering forearm
    drawTaperedLimb(g, elbow, wrist, 4, 3.5, p.body, p.bodyDk, p.outline, s);

    // Wrist guard (wider band)
    const dx = wrist.x - elbow.x;
    const dy = wrist.y - elbow.y;
    const len = Math.sqrt(dx * dx + dy * dy) || 1;
    const px = -dy / len;
    const py = dx / len;

    const guardX = wrist.x - dx / len * 2;
    const guardY = wrist.y - dy / len * 2;
    g.roundRect((guardX - 2.5) * s, (guardY - 1.5) * s, 5 * s, 3 * s, 1 * s);
    g.fill(p.accent);
    g.roundRect((guardX - 2.5) * s, (guardY - 1.5) * s, 5 * s, 3 * s, 1 * s);
    g.stroke({ width: s * 0.4, color: p.accentDk, alpha: 0.4 });

    // Buckle on bracer
    const buckleX = elbow.x + dx * 0.3;
    const buckleY = elbow.y + dy * 0.3;
    g.rect((buckleX - 0.8) * s, (buckleY - 0.6) * s, 1.6 * s, 1.2 * s);
    g.fill(p.accentDk);

    // Leather glove
    g.circle(wrist.x * s, wrist.y * s, 2.6 * s);
    g.fill(p.body);
    g.circle(wrist.x * s, wrist.y * s, 2.6 * s);
    g.stroke({ width: s * 0.3, color: p.outline, alpha: 0.3 });
  }

  getAttachmentPoints(): Record<string, AttachmentPoint> { return {}; }
}
