// TSX parser — Tiled tileset definitions
// Zero deps. Uses regex because TSX XML format is consistent and simple.
//
// Supports:
// - <tileset> header attributes
// - <image> source/width/height
// - <wangsets>/<wangset>/<wangcolor>/<wangtile>
//
// Does NOT yet support animated tiles or per-tile properties.
// Add when needed.

import { readFileSync } from "node:fs";

export type WangColor = {
  /** 1-based index matching wangid integers in <wangtile>. Colour 0 is "empty/any". */
  id: number;
  name: string;
  color: string;
  tile: number;
};

export type WangTile = {
  tileid: number;
  /** 8 values: [edge_N, corner_NE, edge_E, corner_SE, edge_S, corner_SW, edge_W, corner_NW] */
  wangid: [number, number, number, number, number, number, number, number];
};

export type WangSet = {
  name: string;
  type: "corner" | "edge" | "mixed";
  colors: WangColor[];
  tiles: WangTile[];
  /** Key format: "NE,SE,SW,NW" (colour ids). Value: matching tileids. */
  cornerLookup: Map<string, number[]>;
  /** Reverse: colour name → id. */
  colorByName: Map<string, number>;
};

export type Tileset = {
  /** Absolute path to the .tsx file on disk. */
  path: string;
  name: string;
  tilewidth: number;
  tileheight: number;
  tilecount: number;
  columns: number;
  imageSource: string; // relative to .tsx file
  imageWidth: number;
  imageHeight: number;
  wangsets: WangSet[];
};

/** Get a single attribute value from an XML tag's body text (e.g. `name="foo" type="bar"`). */
function attr(tagBody: string, key: string): string | undefined {
  const re = new RegExp(`\\b${key}="([^"]*)"`);
  return tagBody.match(re)?.[1];
}

function requireAttr(tagBody: string, key: string): string {
  const v = attr(tagBody, key);
  if (v === undefined) throw new Error(`Missing required attribute '${key}' in: ${tagBody.slice(0, 80)}`);
  return v;
}

export function parseTsx(path: string): Tileset {
  const xml = readFileSync(path, "utf-8");

  const tsHead = xml.match(/<tileset\b([^>]*)>/);
  if (!tsHead) throw new Error(`No <tileset> element in ${path}`);
  const tsAttrs = tsHead[1];

  const imgMatch = xml.match(/<image\b([^>]*?)\/>/);
  if (!imgMatch) throw new Error(`No <image> element in ${path}`);
  const imgAttrs = imgMatch[1];

  const ts: Tileset = {
    path,
    name: requireAttr(tsAttrs, "name"),
    tilewidth: +requireAttr(tsAttrs, "tilewidth"),
    tileheight: +requireAttr(tsAttrs, "tileheight"),
    tilecount: +requireAttr(tsAttrs, "tilecount"),
    columns: +requireAttr(tsAttrs, "columns"),
    imageSource: requireAttr(imgAttrs, "source"),
    imageWidth: +requireAttr(imgAttrs, "width"),
    imageHeight: +requireAttr(imgAttrs, "height"),
    wangsets: [],
  };

  // Parse wangsets
  const wsRe = /<wangset\b([^>]*)>([\s\S]*?)<\/wangset>/g;
  let m: RegExpExecArray | null;
  while ((m = wsRe.exec(xml)) !== null) {
    const wsAttrs = m[1];
    const wsBody = m[2];

    const ws: WangSet = {
      name: requireAttr(wsAttrs, "name"),
      type: requireAttr(wsAttrs, "type") as WangSet["type"],
      colors: [],
      tiles: [],
      cornerLookup: new Map(),
      colorByName: new Map(),
    };

    // Wang colours — id is their 1-based order in the wangset
    const colorRe = /<wangcolor\b([^/]*)\/>/g;
    let cm: RegExpExecArray | null;
    let colorId = 0;
    while ((cm = colorRe.exec(wsBody)) !== null) {
      colorId++;
      const cAttrs = cm[1];
      const color: WangColor = {
        id: colorId,
        name: requireAttr(cAttrs, "name"),
        color: requireAttr(cAttrs, "color"),
        tile: +requireAttr(cAttrs, "tile"),
      };
      ws.colors.push(color);
      ws.colorByName.set(color.name, color.id);
    }

    // Wang tiles
    const tileRe = /<wangtile\b([^/]*)\/>/g;
    let tm: RegExpExecArray | null;
    while ((tm = tileRe.exec(wsBody)) !== null) {
      const tAttrs = tm[1];
      const tileid = +requireAttr(tAttrs, "tileid");
      const widStr = requireAttr(tAttrs, "wangid");
      const parts = widStr.split(",").map(Number);
      if (parts.length !== 8) {
        throw new Error(`wangid has ${parts.length} parts, expected 8: tileid=${tileid}`);
      }
      const wangid = parts as WangTile["wangid"];
      ws.tiles.push({ tileid, wangid });

      // Corner-type wangs only use odd indices (1,3,5,7 = NE,SE,SW,NW)
      // Build lookup keyed by "NE,SE,SW,NW"
      const key = `${wangid[1]},${wangid[3]},${wangid[5]},${wangid[7]}`;
      const arr = ws.cornerLookup.get(key);
      if (arr) arr.push(tileid);
      else ws.cornerLookup.set(key, [tileid]);
    }

    ts.wangsets.push(ws);
  }

  return ts;
}

/** Find a wangset by name within a tileset. Throws if not found. */
export function getWangSet(ts: Tileset, name: string): WangSet {
  const ws = ts.wangsets.find((w) => w.name === name);
  if (!ws) {
    const available = ts.wangsets.map((w) => `'${w.name}'`).join(", ") || "(none)";
    throw new Error(`Wangset '${name}' not found in ${ts.name}. Available: ${available}`);
  }
  return ws;
}

/** Resolve a colour name to its wang id in a given wangset. */
export function colorId(ws: WangSet, name: string): number {
  const id = ws.colorByName.get(name);
  if (id === undefined) {
    const available = [...ws.colorByName.keys()].map((n) => `'${n}'`).join(", ");
    throw new Error(`Colour '${name}' not in wangset '${ws.name}'. Available: ${available}`);
  }
  return id;
}
