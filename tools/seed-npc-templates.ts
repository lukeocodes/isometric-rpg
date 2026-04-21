/**
 * Phase-2 seed — NPC templates → `npc_templates` table.
 *
 * This is the one place left in the repo with hard-coded NPC stat blocks;
 * it's a one-time migration from the old `npc-templates.ts` registry. After
 * the migration, designers author new NPCs via SQL / an admin UI. The
 * runtime `packages/server/src/game/npc-templates.ts` reads from the DB.
 *
 * Inheritance chain (category → group → variant) is resolved to flat rows
 * here at seed time — no inheritance in SQL.
 *
 * Idempotent (UPSERT). Re-run after tweaking a template below.
 *
 *   DATABASE_URL=… bun tools/seed-npc-templates.ts
 *
 * See AGENTS.md "Data in the Database".
 */
import postgres from "postgres";

// ---------------------------------------------------------------------------
// Types — mirror of packages/server/src/game/npc-templates.ts exports.
// Duplicated here so this tool doesn't import the server package (which
// would drag in Drizzle + other runtime deps).
// ---------------------------------------------------------------------------

type NPCCategory = "wildlife" | "monster" | "interactive";

interface StatRange { min: number; max: number }

interface NPCTemplate {
  id: string;
  name: string;
  groupId: string;
  category: NPCCategory;
  bodyColor: string;
  skinColor: string;
  weaponType: "melee" | "ranged" | "magic" | "none";
  weaponDamage: StatRange;
  attackSpeed: StatRange;
  hp: StatRange;
  str: StatRange;
  dex: StatRange;
  int: StatRange;
  aggressive: boolean;
  flees: boolean;
  wanders: boolean;
  canTalk: boolean;
  speedModifier: number;
  wanderChance: number;
  wanderSteps: number;
}

// ---------------------------------------------------------------------------
// Category / group bases (authoring convenience; resolved into flat rows)
// ---------------------------------------------------------------------------

const WILDLIFE_BASE: Partial<NPCTemplate> = {
  category: "wildlife",
  weaponType: "none",
  weaponDamage: { min: 0, max: 0 },
  attackSpeed: { min: 3, max: 3 },
  aggressive: false,
  flees: true,
  wanders: true,
  canTalk: false,
  speedModifier: 0.2,
  wanderChance: 0.04,
  wanderSteps: 2,
};

const MONSTER_BASE: Partial<NPCTemplate> = {
  category: "monster",
  aggressive: true,
  flees: false,
  wanders: true,
  canTalk: false,
  speedModifier: 0.1,
  wanderChance: 0.02,
  wanderSteps: 1,
};

const INTERACTIVE_BASE: Partial<NPCTemplate> = {
  category: "interactive",
  weaponType: "none",
  weaponDamage: { min: 0, max: 0 },
  attackSpeed: { min: 99, max: 99 },
  aggressive: false,
  flees: false,
  wanders: false,
  canTalk: true,
  speedModifier: 0.0,
  wanderChance: 0.0,
  wanderSteps: 0,
};

function template(
  base: Partial<NPCTemplate>,
  overrides: Partial<NPCTemplate> & { id: string; name: string; groupId: string },
): NPCTemplate {
  return {
    category: "monster",
    bodyColor: "#888888",
    skinColor: "#aaaaaa",
    weaponType: "melee",
    weaponDamage: { min: 1, max: 3 },
    attackSpeed: { min: 2, max: 3 },
    hp: { min: 5, max: 15 },
    str: { min: 5, max: 10 },
    dex: { min: 5, max: 10 },
    int: { min: 5, max: 10 },
    aggressive: true,
    flees: false,
    wanders: true,
    canTalk: false,
    speedModifier: 0.1,
    wanderChance: 0.02,
    wanderSteps: 1,
    ...base,
    ...overrides,
  } as NPCTemplate;
}

const SKELETON_GROUP: Partial<NPCTemplate> = {
  ...MONSTER_BASE, groupId: "skeleton",
  bodyColor: "#aaaaaa", skinColor: "#ccccbb",
};
const IMP_GROUP: Partial<NPCTemplate> = {
  ...MONSTER_BASE, groupId: "imp",
  bodyColor: "#cc3333", skinColor: "#dd6666",
};
const RABBIT_GROUP: Partial<NPCTemplate> = {
  ...WILDLIFE_BASE, groupId: "rabbit",
  bodyColor: "#b8a080", skinColor: "#d4c4a8",
};
const GOBLIN_GROUP: Partial<NPCTemplate> = {
  ...MONSTER_BASE, groupId: "goblin",
  bodyColor: "#556b2f", skinColor: "#6b8e23",
};

