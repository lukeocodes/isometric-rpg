import type { Graphics } from "pixi.js";
import type { Model, RenderContext, DrawCall, Skeleton, AttachmentPoint, V } from "../types";
import { DEPTH_SHADOW, DEPTH_FAR_LIMB, DEPTH_BODY, DEPTH_HEAD, DEPTH_NEAR_LIMB } from "../types";
import { darken, lighten } from "../palette";
import { drawTaperedLimb } from "../draw-helpers";

/**
 * Witch NPC — robed spellcaster with pointed hat, green glowing eyes.
 * Thin, slightly hunched, mysterious presence. CAN hold weapons.
 */
export class WitchBody implements Model {
  readonly id = "witch-body";
  readonly name = "Witch";
  readonly category = "npc" as const;
  readonly slot = "root" as const;

  private readonly ROBE    = 0x2a1a3a;
  private readonly ROBE_DK = 0x1a0a2a;
  private readonly ROBE_LT = 0x3a2a4a;
  private readonly SKIN    = 0xa8b898;
  private readonly SKIN_DK = 0x889878;
  private readonly EYE     = 0x44ee44;
  private readonly HAT     = 0x1a1a2e;

  getDrawCalls(ctx: RenderContext): DrawCall[] {
    const { skeleton, facingCamera, nearSide, farSide } = ctx;
    const j = skeleton.joints;
    const { wf, iso, walkPhase } = skeleton;
    const calls: DrawCall[] = [];

    // Subtle magic aura
    calls.push({ depth: DEPTH_SHADOW - 1, draw: (g, s) => {
      g.ellipse(0, -8 * s, 12 * s, 16 * s);
      g.fill({ color: this.EYE, alpha: 0.02 });
    }});

    calls.push({ depth: DEPTH_SHADOW, draw: (g, s) => {
      g.ellipse(iso.x * s, 2 * s, 10 * s, 4 * s);
      g.fill({ color: 0x000000, alpha: 0.15 });
    }});

    // Robe skirt
    calls.push({ depth: DEPTH_FAR_LIMB - 1, draw: (g, s) => {
      const nB = j.neckBase;
      const sway = walkPhase !== 0 ? Math.sin(walkPhase * 0.8) : 0;
      const topY = j.waistL.y;
      const hemY = j.ankleL.y + 3;
      const W = 0.9;

      g.moveTo((j.waistL.x * W - 1) * s, topY * s);
      g.quadraticCurveTo((j.hipL.x * W - 3 + sway) * s, ((topY + hemY) / 2) * s, (j.hipL.x * W - 4 + sway * 1.5) * s, hemY * s);
      for (let i = 0; i < 5; i++) {
        const t = i / 4;
        const px = (j.hipL.x * W - 4) + ((j.hipR.x * W + 4) - (j.hipL.x * W - 4)) * t + sway * (1 - t);
        const py = hemY + Math.sin(t * 7 + (walkPhase || 0)) * 1.5;
        g.lineTo(px * s, py * s);
      }
      g.quadraticCurveTo((j.hipR.x * W + 3 + sway) * s, ((topY + hemY) / 2) * s, (j.waistR.x * W + 1) * s, topY * s);
      g.closePath();
      g.fill(this.ROBE);

      // Directional robe shadow
      if (Math.abs(iso.x) > 0.1) {
        const shadowSide = iso.x > 0 ? -1 : 1;
        g.moveTo(nB.x * s, (topY + 1) * s);
        g.lineTo((nB.x + shadowSide * 1) * s, (topY + 2) * s);
        g.quadraticCurveTo((nB.x + shadowSide * 2 + sway * 0.3) * s, ((topY + hemY) / 2) * s,
          (nB.x + shadowSide * 3 + sway * 0.8) * s, (hemY - 1) * s);
        g.stroke({ width: s * 0.5, color: this.ROBE_DK, alpha: Math.abs(iso.x) * 0.3 });
      }

      g.moveTo(nB.x * s, (topY + 2) * s);
      g.lineTo((nB.x + sway * 0.5) * s, (hemY - 2) * s);
      g.stroke({ width: s * 0.5, color: this.ROBE_DK, alpha: 0.25 });
    }});

    calls.push({ depth: facingCamera ? DEPTH_FAR_LIMB + 8 : DEPTH_NEAR_LIMB + 0,
      draw: (g, s) => this.drawArm(g, j, skeleton, s, farSide, false) });

    // Torso
    calls.push({ depth: DEPTH_BODY, draw: (g, s) => {
      const nB = j.neckBase;
      const W = 0.9;
      const cL = { x: j.chestL.x * W, y: j.chestL.y };
      const cR = { x: j.chestR.x * W, y: j.chestR.y };
      const wL = { x: j.waistL.x * W, y: j.waistL.y };
      const wR = { x: j.waistR.x * W, y: j.waistR.y };

      g.moveTo(nB.x * s, nB.y * s);
      g.quadraticCurveTo(cR.x * s, cR.y * s, wR.x * s, wR.y * s);
      g.lineTo(wL.x * s, wL.y * s);
      g.quadraticCurveTo(cL.x * s, cL.y * s, nB.x * s, nB.y * s);
      g.closePath();
      g.fill(this.ROBE);

      // Side shading
      if (Math.abs(iso.x) > 0.1) {
        const shadowSide = iso.x > 0 ? -1 : 1;
        const sX = shadowSide > 0 ? wL : wR;
        g.moveTo(nB.x * s, nB.y * s);
        g.lineTo((sX.x + shadowSide * 0.5) * s, sX.y * s);
        g.lineTo(sX.x * s, sX.y * s);
        g.closePath();
        g.fill({ color: this.ROBE_DK, alpha: Math.abs(iso.x) * 0.3 });
      }

      g.moveTo(nB.x * s, nB.y * s);
      g.quadraticCurveTo(cR.x * s, cR.y * s, wR.x * s, wR.y * s);
      g.lineTo(wL.x * s, wL.y * s);
      g.quadraticCurveTo(cL.x * s, cL.y * s, nB.x * s, nB.y * s);
      g.closePath();
      g.stroke({ width: s * 0.5, color: this.ROBE_LT, alpha: 0.2 });

      // Pendant
      const pendY = (nB.y + j.waistL.y) / 2 - 2;
      g.circle(nB.x * s, pendY * s, 1.5 * s);
      g.fill({ color: this.EYE, alpha: 0.5 });
      g.circle(nB.x * s, pendY * s, 0.6 * s);
      g.fill({ color: 0xffffff, alpha: 0.4 });
      g.circle(nB.x * s, pendY * s, 1.5 * s);
      g.stroke({ width: s * 0.3, color: 0x888888, alpha: 0.4 });

      g.roundRect((nB.x - 1.5) * s, (nB.y - 2.5) * s, 3 * s, 3.5 * s, 1 * s);
      g.fill(this.SKIN);
    }});

    calls.push({ depth: DEPTH_HEAD,     draw: (g, s) => this.drawHead(g, j, skeleton, s) });

    calls.push({ depth: facingCamera ? DEPTH_NEAR_LIMB + 5 : DEPTH_FAR_LIMB + 10,
      draw: (g, s) => this.drawArm(g, j, skeleton, s, nearSide, true) });

    return calls;
  }

