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
import { DEPTH_SHADOW, DEPTH_FAR_LIMB, DEPTH_BODY, DEPTH_HEAD, DEPTH_NEAR_LIMB } from "../types";
import { darken, lighten } from "../palette";
import { drawTaperedLimb } from "../draw-helpers";

/**
 * HumanBodyV2 — improved humanoid body with:
 *   • Head: cranium + jaw, proper face proportions, nose, eyebrows from hair colour,
 *     ear with inner detail, directional face construction
 *   • Torso: iso-directional side shading (lit/shadow bands), clavicle line,
 *     subtle pec separation, belt line
 *   • Arms: deltoid cap at shoulder, better hand silhouette with thumb hint
 *   • Legs: larger kneecap, calf curve, ankle malleolus bump
 *   • Feet: boot with toe box / heel distinction
 *
 * Compatible with the same skeleton joints and attachment points as HumanBody.
 */
export class HumanBodyV2 implements Model {
  readonly id   = "human-body-v2";
  readonly name = "Human Body V2";
  readonly category = "body" as const;
  readonly slot     = "root" as const;

  getDrawCalls(ctx: RenderContext): DrawCall[] {
    const { skeleton, palette, farSide, nearSide, facingCamera } = ctx;
    const j    = skeleton.joints;
    const iso  = skeleton.iso;
    const calls: DrawCall[] = [];

    // ─── Shadow ───────────────────────────────────────────────────────
    calls.push({
      depth: DEPTH_SHADOW,
      draw: (g, s) => {
        // Softer, slightly elongated ground shadow
        g.ellipse(iso.x * 3 * s, 2 * s, 14 * s, 5 * s);
        g.fill({ color: 0x000000, alpha: 0.18 });
        g.ellipse(iso.x * 3 * s, 2 * s, 9 * s, 3 * s);
        g.fill({ color: 0x000000, alpha: 0.08 });
      },
    });

    // ─── Far leg (behind torso) ───────────────────────────────────────
    calls.push({ depth: DEPTH_FAR_LIMB + 0, draw: (g, s) => this.drawLeg(g, j, skeleton, palette, s, farSide,  false) });
    calls.push({ depth: DEPTH_FAR_LIMB + 1, draw: (g, s) => this.drawFoot(g, j, skeleton, palette, s, farSide, false) });

    // ─── Near leg ─────────────────────────────────────────────────────
    calls.push({ depth: DEPTH_FAR_LIMB + 2, draw: (g, s) => this.drawLeg(g, j, skeleton, palette, s, nearSide, true) });
    calls.push({ depth: DEPTH_FAR_LIMB + 3, draw: (g, s) => this.drawFoot(g, j, skeleton, palette, s, nearSide, true) });

    // ─── Far arm ──────────────────────────────────────────────────────
    calls.push({
      depth: facingCamera ? DEPTH_FAR_LIMB + 4 : DEPTH_NEAR_LIMB + 0,
      draw: (g, s) => this.drawArm(g, j, skeleton, palette, s, farSide,  false),
    });

    // ─── Glutes (back views) ──────────────────────────────────────────
    if (!facingCamera) {
      calls.push({ depth: DEPTH_BODY - 1, draw: (g, s) => this.drawGlutes(g, j, skeleton, palette, s) });
    }

    // ─── Torso ────────────────────────────────────────────────────────
    calls.push({ depth: DEPTH_BODY + 0, draw: (g, s) => this.drawTorso(g, j, skeleton, palette, s, nearSide) });

    // ─── Pelvis ───────────────────────────────────────────────────────
    calls.push({ depth: DEPTH_BODY + 2, draw: (g, s) => this.drawPelvis(g, j, palette, s) });

    // ─── Head ─────────────────────────────────────────────────────────
    calls.push({ depth: DEPTH_HEAD + 0, draw: (g, s) => this.drawHead(g, j, skeleton, palette, s) });

    // ─── Near arm ─────────────────────────────────────────────────────
    calls.push({
      depth: facingCamera ? DEPTH_NEAR_LIMB + 5 : DEPTH_FAR_LIMB + 5,
      draw: (g, s) => this.drawArm(g, j, skeleton, palette, s, nearSide, true),
    });

    return calls;
  }

  getAttachmentPoints(skeleton: Skeleton): Record<string, AttachmentPoint> {
    return skeleton.attachments;
  }

