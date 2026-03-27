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
 * The naked human body model. Provides attachment points for all
 * equipment slots. Draws torso, pelvis, glutes, legs, feet, arms,
 * and head (skin + eyes only — no hair, helmet, or armor).
 */
export class HumanBody implements Model {
  readonly id = "human-body";
  readonly name = "Human Body";
  readonly category = "body" as const;
  readonly slot = "root" as const;

  getDrawCalls(ctx: RenderContext): DrawCall[] {
    const { skeleton, palette, farSide, nearSide, facingCamera } = ctx;
    const j = skeleton.joints;
    const calls: DrawCall[] = [];

    // Shadow
    calls.push({
      depth: 0,
      draw: (g, s) => {
        g.ellipse(0, 2 * s, 13 * s, 5 * s);
        g.fill({ color: 0x000000, alpha: 0.2 });
      },
    });

    // Both legs (always behind torso)
    calls.push({ depth: 10, draw: (g, s) => this.drawLeg(g, j, palette, s, farSide) });
    calls.push({ depth: 11, draw: (g, s) => this.drawFoot(g, j, skeleton, palette, s, farSide) });
    calls.push({ depth: 12, draw: (g, s) => this.drawLeg(g, j, palette, s, nearSide) });
    calls.push({ depth: 13, draw: (g, s) => this.drawFoot(g, j, skeleton, palette, s, nearSide) });

    // Far arm
    calls.push({
      depth: facingCamera ? 20 : 45,
      draw: (g, s) => this.drawArm(g, j, palette, s, farSide),
    });

    // Glutes (back views only)
    if (!facingCamera) {
      calls.push({ depth: 26, draw: (g, s) => this.drawGlutes(g, j, skeleton, palette, s) });
    }

    // Torso
    calls.push({ depth: 30, draw: (g, s) => this.drawTorso(g, j, palette, s) });

    // Pelvis
    calls.push({ depth: 32, draw: (g, s) => this.drawPelvis(g, j, palette, s) });

    // Head (skin, eyes, ears — no hair)
    calls.push({ depth: 50, draw: (g, s) => this.drawHead(g, j, skeleton, palette, s) });

    // Near arm
    calls.push({
      depth: facingCamera ? 59 : 24,
      draw: (g, s) => this.drawArm(g, j, palette, s, nearSide),
    });

    return calls;
  }

  getAttachmentPoints(skeleton: Skeleton): Record<string, AttachmentPoint> {
    return skeleton.attachments; // neutral params (size=1, ratio=1,1, offset=0,0)
  }

  // ─── TORSO ────────────────────────────────────────────────────────

  private drawTorso(
    g: Graphics,
    j: Record<string, V>,
    p: ModelPalette,
    s: number
  ): void {
    const { chestL, chestR, waistL, waistR, hipL, hipR, neckBase } = j;

    // Main torso shape — bare skin
    this.torsoPath(g, j, s);
    g.fill(p.skin);

    // Shadow side
    g.moveTo(neckBase.x * s, neckBase.y * s);
    g.quadraticCurveTo(chestR.x * s, (chestR.y - 1) * s, chestR.x * s, chestR.y * s);
    g.quadraticCurveTo(
      (chestR.x + 0.5) * s,
      ((chestR.y + waistR.y) / 2) * s,
      waistR.x * s,
      waistR.y * s
    );
    g.quadraticCurveTo(
      (waistR.x + 1) * s,
      ((waistR.y + hipR.y) / 2) * s,
      hipR.x * s,
      hipR.y * s
    );
    g.lineTo(((hipR.x + hipL.x) / 2) * s, hipR.y * s);
    g.lineTo(((waistR.x + neckBase.x) / 2) * s, neckBase.y * s);
    g.closePath();
    g.fill({ color: darken(p.skin, 0.2), alpha: 0.3 });

    // Outline — skin-toned to match arms/legs
    this.torsoPath(g, j, s);
    g.stroke({ width: s * 0.5, color: darken(p.skin, 0.3), alpha: 0.4 });

    // Neck
    const nw = 3 * (Math.abs(chestR.x - chestL.x) / 16);
    g.roundRect(
      (neckBase.x - nw / 2) * s,
      (neckBase.y - 2) * s,
      nw * s,
      3 * s,
      1.5 * s
    );
    g.fill(p.skin);
  }

