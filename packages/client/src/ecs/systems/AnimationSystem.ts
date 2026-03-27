import { EntityManager } from "../EntityManager";
import type { MovementComponent } from "../components/Movement";
import type { RenderableComponent } from "../components/Renderable";
import type { PositionComponent } from "../components/Position";

export class AnimationSystem {
  private entityManager: EntityManager;
  private bobPhase = new Map<string, number>();
  private baseScale = new Map<string, number>();
  private prevPos = new Map<string, { x: number; z: number }>();

  constructor(entityManager: EntityManager) {
    this.entityManager = entityManager;

    // Clean up internal Maps when entities are removed to prevent memory leaks
    entityManager.onEntityRemoved((id) => {
      this.bobPhase.delete(id);
      this.baseScale.delete(id);
      this.prevPos.delete(id);
    });
  }

  update(dt: number) {
    for (const entity of this.entityManager.iterEntitiesWithComponents("renderable", "movement", "position")) {
      const mov = entity.components.get("movement") as MovementComponent;
      const render = entity.components.get("renderable") as RenderableComponent;
      const pos = entity.components.get("position") as PositionComponent;

      if (!render.displayObject) continue;
      // Don't interfere with spawn-in animation
      if ((render.displayObject as any)._spawning) continue;

      // For remote entities, detect movement from position delta
      const isMoving = mov.moving || (() => {
        if (!pos.isRemote) return false;
        const prev = this.prevPos.get(entity.id);
        this.prevPos.set(entity.id, { x: pos.x, z: pos.z });
        if (!prev) return false;
        return Math.abs(pos.x - prev.x) > 0.01 || Math.abs(pos.z - prev.z) > 0.01;
      })();

      if (isMoving) {
        // Walking bob + sway animation
        let phase = this.bobPhase.get(entity.id) || 0;
        phase += dt * 10;
        this.bobPhase.set(entity.id, phase);
        (render.displayObject as any)._bobOffset = Math.sin(phase) * 2.5;
        // Slight body sway while walking
        render.displayObject.skew.x = Math.sin(phase) * 0.04;
        // Restore uniform scale from breathing
        if (this.baseScale.has(entity.id)) {
          const s = this.baseScale.get(entity.id)!;
          render.displayObject.scale.set(s);
          this.baseScale.delete(entity.id);
        }
      } else {
        // Reset walk sway
        render.displayObject.skew.x = 0;
        // Idle breathing — subtle scale pulse (uniform X+Y to avoid squishing)
        if (!this.baseScale.has(entity.id)) {
          this.baseScale.set(entity.id, render.displayObject.scale.x);
        }
        let phase = this.bobPhase.get(entity.id) ?? (Math.random() * Math.PI * 2);
        phase += dt * 1.5;
        this.bobPhase.set(entity.id, phase);
        const s = this.baseScale.get(entity.id)!;
        const breath = s * (1 + Math.sin(phase) * 0.015);
        render.displayObject.scale.set(breath);
        (render.displayObject as any)._bobOffset = 0;
      }
    }
  }
}
