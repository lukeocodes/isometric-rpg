/**
 * Quest system — thin cache over `quests` + `quest_objectives` +
 * `quest_rewards` DB tables, plus the per-player progress logic (which
 * stays in-memory keyed by entity id — players' current objective counts
 * are ephemeral runtime state, not authorable data).
 *
 * Quest templates live in the DB (see AGENTS.md "Data in the Database").
 * The seed `tools/seed-quests.ts` was the one-time migration from the old
 * QUESTS record. Runtime reads from an in-memory map populated at server
 * boot by `loadQuests()`.
 */
import { connectionManager } from "../ws/connections.js";
import { Opcode, packReliable, packXpGain } from "./protocol.js";
import { getPlayerProgress } from "./world.js";
import { processXpGain, xpToNextLevel, totalXpForLevel } from "./experience.js";
import { db } from "../db/postgres.js";
import { quests as questsTable, questObjectives, questRewards } from "../db/schema.js";

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export interface QuestTemplate {
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

export interface QuestProgress {
  questId: string;
  objectives: number[];
  completed: boolean;
  turnedIn: boolean;
}

// ---------------------------------------------------------------------------
// Template cache — populated at boot from DB.
// ---------------------------------------------------------------------------

/** @internal Exported for backwards-compat. Read-only at runtime. */
export const QUESTS: Record<string, QuestTemplate> = {};

export async function loadQuests(): Promise<void> {
  const [qRows, oRows, rRows] = await Promise.all([
    db.select().from(questsTable),
    db.select().from(questObjectives),
    db.select().from(questRewards),
  ]);
  for (const k of Object.keys(QUESTS)) delete QUESTS[k];

  // Seed base quest records.
  for (const q of qRows) {
    QUESTS[q.id] = {
      id:          q.id,
      name:        q.name,
      description: q.description,
      zone:        q.zone,
      levelMin:    q.levelMin,
      objectives:  [],
      rewards: {
        xp:    q.rewardXp,
        items: [],
      },
    };
  }

  // Attach ordered objectives.
  const objectiveRows = [...oRows].sort((a, b) => a.objectiveOrder - b.objectiveOrder);
  for (const o of objectiveRows) {
    const q = QUESTS[o.questId];
    if (!q) continue;
    q.objectives.push({
      type:        o.objectiveType as "kill",
      targetGroup: o.targetGroup,
      count:       o.count,
    });
  }

  // Attach item rewards.
  for (const r of rRows) {
    const q = QUESTS[r.questId];
    if (!q) continue;
    q.rewards.items ??= [];
    q.rewards.items.push({ itemId: r.itemId, qty: r.quantity });
  }

  console.log(
    `[quests] Loaded ${qRows.length} quest(s), ${objectiveRows.length} objective(s), ` +
    `${rRows.length} reward(s) from DB`,
  );
}

/** @internal Test-only helper — seeds cache with fixture data. */
export function _setQuestsForTest(fixtures: Record<string, QuestTemplate>): void {
  for (const k of Object.keys(QUESTS)) delete QUESTS[k];
  for (const [id, q] of Object.entries(fixtures)) QUESTS[id] = q;
}

// ---------------------------------------------------------------------------
// Per-player progress (runtime state — stays in memory)
// ---------------------------------------------------------------------------

const playerQuests = new Map<string, QuestProgress[]>();

export function initPlayerQuests(entityId: string): void {
  playerQuests.set(entityId, []);
}

export function removePlayerQuests(entityId: string): void {
  playerQuests.delete(entityId);
}

/** Accept a quest (returns false if already accepted or template missing). */
export function acceptQuest(entityId: string, questId: string): boolean {
  const quests = playerQuests.get(entityId);
  if (!quests) return false;
  if (quests.some((q) => q.questId === questId)) return false;

  const template = QUESTS[questId];
  if (!template) return false;

  quests.push({
    questId,
    objectives: template.objectives.map(() => 0),
    completed:  false,
    turnedIn:   false,
  });

  sendQuestUpdate(entityId);
  return true;
}

/** Called when a player kills an NPC — updates quest progress. */
export function onQuestKill(entityId: string, npcGroupId: string): void {
  const quests = playerQuests.get(entityId);
  if (!quests) return;

  let changed = false;
  for (const qp of quests) {
    if (qp.completed || qp.turnedIn) continue;
    const template = QUESTS[qp.questId];
    if (!template) continue;

    for (let i = 0; i < template.objectives.length; i++) {
      const obj = template.objectives[i];
      if (obj.type === "kill" && obj.targetGroup === npcGroupId && qp.objectives[i] < obj.count) {
        qp.objectives[i]++;
        changed = true;
      }
    }

    const allDone = template.objectives.every((obj, i) => qp.objectives[i] >= obj.count);
    if (allDone && !qp.completed) {
      qp.completed = true;
      connectionManager.sendReliable(entityId,
        packReliable(Opcode.SYSTEM_MESSAGE, { message: `Quest complete: ${template.name}! Return to turn in.` }));
    }
  }

  if (changed) sendQuestUpdate(entityId);
}

/** Turn in a completed quest (returns rewards or null). */
export function turnInQuest(entityId: string, questId: string): QuestTemplate["rewards"] | null {
  const quests = playerQuests.get(entityId);
  if (!quests) return null;

  const qp = quests.find((q) => q.questId === questId);
  if (!qp || !qp.completed || qp.turnedIn) return null;

  qp.turnedIn = true;
  sendQuestUpdate(entityId);

  const rewards = QUESTS[questId]?.rewards;
  if (!rewards) return null;

  if (rewards.xp > 0) {
    const prog = getPlayerProgress(entityId);
    if (prog) {
      const result = processXpGain(prog.xp, rewards.xp, prog.level);
      prog.xp = result.newXp;
      prog.level = result.newLevel;
      (prog as any).dirty = true;

      const xpNeeded = xpToNextLevel(prog.level);
      const xpIntoLevel = prog.xp - totalXpForLevel(prog.level);
      connectionManager.sendReliable(entityId,
        packXpGain(entityId, rewards.xp, xpIntoLevel, xpNeeded, prog.level));
    }
  }

  connectionManager.sendReliable(entityId,
    packReliable(Opcode.SYSTEM_MESSAGE, {
      message: `Quest reward: +${rewards.xp} XP${rewards.items?.length ? " + items" : ""}`,
    }));

  return rewards;
}

/** Get available quests for a zone (not yet accepted by this player). */
export function getAvailableQuests(
  entityId: string,
  zoneId: string,
  playerLevel: number,
): QuestTemplate[] {
  const quests = playerQuests.get(entityId) ?? [];
  const accepted = new Set(quests.map((q) => q.questId));

  return Object.values(QUESTS).filter((q) =>
    q.zone === zoneId &&
    q.levelMin <= playerLevel &&
    !accepted.has(q.id),
  );
}

function sendQuestUpdate(entityId: string): void {
  const quests = playerQuests.get(entityId) ?? [];
  const data = quests.filter((q) => !q.turnedIn).map((qp) => {
    const template = QUESTS[qp.questId];
    return {
      questId: qp.questId,
      name:    template?.name ?? qp.questId,
      objectives: template?.objectives.map((obj, i) => ({
        description: `Kill ${obj.count} ${obj.targetGroup}`,
        current:     qp.objectives[i],
        target:      obj.count,
      })) ?? [],
      completed: qp.completed,
    };
  });

  connectionManager.sendReliable(entityId,
    packReliable(33 /* QUEST_UPDATE */, { quests: data }));
}
