import type { Graphics } from "pixi.js";
import type {
  Model,
  RenderContext,
  DrawCall,
  Skeleton,
  AttachmentPoint,
  V,
} from "../types";
import { darken, lighten } from "../palette";
import { drawTaperedLimb } from "../draw-helpers";

/**
 * Imp NPC — small demonic creature with bat wings and horns.
 * Short, thin limbs, red/dark skin, yellow glowing eyes.
 * CAN hold weapons (hand-R, hand-L).
 *
 * Reference from game client:
 * - Body: 0x883333 (dark red), small (14x20)
 * - Horns: 0x332222 (dark brown)
 * - Eyes: 0xffaa00 (gold/yellow)
 * - Wings: semi-transparent, bat-like
 */
export class ImpBody implements Model {
  readonly id = "imp-body";
  readonly name = "Imp";
  readonly category = "npc" as const;
  readonly slot = "root" as const;

  private readonly SKIN = 0x883333;
  private readonly SKIN_DK = 0x662222;
  private readonly HORN = 0x332222;
  private readonly WING = 0x553333;
  private readonly EYE = 0xffaa00;

  getDrawCalls(ctx: RenderContext): DrawCall[] {
    const { skeleton, facingCamera, nearSide, farSide } = ctx;
    const j = skeleton.joints;
    const { iso, bob, wf, walkPhase } = skeleton;
    const calls: DrawCall[] = [];

    // Shadow (small)
    calls.push({
      depth: 0,
      draw: (g, s) => {
        g.ellipse(0, 2 * s, 8 * s, 3 * s);
        g.fill({ color: 0x000000, alpha: 0.15 });
      },
    });

    // Wings (behind body)
    calls.push({
      depth: 5,
      draw: (g, s) => this.drawWings(g, j, skeleton, s),
    });

    // Tail
    calls.push({
      depth: 8,
      draw: (g, s) => this.drawTail(g, j, skeleton, s),
    });

    // Legs (short, thin)
    calls.push({ depth: 10, draw: (g, s) => this.drawLeg(g, j, skeleton, s, farSide) });
    calls.push({ depth: 12, draw: (g, s) => this.drawLeg(g, j, skeleton, s, nearSide) });

    // Far arm
    calls.push({
      depth: facingCamera ? 20 : 45,
      draw: (g, s) => this.drawArm(g, j, s, farSide),
    });

    // Torso (small, lean)
    calls.push({ depth: 30, draw: (g, s) => this.drawTorso(g, j, skeleton, s) });

    // Head with horns
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
    };
  }

  // ─── TORSO ───────────────────────────────────────────────────────

  private drawTorso(g: Graphics, j: Record<string, V>, sk: Skeleton, s: number): void {
    const { wf } = sk;
    const neckBase = j.neckBase;

    // Small lean torso
    const W = 0.75;
    const chestL = { x: j.chestL.x * W, y: j.chestL.y };
    const chestR = { x: j.chestR.x * W, y: j.chestR.y };
    const hipL = { x: j.hipL.x * W, y: j.hipL.y };
    const hipR = { x: j.hipR.x * W, y: j.hipR.y };

    g.moveTo(neckBase.x * s, neckBase.y * s);
    g.quadraticCurveTo(chestR.x * s, chestR.y * s, chestR.x * s, (chestR.y + 2) * s);
    g.lineTo(hipR.x * s, hipR.y * s);
    g.lineTo(hipL.x * s, hipL.y * s);
    g.lineTo(chestL.x * s, (chestL.y + 2) * s);
    g.quadraticCurveTo(chestL.x * s, chestL.y * s, neckBase.x * s, neckBase.y * s);
    g.closePath();
    g.fill(this.SKIN);
    g.moveTo(neckBase.x * s, neckBase.y * s);
    g.quadraticCurveTo(chestR.x * s, chestR.y * s, chestR.x * s, (chestR.y + 2) * s);
    g.lineTo(hipR.x * s, hipR.y * s);
    g.lineTo(hipL.x * s, hipL.y * s);
    g.lineTo(chestL.x * s, (chestL.y + 2) * s);
    g.quadraticCurveTo(chestL.x * s, chestL.y * s, neckBase.x * s, neckBase.y * s);
    g.closePath();
    g.stroke({ width: s * 0.5, color: this.SKIN_DK, alpha: 0.4 });

    // Thin neck
    g.roundRect((neckBase.x - 1.5) * s, (neckBase.y - 2) * s, 3 * s, 3 * s, 1 * s);
    g.fill(this.SKIN);
  }

  // ─── LEG ─────────────────────────────────────────────────────────

  private drawLeg(g: Graphics, j: Record<string, V>, sk: Skeleton, s: number, side: "L" | "R"): void {
    const hip = j[`hip${side}`];
    const knee = j[`knee${side}`];
    const ankle = j[`ankle${side}`];
    const legTop: V = { x: hip.x * 0.4, y: hip.y };

    drawTaperedLimb(g, legTop, knee, 3.5, 2.5, this.SKIN, this.SKIN_DK, darken(this.SKIN, 0.3), s);
    drawTaperedLimb(g, knee, ankle, 2.5, 2, this.SKIN, this.SKIN_DK, darken(this.SKIN, 0.3), s);

    // Clawed foot
    const iso = sk.iso;
    const tipX = ankle.x + iso.x * 2.5;
    const tipY = ankle.y + iso.y * 1.2 + 1.5;
    g.moveTo(ankle.x * s, ankle.y * s);
    g.lineTo(tipX * s, tipY * s);
    g.stroke({ width: s * 1.5, color: this.SKIN_DK });

    // Toe claws
    const fdx = tipX - ankle.x;
    const fdy = tipY - ankle.y;
    const flen = Math.sqrt(fdx * fdx + fdy * fdy) || 1;
    const pnx = -fdy / flen;
    const pny = fdx / flen;
    g.moveTo(tipX * s, tipY * s);
    g.lineTo((tipX + fdx / flen + pnx * 0.5) * s, (tipY + fdy / flen * 0.5 + pny * 0.5) * s);
    g.moveTo(tipX * s, tipY * s);
    g.lineTo((tipX + fdx / flen - pnx * 0.5) * s, (tipY + fdy / flen * 0.5 - pny * 0.5) * s);
    g.stroke({ width: s * 0.6, color: this.HORN });
  }

  // ─── ARM ─────────────────────────────────────────────────────────

  private drawArm(g: Graphics, j: Record<string, V>, s: number, side: "L" | "R"): void {
    const shoulder = j[`shoulder${side}`];
    const elbow = j[`elbow${side}`];
    const wrist = j[`wrist${side}`];

    drawTaperedLimb(g, shoulder, elbow, 2.5, 2, this.SKIN, this.SKIN_DK, darken(this.SKIN, 0.3), s);
    drawTaperedLimb(g, elbow, wrist, 2, 1.5, this.SKIN, this.SKIN_DK, darken(this.SKIN, 0.3), s);

    // Clawed hand
    g.circle(wrist.x * s, wrist.y * s, 1.8 * s);
    g.fill(this.SKIN);

    const dx = wrist.x - elbow.x;
    const dy = wrist.y - elbow.y;
    const len = Math.sqrt(dx * dx + dy * dy) || 1;
    for (let i = -1; i <= 1; i++) {
      const px = (-dy / len) * i * 1;
      const py = (dx / len) * i * 1;
      g.moveTo(wrist.x * s, wrist.y * s);
      g.lineTo((wrist.x + dx / len * 2 + px) * s, (wrist.y + dy / len * 2 + py) * s);
      g.stroke({ width: s * 0.5, color: this.HORN });
    }
  }

  // ─── HEAD ────────────────────────────────────────────────────────

  private drawHead(g: Graphics, j: Record<string, V>, sk: Skeleton, s: number): void {
    const head = j.head;
    const { wf, iso } = sk;
    const faceCam = iso.y > 0;
    const sideView = Math.abs(iso.x) > 0.3;
    const r = 6;

    // Horns (behind head for side views)
    this.drawHorns(g, head, wf, iso, r, s);

    // Head
    g.ellipse(head.x * s, head.y * s, r * wf * s, (r - 0.5) * s);
    g.fill(this.SKIN);
    g.ellipse(head.x * s, head.y * s, r * wf * s, (r - 0.5) * s);
    g.stroke({ width: s * 0.5, color: this.SKIN_DK, alpha: 0.4 });

    // Pointed chin
    if (faceCam) {
      g.poly([
        (head.x - 2 * wf) * s, (head.y + r - 2) * s,
        head.x * s, (head.y + r + 1) * s,
        (head.x + 2 * wf) * s, (head.y + r - 2) * s,
      ]);
      g.fill(this.SKIN);
    }

    // Eyes (glowing yellow)
    if (faceCam || (sideView && iso.y >= -0.1)) {
      const spread = 2.5 * wf;
      const eyeY = head.y + 0.5 + iso.y * 0.6;
      const eyeOX = head.x + iso.x * 0.6;

      // Large glowing eyes
      g.ellipse((eyeOX - spread) * s, eyeY * s, 2 * s, 1.5 * s);
      g.fill(this.EYE);
      g.ellipse((eyeOX + spread) * s, eyeY * s, 2 * s, 1.5 * s);
      g.fill(this.EYE);

      // Slit pupils
      g.ellipse((eyeOX - spread + iso.x * 0.3) * s, eyeY * s, 0.5 * s, 1.2 * s);
      g.fill(0x111111);
      g.ellipse((eyeOX + spread + iso.x * 0.3) * s, eyeY * s, 0.5 * s, 1.2 * s);
      g.fill(0x111111);

      // Glow aura
      g.ellipse((eyeOX - spread) * s, eyeY * s, 2.5 * s, 2 * s);
      g.fill({ color: this.EYE, alpha: 0.1 });
      g.ellipse((eyeOX + spread) * s, eyeY * s, 2.5 * s, 2 * s);
      g.fill({ color: this.EYE, alpha: 0.1 });

      // Sinister grin
      if (faceCam) {
        const mouthY = head.y + 3 + iso.y * 0.3;
        g.moveTo((head.x - 2.5 * wf) * s, mouthY * s);
        g.quadraticCurveTo(head.x * s, (mouthY + 1.5) * s, (head.x + 2.5 * wf) * s, mouthY * s);
        g.stroke({ width: s * 0.6, color: this.SKIN_DK, alpha: 0.5 });

        // Small fangs
        g.moveTo((head.x - 1.5 * wf) * s, mouthY * s);
        g.lineTo((head.x - 1.5 * wf) * s, (mouthY + 1) * s);
        g.moveTo((head.x + 1.5 * wf) * s, mouthY * s);
        g.lineTo((head.x + 1.5 * wf) * s, (mouthY + 1) * s);
        g.stroke({ width: s * 0.5, color: 0xeeddcc, alpha: 0.6 });
      }
    }
  }

  // ─── HORNS ───────────────────────────────────────────────────────

  private drawHorns(g: Graphics, head: V, wf: number, iso: V, r: number, s: number): void {
    for (const side of [-1, 1]) {
      const baseX = head.x + side * r * 0.5 * wf;
      const baseY = head.y - r + 1;
      const tipX = baseX + side * 3;
      const tipY = baseY - 5;

      g.moveTo(baseX * s, baseY * s);
      g.quadraticCurveTo(
        (baseX + side * 2) * s, (baseY - 1) * s,
        tipX * s, tipY * s
      );
      g.quadraticCurveTo(
        (baseX + side * 1) * s, (baseY - 2) * s,
        (baseX - side * 0.5) * s, baseY * s
      );
      g.closePath();
      g.fill(this.HORN);
      g.moveTo(baseX * s, baseY * s);
      g.quadraticCurveTo(
        (baseX + side * 2) * s, (baseY - 1) * s,
        tipX * s, tipY * s
      );
      g.stroke({ width: s * 0.4, color: darken(this.HORN, 0.2), alpha: 0.4 });
    }
  }

  // ─── WINGS ───────────────────────────────────────────────────────

  private drawWings(g: Graphics, j: Record<string, V>, sk: Skeleton, s: number): void {
    const { iso, walkPhase, wf } = sk;
    const shoulder = { x: (j.shoulderL.x + j.shoulderR.x) / 2, y: j.shoulderL.y };
    const flap = walkPhase !== 0 ? Math.sin(walkPhase * 3) * 3 : 0;

    for (const side of [-1, 1]) {
      const baseX = shoulder.x + side * 3 * wf;
      const baseY = shoulder.y - 1;

      // Wing membrane
      const tipX = baseX + side * 14;
      const tipY = baseY - 6 + flap * side;
      const midX = baseX + side * 10;
      const midY = baseY + 4 + flap * side * 0.5;
      const lowX = baseX + side * 5;
      const lowY = baseY + 10;

      // Wing shape
      g.moveTo(baseX * s, baseY * s);
      g.quadraticCurveTo((baseX + side * 7) * s, (baseY - 8 + flap * side) * s, tipX * s, tipY * s);
      g.quadraticCurveTo((midX + side * 2) * s, (baseY - 1 + flap * side * 0.3) * s, midX * s, midY * s);
      g.quadraticCurveTo((lowX + side * 3) * s, (baseY + 6) * s, lowX * s, lowY * s);
      g.lineTo(baseX * s, (baseY + 5) * s);
      g.closePath();
      g.fill({ color: this.WING, alpha: 0.6 });

      // Wing bones
      g.moveTo(baseX * s, baseY * s);
      g.lineTo(tipX * s, tipY * s);
      g.stroke({ width: s * 0.8, color: this.SKIN_DK, alpha: 0.5 });
      g.moveTo(baseX * s, baseY * s);
      g.lineTo(midX * s, midY * s);
      g.stroke({ width: s * 0.6, color: this.SKIN_DK, alpha: 0.4 });
      g.moveTo(baseX * s, baseY * s);
      g.lineTo(lowX * s, lowY * s);
      g.stroke({ width: s * 0.5, color: this.SKIN_DK, alpha: 0.35 });

      // Wing outline
      g.moveTo(baseX * s, baseY * s);
      g.quadraticCurveTo((baseX + side * 7) * s, (baseY - 8 + flap * side) * s, tipX * s, tipY * s);
      g.quadraticCurveTo((midX + side * 2) * s, (baseY - 1 + flap * side * 0.3) * s, midX * s, midY * s);
      g.quadraticCurveTo((lowX + side * 3) * s, (baseY + 6) * s, lowX * s, lowY * s);
      g.stroke({ width: s * 0.4, color: this.SKIN_DK, alpha: 0.3 });
    }
  }

  // ─── TAIL ────────────────────────────────────────────────────────

  private drawTail(g: Graphics, j: Record<string, V>, sk: Skeleton, s: number): void {
    const { iso, walkPhase } = sk;
    const crotch = j.crotch;
    const sway = walkPhase !== 0 ? Math.sin(walkPhase * 2) * 2 : 0;

    const tailEndX = crotch.x - iso.x * 10 + sway;
    const tailEndY = crotch.y + 3;

    // Thin tail with arrow tip
    g.moveTo(crotch.x * s, crotch.y * s);
    g.quadraticCurveTo(
      (crotch.x - iso.x * 5 + sway * 0.5) * s, (crotch.y + 5) * s,
      tailEndX * s, tailEndY * s
    );
    g.stroke({ width: s * 1.2, color: this.SKIN_DK });

    // Arrow tip
    const tdx = tailEndX - crotch.x;
    const tdy = tailEndY - crotch.y;
    const tlen = Math.sqrt(tdx * tdx + tdy * tdy) || 1;
    const pnx = -tdy / tlen;
    const pny = tdx / tlen;

    g.poly([
      tailEndX * s, tailEndY * s,
      (tailEndX + tdx / tlen * 2 + pnx * 1.5) * s, (tailEndY + tdy / tlen * 1 + pny * 1.5) * s,
      (tailEndX + tdx / tlen * 3) * s, tailEndY * s,
      (tailEndX + tdx / tlen * 2 - pnx * 1.5) * s, (tailEndY + tdy / tlen * 1 - pny * 1.5) * s,
    ]);
    g.fill(this.SKIN_DK);
  }
}
