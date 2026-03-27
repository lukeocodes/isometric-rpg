import type { Graphics } from "pixi.js";
import type { Model, RenderContext, DrawCall, Skeleton, AttachmentPoint, V } from "../types";
import { darken, lighten } from "../palette";
import { drawTaperedLimb } from "../draw-helpers";

/**
 * Witch NPC — robed spellcaster with pointed hat, glowing eyes, thin frame.
 * Can hold weapons (staff, wand). Slightly hunched, eerie presence.
 * Purple/dark theme with green accents.
 */
export class WitchBody implements Model {
  readonly id = "witch-body";
  readonly name = "Witch";
  readonly category = "npc" as const;
  readonly slot = "root" as const;

  private readonly ROBE = 0x2a1a3a;
  private readonly ROBE_DK = 0x1a0a2a;
  private readonly ROBE_LT = 0x3a2a4a;
  private readonly SKIN = 0xa8b898; // pale greenish
  private readonly SKIN_DK = 0x889878;
  private readonly EYE = 0x44ee44; // green glow
  private readonly HAT = 0x1a1a2e;

  getDrawCalls(ctx: RenderContext): DrawCall[] {
    const { skeleton, facingCamera, nearSide, farSide } = ctx;
    const j = skeleton.joints;
    const { wf, iso, walkPhase } = skeleton;
    const calls: DrawCall[] = [];

    // Subtle magic aura
    calls.push({ depth: -1, draw: (g, s) => {
      g.ellipse(0, -8 * s, 12 * s, 16 * s);
      g.fill({ color: this.EYE, alpha: 0.02 });
    }});

    // Shadow
    calls.push({ depth: 0, draw: (g, s) => {
      g.ellipse(0, 2 * s, 10 * s, 4 * s);
      g.fill({ color: 0x000000, alpha: 0.15 });
    }});

    // Robe skirt (long, covers legs)
    calls.push({ depth: 9, draw: (g, s) => {
      const neckBase = j.neckBase;
      const sway = walkPhase !== 0 ? Math.sin(walkPhase * 0.8) * 1 : 0;
      const topY = j.waistL.y;
      const hemY = j.ankleL.y + 3;
      const W = 0.9;

      g.moveTo((j.waistL.x * W - 1) * s, topY * s);
      g.quadraticCurveTo((j.hipL.x * W - 3 + sway) * s, ((topY + hemY) / 2) * s, (j.hipL.x * W - 4 + sway * 1.5) * s, hemY * s);
      // Tattered hem
      for (let i = 0; i < 5; i++) {
        const t = i / 4;
        const px = (j.hipL.x * W - 4) + ((j.hipR.x * W + 4) - (j.hipL.x * W - 4)) * t + sway * (1 - t);
        const py = hemY + Math.sin(t * 7 + (walkPhase || 0)) * 1.5;
        g.lineTo(px * s, py * s);
      }
      g.quadraticCurveTo((j.hipR.x * W + 3 + sway) * s, ((topY + hemY) / 2) * s, (j.waistR.x * W + 1) * s, topY * s);
      g.closePath();
      g.fill(this.ROBE);

      // Fold lines
      g.moveTo(neckBase.x * s, (topY + 2) * s);
      g.lineTo((neckBase.x + sway * 0.5) * s, (hemY - 2) * s);
      g.stroke({ width: s * 0.5, color: this.ROBE_DK, alpha: 0.25 });
    }});

    // Far arm (robed sleeve)
    calls.push({ depth: facingCamera ? 20 : 45, draw: (g, s) => this.drawArm(g, j, skeleton, s, farSide) });

    // Torso (robed)
    calls.push({ depth: 30, draw: (g, s) => {
      const neckBase = j.neckBase;
      const W = 0.9;
      const chestL = { x: j.chestL.x * W, y: j.chestL.y };
      const chestR = { x: j.chestR.x * W, y: j.chestR.y };
      const waistL = { x: j.waistL.x * W, y: j.waistL.y };
      const waistR = { x: j.waistR.x * W, y: j.waistR.y };

      g.moveTo(neckBase.x * s, neckBase.y * s);
      g.quadraticCurveTo(chestR.x * s, chestR.y * s, waistR.x * s, waistR.y * s);
      g.lineTo(waistL.x * s, waistL.y * s);
      g.quadraticCurveTo(chestL.x * s, chestL.y * s, neckBase.x * s, neckBase.y * s);
      g.closePath();
      g.fill(this.ROBE);
      g.moveTo(neckBase.x * s, neckBase.y * s);
      g.quadraticCurveTo(chestR.x * s, chestR.y * s, waistR.x * s, waistR.y * s);
      g.lineTo(waistL.x * s, waistL.y * s);
      g.quadraticCurveTo(chestL.x * s, chestL.y * s, neckBase.x * s, neckBase.y * s);
      g.closePath();
      g.stroke({ width: s * 0.5, color: this.ROBE_LT, alpha: 0.2 });

      // Pendant/amulet
      const pendY = (neckBase.y + waistL.y) / 2 - 2;
      g.circle(neckBase.x * s, pendY * s, 1.5 * s);
      g.fill({ color: this.EYE, alpha: 0.5 });
      g.circle(neckBase.x * s, pendY * s, 1.5 * s);
      g.stroke({ width: s * 0.3, color: 0x888888, alpha: 0.4 });

      // Thin neck
      g.roundRect((neckBase.x - 1.5) * s, (neckBase.y - 2.5) * s, 3 * s, 3.5 * s, 1 * s);
      g.fill(this.SKIN);
    }});

    // Head + hat
    calls.push({ depth: 50, draw: (g, s) => this.drawHead(g, j, skeleton, s) });

    // Near arm
    calls.push({ depth: facingCamera ? 59 : 24, draw: (g, s) => this.drawArm(g, j, skeleton, s, nearSide) });

    return calls;
  }

