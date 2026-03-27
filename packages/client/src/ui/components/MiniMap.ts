/**
 * Minimap — renders a zoomed-out view of surrounding terrain on a canvas.
 * Supports both procedural biome data (chunk-level) and Tiled map data (tile-level).
 * Shows player position as a white dot and NPC positions as red dots.
 */

// Tiled GID → RGB color (firstgid=1, so GID 1 = grass, etc.)
const TILED_COLORS: Record<number, [number, number, number]> = {
  1:  [77, 140, 60],     // grass
  2:  [160, 130, 80],    // dirt
  3:  [170, 170, 175],   // stone
  4:  [210, 190, 130],   // sand
  5:  [40, 80, 180],     // water
  6:  [15, 30, 90],      // deep_water
  7:  [50, 100, 40],     // forest_floor
  8:  [230, 230, 240],   // snow
  9:  [70, 90, 50],      // swamp
  10: [130, 120, 110],   // mountain_rock
  11: [180, 150, 100],   // path
  12: [55, 110, 45],     // grass_dark
};

// Biome colors for procedural world fallback
const BIOME_COLORS: [number, number, number][] = [
  [13, 26, 77],     // 0  deep_ocean
  [26, 51, 115],    // 1  shallow_ocean
  [194, 179, 128],  // 2  beach
  [77, 128, 51],    // 3  temperate_grassland
  [38, 102, 38],    // 4  temperate_forest
  [20, 71, 20],     // 5  dense_forest
  [31, 77, 46],     // 6  boreal_forest
  [115, 107, 102],  // 7  mountain
  [230, 230, 235],  // 8  snow_peak
  [140, 148, 128],  // 9  tundra
  [199, 173, 102],  // 10 desert
  [140, 128, 77],   // 11 scrubland
  [64, 77, 38],     // 12 swamp
  [102, 115, 77],   // 13 highland
  [102, 140, 64],   // 14 meadow
  [77, 107, 51],    // 15 river_valley
  [38, 64, 128],    // 16 river
  [31, 56, 122],    // 17 lake
];

const MINIMAP_SIZE = 160; // px
const MINIMAP_CHUNK_RADIUS = 8; // chunks around player (for procedural world)
const ZOOM_LEVELS = [24, 40, 64, 96]; // tile radii
const DEFAULT_ZOOM_INDEX = 1;

export class MiniMap {
  private canvas: HTMLCanvasElement | null = null;
  private ctx: CanvasRenderingContext2D | null = null;
  private biomeData: Uint8Array | null = null;
  private worldWidth = 900;
  private worldHeight = 900;
  private playerTileX = 0;
  private playerTileZ = 0;
  private entities: Array<{ x: number; z: number; type: string }> = [];
  private zoneExits: Array<{ tileX: number; tileZ: number; tileWidth: number; tileHeight: number }> = [];
  private zoomIndex = DEFAULT_ZOOM_INDEX;

  // Tiled map ground data (tile-level resolution)
  private tiledGround: number[] | null = null;
  private tiledWidth = 0;
  private tiledHeight = 0;

  setBiomeData(data: Uint8Array, width: number, height: number) {
    this.biomeData = data;
    this.worldWidth = width;
    this.worldHeight = height;
  }

  /** Set Tiled map ground layer data for tile-level minimap rendering */
  setTiledData(groundData: number[], width: number, height: number) {
    this.tiledGround = groundData;
    this.tiledWidth = width;
    this.tiledHeight = height;
  }

  private lastDrawTime = 0;

  updatePlayerPosition(worldX: number, worldZ: number) {
    this.playerTileX = Math.round(worldX);
    this.playerTileZ = Math.round(worldZ);
    // Throttle redraws to 4Hz — minimap doesn't need 60fps
    const now = performance.now();
    if (now - this.lastDrawTime > 250) {
      this.lastDrawTime = now;
      this.draw();
    }
  }

  updateEntities(entities: Array<{ x: number; z: number; type: string }>) {
    this.entities = entities;
  }

