/**
 * Phase-2c seed — map-item type stubs.
 *
 * One-time migration from the `MAP_ITEM_TYPES` array in the old
 * `packages/client/src/builder/registry/map-items.ts`. All seven kinds
 * are currently stubs (`implemented: false`); as each feature lands
 * (container inventory UI, light glow pass, etc.) the seed here + the
 * runtime protocol + the DB row all flip `implemented: true`.
 *
 * Idempotent (UPSERT by kind).
 *
 *   DATABASE_URL=… bun tools/seed-map-items.ts
 *
 * See AGENTS.md "Data in the Database".
 */
import postgres from "postgres";

interface MapItemSeed {
  kind:         string;
  name:         string;
  description:  string;
  blocks:       boolean;
  implemented:  boolean;
  displayOrder: number;
}

const MAP_ITEMS: MapItemSeed[] = [
  {
    kind: "container", name: "Container",
    description: "Chest, barrel, or crate that holds items. Opens an inventory UI on interact.",
    blocks: true,  implemented: false, displayOrder: 10,
  },
  {
    kind: "light", name: "Light Source",
    description: "Lantern, torch, or campfire. Emits a glow radius in the night-time lighting pass.",
    blocks: false, implemented: false, displayOrder: 20,
  },
  {
    kind: "door", name: "Door",
    description: "Opens/closes on interact; may require a key. Walk-through when open; blocks when closed.",
    blocks: true,  implemented: false, displayOrder: 30,
  },
  {
    kind: "sign", name: "Sign",
    description: "Displays a text message on interact. Useful for zone names, quest hints, lore.",
    blocks: true,  implemented: false, displayOrder: 40,
  },
  {
    kind: "npc-spawn", name: "NPC Spawn",
    description: "Spawn marker for a named NPC. Links to an entry in the character model registry.",
    blocks: false, implemented: false, displayOrder: 50,
  },
  {
    kind: "teleporter", name: "Teleporter",
    description: "Travel portal to another zone/map at a specified spawn point.",
    blocks: false, implemented: false, displayOrder: 60,
  },
  {
    kind: "crop-plot", name: "Crop Plot",
    description: "Tilled ground patch where a crop can be planted, watered, and harvested.",
    blocks: false, implemented: false, displayOrder: 70,
  },
];

const DATABASE_URL = process.env.DATABASE_URL
  ?? "postgresql://game:game_dev_password@localhost:5433/game";
const sql = postgres(DATABASE_URL);

async function main() {
  console.log("[seed] connecting to DB:", DATABASE_URL.replace(/:[^:@]+@/, ":***@"));
  const t0 = Date.now();
  console.log(`[seed] map_item_types — ${MAP_ITEMS.length} rows`);
  try {
    for (const m of MAP_ITEMS) {
      await sql`
        INSERT INTO map_item_types
          (kind, name, description, blocks, implemented, display_order, updated_at)
        VALUES
          (${m.kind}, ${m.name}, ${m.description}, ${m.blocks}, ${m.implemented},
           ${m.displayOrder}, NOW())
        ON CONFLICT (kind) DO UPDATE SET
          name          = EXCLUDED.name,
          description   = EXCLUDED.description,
          blocks        = EXCLUDED.blocks,
          implemented   = EXCLUDED.implemented,
          display_order = EXCLUDED.display_order,
          updated_at    = NOW()
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
