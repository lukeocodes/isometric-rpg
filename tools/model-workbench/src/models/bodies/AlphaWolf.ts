import type { Graphics } from "pixi.js";
import type { Model, RenderContext, DrawCall, AttachmentPoint, V } from "../types";
import { DEPTH_SHADOW, DEPTH_FAR_LIMB, DEPTH_BODY, DEPTH_HEAD } from "../types";
import { darken, lighten } from "../palette";

/**
 * Alpha Wolf — boss wolf. Darker, scarred, fierce glowing amber eyes with catch-lights.
 * Directional body shading, near/far fur toning.
 */
export class AlphaWolf implements Model {
  readonly id = "alpha-wolf";
  readonly name = "Alpha Wolf";
  readonly category = "npc" as const;
  readonly slot = "root" as const;

  private readonly FUR    = 0x404850;
  private readonly FUR_DK = 0x282e38;
  private readonly FUR_LT = 0x606870;
  private readonly BELLY  = 0x707880;
  private readonly NOSE   = 0x111111;
  private readonly EYE    = 0xffaa22;
  private readonly SCAR   = 0x884444;

  getDrawCalls(ctx: RenderContext): DrawCall[] {
    const { skeleton } = ctx;
    const { iso, bob, walkPhase, wf } = skeleton;
    const faceCam  = iso.y > 0;
    const sideView = Math.abs(iso.x) > 0.3;
    const sideAmt  = Math.abs(iso.x);
    const SC       = 1.3;

    const trot    = walkPhase !== 0 ? Math.sin(walkPhase) : 0;
    const bodyBob = walkPhase !== 0 ? Math.abs(Math.sin(walkPhase * 2)) * 1.5 : 0;

    const bodyX = iso.x * 2;
    const bodyY = -10 * SC + bob - bodyBob;
    const headX = bodyX + iso.x * 10 * SC + iso.y * 2;
    const headY = bodyY - 4 * SC;

    const calls: DrawCall[] = [];

    calls.push({ depth: DEPTH_SHADOW - 1, draw: (g, s) => {
      g.ellipse(bodyX * s, (bodyY - 2) * s, 16 * SC * s, 14 * SC * s);
      g.fill({ color: 0x223344, alpha: 0.04 });
    }});

    calls.push({ depth: DEPTH_SHADOW, draw: (g, s) => {
      g.ellipse(bodyX * s, 2 * s, 14 * SC * s, 5 * SC * s);
      g.fill({ color: 0x000000, alpha: 0.18 });
    }});

    // Tail
    calls.push({ depth: DEPTH_SHADOW + 3, draw: (g, s) => {
      const sway     = walkPhase !== 0 ? Math.sin(walkPhase * 1.5) * 2 : 0;
      const tailBaseX = bodyX - iso.x * 10 * SC;
      const tailBaseY = bodyY - 2 * SC;
      const tailTipX  = tailBaseX - iso.x * 4 * SC + sway * 1.5;
      const tailTipY  = tailBaseY - 10 * SC;

      g.moveTo(tailBaseX * s, (tailBaseY - 2 * SC) * s);
      g.quadraticCurveTo((tailTipX - 3) * s, (tailTipY + 2) * s, tailTipX * s, tailTipY * s);
      g.quadraticCurveTo((tailTipX + 3) * s, (tailTipY + 2) * s, tailBaseX * s, (tailBaseY + 1 * SC) * s);
      g.closePath(); g.fill(this.FUR);
      g.ellipse(tailTipX * s, tailTipY * s, 2.5 * SC * s, 2 * SC * s);
      g.fill({ color: this.FUR_LT, alpha: 0.2 });
    }});

    calls.push({ depth: DEPTH_FAR_LIMB - 4, draw: (g, s) => this.drawLegs(g, bodyX, bodyY, iso, trot, wf, SC, s, false) });

    // Body with directional shading
    calls.push({ depth: DEPTH_BODY, draw: (g, s) => {
      g.ellipse(bodyX * s, bodyY * s, 15 * wf * SC * s, 9 * SC * s);
      g.fill(this.FUR);

      if (sideAmt > 0.1) {
        const shadowSide = iso.x >= 0 ? -1 : 1;
        g.ellipse((bodyX + shadowSide * 5 * wf * SC * 0.65) * s, bodyY * s, 9 * wf * SC * s, 8.5 * SC * s);
        g.fill({ color: darken(this.FUR, 0.22), alpha: sideAmt * 0.45 });
      }

      if (faceCam) {
        g.ellipse(bodyX * s, (bodyY + 3 * SC) * s, 10 * wf * SC * s, 5 * SC * s);
        g.fill({ color: this.BELLY, alpha: 0.28 });
      }

      // Shoulder hump
      g.ellipse((bodyX + iso.x * 3 * SC) * s, (bodyY - 3 * SC) * s, 7 * wf * SC * s, 5 * SC * s);
      g.fill(this.FUR);

      // Body scar
      g.moveTo((bodyX - 5 * SC) * s, (bodyY - 3 * SC) * s);
      g.quadraticCurveTo(bodyX * s, (bodyY - 1 * SC) * s, (bodyX + 6 * SC) * s, (bodyY - 4 * SC) * s);
      g.stroke({ width: s * 0.8, color: this.SCAR, alpha: 0.3 });

      g.ellipse(bodyX * s, bodyY * s, 15 * wf * SC * s, 9 * SC * s);
      g.stroke({ width: s * 0.6, color: this.FUR_DK, alpha: 0.35 });
    }});

    calls.push({ depth: DEPTH_BODY + 5, draw: (g, s) => this.drawLegs(g, bodyX, bodyY, iso, trot, wf, SC, s, true) });

    // Head
    calls.push({ depth: DEPTH_HEAD, draw: (g, s) => {
      const neckMidX = (bodyX + headX) / 2 + iso.x * 2;
      const neckMidY = (bodyY + headY) / 2;

      g.moveTo((bodyX + iso.x * 8 * SC) * s, (bodyY - 5 * SC) * s);
      g.quadraticCurveTo(neckMidX * s, (neckMidY - 3) * s, headX * s, (headY + 3 * SC) * s);
      g.quadraticCurveTo(neckMidX * s, (neckMidY + 4) * s, (bodyX + iso.x * 8 * SC) * s, (bodyY + 2 * SC) * s);
      g.closePath(); g.fill(this.FUR);

      // Mane ruff
      g.ellipse(neckMidX * s, (neckMidY - 1) * s, 5 * wf * SC * s, 4.5 * SC * s);
      g.fill({ color: this.FUR_LT, alpha: 0.15 });

      const hW = 8 * wf * SC, hH = 6.5 * SC;
      g.ellipse(headX * s, headY * s, hW * s, hH * s);
      g.fill(this.FUR);

      // Directional head shading
      if (sideAmt > 0.1) {
        const shadowSide = iso.x >= 0 ? -1 : 1;
        g.ellipse((headX + shadowSide * hW * 0.45) * s, headY * s, hW * 0.62 * s, hH * 0.88 * s);
        g.fill({ color: darken(this.FUR, 0.22), alpha: sideAmt * 0.4 });
      }

      // Snout
      const snoutX = headX + iso.x * 5 * SC + iso.y * 1.5;
      const snoutY = headY + 1.5 * SC;
      g.ellipse(snoutX * s, snoutY * s, 4 * wf * SC * s, 3 * SC * s);
      g.fill(this.FUR);

      // Face scar
      g.moveTo((headX - 3 * SC) * s, (headY - 2 * SC) * s);
      g.lineTo((headX + 2 * SC) * s, (headY + 1 * SC) * s);
      g.stroke({ width: s * 0.7, color: this.SCAR, alpha: 0.35 });

      g.ellipse(headX * s, headY * s, hW * s, hH * s);
      g.stroke({ width: s * 0.6, color: this.FUR_DK, alpha: 0.35 });

      // Ears
      for (const side of [-1, 1]) {
        const isNear  = side === 1 ? iso.x >= 0 : iso.x < 0;
        const furC    = isNear ? this.FUR : darken(this.FUR, 0.1);
        const earX    = headX + side * 4 * wf * SC + iso.x * 1;
        const earBaseY = headY - 4 * SC;
        const earTipY  = earBaseY - 5 * SC;
        g.poly([(earX - 1.5 * SC) * s, earBaseY * s, (earX + side * 0.5) * s, earTipY * s, (earX + 1.5 * SC) * s, earBaseY * s]);
        g.fill(furC);
        g.poly([(earX - 0.7 * SC) * s, (earBaseY + 0.3) * s, (earX + side * 0.3) * s, (earTipY + 1.5 * SC) * s, (earX + 0.7 * SC) * s, (earBaseY + 0.3) * s]);
        g.fill(darken(furC, 0.1));
      }

      // Eyes
      if (faceCam || (sideView && iso.y >= -0.1)) {
        const spread = 3 * wf * SC;
        const eyeY  = headY - 0.5 * SC + iso.y * 0.4;
        const eyeOX = headX + iso.x * 1.5 * SC;

        g.ellipse((eyeOX - spread) * s, eyeY * s, 2 * SC * s, 1.5 * SC * s); g.fill(this.EYE);
        g.ellipse((eyeOX + spread) * s, eyeY * s, 2 * SC * s, 1.5 * SC * s); g.fill(this.EYE);

        const iX = iso.x * 0.35;
        g.circle((eyeOX - spread + iX) * s, eyeY * s, 0.8 * SC * s); g.fill(0x111111);
        g.circle((eyeOX + spread + iX) * s, eyeY * s, 0.8 * SC * s); g.fill(0x111111);

        // Eye glow
        g.ellipse((eyeOX - spread) * s, eyeY * s, 3 * SC * s, 2.2 * SC * s); g.fill({ color: this.EYE, alpha: 0.1 });
        g.ellipse((eyeOX + spread) * s, eyeY * s, 3 * SC * s, 2.2 * SC * s); g.fill({ color: this.EYE, alpha: 0.1 });

        // Catch-lights
        const pX = iso.x * 0.45;
        g.circle((eyeOX - spread + pX + 0.45 * SC) * s, (eyeY - 0.3 * SC) * s, 0.32 * SC * s); g.fill({ color: 0xffffff, alpha: 0.72 });
        g.circle((eyeOX + spread + pX + 0.45 * SC) * s, (eyeY - 0.3 * SC) * s, 0.32 * SC * s); g.fill({ color: 0xffffff, alpha: 0.72 });
      }

      if (faceCam || sideView) {
        const noseX = snoutX + iso.x * 2.5 * SC;
        g.ellipse(noseX * s, (snoutY - 0.5) * s, 1.5 * wf * SC * s, 1 * SC * s); g.fill(this.NOSE);
      }

      // Bared teeth
      if (faceCam) {
        g.moveTo((snoutX - 2 * wf * SC) * s, (snoutY + 1.5 * SC) * s);
        g.quadraticCurveTo(snoutX * s, (snoutY + 2.5 * SC) * s, (snoutX + 2 * wf * SC) * s, (snoutY + 1.5 * SC) * s);
        g.stroke({ width: s * 0.6, color: this.FUR_DK, alpha: 0.4 });
        for (const side of [-0.8, 0.8]) {
          g.moveTo((snoutX + side * wf * SC) * s, (snoutY + 1.5 * SC) * s);
          g.lineTo((snoutX + side * wf * SC) * s, (snoutY + 2.5 * SC) * s);
          g.stroke({ width: s * 0.5, color: 0xeeddcc, alpha: 0.5 });
        }
      }
    }});

    return calls;
  }

