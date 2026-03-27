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
 * King Rabbit — boss variant of Rabbit.
 * Larger, golden-white fur, tiny crown, regal bearing.
 * Uses the same rendering approach as RabbitBody but with
 * boss-specific colors and a crown decoration.
 */
export class KingRabbit implements Model {
  readonly id = "king-rabbit";
  readonly name = "King Rabbit";
  readonly category = "npc" as const;
  readonly slot = "root" as const;

  private readonly FUR = 0xe8dcc8;     // golden-white
  private readonly FUR_DK = 0xc8b8a0;
  private readonly FUR_LT = 0xf8f0e0;
  private readonly BELLY = 0xfff8ee;
  private readonly EAR_INNER = 0xeeb8b8;
  private readonly NOSE = 0xddaaaa;
  private readonly CROWN = 0xccaa44;
  private readonly GEM = 0xcc2222;

  getDrawCalls(ctx: RenderContext): DrawCall[] {
    const { skeleton } = ctx;
    const { iso, bob, walkPhase, wf } = skeleton;
    const faceCam = iso.y > 0;
    const sideView = Math.abs(iso.x) > 0.3;

    const hop = walkPhase !== 0 ? Math.abs(Math.sin(walkPhase * 2)) * 3 : 0;
    const lean = walkPhase !== 0 ? Math.sin(walkPhase) * 0.8 : 0;

    // Boss is 1.4x scale
    const SC = 1.4;
    const bodyX = iso.x * 1.5 + lean;
    const bodyY = -8 * SC + bob - hop;
    const headX = bodyX + iso.x * 1;
    const headY = bodyY - 10 * SC;

    const calls: DrawCall[] = [];

    // Boss aura
    calls.push({
      depth: -1,
      draw: (g, s) => {
        g.ellipse(bodyX * s, (bodyY - 2) * s, 14 * SC * s, 12 * SC * s);
        g.fill({ color: 0xffee88, alpha: 0.04 });
      },
    });

    // Shadow (larger)
    calls.push({
      depth: 0,
      draw: (g, s) => {
        g.ellipse(bodyX * s, 2 * s, 10 * SC * s, 4 * SC * s);
        g.fill({ color: 0x000000, alpha: 0.15 });
      },
    });

    // Tail
    if (!faceCam || sideView) {
      calls.push({
        depth: 5,
        draw: (g, s) => {
          const tailX = bodyX - iso.x * 6 * SC;
          const tailY = bodyY + 4 * SC;
          g.circle(tailX * s, tailY * s, 3 * SC * s);
          g.fill(this.FUR_LT);
        },
      });
    }

    // Back legs
    calls.push({ depth: 8, draw: (g, s) => this.drawLegs(g, bodyX, bodyY, iso, walkPhase, wf, SC, s, false) });

    // Body
    calls.push({
      depth: 20,
      draw: (g, s) => {
        g.ellipse(bodyX * s, bodyY * s, 8 * wf * SC * s, 10 * SC * s);
        g.fill(this.FUR);
        if (faceCam) {
          g.ellipse(bodyX * s, (bodyY + 2 * SC) * s, 5 * wf * SC * s, 6 * SC * s);
          g.fill({ color: this.BELLY, alpha: 0.5 });
        }
        g.ellipse(bodyX * s, bodyY * s, 8 * wf * SC * s, 10 * SC * s);
        g.stroke({ width: s * 0.5, color: this.FUR_DK, alpha: 0.3 });
      },
    });

    // Front legs
    calls.push({ depth: 25, draw: (g, s) => this.drawLegs(g, bodyX, bodyY, iso, walkPhase, wf, SC, s, true) });

    // Ears
    calls.push({
      depth: faceCam ? 55 : 35,
      draw: (g, s) => this.drawEars(g, headX, headY, iso, wf, walkPhase, SC, s),
    });

    // Head
    calls.push({
      depth: 40,
      draw: (g, s) => {
        const r = 6 * SC;
        g.ellipse(headX * s, headY * s, r * wf * s, (r + 0.5 * SC) * s);
        g.fill(this.FUR);
        if (faceCam) {
          g.ellipse((headX - 2 * wf * SC) * s, (headY + 1.5 * SC) * s, 2.5 * wf * SC * s, 2 * SC * s);
          g.fill(this.FUR_LT);
          g.ellipse((headX + 2 * wf * SC) * s, (headY + 1.5 * SC) * s, 2.5 * wf * SC * s, 2 * SC * s);
          g.fill(this.FUR_LT);
        }
        g.ellipse(headX * s, headY * s, r * wf * s, (r + 0.5 * SC) * s);
        g.stroke({ width: s * 0.5, color: this.FUR_DK, alpha: 0.3 });

        // Eyes
        if (faceCam || (sideView && iso.y >= -0.1)) {
          const spread = 2.5 * wf * SC;
          const eyeY = headY - 0.5 * SC + iso.y * 0.5;
          const eyeOX = headX + iso.x * 0.5;
          g.circle((eyeOX - spread) * s, eyeY * s, 2 * SC * s);
          g.fill(0x111111);
          g.circle((eyeOX + spread) * s, eyeY * s, 2 * SC * s);
          g.fill(0x111111);
          g.circle((eyeOX - spread + 0.5) * s, (eyeY - 0.5) * s, 0.7 * SC * s);
          g.fill(0xffffff);
          g.circle((eyeOX + spread + 0.5) * s, (eyeY - 0.5) * s, 0.7 * SC * s);
          g.fill(0xffffff);

          if (faceCam) {
            const noseY = headY + 2 * SC + iso.y * 0.3;
            g.poly([
              (headX - 1 * SC) * s, noseY * s,
              headX * s, (noseY + 1.2 * SC) * s,
              (headX + 1 * SC) * s, noseY * s,
            ]);
            g.fill(this.NOSE);
          }
        }
      },
    });

    // Crown on head
    calls.push({
      depth: 56,
      draw: (g, s) => {
        const crownY = headY - 6 * SC;
        const crownW = 3.5 * wf * SC;
        const crownH = 2.5 * SC;

        // Band
        g.roundRect((headX - crownW) * s, (crownY - crownH / 2) * s, crownW * 2 * s, crownH * s, 0.5 * s);
        g.fill(this.CROWN);
        g.roundRect((headX - crownW) * s, (crownY - crownH / 2) * s, crownW * 2 * s, crownH * s, 0.5 * s);
        g.stroke({ width: s * 0.4, color: darken(this.CROWN, 0.2), alpha: 0.5 });

        // 3 points
        for (let i = 0; i < 3; i++) {
          const px = headX + (i - 1) * crownW * 0.65;
          const tipY = crownY - crownH / 2 - 2 * SC;
          g.poly([
            (px - 0.6 * SC) * s, (crownY - crownH / 2) * s,
            px * s, tipY * s,
            (px + 0.6 * SC) * s, (crownY - crownH / 2) * s,
          ]);
          g.fill(this.CROWN);
          g.circle(px * s, tipY * s, 0.4 * SC * s);
          g.fill(lighten(this.CROWN, 0.2));
        }

        // Center gem
        g.circle(headX * s, crownY * s, 0.8 * SC * s);
        g.fill(this.GEM);
      },
    });

    return calls;
  }

