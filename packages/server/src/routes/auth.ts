import type { FastifyInstance } from "fastify";
import { config } from "../config.js";
import { exchangeCode, getUserinfo } from "../auth/oauth.js";
import { createGameJwt } from "../auth/jwt.js";
import { requireAuth } from "../auth/middleware.js";
import { db } from "../db/postgres.js";
import { accounts, characters } from "../db/schema.js";
import { eq } from "drizzle-orm";

function accountToJson(a: typeof accounts.$inferSelect) {
  return { id: a.id, email: a.email, displayName: a.displayName, isOnboarded: a.isOnboarded };
}

function charSummary(c: typeof characters.$inferSelect) {
  return { id: c.id, name: c.name, race: c.race, level: c.level };
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
}
