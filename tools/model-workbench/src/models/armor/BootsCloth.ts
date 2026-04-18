import type { Graphics } from "pixi.js";
import type { Model, RenderContext, DrawCall, AttachmentPoint, V, FitmentCorners } from "../types";
import { DEPTH_FAR_LIMB } from "../types";
import { darken } from "../palette";

/**
 * Cloth Wraps — simple linen foot bindings.
 *
 * Draws BOTH feet (far + near) in one invocation. Attach to feet-L ONLY in config.
 * Scale derived from fitmentCorners ankle width when available.
 */
export class BootsCloth implements Model {
  readonly id = "boots-cloth";
  readonly name = "Cloth Wraps";
  readonly category = "feet" as const;
  readonly slot = "feet-L" as const;

  getDrawCalls(ctx: RenderContext): DrawCall[] {
    const { skeleton, palette, farSide, nearSide, fitmentCorners } = ctx;
    const j   = skeleton.joints;
    const iso = skeleton.iso;
    const sz  = ctx.slotParams.size;

    // Derive foot scale from fitmentCorners ankle width (if available)
    const ankleW = fitmentCorners
      ? Math.abs(fitmentCorners.tr.x - fitmentCorners.tl.x) * 0.8
      : 2.2 * sz;
    const toeW = ankleW * 0.6;
    const footLen = fitmentCorners
      ? Math.sqrt(
          Math.pow(fitmentCorners.bl.x - fitmentCorners.tl.x, 2) +
          Math.pow(fitmentCorners.bl.y - fitmentCorners.tl.y, 2),
        ) * 1.2
      : 4.2 * sz;

    return [
      {
        depth: DEPTH_FAR_LIMB + 3,
        draw: (g, s) => this.drawBoot(g, j, iso, palette, s, farSide, sz, ankleW, toeW, footLen, false),
      },
      {
        depth: DEPTH_FAR_LIMB + 7,
        draw: (g, s) => this.drawBoot(g, j, iso, palette, s, nearSide, sz, ankleW, toeW, footLen, true),
      },
    ];
  }

  private drawBoot(
    g: Graphics,
    j: Record<string, V>,
    iso: V,
    p: any,
    s: number,
    side: "L" | "R",
    sz: number,
    ankleW: number,
    toeW: number,
    footLen: number,
    isNear: boolean,
  ): void {
    const ankle = j[`ankle${side}`];
    const color = isNear ? p.body : darken(p.body, 0.1);
    const dk    = isNear ? p.bodyDk : darken(p.bodyDk, 0.1);

    // Foot direction from iso perspective
    const fwdX = iso.x * footLen;
    const fwdY = iso.y * footLen * 0.5;
    const tipX = ankle.x + fwdX;
    const tipY = ankle.y + fwdY + 1.5;

    const fdx  = tipX - ankle.x;
    const fdy  = tipY - ankle.y;
    const flen = Math.sqrt(fdx * fdx + fdy * fdy) || 1;
    const pnx  = -fdy / flen;
    const pny  =  fdx / flen;

    // Boot outline
    g.moveTo((ankle.x + pnx * ankleW) * s, (ankle.y + pny * ankleW) * s);
    g.lineTo((tipX + pnx * toeW) * s, (tipY + pny * toeW) * s);
    g.quadraticCurveTo(
      (tipX + fdx / flen * 1.5) * s, (tipY + fdy / flen) * s,
      (tipX - pnx * toeW) * s, (tipY - pny * toeW) * s,
    );
    g.lineTo((ankle.x - pnx * ankleW) * s, (ankle.y - pny * ankleW) * s);
    g.closePath();
    g.fill(color);

    // Wrap bands (2 lines across the foot)
    for (let i = 0; i < 2; i++) {
      const t  = (i + 1) / 3;
      const bx = ankle.x + fdx * t;
      const by = ankle.y + fdy * t;
      const bw = ankleW + (toeW - ankleW) * t;
      g.moveTo((bx + pnx * bw) * s, (by + pny * bw) * s);
      g.lineTo((bx - pnx * bw) * s, (by - pny * bw) * s);
      g.stroke({ width: s * 0.6, color: dk, alpha: 0.35 });
    }

    // Ankle wrap ring
    g.ellipse(ankle.x * s, (ankle.y - 0.5) * s, ankleW * s, ankleW * 0.6 * s);
    g.fill(color);
    g.ellipse(ankle.x * s, (ankle.y - 0.5) * s, ankleW * s, ankleW * 0.6 * s);
    g.stroke({ width: s * 0.3, color: dk, alpha: 0.3 });
  }

  getAttachmentPoints(): Record<string, AttachmentPoint> { return {}; }
}
