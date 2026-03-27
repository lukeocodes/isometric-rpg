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
 * Elf body model — taller, slimmer proportions than human.
 * Pointed ears, angular jaw, slightly longer limbs.
 * Uses the same skeleton but with scaled proportions.
 *
 * Anatomy reference (relative to human):
 * - ~10% taller overall (longer legs + torso)
 * - ~15% narrower shoulders and waist
 * - Longer neck
 * - Pointed ear tips extending beyond head circle
 * - More angular facial structure
 */
export class ElfBody implements Model {
  readonly id = "elf-body";
  readonly name = "Elf Body";
  readonly category = "body" as const;
  readonly slot = "root" as const;

  // Elf proportions — multiplied into joint positions
  private readonly SLIM = 0.85; // narrower torso/hips
  private readonly TALL = 1.08; // slightly taller

  getDrawCalls(ctx: RenderContext): DrawCall[] {
    const { skeleton, palette, farSide, nearSide, facingCamera } = ctx;
    const j = skeleton.joints;
    const calls: DrawCall[] = [];

    // Shadow (slightly narrower)
    calls.push({
      depth: 0,
      draw: (g, s) => {
        g.ellipse(0, 2 * s, 11 * s, 4.5 * s);
        g.fill({ color: 0x000000, alpha: 0.2 });
      },
    });

    // Legs
    calls.push({ depth: 10, draw: (g, s) => this.drawLeg(g, j, palette, s, farSide) });
    calls.push({ depth: 11, draw: (g, s) => this.drawFoot(g, j, skeleton, palette, s, farSide) });
    calls.push({ depth: 12, draw: (g, s) => this.drawLeg(g, j, palette, s, nearSide) });
    calls.push({ depth: 13, draw: (g, s) => this.drawFoot(g, j, skeleton, palette, s, nearSide) });

    // Far arm
    calls.push({
      depth: facingCamera ? 20 : 45,
      draw: (g, s) => this.drawArm(g, j, palette, s, farSide),
    });

    // Glutes (back views)
    if (!facingCamera) {
      calls.push({ depth: 26, draw: (g, s) => this.drawGlutes(g, j, skeleton, palette, s) });
    }

    // Torso
    calls.push({ depth: 30, draw: (g, s) => this.drawTorso(g, j, palette, s) });

    // Pelvis
    calls.push({ depth: 32, draw: (g, s) => this.drawPelvis(g, j, palette, s) });

    // Head
    calls.push({ depth: 50, draw: (g, s) => this.drawHead(g, j, skeleton, palette, s) });

    // Near arm
    calls.push({
      depth: facingCamera ? 59 : 24,
      draw: (g, s) => this.drawArm(g, j, palette, s, nearSide),
    });

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

  // ─── TORSO (narrower, longer) ───────────────────────────────────

  private drawTorso(g: Graphics, j: Record<string, V>, p: ModelPalette, s: number): void {
    const SL = this.SLIM;
    const chestL = this.slim(j.chestL);
    const chestR = this.slim(j.chestR);
    const waistL = this.slim(j.waistL);
    const waistR = this.slim(j.waistR);
    const hipL = this.slim(j.hipL);
    const hipR = this.slim(j.hipR);
    const neckBase = j.neckBase;

    // Main torso
    this.torsoPath(g, j, s);
    g.fill(p.body);

    // Shadow side
    g.moveTo(neckBase.x * s, neckBase.y * s);
    g.quadraticCurveTo(chestR.x * s, (chestR.y - 1) * s, chestR.x * s, chestR.y * s);
    g.quadraticCurveTo(
      (chestR.x + 0.3) * s,
      ((chestR.y + waistR.y) / 2) * s,
      waistR.x * s,
      waistR.y * s
    );
    g.quadraticCurveTo(
      (waistR.x + 0.8) * s,
      ((waistR.y + hipR.y) / 2) * s,
      hipR.x * s,
      hipR.y * s
    );
    g.lineTo(((hipR.x + hipL.x) / 2) * s, hipR.y * s);
    g.lineTo(((waistR.x + neckBase.x) / 2) * s, neckBase.y * s);
    g.closePath();
    g.fill({ color: p.bodyDk, alpha: 0.3 });

    // Outline
    this.torsoPath(g, j, s);
    g.stroke({ width: s * 0.6, color: p.outline, alpha: 0.4 });

    // Neck (longer, thinner)
    const nw = 2.2 * (Math.abs(chestR.x - chestL.x) / 14);
    g.roundRect(
      (neckBase.x - nw / 2) * s,
      (neckBase.y - 3) * s,
      nw * s,
      4 * s,
      1.2 * s
    );
    g.fill(p.skin);
  }

  private torsoPath(g: Graphics, j: Record<string, V>, s: number): void {
    const chestL = this.slim(j.chestL);
    const chestR = this.slim(j.chestR);
    const waistL = this.slim(j.waistL);
    const waistR = this.slim(j.waistR);
    const hipL = this.slim(j.hipL);
    const hipR = this.slim(j.hipR);
    const neckBase = j.neckBase;

    g.moveTo(neckBase.x * s, neckBase.y * s);
    g.quadraticCurveTo(chestR.x * s, (chestR.y - 1) * s, chestR.x * s, chestR.y * s);
    g.quadraticCurveTo(
      (chestR.x + 0.3) * s,
      ((chestR.y + waistR.y) / 2) * s,
      waistR.x * s,
      waistR.y * s
    );
    g.quadraticCurveTo(
      (waistR.x + 0.8) * s,
      ((waistR.y + hipR.y) / 2) * s,
      hipR.x * s,
      hipR.y * s
    );
    g.lineTo(hipL.x * s, hipL.y * s);
    g.quadraticCurveTo(
      (waistL.x - 0.8) * s,
      ((waistL.y + hipL.y) / 2) * s,
      waistL.x * s,
      waistL.y * s
    );
    g.quadraticCurveTo(
      (chestL.x - 0.3) * s,
      ((chestL.y + waistL.y) / 2) * s,
      chestL.x * s,
      chestL.y * s
    );
    g.quadraticCurveTo(chestL.x * s, (chestL.y - 1) * s, neckBase.x * s, neckBase.y * s);
    g.closePath();
  }

  // ─── PELVIS ──────────────────────────────────────────────────────

  private drawPelvis(g: Graphics, j: Record<string, V>, p: ModelPalette, s: number): void {
    const hipL = this.slim(j.hipL);
    const hipR = this.slim(j.hipR);
    const crotch = j.crotch;
    const legColor = p.skin;

    g.moveTo(hipL.x * s, hipL.y * s);
    g.quadraticCurveTo(
      (hipL.x - 0.8) * s,
      ((hipL.y + crotch.y) / 2) * s,
      ((hipL.x + crotch.x) / 2 - 0.4) * s,
      crotch.y * s
    );
    g.quadraticCurveTo(
      crotch.x * s,
      (crotch.y + 1.2) * s,
      ((hipR.x + crotch.x) / 2 + 0.4) * s,
      crotch.y * s
    );
    g.quadraticCurveTo(
      (hipR.x + 0.8) * s,
      ((hipR.y + crotch.y) / 2) * s,
      hipR.x * s,
      hipR.y * s
    );
    g.closePath();
    g.fill(legColor);

    // Inner thigh shading
    g.moveTo(((hipL.x + crotch.x) / 2 - 0.4) * s, crotch.y * s);
    g.quadraticCurveTo(
      crotch.x * s,
      (crotch.y + 1.2) * s,
      ((hipR.x + crotch.x) / 2 + 0.4) * s,
      crotch.y * s
    );
    g.lineTo(crotch.x * s, (crotch.y - 1) * s);
    g.closePath();
    g.fill({ color: darken(legColor, 0.2), alpha: 0.4 });
  }

  // ─── GLUTES ──────────────────────────────────────────────────────

  private drawGlutes(
    g: Graphics,
    j: Record<string, V>,
    sk: Skeleton,
    p: ModelPalette,
    s: number
  ): void {
    const hipL = this.slim(j.hipL);
    const hipR = this.slim(j.hipR);
    const legColor = p.skin;
    const cheekColor = lighten(legColor, 0.05);

    const cheekW = 3.8 * sk.wf;
    const cheekH = 3.5;
    const cheekY = hipL.y + 0.5;
    const cheekLX = hipL.x * 0.4;
    const cheekRX = hipR.x * 0.4;

    g.ellipse(cheekLX * s, cheekY * s, cheekW * s, cheekH * s);
    g.fill(cheekColor);
    g.ellipse(cheekLX * s, cheekY * s, cheekW * s, cheekH * s);
    g.stroke({ width: s * 0.4, color: darken(legColor, 0.12), alpha: 0.35 });

    g.ellipse(cheekRX * s, cheekY * s, cheekW * s, cheekH * s);
    g.fill(cheekColor);
    g.ellipse(cheekRX * s, cheekY * s, cheekW * s, cheekH * s);
    g.stroke({ width: s * 0.4, color: darken(legColor, 0.12), alpha: 0.35 });

    // Cleft
    g.moveTo(j.crotch.x * s, (hipL.y - 1) * s);
    g.quadraticCurveTo(
      (j.crotch.x - 0.15) * s,
      cheekY * s,
      j.crotch.x * s,
      (cheekY + cheekH) * s
    );
    g.stroke({ width: s * 0.6, color: darken(legColor, 0.2), alpha: 0.5 });
  }

  // ─── LEG (slimmer) ──────────────────────────────────────────────

  private drawLeg(
    g: Graphics,
    j: Record<string, V>,
    p: ModelPalette,
    s: number,
    side: "L" | "R"
  ): void {
    const hip = j[`hip${side}`];
    const knee = j[`knee${side}`];
    const ankle = j[`ankle${side}`];

    const legTop: V = { x: hip.x * 0.5, y: hip.y };
    const legColor = p.skin;
    const legDk = darken(legColor, 0.2);
    const legOutline = darken(legColor, 0.3);

    // Thigh — slimmer than human
    drawTaperedLimb(g, legTop, knee, 4.8, 3.5, legColor, legDk, legOutline, s);

    // Knee
    g.ellipse(knee.x * s, knee.y * s, 2.4 * s, 1.5 * s);
    g.fill(legColor);
    g.ellipse(knee.x * s, knee.y * s, 2.4 * s, 1.5 * s);
    g.stroke({ width: s * 0.3, color: darken(legColor, 0.18), alpha: 0.2 });

    // Calf — slimmer
    drawTaperedLimb(g, knee, ankle, 3.8, 2.5, legColor, legDk, legOutline, s);
  }

  // ─── FOOT ────────────────────────────────────────────────────────

  private drawFoot(
    g: Graphics,
    j: Record<string, V>,
    sk: Skeleton,
    p: ModelPalette,
    s: number,
    side: "L" | "R"
  ): void {
    const ankle = j[`ankle${side}`];
    const bootColor = darken(p.skin, 0.18);
    const iso = sk.iso;

    const footLen = 3.5; // slightly shorter, more delicate
    const fwdX = iso.x * footLen;
    const fwdY = iso.y * footLen * 0.5;
    const tipX = ankle.x + fwdX;
    const tipY = ankle.y + fwdY + 1.3;

    const fdx = tipX - ankle.x;
    const fdy = tipY - ankle.y;
    const flen = Math.sqrt(fdx * fdx + fdy * fdy);
    const pnx = flen > 0.3 ? -fdy / flen : 1;
    const pny = flen > 0.3 ? fdx / flen : 0;
    const hw = 1.6;
    const tw = 0.9;

    g.moveTo((ankle.x + pnx * hw) * s, (ankle.y + pny * hw) * s);
    g.lineTo((tipX + pnx * tw) * s, (tipY + pny * tw) * s);
    g.quadraticCurveTo(
      (tipX + fdx / flen * 1.2) * s,
      (tipY + fdy / flen * 0.8) * s,
      (tipX - pnx * tw) * s,
      (tipY - pny * tw) * s
    );
    g.lineTo((ankle.x - pnx * hw) * s, (ankle.y - pny * hw) * s);
    g.closePath();
    g.fill(bootColor);
    g.moveTo((ankle.x + pnx * hw) * s, (ankle.y + pny * hw) * s);
    g.lineTo((tipX + pnx * tw) * s, (tipY + pny * tw) * s);
    g.quadraticCurveTo(
      (tipX + fdx / flen * 1.2) * s,
      (tipY + fdy / flen * 0.8) * s,
      (tipX - pnx * tw) * s,
      (tipY - pny * tw) * s
    );
    g.lineTo((ankle.x - pnx * hw) * s, (ankle.y - pny * hw) * s);
    g.closePath();
    g.stroke({ width: s * 0.35, color: darken(bootColor, 0.25), alpha: 0.35 });
  }

  // ─── ARM (slimmer, longer forearms) ─────────────────────────────

  private drawArm(
    g: Graphics,
    j: Record<string, V>,
    p: ModelPalette,
    s: number,
    side: "L" | "R"
  ): void {
    const shoulder = j[`shoulder${side}`];
    const elbow = j[`elbow${side}`];
    const wrist = j[`wrist${side}`];

    const armColor = p.skin;
    const armDk = darken(p.skin, 0.18);
    const armOutline = darken(p.skin, 0.28);

    // Upper arm — slimmer
    drawTaperedLimb(g, shoulder, elbow, 3.2, 2.6, armColor, armDk, armOutline, s);

    // Elbow
    g.circle(elbow.x * s, elbow.y * s, 1.6 * s);
    g.fill(armColor);
    g.circle(elbow.x * s, elbow.y * s, 1.6 * s);
    g.stroke({ width: s * 0.3, color: armOutline, alpha: 0.25 });

    // Forearm — slimmer
    drawTaperedLimb(g, elbow, wrist, 2.5, 2, armColor, armDk, armOutline, s);

    // Hand — more delicate
    g.circle(wrist.x * s, wrist.y * s, 1.8 * s);
    g.fill(p.skin);
    g.circle(wrist.x * s, wrist.y * s, 1.8 * s);
    g.stroke({ width: s * 0.3, color: darken(p.skin, 0.2), alpha: 0.25 });
  }

  // ─── HEAD (angular, pointed ears) ───────────────────────────────

  private drawHead(
    g: Graphics,
    j: Record<string, V>,
    sk: Skeleton,
    p: ModelPalette,
    s: number
  ): void {
    const head = j.head;
    const { wf, iso } = sk;
    const r = 6.5; // slightly smaller head relative to body
    const faceCam = iso.y > 0;
    const sideView = Math.abs(iso.x) > 0.3;

    // Pointed ears (always visible, more prominent than human)
    if (sideView) {
      const earSide = iso.x > 0 ? 1 : -1;
      const earBaseX = head.x + earSide * r * wf * 0.9;
      const earBaseY = head.y + 0.5;
      // Pointed ear tip extends up and out
      const earTipX = earBaseX + earSide * 4.5;
      const earTipY = earBaseY - 5;

      // Ear shape (elongated triangle)
      g.moveTo(earBaseX * s, (earBaseY + 2) * s);
      g.quadraticCurveTo(
        (earBaseX + earSide * 2) * s,
        (earBaseY - 1) * s,
        earTipX * s,
        earTipY * s
      );
      g.quadraticCurveTo(
        (earBaseX + earSide * 1) * s,
        (earBaseY - 2) * s,
        earBaseX * s,
        (earBaseY - 1.5) * s
      );
      g.closePath();
      g.fill(p.skin);
      g.moveTo(earBaseX * s, (earBaseY + 2) * s);
      g.quadraticCurveTo(
        (earBaseX + earSide * 2) * s,
        (earBaseY - 1) * s,
        earTipX * s,
        earTipY * s
      );
      g.quadraticCurveTo(
        (earBaseX + earSide * 1) * s,
        (earBaseY - 2) * s,
        earBaseX * s,
        (earBaseY - 1.5) * s
      );
      g.closePath();
      g.stroke({ width: s * 0.4, color: darken(p.skin, 0.2), alpha: 0.35 });

      // Inner ear
      g.moveTo(earBaseX * s, (earBaseY + 1) * s);
      g.quadraticCurveTo(
        (earBaseX + earSide * 1.5) * s,
        (earBaseY - 0.5) * s,
        (earTipX - earSide * 0.5) * s,
        (earTipY + 1.5) * s
      );
      g.stroke({ width: s * 0.4, color: darken(p.skin, 0.15), alpha: 0.3 });
    } else if (faceCam) {
      // Front view — show both ear tips poking out
      for (const earSide of [-1, 1]) {
        const earBaseX = head.x + earSide * r * wf * 0.85;
        const earTipX = earBaseX + earSide * 3.5;
        const earTipY = head.y - 3.5;

        g.moveTo(earBaseX * s, (head.y + 1) * s);
        g.quadraticCurveTo(
          (earBaseX + earSide * 1.5) * s,
          (head.y - 1) * s,
          earTipX * s,
          earTipY * s
        );
        g.quadraticCurveTo(
          (earBaseX + earSide * 0.5) * s,
          (head.y - 1.5) * s,
          earBaseX * s,
          (head.y - 1) * s
        );
        g.closePath();
        g.fill(p.skin);
      }
    }

    // Head shape (slightly more angular — taller ellipse)
    g.ellipse(head.x * s, head.y * s, r * wf * s, (r + 0.5) * s);
    g.fill(p.skin);
    if (faceCam) {
      // Angular jaw — slightly pointed chin
      g.ellipse(head.x * s, (head.y + 2.5) * s, (r - 1) * wf * s, (r - 1.5) * s);
      g.fill(p.skin);
    }
    g.ellipse(head.x * s, head.y * s, r * wf * s, (r + 0.5) * s);
    g.stroke({ width: s * 0.5, color: darken(p.skin, 0.25), alpha: 0.35 });

    // Eyes — slightly larger, more almond-shaped
    if (faceCam || (sideView && iso.y >= -0.1)) {
      const spread = 2.6 * wf;
      const eyeY = head.y + 0.3 + iso.y * 1.2;
      const eyeOX = head.x + iso.x * 1;

      // Almond eye whites (wider, thinner)
      g.ellipse((eyeOX - spread) * s, eyeY * s, 2 * s, 1.2 * s);
      g.fill(0xffffff);
      g.ellipse((eyeOX + spread) * s, eyeY * s, 2 * s, 1.2 * s);
      g.fill(0xffffff);

      // Iris
      g.circle((eyeOX - spread + iso.x * 0.5) * s, (eyeY + 0.05) * s, 1.1 * s);
      g.fill(p.eyes);
      g.circle((eyeOX + spread + iso.x * 0.5) * s, (eyeY + 0.05) * s, 1.1 * s);
      g.fill(p.eyes);

      // Pupils
      g.circle((eyeOX - spread + iso.x * 0.7) * s, (eyeY + 0.1) * s, 0.45 * s);
      g.fill(0x111111);
      g.circle((eyeOX + spread + iso.x * 0.7) * s, (eyeY + 0.1) * s, 0.45 * s);
      g.fill(0x111111);

      // Elegant eyebrows (slightly arched)
      g.moveTo((eyeOX - spread - 1.5) * s, (eyeY - 2.2) * s);
      g.quadraticCurveTo(
        (eyeOX - spread) * s,
        (eyeY - 2.8) * s,
        (eyeOX - spread + 1.5) * s,
        (eyeY - 2.3) * s
      );
      g.moveTo((eyeOX + spread - 1.5) * s, (eyeY - 2.3) * s);
      g.quadraticCurveTo(
        (eyeOX + spread) * s,
        (eyeY - 2.8) * s,
        (eyeOX + spread + 1.5) * s,
        (eyeY - 2.2) * s
      );
      g.stroke({ width: s * 0.5, color: darken(p.skin, 0.25), alpha: 0.4 });

      // Mouth (thinner, more composed)
      if (faceCam) {
        const mouthY = head.y + 3.8 + iso.y * 0.5;
        g.moveTo((head.x - 1.2 * wf) * s, mouthY * s);
        g.quadraticCurveTo(
          head.x * s,
          (mouthY + 0.3) * s,
          (head.x + 1.2 * wf) * s,
          mouthY * s
        );
        g.stroke({ width: s * 0.4, color: darken(p.skin, 0.2), alpha: 0.35 });
      }
    }
  }

  // ─── Helpers ─────────────────────────────────────────────────────

  /** Scale an x-coordinate by the slim factor */
  private slim(joint: V): V {
    return { x: joint.x * this.SLIM, y: joint.y };
  }
}
