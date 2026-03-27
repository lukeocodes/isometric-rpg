import { Container, Sprite, Texture, Rectangle, ImageSource, Graphics } from "pixi.js";
import {
  worldToScreen,
  TILE_WIDTH_HALF,
  TILE_HEIGHT_HALF,
} from "./IsometricRenderer";

/** Tiled JSON types (subset we need) */
interface TiledMap {
  width: number;
  height: number;
  tilewidth: number;
  tileheight: number;
  layers: TiledLayer[];
  tilesets: TiledTilesetRef[];
  properties?: TiledProperty[];
}

type TiledLayer = TiledTileLayer | TiledObjectGroup;

interface TiledTileLayer {
  id: number;
  name: string;
  type: "tilelayer";
  width: number;
  height: number;
  data: number[];
  visible: boolean;
}

interface TiledObjectGroup {
  id: number;
  name: string;
  type: "objectgroup";
  objects: TiledObject[];
  visible: boolean;
}

interface TiledObject {
  id: number;
  name: string;
  type: string;
  x: number;
  y: number;
  width: number;
  height: number;
  properties?: TiledProperty[];
}

interface TiledProperty {
  name: string;
  type: string;
  value: string | number | boolean;
}

interface TiledTilesetRef {
  firstgid: number;
  source: string;
}

interface TiledTileset {
  name: string;
  tilewidth: number;
  tileheight: number;
  tilecount: number;
  columns: number;
  image: string;
  imagewidth: number;
  imageheight: number;
  tiles?: Array<{
    id: number;
    properties?: TiledProperty[];
  }>;
}

export interface SpawnPoint {
  name: string;
  tileX: number;
  tileZ: number;
  properties: Record<string, string | number | boolean>;
}

export interface SafeZone {
  name: string;
  tileX: number;
  tileZ: number;
  tileWidth: number;
  tileHeight: number;
  properties: Record<string, string | number | boolean>;
}

/**
 * Loads and renders a Tiled isometric map using PixiJS sprites.
 * Each tile is rendered as a sprite from the tileset texture.
 */
export class TiledMapRenderer {
  public container: Container;
  public mapWidth = 0;
  public mapHeight = 0;

  private groundData: number[] = [];
  private collisionData: number[] = [];
  private tileTextures: Texture[] = [];
  private tileSprites = new Map<string, Sprite>();
  private tileWalkable = new Map<number, boolean>(); // tile ID -> walkable
  /** GID used for tiles beyond the map edge (deep water) */
  private borderTileGid = 6; // deep_water (firstgid=1 + localId=5)

  // Parsed objects from the map
  public spawnPoints: SpawnPoint[] = [];
  public safeZones: SafeZone[] = [];
  public zoneExits: Array<{ name: string; tileX: number; tileZ: number; tileWidth: number; tileHeight: number; exitId: string }> = [];
  public dungeonEntrances: Array<{ name: string; tileX: number; tileZ: number; tileWidth: number; tileHeight: number; difficulty: number; dungeonName: string }> = [];
  public playerSpawn = { x: 32, z: 32 }; // default center

  private lastCenterX = -Infinity;
  private lastCenterZ = -Infinity;
  private decoSprites = new Map<string, Graphics>();

  /** Tile name lookup (local ID -> name) for decoration placement */
  private tileNames = new Map<number, string>();

  /** Tiles rendered around the camera */
  private renderRadius = 20;

  constructor() {
    this.container = new Container();
    this.container.sortableChildren = true;
  }

