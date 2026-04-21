# Zones, Ownership, Identity, and Data Location

Design note captured during ATProto architecture discussion. Forward-looking; not yet implemented.

## Core design assumptions

- **Always-online, coop-only.** No PVP. All play requires server.
- **No spatial continuity.** Zones are discrete UUIDs in the DB. Travel is teleport. No neighbour relationships, no contiguous world geometry.
- **Travel primitive = teleporter.** Overt (portal tile, menu) or diegetic (tunnel mouth, cave entrance, castle gate, dock/sailing). Mechanically identical.
- **Server is authoritative for ALL gameplay data.** The PDS is never the source of truth. The PDS is an optional mirror for users who bring their own data-capable PDS.
- **ATProto is for identity only.** Social login. Not primary storage for most users.

## Identity model

### Login
- OAuth2 PKCE against an ATProto-compatible provider (default: bsky.social; custom handles resolve to their own PDS).
- Successful login returns: DID + email + handle + avatar.

### What we store
- Email address (for comms + display).
- **`player_ref`** — a derived identifier that binds email to DID without storing the DID itself.
- NO raw DID anywhere in the database.
- NO ATProto private keys ever touch our systems.

### Deriving `player_ref`
The DID is used to "sign" the email to produce a stable per-player reference. Exact cryptographic mechanism TBD — candidate approaches:
- Deterministic HMAC: `player_ref = HMAC-SHA256(email, DID)` — simple, requires DID on every login to re-derive, but never persisted.
- Signed assertion: user signs a canonical message (`"16bit-online:" + email`) with a DID-bound session key (e.g. DPoP); we store the signature + verify on re-login via fresh signature.
- The goal is: given our database alone, nobody can learn which DID corresponds to a given player. DID is recoverable only when the player logs in.

### Security consequence
- A game master operating on the backend **cannot modify player-authored content** (decorations, messages, event creations, etc.) because doing so would require forging a valid DID-bound signature, and we don't hold the DID's private key.
- Admin tools can still operate on **system state** (economy rules, zone templates, spawn configs, moderation labels, rate limits) — those aren't player-authored.
- Player-authored mutations require the player to be in-session. "Fix this for me" support tickets require the player to be present and perform the action themselves, guided.

### Pseudonymity properties
- DB leak doesn't expose the mapping from game account → Bluesky identity.
- Scraping the DB gives emails and opaque hashes only.
- Players' in-game presence is decoupled from their social identity (they can use a custom character name independent of their handle).

## Zone taxonomy

### Server-authored zones (team content, DB only, never on any PDS)

| Type | Party / scale |
|---|---|
| Starter areas | — |
| Capital cities (one per race) | — |
| Adventure areas (difficulty scales over calendar time) | — |
| Dungeon / cave / battle instances (procedural or AI-generated map + encounter) | 5 / 10 / 15 / 20 players |
| World boss battles (can occur in any zone) | 20 / 25 / 40 players |
| Player-scheduled timed events (hosted in server-owned zones as "borrowed venue") | — |

Wired together via teleporters: overt (menu portal) or diegetic (cave mouths, castle gates, docks/sailing, tunnels). Under the hood identical.

Operator-owned, hand-crafted by the team via builder or `tools/paint-map/`. Not mirrored anywhere.

### Player-accessible procedural zones

- **Unclaimed state:** UUID generated on first visit. Server records generator seed + biome + version. No owner.
- **Access triggers:**
  - Special item (shop-bought), OR
  - High-level spell with expensive / RMT-gated reagents.
- **Claim prerequisite:** build a house inside the zone to save it as a home. House requires a **house deed** item.

### House deed item

- Every player starts with **one** house deed item in their inventory.
- The starter deed is **locked** — cannot be used until the player completes a specific mid-game **discovery mission**.
- After that, additional deeds are earned or purchased.
- A deed is **consumed** on use to claim a zone as a home.
- Deeds are inventory items → server-authoritative, never on PDS.

### Home slots

- **Primary home:** exactly one per player; target of "teleport home" action.
- **Secondary homes:** unlimited; any zone where the player has built a house.
- **Exit tiles** (in any player-owned zone):
  - Default: player's race's capital.
  - After house built: owner may reconfigure to any zone they own OR any capital they've personally visited.
  - If never visited any capital: exit defaults to race's capital.
  - Server validates every destination change against "zones owned" and "capitals visited" lists.

### Building rules inside player-owned zones

- World-builder tiles purchased from shops (server economy gate).
- **Cannot change biome / zone type** (desert, tundra, forest, etc. — immutable attribute).
- Decoration must match biome — tile allowlist enforced server-side on every placement.
- Allowed within biome: trees, walls, mazes, paths, interior layouts.
- **Unrestricted:** outdoor decoration, structures, lamps, props that don't alter biome identity.

