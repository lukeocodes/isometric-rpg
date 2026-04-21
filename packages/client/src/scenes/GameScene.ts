import {
  Scene,
  SceneActivationContext,
  ImageSource,
  Keys,
  Engine,
  Vector,
  clamp,
  Loader,
  Entity,
  Actor,
  TileMap,
} from "excalibur";
import { TiledResource } from "@excaliburjs/plugin-tiled";
import { TILE, tileToWorld } from "../tile.js";
import { NetworkManager, Opcode } from "../net/NetworkManager.js";
import { PlayerActor } from "../actors/PlayerActor.js";
import { RemotePlayerActor } from "../actors/RemotePlayerActor.js";

// Heaven is currently the only map. The server always sends `zone.mapFile`
// on SPAWN_ACCEPTED, so this fallback is only used if the server forgot.
const FALLBACK_TMX = "heaven.tmx";



export class GameScene extends Scene {
  private net: NetworkManager;
  private characterId: string;
  private engineRef!: Engine;
  private player!: PlayerActor;
  private playerSpriteImg!: ImageSource;
  private remotePlayers = new Map<string, RemotePlayerActor>();

  private lastSendTime = 0;
  private readonly SEND_HZ = 15;
  private heldDir: { dx: number; dy: number } | null = null;

  private readonly ZOOM_MIN     = 1;
  private readonly ZOOM_MAX     = 6;
  private readonly ZOOM_DEFAULT = 3;
  private readonly ZOOM_STEP    = 0.5;

  /** TiledResource for the current zone. */
  private tiledMap: TiledResource | null = null;

  /**
   * Cache of loaded TiledResource instances keyed by URL.
   * We never unload/dispose them — plugin-tiled v0.32 has no disposal API and
   * loading a second copy leaks GPU textures. Instead we load-once, cache, and
   * re-`addToScene()` on revisit.
   */
  private mapCache = new Map<string, TiledResource>();

  /** In-flight zone change flag — prevents input while we swap maps. */
  private loading = false;

  constructor(net: NetworkManager, characterId: string) {
    super();
    this.net = net;
    this.characterId = characterId;
  }

  override async onInitialize(engine: Engine): Promise<void> {
    this.engineRef = engine;
    this.net.setOnEvent((msg) => this.handleEvent(msg));
    this.net.setOnPosition((buf) => this.handlePositionUpdate(buf));

    // Preload the player sprite once — reused across zone changes.
    this.playerSpriteImg = new ImageSource("/assets/sprites/player.png");
    await this.playerSpriteImg.load();

    const tmx = this.net.zone.mapFile || FALLBACK_TMX;
    await this.loadMap(engine, tmx, this.net.spawn.x, this.net.spawn.z);

    this.wireInputEvents(engine);
  }

  override onActivate(_ctx: SceneActivationContext): void {}

  // ---------------------------------------------------------------------------
  // Map loading / unloading
  // ---------------------------------------------------------------------------

  /** Load a TMX file, add it to the scene, position the player. */
  private async loadMap(
    engine: Engine,
    mapFile: string,
    spawnTileX: number,
    spawnTileZ: number,
  ): Promise<void> {
    this.loading = true;
    try {
      // Every map goes through /api/maps/<filename>. The server serves a
      // frozen TMX from `public/maps/` if one exists, otherwise synthesizes
      // one on demand from `user_maps` + `user_map_tiles`. Same contract
      // either way — plugin-tiled can't tell the difference.
      const url = `/api/maps/${encodeURIComponent(mapFile)}`;

      // Detach the previous map's entities from the scene. Don't destroy the
      // TiledResource itself — keep it cached for instant re-entry without a
      // texture-leaking reload.
      if (this.tiledMap && this.tiledMap !== this.mapCache.get(url)) {
        this.detachMap(this.tiledMap);
      } else if (this.tiledMap) {
        this.detachMap(this.tiledMap);
      }

      // Drop remote players — server will re-announce them for the new zone.
      for (const remote of this.remotePlayers.values()) remote.kill();
      this.remotePlayers.clear();

      // Load or reuse the resource for this URL.
      let tiledMap = this.mapCache.get(url);
      if (!tiledMap) {
        tiledMap = new TiledResource(url, { useTilemapCameraStrategy: true });
        const loader = new Loader([tiledMap]);
        loader.suppressPlayButton = true;
        await engine.load(loader);
        this.mapCache.set(url, tiledMap);
      }

      tiledMap.addToScene(this);
      this.tiledMap = tiledMap;

      const spawnX = tileToWorld(spawnTileX);
      const spawnY = tileToWorld(spawnTileZ);

      if (!this.player) {
        this.player = new PlayerActor(this.playerSpriteImg, spawnX, spawnY, this.characterId);
        this.add(this.player);
      } else {
        this.player.pos = new Vector(spawnX, spawnY);
      }

      // Player is an actor we added, not part of the map — if the map re-added
      // actors from a cached ObjectLayer, make sure the player is still in the
      // scene (the detach removed all map entities, not the player).
      if (!this.isPlayerInScene()) {
        this.add(this.player);
      }

      this.camera.zoom = this.camera.zoom || this.ZOOM_DEFAULT;
      this.camera.pos  = new Vector(spawnX, spawnY);
      this.camera.strategy.lockToActor(this.player);
    } finally {
      this.loading = false;
    }
  }

