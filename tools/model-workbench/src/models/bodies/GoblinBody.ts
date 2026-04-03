import type { Graphics } from "pixi.js";
import type { Model, RenderContext, DrawCall, Skeleton, AttachmentPoint, V, ModelPalette } from "../types";
import { DEPTH_SHADOW, DEPTH_FAR_LIMB, DEPTH_BODY, DEPTH_HEAD, DEPTH_NEAR_LIMB } from "../types";
import { darken, lighten } from "../palette";
import { drawTaperedLimb } from "../draw-helpers";

/**
 * Goblin NPC — short, wide, hunched, green-skinned.
 * Pointed ears, red eyes, wide mouth with underbite fangs.
 * CAN hold weapons (hand-R, hand-L slots).
 */
export class GoblinBody implements Model {
  readonly id = "goblin-body";
  readonly name = "Goblin";
  readonly category = "npc" as const;
  readonly slot = "root" as const;

  private readonly SKIN    = 0x5a8a4a;
  private readonly SKIN_DK = 0x3a6a2a;
  private readonly BELLY   = 0x6a5a3a;
  private readonly BELLY_DK= 0x4a3a1a;
  private readonly EYE     = 0xee4444;

  getDrawCalls(ctx: RenderContext): DrawCall[] {
    const { skeleton, facingCamera, nearSide, farSide } = ctx;
    const j = skeleton.joints;
    const { iso } = skeleton;
    const calls: DrawCall[] = [];

    calls.push({ depth: DEPTH_SHADOW, draw: (g, s) => {
      g.ellipse(iso.x * 2 * s, 2 * s, 14 * s, 5 * s);
      g.fill({ color: 0x000000, alpha: 0.2 });
    }});

    calls.push({ depth: DEPTH_FAR_LIMB,     draw: (g, s) => this.drawLeg(g, j, skeleton, s, farSide,  false) });
    calls.push({ depth: DEPTH_FAR_LIMB + 4, draw: (g, s) => this.drawLeg(g, j, skeleton, s, nearSide, true)  });

    calls.push({ depth: facingCamera ? DEPTH_FAR_LIMB + 8 : DEPTH_NEAR_LIMB + 0,
      draw: (g, s) => this.drawArm(g, j, s, farSide, false) });

    calls.push({ depth: DEPTH_BODY,     draw: (g, s) => this.drawTorso(g, j, skeleton, s, nearSide) });
    calls.push({ depth: DEPTH_HEAD,     draw: (g, s) => this.drawHead(g, j, skeleton, s) });

    calls.push({ depth: facingCamera ? DEPTH_NEAR_LIMB + 5 : DEPTH_FAR_LIMB + 10,
      draw: (g, s) => this.drawArm(g, j, s, nearSide, true) });

    return calls;
  }

  getAttachmentPoints(skeleton: Skeleton): Record<string, AttachmentPoint> {
    return { "hand-R": skeleton.attachments["hand-R"], "hand-L": skeleton.attachments["hand-L"], "head-top": skeleton.attachments["head-top"] };
  }

  // ─── TORSO ────────────────────────────────────────────────────────

  private drawTorso(g: Graphics, j: Record<string, V>, sk: Skeleton, s: number, nearSide: "L" | "R"): void {
    const { wf, iso } = sk;
    const neckBase = j.neckBase;
    const W = 1.3;
    const chestL = { x: j.chestL.x * W, y: j.chestL.y };
    const chestR = { x: j.chestR.x * W, y: j.chestR.y };
    const waistL = { x: j.waistL.x * W * 1.1, y: j.waistL.y };
    const waistR = { x: j.waistR.x * W * 1.1, y: j.waistR.y };
    const hipL   = { x: j.hipL.x * W, y: j.hipL.y };
    const hipR   = { x: j.hipR.x * W, y: j.hipR.y };

    this.torsoPath(g, j, s, W);
    g.fill(this.BELLY);

    // Directional side shading
    const sideAmt = Math.abs(iso.x);
    if (sideAmt > 0.08) {
      const shadowIsRight = nearSide === "L";
      const sX  = shadowIsRight ? chestR  : chestL;
      const sW  = shadowIsRight ? waistR  : waistL;
      const sH  = shadowIsRight ? hipR    : hipL;
      const dir = shadowIsRight ? 1 : -1;
      const bW  = sideAmt * 4;
      g.moveTo(neckBase.x * s, neckBase.y * s);
      g.quadraticCurveTo(sX.x * s, (sX.y - 0.8) * s, sX.x * s, sX.y * s);
      g.quadraticCurveTo((sX.x + dir * 1) * s, ((sX.y + sW.y) / 2) * s, sW.x * s, sW.y * s);
      g.quadraticCurveTo((sW.x + dir * 0.8) * s, ((sW.y + sH.y) / 2) * s, sH.x * s, sH.y * s);
      g.lineTo((sH.x - dir * bW) * s, sH.y * s);
      g.quadraticCurveTo((sW.x - dir * bW + dir * 0.5) * s, ((sW.y + sH.y) / 2) * s, (sW.x - dir * bW) * s, sW.y * s);
      g.quadraticCurveTo((sX.x - dir * bW + dir * 0.3) * s, ((sX.y + sW.y) / 2) * s, (sX.x - dir * bW) * s, sX.y * s);
      g.lineTo((neckBase.x - dir * bW * 0.4) * s, neckBase.y * s);
      g.closePath();
      g.fill({ color: darken(this.BELLY, 0.25), alpha: sideAmt * 0.45 });
    }

    // Belly bulge highlight
    g.ellipse((neckBase.x + 0.5) * s, ((j.waistL.y + j.chestL.y) / 2) * s, 5 * wf * s, 4 * s);
    g.fill({ color: lighten(this.BELLY, 0.07), alpha: 0.2 });

    this.torsoPath(g, j, s, W);
    g.stroke({ width: s * 0.7, color: this.BELLY_DK, alpha: 0.5 });

    const nw = 3.5;
    g.roundRect((neckBase.x - nw / 2) * s, (neckBase.y - 1.5) * s, nw * s, 2.5 * s, 1.2 * s);
    g.fill(this.SKIN);
  }

