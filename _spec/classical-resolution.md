# Canonical classical settlement

## Goal

Migrate the canonical classical phase from `packages/starchess-core/src/resolve/resolve-turn.ts` at `b4b241481fb12de4a7344e6dba8eda775af57675`.
Preserve game behavior without migrating the old provenance companion wire or authorization machinery.
This phase consumes the already verified mine/contact/travel/ray primitives.

## Retained order

Apply these first-matching plan rules in order: jump immunity, blocked Marine forward step, enemy CC destination, own occupied destination, empty Marine diagonal, upstream ray contact, occupied target, mined empty target, sliding fog contact, sieged empty shelling, quiet fallback.
Evaluate both plans against the same starting board.
Apply direct casualties as one attack wave before relocation.
Resolve occupant/quiet movers with actual travel contact and mine landing timing.
Apply deferred path-reveal captures and CC shots against live operands.
Resolve delayed departures/swaps, spent mines and final live promotions in canonical order.

Keep CCs out of ordinary unit destruction.
Moving CC contacts preserve canonical stop/capture behavior.
Spend all mines on a consumed tile while preserving first-matching mine selection.
Preserve B/C/F Marine walk annotations and positional native-double permission from the trusted turn composer.
Public `resolveTurn` has no caller-supplied native-double permission.
The internal composer entrypoint takes rules-derived context, not a serialized authorization flag.

## Verification

Persist reference fingerprints for same-window pairs, fog modes, mines, siege, move timing, path discovery and promotions.
Test pending CC shots and path-application operand changes separately.
Compare actual outcomes and all intermediate public resolver results, not just the final placement.
Use bounded static fixtures; no standalone game rollout or collection follows.

Direct deep comparison passed 122,160 fixed reference cases across six actor-origin pairs, both piece families, pass and all shape-valid destinations, four visibility/mine/blocker/siege variants, Marine walk annotations and promotion choices.
`packages/game-core/tests/fixtures/canonical-classical-resolution.json` records the reference fingerprints.
`packages/game-core/tests/canonical-classical.test.ts` reconstructs the corpus without importing the old worktree.
The temporary direct-comparison script and result remain in `/tmp/opencode/chess-coach-ii-classical-reference-OYFKqn/`.
`packages/game-core/tests/classical-resolution.test.ts` adds attack-wave, swap, simultaneous arrival, CC contact, mine timing, promotion, siege, pending-shot and live-operand fixtures.
The original classical source verification passed 275 tests / 5,380 assertions.
[verification.md](verification.md) records the latest complete suite, including full-turn, journal, continuing-recipient and replay checks.

## Scope limit

This migrates canonical classical physics.
[turn-resolution.md](turn-resolution.md) records the implemented B/F composer.
[causal-journal.md](causal-journal.md) and [recipient-production.md](recipient-production.md) record the separate actual-mutation sink, continuing recipient projection, bank/receipt ownership and source-level replay.
Supervised independent-reference F9 qualification remains unfinished.
Do not derive witnessed losses from the final board or claim that physics output alone authenticates a recipient batch.
