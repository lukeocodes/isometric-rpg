import { MeshBuilder } from "@babylonjs/core/Meshes/meshBuilder";
import { StandardMaterial } from "@babylonjs/core/Materials/standardMaterial";
import { Color3 } from "@babylonjs/core/Maths/math.color";
import type { Mesh } from "@babylonjs/core/Meshes/mesh";
import type { Scene } from "@babylonjs/core/scene";
import { CHUNK_SIZE, TILE_SIZE } from "./WorldConstants";
import { getTileType } from "./TileRegistry";

const matCache = new Map<string, StandardMaterial>();

export function getBiomeMaterial(biomeId: number, scene: Scene): StandardMaterial {
  const key = `biome_${biomeId}`;
  let mat = matCache.get(key);
  if (!mat || mat.getScene() == null) {
    const tileType = getTileType(biomeId);
    mat = new StandardMaterial(key, scene);
    mat.diffuseColor = tileType.color;
    mat.specularColor = Color3.Black();
    mat.freeze();
    matCache.set(key, mat);
  }
  return mat;
}

export class Chunk {
  public readonly chunkX: number;
  public readonly chunkY: number;
  public readonly chunkZ: number;
  public readonly mapId: number;
  public readonly baseY: number;
  public readonly biomeId: number;

  private mesh: Mesh | null = null;

  constructor(
    mapId: number, chunkX: number, chunkY: number, chunkZ: number,
    biomeId: number, baseY: number = 0,
  ) {
    this.mapId = mapId;
    this.chunkX = chunkX;
    this.chunkY = chunkY;
    this.chunkZ = chunkZ;
    this.baseY = baseY;
    this.biomeId = biomeId;
  }

  get key(): string { return `${this.mapId}:${this.chunkX}:${this.chunkY}:${this.chunkZ}`; }

  buildMesh(scene: Scene): Mesh {
    if (this.mesh) return this.mesh;

    const size = CHUNK_SIZE * TILE_SIZE;
    const worldX = this.chunkX * size;
    const worldZ = this.chunkY * size;

    this.mesh = MeshBuilder.CreateGround(`chunk_${this.key}`, { width: size, height: size }, scene);
    this.mesh.position.x = worldX + size / 2;
    this.mesh.position.z = worldZ + size / 2;
    this.mesh.position.y = this.baseY;
    this.mesh.material = getBiomeMaterial(this.biomeId, scene);
    this.mesh.isPickable = false;
    this.mesh.freezeWorldMatrix();
    return this.mesh;
  }

  dispose() {
    if (this.mesh) { this.mesh.dispose(); this.mesh = null; }
  }
}
