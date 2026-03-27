import type { Graphics } from "pixi.js";
import type {
  Model,
  RenderContext,
  DrawCall,
  AttachmentPoint,
} from "../types";
import { darken } from "../palette";

/**
 * Ponytail — tied back, with a gathered bunch falling behind.
 * Short bangs in front, ponytail sways with walk bob.
 */
export class HairPonytail implements Model {
  readonly id = "hair-ponytail";
  readonly name = "Ponytail";
  readonly category = "hair" as const;
  readonly slot = "head-top" as const;

  getDrawCalls(ctx: RenderContext): DrawCall[] {
    const { skeleton, palette, facingCamera } = ctx;
    const head = skeleton.joints.head;
    const wf = skeleton.wf;
    const iso = skeleton.iso;
    const sideView = Math.abs(iso.x) > 0.3;
    const hair = palette.hair;
    const hairDk = darken(hair, 0.18);
    const r = 7 * (ctx.slotParams.size);
    const bob = skeleton.bob;

    const calls: DrawCall[] = [];

    // Ponytail behind head (depth 22 — behind torso)
    calls.push({
      depth: 22,
      draw: (g: Graphics, s: number) => {
        // Tie point at back of head
        const tieX = head.x - iso.x * 3;
        const tieY = head.y - 1;

        // Tail sways slightly with walk
        const swayX = -iso.x * 1.5 + bob * 0.3;
        const tailEndX = tieX - iso.x * 2 + swayX;
        const tailEndY = tieY + 14 + bob * 0.4;

        // Tie band
        g.circle(tieX * s, tieY * s, 2 * s);
        g.fill(hairDk);

        // Ponytail shape (thick at tie, tapers to tip)
        g.moveTo((tieX - 2.5 * wf) * s, tieY * s);
        g.quadraticCurveTo(
          (tieX - 2 * wf + swayX * 0.3) * s,
          (tieY + 7 + bob * 0.2) * s,
          (tailEndX - 1.5) * s,
          tailEndY * s
        );
        g.quadraticCurveTo(
          tailEndX * s,
          (tailEndY + 1.5) * s,
          (tailEndX + 1.5) * s,
          tailEndY * s
        );
        g.quadraticCurveTo(
          (tieX + 2 * wf + swayX * 0.3) * s,
          (tieY + 7 + bob * 0.2) * s,
          (tieX + 2.5 * wf) * s,
          tieY * s
        );
        g.closePath();
        g.fill(hair);

        // Center strand line
        g.moveTo(tieX * s, (tieY + 1) * s);
        g.quadraticCurveTo(
          (tieX + swayX * 0.3) * s,
          (tieY + 8 + bob * 0.3) * s,
          tailEndX * s,
          (tailEndY - 1) * s
        );
        g.stroke({ width: s * 0.5, color: hairDk, alpha: 0.3 });
      },
    });

    // Hair cap on head
    if (!facingCamera) {
      calls.push({
        depth: 53,
        draw: (g: Graphics, s: number) => {
          g.ellipse(
            head.x * s,
            (head.y + 0.5) * s,
            (r + 0.3) * wf * s,
            (r + 0.5) * s
          );
          g.fill(hair);
        },
      });
    }

    // Front bangs (shorter, swept)
    calls.push({
      depth: 53,
      draw: (g: Graphics, s: number) => {
        if (facingCamera || sideView) {
          // Swept bangs
          g.ellipse(
            (head.x + iso.x * 1) * s,
            (head.y - r * 0.5) * s,
            r * 0.6 * wf * s,
            r * 0.35 * s
          );
          g.fill(hair);

          // Side coverage
          if (sideView) {
            const hx = head.x + iso.x * 2;
            g.ellipse(
              hx * s,
              (head.y - r * 0.15) * s,
              r * 0.45 * wf * s,
              r * 0.6 * s
            );
            g.fill(hair);
          }
        } else {
          // Top coverage from behind
          g.ellipse(
            head.x * s,
            (head.y - 1.5) * s,
            r * wf * s,
            (r - 1) * s
          );
          g.fill(hair);
        }
      },
    });

    return calls;
  }

  getAttachmentPoints(): Record<string, AttachmentPoint> {
    return {};
  }
}