  /** Remove the map's entities from the scene WITHOUT destroying resources. */
  private detachMap(tiled: TiledResource): void {
    for (const layer of tiled.layers) {
      const anyLayer = layer as unknown as {
        tilemap?:    TileMap;
        entities?:   Entity[];
        imageActor?: Actor | null;
      };
      if (anyLayer.tilemap)    this.remove(anyLayer.tilemap);
      if (anyLayer.imageActor) this.remove(anyLayer.imageActor);
      if (Array.isArray(anyLayer.entities)) {
        for (const e of anyLayer.entities) this.remove(e);
      }
    }
  }

  private isPlayerInScene(): boolean {
    if (!this.player) return false;
    return (this.actors as unknown as Entity[]).includes(this.player)
        || (this.entities as unknown as Entity[]).includes(this.player);
  }

  // ---------------------------------------------------------------------------
  // Input
  // ---------------------------------------------------------------------------

  private wireInputEvents(engine: Engine): void {
    const canvas = engine.canvas;

    canvas.addEventListener("wheel", (e: WheelEvent) => {
      e.preventDefault();
      if (e.ctrlKey || e.metaKey) {
        const delta = e.deltaY > 0 ? -this.ZOOM_STEP : this.ZOOM_STEP;
        this.camera.zoom = clamp(this.camera.zoom + delta, this.ZOOM_MIN, this.ZOOM_MAX);
      }
    }, { passive: false });

    // Zoom controls + test-zone teleport. Attached to window directly so they
    // fire regardless of canvas/body focus state.
    window.addEventListener("keydown", (e: KeyboardEvent) => {
      // Zoom
      if (e.ctrlKey || e.metaKey) {
        if (e.key === "=" || e.key === "+") {
          e.preventDefault();
          this.camera.zoom = clamp(this.camera.zoom + this.ZOOM_STEP, this.ZOOM_MIN, this.ZOOM_MAX);
          return;
        }
        if (e.key === "-") {
          e.preventDefault();
          this.camera.zoom = clamp(this.camera.zoom - this.ZOOM_STEP, this.ZOOM_MIN, this.ZOOM_MAX);
          return;
        }
        if (e.key === "0") {
          e.preventDefault();
          this.camera.zoom = this.ZOOM_DEFAULT;
          return;
        }
      }

      // (Test-zone teleport shortcuts 1-9 were removed — heaven is the only
      // zone right now. Wire new slots up here when more zones exist.)
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

  // ---------------------------------------------------------------------------
  // Per-frame update
  // ---------------------------------------------------------------------------

  override onPreUpdate(engine: Engine, _delta: number): void {
    if (this.loading || !this.player) return;
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
    if (!this.tiledMap) return true;
    // Ask the Tiled plugin's solid wall layer if this point is blocked.
    // Test zones don't have a "wall" layer (by design — they're walk-anywhere
    // preview rooms). In that case getTileByPoint returns null and we allow it.
    const tile = this.tiledMap.getTileByPoint("wall", new Vector(worldX, worldY));
    if (!tile) return true;
    return tile.exTile.solid === false || !tile.exTile.solid;
  }

  // ---------------------------------------------------------------------------
  // Network events
  // ---------------------------------------------------------------------------

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
        case Opcode.ZONE_CHANGE:
          this.onZoneChange(msg);
          break;
      }
    } catch { /* ignore */ }
  }

  private handlePositionUpdate(_buf: ArrayBuffer): void {
    // Full state sync wired later
  }

  private async onZoneChange(msg: {
    zoneId?: string; zoneName?: string; mapFile?: string;
    spawnX?: number; spawnZ?: number;
  }): Promise<void> {
    if (!msg.mapFile) { console.warn("[GameScene] ZONE_CHANGE missing mapFile"); return; }
    console.log(`[GameScene] zone change → ${msg.zoneName ?? msg.zoneId} (${msg.mapFile})`);
    this.net.zone.zoneId   = msg.zoneId   ?? "";
    this.net.zone.zoneName = msg.zoneName ?? "";
    this.net.zone.mapFile  = msg.mapFile;
    await this.loadMap(
      this.engineRef,
      msg.mapFile,
      msg.spawnX ?? 0,
      msg.spawnZ ?? 0,
    );
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
