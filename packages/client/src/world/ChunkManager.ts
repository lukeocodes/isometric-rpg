import type { Scene } from "@babylonjs/core";
import { CHUNK_SIZE, TILE_SIZE, CHUNK_LOAD_RADIUS, WORLD_WIDTH, WORLD_HEIGHT } from "./WorldConstants";
import { Chunk } from "./Chunk";

export class ChunkManager {
  private chunks = new Map<string, Chunk>();
  private scene: Scene;
  private mapId: number;

  // World map biome data (loaded at startup for chunk generation)
  // This will be replaced by server-streamed chunk data in Phase 3
  private biomeData: Uint8Array | null = null;
  private elevationData: Float32Array | null = null;

  constructor(scene: Scene, mapId = 1) {
    this.scene = scene;
    this.mapId = mapId;
  }

  /**
   * Set the world map data for biome-based chunk generation.
   * Called once at startup with data from the world generation pipeline.
   */
  setWorldData(biomeMap: Uint8Array, elevation: Float32Array) {
    this.biomeData = biomeMap;
    this.elevationData = elevation;
  }

  getChunkElevation(chunkX: number, chunkY: number): number {
    if (!this.elevationData || chunkX < 0 || chunkX >= WORLD_WIDTH || chunkY < 0 || chunkY >= WORLD_HEIGHT) {
      return 0;
    }
    return this.elevationData[chunkY * WORLD_WIDTH + chunkX];
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
    const tileData = this.generateChunkData(chunkX, chunkY);
    const chunk = new Chunk(this.mapId, chunkX, chunkY, chunkZ, tileData);
    chunk.buildMesh(this.scene);
    this.chunks.set(chunk.key, chunk);
  }

  private generateChunkData(chunkX: number, chunkY: number): Uint8Array {
    const data = new Uint8Array(CHUNK_SIZE * CHUNK_SIZE);

    // If we have world map data, use it
    if (this.biomeData && chunkX >= 0 && chunkX < WORLD_WIDTH && chunkY >= 0 && chunkY < WORLD_HEIGHT) {
      const biome = this.biomeData[chunkY * WORLD_WIDTH + chunkX];
      data.fill(biome);
      return data;
    }

    // Fallback: out-of-bounds chunks are deep ocean
    data.fill(0); // BiomeType.DEEP_OCEAN = 0
    return data;
  }
}
