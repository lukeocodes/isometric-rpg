/**
 * Builder scene — walks the character around a user-authored map, renders
 * placed tiles, and handles placement / pickup / deletion / rotation via
 * mouse + keyboard.
 *
 * This scene is distinct from GameScene in that it:
 *   - Never hides cursor ghost
 *   - Talks to the server via BUILDER_* opcodes
 *   - Ignores NPC/combat events
 *   - Loads the current zone's TMX from `/api/maps/<mapFile>` — the server
 *     serves a frozen TMX from disk if it exists, otherwise synthesizes one
 *     from `user_map_tiles`. Either way plugin-tiled renders a normal map.
 */
import {
  Scene, SceneActivationContext,
  Engine, Keys, Vector, clamp, Loader,
  Actor, ImageSource,
} from "excalibur";
import { TiledResource } from "@excaliburjs/plugin-tiled";
import { NetworkManager, Opcode } from "../net/NetworkManager.js";
import { PlayerActor } from "../actors/PlayerActor.js";
import { TILE, tileToWorld } from "../tile.js";
import { TilesetIndex } from "./TilesetIndex.js";
import { TileOverlay, type PlacedTile } from "./TileOverlay.js";
import { BlockOverlay } from "./BlockOverlay.js";
import { TilePicker } from "./TilePicker.js";
import { BuilderHud } from "./BuilderHud.js";
import { PLAYER_Z, getLayer, listLayersByOrder, type LayerId } from "./registry/layers.js";
import { getTilesetDef } from "./registry/tilesets.js";

/** Cached ordered list of canonical layer ids. Sourced from the registry. */
const LAYER_NAMES: LayerId[] = listLayersByOrder().map((l) => l.id);
type LayerName = LayerId;

export class BuilderScene extends Scene {
  private net: NetworkManager;
  private characterId: string;
  private engineRef!: Engine;
  private player!: PlayerActor;
  private playerSpriteImg!: ImageSource;

  // Base map — served from `/api/maps/<mapFile>` (frozen TMX or DB-synth).
  private tiledMap: TiledResource | null = null;
  private mapCache = new Map<string, TiledResource>();
  private loading = false;

  // Overlay — user-placed tiles
  private tiles!: TilesetIndex;
  private overlay!: TileOverlay;
  private blocks!: BlockOverlay;

  // Builder state
  private currentMap = {
    numericId: 0, zoneId: "", name: "", width: 32, height: 32,
  };
  private brush: { tileset: string; tileId: number; rotation: number } | null = null;
  /** Tool mode. "place"/"erase" operate on tiles; "block" toggles collision
   *  blocks at the clicked cell (decoupled from tile placements). */
  private mode: "place" | "erase" | "block" = "place";
  private currentLayer: LayerName = "ground";
  private hoverTile = { x: -1, y: -1 };
  /** Currently-selected placed tile. When set, R rotates and Delete removes
   *  the tile in place; clicking an empty cell moves it. */
  private selected: { layer: string; x: number; y: number } | null = null;

  private picker!: TilePicker;
  private hud!: BuilderHud;

  // Zoom
  private readonly ZOOM_MIN = 1;
  private readonly ZOOM_MAX = 6;
  private readonly ZOOM_DEFAULT = 3;
  private readonly ZOOM_STEP = 0.5;

  // Movement (one-tile-at-a-time like GameScene)
  private heldDir: { dx: number; dy: number } | null = null;
  private lastSendTime = 0;
  private readonly SEND_HZ = 15;

  constructor(net: NetworkManager, characterId: string, tiles: TilesetIndex) {
    super();
    this.net = net;
    this.characterId = characterId;
    this.tiles = tiles;
  }

