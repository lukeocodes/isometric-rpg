import type { Graphics } from "pixi.js";
import type { Model, RenderContext, DrawCall, Skeleton, AttachmentPoint, V } from "../types";
import { DEPTH_SHADOW, DEPTH_FAR_LIMB, DEPTH_BODY, DEPTH_HEAD, DEPTH_NEAR_LIMB } from "../types";
import { darken, lighten } from "../palette";
import { drawTaperedLimb } from "../draw-helpers";

/**
 * Ogre NPC — massive hulking humanoid, grey-green skin.
 * Tree-trunk limbs, tiny head, underbite tusks, beady eyes.
 * CAN hold weapons.
 */
export class OgreBody implements Model {
  readonly id = "ogre-body";
  readonly name = "Ogre";
  readonly category = "npc" as const;
  readonly slot = "root" as const;

  private readonly SKIN    = 0x6a7a5a;
  private readonly SKIN_DK = 0x4a5a3a;
  private readonly SKIN_LT = 0x8a9a7a;
  private readonly BELLY   = 0x7a8a6a;
  private readonly EYE     = 0xcc8800;

  getDrawCalls(ctx: RenderContext): DrawCall[] {
    const { skeleton, facingCamera, nearSide, farSide } = ctx;
    const j = skeleton.joints;
    const { iso } = skeleton;
    const calls: DrawCall[] = [];

    calls.push({ depth: DEPTH_SHADOW, draw: (g, s) => {
      g.ellipse(iso.x * 2 * s, 2 * s, 18 * s, 6 * s);
      g.fill({ color: 0x000000, alpha: 0.22 });
      g.ellipse(iso.x * 2 * s, 2 * s, 11 * s, 3.5 * s);
      g.fill({ color: 0x000000, alpha: 0.1 });
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
    const W = 1.5;
    const cL = { x: j.chestL.x * W, y: j.chestL.y };
    const cR = { x: j.chestR.x * W, y: j.chestR.y };
    const wL = { x: j.waistL.x * W * 1.2, y: j.waistL.y };
    const wR = { x: j.waistR.x * W * 1.2, y: j.waistR.y };
    const hL = { x: j.hipL.x * W, y: j.hipL.y };
    const hR = { x: j.hipR.x * W, y: j.hipR.y };

    this.torsoPath(g, j, s, W);
    g.fill(this.SKIN);

    // Directional side shading
    const sideAmt = Math.abs(iso.x);
    if (sideAmt > 0.08) {
      const shadowIsRight = nearSide === "L";
      const sX  = shadowIsRight ? cR : cL;
      const sW  = shadowIsRight ? wR : wL;
      const sH  = shadowIsRight ? hR : hL;
      const dir = shadowIsRight ? 1 : -1;
      const bW  = sideAmt * 5.5;
      g.moveTo(neckBase.x * s, neckBase.y * s);
      g.quadraticCurveTo(sX.x * s, (sX.y - 0.8) * s, sX.x * s, sX.y * s);
      g.quadraticCurveTo((sX.x + dir * 1.2) * s, ((sX.y + sW.y) / 2) * s, sW.x * s, sW.y * s);
      g.quadraticCurveTo((sW.x + dir * 1.5) * s, ((sW.y + sH.y) / 2) * s, sH.x * s, sH.y * s);
      g.lineTo((sH.x - dir * bW) * s, sH.y * s);
      g.quadraticCurveTo((sW.x - dir * bW + dir * 0.8) * s, ((sW.y + sH.y) / 2) * s, (sW.x - dir * bW) * s, sW.y * s);
      g.quadraticCurveTo((sX.x - dir * bW + dir * 0.6) * s, ((sX.y + sW.y) / 2) * s, (sX.x - dir * bW) * s, sX.y * s);
      g.lineTo((neckBase.x - dir * bW * 0.5) * s, neckBase.y * s);
      g.closePath();
      g.fill({ color: darken(this.SKIN, 0.22), alpha: sideAmt * 0.48 });
    }

    // Belly bulge
    g.ellipse(neckBase.x * s, ((wL.y + cL.y) / 2 + 1) * s, 8 * wf * s, 6 * s);
    g.fill({ color: this.BELLY, alpha: 0.2 });

    this.torsoPath(g, j, s, W);
    g.stroke({ width: s * 0.8, color: this.SKIN_DK, alpha: 0.45 });

    // Warts
    for (const [wx, wy] of [[4, -24], [-5, -22], [6, -19], [-3, -18]]) {
      g.circle((neckBase.x + wx) * s, (neckBase.y + wy + 18) * s, 0.9 * s);
      g.fill(this.SKIN_DK);
      g.circle((neckBase.x + wx) * s, (neckBase.y + wy + 18) * s, 0.9 * s);
      g.stroke({ width: s * 0.2, color: darken(this.SKIN_DK, 0.2), alpha: 0.3 });
    }

    g.roundRect((neckBase.x - 4) * s, (neckBase.y - 1.5) * s, 8 * s, 3 * s, 2 * s);
    g.fill(this.SKIN);
  }

  private torsoPath(g: Graphics, j: Record<string, V>, s: number, W: number): void {
    const nB = j.neckBase;
    const cL = { x: j.chestL.x * W, y: j.chestL.y }, cR = { x: j.chestR.x * W, y: j.chestR.y };
    const wL = { x: j.waistL.x * W * 1.2, y: j.waistL.y }, wR = { x: j.waistR.x * W * 1.2, y: j.waistR.y };
    const hL = { x: j.hipL.x * W, y: j.hipL.y }, hR = { x: j.hipR.x * W, y: j.hipR.y };
    g.moveTo(nB.x * s, nB.y * s);
    g.quadraticCurveTo(cR.x * s, (cR.y - 1) * s, cR.x * s, cR.y * s);
    g.quadraticCurveTo((wR.x + 3) * s, ((cR.y + wR.y) / 2) * s, wR.x * s, wR.y * s);
    g.quadraticCurveTo((hR.x * W + 1) * s, ((wR.y + hR.y) / 2) * s, hR.x * s, hR.y * s);
    g.lineTo(hL.x * s, hL.y * s);
    g.quadraticCurveTo((hL.x * W - 1) * s, ((wL.y + hL.y) / 2) * s, wL.x * s, wL.y * s);
    g.quadraticCurveTo((wL.x - 3) * s, ((cL.y + wL.y) / 2) * s, cL.x * s, cL.y * s);
    g.quadraticCurveTo(cL.x * s, (cL.y - 1) * s, nB.x * s, nB.y * s);
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
    const lTop: V = { x: hip.x * 0.7, y: hip.y };

    drawTaperedLimb(g, lTop, knee, 8, 6.5, lC, lDk, lOu, s);

    g.ellipse(knee.x * s, knee.y * s, 4.2 * s, 2.7 * s); g.fill(lighten(lC, 0.04));
    g.ellipse(knee.x * s, (knee.y + 0.8) * s, 2.7 * s, 1.7 * s); g.fill(darken(lC, 0.08));
    g.ellipse(knee.x * s, knee.y * s, 4.2 * s, 2.7 * s); g.stroke({ width: s * 0.38, color: lOu, alpha: 0.28 });

    drawTaperedLimb(g, knee, ankle, 6.5, 5, lC, lDk, lOu, s);

    const iso  = sk.iso;
    const tipX = ankle.x + iso.x * 5.5, tipY = ankle.y + iso.y * 2.5 + 2.5;
    const fdx  = tipX - ankle.x, fdy = tipY - ankle.y;
    const flen = Math.sqrt(fdx * fdx + fdy * fdy) || 1;
    const pnx  = -fdy / flen, pny = fdx / flen;

    g.moveTo((ankle.x + pnx * 3.5) * s, (ankle.y + pny * 3.5) * s);
    g.lineTo((tipX + pnx * 2.5) * s, (tipY + pny * 2.5) * s);
    g.quadraticCurveTo((tipX + fdx / flen * 2.5) * s, (tipY + fdy / flen * 1.5) * s, (tipX - pnx * 2.5) * s, (tipY - pny * 2.5) * s);
    g.lineTo((ankle.x - pnx * 3.5) * s, (ankle.y - pny * 3.5) * s);
    g.closePath(); g.fill(lDk);

    for (const off of [-1.2, 0, 1.2]) {
      g.circle((tipX + pnx * off) * s, (tipY + pny * off) * s, 1.1 * s);
      g.fill(lDk);
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

    drawTaperedLimb(g, shoulder, elbow, 6, 5, aC, aDk, aOu, s);
    g.circle(elbow.x * s, elbow.y * s, 3 * s); g.fill(aC);
    g.circle(elbow.x * s, elbow.y * s, 3 * s); g.stroke({ width: s * 0.5, color: aOu, alpha: 0.32 });
    drawTaperedLimb(g, elbow, wrist, 5, 4, aC, aDk, aOu, s);

    g.circle(wrist.x * s, wrist.y * s, 3.5 * s); g.fill(aC);
    g.circle(wrist.x * s, wrist.y * s, 3.5 * s); g.stroke({ width: s * 0.4, color: aDk, alpha: 0.3 });

    const dx = wrist.x - elbow.x, dy = wrist.y - elbow.y;
    const len = Math.sqrt(dx * dx + dy * dy) || 1;
    for (let i = -1; i <= 1; i++) {
      const px = (-dy / len) * i * 1.8, py = (dx / len) * i * 1.8;
      g.circle((wrist.x + dx / len * 2.2 + px) * s, (wrist.y + dy / len * 2.2 + py) * s, 1.1 * s);
      g.fill(aDk);
    }
  }

  // ─── HEAD ─────────────────────────────────────────────────────────

  private drawHead(g: Graphics, j: Record<string, V>, sk: Skeleton, s: number): void {
    const head = j.head;
    const { wf, iso } = sk;
    const faceCam = iso.y > 0;
    const sideView = Math.abs(iso.x) > 0.3;
    const r = 7;

    if (sideView) {
      const eS = iso.x > 0 ? 1 : -1;
      const eX = head.x + eS * r * wf * 0.85;
      g.ellipse(eX * s, (head.y + 1) * s, 1.8 * s, 2.2 * s); g.fill(this.SKIN);
      g.ellipse(eX * s, (head.y + 1) * s, 1.0 * s, 1.3 * s); g.fill(this.SKIN_DK);
    }

    g.ellipse(head.x * s, head.y * s, (r + 1) * wf * s, r * s);
    g.fill(this.SKIN);

    if (faceCam) {
      g.ellipse(head.x * s, (head.y + 3) * s, (r + 1.5) * wf * s, (r - 2) * s);
      g.fill(this.SKIN);
    }

    // Brow ridge arc
    if (faceCam || (sideView && iso.y >= -0.1)) {
      const browY = head.y - 2.5;
      const browW = (r + 0.5) * wf;
      g.moveTo((head.x - browW) * s, browY * s);
      g.quadraticCurveTo(head.x * s, (browY - 2) * s, (head.x + browW) * s, browY * s);
      g.stroke({ width: s * 1.8, color: this.SKIN_DK, alpha: 0.35 });
    }

    // Directional skull shading
    if (Math.abs(iso.x) > 0.15) {
      const sX  = head.x - iso.x * (r + 1) * wf * 0.1;
      const sEX = head.x - iso.x * (r + 1) * wf * 0.88;
      g.moveTo(sEX * s, (head.y - r * 0.6) * s);
      g.quadraticCurveTo((sEX - iso.x * 1.8) * s, head.y * s, sEX * s, (head.y + r * 0.6) * s);
      g.lineTo(sX * s, (head.y + r * 0.5) * s);
      g.quadraticCurveTo((sX - iso.x * 0.5) * s, head.y * s, sX * s, (head.y - r * 0.5) * s);
      g.closePath();
      g.fill({ color: darken(this.SKIN, 0.22), alpha: Math.abs(iso.x) * 0.4 });
    }

    g.ellipse(head.x * s, head.y * s, (r + 1) * wf * s, r * s);
    g.stroke({ width: s * 0.7, color: this.SKIN_DK, alpha: 0.45 });

    if (faceCam || (sideView && iso.y >= -0.1)) {
      const spread = 2.8 * wf;
      const eyeY  = head.y + 1 + iso.y * 0.6;
      const eyeOX = head.x + iso.x * 0.6;

      // Small amber eyes
      g.ellipse((eyeOX - spread) * s, eyeY * s, 1.4 * s, 1.1 * s); g.fill(this.EYE);
      g.ellipse((eyeOX + spread) * s, eyeY * s, 1.4 * s, 1.1 * s); g.fill(this.EYE);

      const iX = iso.x * 0.35;
      g.circle((eyeOX - spread + iX) * s, eyeY * s, 0.6 * s); g.fill(0x111111);
      g.circle((eyeOX + spread + iX) * s, eyeY * s, 0.6 * s); g.fill(0x111111);

      // Catch-light
      g.circle((eyeOX - spread + iso.x * 0.4 + 0.35) * s, (eyeY - 0.25) * s, 0.22 * s);
      g.fill({ color: 0xffffff, alpha: 0.7 });
      g.circle((eyeOX + spread + iso.x * 0.4 + 0.35) * s, (eyeY - 0.25) * s, 0.22 * s);
      g.fill({ color: 0xffffff, alpha: 0.7 });

      if (faceCam) {
        const noseY = head.y + 3;
        g.ellipse(head.x * s, noseY * s, 2.5 * wf * s, 1.5 * s); g.fill(darken(this.SKIN, 0.08));
        g.circle((head.x - 1.2 * wf) * s, (noseY + 0.3) * s, 0.8 * s); g.fill(this.SKIN_DK);
        g.circle((head.x + 1.2 * wf) * s, (noseY + 0.3) * s, 0.8 * s); g.fill(this.SKIN_DK);

        const mY = head.y + 5.5;
        const mW = 3.5 * wf;
        g.moveTo((head.x - mW) * s, (mY - 0.5) * s);
        g.quadraticCurveTo(head.x * s, (mY + 0.5) * s, (head.x + mW) * s, (mY - 0.5) * s);
        g.stroke({ width: s * 0.8, color: 0x333322, alpha: 0.5 });

        for (const side of [-1, 1]) {
          g.poly([(head.x + side * 2 * wf) * s, mY * s, (head.x + side * 2.5 * wf) * s, (mY - 3) * s, (head.x + side * 1.5 * wf) * s, mY * s]);
          g.fill(0xe8ddc0);
          g.poly([(head.x + side * 2 * wf) * s, mY * s, (head.x + side * 2.5 * wf) * s, (mY - 3) * s, (head.x + side * 1.5 * wf) * s, mY * s]);
          g.stroke({ width: s * 0.3, color: 0xaa9980, alpha: 0.4 });
        }
      }
    }

    // Forehead wart
    g.circle((head.x + 2) * s, (head.y - 3) * s, 0.8 * s); g.fill(this.SKIN_DK);
  }
}
