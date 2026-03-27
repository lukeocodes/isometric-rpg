import type { Graphics } from "pixi.js";
import type { Model, RenderContext, DrawCall, AttachmentPoint } from "../types";
import { darken, lighten } from "../palette";

/**
 * Tower shield — tall rectangular shield covering most of the body.
 * Heavy, protective, iconic tank equipment.
 */
export class ShieldTower implements Model {
  readonly id = "shield-tower";
  readonly name = "Tower Shield";
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
          const ox = iso.x * 4;
          const oy = iso.y * 2;
          const cx = wrist.x + ox;
          const cy = wrist.y - 6 + oy;
          const sw = 8 * wf;
          const sh = 14;

          // Tall rectangular shield
          g.roundRect((cx - sw) * s, (cy - sh) * s, sw * 2 * s, sh * 2 * s, 2 * s);
          g.fill(palette.secondary);
          g.roundRect((cx - sw) * s, (cy - sh) * s, sw * 2 * s, sh * 2 * s, 2 * s);
          g.stroke({ width: s * 0.8, color: darken(palette.secondary, 0.3), alpha: 0.5 });

          // Metal rim
          g.roundRect((cx - sw + 0.5) * s, (cy - sh + 0.5) * s, (sw * 2 - 1) * s, (sh * 2 - 1) * s, 1.5 * s);
          g.stroke({ width: s * 1, color: darken(palette.secondary, 0.15), alpha: 0.4 });

          // Vertical center band
          g.rect((cx - 1) * s, (cy - sh + 1) * s, 2 * s, (sh * 2 - 2) * s);
          g.fill(darken(palette.secondary, 0.2));

          // Horizontal band
          g.rect((cx - sw + 1) * s, (cy - 1) * s, (sw * 2 - 2) * s, 2 * s);
          g.fill(darken(palette.secondary, 0.2));

          // Center boss (metal circle)
          g.circle(cx * s, cy * s, 2.5 * s);
          g.fill(lighten(palette.secondary, 0.15));
          g.circle(cx * s, cy * s, 2.5 * s);
          g.stroke({ width: s * 0.5, color: darken(palette.secondary, 0.25), alpha: 0.5 });
          g.circle(cx * s, cy * s, 1 * s);
          g.fill(darken(palette.secondary, 0.1));

          // Corner rivets
          for (const [rx, ry] of [
            [cx - sw + 2, cy - sh + 2],
            [cx + sw - 2, cy - sh + 2],
            [cx - sw + 2, cy + sh - 2],
            [cx + sw - 2, cy + sh - 2],
          ]) {
            g.circle(rx * s, ry * s, 0.8 * s);
            g.fill(darken(palette.secondary, 0.2));
          }
        },
      },
    ];
  }

  getAttachmentPoints(): Record<string, AttachmentPoint> { return {}; }
}
