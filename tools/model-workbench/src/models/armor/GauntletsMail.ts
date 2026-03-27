import type { Graphics } from "pixi.js";
import type { Model, RenderContext, DrawCall, AttachmentPoint, V } from "../types";
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

    calls.push({
      depth: facingCamera ? 21 : 46,
      draw: (g, s) => this.drawGauntlet(g, j, palette, s, farSide),
    });
    calls.push({
      depth: facingCamera ? 56 : 26,
      draw: (g, s) => this.drawGauntlet(g, j, palette, s, nearSide),
    });

    return calls;
  }

  private drawGauntlet(g: Graphics, j: Record<string, V>, p: any, s: number, side: "L" | "R"): void {
    const elbow = j[`elbow${side}`];
    const wrist = j[`wrist${side}`];

    // Mail-covered forearm
    drawTaperedLimb(g, elbow, wrist, 4, 3.5, p.body, p.bodyDk, p.outline, s);

    // Ring pattern along forearm
    const dx = wrist.x - elbow.x;
    const dy = wrist.y - elbow.y;
    const len = Math.sqrt(dx * dx + dy * dy) || 1;

    for (let i = 0; i < 3; i++) {
      const t = (i + 0.5) / 3.5;
      const rx = elbow.x + dx * t;
      const ry = elbow.y + dy * t;
      g.circle(rx * s, ry * s, 0.5 * s);
      g.stroke({ width: s * 0.2, color: p.bodyLt, alpha: 0.3 });
    }

    // Padded cuff at elbow
    g.ellipse(elbow.x * s, elbow.y * s, 2.5 * s, 1.8 * s);
    g.fill(p.accent);
    g.ellipse(elbow.x * s, elbow.y * s, 2.5 * s, 1.8 * s);
    g.stroke({ width: s * 0.3, color: p.accentDk, alpha: 0.3 });

    // Mail mitten hand
    g.circle(wrist.x * s, wrist.y * s, 2.8 * s);
    g.fill(p.body);
    g.circle(wrist.x * s, wrist.y * s, 2.8 * s);
    g.stroke({ width: s * 0.4, color: p.outline, alpha: 0.3 });

    // Finger ring pattern on hand
    g.circle((wrist.x + dx / len * 1) * s, (wrist.y + dy / len * 1) * s, 0.4 * s);
    g.stroke({ width: s * 0.2, color: p.bodyLt, alpha: 0.25 });
  }

  getAttachmentPoints(): Record<string, AttachmentPoint> { return {}; }
}