// ---------------------------------------------------------------------------
// Template data — the actual rows to seed.
// ---------------------------------------------------------------------------

const NPC_TEMPLATES: Record<string, NPCTemplate> = {
  "skeleton-warrior": template(SKELETON_GROUP, {
    id: "skeleton-warrior", name: "Skeleton Warrior", groupId: "skeleton",
    weaponType: "melee",
    weaponDamage: { min: 3, max: 5 }, attackSpeed: { min: 2.0, max: 2.5 },
    hp: { min: 10, max: 15 },
    str: { min: 8, max: 12 }, dex: { min: 5, max: 8 }, int: { min: 3, max: 5 },
  }),
  "skeleton-archer": template(SKELETON_GROUP, {
    id: "skeleton-archer", name: "Skeleton Archer", groupId: "skeleton",
    weaponType: "ranged",
    weaponDamage: { min: 2, max: 4 }, attackSpeed: { min: 2.5, max: 3.0 },
    hp: { min: 8, max: 12 },
    str: { min: 5, max: 7 }, dex: { min: 8, max: 12 }, int: { min: 3, max: 5 },
  }),
  "skeleton-mage": template(SKELETON_GROUP, {
    id: "skeleton-mage", name: "Skeleton Mage", groupId: "skeleton",
    bodyColor: "#9999bb", weaponType: "magic",
    weaponDamage: { min: 4, max: 7 }, attackSpeed: { min: 3.0, max: 3.5 },
    hp: { min: 6, max: 10 },
    str: { min: 3, max: 5 }, dex: { min: 5, max: 7 }, int: { min: 10, max: 15 },
  }),
  "skeleton-lord": template(SKELETON_GROUP, {
    id: "skeleton-lord", name: "Skeleton Lord", groupId: "skeleton",
    bodyColor: "#ddddcc", weaponType: "melee",
    weaponDamage: { min: 6, max: 10 }, attackSpeed: { min: 1.8, max: 2.2 },
    hp: { min: 25, max: 40 },
    str: { min: 12, max: 18 }, dex: { min: 8, max: 12 }, int: { min: 8, max: 12 },
  }),
  "lesser-imp": template(IMP_GROUP, {
    id: "lesser-imp", name: "Lesser Imp", groupId: "imp",
    weaponType: "magic",
    weaponDamage: { min: 2, max: 4 }, attackSpeed: { min: 2.0, max: 2.5 },
    hp: { min: 6, max: 10 },
    str: { min: 3, max: 5 }, dex: { min: 6, max: 8 }, int: { min: 8, max: 12 },
  }),
  "greater-imp": template(IMP_GROUP, {
    id: "greater-imp", name: "Greater Imp", groupId: "imp",
    bodyColor: "#aa1111", weaponType: "magic",
    weaponDamage: { min: 5, max: 8 }, attackSpeed: { min: 2.5, max: 3.0 },
    hp: { min: 15, max: 25 },
    str: { min: 5, max: 8 }, dex: { min: 8, max: 10 }, int: { min: 12, max: 18 },
  }),
  "goblin-grunt": template(GOBLIN_GROUP, {
    id: "goblin-grunt", name: "Goblin Grunt", groupId: "goblin",
    weaponType: "melee",
    weaponDamage: { min: 2, max: 3 }, attackSpeed: { min: 1.8, max: 2.2 },
    hp: { min: 8, max: 12 },
    str: { min: 6, max: 9 }, dex: { min: 7, max: 10 }, int: { min: 3, max: 5 },
  }),
  "goblin-shaman": template(GOBLIN_GROUP, {
    id: "goblin-shaman", name: "Goblin Shaman", groupId: "goblin",
    bodyColor: "#3d5c1e", weaponType: "magic",
    weaponDamage: { min: 3, max: 6 }, attackSpeed: { min: 2.5, max: 3.0 },
    hp: { min: 10, max: 15 },
    str: { min: 4, max: 6 }, dex: { min: 5, max: 7 }, int: { min: 8, max: 12 },
  }),
  "rabbit": template(RABBIT_GROUP, {
    id: "rabbit", name: "Rabbit", groupId: "rabbit",
    weaponType: "none", weaponDamage: { min: 0, max: 0 },
    hp: { min: 3, max: 5 },
    str: { min: 1, max: 2 }, dex: { min: 8, max: 12 }, int: { min: 1, max: 2 },
    speedModifier: 0.4, wanderChance: 0.06, wanderSteps: 3,
  }),
  "king-rabbit": template({ ...INTERACTIVE_BASE, ...RABBIT_GROUP,
    canTalk: true, wanders: true, flees: false,
    speedModifier: 0.1, wanderChance: 0.01, wanderSteps: 1,
  }, {
    id: "king-rabbit", name: "King Rabbit", groupId: "rabbit",
    bodyColor: "#f0e68c", skinColor: "#fff8dc",
    hp: { min: 100, max: 100 },
    str: { min: 1, max: 1 }, dex: { min: 1, max: 1 }, int: { min: 20, max: 20 },
  }),
};