  override async onInitialize(engine: Engine): Promise<void> {
    this.engineRef = engine;

    this.playerSpriteImg = new ImageSource("/assets/sprites/player.png");
    await this.playerSpriteImg.load();

    // Load the current zone's TMX. `net.zone.mapFile` is the filename picked
    // by the server (e.g. `heaven.tmx`, `starter.tmx`); the API route serves
    // a frozen disk file if one exists, otherwise synthesizes from DB.
    const initialMap = this.net.zone.mapFile || "heaven.tmx";
    await this.loadBase(engine, initialMap);

    // Overlay is created once and lives for the scene's lifetime.
    this.overlay = new TileOverlay(this.tiles);
    this.add(this.overlay);
    this.blocks = new BlockOverlay();
    this.add(this.blocks as Actor);
    // In non-block modes, blocks render faded so they don't obscure tiles.
    this.blocks.setEmphasised(false);

    // Player z comes from the layer registry (between decor and walls).
    const spawnX = tileToWorld(this.net.spawn.x);
    const spawnY = tileToWorld(this.net.spawn.z);
    this.player = new PlayerActor(this.playerSpriteImg, spawnX, spawnY, this.characterId);
    this.player.z = PLAYER_Z;
    this.add(this.player);

    this.camera.zoom = this.ZOOM_DEFAULT;
    this.camera.pos  = new Vector(spawnX, spawnY);
    this.camera.strategy.lockToActor(this.player);

    // HUD + picker (already in the DOM).
    this.picker = new TilePicker(this.tiles);
    this.picker.setOnPick((entry) => {
      this.brush = { tileset: entry.tileset, tileId: entry.tileId, rotation: 0 };
      this.mode = "place";
      // Auto-switch to the tile's preferred layer (e.g. trees go to walls,
      // canopies go to canopy) so "walls should be walls" works without the
      // author having to manually flip layer buttons first.
      if (entry.defaultLayer && entry.defaultLayer !== this.currentLayer) {
        this.currentLayer = entry.defaultLayer;
        this.hud.setLayer(this.currentLayer);
      }
      this.hud.setMode(this.mode);
      this.hud.setBrush(this.tiles, this.brush);
    });
    this.hud = new BuilderHud();
    this.hud.setMode(this.mode);
    this.hud.setLayer(this.currentLayer);
    this.hud.setZone(this.net.zone.zoneName || "Heaven");
    this.hud.setOnTilesClick(() => this.picker.toggle());
    this.hud.setOnEraseToggle(() => this.toggleErase());
    this.hud.setOnBlocksToggle(() => this.toggleBlockMode());
    this.hud.setOnRotate(() => this.rotate());
    this.hud.setOnLayerChange((l) => { this.currentLayer = l as LayerName; this.hud.setLayer(l); });
    this.hud.setOnCmd((cmd) => this.runCommand(cmd));

    // Network listeners for builder events.
    this.net.setOnEvent((raw) => this.handleEvent(raw));

    // Request initial snapshot in case we connected mid-session.
    // (Server sends a snapshot automatically on WORLD_READY, but this covers
    // the case where the scene re-mounts.)
    // No-op here; the scene is created AFTER WORLD_READY so the snapshot has
    // already been dispatched to `onEvent` before our handler was attached.
    // We'll rely on the next snapshot (zone change) instead. For the first
    // load we ask the server explicitly:
    this.requestSnapshot();

    this.wireInput(engine);
  }

  override onActivate(_ctx: SceneActivationContext): void {}

  // ---------------------------------------------------------------------------
  // Network
  // ---------------------------------------------------------------------------

  private requestSnapshot(): void {
    // The server broadcasts BUILDER_MAP_SNAPSHOT on WORLD_READY and on
    // ZONE_CHANGE. We don't have a pull request for the snapshot yet; if the
    // server sent one before our handler was attached, we'll simply have an
    // empty overlay until the next mutation. That's acceptable for v1.
  }

