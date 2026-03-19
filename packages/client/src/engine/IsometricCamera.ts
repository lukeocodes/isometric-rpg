import { FreeCamera } from "@babylonjs/core/Cameras/freeCamera";
import { Vector3 } from "@babylonjs/core/Maths/math.vector";
import { Camera } from "@babylonjs/core/Cameras/camera";
import type { Scene } from "@babylonjs/core/scene";

const ISO_ELEVATION = Math.atan(Math.sqrt(2) / 2);
const ISO_Y_ROTATION = Math.PI / 4;
const DEFAULT_ZOOM = 8;
const FOLLOW_LERP = 0.1;

export class IsometricCamera {
  public camera: FreeCamera;
  private zoom = DEFAULT_ZOOM;
  private targetPosition = Vector3.Zero();
  private canvas: HTMLCanvasElement;

  constructor(scene: Scene, canvas: HTMLCanvasElement) {
    this.canvas = canvas;
    this.camera = new FreeCamera("isoCam", Vector3.Zero(), scene);
    this.camera.mode = Camera.ORTHOGRAPHIC_CAMERA;
    this.camera.rotation = new Vector3(ISO_ELEVATION, ISO_Y_ROTATION, 0);
    this.camera.inputs.clear();
    this.updateOrtho();
    this.updatePosition();
  }

  setTarget(position: Vector3) { this.targetPosition = position.clone(); }

  setZoom(zoom: number) {
    this.zoom = Math.max(5, Math.min(50, zoom));
    this.updateOrtho();
  }

  getZoom(): number { return this.zoom; }

  update() {
    const current = this.camera.position;
    const offset = this.getCameraOffset();
    const desired = this.targetPosition.add(offset);
    this.camera.position = Vector3.Lerp(current, desired, FOLLOW_LERP);
    this.updateOrtho();
  }

  private getCameraOffset(): Vector3 {
    const distance = this.zoom * 2;
    return new Vector3(
      -Math.sin(ISO_Y_ROTATION) * Math.cos(ISO_ELEVATION) * distance,
      Math.sin(ISO_ELEVATION) * distance,
      -Math.cos(ISO_Y_ROTATION) * Math.cos(ISO_ELEVATION) * distance,
    );
  }

  private updateOrtho() {
    const aspect = this.canvas.width / this.canvas.height;
    this.camera.orthoLeft = -this.zoom * aspect;
    this.camera.orthoRight = this.zoom * aspect;
    this.camera.orthoTop = this.zoom;
    this.camera.orthoBottom = -this.zoom;
  }

  private updatePosition() {
    const offset = this.getCameraOffset();
    this.camera.position = this.targetPosition.add(offset);
  }
}