// ---------------------------------------------------------------------------
// Seed
// ---------------------------------------------------------------------------

const DATABASE_URL = process.env.DATABASE_URL
  ?? "postgresql://game:game_dev_password@localhost:5433/game";
const sql = postgres(DATABASE_URL);

async function main() {
  console.log("[seed] connecting to DB:", DATABASE_URL.replace(/:[^:@]+@/, ":***@"));
  const t0 = Date.now();
  const ids = Object.keys(NPC_TEMPLATES);
  console.log(`[seed] npc_templates — ${ids.length} rows`);

  try {
    for (const id of ids) {
      const t = NPC_TEMPLATES[id];
      await sql`
        INSERT INTO npc_templates (
          id, name, group_id, category,
          body_color, skin_color,
          weapon_type, weapon_damage_min, weapon_damage_max,
          attack_speed_min, attack_speed_max,
          hp_min, hp_max,
          str_min, str_max, dex_min, dex_max, int_min, int_max,
          aggressive, flees, wanders, can_talk,
          speed_modifier, wander_chance, wander_steps,
          notes, updated_at
        ) VALUES (
          ${t.id}, ${t.name}, ${t.groupId}, ${t.category},
          ${t.bodyColor}, ${t.skinColor},
          ${t.weaponType}, ${t.weaponDamage.min}, ${t.weaponDamage.max},
          ${t.attackSpeed.min}, ${t.attackSpeed.max},
          ${t.hp.min}, ${t.hp.max},
          ${t.str.min}, ${t.str.max}, ${t.dex.min}, ${t.dex.max}, ${t.int.min}, ${t.int.max},
          ${t.aggressive}, ${t.flees}, ${t.wanders}, ${t.canTalk},
          ${t.speedModifier}, ${t.wanderChance}, ${t.wanderSteps},
          ${null}, NOW()
        )
        ON CONFLICT (id) DO UPDATE SET
          name                 = EXCLUDED.name,
          group_id             = EXCLUDED.group_id,
          category             = EXCLUDED.category,
          body_color           = EXCLUDED.body_color,
          skin_color           = EXCLUDED.skin_color,
          weapon_type          = EXCLUDED.weapon_type,
          weapon_damage_min    = EXCLUDED.weapon_damage_min,
          weapon_damage_max    = EXCLUDED.weapon_damage_max,
          attack_speed_min     = EXCLUDED.attack_speed_min,
          attack_speed_max     = EXCLUDED.attack_speed_max,
          hp_min               = EXCLUDED.hp_min,
          hp_max               = EXCLUDED.hp_max,
          str_min              = EXCLUDED.str_min,
          str_max              = EXCLUDED.str_max,
          dex_min              = EXCLUDED.dex_min,
          dex_max              = EXCLUDED.dex_max,
          int_min              = EXCLUDED.int_min,
          int_max              = EXCLUDED.int_max,
          aggressive           = EXCLUDED.aggressive,
          flees                = EXCLUDED.flees,
          wanders              = EXCLUDED.wanders,
          can_talk             = EXCLUDED.can_talk,
          speed_modifier       = EXCLUDED.speed_modifier,
          wander_chance        = EXCLUDED.wander_chance,
          wander_steps         = EXCLUDED.wander_steps,
          updated_at           = NOW()
      `;
    }
  } finally {
    await sql.end();
  }

  const dt = ((Date.now() - t0) / 1000).toFixed(2);
  console.log(`[seed] done in ${dt}s`);
}

main().catch((err) => {
  console.error("[seed] FAILED:", err);
  process.exit(1);
});
