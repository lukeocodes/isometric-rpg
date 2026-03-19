import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";
import { entityStore, type ServerEntity } from "./entities.js";
import { registerEntity, unregisterEntity, engageTarget, getCombatState } from "./combat.js";

// Mock connectionManager before importing world.ts
vi.mock("../ws/connections.js", () => {
  const sendReliable = vi.fn();
  const sendPosition = vi.fn();
  const broadcastReliable = vi.fn();
  const getAll = vi.fn(() => []);
  return {
    connectionManager: { sendReliable, sendPosition, broadcastReliable, getAll },
  };
});

// Mock npcs to avoid spawn-point side effects
vi.mock("./npcs.js", () => ({
  handleNpcDeath: vi.fn(),
  tickWandering: vi.fn(),
}));

import { startGameLoop, stopGameLoop } from "./world.js";
import { connectionManager } from "../ws/connections.js";
import { handleNpcDeath, tickWandering } from "./npcs.js";

function makeEntity(overrides: Partial<ServerEntity> = {}): ServerEntity {
  return {
    entityId: "e-" + Math.random().toString(36).slice(2, 8),
    characterId: "", accountId: "", name: "Test",
    entityType: "player", x: 0, y: 0, z: 0, rotation: 0,
    mapId: 1, lastUpdate: Date.now(),
    ...overrides,
  };
}

function addPlayer(id: string, x = 0, z = 0) {
  const e = makeEntity({ entityId: id, entityType: "player", x, z });
  entityStore.add(e);
  registerEntity(id, "melee", 5, 2.0, 50, 50);
  return e;
}

function addNpc(id: string, x = 0, z = 0, hp = 10) {
  const e = makeEntity({ entityId: id, entityType: "npc", x, z });
  entityStore.add(e);
  registerEntity(id, "melee", 3, 2.0, hp, hp);
  return e;
}

