/**
 * Phase-2b seed — items + loot tables.
 *
 * One-time migration from the old `game/items.ts` ITEMS + LOOT_TABLES
 * records. After this, item/loot data lives in the DB; designers author
 * new items via SQL / admin UI.
 *
 * Idempotent (UPSERT). Re-run after tweaking a row below.
 *
 *   DATABASE_URL=… bun tools/seed-items.ts
 *
 * See AGENTS.md "Data in the Database".
 */
import postgres from "postgres";

// ---------------------------------------------------------------------------
// Data (copied from the former packages/server/src/game/items.ts)
// ---------------------------------------------------------------------------

type ItemSlot = "weapon" | "head" | "chest" | "legs" | "feet" | "ring" | "trinket";
type ItemType = "weapon" | "armor" | "consumable" | "material";
type WeaponSubtype = "sword" | "axe" | "bow" | "staff" | "dagger";
type ArmorWeight = "light" | "medium" | "heavy";

interface ItemTemplate {
  id: string;
  name: string;
  type: ItemType;
  slot?: ItemSlot;
  weaponSubtype?: WeaponSubtype;
  armorWeight?: ArmorWeight;
  icon: string;
  description: string;
  level: number;
  bonusStr?: number;
  bonusDex?: number;
  bonusInt?: number;
  bonusHp?: number;
  bonusDamage?: number;
  bonusArmor?: number;
  healAmount?: number;
  stackLimit: number;
  value: number;
}

interface LootEntry {
  itemId: string;
  chance: number;
  minQty: number;
  maxQty: number;
}

const ITEMS: Record<string, ItemTemplate> = {
  "health-potion-small": {
    id: "health-potion-small", name: "Small Health Potion", type: "consumable",
    icon: "🧪", description: "Restores 25 HP", level: 1,
    healAmount: 25, stackLimit: 20, value: 5,
  },
  "health-potion-medium": {
    id: "health-potion-medium", name: "Health Potion", type: "consumable",
    icon: "🧪", description: "Restores 50 HP", level: 5,
    healAmount: 50, stackLimit: 20, value: 15,
  },
  "rabbit-hide": {
    id: "rabbit-hide", name: "Rabbit Hide", type: "material",
    icon: "🐾", description: "Soft fur from a rabbit", level: 1,
    stackLimit: 50, value: 2,
  },
  "bone-fragment": {
    id: "bone-fragment", name: "Bone Fragment", type: "material",
    icon: "🦴", description: "A shard of bleached bone", level: 1,
    stackLimit: 50, value: 3,
  },
  "goblin-ear": {
    id: "goblin-ear", name: "Goblin Ear", type: "material",
    icon: "👂", description: "Proof of a goblin kill", level: 1,
    stackLimit: 50, value: 4,
  },
  "imp-horn": {
    id: "imp-horn", name: "Imp Horn", type: "material",
    icon: "🔺", description: "A small curved horn", level: 1,
    stackLimit: 50, value: 5,
  },
  "rusty-sword": {
    id: "rusty-sword", name: "Rusty Sword", type: "weapon", slot: "weapon",
    weaponSubtype: "sword", icon: "🗡️", description: "A dull, rusty blade",
    level: 1, bonusDamage: 2, stackLimit: 1, value: 10,
  },
  "wooden-bow": {
    id: "wooden-bow", name: "Wooden Bow", type: "weapon", slot: "weapon",
    weaponSubtype: "bow", icon: "🏹", description: "A simple shortbow",
    level: 1, bonusDamage: 2, bonusDex: 1, stackLimit: 1, value: 12,
  },
  "gnarled-staff": {
    id: "gnarled-staff", name: "Gnarled Staff", type: "weapon", slot: "weapon",
    weaponSubtype: "staff", icon: "🪄", description: "A twisted branch with faint magical energy",
    level: 2, bonusDamage: 3, bonusInt: 2, stackLimit: 1, value: 18,
  },
  "goblin-dagger": {
    id: "goblin-dagger", name: "Goblin Dagger", type: "weapon", slot: "weapon",
    weaponSubtype: "dagger", icon: "🔪", description: "Crude but sharp",
    level: 2, bonusDamage: 3, bonusDex: 1, stackLimit: 1, value: 15,
  },
  "bone-axe": {
    id: "bone-axe", name: "Bone Axe", type: "weapon", slot: "weapon",
    weaponSubtype: "axe", icon: "🪓", description: "An axe crafted from skeletal remains",
    level: 3, bonusDamage: 4, bonusStr: 2, stackLimit: 1, value: 25,
  },
  "leather-cap": {
    id: "leather-cap", name: "Leather Cap", type: "armor", slot: "head",
    armorWeight: "light", icon: "🎩", description: "Basic head protection",
    level: 1, bonusArmor: 1, stackLimit: 1, value: 8,
  },
  "hide-vest": {
    id: "hide-vest", name: "Hide Vest", type: "armor", slot: "chest",
    armorWeight: "light", icon: "🦺", description: "A vest made from animal hides",
    level: 1, bonusArmor: 2, bonusHp: 5, stackLimit: 1, value: 12,
  },
  "bone-helm": {
    id: "bone-helm", name: "Bone Helm", type: "armor", slot: "head",
    armorWeight: "medium", icon: "💀", description: "A helmet fashioned from skull fragments",
    level: 2, bonusArmor: 2, bonusStr: 1, stackLimit: 1, value: 16,
  },
  "chainmail-vest": {
    id: "chainmail-vest", name: "Chainmail Vest", type: "armor", slot: "chest",
    armorWeight: "heavy", icon: "🛡️", description: "Interlocking metal rings",
    level: 3, bonusArmor: 4, bonusHp: 10, stackLimit: 1, value: 30,
  },
  "leather-boots": {
    id: "leather-boots", name: "Leather Boots", type: "armor", slot: "feet",
    armorWeight: "light", icon: "👢", description: "Sturdy walking boots",
    level: 1, bonusArmor: 1, bonusDex: 1, stackLimit: 1, value: 8,
  },
  "rabbit-foot": {
    id: "rabbit-foot", name: "Lucky Rabbit Foot", type: "armor", slot: "trinket",
    icon: "🐇", description: "Grants a small luck bonus",
    level: 1, bonusDex: 2, stackLimit: 1, value: 20,
  },
};

