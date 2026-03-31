import type { Graphics } from "pixi.js";
import type { Model, RenderContext, DrawCall, AttachmentPoint, V } from "../types";
import { DEPTH_SHADOW, DEPTH_FAR_LIMB, DEPTH_BODY, DEPTH_HEAD } from "../types";
import { darken, lighten } from "../palette";

/**
 * Rabbit NPC — small quadruped with hop animation.
 * Directional body shading + catch-lights in big round eyes.
 */
export class RabbitBody implements Model {
  readonly id = "rabbit-body";
  readonly name = "Rabbit";
  readonly category = "npc" as const;
  readonly slot = "root" as const;

  private readonly FUR      = 0xc0a080;
  private readonly FUR_DK   = 0x9a8060;
  private readonly FUR_LT   = 0xdac0a0;
  private readonly BELLY    = 0xe0d0b8;
  private readonly EAR_INNER= 0xddaaaa;
  private readonly NOSE     = 0xdd9999;

  getDrawCalls(ctx: RenderContext): DrawCall[] {
    const { skeleton } = ctx;
    const { iso, bob, walkPhase, wf } = skeleton;
    const faceCam  = iso.y > 0;
    const sideView = Math.abs(iso.x) > 0.3;

    const hop  = walkPhase !== 0 ? Math.abs(Math.sin(walkPhase * 2)) * 3 : 0;
    const lean = walkPhase !== 0 ? Math.sin(walkPhase) * 0.8 : 0;

    const bodyX = iso.x * 1.5 + lean;
    const bodyY = -8 + bob - hop;
    const headX = bodyX + iso.x * 1;
    const headY = bodyY - 10;

    // Near/far fur tones based on iso direction
    const furNear = this.FUR;
    const furFar  = darken(this.FUR, 0.1);
    const bodySide = iso.x >= 0 ? "R" : "L"; // which side is near

    const calls: DrawCall[] = [];

    calls.push({ depth: DEPTH_SHADOW, draw: (g, s) => {
      g.ellipse(bodyX * s, 2 * s, 8 * s, 3.5 * s);
      g.fill({ color: 0x000000, alpha: 0.15 });
    }});

    // Tail
    if (!faceCam || sideView) {
      calls.push({ depth: DEPTH_SHADOW + 5, draw: (g, s) => {
        const tX = bodyX - iso.x * 6, tY = bodyY + 4;
        g.circle(tX * s, tY * s, 2.5 * s); g.fill(this.FUR_LT);
        g.circle(tX * s, tY * s, 2.5 * s); g.stroke({ width: s * 0.3, color: this.FUR_DK, alpha: 0.2 });
      }});
    }

    calls.push({ depth: DEPTH_FAR_LIMB - 2, draw: (g, s) => this.drawBackLegs(g, bodyX, bodyY, iso, walkPhase, wf, s) });

    // Body with directional shading
    calls.push({ depth: DEPTH_BODY, draw: (g, s) => {
      g.ellipse(bodyX * s, bodyY * s, 8 * wf * s, 10 * s);
      g.fill(this.FUR);

      // Directional side shadow band
      const sideAmt = Math.abs(iso.x);
      if (sideAmt > 0.1) {
        // Shadow on far side of body
        const shadowSide = iso.x >= 0 ? -1 : 1;
        const shadowX    = bodyX + shadowSide * 4 * wf * 0.5;
        g.ellipse(shadowX * s, bodyY * s, 5 * wf * s, 9 * s);
        g.fill({ color: darken(this.FUR, 0.2), alpha: sideAmt * 0.4 });
      }

      // Belly highlight when facing camera
      if (faceCam) {
        g.ellipse(bodyX * s, (bodyY + 2) * s, 5 * wf * s, 6 * s);
        g.fill({ color: this.BELLY, alpha: 0.5 });
      }

      g.ellipse(bodyX * s, bodyY * s, 8 * wf * s, 10 * s);
      g.stroke({ width: s * 0.5, color: this.FUR_DK, alpha: 0.35 });
    }});

    calls.push({ depth: DEPTH_BODY + 5, draw: (g, s) => this.drawFrontLegs(g, bodyX, bodyY, iso, walkPhase, wf, s) });

    // Ears
    if (!faceCam) {
      calls.push({ depth: DEPTH_HEAD - 5, draw: (g, s) => this.drawEars(g, headX, headY, iso, wf, walkPhase, s) });
    }

    // Head
    calls.push({ depth: DEPTH_HEAD, draw: (g, s) => {
      const r = 6;
      g.ellipse(headX * s, headY * s, r * wf * s, (r + 0.5) * s);
      g.fill(this.FUR);

      // Directional head shading
      const sideAmt = Math.abs(iso.x);
      if (sideAmt > 0.1) {
        const shadowSide = iso.x >= 0 ? -1 : 1;
        g.ellipse((headX + shadowSide * r * wf * 0.5) * s, headY * s, r * wf * 0.65 * s, (r + 0.5) * 0.9 * s);
        g.fill({ color: darken(this.FUR, 0.18), alpha: sideAmt * 0.38 });
      }

      // Cheek puffs
      if (faceCam) {
        g.ellipse((headX - 2 * wf) * s, (headY + 1.5) * s, 2.5 * wf * s, 2 * s); g.fill(this.FUR_LT);
        g.ellipse((headX + 2 * wf) * s, (headY + 1.5) * s, 2.5 * wf * s, 2 * s); g.fill(this.FUR_LT);
      }

      g.ellipse(headX * s, headY * s, r * wf * s, (r + 0.5) * s);
      g.stroke({ width: s * 0.5, color: this.FUR_DK, alpha: 0.35 });

      if (faceCam || (sideView && iso.y >= -0.1)) {
        const spread = 2.5 * wf;
        const eyeY  = headY - 0.5 + iso.y * 0.5;
        const eyeOX = headX + iso.x * 0.5;

        // Big dark eyes
        g.circle((eyeOX - spread) * s, eyeY * s, 1.8 * s); g.fill(0x111111);
        g.circle((eyeOX + spread) * s, eyeY * s, 1.8 * s); g.fill(0x111111);

        // Catch-lights (directional)
        const pX = iso.x * 0.4;
        g.circle((eyeOX - spread + pX + 0.5) * s, (eyeY - 0.5) * s, 0.65 * s); g.fill(0xffffff);
        g.circle((eyeOX + spread + pX + 0.5) * s, (eyeY - 0.5) * s, 0.65 * s); g.fill(0xffffff);
        // Second smaller catch-light
        g.circle((eyeOX - spread + pX + 0.2) * s, (eyeY - 0.8) * s, 0.3 * s); g.fill({ color: 0xffffff, alpha: 0.5 });
        g.circle((eyeOX + spread + pX + 0.2) * s, (eyeY - 0.8) * s, 0.3 * s); g.fill({ color: 0xffffff, alpha: 0.5 });

        if (faceCam) {
          const noseY = headY + 2 + iso.y * 0.3;
          g.poly([(headX - 1) * s, noseY * s, headX * s, (noseY + 1.2) * s, (headX + 1) * s, noseY * s]);
          g.fill(this.NOSE);

          const whiskerY = noseY + 0.8;
          for (const side of [-1, 1]) {
            g.moveTo((headX + side * 1.5) * s, whiskerY * s);
            g.lineTo((headX + side * 5 * wf) * s, (whiskerY - 0.5) * s);
            g.moveTo((headX + side * 1.5) * s, (whiskerY + 0.3) * s);
            g.lineTo((headX + side * 4.5 * wf) * s, (whiskerY + 0.8) * s);
            g.stroke({ width: s * 0.3, color: this.FUR_DK, alpha: 0.35 });
          }

          g.moveTo(headX * s, (noseY + 1.2) * s);
          g.lineTo(headX * s, (noseY + 2) * s);
          g.stroke({ width: s * 0.3, color: this.FUR_DK, alpha: 0.25 });
        }
      }
    }});

    if (faceCam) {
      calls.push({ depth: DEPTH_HEAD + 5, draw: (g, s) => this.drawEars(g, headX, headY, iso, wf, walkPhase, s) });
    }

    return calls;
  }