  private torsoPath(g: Graphics, j: Record<string, V>, s: number, W: number): void {
    const neckBase = j.neckBase;
    const chestL = { x: j.chestL.x * W, y: j.chestL.y };
    const chestR = { x: j.chestR.x * W, y: j.chestR.y };
    const waistL = { x: j.waistL.x * W * 1.1, y: j.waistL.y };
    const waistR = { x: j.waistR.x * W * 1.1, y: j.waistR.y };
    const hipL   = { x: j.hipL.x * W, y: j.hipL.y };
    const hipR   = { x: j.hipR.x * W, y: j.hipR.y };
    g.moveTo(neckBase.x * s, neckBase.y * s);
    g.quadraticCurveTo(chestR.x * s, (chestR.y - 1) * s, chestR.x * s, chestR.y * s);
    g.quadraticCurveTo((waistR.x + 2) * s, ((chestR.y + waistR.y) / 2) * s, waistR.x * s, waistR.y * s);
    g.quadraticCurveTo((hipR.x * W + 1) * s, ((waistR.y + hipR.y) / 2) * s, hipR.x * s, hipR.y * s);
    g.lineTo(hipL.x * s, hipL.y * s);
    g.quadraticCurveTo((hipL.x * W - 1) * s, ((waistL.y + hipL.y) / 2) * s, waistL.x * s, waistL.y * s);
    g.quadraticCurveTo((waistL.x - 2) * s, ((chestL.y + waistL.y) / 2) * s, chestL.x * s, chestL.y * s);
    g.quadraticCurveTo(chestL.x * s, (chestL.y - 1) * s, neckBase.x * s, neckBase.y * s);
    g.closePath();
  }

  // ─── LEG ──────────────────────────────────────────────────────────

  private drawLeg(g: Graphics, j: Record<string, V>, sk: Skeleton, s: number, side: "L" | "R", isNear: boolean): void {
    const hip   = j[`hip${side}`];
    const knee  = j[`knee${side}`];
    const ankle = j[`ankle${side}`];
    const lC  = isNear ? this.SKIN : darken(this.SKIN, 0.07);
    const lDk = this.SKIN_DK;
    const lOu = darken(lC, 0.35);
    const lTop: V = { x: hip.x * 0.6, y: hip.y };

    drawTaperedLimb(g, lTop, knee, 5.5, 4.5, lC, lDk, lOu, s);

    g.ellipse(knee.x * s, knee.y * s, 3.2 * s, 2.2 * s); g.fill(lighten(lC, 0.04));
    g.ellipse(knee.x * s, (knee.y + 0.6) * s, 2 * s, 1.4 * s); g.fill(darken(lC, 0.07));
    g.ellipse(knee.x * s, knee.y * s, 3.2 * s, 2.2 * s); g.stroke({ width: s * 0.28, color: lDk, alpha: 0.25 });

    drawTaperedLimb(g, knee, ankle, 4.5, 3.5, lC, lDk, lOu, s);

    // Clawed foot
    const iso = sk.iso;
    const tipX = ankle.x + iso.x * 4;
    const tipY = ankle.y + iso.y * 1.6 + 2;
    const fdx  = tipX - ankle.x, fdy = tipY - ankle.y;
    const flen = Math.sqrt(fdx * fdx + fdy * fdy) || 1;
    const pnx = -fdy / flen, pny = fdx / flen;

    g.moveTo((ankle.x + pnx * 2.5) * s, (ankle.y + pny * 2.5) * s);
    g.lineTo((tipX + pnx * 1.5) * s, (tipY + pny * 1.5) * s);
    g.quadraticCurveTo((tipX + fdx / flen * 2) * s, (tipY + fdy / flen * 1) * s, (tipX - pnx * 1.5) * s, (tipY - pny * 1.5) * s);
    g.lineTo((ankle.x - pnx * 2.5) * s, (ankle.y - pny * 2.5) * s);
    g.closePath(); g.fill(lDk);
    for (const off of [-0.8, 0.8]) {
      g.moveTo(tipX * s, tipY * s);
      g.lineTo((tipX + fdx / flen * 1.5 + pnx * off) * s, (tipY + fdy / flen * 1 + pny * off) * s);
      g.stroke({ width: s * 0.8, color: 0x333322 });
    }
  }

