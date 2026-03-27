import type { Graphics } from "pixi.js";
import type {
  Model,
  RenderContext,
  DrawCall,
  AttachmentPoint,
} from "../types";
import { darken, lighten } from "../palette";

/**
 * Braided hair — two thick braids falling over the shoulders.
 * Classic dwarf/viking style. Braids sway with walk cycle.
 */
export class HairBraided implements Model {
  readonly id = "hair-braided";
  readonly name = "Braided";
  readonly category = "hair" as const;
  readonly slot = "head-top" as const;

  getDrawCalls(ctx: RenderContext): DrawCall[] {
    const { skeleton, palette, facingCamera } = ctx;
    const head = skeleton.joints.head;
    const wf = skeleton.wf;
    const iso = skeleton.iso;
    const sideView = Math.abs(iso.x) > 0.3;
    const hair = palette.hair;
    const hairDk = darken(hair, 0.15);
    const hairLt = lighten(hair, 0.1);
    const r = 7 * (ctx.slotParams.size);
    const bob = skeleton.bob;

    const calls: DrawCall[] = [];

    // Two braids — depth 22 (behind torso, in front of back hair)
    calls.push({
      depth: 23,
      draw: (g: Graphics, s: number) => {
        const braidStartY = head.y + 3;
        const braidLen = 16;
        const braidW = 2;

        // Determine which braids are visible
        const showLeft = facingCamera || iso.x <= 0.1;
        const showRight = facingCamera || iso.x >= -0.1;

        for (const side of [-1, 1]) {
          if (side === -1 && !showLeft) continue;
          if (side === 1 && !showRight) continue;

          const baseX = head.x + side * r * 0.55 * wf;
          const swayX = side * bob * 0.2;
          const endX = baseX + swayX;
          const endY = braidStartY + braidLen + bob * 0.3;

          // Braid body
          g.moveTo((baseX - braidW * wf) * s, braidStartY * s);
          g.quadraticCurveTo(
            (baseX - braidW * wf + swayX * 0.3) * s,
            ((braidStartY + endY) / 2) * s,
            (endX - braidW * 0.6) * s,
            endY * s
          );
          g.quadraticCurveTo(
            endX * s,
            (endY + 1.5) * s,
            (endX + braidW * 0.6) * s,
            endY * s
          );
          g.quadraticCurveTo(
            (baseX + braidW * wf + swayX * 0.3) * s,
            ((braidStartY + endY) / 2) * s,
            (baseX + braidW * wf) * s,
            braidStartY * s
          );
          g.closePath();
          g.fill(hair);

          // Braid cross-hatching (3 segments)
          for (let i = 0; i < 4; i++) {
            const t = (i + 0.5) / 4;
            const segY = braidStartY + braidLen * t + bob * 0.3 * t;
            const segX = baseX + swayX * t;
            const segW = braidW * (1 - t * 0.3) * wf;

            g.moveTo((segX - segW) * s, segY * s);
            g.lineTo((segX + segW * 0.3) * s, (segY - 1.2) * s);
            g.moveTo((segX + segW) * s, segY * s);
            g.lineTo((segX - segW * 0.3) * s, (segY - 1.2) * s);
            g.stroke({ width: s * 0.5, color: hairDk, alpha: 0.3 });
          }

          // Tie at bottom
          g.circle(endX * s, endY * s, 1.2 * s);
          g.fill(hairDk);
        }
      },
    });

    // Back hair cap
    if (!facingCamera) {
      calls.push({
        depth: 53,
        draw: (g: Graphics, s: number) => {
          g.ellipse(
            head.x * s,
            (head.y + 0.5) * s,
            (r + 0.5) * wf * s,
            (r + 0.8) * s
          );
          g.fill(hair);
        },
      });
    }

    // Front bangs and top
    calls.push({
      depth: 53,
      draw: (g: Graphics, s: number) => {
        if (facingCamera || sideView) {
          // Center-parted bangs
          g.ellipse(
            head.x * s,
            (head.y - r * 0.5) * s,
            r * 0.65 * wf * s,
            r * 0.4 * s
          );
          g.fill(hair);

          // Part line
          g.moveTo(head.x * s, (head.y - r * 0.85) * s);
          g.lineTo(head.x * s, (head.y - r * 0.2) * s);
          g.stroke({ width: s * 0.4, color: hairDk, alpha: 0.3 });

          if (sideView) {
            const hx = head.x + iso.x * 2;
            g.ellipse(
              hx * s,
              (head.y - r * 0.2) * s,
              r * 0.45 * wf * s,
              r * 0.65 * s
            );
            g.fill(hair);
          }
        } else {
          g.ellipse(
            head.x * s,
            (head.y - 1) * s,
            (r + 0.3) * wf * s,
            (r - 0.5) * s
          );
          g.fill(hair);

          // Part line from behind
          g.moveTo(head.x * s, (head.y - r) * s);
          g.lineTo(head.x * s, (head.y - 1) * s);
          g.stroke({ width: s * 0.4, color: hairDk, alpha: 0.25 });
        }
      },
    });

    return calls;
  }

  getAttachmentPoints(): Record<string, AttachmentPoint> {
    return {};
  }
}