  getAttachmentPoints(): Record<string, AttachmentPoint> { return {}; }

  private drawEars(g: Graphics, headX: number, headY: number, iso: V, wf: number, walkPhase: number, SC: number, s: number): void {
    const earW = 2.2 * SC;
    const earH = 10 * SC;
    const earSway = walkPhase !== 0 ? Math.sin(walkPhase * 1.5) * 0.5 : 0;

    for (const side of [-1, 1]) {
      const earX = headX + side * 3 * wf * SC;
      const earBaseY = headY - 5 * SC;
      const earTipY = earBaseY - earH;
      const sway = side * earSway;

      g.moveTo(earX * s, earBaseY * s);
      g.quadraticCurveTo((earX + side * earW + sway) * s, (earBaseY - earH * 0.5) * s, (earX + sway * 1.5) * s, earTipY * s);
      g.quadraticCurveTo((earX - side * earW + sway) * s, (earBaseY - earH * 0.5) * s, earX * s, earBaseY * s);
      g.closePath();
      g.fill(this.FUR);

      g.moveTo(earX * s, (earBaseY + 0.5) * s);
      g.quadraticCurveTo((earX + side * (earW - 0.5) + sway) * s, (earBaseY - earH * 0.45) * s, (earX + sway * 1.3) * s, (earTipY + 1.5 * SC) * s);
      g.quadraticCurveTo((earX - side * (earW - 0.5) + sway) * s, (earBaseY - earH * 0.45) * s, earX * s, (earBaseY + 0.5) * s);
      g.closePath();
      g.fill(this.EAR_INNER);
    }
  }

  private drawLegs(g: Graphics, bodyX: number, bodyY: number, iso: V, walkPhase: number, wf: number, SC: number, s: number, front: boolean): void {
    const hop = walkPhase !== 0 ? Math.sin(walkPhase * 2) : 0;
    const phase = walkPhase !== 0 ? Math.sin(walkPhase) : 0;

    for (const side of [-1, 1]) {
      if (front) {
        const legX = bodyX + side * 4 * wf * SC + iso.x * 2 * SC;
        const topY = bodyY + 5 * SC;
        const pawX = legX + phase * side * 1.5 * SC;
        const pawY = topY + 4 * SC - Math.abs(hop) * 0.5;
        g.moveTo(legX * s, topY * s);
        g.quadraticCurveTo((legX + side * 0.5) * s, ((topY + pawY) / 2) * s, pawX * s, pawY * s);
        g.stroke({ width: s * 3 * SC, color: this.FUR });
        g.ellipse(pawX * s, (pawY + 0.5) * s, 2 * SC * s, 1.2 * SC * s);
        g.fill(this.FUR_DK);
      } else {
        const legX = bodyX + side * 3 * wf * SC - iso.x * 1.5 * SC;
        const haunchY = bodyY + 2 * SC;
        g.ellipse((legX + side * 2 * wf * SC) * s, (haunchY + 3 * SC) * s, 4 * wf * SC * s, 5 * SC * s);
        g.fill(this.FUR);
        const footX = legX + side * 1 * wf * SC - phase * side * 2 * SC;
        const footY = haunchY + 9 * SC - Math.abs(hop) * 1;
        g.moveTo((legX + side * 2 * wf * SC) * s, (haunchY + 6 * SC) * s);
        g.lineTo(footX * s, footY * s);
        g.stroke({ width: s * 2.5 * SC, color: this.FUR });
        g.ellipse((footX + iso.x * 1) * s, (footY + 0.5) * s, 3 * SC * s, 1.2 * SC * s);
        g.fill(this.FUR_DK);
      }
    }
  }
}
