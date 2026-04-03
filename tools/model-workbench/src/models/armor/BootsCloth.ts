import type { Graphics } from "pixi.js";
import type { Model, RenderContext, DrawCall, AttachmentPoint, V } from "../types";
import { DEPTH_FAR_LIMB } from "../types";
import { darken } from "../palette";

/**
 * Cloth boots — simple wrapped foot bindings/sandals.
 */
export class BootsCloth implements Model {
  readonly id = "boots-cloth";
  readonly name = "Cloth Wraps";
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

    // Near wrap uses base color, far wrap darkened 10%
    const color = isNear ? p.body : darken(p.body, 0.1);
    const dk = isNear ? p.bodyDk : darken(p.bodyDk, 0.1);

    const footLen = 4.2 * sz;
    const fwdX = iso.x * footLen;
    const fwdY = iso.y * footLen * 0.5;
    const tipX = ankle.x + fwdX;
    const tipY = ankle.y + fwdY + 1.5;

    const fdx = tipX - ankle.x;
    const fdy = tipY - ankle.y;
    const flen = Math.sqrt(fdx * fdx + fdy * fdy) || 1;
    const pnx = -fdy / flen;
    const pny = fdx / flen;
    const hw = 2.2 * sz;
    const tw = 1.4 * sz;

    // Boot shape
    g.moveTo((ankle.x + pnx * hw) * s, (ankle.y + pny * hw) * s);
    g.lineTo((tipX + pnx * tw) * s, (tipY + pny * tw) * s);
    g.quadraticCurveTo(
      (tipX + fdx / flen * 1.5) * s, (tipY + fdy / flen * 1) * s,
      (tipX - pnx * tw) * s, (tipY - pny * tw) * s
    );
    g.lineTo((ankle.x - pnx * hw) * s, (ankle.y - pny * hw) * s);
    g.closePath();
    g.fill(color);

    // Wrap bands
    for (let i = 0; i < 2; i++) {
      const t = (i + 1) / 3;
      const bx = ankle.x + fdx * t;
      const by = ankle.y + fdy * t;
      const bw = hw + (tw - hw) * t;
      g.moveTo((bx + pnx * bw) * s, (by + pny * bw) * s);
      g.lineTo((bx - pnx * bw) * s, (by - pny * bw) * s);
      g.stroke({ width: s * 0.6, color: dk, alpha: 0.35 });
    }

    // Ankle wrap
    g.ellipse(ankle.x * s, (ankle.y - 0.5) * s, 2.5 * s, 1.5 * s);
    g.fill(color);
    g.ellipse(ankle.x * s, (ankle.y - 0.5) * s, 2.5 * s, 1.5 * s);
    g.stroke({ width: s * 0.3, color: dk, alpha: 0.3 });
  }

  getAttachmentPoints(): Record<string, AttachmentPoint> { return {}; }
}
