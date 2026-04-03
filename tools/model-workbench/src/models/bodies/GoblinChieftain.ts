import type { Graphics } from "pixi.js";
import type { Model, RenderContext, DrawCall, Skeleton, AttachmentPoint, V } from "../types";
import { DEPTH_SHADOW, DEPTH_FAR_LIMB, DEPTH_BODY, DEPTH_HEAD, DEPTH_NEAR_LIMB } from "../types";
import { darken, lighten } from "../palette";
import { drawTaperedLimb } from "../draw-helpers";

/**
 * Goblin Chieftain — boss variant. Larger, war-painted, feathered headdress,
 * scarred. Near/far toning, directional shading, catch-lights.
 */
export class GoblinChieftain implements Model {
  readonly id = "goblin-chieftain";
  readonly name = "Goblin Chieftain";
  readonly category = "npc" as const;
  readonly slot = "root" as const;

  private readonly SKIN     = 0x4a7a3a;
  private readonly SKIN_DK  = 0x2a5a1a;
  private readonly BELLY    = 0x5a4a2a;
  private readonly EYE      = 0xff4444;
  private readonly WARPAINT = 0xcc2222;
  private readonly FEATHER  = 0xcc4400;

  getDrawCalls(ctx: RenderContext): DrawCall[] {
    const { skeleton, facingCamera, nearSide, farSide } = ctx;
    const j = skeleton.joints;
    const { wf, iso } = skeleton;
    const W = 1.35;
    const calls: DrawCall[] = [];

    // Boss aura
    calls.push({ depth: DEPTH_SHADOW - 1, draw: (g, s) => {
      g.ellipse(0, -8 * s, 16 * s, 20 * s);
      g.fill({ color: 0x446622, alpha: 0.04 });
    }});

    calls.push({ depth: DEPTH_SHADOW, draw: (g, s) => {
      g.ellipse(iso.x * 2 * s, 2 * s, 16 * s, 5.5 * s);
      g.fill({ color: 0x000000, alpha: 0.2 });
    }});

    calls.push({ depth: DEPTH_FAR_LIMB,     draw: (g, s) => this.drawLeg(g, j, skeleton, s, farSide,  false, W) });
    calls.push({ depth: DEPTH_FAR_LIMB + 4, draw: (g, s) => this.drawLeg(g, j, skeleton, s, nearSide, true,  W) });

    calls.push({ depth: facingCamera ? DEPTH_FAR_LIMB + 8 : DEPTH_NEAR_LIMB + 0,
      draw: (g, s) => this.drawArm(g, j, s, farSide, false) });

    calls.push({ depth: DEPTH_BODY,     draw: (g, s) => this.drawTorso(g, j, skeleton, s, nearSide, W) });
    calls.push({ depth: DEPTH_HEAD,     draw: (g, s) => this.drawHead(g, j, skeleton, s) });

    calls.push({ depth: facingCamera ? DEPTH_NEAR_LIMB + 5 : DEPTH_FAR_LIMB + 10,
      draw: (g, s) => this.drawArm(g, j, s, nearSide, true) });

    return calls;
  }

  getAttachmentPoints(skeleton: Skeleton): Record<string, AttachmentPoint> {
    return { "hand-R": skeleton.attachments["hand-R"], "hand-L": skeleton.attachments["hand-L"] };
  }

