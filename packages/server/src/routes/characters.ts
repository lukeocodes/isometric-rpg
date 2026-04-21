import type { FastifyInstance } from "fastify";
import { requireAuth } from "../auth/middleware.js";
import { db } from "../db/postgres.js";
import { accounts, characters } from "../db/schema.js";
import { eq, count } from "drizzle-orm";
import { config } from "../config.js";
import { HEAVEN_NUMERIC_ID } from "../game/user-maps.js";

const VALID_RACES = new Set(["human", "elf", "dwarf"]);
const VALID_GENDERS = new Set(["male", "female"]);
const VALID_SKILLS = new Set([
  "swordsmanship", "archery", "magery", "mining", "lumberjacking",
  "tailoring", "blacksmithing", "alchemy", "fishing", "healing",
  "stealth", "musicianship", "cooking", "carpentry", "taming",
]);
const NAME_RE = /^[a-zA-Z][a-zA-Z0-9 ]{1,18}[a-zA-Z0-9]$/;

function charToJson(c: typeof characters.$inferSelect) {
  return {
    id: c.id, name: c.name, race: c.race, gender: c.gender, level: c.level,
    str: c.str, dex: c.dex, int: c.intStat, skills: c.skills,
    hairStyle: c.hairStyle, hairColor: c.hairColor, skinTone: c.skinTone, outfit: c.outfit,
    hp: c.hp, mana: c.mana, stamina: c.stamina,
  };
}

export async function characterRoutes(app: FastifyInstance) {
  app.addHook("preHandler", requireAuth);

  app.get("/", async (request) => {
    const account = (request as any).account;
    const chars = await db.select().from(characters).where(eq(characters.accountId, account.id));
    return { characters: chars.map(charToJson) };
  });

  app.post<{ Body: any }>("/", async (request, reply) => {
    const account = (request as any).account;
    const b = request.body;

    // Validations
    if (!b.name?.trim() || !NAME_RE.test(b.name.trim()))
      return reply.status(400).send({ detail: "Name must be 3-20 chars, alphanumeric + spaces" });
    if (!VALID_RACES.has(b.race?.toLowerCase()))
      return reply.status(400).send({ detail: "Invalid race" });
    if (!VALID_GENDERS.has(b.gender?.toLowerCase()))
      return reply.status(400).send({ detail: "Invalid gender" });

    const total = (b.str_stat || 0) + (b.dex_stat || 0) + (b.int_stat || 0);
    if (total !== 30) return reply.status(400).send({ detail: `Stats must total 30, got ${total}` });
    for (const [name, val] of [["STR", b.str_stat], ["DEX", b.dex_stat], ["INT", b.int_stat]] as const) {
      if (val < 5 || val > 20) return reply.status(400).send({ detail: `${name} must be 5-20` });
    }

    if (!Array.isArray(b.skills) || b.skills.length !== 3)
      return reply.status(400).send({ detail: "Must choose exactly 3 skills" });
    const skillNames = b.skills.map((s: any) => s.name?.toLowerCase());
    if (new Set(skillNames).size !== 3 || !skillNames.every((s: string) => VALID_SKILLS.has(s)))
      return reply.status(400).send({ detail: "Invalid or duplicate skills" });

    // Count check
    const [{ value: charCount }] = await db.select({ value: count() }).from(characters)
      .where(eq(characters.accountId, account.id));
    if (charCount >= 5) return reply.status(400).send({ detail: "Maximum 5 characters" });

    // Name uniqueness
    const [existing] = await db.select().from(characters).where(eq(characters.name, b.name.trim()));
    if (existing) return reply.status(409).send({ detail: "Name already taken" });

    const [character] = await db.insert(characters).values({
      accountId: account.id,
      name: b.name.trim(),
      race: b.race.toLowerCase(),
      gender: b.gender.toLowerCase(),
      str: b.str_stat, dex: b.dex_stat, intStat: b.int_stat,
      skills: skillNames.map((s: string) => ({ name: s, value: 30.0 })),
      hairStyle: b.hair_style || 0, hairColor: b.hair_color || 0,
      skinTone: b.skin_tone || 0, outfit: b.outfit || 0,
      posX: config.world.spawnX, posY: 0, posZ: config.world.spawnZ, mapId: HEAVEN_NUMERIC_ID,
    }).returning();

    return reply.status(201).send({ character: charToJson(character) });
  });

  app.post("/onboard", async (request, reply) => {
    const account = (request as any).account;
    if (account.isOnboarded) return reply.status(400).send({ detail: "Already onboarded" });
    await db.update(accounts).set({ isOnboarded: true }).where(eq(accounts.id, account.id));
    return { success: true };
  });
}
