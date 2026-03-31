import type { Graphics } from "pixi.js";
import type { Model, RenderContext, DrawCall, Skeleton, AttachmentPoint, V } from "../types";
import { DEPTH_SHADOW, DEPTH_FAR_LIMB, DEPTH_BODY, DEPTH_HEAD, DEPTH_NEAR_LIMB } from "../types";
import { darken, lighten } from "../palette";
import { drawTaperedLimb } from "../draw-helpers";

/**
 * Imp NPC — small demonic creature with bat wings and horns.
 * Dark red skin, glowing yellow slit eyes, barbed tail, flapping wings.
 * CAN hold weapons.
 */
export class ImpBody implements Model {
  readonly id = "imp-body";
  readonly name = "Imp";
  readonly category = "npc" as const;
  readonly slot = "root" as const;

  private readonly SKIN    = 0x883333;
  private readonly SKIN_DK = 0x662222;
  private readonly HORN    = 0x332222;
  private readonly WING    = 0x553333;
  private readonly EYE     = 0xffaa00;

  getDrawCalls(ctx: RenderContext): DrawCall[] {
    const { skeleton, facingCamera, nearSide, farSide } = ctx;
    const j = skeleton.joints;
    const { iso } = skeleton;
    const calls: DrawCall[] = [];

    calls.push({ depth: DEPTH_SHADOW, draw: (g, s) => {
      g.ellipse(iso.x * s, 2 * s, 8 * s, 3 * s);
      g.fill({ color: 0x000000, alpha: 0.15 });
    }});

    calls.push({ depth: DEPTH_SHADOW + 5, draw: (g, s) => this.drawWings(g, j, skeleton, s) });
    calls.push({ depth: DEPTH_SHADOW + 8, draw: (g, s) => this.drawTail(g, j, skeleton, s)  });

    calls.push({ depth: DEPTH_FAR_LIMB,     draw: (g, s) => this.drawLeg(g, j, skeleton, s, farSide,  false) });
    calls.push({ depth: DEPTH_FAR_LIMB + 2, draw: (g, s) => this.drawLeg(g, j, skeleton, s, nearSide, true)  });

    calls.push({ depth: facingCamera ? DEPTH_FAR_LIMB + 4 : DEPTH_NEAR_LIMB,
      draw: (g, s) => this.drawArm(g, j, s, farSide, false) });

    calls.push({ depth: DEPTH_BODY,     draw: (g, s) => this.drawTorso(g, j, skeleton, s, nearSide) });
    calls.push({ depth: DEPTH_HEAD,     draw: (g, s) => this.drawHead(g, j, skeleton, s) });

    calls.push({ depth: facingCamera ? DEPTH_NEAR_LIMB + 5 : DEPTH_FAR_LIMB + 5,
      draw: (g, s) => this.drawArm(g, j, s, nearSide, true) });

    return calls;
  }

  getAttachmentPoints(skeleton: Skeleton): Record<string, AttachmentPoint> {
    return { "hand-R": skeleton.attachments["hand-R"], "hand-L": skeleton.attachments["hand-L"] };
  }

  // ─── TORSO ────────────────────────────────────────────────────────

  private drawTorso(g: Graphics, j: Record<string, V>, sk: Skeleton, s: number, nearSide: "L" | "R"): void {
    const { iso } = sk;
    const neckBase = j.neckBase;
    const W = 0.75;
    const cL = { x: j.chestL.x * W, y: j.chestL.y };
    const cR = { x: j.chestR.x * W, y: j.chestR.y };
    const hL = { x: j.hipL.x * W,   y: j.hipL.y   };
    const hR = { x: j.hipR.x * W,   y: j.hipR.y   };

    g.moveTo(neckBase.x * s, neckBase.y * s);
    g.quadraticCurveTo(cR.x * s, cR.y * s, cR.x * s, (cR.y + 2) * s);
    g.lineTo(hR.x * s, hR.y * s);
    g.lineTo(hL.x * s, hL.y * s);
    g.lineTo(cL.x * s, (cL.y + 2) * s);
    g.quadraticCurveTo(cL.x * s, cL.y * s, neckBase.x * s, neckBase.y * s);
    g.closePath();
    g.fill(this.SKIN);

    // Directional shadow on far side
    const sideAmt = Math.abs(iso.x);
    if (sideAmt > 0.1) {
      const shadowIsRight = nearSide === "L";
      const sX = shadowIsRight ? cR : cL;
      const sH = shadowIsRight ? hR : hL;
      const dir = shadowIsRight ? 1 : -1;
      const bW = sideAmt * 2.5;
      g.moveTo((sX.x - dir * bW) * s, sX.y * s);
      g.lineTo(sX.x * s, sX.y * s);
      g.lineTo(sH.x * s, sH.y * s);
      g.lineTo((sH.x - dir * bW) * s, sH.y * s);
      g.closePath();
      g.fill({ color: darken(this.SKIN, 0.25), alpha: sideAmt * 0.42 });
    }

    g.moveTo(neckBase.x * s, neckBase.y * s);
    g.quadraticCurveTo(cR.x * s, cR.y * s, cR.x * s, (cR.y + 2) * s);
    g.lineTo(hR.x * s, hR.y * s);
    g.lineTo(hL.x * s, hL.y * s);
    g.lineTo(cL.x * s, (cL.y + 2) * s);
    g.quadraticCurveTo(cL.x * s, cL.y * s, neckBase.x * s, neckBase.y * s);
    g.closePath();
    g.stroke({ width: s * 0.5, color: this.SKIN_DK, alpha: 0.4 });

    g.roundRect((neckBase.x - 1.5) * s, (neckBase.y - 2) * s, 3 * s, 3 * s, 1 * s);
    g.fill(this.SKIN);
  }

