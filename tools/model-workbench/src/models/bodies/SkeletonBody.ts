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
import { darken, lighten } from "../palette";
import { drawTaperedLimb } from "../draw-helpers";

/**
 * Skeleton NPC body — undead humanoid made of bones.
 * Thin frame, visible rib cage, skull head, bony limbs.
 * CAN hold weapons (hand-R, hand-L slots exposed).
 *
 * Reference from game client:
 * - Bone color: 0xd0c8b8 body, 0xe8e0d0 skull
 * - Thin torso (12px wide vs human 20px)
 * - Three rib lines across torso
 * - Skull with jaw line detail
 */
export class SkeletonBody implements Model {
  readonly id = "skeleton-body";
  readonly name = "Skeleton";
  readonly category = "npc" as const;
  readonly slot = "root" as const;

  private readonly BONE = 0xd0c8b8;
  private readonly SKULL = 0xe8e0d0;
  private readonly BONE_DK = 0x9a9488;
  private readonly JOINT = 0xb8b0a0;
  private readonly RIB_LINE = 0x444444;

  getDrawCalls(ctx: RenderContext): DrawCall[] {
    const { skeleton, facingCamera, nearSide, farSide } = ctx;
    const j = skeleton.joints;
    const calls: DrawCall[] = [];

    // Shadow
    calls.push({
      depth: 0,
      draw: (g, s) => {
        g.ellipse(0, 2 * s, 10 * s, 4 * s);
        g.fill({ color: 0x000000, alpha: 0.15 });
      },
    });

    // Legs (bony)
    calls.push({ depth: 10, draw: (g, s) => this.drawBoneLeg(g, j, skeleton, s, farSide) });
    calls.push({ depth: 12, draw: (g, s) => this.drawBoneLeg(g, j, skeleton, s, nearSide) });

    // Far arm
    calls.push({
      depth: facingCamera ? 20 : 45,
      draw: (g, s) => this.drawBoneArm(g, j, s, farSide),
    });

    // Spine + Rib cage
    calls.push({ depth: 30, draw: (g, s) => this.drawRibCage(g, j, skeleton, s) });

    // Pelvis bone
    calls.push({ depth: 32, draw: (g, s) => this.drawPelvis(g, j, skeleton, s) });

    // Skull
    calls.push({ depth: 50, draw: (g, s) => this.drawSkull(g, j, skeleton, s) });

    // Near arm
    calls.push({
      depth: facingCamera ? 59 : 24,
      draw: (g, s) => this.drawBoneArm(g, j, s, nearSide),
    });

    return calls;
  }

  getAttachmentPoints(skeleton: Skeleton): Record<string, AttachmentPoint> {
    // Skeletons can hold weapons
    return {
      "hand-R": skeleton.attachments["hand-R"],
      "hand-L": skeleton.attachments["hand-L"],
      "head-top": skeleton.attachments["head-top"],
    };
  }

  // ─── RIB CAGE ────────────────────────────────────────────────────

