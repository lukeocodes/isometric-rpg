import type { Graphics } from "pixi.js";
import type { Model, RenderContext, DrawCall, AttachmentPoint } from "../types";
import { darken, lighten } from "../palette";

/**
 * Crown — golden royal crown with gemstones.
 */
export class Crown implements Model {
  readonly id = "crown";
  readonly name = "Crown";
  readonly category = "headgear" as const;
  readonly slot = "head-top" as const;

  private readonly GOLD = 0xccaa44;
  private readonly GOLD_DK = 0x997722;
  private readonly GOLD_LT = 0xeedd66;
  private readonly GEM_RED = 0xcc2222;
  private readonly GEM_BLUE = 0x2244cc;

  getDrawCalls(ctx: RenderContext): DrawCall[] {
    const { skeleton, facingCamera } = ctx;
    const head = skeleton.joints.head;
    const wf = skeleton.wf;
    const iso = skeleton.iso;
    const r = 7 * (ctx.slotParams.size);

    return [
      {
        depth: 58,
        draw: (g: Graphics, s: number) => {
          const cx = head.x;
          const bandY = head.y - r * 0.4;
          const bandW = r * wf;
          const bandH = 2.5;
          const points = 5;

          // Crown band
          g.roundRect(
            (cx - bandW) * s,
            (bandY - bandH / 2) * s,
            bandW * 2 * s,
            bandH * s,
            0.5 * s
          );
          g.fill(this.GOLD);
          g.roundRect(
            (cx - bandW) * s,
            (bandY - bandH / 2) * s,
            bandW * 2 * s,
            bandH * s,
            0.5 * s
          );
          g.stroke({ width: s * 0.5, color: this.GOLD_DK, alpha: 0.5 });

          // Crown points (tines)
          if (facingCamera || Math.abs(iso.x) > 0.2) {
            for (let i = 0; i < points; i++) {
              const t = (i + 0.5) / points;
              const px = cx - bandW + bandW * 2 * t;
              const tipY = bandY - bandH / 2 - 3 - Math.sin(t * Math.PI) * 1.5;

              g.poly([
                (px - 0.8) * s, (bandY - bandH / 2) * s,
                px * s, tipY * s,
                (px + 0.8) * s, (bandY - bandH / 2) * s,
              ]);
              g.fill(this.GOLD);
              g.poly([
                (px - 0.8) * s, (bandY - bandH / 2) * s,
                px * s, tipY * s,
                (px + 0.8) * s, (bandY - bandH / 2) * s,
              ]);
              g.stroke({ width: s * 0.3, color: this.GOLD_DK, alpha: 0.4 });

              // Ball on tip
              g.circle(px * s, tipY * s, 0.6 * s);
              g.fill(this.GOLD_LT);
            }
          }

          // Gemstones on band
          const gemColors = [this.GEM_BLUE, this.GEM_RED, this.GEM_BLUE];
          for (let i = 0; i < 3; i++) {
            const gx = cx + (i - 1) * bandW * 0.6;
            g.roundRect((gx - 0.8) * s, (bandY - 0.8) * s, 1.6 * s, 1.6 * s, 0.3 * s);
            g.fill(gemColors[i]);
            g.roundRect((gx - 0.8) * s, (bandY - 0.8) * s, 1.6 * s, 1.6 * s, 0.3 * s);
            g.stroke({ width: s * 0.3, color: darken(gemColors[i], 0.3), alpha: 0.5 });
            // Gem highlight
            g.circle((gx - 0.2) * s, (bandY - 0.2) * s, 0.3 * s);
            g.fill({ color: 0xffffff, alpha: 0.4 });
          }

          // Band highlight line
          g.moveTo((cx - bandW + 0.5) * s, (bandY - bandH / 2 + 0.5) * s);
          g.lineTo((cx + bandW - 0.5) * s, (bandY - bandH / 2 + 0.5) * s);
          g.stroke({ width: s * 0.4, color: this.GOLD_LT, alpha: 0.3 });
        },
      },
    ];
  }

  getAttachmentPoints(): Record<string, AttachmentPoint> { return {}; }
}
