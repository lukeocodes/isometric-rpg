import type { Graphics } from "pixi.js";
import type { Model, RenderContext, DrawCall, AttachmentPoint, FitmentCorners } from "../types";
import { DEPTH_BODY } from "../types";
import { darken } from "../palette";
import { drawCornerQuad, quadPoint } from "../draw-helpers";

/**
 * Ogre Hide Vest — rough greenish-brown hide with cross-stitch seams and bone toggles.
 *
 * DEPTH: DEPTH_BODY + 3 (= 93).
 * CORNER-BASED: fitmentCorners for body-fitted shape.
 * No directional shading — intentionally rough/flat.
 */
export class ArmorOgreskin implements Model {
  readonly id = "armor-ogreskin";
  readonly name = "Ogre Hide Vest";
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

    // Slightly irregular corners (sine-based deterministic jitter)
    const jitter = (v: number, seed: number) => v + Math.sin(seed * 7.3) * 0.5 * sz;
    const insetCorners: FitmentCorners = {
      tl: { x: jitter(fc.tl.x + 1.5 * sz, 1), y: jitter(fc.tl.y + 1 * sz, 2) },
      tr: { x: jitter(fc.tr.x - 1.5 * sz, 3), y: jitter(fc.tr.y + 1 * sz, 4) },
      bl: { x: jitter(fc.bl.x + 0.5 * sz, 5), y: jitter(fc.bl.y - 0.5 * sz, 6) },
      br: { x: jitter(fc.br.x - 0.5 * sz, 7), y: jitter(fc.br.y - 0.5 * sz, 8) },
    };

    return [
      {
        depth: DEPTH_BODY + 3,
        draw: (g: Graphics, s: number) => {
          // Base quad — rough hide
          drawCornerQuad(g, insetCorners, 0, palette.body, palette.outline, 0.45, s);

          if (facingCamera) {
            // Cross-stitch seams — zigzag pattern along two vertical stitch lines
            for (const uStitch of [0.3, 0.7]) {
              const stitchPts = 8;
              for (let i = 0; i < stitchPts; i++) {
                const v0 = i / stitchPts * 0.85 + 0.05;
                const v1 = (i + 0.5) / stitchPts * 0.85 + 0.05;
                const p0 = quadPoint(insetCorners, uStitch - 0.03, v0);
                const p1 = quadPoint(insetCorners, uStitch + 0.03, v1);
                g.moveTo(p0.x * s, p0.y * s);
                g.lineTo(p1.x * s, p1.y * s);
                g.stroke({ width: s * 0.45, color: palette.bodyDk, alpha: 0.55 });
              }
            }

            // 3 bone toggles
            const togglePositions: Array<[number, number]> = [[0.5, 0.2], [0.3, 0.6], [0.7, 0.6]];
            for (const [u, v] of togglePositions) {
              const tp = quadPoint(insetCorners, u, v);
              // Bone toggle: small rect (bone shape)
              g.roundRect((tp.x - 1.5 * sz) * s, (tp.y - 0.6 * sz) * s, 3 * sz * s, 1.2 * sz * s, 0.5 * s);
              g.fill(palette.bodyLt);
              g.roundRect((tp.x - 1.5 * sz) * s, (tp.y - 0.6 * sz) * s, 3 * sz * s, 1.2 * sz * s, 0.5 * s);
              g.stroke({ width: s * 0.3, color: palette.outline, alpha: 0.5 });
              // Knob ends
              g.circle((tp.x - 1.5 * sz) * s, tp.y * s, 0.7 * sz * s); g.fill(palette.bodyLt);
              g.circle((tp.x + 1.5 * sz) * s, tp.y * s, 0.7 * sz * s); g.fill(palette.bodyLt);
            }

            // Fur trim at top — narrow ellipses along top edge
            const furCount = 6;
            for (let i = 0; i < furCount; i++) {
              const u = (i + 0.5) / furCount;
              const furPt = quadPoint(insetCorners, u, 0.02);
              g.ellipse(furPt.x * s, furPt.y * s, 1.5 * sz * s, 1.2 * sz * s);
              g.fill({ color: palette.bodyLt, alpha: 0.55 });
            }

            // Hanging bone charm at bottom center
            const charm = quadPoint(insetCorners, 0.5, 0.92);
            g.moveTo(charm.x * s, (charm.y - 2 * sz) * s);
            g.lineTo(charm.x * s, charm.y * s);
            g.stroke({ width: s * 0.4, color: palette.bodyDk, alpha: 0.6 });
            g.roundRect((charm.x - 0.8 * sz) * s, charm.y * s, 1.6 * sz * s, 2 * sz * s, 0.4 * s);
            g.fill(palette.bodyLt);
            g.roundRect((charm.x - 0.8 * sz) * s, charm.y * s, 1.6 * sz * s, 2 * sz * s, 0.4 * s);
            g.stroke({ width: s * 0.3, color: palette.outline, alpha: 0.45 });

          } else {
            // Back: vertical back stitching + horizontal strap lines
            drawCornerQuad(g, insetCorners, 0, darken(palette.body, 0.08), palette.outline, 0, s);
            g.fill({ color: darken(palette.body, 0.08), alpha: 0.3 });

            // Vertical back stitch
            const stitchPts = 8;
            for (let i = 0; i < stitchPts; i++) {
              const v0 = i / stitchPts * 0.85 + 0.05;
              const v1 = (i + 0.5) / stitchPts * 0.85 + 0.05;
              const p0 = quadPoint(insetCorners, 0.47, v0);
              const p1 = quadPoint(insetCorners, 0.53, v1);
              g.moveTo(p0.x * s, p0.y * s);
              g.lineTo(p1.x * s, p1.y * s);
              g.stroke({ width: s * 0.4, color: palette.bodyDk, alpha: 0.45 });
            }

            // Horizontal strap lines
            for (const v of [0.3, 0.6]) {
              const rL = quadPoint(insetCorners, 0.05, v);
              const rR = quadPoint(insetCorners, 0.95, v);
              g.moveTo(rL.x * s, rL.y * s);
              g.lineTo(rR.x * s, rR.y * s);
              g.stroke({ width: s * 1.2, color: darken(palette.body, 0.15), alpha: 0.5 });
            }
          }
        },
      },
    ];
  }

  getAttachmentPoints(): Record<string, AttachmentPoint> { return {}; }
}