  // ─── HEAD ─────────────────────────────────────────────────────────────────

  private drawHead(
    g: Graphics,
    j: Record<string, V>,
    sk: Skeleton,
    p: ModelPalette,
    s: number,
  ): void {
    const head     = j.head;
    const { wf, iso } = sk;
    const faceCam  = iso.y > 0;
    const sideAmt  = Math.abs(iso.x);     // 0=straight, 0.5=full side
    const sideSign = iso.x;               // which side we're looking from
    const faceAmt  = Math.max(0, iso.y);  // 0=side, 0.5=full front
    const backAmt  = Math.max(0, -iso.y); // 0=front, 0.5=full back

    const CR = 7.5;  // cranium radius

    // ─── Ear (side-on views) ────────────────────────────────────────
    if (sideAmt > 0.22) {
      const earX   = head.x + sideSign * CR * wf * 0.82;
      const earY   = head.y + 0.8;
      const earRx  = 1.9 + sideAmt * 0.5;
      const earRy  = 2.8 + sideAmt * 0.4;
      // Outer ear
      g.ellipse(earX * s, earY * s, earRx * s, earRy * s);
      g.fill(p.skin);
      // Concha (inner hollow)
      g.ellipse(earX * s, (earY + 0.4) * s, earRx * 0.55 * s, earRy * 0.6 * s);
      g.fill(darken(p.skin, 0.13));
      // Ear lobe bump (bottom)
      g.ellipse(earX * s, (earY + earRy * 0.75) * s, 1.4 * s, 1.1 * s);
      g.fill(p.skin);
      // Ear outline
      g.ellipse(earX * s, earY * s, earRx * s, earRy * s);
      g.stroke({ width: s * 0.4, color: darken(p.skin, 0.28), alpha: 0.45 });
    }

    // ─── Cranium ────────────────────────────────────────────────────
    const crx = CR * wf;
    const cry = CR;
    g.ellipse(head.x * s, head.y * s, crx * s, cry * s);
    g.fill(p.skin);

    // ─── Lower face / jaw (front and 3/4 views) ──────────────────────
    if (faceAmt > 0.05 || (sideAmt > 0.15 && !backAmt)) {
      const jawW  = crx * (0.62 + faceAmt * 0.12);
      const jawH  = cry * 0.68;
      const jawCY = head.y + cry * 0.38;
      // Jaw oval
      g.ellipse(head.x * s, jawCY * s, jawW * s, jawH * s);
      g.fill(p.skin);
      // Chin line (subtle underside shadow)
      g.moveTo((head.x - jawW * 0.7) * s, (jawCY + jawH * 0.6) * s);
      g.quadraticCurveTo(
        head.x * s, (jawCY + jawH * 0.95) * s,
        (head.x + jawW * 0.7) * s, (jawCY + jawH * 0.6) * s,
      );
      g.stroke({ width: s * 0.45, color: darken(p.skin, 0.18), alpha: 0.3 * faceAmt + 0.15 });
    }

    // ─── Head outline ───────────────────────────────────────────────
    g.ellipse(head.x * s, head.y * s, crx * s, cry * s);
    g.stroke({ width: s * 0.55, color: darken(p.skin, 0.32), alpha: 0.45 });

    // ─── Directional shading on skull ────────────────────────────────
    if (sideAmt > 0.15) {
      // Shadow band on the far side of the head
      const shadowSX = head.x - sideSign * crx * 0.1;
      const shadowEX = head.x - sideSign * crx * 0.9;
      g.moveTo(shadowEX * s, (head.y - cry * 0.6) * s);
      g.quadraticCurveTo(
        (shadowEX - sideSign * 1.5) * s, head.y * s,
        shadowEX * s, (head.y + cry * 0.6) * s,
      );
      g.lineTo(shadowSX * s, (head.y + cry * 0.5) * s);
      g.quadraticCurveTo(
        (shadowSX - sideSign * 0.5) * s, head.y * s,
        shadowSX * s, (head.y - cry * 0.5) * s,
      );
      g.closePath();
      g.fill({ color: darken(p.skin, 0.2), alpha: sideAmt * 0.35 });
    }

    // ─── Facial features (face toward camera) ───────────────────────
    if (faceAmt > 0.05 || (sideAmt > 0.2 && iso.y >= -0.1)) {
      const spread = 2.5 * wf;
      const eyeY   = head.y - cry * 0.04 + iso.y * 1.1;
      const eyeOX  = head.x + iso.x * 1.8;

      // ─ Brow ridge (subtle arc above eyes) ─
      const browY = eyeY - 2.4;
      g.moveTo((eyeOX - spread - 1.8) * s, browY * s);
      g.quadraticCurveTo((eyeOX - spread) * s, (browY - 0.8) * s, (eyeOX - spread + 1.8) * s, browY * s);
      g.stroke({ width: s * 0.4, color: darken(p.skin, 0.2), alpha: 0.3 });
      g.moveTo((eyeOX + spread - 1.8) * s, browY * s);
      g.quadraticCurveTo((eyeOX + spread) * s, (browY - 0.8) * s, (eyeOX + spread + 1.8) * s, browY * s);
      g.stroke({ width: s * 0.4, color: darken(p.skin, 0.2), alpha: 0.3 });

      // ─ Eyebrows (arched, using hair colour) ─
      const browOffset = 1.9;
      g.moveTo((eyeOX - spread - browOffset) * s, (browY - 0.3) * s);
      g.quadraticCurveTo(
        (eyeOX - spread) * s, (browY - 1.1) * s,
        (eyeOX - spread + browOffset) * s, (browY + 0.1) * s,
      );
      g.stroke({ width: s * 0.75, color: darken(p.hair, 0.05), alpha: 0.85 });
      g.moveTo((eyeOX + spread - browOffset) * s, (browY + 0.1) * s);
      g.quadraticCurveTo(
        (eyeOX + spread) * s, (browY - 1.1) * s,
        (eyeOX + spread + browOffset) * s, (browY - 0.3) * s,
      );
      g.stroke({ width: s * 0.75, color: darken(p.hair, 0.05), alpha: 0.85 });

      // ─ Eye whites ─
      const eyeRx = 2.3;
      const eyeRy = 1.6;
      g.ellipse((eyeOX - spread) * s, eyeY * s, eyeRx * s, eyeRy * s);
      g.fill(0xf8f4ee);
      g.ellipse((eyeOX + spread) * s, eyeY * s, eyeRx * s, eyeRy * s);
      g.fill(0xf8f4ee);

      // ─ Iris ─
      const irisX = iso.x * 0.65;
      g.circle((eyeOX - spread + irisX) * s, (eyeY + 0.05) * s, 1.3 * s);
      g.fill(p.eyes);
      g.circle((eyeOX + spread + irisX) * s, (eyeY + 0.05) * s, 1.3 * s);
      g.fill(p.eyes);

      // ─ Pupil ─
      const pupilX = iso.x * 0.85;
      g.circle((eyeOX - spread + pupilX) * s, (eyeY + 0.1) * s, 0.65 * s);
      g.fill(0x0d0d0d);
      g.circle((eyeOX + spread + pupilX) * s, (eyeY + 0.1) * s, 0.65 * s);
      g.fill(0x0d0d0d);

      // ─ Eye catch light ─
      g.circle((eyeOX - spread + pupilX + 0.5) * s, (eyeY - 0.3) * s, 0.28 * s);
      g.fill({ color: 0xffffff, alpha: 0.7 });
      g.circle((eyeOX + spread + pupilX + 0.5) * s, (eyeY - 0.3) * s, 0.28 * s);
      g.fill({ color: 0xffffff, alpha: 0.7 });

      // ─ Eye outline ─
      g.ellipse((eyeOX - spread) * s, eyeY * s, eyeRx * s, eyeRy * s);
      g.stroke({ width: s * 0.35, color: darken(p.skin, 0.4), alpha: 0.6 });
      g.ellipse((eyeOX + spread) * s, eyeY * s, eyeRx * s, eyeRy * s);
      g.stroke({ width: s * 0.35, color: darken(p.skin, 0.4), alpha: 0.6 });

      // ─ Nose (front/3/4 hint) ─
      if (faceAmt > 0.15) {
        const noseY  = head.y + cry * 0.22;
        const noseW  = 1.6 * wf * faceAmt;
        const noseH  = 1.4 * faceAmt;
        g.moveTo((head.x - noseW * 0.6) * s, (noseY + noseH) * s);
        g.quadraticCurveTo(head.x * s, (noseY + noseH * 1.5) * s, (head.x + noseW * 0.6) * s, (noseY + noseH) * s);
        g.stroke({ width: s * 0.5, color: darken(p.skin, 0.2), alpha: 0.35 * faceAmt });
        // Bridge shadow
        g.moveTo(head.x * s, (eyeY + eyeRy) * s);
        g.lineTo(head.x * s, (noseY + noseH) * s);
        g.stroke({ width: s * 0.35, color: darken(p.skin, 0.15), alpha: 0.2 * faceAmt });
      }

      // ─ Profile nose ─
      if (sideAmt > 0.35 && faceAmt < 0.15) {
        const npX  = head.x + sideSign * crx * 0.52;
        const npY  = head.y + 0.8;
        g.moveTo(head.x * s, (head.y - 1.5) * s);
        g.quadraticCurveTo(npX * s, npY * s, head.x * s, (npY + 2.0) * s);
        g.stroke({ width: s * 0.7, color: darken(p.skin, 0.15), alpha: 0.3 });
      }

      // ─ Mouth ─
      if (faceAmt > 0.08) {
        const mY  = head.y + cry * 0.52;
        const mW  = 2.0 * wf * Math.max(0.3, faceAmt);
        g.moveTo((head.x - mW) * s, mY * s);
        g.quadraticCurveTo(head.x * s, (mY + 0.7 * faceAmt) * s, (head.x + mW) * s, mY * s);
        g.stroke({ width: s * 0.55, color: darken(p.skin, 0.26), alpha: 0.5 * faceAmt });
        // Upper lip line
        g.moveTo((head.x - mW * 0.55) * s, (mY - 0.3) * s);
        g.quadraticCurveTo(head.x * s, (mY - 0.7) * s, (head.x + mW * 0.55) * s, (mY - 0.3) * s);
        g.stroke({ width: s * 0.35, color: darken(p.skin, 0.18), alpha: 0.3 * faceAmt });
      }
    }
  }

