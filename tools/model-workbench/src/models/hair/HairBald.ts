import type { Graphics } from "pixi.js";
import type { Model, RenderContext, DrawCall, AttachmentPoint } from "../types";
import { lighten } from "../palette";

/**
 * Bald — no hair, just a subtle scalp sheen on the head.
 * Lets users see the bare head without any hair model.
 */
export class HairBald implements Model {
  readonly id = "hair-bald";
  readonly name = "Bald";
  readonly category = "hair" as const;
  readonly slot = "head-top" as const;

  getDrawCalls(ctx: RenderContext): DrawCall[] {
    const { skeleton, palette, facingCamera } = ctx;
    const head = skeleton.joints.head;
    const wf = skeleton.wf;
    const r = 7 * (ctx.slotParams.size);

    return [
      {
        depth: 53,
        draw: (g: Graphics, s: number) => {
          // Subtle scalp highlight (shiny bald head)
          if (facingCamera) {
            g.ellipse(
              (head.x - 1) * s,
              (head.y - r * 0.35) * s,
              2.5 * wf * s,
              2 * s
            );
            g.fill({ color: lighten(palette.skin, 0.12), alpha: 0.25 });
          }
        },
      },
    ];
  }

  getAttachmentPoints(): Record<string, AttachmentPoint> { return {}; }
}
