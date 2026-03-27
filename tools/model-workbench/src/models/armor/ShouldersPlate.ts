import type { Graphics } from "pixi.js";
import type { Model, RenderContext, DrawCall, AttachmentPoint, V } from "../types";

/**
 * Plate shoulders — heavy layered pauldrons with rivets and raised edges.
 */
export class ShouldersPlate implements Model {
  readonly id = "shoulders-plate";
  readonly name = "Plate Pauldrons";
  readonly category = "shoulders" as const;
  readonly slot = "shoulders" as const;

  getDrawCalls(ctx: RenderContext): DrawCall[] {
    const { skeleton, palette, farSide, nearSide, facingCamera } = ctx;
    const j = skeleton.joints;
    const calls: DrawCall[] = [];

    calls.push({
      depth: facingCamera ? 28 : 42,
      draw: (g, s) => this.drawShoulder(g, j, palette, s, farSide),
    });
    calls.push({
      depth: facingCamera ? 42 : 28,
      draw: (g, s) => this.drawShoulder(g, j, palette, s, nearSide),
    });

    return calls;
  }

  private drawShoulder(g: Graphics, j: Record<string, V>, p: any, s: number, side: "L" | "R"): void {
    const shoulder = j[`shoulder${side}`];
    const sign = side === "L" ? -1 : 1;

    const cx = shoulder.x + sign * 1.5;
    const cy = shoulder.y - 1;
    const w = 7.5;
    const h = 6;

    // Main pauldron plate (layered look — bottom layer)
    g.roundRect((cx - w * 0.5 * sign - (sign > 0 ? 0 : w)) * s, (cy - h * 0.3) * s, w * s, h * 0.7 * s, 2 * s);
    g.fill(p.bodyDk);

    // Top plate (upper layer)
    g.ellipse((cx + sign * 0.5) * s, (cy - 0.5) * s, (w - 1) * s, (h - 1.5) * s);
    g.fill(p.body);
    g.ellipse((cx + sign * 0.5) * s, (cy - 0.5) * s, (w - 1) * s, (h - 1.5) * s);
    g.stroke({ width: s * 0.6, color: p.outline, alpha: 0.45 });

    // Raised edge / rim
    g.moveTo((cx - sign * (w - 2)) * s, (cy + h * 0.3) * s);
    g.quadraticCurveTo(
      (cx + sign * (w - 1)) * s, (cy + h * 0.4) * s,
      (cx + sign * (w - 2)) * s, (cy - h * 0.1) * s
    );
    g.stroke({ width: s * 1.2, color: p.bodyLt, alpha: 0.35 });

    // Segmentation lines (layered plates)
    for (let i = 1; i <= 2; i++) {
      const ly = cy + h * (i * 0.2 - 0.1);
      g.moveTo((cx - sign * (w - 3)) * s, ly * s);
      g.quadraticCurveTo(
        (cx + sign * 1) * s, (ly + 0.5) * s,
        (cx + sign * (w - 3)) * s, ly * s
      );
      g.stroke({ width: s * 0.4, color: p.outline, alpha: 0.3 });
    }

    // Center rivet
    g.circle((cx + sign * 0.5) * s, (cy - h * 0.15) * s, 1 * s);
    g.fill(p.accent);
    g.circle((cx + sign * 0.5) * s, (cy - h * 0.15) * s, 1 * s);
    g.stroke({ width: s * 0.3, color: p.accentDk, alpha: 0.4 });

    // Highlight
    g.ellipse((cx - sign * 1) * s, (cy - h * 0.2) * s, 2 * s, 1.5 * s);
    g.fill({ color: p.bodyLt, alpha: 0.15 });
  }

  getAttachmentPoints(): Record<string, AttachmentPoint> { return {}; }
}
