import type { Graphics } from "pixi.js";
import type { Model, RenderContext, DrawCall, AttachmentPoint } from "../types";
import { DEPTH_W } from "../types";

/**
 * Giant Tree — approximately 10× a character's height, 3× their width.
 *
 * Coordinate reference:
 *   Character body: y=0 (feet) to y=-40 (head) — 40 units tall, ~17 units wide.
 *   This tree: trunk from y=6 (roots) to y=-420 (top, off-screen by design).
 *   Trunk: ±26 units wide at base, ±14 at top — 52 units (≈3× body width).
 *
 * The canopy is intentionally above the visible frame — you only see the massive trunk.
 * Root flares spread up to ±80 units wide, spanning ~3 tiles at ground level.
 *
 * DEPTH: DEPTH_W+2 — entities walking south of this tile render in front.
 */
export class TreeGiant implements Model {
  readonly id = "tree-giant";
  readonly name = "Giant Tree";
  readonly category = "construction" as const;
  readonly slot = "root" as const;
  readonly isAnimated = false;

  getDrawCalls(_ctx: RenderContext): DrawCall[] {
    return [{
      depth: DEPTH_W + 2,
      draw: (g: Graphics, s: number) => {

        // ─── Ground shadow ─────────────────────────────────────────────────
        // Very wide ellipse spanning ~3 tiles
        g.ellipse(4 * s, 8 * s, 85 * s, 28 * s);
        g.fill({ color: 0x000000, alpha: 0.30 });
        g.ellipse(4 * s, 8 * s, 50 * s, 16 * s);
        g.fill({ color: 0x000000, alpha: 0.15 });

        // ─── Root buttresses ────────────────────────────────────────────────
        // Tall, organic root flanges that sweep out from the trunk base.
        // Each root is a filled shape: thick at the trunk, tapering to a point.
        // They rise slightly then sweep down into the ground.
        const drawRoot = (
          sign: number, // -1 = left, +1 = right
          trunkAttachX: number, // where root meets trunk (model x)
          trunkAttachTopY: number, // top of root at trunk
          spreadX: number, // how far it spreads outward
          groundY: number,  // y at the tip (ground level)
          thick: number,    // half-thickness at trunk attach
        ) => {
          // Root outline — filled tapered shape
          // Upper edge: curves outward and down
          // Lower edge: hugs ground more tightly
          const cx1 = trunkAttachX + sign * spreadX * 0.45;
          const cy1 = trunkAttachTopY * 0.3; // upper control point
          const cx2 = trunkAttachX + sign * spreadX * 0.8;
          const cy2 = groundY * 0.6; // lower control point

          const tipX = trunkAttachX + sign * spreadX;
          const tipY = groundY + 2;

          // Upper edge of root
          g.moveTo(trunkAttachX * s, trunkAttachTopY * s);
          g.bezierCurveTo(cx1 * s, cy1 * s, cx2 * s, cy2 * s, tipX * s, tipY * s);

          // Lower edge (offset by thickness, hugs ground)
          const cx1b = cx1 + sign * 4;
          const cy1b = cy1 + thick * 0.8;
          const cx2b = cx2 + sign * 2;
          const cy2b = cy2 + thick * 0.5;
          g.bezierCurveTo(
            (tipX - sign * 2) * s, (tipY + 1) * s,
            cx2b * s, cy2b * s,
            (trunkAttachX + sign * thick * 0.3) * s, (trunkAttachTopY + thick * 1.4) * s,
          );
          g.closePath();
          g.fill(0x3d1e08);

          // Inner light band on root (near side)
          const hs = sign < 0 ? 0.35 : 0.20; // near side is left
          g.moveTo(trunkAttachX * s, trunkAttachTopY * s);
          g.bezierCurveTo(cx1 * s, cy1 * s, cx2 * s, cy2 * s, tipX * s, tipY * s);
          g.stroke({ width: thick * hs * s, color: sign < 0 ? 0x7a4820 : 0x2a1006, alpha: 0.7 });
        };

        // Left side roots (near/lit side) — spread shorter, dive into ground sooner
        drawRoot(-1, -24, -20, 32, 14, 10);
        drawRoot(-1, -20, -12, 22, 12,  7);
        drawRoot(-1, -16,  -6, 14, 10,  5);
        // Right side roots (far/shadow side)
        drawRoot(+1,  24, -20, 32, 14, 10);
        drawRoot(+1,  20, -12, 22, 12,  7);
        drawRoot(+1,  16,  -6, 14, 10,  5);

        // ─── Trunk — main body ─────────────────────────────────────────────
        // Tapers from wide base (±26) to narrower top (±14 at very top).
        // Composed of multiple layers for a rich bark look.

        const TRUNK_TOP = -420; // well off screen
        const TRUNK_BASE_Y = 0;
        const TRUNK_BASE_W = 26;   // half-width at base
        const TRUNK_TOP_W  = 14;   // half-width at very top (out of frame)

        // Interpolate width at y: linear taper
        const widthAt = (y: number): number => {
          const t = (y - TRUNK_BASE_Y) / (TRUNK_TOP - TRUNK_BASE_Y);
          return TRUNK_BASE_W + (TRUNK_TOP_W - TRUNK_BASE_W) * Math.max(0, Math.min(1, t));
        };

        // Base fill — dark core colour
        g.moveTo(-TRUNK_BASE_W * s, TRUNK_BASE_Y * s);
        g.lineTo(-(TRUNK_TOP_W + 1) * s, TRUNK_TOP * s);
        g.lineTo( (TRUNK_TOP_W + 1) * s, TRUNK_TOP * s);
        g.lineTo( TRUNK_BASE_W * s, TRUNK_BASE_Y * s);
        g.closePath();
        g.fill(0x3d2210);

        // Mid-tone layer — main bark colour
        g.moveTo(-(TRUNK_BASE_W - 1) * s, TRUNK_BASE_Y * s);
        g.lineTo(-(TRUNK_TOP_W) * s, TRUNK_TOP * s);
        g.lineTo( (TRUNK_TOP_W) * s, TRUNK_TOP * s);
        g.lineTo( (TRUNK_BASE_W - 1) * s, TRUNK_BASE_Y * s);
        g.closePath();
        g.fill(0x5a3318);

        // ─── Bark texture — vertical ridges ────────────────────────────────
        // Draw 12 vertical ridges across the trunk width.
        const RIDGE_COUNT = 12;
        for (let i = 0; i < RIDGE_COUNT; i++) {
          const t = (i + 0.5) / RIDGE_COUNT; // 0..1 across trunk width

          // Ridge positions at several heights
          const heights = [0, -60, -120, -180, -240, -300, -360, -420];
          const pts: [number, number][] = heights.map(y => {
            const hw = widthAt(y);
            const x = -hw + t * hw * 2;
            // Add slight waviness to each ridge
            const wave = Math.sin(y * 0.04 + i * 0.8) * 1.5;
            return [x + wave, y];
          });

          // Ridge line — alternating dark/light for depth
          const isLit  = t > 0.5 ? t - 0.5 : 0;
          const isDark = t < 0.5 ? 0.5 - t : 0;
          const col = isLit  > 0.05 ? 0x7a4a22 :
                      isDark > 0.05 ? 0x2a1408 : 0x4a2810;

          for (let j = 0; j < pts.length - 1; j++) {
            g.moveTo(pts[j][0] * s, pts[j][1] * s);
            g.lineTo(pts[j + 1][0] * s, pts[j + 1][1] * s);
          }
          g.stroke({ width: (1.2 + Math.abs(t - 0.5) * 2) * s, color: col, alpha: 0.7 });
        }

        // ─── Lit left edge ─────────────────────────────────────────────────
        // The left (near) side catches light
        g.moveTo(-TRUNK_BASE_W * s, TRUNK_BASE_Y * s);
        g.lineTo(-TRUNK_TOP_W * s, TRUNK_TOP * s);
        g.stroke({ width: 5 * s, color: 0x8c5528, alpha: 0.55 });

        g.moveTo(-TRUNK_BASE_W * s, TRUNK_BASE_Y * s);
        g.lineTo(-TRUNK_TOP_W * s, TRUNK_TOP * s);
        g.stroke({ width: 2 * s, color: 0xb87840, alpha: 0.30 });

        // ─── Shadow right edge ─────────────────────────────────────────────
        g.moveTo(TRUNK_BASE_W * s, TRUNK_BASE_Y * s);
        g.lineTo(TRUNK_TOP_W * s, TRUNK_TOP * s);
        g.stroke({ width: 6 * s, color: 0x1a0a04, alpha: 0.60 });

        // ─── Horizontal bark bands ─────────────────────────────────────────
        // Subtle horizontal texture bands (rings/plate lines) every ~30 units.
        for (let y = -25; y > TRUNK_TOP + 30; y -= 30) {
          const hw = widthAt(y);
          const offsetX = Math.sin(y * 0.05) * 2;
          g.moveTo((-hw + offsetX) * s, y * s);
          g.lineTo(( hw + offsetX) * s, y * s);
          g.stroke({ width: 0.8 * s, color: 0x2a1408, alpha: 0.35 });
        }

        // ─── Moss patches ──────────────────────────────────────────────────
        // Moss grows on the shaded (right) side of the trunk.
        const mossPatches: [number, number, number, number][] = [
          // [cx, cy, rx, ry]
          [ 10,  -30,  9, 4],
          [ 14,  -75,  7, 3],
          [  8, -130,  8, 3.5],
          [ 16, -190, 10, 4],
          [  6, -250,  7, 3],
          [ 12, -310,  9, 3.5],
          [  4, -370,  6, 2.5],
        ];
        for (const [cx, cy, rx, ry] of mossPatches) {
          const hw = widthAt(cy);
          // Clamp to trunk surface (right side = shadow side)
          const mx = Math.min(cx, hw - 1);
          g.ellipse(mx * s, cy * s, rx * s, ry * s);
          g.fill({ color: 0x2d5e1a, alpha: 0.75 });
          // Highlight on moss
          g.ellipse((mx - rx * 0.3) * s, (cy - ry * 0.3) * s, rx * 0.5 * s, ry * 0.4 * s);
          g.fill({ color: 0x4a8a2a, alpha: 0.45 });
        }

        // ─── Lichen patches (lighter, scattered) ───────────────────────────
        const lichenPatches: [number, number][] = [
          [-8, -50], [14, -100], [-12, -160], [6, -220],
          [-16, -280], [10, -330], [-6, -380],
        ];
        for (const [lx, ly] of lichenPatches) {
          const hw = widthAt(ly);
          const mx = Math.max(-hw + 1, Math.min(lx, hw - 1));
          g.ellipse(mx * s, ly * s, 4 * s, 2 * s);
          g.fill({ color: 0x8a9a6a, alpha: 0.50 });
        }

        // ─── Canopy ────────────────────────────────────────────────────────
        // Massive layered foliage at the trunk top. Spreads 5× trunk half-width.
        const CY  = TRUNK_TOP;           // top of trunk in model units
        const CW  = 130;                  // canopy half-width
        const CLH = 180;                  // canopy height above trunk top

        // Underside shadow
        g.ellipse(2 * s, (CY + 18) * s, CW * 0.8 * s, CLH * 0.12 * s);
        g.fill({ color: 0x0d1f06, alpha: 0.55 });

        // Layer 4 — widest, darkest
        g.ellipse(2 * s, (CY - CLH * 0.08) * s, CW * 1.0 * s, CLH * 0.38 * s);
        g.fill(0x1a3d0a);
        // Layer 3
        g.ellipse(-4 * s, (CY - CLH * 0.32) * s, CW * 0.88 * s, CLH * 0.38 * s);
        g.fill(0x234f0d);
        // Layer 2
        g.ellipse(3 * s, (CY - CLH * 0.55) * s, CW * 0.72 * s, CLH * 0.36 * s);
        g.fill(0x2d6612);
        // Layer 1
        g.ellipse(-3 * s, (CY - CLH * 0.75) * s, CW * 0.52 * s, CLH * 0.30 * s);
        g.fill(0x337514);
        // Crown
        g.ellipse(2 * s, (CY - CLH * 0.92) * s, CW * 0.35 * s, CLH * 0.22 * s);
        g.fill(0x3a8518);

        // Sunlit catch (upper-left)
        g.ellipse(-CW * 0.25 * s, (CY - CLH * 0.62) * s, CW * 0.22 * s, CLH * 0.14 * s);
        g.fill({ color: 0x5cb82a, alpha: 0.35 });
        g.ellipse(-CW * 0.15 * s, (CY - CLH * 0.88) * s, CW * 0.15 * s, CLH * 0.10 * s);
        g.fill({ color: 0x6dcc30, alpha: 0.28 });

        // Shadow right
        g.ellipse(CW * 0.32 * s, (CY - CLH * 0.30) * s, CW * 0.28 * s, CLH * 0.25 * s);
        g.fill({ color: 0x0a1e04, alpha: 0.40 });

        // Outline
        g.ellipse(2 * s, (CY - CLH * 0.08) * s, CW * 1.0 * s, CLH * 0.38 * s);
        g.stroke({ width: s * 1.5, color: 0x0d2005, alpha: 0.35 });

      },
    }];
  }

  getAttachmentPoints(): Record<string, AttachmentPoint> { return {}; }
}
