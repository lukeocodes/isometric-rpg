import type { FastifyInstance } from "fastify";
import { RTCPeerConnection } from "werift";
import { requireAuth } from "../auth/middleware.js";
import { connectionManager } from "../ws/connections.js";
import { config } from "../config.js";
import { entityStore, type ServerEntity } from "../game/entities.js";
import { registerEntity, unregisterEntity, engageTarget, disengage, getCombatState } from "../game/combat.js";
import { getNpcTemplate } from "../game/npcs.js";
import { getAllSpawnPoints } from "../game/spawn-points.js";
import { isInSafeZone } from "../game/zones.js";
import { isWalkable } from "../world/terrain.js";
import { startLingering, cancelLingering, isLingering } from "../game/linger.js";
import { Opcode, packEntitySpawn, packEntityDespawn, packReliable, packSpawnPoint } from "../game/protocol.js";
import { db } from "../db/postgres.js";
import { characters } from "../db/schema.js";
import { eq } from "drizzle-orm";

export async function rtcRoutes(app: FastifyInstance) {
  // Phase 1: Server creates offer with DataChannels
  app.post<{ Body: { characterId: string } }>(
    "/offer",
    { preHandler: [requireAuth] },
    async (request, reply) => {
      const account = (request as any).account;
      const { characterId } = request.body;

      if (!characterId) {
        return reply.status(400).send({ detail: "Missing characterId" });
      }

      const entityId = characterId;

      // Check if character is lingering (reconnect after unsafe disconnect)
      const wasLingering = cancelLingering(entityId);

      // Clean up existing connection (but keep entity if lingering)
      if (connectionManager.get(entityId)) {
        connectionManager.remove(entityId);
      }
      if (!wasLingering) {
        // Fresh connect — remove any stale entity
        if (entityStore.get(entityId)) {
          unregisterEntity(entityId);
          entityStore.remove(entityId);
        }
      }

      // Load position from database
      let startX = 0, startY = 0, startZ = 0, startMapId = 1;
      const [charRow] = await db.select({
        posX: characters.posX, posY: characters.posY,
        posZ: characters.posZ, mapId: characters.mapId,
      }).from(characters).where(eq(characters.id, characterId));
      if (charRow) {
        startX = charRow.posX;
        startY = charRow.posY;
        startZ = charRow.posZ;
        startMapId = charRow.mapId;
      }

      let entity: ServerEntity;
      if (wasLingering && entityStore.get(entityId)) {
        // Reconnect to lingering character — keep their current position/state
        entity = entityStore.get(entityId)!;
        console.log(`[WebRTC] Player ${entityId} reconnected to lingering character at (${entity.x}, ${entity.z})`);
      } else {
        // Fresh spawn at saved position
        entity = {
          entityId, characterId: entityId, accountId: account.id,
          name: account.displayName || "Player", entityType: "player",
          x: startX, y: startY, z: startZ,
          rotation: 0, mapId: startMapId, lastUpdate: Date.now(),
        };
        entityStore.add(entity);
        registerEntity(entityId, "melee", 5, 2.0, 50, 50);
      }

      // Server creates the peer connection and DataChannels
      let iceServers: any[] = config.ice.stun.map(url => ({ urls: url }));
      if (config.ice.cfTurnKeyId && config.ice.cfTurnToken) {
        // Fetch short-lived TURN credentials from Cloudflare
        try {
          const cfRes = await fetch(
            `https://rtc.live.cloudflare.com/v1/turn/keys/${config.ice.cfTurnKeyId}/credentials/generate-ice-servers`,
            {
              method: "POST",
              headers: {
                Authorization: `Bearer ${config.ice.cfTurnToken}`,
                "Content-Type": "application/json",
              },
              body: JSON.stringify({ ttl: 86400 }),
            }
          );
          if (cfRes.ok) {
            const cfData = await cfRes.json() as { iceServers?: any[] };
            if (cfData.iceServers) {
              iceServers = cfData.iceServers;
              console.log(`[WebRTC] Got ${iceServers.length} ICE servers from Cloudflare`);
            }
          } else {
            console.error(`[WebRTC] Cloudflare TURN API error: ${cfRes.status}`);
          }
        } catch (err) {
          console.error(`[WebRTC] Cloudflare TURN API failed:`, err);
        }
      }
      const pc = new RTCPeerConnection({ iceServers });

      const positionChannel = pc.createDataChannel("position", {
        ordered: false,
        maxRetransmits: 0,
      });
      const reliableChannel = pc.createDataChannel("reliable", {
        ordered: true,
      });

      const conn = {
        pc,
        positionChannel: positionChannel as any,
        reliableChannel: reliableChannel as any,
        accountId: account.id,
        characterId: entityId,
        entityId,
      };

      // Track position channel state
      positionChannel.stateChanged.subscribe((state) => {
        console.log(`[WebRTC] position channel: ${state} for ${entityId}`);
      });

      // Position channel messages
      positionChannel.onMessage.subscribe((msg: Buffer) => {
        if (msg.length >= 24) {
          const newX = msg.readFloatLE(8);
          entity.y = msg.readFloatLE(12);
          const newZ = msg.readFloatLE(16);
          entity.rotation = msg.readFloatLE(20);
          entity.lastUpdate = Date.now();

          // Phase 2: Validate movement against terrain walkability
          // Silent rejection: if target tile is blocked, just don't update position
          if (isWalkable(Math.round(newX), Math.round(newZ))) {
            entityStore.updatePosition(entityId, newX, newZ);
          }
          // Always update rotation even if position is rejected
        }
      });

      // Reliable channel messages
      reliableChannel.onMessage.subscribe((msg: Buffer) => {
        let parsed: any;
        try { parsed = JSON.parse(msg.toString()); } catch { return; }
        console.log(`[WebRTC] Reliable msg from ${entityId}:`, parsed);
        if (parsed.op === Opcode.AUTO_ATTACK_TOGGLE && parsed.targetId) {
          console.log(`[WebRTC] Auto-attack toggle: ${entityId} -> ${parsed.targetId}`);
          engageTarget(entityId, parsed.targetId);
        } else if (parsed.op === Opcode.AUTO_ATTACK_CANCEL) {
          disengage(entityId);
        }
      });

      // Send entities when reliable channel opens
      reliableChannel.stateChanged.subscribe((state) => {
        console.log(`[WebRTC] reliable channel: ${state} for ${entityId}`);
        if (state === "open") {
          const allEntities = entityStore.getAll();
          console.log(`[WebRTC] Sending ${allEntities.length - 1} entities to ${entityId}`);
          for (const other of allEntities) {
            if (other.entityId === entityId) continue;
            const combat = getCombatState(other.entityId);
            const npc = getNpcTemplate(other.entityId);
            reliableChannel.send(Buffer.from(packEntitySpawn(
              other.entityId, other.name, other.x, other.y, other.z,
              other.entityType, combat?.hp ?? 50, combat?.maxHp ?? 50,
              npc?.bodyColor ?? "#4466aa", npc?.skinColor ?? "#e8c4a0",
              npc?.weaponType ?? "melee",
            )));
          }
          // Send spawn points (for dev mode visualization)
          for (const sp of getAllSpawnPoints()) {
            reliableChannel.send(Buffer.from(packSpawnPoint(
              sp.id, sp.x, sp.z, sp.distance, sp.npcIds, sp.maxCount, sp.frequency
            )));
          }
          reliableChannel.send(Buffer.from(packReliable(Opcode.WORLD_READY, {})));
        }
      });

      pc.iceConnectionStateChange.subscribe((state) => {
        console.log(`[WebRTC] ICE: ${state} for ${entityId}`);
        if (state === "disconnected" || state === "failed" || state === "closed") {
          const ent = entityStore.get(entityId);
          if (!ent) return;

          // Save position to database
          db.update(characters)
            .set({ posX: ent.x, posY: ent.y, posZ: ent.z, mapId: ent.mapId })
            .where(eq(characters.id, characterId))
            .catch((err) => console.error(`[DB] Failed to save position for ${entityId}:`, err));

          // Remove from connection manager (no longer receiving data)
          connectionManager.remove(entityId);

          if (isInSafeZone(ent.mapId, ent.x, ent.z)) {
            // Safe zone: instantly remove character
            console.log(`[WebRTC] Player ${entityId} disconnected in safe zone — removed instantly`);
            connectionManager.broadcastReliable(packEntityDespawn(entityId));
            unregisterEntity(entityId);
            entityStore.remove(entityId);
          } else {
            // Unsafe: linger for 2 minutes, can still be attacked
            console.log(`[WebRTC] Player ${entityId} disconnected outside safe zone — lingering`);
            startLingering(entityId, characterId);
          }
        }
      });

      connectionManager.add(conn);

      // Notify other players
      const combat = getCombatState(entityId);
      connectionManager.broadcastReliable(
        packEntitySpawn(entityId, entity.name, entity.x, entity.y, entity.z, "player",
          combat?.hp ?? 50, combat?.maxHp ?? 50),
        entityId,
      );

      // Create offer
      const offer = await pc.createOffer();
      await pc.setLocalDescription(offer);

      // Wait for ICE gathering
      await new Promise<void>((resolve) => {
        let resolved = false;
        const done = () => { if (!resolved) { resolved = true; resolve(); } };
        pc.iceGatheringStateChange.subscribe((state) => {
          if (state === "complete") done();
        });
        setTimeout(done, 3000);
      });

      console.log(`[WebRTC] Offer created for ${entityId}`);

      return {
        sdp: pc.localDescription!.sdp,
        type: pc.localDescription!.type,
        spawn: { x: entity.x, y: entity.y, z: entity.z, mapId: entity.mapId },
        iceServers: iceServers.map(s => {
          // Only expose STUN URLs and TURN with short-lived credentials
          if (s.username) return { urls: s.urls, username: s.username, credential: s.credential };
          return { urls: s.urls };
        }),
      };
    }
  );

  // Phase 2: Client sends answer
  app.post<{ Body: { characterId: string; sdp: string } }>(
    "/answer",
    { preHandler: [requireAuth] },
    async (request, reply) => {
      const { characterId, sdp } = request.body;
      const conn = connectionManager.get(characterId);
      if (!conn) {
        return reply.status(404).send({ detail: "Connection not found" });
      }

      await conn.pc.setRemoteDescription({ type: "answer", sdp } as any);
      console.log(`[WebRTC] Answer received for ${characterId}`);

      return { ok: true };
    }
  );
}
