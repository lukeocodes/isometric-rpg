import type { Graphics } from "pixi.js";
import type { Model, RenderContext, DrawCall, Skeleton, AttachmentPoint, V } from "../types";
import { darken, lighten } from "../palette";
import { drawTaperedLimb } from "../draw-helpers";

/**
 * Goblin Chieftain — boss variant of Goblin.
 * Larger, war-painted, feathered headdress, scarred.
 */
export class GoblinChieftain implements Model {
  readonly id = "goblin-chieftain";
  readonly name = "Goblin Chieftain";
  readonly category = "npc" as const;
  readonly slot = "root" as const;

  private readonly SKIN = 0x4a7a3a;     // darker green
  private readonly SKIN_DK = 0x2a5a1a;
  private readonly BELLY = 0x5a4a2a;
  private readonly EYE = 0xff4444;
  private readonly WARPAINT = 0xcc2222;
  private readonly FEATHER = 0xcc4400;

  getDrawCalls(ctx: RenderContext): DrawCall[] {
    const { skeleton, facingCamera, nearSide, farSide } = ctx;
    const j = skeleton.joints;
    const { wf, iso } = skeleton;
    const calls: DrawCall[] = [];

    // Boss aura
    calls.push({ depth: -1, draw: (g, s) => {
      g.ellipse(0, -8 * s, 16 * s, 20 * s);
      g.fill({ color: 0x446622, alpha: 0.04 });
    }});

    // Shadow
    calls.push({ depth: 0, draw: (g, s) => {
      g.ellipse(0, 2 * s, 16 * s, 5.5 * s);
      g.fill({ color: 0x000000, alpha: 0.2 });
    }});

    const W = 1.35;

    // Legs
    calls.push({ depth: 10, draw: (g, s) => this.drawLeg(g, j, skeleton, s, farSide, W) });
    calls.push({ depth: 12, draw: (g, s) => this.drawLeg(g, j, skeleton, s, nearSide, W) });

    // Far arm
    calls.push({ depth: facingCamera ? 20 : 45, draw: (g, s) => this.drawArm(g, j, s, farSide) });

    // Torso (wider)
    calls.push({ depth: 30, draw: (g, s) => {
      const neckBase = j.neckBase;
      const chestL = { x: j.chestL.x * W, y: j.chestL.y };
      const chestR = { x: j.chestR.x * W, y: j.chestR.y };
      const waistL = { x: j.waistL.x * W * 1.15, y: j.waistL.y };
      const waistR = { x: j.waistR.x * W * 1.15, y: j.waistR.y };
      const hipL = { x: j.hipL.x * W, y: j.hipL.y };
      const hipR = { x: j.hipR.x * W, y: j.hipR.y };

      g.moveTo(neckBase.x * s, neckBase.y * s);
      g.quadraticCurveTo(chestR.x * s, (chestR.y - 1) * s, chestR.x * s, chestR.y * s);
      g.quadraticCurveTo((waistR.x + 2) * s, ((chestR.y + waistR.y) / 2) * s, waistR.x * s, waistR.y * s);
      g.lineTo(hipR.x * s, hipR.y * s);
      g.lineTo(hipL.x * s, hipL.y * s);
      g.lineTo(waistL.x * s, waistL.y * s);
      g.quadraticCurveTo((waistL.x - 2) * s, ((chestL.y + waistL.y) / 2) * s, chestL.x * s, chestL.y * s);
      g.quadraticCurveTo(chestL.x * s, (chestL.y - 1) * s, neckBase.x * s, neckBase.y * s);
      g.closePath();
      g.fill(this.BELLY);

      // War scars on torso
      g.moveTo((neckBase.x - 4) * s, (neckBase.y + 3) * s);
      g.lineTo((neckBase.x + 2) * s, (neckBase.y + 8) * s);
      g.stroke({ width: s * 0.6, color: this.WARPAINT, alpha: 0.3 });

      g.roundRect((neckBase.x - 4) * s, (neckBase.y - 1.5) * s, 8 * s, 3 * s, 2 * s);
      g.fill(this.SKIN);
    }});

    // Head with headdress
    calls.push({ depth: 50, draw: (g, s) => this.drawHead(g, j, skeleton, s) });

    // Near arm
    calls.push({ depth: facingCamera ? 59 : 24, draw: (g, s) => this.drawArm(g, j, s, nearSide) });

    return calls;
  }

  getAttachmentPoints(skeleton: Skeleton): Record<string, AttachmentPoint> {
    return { "hand-R": skeleton.attachments["hand-R"], "hand-L": skeleton.attachments["hand-L"] };
  }

  private drawLeg(g: Graphics, j: Record<string, V>, sk: Skeleton, s: number, side: "L" | "R", W: number): void {
    const hip = j[`hip${side}`];
    const knee = j[`knee${side}`];
    const ankle = j[`ankle${side}`];
    const legTop: V = { x: hip.x * 0.6, y: hip.y };
    drawTaperedLimb(g, legTop, knee, 6, 5, this.SKIN, this.SKIN_DK, darken(this.SKIN, 0.35), s);
    g.ellipse(knee.x * s, knee.y * s, 3.2 * s, 2.2 * s);
    g.fill(this.SKIN);
    drawTaperedLimb(g, knee, ankle, 5, 4, this.SKIN, this.SKIN_DK, darken(this.SKIN, 0.35), s);
  }

