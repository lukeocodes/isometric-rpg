import type { Mesh } from "@babylonjs/core/Meshes/mesh";

export interface RenderableComponent {
  type: "renderable";
  mesh: Mesh | null;
  meshType: string; // "player", "npc", "object"
  bodyColor: string;
  skinColor: string;
  hairColor: string;
  visible: boolean;
}

export function createRenderable(
  meshType = "player",
  bodyColor = "#4466aa",
  skinColor = "#e8c4a0",
  hairColor = "#2c1b0e",
): RenderableComponent {
  return {
    type: "renderable",
    mesh: null,
    meshType,
    bodyColor,
    skinColor,
    hairColor,
    visible: true,
  };
}
