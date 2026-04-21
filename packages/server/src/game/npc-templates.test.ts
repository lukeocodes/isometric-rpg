/**
 * npc-templates — cache + getter unit tests.
 *
 * The registry is DB-backed in production. These tests seed the in-memory
 * cache with fixtures via `_setNpcTemplatesForTest` so they don't depend
 * on a live database; the actual production data lives in the
 * `npc_templates` table (see tools/seed-npc-templates.ts for the one-time
 * migration source).
 */
import { beforeEach, describe, it, expect } from "vitest";
import {
  NPC_TEMPLATES,
  rollStat,
  getTemplate,
  getTemplatesByGroup,
  getTemplatesByCategory,
  _setNpcTemplatesForTest,
  type NPCTemplate,
} from "./npc-templates.js";

// Minimal fixture covering each category + multiple group variants.
// Not the production data — that lives in the DB.
const FIXTURES: Record<string, NPCTemplate> = {
  "skeleton-warrior": {
    id: "skeleton-warrior", name: "Skeleton Warrior", groupId: "skeleton", category: "monster",
    bodyColor: "#aaa", skinColor: "#ccb",
    weaponType: "melee", weaponDamage: { min: 3, max: 5 }, attackSpeed: { min: 2, max: 2.5 },
    hp: { min: 10, max: 15 }, str: { min: 8, max: 12 }, dex: { min: 5, max: 8 }, int: { min: 3, max: 5 },
    aggressive: true, flees: false, wanders: true, canTalk: false,
    speedModifier: 0.1, wanderChance: 0.02, wanderSteps: 1,
  },
  "skeleton-archer": {
    id: "skeleton-archer", name: "Skeleton Archer", groupId: "skeleton", category: "monster",
    bodyColor: "#aaa", skinColor: "#ccb",
    weaponType: "ranged", weaponDamage: { min: 2, max: 4 }, attackSpeed: { min: 2.5, max: 3 },
    hp: { min: 8, max: 12 }, str: { min: 5, max: 7 }, dex: { min: 8, max: 12 }, int: { min: 3, max: 5 },
    aggressive: true, flees: false, wanders: true, canTalk: false,
    speedModifier: 0.1, wanderChance: 0.02, wanderSteps: 1,
  },
  "rabbit": {
    id: "rabbit", name: "Rabbit", groupId: "rabbit", category: "wildlife",
    bodyColor: "#b8a", skinColor: "#d4c",
    weaponType: "none", weaponDamage: { min: 0, max: 0 }, attackSpeed: { min: 3, max: 3 },
    hp: { min: 3, max: 5 }, str: { min: 1, max: 2 }, dex: { min: 8, max: 12 }, int: { min: 1, max: 2 },
    aggressive: false, flees: true, wanders: true, canTalk: false,
    speedModifier: 0.4, wanderChance: 0.06, wanderSteps: 3,
  },
  "king-rabbit": {
    id: "king-rabbit", name: "King Rabbit", groupId: "rabbit", category: "interactive",
    bodyColor: "#f0e", skinColor: "#fff",
    weaponType: "none", weaponDamage: { min: 0, max: 0 }, attackSpeed: { min: 99, max: 99 },
    hp: { min: 100, max: 100 }, str: { min: 1, max: 1 }, dex: { min: 1, max: 1 }, int: { min: 20, max: 20 },
    aggressive: false, flees: false, wanders: true, canTalk: true,
    speedModifier: 0.1, wanderChance: 0.01, wanderSteps: 1,
  },
};

describe("npc-templates", () => {
  beforeEach(() => _setNpcTemplatesForTest(FIXTURES));

  describe("registry cache", () => {
    it("loads fixtures via _setNpcTemplatesForTest", () => {
      expect(Object.keys(NPC_TEMPLATES)).toHaveLength(4);
      expect(NPC_TEMPLATES["skeleton-warrior"]).toBeDefined();
    });

    it("exposes all required fields on each template", () => {
      for (const [id, t] of Object.entries(NPC_TEMPLATES)) {
        expect(t.id, `${id} missing id`).toBe(id);
        expect(t.name, `${id} missing name`).toBeTruthy();
        expect(t.groupId, `${id} missing groupId`).toBeTruthy();
        expect(t.category, `${id} missing category`).toBeTruthy();
        expect(t.hp.min, `${id} hp.min`).toBeGreaterThanOrEqual(0);
        expect(t.hp.max, `${id} hp.max`).toBeGreaterThanOrEqual(t.hp.min);
      }
    });

    it("weapon ranges match weapon type", () => {
      for (const [id, t] of Object.entries(NPC_TEMPLATES)) {
        if (t.weaponType === "none") {
          expect(t.weaponDamage.max, `${id} none weapon should do 0 damage`).toBe(0);
        } else {
          expect(t.weaponDamage.max, `${id} armed weapon should do damage`).toBeGreaterThan(0);
        }
      }
    });
  });

  describe("rollStat", () => {
    it("returns min when min equals max", () => {
      expect(rollStat({ min: 100, max: 100 })).toBe(100);
    });

    it("returns values within the range (statistical)", () => {
      const range = { min: 3, max: 7 };
      const results = new Set<number>();
      for (let i = 0; i < 500; i++) results.add(rollStat(range));
      for (let v = range.min; v <= range.max; v++) {
        expect(results.has(v), `expected ${v} to appear in rolls`).toBe(true);
      }
    });

    it("never returns values outside the range", () => {
      const range = { min: 5, max: 10 };
      for (let i = 0; i < 200; i++) {
        const v = rollStat(range);
        expect(v).toBeGreaterThanOrEqual(range.min);
        expect(v).toBeLessThanOrEqual(range.max);
      }
    });

    it("returns integers only", () => {
      for (let i = 0; i < 100; i++) {
        const v = rollStat({ min: 1, max: 20 });
        expect(v).toBe(Math.floor(v));
      }
    });
  });

  describe("getTemplate", () => {
    it("returns the correct template by ID", () => {
      const t = getTemplate("rabbit");
      expect(t).toBeDefined();
      expect(t!.name).toBe("Rabbit");
    });

    it("returns undefined for unknown ID", () => {
      expect(getTemplate("dragon-lord")).toBeUndefined();
    });
  });

  describe("getTemplatesByGroup", () => {
    it("finds all skeleton variants", () => {
      const skeletons = getTemplatesByGroup("skeleton");
      expect(skeletons.map((t) => t.id).sort()).toEqual(["skeleton-archer", "skeleton-warrior"]);
    });

    it("returns empty for unknown group", () => {
      expect(getTemplatesByGroup("dragon")).toEqual([]);
    });
  });

  describe("getTemplatesByCategory", () => {
    it("finds all monsters", () => {
      const monsters = getTemplatesByCategory("monster");
      expect(monsters.length).toBe(2);
      for (const m of monsters) expect(m.category).toBe("monster");
    });

    it("finds wildlife", () => {
      const wildlife = getTemplatesByCategory("wildlife");
      expect(wildlife.some((w) => w.id === "rabbit")).toBe(true);
    });

    it("finds interactive", () => {
      const interactive = getTemplatesByCategory("interactive");
      expect(interactive.some((t) => t.id === "king-rabbit")).toBe(true);
    });
  });
});
