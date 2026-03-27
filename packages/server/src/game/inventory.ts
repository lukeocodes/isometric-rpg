/**
 * Inventory Manager — handles loot drops, item storage, equip/unequip.
 *
 * In-memory inventory per active character, synced to DB on disconnect.
 * Loot is rolled on NPC kill and sent to the player's inventory.
 */

import { db } from "../db/postgres.js";
import { characterInventory } from "../db/schema.js";
import { eq } from "drizzle-orm";
import { rollLoot, getItem, type ItemTemplate } from "./items.js";
import { getSpawnPointTemplate } from "./spawn-points.js";
import { connectionManager } from "../ws/connections.js";
import { Opcode, packReliable } from "./protocol.js";

export interface InventorySlot {
  id: string;         // DB row id
  itemId: string;
  quantity: number;
  equipped: boolean;
  slot: string | null;
}

// In-memory inventory per character (characterId -> items)
const inventories = new Map<string, InventorySlot[]>();
// Map entityId -> characterId for active players
const entityToCharacter = new Map<string, string>();

/** Load inventory from DB when player joins */
export async function loadInventory(entityId: string, characterId: string): Promise<void> {
  entityToCharacter.set(entityId, characterId);

  const rows = await db.select().from(characterInventory)
    .where(eq(characterInventory.characterId, characterId));

  const slots: InventorySlot[] = rows.map(r => ({
    id: r.id,
    itemId: r.itemId,
    quantity: r.quantity,
    equipped: r.equipped,
    slot: r.slot,
  }));

  inventories.set(characterId, slots);
}

/** Send full inventory to player */
export function sendInventory(entityId: string): void {
  const charId = entityToCharacter.get(entityId);
  if (!charId) return;
  const slots = inventories.get(charId) ?? [];

  const items = slots.map(s => {
    const template = getItem(s.itemId);
    return {
      id: s.id,
      itemId: s.itemId,
      name: template?.name ?? s.itemId,
      icon: template?.icon ?? "?",
      type: template?.type ?? "material",
      quantity: s.quantity,
      equipped: s.equipped,
      slot: s.slot,
    };
  });

  connectionManager.sendReliable(entityId,
    packReliable(Opcode.INVENTORY_SYNC, { items }));
}

/** Roll loot for a killed NPC and add to killer's inventory */
export function rollAndGiveLoot(killerEntityId: string, npcEntityId: string): void {
  const charId = entityToCharacter.get(killerEntityId);
  if (!charId) return;

  const template = getSpawnPointTemplate(npcEntityId);
  const templateId = template?.id;
  if (!templateId) return;

  const drops = rollLoot(templateId);
  if (drops.length === 0) return;

  const inventory = inventories.get(charId);
  if (!inventory) return;

  const lootItems: Array<{ itemId: string; name: string; icon: string; qty: number }> = [];

  for (const drop of drops) {
    const item = getItem(drop.itemId);
    if (!item) continue;

    // Stack with existing if possible
    if (item.stackLimit > 1) {
      const existing = inventory.find(s => s.itemId === drop.itemId && !s.equipped);
      if (existing && existing.quantity + drop.qty <= item.stackLimit) {
        existing.quantity += drop.qty;
        lootItems.push({ itemId: drop.itemId, name: item.name, icon: item.icon, qty: drop.qty });
        continue;
      }
    }

    // New slot
    const newSlot: InventorySlot = {
      id: crypto.randomUUID(),
      itemId: drop.itemId,
      quantity: drop.qty,
      equipped: false,
      slot: null,
    };
    inventory.push(newSlot);
    lootItems.push({ itemId: drop.itemId, name: item.name, icon: item.icon, qty: drop.qty });
  }

  if (lootItems.length > 0) {
    connectionManager.sendReliable(killerEntityId,
      packReliable(Opcode.LOOT_DROP, { items: lootItems }));
    // Also send full inventory sync so UI panel updates
    sendInventory(killerEntityId);
  }
}

/** Save inventory to DB (call on disconnect) */
export async function saveInventory(entityId: string): Promise<void> {
  const charId = entityToCharacter.get(entityId);
  if (!charId) return;

  const slots = inventories.get(charId);
  if (!slots) return;

  // Delete all existing rows and re-insert (simple but effective for small inventories)
  await db.delete(characterInventory)
    .where(eq(characterInventory.characterId, charId));

  if (slots.length > 0) {
    await db.insert(characterInventory).values(
      slots.map(s => ({
        id: s.id,
        characterId: charId,
        itemId: s.itemId,
        quantity: s.quantity,
        equipped: s.equipped,
        slot: s.slot,
      }))
    );
  }

  inventories.delete(charId);
  entityToCharacter.delete(entityId);
}

/** Equip an item by inventory row ID. Unequips existing item in that slot. */
export function equipItem(entityId: string, inventoryId: string): boolean {
  const charId = entityToCharacter.get(entityId);
  if (!charId) return false;
  const inventory = inventories.get(charId);
  if (!inventory) return false;

  const item = inventory.find(s => s.id === inventoryId);
  if (!item || item.equipped) return false;

  const template = getItem(item.itemId);
  if (!template?.slot) return false; // Not equippable

  // Unequip existing item in that slot
  const existing = inventory.find(s => s.equipped && s.slot === template.slot);
  if (existing) {
    existing.equipped = false;
    existing.slot = null;
  }

  item.equipped = true;
  item.slot = template.slot;
  sendInventory(entityId);
  return true;
}

/** Unequip an item by inventory row ID */
export function unequipItem(entityId: string, inventoryId: string): boolean {
  const charId = entityToCharacter.get(entityId);
  if (!charId) return false;
  const inventory = inventories.get(charId);
  if (!inventory) return false;

  const item = inventory.find(s => s.id === inventoryId);
  if (!item || !item.equipped) return false;

  item.equipped = false;
  item.slot = null;
  sendInventory(entityId);
  return true;
}

/** Use a consumable item */
export function useItem(entityId: string, inventoryId: string): { healAmount: number } | null {
  const charId = entityToCharacter.get(entityId);
  if (!charId) return null;
  const inventory = inventories.get(charId);
  if (!inventory) return null;

  const idx = inventory.findIndex(s => s.id === inventoryId);
  if (idx === -1) return null;
  const item = inventory[idx];

  const template = getItem(item.itemId);
  if (!template || template.type !== "consumable") return null;

  // Consume: reduce quantity or remove
  if (item.quantity > 1) {
    item.quantity--;
  } else {
    inventory.splice(idx, 1);
  }

  sendInventory(entityId);
  return { healAmount: template.healAmount ?? 0 };
}

/** Get a player's equipped item bonuses */
export function getEquippedBonuses(entityId: string): {
  bonusDamage: number; bonusArmor: number; bonusHp: number;
  bonusStr: number; bonusDex: number; bonusInt: number;
} {
  const charId = entityToCharacter.get(entityId);
  const totals = { bonusDamage: 0, bonusArmor: 0, bonusHp: 0, bonusStr: 0, bonusDex: 0, bonusInt: 0 };
  if (!charId) return totals;

  const slots = inventories.get(charId) ?? [];
  for (const s of slots) {
    if (!s.equipped) continue;
    const item = getItem(s.itemId);
    if (!item) continue;
    totals.bonusDamage += item.bonusDamage ?? 0;
    totals.bonusArmor += item.bonusArmor ?? 0;
    totals.bonusHp += item.bonusHp ?? 0;
    totals.bonusStr += item.bonusStr ?? 0;
    totals.bonusDex += item.bonusDex ?? 0;
    totals.bonusInt += item.bonusInt ?? 0;
  }
  return totals;
}
