import type { Graphics } from "pixi.js";
import type { Model, RenderContext, DrawCall, Skeleton, AttachmentPoint, V, ModelPalette } from "../types";
import { DEPTH_SHADOW, DEPTH_FAR_LIMB, DEPTH_BODY, DEPTH_HEAD, DEPTH_NEAR_LIMB } from "../types";
import { darken, lighten } from "../palette";
import { drawTaperedLimb } from "../draw-helpers";

/**
 * Gnome body — big head, small frame, bright eyes, small pointed ears,
 * sweet smile, tiny hands and feet. Playable race.
 * ~70% human height, SLIM=0.8, head radius=9 (oversized for character).
 */
export class GnomeBody implements Model {
  readonly id       = "gnome-body";
  readonly name     = "Gnome Body";
  readonly category = "body" as const;
  readonly slot     = "root" as const;

  private readonly SLIM = 0.8;

  getDrawCalls(ctx: RenderContext): DrawCall[] {
    const { skeleton, palette, farSide, nearSide, facingCamera } = ctx;
    const j = skeleton.joints;
    const calls: DrawCall[] = [];

    calls.push({ depth: DEPTH_SHADOW, draw: (g, s) => {
      g.ellipse(skeleton.iso.x * 2 * s, 2 * s, 9 * s, 3.5 * s);
      g.fill({ color: 0x000000, alpha: 0.18 });
    }});

    calls.push({ depth: DEPTH_FAR_LIMB + 0, draw: (g, s) => this.drawLeg(g, j, palette, s, farSide,  false) });
    calls.push({ depth: DEPTH_FAR_LIMB + 2, draw: (g, s) => this.drawFoot(g, j, skeleton, palette, s, farSide, false) });
    calls.push({ depth: DEPTH_FAR_LIMB + 4, draw: (g, s) => this.drawLeg(g, j, palette, s, nearSide, true)  });
    calls.push({ depth: DEPTH_FAR_LIMB + 6, draw: (g, s) => this.drawFoot(g, j, skeleton, palette, s, nearSide, true) });

    calls.push({ depth: facingCamera ? DEPTH_FAR_LIMB + 8 : DEPTH_NEAR_LIMB + 0, draw: (g, s) => this.drawArm(g, j, skeleton, palette, s, farSide,  false) });

    if (!facingCamera) {
      calls.push({ depth: DEPTH_BODY - 1, draw: (g, s) => this.drawGlutes(g, j, skeleton, palette, s) });
    }

    calls.push({ depth: DEPTH_BODY + 0, draw: (g, s) => this.drawTorso(g, j, skeleton, palette, s, nearSide) });
    calls.push({ depth: DEPTH_BODY + 2, draw: (g, s) => this.drawPelvis(g, j, palette, s) });
    calls.push({ depth: DEPTH_HEAD,     draw: (g, s) => this.drawHead(g, j, skeleton, palette, s) });

    calls.push({ depth: facingCamera ? DEPTH_NEAR_LIMB + 5 : DEPTH_FAR_LIMB + 10, draw: (g, s) => this.drawArm(g, j, skeleton, palette, s, nearSide, true) });

    return calls;
  }

  getAttachmentPoints(skeleton: Skeleton): Record<string, AttachmentPoint> {
    const S = this.SLIM;
    return Object.fromEntries(
      Object.entries(skeleton.attachments).map(([slot, pt]) => [
        slot, { ...pt, params: { size: S, ratio: { x: S, y: 1 }, offset: { x: 0, y: 0 } } },
      ])
    );
  }

  // ─── TORSO ────────────────────────────────────────────────────────

