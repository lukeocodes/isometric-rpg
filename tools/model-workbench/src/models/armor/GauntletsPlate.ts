import type { Graphics } from "pixi.js";
import type { Model, RenderContext, DrawCall, AttachmentPoint, V } from "../types";
import { drawTaperedLimb } from "../draw-helpers";

/**
 * Plate gauntlets — heavy articulated plate vambraces and gauntlets.
 * Full coverage with segmented finger plates.
 */
export class GauntletsPlate implements Model {
  readonly id = "gauntlets-plate";
  readonly name = "Plate Gauntlets";
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

    // Plate vambrace (thicker coverage)
    drawTaperedLimb(g, elbow, wrist, 4.5, 4, p.body, p.bodyDk, p.outline, s);

    const dx = wrist.x - elbow.x;
    const dy = wrist.y - elbow.y;
    const len = Math.sqrt(dx * dx + dy * dy) || 1;
    const px = -dy / len;
    const py = dx / len;

    // Highlight ridge along vambrace
    g.moveTo(elbow.x * s, elbow.y * s);
    g.lineTo(wrist.x * s, wrist.y * s);
    g.stroke({ width: s * 0.5, color: p.bodyLt, alpha: 0.2 });

    // Articulation lines on vambrace
    for (let i = 1; i <= 2; i++) {
      const t = i / 3;
      const lx = elbow.x + dx * t;
      const ly = elbow.y + dy * t;
      const lw = 4.3 - i * 0.2;
      g.moveTo((lx + px * lw) * s, (ly + py * lw) * s);
      g.lineTo((lx - px * lw) * s, (ly - py * lw) * s);
      g.stroke({ width: s * 0.4, color: p.outline, alpha: 0.3 });
    }

    // Elbow cop (flared plate)
    g.ellipse(elbow.x * s, elbow.y * s, 3.2 * s, 2.2 * s);
    g.fill(p.bodyLt);
    g.ellipse(elbow.x * s, elbow.y * s, 3.2 * s, 2.2 * s);
    g.stroke({ width: s * 0.5, color: p.outline, alpha: 0.4 });

    // Rivet on cop
    g.circle(elbow.x * s, elbow.y * s, 0.7 * s);
    g.fill(p.accent);

    // Plate gauntlet hand (angular, wider)
    g.roundRect((wrist.x - 3) * s, (wrist.y - 2) * s, 6 * s, 4 * s, 1.5 * s);
    g.fill(p.body);
    g.roundRect((wrist.x - 3) * s, (wrist.y - 2) * s, 6 * s, 4 * s, 1.5 * s);
    g.stroke({ width: s * 0.4, color: p.outline, alpha: 0.35 });

    // Finger plate lines
    const handDx = dx / len;
    const handDy = dy / len;
    for (let i = -1; i <= 1; i++) {
      const fx = wrist.x + handDx * 2 + px * i * 1;
      const fy = wrist.y + handDy * 2 + py * i * 1;
      g.moveTo(wrist.x * s, wrist.y * s);
      g.lineTo(fx * s, fy * s);
      g.stroke({ width: s * 0.6, color: p.body });
      g.circle(fx * s, fy * s, 0.5 * s);
      g.fill(p.bodyDk);
    }

    // Wrist flare
    const wfx = wrist.x - dx / len * 1;
    const wfy = wrist.y - dy / len * 1;
    g.moveTo((wfx + px * 3.5) * s, (wfy + py * 3.5) * s);
    g.lineTo((wfx - px * 3.5) * s, (wfy - py * 3.5) * s);
    g.stroke({ width: s * 1.2, color: p.bodyLt, alpha: 0.3 });
  }

  getAttachmentPoints(): Record<string, AttachmentPoint> { return {}; }
}
