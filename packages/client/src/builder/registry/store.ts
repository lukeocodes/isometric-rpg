/**
 * Registry store — single source of truth for categories / layers / tileset
 * definitions / sub-regions / per-tile overrides. ALL data comes from the
 * server at `/api/builder/registry` (see AGENTS.md "Data in the Database").
 *
 * Call `loadRegistry()` before any getter; `TilesetIndex.load()` awaits
 * this during boot. Once loaded, getters are synchronous.
 *
 * Overrides (builder-authored per-tile metadata) ALSO live on the server.
 * `setOverride` / `clearOverride` POST/DELETE to `/api/builder/overrides`
 * and update the in-memory cache optimistically. (WebRTC broadcast so
 * other builder sessions see edits live is Phase 1b.)
 *
 * Type definitions for CategoryDef / LayerDef / TilesetDef / SubRegion /
 * TileOverride live in the sibling files as pure contracts — no data
 * lives in those files any more.
 */
import type { CategoryDef, CategoryId }       from "./categories.js";
import type { LayerDef, LayerId }             from "./layers.js";
import type { TilesetDef, SubRegion }         from "./tilesets.js";
import type { TileOverride }                  from "./overrides.js";
import type { MapItemTypeDef, MapItemKind }   from "./map-items.js";

/** Extended tileset definition returned by the server. Includes the
 *  structural fields ingested from TSX so the client doesn't need to
 *  fetch/parse TSX files at all — just the PNGs. */
export interface RemoteTilesetDef extends TilesetDef {
  /** Display name from the TSX `<tileset name=>`. */
  name: string;
  /** Tile width in pixels. */
  tilewidth: number;
  /** Tile height in pixels. */
  tileheight: number;
  /** Number of tile columns. */
  columns: number;
  /** Total tile count. */
  tilecount: number;
  /** Resolved image URL, e.g. `/maps/test-zones/foo/bar.png`. */
  imageUrl: string;
  /** Image dimensions in pixels. */
  imageWidth: number;
  imageHeight: number;
  /** Tile IDs that are fully transparent (skip them in the picker). */
  emptyTiles: number[];
  /** Animations keyed by head tile id, ordered by frame_idx. */
  animations: Record<number, Array<{ tileId: number; duration: number }>>;
}

interface RegistryPayload {
  categories: CategoryDef[];
  layers:     LayerDef[];
  tilesets:   RemoteTilesetDef[];
  overrides:  Record<string, TileOverride>;
  mapItemTypes: MapItemTypeDef[];
}

// ---------------------------------------------------------------------------
// Module state
// ---------------------------------------------------------------------------

let categoriesList:   CategoryDef[]           = [];
let layersList:       LayerDef[]               = [];
let tilesetsList:     RemoteTilesetDef[]       = [];
let overridesMap:     Record<string, TileOverride> = {};
let mapItemTypesList: MapItemTypeDef[]         = [];
let categoriesById:   Map<CategoryId, CategoryDef>   = new Map();
let layersById:       Map<LayerId, LayerDef>         = new Map();
let tilesetsByFile:   Map<string, RemoteTilesetDef>  = new Map();
let mapItemsByKind:   Map<MapItemKind, MapItemTypeDef> = new Map();

let loadPromise: Promise<void> | null = null;

// ---------------------------------------------------------------------------
// Loader
// ---------------------------------------------------------------------------

/** Fetch and cache the full registry. Idempotent. Call from boot before
 *  anything that reads the registry. */
export function loadRegistry(baseUrl = ""): Promise<void> {
  if (!loadPromise) loadPromise = doLoad(baseUrl);
  return loadPromise;
}

async function doLoad(baseUrl: string): Promise<void> {
  const res = await fetch(`${baseUrl}/api/builder/registry`);
  if (!res.ok) throw new Error(`Registry fetch failed: ${res.status}`);
  const body = (await res.json()) as RegistryPayload;
  apply(body);
  console.log(
    `[Registry] Loaded ${categoriesList.length} categor(ies), ` +
    `${layersList.length} layer(s), ${tilesetsList.length} tileset(s), ` +
    `${mapItemTypesList.length} map-item type(s), ` +
    `${Object.keys(overridesMap).length} override(s)`,
  );
}

function apply(p: RegistryPayload): void {
  categoriesList   = p.categories;
  layersList       = p.layers;
  tilesetsList     = p.tilesets;
  overridesMap     = p.overrides;
  mapItemTypesList = p.mapItemTypes ?? [];

  categoriesById = new Map(categoriesList.map((c) => [c.id, c]));
  layersById     = new Map(layersList.map((l) => [l.id, l]));
  tilesetsByFile = new Map(tilesetsList.map((t) => [t.file, t]));
  mapItemsByKind = new Map(mapItemTypesList.map((m) => [m.kind, m]));
}