  private handleEvent(raw: string): void {
    let msg: any;
    try { msg = JSON.parse(raw); } catch { return; }
    switch (msg.op) {
      case Opcode.BUILDER_MAP_SNAPSHOT: {
        this.currentMap.numericId = msg.numericId;
        this.currentMap.zoneId    = msg.zoneId;
        this.currentMap.name      = msg.name;
        this.currentMap.width     = msg.width;
        this.currentMap.height    = msg.height;
        this.hud.setZone(msg.name || msg.zoneId);
        this.overlay.reset(msg.tiles ?? []);
        this.blocks.reset(msg.blocks ?? []);
        // Snapshot may drop the player onto a newly-blocked cell; rescue.
        this.ensurePlayerSafe();
        break;
      }
      case Opcode.BUILDER_TILE_PLACED: {
        this.overlay.place(msg as PlacedTile);
        break;
      }
      case Opcode.BUILDER_TILE_REMOVED: {
        this.overlay.remove(msg.layer, msg.x, msg.y);
        // Drop selection if someone (including us) removed our selected cell.
        if (this.selected
            && this.selected.layer === msg.layer
            && this.selected.x === msg.x
            && this.selected.y === msg.y) {
          this.clearSelection();
        }
        break;
      }
      case Opcode.BUILDER_BLOCK_PLACED: {
        this.blocks.place(msg.x, msg.y);
        // If that block landed on our feet, bounce us out immediately.
        this.ensurePlayerSafe();
        break;
      }
      case Opcode.BUILDER_BLOCK_REMOVED: {
        this.blocks.remove(msg.x, msg.y);
        break;
      }
      case Opcode.BUILDER_MAPS_LIST: {
        this.hud.showToast(`Maps: ${(msg.maps ?? []).map((m: any) => `${m.numericId}=${m.name}`).join(", ") || "(none)"}`);
        break;
      }
      case Opcode.BUILDER_ERROR: {
        this.hud.showToast(`Builder error: ${msg.reason}`, true);
        break;
      }
      case Opcode.ZONE_CHANGE: {
        // Every zone has its own TMX now (served from `/api/maps/`). Swap
        // the base map and re-seat the player. The next BUILDER_MAP_SNAPSHOT
        // will repopulate the overlay for any tiles not baked into the TMX
        // yet (e.g. the last-second placements by another builder).
        const sx = tileToWorld(msg.spawnX ?? 0);
        const sy = tileToWorld(msg.spawnZ ?? 0);
        this.overlay.clear();
        this.blocks.clear();
        this.currentMap.zoneId = msg.zoneId ?? "";
        this.currentMap.name   = msg.zoneName ?? "";
        this.hud.setZone(msg.zoneName || msg.zoneId || "");
        this.net.zone.zoneId   = msg.zoneId   ?? "";
        this.net.zone.zoneName = msg.zoneName ?? "";
        this.net.zone.mapFile  = msg.mapFile  ?? "";
        const newMap = msg.mapFile;
        if (newMap && typeof newMap === "string") {
          this.loadBase(this.engineRef, newMap)
            .then(() => {
              this.player.teleport(sx, sy);
              this.camera.pos = new Vector(sx, sy);
            })
            .catch((err) => console.error(`[BuilderScene] loadBase("${newMap}") failed:`, err));
        } else {
          this.player.teleport(sx, sy);
          this.camera.pos = new Vector(sx, sy);
        }
        break;
      }
    }
  }

  // ---------------------------------------------------------------------------
  // Input
  // ---------------------------------------------------------------------------

