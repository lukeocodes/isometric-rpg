import type { Model, RenderContext, DrawCall, Skeleton, AttachmentPoint } from "../types";
import { darken, lighten } from "../palette";

/**
 * WALL_N — north wall panel. Six faces, CLAUDE.isometric.md geometry.
 *
 * T=22, H2=11, DX=4, DY=2, STORY_H=66=3T.
 *
 * Colors derived from ctx.palette.primary at runtime:
 *   top / ground cap : lighten(primary, 0.15)   — lit from above
 *   outer / inner    : primary                  — face colour
 *   left / right edge: darken(primary,  0.25)   — in shadow
 *
 * If ctx.texture is set (PixiJS Texture), it is stretched onto each face
 * using g.fill({ texture, matrix }) instead of the flat colour fill.
 */

const T  = 22;
const H2 = T / 2;
const DX = Math.round(0.2 * T);   // 4
const DY = Math.round(0.2 * H2);  // 2

export const STORY_H = 3 * T;     // 66

const TRIM = 0x3a3028;

type V = { x: number; y: number };

const OA: V = { x: -T,      y:  0      };
const OB: V = { x:  0,      y: -H2     };
const IA: V = { x: -T + DX, y:  DY     };
const IB: V = { x:  DX,     y: -H2+DY  };

const lift = (p: V): V => ({ x: p.x, y: p.y - STORY_H });

export class WallN implements Model {
  readonly id         = "wall-n";
  readonly name       = "Wall N";
  readonly category   = "construction" as const;
  readonly slot       = "root" as const;
  readonly isAnimated = false;

  getDrawCalls(ctx: RenderContext): DrawCall[] {
    const { iso } = ctx.skeleton;
    const primary  = ctx.palette.primary;
    const TOP_COL  = lighten(primary, 0.15);
    const FACE_COL = primary;
    const SIDE_COL = darken(primary, 0.25);

    // PixiJS Texture passed through context for textured fills
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
            // Stretch texture over the face's axis-aligned bounding box
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

    // ── 1. Ground cap (depth 1 — buried, never visible) ───────────────────────
    quad(1, TOP_COL, [OA, OB, IB, IA]);

    // ── 2. Outer face (visible from outside, iso.y ≥ 0) ─────────────────────
    if (iso.y >= 0) {
      quad(41, FACE_COL, [OA, OB, lift(OB), lift(OA)]);
    }

    // ── 3. Right edge (visible from east, iso.x ≥ 0) ─────────────────────────
    if (iso.x >= 0) {
      quad(42, SIDE_COL, [OB, IB, lift(IB), lift(OB)]);
    }

    // ── 4. Top cap (always visible) ───────────────────────────────────────────
    quad(43, TOP_COL, [lift(OA), lift(OB), lift(IB), lift(IA)]);

    // ── 5. Left edge (topmost, visible from west, iso.x ≤ 0) ────────────────
    if (iso.x <= 0) {
      quad(50, SIDE_COL, [OA, IA, lift(IA), lift(OA)]);
    }

    // ── 6. Inner face (topmost, always present) ───────────────────────────────
    quad(60, FACE_COL, [IA, IB, lift(IB), lift(IA)]);

    return calls;
  }

  getAttachmentPoints(_skeleton: Skeleton): Record<string, AttachmentPoint> {
    return {};
  }
}