  getAttachmentPoints(skeleton: Skeleton): Record<string, AttachmentPoint> {
    return {
      "hand-R": skeleton.attachments["hand-R"],
      "hand-L": skeleton.attachments["hand-L"],
    };
  }

  private drawArm(g: Graphics, j: Record<string, V>, sk: Skeleton, s: number, side: "L" | "R"): void {
    const shoulder = j[`shoulder${side}`];
    const elbow = j[`elbow${side}`];
    const wrist = j[`wrist${side}`];

    // Wide sleeve upper
    g.moveTo(shoulder.x * s, shoulder.y * s);
    g.lineTo(elbow.x * s, elbow.y * s);
    g.stroke({ width: s * 5, color: this.ROBE });

    // Flared sleeve lower
    g.moveTo(elbow.x * s, elbow.y * s);
    g.lineTo(wrist.x * s, wrist.y * s);
    g.stroke({ width: s * 6, color: this.ROBE });

    // Sleeve drape
    const dx = wrist.x - elbow.x;
    const dy = wrist.y - elbow.y;
    const len = Math.sqrt(dx * dx + dy * dy) || 1;
    const px = -dy / len;
    const py = dx / len;
    g.moveTo(elbow.x * s, elbow.y * s);
    g.quadraticCurveTo((elbow.x + px * 3 + dx * 0.5) * s, (elbow.y + py * 3 + dy * 0.5) * s, wrist.x * s, (wrist.y + 4) * s);
    g.stroke({ width: s * 0.4, color: this.ROBE_DK, alpha: 0.3 });

    // Bony hand
    g.circle(wrist.x * s, wrist.y * s, 1.5 * s);
    g.fill(this.SKIN);
  }

