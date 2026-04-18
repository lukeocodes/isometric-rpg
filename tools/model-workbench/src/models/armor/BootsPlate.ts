import type { Graphics } from "pixi.js";
import type { Model, RenderContext, DrawCall, AttachmentPoint, V, FitmentCorners } from "../types";
import { DEPTH_FAR_LIMB } from "../types";
import { darken } from "../palette";

/**
 * Plate Sabatons — heavy articulated foot armour with armoured shaft and toe plates.
 *
 * Draws BOTH feet (far + near) in one invocation. Attach to feet-L ONLY in config.
 */
export class BootsPlate implements Model {
  readonly id = "boots-plate";
  readonly name = "Plate Sabatons";
  readonly category = "feet" as const;
  readonly slot = "feet-L" as const;

  getDrawCalls(ctx: RenderContext): DrawCall[] {
    const { skeleton, palette, farSide, nearSide, fitmentCorners } = ctx;
    const j   = skeleton.joints;
    const iso = skeleton.iso;
    const sz  = ctx.slotParams.size;

    const ankleW = fitmentCorners
      ? Math.abs(fitmentCorners.tr.x - fitmentCorners.tl.x) * 0.95
      : 3 * sz;
    const footLen = fitmentCorners
      ? Math.sqrt(
          Math.pow(fitmentCorners.bl.x - fitmentCorners.tl.x, 2) +
          Math.pow(fitmentCorners.bl.y - fitmentCorners.tl.y, 2),
        ) * 1.4
      : 5 * sz;

    return [
      {
        depth: DEPTH_FAR_LIMB + 3,
        draw: (g, s) => this.drawSabaton(g, j, iso, palette, s, farSide, sz, ankleW, footLen, false),
      },
      {
        depth: DEPTH_FAR_LIMB + 7,
        draw: (g, s) => this.drawSabaton(g, j, iso, palette, s, nearSide, sz, ankleW, footLen, true),
      },
    ];
  }

  private drawSabaton(
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
    const toeW   = ankleW * 0.58;
    const color  = isNear ? p.body   : darken(p.body, 0.1);
    const bodyLt = isNear ? p.bodyLt : darken(p.bodyLt, 0.1);

    // Armoured shaft — goes up toward knee (35% of ankle-knee distance)
    const shaftFrac = 0.35;
    const shaftTopX = ankle.x + (knee.x - ankle.x) * shaftFrac;
    const shaftTopY = ankle.y + (knee.y - ankle.y) * shaftFrac;
    const shaftW    = ankleW * 1.05;

    g.roundRect(
      (Math.min(shaftTopX, ankle.x) - shaftW * 0.5) * s,
      shaftTopY * s,
      shaftW * s,
      (ankle.y - shaftTopY + 1.5) * s,
      1.5 * s,
    );
    g.fill(color);
    g.roundRect(
      (Math.min(shaftTopX, ankle.x) - shaftW * 0.5) * s,
      shaftTopY * s,
      shaftW * s,
      (ankle.y - shaftTopY + 1.5) * s,
      1.5 * s,
    );
    g.stroke({ width: s * 0.5, color: p.outline, alpha: 0.4 });

    // Highlight ridge on shaft
    g.moveTo(shaftTopX * s, (shaftTopY + 1) * s);
    g.lineTo(ankle.x * s, (ankle.y - 0.5) * s);
    g.stroke({ width: s * 0.5, color: bodyLt, alpha: 0.2 });

    // Articulation line across shaft
    const midY = (shaftTopY + ankle.y) / 2;
    g.moveTo((shaftTopX - shaftW * 0.45) * s, midY * s);
    g.lineTo((shaftTopX + shaftW * 0.45) * s, midY * s);
    g.stroke({ width: s * 0.4, color: p.outline, alpha: 0.28 });

    // Top flare
    g.ellipse(shaftTopX * s, shaftTopY * s, shaftW * s, shaftW * 0.4 * s);
    g.fill(bodyLt);
    g.ellipse(shaftTopX * s, shaftTopY * s, shaftW * s, shaftW * 0.4 * s);
    g.stroke({ width: s * 0.3, color: p.outline, alpha: 0.3 });

    // Foot — wider and heavier than leather
    const fwdX = iso.x * footLen;
    const fwdY = iso.y * footLen * 0.5;
    const tipX = ankle.x + fwdX;
    const tipY = ankle.y + fwdY + 2;
    const fdx  = tipX - ankle.x;
    const fdy  = tipY - ankle.y;
    const flen = Math.sqrt(fdx * fdx + fdy * fdy) || 1;
    const pnx  = -fdy / flen;
    const pny  =  fdx / flen;

    g.moveTo((ankle.x + pnx * ankleW) * s, (ankle.y + pny * ankleW) * s);
    g.lineTo((tipX + pnx * toeW) * s, (tipY + pny * toeW) * s);
    g.quadraticCurveTo(
      (tipX + fdx / flen * 2) * s, (tipY + fdy / flen * 1.2) * s,
      (tipX - pnx * toeW) * s, (tipY - pny * toeW) * s,
    );
    g.lineTo((ankle.x - pnx * ankleW) * s, (ankle.y - pny * ankleW) * s);
    g.closePath();
    g.fill(color);
    g.moveTo((ankle.x + pnx * ankleW) * s, (ankle.y + pny * ankleW) * s);
    g.lineTo((tipX + pnx * toeW) * s, (tipY + pny * toeW) * s);
    g.quadraticCurveTo(
      (tipX + fdx / flen * 2) * s, (tipY + fdy / flen * 1.2) * s,
      (tipX - pnx * toeW) * s, (tipY - pny * toeW) * s,
    );
    g.lineTo((ankle.x - pnx * ankleW) * s, (ankle.y - pny * ankleW) * s);
    g.closePath();
    g.stroke({ width: s * 0.5, color: p.outline, alpha: 0.4 });

    // Toe plate articulation lines
    for (let i = 1; i <= 2; i++) {
      const t  = i / 3;
      const lx = ankle.x + fdx * t;
      const ly = ankle.y + fdy * t;
      const lw = ankleW + (toeW - ankleW) * t;
      g.moveTo((lx + pnx * lw) * s, (ly + pny * lw) * s);
      g.lineTo((lx - pnx * lw) * s, (ly - pny * lw) * s);
      g.stroke({ width: s * 0.4, color: p.outline, alpha: 0.28 });
    }

    // Sole
    g.moveTo((ankle.x - pnx * ankleW) * s, (ankle.y - pny * ankleW) * s);
    g.lineTo((tipX - pnx * toeW) * s, (tipY - pny * toeW) * s);
    g.stroke({ width: s * 0.8, color: p.bodyDk, alpha: 0.5 });
  }

  getAttachmentPoints(): Record<string, AttachmentPoint> { return {}; }
}
