import { describe, it, expect, beforeEach, vi } from "vitest";
import Fastify from "fastify";

// Mock auth middleware
vi.mock("../auth/middleware.js", () => ({
  requireAuth: vi.fn(async (request: any) => {
    request.account = { id: "acc-1", email: "test@dev.local", displayName: "tester", isOnboarded: true };
  }),
}));

// Mock JWT
vi.mock("../auth/jwt.js", () => ({
  createGameJwt: vi.fn(() => "mock-game-jwt"),
}));

// Mock OAuth
vi.mock("../auth/oauth.js", () => ({
  exchangeCode: vi.fn(),
  getUserinfo: vi.fn(),
}));

// Mock DB — chainable query builder
const mockDbWhere = vi.fn();
const mockDbFrom = vi.fn(() => ({ where: mockDbWhere }));
const mockDbReturning = vi.fn();
const mockDbInsertValues = vi.fn(() => ({ returning: mockDbReturning }));
const mockDbInsert = vi.fn(() => ({ values: mockDbInsertValues }));
const mockDbUpdateSet = vi.fn(() => ({ where: vi.fn().mockResolvedValue(undefined) }));
const mockDbUpdate = vi.fn(() => ({ set: mockDbUpdateSet }));
const mockDbDeleteWhere = vi.fn().mockResolvedValue(undefined);
const mockDbDelete = vi.fn(() => ({ where: mockDbDeleteWhere }));

vi.mock("../db/postgres.js", () => ({
  db: {
    select: () => ({ from: mockDbFrom }),
    insert: (...args: any[]) => mockDbInsert(...args),
    update: (...args: any[]) => mockDbUpdate(...args),
    delete: (...args: any[]) => mockDbDelete(...args),
  },
}));

// auth.ts reaches into user-maps for DB-registered spawn locations. Stub
// both built-in lookups so tests don't pull the whole module in.
vi.mock("../game/user-maps.js", () => ({
  getHeavenSpawn:        () => ({ mapId: 500,  posX: 16, posZ: 16 }),
  getStarterSpawnForRace: () => ({ mapId: 1000, posX: 32, posZ: 32 }),
}));

vi.mock("../db/schema.js", () => ({
  accounts: { oauthSub: "accounts.oauth_sub", id: "accounts.id" },
  characters: { accountId: "characters.account_id" },
}));

vi.mock("drizzle-orm", () => ({
  eq: vi.fn((a: any, b: any) => ({ a, b })),
}));

import { authRoutes } from "./auth.js";
import { exchangeCode, getUserinfo } from "../auth/oauth.js";

const fakeAccount = {
  id: "acc-1", email: "test@dev.local", displayName: "tester",
  isOnboarded: true, oauthSub: "dev:tester", oauthIssuer: "dev",
};

async function buildApp() {
  const app = Fastify();
  await app.register(authRoutes, { prefix: "/" });
  return app;
}

