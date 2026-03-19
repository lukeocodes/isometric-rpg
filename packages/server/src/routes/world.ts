import type { FastifyInstance } from "fastify";
import { requireAuth } from "../auth/middleware.js";

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

export async function worldRoutes(app: FastifyInstance) {
  app.addHook("preHandler", requireAuth);

  app.get<{ Querystring: { map_id?: string; x: string; y: string; z?: string } }>("/chunks", async (request) => {
    const x = parseInt(request.query.x);
    const y = parseInt(request.query.y);
    return { tileData: generateChunkData(x, y), x, y, z: 0 };
  });
}
