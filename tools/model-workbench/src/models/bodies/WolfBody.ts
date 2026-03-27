import type { Graphics } from "pixi.js";
import type {
  Model,
  RenderContext,
  DrawCall,
  AttachmentPoint,
  V,
} from "../types";
import { darken, lighten } from "../palette";

/**
 * Wolf NPC — four-legged predator.
 * Sleek body, pointed ears, snout, bushy tail.
 * CANNOT hold weapons — no attachment slots.
 *
 * Like rabbit, uses humanoid skeleton for walk animation timing
 * but renders an entirely different quadruped shape.
 * Walk cycle drives a trotting gait.
 */
export class WolfBody implements Model {
  readonly id = "wolf-body";
  readonly name = "Wolf";
  readonly category = "npc" as const;
  readonly slot = "root" as const;

  private readonly FUR = 0x707880;     // grey
  private readonly FUR_DK = 0x505860;  // dark grey
  private readonly FUR_LT = 0x909aa0;  // light grey
  private readonly BELLY = 0xa0a8b0;   // lighter underbelly
  private readonly NOSE = 0x222222;
  private readonly EYE = 0xddaa33;     // amber

  getDrawCalls(ctx: RenderContext): DrawCall[] {
    const { skeleton } = ctx;
    const { iso, bob, walkPhase, wf } = skeleton;
    const faceCam = iso.y > 0;
    const sideView = Math.abs(iso.x) > 0.3;

    // Quadruped gait
    const trot = walkPhase !== 0 ? Math.sin(walkPhase) : 0;
    const bodyBob = walkPhase !== 0 ? Math.abs(Math.sin(walkPhase * 2)) * 1.5 : 0;

    const bodyX = iso.x * 2;
    const bodyY = -10 + bob - bodyBob;
    const headX = bodyX + iso.x * 10 + iso.y * 2;
    const headY = bodyY - 4;

    const calls: DrawCall[] = [];

    // Shadow
    calls.push({
      depth: 0,
      draw: (g, s) => {
        g.ellipse(bodyX * s, 2 * s, 12 * s, 4 * s);
        g.fill({ color: 0x000000, alpha: 0.15 });
      },
    });

    // Tail (behind body)
    calls.push({
      depth: 3,
      draw: (g, s) => this.drawTail(g, bodyX, bodyY, iso, walkPhase, wf, s),
    });

    // Back legs
    calls.push({
      depth: 6,
      draw: (g, s) => this.drawBackLegs(g, bodyX, bodyY, iso, trot, wf, s),
    });

    // Body
    calls.push({
      depth: 20,
      draw: (g, s) => {
        // Long wolf body (horizontal oval)
        g.ellipse(bodyX * s, bodyY * s, 12 * wf * s, 7 * s);
        g.fill(this.FUR);

        // Underbelly
        if (faceCam) {
          g.ellipse(bodyX * s, (bodyY + 3) * s, 8 * wf * s, 4 * s);
          g.fill({ color: this.BELLY, alpha: 0.4 });
        }

        // Shoulder hump
        g.ellipse((bodyX + iso.x * 3) * s, (bodyY - 2) * s, 5 * wf * s, 4 * s);
        g.fill({ color: this.FUR_DK, alpha: 0.15 });

        // Outline
        g.ellipse(bodyX * s, bodyY * s, 12 * wf * s, 7 * s);
        g.stroke({ width: s * 0.5, color: this.FUR_DK, alpha: 0.35 });
      },
    });

    // Front legs
    calls.push({
      depth: 25,
      draw: (g, s) => this.drawFrontLegs(g, bodyX, bodyY, iso, trot, wf, s),
    });

    // Neck + Head
    calls.push({
      depth: 40,
      draw: (g, s) => {
        // Thick neck
        const neckMidX = (bodyX + headX) / 2 + iso.x * 2;
        const neckMidY = (bodyY + headY) / 2 - 1;
        g.moveTo((bodyX + iso.x * 6) * s, (bodyY - 4) * s);
        g.quadraticCurveTo(neckMidX * s, (neckMidY - 2) * s, headX * s, (headY + 2) * s);
        g.quadraticCurveTo(neckMidX * s, (neckMidY + 3) * s, (bodyX + iso.x * 6) * s, (bodyY + 1) * s);
        g.closePath();
        g.fill(this.FUR);

        // Mane/ruff
        g.ellipse(neckMidX * s, (neckMidY - 1) * s, 4 * wf * s, 3.5 * s);
        g.fill({ color: this.FUR_LT, alpha: 0.2 });

        // Head (elongated for snout)
        const headW = 6 * wf;
        const headH = 5;
        g.ellipse(headX * s, headY * s, headW * s, headH * s);
        g.fill(this.FUR);

        // Snout extension
        const snoutX = headX + iso.x * 5 + iso.y * 1;
        const snoutY = headY + 1.5;
        g.ellipse(snoutX * s, snoutY * s, 3.5 * wf * s, 2.5 * s);
        g.fill(this.FUR);
        g.ellipse(snoutX * s, snoutY * s, 3.5 * wf * s, 2.5 * s);
        g.stroke({ width: s * 0.4, color: this.FUR_DK, alpha: 0.3 });

        // Head outline
        g.ellipse(headX * s, headY * s, headW * s, headH * s);
        g.stroke({ width: s * 0.5, color: this.FUR_DK, alpha: 0.35 });

        // Ears (pointed, on top)
        this.drawEars(g, headX, headY, iso, wf, s);

        // Eyes
        if (faceCam || (sideView && iso.y >= -0.1)) {
          const spread = 2.5 * wf;
          const eyeY = headY - 0.5 + iso.y * 0.4;
          const eyeOX = headX + iso.x * 1.5;

          g.ellipse((eyeOX - spread) * s, eyeY * s, 1.5 * s, 1.2 * s);
          g.fill(this.EYE);
          g.ellipse((eyeOX + spread) * s, eyeY * s, 1.5 * s, 1.2 * s);
          g.fill(this.EYE);

          g.circle((eyeOX - spread + iso.x * 0.3) * s, eyeY * s, 0.6 * s);
          g.fill(0x111111);
          g.circle((eyeOX + spread + iso.x * 0.3) * s, eyeY * s, 0.6 * s);
          g.fill(0x111111);
        }

        // Nose
        if (faceCam || sideView) {
          const noseX = snoutX + iso.x * 2;
          const noseY = snoutY - 0.5;
          g.ellipse(noseX * s, noseY * s, 1.2 * wf * s, 0.8 * s);
          g.fill(this.NOSE);
        }

        // Mouth line
        if (faceCam) {
          g.moveTo((snoutX - 1.5 * wf) * s, (snoutY + 1) * s);
          g.lineTo(snoutX * s, (snoutY + 1.5) * s);
          g.lineTo((snoutX + 1.5 * wf) * s, (snoutY + 1) * s);
          g.stroke({ width: s * 0.4, color: this.FUR_DK, alpha: 0.3 });
        }
      },
    });

    return calls;
  }

