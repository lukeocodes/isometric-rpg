import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";
import { entityStore } from "./entities.js";
import { getCombatState, unregisterEntity } from "./combat.js";

// Mock connectionManager to avoid WebRTC dependency
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

import {
  addSpawnPoint,
  removeSpawnPoint,
  handleNPCDeath,
  getAllSpawnPoints,
  isSpawnedNPC,
  getSpawnPointTemplate,
  tickWandering,
  tickRespawns,
  cleanup,
  type SpawnPoint,
} from "./spawn-points.js";
import { _setNpcTemplatesForTest, type NPCTemplate } from "./npc-templates.js";

// Minimal NPC template fixture for spawn-point tests. Production data lives
// in the `npc_templates` DB table; these fixtures are only enough to exercise
// the spawn / wander / respawn logic.
const NPC_FIXTURES: Record<string, NPCTemplate> = {
  "goblin-grunt": {
    id: "goblin-grunt", name: "Goblin Grunt", groupId: "goblin", category: "monster",
    bodyColor: "#556b2f", skinColor: "#6b8e23",
    weaponType: "melee", weaponDamage: { min: 2, max: 3 }, attackSpeed: { min: 1.8, max: 2.2 },
    hp: { min: 8, max: 12 }, str: { min: 6, max: 9 }, dex: { min: 7, max: 10 }, int: { min: 3, max: 5 },
    aggressive: true, flees: false, wanders: true, canTalk: false,
    speedModifier: 0.1, wanderChance: 0.02, wanderSteps: 1,
  },
  "skeleton-warrior": {
    id: "skeleton-warrior", name: "Skeleton Warrior", groupId: "skeleton", category: "monster",
    bodyColor: "#aaaaaa", skinColor: "#ccccbb",
    weaponType: "melee", weaponDamage: { min: 3, max: 5 }, attackSpeed: { min: 2.0, max: 2.5 },
    hp: { min: 10, max: 15 }, str: { min: 8, max: 12 }, dex: { min: 5, max: 8 }, int: { min: 3, max: 5 },
    aggressive: true, flees: false, wanders: true, canTalk: false,
    speedModifier: 0.1, wanderChance: 0.02, wanderSteps: 1,
  },
};

function makeSpawnPoint(overrides: Partial<SpawnPoint> = {}): SpawnPoint {
  return {
    id: "sp-test",
    x: 10,
    z: 20,
    mapId: 1,
    npcIds: ["goblin-grunt"],
    distance: 5,
    maxCount: 2,
    frequency: 5,
    ...overrides,
  };
}

