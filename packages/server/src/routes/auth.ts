import type { FastifyInstance } from "fastify";
import { config } from "../config.js";
import { exchangeCode, getUserinfo } from "../auth/oauth.js";
import { createGameJwt } from "../auth/jwt.js";
import { requireAuth } from "../auth/middleware.js";
import { db } from "../db/postgres.js";
import { accounts, characters } from "../db/schema.js";
import { eq } from "drizzle-orm";
import { getHeavenSpawn, getStarterSpawnForRace } from "../game/user-maps.js";

function accountToJson(a: typeof accounts.$inferSelect) {
  return { id: a.id, email: a.email, displayName: a.displayName, isOnboarded: a.isOnboarded, preferences: a.preferences || {} };
}

function charSummary(c: typeof characters.$inferSelect) {
  return { id: c.id, name: c.name, race: c.race, level: c.level, role: c.role };
}

/** Seed the two dev characters ("Main" + "Game Master") for an account if
 *  they aren't already present. Idempotent — safe to call on every dev-login.
 *
 *  - Main spawns at the starter map centre. The starter map is seeded as a
 *    regular user map at server boot; its numericId is DB-assigned, so we
 *    look it up here and stamp it onto Main's `mapId`.
 *  - Game Master spawns at heaven (the hardcoded constant zone).
 *
 *  If the account already has non-seeded characters without the expected
 *  roles, wipe and reseed so the state is always predictable. */
async function ensureDevCharacters(accountId: string) {
  const existing = await db.select().from(characters).where(eq(characters.accountId, accountId));
  const hasMain = existing.some(c => c.role === "main");
  const hasGM   = existing.some(c => c.role === "game-master");
  if (hasMain && hasGM) return;

  if (existing.length > 0) {
    await db.delete(characters).where(eq(characters.accountId, accountId));
  }

  // Main is a human character; the Game Master always lives in heaven.
  // Both spawn points come from DB-registered map rows — no hardcoded
  // coordinates or numericIds.
  const mainSpawn = getStarterSpawnForRace("human");
  if (!mainSpawn) {
    throw new Error("Human starter map not seeded — server boot must run loadAllUserMaps first");
  }
  const gmSpawn = getHeavenSpawn();
  if (!gmSpawn) {
    throw new Error("Heaven map not seeded — server boot must run loadAllUserMaps first");
  }

  const baseStats = {
    accountId,
    race:   "human",
    gender: "male",
    posY:   0,
    str:    10, dex: 10, intStat: 10,
    skills: [
      { name: "swordsmanship", value: 30 },
      { name: "archery",       value: 30 },
      { name: "healing",       value: 30 },
    ],
    hairStyle: 0, hairColor: 0, skinTone: 0, outfit: 0,
  } as const;

  await db.insert(characters).values([
    { ...baseStats, name: "Main",        role: "main",        ...mainSpawn },
    { ...baseStats, name: "Game Master", role: "game-master", ...gmSpawn   },
  ]);
}

export async function authRoutes(app: FastifyInstance) {
  app.get("/config", async () => ({
    clientId: config.oauth.clientId,
    issuer: config.oauth.issuer,
    redirectUri: config.oauth.redirectUri,
  }));

  app.post<{ Body: { username: string; password: string } }>("/dev-login", async (request, reply) => {
    const { username } = request.body;
    if (!username?.trim()) return reply.status(400).send({ detail: "Username required" });

    const email = `${username}@dev.local`;
    const oauthSub = `dev:${username}`;

    let [account] = await db.select().from(accounts).where(eq(accounts.oauthSub, oauthSub));
    if (!account) {
      [account] = await db.insert(accounts).values({
        oauthSub, oauthIssuer: "dev", email, displayName: username,
      }).returning();
    } else {
      await db.update(accounts).set({ email, displayName: username }).where(eq(accounts.id, account.id));
    }

    // Ensure "Main" + "Game Master" characters exist for this dev account.
    // index.html picks the "main" role, builder.html picks "game-master".
    await ensureDevCharacters(account.id);

    const chars = await db.select().from(characters).where(eq(characters.accountId, account.id));
    const gameJwt = createGameJwt(account.id, account.email);

    return { gameJwt, account: accountToJson(account), characters: chars.map(charSummary) };
  });

  app.post<{ Body: { code: string; code_verifier: string } }>("/callback", async (request, reply) => {
    let tokens: any;
    try { tokens = await exchangeCode(request.body.code, request.body.code_verifier); }
    catch { return reply.status(400).send({ detail: "Token exchange failed" }); }

    const accessToken = tokens.access_token;
    if (!accessToken) return reply.status(400).send({ detail: "No access token" });

    let userinfo: any;
    try { userinfo = await getUserinfo(accessToken); }
    catch { return reply.status(400).send({ detail: "Userinfo fetch failed" }); }

    const oauthSub = userinfo.sub || "";
    const email = userinfo.email || "";
    const displayName = userinfo.name || userinfo.preferred_username || email.split("@")[0];

    let [account] = await db.select().from(accounts).where(eq(accounts.oauthSub, oauthSub));
    if (!account) {
      [account] = await db.insert(accounts).values({
        oauthSub, oauthIssuer: config.oauth.issuer, email, displayName,
      }).returning();
    } else {
      await db.update(accounts).set({ email, displayName }).where(eq(accounts.id, account.id));
    }

    const chars = await db.select().from(characters).where(eq(characters.accountId, account.id));
    const gameJwt = createGameJwt(account.id, account.email);

    return { gameJwt, account: accountToJson(account), characters: chars.map(charSummary) };
  });

  app.post("/refresh", { preHandler: [requireAuth] }, async (request) => {
    const account = (request as any).account;
    const chars = await db.select().from(characters).where(eq(characters.accountId, account.id));
    const gameJwt = createGameJwt(account.id, account.email);
    return { gameJwt, account: accountToJson(account), characters: chars.map(charSummary) };
  });

  app.put<{ Body: { preferences: Record<string, any> } }>(
    "/preferences",
    { preHandler: [requireAuth] },
    async (request, reply) => {
      const account = (request as any).account;
      const { preferences } = request.body;
      if (!preferences || typeof preferences !== "object") {
        return reply.status(400).send({ detail: "Invalid preferences" });
      }
      // Merge with existing preferences
      const existing = (account.preferences as Record<string, any>) || {};
      const merged = { ...existing, ...preferences };
      await db.update(accounts).set({ preferences: merged }).where(eq(accounts.id, account.id));
      return { preferences: merged };
    }
  );
}
