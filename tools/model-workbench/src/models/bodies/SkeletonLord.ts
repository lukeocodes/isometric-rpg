import type { Graphics } from "pixi.js";
import type { Model, RenderContext, DrawCall, Skeleton, AttachmentPoint, V } from "../types";
import { darken, lighten } from "../palette";
import { drawTaperedLimb } from "../draw-helpers";

/**
 * Skeleton Lord — boss variant of Skeleton.
 * Larger, darker bones, glowing purple eyes, bone crown, dark aura.
 * Uses the same skeleton structure but scaled up with boss decorations.
 */
export class SkeletonLord implements Model {
  readonly id = "skeleton-lord";
  readonly name = "Skeleton Lord";
  readonly category = "npc" as const;
  readonly slot = "root" as const;

  private readonly BONE = 0xb8b0a0;    // slightly darker bone
  private readonly SKULL = 0xd0c8b8;
  private readonly BONE_DK = 0x807870;
  private readonly JOINT = 0xa09890;
  private readonly EYE_GLOW = 0x9944cc; // purple glow
  private readonly AURA = 0x442266;
  private readonly CROWN = 0xd0c8b0;   // bone crown

  getDrawCalls(ctx: RenderContext): DrawCall[] {
    const { skeleton, facingCamera, nearSide, farSide } = ctx;
    const j = skeleton.joints;
    const { iso, wf } = skeleton;
    const calls: DrawCall[] = [];

    // Dark aura
    calls.push({
      depth: -1,
      draw: (g, s) => {
        g.ellipse(0, -10 * s, 16 * s, 22 * s);
        g.fill({ color: this.AURA, alpha: 0.06 });
        g.ellipse(0, -10 * s, 12 * s, 18 * s);
        g.fill({ color: this.AURA, alpha: 0.04 });
      },
    });

    // Shadow
    calls.push({
      depth: 0,
      draw: (g, s) => {
        g.ellipse(0, 2 * s, 12 * s, 4.5 * s);
        g.fill({ color: 0x000000, alpha: 0.18 });
      },
    });

    // Bone legs
    calls.push({ depth: 10, draw: (g, s) => this.drawBoneLeg(g, j, skeleton, s, farSide) });
    calls.push({ depth: 12, draw: (g, s) => this.drawBoneLeg(g, j, skeleton, s, nearSide) });

    // Far arm
    calls.push({ depth: facingCamera ? 20 : 45, draw: (g, s) => this.drawBoneArm(g, j, s, farSide) });

    // Rib cage (larger)
    calls.push({ depth: 30, draw: (g, s) => this.drawRibCage(g, j, skeleton, s) });

    // Pelvis
    calls.push({ depth: 32, draw: (g, s) => this.drawPelvis(g, j, skeleton, s) });

    // Skull with crown
    calls.push({ depth: 50, draw: (g, s) => this.drawSkull(g, j, skeleton, s) });

    // Near arm
    calls.push({ depth: facingCamera ? 59 : 24, draw: (g, s) => this.drawBoneArm(g, j, s, nearSide) });

    return calls;
  }

  getAttachmentPoints(skeleton: Skeleton): Record<string, AttachmentPoint> {
    return {
      "hand-R": skeleton.attachments["hand-R"],
      "hand-L": skeleton.attachments["hand-L"],
    };
  }

  private drawRibCage(g: Graphics, j: Record<string, V>, sk: Skeleton, s: number): void {
    const { wf } = sk;
    const neckBase = j.neckBase;
    const hipL = j.hipL;

    const spineTop = { x: neckBase.x, y: neckBase.y + 1 };
    const spineBot = { x: (j.hipL.x + j.hipR.x) / 2, y: hipL.y - 2 };

    // Thicker spine
    g.moveTo(spineTop.x * s, spineTop.y * s);
    g.lineTo(spineBot.x * s, spineBot.y * s);
    g.stroke({ width: s * 2.5, color: this.BONE });

    // Wider ribs
    const ribWidth = 8 * wf;
    const spineLen = spineBot.y - spineTop.y;
    for (let i = 0; i < 4; i++) {
      const t = (i + 0.4) / 4.5;
      const ribY = spineTop.y + spineLen * t;
      const ribX = spineTop.x + (spineBot.x - spineTop.x) * t;
      const curveW = ribWidth * (1 - i * 0.1);
      const curveH = 1.8 + i * 0.3;

      g.moveTo(ribX * s, ribY * s);
      g.quadraticCurveTo((ribX - curveW * 0.6) * s, (ribY - curveH) * s, (ribX - curveW) * s, (ribY + curveH * 0.5) * s);
      g.moveTo(ribX * s, ribY * s);
      g.quadraticCurveTo((ribX + curveW * 0.6) * s, (ribY - curveH) * s, (ribX + curveW) * s, (ribY + curveH * 0.5) * s);
      g.stroke({ width: s * 1.5, color: this.BONE });
    }

    // Collar bones
    g.moveTo(neckBase.x * s, (neckBase.y + 1) * s);
    g.lineTo((neckBase.x - 8 * wf) * s, (neckBase.y + 2) * s);
    g.moveTo(neckBase.x * s, (neckBase.y + 1) * s);
    g.lineTo((neckBase.x + 8 * wf) * s, (neckBase.y + 2) * s);
    g.stroke({ width: s * 1.5, color: this.BONE });
  }