  getAttachmentPoints(skeleton: Skeleton): Record<string, AttachmentPoint> {
    return { "hand-R": skeleton.attachments["hand-R"], "hand-L": skeleton.attachments["hand-L"] };
  }

  private drawArm(g: Graphics, j: Record<string, V>, sk: Skeleton, s: number, side: "L" | "R", isNear: boolean): void {
    const shoulder = j[`shoulder${side}`];
    const elbow    = j[`elbow${side}`];
    const wrist    = j[`wrist${side}`];
    const rC = isNear ? this.ROBE : darken(this.ROBE, 0.08);

    // Wide sleeve
    g.moveTo(shoulder.x * s, shoulder.y * s);
    g.lineTo(elbow.x * s, elbow.y * s);
    g.stroke({ width: s * 5, color: rC });

    // Flared lower sleeve
    g.moveTo(elbow.x * s, elbow.y * s);
    g.lineTo(wrist.x * s, wrist.y * s);
    g.stroke({ width: s * 6, color: rC });

    const dx  = wrist.x - elbow.x, dy = wrist.y - elbow.y;
    const len = Math.sqrt(dx * dx + dy * dy) || 1;
    const px  = -dy / len, py = dx / len;
    g.moveTo(elbow.x * s, elbow.y * s);
    g.quadraticCurveTo((elbow.x + px * 3 + dx * 0.5) * s, (elbow.y + py * 3 + dy * 0.5) * s, wrist.x * s, (wrist.y + 4) * s);
    g.stroke({ width: s * 0.4, color: this.ROBE_DK, alpha: 0.3 });

    // Bony hand
    g.circle(wrist.x * s, wrist.y * s, 1.5 * s); g.fill(this.SKIN);
  }

