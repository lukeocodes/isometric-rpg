import type { Graphics } from "pixi.js";
import type {
  Model,
  RenderContext,
  DrawCall,
  Skeleton,
  AttachmentPoint,
  V,
} from "../types";
import { darken, lighten } from "../palette";

/**
 * Rabbit NPC body — small, non-humanoid wildlife creature.
 * Oval body, round head, tall ears, stubby legs, cotton tail.
 * CANNOT hold weapons — no attachment slots.
 *
 * Reference from game client:
 * - Body: ellipse 10x12, tan/brown (0xc0a080)
 * - Head: circle r=7
 * - Ears: 2.5x8, inner pink (0xddaaaa)
 *
 * This model uses the humanoid skeleton for walk animation
 * but renders a completely different shape. The walk cycle
 * drives a hopping motion instead of bipedal stride.
 */
export class RabbitBody implements Model {
  readonly id = "rabbit-body";
  readonly name = "Rabbit";
  readonly category = "npc" as const;
  readonly slot = "root" as const;

  private readonly FUR = 0xc0a080;
  private readonly FUR_DK = 0x9a8060;
  private readonly FUR_LT = 0xdac0a0;
  private readonly BELLY = 0xe0d0b8;
  private readonly EAR_INNER = 0xddaaaa;
  private readonly NOSE = 0xdd9999;

