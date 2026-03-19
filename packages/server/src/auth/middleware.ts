import type { FastifyRequest, FastifyReply } from "fastify";
import { decodeGameJwt } from "./jwt.js";
import { db } from "../db/postgres.js";
import { accounts } from "../db/schema.js";
import { eq } from "drizzle-orm";

export async function requireAuth(request: FastifyRequest, reply: FastifyReply) {
  const authHeader = request.headers.authorization;
  if (!authHeader?.startsWith("Bearer ")) {
    return reply.status(401).send({ detail: "Missing token" });
  }

  try {
    const payload = decodeGameJwt(authHeader.slice(7));
    const [account] = await db.select().from(accounts).where(eq(accounts.id, payload.sub));
    if (!account) {
      return reply.status(401).send({ detail: "Account not found" });
    }
    (request as any).account = account;
  } catch {
    return reply.status(401).send({ detail: "Invalid or expired token" });
  }
}
