import type { Graphics } from "pixi.js";
import type {
  Model,
  RenderContext,
  DrawCall,
  AttachmentPoint,
} from "../types";
import { darken } from "../palette";

/**
 * Mohawk — shaved sides with a tall ridge of hair down the center.
 * Popular with orcs, punks, and warriors.
 */
export class HairMohawk implements Model {
  readonly id = "hair-mohawk";
  readonly name = "Mohawk";
  readonly category = "hair" as const;
  readonly slot = "head-top" as const;

  getDrawCalls(ctx: RenderContext): DrawCall[] {
    const { skeleton, palette, facingCamera } = ctx;
    const head = skeleton.joints.head;
    const wf = skeleton.wf;
    const iso = skeleton.iso;
    const sideView = Math.abs(iso.x) > 0.3;
    const hair = palette.hair;
    const hairDk = darken(hair, 0.2);
    const r = 7 * (ctx.slotParams.size);

    const calls: DrawCall[] = [];

    // Mohawk ridge — visible from all angles
    // Depth 55 so it's always on top of the head
    calls.push({
      depth: 53,
      draw: (g: Graphics, s: number) => {
        const ridgeHeight = 7;
        const ridgeW = 2.2; // narrow ridge width

        if (facingCamera) {
          // Front view — see the ridge as a tall fin
          const baseY = head.y - r + 1;

          // Ridge shape
          g.moveTo((head.x - ridgeW * wf) * s, (baseY + 2) * s);
          g.quadraticCurveTo(
            (head.x - ridgeW * 0.8 * wf) * s,
            (baseY - ridgeHeight * 0.5) * s,
            head.x * s,
            (baseY - ridgeHeight) * s
          );
          g.quadraticCurveTo(
            (head.x + ridgeW * 0.8 * wf) * s,
            (baseY - ridgeHeight * 0.5) * s,
            (head.x + ridgeW * wf) * s,
            (baseY + 2) * s
          );
          g.closePath();
          g.fill(hair);

          // Center line highlight
          g.moveTo(head.x * s, (baseY - ridgeHeight + 1) * s);
          g.lineTo(head.x * s, (baseY + 1) * s);
          g.stroke({ width: s * 0.6, color: hairDk, alpha: 0.3 });

          // Shaved sides (fuzz)
          g.ellipse(
            (head.x - r * 0.5 * wf) * s,
            (head.y - r * 0.2) * s,
            r * 0.35 * wf * s,
            r * 0.5 * s
          );
          g.fill({ color: hairDk, alpha: 0.2 });
          g.ellipse(
            (head.x + r * 0.5 * wf) * s,
            (head.y - r * 0.2) * s,
            r * 0.35 * wf * s,
            r * 0.5 * s
          );
          g.fill({ color: hairDk, alpha: 0.2 });
        } else if (sideView) {
          // Side view — ridge runs front to back
          const startX = head.x + iso.x * 3;
          const endX = head.x - iso.x * 4;
          const topY = head.y - r - ridgeHeight + 2;

          g.moveTo(startX * s, (head.y - r * 0.5) * s);
          g.quadraticCurveTo(
            ((startX + head.x) / 2) * s,
            topY * s,
            head.x * s,
            (topY + 0.5) * s
          );
          g.quadraticCurveTo(
            ((head.x + endX) / 2) * s,
            (topY + 1) * s,
            endX * s,
            (head.y - r * 0.3) * s
          );
          g.quadraticCurveTo(
            ((head.x + endX) / 2) * s,
            (head.y - r * 0.4) * s,
            head.x * s,
            (head.y - r + 1) * s
          );
          g.quadraticCurveTo(
            ((startX + head.x) / 2) * s,
            (head.y - r + 0.5) * s,
            startX * s,
            (head.y - r * 0.5) * s
          );
          g.closePath();
          g.fill(hair);

          // Shaved side (fuzz on visible side)
          g.ellipse(
            (head.x + iso.x * r * 0.3 * wf) * s,
            (head.y - 0.5) * s,
            r * 0.4 * wf * s,
            r * 0.55 * s
          );
          g.fill({ color: hairDk, alpha: 0.15 });
        } else {
          // Back view — ridge visible as a strip
          const startX = head.x + 3;
          const endX = head.x - 3;
          const topY = head.y - r - ridgeHeight + 3;

          g.moveTo((head.x - ridgeW * wf) * s, (head.y - r * 0.3) * s);
          g.quadraticCurveTo(
            (head.x - ridgeW * wf) * s,
            topY * s,
            head.x * s,
            (topY - 1) * s
          );
          g.quadraticCurveTo(
            (head.x + ridgeW * wf) * s,
            topY * s,
            (head.x + ridgeW * wf) * s,
            (head.y - r * 0.3) * s
          );
          g.closePath();
          g.fill(hair);

          // Shaved sides
          g.ellipse(
            (head.x - r * 0.5 * wf) * s,
            (head.y - r * 0.15) * s,
            r * 0.3 * wf * s,
            r * 0.5 * s
          );
          g.fill({ color: hairDk, alpha: 0.18 });
          g.ellipse(
            (head.x + r * 0.5 * wf) * s,
            (head.y - r * 0.15) * s,
            r * 0.3 * wf * s,
            r * 0.5 * s
          );
          g.fill({ color: hairDk, alpha: 0.18 });
        }
      },
    });

    return calls;
  }

  getAttachmentPoints(): Record<string, AttachmentPoint> {
    return {};
  }
}
