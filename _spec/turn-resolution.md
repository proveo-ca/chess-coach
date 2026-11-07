# Canonical full-turn composition

## Goal

Migrate canonical `beginScTurn` / `endScTurn` physics from `packages/starchess-core/src/resolve/submit-turn.ts` at `b4b241481fb12de4a7344e6dba8eda775af57675`.
Compose the current queue/dependency/mine/Charon primitives and [classical settlement](classical-resolution.md).
Preserve heads-first B order, held Marine mine walks, positional rewrite/identity checks, promotions, F same-actor anchors, fire-and-forget Charon, siege and jump contacts.

## Boundaries

The canonical kernel owns physical settlement and its timeline consequences.
It does not issue a session or a model planning permission.
Timeline event IDs and final snapshots do not authenticate a recipient loss witness.
The approved typed causal journal still needs actual-mutation integration.

Keep ephemeral native actor/transfer identity only for rule-level positional double eligibility.
Pass the rules-derived result directly to the internal classical composer.
Do not migrate the old WeakMap consume protocol or its companion wire.
The public classical entrypoint still grants no native-double override.

Turn-open chips grant no mineral income.
The separate mineral owner must retain explicit banks across every kernel result and apply actual settlement grants/debits/receipts.
Do not infer historical payments or restore missing bank fields with a turn-based estimate.
Canonical core result fields alone are not the complete game/learning state.

## Verification

Persist canonical complete-result fingerprints for bounded both-seat special/classical combinations, identity-replacing B effects, ordering, mine continuation, F anchors, promotion and terminal chips.
Keep positive init/open/pass process proof separate from source-level fixtures.
Do not run gameplay collection, training, Docker or publication under source verification.

Direct comparison with the original canonical modules passed all 11,045 fixed cases: 9,318 settled outcomes and 1,727 retained rejections.
The corpus crosses 47 authored queues per side across five mine/siege/actor-placement variants.
`packages/game-core/tests/fixtures/canonical-turn-resolution.json` records full-result fingerprints.
`packages/game-core/tests/canonical-turn.test.ts` reconstructs begin, real queue admission and settlement without importing the old worktree.
`packages/game-core/tests/turn-resolution.test.ts` and `turn-resolution.e2e.test.ts` cover native Marine transfers, held/chasing mines, F anchors, last-rank behavior, Charon after actor death, siege, jump collisions and terminal chips.
The direct-comparison script and result remain in `/tmp/opencode/chess-coach-ii-classical-reference-OYFKqn/`.

## Remaining

[causal-journal.md](causal-journal.md) now records actual-mutation events, persistent identities and native snapshot checks.
[recipient-production.md](recipient-production.md) records the implemented continuing recipient, explicit bank/receipt ownership and deterministic source-level replay.
Supervised native/reference qualification remains pending.
No F9 or training-readiness claim follows from kernel parity or the source-level fixtures.