  private drawTorso(g: Graphics, j: Record<string, V>, sk: Skeleton, p: ModelPalette, s: number, nearSide: "L" | "R"): void {
    const iso = sk.iso;
    this.torsoPath(g, j, s);
    g.fill(p.skin);

    // Directional side shading
    const sideAmt = Math.abs(iso.x);
    if (sideAmt > 0.08) {
      const shadowIsRight = nearSide === "L";
      const sX  = shadowIsRight ? this.sl(j.chestR) : this.sl(j.chestL);
      const sW  = shadowIsRight ? this.sl(j.waistR) : this.sl(j.waistL);
      const sH  = shadowIsRight ? this.sl(j.hipR)   : this.sl(j.hipL);
      const dir = shadowIsRight ? 1 : -1;
      const bW  = sideAmt * 2.6;
      const nB  = j.neckBase;
      g.moveTo(nB.x * s, nB.y * s);
      g.quadraticCurveTo(sX.x * s, (sX.y - 0.4) * s, sX.x * s, sX.y * s);
      g.quadraticCurveTo((sX.x + dir * 0.2) * s, ((sX.y + sW.y) / 2) * s, sW.x * s, sW.y * s);
      g.quadraticCurveTo((sW.x + dir * 0.4) * s, ((sW.y + sH.y) / 2) * s, sH.x * s, sH.y * s);
      g.lineTo((sH.x - dir * bW) * s, sH.y * s);
      g.quadraticCurveTo((sW.x - dir * bW + dir * 0.2) * s, ((sW.y + sH.y) / 2) * s, (sW.x - dir * bW) * s, sW.y * s);
      g.quadraticCurveTo((sX.x - dir * bW + dir * 0.1) * s, ((sX.y + sW.y) / 2) * s, (sX.x - dir * bW) * s, sX.y * s);
      g.lineTo((nB.x - dir * bW * 0.4) * s, nB.y * s);
      g.closePath();
      g.fill({ color: darken(p.skin, 0.2), alpha: sideAmt * 0.4 });
    }

    this.torsoPath(g, j, s);
    g.stroke({ width: s * 0.45, color: darken(p.skin, 0.28), alpha: 0.38 });

    // Short neck
    const nw = 2.3;
    g.roundRect((j.neckBase.x - nw / 2) * s, (j.neckBase.y - 2) * s, nw * s, 3 * s, 1 * s);
    g.fill(p.skin);
  }

  private torsoPath(g: Graphics, j: Record<string, V>, s: number): void {
    const cL = this.sl(j.chestL), cR = this.sl(j.chestR);
    const wL = this.sl(j.waistL), wR = this.sl(j.waistR);
    const hL = this.sl(j.hipL),   hR = this.sl(j.hipR);
    const nB = j.neckBase;
    g.moveTo(nB.x * s, nB.y * s);
    g.quadraticCurveTo(cR.x * s, (cR.y - 0.5) * s, cR.x * s, cR.y * s);
    g.quadraticCurveTo((cR.x + 0.28) * s, ((cR.y + wR.y) / 2) * s, wR.x * s, wR.y * s);
    g.quadraticCurveTo((wR.x + 0.45) * s, ((wR.y + hR.y) / 2) * s, hR.x * s, hR.y * s);
    g.lineTo(hL.x * s, hL.y * s);
    g.quadraticCurveTo((wL.x - 0.45) * s, ((wL.y + hL.y) / 2) * s, wL.x * s, wL.y * s);
    g.quadraticCurveTo((cL.x - 0.28) * s, ((cL.y + wL.y) / 2) * s, cL.x * s, cL.y * s);
    g.quadraticCurveTo(cL.x * s, (cL.y - 0.5) * s, nB.x * s, nB.y * s);
    g.closePath();
  }

  // ─── PELVIS ───────────────────────────────────────────────────────

  private drawPelvis(g: Graphics, j: Record<string, V>, p: ModelPalette, s: number): void {
    const hL = this.sl(j.hipL), hR = this.sl(j.hipR), c = j.crotch;
    g.moveTo(hL.x * s, hL.y * s);
    g.quadraticCurveTo((hL.x - 0.5) * s, ((hL.y + c.y) / 2) * s, ((hL.x + c.x) / 2) * s, c.y * s);
    g.quadraticCurveTo(c.x * s, (c.y + 1.0) * s, ((hR.x + c.x) / 2) * s, c.y * s);
    g.quadraticCurveTo((hR.x + 0.5) * s, ((hR.y + c.y) / 2) * s, hR.x * s, hR.y * s);
    g.closePath(); g.fill(p.skin);
  }

  // ─── GLUTES ───────────────────────────────────────────────────────

  private drawGlutes(g: Graphics, j: Record<string, V>, sk: Skeleton, p: ModelPalette, s: number): void {
    const hL = this.sl(j.hipL), hR = this.sl(j.hipR), c = j.crotch;
    const cC = lighten(p.skin, 0.04);
    const cW = 3.4 * sk.wf, cH = 3.0;
    const cY = hL.y + 0.3;
    const lX = hL.x * 0.42, rX = hR.x * 0.42;
    g.ellipse(lX * s, cY * s, cW * s, cH * s); g.fill(cC);
    g.ellipse(lX * s, cY * s, cW * s, cH * s); g.stroke({ width: s * 0.32, color: darken(p.skin, 0.13), alpha: 0.32 });
    g.ellipse(rX * s, cY * s, cW * s, cH * s); g.fill(cC);
    g.ellipse(rX * s, cY * s, cW * s, cH * s); g.stroke({ width: s * 0.32, color: darken(p.skin, 0.13), alpha: 0.32 });
    g.moveTo(c.x * s, (hL.y - 0.8) * s);
    g.quadraticCurveTo((c.x - 0.12) * s, cY * s, c.x * s, (cY + cH) * s);
    g.stroke({ width: s * 0.55, color: darken(p.skin, 0.2), alpha: 0.48 });
  }

