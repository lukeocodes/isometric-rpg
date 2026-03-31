/**
 * WorldBuilderMode — client-side state machine for the in-game world builder.
 *
 * States:
 *   "off"      — WB mode inactive; no interception of clicks
 *   "idle"     — WB active; hover highlights pieces and shows tooltips
 *   "placing"  — A piece is attached to the cursor awaiting left-click placement
 *
 * Hover/selection uses tile-coordinate hit testing via WorkbenchStructureRenderer.
 * All persistence goes through REST calls to /api/world-builder/:zoneId.
 */

import { Graphics, Text, TextStyle } from "pixi.js";
import type { WallPiece } from "../renderer/StructureRenderer";
import type { WorkbenchStructureRenderer, TrackedPiece } from "../renderer/WorkbenchStructureRenderer";
import type { TiledMapRenderer } from "../renderer/TiledMapRenderer";
import type { PixiApp } from "../renderer/PixiApp";
import { screenToWorld, worldToScreen } from "../renderer/IsometricRenderer";

export type WBState = "off" | "idle" | "placing";

export interface WBPieceRef {
  piece: WallPiece;
  pieceIndex: number;
  source: "tiled" | "placed";
  dbId?: string;
}

export const PIECE_NAMES: Record<string, string> = {
  wall_left:       "Wall (NW)",
  wall_right:      "Wall (NE)",
  wall_corner:     "Corner Post",
  wall_left_door:  "Door (NW)",
  wall_right_door: "Door (NE)",
  wall_left_win:   "Window (NW)",
  wall_right_win:  "Window (NE)",
  stair_left:      "Stairs (L)",
  stair_right:     "Stairs (R)",
  floor:           "Floor",
};

export function pieceFriendlyName(piece: WallPiece): string {
  const mat  = piece.material.charAt(0).toUpperCase() + piece.material.slice(1);
  const type = PIECE_NAMES[piece.type] ?? piece.type;
  const elev = (piece.elevation ?? 0) > 0 ? ` [F${piece.elevation}]` : "";
  return `${mat} ${type}${elev}`;
}

export class WorldBuilderMode {
  private _state: WBState = "off";
  private renderer: WorkbenchStructureRenderer | null = null;
  private tiledMap: TiledMapRenderer | null = null;
  private pixiApp: PixiApp | null = null;
  private zoneId = "human-meadows";

  // Hover
  private hoveredPiece: WBPieceRef | null = null;
  private tooltipLabel: Text | null = null;
  private lastHoverTile = { x: -9999, z: -9999 };

  // Selection
  private selectedPieces: WBPieceRef[] = [];

  // Placement
  private placingPiece: WallPiece | null = null;
  private ghostTileX = 0;
  private ghostTileZ = 0;

  // Drag selection rect
  private dragGraphics: Graphics | null = null;
  private dragStartWorld: { x: number; z: number } | null = null;
  private isDragging = false;

  // Context menu
  private contextMenuEl: HTMLElement | null = null;

  // Callbacks wired by Game.ts
  onPlaced?:     (piece: WallPiece, tileX: number, tileZ: number) => Promise<void>;
  onDeleted?:    (ref: WBPieceRef) => Promise<void>;
  onDuplicated?: (ref: WBPieceRef) => void;

  // ─── Public API ───────────────────────────────────────────────────────────

  get state()    { return this._state; }
  get isActive() { return this._state !== "off"; }
  get isPlacing(){ return this._state === "placing"; }

  activate(
    renderer: WorkbenchStructureRenderer,
    tiledMap: TiledMapRenderer,
    pixiApp: PixiApp,
    zoneId: string,
  ): void {
    this._state = "idle";
    this.renderer = renderer;
    this.tiledMap = tiledMap;
    this.pixiApp  = pixiApp;
    this.zoneId   = zoneId;
    this.ensureTooltip();
    this.ensureDragRect();
  }

