import type { Scene } from "@babylonjs/core";
import { CHUNK_SIZE, TILE_SIZE, CHUNK_LOAD_RADIUS } from "./WorldConstants";
import { Chunk } from "./Chunk";

export class ChunkManager {
  private chunks = new Map<string, Chunk>();
  private scene: Scene;
  private mapId: number;

  constructor(scene: Scene, mapId = 1) {
    this.scene = scene;
    this.mapId = mapId;
  }

  updatePlayerPosition(worldX: number, worldZ: number) {
    const chunkX = Math.floor(worldX / (CHUNK_SIZE * TILE_SIZE));
    const chunkY = Math.floor(worldZ / (CHUNK_SIZE * TILE_SIZE));

    // Load chunks in radius
    for (let dx = -CHUNK_LOAD_RADIUS; dx <= CHUNK_LOAD_RADIUS; dx++) {
      for (let dy = -CHUNK_LOAD_RADIUS; dy <= CHUNK_LOAD_RADIUS; dy++) {
        const cx = chunkX + dx;
        const cy = chunkY + dy;
        const key = `${this.mapId}:${cx}:${cy}:0`;

        if (!this.chunks.has(key)) {
          this.loadChunk(cx, cy, 0);
        }
      }
    }

    // Unload chunks outside radius
    for (const [key, chunk] of this.chunks) {
      const dist = Math.max(
        Math.abs(chunk.chunkX - chunkX),
        Math.abs(chunk.chunkY - chunkY),
      );
      if (dist > CHUNK_LOAD_RADIUS + 1) {
        chunk.dispose();
        this.chunks.delete(key);
      }
    }
  }

  loadChunkFromData(chunkX: number, chunkY: number, chunkZ: number, tileData: Uint8Array) {
    const chunk = new Chunk(this.mapId, chunkX, chunkY, chunkZ, tileData);
    chunk.buildMesh(this.scene);
    this.chunks.set(chunk.key, chunk);
  }

  getChunk(chunkX: number, chunkY: number, chunkZ = 0): Chunk | undefined {
    return this.chunks.get(`${this.mapId}:${chunkX}:${chunkY}:${chunkZ}`);
  }

  dispose() {
    for (const chunk of this.chunks.values()) {
      chunk.dispose();
    }
    this.chunks.clear();
  }

  private loadChunk(chunkX: number, chunkY: number, chunkZ: number) {
    // For now, generate procedural chunk data locally.
    // Will be replaced with server-fetched data in Step 12.
    const tileData = this.generateChunkData(chunkX, chunkY);
    const chunk = new Chunk(this.mapId, chunkX, chunkY, chunkZ, tileData);
    chunk.buildMesh(this.scene);
    this.chunks.set(chunk.key, chunk);
  }

  private generateChunkData(chunkX: number, chunkY: number): Uint8Array {
    const data = new Uint8Array(CHUNK_SIZE * CHUNK_SIZE);

    for (let z = 0; z < CHUNK_SIZE; z++) {
      for (let x = 0; x < CHUNK_SIZE; x++) {
        const worldX = chunkX * CHUNK_SIZE + x;
        const worldZ = chunkY * CHUNK_SIZE + z;

        // Simple procedural generation
        const dist = Math.sqrt(worldX * worldX + worldZ * worldZ);

        if (dist < 8) {
          data[z * CHUNK_SIZE + x] = 3; // stone (spawn area)
        } else if (dist < 12) {
          data[z * CHUNK_SIZE + x] = 2; // dirt (transition)
        } else {
          // Pseudo-random variation using simple hash
          const hash = Math.abs(Math.sin(worldX * 12.9898 + worldZ * 78.233) * 43758.5453) % 1;
          if (hash < 0.05) {
            data[z * CHUNK_SIZE + x] = 5; // sand patches
          } else if (hash < 0.08) {
            data[z * CHUNK_SIZE + x] = 2; // dirt patches
          } else {
            data[z * CHUNK_SIZE + x] = 1; // grass
          }
        }
      }
    }

    return data;
  }
}