  private torsoPath(g: Graphics, j: Record<string, V>, s: number): void {
    const { chestL, chestR, waistL, waistR, hipL, hipR, neckBase } = j;
    g.moveTo(neckBase.x * s, neckBase.y * s);
    g.quadraticCurveTo(chestR.x * s, (chestR.y - 1) * s, chestR.x * s, chestR.y * s);
    g.quadraticCurveTo(
      (chestR.x + 0.5) * s,
      ((chestR.y + waistR.y) / 2) * s,
      waistR.x * s,
      waistR.y * s
    );
    g.quadraticCurveTo(
      (waistR.x + 1) * s,
      ((waistR.y + hipR.y) / 2) * s,
      hipR.x * s,
      hipR.y * s
    );
    g.lineTo(hipL.x * s, hipL.y * s);
    g.quadraticCurveTo(
      (waistL.x - 1) * s,
      ((waistL.y + hipL.y) / 2) * s,
      waistL.x * s,
      waistL.y * s
    );
    g.quadraticCurveTo(
      (chestL.x - 0.5) * s,
      ((chestL.y + waistL.y) / 2) * s,
      chestL.x * s,
      chestL.y * s
    );
    g.quadraticCurveTo(chestL.x * s, (chestL.y - 1) * s, neckBase.x * s, neckBase.y * s);
    g.closePath();
  }

  // ─── PELVIS ───────────────────────────────────────────────────────

  private drawPelvis(
    g: Graphics,
    j: Record<string, V>,
    p: ModelPalette,
    s: number
  ): void {
    const { hipL, hipR, crotch } = j;
    const legColor = this.legColor(p);

    g.moveTo(hipL.x * s, hipL.y * s);
    g.quadraticCurveTo(
      (hipL.x - 1) * s,
      ((hipL.y + crotch.y) / 2) * s,
      ((hipL.x + crotch.x) / 2 - 0.5) * s,
      crotch.y * s
    );
    g.quadraticCurveTo(
      crotch.x * s,
      (crotch.y + 1.5) * s,
      ((hipR.x + crotch.x) / 2 + 0.5) * s,
      crotch.y * s
    );
    g.quadraticCurveTo(
      (hipR.x + 1) * s,
      ((hipR.y + crotch.y) / 2) * s,
      hipR.x * s,
      hipR.y * s
    );
    g.closePath();
    g.fill(legColor);

    // Inner thigh shading
    g.moveTo(((hipL.x + crotch.x) / 2 - 0.5) * s, crotch.y * s);
    g.quadraticCurveTo(
      crotch.x * s,
      (crotch.y + 1.5) * s,
      ((hipR.x + crotch.x) / 2 + 0.5) * s,
      crotch.y * s
    );
    g.lineTo(crotch.x * s, (crotch.y - 1) * s);
    g.closePath();
    g.fill({ color: darken(legColor, 0.2), alpha: 0.4 });
  }

  // ─── GLUTES ───────────────────────────────────────────────────────

  private drawGlutes(
    g: Graphics,
    j: Record<string, V>,
    sk: Skeleton,
    p: ModelPalette,
    s: number
  ): void {
    const { hipL, hipR, crotch } = j;
    const legColor = this.legColor(p);
    const cheekColor = lighten(legColor, 0.05);

    const cheekW = 4.5 * sk.wf;
    const cheekH = 4;
    const cheekY = hipL.y + 0.5;
    const cheekLX = hipL.x * 0.4;
    const cheekRX = hipR.x * 0.4;

    // Left cheek
    g.ellipse(cheekLX * s, cheekY * s, cheekW * s, cheekH * s);
    g.fill(cheekColor);
    g.ellipse(cheekLX * s, cheekY * s, cheekW * s, cheekH * s);
    g.stroke({ width: s * 0.5, color: darken(legColor, 0.15), alpha: 0.4 });

    // Right cheek
    g.ellipse(cheekRX * s, cheekY * s, cheekW * s, cheekH * s);
    g.fill(cheekColor);
    g.ellipse(cheekRX * s, cheekY * s, cheekW * s, cheekH * s);
    g.stroke({ width: s * 0.5, color: darken(legColor, 0.15), alpha: 0.4 });

    // Cleft
    g.moveTo(crotch.x * s, (hipL.y - 1.5) * s);
    g.quadraticCurveTo(
      (crotch.x - 0.2) * s,
      cheekY * s,
      crotch.x * s,
      (cheekY + cheekH) * s
    );
    g.stroke({ width: s * 0.7, color: darken(legColor, 0.22), alpha: 0.6 });

    // Underglute creases
    g.moveTo((cheekLX - cheekW * 0.6) * s, (cheekY + cheekH * 0.65) * s);
    g.quadraticCurveTo(
      cheekLX * s,
      (cheekY + cheekH * 0.85) * s,
      (cheekLX + cheekW * 0.4) * s,
      (cheekY + cheekH * 0.55) * s
    );
    g.moveTo((cheekRX + cheekW * 0.6) * s, (cheekY + cheekH * 0.65) * s);
    g.quadraticCurveTo(
      cheekRX * s,
      (cheekY + cheekH * 0.85) * s,
      (cheekRX - cheekW * 0.4) * s,
      (cheekY + cheekH * 0.55) * s
    );
    g.stroke({ width: s * 0.5, color: darken(legColor, 0.18), alpha: 0.45 });
  }