  getAttachmentPoints(): Record<string, AttachmentPoint> {
    return {};
  }

  // ─── EARS ────────────────────────────────────────────────────────

  private drawEars(g: Graphics, headX: number, headY: number, iso: V, wf: number, s: number): void {
    for (const side of [-1, 1]) {
      const earX = headX + side * 3 * wf + iso.x * 1;
      const earBaseY = headY - 4;
      const earTipY = earBaseY - 4;

      g.poly([
        (earX - 1.2) * s, earBaseY * s,
        (earX + side * 0.5) * s, earTipY * s,
        (earX + 1.2) * s, earBaseY * s,
      ]);
      g.fill(this.FUR);
      g.poly([
        (earX - 1.2) * s, earBaseY * s,
        (earX + side * 0.5) * s, earTipY * s,
        (earX + 1.2) * s, earBaseY * s,
      ]);
      g.stroke({ width: s * 0.4, color: this.FUR_DK, alpha: 0.3 });

      // Inner ear
      g.poly([
        (earX - 0.6) * s, (earBaseY + 0.3) * s,
        (earX + side * 0.3) * s, (earTipY + 1.5) * s,
        (earX + 0.6) * s, (earBaseY + 0.3) * s,
      ]);
      g.fill(darken(this.FUR, 0.1));
    }
  }

  // ─── FRONT LEGS ──────────────────────────────────────────────────

  private drawFrontLegs(g: Graphics, bodyX: number, bodyY: number, iso: V, trot: number, wf: number, s: number): void {
    for (const side of [-1, 1]) {
      const legX = bodyX + side * 4.5 * wf + iso.x * 5;
      const shoulderY = bodyY + 2;
      const stride = trot * side * 3;

      // Upper leg
      const kneeX = legX + iso.x * stride * 0.3;
      const kneeY = shoulderY + 6;
      g.moveTo(legX * s, shoulderY * s);
      g.lineTo(kneeX * s, kneeY * s);
      g.stroke({ width: s * 3, color: this.FUR });
      g.moveTo(legX * s, shoulderY * s);
      g.lineTo(kneeX * s, kneeY * s);
      g.stroke({ width: s * 0.6, color: this.FUR_DK, alpha: 0.2 });

      // Lower leg
      const pawX = kneeX + iso.x * stride * 0.5;
      const pawY = kneeY + 5 - Math.abs(trot * side) * 1;
      g.moveTo(kneeX * s, kneeY * s);
      g.lineTo(pawX * s, pawY * s);
      g.stroke({ width: s * 2.5, color: this.FUR });

      // Paw
      g.ellipse(pawX * s, (pawY + 0.5) * s, 2 * s, 1 * s);
      g.fill(this.FUR_DK);
    }
  }

