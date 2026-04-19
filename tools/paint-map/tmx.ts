// TMX writer — emit valid Tiled map XML from an in-memory map description.
//
// Supports:
// - Multiple external tileset references with auto-assigned firstgids
// - Multiple tile layers with CSV-encoded data, layer properties (e.g. solid, zindex)
// - Object layers with point objects + properties

import type { Tileset } from "./tsx.js";

export type TmxTilesetRef = {
  /** Filename relative to the TMX output directory. e.g. "summer-forest-wang.tsx" */
  source: string;
  /** Parsed tileset (needed for tilecount to compute firstgid). */
  tileset: Tileset;
};

export type TmxLayer = {
  name: string;
  width: number;
  height: number;
  /** Per-cell local tileid. -1 = empty (written as 0). Length must equal width*height. */
  tileIds: Int32Array;
  /** Which tileset provides these tileids. firstgid is added to non-empty cells. */
  tilesetIndex: number;
  /** Layer-level properties. */
  properties?: Record<string, { value: string | number | boolean; type?: "bool" | "int" | "float" | "string" }>;
  /** Defaults to true. When false, emits visible="0". */
  visible?: boolean;
};

export type TmxObject = {
  name?: string;
  type: string; // "class" in Tiled terms
  x: number;
  y: number;
  properties?: Record<string, { value: string | number | boolean; type?: "bool" | "int" | "float" | "string" }>;
};

export type TmxObjectGroup = {
  name: string;
  objects: TmxObject[];
};

export type TmxMap = {
  width: number; // tiles
  height: number;
  tilewidth: number;
  tileheight: number;
  tilesets: TmxTilesetRef[];
  layers: TmxLayer[];
  objectGroups: TmxObjectGroup[];
};

/** Compute firstgid for each tileset given their tilecounts. */
export function assignFirstgids(refs: TmxTilesetRef[]): number[] {
  const out: number[] = [];
  let gid = 1;
  for (const ref of refs) {
    out.push(gid);
    gid += ref.tileset.tilecount;
  }
  return out;
}

function renderProperties(
  props: Record<string, { value: string | number | boolean; type?: string }> | undefined,
  indent: string,
): string {
  if (!props || Object.keys(props).length === 0) return "";
  const lines = [`${indent}<properties>`];
  for (const [name, { value, type }] of Object.entries(props)) {
    const t = type ? ` type="${type}"` : "";
    lines.push(`${indent} <property name="${name}"${t} value="${value}"/>`);
  }
  lines.push(`${indent}</properties>`);
  return lines.join("\n");
}

export function renderTmx(map: TmxMap): string {
  const firstgids = assignFirstgids(map.tilesets);

  const lines: string[] = [];
  lines.push(`<?xml version="1.0" encoding="UTF-8"?>`);
  const nextlayerid = map.layers.length + map.objectGroups.length + 1;
  const totalObjects = map.objectGroups.reduce((n, g) => n + g.objects.length, 0);
  const nextobjectid = totalObjects + 1;
  lines.push(
    `<map version="1.10" tiledversion="1.10.2" orientation="orthogonal" renderorder="right-down" ` +
      `width="${map.width}" height="${map.height}" tilewidth="${map.tilewidth}" tileheight="${map.tileheight}" ` +
      `infinite="0" nextlayerid="${nextlayerid}" nextobjectid="${nextobjectid}">`,
  );

  // Tilesets
  for (let i = 0; i < map.tilesets.length; i++) {
    const ref = map.tilesets[i];
    lines.push(` <tileset firstgid="${firstgids[i]}" source="${ref.source}"/>`);
  }

  // Tile layers
  let layerId = 0;
  for (const layer of map.layers) {
    layerId++;
    const visibleAttr = layer.visible === false ? ` visible="0"` : "";
    lines.push(
      ` <layer id="${layerId}" name="${layer.name}" width="${layer.width}" height="${layer.height}"${visibleAttr}>`,
    );
    const propsXml = renderProperties(layer.properties, "  ");
    if (propsXml) lines.push(propsXml);
    lines.push(`  <data encoding="csv">`);

    const fg = firstgids[layer.tilesetIndex];
    const rows: string[] = [];
    for (let y = 0; y < layer.height; y++) {
      const cells: number[] = [];
      for (let x = 0; x < layer.width; x++) {
        const id = layer.tileIds[y * layer.width + x];
        cells.push(id < 0 ? 0 : id + fg);
      }
      // Tiled emits a trailing comma on every row except the last
      const isLast = y === layer.height - 1;
      rows.push(cells.join(",") + (isLast ? "" : ","));
    }
    lines.push(rows.join("\n"));
    lines.push(`  </data>`);
    lines.push(` </layer>`);
  }

  // Object groups
  let objectId = 0;
  for (const group of map.objectGroups) {
    layerId++;
    lines.push(` <objectgroup id="${layerId}" name="${group.name}">`);
    for (const obj of group.objects) {
      objectId++;
      const nameAttr = obj.name ? ` name="${obj.name}"` : "";
      lines.push(
        `  <object id="${objectId}"${nameAttr} type="${obj.type}" x="${obj.x}" y="${obj.y}">`,
      );
      const propsXml = renderProperties(obj.properties, "   ");
      if (propsXml) lines.push(propsXml);
      lines.push(`   <point/>`);
      lines.push(`  </object>`);
    }
    lines.push(` </objectgroup>`);
  }

  lines.push(`</map>`);
  return lines.join("\n") + "\n";
}