  private drawRibCage(g: Graphics, j: Record<string, V>, sk: Skeleton, s: number): void {
    const { wf, iso } = sk;
    const neckBase = j.neckBase;
    const hipL = j.hipL;
    const hipR = j.hipR;

    // Spine (central bone)
    const spineTop = { x: neckBase.x, y: neckBase.y + 1 };
    const spineBot = { x: (hipL.x + hipR.x) / 2, y: hipL.y - 2 };

    g.moveTo(spineTop.x * s, spineTop.y * s);
    g.lineTo(spineBot.x * s, spineBot.y * s);
    g.stroke({ width: s * 2, color: this.BONE });
    g.moveTo(spineTop.x * s, spineTop.y * s);
    g.lineTo(spineBot.x * s, spineBot.y * s);
    g.stroke({ width: s * 0.8, color: this.BONE_DK, alpha: 0.3 });

    // Rib bones (3 pairs curving out from spine)
    const ribWidth = 7 * wf;
    const spineLen = spineBot.y - spineTop.y;

    for (let i = 0; i < 3; i++) {
      const t = (i + 0.5) / 3.5;
      const ribY = spineTop.y + spineLen * t;
      const ribX = spineTop.x + (spineBot.x - spineTop.x) * t;
      const curveW = ribWidth * (1 - i * 0.12); // ribs get narrower lower down
      const curveH = 1.5 + i * 0.3;

      // Left rib
      g.moveTo(ribX * s, ribY * s);
      g.quadraticCurveTo(
        (ribX - curveW * 0.6) * s,
        (ribY - curveH) * s,
        (ribX - curveW) * s,
        (ribY + curveH * 0.5) * s
      );
      // Right rib
      g.moveTo(ribX * s, ribY * s);
      g.quadraticCurveTo(
        (ribX + curveW * 0.6) * s,
        (ribY - curveH) * s,
        (ribX + curveW) * s,
        (ribY + curveH * 0.5) * s
      );
      g.stroke({ width: s * 1.2, color: this.BONE });
    }

    // Rib outlines
    for (let i = 0; i < 3; i++) {
      const t = (i + 0.5) / 3.5;
      const ribY = spineTop.y + spineLen * t;
      const ribX = spineTop.x + (spineBot.x - spineTop.x) * t;
      const curveW = ribWidth * (1 - i * 0.12);
      const curveH = 1.5 + i * 0.3;

      g.moveTo(ribX * s, ribY * s);
      g.quadraticCurveTo(
        (ribX - curveW * 0.6) * s,
        (ribY - curveH) * s,
        (ribX - curveW) * s,
        (ribY + curveH * 0.5) * s
      );
      g.moveTo(ribX * s, ribY * s);
      g.quadraticCurveTo(
        (ribX + curveW * 0.6) * s,
        (ribY - curveH) * s,
        (ribX + curveW) * s,
        (ribY + curveH * 0.5) * s
      );
      g.stroke({ width: s * 0.5, color: this.RIB_LINE, alpha: 0.35 });
    }

    // Collar bones
    const collarY = neckBase.y + 1;
    g.moveTo(neckBase.x * s, collarY * s);
    g.lineTo((neckBase.x - 7 * wf) * s, (collarY + 1) * s);
    g.moveTo(neckBase.x * s, collarY * s);
    g.lineTo((neckBase.x + 7 * wf) * s, (collarY + 1) * s);
    g.stroke({ width: s * 1.2, color: this.BONE });
    g.moveTo(neckBase.x * s, collarY * s);
    g.lineTo((neckBase.x - 7 * wf) * s, (collarY + 1) * s);
    g.moveTo(neckBase.x * s, collarY * s);
    g.lineTo((neckBase.x + 7 * wf) * s, (collarY + 1) * s);
    g.stroke({ width: s * 0.4, color: this.BONE_DK, alpha: 0.3 });
  }

  // ─── PELVIS ──────────────────────────────────────────────────────

  private drawPelvis(g: Graphics, j: Record<string, V>, sk: Skeleton, s: number): void {
    const { hipL, hipR, crotch } = j;
    const wf = sk.wf;

    // Pelvic bone — butterfly shape
    const pelvisW = 6 * wf;
    const pelvisY = (hipL.y + crotch.y) / 2;

    g.moveTo(crotch.x * s, crotch.y * s);
    g.quadraticCurveTo(
      (crotch.x - pelvisW * 0.8) * s,
      (pelvisY - 2) * s,
      (crotch.x - pelvisW) * s,
      pelvisY * s
    );
    g.quadraticCurveTo(
      (crotch.x - pelvisW * 0.5) * s,
      (pelvisY + 2) * s,
      crotch.x * s,
      (crotch.y + 1) * s
    );
    g.quadraticCurveTo(
      (crotch.x + pelvisW * 0.5) * s,
      (pelvisY + 2) * s,
      (crotch.x + pelvisW) * s,
      pelvisY * s
    );
    g.quadraticCurveTo(
      (crotch.x + pelvisW * 0.8) * s,
      (pelvisY - 2) * s,
      crotch.x * s,
      crotch.y * s
    );
    g.closePath();
    g.fill(this.BONE);
    g.moveTo(crotch.x * s, crotch.y * s);
    g.quadraticCurveTo(
      (crotch.x - pelvisW * 0.8) * s,
      (pelvisY - 2) * s,
      (crotch.x - pelvisW) * s,
      pelvisY * s
    );
    g.quadraticCurveTo(
      (crotch.x - pelvisW * 0.5) * s,
      (pelvisY + 2) * s,
      crotch.x * s,
      (crotch.y + 1) * s
    );
    g.quadraticCurveTo(
      (crotch.x + pelvisW * 0.5) * s,
      (pelvisY + 2) * s,
      (crotch.x + pelvisW) * s,
      pelvisY * s
    );
    g.quadraticCurveTo(
      (crotch.x + pelvisW * 0.8) * s,
      (pelvisY - 2) * s,
      crotch.x * s,
      crotch.y * s
    );
    g.closePath();
    g.stroke({ width: s * 0.5, color: this.BONE_DK, alpha: 0.4 });
  }

  // ─── BONE LEG ────────────────────────────────────────────────────