## Guild / shared zones

### Sharing and ownership transfer

A player-owned zone can become a **shared zone** by mutual agreement between the owner and at least one other player. Shared zones are server-authoritative — no individual holds the deed any more.

**Transfer flow:**
1. Zone owner invites another player to share.
2. Both parties agree.
3. Zone enters **paused** state: access frozen, no new edits, no new visitors.
4. Server snapshots current zone state, transfers ownership from `player_ref` to a new `shared` record.
5. All existing houses / decorations / items are preserved in place.
6. Each sharing player's personal deed is retained server-side as proof of their stake.
7. Zone resumes as `shared`; original owner + invitee(s) all have build rights.

### Guild formation

A shared zone is a **prerequisite** for forming a guild:

1. Find a friend → agree to share a zone → zone transfers to shared state.
2. Each member of the shared zone may build their own house inside.
3. Purchase a **guild house** item (distinct from a regular house deed; specific prerequisite reagent for guild creation).
4. Build the guild house inside the shared zone → **guild is created**.
5. Any guild member may now also build in the zone.

Guilds require a shared zone as their home. You cannot create a guild in a personally-owned zone. You cannot create a guild in a server zone.

### Member removal (anti-griefing)

- When a member is removed from a guild (or leaves):
  - Their deed returns to them.
  - All items they placed in the shared zone return to their personal inventory.
  - Their house structure is removed from the shared zone.
- This prevents malicious guild actors from trapping members' content.

### Guild master powers

- Can pick up and move **any member's entire house** within the zone (repositioning, not theft).
- Standard admin actions: invite, remove, promote officers, etc. (full permission model TBD).

### Zone ownership enum

```
zones.owner:
  null                        — unowned (procedural, not yet claimed)
  player:<player_ref>         — owned by one player
  shared:<guild_id>           — shared zone, server-held on behalf of a guild
```

## Storage tiers

### Default tier (most players — ATProto identity only)
- Login via ATProto (bsky.social or other provider).
- All gameplay data in server DB.
- Player-authored records signed / attested by DID so that provenance is cryptographically verifiable, even though the DID itself isn't stored.
- No PDS custom-lexicon writes attempted.

### BYOD tier (power users — custom / self-hosted PDS that accepts game lexicons)
- Login via ATProto against their custom PDS.
- All gameplay data still in server DB (server is always authoritative).
- Server async-mirrors user-authored records to their PDS.
- Realtime data (positions, combat, live zone state) never hits any PDS — stays in Redis / Postgres.
- PDS mirror is a portable backup + composability surface, never a source of truth.
- Mirror is debounced / batched to respect PDS rate limits.

### Invariants across both tiers
- Server DB is ALWAYS the source of truth.
- User content is ALWAYS cryptographically linked to a DID (via `player_ref` + per-record signature where applicable).
- Backend admins CANNOT mutate player-authored content without the player's signing participation.
- Economy / inventory / progression / stats are server-decided and NOT signed by the player (admins can tune these for legitimate game-ops reasons).

## Data ownership matrix

### Server DB only (system / operator-owned, never signed by player)

| Data | Why |
|---|---|
| Server zones (starter / capital / adventure / instanced / boss) | Team authored |
| Procedural zone seed, biome, version | Canonical rehydration source |
| Zone ownership table (UUID → `player_ref` or `shared:guild_id`) | Authoritative register |
| UUID pool (unclaimed / reserved / owned / released) | Global consistency required |
| Biome immutable attribute + tile allowlist | Server invariant |
| Economy ledger (gold, shop txns, RMT) | Absolutely never on PDS |
| Inventory authoritative state (including deeds, reagents, tiles) | Cheatable |
| Character stats, HP, level, progression | Cheatable |
| Party / raid composition (live session) | Ephemeral |
| Live zone instance state | Realtime, 20Hz |
| Event schedule (authoritative) | Server gates access at event time |
| Gift / message queue for offline zone owners | Server holds for delivery |
| Guild roster, permissions, member records | Authoritative |
| Capital-visit log (which capitals a player has reached) | Progression data, server observes |
| Spawn-point and NPC definitions | Operator data |
| Moderation labels / hide flags | Operator data |

### Server DB, player-signed (DID-attested authored content)

These records live in server DB but carry a signature binding them to the player's DID. Admins can't silently alter them.

