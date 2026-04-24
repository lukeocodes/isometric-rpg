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
import { getZone, getZoneByNumericId, getClientMapFile } from "../game/zone-registry.js";
import { isWalkable } from "../world/terrain.js";
import { startLingering, cancelLingering, isLingering } from "../game/linger.js";
import { Opcode, packEntitySpawn, packEntityDespawn, packReliable, packSpawnPoint, packChunkData, packBinaryAbilityCooldown, packBinaryDamage, packBinaryState, packBinaryDeath, packBinaryRespawn } from "../game/protocol.js";
import {
  isBuilderZone,
  getBuilderMapByNumericId,
  getFirstStarterSpawn,
  getHeavenSpawn,
  createUserMap,
  placeTile,
  removeTile,
  placeBlock,
  removeBlock,
  listUserMaps,
  getTilesFor,
  getBlocksFor,
  mapFileName,
  type UserTile,
} from "../game/user-maps.js";

import { getZoneItems, pickupItem } from "../game/world-items.js";
import { giveItem } from "../game/inventory.js";
import { getServerNoisePerm, getCachedWorldMapGzip, getWorldMap } from "../world/queries.js";
import { getOrGenerateChunkHeights } from "../world/chunk-cache.js";
import { generateTileHeight, CONTINENTAL_SCALE } from "../world/terrain-noise.js";
import { isInTiledMap, getZoneMapData } from "../world/tiled-map.js";
import { initPlayerProgress, removePlayerProgress, handleKill, getPlayerProgress } from "../game/world.js";
import { createDungeonInstance, getDungeonMapData, getPlayerDungeon, cleanupPlayerDungeon } from "../game/dungeon.js";
import { loadInventory, saveInventory, sendInventory, equipItem, unequipItem, useItem, getEquippedBonuses } from "../game/inventory.js";
import { initPlayerQuests, removePlayerQuests, acceptQuest, turnInQuest, getAvailableQuests } from "../game/quests.js";
import { db } from "../db/postgres.js";
import { characters } from "../db/schema.js";
import { eq } from "drizzle-orm";

