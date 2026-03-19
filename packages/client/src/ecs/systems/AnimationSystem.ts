import { EntityManager } from "../EntityManager";
import type { MovementComponent } from "../components/Movement";
import type { RenderableComponent } from "../components/Renderable";

export class AnimationSystem {
  private entityManager: EntityManager;
  private bobPhase = new Map<string, number>();

  constructor(entityManager: EntityManager) {
    this.entityManager = entityManager;
  }

  update(dt: number) {
    const entities = this.entityManager.getEntitiesWithComponents("renderable", "movement");

    for (const entity of entities) {
      const mov = entity.components.get("movement") as MovementComponent;
      const render = entity.components.get("renderable") as RenderableComponent;

      if (!render.mesh) continue;

      const isMoving = mov.moving;

      if (isMoving) {
        // Walking bob animation
        let phase = this.bobPhase.get(entity.id) || 0;
        phase += dt * 10;
        this.bobPhase.set(entity.id, phase);

        const bobOffset = Math.sin(phase) * 0.05;
        render.mesh.position.y = 0.6 + bobOffset;
      } else {
        // Reset to standing position
        render.mesh.position.y = 0.6;
        this.bobPhase.delete(entity.id);
      }
    }
  }
}
