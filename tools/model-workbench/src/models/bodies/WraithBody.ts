import type { Graphics } from "pixi.js";
import type { Model, RenderContext, DrawCall, Skeleton, AttachmentPoint, V } from "../types";
import { DEPTH_SHADOW, DEPTH_FAR_LIMB, DEPTH_BODY, DEPTH_HEAD, DEPTH_NEAR_LIMB } from "../types";
import { darken, lighten } from "../palette";

/**
 * Wraith NPC — ethereal, translucent ghostly undead.
 * Hooded figure, no legs (floats), trailing wisps, spectral blue glowing eyes.
 * CAN hold weapons.
 */
export class WraithBody implements Model {
  readonly id = "wraith-body";
  readonly name = "Wraith";
  readonly category = "npc" as const;
  readonly slot = "root" as const;

  private readonly ROBE    = 0x1a1a2e;
  private readonly ROBE_DK = 0x0a0a1e;
  private readonly ROBE_LT = 0x2a2a4e;
  private readonly GLOW    = 0x44ccff;
  private readonly WISP    = 0x222244;

  getDrawCalls(ctx: RenderContext): DrawCall[] {
    const { skeleton, facingCamera, nearSide, farSide } = ctx;
    const j = skeleton.joints;
    const { iso, bob, walkPhase, wf } = skeleton;

    const hover = Math.sin((walkPhase || 0) * 1.5) * 2 - 3;
    const calls: DrawCall[] = [];

    calls.push({ depth: DEPTH_SHADOW, draw: (g, s) => {
      g.ellipse(iso.x * s, 2 * s, 8 * s, 3 * s);
      g.fill({ color: 0x000000, alpha: 0.08 });
    }});

    calls.push({ depth: DEPTH_SHADOW + 5, draw: (g, s) => this.drawWisps(g, j, skeleton, hover, s) });
    calls.push({ depth: DEPTH_BODY - 5,   draw: (g, s) => this.drawRobe(g, j, skeleton, hover, s) });

    calls.push({ depth: facingCamera ? DEPTH_FAR_LIMB + 8 : DEPTH_NEAR_LIMB + 0,
      draw: (g, s) => this.drawArm(g, j, skeleton, hover, s, farSide, false) });

    calls.push({ depth: DEPTH_HEAD,     draw: (g, s) => this.drawHood(g, j, skeleton, hover, s) });

    calls.push({ depth: facingCamera ? DEPTH_NEAR_LIMB + 5 : DEPTH_FAR_LIMB + 10,
      draw: (g, s) => this.drawArm(g, j, skeleton, hover, s, nearSide, true) });

    // Spectral aura
    calls.push({ depth: DEPTH_HEAD + 1, draw: (g, s) => {
      const cx = j.neckBase.x, cy = j.neckBase.y + hover - 5;
      g.ellipse(cx * s, cy * s, 12 * wf * s, 16 * s);
      g.fill({ color: this.GLOW, alpha: 0.03 });
    }});

    return calls;
  }

  getAttachmentPoints(skeleton: Skeleton): Record<string, AttachmentPoint> {
    return { "hand-R": skeleton.attachments["hand-R"], "hand-L": skeleton.attachments["hand-L"] };
  }

  // ─── ROBE ─────────────────────────────────────────────────────────

