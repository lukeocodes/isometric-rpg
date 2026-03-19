export interface PositionComponent {
  type: "position";
  x: number;
  y: number;
  z: number;
  rotation: number;
  mapId: number;

  // Remote entity interpolation targets
  remoteTargetX: number;
  remoteTargetY: number;
  remoteTargetZ: number;
  remoteTargetRotation: number;
  isRemote: boolean;
}

export function createPosition(x = 0, y = 0, z = 0, rotation = 0, mapId = 1): PositionComponent {
  return {
    type: "position", x, y, z, rotation, mapId,
    remoteTargetX: x, remoteTargetY: y, remoteTargetZ: z,
    remoteTargetRotation: rotation, isRemote: false,
  };
}
