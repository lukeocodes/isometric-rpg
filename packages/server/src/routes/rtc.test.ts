import { describe, it, expect, beforeEach, vi } from "vitest";
import Fastify from "fastify";

// --- Capture subscribe callbacks from the mock WebRTC objects ---

let lastPc: any;

vi.mock("werift", () => {
  return {
    RTCPeerConnection: class MockPeerConnection {
      channels = new Map<string, any>();
      iceConnectionStateChange = { subscribe: vi.fn() };
      iceGatheringStateChange = {
        subscribe: vi.fn((cb: (state: string) => void) => cb("complete")),
      };
      localDescription = { sdp: "mock-sdp", type: "offer" as const };

      constructor() { lastPc = this; }

      createDataChannel(name: string) {
        const ch = {
          stateChanged: { subscribe: vi.fn() },
          onMessage: { subscribe: vi.fn() },
          send: vi.fn(),
          readyState: "open",
        };
        this.channels.set(name, ch);
        return ch;
      }
      async createOffer() { return { sdp: "mock-sdp", type: "offer" }; }
      async setLocalDescription() {}
      async setRemoteDescription() {}
      async close() {}
    },
  };
});

// --- Mock auth middleware ---
vi.mock("../auth/middleware.js", () => ({
  requireAuth: vi.fn(async (request: any) => {
    request.account = { id: "acc-1", email: "t@t.com", displayName: "Tester", isOnboarded: true };
  }),
}));

// --- Mock DB ---
const mockDbWhere = vi.fn();
const mockDbFrom = vi.fn(() => ({ where: mockDbWhere }));
const mockDbSelectFields = vi.fn(() => ({ from: mockDbFrom }));
const mockDbUpdateSet = vi.fn(() => ({
  where: vi.fn().mockReturnValue({ catch: vi.fn() }),
}));

vi.mock("../db/postgres.js", () => ({
  db: {
    select: (...args: any[]) => {
      if (args.length > 0) return mockDbSelectFields(...args);
      return { from: mockDbFrom };
    },
    update: vi.fn(() => ({ set: mockDbUpdateSet })),
  },
}));

vi.mock("../db/schema.js", () => ({
  characters: { id: "characters.id", posX: "posX", posY: "posY", posZ: "posZ", mapId: "mapId" },
}));

vi.mock("drizzle-orm", () => ({
  eq: vi.fn((a: any, b: any) => ({ a, b })),
}));

// --- Mock game systems ---
vi.mock("../ws/connections.js", () => ({
  connectionManager: {
    get: vi.fn(),
    add: vi.fn(),
    remove: vi.fn(),
    broadcastReliable: vi.fn(),
  },
}));

vi.mock("../game/combat.js", () => ({
  registerEntity: vi.fn(),
  unregisterEntity: vi.fn(),
  engageTarget: vi.fn(),
  disengage: vi.fn(),
  getCombatState: vi.fn(() => null),
}));

vi.mock("../game/npcs.js", () => ({
  getNpcTemplate: vi.fn(() => null),
}));

vi.mock("../game/spawn-points.js", () => ({
  getAllSpawnPoints: vi.fn(() => []),
}));

vi.mock("../game/zones.js", () => ({
  isInSafeZone: vi.fn(() => true),
}));

// Mock terrain to always allow movement (world map not initialized in tests)
vi.mock("../world/terrain.js", () => ({
  isWalkable: vi.fn(() => true),
}));

// Mock world queries for Phase 3 world map delivery
vi.mock("../world/queries.js", () => ({
  getServerNoisePerm: vi.fn(() => new Uint8Array(512)),
  getCachedWorldMapGzip: vi.fn(() => Buffer.from("mock-gzipped-world-map")),
  getWorldMap: vi.fn(() => ({
    seed: 42, width: 900, height: 900,
    elevation: new Float32Array(900 * 900),
    biomeMap: new Uint8Array(900 * 900),
    regionMap: new Uint16Array(900 * 900),
    continentMap: new Uint8Array(900 * 900),
    continents: [], regions: [],
  })),
}));

// Mock chunk cache for CHUNK_REQUEST handler
vi.mock("../world/chunk-cache.js", () => ({
  getOrGenerateChunkHeights: vi.fn(() => Promise.resolve(Buffer.alloc(2048))),
}));