  deactivate(): void {
    this._state = "off";
    this.clearGhost();
    this.clearTooltip();
    this.clearContextMenu();
    this.renderer?.setHighlight(null);
    this.hoveredPiece    = null;
    this.selectedPieces  = [];
    this.placingPiece    = null;
    this.dragStartWorld  = null;
    this.isDragging      = false;
    if (this.dragGraphics) this.dragGraphics.clear();
  }

  getZoneId(): string { return this.zoneId; }

  // ─── Input handlers (called by Game.ts) ───────────────────────────────────

  /** Call on canvas pointermove. Returns true if event was consumed. */
  handleMouseMove(worldPxX: number, worldPxY: number): boolean {
    if (!this.isActive || !this.renderer) return false;

    const { tileX, tileZ } = screenToWorld(worldPxX, worldPxY);
    const tx = Math.round(tileX), tz = Math.round(tileZ);

    if (this._state === "placing") {
      if (tx !== this.ghostTileX || tz !== this.ghostTileZ) {
        this.ghostTileX = tx;
        this.ghostTileZ = tz;
        this.renderer.setGhost(this.placingPiece, tx, tz);
      }
      return true;
    }

    // Update drag rect if dragging
    if (this.dragStartWorld && this.isDragging) {
      this.drawDragRect(this.dragStartWorld.x, this.dragStartWorld.z, tileX, tileZ);
    }

    // Hover detection (only update when tile changes)
    if (tx === this.lastHoverTile.x && tz === this.lastHoverTile.z) return true;
    this.lastHoverTile = { x: tx, z: tz };

    const hit = this.renderer.hitTestPiece(worldPxX, worldPxY);
    if (hit) {
      const ref = trackedToRef(hit);
      this.hoveredPiece = ref;
      this.renderer.setHighlight(hit.pieceIndex, hit.source);
      this.showTooltip(ref);
    } else {
      if (this.hoveredPiece) {
        this.hoveredPiece = null;
        this.renderer.setHighlight(null);
        if (this.tooltipLabel) this.tooltipLabel.visible = false;
      }
    }
    return true;
  }

  /** Call on pointerdown (left button). Returns true if event was consumed. */
  handlePointerDown(worldPxX: number, worldPxY: number): boolean {
    if (!this.isActive || this._state === "placing") return this.isActive;
    const { tileX, tileZ } = screenToWorld(worldPxX, worldPxY);
    this.dragStartWorld = { x: tileX, z: tileZ };
    this.isDragging = false;
    return true;
  }

  /** Call on pointerup (left button). Returns true if event was consumed. */
  handlePointerUp(worldPxX: number, worldPxY: number): boolean {
    if (!this.isActive) return false;
    if (this.isDragging) {
      if (this.dragGraphics) this.dragGraphics.clear();
      this.dragStartWorld = null;
      this.isDragging = false;
      return true;
    }
    this.dragStartWorld = null;
    return false; // let handleLeftClick also fire
  }

  /** Call on left-click. Returns true if event was consumed. */
  handleLeftClick(worldPxX: number, worldPxY: number, metaKey: boolean): boolean {
    if (!this.isActive || !this.renderer) return false;

    const { tileX, tileZ } = screenToWorld(worldPxX, worldPxY);
    const tx = Math.round(tileX), tz = Math.round(tileZ);

    // Placement: drop the piece
    if (this._state === "placing") {
      if (this.placingPiece && this.onPlaced) {
        void this.onPlaced({ ...this.placingPiece }, tx, tz);
      }
      return true;
    }

    // Idle: hit-test and select/context-menu
    const hit = this.renderer.hitTestPiece(worldPxX, worldPxY);
    this.clearContextMenu();

    if (hit) {
      const ref = trackedToRef(hit);
      if (metaKey) {
        // Toggle in multi-select
        const i = this.selectedPieces.findIndex(
          p => p.pieceIndex === ref.pieceIndex && p.source === ref.source,
        );
        if (i >= 0) this.selectedPieces.splice(i, 1);
        else        this.selectedPieces.push(ref);
        this.renderer.setMultiHighlight(this.selectedPieces);
      } else {
        this.selectedPieces = [ref];
        this.showContextMenu(ref);
      }
    } else {
      this.selectedPieces = [];
      this.renderer.setHighlight(null);
    }
    return true; // always consume in WB mode
  }

