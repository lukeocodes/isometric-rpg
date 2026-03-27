import type { Graphics } from "pixi.js";
import type {
  Model,
  RenderContext,
  DrawCall,
  Skeleton,
  AttachmentPoint,
} from "../types";

export class HelmetPlate implements Model {
  readonly id = "helmet-plate";
  readonly name = "Plate Helmet";
  readonly category = "headgear" as const;
  readonly slot = "head-top" as const;

  getDrawCalls(ctx: RenderContext): DrawCall[] {
    const { skeleton, palette, facingCamera} = ctx;
    const head = skeleton.joints.head;
    const wf = skeleton.wf;
    const iso = skeleton.iso;
    const sideView = Math.abs(iso.x) > 0.3;
    const r = 7 * (ctx.slotParams.size);

    return [
      {
        // Helm dome — fully opaque to completely cover hair/eyes underneath
        depth: 54,
        draw: (g: Graphics, s: number) => {
          g.ellipse(head.x * s, (head.y - 0.5) * s, (r + 1.5) * wf * s, (r + 1) * s);
          g.fill(palette.body); // fully opaque — no alpha
          g.ellipse(head.x * s, (head.y - 0.5) * s, (r + 1.5) * wf * s, (r + 1) * s);
          g.stroke({ width: s * 0.7, color: palette.outline });
        },
      },
      {
        // Helm details — nose guard and eye slit drawn on top of dome
        depth: 55,
        draw: (g: Graphics, s: number) => {
          // Highlight ridge on top
          g.moveTo(head.x * s, (head.y - r - 1) * s);
          g.lineTo(head.x * s, (head.y - r + 3) * s);
          g.stroke({ width: s * 1, color: palette.bodyLt, alpha: 0.4 });

          // Nose guard
          if (facingCamera || sideView) {
            g.moveTo(head.x * s, (head.y - r * 0.4) * s);
            g.lineTo(head.x * s, (head.y + r * 0.4) * s);
            g.stroke({ width: s * 1.5, color: palette.bodyDk, alpha: 0.5 });
          }

          // Eye slit
          if (facingCamera || (sideView && iso.y >= -0.1)) {
            const slitW = 7 * wf;
            g.rect((head.x - slitW / 2) * s, (head.y + 0.2) * s, slitW * s, 2 * s);
            g.fill(0x111122);
          }
        },
      },
    ];
  }

  getAttachmentPoints(): Record<string, AttachmentPoint> {
    return {};
  }
}