  private wireInput(engine: Engine): void {
    const canvas = engine.canvas;
    // Excalibur installs its own pointer capture on the WebGL canvas, which
    // intercepts raw DOM `mousedown`/`mousemove` before they reach our
    // listeners. Use Excalibur's event bus instead so we get the click
    // regardless.
    const pointer = engine.input.pointers.primary;

    // Hover tile tracking — Excalibur already converts to world coords.
    pointer.on("move", (ev: unknown) => {
      const e = ev as { worldPos: Vector };
      const tx = Math.floor(e.worldPos.x / TILE);
      const ty = Math.floor(e.worldPos.y / TILE);
      if (tx !== this.hoverTile.x || ty !== this.hoverTile.y) {
        this.hoverTile = { x: tx, y: ty };
        this.updateHoverGhost();
      }
    });

    // Click handling. Semantics:
    //
    //   erase mode, any click       → remove topmost tile at cell
    //   place mode, has brush:
    //     empty cell                → place brush
    //     on placed tile            → overwrite with brush
    //   place mode, no brush, no selection:
    //     on placed tile            → select it (in place)
    //     empty cell                → nothing
    //   place mode, tile selected:
    //     on another placed tile    → switch selection
    //     on empty cell             → MOVE selected tile here
    //     on the selected cell      → deselect
    //
    // Pickup-to-brush is reachable via shift-click, which lifts the tile into
    // the brush and removes it from the world (useful for very long moves).
    pointer.on("down", (ev: unknown) => {
      const e = ev as { worldPos: Vector; button: string; nativeEvent: MouseEvent };
      if (e.button !== "Left") return;
      if (this.picker.isOpen()) return;
      if (this.hud.isCommandOpen()) return;
      const tx = Math.floor(e.worldPos.x / TILE);
      const ty = Math.floor(e.worldPos.y / TILE);
      if (tx < 0 || ty < 0 || tx >= this.currentMap.width || ty >= this.currentMap.height) return;

      if (this.mode === "erase") {
        this.eraseAt(tx, ty);
        return;
      }

      if (this.mode === "block") {
        // Toggle: click on empty cell places a block; click on a blocked
        // cell removes it. Blocks are 1×1 by design — the author can rapidly
        // click out the desired collision footprint.
        this.toggleBlockAt(tx, ty);
        return;
      }

      const topmost = this.overlay.topmostAt(tx, ty);
      const shiftKey = !!e.nativeEvent?.shiftKey;

      // Shift-click lifts a tile into the brush (legacy "pickup" flow).
      if (shiftKey && topmost) {
        this.clearSelection();
        this.brush = {
          tileset:  topmost.tileset,
          tileId:   topmost.tileId,
          rotation: topmost.rotation,
        };
        this.hud.setBrush(this.tiles, this.brush);
        this.sendRemove(topmost.layer, tx, ty);
        return;
      }

      // Place mode — brush path.
      if (this.brush) {
        // Brush overrides selection. Clicking a placed tile with a brush
        // overwrites; clicking an empty cell places. Selection is cleared
        // because the user is in "placing" intent.
        this.clearSelection();
        this.sendPlace(this.currentLayer, tx, ty);
        return;
      }

      // Place mode — selection path.
      if (topmost) {
        // Select whichever layer has the topmost tile (may differ from
        // currentLayer).
        this.setSelection(topmost.layer, tx, ty);
        return;
      }

      // Empty cell with no brush:
      if (this.selected) {
        // Move the selected tile here.
        this.moveSelectionTo(tx, ty);
      } else {
        // No-op (click on empty air, nothing to do).
      }
    });

    // Zoom — DOM wheel is fine because Excalibur doesn't preventDefault on it.
    canvas.addEventListener("wheel", (e: WheelEvent) => {
      e.preventDefault();
      if (e.ctrlKey || e.metaKey) {
        const delta = e.deltaY > 0 ? -this.ZOOM_STEP : this.ZOOM_STEP;
        this.camera.zoom = clamp(this.camera.zoom + delta, this.ZOOM_MIN, this.ZOOM_MAX);
      }
    }, { passive: false });

    // Keyboard shortcuts.
    window.addEventListener("keydown", (e: KeyboardEvent) => {
      // Don't hijack keys while typing into picker search or command bar.
      const active = document.activeElement as HTMLElement | null;
      if (active && (active.tagName === "INPUT" || active.tagName === "TEXTAREA")) return;

      // Zoom.
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

      // Bare keys.
      if (e.ctrlKey || e.metaKey || e.altKey || e.shiftKey) return;
      // If a modal (picker/command) is currently open we defer to its own
      // Escape handler and skip our own key handling so we don't double-
      // process the same keypress.
      if (this.picker.isOpen() || this.hud.isCommandOpen()) return;
      switch (e.key.toLowerCase()) {
        case "b": e.preventDefault(); this.picker.toggle();       return;
        case "e": e.preventDefault(); this.toggleErase();         return;
        case "k": e.preventDefault(); this.toggleBlockMode();     return;
        case "r": e.preventDefault(); this.rotate();              return;
        case "delete":
        case "backspace":
          e.preventDefault(); this.deleteSelection();             return;
        case "/": e.preventDefault(); this.hud.openCommand();     return;
        case "escape":
          if (this.mode === "block") { this.toggleBlockMode(); return; }
          if (this.mode === "erase") { this.toggleErase(); return; }
          if (this.selected) { this.clearSelection(); return; }
          if (this.brush)    { this.brush = null; this.hud.setBrush(this.tiles, null); return; }
          return;
      }
    });
  }

