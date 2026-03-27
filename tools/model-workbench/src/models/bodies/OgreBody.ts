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
 * Ogre NPC — massive, hulking humanoid.
 * Very wide body, thick limbs, small head, hunched posture.
 * Grey-green skin with warts, underbite, beady eyes.
 * CAN hold weapons (hand-R, hand-L).
 *
 * Anatomy: ~150% human width, ~110% height.
 * Proportionally small head, massive torso, tree-trunk limbs.
 */
export class OgreBody implements Model {
  readonly id = "ogre-body";
  readonly name = "Ogre";
  readonly category = "npc" as const;
  readonly slot = "root" as const;

  private readonly SKIN = 0x6a7a5a;     // grey-green
  private readonly SKIN_DK = 0x4a5a3a;  // dark
  private readonly SKIN_LT = 0x8a9a7a;  // lighter
  private readonly BELLY = 0x7a8a6a;    // belly tone
  private readonly EYE = 0xcc8800;      // dull amber

  getDrawCalls(ctx: RenderContext): DrawCall[] {
    const { skeleton, facingCamera, nearSide, farSide } = ctx;
    const j = skeleton.joints;
    const calls: DrawCall[] = [];

    // Shadow (very wide)
    calls.push({
      depth: 0,
      draw: (g, s) => {
        g.ellipse(0, 2 * s, 18 * s, 6 * s);
        g.fill({ color: 0x000000, alpha: 0.22 });
      },
    });

    // Legs
    calls.push({ depth: 10, draw: (g, s) => this.drawLeg(g, j, skeleton, s, farSide) });
    calls.push({ depth: 12, draw: (g, s) => this.drawLeg(g, j, skeleton, s, nearSide) });

    // Far arm
    calls.push({
      depth: facingCamera ? 20 : 45,
      draw: (g, s) => this.drawArm(g, j, s, farSide),
    });

    // Torso (massive barrel)
    calls.push({ depth: 30, draw: (g, s) => this.drawTorso(g, j, skeleton, s) });

    // Head (small relative to body)
    calls.push({ depth: 50, draw: (g, s) => this.drawHead(g, j, skeleton, s) });

    // Near arm
    calls.push({
      depth: facingCamera ? 59 : 24,
      draw: (g, s) => this.drawArm(g, j, s, nearSide),
    });

    return calls;
  }

  getAttachmentPoints(skeleton: Skeleton): Record<string, AttachmentPoint> {
    return {
      "hand-R": skeleton.attachments["hand-R"],
      "hand-L": skeleton.attachments["hand-L"],
      "head-top": skeleton.attachments["head-top"],
    };
  }

  // ─── TORSO ───────────────────────────────────────────────────────

  private drawTorso(g: Graphics, j: Record<string, V>, sk: Skeleton, s: number): void {
    const { wf } = sk;
    const neckBase = j.neckBase;
    const W = 1.5; // very wide

    const chestL = { x: j.chestL.x * W, y: j.chestL.y };
    const chestR = { x: j.chestR.x * W, y: j.chestR.y };
    const waistL = { x: j.waistL.x * W * 1.2, y: j.waistL.y }; // huge belly
    const waistR = { x: j.waistR.x * W * 1.2, y: j.waistR.y };
    const hipL = { x: j.hipL.x * W, y: j.hipL.y };
    const hipR = { x: j.hipR.x * W, y: j.hipR.y };

    // Massive barrel torso
    g.moveTo(neckBase.x * s, neckBase.y * s);
    g.quadraticCurveTo(chestR.x * s, (chestR.y - 1) * s, chestR.x * s, chestR.y * s);
    g.quadraticCurveTo((waistR.x + 3) * s, ((chestR.y + waistR.y) / 2) * s, waistR.x * s, waistR.y * s);
    g.quadraticCurveTo((hipR.x * W + 1) * s, ((waistR.y + hipR.y) / 2) * s, hipR.x * s, hipR.y * s);
    g.lineTo(hipL.x * s, hipL.y * s);
    g.quadraticCurveTo((hipL.x * W - 1) * s, ((waistL.y + hipL.y) / 2) * s, waistL.x * s, waistL.y * s);
    g.quadraticCurveTo((waistL.x - 3) * s, ((chestL.y + waistL.y) / 2) * s, chestL.x * s, chestL.y * s);
    g.quadraticCurveTo(chestL.x * s, (chestL.y - 1) * s, neckBase.x * s, neckBase.y * s);
    g.closePath();
    g.fill(this.SKIN);

    // Belly bulge
    g.ellipse(neckBase.x * s, ((waistL.y + chestL.y) / 2 + 1) * s, 8 * wf * s, 6 * s);
    g.fill({ color: this.BELLY, alpha: 0.2 });

    // Outline
    g.moveTo(neckBase.x * s, neckBase.y * s);
    g.quadraticCurveTo(chestR.x * s, (chestR.y - 1) * s, chestR.x * s, chestR.y * s);
    g.quadraticCurveTo((waistR.x + 3) * s, ((chestR.y + waistR.y) / 2) * s, waistR.x * s, waistR.y * s);
    g.quadraticCurveTo((hipR.x * W + 1) * s, ((waistR.y + hipR.y) / 2) * s, hipR.x * s, hipR.y * s);
    g.lineTo(hipL.x * s, hipL.y * s);
    g.quadraticCurveTo((hipL.x * W - 1) * s, ((waistL.y + hipL.y) / 2) * s, waistL.x * s, waistL.y * s);
    g.quadraticCurveTo((waistL.x - 3) * s, ((chestL.y + waistL.y) / 2) * s, chestL.x * s, chestL.y * s);
    g.quadraticCurveTo(chestL.x * s, (chestL.y - 1) * s, neckBase.x * s, neckBase.y * s);
    g.closePath();
    g.stroke({ width: s * 0.8, color: this.SKIN_DK, alpha: 0.45 });

    // Warts/bumps
    for (const [wx, wy] of [[4, -24], [-5, -22], [6, -19], [-3, -18]]) {
      g.circle((neckBase.x + wx) * s, (neckBase.y + wy + 18) * s, 0.8 * s);
      g.fill(this.SKIN_DK);
    }

    // Very thick neck (almost no neck)
    g.roundRect((neckBase.x - 4) * s, (neckBase.y - 1.5) * s, 8 * s, 3 * s, 2 * s);
    g.fill(this.SKIN);
  }

