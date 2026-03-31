import type { Graphics } from "pixi.js";
import type { Model, RenderContext, DrawCall, Skeleton, AttachmentPoint, V } from "../types";
import { DEPTH_SHADOW, DEPTH_FAR_LIMB, DEPTH_BODY, DEPTH_HEAD, DEPTH_NEAR_LIMB } from "../types";
import { darken, lighten } from "../palette";
import { drawTaperedLimb } from "../draw-helpers";

/**
 * Imp Overlord — boss variant. Larger, deeper crimson, bigger wings,
 * flaming crown of horns, fire aura. Near/far toning + catch-lights.
 */
export class ImpOverlord implements Model {
  readonly id = "imp-overlord";
  readonly name = "Imp Overlord";
  readonly category = "npc" as const;
  readonly slot = "root" as const;

  private readonly SKIN    = 0x661111;
  private readonly SKIN_DK = 0x440808;
  private readonly HORN    = 0x221111;
  private readonly WING    = 0x441111;
  private readonly EYE     = 0xff8800;
  private readonly FIRE    = 0xff4400;

  getDrawCalls(ctx: RenderContext): DrawCall[] {
    const { skeleton, facingCamera, nearSide, farSide } = ctx;
    const j = skeleton.joints;
    const { iso, walkPhase, wf } = skeleton;
    const SC = 1.3;
    const calls: DrawCall[] = [];

    calls.push({ depth: DEPTH_SHADOW - 1, draw: (g, s) => {
      g.ellipse(0, -8 * s, 14 * SC * s, 18 * SC * s);
      g.fill({ color: this.FIRE, alpha: 0.04 });
    }});

    calls.push({ depth: DEPTH_SHADOW, draw: (g, s) => {
      g.ellipse(iso.x * s, 2 * s, 10 * SC * s, 3.5 * SC * s);
      g.fill({ color: 0x000000, alpha: 0.18 });
    }});

    // Bigger wings
    calls.push({ depth: DEPTH_SHADOW + 5, draw: (g, s) => {
      const shoulder = { x: (j.shoulderL.x + j.shoulderR.x) / 2, y: j.shoulderL.y };
      const flap = walkPhase !== 0 ? Math.sin(walkPhase * 3) * 4 : 0;

      for (const side of [-1, 1]) {
        const bx = shoulder.x + side * 3 * wf;
        const by = shoulder.y - 1;
        const tipX = bx + side * 18 * SC, tipY = by - 8 * SC + flap * side;
        const midX = bx + side * 13 * SC, midY = by + 5 * SC + flap * side * 0.5;

        const wAlpha = side === 1 ? (iso.x > 0 ? 0.7 : 0.5) : (iso.x < 0 ? 0.7 : 0.5);
        g.moveTo(bx * s, by * s);
        g.quadraticCurveTo((bx + side * 9 * SC) * s, (by - 10 * SC + flap * side) * s, tipX * s, tipY * s);
        g.quadraticCurveTo((midX + side * 2) * s, (by - 1) * s, midX * s, midY * s);
        g.lineTo(bx * s, (by + 6 * SC) * s);
        g.closePath();
        g.fill({ color: this.WING, alpha: wAlpha });

        g.moveTo(bx * s, by * s); g.lineTo(tipX * s, tipY * s);
        g.stroke({ width: s * SC, color: this.SKIN_DK, alpha: 0.5 });
        g.moveTo(bx * s, by * s); g.lineTo(midX * s, midY * s);
        g.stroke({ width: s * 0.8 * SC, color: this.SKIN_DK, alpha: 0.4 });
      }
    }});

    // Tail
    calls.push({ depth: DEPTH_SHADOW + 8, draw: (g, s) => {
      const crotch = j.crotch;
      const sway = walkPhase !== 0 ? Math.sin(walkPhase * 2) * 2.5 : 0;
      const endX = crotch.x - iso.x * 12 * SC + sway;
      const endY = crotch.y + 3;
      g.moveTo(crotch.x * s, crotch.y * s);
      g.quadraticCurveTo((crotch.x - iso.x * 6 * SC + sway * 0.5) * s, (crotch.y + 6) * s, endX * s, endY * s);
      g.stroke({ width: s * 1.5 * SC, color: this.SKIN_DK });
      // Flaming tip
      g.circle(endX * s, endY * s, 2 * SC * s); g.fill({ color: this.FIRE, alpha: 0.65 });
      g.circle(endX * s, endY * s, 1.2 * SC * s); g.fill({ color: this.EYE, alpha: 0.75 });
    }});

    calls.push({ depth: DEPTH_FAR_LIMB,     draw: (g, s) => this.drawLeg(g, j, skeleton, s, farSide,  false, SC) });
    calls.push({ depth: DEPTH_FAR_LIMB + 2, draw: (g, s) => this.drawLeg(g, j, skeleton, s, nearSide, true,  SC) });

    calls.push({ depth: facingCamera ? DEPTH_FAR_LIMB + 4 : DEPTH_NEAR_LIMB,
      draw: (g, s) => this.drawArm(g, j, s, farSide, false, SC) });

    // Torso
    calls.push({ depth: DEPTH_BODY, draw: (g, s) => {
      const nB = j.neckBase;
      const W = 0.85;
      const cL = { x: j.chestL.x * W, y: j.chestL.y }, cR = { x: j.chestR.x * W, y: j.chestR.y };
      const hL = { x: j.hipL.x * W,   y: j.hipL.y   }, hR = { x: j.hipR.x * W,   y: j.hipR.y   };

      g.moveTo(nB.x * s, nB.y * s);
      g.quadraticCurveTo(cR.x * s, cR.y * s, cR.x * s, (cR.y + 2) * s);
      g.lineTo(hR.x * s, hR.y * s); g.lineTo(hL.x * s, hL.y * s);
      g.lineTo(cL.x * s, (cL.y + 2) * s);
      g.quadraticCurveTo(cL.x * s, cL.y * s, nB.x * s, nB.y * s);
      g.closePath(); g.fill(this.SKIN);
      g.roundRect((nB.x - 1.5) * s, (nB.y - 2) * s, 3 * s, 3 * s, 1 * s);
      g.fill(this.SKIN);
    }});

    calls.push({ depth: DEPTH_HEAD,     draw: (g, s) => this.drawHead(g, j, skeleton, s, SC) });

    calls.push({ depth: facingCamera ? DEPTH_NEAR_LIMB + 5 : DEPTH_FAR_LIMB + 5,
      draw: (g, s) => this.drawArm(g, j, s, nearSide, true, SC) });

    return calls;
  }

