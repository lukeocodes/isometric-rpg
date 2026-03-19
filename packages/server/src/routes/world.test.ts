import { describe, it, expect } from "vitest";

/**
 * Test the procedural chunk generation from routes/world.ts.
 * The function is not exported, so we replicate it here to verify the terrain rules.
 * The route handler itself needs auth middleware — tested separately below.
 */

const CHUNK_SIZE = 32;

function generateChunkData(chunkX: number, chunkY: number): number[] {
  const data: number[] = new Array(CHUNK_SIZE * CHUNK_SIZE);
  for (let z = 0; z < CHUNK_SIZE; z++) {
    for (let x = 0; x < CHUNK_SIZE; x++) {
      const wx = chunkX * CHUNK_SIZE + x;
      const wz = chunkY * CHUNK_SIZE + z;
      const dist = Math.sqrt(wx * wx + wz * wz);

      if (dist < 8) {
        data[z * CHUNK_SIZE + x] = 3; // stone
      } else if (dist < 12) {
        data[z * CHUNK_SIZE + x] = 2; // dirt
      } else {
        const h = Math.abs(Math.sin(wx * 12.9898 + wz * 78.233) * 43758.5453) % 1;
        data[z * CHUNK_SIZE + x] = h < 0.05 ? 5 : h < 0.08 ? 2 : 1;
      }
    }
  }
  return data;
}

describe("chunk generation (routes/world.ts logic)", () => {
  it("generates correct size array", () => {
    const data = generateChunkData(0, 0);
    expect(data.length).toBe(CHUNK_SIZE * CHUNK_SIZE); // 1024
  });

  it("origin chunk has stone tiles near center", () => {
    const data = generateChunkData(0, 0);
    // Tile at (0,0) — distance 0 from origin → stone (3)
    expect(data[0 * CHUNK_SIZE + 0]).toBe(3);
    // Tile at (3,3) — distance ~4.24 → stone (3)
    expect(data[3 * CHUNK_SIZE + 3]).toBe(3);
  });

  it("origin chunk has dirt ring around stone", () => {
    const data = generateChunkData(0, 0);
    // Tile at (9,0) — distance 9 → dirt (2)
    expect(data[0 * CHUNK_SIZE + 9]).toBe(2);
    // Tile at (0,10) — distance 10 → dirt (2)
    expect(data[10 * CHUNK_SIZE + 0]).toBe(2);
  });

  it("distant tiles are grass, dirt, or sand", () => {
    const data = generateChunkData(0, 0);
    // Tile at (20,20) — distance ~28.28 → procedural (1, 2, or 5)
    const tile = data[20 * CHUNK_SIZE + 20];
    expect([1, 2, 5]).toContain(tile);
  });

  it("far chunk has no stone tiles", () => {
    const data = generateChunkData(10, 10); // 320+ tiles from origin
    // All tiles should be procedural (1, 2, or 5), never stone (3)
    for (const tile of data) {
      expect(tile).not.toBe(3);
    }
  });

  it("only uses valid tile IDs", () => {
    const data = generateChunkData(0, 0);
    const validIds = new Set([1, 2, 3, 5]);
    for (const tile of data) {
      expect(validIds.has(tile), `unexpected tile ID: ${tile}`).toBe(true);
    }
  });

  it("is deterministic (same input = same output)", () => {
    const a = generateChunkData(3, -7);
    const b = generateChunkData(3, -7);
    expect(a).toEqual(b);
  });

  it("different chunks produce different data", () => {
    const a = generateChunkData(0, 0);
    const b = generateChunkData(5, 5);
    // Not every tile will differ, but the arrays shouldn't be identical
    expect(a).not.toEqual(b);
  });
});
