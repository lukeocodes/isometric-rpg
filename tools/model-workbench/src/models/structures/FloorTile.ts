import type { Model, RenderContext, DrawCall, Skeleton, AttachmentPoint } from "../types";
import { darken, lighten } from "../palette";

/**
 * FLOOR_TILE — a full isometric tile with a thin physical thickness.
 *
 * Top face is the complete tile diamond (all four vertices).
 * Two side strips below give it depth = half the wall thickness (H=2).
 *
 * Tile diamond (CLAUDE.isometric.md, T=22, anchor = north vertex):
 *   North : ( 0, −H2) = ( 0, −11)
 *   East  : (+T,   0) = (+22,  0)
 *   South : ( 0, +H2) = ( 0, +11)
 *   West  : (−T,   0) = (−22,  0)
 *
 * Visible side strips (from SE camera):
 *   Left  (SW edge) : West → South → South+(0,H) → West+(0,H)
 *   Right (SE edge) : South → East  → East+(0,H)  → South+(0,H)
 *
 * Lighting (CLAUDE.isometric.md, light from above-right):
 *   Top   = base × 1.00
 *   Left  = base × 0.80
 *   Right = base × 0.65
 */

const T  = 22;
const H2 = T / 2;         // 11
const H  = 2;              // floor thickness — half the wall DX (4 / 2 = 2)

const TRIM = 0x3a3028;

type V = { x: number; y: number };

// Ground-level tile diamond corners (bottom of the slab)
const N: V = { x:  0,   y: -H2  };  // north  ( 0, −11)
const E: V = { x:  T,   y:  0   };  // east   (22,   0)
const S: V = { x:  0,   y:  H2  };  // south  ( 0, +11)
const W: V = { x: -T,   y:  0   };  // west   (−22,  0)

// Top-surface corners — lifted UP by H (the raised slab top face)
const Nt: V = { x:  0,   y: -H2-H };  // north top ( 0, −13)
const Et: V = { x:  T,   y:  -H   };  // east  top (22,  −2)
const St: V = { x:  0,   y:  H2-H };  // south top ( 0,   9)
const Wt: V = { x: -T,   y:  -H   };  // west  top (−22, −2)

export class FloorTile implements Model {
  readonly id         = "floor-tile";
  readonly name       = "Floor Tile";
  readonly category   = "construction" as const;
  readonly slot       = "root" as const;
  readonly isAnimated = false;

  getDrawCalls(ctx: RenderContext): DrawCall[] {
    const primary  = ctx.palette.primary;
    const TOP_COL  = lighten(primary, 0.15);
    const FACE_COL = primary;
    const SIDE_COL = darken(primary, 0.25);

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const tex = ctx.texture as any ?? null;

    const calls: DrawCall[] = [];

    const quad = (depth: number, color: number, pts: [V, V, V, V]) => {
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
          g.poly(flat);
          g.stroke({ width: s * 0.5, color: TRIM, alpha: 0.5 });
        },
      });
    };

    // ── Right side strip (SE edge: ground → top, in shadow) ──────────────────
    quad(10, SIDE_COL, [S, E, Et, St]);

    // ── Left side strip (SW edge: ground → top) ───────────────────────────────
    quad(11, FACE_COL, [W, S, St, Wt]);

    // ── Top face (lifted diamond, lightest) ───────────────────────────────────
    quad(20, TOP_COL, [Nt, Et, St, Wt]);

    return calls;
  }

  getAttachmentPoints(_skeleton: Skeleton): Record<string, AttachmentPoint> {
    return {};
  }
}
