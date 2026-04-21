# Performance — index

## Supplemental docs

- [`docs/binary-protocol.md`](docs/binary-protocol.md) — Binary-vs-JSON rule, wire format, opcode table, how to add a new binary message end-to-end.
- [`docs/performance-rules.md`](docs/performance-rules.md) — Delta broadcasting, sleep optimisation, entity cleanup, animation-loop rules, decoration scroll-out.

## At-a-glance

- **Default to binary** for any reliable message sent more than once per second or during combat.
- **Positions** go over the unreliable channel, batched, 20 bytes per entity.
- **Entity IDs on the wire** are `u32` hashes via `hashEntityId(str)`; client maintains `numericIdMap`.
- **Sleep optimisation:** all entities skip ticking when no player is within 32 tiles.
- **No `requestAnimationFrame` / `setTimeout`** for game-visible animation; hook Excalibur's `onPreUpdate` / `onPostUpdate` instead.