  private drawTorso(g: Graphics, j: Record<string, V>, sk: Skeleton, s: number, nearSide: "L" | "R", W: number): void {
    const { iso } = sk;
    const nB = j.neckBase;
    const cL = { x: j.chestL.x * W, y: j.chestL.y }, cR = { x: j.chestR.x * W, y: j.chestR.y };
    const wL = { x: j.waistL.x * W * 1.15, y: j.waistL.y }, wR = { x: j.waistR.x * W * 1.15, y: j.waistR.y };
    const hL = { x: j.hipL.x * W, y: j.hipL.y }, hR = { x: j.hipR.x * W, y: j.hipR.y };

    g.moveTo(nB.x * s, nB.y * s);
    g.quadraticCurveTo(cR.x * s, (cR.y - 1) * s, cR.x * s, cR.y * s);
    g.quadraticCurveTo((wR.x + 2) * s, ((cR.y + wR.y) / 2) * s, wR.x * s, wR.y * s);
    g.lineTo(hR.x * s, hR.y * s);
    g.lineTo(hL.x * s, hL.y * s);
    g.lineTo(wL.x * s, wL.y * s);
    g.quadraticCurveTo((wL.x - 2) * s, ((cL.y + wL.y) / 2) * s, cL.x * s, cL.y * s);
    g.quadraticCurveTo(cL.x * s, (cL.y - 1) * s, nB.x * s, nB.y * s);
    g.closePath();
    g.fill(this.BELLY);

    // Directional shading
    const sideAmt = Math.abs(iso.x);
    if (sideAmt > 0.08) {
      const shadowIsRight = nearSide === "L";
      const sX = shadowIsRight ? cR : cL, sH = shadowIsRight ? hR : hL;
      const dir = shadowIsRight ? 1 : -1;
      const bW = sideAmt * 4.5;
      g.moveTo((sX.x - dir * bW) * s, sX.y * s);
      g.lineTo(sX.x * s, sX.y * s);
      g.lineTo(sH.x * s, sH.y * s);
      g.lineTo((sH.x - dir * bW) * s, sH.y * s);
      g.closePath();
      g.fill({ color: darken(this.BELLY, 0.25), alpha: sideAmt * 0.44 });
    }

    // War scar on torso
    g.moveTo((nB.x - 4) * s, (nB.y + 3) * s);
    g.lineTo((nB.x + 2) * s, (nB.y + 8) * s);
    g.stroke({ width: s * 0.6, color: this.WARPAINT, alpha: 0.3 });

    g.roundRect((nB.x - 4) * s, (nB.y - 1.5) * s, 8 * s, 3 * s, 2 * s);
    g.fill(this.SKIN);
  }

  private drawLeg(g: Graphics, j: Record<string, V>, sk: Skeleton, s: number, side: "L" | "R", isNear: boolean, W: number): void {
    const hip = j[`hip${side}`], knee = j[`knee${side}`], ankle = j[`ankle${side}`];
    const lC  = isNear ? this.SKIN : darken(this.SKIN, 0.07);
    const lTop: V = { x: hip.x * 0.6, y: hip.y };
    drawTaperedLimb(g, lTop, knee, 6, 5, lC, this.SKIN_DK, darken(lC, 0.35), s);
    g.ellipse(knee.x * s, knee.y * s, 3.2 * s, 2.2 * s); g.fill(lighten(lC, 0.04));
    g.ellipse(knee.x * s, knee.y * s, 3.2 * s, 2.2 * s); g.stroke({ width: s * 0.28, color: this.SKIN_DK, alpha: 0.22 });
    drawTaperedLimb(g, knee, ankle, 5, 4, lC, this.SKIN_DK, darken(lC, 0.35), s);
  }

  private drawArm(g: Graphics, j: Record<string, V>, s: number, side: "L" | "R", isNear: boolean): void {
    const shoulder = j[`shoulder${side}`], elbow = j[`elbow${side}`], wrist = j[`wrist${side}`];
    const aC = isNear ? this.SKIN : darken(this.SKIN, 0.07);
    drawTaperedLimb(g, shoulder, elbow, 5, 4.2, aC, this.SKIN_DK, darken(aC, 0.35), s);
    g.circle(elbow.x * s, elbow.y * s, 2.5 * s); g.fill(aC);
    drawTaperedLimb(g, elbow, wrist, 4, 3.5, aC, this.SKIN_DK, darken(aC, 0.35), s);
    g.circle(wrist.x * s, wrist.y * s, 3 * s); g.fill(aC);
  }