  private drawHead(g: Graphics, j: Record<string, V>, sk: Skeleton, s: number): void {
    const head = j.head;
    const { wf, iso } = sk;
    const faceCam = iso.y > 0;
    const sideView = Math.abs(iso.x) > 0.3;
    const r = 6;

    // Head
    g.ellipse(head.x * s, head.y * s, r * wf * s, (r + 0.5) * s);
    g.fill(this.SKIN);
    if (faceCam) {
      g.ellipse(head.x * s, (head.y + 2) * s, (r - 1) * wf * s, (r - 1.5) * s);
      g.fill(this.SKIN);
    }
    g.ellipse(head.x * s, head.y * s, r * wf * s, (r + 0.5) * s);
    g.stroke({ width: s * 0.4, color: this.SKIN_DK, alpha: 0.3 });

    // Glowing green eyes
    if (faceCam || (sideView && iso.y >= -0.1)) {
      const spread = 2.5 * wf;
      const eyeY = head.y + 0.5 + iso.y * 0.8;
      const eyeOX = head.x + iso.x * 0.8;

      g.circle((eyeOX - spread) * s, eyeY * s, 1.5 * s);
      g.fill({ color: this.EYE, alpha: 0.15 });
      g.circle((eyeOX + spread) * s, eyeY * s, 1.5 * s);
      g.fill({ color: this.EYE, alpha: 0.15 });

      g.circle((eyeOX - spread) * s, eyeY * s, 0.9 * s);
      g.fill({ color: this.EYE, alpha: 0.7 });
      g.circle((eyeOX + spread) * s, eyeY * s, 0.9 * s);
      g.fill({ color: this.EYE, alpha: 0.7 });

      g.circle((eyeOX - spread) * s, eyeY * s, 0.35 * s);
      g.fill({ color: 0xffffff, alpha: 0.5 });
      g.circle((eyeOX + spread) * s, eyeY * s, 0.35 * s);
      g.fill({ color: 0xffffff, alpha: 0.5 });

      // Hooked nose
      if (faceCam) {
        const noseY = head.y + 2.5;
        g.moveTo(head.x * s, (noseY - 1) * s);
        g.quadraticCurveTo((head.x + 0.8) * s, noseY * s, (head.x + 0.3) * s, (noseY + 1.5) * s);
        g.stroke({ width: s * 0.5, color: this.SKIN_DK, alpha: 0.4 });
      }

      // Thin-lipped smile
      if (faceCam) {
        const mouthY = head.y + 4.5;
        g.moveTo((head.x - 1.5 * wf) * s, mouthY * s);
        g.quadraticCurveTo(head.x * s, (mouthY + 0.5) * s, (head.x + 1.5 * wf) * s, (mouthY - 0.3) * s);
        g.stroke({ width: s * 0.4, color: this.SKIN_DK, alpha: 0.3 });
      }
    }

    // Pointed witch hat
    const hatBrimY = head.y - r + 1;
    const hatTipY = hatBrimY - 14;

    // Brim
    g.ellipse(head.x * s, (hatBrimY + 1) * s, (r + 3) * wf * s, 2.5 * s);
    g.fill(this.HAT);
    g.ellipse(head.x * s, (hatBrimY + 1) * s, (r + 3) * wf * s, 2.5 * s);
    g.stroke({ width: s * 0.4, color: lighten(this.HAT, 0.1), alpha: 0.25 });

    // Cone
    g.moveTo((head.x - (r - 1) * wf) * s, hatBrimY * s);
    g.quadraticCurveTo((head.x - 2 * wf) * s, (hatBrimY - 6) * s, (head.x + 2) * s, hatTipY * s);
    g.quadraticCurveTo((head.x + 2 * wf) * s, (hatBrimY - 6) * s, (head.x + (r - 1) * wf) * s, hatBrimY * s);
    g.closePath();
    g.fill(this.HAT);

    // Hat band
    g.moveTo((head.x - (r - 1.5) * wf) * s, (hatBrimY + 0.5) * s);
    g.lineTo((head.x + (r - 1.5) * wf) * s, (hatBrimY + 0.5) * s);
    g.stroke({ width: s * 1.2, color: this.ROBE_LT });

    // Hat buckle
    g.rect((head.x - 1) * s, (hatBrimY - 0.5) * s, 2 * s, 2 * s);
    g.fill(0x888844);
  }
}
