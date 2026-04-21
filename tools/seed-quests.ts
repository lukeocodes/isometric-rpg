/**
 * Phase-2b seed — quest templates + objectives + rewards.
 *
 * One-time migration from the old `game/quests.ts` QUESTS record. Objectives
 * and item rewards are split into child tables so designers can tweak
 * counts / rewards without re-encoding the whole quest. XP reward stays on
 * the quest row.
 *
 * Idempotent — wipes child rows per quest, re-inserts.
 *
 *   DATABASE_URL=… bun tools/seed-quests.ts
 *
 * See AGENTS.md "Data in the Database".
 */
import postgres from "postgres";

// ---------------------------------------------------------------------------
// Data (copied from the former packages/server/src/game/quests.ts)
// ---------------------------------------------------------------------------

interface QuestTemplate {
  id: string;
  name: string;
  description: string;
  zone: string;
  levelMin: number;
  objectives: Array<{
    type: "kill";
    targetGroup: string;
    count: number;
  }>;
  rewards: {
    xp: number;
    items?: Array<{ itemId: string; qty: number }>;
  };
}

const QUESTS: Record<string, QuestTemplate> = {
  "kill-rabbits": {
    id: "kill-rabbits", name: "Rabbit Trouble",
    description: "The rabbits are eating the crops! Cull 5 of them.",
    zone: "human-meadows", levelMin: 1,
    objectives: [{ type: "kill", targetGroup: "rabbit", count: 5 }],
    rewards: { xp: 50, items: [{ itemId: "health-potion-small", qty: 3 }] },
  },
  "goblin-menace": {
    id: "goblin-menace", name: "Goblin Menace",
    description: "Goblins are raiding the roads. Kill 3 goblin grunts.",
    zone: "human-meadows", levelMin: 2,
    objectives: [{ type: "kill", targetGroup: "goblin", count: 3 }],
    rewards: { xp: 100, items: [{ itemId: "rusty-sword", qty: 1 }] },
  },
  "skeleton-threat": {
    id: "skeleton-threat", name: "Skeleton Threat",
    description: "The undead stir in the ruins. Destroy 5 skeletons.",
    zone: "crossroads", levelMin: 5,
    objectives: [{ type: "kill", targetGroup: "skeleton", count: 5 }],
    rewards: { xp: 200, items: [{ itemId: "bone-axe", qty: 1 }] },
  },
  "imp-infestation": {
    id: "imp-infestation", name: "Imp Infestation",
    description: "Imps are swarming the forest. Drive them back. Kill 4.",
    zone: "elf-grove", levelMin: 2,
    objectives: [{ type: "kill", targetGroup: "imp", count: 4 }],
    rewards: { xp: 80, items: [{ itemId: "gnarled-staff", qty: 1 }] },
  },
  "wasteland-warriors": {
    id: "wasteland-warriors", name: "Wasteland Warriors",
    description: "Skeleton warriors roam the wastes. Defeat 4 of them.",
    zone: "orc-wastes", levelMin: 2,
    objectives: [{ type: "kill", targetGroup: "skeleton", count: 4 }],
    rewards: { xp: 120, items: [{ itemId: "bone-helm", qty: 1 }] },
  },
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

  const ids = Object.keys(QUESTS);
  console.log(`[seed] quests — ${ids.length} rows`);

  let objectiveCount = 0;
  let rewardCount    = 0;

  try {
    for (const id of ids) {
      const q = QUESTS[id];
      await sql`
        INSERT INTO quests (id, name, description, zone, level_min, reward_xp, updated_at)
        VALUES (${q.id}, ${q.name}, ${q.description}, ${q.zone}, ${q.levelMin}, ${q.rewards.xp}, NOW())
        ON CONFLICT (id) DO UPDATE SET
          name        = EXCLUDED.name,
          description = EXCLUDED.description,
          zone        = EXCLUDED.zone,
          level_min   = EXCLUDED.level_min,
          reward_xp   = EXCLUDED.reward_xp,
          updated_at  = NOW()
      `;

      // Replace objectives + rewards (small tables, wipe+insert is fine).
      await sql`DELETE FROM quest_objectives WHERE quest_id = ${q.id}`;
      for (let i = 0; i < q.objectives.length; i++) {
        const o = q.objectives[i];
        await sql`
          INSERT INTO quest_objectives
            (quest_id, objective_order, objective_type, target_group, count)
          VALUES
            (${q.id}, ${i}, ${o.type}, ${o.targetGroup}, ${o.count})
        `;
        objectiveCount++;
      }

      await sql`DELETE FROM quest_rewards WHERE quest_id = ${q.id}`;
      for (const r of q.rewards.items ?? []) {
        try {
          await sql`
            INSERT INTO quest_rewards (quest_id, item_id, quantity)
            VALUES (${q.id}, ${r.itemId}, ${r.qty})
          `;
          rewardCount++;
        } catch (err) {
          console.warn(`  [skip] reward ${q.id} → ${r.itemId}: ${(err as Error).message}`);
        }
      }
    }
  } finally {
    await sql.end();
  }

  console.log(`[seed] quest_objectives — ${objectiveCount} rows`);
  console.log(`[seed] quest_rewards — ${rewardCount} rows`);

  const dt = ((Date.now() - t0) / 1000).toFixed(2);
  console.log(`[seed] done in ${dt}s`);
}

main().catch((err) => {
  console.error("[seed] FAILED:", err);
  process.exit(1);
});
