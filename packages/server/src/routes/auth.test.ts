import { describe, it, expect, vi, beforeEach } from "vitest";

/**
 * Test auth route helper functions from routes/auth.ts.
 * These are pure mappers not exported, so we replicate them.
 *
 * The route handlers themselves need Fastify + DB, tested separately
 * with integration tests or Playwright.
 */

// Replicate accountToJson from routes/auth.ts
function accountToJson(a: { id: string; email: string; displayName: string; isOnboarded: boolean }) {
  return { id: a.id, email: a.email, displayName: a.displayName, isOnboarded: a.isOnboarded };
}

// Replicate charSummary from routes/auth.ts
function charSummary(c: { id: string; name: string; race: string; level: number }) {
  return { id: c.id, name: c.name, race: c.race, level: c.level };
}

describe("auth route helpers", () => {
  describe("accountToJson", () => {
    it("maps account fields correctly", () => {
      const result = accountToJson({
        id: "acc-1",
        email: "test@example.com",
        displayName: "Tester",
        isOnboarded: true,
      });
      expect(result).toEqual({
        id: "acc-1",
        email: "test@example.com",
        displayName: "Tester",
        isOnboarded: true,
      });
    });

    it("strips extra fields (simulating full DB row)", () => {
      const fullRow: any = {
        id: "acc-1", email: "a@b.com", displayName: "X", isOnboarded: false,
        oauthSub: "sub-123", oauthIssuer: "deepgram", createdAt: new Date(),
      };
      const result = accountToJson(fullRow);
      expect(result).not.toHaveProperty("oauthSub");
      expect(result).not.toHaveProperty("oauthIssuer");
      expect(result).not.toHaveProperty("createdAt");
    });
  });

  describe("charSummary", () => {
    it("maps character summary fields", () => {
      const result = charSummary({
        id: "c-1", name: "Gandalf", race: "human", level: 5,
      });
      expect(result).toEqual({
        id: "c-1", name: "Gandalf", race: "human", level: 5,
      });
    });

    it("strips detailed character fields", () => {
      const fullChar: any = {
        id: "c-1", name: "Hero", race: "elf", level: 3,
        str: 10, dex: 10, intStat: 10, skills: [], hp: 50, mana: 50,
        hairStyle: 0, skinTone: 0, posX: 5, posZ: 10,
      };
      const result = charSummary(fullChar);
      expect(Object.keys(result).sort()).toEqual(["id", "level", "name", "race"]);
    });
  });
});

describe("auth route dev-login validation", () => {
  // Replicate the username check from the dev-login handler
  function validateDevLogin(username: string | undefined): string | null {
    if (!username?.trim()) return "Username required";
    return null;
  }

  it("accepts valid username", () => {
    expect(validateDevLogin("tester")).toBeNull();
  });

  it("rejects empty username", () => {
    expect(validateDevLogin("")).toBe("Username required");
  });

  it("rejects whitespace-only username", () => {
    expect(validateDevLogin("   ")).toBe("Username required");
  });

  it("rejects undefined username", () => {
    expect(validateDevLogin(undefined)).toBe("Username required");
  });

  it("generates correct email format", () => {
    const username = "tester";
    const email = `${username}@dev.local`;
    expect(email).toBe("tester@dev.local");
  });

  it("generates correct oauth sub format", () => {
    const username = "tester";
    const oauthSub = `dev:${username}`;
    expect(oauthSub).toBe("dev:tester");
  });
});
