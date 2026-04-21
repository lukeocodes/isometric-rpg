import { describe, it, expect, beforeEach, vi } from "vitest";
import Fastify from "fastify";

// Mock auth middleware to bypass JWT/DB checks
vi.mock("../auth/middleware.js", () => ({
  requireAuth: vi.fn(async (request: any) => {
    request.account = { id: "acc-test", email: "t@t.com", displayName: "Tester", isOnboarded: false };
  }),
}));

// Mock DB with chainable query builder
const mockDbReturning = vi.fn();
const mockDbInsertValues = vi.fn(() => ({ returning: mockDbReturning }));
const mockDbInsert = vi.fn(() => ({ values: mockDbInsertValues }));
const mockDbWhere = vi.fn();
const mockDbFrom = vi.fn(() => ({ where: mockDbWhere }));
const mockDbSelectCount = vi.fn(() => ({ from: vi.fn(() => ({ where: vi.fn().mockResolvedValue([{ value: 0 }]) })) }));
const mockDbSelect = vi.fn((...args: any[]) => {
  if (args.length > 0) return mockDbSelectCount(); // select({ value: count() })
  return { from: mockDbFrom };
});
const mockDbUpdateSet = vi.fn(() => ({ where: vi.fn().mockResolvedValue(undefined) }));
const mockDbUpdate = vi.fn(() => ({ set: mockDbUpdateSet }));

vi.mock("../db/postgres.js", () => ({
  db: {
    select: (...args: any[]) => mockDbSelect(...args),
    insert: (...args: any[]) => mockDbInsert(...args),
    update: (...args: any[]) => mockDbUpdate(...args),
  },
}));

vi.mock("../db/schema.js", () => ({
  accounts: {},
  characters: {},
}));

vi.mock("drizzle-orm", () => ({
  eq: vi.fn((a: any, b: any) => ({ a, b })),
  count: vi.fn(() => "count"),
}));

// Stub map-spawn helpers so the route resolves a spawn without needing the
// real DB-backed user-maps registry.
vi.mock("../game/user-maps.js", () => ({
  getStarterSpawnForRace: () => ({ mapId: 1000, posX: 32, posZ: 32 }),
  getFirstStarterSpawn:   () => ({ mapId: 1000, posX: 32, posZ: 32 }),
  getHeavenSpawn:         () => ({ mapId: 500,  posX: 16, posZ: 16 }),
}));

import { characterRoutes } from "./characters.js";

async function buildApp() {
  const app = Fastify();
  await app.register(characterRoutes, { prefix: "/" });
  return app;
}

const validBody = {
  name: "TestHero",
  race: "human",
  gender: "male",
  str_stat: 10,
  dex_stat: 10,
  int_stat: 10,
  skills: [{ name: "swordsmanship" }, { name: "archery" }, { name: "magery" }],
};

