import type { Graphics } from "pixi.js";
import type {
  Model,
  RenderContext,
  DrawCall,
  Skeleton,
  AttachmentPoint,
} from "../types";

export class HairShort implements Model {
  readonly id = "hair-short";
  readonly name = "Short Hair";
  readonly category = "hair" as const;
  readonly slot = "head-top" as const;

  getDrawCalls(ctx: RenderContext): DrawCall[] {
    const { skeleton, palette, facingCamera } = ctx;
    const head = skeleton.joints.head;
    const wf = skeleton.wf;
    const iso = skeleton.iso;
    const sideView = Math.abs(iso.x) > 0.3;
    const hairColor = palette.hair;
    const r = 7 * (ctx.slotParams.size);

    const calls: DrawCall[] = [];

    // Back hair (depth 40) — visible when facing away from camera
    if (!facingCamera) {
      calls.push({
        depth: 53,
        draw: (g: Graphics, s: number) => {
          g.ellipse(
            head.x * s,
            (head.y + 0.5) * s,
            (r + 0.5) * wf * s,
            (r + 1) * s
          );
          g.fill(hairColor);
        },
      });
    }

    // Front hair / bangs (depth 55) — visible when facing camera or side view
    if (facingCamera || sideView) {
      calls.push({
        depth: 53,
        draw: (g: Graphics, s: number) => {
          // Bangs
          g.ellipse(
            head.x * s,
            (head.y - r * 0.5) * s,
            r * 0.7 * wf * s,
            r * 0.45 * s
          );
          g.fill(hairColor);

          // Side hair (when viewed from side)
          if (sideView) {
            const hx = head.x + iso.x * 2;
            g.ellipse(
              hx * s,
              (head.y - r * 0.2) * s,
              r * 0.5 * wf * s,
              r * 0.7 * s
            );
            g.fill(hairColor);
          }
        },
      });
    } else {
      // From behind — full hair coverage on top
      calls.push({
        depth: 53,
        draw: (g: Graphics, s: number) => {
          g.ellipse(
            head.x * s,
            (head.y - 1) * s,
            r * wf * s,
            (r - 0.5) * s
          );
          g.fill(hairColor);
        },
      });
    }

    return calls;
  }

  getAttachmentPoints(): Record<string, AttachmentPoint> {
    return {};
  }
}
