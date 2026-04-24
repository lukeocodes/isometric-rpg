# 16Bit Online

## Adversarial reviews

- Your work is constantly being reviewed by other models (Claude, CoPilot, Codex, Big Pickle, Qwen Coder, …).
- You are constantly facing being switched out for a competitor model.

## Context hygiene (IMPORTANT)

Keep API request size small. Context bloat causes failures. Follow these rules strictly:

- **Read files with `offset`+`limit`** — never read an entire large file. 20-50 lines is usually enough.
- **Use grep / glob first** — find the exact line numbers, then read only that range.
- **Pipe bash output through `| tail -N` or `| head -N`** — never dump full command output. 5-15 lines.
- **Don't echo file contents back** — after reading a file, note what you learned, don't quote it.
- **Avoid redundant reads** — if you already read a section, don't re-read it. Take notes in your response.
- **Minimize screenshot frequency** — one screenshot to verify, not one per change.
- **Prefer Edit over Write** — sends only the diff, not the whole file.
- **Suppress noisy output** — `2>&1 | grep -v "warning" | tail -5` for builds / tests.
- **Update `AGENTS.game.md`** instead of building up conversation context. Future sessions read the file, not the thread.

## Where things live

Top-level `AGENTS.<topic>.md` files are indexes — each points at its deep-dive documents under `docs/`. Read `AGENTS.game.md` at the start of every session.

- **`AGENTS.game.md`** — current state, known issues, blockers. **Read first, update after significant work.** Indexes the `docs/world-builder.md`, `docs/tile-library.md`, `docs/paint-map.md` deep-dives plus the `docs/history/*` archive.
- **`AGENTS.client.md`** — client runtime overview. Indexes `docs/client-architecture.md` (engine concepts, file map, how to add an actor / UI).
- **`AGENTS.server.md`** — server runtime overview. Indexes `docs/server-architecture.md` (boot order, file map, how to add NPCs / spawn points).
- **`AGENTS.performance.md`** — the binary-vs-JSON rule + other perf invariants. Indexes `docs/binary-protocol.md` + `docs/performance-rules.md`.
- **`AGENTS.testing.md`** — Playwright integration testing. Indexes `docs/testing-playwright.md` (setup, combat loop, multi-tab, known constraints).
- **`AGENTS.identity.md`** — design-only: ATProto identity, `player_ref` HMAC, zone ownership taxonomy, row-level integrity signatures, mail system. Indexes `docs/identity-zones.md`. Not yet implemented.
- **`AGENTS.audio.md`** — design-only: Tone.js + Web Audio stack, music state machine, acoustic occlusion. Indexes `docs/audio.md`. Prior Babylon.js implementation lives in `packages/client-old/src/audio/` as salvage.

Supplemental non-index docs that don't have an `AGENTS.*.md` front door:

- **`docs/data-policy.md`** — "Data in the Database, NOT in Code" rule with rationale + workflows for adding fields / asset packs.

These are mentions, not `@`-tags; only file the agent should auto-load on every session is `AGENTS.game.md`.

## Project structure

Bun workspace monorepo with three packages:

- `packages/client` — Excalibur.js v0.30 TypeScript client (Vite bundler).
- `packages/server` — Fastify TypeScript server (runs with Node via tsx; `werift` needs Node's UDP stack).
- `packages/shared` — Shared constants + protocol definitions (JSON).

## Commands

```bash
# Dev
docker compose up -d                                                # PostgreSQL + Redis
cd packages/server && node --watch --import tsx src/index.ts        # Server on 8000
cd packages/client && bunx --bun vite                               # Client on 5173

# Database (from packages/server)
bunx drizzle-kit push                                               # Push schema to DB
bunx drizzle-kit generate                                           # Generate migration
bunx drizzle-kit migrate                                            # Run migrations

# Tile ingest + audit (from repo root, with DATABASE_URL set)
bun tools/ingest-mana-seed.ts                                       # Walk assets/, publish canonical TSX+PNG, upsert DB
bun tools/ingest-mana-seed.ts --reset                               # Wipe tilesets first, full rebuild
bun tools/ingest-mana-seed.ts --pack="20.04c - Summer Forest 4.3"   # Ingest one pack only
bun tools/audit-transparent.ts --fix                                # Clean dead overrides / sub-regions
```

## Architecture (high level)

- **Auth** — OAuth2 PKCE (ATProto / `bsky.social`) + dev-login. Game JWT for session tokens.
- **Networking** — WebRTC DataChannels via `werift`. Unreliable for positions, reliable for events. HTTP POST for signalling. **Never use WebSocket for gameplay.**
- **Database** — PostgreSQL via Drizzle ORM + Redis via ioredis.
- **Client** — Excalibur.js v0.30 2D top-down rendering with `@excaliburjs/plugin-tiled`. Not PixiJS, not Babylon.js.
- **Server** — authoritative game loop (combat, NPC AI, HP, state) at 20Hz.
- **Protocol** — binary for high-frequency messages (positions, combat, state); JSON for rare events (chat, quests, zone changes). Full rules + opcode table in `docs/binary-protocol.md`.
- **Coordinate system** — top-down 2D orthographic: Actor `x, y` in world pixels (`TILE=16` per tile). The binary position protocol still carries a legacy `z` float from the prior isometric architecture; it's ignored on render. See [`docs/binary-protocol.md`](docs/binary-protocol.md).
- **Data in the database, NOT in code** — only logic + images outside the DB. Everything queryable is a table. Full manifesto in `docs/data-policy.md`. This rule is **non-negotiable**.

## Key constants

- Chunk size: 32×32 tiles
- Entity load radius: 32 tiles
- Chunk load radius: 3 chunks
- Server tick rate: 20Hz
- Client tick rate: 20Hz
- Position send rate: 15Hz
- Docker PostgreSQL port: 5433 (local Postgres stays on 5432)

## Git

- Conventional Commits.
- Never include `Co-Authored-By`.
- SSH auth uses 1Password's agent socket: `export SSH_AUTH_SOCK="$HOME/Library/Group Containers/2BUA8C4S2C.com.1password/t/agent.sock"` before `git push`.

## Architecture rules

- **Server-authoritative** — never put combat / HP / spawning logic in the client. The client only renders.
- **No WebSocket** — all game data flows over WebRTC DataChannels. HTTP POST is only for signalling.
- **ECS patterns** — new features = new components + systems. Don't bloat `GameScene.ts`.
- **Excalibur.js rendering** — `actor.graphics.opacity` for fade, `actor.z` for depth. Not PixiJS.
- **Tiled maps** — world is hand-crafted in Tiled editor format. Maps in `public/maps/`. Never hand-edit TMX — use `tools/paint-map/` for scene-spec-driven generation.
- **Memory** — call `actor.kill()` on Excalibur actors when they're removed; clear Maps / Sets on entity despawn; destroy owned `ImageSource` / `SpriteSheet` if single-use.
- **Sleep optimization** — all entities skip ticking when no player is within 32 tiles.

## Common issues

- **DataChannel timeout** — check the server's running. Check the browser (ungoogled Chromium blocks WebRTC; use regular Chrome).
- **NPCs not spawning** — check `spawn-points` table + server log for `[SpawnPoint]` entries on boot.
- **Position not syncing** — check `numericIdMap` in `StateSync` (hash mismatch between server/client).
- **Port 8000 stuck** — `lsof -ti:8000 | xargs kill -9`.
- **Drizzle schema changes** — `cd packages/server && DATABASE_URL="…" bunx drizzle-kit push`.
