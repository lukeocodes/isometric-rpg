// World dimensions (derived from travel time constraints)
// Player speed: 5 tiles/sec, Chunk size: 32 tiles
// Continent cross: ~35 min = 10,500 tiles = ~328 chunks diameter
// Ocean gap: ~17.5 min = 5,250 tiles = ~164 chunks
// World: 900x900 chunks = 28,800x28,800 tiles
export const WORLD_WIDTH = 900; // chunks
export const WORLD_HEIGHT = 900; // chunks
export const CHUNK_SIZE = 32; // tiles per chunk side

// Continent placement (triangular layout, equidistant from center)
export const CONTINENT_OFFSET = 250; // chunks from world center to continent center
export const CONTINENT_RADIUS = 175; // base radius in chunks before noise

// Noise parameters for continent generation
export const CONTINENT_NOISE_SCALE = 0.01; // lower = larger features
export const COAST_NOISE_SCALE = 0.05; // higher frequency for coastline detail
export const CONTINENT_NOISE_OCTAVES = 6; // fBm octaves for continent shape
export const COAST_NOISE_OCTAVES = 4; // fBm octaves for coast detail
export const NOISE_CONTRIBUTION = 0.3; // how much noise affects land threshold
export const COAST_CONTRIBUTION = 0.15; // coastal detail amplitude
export const LAND_THRESHOLD = 0.35; // gradient + noise must exceed this for land
export const SHALLOW_THRESHOLD = -0.05; // below land but above this = shallow ocean

// Elevation parameters
export const ELEVATION_NOISE_SCALE = 0.008;
export const ELEVATION_OCTAVES = 5;

// Moisture parameters
export const MOISTURE_NOISE_SCALE = 0.006;
export const MOISTURE_OCTAVES = 5;

// Temperature parameters (latitude-influenced)
export const TEMPERATURE_NOISE_SCALE = 0.005;
export const TEMPERATURE_OCTAVES = 4;
export const TEMPERATURE_LATITUDE_WEIGHT = 0.3; // how much latitude affects temperature

// Island generation
export const ISLAND_CLUSTER_RADIUS = 40; // chunks
export const ISLAND_NOISE_SCALE = 0.03;
export const ISLANDS_PER_PAIR = 4; // island clusters between each continent pair
