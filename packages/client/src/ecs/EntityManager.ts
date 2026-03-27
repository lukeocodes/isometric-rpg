import type { PositionComponent } from "./components/Position";
import type { MovementComponent } from "./components/Movement";
import type { RenderableComponent } from "./components/Renderable";
import type { IdentityComponent } from "./components/Identity";
import type { StatsComponent } from "./components/Stats";
import type { CombatComponent } from "./components/Combat";

export type Component =
  | PositionComponent
  | MovementComponent
  | RenderableComponent
  | IdentityComponent
  | StatsComponent
  | CombatComponent;

export type ComponentType = Component["type"];

export interface Entity {
  id: string;
  components: Map<ComponentType, Component>;
}

const SPATIAL_CELL_SIZE = 16;

export class EntityManager {
  private entities = new Map<string, Entity>();
  private spatialGrid = new Map<string, Set<string>>();
  private onRemoveCallbacks: Array<(id: string) => void> = [];

  /** Register a callback that fires when an entity is about to be removed. */
  onEntityRemoved(callback: (id: string) => void): void {
    this.onRemoveCallbacks.push(callback);
  }

  addEntity(id: string): Entity {
    const entity: Entity = { id, components: new Map() };
    this.entities.set(id, entity);
    return entity;
  }

  removeEntity(id: string) {
    const entity = this.entities.get(id);
    if (!entity) return;

    // Notify listeners before deletion so they can clean up
    for (const cb of this.onRemoveCallbacks) {
      cb(id);
    }

    // Remove from spatial grid
    const pos = entity.components.get("position") as PositionComponent | undefined;
    if (pos) {
      const cellKey = this.cellKey(pos.x, pos.z);
      const cell = this.spatialGrid.get(cellKey);
      cell?.delete(id);
      if (cell?.size === 0) this.spatialGrid.delete(cellKey);
    }

    // Destroy display object if renderable
    const renderable = entity.components.get("renderable") as RenderableComponent | undefined;
    if (renderable?.displayObject) {
      renderable.displayObject.destroy();
    }

    this.entities.delete(id);
  }

  getEntity(id: string): Entity | undefined {
    return this.entities.get(id);
  }

  addComponent(entityId: string, component: Component) {
    const entity = this.entities.get(entityId);
    if (!entity) return;
    entity.components.set(component.type, component);

    if (component.type === "position") {
      const pos = component as PositionComponent;
      const cellKey = this.cellKey(pos.x, pos.z);
      if (!this.spatialGrid.has(cellKey)) {
        this.spatialGrid.set(cellKey, new Set());
      }
      this.spatialGrid.get(cellKey)!.add(entityId);
    }
  }

  getComponent<T extends Component>(entityId: string, type: ComponentType): T | undefined {
    const entity = this.entities.get(entityId);
    return entity?.components.get(type) as T | undefined;
  }

  updateSpatialIndex(entityId: string, oldX: number, oldZ: number, newX: number, newZ: number) {
    const oldKey = this.cellKey(oldX, oldZ);
    const newKey = this.cellKey(newX, newZ);

    if (oldKey !== newKey) {
      const oldCell = this.spatialGrid.get(oldKey);
      oldCell?.delete(entityId);
      if (oldCell?.size === 0) this.spatialGrid.delete(oldKey);
      if (!this.spatialGrid.has(newKey)) {
        this.spatialGrid.set(newKey, new Set());
      }
      this.spatialGrid.get(newKey)!.add(entityId);
    }
  }

  getEntitiesInRadius(cx: number, cz: number, radius: number): Entity[] {
    const results: Entity[] = [];
    const cellRadius = Math.ceil(radius / SPATIAL_CELL_SIZE);
    const centerCellX = Math.floor(cx / SPATIAL_CELL_SIZE);
    const centerCellZ = Math.floor(cz / SPATIAL_CELL_SIZE);

    for (let dx = -cellRadius; dx <= cellRadius; dx++) {
      for (let dz = -cellRadius; dz <= cellRadius; dz++) {
        const key = `${centerCellX + dx},${centerCellZ + dz}`;
        const cell = this.spatialGrid.get(key);
        if (!cell) continue;

        for (const id of cell) {
          const entity = this.entities.get(id);
          if (!entity) continue;
          const pos = entity.components.get("position") as PositionComponent | undefined;
          if (!pos) continue;

          const distSq = (pos.x - cx) ** 2 + (pos.z - cz) ** 2;
          if (distSq <= radius * radius) {
            results.push(entity);
          }
        }
      }
    }

    return results;
  }

  getEntitiesWithComponents(...types: ComponentType[]): Entity[] {
    const results: Entity[] = [];
    for (const entity of this.entities.values()) {
      if (types.every((t) => entity.components.has(t))) {
        results.push(entity);
      }
    }
    return results;
  }

  /** Allocation-free iteration over entities matching component types */
  *iterEntitiesWithComponents(...types: ComponentType[]): IterableIterator<Entity> {
    for (const entity of this.entities.values()) {
      let match = true;
      for (let i = 0; i < types.length; i++) {
        if (!entity.components.has(types[i])) { match = false; break; }
      }
      if (match) yield entity;
    }
  }

  getAllEntities(): IterableIterator<Entity> {
    return this.entities.values();
  }

  getEntityCount(): number {
    return this.entities.size;
  }

  private cellKey(x: number, z: number): string {
    return `${Math.floor(x / SPATIAL_CELL_SIZE)},${Math.floor(z / SPATIAL_CELL_SIZE)}`;
  }
}
