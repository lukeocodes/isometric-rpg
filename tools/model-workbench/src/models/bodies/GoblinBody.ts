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
 * Goblin NPC body — short, wide, hunched, green-skinned.
 * Pointed ears, red eyes, wide mouth, muscular but squat.
 * CAN hold weapons (hand-R, hand-L slots).
 *
 * Reference from game client:
 * - Body: 24px wide, 22px tall, dark brown/green (0x6a5a3a)
 * - Head: green (0x7aaa5a), pointed triangular ears
 * - Eyes: red (0xee4444)
 *
 * Anatomy: ~60% human height, ~120% human width
 * Short legs, long arms, large head relative to body.
 */
export class GoblinBody implements Model {
  readonly id = "goblin-body";
  readonly name = "Goblin";
  readonly category = "npc" as const;
  readonly slot = "root" as const;

  private readonly SKIN = 0x5a8a4a;    // olive green
  private readonly SKIN_DK = 0x3a6a2a; // dark green
  private readonly BELLY = 0x6a5a3a;   // brown-green torso
  private readonly BELLY_DK = 0x4a3a1a;
  private readonly EYE = 0xee4444;      // red eyes

  getDrawCalls(ctx: RenderContext): DrawCall[] {
    const { skeleton, facingCamera, nearSide, farSide } = ctx;
    const j = skeleton.joints;
    const calls: DrawCall[] = [];

    // Shadow (wider)
    calls.push({
      depth: 0,
      draw: (g, s) => {
        g.ellipse(0, 2 * s, 14 * s, 5 * s);
        g.fill({ color: 0x000000, alpha: 0.2 });
      },
    });

    // Short legs
    calls.push({ depth: 10, draw: (g, s) => this.drawLeg(g, j, skeleton, s, farSide) });
    calls.push({ depth: 12, draw: (g, s) => this.drawLeg(g, j, skeleton, s, nearSide) });

    // Far arm (long, dangly)
    calls.push({
      depth: facingCamera ? 20 : 45,
      draw: (g, s) => this.drawArm(g, j, s, farSide),
    });

    // Torso (wide, potbellied)
    calls.push({ depth: 30, draw: (g, s) => this.drawTorso(g, j, skeleton, s) });

    // Head (large, with ears)
    calls.push({ depth: 50, draw: (g, s) => this.drawHead(g, j, skeleton, s) });

    // Near arm
    calls.push({
      depth: facingCamera ? 59 : 24,
      draw: (g, s) => this.drawArm(g, j, s, nearSide),
    });

    return calls;
  }

  getAttachmentPoints(skeleton: Skeleton): Record<string, AttachmentPoint> {
    // Goblins can hold weapons
    return {
      "hand-R": skeleton.attachments["hand-R"],
      "hand-L": skeleton.attachments["hand-L"],
      "head-top": skeleton.attachments["head-top"],
    };
  }

  // ─── TORSO (wide, potbellied) ───────────────────────────────────

