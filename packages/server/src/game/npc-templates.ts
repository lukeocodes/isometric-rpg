/**
 * NPC Template registry — thin cache over the `npc_templates` DB table.
 *
 * Data lives in the DB (see AGENTS.md "Data in the Database"). The seed
 * `tools/seed-npc-templates.ts` was the one-time migration from the old
 * hand-maintained record. Runtime code reads from an in-memory map that
 * `loadNpcTemplates()` populates at server boot; getters are synchronous
 * so combat / spawner hot paths don't need to await.
 *
 * Type contracts (NPCTemplate / NPCCategory / StatRange) stay here
 * because they're code contracts shared by the combat / spawner modules.
 * `rollStat` is an algorithm, also stays.
 */
import { db } from "../db/postgres.js";
import { npcTemplates } from "../db/schema.js";

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export type NPCCategory = "wildlife" | "monster" | "interactive";

export interface StatRange {
  min: number;
  max: number;
}

export interface NPCTemplate {
  id: string;
  name: string;
  groupId: string;
  category: NPCCategory;

  // Appearance
  bodyColor: string;
  skinColor: string;

  // Combat
  weaponType: "melee" | "ranged" | "magic" | "none";
  weaponDamage: StatRange;
  attackSpeed: StatRange;
  hp: StatRange;

  // Base stats
  str: StatRange;
  dex: StatRange;
  int: StatRange;

  // Behaviour
  aggressive: boolean;
  flees: boolean;
  wanders: boolean;
  canTalk: boolean;

  // Movement (fraction of player base speed)
  speedModifier: number;
  wanderChance: number;
  wanderSteps: number;
}

// ---------------------------------------------------------------------------
// Registry cache — populated at boot by loadNpcTemplates() OR by tests via
// _setNpcTemplatesForTest(fixtures). Hot paths (spawner, combat) read this
// synchronously.
// ---------------------------------------------------------------------------

/** @internal Exported for backwards-compat — code used to import this as a
 *  const. Treat as read-only at runtime. Use the getters below instead. */
export const NPC_TEMPLATES: Record<string, NPCTemplate> = {};

/** Load every row from `npc_templates` into the in-memory cache. Clears
 *  the existing cache first so re-running after a seed picks up changes. */
export async function loadNpcTemplates(): Promise<void> {
  const rows = await db.select().from(npcTemplates);
  // Clear in place so consumers holding a reference to NPC_TEMPLATES still
  // see the fresh data.
  for (const k of Object.keys(NPC_TEMPLATES)) delete NPC_TEMPLATES[k];
  for (const r of rows) {
    NPC_TEMPLATES[r.id] = {
      id:          r.id,
      name:        r.name,
      groupId:     r.groupId,
      category:    r.category as NPCCategory,
      bodyColor:   r.bodyColor,
      skinColor:   r.skinColor,
      weaponType:  r.weaponType as NPCTemplate["weaponType"],
      weaponDamage: { min: r.weaponDamageMin, max: r.weaponDamageMax },
      attackSpeed:  { min: r.attackSpeedMin,  max: r.attackSpeedMax  },
      hp:           { min: r.hpMin, max: r.hpMax },
      str:          { min: r.strMin, max: r.strMax },
      dex:          { min: r.dexMin, max: r.dexMax },
      int:          { min: r.intMin, max: r.intMax },
      aggressive:   r.aggressive,
      flees:        r.flees,
      wanders:      r.wanders,
      canTalk:      r.canTalk,
      speedModifier: r.speedModifier,
      wanderChance:  r.wanderChance,
      wanderSteps:   r.wanderSteps,
    };
  }
  console.log(`[npc-templates] Loaded ${rows.length} template(s) from DB`);
}

/** @internal Test-only helper — populates the cache with fixture data so
 *  the tests don't need a live DB. Production code NEVER calls this. */
export function _setNpcTemplatesForTest(fixtures: Record<string, NPCTemplate>): void {
  for (const k of Object.keys(NPC_TEMPLATES)) delete NPC_TEMPLATES[k];
  for (const [id, t] of Object.entries(fixtures)) NPC_TEMPLATES[id] = t;
}

// ---------------------------------------------------------------------------
// Algorithms — stay in code, not data.
// ---------------------------------------------------------------------------

export function rollStat(range: StatRange): number {
  return Math.floor(Math.random() * (range.max - range.min + 1)) + range.min;
}

// ---------------------------------------------------------------------------
// Getters
// ---------------------------------------------------------------------------

export function getTemplate(id: string): NPCTemplate | undefined {
  return NPC_TEMPLATES[id];
}

export function getTemplatesByGroup(groupId: string): NPCTemplate[] {
  return Object.values(NPC_TEMPLATES).filter((t) => t.groupId === groupId);
}

export function getTemplatesByCategory(category: NPCCategory): NPCTemplate[] {
  return Object.values(NPC_TEMPLATES).filter((t) => t.category === category);
}
