import { EntityManager } from "../EntityManager";
import type { PositionComponent } from "../components/Position";

const LERP_SPEED = 10; // Higher = snappier, lower = smoother

export class InterpolationSystem {
  private entityManager: EntityManager;

  constructor(entityManager: EntityManager) {
    this.entityManager = entityManager;
  }

  update(dt: number) {
    const entities = this.entityManager.getEntitiesWithComponents("position");

    for (const entity of entities) {
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
