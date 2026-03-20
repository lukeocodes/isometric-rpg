import { Vector3 } from "@babylonjs/core/Maths/math.vector";
import "@babylonjs/core/Culling/ray"; // Required for scene.pick()

import { SceneManager } from "./SceneManager";
import { IsometricCamera } from "./IsometricCamera";
import { InputManager } from "./InputManager";
import { Loop } from "./Loop";
import { AssetCache } from "./AssetCache";
import { EntityManager } from "../ecs/EntityManager";
import { MovementSystem } from "../ecs/systems/MovementSystem";
import { RenderSystem } from "../ecs/systems/RenderSystem";
import { AnimationSystem } from "../ecs/systems/AnimationSystem";
import { InterpolationSystem } from "../ecs/systems/InterpolationSystem";
import { ChunkManager } from "../world/ChunkManager";
import { TilePool } from "../world/TilePool";
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
import WorldgenWorker from "../world/worldgen.worker?worker";

const PLAYER_SPEED = 3.0;
const POSITION_SEND_INTERVAL = 1000 / 15;

export class Game {
  private sceneManager: SceneManager;
  private camera: IsometricCamera;
  private input: InputManager;
  private loop: Loop;
  private assetCache: AssetCache;
  private canvas: HTMLCanvasElement;

  private entityManager: EntityManager;
  private movementSystem: MovementSystem;
  private renderSystem: RenderSystem;
  private animationSystem: AnimationSystem;
  private interpolationSystem: InterpolationSystem;
  private localEntityId: string | null = null;
  private onDisconnect: ((reason: string) => void) | null = null;
  private selectedTargetId: string | null = null;
  private hud: GameHUD | null = null;

  // Reusable objects to avoid per-frame allocations
  private cameraTarget = Vector3.Zero();
  private minimapEntities: Array<{ x: number; z: number; type: string }> = [];

  private chunkManager: ChunkManager;
  private tilePool: TilePool;

  private audioSystem: AudioSystem;
  private network: NetworkManager | null = null;
  private stateSync: StateSync;
  private positionSequence = 0;
  private lastPositionSend = 0;

