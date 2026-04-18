import {
  Scene,
  SceneActivationContext,
  TileMap,
  ImageSource,
  SpriteSheet,
  Keys,
  Engine,
  Vector,
  clamp,
} from "excalibur";
import { TILE, tileToWorld } from "../tile.js";
import { NetworkManager, Opcode } from "../net/NetworkManager.js";
import { PlayerActor } from "../actors/PlayerActor.js";
import { RemotePlayerActor } from "../actors/RemotePlayerActor.js";

const MAP_W = 40;
const MAP_H = 30;

export class GameScene extends Scene {
  private net: NetworkManager;
  private characterId: string;
  private player!: PlayerActor;
  private remotePlayers = new Map<string, RemotePlayerActor>();

  private lastSendTime = 0;
  private readonly SEND_HZ = 15;
  private heldDir: { dx: number; dy: number } | null = null;

  // In-game zoom range (camera.zoom units)
  private readonly ZOOM_MIN = 1;
  private readonly ZOOM_MAX = 6;
  private readonly ZOOM_DEFAULT = 3;
  private readonly ZOOM_STEP = 0.5;

  constructor(net: NetworkManager, characterId: string) {
    super();
    this.net = net;
    this.characterId = characterId;
  }

  override async onInitialize(engine: Engine): Promise<void> {
    this.net.setOnEvent((msg) => this.handleEvent(msg));
    this.net.setOnPosition((buf) => this.handlePositionUpdate(buf));

    // Tilemap — 16×16 tiles from the summer forest sheet
    const tilesetImg = new ImageSource("/assets/tilesets/summer forest.png");
    await tilesetImg.load();
    this.add(this.buildMap(tilesetImg));

    // Player — spawned at server tile position
    const spawnX = tileToWorld(this.net.spawn.x);
    const spawnY = tileToWorld(this.net.spawn.z);

    const spriteImg = new ImageSource("/assets/sprites/player.png");
    await spriteImg.load();

    this.player = new PlayerActor(spriteImg, spawnX, spawnY, this.characterId);
    this.add(this.player);

    // Camera
    this.camera.zoom = this.ZOOM_DEFAULT;
    this.camera.pos = new Vector(spawnX, spawnY);
    this.camera.strategy.lockToActor(this.player);

    // All zoom interception is scoped to the canvas element only —
    // does not affect browser chrome, OS zoom, or accessibility tools.
    const canvas = engine.canvas;

    // Ctrl/Cmd+wheel → in-game zoom (also blocks browser pinch-zoom on trackpads)
    canvas.addEventListener("wheel", (e: WheelEvent) => {
      e.preventDefault();
      if (e.ctrlKey || e.metaKey) {
        const delta = e.deltaY > 0 ? -this.ZOOM_STEP : this.ZOOM_STEP;
        this.camera.zoom = clamp(this.camera.zoom + delta, this.ZOOM_MIN, this.ZOOM_MAX);
      }
    }, { passive: false });

    // Ctrl/Cmd + / - / 0 on canvas → in-game zoom, block browser shortcut
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

    // iOS Safari gesture events on canvas
    canvas.addEventListener("gesturestart",  (e) => e.preventDefault(), { passive: false });
    canvas.addEventListener("gesturechange", (e) => e.preventDefault(), { passive: false });
    canvas.addEventListener("gestureend",    (e) => e.preventDefault(), { passive: false });

    // Double-tap zoom on canvas
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

    if (this.heldDir) this.player.tryMove(this.heldDir.dx, this.heldDir.dy);

    // Throttled position send
    const now = performance.now();
    if (now - this.lastSendTime > 1000 / this.SEND_HZ) {
      this.net.sendPosition(this.player.pos.x / TILE, 0, this.player.pos.y / TILE, this.player.rotation);
      this.lastSendTime = now;
    }
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

  private buildMap(img: ImageSource): TileMap {
    const map = new TileMap({
      rows: MAP_H, columns: MAP_W,
      tileWidth: TILE, tileHeight: TILE,
    });
    // summer forest.png: 512×336, 32 cols × 21 rows at 16×16
    const sheet = SpriteSheet.fromImageSource({
      image: img,
      grid: { rows: 21, columns: 32, spriteWidth: TILE, spriteHeight: TILE },
    });
    // col 4, row 0 = solid grass
    const grass = sheet.getSprite(4, 0);
    for (let r = 0; r < MAP_H; r++)
      for (let c = 0; c < MAP_W; c++)
        map.getTile(c, r)?.addGraphic(grass);
    return map;
  }
}
