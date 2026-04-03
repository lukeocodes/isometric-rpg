import type { Graphics } from "pixi.js";
import type { Model, RenderContext, DrawCall, AttachmentPoint, V } from "../types";
import { DEPTH_FAR_LIMB } from "../types";
import { darken } from "../palette";

/**
 * Leather boots — sturdy mid-calf boots with buckle straps.
 */
export class BootsLeather implements Model {
  readonly id = "boots-leather";
  readonly name = "Leather Boots";
  readonly category = "feet" as const;
  readonly slot = "feet-L" as const;

  getDrawCalls(ctx: RenderContext): DrawCall[] {
    const { skeleton, palette, farSide, nearSide } = ctx;
    const j = skeleton.joints;
    const iso = skeleton.iso;
    const calls: DrawCall[] = [];

    const sz = ctx.slotParams.size;
    // Far boot darkened, near boot base color
    calls.push({ depth: DEPTH_FAR_LIMB + 3, draw: (g, s) => this.drawBoot(g, j, iso, palette, s, farSide, sz, false) });
    calls.push({ depth: DEPTH_FAR_LIMB + 7, draw: (g, s) => this.drawBoot(g, j, iso, palette, s, nearSide, sz, true) });
    return calls;
  }

  private drawBoot(
    g: Graphics,
    j: Record<string, V>,
    iso: V,
    p: any,
    s: number,
    side: "L" | "R",
    sz = 1,
    isNear = false
  ): void {
    const ankle = j[`ankle${side}`];
    const knee = j[`knee${side}`];

    // Near boot uses base color, far boot darkened 10%
    const color = isNear ? p.body : darken(p.body, 0.1);
    const dk = isNear ? p.bodyDk : darken(p.bodyDk, 0.1);
    const accent = isNear ? p.accent : darken(p.accent, 0.1);

    // Boot shaft (extends up the calf)
    const shaftTopY = ankle.y - 5 * sz;
    const shaftTopX = ankle.x + (knee.x - ankle.x) * 0.3;
    g.roundRect((shaftTopX - 3 * sz) * s, shaftTopY * s, 6 * sz * s, (ankle.y - shaftTopY + 1) * s, 1 * s);
    g.fill(color);
    g.roundRect((shaftTopX - 3) * s, shaftTopY * s, 6 * s, (ankle.y - shaftTopY + 1) * s, 1 * s);
    g.stroke({ width: s * 0.4, color: p.outline, alpha: 0.35 });

    // Boot top fold
    g.ellipse(shaftTopX * s, shaftTopY * s, 3.2 * s, 1.2 * s);
    g.fill(dk);

    // Buckle strap
    const strapY = shaftTopY + 3;
    g.rect((shaftTopX - 2.8) * s, (strapY - 0.5) * s, 5.6 * s, 1.2 * s);
    g.fill(accent);
    // Buckle
    g.rect((shaftTopX + 1) * s, (strapY - 0.7) * s, 1.5 * s, 1.5 * s);
    g.fill(p.accentDk);

    // Foot
    const footLen = 4.5 * sz;
    const fwdX = iso.x * footLen;
    const fwdY = iso.y * footLen * 0.5;
    const tipX = ankle.x + fwdX;
    const tipY = ankle.y + fwdY + 1.8;

    const fdx = tipX - ankle.x;
    const fdy = tipY - ankle.y;
    const flen = Math.sqrt(fdx * fdx + fdy * fdy) || 1;
    const pnx = -fdy / flen;
    const pny = fdx / flen;
    const hw = 2.5 * sz;
    const tw = 1.5 * sz;

    g.moveTo((ankle.x + pnx * hw) * s, (ankle.y + pny * hw) * s);
    g.lineTo((tipX + pnx * tw) * s, (tipY + pny * tw) * s);
    g.quadraticCurveTo(
      (tipX + fdx / flen * 1.8) * s, (tipY + fdy / flen * 1.2) * s,
      (tipX - pnx * tw) * s, (tipY - pny * tw) * s
    );
    g.lineTo((ankle.x - pnx * hw) * s, (ankle.y - pny * hw) * s);
    g.closePath();
    g.fill(color);
    g.moveTo((ankle.x + pnx * hw) * s, (ankle.y + pny * hw) * s);
    g.lineTo((tipX + pnx * tw) * s, (tipY + pny * tw) * s);
    g.quadraticCurveTo(
      (tipX + fdx / flen * 1.8) * s, (tipY + fdy / flen * 1.2) * s,
      (tipX - pnx * tw) * s, (tipY - pny * tw) * s
    );
    g.lineTo((ankle.x - pnx * hw) * s, (ankle.y - pny * hw) * s);
    g.closePath();
    g.stroke({ width: s * 0.4, color: p.outline, alpha: 0.35 });

    // Sole line
    g.moveTo((ankle.x - pnx * hw) * s, (ankle.y - pny * hw) * s);
    g.lineTo((tipX - pnx * tw) * s, (tipY - pny * tw) * s);
    g.stroke({ width: s * 0.6, color: dk, alpha: 0.4 });
  }

  getAttachmentPoints(): Record<string, AttachmentPoint> { return {}; }
}
