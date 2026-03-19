export interface MovementComponent {
  type: "movement";
  speed: number; // tiles per second

  // Tile-based movement
  tileX: number;    // current logical tile
  tileZ: number;
  targetX: number;  // target tile (same as tileX/Z when idle)
  targetZ: number;
  progress: number; // 0..1 interpolation between current and target
  moving: boolean;

  // Queued direction for responsive chaining
  queuedDx: number;
  queuedDz: number;
}

export function createMovement(speed = 5.0, startTileX = 0, startTileZ = 0): MovementComponent {
  return {
    type: "movement",
    speed,
    tileX: startTileX,
    tileZ: startTileZ,
    targetX: startTileX,
    targetZ: startTileZ,
    progress: 1,
    moving: false,
    queuedDx: 0,
    queuedDz: 0,
  };
}
