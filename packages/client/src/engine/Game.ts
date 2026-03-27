import { PixiApp } from "../renderer/PixiApp";
import { IsoCamera } from "../renderer/IsoCamera";
import { EntityRenderer } from "../renderer/EntityRenderer";
import { TerrainRenderer } from "../renderer/TerrainRenderer";
import { TiledMapRenderer } from "../renderer/TiledMapRenderer";
import { StructureRenderer } from "../renderer/StructureRenderer";
import { screenToWorld, worldToScreen, TILE_WIDTH_HALF, TILE_HEIGHT_HALF } from "../renderer/IsometricRenderer";
// EntitySpriteSheet removed — sprite art handled in separate session
import { ParticleSystem } from "../renderer/ParticleSystem";
import { Graphics } from "pixi.js";
import { InputManager } from "./InputManager";
import { Loop } from "./Loop";
import { EntityManager } from "../ecs/EntityManager";
import { MovementSystem } from "../ecs/systems/MovementSystem";
import { AnimationSystem } from "../ecs/systems/AnimationSystem";
import { InterpolationSystem } from "../ecs/systems/InterpolationSystem";
import { findPath } from "../ecs/systems/Pathfinding";
import { ChunkManager } from "../world/ChunkManager";
import { AudioSystem } from "../audio/AudioSystem";
import { MusicState } from "../audio/types";
import { NetworkManager } from "../net/NetworkManager";
import { StateSync } from "../net/StateSync";
import { packPosition, packReliable, Opcode } from "../net/Protocol";
import { createPosition } from "../ecs/components/Position";
import { createMovement } from "../ecs/components/Movement";
import { createRenderable } from "../ecs/components/Renderable";
import { createIdentity } from "../ecs/components/Identity";
import { createStats } from "../ecs/components/Stats";
import { createCombat } from "../ecs/components/Combat";
import type { PositionComponent } from "../ecs/components/Position";
import type { MovementComponent } from "../ecs/components/Movement";
import type { CombatComponent } from "../ecs/components/Combat";
import type { StatsComponent } from "../ecs/components/Stats";
import type { IdentityComponent } from "../ecs/components/Identity";
import type { GameHUD } from "../ui/screens/GameHUD";
import { WORLD_WIDTH, WORLD_HEIGHT } from "../world/WorldConstants";

const PLAYER_SPEED = 7.0;
const POSITION_SEND_INTERVAL = 1000 / 20; // Match server tick rate (20Hz)

export class Game {
  private pixiApp: PixiApp;
  private camera: IsoCamera;
  private input: InputManager;
  private loop: Loop;
  private canvas: HTMLCanvasElement;

  private entityManager: EntityManager;
  private movementSystem: MovementSystem;
  private entityRenderer: EntityRenderer;
  private terrainRenderer: TerrainRenderer;
  private animationSystem: AnimationSystem;
  private interpolationSystem: InterpolationSystem;
  private localEntityId: string | null = null;
  private onDisconnect: ((reason: string) => void) | null = null;
  private selectedTargetId: string | null = null;
  private hud: GameHUD | null = null;

  private cameraTarget = { x: 0, y: 0, z: 0 };
  private minimapEntities: Array<{ x: number; z: number; type: string }> = [];

  private chunkManager: ChunkManager;
  private tiledMap: TiledMapRenderer | null = null;
  private structureRenderer: StructureRenderer | null = null;
  private useTiledMap = false;

  private audioSystem: AudioSystem;
  private network: NetworkManager | null = null;
  private stateSync: StateSync;
  private positionSequence = 0;
  private lastPositionSend = 0;
  private initialized = false;
  private currentZoneName: string | null = null;
  private hoverCursor: Graphics | null = null;
  private moveMarker: Graphics | null = null;
  private movePath: Array<{ x: number; z: number }> = []; // A* path queue
  private moveGoal: { x: number; z: number } | null = null; // Final destination for marker
  private followTargetId: string | null = null;
  private particles: ParticleSystem;
  private zoneChangeRequested = false;
  private dungeonExitReady = false;
  private renderTime = 0;