  // ─── LEG ──────────────────────────────────────────────────────────

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
    const legColor = this.legColor(p);
    const legDk = darken(legColor, 0.2);
    const legOutline = darken(legColor, 0.35);

    // Thigh
    drawTaperedLimb(g, legTop, knee, 5.5, 4, legColor, legDk, legOutline, s);

    // Knee
    g.ellipse(knee.x * s, knee.y * s, 2.8 * s, 1.8 * s);
    g.fill(legColor);
    g.ellipse(knee.x * s, knee.y * s, 2.8 * s, 1.8 * s);
    g.stroke({ width: s * 0.3, color: darken(legColor, 0.2), alpha: 0.25 });

    // Calf
    drawTaperedLimb(g, knee, ankle, 4.5, 3, legColor, darken(legColor, 0.2), darken(legColor, 0.35), s);
  }

  // ─── FOOT ─────────────────────────────────────────────────────────

  private drawFoot(
    g: Graphics,
    j: Record<string, V>,
    sk: Skeleton,
    p: ModelPalette,
    s: number,
    side: "L" | "R"
  ): void {
    const ankle = j[`ankle${side}`];
    const bootColor = darken(p.skin, 0.2);
    const iso = sk.iso;

    const footLen = 4;
    const fwdX = iso.x * footLen;
    const fwdY = iso.y * footLen * 0.5;
    const tipX = ankle.x + fwdX;
    const tipY = ankle.y + fwdY + 1.5;

    const fdx = tipX - ankle.x;
    const fdy = tipY - ankle.y;
    const flen = Math.sqrt(fdx * fdx + fdy * fdy);
    const pnx = flen > 0.3 ? -fdy / flen : 1;
    const pny = flen > 0.3 ? fdx / flen : 0;
    const hw = 2;
    const tw = 1.2;

    g.moveTo((ankle.x + pnx * hw) * s, (ankle.y + pny * hw) * s);
    g.lineTo((tipX + pnx * tw) * s, (tipY + pny * tw) * s);
    g.quadraticCurveTo(
      (tipX + fdx / flen * 1.5) * s,
      (tipY + fdy / flen * 1) * s,
      (tipX - pnx * tw) * s,
      (tipY - pny * tw) * s
    );
    g.lineTo((ankle.x - pnx * hw) * s, (ankle.y - pny * hw) * s);
    g.closePath();
    g.fill(bootColor);

    // Outline
    g.moveTo((ankle.x + pnx * hw) * s, (ankle.y + pny * hw) * s);
    g.lineTo((tipX + pnx * tw) * s, (tipY + pny * tw) * s);
    g.quadraticCurveTo(
      (tipX + fdx / flen * 1.5) * s,
      (tipY + fdy / flen * 1) * s,
      (tipX - pnx * tw) * s,
      (tipY - pny * tw) * s
    );
    g.lineTo((ankle.x - pnx * hw) * s, (ankle.y - pny * hw) * s);
    g.closePath();
    g.stroke({ width: s * 0.4, color: darken(bootColor, 0.3), alpha: 0.4 });

    // Sole line
    g.moveTo((ankle.x - pnx * hw) * s, (ankle.y - pny * hw) * s);
    g.lineTo((tipX - pnx * tw) * s, (tipY - pny * tw) * s);
    g.stroke({ width: s * 0.5, color: darken(bootColor, 0.35), alpha: 0.5 });
  }

  // ─── ARM ──────────────────────────────────────────────────────────

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
    const armDk = darken(p.skin, 0.2);
    const armOutline = darken(p.skin, 0.3);

    // Upper arm
    drawTaperedLimb(g, shoulder, elbow, 3.8, 3.2, armColor, armDk, armOutline, s);

    // Elbow joint
    g.circle(elbow.x * s, elbow.y * s, 2 * s);
    g.fill(armColor);
    g.circle(elbow.x * s, elbow.y * s, 2 * s);
    g.stroke({ width: s * 0.4, color: armOutline, alpha: 0.3 });

    // Forearm
    drawTaperedLimb(g, elbow, wrist, 3, 2.5, armColor, armDk, armOutline, s);

    // Hand
    g.circle(wrist.x * s, wrist.y * s, 2.2 * s);
    g.fill(p.skin);
    g.circle(wrist.x * s, wrist.y * s, 2.2 * s);
    g.stroke({ width: s * 0.3, color: darken(p.skin, 0.25), alpha: 0.3 });
  }

  // ─── HEAD (skin only — no hair, helmet, or armor) ─────────────────

  private drawHead(
    g: Graphics,
    j: Record<string, V>,
    sk: Skeleton,
    p: ModelPalette,
    s: number
  ): void {
    const head = j.head;
    const { wf, iso } = sk;
    const r = 7;
    const faceCam = iso.y > 0;
    const sideView = Math.abs(iso.x) > 0.3;

    // Ears (visible from side)
    if (sideView) {
      const earSide = iso.x > 0 ? 1 : -1;
      const earX = head.x + earSide * r * wf * 0.85;
      g.ellipse(earX * s, (head.y + 1) * s, 1.8 * s, 2.5 * s);
      g.fill(p.skin);
      g.ellipse(earX * s, (head.y + 1) * s, 1 * s, 1.5 * s);
      g.fill(darken(p.skin, 0.15));
    }

    // Head shape
    g.ellipse(head.x * s, head.y * s, r * wf * s, r * s);
    g.fill(p.skin);
    if (faceCam) {
      g.ellipse(head.x * s, (head.y + 2) * s, (r - 0.5) * wf * s, (r - 2) * s);
      g.fill(p.skin);
    }
    g.ellipse(head.x * s, head.y * s, r * wf * s, r * s);
    g.stroke({ width: s * 0.6, color: darken(p.skin, 0.3), alpha: 0.4 });

    // Eyes (visible when facing camera or from side)
    if (faceCam || (sideView && iso.y >= -0.1)) {
      const spread = 2.8 * wf;
      const eyeY = head.y + 0.5 + iso.y * 1.2;
      const eyeOX = head.x + iso.x * 1;

      g.ellipse((eyeOX - spread) * s, eyeY * s, 1.8 * s, 1.4 * s);
      g.fill(0xffffff);
      g.ellipse((eyeOX + spread) * s, eyeY * s, 1.8 * s, 1.4 * s);
      g.fill(0xffffff);

      g.circle((eyeOX - spread + iso.x * 0.5) * s, (eyeY + 0.1) * s, 1.1 * s);
      g.fill(p.eyes);
      g.circle((eyeOX + spread + iso.x * 0.5) * s, (eyeY + 0.1) * s, 1.1 * s);
      g.fill(p.eyes);

      g.circle((eyeOX - spread + iso.x * 0.7) * s, (eyeY + 0.15) * s, 0.5 * s);
      g.fill(0x111111);
      g.circle((eyeOX + spread + iso.x * 0.7) * s, (eyeY + 0.15) * s, 0.5 * s);
      g.fill(0x111111);

      // Eyebrows
      g.moveTo((eyeOX - spread - 1.2) * s, (eyeY - 2) * s);
      g.lineTo((eyeOX - spread + 1.2) * s, (eyeY - 2.2) * s);
      g.moveTo((eyeOX + spread - 1.2) * s, (eyeY - 2.2) * s);
      g.lineTo((eyeOX + spread + 1.2) * s, (eyeY - 2) * s);
      g.stroke({ width: s * 0.7, color: darken(p.skin, 0.3), alpha: 0.5 });

      // Mouth
      if (faceCam) {
        const mouthY = head.y + 3.5 + iso.y * 0.5;
        g.moveTo((head.x - 1.5 * wf) * s, mouthY * s);
        g.quadraticCurveTo(
          head.x * s,
          (mouthY + 0.5) * s,
          (head.x + 1.5 * wf) * s,
          mouthY * s
        );
        g.stroke({ width: s * 0.5, color: darken(p.skin, 0.25), alpha: 0.4 });
      }
    }
  }

  // ─── Helpers ──────────────────────────────────────────────────────

  private legColor(p: ModelPalette): number {
    return p.skin;
  }
}