  private toggleErase(): void {
    this.mode = this.mode === "erase" ? "place" : "erase";
    if (this.mode === "erase") this.clearSelection();
    this.hud.setMode(this.mode);
    this.updateHoverGhost();
  }

  /** Cycle into / out of block mode. In block mode, tile ghosts are hidden
   *  and a blue collision-cell ghost follows the cursor instead. */
  private toggleBlockMode(): void {
    this.mode = this.mode === "block" ? "place" : "block";
    this.clearSelection();
    this.hud.setMode(this.mode);
    this.blocks.setEmphasised(this.mode === "block");
    this.updateHoverGhost();
  }

  private toggleBlockAt(x: number, y: number): void {
    if (this.blocks.hasBlock(x, y)) {
      this.net.sendEvent(Opcode.BUILDER_REMOVE_BLOCK, { x, y });
      this.blocks.remove(x, y); // optimistic
    } else {
      this.net.sendEvent(Opcode.BUILDER_PLACE_BLOCK,  { x, y });
      this.blocks.place(x, y); // optimistic
      // If we just blocked our own cell, bounce ourselves out.
      this.ensurePlayerSafe();
    }
  }

  /** Refresh cursor-tracking ghosts. The tile ghost (TileOverlay) is only
   *  shown in place/erase modes; the block ghost (BlockOverlay) is only
   *  shown in block mode. */
  private updateHoverGhost(): void {
    const { x, y } = this.hoverTile;
    if (this.mode === "block") {
      // Hide tile ghost, show block ghost.
      this.overlay.setGhost("place", null, -1, -1, this.currentLayer);
      const sub = this.blocks.hasBlock(x, y) ? "erase" : "place";
      this.blocks.setGhost(sub, x, y);
    } else {
      this.blocks.setGhost("off", -1, -1);
      this.overlay.setGhost(this.mode, this.brush, x, y, this.currentLayer);
    }
  }

  /** R key: rotates the selected tile in place if one is selected, otherwise
   *  rotates the brush. */
  private rotate(): void {
    if (this.selected) {
      const t = this.overlay.tileAt(this.selected.layer, this.selected.x, this.selected.y);
      if (!t) { this.clearSelection(); return; }
      const nextRot = ((t.rotation ?? 0) + 90) % 360;
      const updated = { ...t, rotation: nextRot };
      // Upsert via PLACE_TILE at the same cell with new rotation.
      this.net.sendEvent(Opcode.BUILDER_PLACE_TILE, {
        layer: updated.layer, x: updated.x, y: updated.y,
        tileset: updated.tileset, tileId: updated.tileId,
        rotation: nextRot, flipH: updated.flipH, flipV: updated.flipV,
      });
      this.overlay.place(updated);
      this.hud.setSelection(this.tiles, updated);
      return;
    }
    if (this.brush) {
      this.brush.rotation = (this.brush.rotation + 90) % 360;
      this.hud.setBrush(this.tiles, this.brush);
      this.overlay.setGhost(this.mode, this.brush, this.hoverTile.x, this.hoverTile.y, this.currentLayer);
    }
  }

  /** Delete/Backspace removes the current selection (if any). */
  private deleteSelection(): void {
    if (!this.selected) return;
    this.sendRemove(this.selected.layer, this.selected.x, this.selected.y);
    this.clearSelection();
  }

  // ---------------------------------------------------------------------------
  // Selection
  // ---------------------------------------------------------------------------

  private setSelection(layer: string, x: number, y: number): void {
    this.selected = { layer, x, y };
    this.overlay.setSelectionHighlight(x, y);
    this.hud.setSelection(this.tiles, this.overlay.tileAt(layer, x, y) ?? null);
  }

  private clearSelection(): void {
    if (!this.selected) return;
    this.selected = null;
    this.overlay.clearSelectionHighlight();
    this.hud.setSelection(this.tiles, null);
  }

