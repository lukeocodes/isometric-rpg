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
 * Dwarf body model — shorter, wider, stocky proportions.
 * Barrel chest, thick limbs, broad shoulders, strong jaw.
 *
 * Anatomy reference (relative to human):
 * - ~20% shorter overall
 * - ~25% wider shoulders and chest
 * - Thicker limbs, shorter legs proportionally
 * - Wider head, stronger brow ridge
 * - Round ears (not pointed)
 */
export class DwarfBody implements Model {
  readonly id = "dwarf-body";
  readonly name = "Dwarf Body";
  readonly category = "body" as const;
  readonly slot = "root" as const;

  // Dwarf proportions
  private readonly WIDE = 1.25;  // wider torso
  private readonly COMPRESS = 0.85; // squash Y to make shorter

  getDrawCalls(ctx: RenderContext): DrawCall[] {
    const { skeleton, palette, farSide, nearSide, facingCamera } = ctx;
    const j = skeleton.joints;
    const calls: DrawCall[] = [];

    // Shadow (wider)
    calls.push({
      depth: 0,
      draw: (g, s) => {
        g.ellipse(0, 2 * s, 15 * s, 5.5 * s);
        g.fill({ color: 0x000000, alpha: 0.22 });
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
    // Stamp all attachment points with dwarf's proportions so equipment scales correctly
    const W = this.WIDE;
    return Object.fromEntries(
      Object.entries(skeleton.attachments).map(([slot, pt]) => [
        slot,
        { ...pt, params: { size: W, ratio: { x: W, y: 1 }, offset: { x: 0, y: 0 } } },
      ])
    );
  }

  // ─── TORSO (barrel chest, wide) ─────────────────────────────────

  private drawTorso(g: Graphics, j: Record<string, V>, p: ModelPalette, s: number): void {
    const chestL = this.widen(j.chestL);
    const chestR = this.widen(j.chestR);
    const waistL = this.widen(j.waistL);
    const waistR = this.widen(j.waistR);
    const hipL = this.widen(j.hipL);
    const hipR = this.widen(j.hipR);
    const neckBase = j.neckBase;

    // Main torso
    this.torsoPath(g, j, s);
    g.fill(p.body);

    // Shadow side
    g.moveTo(neckBase.x * s, neckBase.y * s);
    g.quadraticCurveTo(chestR.x * s, (chestR.y - 1) * s, chestR.x * s, chestR.y * s);
    g.quadraticCurveTo(
      (chestR.x + 0.8) * s,
      ((chestR.y + waistR.y) / 2) * s,
      waistR.x * s,
      waistR.y * s
    );
    g.quadraticCurveTo(
      (waistR.x + 1.2) * s,
      ((waistR.y + hipR.y) / 2) * s,
      hipR.x * s,
      hipR.y * s
    );
    g.lineTo(((hipR.x + hipL.x) / 2) * s, hipR.y * s);
    g.lineTo(((waistR.x + neckBase.x) / 2) * s, neckBase.y * s);
    g.closePath();
    g.fill({ color: p.bodyDk, alpha: 0.35 });

    // Outline
    this.torsoPath(g, j, s);
    g.stroke({ width: s * 0.8, color: p.outline, alpha: 0.5 });

    // Neck (shorter, thicker)
    const nw = 4 * (Math.abs(chestR.x - chestL.x) / 16);
    g.roundRect(
      (neckBase.x - nw / 2) * s,
      (neckBase.y - 1.5) * s,
      nw * s,
      2.5 * s,
      1.5 * s
    );
    g.fill(p.skin);
  }

  private torsoPath(g: Graphics, j: Record<string, V>, s: number): void {
    const chestL = this.widen(j.chestL);
    const chestR = this.widen(j.chestR);
    const waistL = this.widen(j.waistL);
    const waistR = this.widen(j.waistR);
    const hipL = this.widen(j.hipL);
    const hipR = this.widen(j.hipR);
    const neckBase = j.neckBase;

    g.moveTo(neckBase.x * s, neckBase.y * s);
    g.quadraticCurveTo(chestR.x * s, (chestR.y - 1) * s, chestR.x * s, chestR.y * s);
    g.quadraticCurveTo(
      (chestR.x + 0.8) * s,
      ((chestR.y + waistR.y) / 2) * s,
      waistR.x * s,
      waistR.y * s
    );
    g.quadraticCurveTo(
      (waistR.x + 1.2) * s,
      ((waistR.y + hipR.y) / 2) * s,
      hipR.x * s,
      hipR.y * s
    );
    g.lineTo(hipL.x * s, hipL.y * s);
    g.quadraticCurveTo(
      (waistL.x - 1.2) * s,
      ((waistL.y + hipL.y) / 2) * s,
      waistL.x * s,
      waistL.y * s
    );
    g.quadraticCurveTo(
      (chestL.x - 0.8) * s,
      ((chestL.y + waistL.y) / 2) * s,
      chestL.x * s,
      chestL.y * s
    );
    g.quadraticCurveTo(chestL.x * s, (chestL.y - 1) * s, neckBase.x * s, neckBase.y * s);
    g.closePath();
  }

  // ─── PELVIS ──────────────────────────────────────────────────────

  private drawPelvis(g: Graphics, j: Record<string, V>, p: ModelPalette, s: number): void {
    const hipL = this.widen(j.hipL);
    const hipR = this.widen(j.hipR);
    const crotch = j.crotch;
    const legColor = p.skin;

    g.moveTo(hipL.x * s, hipL.y * s);
    g.quadraticCurveTo(
      (hipL.x - 1.2) * s,
      ((hipL.y + crotch.y) / 2) * s,
      ((hipL.x + crotch.x) / 2 - 0.6) * s,
      crotch.y * s
    );
    g.quadraticCurveTo(
      crotch.x * s,
      (crotch.y + 2) * s,
      ((hipR.x + crotch.x) / 2 + 0.6) * s,
      crotch.y * s
    );
    g.quadraticCurveTo(
      (hipR.x + 1.2) * s,
      ((hipR.y + crotch.y) / 2) * s,
      hipR.x * s,
      hipR.y * s
    );
    g.closePath();
    g.fill(legColor);

    // Inner thigh shading
    g.moveTo(((hipL.x + crotch.x) / 2 - 0.6) * s, crotch.y * s);
    g.quadraticCurveTo(
      crotch.x * s,
      (crotch.y + 2) * s,
      ((hipR.x + crotch.x) / 2 + 0.6) * s,
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
    const hipL = this.widen(j.hipL);
    const hipR = this.widen(j.hipR);
    const legColor = p.skin;
    const cheekColor = lighten(legColor, 0.05);

    const cheekW = 5.5 * sk.wf;
    const cheekH = 4.5;
    const cheekY = hipL.y + 0.5;
    const cheekLX = hipL.x * 0.4;
    const cheekRX = hipR.x * 0.4;

    g.ellipse(cheekLX * s, cheekY * s, cheekW * s, cheekH * s);
    g.fill(cheekColor);
    g.ellipse(cheekLX * s, cheekY * s, cheekW * s, cheekH * s);
    g.stroke({ width: s * 0.5, color: darken(legColor, 0.15), alpha: 0.4 });

    g.ellipse(cheekRX * s, cheekY * s, cheekW * s, cheekH * s);
    g.fill(cheekColor);
    g.ellipse(cheekRX * s, cheekY * s, cheekW * s, cheekH * s);
    g.stroke({ width: s * 0.5, color: darken(legColor, 0.15), alpha: 0.4 });

    // Cleft
    g.moveTo(j.crotch.x * s, (hipL.y - 1.5) * s);
    g.quadraticCurveTo(
      (j.crotch.x - 0.2) * s,
      cheekY * s,
      j.crotch.x * s,
      (cheekY + cheekH) * s
    );
    g.stroke({ width: s * 0.7, color: darken(legColor, 0.22), alpha: 0.6 });
  }

  // ─── LEG (shorter, thicker) ─────────────────────────────────────

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

    const legTop: V = { x: hip.x * 0.5 * this.WIDE, y: hip.y };
    const legColor = p.skin;
    const legDk = darken(legColor, 0.2);
    const legOutline = darken(legColor, 0.35);

    // Thigh — much thicker
    drawTaperedLimb(g, legTop, knee, 7, 5.5, legColor, legDk, legOutline, s);

    // Knee — big and knobbly
    g.ellipse(knee.x * s, knee.y * s, 3.5 * s, 2.2 * s);
    g.fill(legColor);
    g.ellipse(knee.x * s, knee.y * s, 3.5 * s, 2.2 * s);
    g.stroke({ width: s * 0.4, color: darken(legColor, 0.2), alpha: 0.3 });

    // Calf — thick
    drawTaperedLimb(g, knee, ankle, 5.5, 4, legColor, legDk, legOutline, s);
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
    const bootColor = darken(p.skin, 0.22);
    const iso = sk.iso;

    const footLen = 4.5; // bigger feet
    const fwdX = iso.x * footLen;
    const fwdY = iso.y * footLen * 0.5;
    const tipX = ankle.x + fwdX;
    const tipY = ankle.y + fwdY + 1.8;

    const fdx = tipX - ankle.x;
    const fdy = tipY - ankle.y;
    const flen = Math.sqrt(fdx * fdx + fdy * fdy);
    const pnx = flen > 0.3 ? -fdy / flen : 1;
    const pny = flen > 0.3 ? fdx / flen : 0;
    const hw = 2.8; // wider
    const tw = 1.6;

    g.moveTo((ankle.x + pnx * hw) * s, (ankle.y + pny * hw) * s);
    g.lineTo((tipX + pnx * tw) * s, (tipY + pny * tw) * s);
    g.quadraticCurveTo(
      (tipX + fdx / flen * 2) * s,
      (tipY + fdy / flen * 1.2) * s,
      (tipX - pnx * tw) * s,
      (tipY - pny * tw) * s
    );
    g.lineTo((ankle.x - pnx * hw) * s, (ankle.y - pny * hw) * s);
    g.closePath();
    g.fill(bootColor);
    g.moveTo((ankle.x + pnx * hw) * s, (ankle.y + pny * hw) * s);
    g.lineTo((tipX + pnx * tw) * s, (tipY + pny * tw) * s);
    g.quadraticCurveTo(
      (tipX + fdx / flen * 2) * s,
      (tipY + fdy / flen * 1.2) * s,
      (tipX - pnx * tw) * s,
      (tipY - pny * tw) * s
    );
    g.lineTo((ankle.x - pnx * hw) * s, (ankle.y - pny * hw) * s);
    g.closePath();
    g.stroke({ width: s * 0.5, color: darken(bootColor, 0.3), alpha: 0.45 });

    // Sole
    g.moveTo((ankle.x - pnx * hw) * s, (ankle.y - pny * hw) * s);
    g.lineTo((tipX - pnx * tw) * s, (tipY - pny * tw) * s);
    g.stroke({ width: s * 0.6, color: darken(bootColor, 0.35), alpha: 0.5 });
  }

  // ─── ARM (thick, strong) ────────────────────────────────────────

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
    const armDk = darken(p.skin, 0.22);
    const armOutline = darken(p.skin, 0.35);

    // Upper arm — thick
    drawTaperedLimb(g, shoulder, elbow, 5, 4.2, armColor, armDk, armOutline, s);

    // Elbow — beefy
    g.circle(elbow.x * s, elbow.y * s, 2.6 * s);
    g.fill(armColor);
    g.circle(elbow.x * s, elbow.y * s, 2.6 * s);
    g.stroke({ width: s * 0.4, color: armOutline, alpha: 0.35 });

    // Forearm — thick
    drawTaperedLimb(g, elbow, wrist, 4, 3.2, armColor, armDk, armOutline, s);

    // Hand — big meaty paws
    g.circle(wrist.x * s, wrist.y * s, 2.8 * s);
    g.fill(p.skin);
    g.circle(wrist.x * s, wrist.y * s, 2.8 * s);
    g.stroke({ width: s * 0.4, color: darken(p.skin, 0.25), alpha: 0.35 });
  }

  // ─── HEAD (wider, strong jaw, prominent brow) ───────────────────

  private drawHead(
    g: Graphics,
    j: Record<string, V>,
    sk: Skeleton,
    p: ModelPalette,
    s: number
  ): void {
    const head = j.head;
    const { wf, iso } = sk;
    const r = 8; // bigger head
    const faceCam = iso.y > 0;
    const sideView = Math.abs(iso.x) > 0.3;

    // Round ears (small, close to head)
    if (sideView) {
      const earSide = iso.x > 0 ? 1 : -1;
      const earX = head.x + earSide * r * wf * 0.82;
      g.ellipse(earX * s, (head.y + 1) * s, 2 * s, 2.8 * s);
      g.fill(p.skin);
      g.ellipse(earX * s, (head.y + 1) * s, 1.2 * s, 1.7 * s);
      g.fill(darken(p.skin, 0.12));
    }

    // Head shape (wider, squarish)
    g.ellipse(head.x * s, head.y * s, (r + 0.5) * wf * s, r * s);
    g.fill(p.skin);

    // Strong jaw (wider chin area)
    if (faceCam) {
      g.ellipse(head.x * s, (head.y + 2) * s, (r + 0.5) * wf * s, (r - 1.5) * s);
      g.fill(p.skin);
    }

    // Brow ridge (prominent)
    if (faceCam || (sideView && iso.y >= -0.1)) {
      const browY = head.y - 2;
      const browW = (r - 1) * wf;
      g.moveTo((head.x - browW) * s, browY * s);
      g.quadraticCurveTo(
        head.x * s,
        (browY - 1.2) * s,
        (head.x + browW) * s,
        browY * s
      );
      g.stroke({ width: s * 1.2, color: darken(p.skin, 0.15), alpha: 0.35 });
    }

    // Outline
    g.ellipse(head.x * s, head.y * s, (r + 0.5) * wf * s, r * s);
    g.stroke({ width: s * 0.7, color: darken(p.skin, 0.3), alpha: 0.45 });

    // Eyes — smaller, deep-set under brow
    if (faceCam || (sideView && iso.y >= -0.1)) {
      const spread = 3 * wf;
      const eyeY = head.y + 1 + iso.y * 1;
      const eyeOX = head.x + iso.x * 0.8;

      // Smaller, deeper eyes
      g.ellipse((eyeOX - spread) * s, eyeY * s, 1.6 * s, 1.2 * s);
      g.fill(0xffffff);
      g.ellipse((eyeOX + spread) * s, eyeY * s, 1.6 * s, 1.2 * s);
      g.fill(0xffffff);

      g.circle((eyeOX - spread + iso.x * 0.5) * s, (eyeY + 0.1) * s, 1 * s);
      g.fill(p.eyes);
      g.circle((eyeOX + spread + iso.x * 0.5) * s, (eyeY + 0.1) * s, 1 * s);
      g.fill(p.eyes);

      g.circle((eyeOX - spread + iso.x * 0.7) * s, (eyeY + 0.15) * s, 0.5 * s);
      g.fill(0x111111);
      g.circle((eyeOX + spread + iso.x * 0.7) * s, (eyeY + 0.15) * s, 0.5 * s);
      g.fill(0x111111);

      // Thick eyebrows
      g.moveTo((eyeOX - spread - 1.8) * s, (eyeY - 1.8) * s);
      g.lineTo((eyeOX - spread + 1.8) * s, (eyeY - 2.2) * s);
      g.moveTo((eyeOX + spread - 1.8) * s, (eyeY - 2.2) * s);
      g.lineTo((eyeOX + spread + 1.8) * s, (eyeY - 1.8) * s);
      g.stroke({ width: s * 1, color: darken(p.skin, 0.35), alpha: 0.55 });

      // Nose (broader)
      if (faceCam) {
        const noseY = head.y + 2 + iso.y * 0.5;
        g.moveTo((head.x - 1.5 * wf) * s, noseY * s);
        g.quadraticCurveTo(
          (head.x - 0.5) * s,
          (noseY + 1.5) * s,
          head.x * s,
          (noseY + 1) * s
        );
        g.quadraticCurveTo(
          (head.x + 0.5) * s,
          (noseY + 1.5) * s,
          (head.x + 1.5 * wf) * s,
          noseY * s
        );
        g.stroke({ width: s * 0.5, color: darken(p.skin, 0.2), alpha: 0.3 });
      }

      // Mouth (wider, stern)
      if (faceCam) {
        const mouthY = head.y + 4 + iso.y * 0.5;
        g.moveTo((head.x - 2 * wf) * s, mouthY * s);
        g.lineTo((head.x + 2 * wf) * s, mouthY * s);
        g.stroke({ width: s * 0.6, color: darken(p.skin, 0.25), alpha: 0.45 });
      }
    }
  }

  // ─── Helpers ─────────────────────────────────────────────────────

  /** Widen x-coordinates for stocky build */
  private widen(joint: V): V {
    return { x: joint.x * this.WIDE, y: joint.y };
  }
}