  getAttachmentPoints(skeleton: Skeleton): Record<string, AttachmentPoint> {
    return { "hand-R": skeleton.attachments["hand-R"], "hand-L": skeleton.attachments["hand-L"] };
  }

  private drawLeg(g: Graphics, j: Record<string, V>, sk: Skeleton, s: number, side: "L" | "R", isNear: boolean, SC: number): void {
    const hip = j[`hip${side}`], knee = j[`knee${side}`], ankle = j[`ankle${side}`];
    const lC = isNear ? this.SKIN : darken(this.SKIN, 0.08);
    drawTaperedLimb(g, { x: hip.x * 0.4, y: hip.y }, knee, 4 * SC, 3 * SC, lC, this.SKIN_DK, darken(lC, 0.3), s);
    drawTaperedLimb(g, knee, ankle, 3 * SC, 2.5 * SC, lC, this.SKIN_DK, darken(lC, 0.3), s);
  }

  private drawArm(g: Graphics, j: Record<string, V>, s: number, side: "L" | "R", isNear: boolean, SC: number): void {
    const shoulder = j[`shoulder${side}`], elbow = j[`elbow${side}`], wrist = j[`wrist${side}`];
    const aC = isNear ? this.SKIN : darken(this.SKIN, 0.08);
    drawTaperedLimb(g, shoulder, elbow, 3 * SC, 2.5 * SC, aC, this.SKIN_DK, darken(aC, 0.3), s);
    drawTaperedLimb(g, elbow, wrist, 2.5 * SC, 2 * SC, aC, this.SKIN_DK, darken(aC, 0.3), s);
    g.circle(wrist.x * s, wrist.y * s, 2 * SC * s); g.fill(aC);
  }