  // ─── ARM ──────────────────────────────────────────────────────────

  private drawArm(g: Graphics, j: Record<string, V>, s: number, side: "L" | "R", isNear: boolean): void {
    const shoulder = j[`shoulder${side}`];
    const elbow    = j[`elbow${side}`];
    const wrist    = j[`wrist${side}`];
    const aC  = isNear ? this.SKIN : darken(this.SKIN, 0.07);
    const aDk = this.SKIN_DK;
    const aOu = darken(aC, 0.35);

    drawTaperedLimb(g, shoulder, elbow, 4.5, 3.8, aC, aDk, aOu, s);
    g.circle(elbow.x * s, elbow.y * s, 2.2 * s); g.fill(aC);
    g.circle(elbow.x * s, elbow.y * s, 2.2 * s); g.stroke({ width: s * 0.4, color: aOu, alpha: 0.28 });
    drawTaperedLimb(g, elbow, wrist, 3.5, 3.0, aC, aDk, aOu, s);

    g.circle(wrist.x * s, wrist.y * s, 2.5 * s); g.fill(aC);
    g.circle(wrist.x * s, wrist.y * s, 2.5 * s); g.stroke({ width: s * 0.3, color: aDk, alpha: 0.28 });

    const dx = wrist.x - elbow.x, dy = wrist.y - elbow.y;
    const len = Math.sqrt(dx * dx + dy * dy) || 1;
    for (let i = -1; i <= 1; i++) {
      const px = (-dy / len) * i * 1.5, py = (dx / len) * i * 1.5;
      g.moveTo(wrist.x * s, wrist.y * s);
      g.lineTo((wrist.x + dx / len * 2.5 + px) * s, (wrist.y + dy / len * 2.5 + py) * s);
      g.stroke({ width: s * 0.7, color: 0x333322 });
    }
  }

  // ─── HEAD ─────────────────────────────────────────────────────────