| Record | Notes |
|---|---|
| Profile (character name, cosmetics, bio, race choice) | Signed by DID on mutation |
| UI settings / keybindings / accessibility | Signed by DID on mutation |
| Zone content (tile overlay on top of generator seed, decorations, furniture) | Signed per edit (or per batch) |
| Exit-tile configuration on owned zones | Signed; server validates destinations |
| Home designation (which zone is primary) | Signed |
| Chat messages | Signed by sender on send |
| Visit log entries ("I visited zone X on date Y") | Signed by visitor |
| Gifts given / received | Given: signed by giver. Received acceptance: signed by recipient. |
| Event schedule (player-hosted) | Signed by host + server-cosigned for access gating |
| Event attendance records | Signed by attendee + server-cosigned ("server witnessed you here") |
| Pilgrimage lists (curated collections) | Signed by author |
| Social follows | Signed by follower |
| Guild membership attestations | Signed by member + server-cosigned |

### Mirrored to PDS (BYOD tier only, async, best-effort)

The signed records above are additionally mirrored to the user's custom PDS if they opted into BYOD. Mirror is a copy; server DB remains authoritative. Record types as lexicons — namespace TBD, tentative `online.16bit.*`.

## Rationale for the split

- **ATProto hosted PDSes (bsky.social) don't accept arbitrary custom lexicons.** So defaulting to "data on user's PDS" would exclude the majority of players. Server-first means everyone gets full functionality; BYOD is an enhancement for those who want it.
- **Server-authoritative aligns with the game's existing design.** Combat is already server-authoritative. Keeping one authority model (server-first, everywhere, always) avoids split-brain problems.
- **Signing player-authored records with DID decouples identity from data location.** The data could be in our DB, in the user's PDS, both, or neither (deleted) — the signature proves the player authored it wherever it lives.
- **DID never stored because storage is a liability.** If the DB leaks, we don't want to expose a cross-reference between game accounts and Bluesky identities. Hashing/signing gives us a lookup key without the underlying identifier.
- **Admin separation of powers.** Admins can run the game (tune economy, curate server zones, moderate). Admins cannot silently rewrite player-authored content. The signing requirement enforces this structurally.
- **Guild zones as server-held is the only sensible model.** Shared ownership with multiple DIDs holding a deed is conflict-prone; transferring to server and letting the guild record hold membership is much cleaner.

## Emergent properties

- **GDPR / deletion is clean.** Delete a player → server purges their `player_ref` rows, releases their UUIDs back to the pool, gifts / messages they authored survive on recipients' records (as historical fact). BYOD users can additionally delete their PDS mirror themselves.
- **Admin transparency.** Because admins structurally can't rewrite player-authored content, the audit log is implicit: if a record exists, a player authored it.
- **Disaster recovery via BYOD mirrors.** If the game DB is catastrophically lost, BYOD users' PDS mirrors reconstitute their authored content. Non-BYOD content is lost in that scenario — same as any server-only data.
- **Portability for BYOD users.** A fork of the game could re-ingest their identity + creations from their PDS. Non-BYOD users would need server-side export tools.
- **Third-party apps for BYOD users.** Public PDS records from BYOD users are discoverable by external apps ("map gallery", "event calendar", etc.). Non-BYOD users appear in these apps only if we also publish a public read-only AppView of signed server data (optional future work).

## Constraints and open questions

- **Exact `player_ref` derivation scheme.** HMAC-SHA256(email, DID)? Something involving DPoP? Decide and document before first schema design.
- **Per-record signing mechanism.** Is each mutation individually signed by a session-scoped DID-bound key (DPoP style), or is the authentication proof the session token itself? What's the recovery story if the signing key rotates during a long edit session?
- **Email as identity anchor.** Relying on email means a player changing email needs a re-derivation migration. ATProto handles can also change (though DID is stable). Policy TBD.
- **Moderation of player-authored content.** Since admins can't edit authored records, moderation = hide/label only. Full takedown requires the authoring player to delete (or a legal override mechanism outside normal flow).
- **Guild-house prerequisites and economics.** What's the exact cost / recipe for the guild house reagent? Out of scope for this note.
- **Guild master "move any house" power.** Within-zone only, or across zones the guild owns multiple of? (Spec says within-zone; clarify.)
- **Zone sharing across guilds.** Can a shared zone have more than one guild? Assumed no — one shared zone = at most one guild.
- **Orphaned shared zones.** What happens if all guild members leave? Zone reverts to unowned? To the original pre-share owner? To archived? Policy TBD.
- **PDS rate-limit strategy.** 5-minute / 50-edit debounce is a starting guess; measure and tune.
- **Lexicon namespace.** `online.16bit.*` tentative.
- **ATProto OAuth with dynamic issuer.** Real ATProto OAuth discovers the PDS from the user's handle, not a single issuer URL. The current `OAUTH_ISSUER=https://bsky.social` is a simplification and will need to evolve when the actual auth rewrite happens.
- **Discovery layer design.** Non-spatial world = discovery carries all the organizing weight. Portals, directory, search, feeds, tags, algorithmic surfacing. Substantial design work out of scope here.
- **Instance scaling for popular zones.** Multi-instance sharding for high-traffic zones. Future concern.
