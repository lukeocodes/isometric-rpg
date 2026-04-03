import type { Graphics } from "pixi.js";
import type { Model, RenderContext, DrawCall, Skeleton, AttachmentPoint, V } from "../types";
import { DEPTH_SHADOW, DEPTH_FAR_LIMB, DEPTH_BODY, DEPTH_HEAD, DEPTH_NEAR_LIMB } from "../types";
import { darken, lighten } from "../palette";
import { drawTaperedLimb } from "../draw-helpers";

/**
 * Skeleton NPC — undead humanoid made of bones.
 * Thin rib cage, skull head, bony limbs with glowing red eye sockets.
 * CAN hold weapons.
 */
export class SkeletonBody implements Model {
  readonly id = "skeleton-body";
  readonly name = "Skeleton";
  readonly category = "npc" as const;
  readonly slot = "root" as const;

  private readonly BONE    = 0xd0c8b8;
  private readonly SKULL   = 0xe8e0d0;
  private readonly BONE_DK = 0x9a9488;
  private readonly JOINT   = 0xb8b0a0;

  getDrawCalls(ctx: RenderContext): DrawCall[] {
    const { skeleton, facingCamera, nearSide, farSide } = ctx;
    const j = skeleton.joints;
    const { iso } = skeleton;
    const calls: DrawCall[] = [];

    calls.push({ depth: DEPTH_SHADOW, draw: (g, s) => {
      g.ellipse(iso.x * s, 2 * s, 10 * s, 4 * s);
      g.fill({ color: 0x000000, alpha: 0.15 });
    }});

    calls.push({ depth: DEPTH_FAR_LIMB,     draw: (g, s) => this.drawBoneLeg(g, j, skeleton, s, farSide) });
    calls.push({ depth: DEPTH_FAR_LIMB + 4, draw: (g, s) => this.drawBoneLeg(g, j, skeleton, s, nearSide) });

    calls.push({ depth: facingCamera ? DEPTH_FAR_LIMB + 8 : DEPTH_NEAR_LIMB + 0,
      draw: (g, s) => this.drawBoneArm(g, j, s, farSide, false) });

    calls.push({ depth: DEPTH_BODY,     draw: (g, s) => this.drawRibCage(g, j, skeleton, s) });
    calls.push({ depth: DEPTH_BODY + 2, draw: (g, s) => this.drawPelvis(g, j, skeleton, s) });
    calls.push({ depth: DEPTH_HEAD,     draw: (g, s) => this.drawSkull(g, j, skeleton, s) });

    calls.push({ depth: facingCamera ? DEPTH_NEAR_LIMB + 5 : DEPTH_FAR_LIMB + 10,
      draw: (g, s) => this.drawBoneArm(g, j, s, nearSide, true) });

    return calls;
  }

  getAttachmentPoints(skeleton: Skeleton): Record<string, AttachmentPoint> {
    return { "hand-R": skeleton.attachments["hand-R"], "hand-L": skeleton.attachments["hand-L"], "head-top": skeleton.attachments["head-top"] };
  }

  // ─── RIB CAGE ────────────────────────────────────────────────────