  getDrawCalls(ctx: RenderContext): DrawCall[] {
    const { skeleton } = ctx;
    const { iso, bob, walkPhase, wf } = skeleton;
    const faceCam = iso.y > 0;
    const sideView = Math.abs(iso.x) > 0.3;

    // Compute rabbit-specific positions from skeleton
    // Use a hop instead of bipedal walk
    const hop = walkPhase !== 0 ? Math.abs(Math.sin(walkPhase * 2)) * 3 : 0;
    const lean = walkPhase !== 0 ? Math.sin(walkPhase) * 0.8 : 0;

    const bodyX = iso.x * 1.5 + lean;
    const bodyY = -8 + bob - hop;
    const headX = bodyX + iso.x * 1;
    const headY = bodyY - 10;

    const calls: DrawCall[] = [];

    // Shadow
    calls.push({
      depth: 0,
      draw: (g, s) => {
        g.ellipse(bodyX * s, 2 * s, 8 * s, 3.5 * s);
        g.fill({ color: 0x000000, alpha: 0.15 });
      },
    });

    // Tail (behind body, visible from back/side)
    if (!faceCam || sideView) {
      calls.push({
        depth: 5,
        draw: (g, s) => {
          const tailX = bodyX - iso.x * 6;
          const tailY = bodyY + 4;
          g.circle(tailX * s, tailY * s, 2.5 * s);
          g.fill(this.FUR_LT);
          g.circle(tailX * s, tailY * s, 2.5 * s);
          g.stroke({ width: s * 0.3, color: this.FUR_DK, alpha: 0.2 });
        },
      });
    }

    // Back legs (behind body)
    calls.push({
      depth: 8,
      draw: (g, s) => this.drawBackLegs(g, bodyX, bodyY, iso, walkPhase, wf, s),
    });

    // Body (oval)
    calls.push({
      depth: 20,
      draw: (g, s) => {
        // Main body oval
        g.ellipse(bodyX * s, bodyY * s, 8 * wf * s, 10 * s);
        g.fill(this.FUR);

        // Belly highlight
        if (faceCam) {
          g.ellipse(bodyX * s, (bodyY + 2) * s, 5 * wf * s, 6 * s);
          g.fill({ color: this.BELLY, alpha: 0.5 });
        }

        // Body outline
        g.ellipse(bodyX * s, bodyY * s, 8 * wf * s, 10 * s);
        g.stroke({ width: s * 0.5, color: this.FUR_DK, alpha: 0.35 });
      },
    });

    // Front legs
    calls.push({
      depth: 25,
      draw: (g, s) => this.drawFrontLegs(g, bodyX, bodyY, iso, walkPhase, wf, s),
    });

    // Ears (behind head when facing away)
    if (!faceCam) {
      calls.push({
        depth: 35,
        draw: (g, s) => this.drawEars(g, headX, headY, iso, wf, walkPhase, s),
      });
    }

    // Head
    calls.push({
      depth: 40,
      draw: (g, s) => {
        const r = 6;

        // Head shape
        g.ellipse(headX * s, headY * s, r * wf * s, (r + 0.5) * s);
        g.fill(this.FUR);

        // Cheek puff (front view)
        if (faceCam) {
          g.ellipse((headX - 2 * wf) * s, (headY + 1.5) * s, 2.5 * wf * s, 2 * s);
          g.fill(this.FUR_LT);
          g.ellipse((headX + 2 * wf) * s, (headY + 1.5) * s, 2.5 * wf * s, 2 * s);
          g.fill(this.FUR_LT);
        }

        // Outline
        g.ellipse(headX * s, headY * s, r * wf * s, (r + 0.5) * s);
        g.stroke({ width: s * 0.5, color: this.FUR_DK, alpha: 0.35 });

        // Eyes
        if (faceCam || (sideView && iso.y >= -0.1)) {
          const spread = 2.5 * wf;
          const eyeY = headY - 0.5 + iso.y * 0.5;
          const eyeOX = headX + iso.x * 0.5;

          // Big round eyes
          g.circle((eyeOX - spread) * s, eyeY * s, 1.8 * s);
          g.fill(0x111111);
          g.circle((eyeOX + spread) * s, eyeY * s, 1.8 * s);
          g.fill(0x111111);

          // Eye highlights
          g.circle((eyeOX - spread + 0.5) * s, (eyeY - 0.5) * s, 0.6 * s);
          g.fill(0xffffff);
          g.circle((eyeOX + spread + 0.5) * s, (eyeY - 0.5) * s, 0.6 * s);
          g.fill(0xffffff);

          // Nose (small pink triangle)
          if (faceCam) {
            const noseY = headY + 2 + iso.y * 0.3;
            g.poly([
              (headX - 1) * s, noseY * s,
              headX * s, (noseY + 1.2) * s,
              (headX + 1) * s, noseY * s,
            ]);
            g.fill(this.NOSE);

            // Whiskers
            const whiskerY = noseY + 0.8;
            for (const side of [-1, 1]) {
              g.moveTo((headX + side * 1.5) * s, whiskerY * s);
              g.lineTo((headX + side * 5 * wf) * s, (whiskerY - 0.5) * s);
              g.moveTo((headX + side * 1.5) * s, (whiskerY + 0.3) * s);
              g.lineTo((headX + side * 4.5 * wf) * s, (whiskerY + 0.8) * s);
              g.stroke({ width: s * 0.3, color: this.FUR_DK, alpha: 0.35 });
            }

            // Mouth line
            g.moveTo(headX * s, (noseY + 1.2) * s);
            g.lineTo(headX * s, (noseY + 2) * s);
            g.stroke({ width: s * 0.3, color: this.FUR_DK, alpha: 0.25 });
          }
        }
      },
    });

    // Ears (in front when facing camera)
    if (faceCam) {
      calls.push({
        depth: 55,
        draw: (g, s) => this.drawEars(g, headX, headY, iso, wf, walkPhase, s),
      });
    }

    return calls;
  }

  getAttachmentPoints(): Record<string, AttachmentPoint> {
    // Rabbits cannot hold weapons or wear equipment
    return {};
  }

  // ─── EARS ────────────────────────────────────────────────────────