  private drawRobe(g: Graphics, j: Record<string, V>, sk: Skeleton, hover: number, s: number): void {
    const { wf, iso, walkPhase } = sk;
    const nB   = j.neckBase;
    const sway = walkPhase !== 0 ? Math.sin(walkPhase * 0.8) * 1.5 : 0;

    const cx      = nB.x;
    const topY    = nB.y + hover + 2;
    const W       = 1.1;
    const shouldW = 8 * wf * W;
    const midW    = 10 * wf * W;
    const hemW    = 12 * wf * W;
    const robeLen = 22;

    // Main robe — translucent
    g.moveTo((cx - shouldW * 0.5) * s, topY * s);
    g.quadraticCurveTo((cx - midW * 0.6) * s, (topY + robeLen * 0.4) * s, (cx - hemW * 0.5 + sway) * s, (topY + robeLen) * s);
    for (let i = 0; i < 5; i++) {
      const t  = i / 4;
      const px = cx - hemW * 0.5 + hemW * t + sway * (1 - t);
      const py = topY + robeLen + Math.sin(t * 8 + (walkPhase || 0)) * 1.5;
      g.lineTo(px * s, py * s);
    }
    g.quadraticCurveTo((cx + midW * 0.6) * s, (topY + robeLen * 0.4) * s, (cx + shouldW * 0.5) * s, topY * s);
    g.closePath();
    g.fill({ color: this.ROBE, alpha: 0.75 });

    // Directional shadow band
    const sideAmt = Math.abs(iso.x);
    if (sideAmt > 0.1) {
      const shadowSide = iso.x > 0 ? -1 : 1;
      g.moveTo((cx + shadowSide * shouldW * 0.5) * s, topY * s);
      g.quadraticCurveTo((cx + shadowSide * midW * 0.6) * s, (topY + robeLen * 0.4) * s,
        (cx + shadowSide * hemW * 0.5 + sway) * s, (topY + robeLen) * s);
      g.lineTo(cx * s, (topY + robeLen) * s);
      g.lineTo(cx * s, topY * s);
      g.closePath();
      g.fill({ color: this.ROBE_DK, alpha: sideAmt * 0.35 });
    }

    // Center fold + side folds
    g.moveTo(cx * s, (topY + 2) * s);
    g.lineTo((cx + sway * 0.5) * s, (topY + robeLen - 2) * s);
    g.stroke({ width: s * 1.5, color: this.ROBE_DK, alpha: 0.3 });

    for (const dir of [-1, 1]) {
      g.moveTo((cx + dir * 3 * wf) * s, (topY + 4) * s);
      g.quadraticCurveTo((cx + dir * 3.5 * wf + sway * 0.3) * s, (topY + robeLen * 0.6) * s,
        (cx + dir * 4 * wf + sway * 0.7) * s, (topY + robeLen - 1) * s);
      g.stroke({ width: s * 0.6, color: this.ROBE_DK, alpha: 0.2 });
    }

    // Outline
    g.moveTo((cx - shouldW * 0.5) * s, topY * s);
    g.quadraticCurveTo((cx - midW * 0.6) * s, (topY + robeLen * 0.4) * s, (cx - hemW * 0.5 + sway) * s, (topY + robeLen) * s);
    g.stroke({ width: s * 0.4, color: this.ROBE_LT, alpha: 0.15 });
    g.moveTo((cx + shouldW * 0.5) * s, topY * s);
    g.quadraticCurveTo((cx + midW * 0.6) * s, (topY + robeLen * 0.4) * s, (cx + hemW * 0.5 + sway) * s, (topY + robeLen) * s);
    g.stroke({ width: s * 0.4, color: this.ROBE_LT, alpha: 0.15 });
  }

  // ─── HOOD ─────────────────────────────────────────────────────────

  private drawHood(g: Graphics, j: Record<string, V>, sk: Skeleton, hover: number, s: number): void {
    const head = j.head;
    const { wf, iso } = sk;
    const faceCam = iso.y > 0;
    const sideView = Math.abs(iso.x) > 0.3;

    const cx = head.x, cy = head.y + hover;
    const hw = 9 * wf, hh = 9;

    // Hood shape
    g.moveTo((cx - hw * 0.3) * s, (cy + hh * 0.4) * s);
    g.quadraticCurveTo((cx - hw) * s, (cy - hh * 0.2) * s, (cx - hw * 0.6) * s, (cy - hh) * s);
    g.quadraticCurveTo(cx * s, (cy - hh * 1.3) * s, (cx + hw * 0.6) * s, (cy - hh) * s);
    g.quadraticCurveTo((cx + hw) * s, (cy - hh * 0.2) * s, (cx + hw * 0.3) * s, (cy + hh * 0.4) * s);
    g.closePath();
    g.fill({ color: this.ROBE, alpha: 0.85 });

    // Directional shading on hood
    if (Math.abs(iso.x) > 0.1) {
      const shadowSide = iso.x > 0 ? -1 : 1;
      g.moveTo((cx + shadowSide * hw * 0.3) * s, (cy + hh * 0.4) * s);
      g.quadraticCurveTo((cx + shadowSide * hw) * s, (cy - hh * 0.2) * s, (cx + shadowSide * hw * 0.6) * s, (cy - hh) * s);
      g.quadraticCurveTo(cx * s, (cy - hh * 1.3) * s, cx * s, (cy - hh * 0.8) * s);
      g.quadraticCurveTo(cx * s, cy * s, (cx + shadowSide * hw * 0.3) * s, (cy + hh * 0.4) * s);
      g.closePath();
      g.fill({ color: this.ROBE_DK, alpha: Math.abs(iso.x) * 0.4 });
    }

    // Hood edge
    g.moveTo((cx - hw * 0.3) * s, (cy + hh * 0.4) * s);
    g.quadraticCurveTo((cx - hw) * s, (cy - hh * 0.2) * s, (cx - hw * 0.6) * s, (cy - hh) * s);
    g.quadraticCurveTo(cx * s, (cy - hh * 1.3) * s, (cx + hw * 0.6) * s, (cy - hh) * s);
    g.quadraticCurveTo((cx + hw) * s, (cy - hh * 0.2) * s, (cx + hw * 0.3) * s, (cy + hh * 0.4) * s);
    g.stroke({ width: s * 0.5, color: this.ROBE_LT, alpha: 0.22 });

    // Dark void inside hood
    if (faceCam || sideView) {
      g.ellipse((cx + iso.x * 1) * s, (cy + 0.5) * s, (hw - 2) * wf * s, (hh - 3) * s);
      g.fill({ color: 0x050510, alpha: 0.85 });
    }

    // Glowing eyes — follow iso direction
    if (faceCam || (sideView && iso.y >= -0.2)) {
      const spread = 2.5 * wf;
      const eyeY  = cy + 0.5 + iso.y * 0.5;
      const eyeOX = cx + iso.x * 1.2; // directional offset

      // Glow halos
      g.circle((eyeOX - spread) * s, eyeY * s, 2.2 * s); g.fill({ color: this.GLOW, alpha: 0.18 });
      g.circle((eyeOX + spread) * s, eyeY * s, 2.2 * s); g.fill({ color: this.GLOW, alpha: 0.18 });

      // Eye cores
      g.circle((eyeOX - spread) * s, eyeY * s, 1.0 * s); g.fill({ color: this.GLOW, alpha: 0.85 });
      g.circle((eyeOX + spread) * s, eyeY * s, 1.0 * s); g.fill({ color: this.GLOW, alpha: 0.85 });

      // Bright center
      g.circle((eyeOX - spread) * s, eyeY * s, 0.4 * s); g.fill({ color: 0xffffff, alpha: 0.65 });
      g.circle((eyeOX + spread) * s, eyeY * s, 0.4 * s); g.fill({ color: 0xffffff, alpha: 0.65 });

      // Catch-light (directional)
      g.circle((eyeOX - spread + iso.x * 0.5 + 0.35) * s, (eyeY - 0.3) * s, 0.2 * s);
      g.fill({ color: 0xaaffff, alpha: 0.5 });
      g.circle((eyeOX + spread + iso.x * 0.5 + 0.35) * s, (eyeY - 0.3) * s, 0.2 * s);
      g.fill({ color: 0xaaffff, alpha: 0.5 });
    }
  }