  getAttachmentPoints(): Record<string, AttachmentPoint> { return {}; }

  private drawEars(g: Graphics, headX: number, headY: number, iso: V, wf: number, walkPhase: number, s: number): void {
    const earW   = 3.2;
    const earH   = 13;
    const earSway = walkPhase !== 0 ? Math.sin(walkPhase * 1.5) * 0.5 : 0;

    for (const side of [-1, 1]) {
      const earX    = headX + side * 3 * wf;
      const earBaseY = headY - 5;
      const earTipY  = earBaseY - earH;
      const sway    = side * earSway;
      const isNear  = side === 1 ? iso.x >= 0 : iso.x < 0;
      const furC    = isNear ? this.FUR : darken(this.FUR, 0.08);

      g.moveTo(earX * s, earBaseY * s);
      g.quadraticCurveTo((earX + side * earW + sway) * s, (earBaseY - earH * 0.5) * s, (earX + sway * 1.5) * s, earTipY * s);
      g.quadraticCurveTo((earX - side * earW + sway) * s, (earBaseY - earH * 0.5) * s, earX * s, earBaseY * s);
      g.closePath(); g.fill(furC);

      g.moveTo(earX * s, (earBaseY + 0.5) * s);
      g.quadraticCurveTo((earX + side * (earW - 0.5) + sway) * s, (earBaseY - earH * 0.45) * s, (earX + sway * 1.3) * s, (earTipY + 1.5) * s);
      g.quadraticCurveTo((earX - side * (earW - 0.5) + sway) * s, (earBaseY - earH * 0.45) * s, earX * s, (earBaseY + 0.5) * s);
      g.closePath(); g.fill(this.EAR_INNER);

      g.moveTo(earX * s, earBaseY * s);
      g.quadraticCurveTo((earX + side * earW + sway) * s, (earBaseY - earH * 0.5) * s, (earX + sway * 1.5) * s, earTipY * s);
      g.quadraticCurveTo((earX - side * earW + sway) * s, (earBaseY - earH * 0.5) * s, earX * s, earBaseY * s);
      g.closePath(); g.stroke({ width: s * 0.4, color: this.FUR_DK, alpha: 0.3 });
    }
  }

