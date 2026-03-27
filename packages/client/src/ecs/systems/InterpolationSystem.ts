import { EntityManager } from "../EntityManager";
import type { PositionComponent } from "../components/Position";

// Tuned to reach target in ~1 server tick (50ms at 20Hz).
// Higher = snappier but can overshoot, lower = smoother but sluggish.
const LERP_SPEED = 18;

export class InterpolationSystem {
  private entityManager: EntityManager;

  constructor(entityManager: EntityManager) {
    this.entityManager = entityManager;
  }

  update(dt: number) {
    for (const entity of this.entityManager.iterEntitiesWithComponents("position")) {
      const pos = entity.components.get("position") as PositionComponent;
      if (!pos.isRemote) continue;

      const t = Math.min(1, LERP_SPEED * dt);

      pos.x += (pos.remoteTargetX - pos.x) * t;
      pos.y += (pos.remoteTargetY - pos.y) * t;
      pos.z += (pos.remoteTargetZ - pos.z) * t;

      // Interpolate rotation (handle wraparound)
      let rotDiff = pos.remoteTargetRotation - pos.rotation;
      if (rotDiff > Math.PI) rotDiff -= Math.PI * 2;
      if (rotDiff < -Math.PI) rotDiff += Math.PI * 2;
      pos.rotation += rotDiff * t;
    }
  }
}