  private drawRibCage(g: Graphics, j: Record<string, V>, sk: Skeleton, s: number): void {
    const { wf, iso } = sk;
    const neckBase = j.neckBase;
    const hipL = j.hipL, hipR = j.hipR;

    const spineTop = { x: neckBase.x, y: neckBase.y + 1 };
    const spineBot = { x: (hipL.x + hipR.x) / 2, y: hipL.y - 2 };

    // Spine
    g.moveTo(spineTop.x * s, spineTop.y * s);
    g.lineTo(spineBot.x * s, spineBot.y * s);
    g.stroke({ width: s * 2, color: this.BONE });

    // Far side of spine slightly darker
    if (Math.abs(iso.x) > 0.1) {
      const shadowSide = iso.x > 0 ? -1 : 1;
      g.moveTo((spineTop.x + shadowSide * 1) * s, spineTop.y * s);
      g.lineTo((spineBot.x + shadowSide * 0.8) * s, spineBot.y * s);
      g.stroke({ width: s * 0.8, color: this.BONE_DK, alpha: Math.abs(iso.x) * 0.3 });
    }

    // Rib bones (3 pairs)
    const ribWidth = 7 * wf;
    const spineLen = spineBot.y - spineTop.y;
    for (let i = 0; i < 3; i++) {
      const t = (i + 0.5) / 3.5;
      const ribY = spineTop.y + spineLen * t;
      const ribX = spineTop.x + (spineBot.x - spineTop.x) * t;
      const curveW = ribWidth * (1 - i * 0.12);
      const curveH = 1.5 + i * 0.3;

      g.moveTo(ribX * s, ribY * s);
      g.quadraticCurveTo((ribX - curveW * 0.6) * s, (ribY - curveH) * s, (ribX - curveW) * s, (ribY + curveH * 0.5) * s);
      g.moveTo(ribX * s, ribY * s);
      g.quadraticCurveTo((ribX + curveW * 0.6) * s, (ribY - curveH) * s, (ribX + curveW) * s, (ribY + curveH * 0.5) * s);
      g.stroke({ width: s * 1.2, color: this.BONE });

      // Directional shadow on far ribs
      const shadowSide = iso.x >= 0 ? -1 : 1;
      g.moveTo(ribX * s, ribY * s);
      g.quadraticCurveTo((ribX + shadowSide * curveW * 0.6) * s, (ribY - curveH) * s, (ribX + shadowSide * curveW) * s, (ribY + curveH * 0.5) * s);
      g.stroke({ width: s * 0.4, color: this.BONE_DK, alpha: Math.abs(iso.x) * 0.35 + 0.1 });
    }

    // Collar bones
    const cY = neckBase.y + 1;
    g.moveTo(neckBase.x * s, cY * s);
    g.lineTo((neckBase.x - 7 * wf) * s, (cY + 1) * s);
    g.moveTo(neckBase.x * s, cY * s);
    g.lineTo((neckBase.x + 7 * wf) * s, (cY + 1) * s);
    g.stroke({ width: s * 1.2, color: this.BONE });
  }

  // ─── PELVIS ──────────────────────────────────────────────────────

  private drawPelvis(g: Graphics, j: Record<string, V>, sk: Skeleton, s: number): void {
    const { hipL, hipR, crotch } = j;
    const pelvisW = 6 * sk.wf;
    const pelvisY = (hipL.y + crotch.y) / 2;

    g.moveTo(crotch.x * s, crotch.y * s);
    g.quadraticCurveTo((crotch.x - pelvisW * 0.8) * s, (pelvisY - 2) * s, (crotch.x - pelvisW) * s, pelvisY * s);
    g.quadraticCurveTo((crotch.x - pelvisW * 0.5) * s, (pelvisY + 2) * s, crotch.x * s, (crotch.y + 1) * s);
    g.quadraticCurveTo((crotch.x + pelvisW * 0.5) * s, (pelvisY + 2) * s, (crotch.x + pelvisW) * s, pelvisY * s);
    g.quadraticCurveTo((crotch.x + pelvisW * 0.8) * s, (pelvisY - 2) * s, crotch.x * s, crotch.y * s);
    g.closePath(); g.fill(this.BONE);
    g.moveTo(crotch.x * s, crotch.y * s);
    g.quadraticCurveTo((crotch.x - pelvisW * 0.8) * s, (pelvisY - 2) * s, (crotch.x - pelvisW) * s, pelvisY * s);
    g.quadraticCurveTo((crotch.x - pelvisW * 0.5) * s, (pelvisY + 2) * s, crotch.x * s, (crotch.y + 1) * s);
    g.quadraticCurveTo((crotch.x + pelvisW * 0.5) * s, (pelvisY + 2) * s, (crotch.x + pelvisW) * s, pelvisY * s);
    g.quadraticCurveTo((crotch.x + pelvisW * 0.8) * s, (pelvisY - 2) * s, crotch.x * s, crotch.y * s);
    g.closePath(); g.stroke({ width: s * 0.5, color: this.BONE_DK, alpha: 0.4 });
  }

  // ─── BONE LEG ────────────────────────────────────────────────────

