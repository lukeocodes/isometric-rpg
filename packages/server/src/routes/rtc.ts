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
import { getZone } from "../game/zone-registry.js";
import { isWalkable } from "../world/terrain.js";
import { startLingering, cancelLingering, isLingering } from "../game/linger.js";
import { Opcode, packEntitySpawn, packEntityDespawn, packReliable, packSpawnPoint, packChunkData, packDamageEvent, packEntityDeath, packEntityState } from "../game/protocol.js";
import { getServerNoisePerm, getCachedWorldMapGzip, getWorldMap } from "../world/queries.js";
import { getOrGenerateChunkHeights } from "../world/chunk-cache.js";
import { generateTileHeight, CONTINENTAL_SCALE } from "../world/terrain-noise.js";
import { isInTiledMap } from "../world/tiled-map.js";
import { initPlayerProgress, removePlayerProgress, handleKill } from "../game/world.js";
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
      let startX = config.world.spawnX, startY = 0, startZ = config.world.spawnZ, startMapId = 1;
      const [charRow] = await db.select({
        name: characters.name,
        posX: characters.posX, posY: characters.posY,
        posZ: characters.posZ, mapId: characters.mapId,
        xp: characters.xp, level: characters.level,
      }).from(characters).where(eq(characters.id, characterId));
      if (charRow && !(charRow.posX === 0 && charRow.posZ === 0)) {
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
          name: charRow?.name || account.displayName || "Player", entityType: "player",
          x: startX, y: startY, z: startZ,
          rotation: 0, mapId: startMapId, lastUpdate: Date.now(),
        };
        entityStore.add(entity);
        registerEntity(entityId, "melee", 5, 2.0, 50, 50);
      }

      // Initialize XP/level tracking
      initPlayerProgress(entityId, characterId, charRow?.xp ?? 0, charRow?.level ?? 1);

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
        maxPacketLifeTime: 200, // Drop stale position packets after 200ms
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
            // Phase 3: Validate player Y against terrain height
            // Skip Y validation when using Tiled maps (client sends Y=0 for flat terrain)
            const tileX = Math.round(newX);
            const tileZ = Math.round(newZ);
            const inTiledMap = isInTiledMap(tileX, tileZ);
            if (!inTiledMap) {
              const world = getWorldMap();
              if (world) {
                const perm = getServerNoisePerm();
                const chunkX = Math.floor(tileX / 32); // CHUNK_SIZE
                const chunkZ = Math.floor(tileZ / 32);
                if (chunkX >= 0 && chunkX < world.width && chunkZ >= 0 && chunkZ < world.height) {
                  const continentalElev = world.elevation[chunkZ * world.width + chunkX];
                  const biomeId = world.biomeMap[chunkZ * world.width + chunkX];
                  const expectedY = generateTileHeight(tileX, tileZ, continentalElev, biomeId, perm);
                  const clientY = msg.readFloatLE(12);
                  if (Math.abs(clientY - expectedY) > 0.5) {
                    return;
                  }
                }
              }
            }
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
        } else if (parsed.op === Opcode.ACTION_USE && parsed.abilityId) {
          const abilityId = parsed.abilityId as string;
          const now = Date.now();

          // Ability cooldown definitions (ms)
          const ABILITY_COOLDOWNS: Record<string, number> = {
            defend: 15000, heal: 10000, fire: 8000, ice: 12000, shock: 6000,
          };
          const cooldownMs = ABILITY_COOLDOWNS[abilityId];
          if (!cooldownMs) return;

          // Check cooldown
          const cdKey = `_cd_${abilityId}`;
          const lastUsed = (entity as any)[cdKey] ?? 0;
          if (now - lastUsed < cooldownMs) {
            const remaining = Math.ceil((cooldownMs - (now - lastUsed)) / 1000);
            if (reliableChannel.readyState === "open") {
              reliableChannel.send(packReliable(Opcode.ABILITY_COOLDOWN, { abilityId, remaining }));
            }
            return;
          }

          // Mark cooldown
          (entity as any)[cdKey] = now;
          const cdSec = Math.ceil(cooldownMs / 1000);

          if (abilityId === "defend") {
            // Defend: 50% damage reduction for 5 seconds
            (entity as any)._defendUntil = now + 5000;
            console.log(`[Ability] ${entity.name} used Defend (5s)`);
            if (reliableChannel.readyState === "open") {
              reliableChannel.send(packReliable(Opcode.ABILITY_COOLDOWN, { abilityId, remaining: cdSec }));
            }
          } else if (abilityId === "heal") {
            const selfCombat = getCombatState(entityId);
            if (!selfCombat || selfCombat.hp >= selfCombat.maxHp) { (entity as any)[cdKey] = 0; return; }
            const healAmount = Math.min(20, selfCombat.maxHp - selfCombat.hp);
            selfCombat.hp = Math.min(selfCombat.maxHp, selfCombat.hp + healAmount);
            console.log(`[Ability] ${entity.name} used Heal: +${healAmount} HP (${selfCombat.hp}/${selfCombat.maxHp})`);
            if (reliableChannel.readyState === "open") {
              reliableChannel.send(packEntityState(entityId, selfCombat.hp, selfCombat.maxHp));
              reliableChannel.send(packReliable(Opcode.ABILITY_COOLDOWN, { abilityId, remaining: cdSec }));
              connectionManager.broadcastReliable(packEntityState(entityId, selfCombat.hp, selfCombat.maxHp), entityId);
            }
          } else if (abilityId === "fire" || abilityId === "ice" || abilityId === "shock") {
            // Offensive abilities — require a combat target in range
            const combatState = getCombatState(entityId);
            const targetId = parsed.targetId || combatState?.targetId;
            if (!targetId) { (entity as any)[cdKey] = 0; return; }
            const target = entityStore.get(targetId);
            const targetCombat = getCombatState(targetId);
            if (!target || !targetCombat || targetCombat.hp <= 0) { (entity as any)[cdKey] = 0; return; }

            // Range check (magic range = 4 tiles)
            const dist = Math.max(Math.abs(entity.x - target.x), Math.abs(entity.z - target.z));
            if (dist > 4) { (entity as any)[cdKey] = 0; return; }

            // Damage by type
            let damage: number;
            let weaponType: string;
            if (abilityId === "fire") {
              damage = 15 + Math.floor(Math.random() * 6); // 15-20 burst
              weaponType = "fire";
            } else if (abilityId === "ice") {
              damage = 10 + Math.floor(Math.random() * 4); // 10-13 + slow effect
              weaponType = "ice";
            } else {
              damage = 8 + Math.floor(Math.random() * 3); // 8-10 fast chain
              weaponType = "shock";
            }

            // Apply defend reduction on target
            if ((target as any)._defendUntil && now < (target as any)._defendUntil) {
              damage = Math.floor(damage * 0.5);
            }

            targetCombat.hp = Math.max(0, targetCombat.hp - damage);
            targetCombat.inCombat = true;
            targetCombat.combatTimer = 6.0;
            // Retaliate
            if (!targetCombat.autoAttacking) {
              targetCombat.autoAttacking = true;
              targetCombat.targetId = entityId;
              targetCombat.attackTimer = 0;
            }

            console.log(`[Ability] ${entity.name} used ${abilityId} on ${target.name}: ${damage} dmg (${targetCombat.hp}/${targetCombat.maxHp})`);

            // Broadcast damage
            connectionManager.broadcastReliable(packDamageEvent(entityId, targetId, damage, weaponType));
            if (reliableChannel.readyState === "open") {
              reliableChannel.send(packReliable(Opcode.ABILITY_COOLDOWN, { abilityId, remaining: cdSec }));
            }

            // Handle kill (XP, respawn, etc.)
            if (targetCombat.hp <= 0) {
              handleKill(entityId, targetId);
            }
          }
        } else if (parsed.op === 20 /* CHAT_MESSAGE */ && typeof parsed.text === "string") {
          // Chat: sanitize, truncate, broadcast to all players
          const text = parsed.text.trim().slice(0, 200);
          if (text.length === 0) return;
          const senderName = entity.name || "Unknown";
          const chatMsg = JSON.stringify({ op: 20, senderId: entityId, senderName, text });
          connectionManager.broadcastReliable(chatMsg);
        } else if (parsed.op === Opcode.ZONE_CHANGE_REQUEST && parsed.exitId) {
          // Zone transition: validate exit, move entity, notify client
          const currentZone = getZone(entity.mapId === 1 ? "human-meadows" : `zone-${entity.mapId}`);
          if (!currentZone) return;
          const exit = currentZone.exits[parsed.exitId];
          if (!exit) {
            console.log(`[WebRTC] Invalid zone exit: ${parsed.exitId}`);
            return;
          }
          const targetZone = getZone(exit.targetZone);
          if (!targetZone) {
            console.log(`[WebRTC] Target zone not found: ${exit.targetZone}`);
            return;
          }
          // Move entity to new zone
          entity.x = exit.spawnX;
          entity.z = exit.spawnZ;
          entity.y = 0;
          // TODO: update entity.mapId when multi-zone is fully wired
          console.log(`[WebRTC] Zone change: ${entityId} -> ${targetZone.name} at (${exit.spawnX}, ${exit.spawnZ})`);
          // Notify client to load new map
          if (reliableChannel.readyState === "open") {
            reliableChannel.send(JSON.stringify({
              op: Opcode.ZONE_CHANGE,
              zoneId: targetZone.id,
              zoneName: targetZone.name,
              mapFile: targetZone.mapFile,
              spawnX: exit.spawnX,
              spawnZ: exit.spawnZ,
              levelRange: targetZone.levelRange,
              musicTag: targetZone.musicTag,
            }));
          }
        } else if (parsed.op === Opcode.CHUNK_REQUEST && parsed.cx !== undefined && parsed.cz !== undefined) {
          const world = getWorldMap();
          if (!world) return;
          const perm = getServerNoisePerm();
          const cx = parsed.cx as number;
          const cz = parsed.cz as number;
          // Bounds check
          if (cx < 0 || cx >= world.width || cz < 0 || cz >= world.height) return;
          // Generate or retrieve from Redis cache
          getOrGenerateChunkHeights(config.world.seed, cx, cz, world, perm).then((heightBuf) => {
            if (reliableChannel.readyState === "open") {
              reliableChannel.send(packChunkData(cx, cz, heightBuf));
            }
          }).catch((err) => {
            console.error(`[WebRTC] Chunk generation error for (${cx},${cz}):`, err);
          });
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

          // Save position and XP/level to database
          const progress = removePlayerProgress(entityId);
          db.update(characters)
            .set({
              posX: ent.x, posY: ent.y, posZ: ent.z, mapId: ent.mapId,
              ...(progress ? { xp: progress.xp, level: progress.level } : {}),
            })
            .where(eq(characters.id, characterId))
            .catch((err) => console.error(`[DB] Failed to save state for ${entityId}:`, err));

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

      // Get gzipped world map (cached in memory from startup)
      const worldMapGzip = getCachedWorldMapGzip();

      return {
        sdp: pc.localDescription!.sdp,
        type: pc.localDescription!.type,
        spawn: { x: entity.x, y: entity.y, z: entity.z, mapId: entity.mapId },
        iceServers: iceServers.map(s => {
          // Only expose STUN URLs and TURN with short-lived credentials
          if (s.username) return { urls: s.urls, username: s.username, credential: s.credential };
          return { urls: s.urls };
        }),
        worldMap: worldMapGzip.toString("base64"),
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
