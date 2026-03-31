import type { Graphics } from "pixi.js";
import type { Model, RenderContext, DrawCall, AttachmentPoint, V } from "../types";
import { DEPTH_SHADOW, DEPTH_FAR_LIMB, DEPTH_BODY, DEPTH_HEAD } from "../types";
import { darken, lighten } from "../palette";

/**
 * Bear NPC — large quadruped, distinctive shoulder hump.
 * Directional body shading, catch-lights in small dark eyes.
 */
export class BearBody implements Model {
  readonly id = "bear-body";
  readonly name = "Bear";
  readonly category = "npc" as const;
  readonly slot = "root" as const;

  private readonly FUR   = 0x6a5040;
  private readonly FUR_DK= 0x4a3020;
  private readonly FUR_LT= 0x8a7060;
  private readonly SNOUT = 0x9a8070;
  private readonly NOSE  = 0x1a1a1a;
  private readonly EYE   = 0x221100;

  getDrawCalls(ctx: RenderContext): DrawCall[] {
    const { skeleton } = ctx;
    const { iso, bob, walkPhase, wf } = skeleton;
    const faceCam  = iso.y > 0;
    const sideView = Math.abs(iso.x) > 0.3;
    const sideAmt  = Math.abs(iso.x);

    const lumber  = walkPhase !== 0 ? Math.sin(walkPhase) : 0;
    const bodyBob = walkPhase !== 0 ? Math.abs(Math.sin(walkPhase * 2)) * 2 : 0;
    const bodyRoll= walkPhase !== 0 ? Math.sin(walkPhase) * 0.8 : 0;

    const bodyX = iso.x * 2 + bodyRoll;
    const bodyY = -10 + bob - bodyBob;
    const headX = bodyX + iso.x * 12 + iso.y * 2;
    const headY = bodyY - 2;

    const calls: DrawCall[] = [];

    calls.push({ depth: DEPTH_SHADOW, draw: (g, s) => {
      g.ellipse(bodyX * s, 2 * s, 16 * s, 5.5 * s);
      g.fill({ color: 0x000000, alpha: 0.18 });
      g.ellipse(bodyX * s, 2 * s, 10 * s, 3 * s);
      g.fill({ color: 0x000000, alpha: 0.08 });
    }});

    // Stub tail
    calls.push({ depth: DEPTH_SHADOW + 3, draw: (g, s) => {
      const tx = bodyX - iso.x * 12, ty = bodyY - 3;
      g.circle(tx * s, ty * s, 2.5 * s); g.fill(this.FUR);
      g.circle(tx * s, ty * s, 2.5 * s); g.stroke({ width: s * 0.3, color: this.FUR_DK, alpha: 0.2 });
    }});

    calls.push({ depth: DEPTH_FAR_LIMB - 4, draw: (g, s) => this.drawBackLegs(g, bodyX, bodyY, iso, lumber, wf, s) });

    // Body with directional shading
    calls.push({ depth: DEPTH_BODY, draw: (g, s) => {
      g.ellipse(bodyX * s, bodyY * s, 15 * wf * s, 9 * s);
      g.fill(this.FUR);

      // Directional shadow on far side
      if (sideAmt > 0.1) {
        const shadowSide = iso.x >= 0 ? -1 : 1;
        g.ellipse((bodyX + shadowSide * 5 * wf * 0.7) * s, bodyY * s, 9 * wf * s, 8.5 * s);
        g.fill({ color: darken(this.FUR, 0.22), alpha: sideAmt * 0.45 });
      }

      if (faceCam) {
        g.ellipse(bodyX * s, (bodyY + 4) * s, 10 * wf * s, 5 * s);
        g.fill({ color: this.FUR_LT, alpha: 0.22 });
      }

      // Shoulder hump — more prominent
      g.ellipse((bodyX + iso.x * 4) * s, (bodyY - 4) * s, 8 * wf * s, 5 * s);
      g.fill(this.FUR);
      g.ellipse((bodyX + iso.x * 4) * s, (bodyY - 4) * s, 8 * wf * s, 5 * s);
      g.stroke({ width: s * 0.3, color: this.FUR_DK, alpha: 0.15 });

      // Fur texture lines
      for (let i = 0; i < 4; i++) {
        const fx = bodyX + (i - 1.5) * 4 * wf;
        g.moveTo(fx * s, (bodyY - 5) * s);
        g.quadraticCurveTo((fx + 0.5) * s, bodyY * s, (fx - 0.3) * s, (bodyY + 4) * s);
        g.stroke({ width: s * 0.3, color: this.FUR_DK, alpha: 0.07 });
      }

      g.ellipse(bodyX * s, bodyY * s, 15 * wf * s, 9 * s);
      g.stroke({ width: s * 0.5, color: this.FUR_DK, alpha: 0.3 });
    }});

    calls.push({ depth: DEPTH_BODY + 5, draw: (g, s) => this.drawFrontLegs(g, bodyX, bodyY, iso, lumber, wf, s) });

    // Head
    calls.push({ depth: DEPTH_HEAD, draw: (g, s) => {
      const neckMidX = (bodyX + headX) / 2 + iso.x * 2;
      const neckMidY = (bodyY + headY) / 2;

      // Neck
      g.moveTo((bodyX + iso.x * 8) * s, (bodyY - 5) * s);
      g.quadraticCurveTo(neckMidX * s, (neckMidY - 3) * s, headX * s, (headY + 3) * s);
      g.quadraticCurveTo(neckMidX * s, (neckMidY + 4) * s, (bodyX + iso.x * 8) * s, (bodyY + 2) * s);
      g.closePath(); g.fill(this.FUR);

      const hW = 8 * wf, hH = 6.5;
      g.ellipse(headX * s, headY * s, hW * s, hH * s);
      g.fill(this.FUR);

      // Directional head shading
      if (sideAmt > 0.1) {
        const shadowSide = iso.x >= 0 ? -1 : 1;
        g.ellipse((headX + shadowSide * hW * 0.45) * s, headY * s, hW * 0.62 * s, hH * 0.88 * s);
        g.fill({ color: darken(this.FUR, 0.2), alpha: sideAmt * 0.38 });
      }

      // Muzzle
      const muzzleX = headX + iso.x * 5 + iso.y * 1.5;
      const muzzleY = headY + 2;
      g.ellipse(muzzleX * s, muzzleY * s, 4.5 * wf * s, 3.5 * s);
      g.fill(this.SNOUT);
      g.ellipse(muzzleX * s, muzzleY * s, 4.5 * wf * s, 3.5 * s);
      g.stroke({ width: s * 0.4, color: this.FUR_DK, alpha: 0.25 });

      g.ellipse(headX * s, headY * s, hW * s, hH * s);
      g.stroke({ width: s * 0.5, color: this.FUR_DK, alpha: 0.3 });

      this.drawEars(g, headX, headY, iso, wf, hH, s);

      if (faceCam || (sideView && iso.y >= -0.1)) {
        const spread = 3 * wf;
        const eyeY  = headY - 0.5 + iso.y * 0.3;
        const eyeOX = headX + iso.x * 2;

        g.circle((eyeOX - spread) * s, eyeY * s, 1.3 * s); g.fill(this.EYE);
        g.circle((eyeOX + spread) * s, eyeY * s, 1.3 * s); g.fill(this.EYE);

        // Catch-lights (bigger relative to dark eyes)
        const pX = iso.x * 0.4;
        g.circle((eyeOX - spread + pX + 0.35) * s, (eyeY - 0.3) * s, 0.42 * s); g.fill({ color: 0xffffff, alpha: 0.65 });
        g.circle((eyeOX + spread + pX + 0.35) * s, (eyeY - 0.3) * s, 0.42 * s); g.fill({ color: 0xffffff, alpha: 0.65 });
      }

      if (faceCam || sideView) {
        const noseX = muzzleX + iso.x * 2.5;
        const noseY = muzzleY - 0.8;
        g.ellipse(noseX * s, noseY * s, 1.8 * wf * s, 1.2 * s); g.fill(this.NOSE);
        // Nose highlight
        g.ellipse((noseX + iso.x * 0.3 + 0.3) * s, (noseY - 0.3) * s, 0.6 * s, 0.4 * s);
        g.fill({ color: 0x553322, alpha: 0.4 });
      }

      if (faceCam) {
        g.moveTo((muzzleX - 2 * wf) * s, (muzzleY + 1.5) * s);
        g.quadraticCurveTo(muzzleX * s, (muzzleY + 2.2) * s, (muzzleX + 2 * wf) * s, (muzzleY + 1.5) * s);
        g.stroke({ width: s * 0.5, color: this.FUR_DK, alpha: 0.35 });
      }
    }});

    return calls;
  }