  private drawEars(
    g: Graphics,
    headX: number,
    headY: number,
    iso: V,
    wf: number,
    walkPhase: number,
    s: number
  ): void {
    const earW = 3.2;
    const earH = 13;
    const earSway = walkPhase !== 0 ? Math.sin(walkPhase * 1.5) * 0.5 : 0;

    for (const side of [-1, 1]) {
      const earX = headX + side * 3 * wf;
      const earBaseY = headY - 5;
      const earTipY = earBaseY - earH;
      const sway = side * earSway;

      // Outer ear
      g.moveTo(earX * s, earBaseY * s);
      g.quadraticCurveTo(
        (earX + side * earW + sway) * s,
        (earBaseY - earH * 0.5) * s,
        (earX + sway * 1.5) * s,
        earTipY * s
      );
      g.quadraticCurveTo(
        (earX - side * earW + sway) * s,
        (earBaseY - earH * 0.5) * s,
        earX * s,
        earBaseY * s
      );
      g.closePath();
      g.fill(this.FUR);

      // Inner ear (pink)
      g.moveTo(earX * s, (earBaseY + 0.5) * s);
      g.quadraticCurveTo(
        (earX + side * (earW - 0.5) + sway) * s,
        (earBaseY - earH * 0.45) * s,
        (earX + sway * 1.3) * s,
        (earTipY + 1.5) * s
      );
      g.quadraticCurveTo(
        (earX - side * (earW - 0.5) + sway) * s,
        (earBaseY - earH * 0.45) * s,
        earX * s,
        (earBaseY + 0.5) * s
      );
      g.closePath();
      g.fill(this.EAR_INNER);

      // Ear outline
      g.moveTo(earX * s, earBaseY * s);
      g.quadraticCurveTo(
        (earX + side * earW + sway) * s,
        (earBaseY - earH * 0.5) * s,
        (earX + sway * 1.5) * s,
        earTipY * s
      );
      g.quadraticCurveTo(
        (earX - side * earW + sway) * s,
        (earBaseY - earH * 0.5) * s,
        earX * s,
        earBaseY * s
      );
      g.closePath();
      g.stroke({ width: s * 0.4, color: this.FUR_DK, alpha: 0.3 });
    }
  }

  // ─── FRONT LEGS (small paws) ────────────────────────────────────

  private drawFrontLegs(
    g: Graphics,
    bodyX: number,
    bodyY: number,
    iso: V,
    walkPhase: number,
    wf: number,
    s: number
  ): void {
    const hop = walkPhase !== 0 ? Math.sin(walkPhase * 2) : 0;
    const legPhase = walkPhase !== 0 ? Math.sin(walkPhase) : 0;

    for (const side of [-1, 1]) {
      const legX = bodyX + side * 4 * wf + iso.x * 2;
      const legTopY = bodyY + 5;
      const pawX = legX + legPhase * side * 1.5;
      const pawY = legTopY + 4 - Math.abs(hop) * 0.5;

      // Small front leg
      g.moveTo(legX * s, legTopY * s);
      g.quadraticCurveTo(
        (legX + side * 0.5) * s,
        ((legTopY + pawY) / 2) * s,
        pawX * s,
        pawY * s
      );
      g.stroke({ width: s * 2.5, color: this.FUR });

      // Paw
      g.ellipse(pawX * s, (pawY + 0.5) * s, 1.8 * s, 1.2 * s);
      g.fill(this.FUR_DK);
    }
  }

  // ─── BACK LEGS (powerful haunches) ──────────────────────────────

  private drawBackLegs(
    g: Graphics,
    bodyX: number,
    bodyY: number,
    iso: V,
    walkPhase: number,
    wf: number,
    s: number
  ): void {
    const hop = walkPhase !== 0 ? Math.sin(walkPhase * 2) : 0;
    const legPhase = walkPhase !== 0 ? Math.sin(walkPhase) : 0;

    for (const side of [-1, 1]) {
      const haunchX = bodyX + side * 3 * wf - iso.x * 1.5;
      const haunchY = bodyY + 2;

      // Big haunch
      g.ellipse(
        (haunchX + side * 2 * wf) * s,
        (haunchY + 3) * s,
        4 * wf * s,
        5 * s
      );
      g.fill(this.FUR);
      g.ellipse(
        (haunchX + side * 2 * wf) * s,
        (haunchY + 3) * s,
        4 * wf * s,
        5 * s
      );
      g.stroke({ width: s * 0.3, color: this.FUR_DK, alpha: 0.2 });

      // Lower leg
      const footX = haunchX + side * 1 * wf - legPhase * side * 2;
      const footY = haunchY + 9 - Math.abs(hop) * 1;

      g.moveTo((haunchX + side * 2 * wf) * s, (haunchY + 6) * s);
      g.quadraticCurveTo(
        (footX + side * 0.5) * s,
        (haunchY + 7) * s,
        footX * s,
        footY * s
      );
      g.stroke({ width: s * 2, color: this.FUR });

      // Big back paw
      const pawLen = 3;
      g.ellipse(
        (footX + iso.x * pawLen * 0.3) * s,
        (footY + 0.5) * s,
        pawLen * s,
        1.2 * s
      );
      g.fill(this.FUR_DK);
    }
  }
}
