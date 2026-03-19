import { EntityManager } from "../EntityManager";
import type { PositionComponent } from "../components/Position";
import type { MovementComponent } from "../components/Movement";

export class MovementSystem {
  private entityManager: EntityManager;

  constructor(entityManager: EntityManager) {
    this.entityManager = entityManager;
  }

  update(dt: number) {
    const entities = this.entityManager.getEntitiesWithComponents("position", "movement");

    for (const entity of entities) {
      const pos = entity.components.get("position") as PositionComponent;
      const mov = entity.components.get("movement") as MovementComponent;

      if (!mov.moving) {
        // Check for queued movement
        if (mov.queuedDx !== 0 || mov.queuedDz !== 0) {
          this.startMove(mov, mov.queuedDx, mov.queuedDz);
          mov.queuedDx = 0;
          mov.queuedDz = 0;
        }
        continue;
      }

      // Advance interpolation
      mov.progress += mov.speed * dt;

      if (mov.progress >= 1) {
        // Arrived at target tile
        mov.progress = 1;
        mov.moving = false;
        mov.tileX = mov.targetX;
        mov.tileZ = mov.targetZ;

        const oldX = pos.x;
        const oldZ = pos.z;
        pos.x = mov.tileX;
        pos.z = mov.tileZ;
        this.entityManager.updateSpatialIndex(entity.id, oldX, oldZ, pos.x, pos.z);

        // Immediately start queued move for responsive chaining
        if (mov.queuedDx !== 0 || mov.queuedDz !== 0) {
          this.startMove(mov, mov.queuedDx, mov.queuedDz);
          mov.queuedDx = 0;
          mov.queuedDz = 0;
        }
      } else {
        // Smooth lerp between tiles
        const oldX = pos.x;
        const oldZ = pos.z;
        pos.x = mov.tileX + (mov.targetX - mov.tileX) * mov.progress;
        pos.z = mov.tileZ + (mov.targetZ - mov.tileZ) * mov.progress;
        this.entityManager.updateSpatialIndex(entity.id, oldX, oldZ, pos.x, pos.z);
      }
    }
  }

  private startMove(mov: MovementComponent, dx: number, dz: number) {
    mov.targetX = mov.tileX + dx;
    mov.targetZ = mov.tileZ + dz;
    mov.progress = 0;
    mov.moving = true;
  }
}