describe("characters API routes", () => {
  let app: ReturnType<typeof Fastify>;

  beforeEach(async () => {
    vi.clearAllMocks();
    app = await buildApp();
    // Default: no existing characters, name available
    mockDbWhere.mockResolvedValue([]);
    mockDbReturning.mockResolvedValue([{
      id: "c-new", name: "TestHero", race: "human", gender: "male", level: 1,
      str: 10, dex: 10, intStat: 10, skills: [{ name: "swordsmanship", value: 30 }],
      hairStyle: 0, hairColor: 0, skinTone: 0, outfit: 0,
      hp: 50, mana: 50, stamina: 50,
    }]);
  });

  describe("GET /", () => {
    it("returns character list", async () => {
      mockDbWhere.mockResolvedValue([
        { id: "c-1", name: "Hero", race: "elf", gender: "female", level: 3,
          str: 10, dex: 10, intStat: 10, skills: [], hairStyle: 0, hairColor: 0,
          skinTone: 0, outfit: 0, hp: 50, mana: 50, stamina: 50 },
      ]);

      const res = await app.inject({ method: "GET", url: "/" });
      expect(res.statusCode).toBe(200);
      const body = JSON.parse(res.body);
      expect(body.characters).toHaveLength(1);
      expect(body.characters[0].name).toBe("Hero");
    });
  });

  describe("POST / — validation", () => {
    it("rejects invalid name", async () => {
      const res = await app.inject({
        method: "POST", url: "/",
        payload: { ...validBody, name: "a" },
      });
      expect(res.statusCode).toBe(400);
      expect(JSON.parse(res.body).detail).toContain("Name");
    });

    it("rejects invalid race", async () => {
      const res = await app.inject({
        method: "POST", url: "/",
        payload: { ...validBody, race: "orc" },
      });
      expect(res.statusCode).toBe(400);
      expect(JSON.parse(res.body).detail).toBe("Invalid race");
    });

    it("rejects invalid gender", async () => {
      const res = await app.inject({
        method: "POST", url: "/",
        payload: { ...validBody, gender: "other" },
      });
      expect(res.statusCode).toBe(400);
      expect(JSON.parse(res.body).detail).toBe("Invalid gender");
    });

    it("rejects stats not totaling 30", async () => {
      const res = await app.inject({
        method: "POST", url: "/",
        payload: { ...validBody, str_stat: 15, dex_stat: 10, int_stat: 10 },
      });
      expect(res.statusCode).toBe(400);
      expect(JSON.parse(res.body).detail).toContain("Stats must total 30");
    });

    it("rejects missing stat fields (defaults to 0)", async () => {
      const res = await app.inject({
        method: "POST", url: "/",
        payload: { ...validBody, str_stat: undefined, dex_stat: undefined, int_stat: undefined },
      });
      expect(res.statusCode).toBe(400);
      expect(JSON.parse(res.body).detail).toContain("Stats must total 30");
    });

    it("rejects stat below 5", async () => {
      const res = await app.inject({
        method: "POST", url: "/",
        payload: { ...validBody, str_stat: 4, dex_stat: 6, int_stat: 20 },
      });
      expect(res.statusCode).toBe(400);
      expect(JSON.parse(res.body).detail).toContain("STR must be 5-20");
    });

    it("rejects wrong number of skills", async () => {
      const res = await app.inject({
        method: "POST", url: "/",
        payload: { ...validBody, skills: [{ name: "archery" }] },
      });
      expect(res.statusCode).toBe(400);
      expect(JSON.parse(res.body).detail).toContain("3 skills");
    });

    it("rejects invalid skill names", async () => {
      const res = await app.inject({
        method: "POST", url: "/",
        payload: { ...validBody, skills: [{ name: "flying" }, { name: "archery" }, { name: "magery" }] },
      });
      expect(res.statusCode).toBe(400);
    });

    it("rejects when max characters reached", async () => {
      // Override count query to return 5
      mockDbSelectCount.mockReturnValueOnce({
        from: vi.fn(() => ({ where: vi.fn().mockResolvedValue([{ value: 5 }]) })),
      });

      const res = await app.inject({
        method: "POST", url: "/",
        payload: validBody,
      });
      expect(res.statusCode).toBe(400);
      expect(JSON.parse(res.body).detail).toBe("Maximum 5 characters");
    });

    it("rejects duplicate character name", async () => {
      // Count check passes (< 5), but name lookup finds existing
      mockDbWhere
        .mockResolvedValueOnce([{ id: "c-existing", name: "TestHero" }]); // Name taken

      const res = await app.inject({
        method: "POST", url: "/",
        payload: validBody,
      });
      expect(res.statusCode).toBe(409);
      expect(JSON.parse(res.body).detail).toBe("Name already taken");
    });
  });

  describe("POST / — success", () => {
    it("creates character with valid data", async () => {
      const res = await app.inject({
        method: "POST", url: "/",
        payload: validBody,
      });
      expect(res.statusCode).toBe(201);
      const body = JSON.parse(res.body);
      expect(body.character.name).toBe("TestHero");
    });
  });

  describe("POST /onboard", () => {
    it("onboards a new account", async () => {
      const res = await app.inject({ method: "POST", url: "/onboard" });
      expect(res.statusCode).toBe(200);
      expect(JSON.parse(res.body).success).toBe(true);
    });

    it("rejects already onboarded account", async () => {
      // Override the mock to set isOnboarded: true
      const { requireAuth } = await import("../auth/middleware.js");
      (requireAuth as any).mockImplementationOnce(async (request: any) => {
        request.account = { id: "acc-test", isOnboarded: true };
      });

      const res = await app.inject({ method: "POST", url: "/onboard" });
      expect(res.statusCode).toBe(400);
      expect(JSON.parse(res.body).detail).toBe("Already onboarded");
    });
  });
});
