export interface ServerEntity {
  entityId: string;
  characterId: string;
  accountId: string;
  name: string;
  entityType: "player" | "npc";
  x: number;
  y: number;
  z: number;
  rotation: number;
  mapId: number;
  lastUpdate: number;
}

const AWAKE_RADIUS = 32;
const CELL_SIZE = 32;

function cellKey(x: number, z: number): string {
  return `${Math.floor(x / CELL_SIZE)},${Math.floor(z / CELL_SIZE)}`;
}

class EntityStore {
  private entities = new Map<string, ServerEntity>();
  private byCharacter = new Map<string, string>();
  private spatialGrid = new Map<string, Set<string>>();
  private entityCells = new Map<string, string>();

  add(entity: ServerEntity) {
    this.entities.set(entity.entityId, entity);
    if (entity.characterId) this.byCharacter.set(entity.characterId, entity.entityId);

    // Register in spatial grid
    const key = cellKey(entity.x, entity.z);
    let cell = this.spatialGrid.get(key);
    if (!cell) {
      cell = new Set();
      this.spatialGrid.set(key, cell);
    }
    cell.add(entity.entityId);
    this.entityCells.set(entity.entityId, key);
  }

  remove(entityId: string) {
    const entity = this.entities.get(entityId);
    if (entity) {
      this.byCharacter.delete(entity.characterId);
      this.entities.delete(entityId);

      // Clean up spatial grid
      const key = this.entityCells.get(entityId);
      if (key) {
        const cell = this.spatialGrid.get(key);
        if (cell) {
          cell.delete(entityId);
          if (cell.size === 0) this.spatialGrid.delete(key);
        }
        this.entityCells.delete(entityId);
      }
    }
  }

  get(entityId: string): ServerEntity | undefined {
    return this.entities.get(entityId);
  }

  getByCharacter(characterId: string): ServerEntity | undefined {
    const eid = this.byCharacter.get(characterId);
    return eid ? this.entities.get(eid) : undefined;
  }

  getAll(): ServerEntity[] {
    return Array.from(this.entities.values());
  }

  getByType(type: ServerEntity["entityType"]): ServerEntity[] {
    return this.getAll().filter(e => e.entityType === type);
  }

  /** Update entity position and move between spatial grid cells if needed. */
  updatePosition(entityId: string, newX: number, newZ: number) {
    const entity = this.entities.get(entityId);
    if (!entity) return;

    const oldKey = this.entityCells.get(entityId);
    const newKey = cellKey(newX, newZ);

    entity.x = newX;
    entity.z = newZ;

    if (oldKey !== newKey) {
      // Remove from old cell
      if (oldKey) {
        const oldCell = this.spatialGrid.get(oldKey);
        if (oldCell) {
          oldCell.delete(entityId);
          if (oldCell.size === 0) this.spatialGrid.delete(oldKey);
        }
      }
      // Add to new cell
      let newCell = this.spatialGrid.get(newKey);
      if (!newCell) {
        newCell = new Set();
        this.spatialGrid.set(newKey, newCell);
      }
      newCell.add(entityId);
      this.entityCells.set(entityId, newKey);
    }
  }

  /** Get all entities within Chebyshev radius of (x, z). */
  getNearbyEntities(x: number, z: number, radius: number = 32): ServerEntity[] {
    const results: ServerEntity[] = [];
    const minCellX = Math.floor((x - radius) / CELL_SIZE);
    const maxCellX = Math.floor((x + radius) / CELL_SIZE);
    const minCellZ = Math.floor((z - radius) / CELL_SIZE);
    const maxCellZ = Math.floor((z + radius) / CELL_SIZE);

    for (let cx = minCellX; cx <= maxCellX; cx++) {
      for (let cz = minCellZ; cz <= maxCellZ; cz++) {
        const cell = this.spatialGrid.get(`${cx},${cz}`);
        if (!cell) continue;
        for (const eid of cell) {
          const entity = this.entities.get(eid);
          if (!entity) continue;
          const dist = Math.max(Math.abs(entity.x - x), Math.abs(entity.z - z));
          if (dist <= radius) results.push(entity);
        }
      }
    }
    return results;
  }

  /** Get only players within Chebyshev radius of (x, z). */
  getPlayersNear(x: number, z: number, radius: number = 32): ServerEntity[] {
    const results: ServerEntity[] = [];
    const minCellX = Math.floor((x - radius) / CELL_SIZE);
    const maxCellX = Math.floor((x + radius) / CELL_SIZE);
    const minCellZ = Math.floor((z - radius) / CELL_SIZE);
    const maxCellZ = Math.floor((z + radius) / CELL_SIZE);

    for (let cx = minCellX; cx <= maxCellX; cx++) {
      for (let cz = minCellZ; cz <= maxCellZ; cz++) {
        const cell = this.spatialGrid.get(`${cx},${cz}`);
        if (!cell) continue;
        for (const eid of cell) {
          const entity = this.entities.get(eid);
          if (!entity || entity.entityType !== "player") continue;
          const dist = Math.max(Math.abs(entity.x - x), Math.abs(entity.z - z));
          if (dist <= radius) results.push(entity);
        }
      }
    }
    return results;
  }

  /** Returns true if a player is within AWAKE_RADIUS. Players are always awake. */
  isAwake(entityId: string): boolean {
    const entity = this.entities.get(entityId);
    if (!entity) return false;
    if (entity.entityType === "player") return true;

    return this.getPlayersNear(entity.x, entity.z, AWAKE_RADIUS).length > 0;
  }
}

export const entityStore = new EntityStore();
