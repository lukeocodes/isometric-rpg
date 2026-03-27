import type { Graphics } from "pixi.js";
import type {
  Model,
  RenderContext,
  DrawCall,
  Skeleton,
  AttachmentPoint,
  V,
  ModelPalette,
} from "../types";
import { darken, lighten } from "../palette";
import { drawTaperedLimb } from "../draw-helpers";

/**
 * Gnome body — small, clever humanoid. Shorter than dwarf, thinner.
 * Big head relative to body, pointed ears (smaller than elf), bright eyes.
 * CAN hold weapons and wear equipment. Playable race option.
 *
 * Anatomy: ~70% human height, ~80% human width.
 * Large head-to-body ratio, thin limbs, small hands/feet.
 */
export class GnomeBody implements Model {
  readonly id = "gnome-body";
  readonly name = "Gnome Body";
  readonly category = "body" as const;
  readonly slot = "root" as const;

  private readonly SLIM = 0.8;

  getDrawCalls(ctx: RenderContext): DrawCall[] {
    const { skeleton, palette, farSide, nearSide, facingCamera } = ctx;
    const j = skeleton.joints;
    const calls: DrawCall[] = [];

    calls.push({ depth: 0, draw: (g, s) => {
      g.ellipse(0, 2 * s, 9 * s, 3.5 * s);
      g.fill({ color: 0x000000, alpha: 0.18 });
    }});

    calls.push({ depth: 10, draw: (g, s) => this.drawLeg(g, j, palette, s, farSide) });
    calls.push({ depth: 11, draw: (g, s) => this.drawFoot(g, j, skeleton, palette, s, farSide) });
    calls.push({ depth: 12, draw: (g, s) => this.drawLeg(g, j, palette, s, nearSide) });
    calls.push({ depth: 13, draw: (g, s) => this.drawFoot(g, j, skeleton, palette, s, nearSide) });

    calls.push({ depth: facingCamera ? 20 : 45, draw: (g, s) => this.drawArm(g, j, palette, s, farSide) });

    calls.push({ depth: 30, draw: (g, s) => this.drawTorso(g, j, palette, s) });
    calls.push({ depth: 32, draw: (g, s) => this.drawPelvis(g, j, palette, s) });
    calls.push({ depth: 50, draw: (g, s) => this.drawHead(g, j, skeleton, palette, s) });

    calls.push({ depth: facingCamera ? 59 : 24, draw: (g, s) => this.drawArm(g, j, palette, s, nearSide) });

    return calls;
  }

  getAttachmentPoints(skeleton: Skeleton): Record<string, AttachmentPoint> {
    const S = this.SLIM;
    return Object.fromEntries(
      Object.entries(skeleton.attachments).map(([slot, pt]) => [
        slot,
        { ...pt, params: { size: S, ratio: { x: S, y: 1 }, offset: { x: 0, y: 0 } } },
      ])
    );
  }

  private drawTorso(g: Graphics, j: Record<string, V>, p: ModelPalette, s: number): void {
    const SL = this.SLIM;
    const neckBase = j.neckBase;
    const chestL = { x: j.chestL.x * SL, y: j.chestL.y };
    const chestR = { x: j.chestR.x * SL, y: j.chestR.y };
    const waistL = { x: j.waistL.x * SL, y: j.waistL.y };
    const waistR = { x: j.waistR.x * SL, y: j.waistR.y };
    const hipL = { x: j.hipL.x * SL, y: j.hipL.y };
    const hipR = { x: j.hipR.x * SL, y: j.hipR.y };

    g.moveTo(neckBase.x * s, neckBase.y * s);
    g.quadraticCurveTo(chestR.x * s, (chestR.y - 0.5) * s, chestR.x * s, chestR.y * s);
    g.quadraticCurveTo((chestR.x + 0.3) * s, ((chestR.y + waistR.y) / 2) * s, waistR.x * s, waistR.y * s);
    g.quadraticCurveTo((waistR.x + 0.5) * s, ((waistR.y + hipR.y) / 2) * s, hipR.x * s, hipR.y * s);
    g.lineTo(hipL.x * s, hipL.y * s);
    g.quadraticCurveTo((waistL.x - 0.5) * s, ((waistL.y + hipL.y) / 2) * s, waistL.x * s, waistL.y * s);
    g.quadraticCurveTo((chestL.x - 0.3) * s, ((chestL.y + waistL.y) / 2) * s, chestL.x * s, chestL.y * s);
    g.quadraticCurveTo(chestL.x * s, (chestL.y - 0.5) * s, neckBase.x * s, neckBase.y * s);
    g.closePath();
    g.fill(p.body);
    // Re-trace for outline
    g.moveTo(neckBase.x * s, neckBase.y * s);
    g.quadraticCurveTo(chestR.x * s, (chestR.y - 0.5) * s, chestR.x * s, chestR.y * s);
    g.quadraticCurveTo((chestR.x + 0.3) * s, ((chestR.y + waistR.y) / 2) * s, waistR.x * s, waistR.y * s);
    g.quadraticCurveTo((waistR.x + 0.5) * s, ((waistR.y + hipR.y) / 2) * s, hipR.x * s, hipR.y * s);
    g.lineTo(hipL.x * s, hipL.y * s);
    g.quadraticCurveTo((waistL.x - 0.5) * s, ((waistL.y + hipL.y) / 2) * s, waistL.x * s, waistL.y * s);
    g.quadraticCurveTo((chestL.x - 0.3) * s, ((chestL.y + waistL.y) / 2) * s, chestL.x * s, chestL.y * s);
    g.quadraticCurveTo(chestL.x * s, (chestL.y - 0.5) * s, neckBase.x * s, neckBase.y * s);
    g.closePath();
    g.stroke({ width: s * 0.5, color: p.outline, alpha: 0.4 });

    const nw = 2 * (Math.abs(chestR.x - chestL.x) / 14);
    g.roundRect((neckBase.x - nw / 2) * s, (neckBase.y - 2) * s, nw * s, 3 * s, 1 * s);
    g.fill(p.skin);
  }

