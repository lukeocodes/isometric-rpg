import { Engine } from "@babylonjs/core/Engines/engine";
import { Scene } from "@babylonjs/core/scene";
import { HemisphericLight } from "@babylonjs/core/Lights/hemisphericLight";
import { Vector3 } from "@babylonjs/core/Maths/math.vector";
import { Color4 } from "@babylonjs/core/Maths/math.color";

export class SceneManager {
  public engine: Engine;
  public scene: Scene;

  constructor(canvas: HTMLCanvasElement) {
    this.engine = new Engine(canvas, true, {
      preserveDrawingBuffer: true,
      stencil: true,
    });

    this.scene = new Scene(this.engine);
    this.scene.clearColor = new Color4(0.06, 0.06, 0.12, 1);

    const light = new HemisphericLight("ambientLight", new Vector3(0.5, 1, 0.5), this.scene);
    light.intensity = 0.9;
    light.groundColor = new Color4(0.3, 0.3, 0.4, 1) as any;

    window.addEventListener("resize", () => this.engine.resize());
  }

  render() {
    this.scene.render();
  }

  dispose() {
    this.scene.dispose();
    this.engine.dispose();
  }
}