  private drawHead(g: Graphics, j: Record<string, V>, sk: Skeleton, s: number): void {
    const head = j.head;
    const { wf, iso } = sk;
    const faceCam = iso.y > 0;
    const sideView = Math.abs(iso.x) > 0.3;
    const r = 9;

    // Pointed ears
    if (sideView) {
      const eS = iso.x > 0 ? 1 : -1;
      const eBX = head.x + eS * r * wf * 0.85;
      g.poly([eBX * s, (head.y - 3) * s, (eBX + eS * 8) * s, (head.y - 1) * s, eBX * s, (head.y + 2) * s]);
      g.fill(this.SKIN);
    } else if (faceCam) {
      for (const eS of [-1, 1]) {
        const eBX = head.x + eS * r * wf * 0.8;
        g.poly([eBX * s, (head.y - 2) * s, (eBX + eS * 6) * s, (head.y - 0.5) * s, eBX * s, (head.y + 2) * s]);
        g.fill(this.SKIN);
      }
    }

    g.ellipse(head.x * s, head.y * s, r * wf * s, (r - 0.5) * s);
    g.fill(this.SKIN);

    // Directional skull shading
    if (Math.abs(iso.x) > 0.15) {
      const sEX = head.x - iso.x * r * wf * 0.88;
      const sX  = head.x - iso.x * r * wf * 0.1;
      g.moveTo(sEX * s, (head.y - (r - 0.5) * 0.6) * s);
      g.quadraticCurveTo((sEX - iso.x * 1.5) * s, head.y * s, sEX * s, (head.y + (r - 0.5) * 0.6) * s);
      g.lineTo(sX * s, (head.y + (r - 0.5) * 0.5) * s);
      g.quadraticCurveTo((sX - iso.x * 0.4) * s, head.y * s, sX * s, (head.y - (r - 0.5) * 0.5) * s);
      g.closePath();
      g.fill({ color: darken(this.SKIN, 0.22), alpha: Math.abs(iso.x) * 0.38 });
    }

    g.ellipse(head.x * s, head.y * s, r * wf * s, (r - 0.5) * s);
    g.stroke({ width: s * 0.6, color: this.SKIN_DK, alpha: 0.4 });

    // War paint stripes
    if (faceCam) {
      g.moveTo((head.x - 3 * wf) * s, (head.y - 2) * s);
      g.lineTo((head.x - 1 * wf) * s, (head.y + 3) * s);
      g.moveTo((head.x + 3 * wf) * s, (head.y - 2) * s);
      g.lineTo((head.x + 1 * wf) * s, (head.y + 3) * s);
      g.stroke({ width: s * 1, color: this.WARPAINT, alpha: 0.4 });
    }

    if (faceCam || (sideView && iso.y >= -0.1)) {
      const spread = 3.2 * wf;
      const eyeY  = head.y + 0.5 + iso.y * 0.8;
      const eyeOX = head.x + iso.x * 0.8;

      g.ellipse((eyeOX - spread) * s, eyeY * s, 2.5 * s, 2.0 * s); g.fill(0xffee88);
      g.ellipse((eyeOX + spread) * s, eyeY * s, 2.5 * s, 2.0 * s); g.fill(0xffee88);

      const iX = iso.x * 0.5;
      g.circle((eyeOX - spread + iX) * s, eyeY * s, 1.4 * s); g.fill(this.EYE);
      g.circle((eyeOX + spread + iX) * s, eyeY * s, 1.4 * s); g.fill(this.EYE);

      const pX = iso.x * 0.65;
      g.circle((eyeOX - spread + pX) * s, (eyeY + 0.1) * s, 0.6 * s); g.fill(0x111111);
      g.circle((eyeOX + spread + pX) * s, (eyeY + 0.1) * s, 0.6 * s); g.fill(0x111111);

      // Catch-lights
      g.circle((eyeOX - spread + pX + 0.5) * s, (eyeY - 0.3) * s, 0.28 * s); g.fill({ color: 0xffffff, alpha: 0.75 });
      g.circle((eyeOX + spread + pX + 0.5) * s, (eyeY - 0.3) * s, 0.28 * s); g.fill({ color: 0xffffff, alpha: 0.75 });

      if (faceCam) {
        const mY = head.y + 5;
        for (const side of [-1, 1]) {
          g.poly([(head.x + side * 2.5 * wf) * s, mY * s, (head.x + side * 3 * wf) * s, (mY - 3) * s, (head.x + side * 1.8 * wf) * s, mY * s]);
          g.fill(0xeeddcc);
        }
      }
    }

    // Feathered headdress
    const featherBase = head.y - r + 1;
    for (let i = 0; i < 3; i++) {
      const fx  = head.x + (i - 1) * 2.5 * wf;
      const ang = (i - 1) * 0.3;
      const tipX = fx + Math.sin(ang) * 3;
      const tipY = featherBase - 8 - i * 1.5;

      g.moveTo((fx - 0.5) * s, featherBase * s);
      g.quadraticCurveTo((tipX - 1) * s, (tipY + 3) * s, tipX * s, tipY * s);
      g.quadraticCurveTo((tipX + 1) * s, (tipY + 3) * s, (fx + 0.5) * s, featherBase * s);
      g.closePath();
      const fColor = i === 1 ? this.FEATHER : darken(this.FEATHER, 0.15);
      g.fill(fColor);
      // Feather highlight spine
      g.moveTo(fx * s, featherBase * s);
      g.lineTo(tipX * s, tipY * s);
      g.stroke({ width: s * 0.35, color: darken(fColor, 0.15), alpha: 0.4 });
    }
  }
}
