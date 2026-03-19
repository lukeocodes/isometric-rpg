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

  private chunkManager: ChunkManager;

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
    this.stateSync = new StateSync(this.entityManager);

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
        if (combat) {
          combat.inCombat = inCombat;
          combat.autoAttacking = autoAttacking;
          combat.targetEntityId = targetId;
        }
      }
    });

    this.input.setOnLeftClick((sx, sy) => this.handleLeftClick(sx, sy));
    this.input.setOnRightClick((sx, sy) => this.handleRightClick(sx, sy));
    this.input.setOnToggleAutoAttack(() => this.handleToggleAutoAttack());
  }

  start(characterId?: string) {
    const id = characterId || "local-player";
    this.createLocalPlayer(id);
    this.stateSync.setLocalEntityId(id);
    this.chunkManager.updatePlayerPosition(this.spawnPosition.x, this.spawnPosition.z);
    this.sceneManager.scene.activeCamera = this.camera.camera;

    this.loop.onTick((dt) => this.tick(dt));
    this.loop.onRender((frameDt) => {
      this.movementSystem.update(frameDt);
      this.interpolationSystem.update(frameDt);
      if (this.localEntityId) {
        const pos = this.entityManager.getComponent<PositionComponent>(this.localEntityId, "position");
        if (pos) {
          this.camera.setTarget(new Vector3(pos.x, pos.y, pos.z));
          this.chunkManager.updatePlayerPosition(pos.x, pos.z);
        }
      }
      this.renderSystem.update(frameDt);

      // Dev mode: render spawn point markers
      if (import.meta.env.DEV && this.stateSync.spawnPoints.length > 0) {
        this.renderSystem.renderSpawnPoints(this.stateSync.spawnPoints);
      }
      this.animationSystem.update(frameDt);
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

  private spawnPosition = { x: 0, y: 0, z: 0 };

  stop() {
    this.loop.stop();
    this.network?.disconnect();
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
  }

  getInputManager() { return this.input; }
  getEntityManager() { return this.entityManager; }

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
        movement.targetX = movement.tileX + dx;
        movement.targetZ = movement.tileZ + dz;
        movement.progress = 0;
        movement.moving = true;
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
    this.entityManager.addComponent(characterId, createPosition(sx, 0, sz));
    this.entityManager.addComponent(characterId, createMovement(PLAYER_SPEED, sx, sz));
    this.entityManager.addComponent(characterId, createRenderable("player", "#4466aa", "#e8c4a0", "#2c1b0e"));
    this.entityManager.addComponent(characterId, createStats(10, 10, 10));
    this.entityManager.addComponent(characterId, createCombat("melee", 5, 2.0));
  }
}
