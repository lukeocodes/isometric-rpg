import type { Graphics } from "pixi.js";
import type { Model, RenderContext, DrawCall, AttachmentPoint, V } from "../types";
import { DEPTH_FAR_LIMB } from "../types";
import { darken } from "../palette";

/**
 * Mail boots — chain mail sabatons with leather sole.
 */
export class BootsMail implements Model {
  readonly id = "boots-mail";
  readonly name = "Mail Sabatons";
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
    const bodyLt = isNear ? p.bodyLt : darken(p.bodyLt, 0.1);

    // Mail shaft (shorter than leather, to the ankle)
    const shaftTopY = ankle.y - 3.5 * sz;
    const shaftTopX = ankle.x + (knee.x - ankle.x) * 0.2;
    g.roundRect((shaftTopX - 3 * sz) * s, shaftTopY * s, 6 * sz * s, (ankle.y - shaftTopY + 1) * s, 1 * s);
    g.fill(color);
    g.roundRect((shaftTopX - 3) * s, shaftTopY * s, 6 * s, (ankle.y - shaftTopY + 1) * s, 1 * s);
    g.stroke({ width: s * 0.4, color: p.outline, alpha: 0.35 });

    // Ring pattern on shaft
    for (let row = 0; row < 2; row++) {
      const ry = shaftTopY + 1 + row * 2;
      for (let col = 0; col < 3; col++) {
        const rx = shaftTopX - 1.5 + col * 1.5;
        g.circle(rx * s, ry * s, 0.4 * s);
        g.stroke({ width: s * 0.2, color: bodyLt, alpha: 0.3 });
      }
    }

    // Top rim
    g.ellipse(shaftTopX * s, shaftTopY * s, 3.2 * s, 1 * s);
    g.fill(p.accent);

    // Foot
    const footLen = 4.3 * sz;
    const fwdX = iso.x * footLen;
    const fwdY = iso.y * footLen * 0.5;
    const tipX = ankle.x + fwdX;
    const tipY = ankle.y + fwdY + 1.6;

    const fdx = tipX - ankle.x;
    const fdy = tipY - ankle.y;
    const flen = Math.sqrt(fdx * fdx + fdy * fdy) || 1;
    const pnx = -fdy / flen;
    const pny = fdx / flen;
    const hw = 2.3 * sz;
    const tw = 1.4 * sz;

    g.moveTo((ankle.x + pnx * hw) * s, (ankle.y + pny * hw) * s);
    g.lineTo((tipX + pnx * tw) * s, (tipY + pny * tw) * s);
    g.quadraticCurveTo(
      (tipX + fdx / flen * 1.5) * s, (tipY + fdy / flen * 1) * s,
      (tipX - pnx * tw) * s, (tipY - pny * tw) * s
    );
    g.lineTo((ankle.x - pnx * hw) * s, (ankle.y - pny * hw) * s);
    g.closePath();
    g.fill(color);
    g.moveTo((ankle.x + pnx * hw) * s, (ankle.y + pny * hw) * s);
    g.lineTo((tipX + pnx * tw) * s, (tipY + pny * tw) * s);
    g.quadraticCurveTo(
      (tipX + fdx / flen * 1.5) * s, (tipY + fdy / flen * 1) * s,
      (tipX - pnx * tw) * s, (tipY - pny * tw) * s
    );
    g.lineTo((ankle.x - pnx * hw) * s, (ankle.y - pny * hw) * s);
    g.closePath();
    g.stroke({ width: s * 0.4, color: p.outline, alpha: 0.35 });

    // Foot ring pattern
    for (let i = 0; i < 2; i++) {
      const t = (i + 1) / 3;
      const fx = ankle.x + fdx * t;
      const fy = ankle.y + fdy * t;
      g.circle(fx * s, fy * s, 0.4 * s);
      g.stroke({ width: s * 0.2, color: bodyLt, alpha: 0.25 });
    }
  }

  getAttachmentPoints(): Record<string, AttachmentPoint> { return {}; }
}
