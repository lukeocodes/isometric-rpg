import type { Graphics } from "pixi.js";
import type { V, FitmentCorners } from "./types";
import { darken, lighten } from "./palette";

/**
 * Draw a tapered limb segment with muscle bulge, shadow, and outline.
 * Used for arms, legs, and other organic limb shapes.
 */
export function drawTaperedLimb(
  g: Graphics,
  from: V,
  to: V,
  widthFrom: number,
  widthTo: number,
  color: number,
  shadowColor: number,
  outlineColor: number,
  s: number
): void {
  const dx = to.x - from.x;
  const dy = to.y - from.y;
  const len = Math.sqrt(dx * dx + dy * dy);
  if (len < 0.3) return;

  const nx = -dy / len;
  const ny = dx / len;

  const wf = widthFrom * 0.5;
  const wt = widthTo * 0.5;

  const x1l = from.x + nx * wf;
  const y1l = from.y + ny * wf;
  const x1r = from.x - nx * wf;
  const y1r = from.y - ny * wf;
  const x2l = to.x + nx * wt;
  const y2l = to.y + ny * wt;
  const x2r = to.x - nx * wt;
  const y2r = to.y - ny * wt;

  const bulgeOuter = 1.0;
  const bulgeInner = 0.3;

  const m1x = from.x + dx * 0.35;
  const m1y = from.y + dy * 0.35;
  const wm1 = wf + (wt - wf) * 0.35;
  const m1xl = m1x + nx * (wm1 + bulgeOuter);
  const m1yl = m1y + ny * (wm1 + bulgeOuter);
  const m1xr = m1x - nx * (wm1 + bulgeInner);
  const m1yr = m1y - ny * (wm1 + bulgeInner);

  // Shape
  g.moveTo(x1l * s, y1l * s);
  g.quadraticCurveTo(m1xl * s, m1yl * s, x2l * s, y2l * s);
  g.lineTo(x2r * s, y2r * s);
  g.quadraticCurveTo(m1xr * s, m1yr * s, x1r * s, y1r * s);
  g.closePath();
  g.fill(color);

  // Shadow stripe
  const cx2 = (x2r + x2l) / 2;
  const cy2 = (y2r + y2l) / 2;
  const cx1 = (x1r + x1l) / 2;
  const cy1 = (y1r + y1l) / 2;
  g.moveTo(x1r * s, y1r * s);
  g.quadraticCurveTo(m1xr * s, m1yr * s, x2r * s, y2r * s);
  g.lineTo(cx2 * s, cy2 * s);
  g.lineTo(cx1 * s, cy1 * s);
  g.closePath();
  g.fill({ color: shadowColor, alpha: 0.2 });

  // Highlight
  g.moveTo(x1l * s, y1l * s);
  g.quadraticCurveTo(m1xl * s, m1yl * s, x2l * s, y2l * s);
  g.lineTo(cx2 * s, cy2 * s);
  g.lineTo(cx1 * s, cy1 * s);
  g.closePath();
  g.fill({ color: 0xffffff, alpha: 0.06 });

  // Outline
  g.moveTo(x1l * s, y1l * s);
  g.quadraticCurveTo(m1xl * s, m1yl * s, x2l * s, y2l * s);
  g.lineTo(x2r * s, y2r * s);
  g.quadraticCurveTo(m1xr * s, m1yr * s, x1r * s, y1r * s);
  g.closePath();
  g.stroke({ width: s * 0.45, color: outlineColor, alpha: 0.3 });
}

/**
 * Draw a tapered blade shape (used by swords, daggers).
 * Wide at base, pointed at tip, with fuller and edge highlight.
 */