// ---------------------------------------------------------------------------
// Categories
// ---------------------------------------------------------------------------

export function listCategoriesByOrder(): CategoryDef[] {
  return [...categoriesList].sort((a, b) => a.order - b.order);
}

export function getCategory(id: CategoryId): CategoryDef | undefined {
  return categoriesById.get(id);
}

// ---------------------------------------------------------------------------
// Layers
// ---------------------------------------------------------------------------

export function listLayers(): LayerDef[] {
  return layersList;
}

export function listLayersByOrder(): LayerDef[] {
  return [...layersList].sort((a, b) => a.order - b.order);
}

export function getLayer(id: LayerId): LayerDef {
  const l = layersById.get(id);
  if (!l) throw new Error(`Unknown layer: ${id}`);
  return l;
}

/** Layer IDs sorted from topmost (drawn last) → bottom. Used by hit-testing
 *  so "erase" and "select" act on the visually topmost tile. */
export function layerHitOrder(): LayerId[] {
  return [...layersList].sort((a, b) => b.z - a.z).map((l) => l.id);
}

/** All layer IDs whose tiles block player movement. */
export function collidingLayers(): LayerId[] {
  return layersList.filter((l) => l.collides).map((l) => l.id);
}

// ---------------------------------------------------------------------------
// Tilesets
// ---------------------------------------------------------------------------

export function listTilesets(): RemoteTilesetDef[] {
  return tilesetsList;
}

export function getTilesetDef(file: string): RemoteTilesetDef | undefined {
  return tilesetsByFile.get(file);
}

/** Find the first sub-region whose `[from, to]` range contains this tileId.
 *  Higher display_order wins when regions overlap (server already sorted). */
export function matchSubRegion(def: TilesetDef, tileId: number): SubRegion | undefined {
  const subs = def.subRegions;
  if (!subs) return undefined;
  // Scan in reverse so later regions win — server sorts by display_order asc.
  for (let i = subs.length - 1; i >= 0; i--) {
    const sr = subs[i];
    if (tileId >= sr.from && tileId <= sr.to) return sr;
  }
  return undefined;
}

// ---------------------------------------------------------------------------
// Overrides
// ---------------------------------------------------------------------------

export function key(tileset: string, tileId: number): string {
  return `${tileset}:${tileId}`;
}

export function getOverride(tileset: string, tileId: number): TileOverride | undefined {
  return overridesMap[key(tileset, tileId)];
}

export function allOverrides(): Record<string, TileOverride> {
  return { ...overridesMap };
}

export function hasAnyOverride(): boolean {
  return Object.keys(overridesMap).length > 0;
}

export function exportOverridesJson(): string {
  return JSON.stringify(overridesMap, null, 2);
}

/** Upsert an override server-side. Updates the in-memory cache optimistically
 *  on success. Empty overrides (all fields undefined/null) delete the row. */
export async function setOverride(
  tileset: string,
  tileId: number,
  ov: TileOverride,
): Promise<void> {
  const body = {
    tileset,
    tileId,
    category:     ov.category     ?? null,
    name:         ov.name         ?? null,
    tags:         ov.tags         ?? null,
    defaultLayer: ov.defaultLayer ?? null,
    blocks:       ov.blocks       ?? null,
    hide:         ov.hide         ?? null,
  };
  const res = await fetch("/api/builder/overrides", {
    method:  "POST",
    headers: { "content-type": "application/json" },
    body:    JSON.stringify(body),
  });
  if (!res.ok) throw new Error(`setOverride failed: ${res.status}`);
  const out = (await res.json()) as { cleared?: boolean; ok?: boolean };
  const k = key(tileset, tileId);
  if (out.cleared || Object.keys(ov).length === 0) {
    delete overridesMap[k];
  } else {
    overridesMap[k] = ov;
  }
}

export async function clearOverride(tileset: string, tileId: number): Promise<void> {
  const res = await fetch(
    `/api/builder/overrides/${encodeURIComponent(tileset)}/${tileId}`,
    { method: "DELETE" },
  );
  if (!res.ok) throw new Error(`clearOverride failed: ${res.status}`);
  delete overridesMap[key(tileset, tileId)];
}

// ---------------------------------------------------------------------------
// Map-item types (stubs — full behaviour lands per-kind)
// ---------------------------------------------------------------------------

export function listMapItemTypes(): MapItemTypeDef[] {
  return mapItemTypesList;
}

export function getMapItemType(kind: MapItemKind): MapItemTypeDef | undefined {
  return mapItemsByKind.get(kind);
}
