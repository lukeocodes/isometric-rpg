import type { Graphics } from "pixi.js";
import type {
  Model,
  RenderContext,
  DrawCall,
  AttachmentPoint,
} from "../types";
import { darken } from "../palette";

/**
 * Long flowing hair — falls past shoulders.
 * Visible from all angles, with a flowing back section.
 */
export class HairLong implements Model {
  readonly id = "hair-long";
  readonly name = "Long Hair";
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
    const r = 7 * (ctx.slotParams.size);
    const bob = skeleton.bob;

    const calls: DrawCall[] = [];

    // Back flowing section (always visible, falls down back)
    calls.push({
      depth: 22, // behind torso
      draw: (g: Graphics, s: number) => {
        const baseY = head.y + r * 0.3;
        const flowLen = 18; // long hair reaches mid-back
        const flowX = head.x - iso.x * 2; // flows opposite to movement

        // Main flow
        g.moveTo((head.x - r * 0.6 * wf) * s, baseY * s);
        g.quadraticCurveTo(
          (head.x - r * 0.7 * wf - iso.x * 1) * s,
          (baseY + flowLen * 0.4 + bob * 0.3) * s,
          (flowX - 3 * wf) * s,
          (baseY + flowLen + bob * 0.5) * s
        );
        g.quadraticCurveTo(
          flowX * s,
          (baseY + flowLen + 2 + bob * 0.5) * s,
          (flowX + 3 * wf) * s,
          (baseY + flowLen + bob * 0.5) * s
        );
        g.quadraticCurveTo(
          (head.x + r * 0.7 * wf - iso.x * 1) * s,
          (baseY + flowLen * 0.4 + bob * 0.3) * s,
          (head.x + r * 0.6 * wf) * s,
          baseY * s
        );
        g.closePath();
        g.fill(hair);

        // Highlight strand
        g.moveTo(head.x * s, (baseY + 1) * s);
        g.quadraticCurveTo(
          (flowX - iso.x * 0.5) * s,
          (baseY + flowLen * 0.5 + bob * 0.3) * s,
          flowX * s,
          (baseY + flowLen - 1 + bob * 0.5) * s
        );
        g.stroke({ width: s * 0.8, color: hairDk, alpha: 0.3 });
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
            (r + 0.8) * wf * s,
            (r + 1.2) * s
          );
          g.fill(hair);
        },
      });
    }

    // Front bangs + side framing
    calls.push({
      depth: 53,
      draw: (g: Graphics, s: number) => {
        if (facingCamera || sideView) {
          // Curtain bangs — parted, framing face
          const bangY = head.y - r * 0.4;

          // Left bang
          g.moveTo((head.x - r * 0.15 * wf) * s, (bangY - 1) * s);
          g.quadraticCurveTo(
            (head.x - r * 0.6 * wf) * s,
            (bangY + 1) * s,
            (head.x - r * 0.8 * wf) * s,
            (head.y + 2) * s
          );
          g.quadraticCurveTo(
            (head.x - r * 0.9 * wf) * s,
            (head.y - 1) * s,
            (head.x - r * 0.3 * wf) * s,
            (bangY - 2) * s
          );
          g.closePath();
          g.fill(hair);

          // Right bang
          g.moveTo((head.x + r * 0.15 * wf) * s, (bangY - 1) * s);
          g.quadraticCurveTo(
            (head.x + r * 0.6 * wf) * s,
            (bangY + 1) * s,
            (head.x + r * 0.8 * wf) * s,
            (head.y + 2) * s
          );
          g.quadraticCurveTo(
            (head.x + r * 0.9 * wf) * s,
            (head.y - 1) * s,
            (head.x + r * 0.3 * wf) * s,
            (bangY - 2) * s
          );
          g.closePath();
          g.fill(hair);

          // Top cap
          g.ellipse(
            head.x * s,
            (head.y - r * 0.55) * s,
            r * 0.75 * wf * s,
            r * 0.4 * s
          );
          g.fill(hair);
        } else {
          // From behind — full coverage
          g.ellipse(
            head.x * s,
            (head.y - 1) * s,
            (r + 0.5) * wf * s,
            (r - 0.3) * s
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