// Mock terrain noise for Y validation
vi.mock("../world/terrain-noise.js", () => ({
  generateTileHeight: vi.fn(() => 0),
  CONTINENTAL_SCALE: 8.0,
}));

vi.mock("../game/linger.js", () => ({
  cancelLingering: vi.fn(() => false),
  startLingering: vi.fn(),
  isLingering: vi.fn(() => false),
}));

// Mock user-maps so `isBuilderZone(HEAVEN_NUMERIC_ID)` returns true without
// needing a real DB + heaven row.
vi.mock("../game/user-maps.js", () => ({
  HEAVEN_NUMERIC_ID: 500,
  isBuilderZone: (n: number) => n === 500,
  getBuilderMapByNumericId: vi.fn(() => undefined),
  createUserMap: vi.fn(),
  placeTile: vi.fn(),
  removeTile: vi.fn(),
  placeBlock: vi.fn(),
  removeBlock: vi.fn(),
  listUserMaps: vi.fn(() => []),
  getTilesFor: vi.fn(() => []),
  getBlocksFor: vi.fn(() => []),
}));

// Mock zone-registry so `getZoneByNumericId(500)` returns a stub heaven zone.
vi.mock("../game/zone-registry.js", () => ({
  getZone:             vi.fn(() => undefined),
  getZoneByNumericId:  vi.fn((n: number) =>
    n === 500
      ? { id: "heaven", numericId: 500, name: "Heaven", mapFile: "heaven.json",
          levelRange: [1, 99], musicTag: "peaceful", exits: {} }
      : undefined),
  getClientMapFile: (zone: { mapFile: string }) => zone.mapFile.replace(/\.json$/, ".tmx"),
}));

import { rtcRoutes } from "./rtc.js";
import { connectionManager } from "../ws/connections.js";
import { entityStore } from "../game/entities.js";
import { registerEntity, unregisterEntity, engageTarget, disengage } from "../game/combat.js";
import { cancelLingering, startLingering } from "../game/linger.js";
import { isInSafeZone } from "../game/zones.js";
import { getAllSpawnPoints } from "../game/spawn-points.js";
import { Opcode } from "../game/protocol.js";
import { generateTileHeight } from "../world/terrain-noise.js";

async function buildApp() {
  const app = Fastify();
  await app.register(rtcRoutes, { prefix: "/" });
  return app;
}

