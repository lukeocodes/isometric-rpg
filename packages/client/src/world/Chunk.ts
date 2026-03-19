import { MeshBuilder } from "@babylonjs/core/Meshes/meshBuilder";
import { StandardMaterial } from "@babylonjs/core/Materials/standardMaterial";
import { Color3 } from "@babylonjs/core/Maths/math.color";
import { Mesh } from "@babylonjs/core/Meshes/mesh";
import type { Scene } from "@babylonjs/core/scene";
import { CHUNK_SIZE, TILE_SIZE } from "./WorldConstants";
import { getTileType } from "./TileRegistry";

export class Chunk {
  public readonly chunkX: number;
  public readonly chunkY: number;
  public readonly chunkZ: number;
  public readonly mapId: number;

  private tiles: Uint8Array;
  private mesh: Mesh | null = null;

  constructor(mapId: number, chunkX: number, chunkY: number, chunkZ: number, tileData?: Uint8Array) {
    this.mapId = mapId;
    this.chunkX = chunkX;
    this.chunkY = chunkY;
    this.chunkZ = chunkZ;
    this.tiles = tileData || new Uint8Array(CHUNK_SIZE * CHUNK_SIZE).fill(1);
  }

  get key(): string { return `${this.mapId}:${this.chunkX}:${this.chunkY}:${this.chunkZ}`; }

  getTile(localX: number, localZ: number): number { return this.tiles[localZ * CHUNK_SIZE + localX]; }
  setTileData(data: Uint8Array) { this.tiles = data; }

  buildMesh(scene: Scene): Mesh {
    if (this.mesh) return this.mesh;

    const worldX = this.chunkX * CHUNK_SIZE * TILE_SIZE;
    const worldZ = this.chunkY * CHUNK_SIZE * TILE_SIZE;
    const tileGroups = new Map<number, Array<{ x: number; z: number }>>();

    for (let lz = 0; lz < CHUNK_SIZE; lz++) {
      for (let lx = 0; lx < CHUNK_SIZE; lx++) {
        const tileId = this.tiles[lz * CHUNK_SIZE + lx];
        if (!tileGroups.has(tileId)) tileGroups.set(tileId, []);
        tileGroups.get(tileId)!.push({ x: lx, z: lz });
      }
    }

    const meshes: Mesh[] = [];
    for (const [tileId, positions] of tileGroups) {
      const tileType = getTileType(tileId);
      for (const pos of positions) {
        const tile = MeshBuilder.CreateGround(`tile_${this.key}_${pos.x}_${pos.z}`, { width: TILE_SIZE, height: TILE_SIZE }, scene);
        tile.position.x = worldX + pos.x * TILE_SIZE + TILE_SIZE / 2;
        tile.position.z = worldZ + pos.z * TILE_SIZE + TILE_SIZE / 2;
        tile.position.y = this.chunkZ * 3;
        const mat = new StandardMaterial(`tileMat_${tileId}_${this.key}`, scene);
        mat.diffuseColor = tileType.color;
        mat.specularColor = Color3.Black();
        tile.material = mat;
        meshes.push(tile);
      }
    }

    if (meshes.length > 0) {
      this.mesh = Mesh.MergeMeshes(meshes, true, true, undefined, false, true) as Mesh;
      if (this.mesh) this.mesh.name = `chunk_${this.key}`;
    }

    return this.mesh!;
  }

  dispose() { if (this.mesh) { this.mesh.dispose(); this.mesh = null; } }
}
