# Isometric MMO Game

## Agent Guides
- @AGENTS.md — General guidelines, Playwright testing, architecture rules, common issues
- @AGENTS-SERVER.md — Server file map, adding NPCs/spawn points, protocol format
- @AGENTS-CLIENT.md — Client file map, Babylon.js deep imports, ECS patterns, UI screens
- @AGENTS-TESTING.md — Playwright automated testing strategy, combat test loop, multi-tab testing

## Project Structure
Bun workspace monorepo with three packages:
- `packages/client` — Babylon.js TypeScript client (Vite bundler)
- `packages/server` — Fastify TypeScript server (runs with Node via tsx; werift needs Node's UDP stack)
- `packages/shared` — Shared constants and protocol definitions (JSON)

## Commands

### Development
```bash
docker compose up -d                          # Start PostgreSQL + Redis
cd packages/server && node --watch --import tsx src/index.ts  # Start backend
cd packages/client && bunx --bun vite         # Start frontend with HMR
```

### Database
```bash
cd packages/server && bunx drizzle-kit push   # Push schema to DB
cd packages/server && bunx drizzle-kit generate  # Generate migration
cd packages/server && bunx drizzle-kit migrate   # Run migrations
```

## Architecture
- **Auth**: OAuth2 PKCE with id.dx.deepgram.com + dev login, game JWT for sessions
- **Networking**: WebRTC DataChannels via werift (unreliable for positions, reliable for events), HTTP POST for signaling
- **Database**: PostgreSQL via Drizzle ORM + Redis via ioredis
- **Client**: ECS architecture, isometric orthographic camera, chunk-based world
- **Server**: Authoritative game loop (combat, NPCs, HP, state) at 20Hz
- **Protocol**: Binary (24-byte) for position updates, JSON for reliable messages

## Key Constants
- Chunk size: 32x32 tiles
- Entity load radius: 32 tiles
- Chunk load radius: 3 chunks
- Server tick rate: 20Hz
- Client tick rate: 20Hz
- Position send rate: 15Hz
- Docker PostgreSQL port: 5433 (local PG on 5432)

## Git
- Use conventional commits (see global CLAUDE.md)
- Never include Co-Authored-By for Claude