  getAttachmentPoints(): Record<string, AttachmentPoint> { return {}; }

  private drawEars(g: Graphics, headX: number, headY: number, iso: V, wf: number, headH: number, s: number): void {
    for (const side of [-1, 1]) {
      const isNear = side === 1 ? iso.x >= 0 : iso.x < 0;
      const furC   = isNear ? this.FUR : darken(this.FUR, 0.1);
      const earX   = headX + side * 4.5 * wf + iso.x * 1;
      const earY   = headY - headH + 1;

      g.circle(earX * s, earY * s, 2.2 * s); g.fill(furC);
      g.circle(earX * s, earY * s, 1.3 * s); g.fill(darken(furC, 0.1));
      g.circle(earX * s, earY * s, 2.2 * s); g.stroke({ width: s * 0.28, color: this.FUR_DK, alpha: 0.22 });
    }
  }

  private drawFrontLegs(g: Graphics, bodyX: number, bodyY: number, iso: V, lumber: number, wf: number, s: number): void {
    for (const side of [-1, 1]) {
      const isNear = side === 1 ? iso.x >= 0 : iso.x < 0;
      const furC   = isNear ? this.FUR : darken(this.FUR, 0.1);
      const legX   = bodyX + side * 6 * wf + iso.x * 7;
      const shoulderY = bodyY + 3;
      const stride = lumber * side * 2.5;
      const kneeX  = legX + iso.x * stride * 0.3, kneeY = shoulderY + 7;

      g.moveTo(legX * s, shoulderY * s); g.lineTo(kneeX * s, kneeY * s);
      g.stroke({ width: s * 5, color: furC });

      const pawX = kneeX + iso.x * stride * 0.4;
      const pawY = kneeY + 5 - Math.abs(lumber * side) * 1;
      g.moveTo(kneeX * s, kneeY * s); g.lineTo(pawX * s, pawY * s);
      g.stroke({ width: s * 4, color: furC });

      g.ellipse(pawX * s, (pawY + 0.8) * s, 3 * s, 1.5 * s); g.fill(darken(furC, 0.1));

      for (let c = -1; c <= 1; c++) {
        g.moveTo((pawX + c * 1.2 + iso.x * 1) * s, (pawY + 1) * s);
        g.lineTo((pawX + c * 1.2 + iso.x * 1.8) * s, (pawY + 2) * s);
        g.stroke({ width: s * 0.5, color: 0x333322 });
      }
    }
  }

