import type { Graphics } from "pixi.js";
import type { Model, RenderContext, DrawCall, AttachmentPoint, FitmentCorners } from "../types";
import { DEPTH_FAR_LIMB, DEPTH_BODY, DEPTH_NEAR_LIMB } from "../types";
import { darken } from "../palette";
import { drawCornerQuad, quadPoint, sideCorners } from "../draw-helpers";

/**
 * Leather Spaulders — hardened leather shoulder guards with studs and stitching.
 *
 * CORNER-BASED: Uses fitmentCorners split per-side. Adapts to any body width.
 */
export class ShouldersLeather implements Model {
  readonly id = "shoulders-leather";
  readonly name = "Leather Spaulders";
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
      {
        depth: facingCamera ? DEPTH_FAR_LIMB + 9 : DEPTH_NEAR_LIMB + 1,
        draw: (g, s) => this.drawSpauldron(g, palette, s, farSide, fc, sz, false, facingCamera),
      },
      {
        depth: facingCamera ? DEPTH_BODY + 3 : DEPTH_FAR_LIMB + 11,
        draw: (g, s) => this.drawSpauldron(g, palette, s, nearSide, fc, sz, true, facingCamera),
      },
    ];
  }

  private drawSpauldron(
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
    const fillColor = isNear ? p.body : darken(p.body, 0.12);
    const aColor = isNear ? p.accent : darken(p.accent, 0.08);

    // Main spaulder body
    drawCornerQuad(g, sc, 0.5, fillColor, p.outline, 0.42, s);

    // Edge accent band (bottom quarter of the plate)
    const bandTL = quadPoint(sc, 0.0, 0.72);
    const bandTR = quadPoint(sc, 1.0, 0.72);
    const bandBL = quadPoint(sc, 0.0, 1.0);
    const bandBR = quadPoint(sc, 1.0, 1.0);
    const bandCorners: FitmentCorners = { tl: bandTL, tr: bandTR, bl: bandBL, br: bandBR };
    drawCornerQuad(g, bandCorners, 0, aColor, p.accentDk, 0.3, s);

    if (facingCamera) {
      // Studs along the upper edge (front only)
      for (let i = 0; i < 3; i++) {
        const u = 0.2 + i * 0.3;
        const pt = quadPoint(sc, u, 0.15);
        g.circle(pt.x * s, pt.y * s, 0.8 * sz * s);
        g.fill(p.accentDk);
      }

      // Stitching arc
      const stitchL = quadPoint(sc, 0.08, 0.4);
      const stitchM = quadPoint(sc, 0.5, 0.25);
      const stitchR = quadPoint(sc, 0.92, 0.4);
      g.moveTo(stitchL.x * s, stitchL.y * s);
      g.quadraticCurveTo(stitchM.x * s, stitchM.y * s, stitchR.x * s, stitchR.y * s);
      g.stroke({ width: s * 0.35, color: p.accentDk, alpha: 0.3 });

      // Lit shoulder cap
      const capMid = quadPoint(sc, 0.5, 0.0);
      const capW = Math.abs(sc.tr.x - sc.tl.x) * 0.5;
      g.ellipse(capMid.x * s, capMid.y * s, capW * s, 2.0 * sz * s);
      g.fill({ color: p.bodyLt, alpha: 0.18 });

    } else {
      // Back: subtle crease, no studs
      const creaseT = quadPoint(sc, 0.5, 0.2);
      const creaseB = quadPoint(sc, 0.5, 0.68);
      g.moveTo(creaseT.x * s, creaseT.y * s); g.lineTo(creaseB.x * s, creaseB.y * s);
      g.stroke({ width: s * 0.4, color: p.bodyDk, alpha: 0.22 });
    }
  }

  getAttachmentPoints(): Record<string, AttachmentPoint> { return {}; }
}
