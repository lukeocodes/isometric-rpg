import type { Graphics } from "pixi.js";
import type { Model, RenderContext, DrawCall, AttachmentPoint, FitmentCorners } from "../types";
import { DEPTH_FAR_LIMB, DEPTH_BODY, DEPTH_NEAR_LIMB } from "../types";
import { darken, lighten } from "../palette";
import { drawCornerQuad, quadPoint, sideCorners } from "../draw-helpers";

/**
 * Plate Pauldrons — heavy layered shoulder armour.
 *
 * CORNER-BASED: Uses fitmentCorners (shoulders slot) split per-side via sideCorners().
 * Adapts to any body width — narrow elf, wide dwarf, ogre.
 *
 * DEPTH: facingCamera → far shoulder behind body (FAR_LIMB+8), near in front (BODY+3)
 *        !facingCamera → swapped
 */
export class ShouldersPlate implements Model {
  readonly id = "shoulders-plate";
  readonly name = "Plate Pauldrons";
  readonly category = "shoulders" as const;
  readonly slot = "shoulders" as const;

  getDrawCalls(ctx: RenderContext): DrawCall[] {
    const { skeleton, palette, farSide, nearSide, facingCamera, fitmentCorners } = ctx;
    const j  = skeleton.joints;
    const sz = ctx.slotParams.size;
    const wf = skeleton.wf;

    // Fallback corners from joints if not passed
    const fc: FitmentCorners = fitmentCorners ?? {
      tl: { x: j.shoulderL.x - 3 * wf, y: j.shoulderL.y - 2 },
      tr: { x: j.shoulderR.x + 3 * wf, y: j.shoulderR.y - 2 },
      bl: { x: j.elbowL.x, y: j.elbowL.y },
      br: { x: j.elbowR.x, y: j.elbowR.y },
    };

    return [
      {
        depth: facingCamera ? DEPTH_FAR_LIMB + 9 : DEPTH_NEAR_LIMB + 1,
        draw: (g, s) => this.drawPauldron(g, j, palette, s, farSide, fc, sz, false, facingCamera),
      },
      {
        depth: facingCamera ? DEPTH_BODY + 3 : DEPTH_FAR_LIMB + 11,
        draw: (g, s) => this.drawPauldron(g, j, palette, s, nearSide, fc, sz, true, facingCamera),
      },
    ];
  }

  private drawPauldron(
    g: Graphics,
    j: Record<string, any>,
    p: any,
    s: number,
    side: "L" | "R",
    fc: FitmentCorners,
    sz: number,
    isNear: boolean,
    facingCamera: boolean,
  ): void {
    const sc = sideCorners(fc, side);

    // Near side slightly lighter, far side slightly darker
    const bodyColor  = isNear ? p.body    : darken(p.body, 0.12);
    const bodyDkCol  = isNear ? p.bodyDk  : darken(p.bodyDk, 0.12);
    const accentCol  = isNear ? p.accent  : darken(p.accent, 0.1);

    if (facingCamera) {
      // Main pauldron plate — fills the shoulder corner region
      drawCornerQuad(g, sc, 0, bodyDkCol, p.outline, 0.4, s);
      drawCornerQuad(g, sc, 1.5, bodyColor, p.outline, 0, s);

      // Segmentation line across the middle of the plate
      const seg0L = quadPoint(sc, 0.08, 0.5);
      const seg0R = quadPoint(sc, 0.92, 0.5);
      g.moveTo(seg0L.x * s, seg0L.y * s);
      g.quadraticCurveTo(
        quadPoint(sc, 0.5, 0.52).x * s, quadPoint(sc, 0.5, 0.52).y * s,
        seg0R.x * s, seg0R.y * s,
      );
      g.stroke({ width: s * 0.45, color: p.outline, alpha: 0.3 });

      // Second segmentation line (lower plate)
      const seg1L = quadPoint(sc, 0.1, 0.75);
      const seg1R = quadPoint(sc, 0.9, 0.75);
      g.moveTo(seg1L.x * s, seg1L.y * s);
      g.lineTo(seg1R.x * s, seg1R.y * s);
      g.stroke({ width: s * 0.35, color: p.outline, alpha: 0.22 });

      // Rivet — upper centre
      const riv = quadPoint(sc, 0.5, 0.18);
      g.circle(riv.x * s, riv.y * s, 0.9 * sz * s); g.fill(accentCol);

      // Lit edge on near-side (inner edge highlight)
      if (isNear) {
        const litT = quadPoint(sc, 0, 0.05);
        const litB = quadPoint(sc, 0, 0.85);
        g.moveTo(litT.x * s, litT.y * s); g.lineTo(litB.x * s, litB.y * s);
        g.stroke({ width: s * 1.4, color: p.bodyLt, alpha: 0.2 });
      }

      // Shoulder cap flare at top
      const topMid = quadPoint(sc, 0.5, 0.0);
      g.ellipse(topMid.x * s, topMid.y * s, Math.abs(sc.tr.x - sc.tl.x) * 0.55 * s, 2.2 * sz * s);
      g.fill(isNear ? p.bodyLt : darken(p.bodyLt, 0.1));
      g.ellipse(topMid.x * s, topMid.y * s, Math.abs(sc.tr.x - sc.tl.x) * 0.55 * s, 2.2 * sz * s);
      g.stroke({ width: s * 0.4, color: p.outline, alpha: 0.35 });

    } else {
      // Back face — rounded, darker, minimal detail
      drawCornerQuad(g, sc, 0, darken(bodyColor, 0.08), p.outline, 0.4, s);

      const backSeg = quadPoint(sc, 0.5, 0.35);
      g.ellipse(backSeg.x * s, backSeg.y * s, Math.abs(sc.tr.x - sc.tl.x) * 0.45 * s, 1.8 * sz * s);
      g.fill({ color: darken(bodyColor, 0.12), alpha: 0.3 });
    }
  }

  getAttachmentPoints(): Record<string, AttachmentPoint> { return {}; }
}