  /** Move the selected tile to a new empty cell. Also moves the selection. */
  private moveSelectionTo(x: number, y: number): void {
    if (!this.selected) return;
    const t = this.overlay.tileAt(this.selected.layer, this.selected.x, this.selected.y);
    if (!t) { this.clearSelection(); return; }
    // Send remove at old cell, place at new cell (server upsert on the new
    // cell, delete on the old).
    const moved = { ...t, x, y };
    this.sendRemove(t.layer, t.x, t.y);
    this.net.sendEvent(Opcode.BUILDER_PLACE_TILE, {
      layer: moved.layer, x: moved.x, y: moved.y,
      tileset: moved.tileset, tileId: moved.tileId,
      rotation: moved.rotation, flipH: moved.flipH, flipV: moved.flipV,
    });
    this.overlay.place(moved);
    this.setSelection(moved.layer, x, y);
  }

  /** Collision is now driven exclusively by placed blocks (see BlockOverlay).
   *  Tile sprites are purely visual — a tree sprite may span 5×7 cells but
   *  only the cells the author explicitly blocks will stop movement. */
  private isCellBlocked(x: number, y: number): boolean {
    return this.blocks.hasBlock(x, y);
  }

  /**
   * BFS outward from (fromX, fromY) until an in-bounds, unblocked cell is
   * found. Used to rescue the player when they end up standing on a block
   * (someone placed on them; zone change spawned them in a wall; etc.).
   *
   * The returned cell is guaranteed to be INSIDE the current map — out-of-
   * bounds cells are never considered safe even if they're unblocked.
   * If the search origin itself is outside the map (e.g. after a resize or
   * a teleport bug), we clamp it into the map first, then BFS from the
   * closest in-bounds cell.
   *
   * Uses 4-neighbour Manhattan expansion so the "nearest" cell is the one
   * with the smallest tile-step distance. Capped at `maxRadius` to keep the
   * search O(N) in worst case; if that fails we fall back to an exhaustive
   * scan of the whole map (still O(W*H), fine for anything ≤256²).
   */
  private findNearestSafeCell(
    fromX: number, fromY: number,
    maxRadius = 64,
  ): { x: number; y: number } | null {
    const W = this.currentMap.width;
    const H = this.currentMap.height;
    if (W <= 0 || H <= 0) return null;

    const inBounds = (x: number, y: number) =>
      x >= 0 && y >= 0 && x < W && y < H;

    // Clamp the BFS origin into the map so we always expand from somewhere
    // valid. Also anchors "nearest" to the closest point on the map edge
    // when the player has slipped outside.
    const startX = Math.max(0, Math.min(W - 1, Math.floor(fromX)));
    const startY = Math.max(0, Math.min(H - 1, Math.floor(fromY)));

    if (!this.isCellBlocked(startX, startY)) {
      return { x: startX, y: startY };
    }

    const seen = new Set<string>([`${startX},${startY}`]);
    const queue: Array<{ x: number; y: number; d: number }> = [
      { x: startX, y: startY, d: 0 },
    ];
    while (queue.length > 0) {
      const { x, y, d } = queue.shift()!;
      if (d >= maxRadius) break;
      for (const [dx, dy] of [[1, 0], [-1, 0], [0, 1], [0, -1]] as const) {
        const nx = x + dx, ny = y + dy;
        const key = `${nx},${ny}`;
        if (seen.has(key)) continue;
        seen.add(key);
        if (!inBounds(nx, ny)) continue;                  // never step outside the map
        if (!this.isCellBlocked(nx, ny)) return { x: nx, y: ny };
        queue.push({ x: nx, y: ny, d: d + 1 });
      }
    }

    // Fallback: exhaustive scan for the closest in-bounds unblocked cell.
    // This only runs if `maxRadius` was exhausted AND every cell within that
    // radius is blocked. Rare, but prevents us from returning null when the
    // map genuinely has a walkable cell somewhere further away.
    let best: { x: number; y: number } | null = null;
    let bestD = Infinity;
    for (let y = 0; y < H; y++) {
      for (let x = 0; x < W; x++) {
        if (this.isCellBlocked(x, y)) continue;
        const d = Math.abs(x - startX) + Math.abs(y - startY);
        if (d < bestD) { bestD = d; best = { x, y }; }
      }
    }
    return best;
  }

