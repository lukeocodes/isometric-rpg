import type { Skeleton, V, Direction, AttachmentPoint, FitmentCorners } from "./types";
import { ISO_OFFSETS, DEFAULT_SLOT_PARAMS } from "./types";

/**
 * Compute a humanoid skeleton for the given direction and walk phase.
 * Returns named joints + attachment points that models read from.
 */
export function computeHumanoidSkeleton(
  dir: Direction,
  walkPhase: number,
  buildScale: number = 1,
  heightScale: number = 1
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

  // ─── Helper: make attachment point with optional fitment corners ─────────
  const apc = (position: V, angle: number, wf: number, corners?: FitmentCorners): AttachmentPoint => ({
    position, angle, wf, params: { ...DEFAULT_SLOT_PARAMS }, corners,
  });

  // Compute attachment points from joints (neutral params — bodies override per their proportions)
  const attachments: Record<string, AttachmentPoint> = {
    "head-top": apc(
      { x: joints.head.x, y: joints.head.y - 8 }, 0, wf,
      // Head corners: square around the head
      {
        tl: { x: joints.head.x - 7 * wf, y: joints.head.y - 8 },
        tr: { x: joints.head.x + 7 * wf, y: joints.head.y - 8 },
        bl: { x: joints.head.x - 7 * wf, y: joints.head.y + 4 },
        br: { x: joints.head.x + 7 * wf, y: joints.head.y + 4 },
      }
    ),

    "hand-R": apc(
      joints.wristR,
      Math.atan2(joints.wristR.y - joints.elbowR.y, joints.wristR.x - joints.elbowR.x),
      wf
    ),
    "hand-L": apc(
      joints.wristL,
      Math.atan2(joints.wristL.y - joints.elbowL.y, joints.wristL.x - joints.elbowL.x),
      wf
    ),

    torso: apc(
      { x: (joints.shoulderL.x + joints.shoulderR.x) / 2, y: (joints.neckBase.y + joints.hipL.y) / 2 },
      0, wf,
      // Torso corners: shoulder-to-hip bounding quad (adapts to all body shapes)
      {
        tl: { x: joints.shoulderL.x, y: joints.neckBase.y },
        tr: { x: joints.shoulderR.x, y: joints.neckBase.y },
        bl: { x: joints.hipL.x,      y: joints.hipL.y },
        br: { x: joints.hipR.x,      y: joints.hipR.y },
      }
    ),
    "torso-back": apc(
      { x: (joints.shoulderL.x + joints.shoulderR.x) / 2, y: (joints.neckBase.y + joints.hipL.y) / 2 },
      Math.PI, wf,
      {
        tl: { x: joints.shoulderL.x, y: joints.neckBase.y },
        tr: { x: joints.shoulderR.x, y: joints.neckBase.y },
        bl: { x: joints.hipL.x,      y: joints.hipL.y },
        br: { x: joints.hipR.x,      y: joints.hipR.y },
      }
    ),

    shoulders: apc(
      { x: (joints.shoulderL.x + joints.shoulderR.x) / 2, y: (joints.shoulderL.y + joints.shoulderR.y) / 2 },
      0, wf,
      // Shoulder corners: from shoulder joints down to elbow level
      {
        tl: { x: joints.shoulderL.x - 3 * wf, y: joints.shoulderL.y - 2 },
        tr: { x: joints.shoulderR.x + 3 * wf, y: joints.shoulderR.y - 2 },
        bl: { x: joints.elbowL.x,             y: joints.elbowL.y },
        br: { x: joints.elbowR.x,             y: joints.elbowR.y },
      }
    ),

    gauntlets: apc(
      { x: (joints.elbowL.x + joints.elbowR.x) / 2, y: (joints.elbowL.y + joints.elbowR.y) / 2 },
      0, wf,
      // Gauntlet corners: elbow-to-wrist (both sides, averaged — per-side handled in model)
      {
        tl: { x: joints.elbowL.x,  y: joints.elbowL.y },
        tr: { x: joints.elbowR.x,  y: joints.elbowR.y },
        bl: { x: joints.wristL.x,  y: joints.wristL.y },
        br: { x: joints.wristR.x,  y: joints.wristR.y },
      }
    ),

    legs: apc(
      { x: (joints.hipL.x + joints.hipR.x) / 2, y: joints.hipL.y },
      0, wf,
      // Leg corners: hip-to-ankle (both sides, averaged — per-side handled in model)
      {
        tl: { x: joints.hipL.x,    y: joints.hipL.y },
        tr: { x: joints.hipR.x,    y: joints.hipR.y },
        bl: { x: joints.ankleL.x,  y: joints.ankleL.y },
        br: { x: joints.ankleR.x,  y: joints.ankleR.y },
      }
    ),

    "feet-L": apc(
      joints.ankleL,
      Math.atan2(joints.toeL.y - joints.ankleL.y, joints.toeL.x - joints.ankleL.x),
      wf,
      {
        tl: { x: joints.ankleL.x - 2 * wf, y: joints.ankleL.y - 1 },
        tr: { x: joints.ankleL.x + 2 * wf, y: joints.ankleL.y - 1 },
        bl: { x: joints.toeL.x - 1,         y: joints.toeL.y + 1 },
        br: { x: joints.toeL.x + 1,         y: joints.toeL.y + 1 },
      }
    ),
    "feet-R": apc(
      joints.ankleR,
      Math.atan2(joints.toeR.y - joints.ankleR.y, joints.toeR.x - joints.ankleR.x),
      wf,
      {
        tl: { x: joints.ankleR.x - 2 * wf, y: joints.ankleR.y - 1 },
        tr: { x: joints.ankleR.x + 2 * wf, y: joints.ankleR.y - 1 },
        bl: { x: joints.toeR.x - 1,         y: joints.toeR.y + 1 },
        br: { x: joints.toeR.x + 1,         y: joints.toeR.y + 1 },
      }
    ),
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