  constructor(canvas: HTMLCanvasElement) {
    this.canvas = canvas;
    this.pixiApp = new PixiApp(canvas);
    this.input = new InputManager(canvas);
    this.loop = new Loop();

    this.entityManager = new EntityManager();
    this.movementSystem = new MovementSystem(this.entityManager);
    this.animationSystem = new AnimationSystem(this.entityManager);
    this.interpolationSystem = new InterpolationSystem(this.entityManager);

    this.chunkManager = new ChunkManager();
    this.terrainRenderer = new TerrainRenderer(this.chunkManager);
    this.entityRenderer = new EntityRenderer(this.entityManager);

    this.particles = new ParticleSystem();

    // Camera reads screen size from the PixiJS app
    this.camera = new IsoCamera(
      this.pixiApp.worldContainer,
      () => ({ width: this.pixiApp.screenWidth, height: this.pixiApp.screenHeight }),
    );

    this.stateSync = new StateSync(this.entityManager);

    // Initialize audio system
    this.audioSystem = new AudioSystem();
    this.audioSystem.init();

    this.stateSync.setOnDamage((attackerId, targetId, damage, weaponType) => {
      const flashColors: Record<string, string> = { fire: "#ff6600", ice: "#66ccff", shock: "#ffff44" };
      this.entityRenderer.flashEntity(targetId, flashColors[weaponType] ?? "#ff0000");
      this.entityRenderer.showAttackLine(attackerId, targetId);
      this.entityRenderer.showDamageNumber(targetId, damage, weaponType);
      // Impact particles
      const tPos = this.entityManager.getComponent<PositionComponent>(targetId, "position");
      if (tPos) {
        const { sx, sy } = worldToScreen(tPos.x, tPos.z, tPos.y);
        this.particles.spawnImpact(sx, sy, (tPos.x + tPos.z) * 10);
      }
      // Screen shake when player takes damage
      if (targetId === this.localEntityId) {
        this.camera.shake(3, 0.15);
      }
      // Combat log
      if (this.hud && (attackerId === this.localEntityId || targetId === this.localEntityId)) {
        const aName = this.getEntityName(attackerId);
        const tName = this.getEntityName(targetId);
        if (attackerId === this.localEntityId) {
          this.hud.chatBox.addSystemMessage(`You hit ${tName} for ${damage} damage`);
        } else {
          this.hud.chatBox.addSystemMessage(`${aName} hits you for ${damage} damage`);
        }
      }
    });

    this.stateSync.setOnDeath((entityId) => {
      // Death poof particles + screen shake
      const dPos = this.entityManager.getComponent<PositionComponent>(entityId, "position");
      if (dPos) {
        const { sx, sy } = worldToScreen(dPos.x, dPos.z, dPos.y);
        this.particles.spawnDeathPoof(sx, sy, (dPos.x + dPos.z) * 10);
      }
      if (entityId !== this.localEntityId) {
        this.camera.shake(5, 0.25); // Satisfying kill shake
      }
      // Combat log
      if (this.hud) {
        const name = this.getEntityName(entityId);
        if (entityId === this.localEntityId) {
          this.hud.chatBox.addSystemMessage("You have been slain!");
        } else {
          this.hud.chatBox.addSystemMessage(`${name} has been defeated`);
        }
      }
      if (this.selectedTargetId === entityId) this.selectTarget(null);
      this.entityRenderer.fadeOutAndRemove(entityId);
      this.entityManager.removeEntity(entityId);
    });

    this.stateSync.setOnCombatState((entityId, inCombat, autoAttacking, targetId) => {
      if (entityId === this.localEntityId) {
        const combat = this.entityManager.getComponent<CombatComponent>(entityId, "combat");
        const wasInCombat = combat?.inCombat ?? false;
        if (combat) {
          combat.inCombat = inCombat;
          combat.autoAttacking = autoAttacking;
          combat.targetEntityId = targetId;
        }
        const sm = this.audioSystem.getMusicStateMachine();
        if (sm) {
          if (inCombat && !wasInCombat) {
            sm.requestState(MusicState.Combat);
          } else if (!inCombat && wasInCombat) {
            sm.requestState(MusicState.Victory);
          }
        }
        const mcm = this.audioSystem.getMusicContentManager();
        if (mcm && inCombat) {
          mcm.updateEnemyCount(1);
        }
      }
    });

    this.stateSync.setOnEnemyNearby((entityIds, nearby) => {
      const sm = this.audioSystem.getMusicStateMachine();
      if (sm) {
        if (nearby && entityIds.length > 0) {
          sm.requestState(MusicState.EnemyNearby);
        } else if (!nearby) {
          if (sm.getState() === MusicState.EnemyNearby) {
            sm.forceState(sm.getAmbientState());
          }
        }
      }
    });

    this.stateSync.setOnZoneMusicTag((musicState) => {
      const sm = this.audioSystem.getMusicStateMachine();
      if (sm) {
        const stateMap: Record<string, MusicState> = {
          "exploring": MusicState.Exploring,
          "town": MusicState.Town,
          "dungeon": MusicState.Dungeon,
        };
        const mapped = stateMap[musicState];
        if (mapped) {
          sm.forceState(mapped);
        }
      }
    });

    this.stateSync.setOnXpGain((xpGained, totalXp, xpToNext, level) => {
      if (this.hud) {
        this.hud.updateXp(totalXp, xpToNext, level);
        this.hud.showXpGain(xpGained);
      }
      if (this.localEntityId) {
        this.entityRenderer.showXpGain(this.localEntityId, xpGained);
        const xpPos = this.entityManager.getComponent<PositionComponent>(this.localEntityId, "position");
        if (xpPos) {
          const { sx, sy } = worldToScreen(xpPos.x, xpPos.z, xpPos.y);
          this.particles.spawnSparkles(sx, sy - 20, (xpPos.x + xpPos.z) * 10);
        }
      }
      if (this.hud) {
        this.hud.chatBox.addSystemMessage(`+${xpGained} XP (${totalXp}/${xpToNext})`);
      }
    });

    this.stateSync.setOnLevelUp((newLevel, _hpBonus, _manaBonus, _staminaBonus) => {
      if (this.hud) {
        this.hud.showLevelUp(newLevel);
        this.hud.chatBox.addSystemMessage(`Level up! You are now level ${newLevel}`);
      }
    });

    this.stateSync.setOnRespawn((x, y, z, hp, maxHp) => {
      if (!this.localEntityId) return;
      const pos = this.entityManager.getComponent<PositionComponent>(this.localEntityId, "position");
      if (pos) {
        pos.x = x;
        pos.y = y;
        pos.z = z;
      }
      const stats = this.entityManager.getComponent<StatsComponent>(this.localEntityId, "stats");
      if (stats) {
        stats.hp = hp;
        stats.maxHp = maxHp;
      }
      // Clear combat state
      this.selectTarget(null);
      this.entityRenderer.setAutoAttacking(false);
      if (this.hud) {
        this.hud.showZoneNotification("You have been resurrected");
      }
    });

    this.stateSync.setOnLootDrop((items) => {
      for (const item of items) {
        if (this.hud) {
          this.hud.chatBox.addSystemMessage(`Looted: ${item.icon} ${item.name} x${item.qty}`);
        }
      }
    });

    this.stateSync.setOnInventorySync((items) => {
      if (this.hud) this.hud.inventory.updateItems(items);
    });

    this.stateSync.setOnQuestUpdate((quests) => {
      if (this.hud) this.hud.questPanel.updateQuests(quests);
    });

    this.stateSync.setOnChat((senderId, senderName, text) => {
      if (this.hud) {
        this.hud.chatBox.addMessage(senderName, text);
      }
      this.entityRenderer.showChatBubble(senderId, text);
    });

    this.stateSync.setOnAbilityCooldown((abilityId, remaining) => {
      this.abilityCooldowns.set(abilityId, Date.now() + remaining * 1000);
      // Update HUD cooldown visual
      const slotIndex = this.abilitySlotIndex[abilityId];
      if (slotIndex !== undefined && this.hud) {
        this.hud.updateAbilityCooldown(slotIndex, remaining);
        // Schedule clear when cooldown expires
        if (remaining > 0) {
          setTimeout(() => this.hud?.updateAbilityCooldown(slotIndex, 0), remaining * 1000);
        }
      }
    });

    this.stateSync.setOnDungeonMap((data) => {
      console.log(`[Game] Entering dungeon: ${data.width}x${data.height}`);
      if (this.hud) this.hud.chatBox.addSystemMessage("Entering dungeon...");
      this.showLoadingOverlay("Dungeon");

      // Clear remote entities
      for (const entity of this.entityManager.getAllEntities()) {
        if (entity.id !== this.localEntityId) {
          this.entityRenderer.removeEntityMesh(entity.id);
          this.entityManager.removeEntity(entity.id);
        }
      }
      this.movePath = [];
      this.moveGoal = null;
      this.followTargetId = null;
      this.selectTarget(null);

      // Load dungeon map data into existing TiledMapRenderer
      if (this.tiledMap) {
        this.tiledMap.loadFromData(data.width, data.height, data.ground, data.collision);
        this.movementSystem.setTerrainResolvers(
          (_x, _z) => 0,
          (x, z) => this.tiledMap!.isWalkable(Math.round(x), Math.round(z)),
        );
      }

      // Reposition player
      if (this.localEntityId) {
        const pos = this.entityManager.getComponent<PositionComponent>(this.localEntityId, "position");
        const mov = this.entityManager.getComponent<MovementComponent>(this.localEntityId, "movement");
        if (pos) { pos.x = data.spawnX; pos.y = 0; pos.z = data.spawnZ; }
        if (mov) { mov.tileX = data.spawnX; mov.tileZ = data.spawnZ; mov.moving = false; }
        this.camera.snapToTarget();
      }

      if (this.hud) this.hud.showZoneNotification("Dungeon");
      this.hideLoadingOverlay();
    });

    this.stateSync.setOnDungeonExit((_exitX, _exitZ, message) => {
      if (this.hud) {
        this.hud.chatBox.addSystemMessage(message);
        this.hud.showZoneNotification("Boss Defeated!");
      }
      // Player can now walk to the exit portal and send DUNGEON_EXIT
      // The exit portal location is tracked server-side
      this.dungeonExitReady = true;
    });

    this.stateSync.setOnZoneChange(async (zoneId, zoneName, mapFile, spawnX, spawnZ, _levelRange, _musicTag) => {
      console.log(`[Game] Zone change: ${zoneName} (${mapFile})`);
      if (this.hud) {
        this.hud.chatBox.addSystemMessage(`Entering ${zoneName}...`);
      }
      // Show loading overlay
      this.showLoadingOverlay(zoneName);
      try {
        // Clear all remote entities (keep local player)
        for (const entity of this.entityManager.getAllEntities()) {
          if (entity.id !== this.localEntityId) {
            this.entityRenderer.removeEntityMesh(entity.id);
            this.entityManager.removeEntity(entity.id);
          }
        }
        // Clear path state
        this.movePath = [];
        this.moveGoal = null;
        this.followTargetId = null;
        this.selectTarget(null);
        // Load new map
        if (this.structureRenderer) {
          this.structureRenderer.dispose();
          this.structureRenderer = null;
        }
        if (this.tiledMap) {
          this.tiledMap.dispose();
        }
        this.tiledMap = new TiledMapRenderer();
        await this.tiledMap.loadMap(`/maps/${mapFile}`);
        this.pixiApp.worldContainer.addChildAt(this.tiledMap.container, 0);
        // Update walkability resolver
        this.movementSystem.setTerrainResolvers(
          (_x, _z) => 0,
          (x, z) => this.tiledMap!.isWalkable(Math.round(x), Math.round(z)),
        );
        // Reposition player
        if (this.localEntityId) {
          const pos = this.entityManager.getComponent<PositionComponent>(this.localEntityId, "position");
          const mov = this.entityManager.getComponent<MovementComponent>(this.localEntityId, "movement");
          if (pos) { pos.x = spawnX; pos.y = 0; pos.z = spawnZ; }
          if (mov) { mov.tileX = spawnX; mov.tileZ = spawnZ; mov.moving = false; }
          this.camera.snapToTarget();
        }
        this.currentZoneName = null; // Reset zone tracking
        if (this.hud) {
          this.hud.showZoneNotification(zoneName);
          const ground = this.tiledMap.getGroundData();
          this.hud.miniMap.setTiledData(ground, this.tiledMap.mapWidth, this.tiledMap.mapHeight);
          this.hud.miniMap.setZoneExits(this.tiledMap.zoneExits);
          this.hud.worldMap.setTiledData(ground, this.tiledMap.mapWidth, this.tiledMap.mapHeight);
        }
      } catch (e) {
        console.error("[Game] Zone change failed:", e);
        if (this.hud) this.hud.chatBox.addSystemMessage("Failed to load zone");
      }
      this.hideLoadingOverlay();
      this.zoneChangeRequested = false;
      this.dungeonExitReady = false;
    });

    this.input.setOnLeftClick((sx, sy) => this.handleLeftClick(sx, sy));
    this.input.setOnRightClick((sx, sy) => this.handleRightClick(sx, sy));
    this.input.setOnToggleAutoAttack(() => this.handleToggleAutoAttack());
    this.input.setOnTabTarget(() => this.cycleTarget());
    this.input.setOnAbilityUse((slot) => this.handleAbilityUse(slot));
    this.input.setOnToggleInventory(() => this.hud?.inventory.toggle());
    this.input.setOnToggleQuests(() => this.hud?.questPanel.toggle());

    // Scroll wheel zoom
    this.canvas.addEventListener("wheel", (e) => {
      e.preventDefault();
      const delta = e.deltaY > 0 ? -0.15 : 0.15;
      this.camera.setZoom(this.camera.getZoom() + delta);
      if (this.tiledMap) this.tiledMap.setZoom(this.camera.getZoom());
    }, { passive: false });
  }