  private drawBackLegs(g: Graphics, bodyX: number, bodyY: number, iso: V, lumber: number, wf: number, s: number): void {
    for (const side of [-1, 1]) {
      const isNear = side === 1 ? iso.x >= 0 : iso.x < 0;
      const furC   = isNear ? this.FUR : darken(this.FUR, 0.1);
      const legX   = bodyX + side * 6 * wf - iso.x * 7;
      const hipY   = bodyY + 3;
      const stride = -lumber * side * 2.5;

      g.ellipse((legX + side * 2 * wf) * s, (hipY + 1) * s, 5.5 * wf * s, 5.5 * s);
      g.fill(furC);

      const kneeX = legX + iso.x * stride * 0.3, kneeY = hipY + 7;
      g.moveTo(legX * s, (hipY + 4) * s); g.lineTo(kneeX * s, kneeY * s);
      g.stroke({ width: s * 5, color: furC });

      const hockX = kneeX - iso.x * 0.8, hockY = kneeY + 3;
      g.moveTo(kneeX * s, kneeY * s); g.lineTo(hockX * s, hockY * s);
      g.stroke({ width: s * 4, color: furC });

      const pawX = hockX + iso.x * stride * 0.3;
      const pawY = hockY + 3 - Math.abs(lumber * side) * 1.5;
      g.moveTo(hockX * s, hockY * s); g.lineTo(pawX * s, pawY * s);
      g.stroke({ width: s * 3.5, color: furC });

      g.ellipse(pawX * s, (pawY + 0.8) * s, 3 * s, 1.5 * s); g.fill(darken(furC, 0.1));

      for (let c = -1; c <= 1; c++) {
        g.moveTo((pawX + c * 1.2 + iso.x * 0.8) * s, (pawY + 1) * s);
        g.lineTo((pawX + c * 1.2 + iso.x * 1.6) * s, (pawY + 2) * s);
        g.stroke({ width: s * 0.5, color: 0x333322 });
      }
    }
  }
}