describe("spawn-points", () => {
  beforeEach(() => {
    vi.useFakeTimers();
    cleanup();
    // Seed NPC templates from fixtures — production reads from DB but tests
    // don't need a live connection (see AGENTS.md "Data in the Database").
    _setNpcTemplatesForTest(NPC_FIXTURES);
    // Clear entity store
    for (const e of entityStore.getAll()) {
      unregisterEntity(e.entityId);
      entityStore.remove(e.entityId);
    }
  });

  afterEach(() => {
    cleanup();
    vi.useRealTimers();
  });

  describe("addSpawnPoint", () => {
    it("spawns maxCount NPCs on creation", () => {
      addSpawnPoint(makeSpawnPoint({ maxCount: 3 }));
      const npcs = entityStore.getByType("npc");
      expect(npcs.length).toBe(3);
    });

    it("registers spawned NPCs in entity store", () => {
      addSpawnPoint(makeSpawnPoint({ maxCount: 1 }));
      const npcs = entityStore.getByType("npc");
      expect(npcs.length).toBe(1);
      expect(npcs[0].entityType).toBe("npc");
      expect(npcs[0].name).toBe("Goblin Grunt");
    });

    it("spawns NPCs within distance of spawn point", () => {
      addSpawnPoint(makeSpawnPoint({ x: 10, z: 20, distance: 5, maxCount: 10 }));
      const npcs = entityStore.getByType("npc");
      for (const npc of npcs) {
        const dist = Math.sqrt((npc.x - 10) ** 2 + (npc.z - 20) ** 2);
        expect(dist).toBeLessThanOrEqual(6); // Allow for rounding
      }
    });

    it("registers combat state for spawned NPCs", () => {
      addSpawnPoint(makeSpawnPoint({ maxCount: 1 }));
      const npc = entityStore.getByType("npc")[0];
      const combat = getCombatState(npc.entityId);
      expect(combat).toBeDefined();
      expect(combat!.hp).toBeGreaterThan(0);
    });

    it("tracks spawned NPCs correctly", () => {
      addSpawnPoint(makeSpawnPoint({ maxCount: 2 }));
      const npcs = entityStore.getByType("npc");
      for (const npc of npcs) {
        expect(isSpawnedNPC(npc.entityId)).toBe(true);
      }
    });
  });

  describe("addSpawnPoint — edge cases", () => {
    it("handles unknown template ID gracefully", () => {
      const spy = vi.spyOn(console, "error").mockImplementation(() => {});

      addSpawnPoint(makeSpawnPoint({
        npcIds: ["nonexistent-dragon"],
        maxCount: 2,
      }));

      // Should log error for unknown template and not crash
      expect(spy).toHaveBeenCalled();
      // No NPCs spawned since template doesn't exist
      expect(entityStore.getByType("npc").length).toBe(0);

      spy.mockRestore();
    });

    it("handles empty npcIds array", () => {
      addSpawnPoint(makeSpawnPoint({ npcIds: [], maxCount: 2 }));
      expect(entityStore.getByType("npc").length).toBe(0);
    });
  });

  describe("removeSpawnPoint", () => {
    it("removes all NPCs from that spawn point", () => {
      addSpawnPoint(makeSpawnPoint({ maxCount: 3 }));
      expect(entityStore.getByType("npc").length).toBe(3);

      removeSpawnPoint("sp-test");
      expect(entityStore.getByType("npc").length).toBe(0);
    });

    it("removes spawn point from registry", () => {
      addSpawnPoint(makeSpawnPoint());
      removeSpawnPoint("sp-test");
      expect(getAllSpawnPoints().length).toBe(0);
    });

    it("is safe for non-existent spawn point ID", () => {
      expect(() => removeSpawnPoint("no-such-sp")).not.toThrow();
    });
  });

  describe("handleNPCDeath", () => {
    it("removes dead NPC from entity store", () => {
      addSpawnPoint(makeSpawnPoint({ maxCount: 1 }));
      const npc = entityStore.getByType("npc")[0];

      handleNPCDeath(npc.entityId);
      expect(entityStore.get(npc.entityId)).toBeUndefined();
    });

    it("schedules respawn after frequency seconds", () => {
      addSpawnPoint(makeSpawnPoint({ maxCount: 1, frequency: 5 }));
      const npc = entityStore.getByType("npc")[0];
      const deadId = npc.entityId;

      handleNPCDeath(deadId);
      expect(entityStore.getByType("npc").length).toBe(0);

      // Advance past respawn timer — tickRespawns uses Date.now()
      const origNow = Date.now;
      Date.now = () => origNow() + 5 * 1000;
      tickRespawns();
      Date.now = origNow;
      expect(entityStore.getByType("npc").length).toBe(1);

      // Should be a new entity, not the dead one
      const newNpc = entityStore.getByType("npc")[0];
      expect(newNpc.entityId).not.toBe(deadId);
    });

    it("does not respawn if spawn point was removed", () => {
      addSpawnPoint(makeSpawnPoint({ maxCount: 1, frequency: 5 }));
      const npc = entityStore.getByType("npc")[0];

      handleNPCDeath(npc.entityId);
      removeSpawnPoint("sp-test");

      const origNow = Date.now;
      Date.now = () => origNow() + 5 * 1000;
      tickRespawns();
      Date.now = origNow;
      expect(entityStore.getByType("npc").length).toBe(0);
    });

    it("is safe for non-tracked entity", () => {
      expect(() => handleNPCDeath("random-entity")).not.toThrow();
    });

    it("respawn counts surviving siblings before spawning", () => {
      // maxCount: 2 — kill one, the other survives. Timer fires, countAlive
      // iterates the surviving NPC (covers lines 229-230).
      addSpawnPoint(makeSpawnPoint({ maxCount: 2, frequency: 5 }));
      const npcs = entityStore.getByType("npc");
      expect(npcs.length).toBe(2);

      const victim = npcs[0];
      const survivor = npcs[1];

      handleNPCDeath(victim.entityId);
      expect(entityStore.getByType("npc").length).toBe(1);
      expect(entityStore.get(survivor.entityId)).toBeDefined();

      // Advance past respawn — countAlive sees 1 alive < maxCount 2, spawns replacement
      const origNow = Date.now;
      Date.now = () => origNow() + 5 * 1000;
      tickRespawns();
      Date.now = origNow;
      expect(entityStore.getByType("npc").length).toBe(2);
      // Survivor is still the same entity
      expect(entityStore.get(survivor.entityId)).toBeDefined();
    });
  });

  describe("getSpawnPointTemplate", () => {
    it("returns the template for a spawned NPC", () => {
      addSpawnPoint(makeSpawnPoint({ npcIds: ["skeleton-warrior"], maxCount: 1 }));
      const npc = entityStore.getByType("npc")[0];
      const template = getSpawnPointTemplate(npc.entityId);
      expect(template).toBeDefined();
      expect(template!.id).toBe("skeleton-warrior");
    });

    it("returns undefined for unknown entity", () => {
      expect(getSpawnPointTemplate("nope")).toBeUndefined();
    });
  });

  describe("getAllSpawnPoints", () => {
    it("returns all registered spawn points", () => {
      addSpawnPoint(makeSpawnPoint({ id: "sp-1", maxCount: 1 }));
      addSpawnPoint(makeSpawnPoint({ id: "sp-2", maxCount: 1 }));
      const all = getAllSpawnPoints();
      expect(all.length).toBe(2);
      expect(all.map(s => s.id)).toContain("sp-1");
      expect(all.map(s => s.id)).toContain("sp-2");
    });
  });

  describe("tickWandering", () => {
    it("does not crash with no spawned NPCs", () => {
      expect(() => tickWandering(0.05)).not.toThrow();
    });

    it("moves NPC when random chance triggers", () => {
      addSpawnPoint(makeSpawnPoint({ maxCount: 1, distance: 10 }));
      const npc = entityStore.getByType("npc")[0];
      const origX = npc.x;
      const origZ = npc.z;

      // Mock Math.random sequence:
      // 1. wanderChance jitter (0.75 + val * 0.5)
      // 2. wander trigger check (must be < wanderChance)
      // 3. angle
      // 4. distance
      // 5. maxSteps jitter
      const mockRandom = vi.spyOn(Math, "random");
      mockRandom
        .mockReturnValueOnce(0.5)   // jitter → chance = 0.02 * (0.75 + 0.25) = 0.02
        .mockReturnValueOnce(0.001) // < 0.02, triggers wander
        .mockReturnValueOnce(0.25)  // angle = 0.25 * 2π
        .mockReturnValueOnce(0.5)   // dist = 0.5 * point.distance
        .mockReturnValueOnce(0.5);  // maxSteps jitter

      tickWandering(0.05);

      // NPC should have moved one tile
      const moved = Math.abs(npc.x - origX) + Math.abs(npc.z - origZ);
      expect(moved).toBe(1);

      mockRandom.mockRestore();
    });

    it("does not move NPC when random chance does not trigger", () => {
      addSpawnPoint(makeSpawnPoint({ maxCount: 1 }));
      const npc = entityStore.getByType("npc")[0];
      const origX = npc.x;
      const origZ = npc.z;

      const mockRandom = vi.spyOn(Math, "random");
      mockRandom.mockReturnValue(0.5); // > 0.02, no wander

      tickWandering(0.05);
      expect(npc.x).toBe(origX);
      expect(npc.z).toBe(origZ);

      mockRandom.mockRestore();
    });

    it("does not wander if NPC is in combat", () => {
      addSpawnPoint(makeSpawnPoint({ maxCount: 1 }));
      const npc = entityStore.getByType("npc")[0];
      const origX = npc.x;

      // Put NPC in combat
      const combat = getCombatState(npc.entityId);
      if (combat) combat.inCombat = true;

      const mockRandom = vi.spyOn(Math, "random");
      mockRandom.mockReturnValue(0.01); // Would trigger wander

      tickWandering(0.05);
      expect(npc.x).toBe(origX); // Didn't move

      mockRandom.mockRestore();
    });

    it("moves along X when dx > dz", () => {
      // Spawn at (10, 20), then fix NPC position for deterministic test
      addSpawnPoint(makeSpawnPoint({ x: 10, z: 20, maxCount: 1, distance: 5 }));
      const npc = entityStore.getByType("npc")[0];
      // Place NPC at spawn center so we control the direction
      entityStore.updatePosition(npc.entityId, 10, 20);

      const mockRandom = vi.spyOn(Math, "random");
      mockRandom
        .mockReturnValueOnce(0.5)    // jitter → chance = 0.02
        .mockReturnValueOnce(0.001)  // < 0.02, triggers wander
        .mockReturnValueOnce(0.0)    // angle = 0 (east) → cos(0)=1, sin(0)=0
        .mockReturnValueOnce(0.99)   // dist ≈ 4.95 → target=(15, 20)
        .mockReturnValueOnce(0.5);   // maxSteps jitter

      // dx = 15-10 = 5, dz = 20-20 = 0 → |dx| > |dz| → X branch
      tickWandering(0.05);

      expect(npc.x).toBe(11); // X moved +1
      expect(npc.z).toBe(20); // Z unchanged

      mockRandom.mockRestore();
    });

    it("skips dead NPCs during wandering", () => {
      addSpawnPoint(makeSpawnPoint({ maxCount: 1, frequency: 10 }));
      const npc = entityStore.getByType("npc")[0];

      // Kill the NPC — it's now in spawnedNPCs with alive=false
      handleNPCDeath(npc.entityId);

      const mockRandom = vi.spyOn(Math, "random");
      mockRandom.mockReturnValue(0.01); // Would trigger wander

      // Should not crash — dead NPC is skipped at alive check
      expect(() => tickWandering(0.05)).not.toThrow();

      mockRandom.mockRestore();
    });

    it("skips NPC whose wander target equals current position", () => {
      addSpawnPoint(makeSpawnPoint({ x: 10, z: 20, maxCount: 1, distance: 5 }));
      const npc = entityStore.getByType("npc")[0];
      // Place NPC exactly at spawn point center
      entityStore.updatePosition(npc.entityId, 10, 20);
      const origX = npc.x;
      const origZ = npc.z;

      const mockRandom = vi.spyOn(Math, "random");
      mockRandom
        .mockReturnValueOnce(0.5)   // jitter
        .mockReturnValueOnce(0.001) // triggers wander
        .mockReturnValueOnce(0)     // angle = 0
        .mockReturnValueOnce(0);    // dist = 0 → target = spawn center = current pos

      // target = round(10 + cos(0)*0, 20 + sin(0)*0) = (10, 20) = current
      // dx=0, dz=0 → continue
      tickWandering(0.05);
      expect(npc.x).toBe(origX);
      expect(npc.z).toBe(origZ);

      mockRandom.mockRestore();
    });

    it("moves along Z when dz > dx (line 150 branch)", () => {
      // Place NPC at spawn point center so we can control target direction
      addSpawnPoint(makeSpawnPoint({ x: 0, z: 0, maxCount: 1, distance: 10 }));
      const npc = entityStore.getByType("npc")[0];
      // Force NPC to be at (0, 0) for predictable targeting
      entityStore.updatePosition(npc.entityId, 0, 0);

      const mockRandom = vi.spyOn(Math, "random");
      mockRandom
        .mockReturnValueOnce(0.5)     // jitter
        .mockReturnValueOnce(0.001)   // triggers wander
        .mockReturnValueOnce(0.25)    // angle = π/2 (north)
        .mockReturnValueOnce(0.5)     // dist = 5
        .mockReturnValueOnce(0.5);    // maxSteps jitter

      // angle = 0.25 * 2π = π/2 → cos(π/2) ≈ 0, sin(π/2) = 1
      // targetX = round(0 + 0 * 5) = 0, targetZ = round(0 + 1 * 5) = 5
      // dx = 0, dz = 5 → |dz| > |dx| → z branch (line 150)
      tickWandering(0.05);

      expect(npc.x).toBe(0);  // X unchanged
      expect(npc.z).toBe(1);  // Z moved by 1

      mockRandom.mockRestore();
    });
  });

  describe("cleanup", () => {
    it("clears all spawn points and NPCs", () => {
      addSpawnPoint(makeSpawnPoint({ maxCount: 3 }));
      expect(entityStore.getByType("npc").length).toBe(3);

      cleanup();
      expect(getAllSpawnPoints().length).toBe(0);
    });
  });
});