  async start(characterId?: string) {
    // Initialize PixiJS (async)
    if (!this.initialized) {
      await this.pixiApp.init();

      // Sprite sheets removed — art pipeline handled separately

      // Try loading a Tiled map (client-side for now)
      try {
        this.tiledMap = new TiledMapRenderer();
        await this.tiledMap.loadMap("/maps/starter.json");
        this.useTiledMap = true;
        this.pixiApp.worldContainer.addChild(this.tiledMap.container);

        // Use Tiled map's player spawn as the spawn position
        this.spawnPosition = { x: this.tiledMap.playerSpawn.x, y: 0, z: this.tiledMap.playerSpawn.z };

        // Set up walkability from Tiled collision data
        this.movementSystem.setTerrainResolvers(
          (_x, _z) => 0, // Flat terrain (no elevation yet)
          (x, z) => this.tiledMap!.isWalkable(Math.round(x), Math.round(z)),
        );

        // Load structures from map objects
        if (this.tiledMap.wallPieces.length > 0) {
          this.structureRenderer = new StructureRenderer();
          this.structureRenderer.loadWalls(this.tiledMap.wallPieces as any);
          this.pixiApp.worldContainer.addChild(this.structureRenderer.container);
        }

        console.log("[Game] Using Tiled map for terrain");
      } catch (e) {
        console.warn("[Game] No Tiled map found, falling back to procedural terrain", e);
        this.useTiledMap = false;
        this.pixiApp.worldContainer.addChild(this.terrainRenderer.container);
      }

      this.pixiApp.worldContainer.addChild(this.entityRenderer.container);
      this.pixiApp.worldContainer.addChild(this.particles.container);

      // Tile hover cursor — isometric diamond outline
      this.hoverCursor = new Graphics();
      this.hoverCursor.poly([
        { x: 0, y: -TILE_HEIGHT_HALF },
        { x: TILE_WIDTH_HALF, y: 0 },
        { x: 0, y: TILE_HEIGHT_HALF },
        { x: -TILE_WIDTH_HALF, y: 0 },
      ]);
      this.hoverCursor.stroke({ width: 1.5, color: 0xffffff, alpha: 0.6 });
      this.hoverCursor.zIndex = 999990;
      this.pixiApp.worldContainer.addChild(this.hoverCursor);

      // Click-to-move destination marker
      this.moveMarker = new Graphics();
      this.moveMarker.poly([
        { x: 0, y: -TILE_HEIGHT_HALF },
        { x: TILE_WIDTH_HALF, y: 0 },
        { x: 0, y: TILE_HEIGHT_HALF },
        { x: -TILE_WIDTH_HALF, y: 0 },
      ]);
      this.moveMarker.fill({ color: 0x44cc44, alpha: 0.2 });
      this.moveMarker.stroke({ width: 2, color: 0x44cc44, alpha: 0.7 });
      this.moveMarker.zIndex = 999989;
      this.moveMarker.visible = false;
      this.pixiApp.worldContainer.addChild(this.moveMarker);

      this.initialized = true;
    }

    const id = characterId || "local-player";
    this.stateSync.setLocalEntityId(id);

    this.createLocalPlayer(id);
    if (!this.useTiledMap) {
      this.chunkManager.updatePlayerPosition(this.spawnPosition.x, this.spawnPosition.z);
    }

    this.loop.onTick((dt) => this.tick(dt));
    let lastDustProgress = 0;
    this.loop.onRender((frameDt) => {
      this.processInput();
      this.movementSystem.update(frameDt);
      this.interpolationSystem.update(frameDt);

      // Walking dust for local player
      if (this.localEntityId) {
        const mov = this.entityManager.getComponent<MovementComponent>(this.localEntityId, "movement");
        if (mov?.moving) {
          // Spawn dust at mid-step (progress crosses 0.5)
          if (lastDustProgress < 0.5 && mov.progress >= 0.5) {
            const lpos = this.entityManager.getComponent<PositionComponent>(this.localEntityId, "position");
            if (lpos) {
              const { sx, sy } = worldToScreen(lpos.x, lpos.z, lpos.y);
              this.particles.spawnDust(sx, sy, (lpos.x + lpos.z) * 10 - 1);
            }
          }
          lastDustProgress = mov.progress;
        } else {
          lastDustProgress = 0;
        }
      }

      if (this.localEntityId) {
        const pos = this.entityManager.getComponent<PositionComponent>(this.localEntityId, "position");
        if (pos) {
          this.cameraTarget.x = pos.x;
          this.cameraTarget.y = pos.y;
          this.cameraTarget.z = pos.z;
          this.camera.setTarget(pos.x, pos.y, pos.z);
          if (this.useTiledMap && this.tiledMap) {
            this.tiledMap.update(pos.x, pos.z);
          } else {
            this.chunkManager.updatePlayerPosition(pos.x, pos.z);
            this.terrainRenderer.update(pos.x, pos.z);
          }
          // Check zone transitions
          if (this.hud && this.tiledMap) {
            const zone = this.tiledMap.safeZones.find((sz) => {
              const dx = pos.x - sz.tileX;
              const dz = pos.z - sz.tileZ;
              return dx >= 0 && dx < sz.tileWidth && dz >= 0 && dz < sz.tileHeight;
            });
            const zoneName = zone ? (zone.properties.zoneName as string) ?? zone.name : null;
            if (zoneName !== this.currentZoneName) {
              if (zoneName) {
                this.hud.showZoneNotification(zoneName);
              } else if (this.currentZoneName) {
                this.hud.showZoneNotification("Wilderness");
              }
              this.currentZoneName = zoneName;
            }
          }
          // Check zone exits
          if (this.tiledMap) {
            for (const exit of this.tiledMap.zoneExits) {
              const dx = pos.x - exit.tileX;
              const dz = pos.z - exit.tileZ;
              if (dx >= 0 && dx < exit.tileWidth && dz >= 0 && dz < exit.tileHeight) {
                if (!this.zoneChangeRequested && this.network?.isConnected()) {
                  this.zoneChangeRequested = true;
                  this.network.sendReliable(packReliable(Opcode.ZONE_CHANGE_REQUEST, { exitId: exit.exitId }));
                }
                break;
              }
            }
            // Check dungeon entrances
            for (const entrance of this.tiledMap.dungeonEntrances) {
              const dx = pos.x - entrance.tileX;
              const dz = pos.z - entrance.tileZ;
              if (dx >= 0 && dx < entrance.tileWidth && dz >= 0 && dz < entrance.tileHeight) {
                if (!this.zoneChangeRequested && this.network?.isConnected()) {
                  this.zoneChangeRequested = true;
                  this.network.sendReliable(packReliable(Opcode.DUNGEON_ENTER, {}));
                  if (this.hud) this.hud.chatBox.addSystemMessage(`Entering ${entrance.dungeonName}...`);
                }
                break;
              }
            }
          }
          // Update minimap and world map
          if (this.hud) {
            this.hud.miniMap.updatePlayerPosition(pos.x, pos.z);
            this.hud.worldMap.updatePlayerPosition(pos.x, pos.z);
            this.minimapEntities.length = 0;
            for (const ent of this.entityManager.getAllEntities()) {
              if (ent.id === this.localEntityId) continue;
              const epos = ent.components.get("position") as PositionComponent | undefined;
              const eid = ent.components.get("identity") as IdentityComponent | undefined;
              if (epos && eid) this.minimapEntities.push({ x: epos.x, z: epos.z, type: eid.entityType });
            }
            this.hud.miniMap.updateEntities(this.minimapEntities);
          }
        }
      }
      this.entityRenderer.update(frameDt);

      // Dev mode: render spawn point markers
      if (import.meta.env.DEV && this.stateSync.spawnPoints.length > 0) {
        this.entityRenderer.renderSpawnPoints(this.stateSync.spawnPoints);
      }
      // Zone exit portal markers
      if (this.tiledMap && this.tiledMap.zoneExits.length > 0) {
        this.renderTime += frameDt;
        this.entityRenderer.renderZoneExits(this.tiledMap.zoneExits, this.renderTime);
      }
      this.animationSystem.update(frameDt);
      this.particles.update(frameDt);
      const playerPos = this.localEntityId
        ? this.entityManager.getComponent<PositionComponent>(this.localEntityId, "position")
        : null;
      this.audioSystem.update(frameDt, playerPos ? { x: playerPos.x, z: playerPos.z } : undefined);
      this.updateHUD();
      this.camera.update(frameDt);

      // Update click-to-move marker
      if (this.moveMarker) {
        if (this.moveGoal) {
          const { sx: msx, sy: msy } = worldToScreen(this.moveGoal.x, this.moveGoal.z, 0);
          this.moveMarker.position.set(msx, msy);
          this.moveMarker.visible = true;
        } else {
          this.moveMarker.visible = false;
        }
      }

      // Update tile hover cursor
      if (this.hoverCursor) {
        const mouse = this.input.getMousePosition();
        const wc = this.pixiApp.worldContainer;
        const zoom = this.camera.getZoom();
        const worldPxX = (mouse.x - wc.x) / zoom;
        const worldPxY = (mouse.y - wc.y) / zoom;
        const { tileX, tileZ } = screenToWorld(worldPxX, worldPxY);
        const snappedX = Math.round(tileX);
        const snappedZ = Math.round(tileZ);
        const { sx, sy } = worldToScreen(snappedX, snappedZ, 0);
        this.hoverCursor.position.set(sx, sy);
      }

      this.pixiApp.render();
    });

    this.loop.start();
    this.canvas.focus();
  }

