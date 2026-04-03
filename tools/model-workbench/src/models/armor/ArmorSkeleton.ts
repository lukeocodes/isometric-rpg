import type { Graphics } from "pixi.js";
import type { Model, RenderContext, DrawCall, AttachmentPoint, FitmentCorners } from "../types";
import { DEPTH_BODY } from "../types";
import { darken } from "../palette";
import { drawCornerQuad, quadPoint } from "../draw-helpers";

/**
 * Skeleton Bone-Plate Armor — shaped like a ribcage with skull emblem.
 *
 * DEPTH: DEPTH_BODY + 3 (= 93).
 * CORNER-BASED: fitmentCorners for body-fitted placement.
 * FACING AWARE: front ribcage + skull; back spine vertebrae + back ribs.
 */
export class ArmorSkeleton implements Model {
  readonly id = "armor-skeleton";
  readonly name = "Bone Plate Armor";
  readonly category = "armor" as const;
  readonly slot = "torso" as const;

  getDrawCalls(ctx: RenderContext): DrawCall[] {
    const { skeleton, palette, facingCamera, fitmentCorners } = ctx;
    const j  = skeleton.joints;
    const sz = ctx.slotParams.size;

    const fc: FitmentCorners = fitmentCorners ?? {
      tl: { x: j.shoulderL.x, y: j.neckBase.y },
      tr: { x: j.shoulderR.x, y: j.neckBase.y },
      bl: { x: j.hipL.x,      y: j.hipL.y },
      br: { x: j.hipR.x,      y: j.hipR.y },
    };

    const insetCorners: FitmentCorners = {
      tl: { x: fc.tl.x + 1.5 * sz, y: fc.tl.y + 1 * sz },
      tr: { x: fc.tr.x - 1.5 * sz, y: fc.tr.y + 1 * sz },
      bl: { x: fc.bl.x + 0.5 * sz, y: fc.bl.y - 0.5 * sz },
      br: { x: fc.br.x - 0.5 * sz, y: fc.br.y - 0.5 * sz },
    };

    return [
      {
        depth: DEPTH_BODY + 3,
        draw: (g: Graphics, s: number) => {
          // Base quad — bone white
          drawCornerQuad(g, insetCorners, 0, palette.body, palette.outline, 0.42, s);

          if (facingCamera) {
            // Spine: vertical line
            const spTop = quadPoint(insetCorners, 0.5, 0.05);
            const spBot = quadPoint(insetCorners, 0.5, 0.88);
            g.moveTo(spTop.x * s, spTop.y * s);
            g.lineTo(spBot.x * s, spBot.y * s);
            g.stroke({ width: s * 1.0, color: palette.bodyDk, alpha: 0.55 });

            // 4 pairs of rib arcs
            const ribPairs = 4;
            for (let i = 0; i < ribPairs; i++) {
              const v = 0.35 + i * 0.14;
              const spine = quadPoint(insetCorners, 0.5, v);
              // Left rib
              const ribL = quadPoint(insetCorners, 0.08, v + 0.04);
              g.moveTo(spine.x * s, spine.y * s);
              g.quadraticCurveTo(
                quadPoint(insetCorners, 0.28, v - 0.02).x * s,
                quadPoint(insetCorners, 0.28, v - 0.02).y * s,
                ribL.x * s, ribL.y * s
              );
              g.stroke({ width: s * 0.9, color: palette.bodyLt, alpha: 0.6 });
              // Right rib
              const ribR = quadPoint(insetCorners, 0.92, v + 0.04);
              g.moveTo(spine.x * s, spine.y * s);
              g.quadraticCurveTo(
                quadPoint(insetCorners, 0.72, v - 0.02).x * s,
                quadPoint(insetCorners, 0.72, v - 0.02).y * s,
                ribR.x * s, ribR.y * s
              );
              g.stroke({ width: s * 0.9, color: palette.bodyLt, alpha: 0.6 });
            }

            // Skull emblem at top
            const skull = quadPoint(insetCorners, 0.5, 0.18);
            // Skull head
            g.circle(skull.x * s, skull.y * s, 2.5 * sz * s);
            g.fill(palette.bodyLt);
            g.circle(skull.x * s, skull.y * s, 2.5 * sz * s);
            g.stroke({ width: s * 0.4, color: palette.outline, alpha: 0.5 });
            // Eye sockets
            g.circle((skull.x - 0.9 * sz) * s, (skull.y - 0.2 * sz) * s, 0.7 * sz * s);
            g.fill(darken(palette.outline, 0) );
            g.circle((skull.x + 0.9 * sz) * s, (skull.y - 0.2 * sz) * s, 0.7 * sz * s);
            g.fill(darken(palette.outline, 0));
            // Teeth hint
            g.roundRect((skull.x - 1.2 * sz) * s, (skull.y + 1.2 * sz) * s, 2.4 * sz * s, 1 * sz * s, 0.3 * s);
            g.fill(palette.bodyDk);

            // Pelvis-like buckle at bottom
            const pelvis = quadPoint(insetCorners, 0.5, 0.88);
            g.ellipse(pelvis.x * s, pelvis.y * s, 5 * sz * s, 1.8 * sz * s);
            g.fill(palette.bodyLt);
            g.ellipse(pelvis.x * s, pelvis.y * s, 5 * sz * s, 1.8 * sz * s);
            g.stroke({ width: s * 0.4, color: palette.outline, alpha: 0.45 });
            // Center buckle hole
            g.circle(pelvis.x * s, pelvis.y * s, 0.8 * sz * s);
            g.fill(palette.bodyDk);

          } else {
            // Back: darker tint
            drawCornerQuad(g, insetCorners, 0, darken(palette.body, 0.1), palette.outline, 0, s);
            g.fill({ color: darken(palette.body, 0.1), alpha: 0.3 });

            // Spine vertebrae column
            for (let i = 0; i < 6; i++) {
              const v = 0.1 + i * 0.14;
              const vPt = quadPoint(insetCorners, 0.5, v);
              g.circle(vPt.x * s, vPt.y * s, 1.2 * sz * s);
              g.fill(palette.bodyLt);
              g.circle(vPt.x * s, vPt.y * s, 1.2 * sz * s);
              g.stroke({ width: s * 0.3, color: palette.bodyDk, alpha: 0.4 });
            }

            // Back rib arcs (simplified, 3 pairs)
            for (let i = 0; i < 3; i++) {
              const v = 0.4 + i * 0.16;
              const spine = quadPoint(insetCorners, 0.5, v);
              const ribL = quadPoint(insetCorners, 0.1, v + 0.05);
              const ribR = quadPoint(insetCorners, 0.9, v + 0.05);
              g.moveTo(spine.x * s, spine.y * s);
              g.quadraticCurveTo(
                quadPoint(insetCorners, 0.25, v).x * s,
                quadPoint(insetCorners, 0.25, v).y * s,
                ribL.x * s, ribL.y * s
              );
              g.stroke({ width: s * 0.7, color: palette.bodyLt, alpha: 0.45 });
              g.moveTo(spine.x * s, spine.y * s);
              g.quadraticCurveTo(
                quadPoint(insetCorners, 0.75, v).x * s,
                quadPoint(insetCorners, 0.75, v).y * s,
                ribR.x * s, ribR.y * s
              );
              g.stroke({ width: s * 0.7, color: palette.bodyLt, alpha: 0.45 });
            }
          }
        },
      },
    ];
  }

  getAttachmentPoints(): Record<string, AttachmentPoint> { return {}; }
}
