# Identity, Zones, Ownership, and Data Location

**Status: design, not yet implemented.** Forward-looking architecture for the ATProto identity model, zone ownership taxonomy, row-level tamper evidence, and deferred-countersign mail system. No code implements any of this yet. Captured during architecture discussion; all names / namespaces / defaults are tentative.

When gameplay systems are built (auth rewrite, zone ownership, houses, guilds), this is the blueprint they follow.

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

```
player_ref = HMAC-SHA256(key=DID, message=email)
```

- DID is the HMAC secret, email is the message.
- Both inputs come from the OAuth response on every login.
- `player_ref` is deterministic and stable while (DID, email) are stable.
- DID is used transiently during login to compute the HMAC, then discarded from memory. Never written to disk, never logged.
- Given the DB alone, nobody can learn which DID corresponds to which player — HMAC is not invertible, and the DID space is too large to brute-force.

### Implications of `player_ref` stability

- **Email change** → `player_ref` changes. Handled at the email-change moment: user logs in (we have current DID) → they initiate email change → we re-derive the new `player_ref` → migrate rows keyed by old → new → swap atomically.
- **DID change** (rare; happens during ATProto account migration) → `player_ref` also changes. Handled via explicit pre-migration flow: while the user still has access to their old DID, they log in → initiate migration → provide new DID → we re-derive and migrate. If the user loses access to their old DID without doing this flow, their game account becomes unrecoverable by design (pseudonymity / non-reversibility is the whole point).
- **Bans** cannot be enforced via `player_ref` alone (a banned player could rebind their DID to a new email and get a fresh `player_ref`). Ban-list must store DIDs directly in a separate, append-only table consulted at login before `player_ref` is computed. This table is the one intentional place DIDs are persisted; only for banned accounts; pseudonymity is preserved for everyone else.

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
- Player-authored rows carry a **row-level integrity signature** (see next section) that cannot be forged with DB access alone.
- Backend admins CANNOT mutate player-authored content without invalidating the signature — all legitimate changes must go through the game server where the signing inputs are simultaneously available.
- Economy / inventory / progression / stats are server-decided and NOT player-signed (admins can tune these for legitimate game-ops reasons, and they carry a server-only integrity signature if signed at all).

## Row-level integrity signatures

### Purpose
Per-row cryptographic tamper evidence for user-authored data. Prevents silent modification by anyone with DB access only — ops, attackers with a DB dump, a compromised backup, a rogue DBA. Any mutation of a signed row must go through the game server at a moment when all three signing inputs are simultaneously present.

### Signing inputs
Three components, none sufficient alone:

| Input | Source | Lifetime |
|---|---|---|
| `SERVER_SECRET` | Server-side constant (env / secrets manager) | Long-lived; rotated periodically |
| `DID` | Obtained transiently during user's OAuth session | Ephemeral; held in server memory only, never persisted |
| `player_ref` | Stored in the row itself (`HMAC-SHA256(key=DID, message=email)`) | Persistent as a database column |

### Signature construction

```
row_signature = HMAC-SHA256(
  key     = SERVER_SECRET,
  message = DID || player_ref || canonical(row_fields)
)
```

- `DID || player_ref || canonical(row_fields)` uses domain-separated concatenation (version-prefixed, length-framed) to avoid ambiguity.
- `canonical(row_fields)` is a deterministic encoding of all mutable row fields (JCS-style JSON or sorted key-value). Immutable audit fields like `created_at` are included. The `signature` column itself is excluded.
- Stored as a structured blob: `{ version, algorithm, sig }` to allow algorithm / key rotation later.

### What this defends

| Threat | Defended? | How |
|---|---|---|
| DB-only access modifies a row | Yes | Attacker lacks `SERVER_SECRET` and `DID`; cannot compute matching signature |
| DB dump replayed or forged | Yes | Same as above |
| Backup restored with altered fields | Yes | Same as above |
| Signature copied from one user's row to another | Yes | `player_ref` and `DID` are bound into the signature; cross-user replay fails |
| Rogue DBA wants to silently adjust a player's zone | Yes | Detected on that player's next login |
| Running game server compromised (has `SERVER_SECRET`) | Only partially | Can forge for currently-online users (whose DID is in session); cannot forge for offline users |
| User tampers with their own data | N/A | Application-layer rules (tile allowlist, biome invariants, economy gates) handle this; signature just confirms "they authored it" |

### Verification