  private drawBoneLeg(
    g: Graphics,
    j: Record<string, V>,
    sk: Skeleton,
    s: number,
    side: "L" | "R"
  ): void {
    const hip = j[`hip${side}`];
    const knee = j[`knee${side}`];
    const ankle = j[`ankle${side}`];

    // Femur
    g.moveTo((hip.x * 0.4) * s, hip.y * s);
    g.lineTo(knee.x * s, knee.y * s);
    g.stroke({ width: s * 2.5, color: this.BONE });
    g.moveTo((hip.x * 0.4) * s, hip.y * s);
    g.lineTo(knee.x * s, knee.y * s);
    g.stroke({ width: s * 0.6, color: this.BONE_DK, alpha: 0.3 });

    // Knee joint
    g.circle(knee.x * s, knee.y * s, 2.2 * s);
    g.fill(this.JOINT);
    g.circle(knee.x * s, knee.y * s, 2.2 * s);
    g.stroke({ width: s * 0.4, color: this.BONE_DK, alpha: 0.3 });

    // Tibia
    g.moveTo(knee.x * s, knee.y * s);
    g.lineTo(ankle.x * s, ankle.y * s);
    g.stroke({ width: s * 2, color: this.BONE });
    g.moveTo(knee.x * s, knee.y * s);
    g.lineTo(ankle.x * s, ankle.y * s);
    g.stroke({ width: s * 0.5, color: this.BONE_DK, alpha: 0.3 });

    // Bony foot
    const iso = sk.iso;
    const footLen = 3;
    const tipX = ankle.x + iso.x * footLen;
    const tipY = ankle.y + iso.y * footLen * 0.4 + 1.5;

    g.moveTo(ankle.x * s, ankle.y * s);
    g.lineTo(tipX * s, tipY * s);
    g.stroke({ width: s * 1.8, color: this.BONE });
    // Toes (two small prongs)
    const fdx = tipX - ankle.x;
    const fdy = tipY - ankle.y;
    const flen = Math.sqrt(fdx * fdx + fdy * fdy) || 1;
    const pnx = -fdy / flen;
    const pny = fdx / flen;
    g.moveTo(tipX * s, tipY * s);
    g.lineTo((tipX + pnx * 1.2 + fdx / flen) * s, (tipY + pny * 1.2 + fdy / flen * 0.5) * s);
    g.moveTo(tipX * s, tipY * s);
    g.lineTo((tipX - pnx * 1.2 + fdx / flen) * s, (tipY - pny * 1.2 + fdy / flen * 0.5) * s);
    g.stroke({ width: s * 1.2, color: this.BONE });
  }

  // ─── BONE ARM ────────────────────────────────────────────────────

  private drawBoneArm(
    g: Graphics,
    j: Record<string, V>,
    s: number,
    side: "L" | "R"
  ): void {
    const shoulder = j[`shoulder${side}`];
    const elbow = j[`elbow${side}`];
    const wrist = j[`wrist${side}`];

    // Humerus
    g.moveTo(shoulder.x * s, shoulder.y * s);
    g.lineTo(elbow.x * s, elbow.y * s);
    g.stroke({ width: s * 2, color: this.BONE });
    g.moveTo(shoulder.x * s, shoulder.y * s);
    g.lineTo(elbow.x * s, elbow.y * s);
    g.stroke({ width: s * 0.5, color: this.BONE_DK, alpha: 0.3 });

    // Elbow joint
    g.circle(elbow.x * s, elbow.y * s, 1.8 * s);
    g.fill(this.JOINT);

    // Radius/Ulna (two parallel bones)
    const dx = wrist.x - elbow.x;
    const dy = wrist.y - elbow.y;
    const len = Math.sqrt(dx * dx + dy * dy) || 1;
    const px = (-dy / len) * 0.6;
    const py = (dx / len) * 0.6;

    g.moveTo((elbow.x + px) * s, (elbow.y + py) * s);
    g.lineTo((wrist.x + px * 0.5) * s, (wrist.y + py * 0.5) * s);
    g.moveTo((elbow.x - px) * s, (elbow.y - py) * s);
    g.lineTo((wrist.x - px * 0.5) * s, (wrist.y - py * 0.5) * s);
    g.stroke({ width: s * 1.3, color: this.BONE });

    // Bony hand
    g.circle(wrist.x * s, wrist.y * s, 1.6 * s);
    g.fill(this.BONE);
    g.circle(wrist.x * s, wrist.y * s, 1.6 * s);
    g.stroke({ width: s * 0.3, color: this.BONE_DK, alpha: 0.3 });

    // Finger bones (3 small lines)
    for (let i = -1; i <= 1; i++) {
      const fx = wrist.x + (dx / len) * 2.5 + (px * i * 1.2);
      const fy = wrist.y + (dy / len) * 2.5 + (py * i * 1.2);
      g.moveTo(wrist.x * s, wrist.y * s);
      g.lineTo(fx * s, fy * s);
      g.stroke({ width: s * 0.6, color: this.BONE });
    }
  }