  setZoneExits(exits: Array<{ tileX: number; tileZ: number; tileWidth: number; tileHeight: number }>) {
    this.zoneExits = exits;
  }

  render(): HTMLElement {
    const container = document.createElement("div");
    container.style.cssText = `
      background: #0a0a14; border: 2px solid #333; border-radius: 50%;
      width: ${MINIMAP_SIZE + 4}px; height: ${MINIMAP_SIZE + 4}px;
      padding: 2px; position: relative; overflow: hidden;
    `;

    this.canvas = document.createElement("canvas");
    this.canvas.width = MINIMAP_SIZE;
    this.canvas.height = MINIMAP_SIZE;
    this.canvas.style.cssText = "border-radius: 50%; display: block; transform: rotate(45deg) scale(1.15);";
    this.ctx = this.canvas.getContext("2d")!;
    container.appendChild(this.canvas);

    // "N" indicator — points toward isometric north (upper-right)
    const north = document.createElement("div");
    north.textContent = "N";
    north.style.cssText = `
      position: absolute; top: 6px; right: 6px;
      font-size: 10px; color: #888; font-weight: 600;
    `;
    container.appendChild(north);

    // Zoom controls
    const btnStyle = `
      width: 20px; height: 20px; border-radius: 50%; border: 1px solid #555;
      background: rgba(20, 20, 30, 0.8); color: #aaa; font-size: 14px;
      cursor: pointer; display: flex; align-items: center; justify-content: center;
      pointer-events: auto; line-height: 1;
    `;
    const zoomIn = document.createElement("div");
    zoomIn.textContent = "+";
    zoomIn.style.cssText = `position: absolute; bottom: 6px; right: 6px; ${btnStyle}`;
    zoomIn.onclick = () => { this.zoomIndex = Math.min(this.zoomIndex + 1, ZOOM_LEVELS.length - 1); };
    container.appendChild(zoomIn);

    const zoomOut = document.createElement("div");
    zoomOut.textContent = "-";
    zoomOut.style.cssText = `position: absolute; bottom: 6px; right: 30px; ${btnStyle}`;
    zoomOut.onclick = () => { this.zoomIndex = Math.max(this.zoomIndex - 1, 0); };
    container.appendChild(zoomOut);

    return container;
  }

  // Reusable ImageData to avoid 102KB allocation every frame
  private cachedImageData: ImageData | null = null;

  private draw() {
    if (!this.ctx || !this.canvas) return;
    if (this.tiledGround) {
      this.drawTiled();
    } else if (this.biomeData) {
      this.drawProcedural();
    }
  }

  /** Draw minimap from Tiled ground tile data (tile-level resolution) */
  private drawTiled() {
    if (!this.ctx || !this.tiledGround) return;

    const ctx = this.ctx;
    const size = MINIMAP_SIZE;
    const radius = ZOOM_LEVELS[this.zoomIndex];
    const diameter = radius * 2 + 1;
    const pixPerTile = size / diameter;

    if (!this.cachedImageData) this.cachedImageData = ctx.createImageData(size, size);
    const data = this.cachedImageData.data;

    for (let py = 0; py < size; py++) {
      for (let px = 0; px < size; px++) {
        const tx = this.playerTileX - radius + Math.floor(px / pixPerTile);
        const tz = this.playerTileZ - radius + Math.floor(py / pixPerTile);

        let r = 10, g = 15, b = 40; // out of bounds = dark ocean
        if (tx >= 0 && tx < this.tiledWidth && tz >= 0 && tz < this.tiledHeight) {
          const gid = this.tiledGround[tz * this.tiledWidth + tx];
          const color = TILED_COLORS[gid] || [10, 15, 40];
          r = color[0];
          g = color[1];
          b = color[2];
        }

        const i = (py * size + px) * 4;
        data[i] = r;
        data[i + 1] = g;
        data[i + 2] = b;
        data[i + 3] = 255;
      }
    }

    ctx.putImageData(this.cachedImageData, 0, 0);
    this.drawOverlays(size, radius, diameter);
  }

