import type { Graphics } from "pixi.js";
import type { Model, RenderContext, DrawCall, Skeleton, AttachmentPoint, V } from "../types";
import { DEPTH_SHADOW, DEPTH_FAR_LIMB, DEPTH_BODY, DEPTH_HEAD, DEPTH_NEAR_LIMB } from "../types";
import { darken, lighten } from "../palette";
import { drawTaperedLimb } from "../draw-helpers";

/**
 * Skeleton Lord — boss variant. Darker bones, glowing purple eyes, bone crown, dark aura.
 * Near/far toning on bones, directional skull shading, dramatic eye glow with catch-light.
 */
export class SkeletonLord implements Model {
  readonly id = "skeleton-lord";
  readonly name = "Skeleton Lord";
  readonly category = "npc" as const;
  readonly slot = "root" as const;

  private readonly BONE     = 0xb8b0a0;
  private readonly SKULL    = 0xd0c8b8;
  private readonly BONE_DK  = 0x807870;
  private readonly JOINT    = 0xa09890;
  private readonly EYE_GLOW = 0x9944cc;
  private readonly AURA     = 0x442266;
  private readonly CROWN    = 0xd0c8b0;

  getDrawCalls(ctx: RenderContext): DrawCall[] {
    const { skeleton, facingCamera, nearSide, farSide } = ctx;
    const j = skeleton.joints;
    const { iso, wf } = skeleton;
    const calls: DrawCall[] = [];

    // Dark aura
    calls.push({ depth: DEPTH_SHADOW - 1, draw: (g, s) => {
      g.ellipse(0, -10 * s, 16 * s, 22 * s); g.fill({ color: this.AURA, alpha: 0.06 });
      g.ellipse(0, -10 * s, 12 * s, 18 * s); g.fill({ color: this.AURA, alpha: 0.04 });
    }});

    calls.push({ depth: DEPTH_SHADOW, draw: (g, s) => {
      g.ellipse(iso.x * s, 2 * s, 12 * s, 4.5 * s);
      g.fill({ color: 0x000000, alpha: 0.18 });
    }});

    calls.push({ depth: DEPTH_FAR_LIMB,     draw: (g, s) => this.drawBoneLeg(g, j, skeleton, s, farSide,  false) });
    calls.push({ depth: DEPTH_FAR_LIMB + 4, draw: (g, s) => this.drawBoneLeg(g, j, skeleton, s, nearSide, true)  });

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
    return { "hand-R": skeleton.attachments["hand-R"], "hand-L": skeleton.attachments["hand-L"] };
  }

  private drawRibCage(g: Graphics, j: Record<string, V>, sk: Skeleton, s: number): void {
    const { wf, iso } = sk;
    const nB = j.neckBase;
    const spineTop = { x: nB.x, y: nB.y + 1 };
    const spineBot = { x: (j.hipL.x + j.hipR.x) / 2, y: j.hipL.y - 2 };

    g.moveTo(spineTop.x * s, spineTop.y * s);
    g.lineTo(spineBot.x * s, spineBot.y * s);
    g.stroke({ width: s * 2.5, color: this.BONE });

    const ribWidth = 8 * wf;
    const spineLen = spineBot.y - spineTop.y;
    for (let i = 0; i < 4; i++) {
      const t = (i + 0.4) / 4.5;
      const ribY = spineTop.y + spineLen * t;
      const ribX = spineTop.x + (spineBot.x - spineTop.x) * t;
      const cW = ribWidth * (1 - i * 0.1);
      const cH = 1.8 + i * 0.3;

      g.moveTo(ribX * s, ribY * s);
      g.quadraticCurveTo((ribX - cW * 0.6) * s, (ribY - cH) * s, (ribX - cW) * s, (ribY + cH * 0.5) * s);
      g.moveTo(ribX * s, ribY * s);
      g.quadraticCurveTo((ribX + cW * 0.6) * s, (ribY - cH) * s, (ribX + cW) * s, (ribY + cH * 0.5) * s);
      g.stroke({ width: s * 1.5, color: this.BONE });

      // Far side shadow
      const sSide = iso.x >= 0 ? -1 : 1;
      g.moveTo(ribX * s, ribY * s);
      g.quadraticCurveTo((ribX + sSide * cW * 0.6) * s, (ribY - cH) * s, (ribX + sSide * cW) * s, (ribY + cH * 0.5) * s);
      g.stroke({ width: s * 0.4, color: this.BONE_DK, alpha: Math.abs(iso.x) * 0.32 + 0.1 });
    }

    g.moveTo(nB.x * s, (nB.y + 1) * s);
    g.lineTo((nB.x - 8 * wf) * s, (nB.y + 2) * s);
    g.moveTo(nB.x * s, (nB.y + 1) * s);
    g.lineTo((nB.x + 8 * wf) * s, (nB.y + 2) * s);
    g.stroke({ width: s * 1.5, color: this.BONE });
  }