  // ─── SKULL ───────────────────────────────────────────────────────

  private drawSkull(g: Graphics, j: Record<string, V>, sk: Skeleton, s: number): void {
    const head = j.head;
    const { wf, iso } = sk;
    const faceCam = iso.y > 0;
    const sideView = Math.abs(iso.x) > 0.3;

    // Skull shape (slightly wider than round — more angular)
    const skullW = 7.5 * wf;
    const skullH = 7;

    g.roundRect(
      (head.x - skullW) * s,
      (head.y - skullH) * s,
      skullW * 2 * s,
      skullH * 2 * s,
      3 * s
    );
    g.fill(this.SKULL);
    g.roundRect(
      (head.x - skullW) * s,
      (head.y - skullH) * s,
      skullW * 2 * s,
      skullH * 2 * s,
      3 * s
    );
    g.stroke({ width: s * 0.6, color: this.BONE_DK, alpha: 0.4 });

    // Cranium highlight
    g.ellipse(
      (head.x - iso.x * 1) * s,
      (head.y - 2) * s,
      (skullW - 1.5) * s,
      (skullH - 2.5) * s
    );
    g.fill({ color: lighten(this.SKULL, 0.08), alpha: 0.3 });

    // Eye sockets (dark holes)
    if (faceCam || (sideView && iso.y >= -0.1)) {
      const spread = 3 * wf;
      const eyeY = head.y + 0.5 + iso.y * 0.8;
      const eyeOX = head.x + iso.x * 0.8;

      // Deep sockets
      g.ellipse((eyeOX - spread) * s, eyeY * s, 2.2 * s, 2 * s);
      g.fill(0x222222);
      g.ellipse((eyeOX + spread) * s, eyeY * s, 2.2 * s, 2 * s);
      g.fill(0x222222);

      // Eerie red glow dots
      g.circle((eyeOX - spread + iso.x * 0.3) * s, (eyeY + 0.2) * s, 0.7 * s);
      g.fill(0xcc3333);
      g.circle((eyeOX + spread + iso.x * 0.3) * s, (eyeY + 0.2) * s, 0.7 * s);
      g.fill(0xcc3333);

      // Nose cavity (triangle)
      if (faceCam) {
        const noseY = head.y + 2.5 + iso.y * 0.3;
        g.poly([
          (head.x - 1) * s, noseY * s,
          head.x * s, (noseY + 2) * s,
          (head.x + 1) * s, noseY * s,
        ]);
        g.fill(0x333333);
      }

      // Jaw line / teeth
      if (faceCam) {
        const jawY = head.y + 4.5 + iso.y * 0.3;
        g.moveTo((head.x - 3 * wf) * s, jawY * s);
        g.lineTo((head.x + 3 * wf) * s, jawY * s);
        g.stroke({ width: s * 0.8, color: this.BONE_DK, alpha: 0.5 });

        // Teeth (small vertical lines)
        for (let i = -2; i <= 2; i++) {
          const tx = head.x + i * 1.2 * wf;
          g.moveTo(tx * s, (jawY - 0.8) * s);
          g.lineTo(tx * s, (jawY + 0.8) * s);
          g.stroke({ width: s * 0.5, color: this.SKULL, alpha: 0.7 });
        }
      }
    } else {
      // Back of skull — just a smooth dome
      g.ellipse(
        head.x * s,
        (head.y - 1) * s,
        (skullW - 0.5) * s,
        (skullH - 1) * s
      );
      g.fill({ color: darken(this.SKULL, 0.05), alpha: 0.3 });
    }

    // Neck vertebrae
    const neckBase = j.neckBase;
    g.moveTo(head.x * s, (head.y + skullH - 1) * s);
    g.lineTo(neckBase.x * s, neckBase.y * s);
    g.stroke({ width: s * 1.5, color: this.BONE });

    // Vertebrae bumps
    for (let i = 1; i <= 2; i++) {
      const t = i / 3;
      const vx = head.x + (neckBase.x - head.x) * t;
      const vy = (head.y + skullH - 1) + (neckBase.y - head.y - skullH + 1) * t;
      g.circle(vx * s, vy * s, 1 * s);
      g.fill(this.JOINT);
    }
  }
}
