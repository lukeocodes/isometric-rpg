import {
  Scene,
  SceneActivationContext,
  TileMap,
  ImageSource,
  SpriteSheet,
  Actor,
  Keys,
  Engine,
  Vector,
  clamp,
} from "excalibur";
import { TILE, tileToWorld } from "../tile.js";
import { NetworkManager, Opcode } from "../net/NetworkManager.js";
import { PlayerActor } from "../actors/PlayerActor.js";
import { RemotePlayerActor } from "../actors/RemotePlayerActor.js";
import { computeWallPlacements, WALL_FRAME_PX, WALL_COLS, WALL_ROWS } from "../sprites/tilewall.js";

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

    // Ground tilemap
    const tilesetImg = new ImageSource("/assets/tilesets/summer forest.png");
    await tilesetImg.load();
    this.add(this.buildMap(tilesetImg));

    // Tree wall border (128×128 autotiles, rendered over the ground)
    const wallImg = new ImageSource("/assets/tilesets/summer forest tree wall 128x128.png");
    const canopyImg = new ImageSource("/assets/tilesets/summer forest tree wall canopy 128x128.png");
    await Promise.all([wallImg.load(), canopyImg.load()]);
    this.buildWallBorder(wallImg, canopyImg);

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

    if (this.heldDir) {
      const { dx, dy } = this.heldDir;
      const destCol = Math.floor((this.player.pos.x + dx) / TILE);
      const destRow = Math.floor((this.player.pos.y + dy) / TILE);
      if (this.isTilePassable(destCol, destRow)) {
        this.player.tryMove(dx, dy);
      }
    }

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

  // Which ground tiles are impassable (forest border, in TILE units)
  private forestTiles = new Set<string>();

  isTilePassable(col: number, row: number): boolean {
    return !this.forestTiles.has(`${col},${row}`);
  }

  private buildMap(img: ImageSource): TileMap {
    const map = new TileMap({
      rows: MAP_H, columns: MAP_W,
      tileWidth: TILE, tileHeight: TILE,
    });
    const sheet = SpriteSheet.fromImageSource({
      image: img,
      grid: { rows: 21, columns: 32, spriteWidth: TILE, spriteHeight: TILE },
    });
    const grass = sheet.getSprite(4, 0);
    // Fill entirely with grass — wall border drawn separately as sprites
    for (let r = 0; r < MAP_H; r++)
      for (let c = 0; c < MAP_W; c++)
        map.getTile(c, r)?.addGraphic(grass);
    return map;
  }

  // Wall border thickness in 128px wall-tile units.
  // 1 wall tile = WALL_FRAME_PX / TILE = 128/16 = 8 ground tiles.
  private readonly WALL_THICKNESS = 1; // wall tiles deep (= 8 ground tiles)

  private buildWallBorder(wallImg: ImageSource, canopyImg: ImageSource): void {
    const WALL_GT = WALL_FRAME_PX / TILE; // ground tiles per wall tile = 8

    // Wall tile sheet: 6 cols × 4 rows of 128×128 sprites
    const wallSheet = SpriteSheet.fromImageSource({
      image: wallImg,
      grid: { rows: WALL_ROWS, columns: WALL_COLS, spriteWidth: WALL_FRAME_PX, spriteHeight: WALL_FRAME_PX },
    });
    const canopySheet = SpriteSheet.fromImageSource({
      image: canopyImg,
      grid: { rows: WALL_ROWS, columns: WALL_COLS, spriteWidth: WALL_FRAME_PX, spriteHeight: WALL_FRAME_PX },
    });

    // Map is MAP_W × MAP_H ground tiles.
    // Wall tiles occupy the outermost WALL_THICKNESS wall-tile rows.
    // Wall grid size (in wall-tile units, ceiling to cover full map):
    const wCols = Math.ceil(MAP_W / WALL_GT);
    const wRows = Math.ceil(MAP_H / WALL_GT);

    // isForest in wall-tile coords
    const isForest = (wc: number, wr: number): boolean => {
      if (wc < 0 || wr < 0 || wc >= wCols || wr >= wRows) return true; // outside = forest
      return wc < this.WALL_THICKNESS || wc >= wCols - this.WALL_THICKNESS
          || wr < this.WALL_THICKNESS || wr >= wRows - this.WALL_THICKNESS;
    };

    const placements = computeWallPlacements(wCols, wRows, isForest);

    for (const { tileCol, tileRow, wallTile: [sc, sr] } of placements) {
      // World position: centre of this 128px tile
      const wx = tileCol * WALL_FRAME_PX + WALL_FRAME_PX / 2;
      const wy = tileRow * WALL_FRAME_PX + WALL_FRAME_PX / 2;

      // Ground layer wall actor (z-order: below player)
      const wallActor = new Actor({ x: wx, y: wy, z: -1 });
      wallActor.graphics.use(wallSheet.getSprite(sc, sr));
      this.add(wallActor);

      // Canopy layer actor (z-order: above player)
      const canopyActor = new Actor({ x: wx, y: wy, z: 10 });
      canopyActor.graphics.use(canopySheet.getSprite(sc, sr));
      this.add(canopyActor);

      // Mark ground tiles under this wall tile as impassable
      const gc0 = tileCol * WALL_GT;
      const gr0 = tileRow * WALL_GT;
      for (let dr = 0; dr < WALL_GT; dr++)
        for (let dc = 0; dc < WALL_GT; dc++)
          this.forestTiles.add(`${gc0 + dc},${gr0 + dr}`);
    }
  }
}