  async connectToServer(token: string, characterId: string) {
    this.network = new NetworkManager();
    this.network.setOnPositionMessage((data) => this.stateSync.handlePositionMessage(data));
    this.network.setOnReliableMessage((msg) => this.stateSync.handleReliableMessage(msg));
    this.network.setOnBinaryReliable((data) => this.stateSync.handleBinaryReliable(data));
    this.network.setOnChunkData((data) => this.stateSync.handleChunkData(data));
    this.network.setOnDisconnect((reason) => {
      if (this.onDisconnect) this.onDisconnect(reason);
    });

    await this.network.connect(token, characterId);
    console.log("WebRTC connected, waiting for world data...");

    if (this.network.worldData) {
      const wd = this.network.worldData;
      this.chunkManager.setWorldData(wd.biomeMap, wd.elevationBands, wd.regionMap, wd.regionBiomes);
      console.log(`[Game] World map applied: ${wd.width}x${wd.height}`);
    } else {
      console.warn("[Game] No world map received from server!");
    }

    // Set up terrain resolvers — Tiled map overrides procedural if active
    if (this.useTiledMap && this.tiledMap) {
      this.stateSync.setTerrainYResolver((_x, _z) => 0);
    } else {
      this.stateSync.setTerrainYResolver((x, z) => this.chunkManager.getTerrainY(x, z));
      this.stateSync.setOnChunkData((cx, cz, heights) => {
        this.chunkManager.setChunkHeights(cx, cz, heights);
        if (this.localEntityId) {
          const pos = this.entityManager.getComponent<PositionComponent>(this.localEntityId, "position");
          if (pos) pos.y = this.chunkManager.getTerrainY(pos.x, pos.z);
        }
      });
      this.movementSystem.setTerrainResolvers(
        (x, z) => this.chunkManager.getTerrainY(x, z),
        (x, z) => this.chunkManager.isWalkable(x, z),
      );
    }

    this.chunkManager.setChunkRequestFn((cx, cz) => {
      if (this.network?.isConnected()) {
        this.network.sendReliable(packReliable(Opcode.CHUNK_REQUEST, { cx, cz }));
      }
    });

    await this.network.waitForWorldReady();
    console.log("World ready -- all entities loaded");

    this.spawnPosition = this.network.spawnPosition;
  }