  private drawHead(g: Graphics, j: Record<string, V>, sk: Skeleton, s: number): void {
    const head = j.head;
    const { wf, iso } = sk;
    const faceCam = iso.y > 0;
    const sideView = Math.abs(iso.x) > 0.3;
    const r = 6;

    // Head
    g.ellipse(head.x * s, head.y * s, r * wf * s, (r + 0.5) * s);
    g.fill(this.SKIN);

    if (faceCam) {
      g.ellipse(head.x * s, (head.y + 2) * s, (r - 1) * wf * s, (r - 1.5) * s);
      g.fill(this.SKIN);
    }

    // Directional shading
    if (Math.abs(iso.x) > 0.15) {
      const sEX = head.x - iso.x * r * wf * 0.88;
      const sX  = head.x - iso.x * r * wf * 0.12;
      g.moveTo(sEX * s, (head.y - (r + 0.5) * 0.6) * s);
      g.quadraticCurveTo((sEX - iso.x * 1.2) * s, head.y * s, sEX * s, (head.y + (r + 0.5) * 0.6) * s);
      g.lineTo(sX * s, (head.y + (r + 0.5) * 0.5) * s);
      g.quadraticCurveTo((sX - iso.x * 0.3) * s, head.y * s, sX * s, (head.y - (r + 0.5) * 0.5) * s);
      g.closePath();
      g.fill({ color: darken(this.SKIN, 0.18), alpha: Math.abs(iso.x) * 0.32 });
    }

    g.ellipse(head.x * s, head.y * s, r * wf * s, (r + 0.5) * s);
    g.stroke({ width: s * 0.4, color: this.SKIN_DK, alpha: 0.3 });

    // Glowing green eyes
    if (faceCam || (sideView && iso.y >= -0.1)) {
      const spread = 2.5 * wf;
      const eyeY  = head.y + 0.5 + iso.y * 0.8;
      const eyeOX = head.x + iso.x * 0.8;

      // Glow halo
      g.circle((eyeOX - spread) * s, eyeY * s, 1.8 * s); g.fill({ color: this.EYE, alpha: 0.12 });
      g.circle((eyeOX + spread) * s, eyeY * s, 1.8 * s); g.fill({ color: this.EYE, alpha: 0.12 });

      // Glowing core
      g.circle((eyeOX - spread) * s, eyeY * s, 0.9 * s); g.fill({ color: this.EYE, alpha: 0.75 });
      g.circle((eyeOX + spread) * s, eyeY * s, 0.9 * s); g.fill({ color: this.EYE, alpha: 0.75 });

      // Bright center + directional catch-light
      g.circle((eyeOX - spread + iso.x * 0.4 + 0.3) * s, (eyeY - 0.25) * s, 0.3 * s);
      g.fill({ color: 0xffffff, alpha: 0.6 });
      g.circle((eyeOX + spread + iso.x * 0.4 + 0.3) * s, (eyeY - 0.25) * s, 0.3 * s);
      g.fill({ color: 0xffffff, alpha: 0.6 });

      // Hooked nose
      if (faceCam) {
        const nY = head.y + 2.5;
        g.moveTo(head.x * s, (nY - 1) * s);
        g.quadraticCurveTo((head.x + 0.8) * s, nY * s, (head.x + 0.3) * s, (nY + 1.5) * s);
        g.stroke({ width: s * 0.5, color: this.SKIN_DK, alpha: 0.4 });
      }

      if (faceCam) {
        const mY = head.y + 4.5;
        g.moveTo((head.x - 1.5 * wf) * s, mY * s);
        g.quadraticCurveTo(head.x * s, (mY + 0.5) * s, (head.x + 1.5 * wf) * s, (mY - 0.3) * s);
        g.stroke({ width: s * 0.4, color: this.SKIN_DK, alpha: 0.3 });
      }
    }

    // Pointed hat
    const brimY = head.y - r + 1;
    const tipY  = brimY - 14;

    g.ellipse(head.x * s, (brimY + 1) * s, (r + 3) * wf * s, 2.5 * s);
    g.fill(this.HAT);
    // Brim shading
    if (Math.abs(iso.x) > 0.1) {
      const shadowSide = iso.x > 0 ? -1 : 1;
      g.ellipse((head.x + shadowSide * 1.5) * s, (brimY + 1.5) * s, (r + 3) * wf * 0.6 * s, 1.8 * s);
      g.fill({ color: darken(this.HAT, 0.2), alpha: Math.abs(iso.x) * 0.4 });
    }
    g.ellipse(head.x * s, (brimY + 1) * s, (r + 3) * wf * s, 2.5 * s);
    g.stroke({ width: s * 0.4, color: lighten(this.HAT, 0.1), alpha: 0.25 });

    // Cone with directional shading
    g.moveTo((head.x - (r - 1) * wf) * s, brimY * s);
    g.quadraticCurveTo((head.x - 2 * wf) * s, (brimY - 6) * s, (head.x + 2) * s, tipY * s);
    g.quadraticCurveTo((head.x + 2 * wf) * s, (brimY - 6) * s, (head.x + (r - 1) * wf) * s, brimY * s);
    g.closePath();
    g.fill(this.HAT);

    // Cone shadow side
    if (Math.abs(iso.x) > 0.1) {
      const shadowSide = iso.x > 0 ? -1 : 1;
      g.moveTo((head.x + shadowSide * (r - 1) * wf) * s, brimY * s);
      g.quadraticCurveTo((head.x + shadowSide * 2 * wf) * s, (brimY - 6) * s, (head.x + 2) * s, tipY * s);
      g.closePath();
      g.fill({ color: darken(this.HAT, 0.2), alpha: Math.abs(iso.x) * 0.35 });
    }

    // Hat band + buckle
    g.moveTo((head.x - (r - 1.5) * wf) * s, (brimY + 0.5) * s);
    g.lineTo((head.x + (r - 1.5) * wf) * s, (brimY + 0.5) * s);
    g.stroke({ width: s * 1.2, color: this.ROBE_LT });

    g.rect((head.x - 1) * s, (brimY - 0.5) * s, 2 * s, 2 * s);
    g.fill(0x998844);
    g.rect((head.x - 1) * s, (brimY - 0.5) * s, 2 * s, 2 * s);
    g.stroke({ width: s * 0.3, color: 0x776622, alpha: 0.5 });
  }
}
