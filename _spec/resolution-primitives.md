# Deterministic collision prerequisites

Selectively adapt `board/mine-contact.ts`, `board/move-timing.ts`, `board/ray-scan.ts` and required Charon strike helpers from the canonical reference at `b4b241481fb12de4a7344e6dba8eda775af57675`. Keep the new flat package and existing geometry/vision functions. `scanRay` accepts an optional path-query tap directly; do not add a second kernel entrypoint or carry the old provenance companion implementation.

## Retained rules

- Hoverbikes travel one tick per Manhattan square; other units use two ticks per Chebyshev square. Marines, Hoverbikes and CCs are airborne between departure and landing. Ground movers hold intermediate ray squares after entering them. Departure origins are not held.
- Landing-death schedules remain present at the landing tick, then disappear. Contacts report first occupied square and tick, including head-on swaps. Swaps use the lower square name for presentation while both movers still meet.
- Mine contact selects the first matching native-order mine on each visited square, ignores own mines, clears fired-upon tiles and treats every CC contact as an attack. Walking through a hostile mine detonates it at landing and records its chase origin. A walk-then-attack clears a landing mine but still triggers an intermediate one. Consuming a spent tile removes every mine on that tile.
- Ray scanning stops at the first occupied intermediate tile. It records current visibility, first cumulative path-reveal step, discovery tile and previous safe tile. Path taps observe the exact geometry query; they do not establish authentic resolver consumption by themselves.
- Charon targets only the first BattleShip on each diagonal. Other piece types do not screen it. Allied BattleShips screen but cannot be killed. A paid fire-and-forget action can use its bound side after the original Mecha disappears. Fizzle edges extend diagonal or orthogonal rays; non-rays keep the authored target.

The functions consume trusted typed rule inputs. They are not arbitrary JSON decoders. [turn-resolution.md](turn-resolution.md), [causal-journal.md](causal-journal.md) and [recipient-production.md](recipient-production.md) now record the implemented simultaneous composer, actual mutation effects, causal recipient witnesses, paid receipt/bank ownership and deterministic source replay. Runtime-owned protocol and independent native/reference qualification remain pending. The operator approved a new typed causal-event journal in [provenance.md](provenance.md); do not restore the old frame/proof framework by copying its names.

## Verification

The direct comparison against canonical modules matched 49,152 schedules, 294,912 mover contacts, 98,304 mine queries, 98,304 Charon queries and 13,824 ray queries. `tests/resolution-corpus.ts` defines those finite synthetic cases. The JSON-plus-LF SHA-256 fingerprints are persisted in `tests/fixtures/canonical-resolution-primitives.json`; project tests do not read the old worktree.

The timing corpus covers all 64 origins/targets, six unit types, landing-death variants and reversed opposing schedules. Mine cases cover both sides, all unit/contact modes, endpoint/intermediate mines and overlapping native mine orders. Charon cases cover missing actors, bound sides, nonship transparency, allied/enemy screens and fizzle edges. Ray cases preserve evaluated taps as well as discovery results across both sides, all actor squares/types, siege modes and blocker variants.

Unit cases independently pin the named edge conditions. `collision-primitives.e2e.test.ts` composes mine chase, landing-death timing and contact cancellation without mutating source mines. It is a primitive API integration case, not a complete resolver, game, provenance journal or host-boundary e2e.

All 27 tests in the three resolution-prerequisite test files pass. The full Bun workspace passes 238 tests with 5,168 assertions. Strict TypeScript analysis and native syntax/render verification of all ten diagrams pass.