  private drawTorso(g: Graphics, j: Record<string, V>, sk: Skeleton, s: number): void {
    const { wf } = sk;
    const neckBase = j.neckBase;
    const hipL = j.hipL;
    const hipR = j.hipR;

    // Wide barrel torso
    const W = 1.3; // extra wide
    const chestL = { x: j.chestL.x * W, y: j.chestL.y };
    const chestR = { x: j.chestR.x * W, y: j.chestR.y };
    const waistL = { x: j.waistL.x * W * 1.1, y: j.waistL.y }; // potbelly widens at waist
    const waistR = { x: j.waistR.x * W * 1.1, y: j.waistR.y };

    // Main body shape
    g.moveTo(neckBase.x * s, neckBase.y * s);
    g.quadraticCurveTo(chestR.x * s, (chestR.y - 1) * s, chestR.x * s, chestR.y * s);
    g.quadraticCurveTo(
      (waistR.x + 2) * s,
      ((chestR.y + waistR.y) / 2) * s,
      waistR.x * s,
      waistR.y * s
    );
    g.quadraticCurveTo(
      (hipR.x * W + 1) * s,
      ((waistR.y + hipR.y) / 2) * s,
      (hipR.x * W) * s,
      hipR.y * s
    );
    g.lineTo((hipL.x * W) * s, hipL.y * s);
    g.quadraticCurveTo(
      (hipL.x * W - 1) * s,
      ((waistL.y + hipL.y) / 2) * s,
      waistL.x * s,
      waistL.y * s
    );
    g.quadraticCurveTo(
      (waistL.x - 2) * s,
      ((chestL.y + waistL.y) / 2) * s,
      chestL.x * s,
      chestL.y * s
    );
    g.quadraticCurveTo(chestL.x * s, (chestL.y - 1) * s, neckBase.x * s, neckBase.y * s);
    g.closePath();
    g.fill(this.BELLY);

    // Belly bulge highlight
    g.ellipse(
      (neckBase.x + 0.5) * s,
      ((j.waistL.y + j.chestL.y) / 2) * s,
      5 * wf * s,
      4 * s
    );
    g.fill({ color: lighten(this.BELLY, 0.08), alpha: 0.25 });

    // Outline
    g.moveTo(neckBase.x * s, neckBase.y * s);
    g.quadraticCurveTo(chestR.x * s, (chestR.y - 1) * s, chestR.x * s, chestR.y * s);
    g.quadraticCurveTo(
      (waistR.x + 2) * s,
      ((chestR.y + waistR.y) / 2) * s,
      waistR.x * s,
      waistR.y * s
    );
    g.quadraticCurveTo(
      (hipR.x * W + 1) * s,
      ((waistR.y + hipR.y) / 2) * s,
      (hipR.x * W) * s,
      hipR.y * s
    );
    g.lineTo((hipL.x * W) * s, hipL.y * s);
    g.quadraticCurveTo(
      (hipL.x * W - 1) * s,
      ((waistL.y + hipL.y) / 2) * s,
      waistL.x * s,
      waistL.y * s
    );
    g.quadraticCurveTo(
      (waistL.x - 2) * s,
      ((chestL.y + waistL.y) / 2) * s,
      chestL.x * s,
      chestL.y * s
    );
    g.quadraticCurveTo(chestL.x * s, (chestL.y - 1) * s, neckBase.x * s, neckBase.y * s);
    g.closePath();
    g.stroke({ width: s * 0.7, color: this.BELLY_DK, alpha: 0.5 });

    // Short thick neck
    const nw = 3.5;
    g.roundRect(
      (neckBase.x - nw / 2) * s,
      (neckBase.y - 1.5) * s,
      nw * s,
      2.5 * s,
      1.2 * s
    );
    g.fill(this.SKIN);
  }

  // ─── LEG (short, bowed) ─────────────────────────────────────────

  private drawLeg(
    g: Graphics,
    j: Record<string, V>,
    sk: Skeleton,
    s: number,
    side: "L" | "R"
  ): void {
    const hip = j[`hip${side}`];
    const knee = j[`knee${side}`];
    const ankle = j[`ankle${side}`];

    const legTop: V = { x: hip.x * 0.6, y: hip.y };
    const legDk = this.SKIN_DK;
    const legOutline = darken(this.SKIN, 0.35);

    // Short thick thigh
    drawTaperedLimb(g, legTop, knee, 5.5, 4.5, this.SKIN, legDk, legOutline, s);

    // Knobbly knee
    g.ellipse(knee.x * s, knee.y * s, 3 * s, 2 * s);
    g.fill(this.SKIN);
    g.ellipse(knee.x * s, knee.y * s, 3 * s, 2 * s);
    g.stroke({ width: s * 0.3, color: legDk, alpha: 0.3 });

    // Short calf
    drawTaperedLimb(g, knee, ankle, 4.5, 3.5, this.SKIN, legDk, legOutline, s);

    // Big clawed foot
    const iso = sk.iso;
    const footLen = 4;
    const tipX = ankle.x + iso.x * footLen;
    const tipY = ankle.y + iso.y * footLen * 0.4 + 2;

    const fdx = tipX - ankle.x;
    const fdy = tipY - ankle.y;
    const flen = Math.sqrt(fdx * fdx + fdy * fdy) || 1;
    const pnx = -fdy / flen;
    const pny = fdx / flen;

    g.moveTo((ankle.x + pnx * 2.5) * s, (ankle.y + pny * 2.5) * s);
    g.lineTo((tipX + pnx * 1.5) * s, (tipY + pny * 1.5) * s);
    g.quadraticCurveTo(
      (tipX + fdx / flen * 2) * s,
      (tipY + fdy / flen * 1) * s,
      (tipX - pnx * 1.5) * s,
      (tipY - pny * 1.5) * s
    );
    g.lineTo((ankle.x - pnx * 2.5) * s, (ankle.y - pny * 2.5) * s);
    g.closePath();
    g.fill(this.SKIN_DK);

    // Toe claws (2 prongs)
    for (const offset of [-0.8, 0.8]) {
      g.moveTo(tipX * s, tipY * s);
      g.lineTo(
        (tipX + fdx / flen * 1.5 + pnx * offset) * s,
        (tipY + fdy / flen * 1 + pny * offset) * s
      );
      g.stroke({ width: s * 0.8, color: 0x333322 });
    }
  }

