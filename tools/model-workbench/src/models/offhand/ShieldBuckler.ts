import type { Graphics } from "pixi.js";
import type { Model, RenderContext, DrawCall, AttachmentPoint } from "../types";
import { darken, lighten } from "../palette";

/**
 * Buckler — small round shield strapped to the forearm.
 * Light, quick, used by duelists and rogues.
 */
export class ShieldBuckler implements Model {
  readonly id = "shield-buckler";
  readonly name = "Buckler";
  readonly category = "offhand" as const;
  readonly slot = "hand-L" as const;

  getDrawCalls(ctx: RenderContext): DrawCall[] {
    const { skeleton, facingCamera, palette } = ctx;
    const side = ctx.farSide;
    const wrist = skeleton.joints[`wrist${side}`];
    const iso = skeleton.iso;
    const wf = skeleton.wf;

    return [
      {
        depth: facingCamera ? 18 : 48,
        draw: (g: Graphics, s: number) => {
          const ox = iso.x * 3;
          const oy = iso.y * 1.5;
          const cx = wrist.x + ox;
          const cy = wrist.y - 1 + oy;
          const r = 5 * wf;

          // Small round shield
          g.circle(cx * s, cy * s, r * s);
          g.fill(palette.secondary);
          g.circle(cx * s, cy * s, r * s);
          g.stroke({ width: s * 0.7, color: darken(palette.secondary, 0.3), alpha: 0.5 });

          // Inner ring
          g.circle(cx * s, cy * s, (r - 1.5) * s);
          g.stroke({ width: s * 0.5, color: darken(palette.secondary, 0.15), alpha: 0.35 });

          // Center boss
          g.circle(cx * s, cy * s, 2 * s);
          g.fill(lighten(palette.secondary, 0.2));
          g.circle(cx * s, cy * s, 2 * s);
          g.stroke({ width: s * 0.4, color: darken(palette.secondary, 0.2), alpha: 0.45 });
          g.circle(cx * s, cy * s, 0.8 * s);
          g.fill(darken(palette.secondary, 0.15));

          // Decorative rivets around edge (6 points)
          for (let i = 0; i < 6; i++) {
            const angle = (i / 6) * Math.PI * 2;
            const rx = cx + Math.cos(angle) * (r - 0.8);
            const ry = cy + Math.sin(angle) * (r - 0.8);
            g.circle(rx * s, ry * s, 0.5 * s);
            g.fill(darken(palette.secondary, 0.25));
          }
        },
      },
    ];
  }

  getAttachmentPoints(): Record<string, AttachmentPoint> { return {}; }
}