export async function rtcRoutes(app: FastifyInstance) {
  // Phase 1: Server creates offer with DataChannels
  app.post<{ Body: { characterId: string; builder?: boolean } }>(
    "/offer",
    { preHandler: [requireAuth] },
    async (request, reply) => {
      const account = (request as any).account;
      const { characterId, builder } = request.body;
      const isBuilder = !!builder;

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

      // Load saved position from DB. Characters from the normal creation /
      // dev-seed paths already have a valid mapId + coords. Manually-added
      // rows (e.g. inserted via raw SQL) may have a stale mapId — drop them
      // onto the first seeded starter so they land somewhere sane. Heaven
      // is the last-ditch fallback if no starter exists at all.
      const fallback = getFirstStarterSpawn() ?? getHeavenSpawn();
      if (!fallback) {
        return reply.status(500).send({ detail: "No playable map seeded" });
      }

      let startX     = fallback.posX;
      let startY     = 0;
      let startZ     = fallback.posZ;
      let startMapId = fallback.mapId;

      const [charRow] = await db.select({
        name: characters.name,
        posX: characters.posX, posY: characters.posY,
        posZ: characters.posZ, mapId: characters.mapId,
        xp: characters.xp, level: characters.level,
      }).from(characters).where(eq(characters.id, characterId));
      if (charRow && isBuilderZone(charRow.mapId) && !(charRow.posX === 0 && charRow.posZ === 0)) {
        startX     = charRow.posX;
        startY     = charRow.posY;
        startZ     = charRow.posZ;
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

      // Initialize XP/level tracking + inventory + quests
      initPlayerProgress(entityId, characterId, charRow?.xp ?? 0, charRow?.level ?? 1);
      initPlayerQuests(entityId);
      loadInventory(entityId, characterId).catch(err =>
        console.error(`[Inventory] Failed to load for ${entityId}:`, err));

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
        isBuilder,
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
      reliableChannel.onMessage.subscribe(async (msg: Buffer) => {
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
              reliableChannel.send(packBinaryAbilityCooldown(abilityId, remaining));
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
              reliableChannel.send(packBinaryAbilityCooldown(abilityId, cdSec));
            }
          } else if (abilityId === "heal") {
            const selfCombat = getCombatState(entityId);
            if (!selfCombat || selfCombat.hp >= selfCombat.maxHp) { (entity as any)[cdKey] = 0; return; }
            const healAmount = Math.min(20, selfCombat.maxHp - selfCombat.hp);
            selfCombat.hp = Math.min(selfCombat.maxHp, selfCombat.hp + healAmount);
            console.log(`[Ability] ${entity.name} used Heal: +${healAmount} HP (${selfCombat.hp}/${selfCombat.maxHp})`);
            if (reliableChannel.readyState === "open") {
              const stateBuf = packBinaryState(entityId, selfCombat.hp, selfCombat.maxHp);
              reliableChannel.send(stateBuf);
              reliableChannel.send(packBinaryAbilityCooldown(abilityId, cdSec));
              connectionManager.broadcastBinary(stateBuf, entityId);
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

            // Base damage by type + equipment bonus
            const eqBonus = getEquippedBonuses(entityId);
            let damage: number;
            let weaponType: string;
            if (abilityId === "fire") {
              damage = 15 + Math.floor(Math.random() * 6) + eqBonus.bonusDamage;
              weaponType = "fire";
            } else if (abilityId === "ice") {
              damage = 10 + Math.floor(Math.random() * 4) + eqBonus.bonusDamage;
              weaponType = "ice";
            } else {
              damage = 8 + Math.floor(Math.random() * 3) + eqBonus.bonusDamage;
              weaponType = "shock";
            }

            // Target armor reduces damage
            if (target.entityType === "player") {
              const targetBonus = getEquippedBonuses(targetId);
              damage = Math.max(1, damage - targetBonus.bonusArmor);
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

            // Broadcast damage (binary)
            connectionManager.broadcastBinary(packBinaryDamage(entityId, targetId, damage, weaponType));
            if (reliableChannel.readyState === "open") {
              reliableChannel.send(packBinaryAbilityCooldown(abilityId, cdSec));
            }

            // Handle kill (XP, respawn, etc.)
            if (targetCombat.hp <= 0) {
              handleKill(entityId, targetId);
            }
          }
        } else if (parsed.op === 20 /* CHAT_MESSAGE */ && typeof parsed.text === "string") {
          const text = parsed.text.trim().slice(0, 200);
          if (text.length === 0) return;

          if (text.startsWith("/")) {
            // Server-side command
            const parts = text.split(/[\s,]+/);
            const cmd = parts[0].toLowerCase();
            const reply = (msg: string) => connectionManager.sendReliable(entityId, JSON.stringify({ op: 21 /* SYSTEM_MESSAGE */, message: msg }));

            if (cmd === "/go") {
              const x = parseFloat(parts[1]);
              const z = parseFloat(parts[2]);
              if (isNaN(x) || isNaN(z)) { reply("Usage: /go x,z"); return; }
              entity.x = x; entity.z = z;
              const combat = getCombatState(entityId);
              const hp = combat?.hp ?? 50;
              const maxHp = combat?.maxHp ?? 50;
              connectionManager.sendBinary(entityId, packBinaryRespawn(entityId, x, 0, z, hp, maxHp));
              reply(`Teleported to (${Math.round(x)}, ${Math.round(z)})`);
            } else {
              reply(`Unknown command: ${cmd}`);
            }
            return;
          }

          // Regular chat — broadcast to all players
          const senderName = entity.name || "Unknown";
          const chatMsg = JSON.stringify({ op: 20, senderId: entityId, senderName, text });
          connectionManager.broadcastReliable(chatMsg);
        } else if (parsed.op === Opcode.EQUIP_ITEM && parsed.inventoryId) {
          equipItem(entityId, parsed.inventoryId);
        } else if (parsed.op === Opcode.UNEQUIP_ITEM && parsed.inventoryId) {
          unequipItem(entityId, parsed.inventoryId);
        } else if (parsed.op === Opcode.USE_ITEM && parsed.inventoryId) {
          const result = useItem(entityId, parsed.inventoryId);
          if (result && result.healAmount > 0) {
            const selfCombat = getCombatState(entityId);
            if (selfCombat && selfCombat.hp < selfCombat.maxHp) {
              const healAmount = Math.min(result.healAmount, selfCombat.maxHp - selfCombat.hp);
              selfCombat.hp += healAmount;
              connectionManager.sendBinary(entityId,
                packBinaryState(entityId, selfCombat.hp, selfCombat.maxHp));
              connectionManager.broadcastBinary(
                packBinaryState(entityId, selfCombat.hp, selfCombat.maxHp), entityId);
            }
          }
        } else if (parsed.op === 34 /* QUEST_ACCEPT */ && parsed.questId) {
          acceptQuest(entityId, parsed.questId);
        } else if (parsed.op === 36 /* QUEST_TURNIN */ && parsed.questId) {
          const rewards = turnInQuest(entityId, parsed.questId);
          if (rewards) {
            console.log(`[Quest] ${entity.name} turned in quest ${parsed.questId}, reward: ${rewards.xp} XP`);
          }
        } else if (parsed.op === Opcode.ITEM_PICKUP_REQUEST && parsed.worldItemId) {
          const wi = await pickupItem(parsed.worldItemId);
          if (wi) {
            giveItem(entityId, wi.itemId, wi.quantity);
            // Broadcast despawn to all players in zone
            connectionManager.broadcastReliable(
              packReliable(Opcode.WORLD_ITEM_DESPAWN, { id: wi.id }),
            );
          }
        } else if (parsed.op === Opcode.DUNGEON_ENTER) {
          // Create a dungeon instance for this player
          const playerProgress = getPlayerProgress(entityId);
          const difficulty = Math.min(3, Math.floor((playerProgress?.level ?? 1) / 3) + 1);
          const instance = createDungeonInstance(entityId, difficulty);
          const mapData = getDungeonMapData(instance.instanceId);
          if (!mapData) return;

          // Move entity to dungeon
          entity.mapId = instance.mapId;
          entity.x = mapData.spawnX;
          entity.z = mapData.spawnZ;

          // Send dungeon map to client
          if (reliableChannel.readyState === "open") {
            reliableChannel.send(packReliable(Opcode.DUNGEON_MAP, {
              instanceId: instance.instanceId,
              width: mapData.width,
              height: mapData.height,
              ground: mapData.ground,
              collision: mapData.collision,
              spawnX: mapData.spawnX,
              spawnZ: mapData.spawnZ,
            }));
          }
          console.log(`[Dungeon] Player ${entity.name} entered dungeon (difficulty ${difficulty})`);
        } else if (parsed.op === Opcode.DUNGEON_EXIT) {
          // Return player to heaven. Coordinates + numericId come from the
          // DB-registered heaven row; no hardcoded values.
          const dungeon = getPlayerDungeon(entityId);
          if (dungeon) {
            cleanupPlayerDungeon(entityId);
            const heavenSpawn = getHeavenSpawn();
            const heavenZone  = heavenSpawn ? getZoneByNumericId(heavenSpawn.mapId) : undefined;
            if (heavenSpawn && heavenZone) {
              entity.mapId = heavenSpawn.mapId;
              entity.x = heavenSpawn.posX; entity.y = 0; entity.z = heavenSpawn.posZ;
              if (reliableChannel.readyState === "open") {
                reliableChannel.send(packReliable(Opcode.ZONE_CHANGE, {
                  zoneId:     heavenZone.id,
                  zoneName:   heavenZone.name,
                  mapFile:    getClientMapFile(heavenZone),
                  spawnX:     heavenSpawn.posX, spawnZ: heavenSpawn.posZ,
                  levelRange: heavenZone.levelRange,
                  musicTag:   heavenZone.musicTag,
                }));
              }
            }
          }
        } else if (parsed.op === Opcode.ZONE_CHANGE_REQUEST) {
          // Two forms:
          //   { op:90, targetZoneId: "heaven" }    → direct teleport (debug)
          //   { op:90, exitId: "north-gate" }      → use current zone's exit map
          let targetZone = undefined as ReturnType<typeof getZone>;
          let spawnX = 0;
          let spawnZ = 0;

          if (typeof parsed.targetZoneId === "string") {
            targetZone = getZone(parsed.targetZoneId);
            if (!targetZone) { console.log(`[WebRTC] Unknown zone: ${parsed.targetZoneId}`); return; }
            if (isBuilderZone(targetZone.numericId)) {
              // Builder zones have no Tiled server spec; spawn at map centre.
              const m = getBuilderMapByNumericId(targetZone.numericId);
              spawnX = m ? Math.floor(m.width / 2) : 0;
              spawnZ = m ? Math.floor(m.height / 2) : 0;
            } else {
              // For debug teleport, spawn at the JSON's player-spawn object (parsed at load time).
              const spec = getZoneMapData(targetZone.id);
              spawnX = spec?.playerSpawn.x ?? 0;
              spawnZ = spec?.playerSpawn.z ?? 0;
            }
          } else if (typeof parsed.exitId === "string") {
            const currentZone = getZoneByNumericId(entity.mapId);
            if (!currentZone) return;
            const exit = currentZone.exits[parsed.exitId];
            if (!exit) { console.log(`[WebRTC] Invalid zone exit: ${parsed.exitId}`); return; }
            targetZone = getZone(exit.targetZone);
            if (!targetZone) { console.log(`[WebRTC] Target zone not found: ${exit.targetZone}`); return; }
            spawnX = exit.spawnX;
            spawnZ = exit.spawnZ;
          } else {
            return;
          }

          // Despawn old-zone observers' view of this entity
          for (const other of entityStore.iterAll()) {
            if (other.entityId === entityId) continue;
            if (other.mapId !== entity.mapId) continue;
            const otherConn = connectionManager.get(other.entityId);
            if (otherConn?.reliableChannel?.readyState === "open") {
              otherConn.reliableChannel.send(packEntityDespawn(entityId));
            }
          }

          // Move entity
          entity.mapId = targetZone.numericId;
          entity.x = spawnX;
          entity.y = 0;
          entity.z = spawnZ;
          console.log(`[WebRTC] Zone change: ${entityId} -> ${targetZone.name} (mapId=${targetZone.numericId}) at (${spawnX}, ${spawnZ})`);

          // Send new zone to requester + resend entities in new zone
          if (reliableChannel.readyState === "open") {
            // Tell client to load the new map
            reliableChannel.send(packReliable(Opcode.ZONE_CHANGE, {
              zoneId:     targetZone.id,
              zoneName:   targetZone.name,
              mapFile:    getClientMapFile(targetZone),
              spawnX, spawnZ,
              levelRange: targetZone.levelRange,
              musicTag:   targetZone.musicTag,
            }));

            // Builder session: stream the new zone's tile overlay too.
            if (conn.isBuilder && isBuilderZone(targetZone.numericId)) {
              sendBuilderSnapshot(reliableChannel, targetZone.numericId);
            }

            // Spawn new-zone entities on the requester's client
            for (const other of entityStore.iterAll()) {
              if (other.entityId === entityId) continue;
              if (other.mapId !== targetZone.numericId) continue;
              const combat = getCombatState(other.entityId);
              const npc    = getNpcTemplate(other.entityId);
              reliableChannel.send(Buffer.from(packEntitySpawn(
                other.entityId, other.name, other.x, other.y, other.z,
                other.entityType, combat?.hp ?? 50, combat?.maxHp ?? 50,
                npc?.bodyColor ?? "#4466aa", npc?.skinColor ?? "#e8c4a0",
                npc?.weaponType ?? "melee",
              )));
            }
          }

          // Spawn this entity on new-zone observers' clients
          for (const other of entityStore.iterAll()) {
            if (other.entityId === entityId) continue;
            if (other.mapId !== targetZone.numericId) continue;
            const otherConn = connectionManager.get(other.entityId);
            if (otherConn?.reliableChannel?.readyState === "open") {
              const combat = getCombatState(entityId);
              otherConn.reliableChannel.send(Buffer.from(packEntitySpawn(
                entity.entityId, entity.name, entity.x, entity.y, entity.z,
                entity.entityType, combat?.hp ?? 50, combat?.maxHp ?? 50,
                "#4466aa", "#e8c4a0", "melee",
              )));
            }
          }
        } else if (parsed.op >= 200 && parsed.op <= 213) {
          // --- World builder opcodes ---
          // All builder mutations require an is-builder session. Silently
          // reject from regular clients to keep the attack surface small.
          if (!conn.isBuilder) {
            if (reliableChannel.readyState === "open") {
              reliableChannel.send(packReliable(Opcode.BUILDER_ERROR, { reason: "not-a-builder" }));
            }
            return;
          }

          try {
            await handleBuilderOp(conn, entity, parsed, reliableChannel);
          } catch (err) {
            console.error(`[Builder] op=${parsed.op} failed:`, err);
            if (reliableChannel.readyState === "open") {
              reliableChannel.send(packReliable(Opcode.BUILDER_ERROR, { reason: (err as Error).message }));
            }
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
          const self = entityStore.get(entityId);
          const selfMapId = self?.mapId ?? 1;
          let sentCount = 0;
          for (const other of entityStore.iterAll()) {
            if (other.entityId === entityId) continue;
            if (other.mapId !== selfMapId) continue; // Only same-zone entities
            const combat = getCombatState(other.entityId);
            const npc = getNpcTemplate(other.entityId);
            reliableChannel.send(Buffer.from(packEntitySpawn(
              other.entityId, other.name, other.x, other.y, other.z,
              other.entityType, combat?.hp ?? 50, combat?.maxHp ?? 50,
              npc?.bodyColor ?? "#4466aa", npc?.skinColor ?? "#e8c4a0",
              npc?.weaponType ?? "melee",
            )));
            sentCount++;
          }
          console.log(`[WebRTC] Sent ${sentCount} entities (zone mapId=${selfMapId}) to ${entityId}`);
          // Send spawn points (for dev mode visualization)
          for (const sp of getAllSpawnPoints()) {
            reliableChannel.send(Buffer.from(packSpawnPoint(
              sp.id, sp.x, sp.z, sp.distance, sp.npcIds, sp.maxCount, sp.frequency
            )));
          }
          // Send world items for this zone
          const zoneId = getZoneByNumericId(selfMapId)?.id ?? `zone-${selfMapId}`;
          const worldItems = getZoneItems(zoneId);
          if (worldItems.length > 0) {
            reliableChannel.send(Buffer.from(packReliable(Opcode.WORLD_ITEMS_SYNC, { items: worldItems })));
          }

          const selfZone = getZoneByNumericId(selfMapId);
          reliableChannel.send(Buffer.from(packReliable(Opcode.WORLD_READY, {
            spawnX: entity.x, spawnY: entity.y, spawnZ: entity.z,
            zoneId:   selfZone?.id   ?? `zone-${selfMapId}`,
            zoneName: selfZone?.name ?? "",
            mapFile:  selfZone ? getClientMapFile(selfZone) : "",
            musicTag: selfZone?.musicTag ?? "town",
          })));

          // Builder bootstrap: if this is a builder session, send a snapshot of
          // the current builder zone's tile overlay.
          if (conn.isBuilder && isBuilderZone(selfMapId)) {
            sendBuilderSnapshot(reliableChannel, selfMapId);
          }

          // Send inventory after world is ready
          sendInventory(entityId);

          // Auto-accept available quests in the player's current zone at
          // their level. There's only one zone (heaven) right now, and
          // heaven has no quests, so this is effectively a no-op — but it
          // still wires up correctly once quest data is authored.
          const prog = getPlayerProgress(entityId);
          const level = prog?.level ?? 1;
          const currentZoneId = getZoneByNumericId(selfMapId)?.id;
          if (currentZoneId) {
            for (const quest of getAvailableQuests(entityId, currentZoneId, level)) {
              acceptQuest(entityId, quest.id);
            }
          }
        }
      });

      pc.iceConnectionStateChange.subscribe((state) => {
        console.log(`[WebRTC] ICE: ${state} for ${entityId}`);
        if (state === "disconnected" || state === "failed" || state === "closed") {
          const ent = entityStore.get(entityId);
          if (!ent) return;

          // Save position, XP/level, and inventory to database
          const progress = removePlayerProgress(entityId);
          db.update(characters)
            .set({
              posX: ent.x, posY: ent.y, posZ: ent.z, mapId: ent.mapId,
              ...(progress ? { xp: progress.xp, level: progress.level } : {}),
            })
            .where(eq(characters.id, characterId))
            .catch((err) => console.error(`[DB] Failed to save state for ${entityId}:`, err));

          saveInventory(entityId)
            .catch((err) => console.error(`[Inventory] Failed to save for ${entityId}:`, err));

          // Clean up dungeon + quests
          cleanupPlayerDungeon(entityId);
          removePlayerQuests(entityId);

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

// ---------------------------------------------------------------------------
// World-builder helpers
// ---------------------------------------------------------------------------

/** Send the full tile + block overlay for a builder zone as one snapshot. */
function sendBuilderSnapshot(channel: any, mapNumericId: number): void {
  const map = getBuilderMapByNumericId(mapNumericId);
  if (!map) return;
  if (channel.readyState !== "open") return;
  channel.send(packReliable(Opcode.BUILDER_MAP_SNAPSHOT, {
    mapId:     map.id,
    zoneId:    map.zoneId,
    numericId: map.numericId,
    name:      map.name,
    width:     map.width,
    height:    map.height,
    tiles:     getTilesFor(map),
    blocks:    getBlocksFor(map),
  }));
}

/** Broadcast a builder event to every builder currently in the same zone. */
function broadcastBuilderEvent(mapNumericId: number, payload: string, exclude?: string): void {
  const buf = Buffer.from(payload);
  for (const other of connectionManager.iterAll()) {
    if (!other.isBuilder) continue;
    if (other.entityId === exclude) continue;
    const ent = entityStore.get(other.entityId);
    if (!ent || ent.mapId !== mapNumericId) continue;
    if (other.reliableChannel?.readyState === "open") {
      other.reliableChannel.send(buf);
    }
  }
}

/** Dispatch a single builder opcode from a pre-validated builder connection. */
async function handleBuilderOp(
  conn: any,
  entity: ServerEntity,
  parsed: any,
  channel: any,
): Promise<void> {
  switch (parsed.op) {
    case Opcode.BUILDER_LIST_MAPS: {
      const maps = listUserMaps().map((m) => ({
        id: m.id, zoneId: m.zoneId, numericId: m.numericId,
        name: m.name, width: m.width, height: m.height,
      }));
      if (channel.readyState === "open") {
        channel.send(packReliable(Opcode.BUILDER_MAPS_LIST, { maps }));
      }
      return;
    }

    case Opcode.BUILDER_NEW_MAP: {
      const w = Math.max(8, Math.min(256, Math.floor(parsed.width ?? 32)));
      const h = Math.max(8, Math.min(256, Math.floor(parsed.height ?? 32)));
      const name = String(parsed.name ?? "Untitled").slice(0, 100);
      const m = await createUserMap({
        name, width: w, height: h, createdBy: conn.accountId ?? null,
      });
      // Teleport the creator to the new map's centre.
      const spawnX = Math.floor(m.width / 2);
      const spawnZ = Math.floor(m.height / 2);
      entity.mapId = m.numericId;
      entity.x = spawnX; entity.y = 0; entity.z = spawnZ;
      if (channel.readyState === "open") {
        channel.send(packReliable(Opcode.ZONE_CHANGE, {
          zoneId:     m.zoneId,
          zoneName:   m.name,
          mapFile:    mapFileName(m),
          spawnX, spawnZ,
          levelRange: [1, 99],
          musicTag:   "peaceful",
        }));
        sendBuilderSnapshot(channel, m.numericId);
      }
      return;
    }

    case Opcode.BUILDER_GOTO_MAP: {
      const targetId = Number(parsed.numericId);
      const target = getBuilderMapByNumericId(targetId);
      if (!target) throw new Error(`unknown-map:${targetId}`);
      const spawnX = Math.floor(target.width / 2);
      const spawnZ = Math.floor(target.height / 2);
      entity.mapId = target.numericId;
      entity.x = spawnX; entity.y = 0; entity.z = spawnZ;
      if (channel.readyState === "open") {
        channel.send(packReliable(Opcode.ZONE_CHANGE, {
          zoneId:     target.zoneId,
          zoneName:   target.name,
          mapFile:    mapFileName(target),
          spawnX, spawnZ,
          levelRange: [1, 99],
          musicTag:   "peaceful",
        }));
        sendBuilderSnapshot(channel, target.numericId);
      }
      return;
    }

    case Opcode.BUILDER_PLACE_TILE: {
      const map = getBuilderMapByNumericId(entity.mapId);
      if (!map) throw new Error("not-in-builder-zone");
      const tile: UserTile = {
        layer:    parsed.layer ?? "ground",
        x:        parsed.x,
        y:        parsed.y,
        tileset:  parsed.tileset,
        tileId:   parsed.tileId,
        rotation: parsed.rotation ?? 0,
        flipH:    !!parsed.flipH,
        flipV:    !!parsed.flipV,
      };
      const stored = await placeTile(map, tile, conn.accountId ?? null);
      const broadcast = packReliable(Opcode.BUILDER_TILE_PLACED, stored);
      broadcastBuilderEvent(map.numericId, broadcast);
      return;
    }

    case Opcode.BUILDER_REMOVE_TILE: {
      const map = getBuilderMapByNumericId(entity.mapId);
      if (!map) throw new Error("not-in-builder-zone");
      const layer = String(parsed.layer ?? "ground");
      const x = Math.floor(parsed.x);
      const y = Math.floor(parsed.y);
      const removed = await removeTile(map, layer, x, y);
      if (removed) {
        const broadcast = packReliable(Opcode.BUILDER_TILE_REMOVED, { layer, x, y });
        broadcastBuilderEvent(map.numericId, broadcast);
      }
      return;
    }

    case Opcode.BUILDER_PLACE_BLOCK: {
      const map = getBuilderMapByNumericId(entity.mapId);
      if (!map) throw new Error("not-in-builder-zone");
      const block = await placeBlock(
        map, Number(parsed.x), Number(parsed.y), conn.accountId ?? null,
      );
      const broadcast = packReliable(Opcode.BUILDER_BLOCK_PLACED, block);
      broadcastBuilderEvent(map.numericId, broadcast);
      return;
    }

    case Opcode.BUILDER_REMOVE_BLOCK: {
      const map = getBuilderMapByNumericId(entity.mapId);
      if (!map) throw new Error("not-in-builder-zone");
      const x = Math.floor(parsed.x), y = Math.floor(parsed.y);
      const removed = await removeBlock(map, x, y);
      if (removed) {
        const broadcast = packReliable(Opcode.BUILDER_BLOCK_REMOVED, { x, y });
        broadcastBuilderEvent(map.numericId, broadcast);
      }
      return;
    }

    default:
      throw new Error(`unhandled-builder-op:${parsed.op}`);
  }
}