  /**
   * Rescue the player when they end up in an unsafe cell:
   *   - standing on a block
   *   - standing outside the map bounds
   * Teleports them to the nearest in-bounds, unblocked cell and notifies
   * the server. No-op when the player is already on a walkable in-map cell.
   */
  private ensurePlayerSafe(): void {
    if (!this.player) return;
    const px = Math.floor(this.player.pos.x / TILE);
    const py = Math.floor(this.player.pos.y / TILE);
    const W = this.currentMap.width;
    const H = this.currentMap.height;
    const outOfBounds = px < 0 || py < 0 || px >= W || py >= H;
    if (!outOfBounds && !this.isCellBlocked(px, py)) return;

    const safe = this.findNearestSafeCell(px, py);
    if (!safe) {
      console.warn(`[Builder] No safe cell within map (${W}×${H}); staying put`);
      return;
    }
    const wx = safe.x * TILE + TILE / 2;
    const wy = safe.y * TILE + TILE / 2;
    this.player.teleport(wx, wy);
    // Keep the camera following the player.
    this.camera.pos = new Vector(wx, wy);
    // Push the new position to the server right away so it doesn't believe
    // we're still standing on the block.
    this.net.sendPosition(safe.x, 0, safe.y, this.player.rotation);
    const reason = outOfBounds ? "you were outside the map" : "block placed on your tile";
    this.hud.showToast(`Teleported to (${safe.x}, ${safe.y}) — ${reason}`);
  }

  /** Erase mode click — removes the topmost placed tile at (x, y). */
  private eraseAt(x: number, y: number): void {
    const t = this.overlay.topmostAt(x, y);
    if (!t) return;
    this.sendRemove(t.layer, t.x, t.y);
    if (this.selected && this.selected.layer === t.layer
        && this.selected.x === t.x && this.selected.y === t.y) {
      this.clearSelection();
    }
  }

  // ---------------------------------------------------------------------------
  // Commands
  // ---------------------------------------------------------------------------

  private runCommand(cmd: string): void {
    const parts = cmd.trim().replace(/^\//, "").split(/\s+/);
    const op = parts[0]?.toLowerCase();
    switch (op) {
      case "newmap": {
        const w = parseInt(parts[1] ?? "32", 10);
        const h = parseInt(parts[2] ?? "32", 10);
        const name = parts.slice(3).join(" ") || "Untitled";
        if (!Number.isFinite(w) || !Number.isFinite(h) || w < 8 || h < 8) {
          this.hud.showToast("Usage: /newmap <width> <height> [name]", true);
          return;
        }
        this.net.sendEvent(Opcode.BUILDER_NEW_MAP, { width: w, height: h, name });
        this.hud.showToast(`Creating ${w}×${h} "${name}"…`);
        break;
      }
      case "goto": {
        const t = parts[1]?.toLowerCase();
        if (t === "heaven") {
          this.net.sendEvent(Opcode.BUILDER_GOTO_MAP, { numericId: 500 });
          this.hud.showToast(`Going to heaven…`);
        } else {
          const n = parseInt(t ?? "", 10);
          if (Number.isFinite(n)) {
            this.net.sendEvent(Opcode.BUILDER_GOTO_MAP, { numericId: n });
            this.hud.showToast(`Going to map ${n}…`);
          } else {
            this.hud.showToast("Usage: /goto <numericId>  or  /goto heaven", true);
          }
        }
        break;
      }
      case "maps":
        this.net.sendEvent(Opcode.BUILDER_LIST_MAPS);
        break;
      case "layer":
        if (LAYER_NAMES.includes(parts[1] as LayerName)) {
          this.currentLayer = parts[1] as LayerName;
          this.hud.setLayer(this.currentLayer);
        } else {
          this.hud.showToast(`Layers: ${LAYER_NAMES.join(", ")}`, true);
        }
        break;
      case "help":
      case "?":
        this.hud.showToast("/newmap W H [name]  /goto <id|heaven>  /maps  /layer <name>");
        break;
      default:
        this.hud.showToast(`Unknown command: /${op}`, true);
    }
  }

  // ---------------------------------------------------------------------------
  // Sending placements / removals to the server
  // ---------------------------------------------------------------------------

  private sendPlace(layer: string, x: number, y: number): void {
    if (!this.brush) return;
    this.net.sendEvent(Opcode.BUILDER_PLACE_TILE, {
      layer,
      x, y,
      tileset:  this.brush.tileset,
      tileId:   this.brush.tileId,
      rotation: this.brush.rotation,
      flipH:    false,
      flipV:    false,
    });
    // Optimistic apply — the server will broadcast and confirm.
    this.overlay.place({
      layer, x, y,
      tileset: this.brush.tileset, tileId: this.brush.tileId,
      rotation: this.brush.rotation, flipH: false, flipV: false,
    });
  }

  private sendRemove(layer: string, x: number, y: number): void {
    this.net.sendEvent(Opcode.BUILDER_REMOVE_TILE, { layer, x, y });
    // Optimistic.
    this.overlay.remove(layer, x, y);
  }

  // ---------------------------------------------------------------------------
  // Per-frame — movement only (no combat, no NPCs)
  // ---------------------------------------------------------------------------

  override onPreUpdate(engine: Engine, _delta: number): void {
    if (this.loading || !this.player) return;
    if (this.picker.isOpen() || this.hud.isCommandOpen()) return;

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
      const tileX = Math.floor(destX / TILE);
      const tileY = Math.floor(destY / TILE);
      const inBounds =
        tileX >= 0 && tileY >= 0
        && tileX < this.currentMap.width
        && tileY < this.currentMap.height;
      if (inBounds && !this.isCellBlocked(tileX, tileY)) {
        this.player.tryMove(dx, dy);
      }
    }

    const now = performance.now();
    if (now - this.lastSendTime > 1000 / this.SEND_HZ) {
      this.net.sendPosition(
        this.player.pos.x / TILE, 0, this.player.pos.y / TILE, this.player.rotation,
      );
      this.lastSendTime = now;
    }
  }