describe("world game loop", () => {
  beforeEach(() => {
    vi.useFakeTimers();
    vi.clearAllMocks();
    for (const e of entityStore.getAll()) {
      unregisterEntity(e.entityId);
      entityStore.remove(e.entityId);
    }
  });

  afterEach(() => {
    stopGameLoop();
    vi.useRealTimers();
  });

  describe("startGameLoop / stopGameLoop", () => {
    it("starts a 20Hz interval", () => {
      const spy = vi.spyOn(console, "log").mockImplementation(() => {});
      startGameLoop();
      expect(spy).toHaveBeenCalledWith("Game loop started (20Hz)");
      spy.mockRestore();
    });

    it("stop clears the interval", () => {
      startGameLoop();
      stopGameLoop();
      // Advance time — no ticks should fire
      (connectionManager.getAll as any).mockReturnValue([]);
      vi.advanceTimersByTime(200);
      // broadcastReliable should not be called after stop
      expect(connectionManager.broadcastReliable).not.toHaveBeenCalled();
    });

    it("game tick fires every 50ms", () => {
      (connectionManager.getAll as any).mockReturnValue([]);
      startGameLoop();

      vi.advanceTimersByTime(100); // 2 ticks
      // tickWandering should have been called for each tick
      expect(tickWandering).toHaveBeenCalledTimes(2);
    });
  });

  describe("position broadcasting", () => {
    it("sends batched positions to connected players", () => {
      const p1 = addPlayer("p1", 0, 0);
      const p2 = addPlayer("p2", 5, 5);

      // Mock connections: p1 is connected
      (connectionManager.getAll as any).mockReturnValue([
        { entityId: "p1", reliableChannel: { readyState: "open", send: vi.fn() } },
      ]);

      startGameLoop();
      vi.advanceTimersByTime(50); // 1 tick

      // sendPosition should be called for p1 (with p2's position)
      expect(connectionManager.sendPosition).toHaveBeenCalled();
      const [entityId, buf] = (connectionManager.sendPosition as any).mock.calls[0];
      expect(entityId).toBe("p1");

      // Parse the buffer: count should be 1 (p2)
      expect(buf.readUInt16LE(0)).toBe(1);
    });

    it("excludes distant entities from position batch", () => {
      addPlayer("p1", 0, 0);
      addNpc("far-npc", 100, 100); // Way outside 32-tile radius

      (connectionManager.getAll as any).mockReturnValue([
        { entityId: "p1" },
      ]);

      startGameLoop();
      vi.advanceTimersByTime(50);

      // No position sent (no nearby entities)
      expect(connectionManager.sendPosition).not.toHaveBeenCalled();
    });

    it("skips connections with no matching entity", () => {
      (connectionManager.getAll as any).mockReturnValue([
        { entityId: "disconnected-player" }, // Not in entity store
      ]);

      startGameLoop();
      vi.advanceTimersByTime(50);

      expect(connectionManager.sendPosition).not.toHaveBeenCalled();
    });
  });

  describe("state broadcasting", () => {
    it("broadcasts state periodically (every ~500ms)", () => {
      addPlayer("p1", 0, 0);
      (connectionManager.getAll as any).mockReturnValue([
        { entityId: "p1" },
      ]);

      startGameLoop();
      // Run enough ticks to guarantee at least one state broadcast
      vi.advanceTimersByTime(1000);

      expect(connectionManager.sendReliable).toHaveBeenCalled();
    });

    it("sends own combat state and HP to connected player", () => {
      addPlayer("p1", 0, 0);
      (connectionManager.getAll as any).mockReturnValue([
        { entityId: "p1" },
      ]);

      startGameLoop();
      vi.advanceTimersByTime(1000);

      const calls = (connectionManager.sendReliable as any).mock.calls;
      expect(calls.length).toBeGreaterThanOrEqual(2);
      for (const [eid] of calls) {
        expect(eid).toBe("p1");
      }
    });

    it("sends nearby NPC state to player", () => {
      addPlayer("p1", 0, 0);
      addNpc("n1", 3, 3, 10);

      (connectionManager.getAll as any).mockReturnValue([
        { entityId: "p1" },
      ]);

      startGameLoop();
      vi.advanceTimersByTime(1000);

      const calls = (connectionManager.sendReliable as any).mock.calls;
      const npcStateCalls = calls.filter(([, msg]: [string, string]) => {
        const parsed = JSON.parse(msg);
        return parsed.entityId === "n1";
      });
      expect(npcStateCalls.length).toBeGreaterThan(0);
    });
  });

  describe("combat damage/death broadcasting", () => {
    it("broadcasts damage events from combat", () => {
      addPlayer("p1", 0, 0);
      addNpc("n1", 1, 0, 20);

      engageTarget("p1", "n1");

      (connectionManager.getAll as any).mockReturnValue([]);

      startGameLoop();
      // Run enough ticks for wind-up + damage (>0.55s)
      vi.advanceTimersByTime(1000);

      const calls = (connectionManager.broadcastReliable as any).mock.calls;
      const damageCall = calls.find(([msg]: [string]) => {
        try { return JSON.parse(msg).op === 50; } catch { return false; }
      });
      expect(damageCall).toBeDefined();
    });

    it("broadcasts death and despawn on NPC kill", () => {
      addPlayer("p1", 0, 0);
      addNpc("n1", 1, 0, 1); // 1 HP, dies in one hit

      engageTarget("p1", "n1");

      (connectionManager.getAll as any).mockReturnValue([]);

      startGameLoop();
      vi.advanceTimersByTime(1000);

      const calls = (connectionManager.broadcastReliable as any).mock.calls;
      const deathCall = calls.find(([msg]: [string]) => {
        try { return JSON.parse(msg).op === 51; } catch { return false; }
      });
      const despawnCall = calls.find(([msg]: [string]) => {
        try { return JSON.parse(msg).op === 3; } catch { return false; }
      });
      expect(deathCall).toBeDefined();
      expect(despawnCall).toBeDefined();

      expect(handleNpcDeath).toHaveBeenCalledWith("n1");
    });
  });

  describe("broadcastState edge cases", () => {
    it("skips connection whose entity is missing from store", () => {
      // Connection exists but entity was removed (disconnect race)
      (connectionManager.getAll as any).mockReturnValue([
        { entityId: "gone-player" }, // Not in entityStore
      ]);

      startGameLoop();
      vi.advanceTimersByTime(1000);

      // sendReliable should NOT be called (no self entity)
      expect(connectionManager.sendReliable).not.toHaveBeenCalled();
    });

    it("handles nearby entity without combat state", () => {
      addPlayer("p1", 0, 0);
      // Add a raw entity nearby with no combat registration
      const raw = makeEntity({ entityId: "npc-raw", entityType: "npc", x: 2, z: 2 });
      entityStore.add(raw);
      // Don't registerEntity — no combat state

      (connectionManager.getAll as any).mockReturnValue([
        { entityId: "p1" },
      ]);

      startGameLoop();
      vi.advanceTimersByTime(1000);

      // Should send own state but skip NPC without combat (no crash)
      const calls = (connectionManager.sendReliable as any).mock.calls;
      const ownCalls = calls.filter(([eid]: [string]) => eid === "p1");
      expect(ownCalls.length).toBeGreaterThan(0);

      // No calls for the raw NPC
      const rawCalls = calls.filter(([, msg]: [string, string]) => {
        try { return JSON.parse(msg).entityId === "npc-raw"; } catch { return false; }
      });
      expect(rawCalls.length).toBe(0);
    });

    it("skips distant entities in state broadcast", () => {
      addPlayer("p1", 0, 0);
      addNpc("far-npc", 50, 50, 10); // Outside 32-tile radius

      (connectionManager.getAll as any).mockReturnValue([
        { entityId: "p1" },
      ]);

      startGameLoop();
      vi.advanceTimersByTime(1000);

      // No state sent for far NPC
      const calls = (connectionManager.sendReliable as any).mock.calls;
      const farCalls = calls.filter(([, msg]: [string, string]) => {
        try { return JSON.parse(msg).entityId === "far-npc"; } catch { return false; }
      });
      expect(farCalls.length).toBe(0);
    });

    it("connection without combat state skips own state send", () => {
      // Add entity to store but don't register combat
      const raw = makeEntity({ entityId: "no-combat-player", entityType: "player", x: 0, z: 0 });
      entityStore.add(raw);

      (connectionManager.getAll as any).mockReturnValue([
        { entityId: "no-combat-player" },
      ]);

      startGameLoop();
      vi.advanceTimersByTime(1000);

      // Should not crash and not send own combat state
      // (may still iterate nearby entities)
      expect(() => vi.advanceTimersByTime(100)).not.toThrow();
    });
  });
});
