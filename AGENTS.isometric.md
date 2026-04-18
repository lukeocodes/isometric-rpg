# Isometric tilemap — coordinate system, drawing rules & renderer

## Renderer

PixiJS. Specify `v7` or `v8` in your prompt if version matters — the vertex
math is identical, only the Graphics API call differs.

```js
// PixiJS v7
g.beginFill(hex);
g.drawPolygon(verts.flat());
g.endFill();

// PixiJS v8
g.poly(verts.flat(), true);
g.fill({ color: hex });
g.stroke({ color: strokeHex, width: 0.5 });
```

Coordinates are PixiJS screen space: origin top-left, Y increases downward.
This matches the iso axis vectors below — no stage transform assumed.
If you have a camera offset or stage pivot, document it here.

---

## Projection

Dimetric isometric projection (2:1 iso — the pixel-art / game standard).
Not true 30° isometric.

### Axis vectors (per tile unit T)

| World axis | Screen ΔX | Screen ΔY |
|------------|-----------|-----------|
| +X (right-forward) | +T    | +T/2  |
| +Z (left-forward)  | -T    | +T/2  |
| +Y (up)            |  0    | -T    |

### Tile unit

Default `T = 64`. Override per-request with `T=N` in your prompt.
All coordinates must derive from T algebraically — no magic numbers.

---

## Tile top face — the rhombus

A 1×1 floor tile top face is a rhombus. Given anchor A = (ax, ay) at the
tile's **top-centre vertex**:

```
top    = (ax,      ay      )
right  = (ax + T,  ay + T/2)
bottom = (ax,      ay + T  )
left   = (ax - T,  ay + T/2)
```

Six vertices in the outline (hexagonal silhouette when stacked with walls):
top → right → bottom → left → back to top.

---

## Solid cube — three visible faces

For a cube of height `H` tile-units, anchor the **top face** first (shifted
up by H × T in screen Y), then derive the two side faces from it.

```
anchor_top = (ax, ay - H * T)
```

### Top face (rhombus, same formula as above, at anchor_top)

```
top    = (ax,      ay - H*T        )
right  = (ax + T,  ay - H*T + T/2  )
bottom = (ax,      ay - H*T + T    )
left   = (ax - T,  ay - H*T + T/2  )
```

### Left face (X-axis wall, parallelogram)

```
top-left     = left   vertex of top face
top-right    = bottom vertex of top face
bottom-right = bottom vertex of top face + (0, H*T)
bottom-left  = left   vertex of top face  + (0, H*T)
```

### Right face (Z-axis wall, parallelogram)

```
top-left     = bottom vertex of top face
top-right    = right  vertex of top face
bottom-right = right  vertex of top face + (0, H*T)
bottom-left  = bottom vertex of top face + (0, H*T)
```

---

## Wall panel (flush against one edge of a floor tile)

A wall panel is a flat slab with zero (or minimal) world depth, flush
against one edge of a tile.

### Left-edge panel (X-axis-facing wall)

Shared edge = left-vertex → bottom-vertex of the floor tile top face.

```
bottom-left  = left   vertex of floor tile top face  = (ax - T,  ay + T/2)
bottom-right = bottom vertex of floor tile top face  = (ax,       ay + T  )
top-right    = bottom-right + (0, -H_wall * T)
top-left     = bottom-left  + (0, -H_wall * T)
```

### Right-edge panel (Z-axis-facing wall)

Shared edge = bottom-vertex → right-vertex of the floor tile top face.

```
bottom-left  = bottom vertex of floor tile top face  = (ax,      ay + T  )
bottom-right = right  vertex of floor tile top face  = (ax + T,  ay + T/2)
top-right    = bottom-right + (0, -H_wall * T)
top-left     = bottom-left  + (0, -H_wall * T)
```

### Top-face strip (if panel has depth D_world > 0, default 0)

```
depth_dx = D_world * T
depth_dy = D_world * T / 2

strip = [
  top-left  + (depth_dx, -depth_dy),
  top-right + (depth_dx, -depth_dy),
  top-right,
  top-left,
]
```

---

## Lighting convention

Flat colour, three-tone shading. Light source: above-right.

| Face      | Brightness         |
|-----------|--------------------|
| Top       | base colour        |
| Left face | base × 0.80        |
| Right face| base × 0.65        |

Apply by multiplying each RGB channel. No gradients.

---

## Draw order (painter's algorithm)

Back-to-front, row by row:

1. Floor tiles — back row first, then forward
2. Wall panels behind foreground objects
3. Props / objects sitting on tiles
4. Wall panels in the foreground
5. UI / selection highlights last

---

## JavaScript helpers

These are engine-agnostic. Swap `toSVGPoints` for PixiJS draw calls above.

