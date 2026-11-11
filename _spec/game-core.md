# Canonical game migration

## Scope and provenance

`packages/game-core` selectively adapts the canonical rules from `packages/starchess-core` at `b4b241481fb12de4a7344e6dba8eda775af57675`.

The first slices retain typed actions and snapshots, board occupancy and attack geometry, native classical moves, mine helpers, cumulative fog, path reveals, special costs, material accounting, gas overlays, planning clocks and terminal outcomes. These support deterministic game integration without carrying old AI planners or operational tooling. Public API names stay recognizable; the old directory structure and compatibility-only aliases do not move.

The `Square` template-literal type represents the same 64 squares without depending on chess.js for a type-only import. StarChess attack rules, not chess.js move legality, own board geometry. Placement helpers operate on canonical placements; this slice does not claim to validate arbitrary serialized input.

## Retained semantics

- White Marines attack diagonally toward increasing ranks; black Marines attack toward decreasing ranks.
- Sliding attacks stop at intervening occupancy; leap attacks ignore it.
- Command Centers can attack each other from adjacent squares.
- CC checks use the attacking side's visibility callback, not per-attacker vision.
- CC checks sort white before black, then by origin square.
- Income tiers are 1 through turn 10, 2 through turn 20, and 3 thereafter.
- Gas refills each turn; it does not accumulate.
- Planning clocks are 10,000 / 15,000 / 22,000 ms by income tier.
- Stored material caps at 12; opening banks hold 3; deployed material uses canonical piece costs.
- Snapshot gas already includes queued spends; overlay accounting skips matching queued sequence numbers.
- Both CCs dead yields a draw; one dead yields the other side's win; at turn 45, remaining CC lives decide.
- A Marine's classical double is positional: white ranks 1–2, black ranks 7–8. Intermediate and destination occupancy block it.
- Empty Marine diagonals require a hostile mine target; promotion defaults to BattleShip (`q`).
- Sieged Tanks fire along the whole cross without relocating; intent generation leaves interception to resolution.
- CC-target classical intents carry `dropsAtResolve`; move generation does not implement resolution.
- Mine path contact excludes Hoverbikes and Command Centers. The actual canonical mine cap is 3 per side, despite stale comments in the reference types describing 2.
- Fog unions friendly-unit geometry and own mine tiles. Mecha pings reveal BattleShip pieces without lighting their tiles. Cumulative light removes redundant pings.
- Recipient move planning must not read unseen opponent occupancy. Shape-only intents may cross unseen blockers; resolution discovers them later.

## Pending

Queue eligibility helpers and authoritative gas-aware queue edits have a separate contract in [turn-planning.md](turn-planning.md). The simultaneous composer, actual-mutation journal, continuing recipient producer, explicit mineral/receipt owner and source-bound replay now have separate contracts and persisted tests. Preserve private engine identity at the resolution boundary. Runtime-owned admission/session/reference verification remains pending. Do not wire a learner directly to hidden simulator snapshots or expose authoritative hidden-dependent refusals to a policy.

Canonical initialization now has a separate contract in [initialization.md](initialization.md). It creates the actual public opening, endowed identities and both initial recipient observations. It does not implement continuing causal observations, turn settlement or the cold F9 process proof.

Deterministic collision prerequisites now have a separate contract in [resolution-primitives.md](resolution-primitives.md). They preserve canonical travel/contact, ordered mine effects, cumulative ray discovery and Charon targeting. They do not implement a complete simultaneous turn or the newly approved causal-event journal.

[classical-resolution.md](classical-resolution.md) specifies the implemented classical attack, movement, path-reveal and promotion phase, pending CC shots and live path-application helpers. [turn-resolution.md](turn-resolution.md) covers the implemented complete B/C/F composer. Full-result reference parity covers 122,160 classical fixtures and 11,045 complete-turn fixtures. [causal-journal.md](causal-journal.md) records the implemented actual-mutation journal and its matching sink-parity suite. [recipient-production.md](recipient-production.md) records separate continuing recipient/economic data ownership and deterministic source replay. These bounded static fixtures do not establish supervised independent-reference F9 qualification or training readiness.

## Verification

`packages/game-core/tests` uses Bun's built-in test runner. No third-party test framework or legacy installation is required. Pinned TypeScript 5.9.3 checks both source and tests, with Bun 1.4.0 type definitions. The operator explicitly approved anonymous public npm resolution with lifecycle scripts disabled. The fresh cache and install log remain in `/tmp/opencode/chess-coach-ii-bun-T3kcLM/`. `bun.lock` contains five public development packages and the local workspace link. No legacy suite result verifies this branch.

A bounded direct comparison against the original canonical modules matched 98,304 attack queries across both colors, all piece types, all origins/targets and blocked/unblocked fixtures. It also matched placement/material/check enumeration and 51 turn-index cases for income, clocks, bank estimates and terminal outcomes. That comparison used the old worktree only as a read-only reference; persisted tests have no dependency on its paths.

`tests/fixtures/canonical-primitives.json` records fingerprints generated from the original modules at the recorded reference commit. `tests/canonical.test.ts` reconstructs the same corpus: file-major square order, both colors, piece order p/n/b/r/q/k, all source squares, then unblocked/blocked boards. Blockers occupy b2/c4/d5/e3/f6/g7; an opposite-color BattleShip occupies h8 unless the actor does. Move cases run without extras, then with source-square siege and mines w:c3/b:f6. Vision cases run tank then siege mode and sort lit/revealed sets. Each result contributes JSON plus LF to SHA-256. Shape cases cover all destinations for each actor. The corpus contains 1,536 boards and 49,152 shape queries.

`tests/planning.e2e.test.ts` exercises the public planning primitives from simulator placement through fog filtering to recipient move generation and shape acceptance. This is a package-level integration case, not a complete game, policy, process-isolation or training e2e claim.