  // ---------------------------------------------------------------------------
  // Base-map loading (served from /api/maps/<mapFile>)
  // ---------------------------------------------------------------------------

  private async loadBase(engine: Engine, mapFile: string): Promise<void> {
    this.loading = true;
    try {
      // Same URL contract as the game client: the server decides whether to
      // stream a frozen TMX off disk or synthesize one from `user_map_tiles`.
      const url = `/api/maps/${encodeURIComponent(mapFile)}`;

      // If the previous base belongs to a different zone, detach it from the
      // scene before swapping in the new one. Don't destroy cached resources
      // — plugin-tiled has no disposal API and loading fresh copies leaks
      // GPU textures.
      if (this.tiledMap && this.mapCache.get(url) !== this.tiledMap) {
        this.detachBase(this.tiledMap);
      }

      let tiledMap = this.mapCache.get(url);
      if (!tiledMap) {
        // NOTE: useTilemapCameraStrategy confines the camera to the map's
        // bounds — which means a zoomed-in view beyond the map edges clamps
        // weirdly. For the builder we want unconstrained camera so users can
        // pan past the edge while placing.
        tiledMap = new TiledResource(url, { useTilemapCameraStrategy: false });
        const loader = new Loader([tiledMap]);
        loader.suppressPlayButton = true;
        await engine.load(loader);
        this.mapCache.set(url, tiledMap);
      }
      tiledMap.addToScene(this);
      this.tiledMap = tiledMap;
    } finally {
      this.loading = false;
    }
  }

  /** Remove a TiledResource's actors from the scene without destroying the
   *  resource itself (so re-entering the zone doesn't re-upload textures). */
  private detachBase(tiled: TiledResource): void {
    for (const layer of tiled.layers) {
      const anyLayer = layer as unknown as {
        tilemap?:    { kill?: () => void };
        entities?:   Array<{ kill?: () => void }>;
        imageActor?: { kill?: () => void } | null;
      };
      if (anyLayer.tilemap)    this.remove(anyLayer.tilemap as any);
      if (anyLayer.imageActor) this.remove(anyLayer.imageActor as any);
      if (Array.isArray(anyLayer.entities)) {
        for (const e of anyLayer.entities) this.remove(e as any);
      }
    }
  }
}
