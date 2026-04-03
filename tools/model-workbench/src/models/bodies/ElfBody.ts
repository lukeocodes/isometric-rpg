import type { Graphics } from "pixi.js";
import type { Model, RenderContext, DrawCall, Skeleton, AttachmentPoint, V, ModelPalette } from "../types";
import { DEPTH_SHADOW, DEPTH_FAR_LIMB, DEPTH_BODY, DEPTH_HEAD, DEPTH_NEAR_LIMB } from "../types";
import { darken, lighten } from "../palette";
import { drawTaperedLimb } from "../draw-helpers";

/**
 * Elf body — taller, slimmer, angular grace.
 * Narrow waist, prominent pointed ears (visible from all directions),
 * almond eyes, elegant arched brows, angular jaw.
 */
export class ElfBody implements Model {
  readonly id       = "elf-body";
  readonly name     = "Elf Body";
  readonly category = "body" as const;
  readonly slot     = "root" as const;

  private readonly SLIM = 0.85;

  getDrawCalls(ctx: RenderContext): DrawCall[] {
    const { skeleton, palette, farSide, nearSide, facingCamera } = ctx;
    const j = skeleton.joints;
    const calls: DrawCall[] = [];

    calls.push({ depth: DEPTH_SHADOW, draw: (g, s) => {
      g.ellipse(skeleton.iso.x * 2.5 * s, 2 * s, 11 * s, 4 * s);
      g.fill({ color: 0x000000, alpha: 0.16 });
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
      const sX  = shadowIsRight ? this.s(j.chestR) : this.s(j.chestL);
      const sW  = shadowIsRight ? this.s(j.waistR) : this.s(j.waistL);
      const sH  = shadowIsRight ? this.s(j.hipR)   : this.s(j.hipL);
      const dir = shadowIsRight ? 1 : -1;
      const bW  = sideAmt * 3;
      const nB  = j.neckBase;
      g.moveTo(nB.x * s, nB.y * s);
      g.quadraticCurveTo(sX.x * s, (sX.y - 1) * s, sX.x * s, sX.y * s);
      g.quadraticCurveTo((sX.x + dir * 0.2) * s, ((sX.y + sW.y) / 2) * s, sW.x * s, sW.y * s);
      g.quadraticCurveTo((sW.x + dir * 0.5) * s, ((sW.y + sH.y) / 2) * s, sH.x * s, sH.y * s);
      g.lineTo((sH.x - dir * bW) * s, sH.y * s);
      g.quadraticCurveTo((sW.x - dir * bW + dir * 0.2) * s, ((sW.y + sH.y) / 2) * s, (sW.x - dir * bW) * s, sW.y * s);
      g.quadraticCurveTo((sX.x - dir * bW + dir * 0.1) * s, ((sX.y + sW.y) / 2) * s, (sX.x - dir * bW) * s, sX.y * s);
      g.lineTo((nB.x - dir * bW * 0.4) * s, nB.y * s);
      g.closePath();
      g.fill({ color: darken(p.skin, 0.2), alpha: sideAmt * 0.42 });
    }

    // Clavicle line
    const sL = this.s(j.shoulderL), sR = this.s(j.shoulderR);
    g.moveTo(sL.x * s, (sL.y + 1) * s);
    g.quadraticCurveTo(j.neckBase.x * s, (j.neckBase.y + 0.5) * s, sR.x * s, (sR.y + 1) * s);
    g.stroke({ width: s * 0.4, color: darken(p.skin, 0.14), alpha: 0.28 });

    this.torsoPath(g, j, s);
    g.stroke({ width: s * 0.45, color: darken(p.skin, 0.28), alpha: 0.38 });

    // Neck — longer and thinner for elf
    const chestW = Math.abs(this.s(j.chestR).x - this.s(j.chestL).x);
    const nw = 2.1 * (chestW / 14);
    g.roundRect((j.neckBase.x - nw / 2) * s, (j.neckBase.y - 3.5) * s, nw * s, 4.5 * s, 1.2 * s);
    g.fill(p.skin);
  }

  private torsoPath(g: Graphics, j: Record<string, V>, s: number): void {
    const cL = this.s(j.chestL), cR = this.s(j.chestR);
    const wL = this.s(j.waistL), wR = this.s(j.waistR);
    const hL = this.s(j.hipL),   hR = this.s(j.hipR);
    const nB = j.neckBase;
    g.moveTo(nB.x * s, nB.y * s);
    g.quadraticCurveTo(cR.x * s, (cR.y - 1.5) * s, cR.x * s, cR.y * s);
    g.quadraticCurveTo((cR.x + 0.25) * s, ((cR.y + wR.y) / 2) * s, wR.x * s, wR.y * s);
    g.quadraticCurveTo((wR.x + 0.6)  * s, ((wR.y + hR.y) / 2) * s, hR.x * s, hR.y * s);
    g.lineTo(hL.x * s, hL.y * s);
    g.quadraticCurveTo((wL.x - 0.6)  * s, ((wL.y + hL.y) / 2) * s, wL.x * s, wL.y * s);
    g.quadraticCurveTo((cL.x - 0.25) * s, ((cL.y + wL.y) / 2) * s, cL.x * s, cL.y * s);
    g.quadraticCurveTo(cL.x * s, (cL.y - 1.5) * s, nB.x * s, nB.y * s);
    g.closePath();
  }

  // ─── PELVIS ───────────────────────────────────────────────────────

  private drawPelvis(g: Graphics, j: Record<string, V>, p: ModelPalette, s: number): void {
    const hL = this.s(j.hipL), hR = this.s(j.hipR), c = j.crotch;
    g.moveTo(hL.x * s, hL.y * s);
    g.quadraticCurveTo((hL.x - 0.7) * s, ((hL.y + c.y) / 2) * s, ((hL.x + c.x) / 2 - 0.3) * s, c.y * s);
    g.quadraticCurveTo(c.x * s, (c.y + 1.2) * s, ((hR.x + c.x) / 2 + 0.3) * s, c.y * s);
    g.quadraticCurveTo((hR.x + 0.7) * s, ((hR.y + c.y) / 2) * s, hR.x * s, hR.y * s);
    g.closePath();
    g.fill(p.skin);
    g.moveTo(((hL.x + c.x) / 2 - 0.3) * s, c.y * s);
    g.quadraticCurveTo(c.x * s, (c.y + 1.2) * s, ((hR.x + c.x) / 2 + 0.3) * s, c.y * s);
    g.lineTo(c.x * s, (c.y - 0.8) * s);
    g.closePath();
    g.fill({ color: darken(p.skin, 0.2), alpha: 0.35 });
  }

  // ─── GLUTES ───────────────────────────────────────────────────────

  private drawGlutes(g: Graphics, j: Record<string, V>, sk: Skeleton, p: ModelPalette, s: number): void {
    const hL = this.s(j.hipL), hR = this.s(j.hipR), c = j.crotch;
    const cC = lighten(p.skin, 0.04);
    const cW = 3.8 * sk.wf, cH = 3.5;
    const cY = hL.y + 0.4;
    const lX = hL.x * 0.4, rX = hR.x * 0.4;
    g.ellipse(lX * s, cY * s, cW * s, cH * s); g.fill(cC);
    g.ellipse(lX * s, cY * s, cW * s, cH * s); g.stroke({ width: s * 0.35, color: darken(p.skin, 0.13), alpha: 0.35 });
    g.ellipse(rX * s, cY * s, cW * s, cH * s); g.fill(cC);
    g.ellipse(rX * s, cY * s, cW * s, cH * s); g.stroke({ width: s * 0.35, color: darken(p.skin, 0.13), alpha: 0.35 });
    g.moveTo(c.x * s, (hL.y - 1) * s);
    g.quadraticCurveTo((c.x - 0.15) * s, cY * s, c.x * s, (cY + cH) * s);
    g.stroke({ width: s * 0.6, color: darken(p.skin, 0.2), alpha: 0.5 });
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

    // Deltoid cap
    g.ellipse(shoulder.x * s, shoulder.y * s, 2.8 * sk.wf * s, 2.2 * s);
    g.fill(isNear ? lighten(ac, 0.05) : ac);
    g.ellipse(shoulder.x * s, shoulder.y * s, 2.8 * sk.wf * s, 2.2 * s);
    g.stroke({ width: s * 0.3, color: aOu, alpha: 0.25 });

    drawTaperedLimb(g, shoulder, elbow, 3.2, 2.6, ac, aDk, aOu, s);
    g.circle(elbow.x * s, elbow.y * s, 1.6 * s); g.fill(ac);
    g.circle(elbow.x * s, elbow.y * s, 1.6 * s); g.stroke({ width: s * 0.3, color: aOu, alpha: 0.22 });
    drawTaperedLimb(g, elbow, wrist, 2.5, 2.0, ac, aDk, aOu, s);

    // Delicate hand with thumb hint
    g.ellipse(wrist.x * s, wrist.y * s, 2.2 * s, 1.7 * s);
    g.fill(ac);
    const dx = wrist.x - elbow.x, dy = wrist.y - elbow.y;
    const len = Math.sqrt(dx * dx + dy * dy) || 1;
    const pX = (-dy / len) * (side === "L" ? 1 : -1);
    const pY = ( dx / len) * (side === "L" ? 1 : -1);
    g.ellipse((wrist.x + pX * 1.5 + dx / len * 0.7) * s, (wrist.y + pY * 1.5 + dy / len * 0.7) * s, 1.1 * s, 0.8 * s);
    g.fill(ac);
    g.ellipse(wrist.x * s, wrist.y * s, 2.2 * s, 1.7 * s);
    g.stroke({ width: s * 0.3, color: aOu, alpha: 0.32 });
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

    drawTaperedLimb(g, lTop, knee, 4.8, 3.5, lC, lDk, lOu, s);

    // Two-part kneecap
    g.ellipse(knee.x * s, knee.y * s, 2.8 * s, 1.8 * s); g.fill(lighten(lC, 0.04));
    g.ellipse(knee.x * s, (knee.y + 0.6) * s, 1.7 * s, 1.2 * s); g.fill(darken(lC, 0.07));
    g.ellipse(knee.x * s, knee.y * s, 2.8 * s, 1.8 * s); g.stroke({ width: s * 0.28, color: lOu, alpha: 0.22 });

    drawTaperedLimb(g, knee, ankle, 3.8, 2.5, lC, darken(lC, 0.18), lOu, s);

    // Ankle malleolus
    const dir = side === "L" ? -1 : 1;
    g.ellipse((ankle.x + dir * 1.1) * s, (ankle.y + 0.3) * s, 1.1 * s, 0.8 * s);
    g.fill(lighten(lC, 0.04));
  }

  // ─── FOOT ─────────────────────────────────────────────────────────

  private drawFoot(g: Graphics, j: Record<string, V>, sk: Skeleton, p: ModelPalette, s: number, side: "L" | "R", isNear: boolean): void {
    const ankle = j[`ankle${side}`];
    const iso   = sk.iso;
    const bBase = darken(p.skin, 0.22);
    const bC    = isNear ? bBase : darken(bBase, 0.07);
    const bDk   = darken(bC, 0.2);

    const footLen = 4.2; // longer, more elegant
    const tipX = ankle.x + iso.x * footLen;
    const tipY = ankle.y + iso.y * footLen * 0.5 + 1.4;
    const fdx  = tipX - ankle.x, fdy = tipY - ankle.y;
    const flen = Math.sqrt(fdx * fdx + fdy * fdy) || 1;
    const pnx = -fdy / flen, pny = fdx / flen;
    const hw = 1.7, tw = 0.9;

    // Heel
    g.ellipse((ankle.x - fdx / flen * 1.3) * s, (ankle.y - fdy / flen * 1.3 + 0.5) * s, hw * 1.3 * s, 1.3 * s);
    g.fill(bDk);
    // Ankle upper
    g.roundRect((ankle.x - hw) * s, (ankle.y - 1.5) * s, hw * 2 * s, 3 * s, 1 * s); g.fill(bC);
    // Sole
    g.moveTo((ankle.x + pnx * hw) * s, (ankle.y + pny * hw) * s);
    g.lineTo((tipX + pnx * tw) * s, (tipY + pny * tw) * s);
    g.quadraticCurveTo((tipX + fdx / flen * 2.2) * s, (tipY + fdy / flen * 1.4) * s, (tipX - pnx * tw) * s, (tipY - pny * tw) * s);
    g.lineTo((ankle.x - pnx * hw) * s, (ankle.y - pny * hw) * s);
    g.closePath(); g.fill(bC);
    // Toe highlight
    g.ellipse((tipX - fdx / flen * 0.4) * s, (tipY - fdy / flen * 0.4) * s, tw * 1.8 * s, tw * 1.0 * s);
    g.fill({ color: lighten(bC, 0.1), alpha: 0.38 });
    // Sole edge
    g.moveTo((ankle.x - pnx * hw) * s, (ankle.y - pny * hw) * s);
    g.lineTo((tipX - pnx * tw) * s, (tipY - pny * tw) * s);
    g.stroke({ width: s * 0.5, color: bDk, alpha: 0.5 });
    // Outline
    g.moveTo((ankle.x + pnx * hw) * s, (ankle.y + pny * hw) * s);
    g.lineTo((tipX + pnx * tw) * s, (tipY + pny * tw) * s);
    g.quadraticCurveTo((tipX + fdx / flen * 2.2) * s, (tipY + fdy / flen * 1.4) * s, (tipX - pnx * tw) * s, (tipY - pny * tw) * s);
    g.lineTo((ankle.x - pnx * hw) * s, (ankle.y - pny * hw) * s);
    g.closePath(); g.stroke({ width: s * 0.38, color: bDk, alpha: 0.42 });
  }

  // ─── HEAD ─────────────────────────────────────────────────────────

  private drawHead(g: Graphics, j: Record<string, V>, sk: Skeleton, p: ModelPalette, s: number): void {
    const head = j.head;
    const { wf, iso } = sk;
    const faceCam = iso.y > 0;
    const sideAmt = Math.abs(iso.x);
    const sideSign = iso.x;
    const faceAmt = Math.max(0, iso.y);
    const CR = 6.8;

    // ─ Pointed ears — always visible, even full-front ─
    if (sideAmt > 0.2) {
      // Side / 3-quarter ear
      const eX   = head.x + sideSign * CR * wf * 0.88;
      const eY   = head.y + 0.5;
      const eTipX = eX + sideSign * 4.5;
      const eTipY = eY - 5.5;
      g.moveTo(eX * s, (eY + 2) * s);
      g.quadraticCurveTo((eX + sideSign * 2.2) * s, (eY - 0.5) * s, eTipX * s, eTipY * s);
      g.quadraticCurveTo((eX + sideSign * 1) * s, (eY - 2) * s, eX * s, (eY - 1.5) * s);
      g.closePath(); g.fill(p.skin);
      // Inner ridge
      g.moveTo(eX * s, (eY + 1) * s);
      g.quadraticCurveTo((eX + sideSign * 1.6) * s, (eY - 0.5) * s, (eTipX - sideSign * 0.4) * s, (eTipY + 1.5) * s);
      g.stroke({ width: s * 0.4, color: darken(p.skin, 0.15), alpha: 0.35 });
      // Outline
      g.moveTo(eX * s, (eY + 2) * s);
      g.quadraticCurveTo((eX + sideSign * 2.2) * s, (eY - 0.5) * s, eTipX * s, eTipY * s);
      g.quadraticCurveTo((eX + sideSign * 1) * s, (eY - 2) * s, eX * s, (eY - 1.5) * s);
      g.closePath(); g.stroke({ width: s * 0.38, color: darken(p.skin, 0.25), alpha: 0.4 });
    } else {
      // Front — tips poke out both sides
      for (const eS of [-1, 1]) {
        const eBX = head.x + eS * CR * wf * 0.88;
        const eTX = eBX + eS * 3.5, eTY = head.y - 4;
        g.moveTo(eBX * s, (head.y + 1) * s);
        g.quadraticCurveTo((eBX + eS * 1.5) * s, (head.y - 1) * s, eTX * s, eTY * s);
        g.quadraticCurveTo((eBX + eS * 0.4) * s, (head.y - 1.5) * s, eBX * s, (head.y - 1) * s);
        g.closePath(); g.fill(p.skin);
        g.moveTo(eBX * s, (head.y + 1) * s);
        g.quadraticCurveTo((eBX + eS * 1.5) * s, (head.y - 1) * s, eTX * s, eTY * s);
        g.quadraticCurveTo((eBX + eS * 0.4) * s, (head.y - 1.5) * s, eBX * s, (head.y - 1) * s);
        g.closePath(); g.stroke({ width: s * 0.35, color: darken(p.skin, 0.2), alpha: 0.35 });
      }
    }

    // Cranium
    const crx = CR * wf, cry = CR + 0.5;
    g.ellipse(head.x * s, head.y * s, crx * s, cry * s); g.fill(p.skin);

    // Angular jaw (taller/narrower for elf)
    if (faceAmt > 0.05 || (sideAmt > 0.15 && !Math.max(0, -iso.y))) {
      g.ellipse(head.x * s, (head.y + cry * 0.35) * s, crx * 0.56 * s, cry * 0.65 * s);
      g.fill(p.skin);
      // Pointed chin line
      g.moveTo((head.x - crx * 0.38) * s, (head.y + cry * 0.78) * s);
      g.quadraticCurveTo(head.x * s, (head.y + cry + 0.8) * s, (head.x + crx * 0.38) * s, (head.y + cry * 0.78) * s);
      g.stroke({ width: s * 0.4, color: darken(p.skin, 0.18), alpha: 0.28 * faceAmt + 0.12 });
    }

    // Skull outline
    g.ellipse(head.x * s, head.y * s, crx * s, cry * s);
    g.stroke({ width: s * 0.5, color: darken(p.skin, 0.3), alpha: 0.42 });

    // Directional skull shading
    if (sideAmt > 0.15) {
      const sX  = head.x - sideSign * crx * 0.12;
      const sEX = head.x - sideSign * crx * 0.88;
      g.moveTo(sEX * s, (head.y - cry * 0.55) * s);
      g.quadraticCurveTo((sEX - sideSign * 1.3) * s, head.y * s, sEX * s, (head.y + cry * 0.55) * s);
      g.lineTo(sX * s, (head.y + cry * 0.45) * s);
      g.quadraticCurveTo((sX - sideSign * 0.4) * s, head.y * s, sX * s, (head.y - cry * 0.45) * s);
      g.closePath();
      g.fill({ color: darken(p.skin, 0.18), alpha: sideAmt * 0.32 });
    }

    // Facial features
    if (faceAmt > 0.05 || (sideAmt > 0.2 && iso.y >= -0.1)) {
      const spread = 2.4 * wf;
      const eyeY  = head.y - cry * 0.05 + iso.y * 1.0;
      const eyeOX = head.x + iso.x * 1.8;

      // Brow ridge
      const browY = eyeY - 2.3;
      for (const eS of [-1, 1]) {
        g.moveTo((eyeOX + eS * (spread - 1.8)) * s, browY * s);
        g.quadraticCurveTo((eyeOX + eS * spread) * s, (browY - 0.7) * s, (eyeOX + eS * (spread + 1.8)) * s, browY * s);
        g.stroke({ width: s * 0.35, color: darken(p.skin, 0.18), alpha: 0.28 });
      }

      // Eyebrows — elegant arched, from hair colour
      g.moveTo((eyeOX - spread - 1.8) * s, (browY - 0.2) * s);
      g.quadraticCurveTo((eyeOX - spread) * s, (browY - 1.2) * s, (eyeOX - spread + 1.8) * s, (browY + 0.1) * s);
      g.stroke({ width: s * 0.7, color: darken(p.hair, 0.05), alpha: 0.82 });
      g.moveTo((eyeOX + spread - 1.8) * s, (browY + 0.1) * s);
      g.quadraticCurveTo((eyeOX + spread) * s, (browY - 1.2) * s, (eyeOX + spread + 1.8) * s, (browY - 0.2) * s);
      g.stroke({ width: s * 0.7, color: darken(p.hair, 0.05), alpha: 0.82 });

      // Almond eye whites (wider and thinner than human)
      const eRx = 2.4, eRy = 1.4;
      g.ellipse((eyeOX - spread) * s, eyeY * s, eRx * s, eRy * s); g.fill(0xf8f4ee);
      g.ellipse((eyeOX + spread) * s, eyeY * s, eRx * s, eRy * s); g.fill(0xf8f4ee);

      // Iris
      const iX = iso.x * 0.65;
      g.circle((eyeOX - spread + iX) * s, (eyeY + 0.05) * s, 1.2 * s); g.fill(p.eyes);
      g.circle((eyeOX + spread + iX) * s, (eyeY + 0.05) * s, 1.2 * s); g.fill(p.eyes);

      // Pupil
      const pX = iso.x * 0.85;
      g.circle((eyeOX - spread + pX) * s, (eyeY + 0.1) * s, 0.58 * s); g.fill(0x0d0d0d);
      g.circle((eyeOX + spread + pX) * s, (eyeY + 0.1) * s, 0.58 * s); g.fill(0x0d0d0d);

      // Catch light
      g.circle((eyeOX - spread + pX + 0.45) * s, (eyeY - 0.25) * s, 0.25 * s); g.fill({ color: 0xffffff, alpha: 0.7 });
      g.circle((eyeOX + spread + pX + 0.45) * s, (eyeY - 0.25) * s, 0.25 * s); g.fill({ color: 0xffffff, alpha: 0.7 });

      // Eye outlines
      g.ellipse((eyeOX - spread) * s, eyeY * s, eRx * s, eRy * s); g.stroke({ width: s * 0.32, color: darken(p.skin, 0.38), alpha: 0.55 });
      g.ellipse((eyeOX + spread) * s, eyeY * s, eRx * s, eRy * s); g.stroke({ width: s * 0.32, color: darken(p.skin, 0.38), alpha: 0.55 });

      // Nose
      if (faceAmt > 0.12) {
        const nY = head.y + cry * 0.22;
        const nW = 1.3 * wf * faceAmt, nH = 1.3 * faceAmt;
        g.moveTo((head.x - nW * 0.55) * s, (nY + nH) * s);
        g.quadraticCurveTo(head.x * s, (nY + nH * 1.5) * s, (head.x + nW * 0.55) * s, (nY + nH) * s);
        g.stroke({ width: s * 0.45, color: darken(p.skin, 0.18), alpha: 0.32 * faceAmt });
      }

      // Mouth — thin, composed
      if (faceAmt > 0.08) {
        const mY = head.y + cry * 0.52;
        const mW = 1.7 * wf * Math.max(0.35, faceAmt);
        g.moveTo((head.x - mW) * s, mY * s);
        g.quadraticCurveTo(head.x * s, (mY + 0.5 * faceAmt) * s, (head.x + mW) * s, mY * s);
        g.stroke({ width: s * 0.48, color: darken(p.skin, 0.24), alpha: 0.48 * faceAmt });
      }
    }
  }

  // ─── Helper ───────────────────────────────────────────────────────
  private s(joint: V): V { return { x: joint.x * this.SLIM, y: joint.y }; }
}