  // ─── LEG ─────────────────────────────────────────────────────────

  private drawLeg(g: Graphics, j: Record<string, V>, sk: Skeleton, s: number, side: "L" | "R"): void {
    const hip = j[`hip${side}`];
    const knee = j[`knee${side}`];
    const ankle = j[`ankle${side}`];
    const legTop: V = { x: hip.x * 0.7, y: hip.y };

    // Massive tree-trunk thigh
    drawTaperedLimb(g, legTop, knee, 8, 6.5, this.SKIN, this.SKIN_DK, darken(this.SKIN, 0.35), s);

    // Big knee
    g.ellipse(knee.x * s, knee.y * s, 4 * s, 2.5 * s);
    g.fill(this.SKIN);
    g.ellipse(knee.x * s, knee.y * s, 4 * s, 2.5 * s);
    g.stroke({ width: s * 0.4, color: this.SKIN_DK, alpha: 0.3 });

    // Thick calf
    drawTaperedLimb(g, knee, ankle, 6.5, 5, this.SKIN, this.SKIN_DK, darken(this.SKIN, 0.35), s);

    // Huge flat foot
    const iso = sk.iso;
    const footLen = 5.5;
    const fwdX = iso.x * footLen;
    const fwdY = iso.y * footLen * 0.5;
    const tipX = ankle.x + fwdX;
    const tipY = ankle.y + fwdY + 2.5;

    const fdx = tipX - ankle.x;
    const fdy = tipY - ankle.y;
    const flen = Math.sqrt(fdx * fdx + fdy * fdy) || 1;
    const pnx = -fdy / flen;
    const pny = fdx / flen;

    g.moveTo((ankle.x + pnx * 3.5) * s, (ankle.y + pny * 3.5) * s);
    g.lineTo((tipX + pnx * 2.5) * s, (tipY + pny * 2.5) * s);
    g.quadraticCurveTo((tipX + fdx / flen * 2.5) * s, (tipY + fdy / flen * 1.5) * s, (tipX - pnx * 2.5) * s, (tipY - pny * 2.5) * s);
    g.lineTo((ankle.x - pnx * 3.5) * s, (ankle.y - pny * 3.5) * s);
    g.closePath();
    g.fill(this.SKIN_DK);

    // Toe bumps
    for (const off of [-1.2, 0, 1.2]) {
      g.circle((tipX + pnx * off) * s, (tipY + pny * off) * s, 1 * s);
      g.fill(this.SKIN_DK);
    }
  }

  // ─── ARM ─────────────────────────────────────────────────────────

  private drawArm(g: Graphics, j: Record<string, V>, s: number, side: "L" | "R"): void {
    const shoulder = j[`shoulder${side}`];
    const elbow = j[`elbow${side}`];
    const wrist = j[`wrist${side}`];

    // Massive upper arm
    drawTaperedLimb(g, shoulder, elbow, 6, 5, this.SKIN, this.SKIN_DK, darken(this.SKIN, 0.35), s);

    // Big elbow
    g.circle(elbow.x * s, elbow.y * s, 3 * s);
    g.fill(this.SKIN);
    g.circle(elbow.x * s, elbow.y * s, 3 * s);
    g.stroke({ width: s * 0.5, color: this.SKIN_DK, alpha: 0.35 });

    // Thick forearm
    drawTaperedLimb(g, elbow, wrist, 5, 4, this.SKIN, this.SKIN_DK, darken(this.SKIN, 0.35), s);

    // Huge meaty fist
    g.circle(wrist.x * s, wrist.y * s, 3.5 * s);
    g.fill(this.SKIN);
    g.circle(wrist.x * s, wrist.y * s, 3.5 * s);
    g.stroke({ width: s * 0.4, color: this.SKIN_DK, alpha: 0.3 });

    // Knuckle bumps
    const dx = wrist.x - elbow.x;
    const dy = wrist.y - elbow.y;
    const len = Math.sqrt(dx * dx + dy * dy) || 1;
    for (let i = -1; i <= 1; i++) {
      const px = (-dy / len) * i * 1.8;
      const py = (dx / len) * i * 1.8;
      g.circle((wrist.x + dx / len * 2 + px) * s, (wrist.y + dy / len * 2 + py) * s, 1 * s);
      g.fill(this.SKIN_DK);
    }
  }