  private drawBoneLeg(g: Graphics, j: Record<string, V>, sk: Skeleton, s: number, side: "L" | "R"): void {
    const hip   = j[`hip${side}`];
    const knee  = j[`knee${side}`];
    const ankle = j[`ankle${side}`];

    g.moveTo((hip.x * 0.4) * s, hip.y * s);
    g.lineTo(knee.x * s, knee.y * s);
    g.stroke({ width: s * 2.5, color: this.BONE });

    g.circle(knee.x * s, knee.y * s, 2.2 * s); g.fill(this.JOINT);
    g.circle(knee.x * s, knee.y * s, 2.2 * s); g.stroke({ width: s * 0.4, color: this.BONE_DK, alpha: 0.3 });

    g.moveTo(knee.x * s, knee.y * s);
    g.lineTo(ankle.x * s, ankle.y * s);
    g.stroke({ width: s * 2, color: this.BONE });

    // Bony foot
    const iso = sk.iso;
    const tipX = ankle.x + iso.x * 3, tipY = ankle.y + iso.y * 1.2 + 1.5;
    g.moveTo(ankle.x * s, ankle.y * s); g.lineTo(tipX * s, tipY * s);
    g.stroke({ width: s * 1.8, color: this.BONE });
    const fdx = tipX - ankle.x, fdy = tipY - ankle.y;
    const flen = Math.sqrt(fdx * fdx + fdy * fdy) || 1;
    const pnx = -fdy / flen, pny = fdx / flen;
    g.moveTo(tipX * s, tipY * s);
    g.lineTo((tipX + pnx * 1.2 + fdx / flen) * s, (tipY + pny * 1.2 + fdy / flen * 0.5) * s);
    g.moveTo(tipX * s, tipY * s);
    g.lineTo((tipX - pnx * 1.2 + fdx / flen) * s, (tipY - pny * 1.2 + fdy / flen * 0.5) * s);
    g.stroke({ width: s * 1.2, color: this.BONE });
  }

  // ─── BONE ARM ────────────────────────────────────────────────────

  private drawBoneArm(g: Graphics, j: Record<string, V>, s: number, side: "L" | "R", isNear: boolean): void {
    const shoulder = j[`shoulder${side}`];
    const elbow    = j[`elbow${side}`];
    const wrist    = j[`wrist${side}`];
    const bC = isNear ? this.BONE : darken(this.BONE, 0.08);

    g.moveTo(shoulder.x * s, shoulder.y * s);
    g.lineTo(elbow.x * s, elbow.y * s);
    g.stroke({ width: s * 2, color: bC });

    g.circle(elbow.x * s, elbow.y * s, 1.8 * s); g.fill(this.JOINT);

    const dx = wrist.x - elbow.x, dy = wrist.y - elbow.y;
    const len = Math.sqrt(dx * dx + dy * dy) || 1;
    const px = (-dy / len) * 0.6, py = (dx / len) * 0.6;
    g.moveTo((elbow.x + px) * s, (elbow.y + py) * s);
    g.lineTo((wrist.x + px * 0.5) * s, (wrist.y + py * 0.5) * s);
    g.moveTo((elbow.x - px) * s, (elbow.y - py) * s);
    g.lineTo((wrist.x - px * 0.5) * s, (wrist.y - py * 0.5) * s);
    g.stroke({ width: s * 1.3, color: bC });

    g.circle(wrist.x * s, wrist.y * s, 1.6 * s); g.fill(bC);
    g.circle(wrist.x * s, wrist.y * s, 1.6 * s); g.stroke({ width: s * 0.3, color: this.BONE_DK, alpha: 0.3 });

    for (let i = -1; i <= 1; i++) {
      g.moveTo(wrist.x * s, wrist.y * s);
      g.lineTo((wrist.x + (dx / len) * 2.5 + (px * i * 1.2)) * s, (wrist.y + (dy / len) * 2.5 + (py * i * 1.2)) * s);
      g.stroke({ width: s * 0.6, color: bC });
    }
  }

  // ─── SKULL ───────────────────────────────────────────────────────