  // ─── BACK LEGS ───────────────────────────────────────────────────

  private drawBackLegs(g: Graphics, bodyX: number, bodyY: number, iso: V, trot: number, wf: number, s: number): void {
    for (const side of [-1, 1]) {
      const legX = bodyX + side * 4.5 * wf - iso.x * 5;
      const hipY = bodyY + 3;
      const stride = -trot * side * 3;

      // Haunch
      g.ellipse((legX + side * 1.5 * wf) * s, (hipY + 1) * s, 4 * wf * s, 4.5 * s);
      g.fill(this.FUR);

      // Upper back leg
      const kneeX = legX + iso.x * stride * 0.3;
      const kneeY = hipY + 6;
      g.moveTo(legX * s, (hipY + 3) * s);
      g.lineTo(kneeX * s, kneeY * s);
      g.stroke({ width: s * 3.5, color: this.FUR });

      // Hock joint
      const hockX = kneeX - iso.x * 1;
      const hockY = kneeY + 3;
      g.moveTo(kneeX * s, kneeY * s);
      g.lineTo(hockX * s, hockY * s);
      g.stroke({ width: s * 2.5, color: this.FUR });

      // Lower leg + paw
      const pawX = hockX + iso.x * stride * 0.3;
      const pawY = hockY + 3 - Math.abs(trot * side) * 1.5;
      g.moveTo(hockX * s, hockY * s);
      g.lineTo(pawX * s, pawY * s);
      g.stroke({ width: s * 2, color: this.FUR });

      g.ellipse(pawX * s, (pawY + 0.5) * s, 2.2 * s, 1.2 * s);
      g.fill(this.FUR_DK);
    }
  }

  // ─── TAIL ────────────────────────────────────────────────────────

  private drawTail(g: Graphics, bodyX: number, bodyY: number, iso: V, walkPhase: number, wf: number, s: number): void {
    const sway = walkPhase !== 0 ? Math.sin(walkPhase * 1.5) * 2 : 0;

    const tailBaseX = bodyX - iso.x * 10;
    const tailBaseY = bodyY - 2;
    const tailMidX = tailBaseX - iso.x * 5 + sway;
    const tailMidY = tailBaseY - 5;
    const tailTipX = tailBaseX - iso.x * 3 + sway * 1.5;
    const tailTipY = tailBaseY - 9;

    // Bushy tail (thicker shape)
    g.moveTo(tailBaseX * s, (tailBaseY - 2) * s);
    g.quadraticCurveTo(
      (tailMidX - 2) * s, (tailMidY - 1) * s,
      tailTipX * s, tailTipY * s
    );
    g.quadraticCurveTo(
      (tailTipX + 1) * s, (tailTipY + 1) * s,
      (tailTipX + 2) * s, (tailTipY + 0.5) * s
    );
    g.quadraticCurveTo(
      (tailMidX + 2) * s, (tailMidY + 2) * s,
      tailBaseX * s, (tailBaseY + 1) * s
    );
    g.closePath();
    g.fill(this.FUR);

    // Tail tip highlight
    g.ellipse(tailTipX * s, tailTipY * s, 2 * s, 1.5 * s);
    g.fill({ color: this.FUR_LT, alpha: 0.3 });

    // Outline
    g.moveTo(tailBaseX * s, (tailBaseY - 2) * s);
    g.quadraticCurveTo(
      (tailMidX - 2) * s, (tailMidY - 1) * s,
      tailTipX * s, tailTipY * s
    );
    g.quadraticCurveTo(
      (tailTipX + 1) * s, (tailTipY + 1) * s,
      (tailTipX + 2) * s, (tailTipY + 0.5) * s
    );
    g.quadraticCurveTo(
      (tailMidX + 2) * s, (tailMidY + 2) * s,
      tailBaseX * s, (tailBaseY + 1) * s
    );
    g.closePath();
    g.stroke({ width: s * 0.4, color: this.FUR_DK, alpha: 0.3 });
  }
}