  // ─── HEAD ────────────────────────────────────────────────────────

  private drawHead(g: Graphics, j: Record<string, V>, sk: Skeleton, s: number): void {
    const head = j.head;
    const { wf, iso } = sk;
    const faceCam = iso.y > 0;
    const sideView = Math.abs(iso.x) > 0.3;
    const r = 7; // relatively small head for the body size

    // Small round ears
    if (sideView) {
      const earSide = iso.x > 0 ? 1 : -1;
      const earX = head.x + earSide * r * wf * 0.85;
      g.ellipse(earX * s, (head.y + 1) * s, 1.8 * s, 2.2 * s);
      g.fill(this.SKIN);
      g.ellipse(earX * s, (head.y + 1) * s, 1 * s, 1.3 * s);
      g.fill(this.SKIN_DK);
    }

    // Head shape (squarish, heavy jaw)
    g.ellipse(head.x * s, head.y * s, (r + 1) * wf * s, r * s);
    g.fill(this.SKIN);

    // Heavy jaw
    if (faceCam) {
      g.ellipse(head.x * s, (head.y + 3) * s, (r + 1.5) * wf * s, (r - 2) * s);
      g.fill(this.SKIN);
    }

    // Massive brow ridge
    if (faceCam || (sideView && iso.y >= -0.1)) {
      const browY = head.y - 2.5;
      const browW = (r + 0.5) * wf;
      g.moveTo((head.x - browW) * s, browY * s);
      g.quadraticCurveTo(head.x * s, (browY - 2) * s, (head.x + browW) * s, browY * s);
      g.stroke({ width: s * 1.8, color: this.SKIN_DK, alpha: 0.35 });
    }

    // Outline
    g.ellipse(head.x * s, head.y * s, (r + 1) * wf * s, r * s);
    g.stroke({ width: s * 0.7, color: this.SKIN_DK, alpha: 0.45 });

    // Face features
    if (faceCam || (sideView && iso.y >= -0.1)) {
      const spread = 2.8 * wf;
      const eyeY = head.y + 1 + iso.y * 0.6;
      const eyeOX = head.x + iso.x * 0.6;

      // Small beady eyes (deep-set under brow)
      g.ellipse((eyeOX - spread) * s, eyeY * s, 1.3 * s, 1 * s);
      g.fill(this.EYE);
      g.ellipse((eyeOX + spread) * s, eyeY * s, 1.3 * s, 1 * s);
      g.fill(this.EYE);

      g.circle((eyeOX - spread + iso.x * 0.3) * s, eyeY * s, 0.55 * s);
      g.fill(0x111111);
      g.circle((eyeOX + spread + iso.x * 0.3) * s, eyeY * s, 0.55 * s);
      g.fill(0x111111);

      // Flat broad nose
      if (faceCam) {
        const noseY = head.y + 3;
        g.ellipse(head.x * s, noseY * s, 2.5 * wf * s, 1.5 * s);
        g.fill(darken(this.SKIN, 0.08));
        g.circle((head.x - 1.2 * wf) * s, (noseY + 0.3) * s, 0.8 * s);
        g.fill(this.SKIN_DK);
        g.circle((head.x + 1.2 * wf) * s, (noseY + 0.3) * s, 0.8 * s);
        g.fill(this.SKIN_DK);
      }

      // Underbite with tusks
      if (faceCam) {
        const mouthY = head.y + 5.5;
        const mw = 3.5 * wf;

        // Wide grimace
        g.moveTo((head.x - mw) * s, (mouthY - 0.5) * s);
        g.quadraticCurveTo(head.x * s, (mouthY + 0.5) * s, (head.x + mw) * s, (mouthY - 0.5) * s);
        g.stroke({ width: s * 0.8, color: 0x333322, alpha: 0.5 });

        // Tusks (protruding from lower jaw)
        for (const side of [-1, 1]) {
          g.poly([
            (head.x + side * 2 * wf) * s, mouthY * s,
            (head.x + side * 2.5 * wf) * s, (mouthY - 3) * s,
            (head.x + side * 1.5 * wf) * s, mouthY * s,
          ]);
          g.fill(0xe8ddc0);
          g.poly([
            (head.x + side * 2 * wf) * s, mouthY * s,
            (head.x + side * 2.5 * wf) * s, (mouthY - 3) * s,
            (head.x + side * 1.5 * wf) * s, mouthY * s,
          ]);
          g.stroke({ width: s * 0.3, color: 0xaa9980, alpha: 0.4 });
        }
      }
    }

    // Wart on forehead
    g.circle((head.x + 2) * s, (head.y - 3) * s, 0.7 * s);
    g.fill(this.SKIN_DK);
  }
}