describe("rtc routes", () => {
  let app: ReturnType<typeof Fastify>;

  beforeEach(async () => {
    vi.clearAllMocks();
    // Clear entity store
    for (const e of entityStore.getAll()) entityStore.remove(e.entityId);
    // Default: no existing connection, no lingering, DB returns position
    (connectionManager.get as any).mockReturnValue(undefined);
    (cancelLingering as any).mockReturnValue(false);
    mockDbWhere.mockResolvedValue([{ posX: 5, posY: 0, posZ: 10, mapId: 500 }]);
    app = await buildApp();
  });

  // --- POST /offer ---

  describe("POST /offer", () => {
    it("creates entity and returns SDP offer", async () => {
      const res = await app.inject({
        method: "POST", url: "/offer",
        payload: { characterId: "char-1" },
      });

      expect(res.statusCode).toBe(200);
      const body = JSON.parse(res.body);
      expect(body.sdp).toBe("mock-sdp");
      expect(body.type).toBe("offer");
      expect(body.spawn).toEqual({ x: 5, y: 0, z: 10, mapId: 500 });

      // Entity should be in the store
      const entity = entityStore.get("char-1");
      expect(entity).toBeDefined();
      expect(entity!.x).toBe(5);
      expect(entity!.z).toBe(10);

      // Combat registered, connection added, spawn broadcast
      expect(registerEntity).toHaveBeenCalledWith("char-1", "melee", 5, 2.0, 50, 50);
      expect(connectionManager.add).toHaveBeenCalled();
      expect(connectionManager.broadcastReliable).toHaveBeenCalled();
    });

    it("returns 400 when characterId is missing", async () => {
      const res = await app.inject({
        method: "POST", url: "/offer",
        payload: {},
      });
      expect(res.statusCode).toBe(400);
      expect(JSON.parse(res.body).detail).toBe("Missing characterId");
    });

    it("cleans up existing connection on reconnect", async () => {
      (connectionManager.get as any).mockReturnValue({ entityId: "char-1" });

      const res = await app.inject({
        method: "POST", url: "/offer",
        payload: { characterId: "char-1" },
      });

      expect(res.statusCode).toBe(200);
      expect(connectionManager.remove).toHaveBeenCalledWith("char-1");
    });

    it("uses default heaven spawn when character not in DB", async () => {
      mockDbWhere.mockResolvedValue([]); // No character row

      const res = await app.inject({
        method: "POST", url: "/offer",
        payload: { characterId: "char-new" },
      });

      expect(res.statusCode).toBe(200);
      const body = JSON.parse(res.body);
      // Default spawn = heaven centre (config.world.spawnX/Z default to 16,16)
      expect(body.spawn).toEqual({ x: 16, y: 0, z: 16, mapId: 500 });
    });

    it("cleans up stale entity on fresh connect", async () => {
      // Pre-add a stale entity that should be cleaned up
      entityStore.add({
        entityId: "char-stale", characterId: "char-stale", accountId: "acc-old",
        name: "Stale", entityType: "player",
        x: 0, y: 0, z: 0, rotation: 0, mapId: 500, lastUpdate: Date.now(),
      });

      const res = await app.inject({
        method: "POST", url: "/offer",
        payload: { characterId: "char-stale" },
      });

      expect(res.statusCode).toBe(200);
      // Old entity should have been unregistered and removed, then re-added
      expect(unregisterEntity).toHaveBeenCalledWith("char-stale");
      expect(entityStore.get("char-stale")).toBeDefined();
      // Fresh entity has the DB position, not the stale one
      expect(entityStore.get("char-stale")!.x).toBe(5);
    });

    it("reuses lingering entity on reconnect", async () => {
      // Pre-create a lingering entity
      const lingeringEntity = {
        entityId: "char-linger", characterId: "char-linger", accountId: "acc-1",
        name: "Lingerer", entityType: "player" as const,
        x: 42, y: 0, z: 99, rotation: 0, mapId: 500, lastUpdate: Date.now(),
      };
      entityStore.add(lingeringEntity);

      (cancelLingering as any).mockReturnValue(true);

      const res = await app.inject({
        method: "POST", url: "/offer",
        payload: { characterId: "char-linger" },
      });

      expect(res.statusCode).toBe(200);
      const body = JSON.parse(res.body);
      // Should use the lingering entity's position, not DB
      expect(body.spawn.x).toBe(42);
      expect(body.spawn.z).toBe(99);
      // Should NOT re-register combat (entity already exists)
      expect(registerEntity).not.toHaveBeenCalled();
    });
  });

  // --- POST /answer ---

  describe("POST /answer", () => {
    it("returns 404 when connection not found", async () => {
      (connectionManager.get as any).mockReturnValue(undefined);

      const res = await app.inject({
        method: "POST", url: "/answer",
        payload: { characterId: "no-one", sdp: "sdp-data" },
      });

      expect(res.statusCode).toBe(404);
      expect(JSON.parse(res.body).detail).toBe("Connection not found");
    });

    it("sets remote description on valid answer", async () => {
      const mockPc = { setRemoteDescription: vi.fn() };
      (connectionManager.get as any).mockReturnValue({ pc: mockPc });

      const res = await app.inject({
        method: "POST", url: "/answer",
        payload: { characterId: "char-1", sdp: "client-sdp" },
      });

      expect(res.statusCode).toBe(200);
      expect(JSON.parse(res.body).ok).toBe(true);
      expect(mockPc.setRemoteDescription).toHaveBeenCalledWith({ type: "answer", sdp: "client-sdp" });
    });
  });

  // --- Event handler callbacks (registered during /offer) ---

  describe("position channel state", () => {
    it("logs position channel state changes", async () => {
      await app.inject({
        method: "POST", url: "/offer",
        payload: { characterId: "char-pstate" },
      });

      const posChannel = lastPc.channels.get("position");
      const stateChangedCb = posChannel.stateChanged.subscribe.mock.calls[0][0];

      // Should not crash — just logs
      expect(() => stateChangedCb("open")).not.toThrow();
    });
  });

  describe("position channel handler", () => {
    it("updates entity position via updatePosition on valid message", async () => {
      // Mock generateTileHeight to return Y matching the client value (Phase 3 Y validation)
      (generateTileHeight as any).mockReturnValue(1.0);

      await app.inject({
        method: "POST", url: "/offer",
        payload: { characterId: "char-pos" },
      });

      // Get the captured onMessage callback
      const posChannel = lastPc.channels.get("position");
      const onMessageCb = posChannel.onMessage.subscribe.mock.calls[0][0];

      // Build a 24-byte position buffer: [opcode:u32][padding:u32][x:f32][y:f32][z:f32][rot:f32]
      const buf = Buffer.alloc(24);
      buf.writeFloatLE(20.5, 8);  // x
      buf.writeFloatLE(1.0, 12);  // y
      buf.writeFloatLE(30.5, 16); // z
      buf.writeFloatLE(1.57, 20); // rotation

      onMessageCb(buf);

      const entity = entityStore.get("char-pos");
      expect(entity!.x).toBe(20.5);
      expect(entity!.y).toBe(1.0);
      expect(entity!.z).toBe(30.5);
      expect(entity!.rotation).toBeCloseTo(1.57);
    });

    it("ignores messages shorter than 24 bytes", async () => {
      await app.inject({
        method: "POST", url: "/offer",
        payload: { characterId: "char-short" },
      });

      const posChannel = lastPc.channels.get("position");
      const onMessageCb = posChannel.onMessage.subscribe.mock.calls[0][0];

      const entity = entityStore.get("char-short");
      const origX = entity!.x;

      onMessageCb(Buffer.alloc(10)); // Too short

      expect(entity!.x).toBe(origX); // Unchanged
    });
  });

  describe("reliable channel handler", () => {
    it("engages target on AUTO_ATTACK_TOGGLE", async () => {
      await app.inject({
        method: "POST", url: "/offer",
        payload: { characterId: "char-atk" },
      });

      const relChannel = lastPc.channels.get("reliable");
      const onMessageCb = relChannel.onMessage.subscribe.mock.calls[0][0];

      onMessageCb(Buffer.from(JSON.stringify({ op: Opcode.AUTO_ATTACK_TOGGLE, targetId: "npc-1" })));

      expect(engageTarget).toHaveBeenCalledWith("char-atk", "npc-1");
    });

    it("disengages on AUTO_ATTACK_CANCEL", async () => {
      await app.inject({
        method: "POST", url: "/offer",
        payload: { characterId: "char-cancel" },
      });

      const relChannel = lastPc.channels.get("reliable");
      const onMessageCb = relChannel.onMessage.subscribe.mock.calls[0][0];

      onMessageCb(Buffer.from(JSON.stringify({ op: Opcode.AUTO_ATTACK_CANCEL })));

      expect(disengage).toHaveBeenCalledWith("char-cancel");
    });

    it("ignores invalid JSON messages", async () => {
      await app.inject({
        method: "POST", url: "/offer",
        payload: { characterId: "char-bad" },
      });

      const relChannel = lastPc.channels.get("reliable");
      const onMessageCb = relChannel.onMessage.subscribe.mock.calls[0][0];

      expect(() => onMessageCb(Buffer.from("not json!"))).not.toThrow();
    });
  });

  describe("reliable channel open — entity sync", () => {
    it("sends existing entities and WORLD_READY on open", async () => {
      // Add another entity that should be synced to the new player
      entityStore.add({
        entityId: "npc-existing", characterId: "", accountId: "",
        name: "Skeleton", entityType: "npc",
        x: 5, y: 0, z: 5, rotation: 0, mapId: 1, lastUpdate: Date.now(),
      });

      await app.inject({
        method: "POST", url: "/offer",
        payload: { characterId: "char-sync" },
      });

      const relChannel = lastPc.channels.get("reliable");
      const stateChangedCb = relChannel.stateChanged.subscribe.mock.calls[0][0];

      // Trigger the "open" state
      stateChangedCb("open");

      // Should have sent: entity spawn for npc-existing + WORLD_READY
      // (at least 2 send calls — spawn + world_ready)
      expect(relChannel.send).toHaveBeenCalled();
      const calls = relChannel.send.mock.calls;
      expect(calls.length).toBeGreaterThanOrEqual(2);
    });

    it("sends spawn points on open", async () => {
      (getAllSpawnPoints as any).mockReturnValue([
        { id: "sp-1", x: 0, z: 0, distance: 8, npcIds: ["goblin"], maxCount: 4, frequency: 5 },
      ]);

      await app.inject({
        method: "POST", url: "/offer",
        payload: { characterId: "char-sp" },
      });

      const relChannel = lastPc.channels.get("reliable");
      const stateChangedCb = relChannel.stateChanged.subscribe.mock.calls[0][0];

      stateChangedCb("open");

      // spawn point + WORLD_READY = at least 2 sends
      expect(relChannel.send.mock.calls.length).toBeGreaterThanOrEqual(2);
    });

    it("does not send entities when channel state is not open", async () => {
      await app.inject({
        method: "POST", url: "/offer",
        payload: { characterId: "char-closed" },
      });

      const relChannel = lastPc.channels.get("reliable");
      const stateChangedCb = relChannel.stateChanged.subscribe.mock.calls[0][0];

      stateChangedCb("connecting"); // Not "open"

      // send should not have been called (no entity sync)
      expect(relChannel.send).not.toHaveBeenCalled();
    });
  });

  describe("ICE disconnect handler", () => {
    it("removes entity in safe zone on disconnect", async () => {
      (isInSafeZone as any).mockReturnValue(true);

      await app.inject({
        method: "POST", url: "/offer",
        payload: { characterId: "char-dc" },
      });

      expect(entityStore.get("char-dc")).toBeDefined();

      const iceChangeCb = lastPc.iceConnectionStateChange.subscribe.mock.calls[0][0];
      iceChangeCb("disconnected");

      // Entity removed from store
      expect(entityStore.get("char-dc")).toBeUndefined();
      expect(unregisterEntity).toHaveBeenCalledWith("char-dc");
      expect(connectionManager.broadcastReliable).toHaveBeenCalled();
    });

    it("starts lingering outside safe zone on disconnect", async () => {
      (isInSafeZone as any).mockReturnValue(false);

      await app.inject({
        method: "POST", url: "/offer",
        payload: { characterId: "char-linger-dc" },
      });

      const iceChangeCb = lastPc.iceConnectionStateChange.subscribe.mock.calls[0][0];
      iceChangeCb("disconnected");

      // Entity should still be in store (lingering)
      expect(entityStore.get("char-linger-dc")).toBeDefined();
      expect(startLingering).toHaveBeenCalledWith("char-linger-dc", "char-linger-dc");
    });

    it("does nothing for non-disconnect ICE states", async () => {
      await app.inject({
        method: "POST", url: "/offer",
        payload: { characterId: "char-ice" },
      });

      const iceChangeCb = lastPc.iceConnectionStateChange.subscribe.mock.calls[0][0];
      iceChangeCb("connected"); // Not a disconnect state

      // Entity should still be there, no cleanup
      expect(entityStore.get("char-ice")).toBeDefined();
      expect(connectionManager.remove).not.toHaveBeenCalledWith("char-ice");
    });

    it("catches DB save error on disconnect", async () => {
      (isInSafeZone as any).mockReturnValue(true);

      // Make the DB update chain's .catch() fire
      mockDbUpdateSet.mockReturnValueOnce({
        where: vi.fn().mockReturnValue({
          catch: vi.fn((handler: Function) => handler(new Error("DB write failed"))),
        }),
      });

      const spy = vi.spyOn(console, "error").mockImplementation(() => {});

      await app.inject({
        method: "POST", url: "/offer",
        payload: { characterId: "char-dberr" },
      });

      const iceChangeCb = lastPc.iceConnectionStateChange.subscribe.mock.calls[0][0];
      iceChangeCb("disconnected");

      expect(spy).toHaveBeenCalledWith(
        expect.stringContaining("Failed to save state"),
        expect.any(Error),
      );
      spy.mockRestore();
    });

    it("handles entity already removed before disconnect", async () => {
      await app.inject({
        method: "POST", url: "/offer",
        payload: { characterId: "char-gone" },
      });

      // Manually remove entity before disconnect fires
      entityStore.remove("char-gone");

      const iceChangeCb = lastPc.iceConnectionStateChange.subscribe.mock.calls[0][0];

      // Should not crash
      expect(() => iceChangeCb("failed")).not.toThrow();
    });
  });
});