  /** Draw minimap from procedural biome data (chunk-level resolution) */
  private drawProcedural() {
    if (!this.ctx || !this.biomeData) return;

    const ctx = this.ctx;
    const size = MINIMAP_SIZE;
    const radius = MINIMAP_CHUNK_RADIUS;
    const diameter = radius * 2 + 1;
    const pixPerChunk = size / diameter;
    const playerChunkX = Math.floor(this.playerTileX / 32);
    const playerChunkZ = Math.floor(this.playerTileZ / 32);

    if (!this.cachedImageData) this.cachedImageData = ctx.createImageData(size, size);
    const data = this.cachedImageData.data;

    for (let py = 0; py < size; py++) {
      for (let px = 0; px < size; px++) {
        const cx = playerChunkX - radius + Math.floor(px / pixPerChunk);
        const cz = playerChunkZ - radius + Math.floor(py / pixPerChunk);

        let r = 6, g = 6, b = 18;
        if (cx >= 0 && cx < this.worldWidth && cz >= 0 && cz < this.worldHeight) {
          const biome = this.biomeData[cz * this.worldWidth + cx];
          const color = BIOME_COLORS[biome] || BIOME_COLORS[0];
          r = color[0];
          g = color[1];
          b = color[2];
        }

        const i = (py * size + px) * 4;
        data[i] = r;
        data[i + 1] = g;
        data[i + 2] = b;
        data[i + 3] = 255;
      }
    }

    ctx.putImageData(this.cachedImageData, 0, 0);
    this.drawOverlays(size, radius, diameter);
  }

  /** Draw entity dots and player marker */
  private drawOverlays(size: number, radius: number, diameter: number) {
    if (!this.ctx) return;
    const ctx = this.ctx;
    const isTiled = !!this.tiledGround;

    for (const ent of this.entities) {
      let ex: number, ey: number;
      if (isTiled) {
        const etx = Math.round(ent.x);
        const etz = Math.round(ent.z);
        ex = ((etx - this.playerTileX + radius) / diameter) * size;
        ey = ((etz - this.playerTileZ + radius) / diameter) * size;
      } else {
        const ecx = Math.floor(ent.x / 32);
        const ecz = Math.floor(ent.z / 32);
        const playerChunkX = Math.floor(this.playerTileX / 32);
        const playerChunkZ = Math.floor(this.playerTileZ / 32);
        ex = ((ecx - playerChunkX + radius) / diameter) * size;
        ey = ((ecz - playerChunkZ + radius) / diameter) * size;
      }
      if (ex < 0 || ex >= size || ey < 0 || ey >= size) continue;

      ctx.fillStyle = ent.type === "player" ? "#00ff00" : "#ff4444";
      ctx.fillRect(Math.floor(ex) - 1, Math.floor(ey) - 1, 3, 3);
    }

    // Zone exit markers (purple diamonds)
    if (this.tiledGround) {
      for (const exit of this.zoneExits) {
        const ecx = exit.tileX + exit.tileWidth / 2;
        const ecz = exit.tileZ + exit.tileHeight / 2;
        const ex = ((ecx - this.playerTileX + radius) / diameter) * size;
        const ey = ((ecz - this.playerTileZ + radius) / diameter) * size;
        if (ex < 0 || ex >= size || ey < 0 || ey >= size) continue;
        ctx.fillStyle = "#8866ff";
        ctx.beginPath();
        ctx.moveTo(ex, ey - 4);
        ctx.lineTo(ex + 3, ey);
        ctx.lineTo(ex, ey + 4);
        ctx.lineTo(ex - 3, ey);
        ctx.closePath();
        ctx.fill();
      }
    }

    // Player dot (center)
    const center = size / 2;
    ctx.fillStyle = "#ffffff";
    ctx.fillRect(center - 2, center - 2, 5, 5);
    ctx.strokeStyle = "#000000";
    ctx.lineWidth = 1;
    ctx.strokeRect(center - 2, center - 2, 5, 5);
  }

  dispose() {
    this.canvas = null;
    this.ctx = null;
  }
}