  private spawnPosition = { x: 0, y: 0, z: 0 };

  stop() {
    this.loop.stop();
    this.network?.disconnect();
    this.audioSystem.dispose();
    this.tiledMap?.dispose();
    this.terrainRenderer.dispose();
    this.entityRenderer.dispose();
    this.chunkManager.dispose();
    this.pixiApp.dispose();
  }

  setOnDisconnect(handler: (reason: string) => void) {
    this.onDisconnect = handler;
  }

  setHUD(hud: GameHUD) {
    this.hud = hud;
    hud.setOnAutoAttackToggle(() => this.handleToggleAutoAttack());
    hud.setOnAbilityUse((slot) => this.handleAbilityUse(slot));

    // Wire quest turn-in
    hud.questPanel.setOnTurnIn((questId) => {
      if (this.network?.isConnected()) {
        this.network.sendReliable(packReliable(Opcode.QUEST_TURNIN, { questId }));
      }
    });

    // Wire inventory actions
    hud.inventory.setOnEquip((id) => {
      if (this.network?.isConnected()) {
        this.network.sendReliable(packReliable(Opcode.EQUIP_ITEM, { inventoryId: id }));
      }
    });
    hud.inventory.setOnUnequip((id) => {
      if (this.network?.isConnected()) {
        this.network.sendReliable(packReliable(Opcode.UNEQUIP_ITEM, { inventoryId: id }));
      }
    });
    hud.inventory.setOnUseItem((id) => {
      if (this.network?.isConnected()) {
        this.network.sendReliable(packReliable(Opcode.USE_ITEM, { inventoryId: id }));
      }
    });

    // Wire chat send
    hud.chatBox.setOnSend((text) => {
      if (this.network?.isConnected()) {
        this.network.sendReliable(packReliable(20 /* CHAT_MESSAGE */, { text }));
      }
    });

    // Feed minimap/world map with terrain data
    if (this.useTiledMap && this.tiledMap) {
      const ground = this.tiledMap.getGroundData();
      const w = this.tiledMap.mapWidth;
      const h = this.tiledMap.mapHeight;
      hud.miniMap.setTiledData(ground, w, h);
      if (this.tiledMap) hud.miniMap.setZoneExits(this.tiledMap.zoneExits);
      hud.worldMap.setTiledData(ground, w, h);
    } else {
      const biomeData = this.chunkManager.getBiomeData();
      if (biomeData) {
        hud.miniMap.setBiomeData(biomeData, WORLD_WIDTH, WORLD_HEIGHT);
        hud.worldMap.setBiomeData(biomeData, WORLD_WIDTH, WORLD_HEIGHT);
      }
    }

    hud.settingsMenu.setOnVolumeChange((master, music, sfx) => {
      this.audioSystem.setPreferences({ masterVolume: master, musicVolume: music, sfxVolume: sfx });
      const token = sessionStorage.getItem("gameJwt") || "";
      if (token) {
        fetch("/api/auth/preferences", {
          method: "PUT",
          headers: { "Content-Type": "application/json", "Authorization": `Bearer ${token}` },
          body: JSON.stringify({ preferences: { masterVolume: master, musicVolume: music, sfxVolume: sfx } }),
        }).catch(() => {});
      }
    });

    window.addEventListener("keydown", (e) => {
      const tag = (document.activeElement as HTMLElement)?.tagName;
      if (tag === "INPUT" || tag === "TEXTAREA") {
        // Escape should still close the map even when typing
        if (e.code === "Escape" && this.hud?.worldMap.isVisible()) {
          this.hud.worldMap.toggle();
        }
        return;
      }
      if (e.code === "KeyM" && this.hud) {
        this.hud.worldMap.toggle();
      }
      if (e.code === "Escape") {
        if (this.hud?.worldMap.isVisible()) {
          this.hud.worldMap.toggle();
        } else if (this.selectedTargetId) {
          this.selectTarget(null);
          this.entityRenderer.setAutoAttacking(false);
        }
      }
    });
  }

