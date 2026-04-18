import type { Graphics } from "pixi.js";
import type { Model, RenderContext, DrawCall, AttachmentPoint, FitmentCorners } from "../types";
import { DEPTH_FAR_LIMB, DEPTH_NEAR_LIMB } from "../types";
import { darken } from "../palette";
import { drawCornerQuad, quadPoint, sideCorners } from "../draw-helpers";

/**
 * Plate Gauntlets — heavy articulated vambraces with elbow cops and finger plates.
 *
 * CORNER-BASED: Uses fitmentCorners (gauntlets slot) split per-side.
 * elbow→wrist quad adapts to arm length and width of any body type.
 */
export class GauntletsPlate implements Model {
  readonly id = "gauntlets-plate";
  readonly name = "Plate Gauntlets";
  readonly category = "gauntlets" as const;
  readonly slot = "gauntlets" as const;

  getDrawCalls(ctx: RenderContext): DrawCall[] {
    const { skeleton, palette, farSide, nearSide, facingCamera, fitmentCorners } = ctx;
    const j  = skeleton.joints;
    const sz = ctx.slotParams.size;
    const wf = skeleton.wf;

    const fc: FitmentCorners = fitmentCorners ?? {
      tl: { x: j.elbowL.x, y: j.elbowL.y },
      tr: { x: j.elbowR.x, y: j.elbowR.y },
      bl: { x: j.wristL.x, y: j.wristL.y },
      br: { x: j.wristR.x, y: j.wristR.y },
    };

    return [
      {
        depth: facingCamera ? DEPTH_FAR_LIMB + 9 : DEPTH_NEAR_LIMB + 1,
        draw: (g, s) => this.drawVambrace(g, j, palette, s, farSide, fc, sz, wf, false),
      },
      {
        depth: facingCamera ? DEPTH_NEAR_LIMB + 6 : DEPTH_FAR_LIMB + 11,
        draw: (g, s) => this.drawVambrace(g, j, palette, s, nearSide, fc, sz, wf, true),
      },
    ];
  }

  private drawVambrace(
    g: Graphics,
    j: Record<string, any>,
    p: any,
    s: number,
    side: "L" | "R",
    fc: FitmentCorners,
    sz: number,
    wf: number,
    isNear: boolean,
  ): void {
    const sc    = sideCorners(fc, side);
    const elbow = j[`elbow${side}`];
    const wrist = j[`wrist${side}`];

    const color  = isNear ? p.body    : darken(p.body, 0.12);
    const bodyLt = isNear ? p.bodyLt  : darken(p.bodyLt, 0.12);
    const bodyDk = isNear ? p.bodyDk  : darken(p.bodyDk, 0.12);

    // Vambrace plate — fills elbow→wrist corner region
    drawCornerQuad(g, sc, 0, color, p.outline, 0.42, s);

    // Highlight ridge along the plate
    const ridgeT = quadPoint(sc, 0.5, 0.08);
    const ridgeB = quadPoint(sc, 0.5, 0.88);
    g.moveTo(ridgeT.x * s, ridgeT.y * s); g.lineTo(ridgeB.x * s, ridgeB.y * s);
    g.stroke({ width: s * 0.6, color: bodyLt, alpha: 0.22 });

    // Articulation lines (2 bands across the vambrace)
    for (let i = 1; i <= 2; i++) {
      const t = i * 0.28;
      const aL = quadPoint(sc, 0.05, t);
      const aR = quadPoint(sc, 0.95, t);
      g.moveTo(aL.x * s, aL.y * s); g.lineTo(aR.x * s, aR.y * s);
      g.stroke({ width: s * 0.4, color: p.outline, alpha: 0.28 });
    }

    // Elbow cop — flared disc at the elbow joint
    g.ellipse(elbow.x * s, elbow.y * s, 3.4 * sz * wf * s, 2.4 * sz * s);
    g.fill(bodyLt);
    g.ellipse(elbow.x * s, elbow.y * s, 3.4 * sz * wf * s, 2.4 * sz * s);
    g.stroke({ width: s * 0.5, color: p.outline, alpha: 0.42 });
    // Cop rivet
    g.circle(elbow.x * s, elbow.y * s, 0.75 * s); g.fill(p.accent);

    // Wrist flare
    const wflareW = Math.abs(sc.br.x - sc.bl.x) * 0.55;
    g.ellipse(wrist.x * s, wrist.y * s, wflareW * s, 1.5 * sz * s);
    g.fill(bodyLt);
    g.ellipse(wrist.x * s, wrist.y * s, wflareW * s, 1.5 * sz * s);
    g.stroke({ width: s * 0.35, color: p.outline, alpha: 0.3 });

    // Plate gauntlet hand
    const handW = Math.abs(sc.br.x - sc.bl.x) * 0.7;
    g.roundRect((wrist.x - handW * 0.5) * s, (wrist.y - 1.5 * sz) * s, handW * s, 4 * sz * s, 1.5 * s);
    g.fill(color);
    g.roundRect((wrist.x - handW * 0.5) * s, (wrist.y - 1.5 * sz) * s, handW * s, 4 * sz * s, 1.5 * s);
    g.stroke({ width: s * 0.4, color: p.outline, alpha: 0.35 });

    // Finger plate lines
    const dx = wrist.x - elbow.x;
    const dy = wrist.y - elbow.y;
    const len = Math.sqrt(dx * dx + dy * dy) || 1;
    const hd = { x: dx / len, y: dy / len };
    const perp = { x: -dy / len, y: dx / len };
    for (let i = -1; i <= 1; i++) {
      const fx = wrist.x + hd.x * 2 + perp.x * i * 1.2;
      const fy = wrist.y + hd.y * 2 + perp.y * i * 1.2;
      g.moveTo(wrist.x * s, wrist.y * s); g.lineTo(fx * s, fy * s);
      g.stroke({ width: s * 0.6, color: color });
      g.circle(fx * s, fy * s, 0.5 * s); g.fill(bodyDk);
    }
  }

  getAttachmentPoints(): Record<string, AttachmentPoint> { return {}; }
}