  // ─── TORSO ────────────────────────────────────────────────────────────────

  private drawTorso(
    g: Graphics,
    j: Record<string, V>,
    sk: Skeleton,
    p: ModelPalette,
    s: number,
    nearSide: "L" | "R",
  ): void {
    const { chestL, chestR, waistL, waistR, hipL, hipR, neckBase, shoulderL, shoulderR } = j;
    const iso = sk.iso;

    // ─── Base fill ──────────────────────────────────────────────────
    this.torsoPath(g, j, s);
    g.fill(p.skin);

    // ─── Directional side shading ────────────────────────────────────
    // Shadow on the far side; subtle highlight near the near-side edge
    const sideAmt = Math.abs(iso.x);
    if (sideAmt > 0.08) {
      // Determine which side is the shadow side (opposite nearSide)
      const shadowIsRight = nearSide === "L"; // near=L → right side is far/shadowed
      const sX  = shadowIsRight ? chestR  : chestL;
      const sW  = shadowIsRight ? waistR  : waistL;
      const sH  = shadowIsRight ? hipR    : hipL;
      const nB  = neckBase;
      const dir = shadowIsRight ? 1 : -1;

      // Shadow band: a strip along the far edge of the torso
      const bandW = sideAmt * 3.5;
      g.moveTo(nB.x * s, nB.y * s);
      g.quadraticCurveTo(sX.x * s, (sX.y - 0.5) * s, sX.x * s, sX.y * s);
      g.quadraticCurveTo((sX.x + dir * 0.3) * s, ((sX.y + sW.y) / 2) * s, sW.x * s, sW.y * s);
      g.quadraticCurveTo((sW.x + dir * 0.5) * s, ((sW.y + sH.y) / 2) * s, sH.x * s, sH.y * s);
      g.lineTo((sH.x - dir * bandW) * s, sH.y * s);
      g.quadraticCurveTo(
        (sW.x - dir * bandW + dir * 0.3) * s, ((sW.y + sH.y) / 2) * s,
        (sW.x - dir * bandW) * s, sW.y * s,
      );
      g.quadraticCurveTo(
        (sX.x - dir * bandW + dir * 0.2) * s, ((sX.y + sW.y) / 2) * s,
        (sX.x - dir * bandW) * s, sX.y * s,
      );
      g.lineTo((nB.x - dir * bandW * 0.5) * s, nB.y * s);
      g.closePath();
      g.fill({ color: darken(p.skin, 0.22), alpha: sideAmt * 0.45 });
    }

    // ─── Clavicle / shoulder line ─────────────────────────────────────
    g.moveTo(shoulderL.x * s, (shoulderL.y + 1) * s);
    g.quadraticCurveTo(neckBase.x * s, (neckBase.y + 0.5) * s, shoulderR.x * s, (shoulderR.y + 1) * s);
    g.stroke({ width: s * 0.5, color: darken(p.skin, 0.15), alpha: 0.3 });

    // ─── Pec/chest separation hint (front-facing only) ───────────────
    if (iso.y > 0.15) {
      const alpha = (iso.y - 0.15) * 0.8;
      const midX  = (chestL.x + chestR.x) / 2;
      g.moveTo(neckBase.x * s, (neckBase.y + 1) * s);
      g.lineTo(midX * s, ((chestL.y + waistL.y) / 2) * s);
      g.stroke({ width: s * 0.4, color: darken(p.skin, 0.15), alpha: alpha * 0.35 });
    }

    // ─── Belt line hint ───────────────────────────────────────────────
    const beltY = (hipL.y + waistL.y) / 2 - 0.5;
    g.moveTo(hipL.x * s, beltY * s);
    g.quadraticCurveTo(neckBase.x * s, (beltY + 0.3) * s, hipR.x * s, beltY * s);
    g.stroke({ width: s * 0.5, color: darken(p.skin, 0.12), alpha: 0.25 });

    // ─── Outline ──────────────────────────────────────────────────────
    this.torsoPath(g, j, s);
    g.stroke({ width: s * 0.5, color: darken(p.skin, 0.32), alpha: 0.4 });

    // ─── Neck ────────────────────────────────────────────────────────
    const nw = 3.2 * sk.wf;
    g.roundRect((neckBase.x - nw / 2) * s, (neckBase.y - 2) * s, nw * s, 3 * s, 1.5 * s);
    g.fill(p.skin);
    // Neck outline
    g.roundRect((neckBase.x - nw / 2) * s, (neckBase.y - 2) * s, nw * s, 3 * s, 1.5 * s);
    g.stroke({ width: s * 0.35, color: darken(p.skin, 0.28), alpha: 0.3 });
  }