  private drawPelvis(g: Graphics, j: Record<string, V>, sk: Skeleton, s: number): void {
    const crotch = j.crotch;
    const pW = 7 * sk.wf;
    const pY = (j.hipL.y + crotch.y) / 2;
    g.moveTo(crotch.x * s, crotch.y * s);
    g.quadraticCurveTo((crotch.x - pW * 0.8) * s, (pY - 2) * s, (crotch.x - pW) * s, pY * s);
    g.quadraticCurveTo((crotch.x - pW * 0.5) * s, (pY + 2) * s, crotch.x * s, (crotch.y + 1) * s);
    g.quadraticCurveTo((crotch.x + pW * 0.5) * s, (pY + 2) * s, (crotch.x + pW) * s, pY * s);
    g.quadraticCurveTo((crotch.x + pW * 0.8) * s, (pY - 2) * s, crotch.x * s, crotch.y * s);
    g.closePath(); g.fill(this.BONE);
  }

  private drawBoneLeg(g: Graphics, j: Record<string, V>, sk: Skeleton, s: number, side: "L" | "R", isNear: boolean): void {
    const hip = j[`hip${side}`], knee = j[`knee${side}`], ankle = j[`ankle${side}`];
    const bC = isNear ? this.BONE : darken(this.BONE, 0.1);

    g.moveTo((hip.x * 0.4) * s, hip.y * s);
    g.lineTo(knee.x * s, knee.y * s);
    g.stroke({ width: s * 3, color: bC });

    g.circle(knee.x * s, knee.y * s, 2.5 * s); g.fill(this.JOINT);
    g.circle(knee.x * s, knee.y * s, 2.5 * s); g.stroke({ width: s * 0.4, color: this.BONE_DK, alpha: 0.28 });

    g.moveTo(knee.x * s, knee.y * s);
    g.lineTo(ankle.x * s, ankle.y * s);
    g.stroke({ width: s * 2.5, color: bC });

    const iso = sk.iso;
    const tipX = ankle.x + iso.x * 3, tipY = ankle.y + iso.y * 1.2 + 1.5;
    g.moveTo(ankle.x * s, ankle.y * s); g.lineTo(tipX * s, tipY * s);
    g.stroke({ width: s * 2, color: bC });
  }

  private drawBoneArm(g: Graphics, j: Record<string, V>, s: number, side: "L" | "R", isNear: boolean): void {
    const shoulder = j[`shoulder${side}`], elbow = j[`elbow${side}`], wrist = j[`wrist${side}`];
    const bC = isNear ? this.BONE : darken(this.BONE, 0.1);

    g.moveTo(shoulder.x * s, shoulder.y * s); g.lineTo(elbow.x * s, elbow.y * s);
    g.stroke({ width: s * 2.5, color: bC });
    g.circle(elbow.x * s, elbow.y * s, 2 * s); g.fill(this.JOINT);

    const dx = wrist.x - elbow.x, dy = wrist.y - elbow.y;
    const len = Math.sqrt(dx * dx + dy * dy) || 1;
    const px = (-dy / len) * 0.7, py = (dx / len) * 0.7;
    g.moveTo((elbow.x + px) * s, (elbow.y + py) * s);
    g.lineTo((wrist.x + px * 0.5) * s, (wrist.y + py * 0.5) * s);
    g.moveTo((elbow.x - px) * s, (elbow.y - py) * s);
    g.lineTo((wrist.x - px * 0.5) * s, (wrist.y - py * 0.5) * s);
    g.stroke({ width: s * 1.5, color: bC });

    g.circle(wrist.x * s, wrist.y * s, 2 * s); g.fill(bC);
  }