  private drawHead(g: Graphics, j: Record<string, V>, sk: Skeleton, s: number, SC: number): void {
    const head = j.head;
    const { wf, iso } = sk;
    const faceCam = iso.y > 0;
    const r = 7 * SC;

    // Crown of horns
    for (let i = 0; i < 4; i++) {
      const ang  = (i / 4) * Math.PI * 2 - Math.PI * 0.25;
      const bX   = head.x + Math.cos(ang) * r * 0.5 * wf;
      const bY   = head.y - r + 1 + Math.sin(ang) * 2;
      const tX   = bX + Math.cos(ang) * 5 * SC;
      const tY   = bY - 6 * SC;

      g.moveTo(bX * s, bY * s);
      g.quadraticCurveTo((bX + Math.cos(ang) * 3 * SC) * s, (bY - 2) * s, tX * s, tY * s);
      g.quadraticCurveTo((bX + Math.cos(ang) * 1.5 * SC) * s, (bY - 3) * s, (bX - Math.cos(ang) * 0.5) * s, bY * s);
      g.closePath(); g.fill(this.HORN);

      // Horn ridge
      g.moveTo(bX * s, bY * s); g.lineTo(tX * s, tY * s);
      g.stroke({ width: s * 0.3, color: darken(this.HORN, 0.15), alpha: 0.4 });
    }

    // Head
    g.ellipse(head.x * s, head.y * s, r * wf * 0.7 * s, (r - 0.5) * 0.7 * s);
    g.fill(this.SKIN);

    // Directional skull shading
    if (Math.abs(iso.x) > 0.15) {
      const rEff = r * 0.7;
      const sEX  = head.x - iso.x * rEff * wf * 0.88;
      const sX   = head.x - iso.x * rEff * wf * 0.1;
      g.moveTo(sEX * s, (head.y - (r - 0.5) * 0.7 * 0.6) * s);
      g.quadraticCurveTo((sEX - iso.x * 1.2) * s, head.y * s, sEX * s, (head.y + (r - 0.5) * 0.7 * 0.6) * s);
      g.lineTo(sX * s, (head.y + (r - 0.5) * 0.7 * 0.5) * s);
      g.quadraticCurveTo((sX - iso.x * 0.3) * s, head.y * s, sX * s, (head.y - (r - 0.5) * 0.7 * 0.5) * s);
      g.closePath();
      g.fill({ color: darken(this.SKIN, 0.22), alpha: Math.abs(iso.x) * 0.38 });
    }

    g.ellipse(head.x * s, head.y * s, r * wf * 0.7 * s, (r - 0.5) * 0.7 * s);
    g.stroke({ width: s * 0.5, color: this.SKIN_DK, alpha: 0.4 });

    if (faceCam || Math.abs(iso.x) > 0.3) {
      const spread = 2.5 * wf;
      const eyeY  = head.y + 0.5 + iso.y * 0.6;
      const eyeOX = head.x + iso.x * 0.6;

      // Orange iris
      g.ellipse((eyeOX - spread) * s, eyeY * s, 2.2 * s, 1.7 * s); g.fill(this.EYE);
      g.ellipse((eyeOX + spread) * s, eyeY * s, 2.2 * s, 1.7 * s); g.fill(this.EYE);

      // Slit pupils (directional)
      const iX = iso.x * 0.4;
      g.ellipse((eyeOX - spread + iX) * s, eyeY * s, 0.6 * s, 1.4 * s); g.fill(0x111111);
      g.ellipse((eyeOX + spread + iX) * s, eyeY * s, 0.6 * s, 1.4 * s); g.fill(0x111111);

      // Fire glow
      g.ellipse((eyeOX - spread) * s, eyeY * s, 3 * s, 2.5 * s); g.fill({ color: this.FIRE, alpha: 0.12 });
      g.ellipse((eyeOX + spread) * s, eyeY * s, 3 * s, 2.5 * s); g.fill({ color: this.FIRE, alpha: 0.12 });

      // Catch-lights
      const pX = iso.x * 0.5;
      g.circle((eyeOX - spread + pX + 0.45) * s, (eyeY - 0.3) * s, 0.28 * s); g.fill({ color: 0xffffff, alpha: 0.7 });
      g.circle((eyeOX + spread + pX + 0.45) * s, (eyeY - 0.3) * s, 0.28 * s); g.fill({ color: 0xffffff, alpha: 0.7 });
    }
  }
}