  private torsoPath(g: Graphics, j: Record<string, V>, s: number): void {
    const { chestL, chestR, waistL, waistR, hipL, hipR, neckBase } = j;
    g.moveTo(neckBase.x * s, neckBase.y * s);
    g.quadraticCurveTo(chestR.x * s, (chestR.y - 1.5) * s, chestR.x * s, chestR.y * s);
    g.quadraticCurveTo(
      (chestR.x + 0.5) * s, ((chestR.y + waistR.y) / 2) * s,
      waistR.x * s, waistR.y * s,
    );
    g.quadraticCurveTo(
      (waistR.x + 1) * s, ((waistR.y + hipR.y) / 2) * s,
      hipR.x * s, hipR.y * s,
    );
    g.lineTo(hipL.x * s, hipL.y * s);
    g.quadraticCurveTo(
      (waistL.x - 1) * s, ((waistL.y + hipL.y) / 2) * s,
      waistL.x * s, waistL.y * s,
    );
    g.quadraticCurveTo(
      (chestL.x - 0.5) * s, ((chestL.y + waistL.y) / 2) * s,
      chestL.x * s, chestL.y * s,
    );
    g.quadraticCurveTo(chestL.x * s, (chestL.y - 1.5) * s, neckBase.x * s, neckBase.y * s);
    g.closePath();
  }