  private drawFrontLegs(g: Graphics, bodyX: number, bodyY: number, iso: V, walkPhase: number, wf: number, s: number): void {
    const hop      = walkPhase !== 0 ? Math.sin(walkPhase * 2) : 0;
    const legPhase = walkPhase !== 0 ? Math.sin(walkPhase) : 0;

    for (const side of [-1, 1]) {
      const isNear = side === 1 ? iso.x >= 0 : iso.x < 0;
      const furC   = isNear ? this.FUR : darken(this.FUR, 0.1);

      const legX  = bodyX + side * 4 * wf + iso.x * 2;
      const legTopY = bodyY + 5;
      const pawX  = legX + legPhase * side * 1.5;
      const pawY  = legTopY + 4 - Math.abs(hop) * 0.5;

      g.moveTo(legX * s, legTopY * s);
      g.quadraticCurveTo((legX + side * 0.5) * s, ((legTopY + pawY) / 2) * s, pawX * s, pawY * s);
      g.stroke({ width: s * 2.5, color: furC });

      g.ellipse(pawX * s, (pawY + 0.5) * s, 1.8 * s, 1.2 * s); g.fill(darken(furC, 0.08));
    }
  }

  private drawBackLegs(g: Graphics, bodyX: number, bodyY: number, iso: V, walkPhase: number, wf: number, s: number): void {
    const hop      = walkPhase !== 0 ? Math.sin(walkPhase * 2) : 0;
    const legPhase = walkPhase !== 0 ? Math.sin(walkPhase) : 0;

    for (const side of [-1, 1]) {
      const isNear  = side === 1 ? iso.x >= 0 : iso.x < 0;
      const furC    = isNear ? this.FUR : darken(this.FUR, 0.1);
      const haunchX = bodyX + side * 3 * wf - iso.x * 1.5;
      const haunchY = bodyY + 2;

      g.ellipse((haunchX + side * 2 * wf) * s, (haunchY + 3) * s, 4 * wf * s, 5 * s);
      g.fill(furC);
      g.ellipse((haunchX + side * 2 * wf) * s, (haunchY + 3) * s, 4 * wf * s, 5 * s);
      g.stroke({ width: s * 0.3, color: this.FUR_DK, alpha: 0.2 });

      const footX = haunchX + side * 1 * wf - legPhase * side * 2;
      const footY = haunchY + 9 - Math.abs(hop) * 1;

      g.moveTo((haunchX + side * 2 * wf) * s, (haunchY + 6) * s);
      g.quadraticCurveTo((footX + side * 0.5) * s, (haunchY + 7) * s, footX * s, footY * s);
      g.stroke({ width: s * 2, color: furC });

      g.ellipse((footX + iso.x * 3 * 0.3) * s, (footY + 0.5) * s, 3 * s, 1.2 * s);
      g.fill(darken(furC, 0.08));
    }
  }
}
