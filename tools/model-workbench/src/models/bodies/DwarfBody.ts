import type { Graphics } from "pixi.js";
import type { Model, RenderContext, DrawCall, Skeleton, AttachmentPoint, V, ModelPalette } from "../types";
import { DEPTH_SHADOW, DEPTH_FAR_LIMB, DEPTH_BODY, DEPTH_HEAD, DEPTH_NEAR_LIMB } from "../types";
import { darken, lighten } from "../palette";
import { drawTaperedLimb } from "../draw-helpers";

/**
 * Dwarf body — barrel chest, thick limbs, strong jaw, prominent brow.
 * WIDE=1.25 torso, stocky proportions, heavy boots.
 */
export class DwarfBody implements Model {
  readonly id       = "dwarf-body";
  readonly name     = "Dwarf Body";
  readonly category = "body" as const;
  readonly slot     = "root" as const;

  private readonly WIDE = 1.25;

  getDrawCalls(ctx: RenderContext): DrawCall[] {
    const { skeleton, palette, farSide, nearSide, facingCamera } = ctx;
    const j = skeleton.joints;
    const calls: DrawCall[] = [];

    calls.push({ depth: DEPTH_SHADOW, draw: (g, s) => {
      g.ellipse(skeleton.iso.x * 3 * s, 2 * s, 16 * s, 5.5 * s);
      g.fill({ color: 0x000000, alpha: 0.22 });
      g.ellipse(skeleton.iso.x * 3 * s, 2 * s, 10 * s, 3 * s);
      g.fill({ color: 0x000000, alpha: 0.1 });
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
    const W = this.WIDE;
    return Object.fromEntries(
      Object.entries(skeleton.attachments).map(([slot, pt]) => [
        slot, { ...pt, params: { size: W, ratio: { x: W, y: 1 }, offset: { x: 0, y: 0 } } },
      ])
    );
  }

  // ─── TORSO ────────────────────────────────────────────────────────

  private drawTorso(g: Graphics, j: Record<string, V>, sk: Skeleton, p: ModelPalette, s: number, nearSide: "L" | "R"): void {
    const iso = sk.iso;
    this.torsoPath(g, j, s);
    g.fill(p.skin);

    // Directional shading — dwarves have notable barrel-chest volume
    const sideAmt = Math.abs(iso.x);
    if (sideAmt > 0.08) {
      const shadowIsRight = nearSide === "L";
      const sX  = shadowIsRight ? this.w(j.chestR) : this.w(j.chestL);
      const sW  = shadowIsRight ? this.w(j.waistR) : this.w(j.waistL);
      const sH  = shadowIsRight ? this.w(j.hipR)   : this.w(j.hipL);
      const dir = shadowIsRight ? 1 : -1;
      const bW  = sideAmt * 4.5;
      const nB  = j.neckBase;
      g.moveTo(nB.x * s, nB.y * s);
      g.quadraticCurveTo(sX.x * s, (sX.y - 0.8) * s, sX.x * s, sX.y * s);
      g.quadraticCurveTo((sX.x + dir * 0.6) * s, ((sX.y + sW.y) / 2) * s, sW.x * s, sW.y * s);
      g.quadraticCurveTo((sW.x + dir * 0.9) * s, ((sW.y + sH.y) / 2) * s, sH.x * s, sH.y * s);
      g.lineTo((sH.x - dir * bW) * s, sH.y * s);
      g.quadraticCurveTo((sW.x - dir * bW + dir * 0.5) * s, ((sW.y + sH.y) / 2) * s, (sW.x - dir * bW) * s, sW.y * s);
      g.quadraticCurveTo((sX.x - dir * bW + dir * 0.3) * s, ((sX.y + sW.y) / 2) * s, (sX.x - dir * bW) * s, sX.y * s);
      g.lineTo((nB.x - dir * bW * 0.5) * s, nB.y * s);
      g.closePath();
      g.fill({ color: darken(p.skin, 0.22), alpha: sideAmt * 0.48 });
    }

    // Chest shelf (horizontal crease where pecs meet) — distinctive dwarf trait
    if (iso.y > 0.12) {
      const alpha = (iso.y - 0.12) * 0.9;
      const cY = (j.chestL.y + j.waistL.y) * 0.48;
      g.moveTo(this.w(j.chestL).x * s, cY * s);
      g.quadraticCurveTo(j.neckBase.x * s, (cY - 0.5) * s, this.w(j.chestR).x * s, cY * s);
      g.stroke({ width: s * 0.65, color: darken(p.skin, 0.18), alpha: alpha * 0.4 });
    }

    // Clavicle
    const sL = this.w(j.shoulderL), sR = this.w(j.shoulderR);
    g.moveTo(sL.x * s, (sL.y + 0.8) * s);
    g.quadraticCurveTo(j.neckBase.x * s, (j.neckBase.y + 0.4) * s, sR.x * s, (sR.y + 0.8) * s);
    g.stroke({ width: s * 0.5, color: darken(p.skin, 0.15), alpha: 0.3 });

    this.torsoPath(g, j, s);
    g.stroke({ width: s * 0.55, color: darken(p.skin, 0.32), alpha: 0.42 });

    // Short thick neck (dwarf barely has a neck)
    const nw = 4.5;
    g.roundRect((j.neckBase.x - nw / 2) * s, (j.neckBase.y - 1.5) * s, nw * s, 2.5 * s, 1.5 * s);
    g.fill(p.skin);
    g.roundRect((j.neckBase.x - nw / 2) * s, (j.neckBase.y - 1.5) * s, nw * s, 2.5 * s, 1.5 * s);
    g.stroke({ width: s * 0.38, color: darken(p.skin, 0.28), alpha: 0.3 });
  }

  private torsoPath(g: Graphics, j: Record<string, V>, s: number): void {
    const cL = this.w(j.chestL), cR = this.w(j.chestR);
    const wL = this.w(j.waistL), wR = this.w(j.waistR);
    const hL = this.w(j.hipL),   hR = this.w(j.hipR);
    const nB = j.neckBase;
    g.moveTo(nB.x * s, nB.y * s);
    g.quadraticCurveTo(cR.x * s, (cR.y - 1) * s, cR.x * s, cR.y * s);
    g.quadraticCurveTo((cR.x + 0.8) * s, ((cR.y + wR.y) / 2) * s, wR.x * s, wR.y * s);
    g.quadraticCurveTo((wR.x + 1.2) * s, ((wR.y + hR.y) / 2) * s, hR.x * s, hR.y * s);
    g.lineTo(hL.x * s, hL.y * s);
    g.quadraticCurveTo((wL.x - 1.2) * s, ((wL.y + hL.y) / 2) * s, wL.x * s, wL.y * s);
    g.quadraticCurveTo((cL.x - 0.8) * s, ((cL.y + wL.y) / 2) * s, cL.x * s, cL.y * s);
    g.quadraticCurveTo(cL.x * s, (cL.y - 1) * s, nB.x * s, nB.y * s);
    g.closePath();
  }

  // ─── PELVIS ───────────────────────────────────────────────────────

  private drawPelvis(g: Graphics, j: Record<string, V>, p: ModelPalette, s: number): void {
    const hL = this.w(j.hipL), hR = this.w(j.hipR), c = j.crotch;
    g.moveTo(hL.x * s, hL.y * s);
    g.quadraticCurveTo((hL.x - 1.2) * s, ((hL.y + c.y) / 2) * s, ((hL.x + c.x) / 2 - 0.6) * s, c.y * s);
    g.quadraticCurveTo(c.x * s, (c.y + 2) * s, ((hR.x + c.x) / 2 + 0.6) * s, c.y * s);
    g.quadraticCurveTo((hR.x + 1.2) * s, ((hR.y + c.y) / 2) * s, hR.x * s, hR.y * s);
    g.closePath(); g.fill(p.skin);
    g.moveTo(((hL.x + c.x) / 2 - 0.6) * s, c.y * s);
    g.quadraticCurveTo(c.x * s, (c.y + 2) * s, ((hR.x + c.x) / 2 + 0.6) * s, c.y * s);
    g.lineTo(c.x * s, (c.y - 1) * s);
    g.closePath(); g.fill({ color: darken(p.skin, 0.2), alpha: 0.4 });
  }

  // ─── GLUTES ───────────────────────────────────────────────────────

  private drawGlutes(g: Graphics, j: Record<string, V>, sk: Skeleton, p: ModelPalette, s: number): void {
    const hL = this.w(j.hipL), hR = this.w(j.hipR), c = j.crotch;
    const cC = lighten(p.skin, 0.04);
    const cW = 5.5 * sk.wf, cH = 4.5;
    const cY = hL.y + 0.5;
    const lX = hL.x * 0.4, rX = hR.x * 0.4;
    g.ellipse(lX * s, cY * s, cW * s, cH * s); g.fill(cC);
    g.ellipse(lX * s, cY * s, cW * s, cH * s); g.stroke({ width: s * 0.5, color: darken(p.skin, 0.15), alpha: 0.4 });
    g.ellipse(rX * s, cY * s, cW * s, cH * s); g.fill(cC);
    g.ellipse(rX * s, cY * s, cW * s, cH * s); g.stroke({ width: s * 0.5, color: darken(p.skin, 0.15), alpha: 0.4 });
    g.moveTo(c.x * s, (hL.y - 1.5) * s);
    g.quadraticCurveTo((c.x - 0.2) * s, cY * s, c.x * s, (cY + cH) * s);
    g.stroke({ width: s * 0.72, color: darken(p.skin, 0.22), alpha: 0.58 });
  }

  // ─── ARM ──────────────────────────────────────────────────────────

  private drawArm(g: Graphics, j: Record<string, V>, sk: Skeleton, p: ModelPalette, s: number, side: "L" | "R", isNear: boolean): void {
    const shoulder = j[`shoulder${side}`];
    const elbow    = j[`elbow${side}`];
    const wrist    = j[`wrist${side}`];
    const ac  = isNear ? p.skin : darken(p.skin, 0.06);
    const aDk = darken(ac, 0.22);
    const aOu = darken(ac, 0.35);

    // Big deltoid cap
    g.ellipse(shoulder.x * s, shoulder.y * s, 4.2 * sk.wf * s, 3.2 * s);
    g.fill(isNear ? lighten(ac, 0.05) : ac);
    g.ellipse(shoulder.x * s, shoulder.y * s, 4.2 * sk.wf * s, 3.2 * s);
    g.stroke({ width: s * 0.4, color: aOu, alpha: 0.3 });

    drawTaperedLimb(g, shoulder, elbow, 5.2, 4.4, ac, aDk, aOu, s);
    // Beefy elbow
    g.circle(elbow.x * s, elbow.y * s, 2.6 * s); g.fill(ac);
    g.circle(elbow.x * s, elbow.y * s, 2.6 * s); g.stroke({ width: s * 0.4, color: aOu, alpha: 0.32 });
    drawTaperedLimb(g, elbow, wrist, 4.2, 3.4, ac, aDk, aOu, s);

    // Meaty hand with thumb
    g.ellipse(wrist.x * s, wrist.y * s, 3.0 * s, 2.3 * s); g.fill(ac);
    const dx = wrist.x - elbow.x, dy = wrist.y - elbow.y;
    const len = Math.sqrt(dx * dx + dy * dy) || 1;
    const pX = (-dy / len) * (side === "L" ? 1 : -1);
    const pY = ( dx / len) * (side === "L" ? 1 : -1);
    g.ellipse((wrist.x + pX * 2.0 + dx / len * 0.9) * s, (wrist.y + pY * 2.0 + dy / len * 0.9) * s, 1.7 * s, 1.3 * s);
    g.fill(ac);
    // Knuckle hints
    const kX = wrist.x - dx / len * 0.7, kY = wrist.y - dy / len * 0.7;
    for (let i = -1; i <= 1; i++) {
      g.circle((kX + pX * i * 0.8) * s, (kY + pY * i * 0.8) * s, 0.42 * s);
      g.fill({ color: darken(ac, 0.22), alpha: 0.42 });
    }
    g.ellipse(wrist.x * s, wrist.y * s, 3.0 * s, 2.3 * s);
    g.stroke({ width: s * 0.4, color: aOu, alpha: 0.38 });
  }

  // ─── LEG ──────────────────────────────────────────────────────────

  private drawLeg(g: Graphics, j: Record<string, V>, p: ModelPalette, s: number, side: "L" | "R", isNear: boolean): void {
    const hip   = j[`hip${side}`];
    const knee  = j[`knee${side}`];
    const ankle = j[`ankle${side}`];
    const lC  = isNear ? p.skin : darken(p.skin, 0.07);
    const lDk = darken(lC, 0.2);
    const lOu = darken(lC, 0.35);
    const lTop: V = { x: hip.x * 0.5 * this.WIDE, y: hip.y };

    drawTaperedLimb(g, lTop, knee, 7.2, 5.8, lC, lDk, lOu, s);

    // Big knobbly kneecap
    g.ellipse(knee.x * s, knee.y * s, 4.0 * s, 2.6 * s); g.fill(lighten(lC, 0.05));
    g.ellipse(knee.x * s, (knee.y + 0.8) * s, 2.5 * s, 1.6 * s); g.fill(darken(lC, 0.08));
    g.ellipse(knee.x * s, knee.y * s, 4.0 * s, 2.6 * s); g.stroke({ width: s * 0.38, color: lOu, alpha: 0.28 });

    drawTaperedLimb(g, knee, ankle, 5.8, 4.2, lC, darken(lC, 0.18), lOu, s);

    // Stubby ankle bump
    const dir = side === "L" ? -1 : 1;
    g.ellipse((ankle.x + dir * 1.4) * s, (ankle.y + 0.3) * s, 1.5 * s, 1.1 * s);
    g.fill(lighten(lC, 0.04));
  }

  // ─── FOOT ─────────────────────────────────────────────────────────

  private drawFoot(g: Graphics, j: Record<string, V>, sk: Skeleton, p: ModelPalette, s: number, side: "L" | "R", isNear: boolean): void {
    const ankle = j[`ankle${side}`];
    const iso   = sk.iso;
    const bBase = darken(p.skin, 0.32);
    const bC    = isNear ? bBase : darken(bBase, 0.07);
    const bDk   = darken(bC, 0.22);
    const bLt   = lighten(bC, 0.08);

    const footLen = 5.0; // big heavy boot
    const tipX = ankle.x + iso.x * footLen;
    const tipY = ankle.y + iso.y * footLen * 0.5 + 2.0;
    const fdx  = tipX - ankle.x, fdy = tipY - ankle.y;
    const flen = Math.sqrt(fdx * fdx + fdy * fdy) || 1;
    const pnx = -fdy / flen, pny = fdx / flen;
    const hw = 3.0, tw = 1.8;

    // Wide heavy heel
    g.ellipse((ankle.x - fdx / flen * 1.8) * s, (ankle.y - fdy / flen * 1.8 + 0.6) * s, hw * 1.5 * s, 2.0 * s);
    g.fill(bDk);
    // Boot upper
    g.roundRect((ankle.x - hw) * s, (ankle.y - 2) * s, hw * 2 * s, 3.5 * s, 1.5 * s); g.fill(bC);
    // Sole
    g.moveTo((ankle.x + pnx * hw) * s, (ankle.y + pny * hw) * s);
    g.lineTo((tipX + pnx * tw) * s, (tipY + pny * tw) * s);
    g.quadraticCurveTo((tipX + fdx / flen * 2.5) * s, (tipY + fdy / flen * 1.5) * s, (tipX - pnx * tw) * s, (tipY - pny * tw) * s);
    g.lineTo((ankle.x - pnx * hw) * s, (ankle.y - pny * hw) * s);
    g.closePath(); g.fill(bC);
    // Toe box
    g.ellipse((tipX - fdx / flen * 0.5) * s, (tipY - fdy / flen * 0.5) * s, tw * 2.2 * s, tw * 1.4 * s);
    g.fill({ color: bLt, alpha: 0.38 });
    // Sole edge
    g.moveTo((ankle.x - pnx * hw) * s, (ankle.y - pny * hw) * s);
    g.lineTo((tipX - pnx * tw) * s, (tipY - pny * tw) * s);
    g.stroke({ width: s * 0.65, color: bDk, alpha: 0.58 });
    // Outline
    g.moveTo((ankle.x + pnx * hw) * s, (ankle.y + pny * hw) * s);
    g.lineTo((tipX + pnx * tw) * s, (tipY + pny * tw) * s);
    g.quadraticCurveTo((tipX + fdx / flen * 2.5) * s, (tipY + fdy / flen * 1.5) * s, (tipX - pnx * tw) * s, (tipY - pny * tw) * s);
    g.lineTo((ankle.x - pnx * hw) * s, (ankle.y - pny * hw) * s);
    g.closePath(); g.stroke({ width: s * 0.48, color: bDk, alpha: 0.48 });
  }

  // ─── HEAD ─────────────────────────────────────────────────────────

  private drawHead(g: Graphics, j: Record<string, V>, sk: Skeleton, p: ModelPalette, s: number): void {
    const head = j.head;
    const { wf, iso } = sk;
    const faceCam = iso.y > 0;
    const sideAmt = Math.abs(iso.x);
    const sideSign = iso.x;
    const faceAmt = Math.max(0, iso.y);
    const CR = 8.5, CRW = CR + 1.0;

    // Round ears
    if (sideAmt > 0.22) {
      const eX = head.x + sideSign * CRW * wf * 0.82;
      const eY = head.y + 0.8;
      g.ellipse(eX * s, eY * s, 2.2 * s, 3.0 * s); g.fill(p.skin);
      g.ellipse(eX * s, (eY + 0.3) * s, 1.2 * s, 1.8 * s); g.fill(darken(p.skin, 0.12));
      g.ellipse(eX * s, eY * s, 2.2 * s, 3.0 * s); g.stroke({ width: s * 0.4, color: darken(p.skin, 0.28), alpha: 0.42 });
    }

    // Wide skull
    const crx = CRW * wf, cry = CR;
    g.ellipse(head.x * s, head.y * s, crx * s, cry * s); g.fill(p.skin);

    // Strong jaw — wide lower face
    if (faceAmt > 0.05 || (sideAmt > 0.15 && !Math.max(0, -iso.y))) {
      const jW = crx * 0.88, jH = cry * 0.72;
      const jY = head.y + cry * 0.35;
      g.ellipse(head.x * s, jY * s, jW * s, jH * s); g.fill(p.skin);
      // Jaw line — strong horizontal line
      g.moveTo((head.x - jW * 0.72) * s, (jY + jH * 0.52) * s);
      g.lineTo((head.x + jW * 0.72) * s, (jY + jH * 0.52) * s);
      g.stroke({ width: s * 0.6, color: darken(p.skin, 0.2), alpha: 0.3 * faceAmt });
    }

    // Skull outline
    g.ellipse(head.x * s, head.y * s, crx * s, cry * s);
    g.stroke({ width: s * 0.65, color: darken(p.skin, 0.32), alpha: 0.45 });

    // Directional skull shading
    if (sideAmt > 0.15) {
      const sX  = head.x - sideSign * crx * 0.1;
      const sEX = head.x - sideSign * crx * 0.88;
      g.moveTo(sEX * s, (head.y - cry * 0.6) * s);
      g.quadraticCurveTo((sEX - sideSign * 1.8) * s, head.y * s, sEX * s, (head.y + cry * 0.6) * s);
      g.lineTo(sX * s, (head.y + cry * 0.5) * s);
      g.quadraticCurveTo((sX - sideSign * 0.5) * s, head.y * s, sX * s, (head.y - cry * 0.5) * s);
      g.closePath();
      g.fill({ color: darken(p.skin, 0.22), alpha: sideAmt * 0.4 });
    }

    // Facial features
    if (faceAmt > 0.05 || (sideAmt > 0.2 && iso.y >= -0.1)) {
      const spread = 3.0 * wf;
      const eyeY  = head.y + 0.8 + iso.y * 0.9;
      const eyeOX = head.x + iso.x * 0.9;

      // Prominent brow ridge (thick arc above eyes)
      const bY = eyeY - 2.0;
      g.moveTo((eyeOX - spread - CRW * wf * 0.6) * s, (bY - 0.5) * s);
      g.quadraticCurveTo((eyeOX - spread) * s, (bY - 2.2) * s, (eyeOX + spread) * s, (bY - 2.2) * s);
      g.quadraticCurveTo((eyeOX + spread + CRW * wf * 0.6) * s, (bY - 0.5) * s, (eyeOX + spread + CRW * wf * 0.2) * s, bY * s);
      g.quadraticCurveTo(eyeOX * s, (bY - 1.5) * s, (eyeOX - spread - CRW * wf * 0.2) * s, bY * s);
      g.closePath();
      g.fill({ color: darken(p.skin, 0.1), alpha: 0.28 });

      // Eyebrows — thick, from hair colour
      g.moveTo((eyeOX - spread - 2.0) * s, (bY - 0.3) * s);
      g.lineTo((eyeOX - spread + 2.0) * s, (bY - 0.8) * s);
      g.moveTo((eyeOX + spread - 2.0) * s, (bY - 0.8) * s);
      g.lineTo((eyeOX + spread + 2.0) * s, (bY - 0.3) * s);
      g.stroke({ width: s * 1.1, color: darken(p.hair, 0.05), alpha: 0.88 });

      // Eye whites — smaller, deep-set
      const eRx = 1.8, eRy = 1.3;
      g.ellipse((eyeOX - spread) * s, eyeY * s, eRx * s, eRy * s); g.fill(0xf0ece0);
      g.ellipse((eyeOX + spread) * s, eyeY * s, eRx * s, eRy * s); g.fill(0xf0ece0);

      const iX = iso.x * 0.55;
      g.circle((eyeOX - spread + iX) * s, (eyeY + 0.05) * s, 1.0 * s); g.fill(p.eyes);
      g.circle((eyeOX + spread + iX) * s, (eyeY + 0.05) * s, 1.0 * s); g.fill(p.eyes);

      const pX = iso.x * 0.75;
      g.circle((eyeOX - spread + pX) * s, (eyeY + 0.1) * s, 0.5 * s); g.fill(0x0d0d0d);
      g.circle((eyeOX + spread + pX) * s, (eyeY + 0.1) * s, 0.5 * s); g.fill(0x0d0d0d);
      g.circle((eyeOX - spread + pX + 0.4) * s, (eyeY - 0.2) * s, 0.22 * s); g.fill({ color: 0xffffff, alpha: 0.65 });
      g.circle((eyeOX + spread + pX + 0.4) * s, (eyeY - 0.2) * s, 0.22 * s); g.fill({ color: 0xffffff, alpha: 0.65 });

      g.ellipse((eyeOX - spread) * s, eyeY * s, eRx * s, eRy * s); g.stroke({ width: s * 0.32, color: darken(p.skin, 0.4), alpha: 0.6 });
      g.ellipse((eyeOX + spread) * s, eyeY * s, eRx * s, eRy * s); g.stroke({ width: s * 0.32, color: darken(p.skin, 0.4), alpha: 0.6 });

      // Broad nose
      if (faceAmt > 0.1) {
        const nY = head.y + cry * 0.22;
        const nW = 2.2 * wf * faceAmt;
        // Bulbous tip
        g.circle(head.x * s, (nY + 2.0 * faceAmt) * s, 1.6 * faceAmt * s);
        g.fill({ color: darken(p.skin, 0.08), alpha: 0.5 * faceAmt });
        // Nostril suggestion
        g.moveTo((head.x - nW * 0.55) * s, (nY + 2.0 * faceAmt) * s);
        g.quadraticCurveTo(head.x * s, (nY + 2.8 * faceAmt) * s, (head.x + nW * 0.55) * s, (nY + 2.0 * faceAmt) * s);
        g.stroke({ width: s * 0.62, color: darken(p.skin, 0.22), alpha: 0.4 * faceAmt });
      }

      // Stern horizontal mouth
      if (faceAmt > 0.08) {
        const mY = head.y + cry * 0.56;
        const mW = 2.5 * wf * Math.max(0.4, faceAmt);
        g.moveTo((head.x - mW) * s, mY * s);
        g.lineTo((head.x + mW) * s, mY * s);
        g.stroke({ width: s * 0.65, color: darken(p.skin, 0.28), alpha: 0.5 * faceAmt });
      }
    }
  }

  // ─── Helper ───────────────────────────────────────────────────────
  private w(joint: V): V { return { x: joint.x * this.WIDE, y: joint.y }; }
}
