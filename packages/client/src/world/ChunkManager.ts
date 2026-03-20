import type { Scene } from "@babylonjs/core/scene";
import { CHUNK_SIZE, TILE_SIZE, CHUNK_LOAD_RADIUS, WORLD_WIDTH, WORLD_HEIGHT, ELEVATION_STEP_HEIGHT } from "./WorldConstants";
import { Chunk } from "./Chunk";
import { getTileType } from "./TileRegistry";

export class ChunkManager {
  private chunks = new Map<string, Chunk>();
  private scene: Scene;
  private mapId: number;

  // World map data (loaded at startup from server)
  private biomeData: Uint8Array | null = null;
  /** Pre-computed elevation bands (0-6) per chunk from server */
  private elevationBands: Uint8Array | null = null;
  /** Per-chunk region ID for region-coherent terrain profiles */
  private regionMap: Uint16Array | null = null;
  /** Compact region ID -> biome lookup */
  private regionBiomes: Uint8Array | null = null;

  /** Per-chunk tile heights from server: key = "cx:cz", value = Float32Array(1024) */
  private chunkHeights = new Map<string, Float32Array>();
  /** Callback to request chunks from server */
  private chunkRequestFn: ((cx: number, cz: number) => void) | null = null;
  /** Set of chunk keys already requested (prevents duplicate requests) */
  private pendingChunkRequests = new Set<string>();

  constructor(scene: Scene, mapId = 1) {
    this.scene = scene;
    this.mapId = mapId;
  }

  getBiomeData(): Uint8Array | null { return this.biomeData; }

  setChunkRequestFn(fn: (cx: number, cz: number) => void) { this.chunkRequestFn = fn; }

  setChunkHeights(cx: number, cz: number, heights: Float32Array): void {
    const key = `${cx}:${cz}`;
    this.chunkHeights.set(key, heights);
    this.pendingChunkRequests.delete(key);
  }

  setWorldData(biomeMap: Uint8Array, elevationBands: Uint8Array, regionMap?: Uint16Array, regionBiomes?: Uint8Array) {
    this.biomeData = biomeMap;
    this.elevationBands = elevationBands;
    if (regionMap) this.regionMap = regionMap;
    if (regionBiomes) this.regionBiomes = regionBiomes;
  }

  /** Get terrain Y position in world units for a given tile position (server-provided per-tile heights) */
  getTerrainY(worldX: number, worldZ: number): number {
    const chunkX = Math.floor(worldX / (CHUNK_SIZE * TILE_SIZE));
    const chunkZ = Math.floor(worldZ / (CHUNK_SIZE * TILE_SIZE));
    const key = `${chunkX}:${chunkZ}`;
    const heights = this.chunkHeights.get(key);
    if (heights) {
      const localX = Math.floor(worldX) - chunkX * CHUNK_SIZE;
      const localZ = Math.floor(worldZ) - chunkZ * CHUNK_SIZE;
      const clampedX = Math.max(0, Math.min(CHUNK_SIZE - 1, localX));
      const clampedZ = Math.max(0, Math.min(CHUNK_SIZE - 1, localZ));
      return heights[clampedZ * CHUNK_SIZE + clampedX];
    }
    // Fallback: use elevation band * step height if heights not yet loaded
    return this.getChunkElevationBand(chunkX, chunkZ) * ELEVATION_STEP_HEIGHT;
  }

  /** Get the region's biome for a chunk coordinate (consistent across entire region) */
  getRegionBiome(chunkX: number, chunkY: number): number {
    if (this.regionMap && this.regionBiomes &&
        chunkX >= 0 && chunkX < WORLD_WIDTH && chunkY >= 0 && chunkY < WORLD_HEIGHT) {
      const regionId = this.regionMap[chunkY * WORLD_WIDTH + chunkX];
      return this.regionBiomes[regionId] ?? 0;
    }
    return this.getChunkBiome(chunkX, chunkY);
  }

  /** Get the discrete elevation band (0-6) for a chunk coordinate */
  getChunkElevationBand(chunkX: number, chunkY: number): number {
    if (!this.elevationBands || chunkX < 0 || chunkX >= WORLD_WIDTH || chunkY < 0 || chunkY >= WORLD_HEIGHT) {
      return 0;
    }
    return this.elevationBands[chunkY * WORLD_WIDTH + chunkX];
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
        // Request per-tile heights from server if not already cached
        const hkey = `${cx}:${cy}`;
        if (!this.chunkHeights.has(hkey) && !this.pendingChunkRequests.has(hkey) && this.chunkRequestFn) {
          this.pendingChunkRequests.add(hkey);
          this.chunkRequestFn(cx, cy);
        }
      }
    }

    // Unload chunks outside radius + 1 buffer
    for (const [key, chunk] of this.chunks) {
      const dist = Math.max(
        Math.abs(chunk.chunkX - chunkX),
        Math.abs(chunk.chunkY - chunkY),
      );
      if (dist > CHUNK_LOAD_RADIUS + 1) {
        chunk.dispose();
        this.chunks.delete(key);
        const hkey = `${chunk.chunkX}:${chunk.chunkY}`;
        this.chunkHeights.delete(hkey);
        this.pendingChunkRequests.delete(hkey);
      }
    }
  }

  getChunk(chunkX: number, chunkY: number, chunkZ = 0): Chunk | undefined {
    return this.chunks.get(`${this.mapId}:${chunkX}:${chunkY}:${chunkZ}`);
  }

  dispose() {
    for (const chunk of this.chunks.values()) {
      chunk.dispose();
    }
    this.chunks.clear();
    this.chunkHeights.clear();
    this.pendingChunkRequests.clear();
  }

  /** Check if a world tile position is walkable based on biome */
  isWalkable(worldX: number, worldZ: number): boolean {
    const biome = this.getChunkBiome(
      Math.floor(worldX / (CHUNK_SIZE * TILE_SIZE)),
      Math.floor(worldZ / (CHUNK_SIZE * TILE_SIZE)),
    );
    return getTileType(biome).walkable;
  }

  /** Get the biome ID at a world tile position */
  getBiomeAt(worldX: number, worldZ: number): number {
    return this.getChunkBiome(
      Math.floor(worldX / (CHUNK_SIZE * TILE_SIZE)),
      Math.floor(worldZ / (CHUNK_SIZE * TILE_SIZE)),
    );
  }

  /** Get the discrete elevation band (0-6) for a world tile position */
  getElevationBandAt(worldX: number, worldZ: number): number {
    return this.getChunkElevationBand(
      Math.floor(worldX / (CHUNK_SIZE * TILE_SIZE)),
      Math.floor(worldZ / (CHUNK_SIZE * TILE_SIZE)),
    );
  }

  private getChunkBiome(chunkX: number, chunkY: number): number {
    if (this.biomeData && chunkX >= 0 && chunkX < WORLD_WIDTH && chunkY >= 0 && chunkY < WORLD_HEIGHT) {
      return this.biomeData[chunkY * WORLD_WIDTH + chunkX];
    }
    return 0; // deep ocean fallback
  }

  private loadChunk(chunkX: number, chunkY: number, chunkZ: number) {
    const biome = this.getChunkBiome(chunkX, chunkY);
    const baseY = this.getChunkElevationBand(chunkX, chunkY) * ELEVATION_STEP_HEIGHT;
    const chunk = new Chunk(this.mapId, chunkX, chunkY, chunkZ, biome, baseY);
    chunk.buildMesh(this.scene);
    this.chunks.set(chunk.key, chunk);
  }
}
