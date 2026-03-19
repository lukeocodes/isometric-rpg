# Phase 1: World Map Data Layer - Research

**Researched:** 2026-03-19
**Domain:** Procedural world map generation, spatial hierarchy, Voronoi region systems, seeded noise terrain
**Confidence:** HIGH

## Summary

Phase 1 creates the static data layer that describes the world's geography: three continents arranged in a triangular layout, organic Voronoi-based regions within each continent, and a spatial hierarchy (Continent > Region > Chunk > Tile) that is queryable at O(1) for any chunk coordinate. This is a data-only phase -- no rendering, no chunk streaming, no visual changes. The output is a world generation pipeline that runs at server startup from a configurable seed, producing an in-memory world definition that downstream phases consume.

The core technical challenge is procedural generation of organic continental shapes using simplex noise, followed by Voronoi region subdivision using Poisson disk-sampled seed points. Elevation and moisture noise layers drive biome classification per region. The entire generation must be deterministic from a single world seed so different servers can reproduce identical worlds.

The existing codebase has a server startup pattern in `index.ts` (Redis connect, NPC spawn, game loop start) where world map loading fits naturally. The `worldMaps` and `chunkData` DB tables exist but are not yet used for macro-level geography. The `SafeZone` system in `zones.ts` is hardcoded but extensible. The server already has a spatial grid in `EntityStore` with cell-based lookups that validates the precomputed chunk-to-region mapping approach.

**Primary recommendation:** Build the world generator as a pure function pipeline in `packages/server/src/world/` that takes a seed and produces an in-memory `WorldMap` object. Precompute the chunk-to-region lookup table as a flat `Uint16Array` (900x900 = ~1.6MB) for O(1) spatial queries. Store the world seed and config in `packages/shared/` so it is available to both packages.

<user_constraints>
## User Constraints (from CONTEXT.md)

### Locked Decisions
- Three continents arranged in a **triangular layout**, roughly equidistant from each other
- Continental shapes must be **organic and irregular** -- not geometric blobs. Complex coastlines with bays, peninsulas, fjords, and inlets
- All continents are **strictly ocean-separated** -- no land bridges or connections
- **Roughly equal in size** -- no race gets a larger homeland
- **Small neutral/unclaimed islands** scattered between continents
- **World origin (0,0) is in the ocean center** -- continents are offset from the origin
- **Hard edges** -- finite world with deep ocean at boundaries, no wrapping
- **Lakes and rivers** exist within continents (data layer marks where inland water features go)
- **Basic depth zones** -- distinguish coastal shallows from deep ocean in the data layer
- **Mark natural passages/straits** between island chains
- **Ocean areas divided into named regions** -- just like land
- Each continent has a **dominant biome theme** with secondary biomes for variety:
  - **Elf continent**: Ancient forests & rivers
  - **Dwarf continent**: Mountains & tundra
  - **Human continent**: Temperate & diverse
- **One contrasting "wild zone" per continent** -- unexpected biome pocket
- **Island groups have distinct biomes** per their ocean location
- **Minority outposts match local continent terrain**
- World map is **procedurally generated from a seed** using noise functions + rules
- **World seed is configurable per server**
- **Elevation data included in Phase 1** -- noise-based elevation drives biome assignment
- **Voronoi regions** -- organic, natural-looking boundaries from seed points
- **20-30 regions per continent** (~80 total land regions, plus ocean regions)
- **Poisson disk sampling** for seed point placement
- **Pure Voronoi boundaries** -- mathematical edges, not snapped to terrain features
- **POI markers in data layer** -- tagged locations with no gameplay effect
- **Chunk-to-region lookup** precomputed at startup -- O(1) lookups
- **30-45 minutes real time** to walk across a continent
- **5-10 minutes** between safe zones
- **World size derived from travel time**
- **Ocean gaps ~half a continent width** (~15-20 minutes)

