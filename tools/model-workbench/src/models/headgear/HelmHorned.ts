import type { Graphics } from "pixi.js";
import type { Model, RenderContext, DrawCall, AttachmentPoint } from "../types";
import { darken, lighten } from "../palette";

/**
 * Horned Helm — barbarian/viking helmet with curved horns.
 */
export class HelmHorned implements Model {
  readonly id = "helm-horned";
  readonly name = "Horned Helm";
  readonly category = "headgear" as const;
  readonly slot = "head-top" as const;

  getDrawCalls(ctx: RenderContext): DrawCall[] {
    const { skeleton, palette, facingCamera } = ctx;
    const head = skeleton.joints.head;
    const wf = skeleton.wf;
    const iso = skeleton.iso;
    const sideView = Math.abs(iso.x) > 0.3;
    const r = 7 * (ctx.slotParams.size);

    return [
      {
        depth: 54,
        draw: (g: Graphics, s: number) => {
          const cx = head.x;
          const helmColor = palette.body;
          const helmDk = palette.bodyDk;
          const hornColor = 0xd0c0a0;
          const hornDk = 0xa09070;

          // Helm dome — fully opaque to cover hair/eyes underneath
          g.ellipse(cx * s, (head.y - 1) * s, (r + 1) * wf * s, (r - 0.5) * s);
          g.fill(helmColor); // no alpha — fully covers head
          g.ellipse(cx * s, (head.y - 1) * s, (r + 1) * wf * s, (r - 0.5) * s);
          g.stroke({ width: s * 0.6, color: palette.outline, alpha: 0.45 });

          // Nose guard (front view)
          if (facingCamera) {
            g.moveTo((cx - 1) * s, (head.y - r * 0.3) * s);
            g.lineTo(cx * s, (head.y + r * 0.5) * s);
            g.lineTo((cx + 1) * s, (head.y - r * 0.3) * s);
            g.stroke({ width: s * 1, color: helmDk, alpha: 0.4 });
          }

          // Eye slit (front/side)
          if (facingCamera || sideView) {
            g.moveTo((cx - (r - 1.5) * wf) * s, (head.y + 0.5) * s);
            g.lineTo((cx + (r - 1.5) * wf) * s, (head.y + 0.5) * s);
            g.stroke({ width: s * 1.5, color: 0x111122, alpha: 0.5 });
          }

          // Center ridge
          g.moveTo(cx * s, (head.y - r + 0.5) * s);
          g.lineTo(cx * s, (head.y + 2) * s);
          g.stroke({ width: s * 1.2, color: lighten(helmColor, 0.1), alpha: 0.3 });

          // Rivets along band
          const bandY = head.y - 0.5;
          for (let i = 0; i < 4; i++) {
            const rx = cx + (i - 1.5) * 2.5 * wf;
            g.circle(rx * s, bandY * s, 0.5 * s);
            g.fill(palette.accent);
          }

          // HORNS
          for (const side of [-1, 1]) {
            const hornBaseX = cx + side * (r - 0.5) * wf;
            const hornBaseY = head.y - r * 0.2;
            const hornTipX = hornBaseX + side * 6;
            const hornTipY = hornBaseY - 8;

            // Curved horn shape
            g.moveTo(hornBaseX * s, (hornBaseY - 1) * s);
            g.quadraticCurveTo(
              (hornBaseX + side * 4) * s, (hornBaseY - 2) * s,
              hornTipX * s, hornTipY * s
            );
            g.quadraticCurveTo(
              (hornBaseX + side * 3) * s, (hornBaseY - 4) * s,
              hornBaseX * s, (hornBaseY + 1) * s
            );
            g.closePath();
            g.fill(hornColor);

            // Horn ridges
            for (let i = 1; i <= 3; i++) {
              const t = i / 4;
              const rx = hornBaseX + (hornTipX - hornBaseX) * t;
              const ry = hornBaseY + (hornTipY - hornBaseY) * t;
              const rw = 2 * (1 - t);
              g.moveTo((rx - rw * 0.5 * side) * s, (ry - 0.5) * s);
              g.lineTo((rx + rw * 0.5 * side) * s, (ry + 0.5) * s);
              g.stroke({ width: s * 0.4, color: hornDk, alpha: 0.3 });
            }

            // Horn outline
            g.moveTo(hornBaseX * s, (hornBaseY - 1) * s);
            g.quadraticCurveTo(
              (hornBaseX + side * 4) * s, (hornBaseY - 2) * s,
              hornTipX * s, hornTipY * s
            );
            g.stroke({ width: s * 0.5, color: hornDk, alpha: 0.4 });
          }
        },
      },
    ];
  }

  getAttachmentPoints(): Record<string, AttachmentPoint> { return {}; }
}