  constructor(canvas: HTMLCanvasElement) {
    this.canvas = canvas;
    this.sceneManager = new SceneManager(canvas);
    this.camera = new IsometricCamera(this.sceneManager.scene, canvas);
    this.input = new InputManager(canvas);
    this.loop = new Loop();
    this.assetCache = new AssetCache();

    this.entityManager = new EntityManager();
    this.movementSystem = new MovementSystem(this.entityManager);
    this.renderSystem = new RenderSystem(this.entityManager, this.sceneManager.scene);
    this.animationSystem = new AnimationSystem(this.entityManager);
    this.interpolationSystem = new InterpolationSystem(this.entityManager);

    this.chunkManager = new ChunkManager(this.sceneManager.scene);
    this.tilePool = new TilePool(this.sceneManager.scene);
    this.stateSync = new StateSync(this.entityManager);

    // Initialize audio system
    this.audioSystem = new AudioSystem();
    this.audioSystem.init();

    this.stateSync.setOnDamage((attackerId, targetId, damage, weaponType) => {
      this.renderSystem.flashEntity(targetId, "#ff0000");
      this.renderSystem.showAttackLine(attackerId, targetId);
    });

    this.stateSync.setOnDeath((entityId) => {
      if (this.selectedTargetId === entityId) this.selectTarget(null);
      this.renderSystem.removeEntityMesh(entityId);
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
        // Drive music state machine — only on state *changes*
        const sm = this.audioSystem.getMusicStateMachine();
        if (sm) {
          if (inCombat && !wasInCombat) {
            sm.requestState(MusicState.Combat);
          } else if (!inCombat && wasInCombat) {
            sm.requestState(MusicState.Victory);
          }
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

    this.input.setOnLeftClick((sx, sy) => this.handleLeftClick(sx, sy));
    this.input.setOnRightClick((sx, sy) => this.handleRightClick(sx, sy));
    this.input.setOnToggleAutoAttack(() => this.handleToggleAutoAttack());
  }

  start(characterId?: string) {
    const id = characterId || "local-player";
    this.stateSync.setLocalEntityId(id);

    // Create player — world data already loaded in constructor
    this.createLocalPlayer(id);
    this.chunkManager.updatePlayerPosition(this.spawnPosition.x, this.spawnPosition.z);
    this.sceneManager.scene.activeCamera = this.camera.camera;

    this.loop.onTick((dt) => this.tick(dt));
    this.loop.onRender((frameDt) => {
      this.movementSystem.update(frameDt);
      this.interpolationSystem.update(frameDt);
      if (this.localEntityId) {
        const pos = this.entityManager.getComponent<PositionComponent>(this.localEntityId, "position");
        if (pos) {
          this.cameraTarget.set(pos.x, pos.y, pos.z);
          this.camera.setTarget(this.cameraTarget);
          this.chunkManager.updatePlayerPosition(pos.x, pos.z);
          this.tilePool.update(pos.x, pos.z);
          // Update minimap and world map
          if (this.hud) {
            this.hud.miniMap.updatePlayerPosition(pos.x, pos.z);
            this.hud.worldMap.updatePlayerPosition(pos.x, pos.z);
            // Feed entity positions to minimap (reuse array)
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
      this.renderSystem.update(frameDt);

      // Dev mode: render spawn point markers
      if (import.meta.env.DEV && this.stateSync.spawnPoints.length > 0) {
        this.renderSystem.renderSpawnPoints(this.stateSync.spawnPoints);
      }
      this.animationSystem.update(frameDt);
      this.audioSystem.update(frameDt);
      this.updateHUD();
      this.camera.update();
      this.sceneManager.render();
    });

    this.loop.start();
    this.canvas.focus();
  }

  async connectToServer(token: string, characterId: string) {
    this.network = new NetworkManager();
    this.network.setOnPositionMessage((data) => this.stateSync.handlePositionMessage(data));
    this.network.setOnReliableMessage((msg) => this.stateSync.handleReliableMessage(msg));
    this.network.setOnDisconnect((reason) => {
      if (this.onDisconnect) this.onDisconnect(reason);
    });

    await this.network.connect(token, characterId);
    console.log("WebRTC connected, waiting for world data...");
    await this.network.waitForWorldReady();
    console.log("World ready — all entities loaded");

    // Store spawn position for start()
    this.spawnPosition = this.network.spawnPosition;
  }

  /** Run worldgen in a web worker so the loading screen stays responsive */
  async generateWorldAsync(seed = 42): Promise<void> {
    console.log("[Game] Generating world map (worker)...");
    const start = performance.now();

    const { biomeMap, elevation } = await new Promise<{ biomeMap: Uint8Array; elevation: Float32Array }>((resolve, reject) => {
      const worker = new WorldgenWorker();
      worker.onmessage = (e: MessageEvent) => {
        resolve(e.data);
        worker.terminate();
      };
      worker.onerror = (err) => {
        reject(err);
        worker.terminate();
      };
      worker.postMessage({ seed });
    });

    this.chunkManager.setWorldData(biomeMap, elevation);
    console.log(`[Game] World map loaded in ${Math.round(performance.now() - start)}ms (worker)`);

    this.stateSync.setTerrainYResolver((x, z) => this.chunkManager.getTerrainY(x, z));
    this.movementSystem.setTerrainResolvers(
      (x, z) => this.chunkManager.getTerrainY(x, z),
      (x, z) => this.chunkManager.getElevationBandAt(x, z),
      (x, z) => this.chunkManager.isWalkable(x, z),
    );
    this.tilePool.setResolvers(
      (x, z) => this.chunkManager.getTerrainY(x, z),
      (x, z) => this.chunkManager.getBiomeAt(x, z),
    );
  }

  private spawnPosition = { x: 0, y: 0, z: 0 };

  stop() {
    this.loop.stop();
    this.network?.disconnect();
    this.audioSystem.dispose();
    this.tilePool.dispose();
    this.chunkManager.dispose();
    this.assetCache.clear();
    this.sceneManager.dispose();
  }

  setOnDisconnect(handler: (reason: string) => void) {
    this.onDisconnect = handler;
  }

  setHUD(hud: GameHUD) {
    this.hud = hud;
    hud.setOnAutoAttackToggle(() => this.handleToggleAutoAttack());

    // Pass biome data to minimap and world map
    const biomeData = this.chunkManager.getBiomeData();
    if (biomeData) {
      hud.miniMap.setBiomeData(biomeData, WORLD_WIDTH, WORLD_HEIGHT);
      hud.worldMap.setBiomeData(biomeData, WORLD_WIDTH, WORLD_HEIGHT);
    }

    // Wire settings menu volume changes to audio system + server persistence
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

    // M key toggles world map
    window.addEventListener("keydown", (e) => {
      if (e.code === "KeyM" && this.hud) {
        this.hud.worldMap.toggle();
      }
      if (e.code === "Escape" && this.hud?.worldMap.isVisible()) {
        this.hud.worldMap.toggle();
      }
    });
  }

  getInputManager() { return this.input; }
  getEntityManager() { return this.entityManager; }
  getAudioSystem(): AudioSystem { return this.audioSystem; }

  private tick(dt: number) {
    if (!this.localEntityId) return;
    const inputState = this.input.getState();
    const movement = this.entityManager.getComponent<MovementComponent>(this.localEntityId, "movement");
    if (!movement) return;

    let dx = 0, dz = 0;
    if (inputState.moveForward) { dz += 1; }
    if (inputState.moveBackward) { dz -= 1; }
    if (inputState.moveLeft) { dx -= 1; }
    if (inputState.moveRight) { dx += 1; }

    if (dx !== 0 || dz !== 0) {
      if (!movement.moving) {
        const tx = movement.tileX + dx;
        const tz = movement.tileZ + dz;
        if (this.movementSystem.canMoveTo(movement.tileX, movement.tileZ, tx, tz)) {
          movement.targetX = tx;
          movement.targetZ = tz;
          movement.progress = 0;
          movement.moving = true;
        }
      } else {
        movement.queuedDx = dx;
        movement.queuedDz = dz;
      }
    } else {
      movement.queuedDx = 0;
      movement.queuedDz = 0;
    }

    const pos = this.entityManager.getComponent<PositionComponent>(this.localEntityId, "position");
    if (pos) this.sendPositionUpdate(pos);
  }

  private pickEntityAt(screenX: number, screenY: number): string | null {
    const pick = this.sceneManager.scene.pick(screenX, screenY);
    if (pick?.hit && pick.pickedMesh) {
      let parentName = pick.pickedMesh.name;
      if (pick.pickedMesh.parent) parentName = pick.pickedMesh.parent.name;
      const match = parentName.match(/^body_(.+)$/);
      if (match && match[1] !== this.localEntityId) return match[1];
    }
    return null;
  }

  selectTarget(entityId: string | null) {
    this.selectedTargetId = entityId;
    this.renderSystem.setTargetEntity(entityId);
  }

  private handleLeftClick(sx: number, sy: number) { this.selectTarget(this.pickEntityAt(sx, sy)); }

  private handleRightClick(sx: number, sy: number) {
    const entityId = this.pickEntityAt(sx, sy);
    if (entityId) { this.selectTarget(entityId); this.sendAutoAttackToggle(entityId); }
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
      this.renderSystem.setAutoAttacking(combat.autoAttacking);
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

  private createLocalPlayer(characterId: string) {
    this.localEntityId = characterId;
    this.entityManager.addEntity(characterId);
    this.entityManager.addComponent(characterId, createIdentity(characterId, "Player", "player", true));
    const sx = this.spawnPosition.x;
    const sz = this.spawnPosition.z;
    // Compute player Y from terrain elevation so they stand on top of the ground
    const terrainY = this.chunkManager.getTerrainY(sx, sz);
    this.entityManager.addComponent(characterId, createPosition(sx, terrainY, sz));
    this.entityManager.addComponent(characterId, createMovement(PLAYER_SPEED, sx, sz));
    this.entityManager.addComponent(characterId, createRenderable("player", "#4466aa", "#e8c4a0", "#2c1b0e"));
    this.entityManager.addComponent(characterId, createStats(10, 10, 10));
    this.entityManager.addComponent(characterId, createCombat("melee", 5, 2.0));
  }
}