  getInputManager() { return this.input; }
  getEntityManager() { return this.entityManager; }
  getAudioSystem(): AudioSystem { return this.audioSystem; }

  /** Process WASD input and apply to movement component. Called every render frame for responsiveness. */
  private processInput() {
    if (!this.localEntityId) return;
    const inputState = this.input.getState();
    const movement = this.entityManager.getComponent<MovementComponent>(this.localEntityId, "movement");
    if (!movement) return;

    // Follow target: recompute path to entity's current position
    if (this.followTargetId) {
      const targetPos = this.entityManager.getComponent<PositionComponent>(this.followTargetId, "position");
      if (targetPos) {
        const myPos = this.entityManager.getComponent<PositionComponent>(this.localEntityId, "position");
        if (myPos) {
          const dist = Math.max(Math.abs(myPos.x - targetPos.x), Math.abs(myPos.z - targetPos.z));
          if (dist <= 1.5) {
            this.movePath = [];
            this.moveGoal = null;
            this.sendAutoAttackToggle(this.followTargetId);
            this.followTargetId = null;
          } else if (!movement.moving && this.movePath.length === 0) {
            // Recompute path when idle
            this.computePath(movement.tileX, movement.tileZ, Math.round(targetPos.x), Math.round(targetPos.z));
          }
        }
      } else {
        this.followTargetId = null;
        this.movePath = [];
        this.moveGoal = null;
      }
    }

    // Isometric WASD: W=up-left(-X), S=down-right(+X), A=down-left(+Z), D=up-right(-Z)
    let dx = 0, dz = 0;
    if (inputState.moveForward) { dx -= 1; }  // W = up-left on screen
    if (inputState.moveBackward) { dx += 1; }  // S = down-right on screen
    if (inputState.moveLeft) { dz += 1; }      // A = down-left on screen
    if (inputState.moveRight) { dz -= 1; }     // D = up-right on screen

    if (dx !== 0 || dz !== 0) {
      // WASD input cancels click-to-move and follow
      this.movePath = [];
      this.moveGoal = null;
      this.followTargetId = null;
      if (!movement.moving) {
        const tx = movement.tileX + dx;
        const tz = movement.tileZ + dz;
        if (this.movementSystem.canMoveTo(movement.tileX, movement.tileZ, tx, tz)) {
          movement.targetX = tx;
          movement.targetZ = tz;
          movement.progress = 0;
          movement.moving = true;
        } else {
          this.movementSystem.startBump(movement, dx, dz);
        }
      } else {
        movement.queuedDx = dx;
        movement.queuedDz = dz;
      }
    } else if (this.movePath.length > 0 && !movement.moving) {
      // A* path following: consume next tile from path
      const next = this.movePath[0];
      if (this.movementSystem.canMoveTo(movement.tileX, movement.tileZ, next.x, next.z)) {
        movement.targetX = next.x;
        movement.targetZ = next.z;
        movement.progress = 0;
        movement.moving = true;
        this.movePath.shift();
      } else {
        // Path blocked (dynamic obstacle?) — cancel
        this.movePath = [];
        this.moveGoal = null;
      }
      if (this.movePath.length === 0) {
        this.moveGoal = null;
      }
    } else {
      movement.queuedDx = 0;
      movement.queuedDz = 0;
    }
  }