  // ─── PELVIS ───────────────────────────────────────────────────────────────

  private drawPelvis(
    g: Graphics,
    j: Record<string, V>,
    p: ModelPalette,
    s: number,
  ): void {
    const { hipL, hipR, crotch } = j;
    const legColor = p.skin;

    g.moveTo(hipL.x * s, hipL.y * s);
    g.quadraticCurveTo(
      (hipL.x - 1) * s, ((hipL.y + crotch.y) / 2) * s,
      ((hipL.x + crotch.x) / 2 - 0.5) * s, crotch.y * s,
    );
    g.quadraticCurveTo(
      crotch.x * s, (crotch.y + 1.5) * s,
      ((hipR.x + crotch.x) / 2 + 0.5) * s, crotch.y * s,
    );
    g.quadraticCurveTo(
      (hipR.x + 1) * s, ((hipR.y + crotch.y) / 2) * s,
      hipR.x * s, hipR.y * s,
    );
    g.closePath();
    g.fill(legColor);

    // Inner thigh crease
    g.moveTo(((hipL.x + crotch.x) / 2 - 0.5) * s, crotch.y * s);
    g.quadraticCurveTo(
      crotch.x * s, (crotch.y + 1.5) * s,
      ((hipR.x + crotch.x) / 2 + 0.5) * s, crotch.y * s,
    );
    g.lineTo(crotch.x * s, (crotch.y - 1) * s);
    g.closePath();
    g.fill({ color: darken(legColor, 0.2), alpha: 0.4 });
  }

