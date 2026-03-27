import type { Graphics } from "pixi.js";
import type { Model, RenderContext, DrawCall, Skeleton, AttachmentPoint, V } from "../types";
import { darken, lighten } from "../palette";
import { drawTaperedLimb } from "../draw-helpers";

/**
 * Imp Overlord — boss variant of Imp.
 * Larger, deeper red, bigger wings, flaming crown of horns, fire aura.
 */
export class ImpOverlord implements Model {
  readonly id = "imp-overlord";
  readonly name = "Imp Overlord";
  readonly category = "npc" as const;
  readonly slot = "root" as const;

  private readonly SKIN = 0x661111;
  private readonly SKIN_DK = 0x440808;
  private readonly HORN = 0x221111;
  private readonly WING = 0x441111;
  private readonly EYE = 0xff8800;
  private readonly FIRE = 0xff4400;

  getDrawCalls(ctx: RenderContext): DrawCall[] {
    const { skeleton, facingCamera, nearSide, farSide } = ctx;
    const j = skeleton.joints;
    const { iso, walkPhase, wf } = skeleton;
    const SC = 1.3;
    const calls: DrawCall[] = [];

    // Fire aura
    calls.push({ depth: -1, draw: (g, s) => {
      g.ellipse(0, -8 * s, 14 * SC * s, 18 * SC * s);
      g.fill({ color: this.FIRE, alpha: 0.04 });
    }});

    // Shadow
    calls.push({ depth: 0, draw: (g, s) => {
      g.ellipse(0, 2 * s, 10 * SC * s, 3.5 * SC * s);
      g.fill({ color: 0x000000, alpha: 0.18 });
    }});

    // Wings (bigger)
    calls.push({ depth: 5, draw: (g, s) => {
      const shoulder = { x: (j.shoulderL.x + j.shoulderR.x) / 2, y: j.shoulderL.y };
      const flap = walkPhase !== 0 ? Math.sin(walkPhase * 3) * 4 : 0;

      for (const side of [-1, 1]) {
        const bx = shoulder.x + side * 3 * wf;
        const by = shoulder.y - 1;
        const tipX = bx + side * 18 * SC;
        const tipY = by - 8 * SC + flap * side;
        const midX = bx + side * 13 * SC;
        const midY = by + 5 * SC + flap * side * 0.5;

        g.moveTo(bx * s, by * s);
        g.quadraticCurveTo((bx + side * 9 * SC) * s, (by - 10 * SC + flap * side) * s, tipX * s, tipY * s);
        g.quadraticCurveTo((midX + side * 2) * s, (by - 1) * s, midX * s, midY * s);
        g.lineTo(bx * s, (by + 6 * SC) * s);
        g.closePath();
        g.fill({ color: this.WING, alpha: 0.6 });

        g.moveTo(bx * s, by * s);
        g.lineTo(tipX * s, tipY * s);
        g.stroke({ width: s * 1 * SC, color: this.SKIN_DK, alpha: 0.5 });
        g.moveTo(bx * s, by * s);
        g.lineTo(midX * s, midY * s);
        g.stroke({ width: s * 0.8 * SC, color: this.SKIN_DK, alpha: 0.4 });
      }
    }});

    // Tail
    calls.push({ depth: 8, draw: (g, s) => {
      const crotch = j.crotch;
      const sway = walkPhase !== 0 ? Math.sin(walkPhase * 2) * 2.5 : 0;
      const tailEndX = crotch.x - iso.x * 12 * SC + sway;
      const tailEndY = crotch.y + 3;
      g.moveTo(crotch.x * s, crotch.y * s);
      g.quadraticCurveTo((crotch.x - iso.x * 6 * SC + sway * 0.5) * s, (crotch.y + 6) * s, tailEndX * s, tailEndY * s);
      g.stroke({ width: s * 1.5 * SC, color: this.SKIN_DK });

      // Flaming tail tip
      const tdx = tailEndX - crotch.x;
      const tlen = Math.sqrt(tdx * tdx + 9) || 1;
      g.circle(tailEndX * s, tailEndY * s, 2 * SC * s);
      g.fill({ color: this.FIRE, alpha: 0.6 });
      g.circle(tailEndX * s, tailEndY * s, 1.2 * SC * s);
      g.fill({ color: this.EYE, alpha: 0.7 });
    }});

    // Legs
    calls.push({ depth: 10, draw: (g, s) => this.drawLeg(g, j, skeleton, s, farSide, SC) });
    calls.push({ depth: 12, draw: (g, s) => this.drawLeg(g, j, skeleton, s, nearSide, SC) });

    // Far arm
    calls.push({ depth: facingCamera ? 20 : 45, draw: (g, s) => this.drawArm(g, j, s, farSide, SC) });

    // Torso
    calls.push({ depth: 30, draw: (g, s) => {
      const neckBase = j.neckBase;
      const W = 0.85;
      g.moveTo(neckBase.x * s, neckBase.y * s);
      g.quadraticCurveTo((j.chestR.x * W) * s, j.chestR.y * s, (j.chestR.x * W) * s, (j.chestR.y + 2) * s);
      g.lineTo((j.hipR.x * W) * s, j.hipR.y * s);
      g.lineTo((j.hipL.x * W) * s, j.hipL.y * s);
      g.lineTo((j.chestL.x * W) * s, (j.chestL.y + 2) * s);
      g.quadraticCurveTo((j.chestL.x * W) * s, j.chestL.y * s, neckBase.x * s, neckBase.y * s);
      g.closePath();
      g.fill(this.SKIN);
      g.roundRect((neckBase.x - 1.5) * s, (neckBase.y - 2) * s, 3 * s, 3 * s, 1 * s);
      g.fill(this.SKIN);
    }});

    // Head with crown of horns
    calls.push({ depth: 50, draw: (g, s) => this.drawHead(g, j, skeleton, s, SC) });

    // Near arm
    calls.push({ depth: facingCamera ? 59 : 24, draw: (g, s) => this.drawArm(g, j, s, nearSide, SC) });

    return calls;
  }