### Claude's Discretion
- Exact noise function parameters for continent generation
- Voronoi relaxation iterations (Lloyd's algorithm)
- Specific biome assignment thresholds from elevation/moisture
- Data file format and structure for the world map
- POI type taxonomy for the data layer
- Ocean region count and sizing strategy

### Deferred Ideas (OUT OF SCOPE)
- Rivers and lakes as distinct terrain types -- Phase 2 (WORLD-03)
- Movement blocking for water/terrain -- Phase 2 (WORLD-05)
- Naval/ocean traversal mechanics -- Out of scope
- Interior spaces in settlements -- Out of scope
- Minimap terrain data -- v2 requirement (WPOL-02)
</user_constraints>

<phase_requirements>
## Phase Requirements

| ID | Description | Research Support |
|----|-------------|-----------------|
| TECH-01 | World map data layer defines continental outlines, elevation, biome classification, and settlement locations above the existing chunk system | Noise-based continent generation pipeline, elevation/moisture grids, biome classification rules, WorldMap data structure |
| TECH-02 | Hierarchical spatial system -- Continent > Region > Chunk > Tile -- with region as the unit of discovery and seeding | Voronoi region generation from Poisson disk points, precomputed chunk-to-region lookup table (Uint16Array), O(1) spatial queries |
| WORLD-01 | World map defines three continents (Human, Elf, Dwarf) with ocean separation, each containing distinct biome regions | Triangular continent placement, noise-based landmass shaping, per-continent biome themes with elevation/moisture classification |
</phase_requirements>

## Standard Stack

### Core
| Library | Version | Purpose | Why Standard |
|---------|---------|---------|--------------|
| `simplex-noise` | 4.0.3 (verified via npm) | Coherent noise for elevation, moisture, temperature, continent shapes | Dominant JS/TS noise library. Zero dependencies, ~2KB gzipped, tree-shakeable ESM. ~73M ops/sec for 2D. Seeded via constructor with custom PRNG. |
| `alea` | 1.0.1 (verified via npm) | Seedable PRNG for deterministic generation | Standard pairing with simplex-noise. Fast, well-distributed, seedable from string or number. `createNoise2D(alea(seed))` is the canonical pattern. |

### Supporting
| Library | Version | Purpose | When to Use |
|---------|---------|---------|-------------|
| `fast-2d-poisson-disk-sampling` | 1.0.3 (verified via npm) | Poisson disk sampling for region seed point placement | When generating evenly-spaced-with-randomness region centers. O(n) Bridson algorithm, produces organic point distributions without Lloyd relaxation overhead. |

### Alternatives Considered
| Instead of | Could Use | Tradeoff |
|------------|-----------|----------|
| `simplex-noise` | `open-simplex-noise` | Older API, less active. simplex-noise v4 is cleaner. |
| `fast-2d-poisson-disk-sampling` | Custom Bridson implementation | Library is 1.0.3, tiny, well-tested. Custom code saves a dependency but adds 80-100 lines of tricky geometry code. Recommend library. |
| `fast-2d-poisson-disk-sampling` | `poisson-disk-sampling` (2.3.1) | N-dimensional, more complex API. We only need 2D -- the fast-2d variant is simpler and faster for our use case. |
| Voronoi library (d3-voronoi, delaunator) | Custom nearest-point assignment | For region assignment, we do NOT need full Voronoi edge computation. We only need "which region center is closest to this chunk?" -- a simple distance calculation. No Voronoi library needed. |

**Installation:**
```bash
cd packages/server
bun add simplex-noise alea fast-2d-poisson-disk-sampling
```

**Version verification:** simplex-noise 4.0.3, alea 1.0.1, fast-2d-poisson-disk-sampling 1.0.3 confirmed current via `npm view` on 2026-03-19.

## Architecture Patterns

### Recommended Project Structure
```
packages/server/src/world/
  worldgen.ts             # Main pipeline: seed -> WorldMap
  continents.ts           # Continent shape generation (noise + landmask)
  regions.ts              # Voronoi region generation (Poisson disk + assignment)
  biomes.ts               # Biome classification (elevation + moisture -> biome)
  types.ts                # All world data type definitions
  constants.ts            # World generation constants (sizes, thresholds)

packages/shared/
  world-config.json       # World seed, dimension constants, biome enum
  constants.json          # Extended with world constants (existing file)
```

### Pattern 1: Pure Function Generation Pipeline
**What:** World generation is a pure function: `generateWorld(seed: number, config: WorldConfig) -> WorldMap`. No side effects, no database access, no global state.
**When to use:** Always. The world generator must be testable in isolation.
**Example:**
```typescript
// Source: Project-specific pattern based on simplex-noise v4 API
import { createNoise2D } from 'simplex-noise';
import alea from 'alea';

interface WorldMap {
  seed: number;
  width: number;          // in chunks
  height: number;         // in chunks
  continents: Continent[];
  regions: Region[];
  // Flat arrays indexed by [y * width + x] for chunk coordinates
  landmask: Uint8Array;       // 0=deep ocean, 1=shallow, 2=land, 3=lake
  elevation: Float32Array;    // 0.0 to 1.0
  moisture: Float32Array;     // 0.0 to 1.0
  temperature: Float32Array;  // 0.0 to 1.0
  regionMap: Uint16Array;     // chunk -> region ID
  continentMap: Uint8Array;   // chunk -> continent ID (0=ocean)
  biomeMap: Uint8Array;       // chunk -> biome enum value
}

function generateWorld(seed: number, config: WorldConfig): WorldMap {
  const prng = alea(seed);

  // Step 1: Generate continent shapes (landmask + elevation)
  const landmask = generateContinents(seed, config);

  // Step 2: Generate noise layers (elevation, moisture, temperature)
  const elevation = generateElevation(seed, config, landmask);
  const moisture = generateMoisture(seed + 1, config, landmask);
  const temperature = generateTemperature(seed + 2, config, landmask);

  // Step 3: Generate Voronoi regions via Poisson disk sampling
  const regions = generateRegions(seed, config, landmask);
  const regionMap = buildRegionLookup(regions, config);

  // Step 4: Classify biomes from noise layers
  const biomeMap = classifyBiomes(elevation, moisture, temperature, landmask);

  return { seed, ...config.dimensions, continents, regions,
           landmask, elevation, moisture, temperature, regionMap,
           continentMap, biomeMap };
}
```

### Pattern 2: Multi-Octave Noise (Fractal Brownian Motion)
**What:** Layer multiple noise samples at decreasing scales to create natural-looking terrain. This is the standard technique for continent shapes and terrain features.
**When to use:** Continent shape generation, elevation maps, moisture maps.
**Example:**
```typescript
// Source: Standard fBm technique, simplex-noise v4 API
import { createNoise2D } from 'simplex-noise';
import alea from 'alea';

function fbm(
  noise2D: ReturnType<typeof createNoise2D>,
  x: number, y: number,
  octaves: number = 6,
  lacunarity: number = 2.0,
  gain: number = 0.5
): number {
  let value = 0;
  let amplitude = 1.0;
  let frequency = 1.0;
  let maxValue = 0;

  for (let i = 0; i < octaves; i++) {
    value += amplitude * noise2D(x * frequency, y * frequency);
    maxValue += amplitude;
    amplitude *= gain;
    frequency *= lacunarity;
  }

  return value / maxValue; // Normalized to [-1, 1]
}

// Usage for continent generation:
const continentNoise = createNoise2D(alea(`${seed}-continents`));
const scale = 0.003; // Lower = larger features
for (let cy = 0; cy < height; cy++) {
  for (let cx = 0; cx < width; cx++) {
    const wx = (cx - width / 2) * 32; // Convert chunk to world tiles
    const wz = (cy - height / 2) * 32;
    const n = fbm(continentNoise, wx * scale, wz * scale, 6);
    // Combine with continent placement mask...
  }
}
```

### Pattern 3: Continent Placement with Radial Gradient + Noise
**What:** Place continents by defining center points in a triangular arrangement, then use radial gradients combined with noise to create organic coastlines. The gradient ensures land exists near the center, while noise creates irregular edges.
**When to use:** Generating the landmask for three continents.
**Example:**
```typescript
// Source: Red Blob Games island generation technique + project constraints
interface ContinentDef {
  id: string;
  name: string;
  race: 'human' | 'elf' | 'dwarf';
  centerX: number;  // chunk coordinate
  centerZ: number;  // chunk coordinate
  radius: number;   // base radius in chunks
}

function placeContinents(worldWidth: number, worldHeight: number): ContinentDef[] {
  // Triangular layout: origin (0,0) is ocean center
  // Continents offset ~250 chunks from center
  const offset = 250; // chunks from world center
  const cx = worldWidth / 2;
  const cz = worldHeight / 2;

  // Equilateral triangle vertices
  return [
    { id: 'elf', name: 'Faerwood', race: 'elf',
      centerX: cx, centerZ: cz - offset, radius: 175 },
    { id: 'dwarf', name: 'Khazdum', race: 'dwarf',
      centerX: cx - offset * Math.cos(Math.PI/6),
      centerZ: cz + offset * Math.sin(Math.PI/6), radius: 175 },
    { id: 'human', name: 'Britannia', race: 'human',
      centerX: cx + offset * Math.cos(Math.PI/6),
      centerZ: cz + offset * Math.sin(Math.PI/6), radius: 175 },
  ];
}

function generateLandmask(
  seed: number, continents: ContinentDef[],
  width: number, height: number
): Uint8Array {
  const noise = createNoise2D(alea(`${seed}-land`));
  const coastNoise = createNoise2D(alea(`${seed}-coast`));
  const landmask = new Uint8Array(width * height);

  for (let cz = 0; cz < height; cz++) {
    for (let cx = 0; cx < width; cx++) {
      let maxLandValue = -1;
      for (const cont of continents) {
        const dx = cx - cont.centerX;
        const dz = cz - cont.centerZ;
        const dist = Math.sqrt(dx * dx + dz * dz);
        const normalizedDist = dist / cont.radius;

        // Radial gradient: 1.0 at center, 0.0 at radius
        const gradient = Math.max(0, 1.0 - normalizedDist);

        // Add noise for organic coastline
        const n = fbm(noise, cx * 0.01, cz * 0.01, 6) * 0.5 + 0.5;
        const coastDetail = fbm(coastNoise, cx * 0.05, cz * 0.05, 4) * 0.15;

        const landValue = gradient + n * 0.3 + coastDetail - 0.35;
        maxLandValue = Math.max(maxLandValue, landValue);
      }

      // Classify: deep ocean, shallow, land
      if (maxLandValue > 0.1) landmask[cz * width + cx] = 2; // land
      else if (maxLandValue > -0.05) landmask[cz * width + cx] = 1; // shallow
      else landmask[cz * width + cx] = 0; // deep ocean
    }
  }
  return landmask;
}
```

### Pattern 4: Poisson Disk + Nearest-Point Region Assignment
**What:** Generate evenly-spaced region seed points using Poisson disk sampling, then assign each chunk to its nearest seed point. This produces Voronoi-like regions without computing actual Voronoi diagrams.
**When to use:** Region generation and chunk-to-region lookup table building.
**Example:**
```typescript
// Source: fast-2d-poisson-disk-sampling library + project constraints
import PoissonDiskSampling from 'fast-2d-poisson-disk-sampling';

interface Region {
  id: number;
  name: string;
  continentId: string;    // 'elf', 'dwarf', 'human', 'ocean'
  centerX: number;        // chunk coordinate
  centerZ: number;        // chunk coordinate
  biome: BiomeType;
  isLand: boolean;
  pois: POI[];
}

function generateRegions(
  seed: number, config: WorldConfig, landmask: Uint8Array
): Region[] {
  const prng = alea(`${seed}-regions`);

  // Generate Poisson disk points within each continent's bounds
  // minDistance controls region density (~20 chunks between centers
  // gives 20-30 regions per continent at radius 175)
  const pds = new PoissonDiskSampling({
    shape: [config.width, config.height],
    minDistance: 40,  // chunks between region centers
    maxDistance: 60,  // upper bound
    tries: 30
  }, prng);

  const allPoints = pds.fill();

  // Filter and classify: land points become land regions,
  // ocean points become ocean regions
  const regions: Region[] = allPoints.map((point, i) => {
    const cx = Math.round(point[0]);
    const cz = Math.round(point[1]);
    const isLand = landmask[cz * config.width + cx] >= 2;
    const continentId = getContinentAt(cx, cz, config.continents);
    return {
      id: i,
      name: '', // Generated later from seed
      continentId,
      centerX: cx,
      centerZ: cz,
      biome: BiomeType.UNCLASSIFIED, // Classified later
      isLand,
      pois: [],
    };
  });

  return regions;
}

function buildRegionLookup(
  regions: Region[], width: number, height: number
): Uint16Array {
  const map = new Uint16Array(width * height);

  for (let cz = 0; cz < height; cz++) {
    for (let cx = 0; cx < width; cx++) {
      let minDist = Infinity;
      let nearestRegion = 0;

      for (const region of regions) {
        const dx = cx - region.centerX;
        const dz = cz - region.centerZ;
        const dist = dx * dx + dz * dz; // Skip sqrt, compare squared
        if (dist < minDist) {
          minDist = dist;
          nearestRegion = region.id;
        }
      }

      map[cz * width + cx] = nearestRegion;
    }
  }

  return map;
}
```

### Pattern 5: Biome Classification from Noise Layers
**What:** Use elevation, moisture, and temperature noise values to classify each chunk/region into a biome type. Continental affinity modulates the result to create themed continents.
**When to use:** After noise layers are generated, before region finalization.
**Example:**
```typescript
// Source: Red Blob Games Whittaker diagram technique + project constraints
enum BiomeType {
  DEEP_OCEAN = 0,
  SHALLOW_OCEAN = 1,
  BEACH = 2,
  TEMPERATE_GRASSLAND = 3,
  TEMPERATE_FOREST = 4,
  DENSE_FOREST = 5,
  BOREAL_FOREST = 6,
  MOUNTAIN = 7,
  SNOW_PEAK = 8,
  TUNDRA = 9,
  DESERT = 10,
  SCRUBLAND = 11,
  SWAMP = 12,
  HIGHLAND = 13,
  MEADOW = 14,
  RIVER_VALLEY = 15,
}

function classifyBiome(
  elevation: number, moisture: number, temperature: number,
  continentId: string
): BiomeType {
  // Continental modifiers create themed biomes
  let elevMod = 0, moistMod = 0, tempMod = 0;
  switch (continentId) {
    case 'elf':   moistMod = 0.15; tempMod = 0.1;  break; // Wetter, warmer
    case 'dwarf': elevMod = 0.15;  tempMod = -0.15; break; // Higher, colder
    case 'human': break; // No modifier -- most diverse
  }

  const e = Math.min(1, Math.max(0, elevation + elevMod));
  const m = Math.min(1, Math.max(0, moisture + moistMod));
  const t = Math.min(1, Math.max(0, temperature + tempMod));

  if (e > 0.85) return BiomeType.SNOW_PEAK;
  if (e > 0.7) return BiomeType.MOUNTAIN;
  if (e > 0.6) return m > 0.5 ? BiomeType.HIGHLAND : BiomeType.TUNDRA;
  if (t < 0.2) return BiomeType.TUNDRA;
  if (t < 0.35) return m > 0.5 ? BiomeType.BOREAL_FOREST : BiomeType.TUNDRA;
  if (m < 0.15 && t > 0.6) return BiomeType.DESERT;
  if (m < 0.3) return BiomeType.SCRUBLAND;
  if (m > 0.75 && e < 0.3) return BiomeType.SWAMP;
  if (m > 0.6) return BiomeType.DENSE_FOREST;
  if (m > 0.4) return BiomeType.TEMPERATE_FOREST;
  return BiomeType.TEMPERATE_GRASSLAND;
}
```

### Anti-Patterns to Avoid
- **Non-deterministic generation:** NEVER use `Math.random()` in world generation. Every function must accept a seed or PRNG. Test determinism: `generateWorld(42) === generateWorld(42)`.
- **Storing full world map in database:** The world map is generated at boot from a seed. Do NOT store the landmask, elevation grid, or region map in PostgreSQL. Store only the seed + generation version. Regenerate on each server start.
- **Eager chunk generation:** Phase 1 generates the macro world definition only (continent shapes, regions, biomes). It does NOT generate individual tile data for 800K+ chunks. Tile-level generation happens lazily in Phase 3/4 when players explore.
- **Complex Voronoi edge computation:** We do not need Voronoi polygon edges for Phase 1. We only need "which region does this chunk belong to?" which is a simple nearest-point lookup. Skip Fortune's algorithm, Delaunay triangulation, and edge polygon computation entirely.
- **Per-region database records at boot:** Do not create 110+ region rows in PostgreSQL during world generation. Regions are an in-memory data structure. Database records for regions are created in Phase 4 when a region is first discovered.

## Don't Hand-Roll

| Problem | Don't Build | Use Instead | Why |
|---------|-------------|-------------|-----|
| Simplex noise | Custom noise implementation | `simplex-noise` 4.0.3 | Patent-free, 73M ops/sec, 2KB, zero-dep, TypeScript native |
| Seedable PRNG | Math.sin-based hash or custom PRNG | `alea` 1.0.1 | Statistically excellent distribution, canonical pairing with simplex-noise |
| Poisson disk sampling | Custom Bridson implementation | `fast-2d-poisson-disk-sampling` 1.0.3 | Bridson's O(n) algorithm, 80+ lines of tricky geometry code you'd write by hand |
| Voronoi diagrams | Fortune's algorithm / d3-voronoi | Simple nearest-point distance | For chunk-to-region mapping, a brute-force nearest-point loop over ~110 regions is fast enough (~0.1ms per chunk, 810K chunks = ~80ms total). No Voronoi library needed. |
| fBm (fractal Brownian motion) | N/A | Custom ~15-line utility | This IS hand-rolled -- it's too simple to warrant a library. Just loop octaves of simplex noise. |

**Key insight:** The world map is a ~80ms computation at server startup. Performance-critical libraries are for runtime operations (chunk streaming, entity broadcasting). For a one-time boot computation over ~810K chunks, even naive algorithms complete in under a second.

## Common Pitfalls

### Pitfall 1: Seed Determinism Failures
**What goes wrong:** World generation uses `Math.random()` or shared PRNG state, producing different worlds on different runs with the same seed.
**Why it happens:** `Math.random()` is the default. `simplex-noise` uses it if no PRNG is passed. Developers forget to pass fresh `alea` instances to each noise function.
**How to avoid:** Every `createNoise2D()` call gets `alea(\`${seed}-${uniqueSuffix}\`)`. Never reuse a PRNG instance across noise functions. Write a determinism test: `JSON.stringify(generateWorld(42)) === JSON.stringify(generateWorld(42))`.
**Warning signs:** Test output differs between runs. Two developers describe different world layouts from the same seed.

### Pitfall 2: Continent Shapes That Look Like Circles
**What goes wrong:** Radial gradient produces perfect circles instead of organic coastlines. The noise amplitude is too low relative to the gradient, or the noise frequency is wrong.
**Why it happens:** Conservative noise parameters. The gradient dominates because the noise is at the wrong scale.
**How to avoid:** Use 6+ octaves of fBm with the lowest frequency matching the continent radius. The noise contribution should be 30-40% of the final land value, not 10%. Add a separate high-frequency coastal detail noise layer. Visually inspect the landmask output (write a debug function that outputs a text grid or simple image).
**Warning signs:** All three continents are roughly circular when viewed from above.

### Pitfall 3: Region Sizes Vary Wildly with Poisson Disk
**What goes wrong:** Poisson disk sampling produces points that cluster at the edges of continents, creating tiny coastal regions and huge interior regions. Or the minDistance parameter creates too few/many regions.
**Why it happens:** Poisson disk sampling does not know about continent boundaries. Points may fall in ocean and get discarded, leaving gaps on land.
**How to avoid:** Generate Poisson points per-continent (within bounding box), not globally. Use different minDistance for land and ocean regions. After generation, verify region count is in the 20-30 range per continent and adjust minDistance if needed. Apply 1-2 iterations of Lloyd relaxation on land-only points if distribution is uneven.
**Warning signs:** Some regions span 100+ chunks while others are 5-10 chunks.

### Pitfall 4: Biome Classification Ignores Continental Theme
**What goes wrong:** All three continents have similar biome distributions because classification is purely based on noise values without continental modifiers. The Elf continent does not feel distinctly forested.
**Why it happens:** Elevation/moisture/temperature noise is uniform across the world. Without continental modifiers, biome assignment has no racial character.
**How to avoid:** Apply per-continent modifiers to the noise values before classification (see Pattern 5 above). The Elf continent gets +moisture/+temperature, Dwarf gets +elevation/-temperature, Human gets no modifier. Additionally, place the "wild zone" explicitly by inverting modifiers in a specific sub-region.
**Warning signs:** Walking between continents, biomes feel interchangeable.

### Pitfall 5: World Scale Miscalculation
**What goes wrong:** The world is too small (players cross a continent in 5 minutes) or too large (server takes seconds to generate, memory exceeds limits).
**Why it happens:** Not validating the travel-time-to-chunk-count math.
**How to avoid:** Lock the math early:
  - Player speed: 5 tiles/sec
  - Continent cross: 35 min avg = 2100 sec = 10,500 tiles = ~328 chunks diameter
  - Ocean gap: 17.5 min = 5,250 tiles = ~164 chunks
  - World dimensions: ~900x900 chunks = 28,800x28,800 tiles
  - Memory: 900*900 = 810K entries. Each grid (Uint8/Uint16/Float32): 0.8-3.2MB. Total ~15MB for all grids. Comfortable.
**Warning signs:** Memory exceeds 50MB for world data, or generation takes >2 seconds.

### Pitfall 6: O(n*m) Region Assignment Without Optimization
**What goes wrong:** Assigning 810K chunks to ~110 regions by brute-force nearest-point takes too long.
**Why it happens:** The naive loop is O(chunks * regions) = 810K * 110 = 89M comparisons.
**How to avoid:** This is actually fine for a one-time startup cost (~80-200ms on modern hardware). But if it proves slow, optimize with a simple grid acceleration: divide the world into ~30x30 macro cells, cache which regions could possibly be nearest to each macro cell, and only compare against those candidates. Alternatively, use the sorted-by-distance early-exit pattern.
**Warning signs:** Region lookup precomputation takes >1 second. Profile before optimizing.

## Code Examples

Verified patterns from official sources:

### simplex-noise v4 + alea Integration
```typescript
// Source: https://github.com/jwagner/simplex-noise.js/blob/main/README.md
import { createNoise2D, createNoise3D } from 'simplex-noise';
import alea from 'alea';

// CRITICAL: Each noise function gets its OWN alea instance
const elevationNoise = createNoise2D(alea('42-elevation'));
const moistureNoise = createNoise2D(alea('42-moisture'));
const continentNoise = createNoise2D(alea('42-continents'));

// Returns value in [-1, 1]
const value = elevationNoise(10.5, 20.3);

// Normalize to [0, 1] for most use cases
const normalized = (value + 1) / 2;
```

### fast-2d-poisson-disk-sampling Usage
```typescript
// Source: https://github.com/kchapelier/fast-2d-poisson-disk-sampling
import PoissonDiskSampling from 'fast-2d-poisson-disk-sampling';
import alea from 'alea';

// Generate evenly-spaced points within a bounding box
const pds = new PoissonDiskSampling({
  shape: [350, 350],    // continent bounding box in chunks
  minDistance: 40,       // minimum gap between region centers
  maxDistance: 60,       // max gap (points placed within this range)
  tries: 30             // attempts per point before giving up
}, alea('42-regions-elf')); // Seedable!

const points: [number, number][] = pds.fill();
// Returns array of [x, y] coordinates within the shape
```

### Server Startup Integration
```typescript
// Source: Existing index.ts pattern
// packages/server/src/index.ts (extended)
import { generateWorld } from "./world/worldgen.js";
import { WorldMap } from "./world/types.js";

let worldMap: WorldMap;

async function main() {
  const app = await buildApp();
  await connectRedis();

  // NEW: Generate world map from seed (deterministic, ~100ms)
  const worldSeed = parseInt(process.env.WORLD_SEED || "42");
  worldMap = generateWorld(worldSeed);
  console.log(`World generated: ${worldMap.regions.length} regions, ` +
    `${worldMap.continents.length} continents`);

  spawnInitialNpcs();
  startGameLoop();
  // ...
}

// Exported for use by other server modules
export function getWorldMap(): WorldMap { return worldMap; }
```

### Chunk-to-Region Query (O(1) at Runtime)
```typescript
// Source: Project-specific pattern
function getRegionForChunk(cx: number, cz: number, worldMap: WorldMap): Region | null {
  // Translate from world-relative to array-relative coordinates
  if (cx < 0 || cx >= worldMap.width || cz < 0 || cz >= worldMap.height) {
    return null; // Out of world bounds
  }
  const regionId = worldMap.regionMap[cz * worldMap.width + cx];
  return worldMap.regions[regionId] ?? null;
}

function getContinentForChunk(cx: number, cz: number, worldMap: WorldMap): string {
  if (cx < 0 || cx >= worldMap.width || cz < 0 || cz >= worldMap.height) {
    return 'void';
  }
  const continentId = worldMap.continentMap[cz * worldMap.width + cx];
  return worldMap.continents[continentId]?.id ?? 'ocean';
}

function getBiomeForChunk(cx: number, cz: number, worldMap: WorldMap): BiomeType {
  if (cx < 0 || cx >= worldMap.width || cz < 0 || cz >= worldMap.height) {
    return BiomeType.DEEP_OCEAN;
  }
  return worldMap.biomeMap[cz * worldMap.width + cx];
}
```

## State of the Art

| Old Approach | Current Approach | When Changed | Impact |
|--------------|------------------|--------------|--------|
| `new SimplexNoise()` class-based API | `createNoise2D(prng)` function-based API | simplex-noise v4 (2022) | Tree-shakeable, no unused 3D/4D code in bundle |
| Built-in alea PRNG in simplex-noise | Separate `alea` package | simplex-noise v4 | Must install alea separately; cleaner separation of concerns |
| Perlin noise for terrain | Simplex noise | Established best practice | Fewer directional artifacts, faster at higher dimensions |
| Per-pixel Voronoi computation | Nearest-point brute force for grid | N/A | Full Voronoi is unnecessary when you only need region assignment on a fixed grid |
| Lloyd relaxation for even regions | Poisson disk sampling (Bridson) | Established alternative | Poisson disk is O(n), produces organic results from the start without iterative relaxation |

**Deprecated/outdated:**
- `simplex-noise` v3 class-based API: Still works but v4 is recommended. Import style completely different.
- `open-simplex-noise`: Less maintained than `simplex-noise`. Use `simplex-noise` v4 instead.

## Open Questions

1. **Island Generation Between Continents**
   - What we know: CONTEXT.md requires "small neutral/unclaimed islands scattered between continents" with distinct biomes per ocean location
   - What's unclear: How many island groups? How large? Should they be noise-generated (random) or placed at specific coordinates?
   - Recommendation: Generate 3-5 island clusters between each continent pair (9-15 total clusters) using smaller radial gradients. Place cluster centers at fixed positions relative to continent pairs, let noise determine individual island shapes. Each cluster gets its biome from the midpoint between adjacent continents' temperatures.

2. **Ocean Region Count and Strategy**
   - What we know: Ocean areas should be "divided into named regions" like land
   - What's unclear: How many ocean regions? Same Poisson disk approach, or predefined?
   - Recommendation: Use same Poisson disk approach but with larger minDistance (80-100 chunks) for ocean since ocean regions are less gameplay-relevant. Expect ~20-30 ocean regions total. Name them after geographic position (e.g., "Northern Passage", "Elven Straits").

3. **POI Type Taxonomy**
   - What we know: Regions can contain tagged POI locations for future ruins, cave entrances
   - What's unclear: What POI types should exist in the data layer?
   - Recommendation: Minimal taxonomy for Phase 1: `{ type: 'ruin' | 'cave' | 'landmark' | 'resource' | 'settlement', x: number, z: number, subtype?: string }`. Place 0-3 POIs per land region during generation, seeded deterministically. No gameplay effect -- pure data markers.

4. **Coordinate System Convention**
   - What we know: World origin (0,0) is in the ocean center. Current game uses tile coordinates with (0,0) at spawn.
   - What's unclear: Should chunk coordinates be offset so (0,0) chunk is at the world center? Or use array indices starting from 0?
   - Recommendation: Use two coordinate systems: **world chunks** where (0,0) is world center (used by gameplay/queries), and **array indices** where (0,0) is top-left corner (used by internal arrays). Provide conversion functions. The world chunk system means continent centers are at roughly (+/-250, +/-250) from origin, matching the "origin is in ocean" constraint.

5. **Passage/Strait Marking**
   - What we know: Natural passages between island chains should be tagged for future naval traversal
   - What's unclear: How to define a "passage" in the data layer?
   - Recommendation: A passage is a POI with type 'strait' placed at the narrowest point between two landmasses along the island chain. Identified during generation by scanning for narrow ocean gaps between land chunks. Store as `{ type: 'strait', x, z, connects: [regionA, regionB] }`.

## Validation Architecture

### Test Framework
| Property | Value |
|----------|-------|
| Framework | vitest 4.1.0 |
| Config file | `packages/server/vitest.config.ts` |
| Quick run command | `cd packages/server && npx vitest run src/world/` |
| Full suite command | `cd packages/server && npx vitest run` |

### Phase Requirements to Test Map
| Req ID | Behavior | Test Type | Automated Command | File Exists? |
|--------|----------|-----------|-------------------|-------------|
| TECH-01 | World map defines continental outlines, elevation, biome classification | unit | `cd packages/server && npx vitest run src/world/worldgen.test.ts -t "continent generation"` | No -- Wave 0 |
| TECH-01 | Elevation grid has reasonable ranges (0-1, land higher than ocean) | unit | `cd packages/server && npx vitest run src/world/worldgen.test.ts -t "elevation"` | No -- Wave 0 |
| TECH-02 | Chunk-to-region lookup returns valid region for any land chunk | unit | `cd packages/server && npx vitest run src/world/regions.test.ts -t "chunk to region"` | No -- Wave 0 |
| TECH-02 | Chunk-to-continent lookup returns correct continent | unit | `cd packages/server && npx vitest run src/world/regions.test.ts -t "chunk to continent"` | No -- Wave 0 |
| TECH-02 | Spatial hierarchy is consistent: region's continent matches chunk's continent | unit | `cd packages/server && npx vitest run src/world/regions.test.ts -t "hierarchy consistency"` | No -- Wave 0 |
| WORLD-01 | Three distinct continental landmasses exist separated by ocean | unit | `cd packages/server && npx vitest run src/world/continents.test.ts -t "three continents"` | No -- Wave 0 |
| WORLD-01 | No land bridge connects any two continents (flood fill from one continent cannot reach another) | unit | `cd packages/server && npx vitest run src/world/continents.test.ts -t "ocean separation"` | No -- Wave 0 |
| WORLD-01 | Each continent has distinct biome regions (not uniform) | unit | `cd packages/server && npx vitest run src/world/biomes.test.ts -t "biome diversity"` | No -- Wave 0 |
| ALL | World generation is deterministic (same seed = same output) | unit | `cd packages/server && npx vitest run src/world/worldgen.test.ts -t "determinism"` | No -- Wave 0 |
| ALL | World map loads at server startup without blocking game loop | integration | `cd packages/server && npx vitest run src/world/worldgen.test.ts -t "startup performance"` | No -- Wave 0 |

### Sampling Rate
- **Per task commit:** `cd packages/server && npx vitest run src/world/`
- **Per wave merge:** `cd packages/server && npx vitest run`
- **Phase gate:** Full suite green before `/gsd:verify-work`

### Wave 0 Gaps
- [ ] `packages/server/src/world/worldgen.test.ts` -- covers TECH-01 (world generation pipeline, determinism, performance)
- [ ] `packages/server/src/world/continents.test.ts` -- covers WORLD-01 (three continents, ocean separation, coastline quality)
- [ ] `packages/server/src/world/regions.test.ts` -- covers TECH-02 (chunk-to-region lookup, hierarchy consistency)
- [ ] `packages/server/src/world/biomes.test.ts` -- covers WORLD-01 biome diversity, continental themes
- [ ] Framework install: `cd packages/server && bun add simplex-noise alea fast-2d-poisson-disk-sampling` -- new dependencies needed

## Sources

### Primary (HIGH confidence)
- [simplex-noise npm](https://www.npmjs.com/package/simplex-noise) -- v4.0.3 API: `createNoise2D(prng)`, seeding with alea, performance benchmarks
- [simplex-noise GitHub README](https://github.com/jwagner/simplex-noise.js/blob/main/README.md) -- Full API documentation, migration from v3, alea integration pattern
- [alea npm](https://www.npmjs.com/package/alea) -- v1.0.1, seedable PRNG, simplex-noise integration
- [fast-2d-poisson-disk-sampling GitHub](https://github.com/kchapelier/fast-2d-poisson-disk-sampling) -- v1.0.3, Bridson algorithm, seedable
- Existing codebase files (HIGH): `packages/server/src/game/entities.ts` (spatial grid pattern), `packages/server/src/game/zones.ts` (SafeZone interface), `packages/server/src/db/schema.ts` (worldMaps/chunkData tables), `packages/server/src/index.ts` (startup pattern), `packages/shared/constants.json` (CHUNK_SIZE, MAX_PLAYER_SPEED)

### Secondary (MEDIUM confidence)
- [Red Blob Games mapgen2](https://www.redblobgames.com/maps/mapgen2/) -- Voronoi + Delaunay for polygon map generation, elevation/moisture biome classification (Whittaker diagram)
- [Lloyd's algorithm Wikipedia](https://en.wikipedia.org/wiki/Lloyd's_algorithm) -- Voronoi relaxation for even point distribution
- [Procedural Island Generation (2025)](https://brashandplucky.com/2025/09/07/procedural-island-generation-i.html) -- Modern continent/island noise generation techniques
- Prior project research: `.planning/research/ARCHITECTURE.md`, `.planning/research/STACK.md`, `.planning/research/PITFALLS.md`, `.planning/research/FEATURES.md`

### Tertiary (LOW confidence)
- World scale calculations (derived from CONTEXT.md constraints + player speed constants) -- math is correct but final dimensions need visual validation after generation

## Metadata

**Confidence breakdown:**
- Standard stack: HIGH -- simplex-noise + alea are verified ecosystem standards, versions confirmed via npm
- Architecture: HIGH -- patterns are well-established (fBm, Poisson disk, nearest-point regions), codebase integration points verified by reading source
- Pitfalls: HIGH -- identified from codebase analysis (PRNG in spawn-points.ts), domain knowledge, and project-specific constraints
- World scale: MEDIUM -- math is sound but exact dimensions need visual validation; may need 5-10% adjustments after seeing generated output

**Research date:** 2026-03-19
**Valid until:** 2026-04-19 (stable domain, libraries are mature)
