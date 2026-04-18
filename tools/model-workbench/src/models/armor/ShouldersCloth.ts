import type { Graphics } from "pixi.js";
import type { Model, RenderContext, DrawCall, AttachmentPoint, FitmentCorners } from "../types";
import { DEPTH_FAR_LIMB, DEPTH_BODY, DEPTH_NEAR_LIMB } from "../types";
import { darken } from "../palette";
import { drawCornerQuad, quadPoint, sideCorners } from "../draw-helpers";

/**
 * Cloth Mantle — flowing fabric drape over both shoulders with a connecting yoke.
 *
 * CORNER-BASED: Uses fitmentCorners (shoulders slot) split per-side + centre yoke.
 * The drape hem and yoke curve adapt to any body width.
 *
 * DEPTH: far drape → FAR_LIMB+8 (behind body when facing cam), BODY+3 (in front away)
 *        near drape → BODY+3 (in front facing cam), FAR_LIMB+8 (behind away)
 *        yoke → always BODY+3 (centre panel always in front of far drape)
 */
export class ShouldersCloth implements Model {
  readonly id = "shoulders-cloth";
  readonly name = "Cloth Mantle";
  readonly category = "shoulders" as const;
  readonly slot = "shoulders" as const;

  getDrawCalls(ctx: RenderContext): DrawCall[] {
    const { skeleton, palette, farSide, nearSide, facingCamera, fitmentCorners } = ctx;
    const j  = skeleton.joints;
    const sz = ctx.slotParams.size;
    const wf = skeleton.wf;

    const fc: FitmentCorners = fitmentCorners ?? {
      tl: { x: j.shoulderL.x - 3 * wf, y: j.shoulderL.y - 2 },
      tr: { x: j.shoulderR.x + 3 * wf, y: j.shoulderR.y - 2 },
      bl: { x: j.elbowL.x, y: j.elbowL.y },
      br: { x: j.elbowR.x, y: j.elbowR.y },
    };

    return [
      // Far side drape
      {
        depth: facingCamera ? DEPTH_FAR_LIMB + 9 : DEPTH_NEAR_LIMB + 1,
        draw: (g, s) => this.drawDrape(g, palette, s, farSide, fc, sz, false, facingCamera),
      },
      // Yoke (centre panel connecting both drapes)
      {
        depth: DEPTH_BODY + 3,
        draw: (g, s) => {
          const topL = quadPoint(fc, 0.28, 0.05);
          const topR = quadPoint(fc, 0.72, 0.05);
          const neck = j.neckBase;
          const dropY = neck.y + 5 * sz;
          // Yoke arc from left shoulder to right, dropping to dropY
          g.moveTo(topL.x * s, topL.y * s);
          g.quadraticCurveTo(neck.x * s, (neck.y + 0.5) * s, topR.x * s, topR.y * s);
          g.lineTo(quadPoint(fc, 0.68, 0.0).x * s, dropY * s);
          g.quadraticCurveTo(neck.x * s, (dropY + 0.5) * s, quadPoint(fc, 0.32, 0.0).x * s, dropY * s);
          g.closePath();
          g.fill(palette.body);
          g.stroke({ width: s * 0.4, color: palette.bodyDk, alpha: 0.3 });
        },
      },
      // Near side drape
      {
        depth: facingCamera ? DEPTH_BODY + 3 : DEPTH_FAR_LIMB + 11,
        draw: (g, s) => this.drawDrape(g, palette, s, nearSide, fc, sz, true, facingCamera),
      },
    ];
  }

  private drawDrape(
    g: Graphics,
    p: any,
    s: number,
    side: "L" | "R",
    fc: FitmentCorners,
    sz: number,
    isNear: boolean,
    facingCamera: boolean,
  ): void {
    const sc = sideCorners(fc, side);
    const fillColor = isNear ? p.body : darken(p.body, 0.1);

    // Drape fill — outer edge hangs past the elbow; inner edge stays near neck
    drawCornerQuad(g, sc, 0, fillColor, p.outline, 0, s);

    // Accent hem along outer+bottom edge
    const hemA = quadPoint(sc, 1.0, 0.4);
    const hemB = quadPoint(sc, 0.85, 1.0);
    const hemC = quadPoint(sc, 0.3, 1.0);
    g.moveTo(hemA.x * s, hemA.y * s);
    g.quadraticCurveTo(hemB.x * s, hemB.y * s, hemC.x * s, hemC.y * s);
    g.stroke({ width: s * 0.9, color: p.accent, alpha: 0.62 });
    g.moveTo(hemA.x * s, hemA.y * s);
    g.quadraticCurveTo(hemB.x * s, hemB.y * s, hemC.x * s, hemC.y * s);
    g.stroke({ width: s * 0.35, color: p.accentDk, alpha: 0.4 });

    // Fold crease from top toward hem
    const creaseT = quadPoint(sc, 0.6, 0.1);
    const creaseB = quadPoint(sc, 0.75, 0.75);
    g.moveTo(creaseT.x * s, creaseT.y * s);
    g.quadraticCurveTo(
      quadPoint(sc, 0.7, 0.4).x * s, quadPoint(sc, 0.7, 0.4).y * s,
      creaseB.x * s, creaseB.y * s,
    );
    g.stroke({ width: s * 0.4, color: p.bodyDk, alpha: 0.22 });

    // Back view: slightly darker, no accent visible
    if (!facingCamera) {
      drawCornerQuad(g, sc, 0, darken(fillColor, 0.06), p.outline, 0, s);
    }
  }

  getAttachmentPoints(): Record<string, AttachmentPoint> { return {}; }
}