  getAttachmentPoints(skeleton: Skeleton): Record<string, AttachmentPoint> {
    return { "hand-R": skeleton.attachments["hand-R"], "hand-L": skeleton.attachments["hand-L"] };
  }

  private drawLeg(g: Graphics, j: Record<string, V>, sk: Skeleton, s: number, side: "L" | "R", SC: number): void {
    const hip = j[`hip${side}`];
    const knee = j[`knee${side}`];
    const ankle = j[`ankle${side}`];
    drawTaperedLimb(g, { x: hip.x * 0.4, y: hip.y }, knee, 4 * SC, 3 * SC, this.SKIN, this.SKIN_DK, darken(this.SKIN, 0.3), s);
    drawTaperedLimb(g, knee, ankle, 3 * SC, 2.5 * SC, this.SKIN, this.SKIN_DK, darken(this.SKIN, 0.3), s);
  }

  private drawArm(g: Graphics, j: Record<string, V>, s: number, side: "L" | "R", SC: number): void {
    const shoulder = j[`shoulder${side}`];
    const elbow = j[`elbow${side}`];
    const wrist = j[`wrist${side}`];
    drawTaperedLimb(g, shoulder, elbow, 3 * SC, 2.5 * SC, this.SKIN, this.SKIN_DK, darken(this.SKIN, 0.3), s);
    drawTaperedLimb(g, elbow, wrist, 2.5 * SC, 2 * SC, this.SKIN, this.SKIN_DK, darken(this.SKIN, 0.3), s);
    g.circle(wrist.x * s, wrist.y * s, 2 * SC * s);
    g.fill(this.SKIN);
  }

  private drawHead(g: Graphics, j: Record<string, V>, sk: Skeleton, s: number, SC: number): void {
    const head = j.head;
    const { wf, iso } = sk;
    const faceCam = iso.y > 0;
    const r = 7 * SC;

    // Crown of horns (4 horns in a ring)
    for (let i = 0; i < 4; i++) {
      const angle = (i / 4) * Math.PI * 2 - Math.PI * 0.25;
      const baseX = head.x + Math.cos(angle) * r * 0.5 * wf;
      const baseY = head.y - r + 1 + Math.sin(angle) * 2;
      const tipX = baseX + Math.cos(angle) * 5 * SC;
      const tipY = baseY - 6 * SC;

      g.moveTo(baseX * s, baseY * s);
      g.quadraticCurveTo((baseX + Math.cos(angle) * 3 * SC) * s, (baseY - 2) * s, tipX * s, tipY * s);
      g.quadraticCurveTo((baseX + Math.cos(angle) * 1.5 * SC) * s, (baseY - 3) * s, (baseX - Math.cos(angle) * 0.5) * s, baseY * s);
      g.closePath();
      g.fill(this.HORN);
    }

    // Head
    g.ellipse(head.x * s, head.y * s, r * wf * 0.7 * s, (r - 0.5) * 0.7 * s);
    g.fill(this.SKIN);
    g.ellipse(head.x * s, head.y * s, r * wf * 0.7 * s, (r - 0.5) * 0.7 * s);
    g.stroke({ width: s * 0.5, color: this.SKIN_DK, alpha: 0.4 });

    // Glowing eyes
    if (faceCam || Math.abs(iso.x) > 0.3) {
      const spread = 2.5 * wf;
      const eyeY = head.y + 0.5 + iso.y * 0.6;
      const eyeOX = head.x + iso.x * 0.6;

      g.ellipse((eyeOX - spread) * s, eyeY * s, 2.2 * s, 1.7 * s);
      g.fill(this.EYE);
      g.ellipse((eyeOX + spread) * s, eyeY * s, 2.2 * s, 1.7 * s);
      g.fill(this.EYE);
      g.ellipse((eyeOX - spread) * s, eyeY * s, 0.6 * s, 1.4 * s);
      g.fill(0x111111);
      g.ellipse((eyeOX + spread) * s, eyeY * s, 0.6 * s, 1.4 * s);
      g.fill(0x111111);

      // Fire glow around eyes
      g.ellipse((eyeOX - spread) * s, eyeY * s, 3 * s, 2.5 * s);
      g.fill({ color: this.FIRE, alpha: 0.1 });
      g.ellipse((eyeOX + spread) * s, eyeY * s, 3 * s, 2.5 * s);
      g.fill({ color: this.FIRE, alpha: 0.1 });
    }
  }
}