  private drawSkull(g: Graphics, j: Record<string, V>, sk: Skeleton, s: number): void {
    const head = j.head;
    const { wf, iso } = sk;
    const faceCam = iso.y > 0;
    const sideView = Math.abs(iso.x) > 0.3;
    const skullW = 8 * wf, skullH = 7.5;

    g.roundRect((head.x - skullW) * s, (head.y - skullH) * s, skullW * 2 * s, skullH * 2 * s, 3.5 * s);
    g.fill(this.SKULL);

    // Directional shading
    if (Math.abs(iso.x) > 0.1) {
      const shadowSide = iso.x >= 0 ? -1 : 1;
      g.roundRect(
        (head.x + shadowSide * skullW * 0.1) * s, (head.y - skullH) * s,
        skullW * s, skullH * 2 * s, 3.5 * s
      );
      g.fill({ color: darken(this.SKULL, 0.18), alpha: Math.abs(iso.x) * 0.42 });
    }

    // Highlight
    g.ellipse((head.x + iso.x * 1.5) * s, (head.y - 2) * s, (skullW - 1.5) * s, (skullH - 2.5) * s);
    g.fill({ color: lighten(this.SKULL, 0.1), alpha: 0.3 });

    g.roundRect((head.x - skullW) * s, (head.y - skullH) * s, skullW * 2 * s, skullH * 2 * s, 3.5 * s);
    g.stroke({ width: s * 0.7, color: this.BONE_DK, alpha: 0.45 });

    if (faceCam || (sideView && iso.y >= -0.1)) {
      const spread = 3.2 * wf;
      const eyeY  = head.y + 0.5 + iso.y * 0.8;
      const eyeOX = head.x + iso.x * 0.8;

      // Purple glow halos
      g.ellipse((eyeOX - spread) * s, eyeY * s, 3.5 * s, 3.0 * s); g.fill({ color: this.EYE_GLOW, alpha: 0.18 });
      g.ellipse((eyeOX + spread) * s, eyeY * s, 3.5 * s, 3.0 * s); g.fill({ color: this.EYE_GLOW, alpha: 0.18 });

      // Dark sockets
      g.ellipse((eyeOX - spread) * s, eyeY * s, 2.5 * s, 2.2 * s); g.fill(0x111111);
      g.ellipse((eyeOX + spread) * s, eyeY * s, 2.5 * s, 2.2 * s); g.fill(0x111111);

      // Glowing purple cores
      const iX = iso.x * 0.35;
      g.circle((eyeOX - spread + iX) * s, (eyeY + 0.1) * s, 1.1 * s); g.fill({ color: this.EYE_GLOW, alpha: 0.85 });
      g.circle((eyeOX + spread + iX) * s, (eyeY + 0.1) * s, 1.1 * s); g.fill({ color: this.EYE_GLOW, alpha: 0.85 });

      // Bright center + catch-light
      g.circle((eyeOX - spread + iX) * s, eyeY * s, 0.45 * s); g.fill({ color: 0xffffff, alpha: 0.65 });
      g.circle((eyeOX + spread + iX) * s, eyeY * s, 0.45 * s); g.fill({ color: 0xffffff, alpha: 0.65 });
      g.circle((eyeOX - spread + iso.x * 0.5 + 0.4) * s, (eyeY - 0.35) * s, 0.2 * s);
      g.fill({ color: 0xddaaff, alpha: 0.55 });
      g.circle((eyeOX + spread + iso.x * 0.5 + 0.4) * s, (eyeY - 0.35) * s, 0.2 * s);
      g.fill({ color: 0xddaaff, alpha: 0.55 });

      if (faceCam) {
        g.poly([(head.x - 1) * s, (head.y + 2.5) * s, head.x * s, (head.y + 4.5) * s, (head.x + 1) * s, (head.y + 2.5) * s]);
        g.fill(0x333333);

        const jawY = head.y + 5;
        g.moveTo((head.x - 3.5 * wf) * s, jawY * s);
        g.lineTo((head.x + 3.5 * wf) * s, jawY * s);
        g.stroke({ width: s * 0.8, color: this.BONE_DK, alpha: 0.5 });
      }
    }

    // Neck
    g.moveTo(head.x * s, (head.y + skullH - 1) * s);
    g.lineTo(j.neckBase.x * s, j.neckBase.y * s);
    g.stroke({ width: s * 2, color: this.BONE });

    // Bone crown
    const crownY = head.y - skullH + 1;
    const crownW = skullW * 0.9;
    for (let i = 0; i < 5; i++) {
      const t = (i + 0.5) / 5;
      const px = head.x - crownW + crownW * 2 * t;
      const tipY = crownY - 4 - Math.sin(t * Math.PI) * 2;

      g.poly([(px - 0.8) * s, crownY * s, px * s, tipY * s, (px + 0.8) * s, crownY * s]);
      g.fill(this.CROWN);
      g.poly([(px - 0.8) * s, crownY * s, px * s, tipY * s, (px + 0.8) * s, crownY * s]);
      g.stroke({ width: s * 0.3, color: this.BONE_DK, alpha: 0.4 });
    }
  }
}
