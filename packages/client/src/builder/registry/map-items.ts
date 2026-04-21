/**
 * Map-item type contracts. Data lives in the database (`map_item_types`
 * table) and is fetched via `store.ts` at boot alongside categories /
 * layers / tilesets. See AGENTS.md "Data in the Database".
 *
 * A "map item" is a placed world object whose behaviour exceeds a static
 * sprite — containers hold inventories, lights emit glow, doors toggle,
 * signs show text, NPC spawns spawn AI-driven characters. All stubs for
 * now (`implemented: false` on every row); full feature design lands
 * alongside each runtime.
 *
 * Kinds are wire-format slugs — don't rename without a data migration.
 */

export type MapItemKind =
  | "container"
  | "light"
  | "door"
  | "sign"
  | "npc-spawn"
  | "teleporter"
  | "crop-plot";

export interface MapItemTypeDef {
  kind:        MapItemKind;
  name:        string;
  description: string;
  /** Whether the item blocks player movement. Most do. */
  blocks:      boolean;
  /** Tile-like footprint the picker draws as a preview, if any. */
  preview?:    { tileset: string; tileId: number };
  /** True once the full behaviour is implemented end-to-end. */
  implemented: boolean;
}

// Runtime accessors live in ./store.ts — re-export for import ergonomics.
export { listMapItemTypes, getMapItemType } from "./store.js";
