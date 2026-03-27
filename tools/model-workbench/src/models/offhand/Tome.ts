import type { Graphics } from "pixi.js";
import type { Model, RenderContext, DrawCall, AttachmentPoint } from "../types";
import { darken, lighten } from "../palette";

/**
 * Tome — magical spellbook held in the off-hand.
 * Open book with glowing runes, used by mages.
 */
export class Tome implements Model {
  readonly id = "offhand-tome";
  readonly name = "Spell Tome";
  readonly category = "offhand" as const;
  readonly slot = "hand-L" as const;

  getDrawCalls(ctx: RenderContext): DrawCall[] {
    const { skeleton, facingCamera, palette } = ctx;
    const side = ctx.farSide;
    const wrist = skeleton.joints[`wrist${side}`];
    const elbow = skeleton.joints[`elbow${side}`];
    const iso = skeleton.iso;
    const wf = skeleton.wf;

    return [
      {
        depth: facingCamera ? 18 : 48,
        draw: (g: Graphics, s: number) => {
          const ox = iso.x * 3;
          const oy = iso.y * 1.5;
          const cx = wrist.x + ox;
          const cy = wrist.y - 3 + oy;

          const bw = 5 * wf;
          const bh = 7;
          const cover = darken(palette.primary, 0.1);
          const coverDk = darken(palette.primary, 0.3);
          const pages = 0xeee8d8;

          // Back cover
          g.roundRect((cx - bw + 0.5) * s, (cy - bh + 0.5) * s, (bw * 2 - 1) * s, (bh * 2 - 1) * s, 1 * s);
          g.fill(coverDk);

          // Pages (slightly inset, cream colored)
          g.roundRect((cx - bw + 1.5) * s, (cy - bh + 1.5) * s, (bw * 2 - 3) * s, (bh * 2 - 3) * s, 0.5 * s);
          g.fill(pages);

          // Page lines
          for (let i = 0; i < 4; i++) {
            const ly = cy - bh + 3.5 + i * 2.5;
            g.moveTo((cx - bw + 3) * s, ly * s);
            g.lineTo((cx + bw - 3) * s, ly * s);
            g.stroke({ width: s * 0.3, color: darken(pages, 0.15), alpha: 0.3 });
          }

          // Front cover
          g.roundRect((cx - bw) * s, (cy - bh) * s, bw * 2 * s, bh * 2 * s, 1.5 * s);
          g.stroke({ width: s * 0.8, color: cover, alpha: 0.8 });

          // Spine
          g.moveTo((cx - bw) * s, (cy - bh + 1) * s);
          g.lineTo((cx - bw) * s, (cy + bh - 1) * s);
          g.stroke({ width: s * 1.5, color: coverDk });

          // Cover emblem (glowing rune)
          g.circle(cx * s, (cy - 1) * s, 2 * s);
          g.fill({ color: palette.primary, alpha: 0.6 });
          g.circle(cx * s, (cy - 1) * s, 2 * s);
          g.stroke({ width: s * 0.4, color: lighten(palette.primary, 0.3), alpha: 0.5 });

          // Glow effect
          g.circle(cx * s, (cy - 1) * s, 3.5 * s);
          g.fill({ color: lighten(palette.primary, 0.3), alpha: 0.08 });

          // Corner clasps
          for (const [rx, ry] of [
            [cx - bw + 1, cy - bh + 1],
            [cx + bw - 1, cy - bh + 1],
            [cx - bw + 1, cy + bh - 1],
            [cx + bw - 1, cy + bh - 1],
          ]) {
            g.circle(rx * s, ry * s, 0.6 * s);
            g.fill(coverDk);
          }

          // Bookmark ribbon
          g.moveTo((cx + bw - 2) * s, (cy - bh) * s);
          g.quadraticCurveTo(
            (cx + bw - 1) * s, (cy + bh + 1) * s,
            (cx + bw - 2.5) * s, (cy + bh + 3) * s
          );
          g.stroke({ width: s * 0.6, color: 0xcc3333 });
        },
      },
    ];
  }

  getAttachmentPoints(): Record<string, AttachmentPoint> { return {}; }
}