  // ─── LEG ──────────────────────────────────────────────────────────

  private drawLeg(g: Graphics, j: Record<string, V>, sk: Skeleton, s: number, side: "L" | "R", isNear: boolean): void {
    const hip   = j[`hip${side}`];
    const knee  = j[`knee${side}`];
    const ankle = j[`ankle${side}`];
    const lC  = isNear ? this.SKIN : darken(this.SKIN, 0.08);
    const lDk = this.SKIN_DK;
    const lTop: V = { x: hip.x * 0.4, y: hip.y };

    drawTaperedLimb(g, lTop, knee, 3.5, 2.5, lC, lDk, darken(lC, 0.3), s);
    drawTaperedLimb(g, knee, ankle, 2.5, 2, lC, lDk, darken(lC, 0.3), s);

    const iso  = sk.iso;
    const tipX = ankle.x + iso.x * 2.5, tipY = ankle.y + iso.y * 1.2 + 1.5;
    g.moveTo(ankle.x * s, ankle.y * s);
    g.lineTo(tipX * s, tipY * s);
    g.stroke({ width: s * 1.5, color: lDk });

    const fdx = tipX - ankle.x, fdy = tipY - ankle.y;
    const flen = Math.sqrt(fdx * fdx + fdy * fdy) || 1;
    const pnx = -fdy / flen, pny = fdx / flen;
    g.moveTo(tipX * s, tipY * s);
    g.lineTo((tipX + fdx / flen + pnx * 0.5) * s, (tipY + fdy / flen * 0.5 + pny * 0.5) * s);
    g.moveTo(tipX * s, tipY * s);
    g.lineTo((tipX + fdx / flen - pnx * 0.5) * s, (tipY + fdy / flen * 0.5 - pny * 0.5) * s);
    g.stroke({ width: s * 0.6, color: this.HORN });
  }

  // ─── ARM ──────────────────────────────────────────────────────────

  private drawArm(g: Graphics, j: Record<string, V>, s: number, side: "L" | "R", isNear: boolean): void {
    const shoulder = j[`shoulder${side}`];
    const elbow    = j[`elbow${side}`];
    const wrist    = j[`wrist${side}`];
    const aC  = isNear ? this.SKIN : darken(this.SKIN, 0.08);
    const aDk = this.SKIN_DK;

    drawTaperedLimb(g, shoulder, elbow, 2.5, 2.0, aC, aDk, darken(aC, 0.3), s);
    drawTaperedLimb(g, elbow, wrist, 2.0, 1.5, aC, aDk, darken(aC, 0.3), s);

    g.circle(wrist.x * s, wrist.y * s, 1.8 * s); g.fill(aC);

    const dx = wrist.x - elbow.x, dy = wrist.y - elbow.y;
    const len = Math.sqrt(dx * dx + dy * dy) || 1;
    for (let i = -1; i <= 1; i++) {
      const px = (-dy / len) * i * 1, py = (dx / len) * i * 1;
      g.moveTo(wrist.x * s, wrist.y * s);
      g.lineTo((wrist.x + dx / len * 2 + px) * s, (wrist.y + dy / len * 2 + py) * s);
      g.stroke({ width: s * 0.5, color: this.HORN });
    }
  }

  // ─── HEAD ─────────────────────────────────────────────────────────

