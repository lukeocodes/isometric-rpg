import type { Graphics } from "pixi.js";
import type { Model, RenderContext, DrawCall, AttachmentPoint, FitmentCorners } from "../types";
import { DEPTH_BODY } from "../types";
import { darken } from "../palette";
import { drawCornerQuad, quadPoint } from "../draw-helpers";

/**
 * Dragon Scale Armor — overlapping dragonscale plates with gold trim.
 *
 * DEPTH: DEPTH_BODY + 3 (= 93) — above torso body.
 * CORNER-BASED: stretches to fit any body type via fitmentCorners.
 * FACING AWARE: front crest + ornate belt; back shows spine scales only.
 */
export class ArmorDragon implements Model {
  readonly id = "armor-dragon";
  readonly name = "Dragon Scale Armor";
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
          drawCornerQuad(g, insetCorners, 0, palette.body, palette.outline, 0.4, s);

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
            drawCornerQuad(g, shadowCorners, 0, darken(palette.body, 0.2), palette.outline, 0, s);
            g.fill({ color: darken(palette.body, 0.2), alpha: sideAmt * 0.4 });
          }

          // Scale rows — overlapping arcs across torso
          const scaleRows = 5;
          const scaleCols = 4;
          for (let row = 0; row < scaleRows; row++) {
            for (let col = 0; col < scaleCols; col++) {
              const uOffset = row % 2 === 0 ? 0 : 0.5 / scaleCols;
              const uC = (col + 0.5) / scaleCols + uOffset;
              const vMid = (row + 0.5) / scaleRows * 0.85 + 0.05;
              if (uC <= 0 || uC >= 1) continue;
              const center = quadPoint(insetCorners, uC, vMid);
              const scaleW = ((insetCorners.tr.x - insetCorners.tl.x) / scaleCols) * 0.55 * s;
              const scaleH = ((insetCorners.bl.y - insetCorners.tl.y) / scaleRows) * 0.65 * s;
              g.ellipse(center.x * s, center.y * s, scaleW, scaleH);
              g.stroke({ width: s * 0.5, color: palette.accent, alpha: 0.45 });
            }
          }

          if (facingCamera) {
            // Dragon crest at top-center — wing/claw shape
            const crest = quadPoint(insetCorners, 0.5, 0.22);
            // Left wing
            g.moveTo((crest.x - 4 * sz * wf) * s, (crest.y + 1 * sz) * s);
            g.quadraticCurveTo((crest.x - 2 * sz * wf) * s, (crest.y - 2 * sz) * s, crest.x * s, (crest.y - 0.5 * sz) * s);
            g.stroke({ width: s * 1.2, color: palette.accent, alpha: 0.75 });
            // Right wing
            g.moveTo((crest.x + 4 * sz * wf) * s, (crest.y + 1 * sz) * s);
            g.quadraticCurveTo((crest.x + 2 * sz * wf) * s, (crest.y - 2 * sz) * s, crest.x * s, (crest.y - 0.5 * sz) * s);
            g.stroke({ width: s * 1.2, color: palette.accent, alpha: 0.75 });
            // Claw
            g.moveTo(crest.x * s, (crest.y - 2 * sz) * s);
            g.lineTo(crest.x * s, (crest.y + 1.5 * sz) * s);
            g.stroke({ width: s * 0.9, color: palette.accent, alpha: 0.6 });
            // Crest jewel
            g.circle(crest.x * s, (crest.y - 0.3 * sz) * s, 1.1 * sz * s);
            g.fill(palette.accent);
            g.circle(crest.x * s, (crest.y - 0.3 * sz) * s, 1.1 * sz * s);
            g.stroke({ width: s * 0.3, color: palette.outline, alpha: 0.5 });

            // Ornate belt at 0.65
            const beltL = quadPoint(insetCorners, 0.05, 0.65);
            const beltR = quadPoint(insetCorners, 0.95, 0.65);
            const beltMid = quadPoint(insetCorners, 0.5, 0.65);
            g.moveTo(beltL.x * s, beltL.y * s);
            g.lineTo(beltR.x * s, beltR.y * s);
            g.stroke({ width: s * 2, color: palette.accent, alpha: 0.55 });
            // Belt buckle
            g.roundRect((beltMid.x - 2 * sz) * s, (beltMid.y - 1.2 * sz) * s, 4 * sz * s, 2.4 * sz * s, 0.5 * s);
            g.fill(palette.accent);
            g.roundRect((beltMid.x - 2 * sz) * s, (beltMid.y - 1.2 * sz) * s, 4 * sz * s, 2.4 * sz * s, 0.5 * s);
            g.stroke({ width: s * 0.4, color: palette.outline, alpha: 0.5 });

          } else {
            // Back: darker overlay
            drawCornerQuad(g, insetCorners, 0, darken(palette.body, 0.1), palette.outline, 0, s);
            g.fill({ color: darken(palette.body, 0.1), alpha: 0.3 });

            // Spine column of 5 scale bumps
            for (let i = 0; i < 5; i++) {
              const spPt = quadPoint(insetCorners, 0.5, 0.1 + i * 0.17);
              g.circle(spPt.x * s, spPt.y * s, 1.5 * sz * s);
              g.fill(palette.accent);
              g.circle(spPt.x * s, spPt.y * s, 1.5 * sz * s);
              g.stroke({ width: s * 0.4, color: palette.outline, alpha: 0.4 });
            }
          }
        },
      },
    ];
  }

  getAttachmentPoints(): Record<string, AttachmentPoint> { return {}; }
}