  // ─── ARM (long, dangly, strong) ─────────────────────────────────

  private drawArm(
    g: Graphics,
    j: Record<string, V>,
    s: number,
    side: "L" | "R"
  ): void {
    const shoulder = j[`shoulder${side}`];
    const elbow = j[`elbow${side}`];
    const wrist = j[`wrist${side}`];

    const armDk = this.SKIN_DK;
    const armOutline = darken(this.SKIN, 0.35);

    // Thick upper arm
    drawTaperedLimb(g, shoulder, elbow, 4.5, 3.8, this.SKIN, armDk, armOutline, s);

    // Elbow
    g.circle(elbow.x * s, elbow.y * s, 2.2 * s);
    g.fill(this.SKIN);
    g.circle(elbow.x * s, elbow.y * s, 2.2 * s);
    g.stroke({ width: s * 0.4, color: armOutline, alpha: 0.3 });

    // Forearm
    drawTaperedLimb(g, elbow, wrist, 3.5, 3, this.SKIN, armDk, armOutline, s);

    // Big clawed hand
    g.circle(wrist.x * s, wrist.y * s, 2.5 * s);
    g.fill(this.SKIN);
    g.circle(wrist.x * s, wrist.y * s, 2.5 * s);
    g.stroke({ width: s * 0.3, color: armDk, alpha: 0.3 });

    // Finger claws
    const dx = wrist.x - elbow.x;
    const dy = wrist.y - elbow.y;
    const len = Math.sqrt(dx * dx + dy * dy) || 1;
    for (let i = -1; i <= 1; i++) {
      const px = (-dy / len) * i * 1.5;
      const py = (dx / len) * i * 1.5;
      g.moveTo(wrist.x * s, wrist.y * s);
      g.lineTo((wrist.x + dx / len * 2.5 + px) * s, (wrist.y + dy / len * 2.5 + py) * s);
      g.stroke({ width: s * 0.7, color: 0x333322 });
    }
  }

  // ─── HEAD (large, with pointed ears) ────────────────────────────