  private drawHead(g: Graphics, j: Record<string, V>, sk: Skeleton, s: number): void {
    const head = j.head;
    const { wf, iso } = sk;
    const faceCam = iso.y > 0;
    const sideView = Math.abs(iso.x) > 0.3;
    const r = 6;

    this.drawHorns(g, head, wf, iso, r, s);

    g.ellipse(head.x * s, head.y * s, r * wf * s, (r - 0.5) * s);
    g.fill(this.SKIN);

    // Directional skull shading
    if (Math.abs(iso.x) > 0.15) {
      const sEX = head.x - iso.x * r * wf * 0.88;
      const sX  = head.x - iso.x * r * wf * 0.1;
      g.moveTo(sEX * s, (head.y - (r - 0.5) * 0.6) * s);
      g.quadraticCurveTo((sEX - iso.x * 1.2) * s, head.y * s, sEX * s, (head.y + (r - 0.5) * 0.6) * s);
      g.lineTo(sX * s, (head.y + (r - 0.5) * 0.5) * s);
      g.quadraticCurveTo((sX - iso.x * 0.3) * s, head.y * s, sX * s, (head.y - (r - 0.5) * 0.5) * s);
      g.closePath();
      g.fill({ color: darken(this.SKIN, 0.22), alpha: Math.abs(iso.x) * 0.4 });
    }

    g.ellipse(head.x * s, head.y * s, r * wf * s, (r - 0.5) * s);
    g.stroke({ width: s * 0.5, color: this.SKIN_DK, alpha: 0.4 });

    if (faceCam) {
      g.poly([(head.x - 2 * wf) * s, (head.y + r - 2) * s, head.x * s, (head.y + r + 1) * s, (head.x + 2 * wf) * s, (head.y + r - 2) * s]);
      g.fill(this.SKIN);
    }

    if (faceCam || (sideView && iso.y >= -0.1)) {
      const spread = 2.5 * wf;
      const eyeY  = head.y + 0.5 + iso.y * 0.6;
      const eyeOX = head.x + iso.x * 0.6;

      // Yellow iris
      g.ellipse((eyeOX - spread) * s, eyeY * s, 2.0 * s, 1.5 * s); g.fill(this.EYE);
      g.ellipse((eyeOX + spread) * s, eyeY * s, 2.0 * s, 1.5 * s); g.fill(this.EYE);

      // Slit pupil (directional)
      const iX = iso.x * 0.35;
      g.ellipse((eyeOX - spread + iX) * s, eyeY * s, 0.5 * s, 1.2 * s); g.fill(0x111111);
      g.ellipse((eyeOX + spread + iX) * s, eyeY * s, 0.5 * s, 1.2 * s); g.fill(0x111111);

      // Glow aura
      g.ellipse((eyeOX - spread) * s, eyeY * s, 2.7 * s, 2.1 * s); g.fill({ color: this.EYE, alpha: 0.14 });
      g.ellipse((eyeOX + spread) * s, eyeY * s, 2.7 * s, 2.1 * s); g.fill({ color: this.EYE, alpha: 0.14 });

      // Catch-light
      g.circle((eyeOX - spread + iso.x * 0.5 + 0.45) * s, (eyeY - 0.3) * s, 0.25 * s);
      g.fill({ color: 0xffffff, alpha: 0.7 });
      g.circle((eyeOX + spread + iso.x * 0.5 + 0.45) * s, (eyeY - 0.3) * s, 0.25 * s);
      g.fill({ color: 0xffffff, alpha: 0.7 });

      if (faceCam) {
        const mY = head.y + 3 + iso.y * 0.3;
        g.moveTo((head.x - 2.5 * wf) * s, mY * s);
        g.quadraticCurveTo(head.x * s, (mY + 1.5) * s, (head.x + 2.5 * wf) * s, mY * s);
        g.stroke({ width: s * 0.6, color: this.SKIN_DK, alpha: 0.5 });

        g.moveTo((head.x - 1.5 * wf) * s, mY * s);
        g.lineTo((head.x - 1.5 * wf) * s, (mY + 1) * s);
        g.moveTo((head.x + 1.5 * wf) * s, mY * s);
        g.lineTo((head.x + 1.5 * wf) * s, (mY + 1) * s);
        g.stroke({ width: s * 0.5, color: 0xeeddcc, alpha: 0.55 });
      }
    }
  }

  // ─── HORNS ────────────────────────────────────────────────────────

