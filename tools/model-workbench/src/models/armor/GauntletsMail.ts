import type { Graphics } from "pixi.js";
import type { Model, RenderContext, DrawCall, AttachmentPoint, FitmentCorners } from "../types";
import { DEPTH_FAR_LIMB, DEPTH_NEAR_LIMB } from "../types";
import { darken } from "../palette";
import { drawCornerQuad, quadPoint, sideCorners } from "../draw-helpers";

/**
 * Mail Mittens — chain-mail covered forearms with padded cuff and mitten.
 *
 * CORNER-BASED: Uses fitmentCorners (gauntlets slot) split per-side.
 */
export class GauntletsMail implements Model {
  readonly id = "gauntlets-mail";
  readonly name = "Mail Mittens";
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
        draw: (g, s) => this.drawMailGauntlet(g, j, palette, s, farSide, fc, sz, wf, false),
      },
      {
        depth: facingCamera ? DEPTH_NEAR_LIMB + 6 : DEPTH_FAR_LIMB + 11,
        draw: (g, s) => this.drawMailGauntlet(g, j, palette, s, nearSide, fc, sz, wf, true),
      },
    ];
  }

  private drawMailGauntlet(
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
    const color = isNear ? p.body : darken(p.body, 0.12);
    const bodyLt = isNear ? p.bodyLt : darken(p.bodyLt, 0.12);

    // Mail-covered forearm
    drawCornerQuad(g, sc, 0, color, p.outline, 0.38, s);

    // Ring rows along the forearm (3 horizontal lines)
    for (let i = 0; i < 3; i++) {
      const t = 0.12 + i * 0.27;
      const rowL = quadPoint(sc, 0.06, t);
      const rowR = quadPoint(sc, 0.94, t);
      g.moveTo(rowL.x * s, rowL.y * s); g.lineTo(rowR.x * s, rowR.y * s);
      g.stroke({ width: s * 0.4, color: bodyLt, alpha: 0.3 });
    }

    // Ring dots
    for (let i = 0; i < 3; i++) {
      const pt = quadPoint(sc, 0.5, 0.12 + i * 0.27);
      g.circle(pt.x * s, pt.y * s, 0.5 * s);
      g.stroke({ width: s * 0.2, color: bodyLt, alpha: 0.3 });
    }

    // Padded cuff at elbow
    g.ellipse(elbow.x * s, elbow.y * s, 2.8 * sz * wf * s, 2.0 * sz * s);
    g.fill(p.accent);
    g.ellipse(elbow.x * s, elbow.y * s, 2.8 * sz * wf * s, 2.0 * sz * s);
    g.stroke({ width: s * 0.35, color: p.accentDk, alpha: 0.35 });

    // Mail mitten hand
    const handR = Math.abs(sc.br.x - sc.bl.x) * 0.55;
    g.circle(wrist.x * s, wrist.y * s, handR * s);
    g.fill(color);
    g.circle(wrist.x * s, wrist.y * s, handR * s);
    g.stroke({ width: s * 0.4, color: p.outline, alpha: 0.32 });
    // Ring on hand
    g.circle(wrist.x * s, wrist.y * s, 0.45 * s);
    g.stroke({ width: s * 0.2, color: bodyLt, alpha: 0.25 });
  }

  getAttachmentPoints(): Record<string, AttachmentPoint> { return {}; }
}