  private drawHead(g: Graphics, j: Record<string, V>, sk: Skeleton, s: number): void {
    const head = j.head;
    const { wf, iso } = sk;
    const faceCam = iso.y > 0;
    const sideView = Math.abs(iso.x) > 0.3;
    const r = 8.5; // big head

    // Pointed ears
    if (sideView) {
      const earSide = iso.x > 0 ? 1 : -1;
      const earBaseX = head.x + earSide * r * wf * 0.85;
      const earTipX = earBaseX + earSide * 6;
      const earTipY = head.y - 1;

      g.poly([
        earBaseX * s, (head.y - 2) * s,
        earTipX * s, earTipY * s,
        earBaseX * s, (head.y + 2) * s,
      ]);
      g.fill(this.SKIN);
      g.poly([
        earBaseX * s, (head.y - 2) * s,
        earTipX * s, earTipY * s,
        earBaseX * s, (head.y + 2) * s,
      ]);
      g.stroke({ width: s * 0.5, color: this.SKIN_DK, alpha: 0.4 });

      // Inner ear
      g.poly([
        earBaseX * s, (head.y - 1) * s,
        (earTipX - earSide * 1) * s, earTipY * s,
        earBaseX * s, (head.y + 1) * s,
      ]);
      g.fill(darken(this.SKIN, 0.1));
    } else if (faceCam) {
      // Both ears visible from front
      for (const earSide of [-1, 1]) {
        const earBaseX = head.x + earSide * r * wf * 0.8;
        const earTipX = earBaseX + earSide * 5;
        g.poly([
          earBaseX * s, (head.y - 2) * s,
          earTipX * s, (head.y - 0.5) * s,
          earBaseX * s, (head.y + 1.5) * s,
        ]);
        g.fill(this.SKIN);
      }
    }

    // Head shape (slightly squarish)
    g.ellipse(head.x * s, head.y * s, r * wf * s, (r - 0.5) * s);
    g.fill(this.SKIN);

    // Wide jaw
    if (faceCam) {
      g.ellipse(head.x * s, (head.y + 2) * s, (r + 0.5) * wf * s, (r - 2) * s);
      g.fill(this.SKIN);
    }

    // Outline
    g.ellipse(head.x * s, head.y * s, r * wf * s, (r - 0.5) * s);
    g.stroke({ width: s * 0.6, color: this.SKIN_DK, alpha: 0.45 });

    // Face features
    if (faceCam || (sideView && iso.y >= -0.1)) {
      const spread = 3 * wf;
      const eyeY = head.y + 0.5 + iso.y * 0.8;
      const eyeOX = head.x + iso.x * 0.8;

      // Beady red eyes (large, menacing)
      g.ellipse((eyeOX - spread) * s, eyeY * s, 2.2 * s, 1.8 * s);
      g.fill(0xffee88); // yellowish sclera
      g.ellipse((eyeOX + spread) * s, eyeY * s, 2.2 * s, 1.8 * s);
      g.fill(0xffee88);

      g.circle((eyeOX - spread + iso.x * 0.4) * s, (eyeY + 0.1) * s, 1.3 * s);
      g.fill(this.EYE);
      g.circle((eyeOX + spread + iso.x * 0.4) * s, (eyeY + 0.1) * s, 1.3 * s);
      g.fill(this.EYE);

      g.circle((eyeOX - spread + iso.x * 0.6) * s, (eyeY + 0.15) * s, 0.55 * s);
      g.fill(0x111111);
      g.circle((eyeOX + spread + iso.x * 0.6) * s, (eyeY + 0.15) * s, 0.55 * s);
      g.fill(0x111111);

      // Heavy brow
      g.moveTo((eyeOX - spread - 2) * s, (eyeY - 1.8) * s);
      g.lineTo((eyeOX - spread + 2) * s, (eyeY - 2.5) * s);
      g.moveTo((eyeOX + spread - 2) * s, (eyeY - 2.5) * s);
      g.lineTo((eyeOX + spread + 2) * s, (eyeY - 1.8) * s);
      g.stroke({ width: s * 1, color: this.SKIN_DK, alpha: 0.5 });

      // Broad flat nose
      if (faceCam) {
        const noseY = head.y + 2.5 + iso.y * 0.3;
        g.ellipse(head.x * s, noseY * s, 2 * wf * s, 1.2 * s);
        g.fill(darken(this.SKIN, 0.08));
        // Nostrils
        g.circle((head.x - 1 * wf) * s, (noseY + 0.3) * s, 0.6 * s);
        g.fill(this.SKIN_DK);
        g.circle((head.x + 1 * wf) * s, (noseY + 0.3) * s, 0.6 * s);
        g.fill(this.SKIN_DK);
      }

      // Wide mouth with underbite fangs
      if (faceCam) {
        const mouthY = head.y + 4.5 + iso.y * 0.4;
        const mw = 3.5 * wf;

        // Wide grinning mouth
        g.moveTo((head.x - mw) * s, mouthY * s);
        g.quadraticCurveTo(
          head.x * s,
          (mouthY + 1.5) * s,
          (head.x + mw) * s,
          mouthY * s
        );
        g.stroke({ width: s * 0.8, color: 0x332211, alpha: 0.6 });

        // Underbite fangs
        g.poly([
          (head.x - 2 * wf) * s, mouthY * s,
          (head.x - 2.3 * wf) * s, (mouthY - 1.8) * s,
          (head.x - 1.5 * wf) * s, mouthY * s,
        ]);
        g.fill(0xeeddcc);
        g.poly([
          (head.x + 2 * wf) * s, mouthY * s,
          (head.x + 2.3 * wf) * s, (mouthY - 1.8) * s,
          (head.x + 1.5 * wf) * s, mouthY * s,
        ]);
        g.fill(0xeeddcc);
      }
    }
  }
}
