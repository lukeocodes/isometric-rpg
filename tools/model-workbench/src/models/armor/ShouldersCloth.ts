import type { Graphics } from "pixi.js";
import type { Model, RenderContext, DrawCall, AttachmentPoint } from "../types";
import { DEPTH_FAR_LIMB, DEPTH_BODY } from "../types";
import { darken } from "../palette";

/**
 * Cloth Mantle — wide shoulder drape that hangs from the shoulders
 * to just past the elbows, with a yoke connecting both sides.
 */
export class ShouldersCloth implements Model {
  readonly id = "shoulders-cloth";
  readonly name = "Cloth Mantle";
  readonly category = "shoulders" as const;
  readonly slot = "shoulders" as const;

  getDrawCalls(ctx: RenderContext): DrawCall[] {
    const { skeleton, palette, farSide, nearSide, facingCamera } = ctx;
    const j = skeleton.joints;
    const sz = ctx.slotParams.size;
    const wf = skeleton.wf;
    const calls: DrawCall[] = [];

    // Far side drape — behind body when facingCamera, in front when !facingCamera
    calls.push({
      depth: facingCamera ? DEPTH_FAR_LIMB + 8 : DEPTH_BODY + 3,
      draw: (g, s) => this.drawDrape(g, j, palette, s, farSide, sz, wf, false),
    });

    // Yoke connecting panel — center stays at body level
    calls.push({
      depth: DEPTH_BODY + 3,
      draw: (g, s) => {
        const sL = j.shoulderL;
        const sR = j.shoulderR;
        const neck = j.neckBase;
        const dropY = neck.y + 5 * sz;

        // Horizontal yoke from shoulder to shoulder
        g.moveTo((sL.x - 2 * sz * wf) * s, sL.y * s);
        g.quadraticCurveTo(neck.x * s, (neck.y + 1) * s, (sR.x + 2 * sz * wf) * s, sR.y * s);
        g.lineTo((sR.x + 1 * sz * wf) * s, dropY * s);
        g.quadraticCurveTo(neck.x * s, (dropY + 1) * s, (sL.x - 1 * sz * wf) * s, dropY * s);
        g.closePath();
        g.fill(palette.body);
        g.stroke({ width: s * 0.4, color: palette.bodyDk, alpha: 0.3 });
      },
    });

    // Near side drape — in front of body when facingCamera, behind when !facingCamera
    calls.push({
      depth: facingCamera ? DEPTH_BODY + 3 : DEPTH_FAR_LIMB + 8,
      draw: (g, s) => this.drawDrape(g, j, palette, s, nearSide, sz, wf, true),
    });

    return calls;
  }

  private drawDrape(
    g: Graphics,
    j: Record<string, any>,
    p: any,
    s: number,
    side: "L" | "R",
    sz: number,
    wf: number,
    isNear: boolean
  ): void {
    const shoulder = j[`shoulder${side}`];
    const sign     = side === "L" ? -1 : 1;

    // Near drape uses base body color; far drape is darkened 10%
    const fillColor = isNear ? p.body : darken(p.body, 0.1);

    // Drape covers shoulders only — hem sits just below the deltoid
    const outerX  = shoulder.x + sign * 5 * sz * wf;
    const hemY    = shoulder.y + 5 * sz;
    const innerX  = shoulder.x + sign * 1.5 * sz * wf;

    g.moveTo(shoulder.x * s, shoulder.y * s);
    g.quadraticCurveTo(
      outerX * s, (shoulder.y + 1) * s,
      outerX * s, (shoulder.y + (hemY - shoulder.y) * 0.5) * s
    );
    g.quadraticCurveTo(
      outerX * s, hemY * s,
      (shoulder.x + sign * 2 * sz * wf) * s, hemY * s
    );
    g.lineTo(innerX * s, (shoulder.y + 4 * sz) * s);
    g.closePath();
    g.fill(fillColor);

    // Hem edge
    g.moveTo(outerX * s, (shoulder.y + (hemY - shoulder.y) * 0.6) * s);
    g.quadraticCurveTo(
      outerX * s, hemY * s,
      (shoulder.x + sign * 2 * sz * wf) * s, hemY * s
    );
    g.stroke({ width: s * 0.7, color: p.accent, alpha: 0.6 });

    // Fold crease
    g.moveTo(shoulder.x * s, (shoulder.y + 2) * s);
    g.quadraticCurveTo(
      (shoulder.x + sign * 2 * sz * wf) * s, (shoulder.y + 3) * s,
      innerX * s, (shoulder.y + 5 * sz) * s
    );
    g.stroke({ width: s * 0.4, color: p.bodyDk, alpha: 0.25 });
  }

  getAttachmentPoints(): Record<string, AttachmentPoint> { return {}; }
}
