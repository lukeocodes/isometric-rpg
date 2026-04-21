# Identity, zones, and data ownership

**Status: design, not yet implemented.** All of this is forward-looking architecture. No code implements any of it yet. When the auth rewrite / zone ownership / houses / guilds ship, this is the spec they follow.

Current auth is a simplified stand-in: OAuth2 PKCE against a single `OAUTH_ISSUER` (default `bsky.social`) plus dev-login, issuing a game JWT for session tokens. The identity model below is what replaces it.

## Deep-dive

- [`docs/identity-zones.md`](docs/identity-zones.md) — full design note covering:
  - **Identity model** — ATProto OAuth → `player_ref = HMAC-SHA256(key=DID, message=email)`, DID never stored, ban-list is the one exception.
  - **Zone taxonomy** — server-authored zones, procedural zones, house deeds, primary/secondary home slots, exit-tile config.
  - **Guild / shared zones** — sharing flow, guild formation requires shared zone + guild-house item, member removal returns deed + placed items.
  - **Storage tiers** — default (DB only) vs BYOD (async mirror to custom PDS). Server is always authoritative.
  - **Row-level integrity signatures** — three-factor HMAC (`SERVER_SECRET + DID + player_ref`) makes admin tampering structurally impossible for Tier A rows.
  - **Tier B deferred countersign** — offline-user writes go to in-game mail; recipient signs on accept. Reject path for anti-griefing.
  - **Data ownership matrix** — which rows are system-owned, which are player-signed, which are BYOD-mirrored.
  - **Open questions** — mail expiry policy, `SERVER_SECRET` rotation, append-only edit history, lexicon namespace, dynamic ATProto issuer discovery.

## Rules (once implemented)

- Never store raw DIDs (except ban-list).
- Every player-authored row carries an HMAC signature bound to `SERVER_SECRET + DID + player_ref`.
- Admin / migration scripts cannot touch Tier A rows — they'd invalidate the signature.
- Server DB is the source of truth even for BYOD users; PDS mirror is a copy.
- Guilds only exist inside shared zones. No guilds in solo-owned or server zones.