  /** Load a Tiled map from a JSON URL (absolute or relative to origin) */
  async loadMap(mapUrl: string): Promise<void> {
    // Resolve to absolute URL for proper relative path resolution
    const baseUrl = new URL(mapUrl, window.location.href).href;

    const mapResponse = await fetch(baseUrl);
    const map: TiledMap = await mapResponse.json();

    this.mapWidth = map.width;
    this.mapHeight = map.height;

    // Load tileset(s)
    for (const tsRef of map.tilesets) {
      const tsjUrl = new URL(tsRef.source, baseUrl).href;
      const tsResponse = await fetch(tsjUrl);
      const tileset: TiledTileset = await tsResponse.json();

      // Load the tileset image via HTMLImageElement (avoids PixiJS Assets pipeline issues)
      const imgUrl = new URL(tileset.image, tsjUrl).href;
      const img = new Image();
      img.crossOrigin = "anonymous";
      await new Promise<void>((resolve, reject) => {
        img.onload = () => resolve();
        img.onerror = () => reject(new Error(`Failed to load tileset image: ${imgUrl}`));
        img.src = imgUrl;
      });
      const texture = Texture.from(img);

      // Cut individual tile textures from the sheet
      const { tilewidth, tileheight, columns, tilecount } = tileset;
      for (let i = 0; i < tilecount; i++) {
        const col = i % columns;
        const row = Math.floor(i / columns);
        const frame = new Rectangle(col * tilewidth, row * tileheight, tilewidth, tileheight);
        const tileTexture = new Texture({ source: texture.source, frame });
        // Store at the global ID (firstgid + local ID)
        this.tileTextures[tsRef.firstgid + i] = tileTexture;
      }

      // Parse walkability and find border tile from tileset properties
      if (tileset.tiles) {
        for (const tile of tileset.tiles) {
          const walkProp = tile.properties?.find((p) => p.name === "walkable");
          if (walkProp !== undefined) {
            this.tileWalkable.set(tsRef.firstgid + tile.id, walkProp.value as boolean);
          }
          const nameProp = tile.properties?.find((p) => p.name === "name");
          if (nameProp) {
            this.tileNames.set(tsRef.firstgid + tile.id, nameProp.value as string);
          }
          if (nameProp?.value === "deep_water") {
            this.borderTileGid = tsRef.firstgid + tile.id;
          }
        }
      }
    }

    // Parse layers
    for (const layer of map.layers) {
      if (layer.type === "tilelayer") {
        if (layer.name === "ground") {
          this.groundData = layer.data;
        } else if (layer.name === "collision") {
          this.collisionData = layer.data;
        }
      } else if (layer.type === "objectgroup" && layer.name === "objects") {
        this.parseObjects(layer.objects, map.tilewidth, map.tileheight);
      }
    }

    console.log(
      `[TiledMap] Loaded: ${this.mapWidth}x${this.mapHeight}, ` +
        `${this.spawnPoints.length} spawns, ${this.safeZones.length} safe zones, ` +
        `player spawn at (${this.playerSpawn.x}, ${this.playerSpawn.z})`,
    );
  }

  /**
   * Load a dungeon from raw data (no fetch needed — map data comes from server).
   * Reuses the tileset already loaded from a previous loadMap() call.
   */
  loadFromData(width: number, height: number, ground: number[], collision: number[]): void {
    // Clear existing tile sprites
    for (const [, sprite] of this.tileSprites) sprite.destroy();
    this.tileSprites.clear();
    for (const [, deco] of this.decoSprites) deco.destroy();
    this.decoSprites.clear();

    this.mapWidth = width;
    this.mapHeight = height;
    this.groundData = ground;
    this.collisionData = collision;
    this.spawnPoints = [];
    this.safeZones = [];
    this.zoneExits = [];
    this.dungeonEntrances = [];
    console.log(`[TiledMap] Loaded dungeon: ${width}x${height}`);
  }

  /** Get the raw ground tile data array (for minimap rendering) */
  getGroundData(): number[] { return this.groundData; }

  /** Check if a tile position is walkable */
  isWalkable(tileX: number, tileZ: number): boolean {
    if (tileX < 0 || tileX >= this.mapWidth || tileZ < 0 || tileZ >= this.mapHeight) {
      return false; // Out of bounds
    }
    const gid = this.groundData[tileZ * this.mapWidth + tileX];
    if (gid === 0) return false; // Empty tile
    const walkable = this.tileWalkable.get(gid);
    if (walkable === false) return false;

    // Check collision layer
    if (this.collisionData.length > 0) {
      const colGid = this.collisionData[tileZ * this.mapWidth + tileX];
      if (colGid !== 0) return false; // Collision tile present
    }

    return true;
  }

  /** Get tile ID at position (0 if out of bounds) */
  getTileAt(tileX: number, tileZ: number): number {
    if (tileX < 0 || tileX >= this.mapWidth || tileZ < 0 || tileZ >= this.mapHeight) {
      return 0;
    }
    return this.groundData[tileZ * this.mapWidth + tileX];
  }