  private drawHead(g: Graphics, j: Record<string, V>, sk: Skeleton, s: number): void {
    const head = j.head;
    const { wf, iso } = sk;
    const faceCam = iso.y > 0;
    const sideView = Math.abs(iso.x) > 0.3;
    const r = 8.5;

    // Pointed ears
    if (sideView) {
      const eS  = iso.x > 0 ? 1 : -1;
      const eBX = head.x + eS * r * wf * 0.85;
      g.poly([eBX * s, (head.y - 2) * s, (eBX + eS * 6) * s, (head.y - 1) * s, eBX * s, (head.y + 2) * s]);
      g.fill(this.SKIN);
      g.poly([eBX * s, (head.y - 1) * s, (eBX + eS * 4) * s, (head.y - 1) * s, eBX * s, (head.y + 1) * s]);
      g.fill(darken(this.SKIN, 0.1));
    } else if (faceCam) {
      for (const eS of [-1, 1]) {
        const eBX = head.x + eS * r * wf * 0.8;
        g.poly([eBX * s, (head.y - 2) * s, (eBX + eS * 5) * s, (head.y - 0.5) * s, eBX * s, (head.y + 1.5) * s]);
        g.fill(this.SKIN);
      }
    }

    g.ellipse(head.x * s, head.y * s, r * wf * s, (r - 0.5) * s);
    g.fill(this.SKIN);

    if (faceCam) {
      g.ellipse(head.x * s, (head.y + 2) * s, (r + 0.5) * wf * s, (r - 2) * s);
      g.fill(this.SKIN);
    }

    // Directional skull shading
    if (Math.abs(iso.x) > 0.15) {
      const sX  = head.x - iso.x * r * wf * 0.12;
      const sEX = head.x - iso.x * r * wf * 0.88;
      g.moveTo(sEX * s, (head.y - (r - 0.5) * 0.6) * s);
      g.quadraticCurveTo((sEX - iso.x * 1.5) * s, head.y * s, sEX * s, (head.y + (r - 0.5) * 0.6) * s);
      g.lineTo(sX * s, (head.y + (r - 0.5) * 0.5) * s);
      g.quadraticCurveTo((sX - iso.x * 0.4) * s, head.y * s, sX * s, (head.y - (r - 0.5) * 0.5) * s);
      g.closePath();
      g.fill({ color: darken(this.SKIN, 0.22), alpha: Math.abs(iso.x) * 0.38 });
    }

    g.ellipse(head.x * s, head.y * s, r * wf * s, (r - 0.5) * s);
    g.stroke({ width: s * 0.6, color: this.SKIN_DK, alpha: 0.45 });

    if (faceCam || (sideView && iso.y >= -0.1)) {
      const spread = 3 * wf;
      const eyeY  = head.y + 0.5 + iso.y * 0.8;
      const eyeOX = head.x + iso.x * 0.8;

      // Yellow sclera + red iris
      g.ellipse((eyeOX - spread) * s, eyeY * s, 2.2 * s, 1.8 * s); g.fill(0xffee88);
      g.ellipse((eyeOX + spread) * s, eyeY * s, 2.2 * s, 1.8 * s); g.fill(0xffee88);

      const iX = iso.x * 0.5;
      g.circle((eyeOX - spread + iX) * s, (eyeY + 0.1) * s, 1.3 * s); g.fill(this.EYE);
      g.circle((eyeOX + spread + iX) * s, (eyeY + 0.1) * s, 1.3 * s); g.fill(this.EYE);

      const pX = iso.x * 0.65;
      g.circle((eyeOX - spread + pX) * s, (eyeY + 0.15) * s, 0.55 * s); g.fill(0x111111);
      g.circle((eyeOX + spread + pX) * s, (eyeY + 0.15) * s, 0.55 * s); g.fill(0x111111);

      // Catch-lights
      g.circle((eyeOX - spread + pX + 0.5) * s, (eyeY - 0.25) * s, 0.26 * s); g.fill({ color: 0xffffff, alpha: 0.75 });
      g.circle((eyeOX + spread + pX + 0.5) * s, (eyeY - 0.25) * s, 0.26 * s); g.fill({ color: 0xffffff, alpha: 0.75 });

      // Eye outlines
      g.ellipse((eyeOX - spread) * s, eyeY * s, 2.2 * s, 1.8 * s); g.stroke({ width: s * 0.28, color: this.SKIN_DK, alpha: 0.5 });
      g.ellipse((eyeOX + spread) * s, eyeY * s, 2.2 * s, 1.8 * s); g.stroke({ width: s * 0.28, color: this.SKIN_DK, alpha: 0.5 });

      // Heavy brow
      g.moveTo((eyeOX - spread - 2) * s, (eyeY - 1.8) * s);
      g.lineTo((eyeOX - spread + 2) * s, (eyeY - 2.5) * s);
      g.moveTo((eyeOX + spread - 2) * s, (eyeY - 2.5) * s);
      g.lineTo((eyeOX + spread + 2) * s, (eyeY - 1.8) * s);
      g.stroke({ width: s * 1.0, color: this.SKIN_DK, alpha: 0.52 });

      if (faceCam) {
        const noseY = head.y + 2.5 + iso.y * 0.3;
        g.ellipse(head.x * s, noseY * s, 2 * wf * s, 1.2 * s); g.fill(darken(this.SKIN, 0.08));
        g.circle((head.x - 1 * wf) * s, (noseY + 0.3) * s, 0.6 * s); g.fill(this.SKIN_DK);
        g.circle((head.x + 1 * wf) * s, (noseY + 0.3) * s, 0.6 * s); g.fill(this.SKIN_DK);

        const mY = head.y + 4.5 + iso.y * 0.4;
        const mW = 3.5 * wf;
        g.moveTo((head.x - mW) * s, mY * s);
        g.quadraticCurveTo(head.x * s, (mY + 1.5) * s, (head.x + mW) * s, mY * s);
        g.stroke({ width: s * 0.8, color: 0x332211, alpha: 0.6 });

        // Underbite fangs
        g.poly([(head.x - 2 * wf) * s, mY * s, (head.x - 2.3 * wf) * s, (mY - 1.8) * s, (head.x - 1.5 * wf) * s, mY * s]);
        g.fill(0xeeddcc);
        g.poly([(head.x + 2 * wf) * s, mY * s, (head.x + 2.3 * wf) * s, (mY - 1.8) * s, (head.x + 1.5 * wf) * s, mY * s]);
        g.fill(0xeeddcc);
      }
    }
  }
}