  // ─── ARM ──────────────────────────────────────────────────────────

  private drawArm(g: Graphics, j: Record<string, V>, sk: Skeleton, p: ModelPalette, s: number, side: "L" | "R", isNear: boolean): void {
    const raw      = j[`shoulder${side}`];
    const shoulder = { x: raw.x + (side === "L" ? 2 : -2), y: raw.y };
    const elbow    = j[`elbow${side}`];
    const wrist    = j[`wrist${side}`];
    const ac  = isNear ? p.skin : darken(p.skin, 0.06);
    const aDk = darken(ac, 0.18);
    const aOu = darken(ac, 0.28);

    // Small deltoid cap
    g.ellipse(shoulder.x * s, shoulder.y * s, 2.4 * sk.wf * s, 1.8 * s);
    g.fill(isNear ? lighten(ac, 0.05) : ac);
    g.ellipse(shoulder.x * s, shoulder.y * s, 2.4 * sk.wf * s, 1.8 * s);
    g.stroke({ width: s * 0.28, color: aOu, alpha: 0.22 });

    drawTaperedLimb(g, shoulder, elbow, 2.8, 2.3, ac, aDk, aOu, s);
    g.circle(elbow.x * s, elbow.y * s, 1.4 * s); g.fill(ac);
    g.circle(elbow.x * s, elbow.y * s, 1.4 * s); g.stroke({ width: s * 0.25, color: aOu, alpha: 0.2 });
    drawTaperedLimb(g, elbow, wrist, 2.2, 1.8, ac, aDk, aOu, s);

    // Tiny hand
    g.ellipse(wrist.x * s, wrist.y * s, 1.9 * s, 1.5 * s); g.fill(ac);
    const dx = wrist.x - elbow.x, dy = wrist.y - elbow.y;
    const len = Math.sqrt(dx * dx + dy * dy) || 1;
    const pX = (-dy / len) * (side === "L" ? 1 : -1);
    const pY = ( dx / len) * (side === "L" ? 1 : -1);
    g.ellipse((wrist.x + pX * 1.4 + dx / len * 0.6) * s, (wrist.y + pY * 1.4 + dy / len * 0.6) * s, 1.1 * s, 0.8 * s);
    g.fill(ac);
    g.ellipse(wrist.x * s, wrist.y * s, 1.9 * s, 1.5 * s);
    g.stroke({ width: s * 0.28, color: aOu, alpha: 0.3 });
  }

  // ─── LEG ──────────────────────────────────────────────────────────

  private drawLeg(g: Graphics, j: Record<string, V>, p: ModelPalette, s: number, side: "L" | "R", isNear: boolean): void {
    const hip   = j[`hip${side}`];
    const knee  = j[`knee${side}`];
    const ankle = j[`ankle${side}`];
    const lC  = isNear ? p.skin : darken(p.skin, 0.07);
    const lDk = darken(lC, 0.2);
    const lOu = darken(lC, 0.3);
    const lTop: V = { x: hip.x * 0.5, y: hip.y };

    drawTaperedLimb(g, lTop, knee, 4.0, 3.0, lC, lDk, lOu, s);

    // Two-part kneecap (small)
    g.ellipse(knee.x * s, knee.y * s, 2.3 * s, 1.5 * s); g.fill(lighten(lC, 0.04));
    g.ellipse(knee.x * s, (knee.y + 0.5) * s, 1.4 * s, 1.0 * s); g.fill(darken(lC, 0.07));
    g.ellipse(knee.x * s, knee.y * s, 2.3 * s, 1.5 * s); g.stroke({ width: s * 0.25, color: lOu, alpha: 0.2 });

    drawTaperedLimb(g, knee, ankle, 3.0, 2.2, lC, darken(lC, 0.18), lOu, s);
  }

  // ─── FOOT ─────────────────────────────────────────────────────────