  private drawPelvis(g: Graphics, j: Record<string, V>, p: ModelPalette, s: number): void {
    const SL = this.SLIM;
    const hipL = { x: j.hipL.x * SL, y: j.hipL.y };
    const hipR = { x: j.hipR.x * SL, y: j.hipR.y };
    const crotch = j.crotch;

    g.moveTo(hipL.x * s, hipL.y * s);
    g.quadraticCurveTo((hipL.x - 0.5) * s, ((hipL.y + crotch.y) / 2) * s, ((hipL.x + crotch.x) / 2) * s, crotch.y * s);
    g.quadraticCurveTo(crotch.x * s, (crotch.y + 1) * s, ((hipR.x + crotch.x) / 2) * s, crotch.y * s);
    g.quadraticCurveTo((hipR.x + 0.5) * s, ((hipR.y + crotch.y) / 2) * s, hipR.x * s, hipR.y * s);
    g.closePath();
    g.fill(p.skin);
  }

  private drawLeg(g: Graphics, j: Record<string, V>, p: ModelPalette, s: number, side: "L" | "R"): void {
    const hip = j[`hip${side}`];
    const knee = j[`knee${side}`];
    const ankle = j[`ankle${side}`];
    const legTop: V = { x: hip.x * 0.5, y: hip.y };

    drawTaperedLimb(g, legTop, knee, 4, 3, p.skin, darken(p.skin, 0.2), darken(p.skin, 0.3), s);
    g.ellipse(knee.x * s, knee.y * s, 2 * s, 1.3 * s);
    g.fill(p.skin);
    drawTaperedLimb(g, knee, ankle, 3, 2.2, p.skin, darken(p.skin, 0.2), darken(p.skin, 0.3), s);
  }

  private drawFoot(g: Graphics, j: Record<string, V>, sk: Skeleton, p: ModelPalette, s: number, side: "L" | "R"): void {
    const ankle = j[`ankle${side}`];
    const bootColor = darken(p.skin, 0.15);
    const iso = sk.iso;
    const footLen = 3;
    const fwdX = iso.x * footLen;
    const fwdY = iso.y * footLen * 0.5;
    const tipX = ankle.x + fwdX;
    const tipY = ankle.y + fwdY + 1;

    const fdx = tipX - ankle.x;
    const fdy = tipY - ankle.y;
    const flen = Math.sqrt(fdx * fdx + fdy * fdy) || 1;
    const pnx = -fdy / flen;
    const pny = fdx / flen;

    g.moveTo((ankle.x + pnx * 1.5) * s, (ankle.y + pny * 1.5) * s);
    g.lineTo((tipX + pnx * 0.8) * s, (tipY + pny * 0.8) * s);
    g.quadraticCurveTo((tipX + fdx / flen * 1) * s, (tipY + fdy / flen * 0.5) * s, (tipX - pnx * 0.8) * s, (tipY - pny * 0.8) * s);
    g.lineTo((ankle.x - pnx * 1.5) * s, (ankle.y - pny * 1.5) * s);
    g.closePath();
    g.fill(bootColor);
  }

  private drawArm(g: Graphics, j: Record<string, V>, p: ModelPalette, s: number, side: "L" | "R"): void {
    const shoulder = j[`shoulder${side}`];
    const elbow = j[`elbow${side}`];
    const wrist = j[`wrist${side}`];

    drawTaperedLimb(g, shoulder, elbow, 2.8, 2.3, p.skin, darken(p.skin, 0.18), darken(p.skin, 0.28), s);
    g.circle(elbow.x * s, elbow.y * s, 1.4 * s);
    g.fill(p.skin);
    drawTaperedLimb(g, elbow, wrist, 2.2, 1.8, p.skin, darken(p.skin, 0.18), darken(p.skin, 0.28), s);
    g.circle(wrist.x * s, wrist.y * s, 1.6 * s);
    g.fill(p.skin);
  }