  /** Update visible tiles around the camera center */
  update(centerX: number, centerZ: number): void {
    const cx = Math.floor(centerX);
    const cz = Math.floor(centerZ);

    if (cx === this.lastCenterX && cz === this.lastCenterZ) return;
    this.lastCenterX = cx;
    this.lastCenterZ = cz;

    const visibleKeys = new Set<string>();
    const r = this.renderRadius;

    for (let dz = -r; dz <= r; dz++) {
      for (let dx = -r; dx <= r; dx++) {
        if (Math.abs(dx) + Math.abs(dz) > r * 1.4) continue; // Diamond clip

        const tx = cx + dx;
        const tz = cz + dz;

        // Out-of-bounds: render deep water border
        const outOfBounds = tx < 0 || tx >= this.mapWidth || tz < 0 || tz >= this.mapHeight;
        const gid = outOfBounds ? this.borderTileGid : this.groundData[tz * this.mapWidth + tx];
        if (gid === 0) continue; // Empty

        const key = `${tx},${tz}`;
        visibleKeys.add(key);

        let sprite = this.tileSprites.get(key);
        const texture = this.tileTextures[gid];
        if (!texture) continue;

        if (!sprite) {
          sprite = new Sprite(texture);
          // Anchor at center-top of the diamond portion
          sprite.anchor.set(0.5, 32 / 48); // 32px is diamond center from top of 48px tile
          this.container.addChild(sprite);
          this.tileSprites.set(key, sprite);
        } else if (sprite.texture !== texture) {
          sprite.texture = texture;
        }

        const { sx, sy } = worldToScreen(tx, tz, 0);
        sprite.position.set(sx, sy);
        sprite.zIndex = (tx + tz) * 10;
        sprite.visible = true;

        // Decorations — place on certain tile types with seeded probability
        if (!outOfBounds && !this.decoSprites.has(key)) {
          const tileName = this.tileNames.get(gid);
          const hash = ((tx * 73856093) ^ (tz * 19349663)) >>> 0;
          const prob = (hash % 1000) / 1000;
          const deco = this.createDecoration(tileName, prob, hash);
          if (deco) {
            // Offset within tile for variety
            const offX = ((hash >> 8) % 20) - 10;
            const offY = ((hash >> 16) % 10) - 5;
            deco.position.set(sx + offX, sy + offY - 8);
            deco.zIndex = (tx + tz) * 10 + 5; // Above tile, below entities
            this.container.addChild(deco);
            this.decoSprites.set(key, deco);
          }
        }
        const deco = this.decoSprites.get(key);
        if (deco) deco.visible = true;
      }
    }

    // Hide tiles and decorations no longer visible
    for (const [key, sprite] of this.tileSprites) {
      if (!visibleKeys.has(key)) {
        sprite.visible = false;
      }
    }
    for (const [key, deco] of this.decoSprites) {
      if (!visibleKeys.has(key)) {
        deco.destroy();
        this.decoSprites.delete(key);
      }
    }
  }