export function drawBlade(
  g: Graphics,
  x1: number,
  y1: number,
  x2: number,
  y2: number,
  w: number,
  color: number,
  s: number
): void {
  const dx = x2 - x1;
  const dy = y2 - y1;
  const len = Math.sqrt(dx * dx + dy * dy);
  if (len < 0.1) return;
  const px = (-dy / len) * w;
  const py = (dx / len) * w;

  // Tapered blade
  g.poly([
    (x1 + px) * s, (y1 + py) * s,
    x2 * s, y2 * s,
    (x1 - px) * s, (y1 - py) * s,
  ]);
  g.fill(color);
  g.poly([
    (x1 + px) * s, (y1 + py) * s,
    x2 * s, y2 * s,
    (x1 - px) * s, (y1 - py) * s,
  ]);
  g.stroke({ width: s * 0.4, color: darken(color, 0.3), alpha: 0.4 });

  // Edge highlight
  g.moveTo(x1 * s, y1 * s);
  g.lineTo(x2 * s, y2 * s);
  g.stroke({ width: s * 0.3, color: lighten(color, 0.3), alpha: 0.6 });

  // Fuller (blood groove)
  const fStart = 0.2;
  const fEnd = 0.7;
  g.moveTo(
    (x1 + dx * fStart + px * 0.3) * s,
    (y1 + dy * fStart + py * 0.3) * s
  );
  g.lineTo(
    (x1 + dx * fEnd + px * 0.15) * s,
    (y1 + dy * fEnd + py * 0.15) * s
  );
  g.stroke({ width: s * 0.3, color: darken(color, 0.15), alpha: 0.4 });
}

/**
 * Draw a quad using four fitment corner points with fill + outline.
 * The quad naturally shears/stretches to match any body type.
 *
 * @param inset  Shrink each corner inward by this many model units (0 = full fit)
 */
export function drawCornerQuad(
  g: Graphics,
  corners: FitmentCorners,
  inset: number,
  color: number,
  outlineColor: number,
  outlineAlpha: number,
  s: number,
): void {
  const { tl, tr, bl, br } = corners;
  // Apply inset: move each corner toward the centre
  const cx = (tl.x + tr.x + bl.x + br.x) / 4;
  const cy = (tl.y + tr.y + bl.y + br.y) / 4;
  const lerp = (a: number, b: number, t: number) => a + (b - a) * t;
  const f = inset > 0 ? inset / Math.max(1, Math.abs(tr.x - tl.x)) : 0;

  const iTL = { x: lerp(tl.x, cx, f), y: lerp(tl.y, cy, f) };
  const iTR = { x: lerp(tr.x, cx, f), y: lerp(tr.y, cy, f) };
  const iBL = { x: lerp(bl.x, cx, f), y: lerp(bl.y, cy, f) };
  const iBR = { x: lerp(br.x, cx, f), y: lerp(br.y, cy, f) };

  g.moveTo(iTL.x * s, iTL.y * s);
  g.lineTo(iTR.x * s, iTR.y * s);
  g.lineTo(iBR.x * s, iBR.y * s);
  g.lineTo(iBL.x * s, iBL.y * s);
  g.closePath();
  g.fill(color);

  g.moveTo(iTL.x * s, iTL.y * s);
  g.lineTo(iTR.x * s, iTR.y * s);
  g.lineTo(iBR.x * s, iBR.y * s);
  g.lineTo(iBL.x * s, iBL.y * s);
  g.closePath();
  g.stroke({ width: s * 0.5, color: outlineColor, alpha: outlineAlpha });
}

/**
 * Interpolate a point inside a corner quad using (u, v) in [0,1]×[0,1].
 * u=0 → left edge, u=1 → right edge, v=0 → top, v=1 → bottom.
 * Useful for placing rivets, emblems, or decoration inside corner-fit armor.
 */
export function quadPoint(corners: FitmentCorners, u: number, v: number): V {
  const { tl, tr, bl, br } = corners;
  const top = { x: tl.x + (tr.x - tl.x) * u, y: tl.y + (tr.y - tl.y) * u };
  const bot = { x: bl.x + (br.x - bl.x) * u, y: bl.y + (br.y - bl.y) * u };
  return { x: top.x + (bot.x - top.x) * v, y: top.y + (bot.y - top.y) * v };
}