  private drawPelvis(g: Graphics, j: Record<string, V>, sk: Skeleton, s: number): void {
    const { crotch } = j;
    const pelvisW = 7 * sk.wf;
    const pelvisY = (j.hipL.y + crotch.y) / 2;

    g.moveTo(crotch.x * s, crotch.y * s);
    g.quadraticCurveTo((crotch.x - pelvisW * 0.8) * s, (pelvisY - 2) * s, (crotch.x - pelvisW) * s, pelvisY * s);
    g.quadraticCurveTo((crotch.x - pelvisW * 0.5) * s, (pelvisY + 2) * s, crotch.x * s, (crotch.y + 1) * s);
    g.quadraticCurveTo((crotch.x + pelvisW * 0.5) * s, (pelvisY + 2) * s, (crotch.x + pelvisW) * s, pelvisY * s);
    g.quadraticCurveTo((crotch.x + pelvisW * 0.8) * s, (pelvisY - 2) * s, crotch.x * s, crotch.y * s);
    g.closePath();
    g.fill(this.BONE);
  }

  private drawBoneLeg(g: Graphics, j: Record<string, V>, sk: Skeleton, s: number, side: "L" | "R"): void {
    const hip = j[`hip${side}`];
    const knee = j[`knee${side}`];
    const ankle = j[`ankle${side}`];

    g.moveTo((hip.x * 0.4) * s, hip.y * s);
    g.lineTo(knee.x * s, knee.y * s);
    g.stroke({ width: s * 3, color: this.BONE });
    g.circle(knee.x * s, knee.y * s, 2.5 * s);
    g.fill(this.JOINT);
    g.moveTo(knee.x * s, knee.y * s);
    g.lineTo(ankle.x * s, ankle.y * s);
    g.stroke({ width: s * 2.5, color: this.BONE });

    const iso = sk.iso;
    const tipX = ankle.x + iso.x * 3;
    const tipY = ankle.y + iso.y * 1.2 + 1.5;
    g.moveTo(ankle.x * s, ankle.y * s);
    g.lineTo(tipX * s, tipY * s);
    g.stroke({ width: s * 2, color: this.BONE });
  }

  private drawBoneArm(g: Graphics, j: Record<string, V>, s: number, side: "L" | "R"): void {
    const shoulder = j[`shoulder${side}`];
    const elbow = j[`elbow${side}`];
    const wrist = j[`wrist${side}`];

    g.moveTo(shoulder.x * s, shoulder.y * s);
    g.lineTo(elbow.x * s, elbow.y * s);
    g.stroke({ width: s * 2.5, color: this.BONE });
    g.circle(elbow.x * s, elbow.y * s, 2 * s);
    g.fill(this.JOINT);

    const dx = wrist.x - elbow.x;
    const dy = wrist.y - elbow.y;
    const len = Math.sqrt(dx * dx + dy * dy) || 1;
    const px = (-dy / len) * 0.7;
    const py = (dx / len) * 0.7;
    g.moveTo((elbow.x + px) * s, (elbow.y + py) * s);
    g.lineTo((wrist.x + px * 0.5) * s, (wrist.y + py * 0.5) * s);
    g.moveTo((elbow.x - px) * s, (elbow.y - py) * s);
    g.lineTo((wrist.x - px * 0.5) * s, (wrist.y - py * 0.5) * s);
    g.stroke({ width: s * 1.5, color: this.BONE });

    g.circle(wrist.x * s, wrist.y * s, 2 * s);
    g.fill(this.BONE);
  }

  private drawSkull(g: Graphics, j: Record<string, V>, sk: Skeleton, s: number): void {
    const head = j.head;
    const { wf, iso } = sk;
    const faceCam = iso.y > 0;
    const sideView = Math.abs(iso.x) > 0.3;
    const skullW = 8 * wf;
    const skullH = 7.5;

    // Skull
    g.roundRect((head.x - skullW) * s, (head.y - skullH) * s, skullW * 2 * s, skullH * 2 * s, 3.5 * s);
    g.fill(this.SKULL);
    g.roundRect((head.x - skullW) * s, (head.y - skullH) * s, skullW * 2 * s, skullH * 2 * s, 3.5 * s);
    g.stroke({ width: s * 0.7, color: this.BONE_DK, alpha: 0.45 });

    // Eye sockets with purple glow
    if (faceCam || (sideView && iso.y >= -0.1)) {
      const spread = 3.2 * wf;
      const eyeY = head.y + 0.5 + iso.y * 0.8;
      const eyeOX = head.x + iso.x * 0.8;

      // Glow halos
      g.ellipse((eyeOX - spread) * s, eyeY * s, 3 * s, 2.5 * s);
      g.fill({ color: this.EYE_GLOW, alpha: 0.15 });
      g.ellipse((eyeOX + spread) * s, eyeY * s, 3 * s, 2.5 * s);
      g.fill({ color: this.EYE_GLOW, alpha: 0.15 });

      // Sockets
      g.ellipse((eyeOX - spread) * s, eyeY * s, 2.5 * s, 2.2 * s);
      g.fill(0x111111);
      g.ellipse((eyeOX + spread) * s, eyeY * s, 2.5 * s, 2.2 * s);
      g.fill(0x111111);

      // Glowing purple cores
      g.circle((eyeOX - spread) * s, eyeY * s, 1 * s);
      g.fill({ color: this.EYE_GLOW, alpha: 0.8 });
      g.circle((eyeOX + spread) * s, eyeY * s, 1 * s);
      g.fill({ color: this.EYE_GLOW, alpha: 0.8 });

      // Nose + teeth
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

      g.poly([
        (px - 0.8) * s, crownY * s,
        px * s, tipY * s,
        (px + 0.8) * s, crownY * s,
      ]);
      g.fill(this.CROWN);
      g.poly([
        (px - 0.8) * s, crownY * s,
        px * s, tipY * s,
        (px + 0.8) * s, crownY * s,
      ]);
      g.stroke({ width: s * 0.3, color: this.BONE_DK, alpha: 0.4 });
    }
  }
}