  // ─── ARM ──────────────────────────────────────────────────────────

  private drawArm(g: Graphics, j: Record<string, V>, sk: Skeleton, hover: number, s: number, side: "L" | "R", isNear: boolean): void {
    const shoulder = j[`shoulder${side}`];
    const elbow    = j[`elbow${side}`];
    const wrist    = j[`wrist${side}`];
    const rC    = isNear ? this.ROBE : darken(this.ROBE, 0.08);
    const shoulderY = shoulder.y + hover;
    const elbowY    = elbow.y + hover;
    const wristY    = wrist.y + hover;

    g.moveTo(shoulder.x * s, shoulderY * s);
    g.lineTo(elbow.x * s, elbowY * s);
    g.stroke({ width: s * 5, color: rC, alpha: 0.6 });

    g.moveTo(elbow.x * s, elbowY * s);
    g.lineTo(wrist.x * s, wristY * s);
    g.stroke({ width: s * 4, color: rC, alpha: 0.5 });

    const dx  = wrist.x - elbow.x, dy = wristY - elbowY;
    const len = Math.sqrt(dx * dx + dy * dy) || 1;
    const px  = -dy / len, py = dx / len;
    g.moveTo(elbow.x * s, elbowY * s);
    g.quadraticCurveTo((elbow.x + px * 3 + dx * 0.5) * s, (elbowY + py * 3 + dy * 0.5) * s, wrist.x * s, (wristY + 3) * s);
    g.stroke({ width: s * 0.5, color: this.ROBE_DK, alpha: 0.3 });

    // Skeletal hand — barely visible
    g.circle(wrist.x * s, wristY * s, 1.5 * s);
    g.fill({ color: 0x888899, alpha: 0.4 });

    // Spectral glow around hand
    g.circle(wrist.x * s, wristY * s, 3 * s);
    g.fill({ color: this.GLOW, alpha: 0.05 });
  }

  // ─── WISPS ────────────────────────────────────────────────────────

  private drawWisps(g: Graphics, j: Record<string, V>, sk: Skeleton, hover: number, s: number): void {
    const { iso, walkPhase } = sk;
    const cx    = j.neckBase.x;
    const baseY = j.hipL.y + hover + 10;
    const phase = walkPhase || 0;

    for (let i = 0; i < 3; i++) {
      const offset = (i - 1) * 4;
      const sway   = Math.sin(phase * 0.7 + i * 2.1) * 3;
      const wx     = cx + offset - iso.x * 5;
      const wy     = baseY + i * 3;
      const tipX   = wx - iso.x * 8 + sway;
      const tipY   = wy + 8 + Math.sin(phase + i) * 2;

      g.moveTo(wx * s, wy * s);
      g.quadraticCurveTo(((wx + tipX) / 2 + sway * 0.5) * s, ((wy + tipY) / 2 + 2) * s, tipX * s, tipY * s);
      g.stroke({ width: s * (2 - i * 0.4), color: this.WISP, alpha: 0.3 - i * 0.08 });
    }

    // Ground mist
    g.ellipse(cx * s, (baseY + 5) * s, 10 * s, 3 * s);
    g.fill({ color: this.WISP, alpha: 0.08 });
  }
}