  private drawFoot(g: Graphics, j: Record<string, V>, sk: Skeleton, p: ModelPalette, s: number, side: "L" | "R", isNear: boolean): void {
    const ankle = j[`ankle${side}`];
    const iso   = sk.iso;
    const bBase = darken(p.skin, 0.18);
    const bC    = isNear ? bBase : darken(bBase, 0.07);
    const bDk   = darken(bC, 0.2);

    const footLen = 3.2;
    const tipX = ankle.x + iso.x * footLen;
    const tipY = ankle.y + iso.y * footLen * 0.5 + 1.0;
    const fdx  = tipX - ankle.x, fdy = tipY - ankle.y;
    const flen = Math.sqrt(fdx * fdx + fdy * fdy) || 1;
    const pnx = -fdy / flen, pny = fdx / flen;
    const hw = 1.6, tw = 0.9;

    // Heel
    g.ellipse((ankle.x - fdx / flen * 1.0) * s, (ankle.y - fdy / flen * 1.0 + 0.4) * s, hw * 1.2 * s, 1.1 * s);
    g.fill(bDk);
    // Ankle upper
    g.roundRect((ankle.x - hw) * s, (ankle.y - 1.2) * s, hw * 2 * s, 2.2 * s, 0.8 * s); g.fill(bC);
    // Sole
    g.moveTo((ankle.x + pnx * hw) * s, (ankle.y + pny * hw) * s);
    g.lineTo((tipX + pnx * tw) * s, (tipY + pny * tw) * s);
    g.quadraticCurveTo((tipX + fdx / flen * 1.5) * s, (tipY + fdy / flen * 0.9) * s, (tipX - pnx * tw) * s, (tipY - pny * tw) * s);
    g.lineTo((ankle.x - pnx * hw) * s, (ankle.y - pny * hw) * s);
    g.closePath(); g.fill(bC);
    // Toe highlight
    g.ellipse((tipX - fdx / flen * 0.3) * s, (tipY - fdy / flen * 0.3) * s, tw * 1.6 * s, tw * 0.9 * s);
    g.fill({ color: lighten(bC, 0.1), alpha: 0.35 });
    // Sole edge
    g.moveTo((ankle.x - pnx * hw) * s, (ankle.y - pny * hw) * s);
    g.lineTo((tipX - pnx * tw) * s, (tipY - pny * tw) * s);
    g.stroke({ width: s * 0.48, color: bDk, alpha: 0.5 });
    // Outline
    g.moveTo((ankle.x + pnx * hw) * s, (ankle.y + pny * hw) * s);
    g.lineTo((tipX + pnx * tw) * s, (tipY + pny * tw) * s);
    g.quadraticCurveTo((tipX + fdx / flen * 1.5) * s, (tipY + fdy / flen * 0.9) * s, (tipX - pnx * tw) * s, (tipY - pny * tw) * s);
    g.lineTo((ankle.x - pnx * hw) * s, (ankle.y - pny * hw) * s);
    g.closePath(); g.stroke({ width: s * 0.35, color: bDk, alpha: 0.4 });
  }

  // ─── HEAD ─────────────────────────────────────────────────────────

