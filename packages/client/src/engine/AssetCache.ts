import type { Mesh } from "@babylonjs/core/Meshes/mesh";

interface CacheEntry {
  mesh: Mesh;
  lastAccess: number;
}

const MAX_CACHE_SIZE = 200;

export class AssetCache {
  private cache = new Map<string, CacheEntry>();

  get(key: string): Mesh | null {
    const entry = this.cache.get(key);
    if (entry) {
      entry.lastAccess = Date.now();
      return entry.mesh;
    }
    return null;
  }

  set(key: string, mesh: Mesh) {
    if (this.cache.size >= MAX_CACHE_SIZE) {
      this.evictOldest();
    }
    this.cache.set(key, { mesh, lastAccess: Date.now() });
  }

  dispose(key: string) {
    const entry = this.cache.get(key);
    if (entry) {
      entry.mesh.dispose();
      this.cache.delete(key);
    }
  }

  clear() {
    for (const [, entry] of this.cache) {
      entry.mesh.dispose();
    }
    this.cache.clear();
  }

  private evictOldest() {
    let oldestKey: string | null = null;
    let oldestTime = Infinity;

    for (const [key, entry] of this.cache) {
      if (entry.lastAccess < oldestTime) {
        oldestTime = entry.lastAccess;
        oldestKey = key;
      }
    }

    if (oldestKey) {
      this.dispose(oldestKey);
    }
  }
}
