import type { Graphics } from "pixi.js";
import type { Model, RenderContext, DrawCall, AttachmentPoint, V } from "../types";
import { DEPTH_FAR_LIMB } from "../types";
import { darken } from "../palette";

/**
 * Plate boots — heavy armored sabatons with articulated toe plates.
 */
export class BootsPlate implements Model {
  readonly id = "boots-plate";
  readonly name = "Plate Sabatons";
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

    // Armored shin guard (extends up)
    const shaftTopY = ankle.y - 4 * sz;
    const shaftTopX = ankle.x + (knee.x - ankle.x) * 0.25;
    g.roundRect((shaftTopX - 3.2 * sz) * s, shaftTopY * s, 6.4 * sz * s, (ankle.y - shaftTopY + 1.5) * s, 1.5 * s);
    g.fill(color);
    g.roundRect((shaftTopX - 3.2) * s, shaftTopY * s, 6.4 * s, (ankle.y - shaftTopY + 1.5) * s, 1.5 * s);
    g.stroke({ width: s * 0.5, color: p.outline, alpha: 0.4 });

    // Highlight ridge
    g.moveTo(shaftTopX * s, (shaftTopY + 1) * s);
    g.lineTo(ankle.x * s, (ankle.y - 0.5) * s);
    g.stroke({ width: s * 0.5, color: bodyLt, alpha: 0.2 });

    // Top flare
    g.ellipse(shaftTopX * s, shaftTopY * s, 3.5 * s, 1.3 * s);
    g.fill(bodyLt);
    g.ellipse(shaftTopX * s, shaftTopY * s, 3.5 * s, 1.3 * s);
    g.stroke({ width: s * 0.3, color: p.outline, alpha: 0.3 });

    // Articulation line
    const midY = (shaftTopY + ankle.y) / 2;
    g.moveTo((shaftTopX - 2.5) * s, midY * s);
    g.lineTo((shaftTopX + 2.5) * s, midY * s);
    g.stroke({ width: s * 0.4, color: p.outline, alpha: 0.3 });

    // Heavy armored foot
    const footLen = 5 * sz;
    const fwdX = iso.x * footLen;
    const fwdY = iso.y * footLen * 0.5;
    const tipX = ankle.x + fwdX;
    const tipY = ankle.y + fwdY + 2;

    const fdx = tipX - ankle.x;
    const fdy = tipY - ankle.y;
    const flen = Math.sqrt(fdx * fdx + fdy * fdy) || 1;
    const pnx = -fdy / flen;
    const pny = fdx / flen;
    const hw = 3 * sz; // wider
    const tw = 1.8 * sz;

    g.moveTo((ankle.x + pnx * hw) * s, (ankle.y + pny * hw) * s);
    g.lineTo((tipX + pnx * tw) * s, (tipY + pny * tw) * s);
    g.quadraticCurveTo(
      (tipX + fdx / flen * 2) * s, (tipY + fdy / flen * 1.2) * s,
      (tipX - pnx * tw) * s, (tipY - pny * tw) * s
    );
    g.lineTo((ankle.x - pnx * hw) * s, (ankle.y - pny * hw) * s);
    g.closePath();
    g.fill(color);
    g.moveTo((ankle.x + pnx * hw) * s, (ankle.y + pny * hw) * s);
    g.lineTo((tipX + pnx * tw) * s, (tipY + pny * tw) * s);
    g.quadraticCurveTo(
      (tipX + fdx / flen * 2) * s, (tipY + fdy / flen * 1.2) * s,
      (tipX - pnx * tw) * s, (tipY - pny * tw) * s
    );
    g.lineTo((ankle.x - pnx * hw) * s, (ankle.y - pny * hw) * s);
    g.closePath();
    g.stroke({ width: s * 0.5, color: p.outline, alpha: 0.4 });

    // Toe plate articulation lines
    for (let i = 1; i <= 2; i++) {
      const t = i / 3;
      const lx = ankle.x + fdx * t;
      const ly = ankle.y + fdy * t;
      const lw = hw + (tw - hw) * t;
      g.moveTo((lx + pnx * lw) * s, (ly + pny * lw) * s);
      g.lineTo((lx - pnx * lw) * s, (ly - pny * lw) * s);
      g.stroke({ width: s * 0.4, color: p.outline, alpha: 0.3 });
    }

    // Sole (thick)
    g.moveTo((ankle.x - pnx * hw) * s, (ankle.y - pny * hw) * s);
    g.lineTo((tipX - pnx * tw) * s, (tipY - pny * tw) * s);
    g.stroke({ width: s * 0.8, color: p.bodyDk, alpha: 0.5 });
  }

  getAttachmentPoints(): Record<string, AttachmentPoint> { return {}; }
}
