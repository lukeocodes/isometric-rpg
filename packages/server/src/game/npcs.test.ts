import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";
import { entityStore } from "./entities.js";
import { unregisterEntity } from "./combat.js";

vi.mock("../ws/connections.js", () => ({
  connectionManager: {
    broadcastReliable: vi.fn(),
    getAll: vi.fn(() => []),
  },
}));

// Mock terrain to always allow movement (world map not initialized in tests)
vi.mock("../world/terrain.js", () => ({
  isWalkable: vi.fn(() => true),
}));

import { spawnInitialNpcs, handleNpcDeath, getNpcTemplate, getNpcIds, isSpawnedNPC, cleanup } from "./npcs.js";

describe("npcs", () => {
  beforeEach(() => {
    cleanup();
    for (const e of entityStore.getAll()) {
      unregisterEntity(e.entityId);
      entityStore.remove(e.entityId);
    }
  });

  afterEach(() => {
    cleanup();
  });

  describe("spawnInitialNpcs", () => {
    it("spawns skeleton NPCs at the default spawn point", () => {
      spawnInitialNpcs();

      const npcs = entityStore.getByType("npc");
      expect(npcs.length).toBe(4); // maxCount: 4
    });

    it("all spawned NPCs are tracked", () => {
      spawnInitialNpcs();

      for (const npc of entityStore.getByType("npc")) {
        expect(isSpawnedNPC(npc.entityId)).toBe(true);
      }
    });

    it("spawned NPCs have valid templates", () => {
      spawnInitialNpcs();

      for (const npc of entityStore.getByType("npc")) {
        const template = getNpcTemplate(npc.entityId);
        expect(template).toBeDefined();
        expect(template!.groupId).toBe("skeleton");
      }
    });
  });

  describe("handleNpcDeath", () => {
    it("removes NPC from entity store", () => {
      vi.useFakeTimers();
      spawnInitialNpcs();

      const npc = entityStore.getByType("npc")[0];
      handleNpcDeath(npc.entityId);

      expect(entityStore.get(npc.entityId)).toBeUndefined();
      vi.useRealTimers();
    });
  });

  describe("getNpcTemplate", () => {
    it("returns undefined for non-NPC entity", () => {
      expect(getNpcTemplate("player-1")).toBeUndefined();
    });
  });

  describe("getNpcIds", () => {
    it("returns empty array (legacy stub)", () => {
      expect(getNpcIds()).toEqual([]);
    });
  });
});