  private tick(_dt: number) {
    if (!this.localEntityId) return;
    const pos = this.entityManager.getComponent<PositionComponent>(this.localEntityId, "position");
    if (pos) this.sendPositionUpdate(pos);
  }

  /** Pick entity near a screen coordinate using inverse iso projection + spatial query */
  private pickEntityAt(screenX: number, screenY: number): string | null {
    const wc = this.pixiApp.worldContainer;
    const zoom = this.camera.getZoom();
    // Convert screen coords to world-pixel coords
    const worldPxX = (screenX - wc.x) / zoom;
    const worldPxY = (screenY - wc.y) / zoom;
    // Convert to tile coords
    const { tileX, tileZ } = screenToWorld(worldPxX, worldPxY);
    const tx = Math.round(tileX);
    const tz = Math.round(tileZ);
    // Find closest entity within 2 tiles of clicked position
    const nearby = this.entityManager.getEntitiesInRadius(tx, tz, 2);
    let closest: string | null = null;
    let closestDist = Infinity;
    for (const entity of nearby) {
      if (entity.id === this.localEntityId) continue;
      const pos = entity.components.get("position") as PositionComponent | undefined;
      if (!pos) continue;
      const dist = Math.abs(pos.x - tileX) + Math.abs(pos.z - tileZ);
      if (dist < closestDist) {
        closestDist = dist;
        closest = entity.id;
      }
    }
    return closest;
  }

  selectTarget(entityId: string | null) {
    this.selectedTargetId = entityId;
    this.entityRenderer.setTargetEntity(entityId);
  }

  /** Tab-target: cycle through nearby entities sorted by distance */
  private cycleTarget() {
    if (!this.localEntityId) return;
    const pos = this.entityManager.getComponent<PositionComponent>(this.localEntityId, "position");
    if (!pos) return;

    const nearby = this.entityManager.getEntitiesInRadius(Math.round(pos.x), Math.round(pos.z), 32);
    const candidates: Array<{ id: string; dist: number }> = [];
    for (const entity of nearby) {
      if (entity.id === this.localEntityId) continue;
      const epos = entity.components.get("position") as PositionComponent | undefined;
      if (!epos) continue;
      candidates.push({ id: entity.id, dist: Math.abs(epos.x - pos.x) + Math.abs(epos.z - pos.z) });
    }
    candidates.sort((a, b) => a.dist - b.dist);
    if (candidates.length === 0) return;

    // Find current target index and advance to next
    const currentIdx = candidates.findIndex(c => c.id === this.selectedTargetId);
    const nextIdx = (currentIdx + 1) % candidates.length;
    this.selectTarget(candidates[nextIdx].id);
  }

  private handleLeftClick(sx: number, sy: number) {
    const entityId = this.pickEntityAt(sx, sy);
    if (entityId) {
      this.selectTarget(entityId);
      this.movePath = [];
      this.moveGoal = null;
      this.followTargetId = null;
    } else {
      this.followTargetId = null;
      this.selectTarget(null);
      const wc = this.pixiApp.worldContainer;
      const zoom = this.camera.getZoom();
      const worldPxX = (sx - wc.x) / zoom;
      const worldPxY = (sy - wc.y) / zoom;
      const { tileX, tileZ } = screenToWorld(worldPxX, worldPxY);
      const movement = this.localEntityId
        ? this.entityManager.getComponent<MovementComponent>(this.localEntityId, "movement")
        : null;
      if (movement) {
        this.computePath(movement.tileX, movement.tileZ, Math.round(tileX), Math.round(tileZ));
      }
    }
  }

  private handleRightClick(sx: number, sy: number) {
    const entityId = this.pickEntityAt(sx, sy);
    if (entityId) {
      this.selectTarget(entityId);
      // Check if already in melee range (1 tile)
      const myPos = this.localEntityId
        ? this.entityManager.getComponent<PositionComponent>(this.localEntityId, "position")
        : null;
      const targetPos = this.entityManager.getComponent<PositionComponent>(entityId, "position");
      if (myPos && targetPos) {
        const dist = Math.max(Math.abs(myPos.x - targetPos.x), Math.abs(myPos.z - targetPos.z));
        if (dist <= 1.5) {
          this.sendAutoAttackToggle(entityId);
          this.followTargetId = null;
        } else {
          // Too far — walk toward target, attack when in range
          this.followTargetId = entityId;
          const movement = this.entityManager.getComponent<MovementComponent>(this.localEntityId!, "movement");
          if (movement) {
            this.computePath(movement.tileX, movement.tileZ, Math.round(targetPos.x), Math.round(targetPos.z));
          }
        }
      }
    } else {
      this.selectTarget(null);
      this.followTargetId = null;
      const wc = this.pixiApp.worldContainer;
      const zoom = this.camera.getZoom();
      const worldPxX = (sx - wc.x) / zoom;
      const worldPxY = (sy - wc.y) / zoom;
      const { tileX, tileZ } = screenToWorld(worldPxX, worldPxY);
      const movement = this.localEntityId
        ? this.entityManager.getComponent<MovementComponent>(this.localEntityId, "movement")
        : null;
      if (movement) {
        this.computePath(movement.tileX, movement.tileZ, Math.round(tileX), Math.round(tileZ));
      }
    }
  }

  /** Compute A* path and store in movePath queue */
  private computePath(fromX: number, fromZ: number, toX: number, toZ: number) {
    const canWalk = (x: number, z: number) => this.movementSystem.canMoveTo(fromX, fromZ, x, z) ||
      (x === fromX && z === fromZ); // Start is always valid
    // Use proper walkability check for all tiles
    const walkable = (x: number, z: number) => {
      if (this.useTiledMap && this.tiledMap) {
        return this.tiledMap.isWalkable(Math.round(x), Math.round(z));
      }
      return true;
    };
    this.movePath = findPath(fromX, fromZ, toX, toZ, walkable);
    this.moveGoal = this.movePath.length > 0 ? { x: toX, z: toZ } : null;
  }

