import type { Graphics } from "pixi.js";
import type { Model, RenderContext, DrawCall, AttachmentPoint, FitmentCorners } from "../types";
import { DEPTH_BODY } from "../types";
import { darken } from "../palette";
import { drawCornerQuad, quadPoint } from "../draw-helpers";

/**
 * Elven Leaf Armor — light leaf-weave with vine motifs and silver trim.
 *
 * DEPTH: DEPTH_BODY + 3 (= 93).
 * CORNER-BASED: adapts to any body type via fitmentCorners.
 * FACING AWARE: front shows leaf motifs + vine diagonals; back shows mail rows.
 */
export class ArmorElven implements Model {
  readonly id = "armor-elven";
  readonly name = "Elven Leaf Armor";
  readonly category = "armor" as const;
  readonly slot = "torso" as const;

  getDrawCalls(ctx: RenderContext): DrawCall[] {
    const { skeleton, palette, facingCamera, fitmentCorners } = ctx;
    const j  = skeleton.joints;
    const sz = ctx.slotParams.size;
    const wf = skeleton.wf;

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
          // Base quad
          drawCornerQuad(g, insetCorners, 0, palette.body, palette.outline, 0.38, s);

          // Directional shading
          const sideAmt = Math.abs(skeleton.iso.x);
          if (sideAmt > 0.08) {
            const shadowIsRight = ctx.nearSide === "L";
            const shadowCorners: FitmentCorners = shadowIsRight ? {
              tl: insetCorners.tr,
              tr: { x: (insetCorners.tl.x + insetCorners.tr.x) / 2, y: insetCorners.tl.y },
              bl: insetCorners.br,
              br: { x: (insetCorners.bl.x + insetCorners.br.x) / 2, y: insetCorners.bl.y },
            } : {
              tl: { x: (insetCorners.tl.x + insetCorners.tr.x) / 2, y: insetCorners.tl.y },
              tr: insetCorners.tl,
              bl: { x: (insetCorners.bl.x + insetCorners.br.x) / 2, y: insetCorners.bl.y },
              br: insetCorners.bl,
            };
            drawCornerQuad(g, shadowCorners, 0, darken(palette.body, 0.18), palette.outline, 0, s);
            g.fill({ color: darken(palette.body, 0.18), alpha: sideAmt * 0.4 });
          }

          if (facingCamera) {
            // Vine diagonal tl→br
            const tl = quadPoint(insetCorners, 0.05, 0.05);
            const br = quadPoint(insetCorners, 0.95, 0.90);
            const vmid1 = quadPoint(insetCorners, 0.4, 0.5);
            g.moveTo(tl.x * s, tl.y * s);
            g.quadraticCurveTo(vmid1.x * s, vmid1.y * s, br.x * s, br.y * s);
            g.stroke({ width: s * 0.7, color: palette.accent, alpha: 0.35 });

            // Vine diagonal tr→bl
            const tr = quadPoint(insetCorners, 0.95, 0.05);
            const bl = quadPoint(insetCorners, 0.05, 0.90);
            const vmid2 = quadPoint(insetCorners, 0.6, 0.5);
            g.moveTo(tr.x * s, tr.y * s);
            g.quadraticCurveTo(vmid2.x * s, vmid2.y * s, bl.x * s, bl.y * s);
            g.stroke({ width: s * 0.7, color: palette.accent, alpha: 0.35 });

            // Leaf motifs — 3 positions
            const leafPositions: Array<[number, number]> = [[0.5, 0.2], [0.3, 0.5], [0.7, 0.5]];
            for (const [u, v] of leafPositions) {
              const lp = quadPoint(insetCorners, u, v);
              const lw = 2.5 * sz * wf * s;
              const lh = 3.5 * sz * s;
              // Leaf ellipse
              g.ellipse(lp.x * s, lp.y * s, lw, lh);
              g.fill({ color: palette.accent, alpha: 0.55 });
              g.ellipse(lp.x * s, lp.y * s, lw, lh);
              g.stroke({ width: s * 0.4, color: palette.outline, alpha: 0.4 });
              // Leaf vein
              g.moveTo(lp.x * s, (lp.y - 1.5 * sz) * s);
              g.lineTo(lp.x * s, (lp.y + 1.5 * sz) * s);
              g.stroke({ width: s * 0.3, color: palette.bodyLt, alpha: 0.3 });
            }

            // Silver sash at 0.65
            const sashL = quadPoint(insetCorners, 0.05, 0.65);
            const sashR = quadPoint(insetCorners, 0.95, 0.65);
            g.moveTo(sashL.x * s, sashL.y * s);
            g.lineTo(sashR.x * s, sashR.y * s);
            g.stroke({ width: s * 1.8, color: palette.accent, alpha: 0.5 });
            // Sash knot
            const sashMid = quadPoint(insetCorners, 0.5, 0.65);
            g.circle(sashMid.x * s, sashMid.y * s, 1.2 * sz * s);
            g.fill(palette.accent);
            g.circle(sashMid.x * s, sashMid.y * s, 1.2 * sz * s);
            g.stroke({ width: s * 0.35, color: palette.outline, alpha: 0.45 });

          } else {
            // Back: horizontal mail rows + seam
            drawCornerQuad(g, insetCorners, 0, darken(palette.body, 0.08), palette.outline, 0, s);
            g.fill({ color: darken(palette.body, 0.08), alpha: 0.3 });

            // Horizontal rows
            const rows = 5;
            for (let i = 1; i < rows; i++) {
              const rowL = quadPoint(insetCorners, 0.05, i / rows);
              const rowR = quadPoint(insetCorners, 0.95, i / rows);
              g.moveTo(rowL.x * s, rowL.y * s);
              g.lineTo(rowR.x * s, rowR.y * s);
              g.stroke({ width: s * 0.4, color: palette.bodyDk, alpha: 0.25 });
            }

            // Back seam
            const seamT = quadPoint(insetCorners, 0.5, 0.02);
            const seamB = quadPoint(insetCorners, 0.5, 0.95);
            g.moveTo(seamT.x * s, seamT.y * s);
            g.lineTo(seamB.x * s, seamB.y * s);
            g.stroke({ width: s * 0.4, color: palette.bodyDk, alpha: 0.3 });
          }
        },
      },
    ];
  }

  getAttachmentPoints(): Record<string, AttachmentPoint> { return {}; }
}
