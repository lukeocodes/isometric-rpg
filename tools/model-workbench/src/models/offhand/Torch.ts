import type { Graphics } from "pixi.js";
import type { Model, RenderContext, DrawCall, AttachmentPoint } from "../types";
import { darken, lighten } from "../palette";

/**
 * Torch — burning stick held in the off-hand.
 * Provides light, flickering flame animation.
 */
export class Torch implements Model {
  readonly id = "offhand-torch";
  readonly name = "Torch";
  readonly category = "offhand" as const;
  readonly slot = "hand-L" as const;

  getDrawCalls(ctx: RenderContext): DrawCall[] {
    const { skeleton, facingCamera } = ctx;
    const side = ctx.farSide;
    const wrist = skeleton.joints[`wrist${side}`];
    const elbow = skeleton.joints[`elbow${side}`];
    const iso = skeleton.iso;
    const walkPhase = skeleton.walkPhase;

    return [
      {
        depth: facingCamera ? 19 : 47,
        draw: (g: Graphics, s: number) => {
          // Direction from elbow to wrist (torch extends along arm direction)
          const dx = wrist.x - elbow.x;
          const dy = wrist.y - elbow.y;
          const len = Math.sqrt(dx * dx + dy * dy) || 1;
          const ux = dx / len;
          const uy = dy / len;

          // Handle base at wrist, extends upward
          const baseX = wrist.x;
          const baseY = wrist.y;
          const tipX = baseX - ux * 14;
          const tipY = baseY - uy * 14;

          // Wooden handle
          g.moveTo(baseX * s, baseY * s);
          g.lineTo(tipX * s, tipY * s);
          g.stroke({ width: s * 2, color: 0x6b4226 });
          g.moveTo(baseX * s, baseY * s);
          g.lineTo(tipX * s, tipY * s);
          g.stroke({ width: s * 0.5, color: 0x4a2e18, alpha: 0.3 });

          // Wrapped grip near base
          for (let i = 0; i < 3; i++) {
            const t = (i + 0.5) / 5;
            const gx = baseX + (tipX - baseX) * t;
            const gy = baseY + (tipY - baseY) * t;
            const px = -uy * 1.5;
            const py = ux * 1.5;
            g.moveTo((gx + px) * s, (gy + py) * s);
            g.lineTo((gx - px) * s, (gy - py) * s);
            g.stroke({ width: s * 0.5, color: 0x8b6914, alpha: 0.4 });
          }

          // Charred top area
          const topX = tipX + ux * 1;
          const topY = tipY + uy * 1;
          g.circle(topX * s, topY * s, 2 * s);
          g.fill(0x222222);

          // Flame (animated flicker)
          const flicker = walkPhase !== 0 ? Math.sin(walkPhase * 6) * 1.5 : 0;
          const flameX = tipX + flicker * 0.3;
          const flameY = tipY - 2;

          // Outer flame (orange-red)
          g.moveTo((flameX - 2.5) * s, flameY * s);
          g.quadraticCurveTo(
            (flameX - 1.5 + flicker * 0.5) * s, (flameY - 5 + Math.abs(flicker) * 0.5) * s,
            flameX * s, (flameY - 7 + Math.abs(flicker)) * s
          );
          g.quadraticCurveTo(
            (flameX + 1.5 - flicker * 0.3) * s, (flameY - 5 + Math.abs(flicker) * 0.5) * s,
            (flameX + 2.5) * s, flameY * s
          );
          g.closePath();
          g.fill({ color: 0xff6600, alpha: 0.8 });

          // Inner flame (yellow)
          g.moveTo((flameX - 1.2) * s, (flameY + 0.5) * s);
          g.quadraticCurveTo(
            (flameX - 0.5 + flicker * 0.3) * s, (flameY - 3 + Math.abs(flicker) * 0.3) * s,
            flameX * s, (flameY - 4.5 + Math.abs(flicker) * 0.5) * s
          );
          g.quadraticCurveTo(
            (flameX + 0.5 - flicker * 0.2) * s, (flameY - 3 + Math.abs(flicker) * 0.3) * s,
            (flameX + 1.2) * s, (flameY + 0.5) * s
          );
          g.closePath();
          g.fill({ color: 0xffcc00, alpha: 0.9 });

          // Core (white-hot)
          g.ellipse(flameX * s, (flameY - 0.5) * s, 0.8 * s, 1.5 * s);
          g.fill({ color: 0xffffff, alpha: 0.5 });

          // Glow halo
          g.circle(flameX * s, (flameY - 2) * s, 5 * s);
          g.fill({ color: 0xff8800, alpha: 0.05 });
        },
      },
    ];
  }

  getAttachmentPoints(): Record<string, AttachmentPoint> { return {}; }
}