  private drawArm(g: Graphics, j: Record<string, V>, s: number, side: "L" | "R"): void {
    const shoulder = j[`shoulder${side}`];
    const elbow = j[`elbow${side}`];
    const wrist = j[`wrist${side}`];
    drawTaperedLimb(g, shoulder, elbow, 5, 4.2, this.SKIN, this.SKIN_DK, darken(this.SKIN, 0.35), s);
    g.circle(elbow.x * s, elbow.y * s, 2.5 * s);
    g.fill(this.SKIN);
    drawTaperedLimb(g, elbow, wrist, 4, 3.5, this.SKIN, this.SKIN_DK, darken(this.SKIN, 0.35), s);
    g.circle(wrist.x * s, wrist.y * s, 3 * s);
    g.fill(this.SKIN);
  }

  private drawHead(g: Graphics, j: Record<string, V>, sk: Skeleton, s: number): void {
    const head = j.head;
    const { wf, iso } = sk;
    const faceCam = iso.y > 0;
    const sideView = Math.abs(iso.x) > 0.3;
    const r = 9;

    // Pointed ears (bigger)
    if (sideView) {
      const earSide = iso.x > 0 ? 1 : -1;
      const earBaseX = head.x + earSide * r * wf * 0.85;
      g.poly([earBaseX * s, (head.y - 3) * s, (earBaseX + earSide * 8) * s, (head.y - 1) * s, earBaseX * s, (head.y + 2) * s]);
      g.fill(this.SKIN);
    } else if (faceCam) {
      for (const earSide of [-1, 1]) {
        const earBaseX = head.x + earSide * r * wf * 0.8;
        g.poly([earBaseX * s, (head.y - 2) * s, (earBaseX + earSide * 6) * s, (head.y - 0.5) * s, earBaseX * s, (head.y + 2) * s]);
        g.fill(this.SKIN);
      }
    }

    // Head
    g.ellipse(head.x * s, head.y * s, r * wf * s, (r - 0.5) * s);
    g.fill(this.SKIN);
    g.ellipse(head.x * s, head.y * s, r * wf * s, (r - 0.5) * s);
    g.stroke({ width: s * 0.6, color: this.SKIN_DK, alpha: 0.4 });

    // War paint stripes on face
    if (faceCam) {
      g.moveTo((head.x - 3 * wf) * s, (head.y - 2) * s);
      g.lineTo((head.x - 1 * wf) * s, (head.y + 3) * s);
      g.moveTo((head.x + 3 * wf) * s, (head.y - 2) * s);
      g.lineTo((head.x + 1 * wf) * s, (head.y + 3) * s);
      g.stroke({ width: s * 1, color: this.WARPAINT, alpha: 0.4 });
    }

    // Eyes
    if (faceCam || (sideView && iso.y >= -0.1)) {
      const spread = 3.2 * wf;
      const eyeY = head.y + 0.5 + iso.y * 0.8;
      const eyeOX = head.x + iso.x * 0.8;
      g.ellipse((eyeOX - spread) * s, eyeY * s, 2.5 * s, 2 * s);
      g.fill(0xffee88);
      g.ellipse((eyeOX + spread) * s, eyeY * s, 2.5 * s, 2 * s);
      g.fill(0xffee88);
      g.circle((eyeOX - spread) * s, eyeY * s, 1.4 * s);
      g.fill(this.EYE);
      g.circle((eyeOX + spread) * s, eyeY * s, 1.4 * s);
      g.fill(this.EYE);

      // Tusks (bigger)
      if (faceCam) {
        const mouthY = head.y + 5;
        for (const side of [-1, 1]) {
          g.poly([
            (head.x + side * 2.5 * wf) * s, mouthY * s,
            (head.x + side * 3 * wf) * s, (mouthY - 3) * s,
            (head.x + side * 1.8 * wf) * s, mouthY * s,
          ]);
          g.fill(0xeeddcc);
        }
      }
    }

    // Feathered headdress
    const featherBase = head.y - r + 1;
    for (let i = 0; i < 3; i++) {
      const fx = head.x + (i - 1) * 2.5 * wf;
      const angle = (i - 1) * 0.3;
      const tipX = fx + Math.sin(angle) * 3;
      const tipY = featherBase - 8 - i * 1.5;

      g.moveTo((fx - 0.5) * s, featherBase * s);
      g.quadraticCurveTo((tipX - 1) * s, (tipY + 3) * s, tipX * s, tipY * s);
      g.quadraticCurveTo((tipX + 1) * s, (tipY + 3) * s, (fx + 0.5) * s, featherBase * s);
      g.closePath();
      g.fill(i === 1 ? this.FEATHER : darken(this.FEATHER, 0.15));
    }
  }
}