  // ─── GLUTES ───────────────────────────────────────────────────────────────

  private drawGlutes(
    g: Graphics,
    j: Record<string, V>,
    sk: Skeleton,
    p: ModelPalette,
    s: number,
  ): void {
    const { hipL, hipR, crotch } = j;
    const legColor   = p.skin;
    const cheekColor = lighten(legColor, 0.04);

    const cheekW = 4.8 * sk.wf;
    const cheekH = 4.2;
    const cheekY = hipL.y + 0.6;
    const cheekLX = hipL.x * 0.42;
    const cheekRX = hipR.x * 0.42;

    // Left cheek
    g.ellipse(cheekLX * s, cheekY * s, cheekW * s, cheekH * s);
    g.fill(cheekColor);
    g.ellipse(cheekLX * s, cheekY * s, cheekW * s, cheekH * s);
    g.stroke({ width: s * 0.45, color: darken(legColor, 0.15), alpha: 0.4 });

    // Right cheek
    g.ellipse(cheekRX * s, cheekY * s, cheekW * s, cheekH * s);
    g.fill(cheekColor);
    g.ellipse(cheekRX * s, cheekY * s, cheekW * s, cheekH * s);
    g.stroke({ width: s * 0.45, color: darken(legColor, 0.15), alpha: 0.4 });

    // Cleft
    g.moveTo(crotch.x * s, (hipL.y - 1.5) * s);
    g.quadraticCurveTo(
      (crotch.x - 0.2) * s, cheekY * s,
      crotch.x * s, (cheekY + cheekH) * s,
    );
    g.stroke({ width: s * 0.7, color: darken(legColor, 0.22), alpha: 0.55 });

    // Under-glute crease
    g.moveTo((cheekLX - cheekW * 0.6) * s, (cheekY + cheekH * 0.65) * s);
    g.quadraticCurveTo(
      cheekLX * s, (cheekY + cheekH * 0.88) * s,
      (cheekLX + cheekW * 0.4) * s, (cheekY + cheekH * 0.55) * s,
    );
    g.moveTo((cheekRX + cheekW * 0.6) * s, (cheekY + cheekH * 0.65) * s);
    g.quadraticCurveTo(
      cheekRX * s, (cheekY + cheekH * 0.88) * s,
      (cheekRX - cheekW * 0.4) * s, (cheekY + cheekH * 0.55) * s,
    );
    g.stroke({ width: s * 0.5, color: darken(legColor, 0.18), alpha: 0.45 });
  }

  // ─── ARM ──────────────────────────────────────────────────────────────────

  private drawArm(
    g: Graphics,
    j: Record<string, V>,
    sk: Skeleton,
    p: ModelPalette,
    s: number,
    side: "L" | "R",
    isNear: boolean,
  ): void {
    const shoulder = j[`shoulder${side}`];
    const elbow    = j[`elbow${side}`];
    const wrist    = j[`wrist${side}`];

    const armColor   = isNear ? p.skin : darken(p.skin, 0.06);
    const armDk      = darken(armColor, 0.2);
    const armOutline = darken(armColor, 0.32);

    // ─── Deltoid cap ─────────────────────────────────────────────────
    // Small rounded bump at shoulder socket
    const dR = 3.2;
    g.ellipse(shoulder.x * s, shoulder.y * s, dR * sk.wf * s, dR * 0.75 * s);
    g.fill(isNear ? lighten(armColor, 0.06) : armColor);
    g.ellipse(shoulder.x * s, shoulder.y * s, dR * sk.wf * s, dR * 0.75 * s);
    g.stroke({ width: s * 0.35, color: armOutline, alpha: 0.3 });

    // ─── Upper arm ────────────────────────────────────────────────────
    drawTaperedLimb(g, shoulder, elbow, 3.8, 3.2, armColor, armDk, armOutline, s);

    // ─── Elbow ────────────────────────────────────────────────────────
    g.circle(elbow.x * s, elbow.y * s, 2 * s);
    g.fill(armColor);
    g.circle(elbow.x * s, elbow.y * s, 2 * s);
    g.stroke({ width: s * 0.4, color: armOutline, alpha: 0.28 });

    // ─── Forearm ──────────────────────────────────────────────────────
    drawTaperedLimb(g, elbow, wrist, 3.1, 2.4, armColor, armDk, armOutline, s);

    // ─── Hand with thumb hint ─────────────────────────────────────────
    this.drawHand(g, j, sk, p, s, side, isNear);
  }