  startPlacing(piece: WallPiece): void {
    this.placingPiece = { ...piece, tileX: 0, tileZ: 0 };
    this._state = "placing";
    this.clearContextMenu();
    this.hoveredPiece = null;
    this.renderer?.setHighlight(null);
  }

  cancelPlacing(): void {
    this.placingPiece = null;
    this._state = "idle";
    this.clearGhost();
  }

  // ─── Private ──────────────────────────────────────────────────────────────

  private ensureTooltip(): void {
    if (this.tooltipLabel || !this.pixiApp) return;
    this.tooltipLabel = new Text({
      text: "",
      style: new TextStyle({
        fill: "#ffffff",
        fontSize: 11,
        fontFamily: "monospace",
        stroke: { color: "#000000", width: 3 },
      }),
    });
    this.tooltipLabel.zIndex  = 99_999;
    this.tooltipLabel.visible = false;
    this.pixiApp.worldContainer.addChild(this.tooltipLabel);
  }

  private ensureDragRect(): void {
    if (this.dragGraphics || !this.pixiApp) return;
    this.dragGraphics = new Graphics();
    this.dragGraphics.zIndex = 98_000;
    this.pixiApp.worldContainer.addChild(this.dragGraphics);
  }

  private clearGhost(): void {
    this.renderer?.setGhost(null, 0, 0);
  }

  private clearTooltip(): void {
    if (this.tooltipLabel) {
      this.tooltipLabel.parent?.removeChild(this.tooltipLabel);
      this.tooltipLabel.destroy();
      this.tooltipLabel = null;
    }
    if (this.dragGraphics) {
      this.dragGraphics.parent?.removeChild(this.dragGraphics);
      this.dragGraphics.destroy();
      this.dragGraphics = null;
    }
  }

  private showTooltip(ref: WBPieceRef): void {
    if (!this.tooltipLabel) return;
    this.tooltipLabel.text = pieceFriendlyName(ref.piece);
    const elev = ref.piece.elevation ?? 0;
    const { sx, sy } = worldToScreen(ref.piece.tileX, ref.piece.tileZ, elev);
    this.tooltipLabel.position.set(sx - this.tooltipLabel.width / 2, sy - 92);
    this.tooltipLabel.visible = true;
  }

  private drawDragRect(tx0: number, tz0: number, tx1: number, tz1: number): void {
    if (!this.dragGraphics) return;
    const dx = Math.abs(tx1 - tx0), dz = Math.abs(tz1 - tz0);
    if (dx < 0.5 && dz < 0.5) return;
    this.isDragging = true;
    this.dragGraphics.clear();
    const minX = Math.min(tx0, tx1), maxX = Math.max(tx0, tx1);
    const minZ = Math.min(tz0, tz1), maxZ = Math.max(tz0, tz1);
    const tl = worldToScreen(minX, minZ, 0);
    const tr = worldToScreen(maxX, minZ, 0);
    const br = worldToScreen(maxX, maxZ, 0);
    const bl = worldToScreen(minX, maxZ, 0);
    this.dragGraphics.poly([
      { x: tl.sx, y: tl.sy }, { x: tr.sx, y: tr.sy },
      { x: br.sx, y: br.sy }, { x: bl.sx, y: bl.sy },
    ]);
    this.dragGraphics.fill({ color: 0x44aaff, alpha: 0.08 });
    this.dragGraphics.poly([
      { x: tl.sx, y: tl.sy }, { x: tr.sx, y: tr.sy },
      { x: br.sx, y: br.sy }, { x: bl.sx, y: bl.sy },
    ]);
    this.dragGraphics.stroke({ width: 1.5, color: 0x44aaff, alpha: 0.9 });
  }

