import { EntityManager } from "../EntityManager";
import type { PositionComponent } from "../components/Position";
import type { MovementComponent } from "../components/Movement";

/** Max per-tile height difference (world units) the player can walk across */
const MAX_TILE_HEIGHT_DIFF = 0.8;

export class MovementSystem {
  private entityManager: EntityManager;
  private terrainYResolver: ((x: number, z: number) => number) | null = null;
  private walkableResolver: ((x: number, z: number) => boolean) | null = null;

  constructor(entityManager: EntityManager) {
    this.entityManager = entityManager;
  }

  setTerrainResolvers(
    terrainY: (x: number, z: number) => number,
    walkable?: (x: number, z: number) => boolean,
  ) {
    this.terrainYResolver = terrainY;
    this.walkableResolver = walkable ?? null;
  }

  update(dt: number) {
    for (const entity of this.entityManager.iterEntitiesWithComponents("position", "movement")) {
      const pos = entity.components.get("position") as PositionComponent;
      const mov = entity.components.get("movement") as MovementComponent;

      // Remote entities are driven by InterpolationSystem, not MovementSystem
      if (pos.isRemote) continue;

      if (!mov.moving) {
        // Auto-correct idle local entities to tile position if drifted
        if (Math.abs(pos.x - mov.tileX) > 0.01 || Math.abs(pos.z - mov.tileZ) > 0.01) {
          pos.x = mov.tileX;
          pos.z = mov.tileZ;
        }

        if (mov.queuedDx !== 0 || mov.queuedDz !== 0) {
          this.startMove(pos, mov, mov.queuedDx, mov.queuedDz);
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
        // Snap Y to terrain at destination
        if (this.terrainYResolver) {
          pos.y = this.terrainYResolver(mov.tileX, mov.tileZ);
        }
        this.entityManager.updateSpatialIndex(entity.id, oldX, oldZ, pos.x, pos.z);

        // Immediately start queued move
        if (mov.queuedDx !== 0 || mov.queuedDz !== 0) {
          this.startMove(pos, mov, mov.queuedDx, mov.queuedDz);
          mov.queuedDx = 0;
          mov.queuedDz = 0;
        }
      } else {
        // Smooth lerp between tile positions
        const oldX = pos.x;
        const oldZ = pos.z;
        pos.x = mov.tileX + (mov.targetX - mov.tileX) * mov.progress;
        pos.z = mov.tileZ + (mov.targetZ - mov.tileZ) * mov.progress;
        // Lerp Y between source and destination terrain height
        if (this.terrainYResolver) {
          const srcY = this.terrainYResolver(mov.tileX, mov.tileZ);
          const dstY = this.terrainYResolver(mov.targetX, mov.targetZ);
          pos.y = srcY + (dstY - srcY) * mov.progress;
        }
        this.entityManager.updateSpatialIndex(entity.id, oldX, oldZ, pos.x, pos.z);
      }
    }
  }

  /** Check if a tile-to-tile move is allowed (walkable + height gradient) */
  canMoveTo(fromX: number, fromZ: number, toX: number, toZ: number): boolean {
    if (this.walkableResolver && !this.walkableResolver(toX, toZ)) return false;
    if (this.terrainYResolver) {
      const srcY = this.terrainYResolver(fromX, fromZ);
      const dstY = this.terrainYResolver(toX, toZ);
      if (Math.abs(srcY - dstY) > MAX_TILE_HEIGHT_DIFF) return false;
    }
    return true;
  }

  private startMove(pos: PositionComponent, mov: MovementComponent, dx: number, dz: number) {
    const targetX = mov.tileX + dx;
    const targetZ = mov.tileZ + dz;

    // Block movement onto non-walkable tiles (ocean, snow peak, etc.)
    if (this.walkableResolver && !this.walkableResolver(targetX, targetZ)) {
      return;
    }

    // Block movement across steep per-tile height transitions
    if (this.terrainYResolver) {
      const srcY = this.terrainYResolver(mov.tileX, mov.tileZ);
      const dstY = this.terrainYResolver(targetX, targetZ);
      if (Math.abs(srcY - dstY) > MAX_TILE_HEIGHT_DIFF) {
        return;
      }
    }

    mov.targetX = targetX;
    mov.targetZ = targetZ;
    mov.progress = 0;
    mov.moving = true;
  }
}