- **Online user:** server has DID in session, re-derives signature, compares. Any row that doesn't match is flagged.
- **Offline user:** their DID is not recoverable. Their rows cannot be verified until they next log in. This is by design — the signature is ephemeral in the sense that **verification capability tracks session presence**.
- **Tamper detection is therefore eventually consistent.** A rogue modification in month N is detected at login in month N+k. Combined with an append-only edit history (see open questions), rollback is feasible.

### Write semantics

All writes to signed rows go through the game server. The server must have all three inputs at write time:

- **Tier A — user-authored (DID present):** signed at write time with the user's live session DID. Normal case for chat messages, decorations, profile edits, visit logs, gift-givings.
- **Tier B — server-acting-on-behalf-of-offline-user:** DID is not available at write time. Row is inserted in **pending-signature state** and surfaced to the user as an in-game mail item. The user explicitly accepts or rejects each item on their next login; acceptance triggers a Tier A signature using the live session DID. See "Tier B via deferred countersign (mail system)" below.

Tier B examples: gift received while recipient offline, event attendance attestation after attendee has disconnected, achievement earned at a disconnect moment, inventory returned from a guild member removal, raid loot rolls while disconnected.

### Update semantics

- Every mutation to a Tier A row re-signs with the fresh DID from the current session. The signature always reflects the most recent legitimate write.
- Rollback on detected tampering requires an append-only edit history (write-ahead log of signed mutations). Out of scope for this doc; flagged in open questions.

### Consequence: "all changes through game tools"

Because the three inputs coexist only inside a game-server process that's actively handling an authenticated user's request, there is no database-side or admin-CLI path that can produce a valid signature for a Tier A row. Operational tools (admin dashboards, support CLIs, migration scripts) can freely modify Tier C / system rows but cannot touch Tier A rows without the player being present in-session to re-sign. This is the structural enforcement of "admins cannot silently modify player data."

### Tier B via deferred countersign (in-game mail system)

When the server must write a row on behalf of an offline user, the row enters a **pending-signature** state and is surfaced as an **in-game mail item** on the user's next login. The user explicitly accepts or rejects, and acceptance triggers the Tier A signature using their live session DID. No Tier B row ever ships with a "weaker" signature — either it becomes a full Tier A row (on accept) or it's discarded (on reject / expiry).

This is possible because the game has (or will have) an in-game mail system as a general communication surface; deferred-countersign reuses that surface for signing-related player actions.

**Flow:**

1. Server needs to create a row for an offline user (e.g. "Alice received a gift from Bob while offline").
2. Row inserted with `tier=B`, `state=pending`, no signature, `target_player_ref` set.
3. Server creates a mail item pointing at the pending row.
4. Alice logs in, sees mail: *"Bob sent you a gift. Claim? yes/no"*.
5. On **Accept**:
   - Server computes Tier A signature using Alice's live session DID.
   - Row updated: `tier=A`, `state=signed`, `signature=<hmac>`.
   - Side-effect applied (gift added to inventory, attendance recorded, etc.).
6. On **Reject**:
   - Row marked `state=rejected`.
   - Side-effect reversed (gift returns to giver with a counter-mail, attendance discarded, etc.).