  /** Create a small decorative graphic for a tile type (or null if no decoration) */
  private createDecoration(tileName: string | undefined, prob: number, hash: number): Graphics | null {
    if (!tileName) return null;
    const variant = hash % 3;

    if (tileName === "forest_floor" && prob < 0.45) {
      // Trees — triangular evergreen shapes
      const g = new Graphics();
      const h = 14 + (variant * 4);
      const w = 6 + (variant * 2);
      // Trunk
      g.roundRect(-1.5, -2, 3, 5, 1);
      g.fill(0x5a3a1a);
      // Canopy layers
      g.poly([{ x: 0, y: -h }, { x: w, y: -4 }, { x: -w, y: -4 }]);
      g.fill(variant === 0 ? 0x2a6e2a : variant === 1 ? 0x1a5a1a : 0x3a7a3a);
      g.poly([{ x: 0, y: -h + 4 }, { x: w - 1, y: -2 }, { x: -(w - 1), y: -2 }]);
      g.fill(variant === 0 ? 0x1a5a1a : variant === 1 ? 0x2a6e2a : 0x2a5a2a);
      return g;
    }

    if (tileName === "grass" && prob < 0.08) {
      // Occasional bush or flower
      const g = new Graphics();
      if (variant === 0) {
        // Small bush
        g.circle(0, -5, 5);
        g.fill(0x4a8a3a);
        g.circle(-3, -4, 3);
        g.fill(0x3a7a2a);
      } else {
        // Flowers (small dots)
        const colors = [0xee4444, 0xeeee44, 0xee44ee, 0x4488ee];
        g.circle(0, -3, 2);
        g.fill(colors[variant % 4]);
        g.circle(3, -2, 1.5);
        g.fill(colors[(variant + 1) % 4]);
      }
      return g;
    }

    if (tileName === "grass_dark" && prob < 0.2) {
      // Tall grass tufts
      const g = new Graphics();
      g.moveTo(-3, 0); g.lineTo(-2, -8); g.moveTo(0, 0); g.lineTo(1, -10); g.moveTo(3, 0); g.lineTo(2, -7);
      g.stroke({ width: 1.5, color: 0x3a6a2a, alpha: 0.7 });
      return g;
    }

    if (tileName === "swamp" && prob < 0.15) {
      // Reeds
      const g = new Graphics();
      g.moveTo(-2, 0); g.lineTo(-1, -12); g.moveTo(2, 0); g.lineTo(1, -10);
      g.stroke({ width: 1, color: 0x6a7a3a, alpha: 0.6 });
      // Cattail top
      g.ellipse(-1, -13, 1.5, 3);
      g.fill(0x5a4a2a);
      return g;
    }

    if (tileName === "sand" && prob < 0.05) {
      // Small rocks/pebbles
      const g = new Graphics();
      g.circle(0, -2, 3);
      g.circle(4, -1, 2);
      g.fill(0x9a8a6a);
      return g;
    }

    if (tileName === "snow" && prob < 0.06) {
      // Snow-covered rock
      const g = new Graphics();
      g.roundRect(-4, -6, 8, 6, 2);
      g.fill(0x888888);
      // Snow cap
      g.roundRect(-5, -8, 10, 3, 2);
      g.fill(0xddddee);
      return g;
    }

    if (tileName === "stone" && prob < 0.06) {
      const g = new Graphics();
      if (variant === 0) {
        // Market crate
        g.roundRect(-5, -8, 10, 8, 1);
        g.fill(0x8a6a3a);
        g.stroke({ width: 1, color: 0x5a4a2a });
        g.moveTo(-5, -4); g.lineTo(5, -4);
        g.stroke({ width: 0.5, color: 0x5a4a2a });
      } else if (variant === 1) {
        // Barrel
        g.ellipse(0, -3, 5, 4);
        g.fill(0x7a5a2a);
        g.stroke({ width: 1, color: 0x5a3a1a });
        g.moveTo(-5, -3); g.lineTo(5, -3);
        g.stroke({ width: 0.5, color: 0x4a3a1a });
      } else {
        // Stone pillar/lamp post
        g.roundRect(-2, -14, 4, 14, 1);
        g.fill(0x888888);
        g.stroke({ width: 0.5, color: 0x666666 });
        // Lamp light
        g.circle(0, -16, 3);
        g.fill(0xffdd66);
      }
      return g;
    }

    if (tileName === "path" && prob < 0.03) {
      // Occasional stone marker along paths
      const g = new Graphics();
      g.roundRect(-2, -6, 4, 6, 1);
      g.fill(0x999999);
      return g;
    }

    if (tileName === "dirt" && prob < 0.06) {
      // Small rocks on dirt
      const g = new Graphics();
      g.circle(0, -2, 2);
      g.circle(3, -1, 1.5);
      g.fill(0x7a6a5a);
      return g;
    }

    return null;
  }

  private parseObjects(objects: TiledObject[], tileW: number, tileH: number): void {
    for (const obj of objects) {
      const props: Record<string, string | number | boolean> = {};
      if (obj.properties) {
        for (const p of obj.properties) props[p.name] = p.value;
      }

      // Convert pixel coords to tile coords
      const tileX = Math.round(obj.x / tileW);
      const tileZ = Math.round(obj.y / tileH);

      if (obj.type === "spawn") {
        if (props.spawnType === "player") {
          this.playerSpawn = { x: tileX, z: tileZ };
        } else {
          this.spawnPoints.push({ name: obj.name, tileX, tileZ, properties: props });
        }
      } else if (obj.type === "zone_exit") {
        this.zoneExits.push({
          name: obj.name,
          tileX,
          tileZ,
          tileWidth: Math.round(obj.width / tileW),
          tileHeight: Math.round(obj.height / tileH),
          exitId: (props.exitId as string) || obj.name,
        });
      } else if (obj.type === "dungeon_entrance") {
        this.dungeonEntrances.push({
          name: obj.name,
          tileX,
          tileZ,
          tileWidth: Math.round(obj.width / tileW),
          tileHeight: Math.round(obj.height / tileH),
          difficulty: (props.difficulty as number) || 1,
          dungeonName: (props.dungeonName as string) || obj.name,
        });
      } else if (obj.type === "safe_zone" || obj.type === "zone") {
        this.safeZones.push({
          name: obj.name,
          tileX,
          tileZ,
          tileWidth: Math.round(obj.width / tileW),
          tileHeight: Math.round(obj.height / tileH),
          properties: props,
        });
      }
    }
  }

  dispose(): void {
    for (const sprite of this.tileSprites.values()) {
      sprite.destroy();
    }
    this.tileSprites.clear();
    this.container.destroy();
  }
}