  private showContextMenu(ref: WBPieceRef): void {
    this.clearContextMenu();

    // Position near cursor using last known screen coords via hovered piece
    const elev = ref.piece.elevation ?? 0;
    const { sx: wsx, sy: wsy } = worldToScreen(ref.piece.tileX, ref.piece.tileZ, elev);
    // Convert world-px to screen px
    const wc   = this.pixiApp?.worldContainer;
    const zoom = this.pixiApp?.app.renderer ? 1 : 1; // use camera zoom if accessible
    const screenX = wsx * (wc ? 1 : 1) + (wc?.x ?? 0);
    const screenY = wsy + (wc?.y ?? 0) - 40;

    const el = document.createElement("div");
    el.style.cssText = `
      position: fixed;
      left: ${Math.min(screenX, window.innerWidth - 160)}px;
      top: ${Math.max(screenY - 80, 50)}px;
      background: rgba(12,16,28,0.97);
      border: 1px solid rgba(100,140,255,0.45);
      border-radius: 5px;
      padding: 4px 0;
      z-index: 10000;
      min-width: 150px;
      box-shadow: 0 6px 20px rgba(0,0,0,0.6);
      font-family: monospace;
      pointer-events: auto;
    `;

    const header = document.createElement("div");
    header.textContent = pieceFriendlyName(ref.piece);
    header.style.cssText = "padding: 5px 12px; color: #88aaff; font-size: 11px; border-bottom: 1px solid rgba(100,140,255,0.2); margin-bottom: 3px;";
    el.appendChild(header);

    this.addMenuBtn(el, "Pick Up",   () => {
      this.startPlacing({ ...ref.piece });
      if (this.onDeleted) void this.onDeleted(ref);
    });
    this.addMenuBtn(el, "Duplicate", () => {
      this.onDuplicated?.(ref);
    });
    this.addMenuBtn(el, "Delete",    () => {
      if (this.onDeleted) void this.onDeleted(ref);
      this.renderer?.removePiece(ref.pieceIndex, ref.source);
      this.hoveredPiece   = null;
      this.selectedPieces = [];
      if (this.tooltipLabel) this.tooltipLabel.visible = false;
    });

    document.body.appendChild(el);
    this.contextMenuEl = el;

    // Close on the NEXT pointerdown outside the menu.
    // Using pointerdown (rather than click) avoids the issue where the triggering
    // click's own events close the menu immediately on mouseup.
    // The timestamp guard drops any event that arrives within 150ms of the open.
    const openTime = performance.now();
    const close = (e: PointerEvent) => {
      if (performance.now() - openTime < 150) return;
      if (!el.contains(e.target as Node)) {
        this.clearContextMenu();
        document.removeEventListener("pointerdown", close, true);
      }
    };
    document.addEventListener("pointerdown", close, true);
  }

  private addMenuBtn(parent: HTMLElement, label: string, onClick: () => void): void {
    const btn = document.createElement("div");
    btn.textContent = label;
    btn.style.cssText = "padding: 7px 14px; color: #dde4f0; cursor: pointer; font-size: 12px; transition: background 0.1s;";
    btn.addEventListener("mouseenter", () => { btn.style.background = "rgba(100,140,255,0.18)"; });
    btn.addEventListener("mouseleave", () => { btn.style.background = ""; });
    btn.addEventListener("click",      (e) => { e.stopPropagation(); onClick(); this.clearContextMenu(); });
    parent.appendChild(btn);
  }

  clearContextMenu(): void {
    if (this.contextMenuEl) {
      this.contextMenuEl.remove();
      this.contextMenuEl = null;
    }
  }
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

function trackedToRef(tp: TrackedPiece): WBPieceRef {
  return { piece: tp.piece, pieceIndex: tp.pieceIndex, source: tp.source, dbId: tp.dbId };
}
