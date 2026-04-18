import type { Graphics } from "pixi.js";
import type { Model, RenderContext, DrawCall, AttachmentPoint, V, FitmentCorners } from "../types";
import { DEPTH_FAR_LIMB } from "../types";
import { darken } from "../palette";

/**
 * Leather Boots — sturdy mid-calf boots with buckle strap and shaped toe.
 *
 * Draws BOTH feet (far + near) in one invocation. Attach to feet-L ONLY in config.
 */
export class BootsLeather implements Model {
  readonly id = "boots-leather";
  readonly name = "Leather Boots";
  readonly category = "feet" as const;
  readonly slot = "feet-L" as const;

  getDrawCalls(ctx: RenderContext): DrawCall[] {
    const { skeleton, palette, farSide, nearSide, fitmentCorners } = ctx;
    const j   = skeleton.joints;
    const iso = skeleton.iso;
    const sz  = ctx.slotParams.size;

    const ankleW = fitmentCorners
      ? Math.abs(fitmentCorners.tr.x - fitmentCorners.tl.x) * 0.9
      : 2.5 * sz;
    const footLen = fitmentCorners
      ? Math.sqrt(
          Math.pow(fitmentCorners.bl.x - fitmentCorners.tl.x, 2) +
          Math.pow(fitmentCorners.bl.y - fitmentCorners.tl.y, 2),
        ) * 1.3
      : 4.5 * sz;

    return [
      {
        depth: DEPTH_FAR_LIMB + 3,
        draw: (g, s) => this.drawBoot(g, j, iso, palette, s, farSide, sz, ankleW, footLen, false),
      },
      {
        depth: DEPTH_FAR_LIMB + 7,
        draw: (g, s) => this.drawBoot(g, j, iso, palette, s, nearSide, sz, ankleW, footLen, true),
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
    footLen: number,
    isNear: boolean,
  ): void {
    const ankle  = j[`ankle${side}`];
    const knee   = j[`knee${side}`];
    const toeW   = ankleW * 0.6;
    const color  = isNear ? p.body    : darken(p.body,   0.1);
    const dk     = isNear ? p.bodyDk  : darken(p.bodyDk, 0.1);
    const accent = isNear ? p.accent  : darken(p.accent, 0.1);

    // Shaft height — from ankle up toward knee (40% of ankle-to-knee)
    const shaftFrac = 0.4;
    const shaftTopX = ankle.x + (knee.x - ankle.x) * shaftFrac;
    const shaftTopY = ankle.y + (knee.y - ankle.y) * shaftFrac;
    const shaftW    = ankleW * 1.1;

    // Shaft (round-rect for a sturdy calf look)
    g.roundRect(
      (Math.min(shaftTopX, ankle.x) - shaftW * 0.5) * s,
      shaftTopY * s,
      shaftW * s,
      (ankle.y - shaftTopY + 1) * s,
      1 * s,
    );
    g.fill(color);
    g.roundRect(
      (Math.min(shaftTopX, ankle.x) - shaftW * 0.5) * s,
      shaftTopY * s,
      shaftW * s,
      (ankle.y - shaftTopY + 1) * s,
      1 * s,
    );
    g.stroke({ width: s * 0.4, color: p.outline, alpha: 0.35 });

    // Top fold
    g.ellipse(shaftTopX * s, shaftTopY * s, shaftW * s, shaftW * 0.5 * s);
    g.fill(dk);

    // Buckle strap
    const strapY = shaftTopY + (ankle.y - shaftTopY) * 0.55;
    const strapSign = side === "L" ? 1 : -1;
    g.rect((shaftTopX - shaftW * 0.55) * s, (strapY - 0.55) * s, shaftW * 1.1 * s, 1.1 * s);
    g.fill(accent);
    g.rect((shaftTopX + strapSign * shaftW * 0.2) * s, (strapY - 0.75) * s, 1.5 * s, 1.5 * s);
    g.fill(p.accentDk);

    // Foot
    const fwdX = iso.x * footLen;
    const fwdY = iso.y * footLen * 0.5;
    const tipX = ankle.x + fwdX;
    const tipY = ankle.y + fwdY + 1.8;
    const fdx  = tipX - ankle.x;
    const fdy  = tipY - ankle.y;
    const flen = Math.sqrt(fdx * fdx + fdy * fdy) || 1;
    const pnx  = -fdy / flen;
    const pny  =  fdx / flen;

    g.moveTo((ankle.x + pnx * ankleW) * s, (ankle.y + pny * ankleW) * s);
    g.lineTo((tipX + pnx * toeW) * s, (tipY + pny * toeW) * s);
    g.quadraticCurveTo(
      (tipX + fdx / flen * 1.8) * s, (tipY + fdy / flen * 1.2) * s,
      (tipX - pnx * toeW) * s, (tipY - pny * toeW) * s,
    );
    g.lineTo((ankle.x - pnx * ankleW) * s, (ankle.y - pny * ankleW) * s);
    g.closePath();
    g.fill(color);
    g.moveTo((ankle.x + pnx * ankleW) * s, (ankle.y + pny * ankleW) * s);
    g.lineTo((tipX + pnx * toeW) * s, (tipY + pny * toeW) * s);
    g.quadraticCurveTo(
      (tipX + fdx / flen * 1.8) * s, (tipY + fdy / flen * 1.2) * s,
      (tipX - pnx * toeW) * s, (tipY - pny * toeW) * s,
    );
    g.lineTo((ankle.x - pnx * ankleW) * s, (ankle.y - pny * ankleW) * s);
    g.closePath();
    g.stroke({ width: s * 0.4, color: p.outline, alpha: 0.35 });

    // Sole
    g.moveTo((ankle.x - pnx * ankleW) * s, (ankle.y - pny * ankleW) * s);
    g.lineTo((tipX - pnx * toeW) * s, (tipY - pny * toeW) * s);
    g.stroke({ width: s * 0.7, color: dk, alpha: 0.42 });
  }

  getAttachmentPoints(): Record<string, AttachmentPoint> { return {}; }
}