7. On **Expiry** (per-type policy, TBD):
   - Gifts return to sender automatically.
   - Event attendance discards silently.
   - Achievements persist indefinitely.
   - Item returns from guild removal persist indefinitely (the player's items should always be retrievable).

**Mail item types tied to pending-sign records:**

- Gift received from another player while offline.
- Event attendance attestation (user was in zone when event concluded but disconnected before cosigning).
- Achievement earned at a disconnect moment.
- Items returned from a guild member removal.
- Raid / dungeon loot when player disconnected before distribution.

**Mail item types NOT tied to signing** (general mail system):

- Server announcements (operator → player).
- Guild communications (guild master → member).
- Friend notifications.
- System messages ("your zone claim expires in 7 days", "you have unread mail").

**Why this works:**

- **Signature integrity preserved.** Every Tier A signature is still produced with the user's DID live in session. No weakening of the three-factor scheme.
- **Player has explicit control.** Anything attributed to them required them to click Accept. Reject path provides natural anti-griefing (unwanted gifts, contested event attendance).
- **Adds no login friction in the common case.** Bulk-claim for routine item types (e.g. "accept all event attestations") can be offered without compromising individual control for anything consequential.
- **UX is a known pattern.** In-game mail is a standard MMO surface. Players expect "stuff that happened while I was away" to arrive there. The cryptographic mechanism is invisible to them.
- **Audit trail is clean.** Rejected rows are still stored (with `state=rejected`) for audit purposes — we can show that the server attempted an attribution and the user declined it.

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

### Server DB, player-signed (Tier A rows, DID-attested authored content)

These rows live in the server DB and carry a **row-level integrity signature** (see Row-level integrity signatures section). Signature is a function of `SERVER_SECRET + DID + player_ref + canonical(row)`. Tamper-evident against DB-only access; admins cannot silently alter them without the player being present to re-sign.

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
- **Three-factor row signing decouples authentication from storage.** The signature binds `SERVER_SECRET` (which the server has), `DID` (which only the player's session has), and `player_ref` (which is in the row itself). Any one compromise is insufficient to forge. The data could be in our DB, a BYOD PDS, or a backup tape — the signature travels with it and proves integrity.
- **DID never stored because storage is a liability.** If the DB leaks, we don't want to expose a cross-reference between game accounts and Bluesky identities. HMAC into `player_ref` gives us a lookup key without the underlying identifier, and the DID remains part of the per-row signature without being persisted.
- **Admin separation of powers is structural, not policy.** Admins can run the game (tune economy, curate server zones, moderate). Admins structurally cannot rewrite Tier A player-authored content without the player being in-session to re-sign. This isn't enforced by a rule we promise to follow — it's enforced by cryptography.
- **Guild zones as server-held is the only sensible model.** Shared ownership with multiple DIDs holding a deed is conflict-prone; transferring to server and letting the guild record hold membership is much cleaner.

## Emergent properties

- **GDPR / deletion is clean.** Delete a player → server purges their `player_ref` rows, releases their UUIDs back to the pool, gifts / messages they authored survive on recipients' records (as historical fact). BYOD users can additionally delete their PDS mirror themselves.
- **Admin transparency is cryptographic, not promised.** Because admins structurally can't forge signatures for Tier A rows, any tampering is detectable on the player's next login. "Trust us not to mess with your data" becomes "the database itself tells you if anyone messed with your data."
- **Row-level tamper evidence on backups.** If a backup is restored and someone has modified rows during restore, the signatures fail. Integrity survives the backup/restore cycle.
- **Disaster recovery via BYOD mirrors.** If the game DB is catastrophically lost, BYOD users' PDS mirrors reconstitute their authored content. Non-BYOD content is lost in that scenario — same as any server-only data.
- **Portability for BYOD users.** A fork of the game could re-ingest their identity + creations from their PDS. Non-BYOD users would need server-side export tools.
- **Third-party apps for BYOD users.** Public PDS records from BYOD users are discoverable by external apps ("map gallery", "event calendar", etc.). Non-BYOD users appear in these apps only if we also publish a public read-only AppView of signed server data (optional future work).

## Constraints and open questions

- **Mail system implementation.** Tier B relies on in-game mail to surface pending-sign items. Mail system either exists already or needs building — audit current state before scheduling this work.
- **Mail item expiration policy per type.** Gifts return to sender on expiry; event attendance discards silently; achievements + guild-return items persist indefinitely. Confirm per-type defaults and make them configurable.
- **Bulk-accept UX.** "Accept all event attestations" for active guild members who accumulate many attendance rows. Should this skip individual signing (batch-signed) or still sign each row (just presented as a single click)? Batch-signed rows still need three-factor integrity — probably one signature per row, just UX batching.
- **Reject side-effect guarantees.** When a player rejects a gift, the gift returns to the giver. Giver's inventory must accept the return (they might have moved / deleted items). Edge cases TBD.
- **`SERVER_SECRET` rotation strategy.** Signatures carry a `version` so a new `SERVER_SECRET` can coexist with old signatures. Old rows don't get re-signed; verification routes to the right version of the secret. Need to document operational procedure.
- **Append-only edit history for rollback.** When tampering is detected, rollback requires knowing the last legitimate state. Implies an append-only history table of signed mutations (write-ahead log). Not strictly required for the signing scheme but required to realise its full value.
- **Canonical encoding standard.** JCS (RFC 8785 JSON Canonicalization Scheme) is the obvious choice; confirm and document.
- **Ban-list table.** Intentional exception to the no-DID-stored rule. Append-only, consulted at login, never joined against other tables. Confirm this is the right shape.
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