describe("auth API routes", () => {
  let app: ReturnType<typeof Fastify>;

  beforeEach(async () => {
    vi.clearAllMocks();
    app = await buildApp();
    mockDbWhere.mockResolvedValue([]); // No existing account/chars by default
    mockDbReturning.mockResolvedValue([fakeAccount]);
  });

  describe("GET /config", () => {
    it("returns OAuth config", async () => {
      const res = await app.inject({ method: "GET", url: "/config" });
      expect(res.statusCode).toBe(200);
      const body = JSON.parse(res.body);
      expect(body).toHaveProperty("clientId");
      expect(body).toHaveProperty("issuer");
      expect(body).toHaveProperty("redirectUri");
    });
  });

  describe("POST /dev-login", () => {
    it("creates account for new user", async () => {
      const seeded = [
        { id: "c-m", name: "Main",        race: "human", level: 1, role: "main"        },
        { id: "c-g", name: "Game Master", race: "human", level: 1, role: "game-master" },
      ];
      // Order of `where` calls during dev-login:
      //   1. accounts.select (for oauthSub) → no existing account
      //   2. ensureDevCharacters: characters.select → none (new user)
      //   3. auth route final: characters.select → the two we just seeded
      mockDbWhere
        .mockResolvedValueOnce([])
        .mockResolvedValueOnce([])
        .mockResolvedValueOnce(seeded);

      const res = await app.inject({
        method: "POST", url: "/dev-login",
        payload: { username: "newuser", password: "pass" },
      });

      expect(res.statusCode).toBe(200);
      const body = JSON.parse(res.body);
      expect(body.gameJwt).toBe("mock-game-jwt");
      expect(body.account).toBeDefined();
      expect(body.characters).toHaveLength(2);
    });

    it("updates existing account on login", async () => {
      const seeded = [
        { id: "c-m", name: "Main",        race: "human", level: 1, role: "main"        },
        { id: "c-g", name: "Game Master", race: "human", level: 1, role: "game-master" },
      ];
      mockDbWhere
        .mockResolvedValueOnce([fakeAccount]) // 1. account found
        .mockResolvedValueOnce(seeded)        // 2. ensureDevCharacters: both roles present (no-op)
        .mockResolvedValueOnce(seeded);       // 3. final characters.select

      const res = await app.inject({
        method: "POST", url: "/dev-login",
        payload: { username: "tester", password: "pass" },
      });

      expect(res.statusCode).toBe(200);
      expect(mockDbUpdate).toHaveBeenCalled();
    });

    it("returns existing characters on login", async () => {
      // ensureDevCharacters() inspects chars for main + game-master roles.
      // When both exist it's a no-op, so we mock two chars with the expected
      // roles and the final select returns them unchanged.
      const main = { id: "c-1", name: "Main",        race: "human", level: 1, role: "main"         };
      const gm   = { id: "c-2", name: "Game Master", race: "human", level: 1, role: "game-master"  };
      mockDbWhere
        .mockResolvedValueOnce([fakeAccount]) // accounts.select
        .mockResolvedValueOnce([main, gm])    // ensureDevCharacters: both roles present (no-op)
        .mockResolvedValueOnce([main, gm]);   // final characters.select

      const res = await app.inject({
        method: "POST", url: "/dev-login",
        payload: { username: "tester", password: "pass" },
      });

      expect(res.statusCode).toBe(200);
      const body = JSON.parse(res.body);
      expect(body.characters).toHaveLength(2);
      expect(body.characters[0]).toEqual({ id: "c-1", name: "Main", race: "human", level: 1, role: "main" });
      expect(body.characters[1]).toEqual({ id: "c-2", name: "Game Master", race: "human", level: 1, role: "game-master" });
    });

    it("rejects empty username", async () => {
      const res = await app.inject({
        method: "POST", url: "/dev-login",
        payload: { username: "", password: "" },
      });
      expect(res.statusCode).toBe(400);
      expect(JSON.parse(res.body).detail).toBe("Username required");
    });
  });

  describe("POST /callback", () => {
    it("exchanges code and creates session", async () => {
      (exchangeCode as any).mockResolvedValue({ access_token: "at-123" });
      (getUserinfo as any).mockResolvedValue({
        sub: "oauth-sub-1", email: "user@example.com", name: "OAuth User",
      });
      mockDbWhere
        .mockResolvedValueOnce([]) // No existing account
        .mockResolvedValueOnce([]); // No characters

      const res = await app.inject({
        method: "POST", url: "/callback",
        payload: { code: "auth-code", code_verifier: "verifier" },
      });

      expect(res.statusCode).toBe(200);
      const body = JSON.parse(res.body);
      expect(body.gameJwt).toBe("mock-game-jwt");
    });

    it("updates existing OAuth account", async () => {
      (exchangeCode as any).mockResolvedValue({ access_token: "at-123" });
      (getUserinfo as any).mockResolvedValue({
        sub: "oauth-sub-1", email: "user@example.com", name: "User",
      });
      mockDbWhere
        .mockResolvedValueOnce([fakeAccount]) // Existing account
        .mockResolvedValueOnce([]);

      const res = await app.inject({
        method: "POST", url: "/callback",
        payload: { code: "auth-code", code_verifier: "verifier" },
      });

      expect(res.statusCode).toBe(200);
      expect(mockDbUpdate).toHaveBeenCalled();
    });

    it("falls back to empty strings for missing userinfo fields", async () => {
      (exchangeCode as any).mockResolvedValue({ access_token: "at-123" });
      // Return userinfo with no sub, no email, no name — only preferred_username
      (getUserinfo as any).mockResolvedValue({
        preferred_username: "fallback-user",
      });
      mockDbWhere
        .mockResolvedValueOnce([]) // No existing account
        .mockResolvedValueOnce([]); // No characters

      const res = await app.inject({
        method: "POST", url: "/callback",
        payload: { code: "auth-code", code_verifier: "verifier" },
      });

      expect(res.statusCode).toBe(200);
      // Account should still be created with fallback values
      expect(mockDbInsert).toHaveBeenCalled();
    });

    it("falls back to email prefix for displayName when name and preferred_username missing", async () => {
      (exchangeCode as any).mockResolvedValue({ access_token: "at-123" });
      (getUserinfo as any).mockResolvedValue({
        sub: "sub-1",
        email: "someone@example.com",
        // no name, no preferred_username → falls back to email.split("@")[0]
      });
      mockDbWhere
        .mockResolvedValueOnce([]) // No existing account
        .mockResolvedValueOnce([]); // No characters

      const res = await app.inject({
        method: "POST", url: "/callback",
        payload: { code: "auth-code", code_verifier: "verifier" },
      });

      expect(res.statusCode).toBe(200);
      expect(mockDbInsert).toHaveBeenCalled();
    });

    it("returns 400 when token exchange fails", async () => {
      (exchangeCode as any).mockRejectedValue(new Error("exchange failed"));

      const res = await app.inject({
        method: "POST", url: "/callback",
        payload: { code: "bad", code_verifier: "bad" },
      });

      expect(res.statusCode).toBe(400);
      expect(JSON.parse(res.body).detail).toBe("Token exchange failed");
    });

    it("returns 400 when no access token", async () => {
      (exchangeCode as any).mockResolvedValue({}); // Missing access_token

      const res = await app.inject({
        method: "POST", url: "/callback",
        payload: { code: "code", code_verifier: "verifier" },
      });

      expect(res.statusCode).toBe(400);
      expect(JSON.parse(res.body).detail).toBe("No access token");
    });

    it("returns 400 when userinfo fails", async () => {
      (exchangeCode as any).mockResolvedValue({ access_token: "at" });
      (getUserinfo as any).mockRejectedValue(new Error("userinfo failed"));

      const res = await app.inject({
        method: "POST", url: "/callback",
        payload: { code: "code", code_verifier: "verifier" },
      });

      expect(res.statusCode).toBe(400);
      expect(JSON.parse(res.body).detail).toBe("Userinfo fetch failed");
    });
  });

  describe("POST /refresh", () => {
    it("refreshes session with new JWT", async () => {
      mockDbWhere.mockResolvedValueOnce([]); // No characters

      const res = await app.inject({
        method: "POST", url: "/refresh",
      });

      expect(res.statusCode).toBe(200);
      const body = JSON.parse(res.body);
      expect(body.gameJwt).toBe("mock-game-jwt");
      expect(body.account).toBeDefined();
    });
  });
});