  private drawHorns(g: Graphics, head: V, wf: number, iso: V, r: number, s: number): void {
    for (const side of [-1, 1]) {
      const bX = head.x + side * r * 0.5 * wf;
      const bY = head.y - r + 1;
      const tX = bX + side * 3, tY = bY - 5;

      g.moveTo(bX * s, bY * s);
      g.quadraticCurveTo((bX + side * 2) * s, (bY - 1) * s, tX * s, tY * s);
      g.quadraticCurveTo((bX + side * 1) * s, (bY - 2) * s, (bX - side * 0.5) * s, bY * s);
      g.closePath(); g.fill(this.HORN);

      // Highlight on near side
      g.moveTo(bX * s, bY * s);
      g.quadraticCurveTo((bX + side * 2) * s, (bY - 1) * s, tX * s, tY * s);
      g.stroke({ width: s * 0.38, color: darken(this.HORN, 0.2), alpha: 0.4 });
    }
  }

  // ─── WINGS ────────────────────────────────────────────────────────

  private drawWings(g: Graphics, j: Record<string, V>, sk: Skeleton, s: number): void {
    const { iso, walkPhase, wf } = sk;
    const shoulder = { x: (j.shoulderL.x + j.shoulderR.x) / 2, y: j.shoulderL.y };
    const flap = walkPhase !== 0 ? Math.sin(walkPhase * 3) * 3 : 0;
    const sideAmt = Math.abs(iso.x);

    for (const side of [-1, 1]) {
      const bX = shoulder.x + side * 3 * wf;
      const bY = shoulder.y - 1;
      const tipX = bX + side * 14, tipY = bY - 6 + flap * side;
      const midX = bX + side * 10, midY = bY + 4 + flap * side * 0.5;
      const lowX = bX + side * 5,  lowY = bY + 10;

      // Wing fill — near side slightly brighter
      const wAlpha = side === 1 ? (iso.x > 0 ? 0.7 : 0.5) : (iso.x < 0 ? 0.7 : 0.5);
      g.moveTo(bX * s, bY * s);
      g.quadraticCurveTo((bX + side * 7) * s, (bY - 8 + flap * side) * s, tipX * s, tipY * s);
      g.quadraticCurveTo((midX + side * 2) * s, (bY - 1 + flap * side * 0.3) * s, midX * s, midY * s);
      g.quadraticCurveTo((lowX + side * 3) * s, (bY + 6) * s, lowX * s, lowY * s);
      g.lineTo(bX * s, (bY + 5) * s);
      g.closePath();
      g.fill({ color: this.WING, alpha: wAlpha });

      // Wing bones
      g.moveTo(bX * s, bY * s); g.lineTo(tipX * s, tipY * s);
      g.stroke({ width: s * 0.8, color: this.SKIN_DK, alpha: 0.5 });
      g.moveTo(bX * s, bY * s); g.lineTo(midX * s, midY * s);
      g.stroke({ width: s * 0.6, color: this.SKIN_DK, alpha: 0.4 });
      g.moveTo(bX * s, bY * s); g.lineTo(lowX * s, lowY * s);
      g.stroke({ width: s * 0.5, color: this.SKIN_DK, alpha: 0.35 });
    }
  }

  // ─── TAIL ─────────────────────────────────────────────────────────

  private drawTail(g: Graphics, j: Record<string, V>, sk: Skeleton, s: number): void {
    const { iso, walkPhase } = sk;
    const crotch = j.crotch;
    const sway = walkPhase !== 0 ? Math.sin(walkPhase * 2) * 2 : 0;
    const tailEndX = crotch.x - iso.x * 10 + sway;
    const tailEndY = crotch.y + 3;

    g.moveTo(crotch.x * s, crotch.y * s);
    g.quadraticCurveTo((crotch.x - iso.x * 5 + sway * 0.5) * s, (crotch.y + 5) * s, tailEndX * s, tailEndY * s);
    g.stroke({ width: s * 1.2, color: this.SKIN_DK });

    const tdx = tailEndX - crotch.x, tdy = tailEndY - crotch.y;
    const tlen = Math.sqrt(tdx * tdx + tdy * tdy) || 1;
    const pnx = -tdy / tlen, pny = tdx / tlen;
    g.poly([
      tailEndX * s, tailEndY * s,
      (tailEndX + tdx / tlen * 2 + pnx * 1.5) * s, (tailEndY + tdy / tlen * 1 + pny * 1.5) * s,
      (tailEndX + tdx / tlen * 3) * s, tailEndY * s,
      (tailEndX + tdx / tlen * 2 - pnx * 1.5) * s, (tailEndY + tdy / tlen * 1 - pny * 1.5) * s,
    ]);
    g.fill(this.SKIN_DK);
  }
}
