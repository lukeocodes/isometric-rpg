import type { Model, RenderContext, DrawCall, Skeleton, AttachmentPoint } from "../types";
import { darken, lighten } from "../palette";
import { STORY_H } from "./WallN";

/**
 * WALL_W — west wall panel. SW edge of the tile.
 *
 * Edge:  South(0, +H2) → West(−T, 0)
 * Depth: +Z world direction → screen (−DX, +DY) = (−4, +2)
 *
 * Inner face is FARTHER from the SE camera (offset goes south-west = away from viewer),
 * so depth ordering mirrors WALL_S: outer face topmost (59), inner face behind (2).
 */

const T  = 22;
const H2 = T / 2;
const DX = Math.round(0.2 * T);   // 4
const DY = Math.round(0.2 * H2);  // 2

const TRIM = 0x3a3028;

type V = { x: number; y: number };

const OA: V = { x:  0,      y:  H2     };  // outer south  ( 0, 11)
const OB: V = { x: -T,      y:  0      };  // outer west   (−22, 0)
const IA: V = { x: -DX,     y:  H2+DY  };  // inner south  (−4, 13) = OA + (−DX, +DY)
const IB: V = { x: -T-DX,   y:  DY     };  // inner west   (−26, 2) = OB + (−DX, +DY)

const lift = (p: V): V => ({ x: p.x, y: p.y - STORY_H });

export class WallW implements Model {
  readonly id         = "wall-w";
  readonly name       = "Wall W";
  readonly category   = "construction" as const;
  readonly slot       = "root" as const;
  readonly isAnimated = false;

  getDrawCalls(ctx: RenderContext): DrawCall[] {
    const { iso } = ctx.skeleton;
    const primary  = ctx.palette.primary;
    const TOP_COL  = lighten(primary, 0.15);
    const FACE_COL = primary;
    const SIDE_COL = darken(primary, 0.25);

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const tex = ctx.texture as any ?? null;

    const calls: DrawCall[] = [];

    const quad = (
      depth: number,
      color: number,
      pts: [V, V, V, V],
      detail?: (g: import("pixi.js").Graphics, s: number) => void,
    ) => {
      calls.push({
        depth,
        draw: (g, s) => {
          const flat = pts.flatMap(p => [p.x * s, p.y * s]);
          g.poly(flat);
          if (tex) {
            const xs = pts.map(p => p.x * s);
            const ys = pts.map(p => p.y * s);
            const x0 = Math.min(...xs), x1 = Math.max(...xs);
            const y0 = Math.min(...ys), y1 = Math.max(...ys);
            const { Matrix } = (globalThis as any).PIXI ?? {};
            if (Matrix) {
              const m = new Matrix().scale(x1 - x0, y1 - y0).translate(x0, y0);
              g.fill({ texture: tex, matrix: m });
            } else {
              g.fill(color);
            }
          } else {
            g.fill(color);
          }
          detail?.(g, s);
          g.poly(flat);
          g.stroke({ width: s * 0.5, color: TRIM, alpha: 0.5 });
        },
      });
    };

    // ── 1. Ground cap (buried) ────────────────────────────────────────────────
    quad(1, TOP_COL, [OA, OB, IB, IA]);

    // ── 2. Outer face (iso.y ≥ 0) ────────────────────────────────────────────
    if (iso.y >= 0) {
      quad(41, FACE_COL, [OA, OB, lift(OB), lift(OA)]);
    }


    // ── 3. Right edge — south corner (iso.x ≥ 0) ─────────────────────────────
    if (iso.x >= 0) {
      quad(42, SIDE_COL, [OA, IA, lift(IA), lift(OA)]);
    }

    // ── 4. Top cap — above inner face and mortar lines ────────────────────────
    quad(62, TOP_COL, [lift(OA), lift(OB), lift(IB), lift(IA)]);

    // ── 5. Left edge — west corner, topmost (iso.x ≤ 0) ─────────────────────
    if (iso.x <= 0) {
      quad(50, SIDE_COL, [OB, IB, lift(IB), lift(OB)]);
    }

    // ── 6. Inner face — topmost, with mortar lines ───────────────────────────
    quad(60, FACE_COL, [IA, IB, lift(IB), lift(IA)], (g, s) => {
      if (!tex) {
        for (let i = 1; i < 6; i++) {
          const t = i / 6;
          g.moveTo(IA.x * s, (IA.y - STORY_H * t) * s);
          g.lineTo(IB.x * s, (IB.y - STORY_H * t) * s);
          g.stroke({ width: s * 0.35, color: TRIM, alpha: 0.25 });
        }
      }
    });

    return calls;
  }

  getAttachmentPoints(_skeleton: Skeleton): Record<string, AttachmentPoint> {
    return {};
  }
}