```js
const T = 64;        // tile unit — change here only
const H2 = T / 2;

// Anchor = top-centre vertex of a tile's top face in screen coords
function tilePoly(ax, ay) {
  return [
    [ax,      ay      ],  // top
    [ax + T,  ay + H2 ],  // right
    [ax,      ay + T  ],  // bottom
    [ax - T,  ay + H2 ],  // left
  ];
}

// Solid cube — returns { top, left, right } face vertex arrays
function cubeFaces(ax, ay, hWorld = 1) {
  const ty = ay - hWorld * T;
  const top = [
    [ax,      ty      ],
    [ax + T,  ty + H2 ],
    [ax,      ty + T  ],
    [ax - T,  ty + H2 ],
  ];
  const left = [
    top[3],                             // top-left
    top[2],                             // top-right
    [top[2][0], top[2][1] + hWorld*T],  // bottom-right
    [top[3][0], top[3][1] + hWorld*T],  // bottom-left
  ];
  const right = [
    top[2],                             // top-left
    top[1],                             // top-right
    [top[1][0], top[1][1] + hWorld*T],  // bottom-right
    [top[2][0], top[2][1] + hWorld*T],  // bottom-left
  ];
  return { top, left, right };
}

// Wall panel flush against one edge of a floor tile
// edge: 'left' = X-axis wall, 'right' = Z-axis wall
function wallPanel(ax, ay, hWorld = 1, edge = 'left', dWorld = 0) {
  const bl = edge === 'left'
    ? [ax - T, ay + H2]   // left vertex of tile top face
    : [ax,     ay + T ];  // bottom vertex of tile top face
  const br = edge === 'left'
    ? [ax,     ay + T ]   // bottom vertex
    : [ax + T, ay + H2];  // right vertex

  const tl = [bl[0], bl[1] - hWorld * T];
  const tr = [br[0], br[1] - hWorld * T];

  const front = [bl, br, tr, tl];

  let topStrip = null;
  if (dWorld > 0) {
    const dx =  dWorld * T;
    const dy = -dWorld * H2;
    topStrip = [
      [tl[0] + dx, tl[1] + dy],
      [tr[0] + dx, tr[1] + dy],
      tr,
      tl,
    ];
  }

  return { front, topStrip };
}

// World grid (col, row) → screen anchor (ax, ay)
// Origin anchor = screen position of tile (0,0) top vertex
function gridToScreen(col, row, originX, originY) {
  return [
    originX + (col - row) * T,
    originY + (col + row) * H2,
  ];
}

// Flatten vertex array for PixiJS drawPolygon / poly
function flat(verts) {
  return verts.flat();
}

// Darken a hex colour by a factor (0–1)
function darken(hex, factor) {
  const r = (hex >> 16 & 0xff) * factor | 0;
  const g = (hex >>  8 & 0xff) * factor | 0;
  const b = (hex       & 0xff) * factor | 0;
  return (r << 16) | (g << 8) | b;
}

// Draw a tile face with correct lighting
// g = PIXI.Graphics instance
function drawFace(g, verts, baseHex, face = 'top', alpha = 1) {
  const shade = { top: 1, left: 0.80, right: 0.65 };
  const colour = darken(baseHex, shade[face] ?? 1);
  // v7:
  g.beginFill(colour, alpha);
  g.drawPolygon(flat(verts));
  g.endFill();
  // v8: g.poly(flat(verts), true); g.fill({ color: colour, alpha });
}
```

---

## Vocabulary

| Term | Meaning |
|------|---------|
| tile unit / T | Base grid unit in screen pixels (default 64) |
| anchor (ax, ay) | Top-centre vertex of a tile's top face in screen coords |
| left edge | X-axis-facing edge: left-vertex → bottom-vertex |
| right edge | Z-axis-facing edge: bottom-vertex → right-vertex |
| H / hWorld | Height in tile-units; screen ΔY = H × T |
| flush | Panel shares an edge exactly with the tile, zero gap |
| top strip | Thin top face of a wall panel showing its depth |
| painter order | Back row first, front row last |
| D / dWorld | Panel depth in tile-units (default 0 = infinitely thin) |

---

## Prompt conventions

Specify these when requesting a tile, cube, or panel:

- `T=N` — tile unit size (omit to use default 64)
- `anchor=(ax,ay)` — or say "auto-centre in viewBox"
- `H=N` — height in tile-units (floor = 1, walls = 0.5–2)
- `edge=left|right` — which edge a wall panel hugs
- `colour=0xRRGGBB` — base hex; shading computed automatically
- `faces=top,left,right` — which faces to render (omit hidden ones)
- `D=N` — panel depth (default 0)
- `pixi=v7|v8` — Graphics API version

Example prompt:

```
Iso wall panel. T=64, anchor=(340,200), H=1, edge=left,
colour=0x8B7355, faces=front,top-strip, D=0.1, pixi=v7.
Floor tile beneath it, colour=0x6B8E6B, faces=top,right.
```
