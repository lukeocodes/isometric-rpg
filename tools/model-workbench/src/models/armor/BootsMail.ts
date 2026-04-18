import type { Graphics } from "pixi.js";
import type { Model, RenderContext, DrawCall, AttachmentPoint, V, FitmentCorners } from "../types";
import { DEPTH_FAR_LIMB } from "../types";
import { darken } from "../palette";

/**
 * Mail Sabatons — chain mail ankle boot with leather sole and top rim.
 *
 * Draws BOTH feet (far + near) in one invocation. Attach to feet-L ONLY in config.
 */
export class BootsMail implements Model {
  readonly id = "boots-mail";
  readonly name = "Mail Sabatons";
  readonly category = "feet" as const;
  readonly slot = "feet-L" as const;

  getDrawCalls(ctx: RenderContext): DrawCall[] {
    const { skeleton, palette, farSide, nearSide, fitmentCorners } = ctx;
    const j   = skeleton.joints;
    const iso = skeleton.iso;
    const sz  = ctx.slotParams.size;

    const ankleW = fitmentCorners
      ? Math.abs(fitmentCorners.tr.x - fitmentCorners.tl.x) * 0.88
      : 2.3 * sz;
    const footLen = fitmentCorners
      ? Math.sqrt(
          Math.pow(fitmentCorners.bl.x - fitmentCorners.tl.x, 2) +
          Math.pow(fitmentCorners.bl.y - fitmentCorners.tl.y, 2),
        ) * 1.2
      : 4.3 * sz;

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
    const color  = isNear ? p.body   : darken(p.body, 0.1);
    const bodyLt = isNear ? p.bodyLt : darken(p.bodyLt, 0.1);

    // Mail shaft — short (ankle-height) for sabatons
    const shaftFrac = 0.22;
    const shaftTopX = ankle.x + (knee.x - ankle.x) * shaftFrac;
    const shaftTopY = ankle.y + (knee.y - ankle.y) * shaftFrac;
    const shaftW    = ankleW * 1.15;

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
    g.stroke({ width: s * 0.4, color: p.outline, alpha: 0.32 });

    // Ring pattern on shaft
    for (let row = 0; row < 2; row++) {
      const ry = shaftTopY + 1 + row * ((ankle.y - shaftTopY) * 0.45);
      for (let col = 0; col < 3; col++) {
        const rx = shaftTopX - shaftW * 0.33 + col * shaftW * 0.33;
        g.circle(rx * s, ry * s, 0.42 * s);
        g.stroke({ width: s * 0.2, color: bodyLt, alpha: 0.28 });
      }
    }

    // Top rim
    g.ellipse(shaftTopX * s, shaftTopY * s, shaftW * s, shaftW * 0.42 * s);
    g.fill(p.accent);
    g.ellipse(shaftTopX * s, shaftTopY * s, shaftW * s, shaftW * 0.42 * s);
    g.stroke({ width: s * 0.28, color: p.accentDk, alpha: 0.3 });

    // Foot
    const fwdX = iso.x * footLen;
    const fwdY = iso.y * footLen * 0.5;
    const tipX = ankle.x + fwdX;
    const tipY = ankle.y + fwdY + 1.6;
    const fdx  = tipX - ankle.x;
    const fdy  = tipY - ankle.y;
    const flen = Math.sqrt(fdx * fdx + fdy * fdy) || 1;
    const pnx  = -fdy / flen;
    const pny  =  fdx / flen;

    g.moveTo((ankle.x + pnx * ankleW) * s, (ankle.y + pny * ankleW) * s);
    g.lineTo((tipX + pnx * toeW) * s, (tipY + pny * toeW) * s);
    g.quadraticCurveTo(
      (tipX + fdx / flen * 1.5) * s, (tipY + fdy / flen) * s,
      (tipX - pnx * toeW) * s, (tipY - pny * toeW) * s,
    );
    g.lineTo((ankle.x - pnx * ankleW) * s, (ankle.y - pny * ankleW) * s);
    g.closePath();
    g.fill(color);
    g.moveTo((ankle.x + pnx * ankleW) * s, (ankle.y + pny * ankleW) * s);
    g.lineTo((tipX + pnx * toeW) * s, (tipY + pny * toeW) * s);
    g.quadraticCurveTo(
      (tipX + fdx / flen * 1.5) * s, (tipY + fdy / flen) * s,
      (tipX - pnx * toeW) * s, (tipY - pny * toeW) * s,
    );
    g.lineTo((ankle.x - pnx * ankleW) * s, (ankle.y - pny * ankleW) * s);
    g.closePath();
    g.stroke({ width: s * 0.4, color: p.outline, alpha: 0.35 });

    // Foot ring dots
    for (let i = 0; i < 2; i++) {
      const t = (i + 1) / 3;
      g.circle((ankle.x + fdx * t) * s, (ankle.y + fdy * t) * s, 0.42 * s);
      g.stroke({ width: s * 0.2, color: bodyLt, alpha: 0.25 });
    }
  }

  getAttachmentPoints(): Record<string, AttachmentPoint> { return {}; }
}
