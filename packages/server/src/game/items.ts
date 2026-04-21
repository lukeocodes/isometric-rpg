/**
 * Item registry + loot tables — thin cache over the `item_templates` and
 * `loot_entries` DB tables.
 *
 * Data lives in the DB (see AGENTS.md "Data in the Database"). The seed
 * `tools/seed-items.ts` was the one-time migration from the old
 * hand-maintained records. Runtime reads from in-memory maps populated at
 * server boot by `loadItems()` + `loadLootTables()`; getters stay sync so
 * combat / inventory hot paths don't need to await.
 *
 * Type contracts (ItemTemplate, LootEntry, LootTable, and the slot/type
 * string unions) stay here — they're the shared surface combat/inventory
 * code relies on. `rollLoot` is an algorithm, also stays.
 */
import { db } from "../db/postgres.js";
import { itemTemplates, lootEntries } from "../db/schema.js";

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export type ItemSlot      = "weapon" | "head" | "chest" | "legs" | "feet" | "ring" | "trinket";
export type ItemType      = "weapon" | "armor" | "consumable" | "material";
export type WeaponSubtype = "sword" | "axe" | "bow" | "staff" | "dagger";
export type ArmorWeight   = "light" | "medium" | "heavy";

export interface ItemTemplate {
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

export interface LootEntry {
  itemId: string;
  chance: number;    // 0.0 – 1.0
  minQty: number;
  maxQty: number;
}

export type LootTable = LootEntry[];

// ---------------------------------------------------------------------------
// In-memory caches — populated at boot (or by tests via setters).
// ---------------------------------------------------------------------------

/** @internal Exported for backwards-compat. Treat as read-only at runtime. */
export const ITEMS: Record<string, ItemTemplate> = {};

/** @internal Loot tables keyed by NPC template id. Read-only at runtime. */
export const LOOT_TABLES: Record<string, LootTable> = {};

/** Populate the item catalogue cache from the DB. Clears the cache first
 *  so re-running after a seed picks up changes. */
export async function loadItems(): Promise<void> {
  const rows = await db.select().from(itemTemplates);
  for (const k of Object.keys(ITEMS)) delete ITEMS[k];
  for (const r of rows) {
    const item: ItemTemplate = {
      id:          r.id,
      name:        r.name,
      type:        r.itemType as ItemType,
      icon:        r.icon,
      description: r.description,
      level:       r.level,
      stackLimit:  r.stackLimit,
      value:       r.value,
    };
    if (r.slot)            item.slot          = r.slot as ItemSlot;
    if (r.weaponSubtype)   item.weaponSubtype = r.weaponSubtype as WeaponSubtype;
    if (r.armorWeight)     item.armorWeight   = r.armorWeight as ArmorWeight;
    if (r.bonusStr    !== 0) item.bonusStr    = r.bonusStr;
    if (r.bonusDex    !== 0) item.bonusDex    = r.bonusDex;
    if (r.bonusInt    !== 0) item.bonusInt    = r.bonusInt;
    if (r.bonusHp     !== 0) item.bonusHp     = r.bonusHp;
    if (r.bonusDamage !== 0) item.bonusDamage = r.bonusDamage;
    if (r.bonusArmor  !== 0) item.bonusArmor  = r.bonusArmor;
    if (r.healAmount  !== 0) item.healAmount  = r.healAmount;
    ITEMS[r.id] = item;
  }
  console.log(`[items] Loaded ${rows.length} item template(s) from DB`);
}

/** Populate loot tables from the DB. Clears the cache first. */
export async function loadLootTables(): Promise<void> {
  const rows = await db.select().from(lootEntries);
  for (const k of Object.keys(LOOT_TABLES)) delete LOOT_TABLES[k];
  for (const r of rows) {
    const table = LOOT_TABLES[r.npcTemplateId] ?? [];
    table.push({
      itemId: r.itemId,
      chance: r.chance,
      minQty: r.minQty,
      maxQty: r.maxQty,
    });
    LOOT_TABLES[r.npcTemplateId] = table;
  }
  console.log(
    `[items] Loaded ${rows.length} loot entr(ies) across ` +
    `${Object.keys(LOOT_TABLES).length} NPC template(s) from DB`,
  );
}

/** @internal Test-only helper — seeds caches with fixture data. */
export function _setItemsForTest(
  items: Record<string, ItemTemplate>,
  loot:  Record<string, LootTable> = {},
): void {
  for (const k of Object.keys(ITEMS))       delete ITEMS[k];
  for (const k of Object.keys(LOOT_TABLES)) delete LOOT_TABLES[k];
  for (const [id, t] of Object.entries(items)) ITEMS[id] = t;
  for (const [id, t] of Object.entries(loot))  LOOT_TABLES[id] = t;
}

// ---------------------------------------------------------------------------
// Algorithms + getters
// ---------------------------------------------------------------------------

/** Roll loot from a loot table. Returns array of {itemId, qty} drops. */
export function rollLoot(npcTemplateId: string): Array<{ itemId: string; qty: number }> {
  const table = LOOT_TABLES[npcTemplateId];
  if (!table) return [];
  const drops: Array<{ itemId: string; qty: number }> = [];
  for (const entry of table) {
    if (Math.random() < entry.chance) {
      const qty = entry.minQty + Math.floor(Math.random() * (entry.maxQty - entry.minQty + 1));
      drops.push({ itemId: entry.itemId, qty });
    }
  }
  return drops;
}

export function getItem(itemId: string): ItemTemplate | undefined {
  return ITEMS[itemId];
}