  getAttachmentPoints(): Record<string, AttachmentPoint> { return {}; }

  private drawLegs(g: Graphics, bodyX: number, bodyY: number, iso: V, trot: number, wf: number, SC: number, s: number, front: boolean): void {
    for (const side of [-1, 1]) {
      const isNear = side === 1 ? iso.x >= 0 : iso.x < 0;
      const furC   = isNear ? this.FUR : darken(this.FUR, 0.1);
      const legX   = bodyX + side * 6 * wf * SC + iso.x * (front ? 7 : -7) * SC;
      const topY   = bodyY + 3 * SC;
      const stride = (front ? 1 : -1) * trot * side * 3 * SC;

      if (!front) {
        g.ellipse((legX + side * 2 * wf * SC) * s, (topY + 1 * SC) * s, 5.5 * wf * SC * s, 5.5 * SC * s);
        g.fill(furC);
      }

      const kneeX = legX + iso.x * stride * 0.3, kneeY = topY + 7 * SC;
      g.moveTo(legX * s, (topY + (front ? 0 : 4 * SC)) * s);
      g.lineTo(kneeX * s, kneeY * s);
      g.stroke({ width: s * (front ? 4 : 4.5) * SC, color: furC });

      if (!front) {
        const hockX = kneeX - iso.x * 0.8, hockY = kneeY + 3 * SC;
        g.moveTo(kneeX * s, kneeY * s); g.lineTo(hockX * s, hockY * s);
        g.stroke({ width: s * 3.5 * SC, color: furC });
        const pawX = hockX + iso.x * stride * 0.2;
        const pawY = hockY + 3 * SC - Math.abs(trot * side) * 1.5;
        g.moveTo(hockX * s, hockY * s); g.lineTo(pawX * s, pawY * s);
        g.stroke({ width: s * 3 * SC, color: furC });
        g.ellipse(pawX * s, (pawY + 0.8) * s, 3 * SC * s, 1.5 * SC * s); g.fill(darken(furC, 0.1));
      } else {
        const pawX = kneeX + iso.x * stride * 0.5;
        const pawY = kneeY + 5 * SC - Math.abs(trot * side) * 1;
        g.moveTo(kneeX * s, kneeY * s); g.lineTo(pawX * s, pawY * s);
        g.stroke({ width: s * 3.5 * SC, color: furC });
        g.ellipse(pawX * s, (pawY + 0.8) * s, 3 * SC * s, 1.5 * SC * s); g.fill(darken(furC, 0.1));
      }
    }
  }
}