  private drawHand(
    g: Graphics,
    j: Record<string, V>,
    sk: Skeleton,
    p: ModelPalette,
    s: number,
    side: "L" | "R",
    isNear: boolean,
  ): void {
    const wrist  = j[`wrist${side}`];
    const elbow  = j[`elbow${side}`];
    const color  = isNear ? p.skin : darken(p.skin, 0.06);

    // Palm
    g.ellipse(wrist.x * s, wrist.y * s, 2.5 * s, 1.9 * s);
    g.fill(color);

    // Thumb bump (offset toward the palm's near-camera side)
    const dx   = wrist.x - elbow.x;
    const dy   = wrist.y - elbow.y;
    const len  = Math.sqrt(dx * dx + dy * dy) || 1;
    const perpX = (-dy / len) * (side === "L" ? 1 : -1);
    const perpY = ( dx / len) * (side === "L" ? 1 : -1);
    const tX   = wrist.x + perpX * 1.8 + dx / len * 0.8;
    const tY   = wrist.y + perpY * 1.8 + dy / len * 0.8;
    g.ellipse(tX * s, tY * s, 1.4 * s, 1.0 * s);
    g.fill(color);

    // Knuckle line hint (3 dots/notches)
    const kX = wrist.x - dx / len * 0.6;
    const kY = wrist.y - dy / len * 0.6;
    for (let i = -1; i <= 1; i++) {
      g.circle((kX + perpX * i * 0.7) * s, (kY + perpY * i * 0.7) * s, 0.35 * s);
      g.fill({ color: darken(color, 0.2), alpha: 0.4 });
    }

    // Hand outline
    g.ellipse(wrist.x * s, wrist.y * s, 2.5 * s, 1.9 * s);
    g.stroke({ width: s * 0.35, color: darken(color, 0.28), alpha: 0.4 });
  }

  // ─── LEG ──────────────────────────────────────────────────────────────────

  private drawLeg(
    g: Graphics,
    j: Record<string, V>,
    sk: Skeleton,
    p: ModelPalette,
    s: number,
    side: "L" | "R",
    isNear: boolean,
  ): void {
    const hip   = j[`hip${side}`];
    const knee  = j[`knee${side}`];
    const ankle = j[`ankle${side}`];

    const legTop   = { x: hip.x * 0.5, y: hip.y };
    const legColor = isNear ? p.skin : darken(p.skin, 0.07);
    const legDk    = darken(legColor, 0.2);
    const legOut   = darken(legColor, 0.35);

    // ─── Thigh ───────────────────────────────────────────────────────
    drawTaperedLimb(g, legTop, knee, 5.8, 4.2, legColor, legDk, legOut, s);

    // ─── Kneecap ─────────────────────────────────────────────────────
    // A more defined kneecap: two overlapping ellipses
    g.ellipse(knee.x * s, knee.y * s, 3.2 * s, 2.2 * s);
    g.fill(lighten(legColor, 0.05));
    g.ellipse(knee.x * s, (knee.y + 0.7) * s, 2 * s, 1.4 * s);
    g.fill(darken(legColor, 0.08));
    g.ellipse(knee.x * s, knee.y * s, 3.2 * s, 2.2 * s);
    g.stroke({ width: s * 0.3, color: legOut, alpha: 0.25 });

    // ─── Calf ────────────────────────────────────────────────────────
    // Slightly wider at the calf bulge
    drawTaperedLimb(g, knee, ankle, 4.8, 2.8, legColor, darken(legColor, 0.18), legOut, s);

    // ─── Ankle malleolus bump ─────────────────────────────────────────
    const dir = side === "L" ? -1 : 1;
    g.ellipse((ankle.x + dir * 1.2) * s, (ankle.y + 0.3) * s, 1.2 * s, 0.9 * s);
    g.fill(lighten(legColor, 0.04));
    g.ellipse((ankle.x + dir * 1.2) * s, (ankle.y + 0.3) * s, 1.2 * s, 0.9 * s);
    g.stroke({ width: s * 0.25, color: legOut, alpha: 0.2 });
  }