  private loadingOverlay: HTMLElement | null = null;

  private showLoadingOverlay(zoneName: string): void {
    this.loadingOverlay = document.createElement("div");
    this.loadingOverlay.style.cssText = `
      position: fixed; top: 0; left: 0; width: 100%; height: 100%;
      background: #0a0a0a; display: flex; flex-direction: column;
      align-items: center; justify-content: center; z-index: 10000;
      font-family: monospace; color: #ccc; pointer-events: all;
    `;
    this.loadingOverlay.innerHTML = `
      <div style="font-size: 28px; color: #88ddff; margin-bottom: 16px;">${zoneName}</div>
      <div style="font-size: 14px; opacity: 0.6;">Loading...</div>
    `;
    document.body.appendChild(this.loadingOverlay);
  }

  private hideLoadingOverlay(): void {
    if (this.loadingOverlay) {
      // Fade out
      this.loadingOverlay.style.transition = "opacity 0.5s";
      this.loadingOverlay.style.opacity = "0";
      const el = this.loadingOverlay;
      setTimeout(() => el.remove(), 500);
      this.loadingOverlay = null;
    }
  }

  private getEntityName(entityId: string): string {
    const identity = this.entityManager.getComponent<IdentityComponent>(entityId, "identity");
    return identity?.name ?? "Unknown";
  }

  private abilityMap: Record<number, string> = {
    1: "defend", 2: "heal", 3: "fire", 4: "ice", 5: "shock",
  };
  private abilitySlotIndex: Record<string, number> = {
    defend: 0, heal: 1, fire: 2, ice: 3, shock: 4,
  };
  private abilityCooldowns = new Map<string, number>(); // abilityId -> expires timestamp

  private handleAbilityUse(slot: number) {
    const abilityId = this.abilityMap[slot];
    if (!abilityId) return;

    // Check local cooldown
    const now = Date.now();
    const expires = this.abilityCooldowns.get(abilityId) ?? 0;
    if (now < expires) {
      const remaining = Math.ceil((expires - now) / 1000);
      if (this.hud) this.hud.chatBox.addSystemMessage(`${abilityId} on cooldown (${remaining}s)`);
      return;
    }

    if (this.network?.isConnected()) {
      const payload: any = { abilityId };
      // Offensive abilities send current target
      if (abilityId === "fire" || abilityId === "ice" || abilityId === "shock") {
        if (!this.selectedTargetId) {
          if (this.hud) this.hud.chatBox.addSystemMessage("No target selected");
          return;
        }
        payload.targetId = this.selectedTargetId;
      }
      this.network.sendReliable(packReliable(Opcode.ACTION_USE, payload));
      if (this.hud) this.hud.chatBox.addSystemMessage(`Used ${abilityId}`);
    }
  }

  private handleToggleAutoAttack() {
    if (this.selectedTargetId) this.sendAutoAttackToggle(this.selectedTargetId);
  }

  sendAutoAttackToggle(targetId: string) {
    if (this.network?.isConnected()) {
      this.network.sendReliable(packReliable(Opcode.AUTO_ATTACK_TOGGLE, { targetId }));
    }
  }

  private updateHUD() {
    if (!this.hud || !this.localEntityId) return;
    const combat = this.entityManager.getComponent<CombatComponent>(this.localEntityId, "combat");
    const stats = this.entityManager.getComponent<StatsComponent>(this.localEntityId, "stats");
    if (combat) {
      this.hud.updateAutoAttack(combat.autoAttacking);
      this.hud.updateCombat(combat.inCombat);
      this.entityRenderer.setAutoAttacking(combat.autoAttacking);
    }
    if (stats) this.hud.updatePlayerHp(stats.hp, stats.maxHp, stats.mana, stats.maxMana, stats.stamina, stats.maxStamina);
    if (this.selectedTargetId) {
      const ts = this.entityManager.getComponent<StatsComponent>(this.selectedTargetId, "stats");
      const ti = this.entityManager.getComponent<IdentityComponent>(this.selectedTargetId, "identity");
      if (ts && ti) this.hud.updateTarget({ name: ti.name, hp: ts.hp, maxHp: ts.maxHp });
      else this.hud.updateTarget(null);
    } else this.hud.updateTarget(null);
  }

  private sendPositionUpdate(pos: PositionComponent) {
    if (!this.network?.isConnected()) return;
    const now = performance.now();
    if (now - this.lastPositionSend < POSITION_SEND_INTERVAL) return;
    this.lastPositionSend = now;
    this.positionSequence = (this.positionSequence + 1) & 0xFFFF;
    this.network.sendPosition(packPosition(0, pos.x, pos.y, pos.z, pos.rotation, this.positionSequence));
  }

  private characterName = "Player";

  setCharacterName(name: string) {
    this.characterName = name;
  }

  private createLocalPlayer(characterId: string) {
    this.localEntityId = characterId;
    this.entityRenderer.setLocalEntityId(characterId);
    this.entityManager.addEntity(characterId);
    this.entityManager.addComponent(characterId, createIdentity(characterId, this.characterName, "player", true));
    const tileX = Math.round(this.spawnPosition.x);
    const tileZ = Math.round(this.spawnPosition.z);
    const terrainY = this.chunkManager.getTerrainY(tileX, tileZ);
    this.entityManager.addComponent(characterId, createPosition(tileX + 0.5, terrainY, tileZ + 0.5));
    this.entityManager.addComponent(characterId, createMovement(PLAYER_SPEED, tileX, tileZ));
    this.entityManager.addComponent(characterId, createRenderable("player", "#4466aa", "#e8c4a0", "#2c1b0e"));
    this.entityManager.addComponent(characterId, createStats(10, 10, 10));
    this.entityManager.addComponent(characterId, createCombat("melee", 5, 2.0));
  }
}