  private drawHead(g: Graphics, j: Record<string, V>, sk: Skeleton, p: ModelPalette, s: number): void {
    const head = j.head;
    const { wf, iso } = sk;
    const faceCam = iso.y > 0;
    const sideAmt = Math.abs(iso.x);
    const sideSign = iso.x;
    const faceAmt = Math.max(0, iso.y);
    const CR = 9.0; // large head — gnome signature

    // Small pointed ears
    if (sideAmt > 0.2) {
      const eX   = head.x + sideSign * CR * wf * 0.86;
      const eY   = head.y + 0.4;
      const eTipX = eX + sideSign * 2.8, eTipY = eY - 3.2;
      g.moveTo(eX * s, (eY + 1.5) * s);
      g.quadraticCurveTo((eX + sideSign * 1.4) * s, (eY - 0.4) * s, eTipX * s, eTipY * s);
      g.quadraticCurveTo((eX + sideSign * 0.4) * s, (eY - 1.0) * s, eX * s, (eY - 0.8) * s);
      g.closePath(); g.fill(p.skin);
      g.moveTo(eX * s, (eY + 1.5) * s);
      g.quadraticCurveTo((eX + sideSign * 1.4) * s, (eY - 0.4) * s, eTipX * s, eTipY * s);
      g.quadraticCurveTo((eX + sideSign * 0.4) * s, (eY - 1.0) * s, eX * s, (eY - 0.8) * s);
      g.closePath(); g.stroke({ width: s * 0.35, color: darken(p.skin, 0.2), alpha: 0.35 });
    } else {
      for (const eS of [-1, 1]) {
        const eBX = head.x + eS * CR * wf * 0.82;
        const eTX = eBX + eS * 2.2, eTY = head.y - 2.5;
        g.moveTo(eBX * s, (head.y + 0.6) * s);
        g.quadraticCurveTo((eBX + eS * 1.1) * s, (head.y - 0.6) * s, eTX * s, eTY * s);
        g.quadraticCurveTo((eBX + eS * 0.3) * s, (head.y - 0.8) * s, eBX * s, (head.y - 0.4) * s);
        g.closePath(); g.fill(p.skin);
        g.moveTo(eBX * s, (head.y + 0.6) * s);
        g.quadraticCurveTo((eBX + eS * 1.1) * s, (head.y - 0.6) * s, eTX * s, eTY * s);
        g.quadraticCurveTo((eBX + eS * 0.3) * s, (head.y - 0.8) * s, eBX * s, (head.y - 0.4) * s);
        g.closePath(); g.stroke({ width: s * 0.3, color: darken(p.skin, 0.18), alpha: 0.32 });
      }
    }

    // Big round cranium
    const crx = CR * wf, cry = CR;
    g.ellipse(head.x * s, head.y * s, crx * s, cry * s); g.fill(p.skin);

    // Slightly rounded lower face (less angular than human)
    if (faceAmt > 0.05 || (sideAmt > 0.15 && !Math.max(0, -iso.y))) {
      g.ellipse(head.x * s, (head.y + cry * 0.3) * s, crx * 0.68 * s, cry * 0.72 * s);
      g.fill(p.skin);
    }

    // Head outline
    g.ellipse(head.x * s, head.y * s, crx * s, cry * s);
    g.stroke({ width: s * 0.5, color: darken(p.skin, 0.28), alpha: 0.42 });

    // Directional shading
    if (sideAmt > 0.15) {
      const sX  = head.x - sideSign * crx * 0.1;
      const sEX = head.x - sideSign * crx * 0.88;
      g.moveTo(sEX * s, (head.y - cry * 0.6) * s);
      g.quadraticCurveTo((sEX - sideSign * 1.5) * s, head.y * s, sEX * s, (head.y + cry * 0.6) * s);
      g.lineTo(sX * s, (head.y + cry * 0.5) * s);
      g.quadraticCurveTo((sX - sideSign * 0.4) * s, head.y * s, sX * s, (head.y - cry * 0.5) * s);
      g.closePath();
      g.fill({ color: darken(p.skin, 0.18), alpha: sideAmt * 0.3 });
    }

    // Facial features
    if (faceAmt > 0.05 || (sideAmt > 0.2 && iso.y >= -0.1)) {
      // Big expressive eyes — gnome signature
      const spread = 3.0 * wf;
      const eyeY  = head.y + 0.2 + iso.y * 0.9;
      const eyeOX = head.x + iso.x * 0.9;

      // Brow arches (light, thin — gnomes are curious not stern)
      const bY = eyeY - 2.5;
      g.moveTo((eyeOX - spread - 1.6) * s, (bY - 0.15) * s);
      g.quadraticCurveTo((eyeOX - spread) * s, (bY - 1.0) * s, (eyeOX - spread + 1.6) * s, (bY + 0.15) * s);
      g.stroke({ width: s * 0.35, color: darken(p.skin, 0.16), alpha: 0.28 });
      g.moveTo((eyeOX + spread - 1.6) * s, (bY + 0.15) * s);
      g.quadraticCurveTo((eyeOX + spread) * s, (bY - 1.0) * s, (eyeOX + spread + 1.6) * s, (bY - 0.15) * s);
      g.stroke({ width: s * 0.35, color: darken(p.skin, 0.16), alpha: 0.28 });

      // Eyebrows — thin, arched, from hair colour
      g.moveTo((eyeOX - spread - 1.6) * s, (bY - 0.1) * s);
      g.quadraticCurveTo((eyeOX - spread) * s, (bY - 1.1) * s, (eyeOX - spread + 1.6) * s, (bY + 0.2) * s);
      g.stroke({ width: s * 0.62, color: darken(p.hair, 0.05), alpha: 0.78 });
      g.moveTo((eyeOX + spread - 1.6) * s, (bY + 0.2) * s);
      g.quadraticCurveTo((eyeOX + spread) * s, (bY - 1.1) * s, (eyeOX + spread + 1.6) * s, (bY - 0.1) * s);
      g.stroke({ width: s * 0.62, color: darken(p.hair, 0.05), alpha: 0.78 });

      // Large round eye whites
      const eRx = 2.5, eRy = 2.2;
      g.ellipse((eyeOX - spread) * s, eyeY * s, eRx * s, eRy * s); g.fill(0xf8f4ee);
      g.ellipse((eyeOX + spread) * s, eyeY * s, eRx * s, eRy * s); g.fill(0xf8f4ee);

      // Large iris
      const iX = iso.x * 0.5;
      g.circle((eyeOX - spread + iX) * s, (eyeY + 0.1) * s, 1.45 * s); g.fill(p.eyes);
      g.circle((eyeOX + spread + iX) * s, (eyeY + 0.1) * s, 1.45 * s); g.fill(p.eyes);

      // Pupil
      const pX = iso.x * 0.7;
      g.circle((eyeOX - spread + pX) * s, (eyeY - 0.05) * s, 0.62 * s); g.fill(0x0d0d0d);
      g.circle((eyeOX + spread + pX) * s, (eyeY - 0.05) * s, 0.62 * s); g.fill(0x0d0d0d);

      // Catch light — gnomes have a sparkle in their eye
      g.circle((eyeOX - spread + pX + 0.55) * s, (eyeY - 0.45) * s, 0.3 * s);  g.fill({ color: 0xffffff, alpha: 0.8 });
      g.circle((eyeOX + spread + pX + 0.55) * s, (eyeY - 0.45) * s, 0.3 * s);  g.fill({ color: 0xffffff, alpha: 0.8 });
      // Second smaller sparkle
      g.circle((eyeOX - spread + pX + 0.25) * s, (eyeY - 0.75) * s, 0.14 * s); g.fill({ color: 0xffffff, alpha: 0.5 });
      g.circle((eyeOX + spread + pX + 0.25) * s, (eyeY - 0.75) * s, 0.14 * s); g.fill({ color: 0xffffff, alpha: 0.5 });

      // Eye outlines
      g.ellipse((eyeOX - spread) * s, eyeY * s, eRx * s, eRy * s); g.stroke({ width: s * 0.32, color: darken(p.skin, 0.36), alpha: 0.5 });
      g.ellipse((eyeOX + spread) * s, eyeY * s, eRx * s, eRy * s); g.stroke({ width: s * 0.32, color: darken(p.skin, 0.36), alpha: 0.5 });

      // Button nose
      if (faceAmt > 0.12) {
        const nY = head.y + cry * 0.26;
        g.circle(head.x * s, (nY + 2.2 * faceAmt) * s, 1.5 * faceAmt * s);
        g.fill({ color: darken(p.skin, 0.07), alpha: 0.55 * faceAmt });
        g.circle(head.x * s, (nY + 2.2 * faceAmt) * s, 1.5 * faceAmt * s);
        g.stroke({ width: s * 0.3, color: darken(p.skin, 0.16), alpha: 0.32 * faceAmt });
      }

      // Sweet curved smile (gnomes always look slightly pleased)
      if (faceAmt > 0.08) {
        const mY = head.y + cry * 0.54;
        const mW = 2.0 * wf * Math.max(0.38, faceAmt);
        g.moveTo((head.x - mW) * s, mY * s);
        g.quadraticCurveTo(head.x * s, (mY + 1.2 * faceAmt) * s, (head.x + mW) * s, mY * s);
        g.stroke({ width: s * 0.52, color: darken(p.skin, 0.25), alpha: 0.5 * faceAmt });
        // Cheek dimples (tiny)
        if (faceAmt > 0.3) {
          g.circle((head.x - mW * 0.75) * s, (mY + 0.5 * faceAmt) * s, 0.5 * s);
          g.fill({ color: darken(p.skin, 0.12), alpha: 0.3 * faceAmt });
          g.circle((head.x + mW * 0.75) * s, (mY + 0.5 * faceAmt) * s, 0.5 * s);
          g.fill({ color: darken(p.skin, 0.12), alpha: 0.3 * faceAmt });
        }
      }
    }
  }

  // ─── Helper ───────────────────────────────────────────────────────
  private sl(joint: V): V { return { x: joint.x * this.SLIM, y: joint.y }; }
}
