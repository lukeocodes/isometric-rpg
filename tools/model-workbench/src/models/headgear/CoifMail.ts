import type { Graphics } from "pixi.js";
import type {
  Model,
  RenderContext,
  DrawCall,
  Skeleton,
  AttachmentPoint,
} from "../types";

export class CoifMail implements Model {
  readonly id = "coif-mail";
  readonly name = "Mail Coif";
  readonly category = "headgear" as const;
  readonly slot = "head-top" as const;

  getDrawCalls(ctx: RenderContext): DrawCall[] {
    const { skeleton, palette} = ctx;
    const head = skeleton.joints.head;
    const wf = skeleton.wf;
    const r = 7 * (ctx.slotParams.size);

    return [
      {
        depth: 54,
        draw: (g: Graphics, s: number) => {
          // Coif covers full head (opaque) — chain mail texture with ring pattern
          g.ellipse(head.x * s, (head.y + 1) * s, (r + 1) * wf * s, (r + 2) * s);
          g.fill(palette.body); // opaque — covers hair
          g.ellipse(head.x * s, (head.y + 1) * s, (r + 1) * wf * s, (r + 2) * s);
          g.stroke({ width: s * 0.5, color: palette.outline, alpha: 0.4 });

          // Chain ring pattern (semi-transparent over the covered area)
          for (let row = 0; row < 3; row++) {
            for (let col = 0; col < 4; col++) {
              const rx = head.x + (col - 1.5) * 2.5 * wf;
              const ry = head.y - 2 + row * 3;
              g.circle(rx * s, ry * s, 0.6 * s);
              g.stroke({ width: s * 0.3, color: palette.bodyLt, alpha: 0.25 });
            }
          }

          // Face opening (darker area showing face through mail)
          g.ellipse(head.x * s, (head.y + 2) * s, (r - 2) * wf * s, (r - 2) * s);
          g.fill({ color: palette.body, alpha: 0.3 }); // slight re-darken of face area
        },
      },
    ];
  }

  getAttachmentPoints(): Record<string, AttachmentPoint> {
    return {};
  }
}