  private drawHead(g: Graphics, j: Record<string, V>, sk: Skeleton, p: ModelPalette, s: number): void {
    const head = j.head;
    const { wf, iso } = sk;
    const r = 8; // big head relative to body
    const faceCam = iso.y > 0;
    const sideView = Math.abs(iso.x) > 0.3;

    // Small pointed ears (less dramatic than elf)
    if (sideView) {
      const earSide = iso.x > 0 ? 1 : -1;
      const earBaseX = head.x + earSide * r * wf * 0.85;
      const earTipX = earBaseX + earSide * 2.5;
      const earTipY = head.y - 2;

      g.moveTo(earBaseX * s, (head.y + 1) * s);
      g.quadraticCurveTo((earBaseX + earSide * 1.5) * s, (head.y - 0.5) * s, earTipX * s, earTipY * s);
      g.quadraticCurveTo((earBaseX + earSide * 0.5) * s, (head.y - 1) * s, earBaseX * s, (head.y - 0.5) * s);
      g.closePath();
      g.fill(p.skin);
    } else if (faceCam) {
      for (const earSide of [-1, 1]) {
        const earBaseX = head.x + earSide * r * wf * 0.8;
        const earTipX = earBaseX + earSide * 2;
        g.moveTo(earBaseX * s, (head.y + 0.5) * s);
        g.quadraticCurveTo((earBaseX + earSide * 1) * s, (head.y - 0.5) * s, earTipX * s, (head.y - 1.5) * s);
        g.quadraticCurveTo((earBaseX + earSide * 0.3) * s, (head.y - 0.5) * s, earBaseX * s, (head.y - 0.3) * s);
        g.closePath();
        g.fill(p.skin);
      }
    }

    // Big round head
    g.ellipse(head.x * s, head.y * s, r * wf * s, r * s);
    g.fill(p.skin);
    if (faceCam) {
      g.ellipse(head.x * s, (head.y + 1.5) * s, (r - 0.5) * wf * s, (r - 2) * s);
      g.fill(p.skin);
    }
    g.ellipse(head.x * s, head.y * s, r * wf * s, r * s);
    g.stroke({ width: s * 0.5, color: darken(p.skin, 0.25), alpha: 0.35 });

    // Big bright eyes
    if (faceCam || (sideView && iso.y >= -0.1)) {
      const spread = 3 * wf;
      const eyeY = head.y + 0.3 + iso.y * 1;
      const eyeOX = head.x + iso.x * 0.8;

      // Large round eyes (gnomes have big expressive eyes)
      g.ellipse((eyeOX - spread) * s, eyeY * s, 2.2 * s, 2 * s);
      g.fill(0xffffff);
      g.ellipse((eyeOX + spread) * s, eyeY * s, 2.2 * s, 2 * s);
      g.fill(0xffffff);

      g.circle((eyeOX - spread + iso.x * 0.4) * s, (eyeY + 0.1) * s, 1.2 * s);
      g.fill(p.eyes);
      g.circle((eyeOX + spread + iso.x * 0.4) * s, (eyeY + 0.1) * s, 1.2 * s);
      g.fill(p.eyes);

      g.circle((eyeOX - spread + iso.x * 0.6) * s, (eyeY - 0.1) * s, 0.5 * s);
      g.fill(0x111111);
      g.circle((eyeOX + spread + iso.x * 0.6) * s, (eyeY - 0.1) * s, 0.5 * s);
      g.fill(0x111111);

      // Eye highlight
      g.circle((eyeOX - spread + 0.5) * s, (eyeY - 0.5) * s, 0.4 * s);
      g.fill({ color: 0xffffff, alpha: 0.5 });
      g.circle((eyeOX + spread + 0.5) * s, (eyeY - 0.5) * s, 0.4 * s);
      g.fill({ color: 0xffffff, alpha: 0.5 });

      // Thin arched eyebrows
      g.moveTo((eyeOX - spread - 1.5) * s, (eyeY - 2.5) * s);
      g.quadraticCurveTo((eyeOX - spread) * s, (eyeY - 3.2) * s, (eyeOX - spread + 1.5) * s, (eyeY - 2.6) * s);
      g.moveTo((eyeOX + spread - 1.5) * s, (eyeY - 2.6) * s);
      g.quadraticCurveTo((eyeOX + spread) * s, (eyeY - 3.2) * s, (eyeOX + spread + 1.5) * s, (eyeY - 2.5) * s);
      g.stroke({ width: s * 0.4, color: darken(p.skin, 0.25), alpha: 0.4 });

      // Button nose
      if (faceCam) {
        const noseY = head.y + 3 + iso.y * 0.3;
        g.circle(head.x * s, noseY * s, 1.2 * s);
        g.fill(darken(p.skin, 0.08));
        g.circle(head.x * s, noseY * s, 1.2 * s);
        g.stroke({ width: s * 0.3, color: darken(p.skin, 0.18), alpha: 0.3 });
      }

      // Small smile
      if (faceCam) {
        const mouthY = head.y + 4.5 + iso.y * 0.4;
        g.moveTo((head.x - 1.5 * wf) * s, mouthY * s);
        g.quadraticCurveTo(head.x * s, (mouthY + 1) * s, (head.x + 1.5 * wf) * s, mouthY * s);
        g.stroke({ width: s * 0.4, color: darken(p.skin, 0.2), alpha: 0.35 });
      }
    }
  }
}