  private drawSkull(g: Graphics, j: Record<string, V>, sk: Skeleton, s: number): void {
    const head = j.head;
    const { wf, iso } = sk;
    const faceCam = iso.y > 0;
    const sideView = Math.abs(iso.x) > 0.3;
    const skullW = 7.5 * wf;
    const skullH = 7;

    // Skull base
    g.roundRect((head.x - skullW) * s, (head.y - skullH) * s, skullW * 2 * s, skullH * 2 * s, 3 * s);
    g.fill(this.SKULL);

    // Directional skull shading — far side darker
    if (Math.abs(iso.x) > 0.1) {
      const shadowSide = iso.x >= 0 ? -1 : 1;
      g.roundRect(
        (head.x + shadowSide * skullW * 0.1) * s, (head.y - skullH) * s,
        skullW * s, skullH * 2 * s, 3 * s
      );
      g.fill({ color: darken(this.SKULL, 0.15), alpha: Math.abs(iso.x) * 0.4 });
    }

    // Cranium highlight on lit side
    g.ellipse((head.x + iso.x * 1.5) * s, (head.y - 2) * s, (skullW - 2) * s, (skullH - 3) * s);
    g.fill({ color: lighten(this.SKULL, 0.1), alpha: 0.3 });

    g.roundRect((head.x - skullW) * s, (head.y - skullH) * s, skullW * 2 * s, skullH * 2 * s, 3 * s);
    g.stroke({ width: s * 0.6, color: this.BONE_DK, alpha: 0.42 });

    if (faceCam || (sideView && iso.y >= -0.1)) {
      const spread = 3 * wf;
      const eyeY  = head.y + 0.5 + iso.y * 0.8;
      const eyeOX = head.x + iso.x * 0.8;

      // Deep dark sockets
      g.ellipse((eyeOX - spread) * s, eyeY * s, 2.4 * s, 2.1 * s); g.fill(0x111111);
      g.ellipse((eyeOX + spread) * s, eyeY * s, 2.4 * s, 2.1 * s); g.fill(0x111111);

      // Glowing red core
      const iX = iso.x * 0.35;
      g.circle((eyeOX - spread + iX) * s, (eyeY + 0.2) * s, 0.9 * s); g.fill(0xdd2222);
      g.circle((eyeOX + spread + iX) * s, (eyeY + 0.2) * s, 0.9 * s); g.fill(0xdd2222);

      // Outer glow halo
      g.ellipse((eyeOX - spread + iX) * s, (eyeY + 0.2) * s, 2.0 * s, 1.7 * s);
      g.fill({ color: 0xcc3333, alpha: 0.18 });
      g.ellipse((eyeOX + spread + iX) * s, (eyeY + 0.2) * s, 2.0 * s, 1.7 * s);
      g.fill({ color: 0xcc3333, alpha: 0.18 });

      // Bright center catch-light
      g.circle((eyeOX - spread + iso.x * 0.5 + 0.4) * s, (eyeY - 0.2) * s, 0.3 * s);
      g.fill({ color: 0xff6666, alpha: 0.7 });
      g.circle((eyeOX + spread + iso.x * 0.5 + 0.4) * s, (eyeY - 0.2) * s, 0.3 * s);
      g.fill({ color: 0xff6666, alpha: 0.7 });

      if (faceCam) {
        const noseY = head.y + 2.5 + iso.y * 0.3;
        g.poly([(head.x - 1) * s, noseY * s, head.x * s, (noseY + 2) * s, (head.x + 1) * s, noseY * s]);
        g.fill(0x333333);

        const jawY = head.y + 4.5 + iso.y * 0.3;
        g.moveTo((head.x - 3 * wf) * s, jawY * s);
        g.lineTo((head.x + 3 * wf) * s, jawY * s);
        g.stroke({ width: s * 0.8, color: this.BONE_DK, alpha: 0.5 });

        for (let i = -2; i <= 2; i++) {
          const tx = head.x + i * 1.2 * wf;
          g.moveTo(tx * s, (jawY - 0.8) * s);
          g.lineTo(tx * s, (jawY + 0.8) * s);
          g.stroke({ width: s * 0.5, color: this.SKULL, alpha: 0.7 });
        }
      }
    } else {
      // Back of skull — dome
      g.ellipse(head.x * s, (head.y - 1) * s, (skullW - 0.5) * s, (skullH - 1) * s);
      g.fill({ color: darken(this.SKULL, 0.08), alpha: 0.3 });
    }

    // Neck vertebrae (follow iso direction)
    const neckBase = j.neckBase;
    g.moveTo(head.x * s, (head.y + skullH - 1) * s);
    g.lineTo(neckBase.x * s, neckBase.y * s);
    g.stroke({ width: s * 1.5, color: this.BONE });

    for (let i = 1; i <= 2; i++) {
      const t  = i / 3;
      const vx = head.x + (neckBase.x - head.x) * t;
      const vy = (head.y + skullH - 1) + (neckBase.y - head.y - skullH + 1) * t;
      g.circle(vx * s, vy * s, 1.1 * s); g.fill(this.JOINT);
    }
  }
}
