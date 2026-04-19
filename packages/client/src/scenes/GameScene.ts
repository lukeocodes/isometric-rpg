import {
  Scene,
  SceneActivationContext,
  ImageSource,
  Keys,
  Engine,
  Vector,
  clamp,
  Loader,
} from "excalibur";
import { TiledResource } from "@excaliburjs/plugin-tiled";
import { TILE, tileToWorld } from "../tile.js";
import { NetworkManager, Opcode } from "../net/NetworkManager.js";
import { PlayerActor } from "../actors/PlayerActor.js";
import { RemotePlayerActor } from "../actors/RemotePlayerActor.js";

export class GameScene extends Scene {
  private net: NetworkManager;
  private characterId: string;
  private player!: PlayerActor;
  private remotePlayers = new Map<string, RemotePlayerActor>();

  private lastSendTime = 0;
  private readonly SEND_HZ = 15;
  private heldDir: { dx: number; dy: number } | null = null;

  private readonly ZOOM_MIN     = 1;
  private readonly ZOOM_MAX     = 6;
  private readonly ZOOM_DEFAULT = 3;
  private readonly ZOOM_STEP    = 0.5;

  // TiledResource — loads TMX, tilesets, renders layers, wires collision
  private tiledMap!: TiledResource;

  constructor(net: NetworkManager, characterId: string) {
    super();
    this.net = net;
    this.characterId = characterId;
  }

  override async onInitialize(engine: Engine): Promise<void> {
    this.net.setOnEvent((msg) => this.handleEvent(msg));
    this.net.setOnPosition((buf) => this.handlePositionUpdate(buf));

    // Load TMX via plugin — handles tileset loading, layer rendering, collision
    this.tiledMap = new TiledResource("/maps/starter-area.tmx", {
      useTilemapCameraStrategy: true,
    });

    const loader = new Loader([this.tiledMap]);
    await engine.load(loader);

    // Add map layers to scene (ground, wall solid layer, canopy above player)
    this.tiledMap.addToScene(this);

    // Spawn player at the server-given position
    // (server spawns at tile 20,15 by default; use that if no spawn object found)
    const spawnX = tileToWorld(this.net.spawn.x || 20);
    const spawnY = tileToWorld(this.net.spawn.z || 15);

    const spriteImg = new ImageSource("/assets/sprites/player.png");
    await spriteImg.load();

    this.player = new PlayerActor(spriteImg, spawnX, spawnY, this.characterId);
    this.add(this.player);

    // Camera
    this.camera.zoom = this.ZOOM_DEFAULT;
    this.camera.pos  = new Vector(spawnX, spawnY);
    this.camera.strategy.lockToActor(this.player);

    // Zoom interception — scoped to canvas only
    const canvas = engine.canvas;

    canvas.addEventListener("wheel", (e: WheelEvent) => {
      e.preventDefault();
      if (e.ctrlKey || e.metaKey) {
        const delta = e.deltaY > 0 ? -this.ZOOM_STEP : this.ZOOM_STEP;
        this.camera.zoom = clamp(this.camera.zoom + delta, this.ZOOM_MIN, this.ZOOM_MAX);
      }
    }, { passive: false });

    canvas.addEventListener("keydown", (e: KeyboardEvent) => {
      if (e.ctrlKey || e.metaKey) {
        if (e.key === "=" || e.key === "+") {
          e.preventDefault();
          this.camera.zoom = clamp(this.camera.zoom + this.ZOOM_STEP, this.ZOOM_MIN, this.ZOOM_MAX);
        } else if (e.key === "-") {
          e.preventDefault();
          this.camera.zoom = clamp(this.camera.zoom - this.ZOOM_STEP, this.ZOOM_MIN, this.ZOOM_MAX);
        } else if (e.key === "0") {
          e.preventDefault();
          this.camera.zoom = this.ZOOM_DEFAULT;
        }
      }
    });

    canvas.addEventListener("gesturestart",  (e) => e.preventDefault(), { passive: false });
    canvas.addEventListener("gesturechange", (e) => e.preventDefault(), { passive: false });
    canvas.addEventListener("gestureend",    (e) => e.preventDefault(), { passive: false });

    let lastTouch = 0;
    canvas.addEventListener("touchend", (e) => {
      const now = Date.now();
      if (now - lastTouch <= 300) e.preventDefault();
      lastTouch = now;
    }, { passive: false });
  }

  override onActivate(_ctx: SceneActivationContext): void {}

  override onPreUpdate(engine: Engine, _delta: number): void {
    const kb = engine.input.keyboard;
    const up    = kb.isHeld(Keys.ArrowUp)    || kb.isHeld(Keys.W);
    const down  = kb.isHeld(Keys.ArrowDown)  || kb.isHeld(Keys.S);
    const left  = kb.isHeld(Keys.ArrowLeft)  || kb.isHeld(Keys.A);
    const right = kb.isHeld(Keys.ArrowRight) || kb.isHeld(Keys.D);

    if      (up)    this.heldDir = { dx: 0,     dy: -TILE };
    else if (down)  this.heldDir = { dx: 0,     dy:  TILE };
    else if (left)  this.heldDir = { dx: -TILE, dy: 0 };
    else if (right) this.heldDir = { dx:  TILE, dy: 0 };
    else            this.heldDir = null;

    if (this.heldDir) {
      const { dx, dy } = this.heldDir;
      // Check tile passability via the Tiled map's solid layer
      const destX = this.player.pos.x + dx;
      const destY = this.player.pos.y + dy;
      if (this.isPassable(destX, destY)) {
        this.player.tryMove(dx, dy);
      }
    }

    const now = performance.now();
    if (now - this.lastSendTime > 1000 / this.SEND_HZ) {
      this.net.sendPosition(this.player.pos.x / TILE, 0, this.player.pos.y / TILE, this.player.rotation);
      this.lastSendTime = now;
    }
  }

  private isPassable(worldX: number, worldY: number): boolean {
    // Ask the Tiled plugin's solid wall layer if this point is blocked
    const tile = this.tiledMap.getTileByPoint("wall", new Vector(worldX, worldY));
    if (!tile) return true; // outside map = let the map edges stop us
    return tile.exTile.solid === false || !tile.exTile.solid;
  }

  private handleEvent(raw: string): void {
    try {
      const msg = JSON.parse(raw);
      switch (msg.op) {
        case Opcode.ENTITY_SPAWN:
          if (msg.entityId !== this.characterId && msg.entityType === "player")
            this.spawnRemote(msg);
          break;
        case Opcode.ENTITY_DESPAWN:
          this.despawnRemote(msg.entityId);
          break;
      }
    } catch { /* ignore */ }
  }

  private handlePositionUpdate(_buf: ArrayBuffer): void {
    // Full state sync wired later
  }

  private spawnRemote(msg: { entityId: string; x: number; z: number }): void {
    if (this.remotePlayers.has(msg.entityId)) return;
    const remote = new RemotePlayerActor(tileToWorld(msg.x), tileToWorld(msg.z), msg.entityId);
    this.remotePlayers.set(msg.entityId, remote);
    this.add(remote);
  }

  private despawnRemote(entityId: string): void {
    const actor = this.remotePlayers.get(entityId);
    if (actor) { actor.kill(); this.remotePlayers.delete(entityId); }
  }
}
