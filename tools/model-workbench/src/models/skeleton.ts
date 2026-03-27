import type { Skeleton, V, Direction, AttachmentPoint } from "./types";
import { ISO_OFFSETS, DEFAULT_SLOT_PARAMS } from "./types";

/** Helper: neutral attachment point (override params in body models) */
function ap(position: V, angle: number, wf: number): AttachmentPoint {
  return { position, angle, wf, params: { ...DEFAULT_SLOT_PARAMS } };
}

/**
 * Compute a humanoid skeleton for the given direction and walk phase.
 * Returns named joints + attachment points that models read from.
 */
export function computeHumanoidSkeleton(
  dir: Direction,
  walkPhase: number,
  buildScale: number = 1,
  heightScale: number = 1,
  combatPhase: number = 0
): Skeleton {
  const iso = ISO_OFFSETS[dir] ?? ISO_OFFSETS[0];
  const w = walkPhase !== 0;
  const swing = w ? Math.sin(walkPhase) : 0;
  const bob = w ? -Math.abs(Math.sin(walkPhase * 2)) * 1.6 : 0;

  // Build/height affect the base position helper
  const bw = buildScale;  // width multiplier
  const bh = heightScale; // height multiplier

  const wf = 1 - Math.abs(iso.x) * 0.35;
  const lx = iso.x * 2.5;
  const ly = iso.y * 1.2;

  const hipRot = w ? swing * 0.06 : 0;
  const lsFwd = swing * 4.5;
  const lsBck = -swing * 4.5;
  const armFwd = -swing * 3.5;
  const armBck = swing * 3.5;
  const fwdX = iso.y;
  const fwdY = -Math.abs(iso.x) * 0.6;
  const liftL = swing > 0.2 ? -(swing - 0.2) * 2.5 : 0;
  const liftR = swing < -0.2 ? (swing + 0.2) * 2.5 : 0;
  const elbowBendL = w ? Math.max(0, -swing) * 2.5 : 0;
  const elbowBendR = w ? Math.max(0, swing) * 2.5 : 0;

  const p = (bx: number, by: number, offX = 0, offY = 0): V => ({
    x: bx * wf * bw + lx + offX,
    y: by * bh + bob + ly * 0.3 + offY,
  });

  // All joint positions
  const joints: Record<string, V> = {
    head: p(0, -39),
    neckBase: p(0, -32),
    shoulderL: p(-8.5 - hipRot * 5, -29),
    shoulderR: p(8.5 + hipRot * 5, -29),
    chestL: p(-8, -28),
    chestR: p(8, -28),
    waistL: p(-5, -20),
    waistR: p(5, -20),
    hipL: p(-5.5 + hipRot * 2, -16.5),
    hipR: p(5.5 - hipRot * 2, -16.5),
    crotch: p(0, -15.5),
    elbowL: p(-9.5, -23, armFwd * fwdX * 0.5, armFwd * fwdY * 0.5 - elbowBendL),
    elbowR: p(9.5, -23, armBck * fwdX * 0.5, armBck * fwdY * 0.5 - elbowBendR),
    wristL: p(-8.5, -15.5, armFwd * fwdX, armFwd * fwdY),
    wristR: p(8.5, -15.5, armBck * fwdX, armBck * fwdY),
    kneeL: p(-3, -6.5, lsFwd * fwdX * 0.5, lsFwd * fwdY * 0.3),
    kneeR: p(3, -6.5, lsBck * fwdX * 0.5, lsBck * fwdY * 0.3),
    ankleL: p(-2.5, -1.5, lsFwd * fwdX * 0.8, lsFwd * fwdY * 0.5 + liftL),
    ankleR: p(2.5, -1.5, lsBck * fwdX * 0.8, lsBck * fwdY * 0.5 + liftR),
    toeL: p(-2, 1, lsFwd * fwdX * 0.3, lsFwd * fwdY * 0.2 + liftL * 0.5),
    toeR: p(2, 1, lsBck * fwdX * 0.3, lsBck * fwdY * 0.2 + liftR * 0.5),
  };

  // ─── Combat animation override ───────────────────────────────────────
  // When combatPhase != 0, override arm joints with attack-swing positions.
  // sin(phase): 0=idle, +1=strike, 0=follow-through, -1=wind-up
  // cos(phase): 1=idle/recovery, 0=strike/wind-up, -1=opposite
  //
  // Full cycle:  0=idle  →  π/2=strike  →  π=follow-through  →  3π/2=wind-up  →  2π=idle
  if (combatPhase !== 0) {
    const cs = Math.sin(combatPhase);   // +1=strike, -1=wind-up
    const cc = Math.cos(combatPhase);   // +1=idle, -1=follow-through peak

    // Weapon arm (R): large sweeping strike
    const rFwd = cs * 10;              // +10 forward at strike, -10 back at wind-up
    const rUp  = -Math.max(0, -cs) * 6; // arm raises during wind-up only

    joints.elbowR = {
      x: (9.5 + cs * 2) * wf * buildScale + lx + rFwd * 0.4 * fwdX,
      y: (-23 + rUp) * heightScale + bob + rFwd * 0.4 * fwdY + ly * 0.3,
    };
    joints.wristR = {
      x: (8.5 + cs * 3) * wf * buildScale + lx + rFwd * 0.85 * fwdX,
      y: (-15.5 + rUp * 0.6 + cs * 3) * heightScale + bob + rFwd * 0.85 * fwdY + ly * 0.3,
    };

    // Offhand arm (L): defensive guard — raised forward, static
    const lFwd = 4 + Math.max(0, -cs) * 2; // slightly more forward during wind-up
    joints.elbowL = {
      x: (-9.5) * wf * buildScale + lx + lFwd * 0.4 * fwdX,
      y: (-25) * heightScale + bob + lFwd * 0.4 * fwdY + ly * 0.3,
    };
    joints.wristL = {
      x: (-8.5) * wf * buildScale + lx + lFwd * 0.85 * fwdX,
      y: (-20) * heightScale + bob + lFwd * 0.85 * fwdY + ly * 0.3,
    };

    // Body lean into the strike
    const lean = Math.max(0, cs) * 2;
    joints.head    = { x: joints.head.x    + lean * fwdX * 0.35, y: joints.head.y    + lean * fwdY * 0.35 };
    joints.neckBase= { x: joints.neckBase.x + lean * fwdX * 0.25, y: joints.neckBase.y + lean * fwdY * 0.25 };

    // Slight combat crouch — lower the hips a touch during strike
    const crouch = Math.max(0, cs) * 1.5;
    for (const key of ["hipL","hipR","crotch","kneeL","kneeR","ankleL","ankleR","toeL","toeR"] as const) {
      joints[key] = { x: joints[key].x, y: joints[key].y + crouch };
    }
  }

  // Compute attachment points from joints (neutral params — bodies override per their proportions)
  const attachments: Record<string, AttachmentPoint> = {
    "head-top": ap({ x: joints.head.x, y: joints.head.y - 8 }, 0, wf),
    "hand-R": ap(joints.wristR, Math.atan2(joints.wristR.y - joints.elbowR.y, joints.wristR.x - joints.elbowR.x), wf),
    "hand-L": ap(joints.wristL, Math.atan2(joints.wristL.y - joints.elbowL.y, joints.wristL.x - joints.elbowL.x), wf),
    torso: ap({ x: (joints.shoulderL.x + joints.shoulderR.x) / 2, y: (joints.neckBase.y + joints.hipL.y) / 2 }, 0, wf),
    "torso-back": ap({ x: (joints.shoulderL.x + joints.shoulderR.x) / 2, y: (joints.neckBase.y + joints.hipL.y) / 2 }, Math.PI, wf),
    shoulders: ap({ x: (joints.shoulderL.x + joints.shoulderR.x) / 2, y: (joints.shoulderL.y + joints.shoulderR.y) / 2 }, 0, wf),
    gauntlets: ap({ x: (joints.elbowL.x + joints.elbowR.x) / 2, y: (joints.elbowL.y + joints.elbowR.y) / 2 }, 0, wf),
    legs: ap({ x: (joints.hipL.x + joints.hipR.x) / 2, y: joints.hipL.y }, 0, wf),
    "feet-L": ap(joints.ankleL, Math.atan2(joints.toeL.y - joints.ankleL.y, joints.toeL.x - joints.ankleL.x), wf),
    "feet-R": ap(joints.ankleR, Math.atan2(joints.toeR.y - joints.ankleR.y, joints.toeR.x - joints.ankleR.x), wf),
  };

  return {
    joints,
    attachments,
    bob,
    wf,
    iso,
    direction: dir,
    walkPhase,
  };
}