const LOOT_TABLES: Record<string, LootEntry[]> = {
  "rabbit": [
    { itemId: "rabbit-hide", chance: 0.6, minQty: 1, maxQty: 2 },
    { itemId: "health-potion-small", chance: 0.15, minQty: 1, maxQty: 1 },
    { itemId: "rabbit-foot", chance: 0.03, minQty: 1, maxQty: 1 },
  ],
  "skeleton-warrior": [
    { itemId: "bone-fragment", chance: 0.5, minQty: 1, maxQty: 3 },
    { itemId: "rusty-sword", chance: 0.08, minQty: 1, maxQty: 1 },
    { itemId: "bone-helm", chance: 0.05, minQty: 1, maxQty: 1 },
    { itemId: "health-potion-small", chance: 0.2, minQty: 1, maxQty: 1 },
  ],
  "skeleton-archer": [
    { itemId: "bone-fragment", chance: 0.5, minQty: 1, maxQty: 2 },
    { itemId: "wooden-bow", chance: 0.08, minQty: 1, maxQty: 1 },
    { itemId: "leather-cap", chance: 0.06, minQty: 1, maxQty: 1 },
    { itemId: "health-potion-small", chance: 0.2, minQty: 1, maxQty: 1 },
  ],
  "skeleton-mage": [
    { itemId: "bone-fragment", chance: 0.4, minQty: 1, maxQty: 2 },
    { itemId: "gnarled-staff", chance: 0.06, minQty: 1, maxQty: 1 },
    { itemId: "health-potion-medium", chance: 0.1, minQty: 1, maxQty: 1 },
  ],
  "goblin-grunt": [
    { itemId: "goblin-ear", chance: 0.5, minQty: 1, maxQty: 1 },
    { itemId: "goblin-dagger", chance: 0.07, minQty: 1, maxQty: 1 },
    { itemId: "hide-vest", chance: 0.05, minQty: 1, maxQty: 1 },
    { itemId: "health-potion-small", chance: 0.2, minQty: 1, maxQty: 1 },
    { itemId: "leather-boots", chance: 0.04, minQty: 1, maxQty: 1 },
  ],
  "goblin-shaman": [
    { itemId: "goblin-ear", chance: 0.5, minQty: 1, maxQty: 1 },
    { itemId: "gnarled-staff", chance: 0.08, minQty: 1, maxQty: 1 },
    { itemId: "health-potion-medium", chance: 0.12, minQty: 1, maxQty: 1 },
  ],
  // NOTE: the "imp" loot table keyed by the group id doesn't match a real
  // NPC template id. The original items.ts used "imp"; the actual templates
  // are "lesser-imp"/"greater-imp". For the migration we drop the orphan
  // key rather than fabricate rows.
  "skeleton-lord": [
    { itemId: "bone-fragment", chance: 0.8, minQty: 2, maxQty: 5 },
    { itemId: "bone-axe", chance: 0.1, minQty: 1, maxQty: 1 },
    { itemId: "bone-helm", chance: 0.1, minQty: 1, maxQty: 1 },
    { itemId: "chainmail-vest", chance: 0.04, minQty: 1, maxQty: 1 },
    { itemId: "health-potion-medium", chance: 0.25, minQty: 1, maxQty: 1 },
  ],
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

  const itemIds = Object.keys(ITEMS);
  console.log(`[seed] item_templates — ${itemIds.length} rows`);
  try {
    for (const id of itemIds) {
      const t = ITEMS[id];
      await sql`
        INSERT INTO item_templates (
          id, name, item_type, slot, weapon_subtype, armor_weight,
          icon, description, level,
          bonus_str, bonus_dex, bonus_int, bonus_hp, bonus_damage, bonus_armor,
          heal_amount, stack_limit, value, updated_at
        ) VALUES (
          ${t.id}, ${t.name}, ${t.type},
          ${t.slot ?? null}, ${t.weaponSubtype ?? null}, ${t.armorWeight ?? null},
          ${t.icon}, ${t.description}, ${t.level},
          ${t.bonusStr ?? 0}, ${t.bonusDex ?? 0}, ${t.bonusInt ?? 0},
          ${t.bonusHp ?? 0}, ${t.bonusDamage ?? 0}, ${t.bonusArmor ?? 0},
          ${t.healAmount ?? 0}, ${t.stackLimit}, ${t.value}, NOW()
        )
        ON CONFLICT (id) DO UPDATE SET
          name           = EXCLUDED.name,
          item_type      = EXCLUDED.item_type,
          slot           = EXCLUDED.slot,
          weapon_subtype = EXCLUDED.weapon_subtype,
          armor_weight   = EXCLUDED.armor_weight,
          icon           = EXCLUDED.icon,
          description    = EXCLUDED.description,
          level          = EXCLUDED.level,
          bonus_str      = EXCLUDED.bonus_str,
          bonus_dex      = EXCLUDED.bonus_dex,
          bonus_int      = EXCLUDED.bonus_int,
          bonus_hp       = EXCLUDED.bonus_hp,
          bonus_damage   = EXCLUDED.bonus_damage,
          bonus_armor    = EXCLUDED.bonus_armor,
          heal_amount    = EXCLUDED.heal_amount,
          stack_limit    = EXCLUDED.stack_limit,
          value          = EXCLUDED.value,
          updated_at     = NOW()
      `;
    }

    // Replace all loot entries per NPC template (wipe then re-insert, small
    // table, simpler than diff-upsert). Skip any entry whose NPC template
    // isn't in the DB — FK would reject it.
    const npcIds = Object.keys(LOOT_TABLES);
    let totalLoot = 0;
    for (const npcId of npcIds) {
      await sql`DELETE FROM loot_entries WHERE npc_template_id = ${npcId}`;
    }
    for (const npcId of npcIds) {
      const entries = LOOT_TABLES[npcId];
      for (const e of entries) {
        try {
          await sql`
            INSERT INTO loot_entries (npc_template_id, item_id, chance, min_qty, max_qty)
            VALUES (${npcId}, ${e.itemId}, ${e.chance}, ${e.minQty}, ${e.maxQty})
          `;
          totalLoot++;
        } catch (err) {
          // FK violation — NPC template not in DB. Log and continue.
          console.warn(`  [skip] loot for ${npcId} → ${e.itemId}: ${(err as Error).message}`);
        }
      }
    }
    console.log(`[seed] loot_entries — ${totalLoot} rows across ${npcIds.length} NPC template(s)`);
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