  // ─── FOOT / BOOT ──────────────────────────────────────────────────────────

  private drawFoot(
    g: Graphics,
    j: Record<string, V>,
    sk: Skeleton,
    p: ModelPalette,
    s: number,
    side: "L" | "R",
    isNear: boolean,
  ): void {
    const ankle = j[`ankle${side}`];
    const iso   = sk.iso;

    // Boot is darker than skin
    const bootBase   = darken(p.skin, 0.28);
    const bootColor  = isNear ? bootBase : darken(bootBase, 0.08);
    const bootDk     = darken(bootColor, 0.22);
    const bootLight  = lighten(bootColor, 0.1);

    const footLen = 4;
    const fwdX    = iso.x * footLen;
    const fwdY    = iso.y * footLen * 0.5;
    const tipX    = ankle.x + fwdX;
    const tipY    = ankle.y + fwdY + 1.5;

    const fdx  = tipX - ankle.x;
    const fdy  = tipY - ankle.y;
    const flen = Math.sqrt(fdx * fdx + fdy * fdy) || 1;
    const pnx  = -fdy / flen;
    const pny  =  fdx / flen;
    const hw   = 2.2;
    const tw   = 1.3;

    // ─── Heel (rounded back of boot) ─────────────────────────────────
    const heelX = ankle.x - fdx / flen * 1.5;
    const heelY = ankle.y - fdy / flen * 1.5 + 0.5;
    g.ellipse(heelX * s, heelY * s, hw * 1.4 * s, 1.5 * s);
    g.fill(bootDk);

    // ─── Boot upper (ankle area) ──────────────────────────────────────
    g.roundRect(
      (ankle.x - hw) * s,
      (ankle.y - 1.5) * s,
      hw * 2 * s,
      3 * s,
      1 * s,
    );
    g.fill(bootColor);

    // ─── Sole / foot shape ────────────────────────────────────────────
    g.moveTo((ankle.x + pnx * hw) * s,        (ankle.y + pny * hw) * s);
    g.lineTo((tipX + pnx * tw) * s,           (tipY + pny * tw) * s);
    g.quadraticCurveTo(
      (tipX + fdx / flen * 2) * s,
      (tipY + fdy / flen * 1.2) * s,
      (tipX - pnx * tw) * s,
      (tipY - pny * tw) * s,
    );
    g.lineTo((ankle.x - pnx * hw) * s,        (ankle.y - pny * hw) * s);
    g.closePath();
    g.fill(bootColor);

    // ─── Toe box highlight ────────────────────────────────────────────
    g.ellipse(
      (tipX - fdx / flen * 0.5) * s,
      (tipY - fdy / flen * 0.5) * s,
      tw * 2 * s, tw * 1.2 * s,
    );
    g.fill({ color: bootLight, alpha: 0.4 });

    // ─── Sole underline ───────────────────────────────────────────────
    g.moveTo((ankle.x - pnx * hw) * s, (ankle.y - pny * hw) * s);
    g.lineTo((tipX - pnx * tw) * s,    (tipY - pny * tw) * s);
    g.stroke({ width: s * 0.55, color: bootDk, alpha: 0.55 });

    // ─── Boot outline ─────────────────────────────────────────────────
    g.moveTo((ankle.x + pnx * hw) * s, (ankle.y + pny * hw) * s);
    g.lineTo((tipX + pnx * tw) * s,    (tipY + pny * tw) * s);
    g.quadraticCurveTo(
      (tipX + fdx / flen * 2) * s,
      (tipY + fdy / flen * 1.2) * s,
      (tipX - pnx * tw) * s,
      (tipY - pny * tw) * s,
    );
    g.lineTo((ankle.x - pnx * hw) * s, (ankle.y - pny * hw) * s);
    g.closePath();
    g.stroke({ width: s * 0.4, color: bootDk, alpha: 0.45 });
  }
}
