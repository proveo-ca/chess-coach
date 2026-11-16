# Canonical native ownership and retained regressions

## Approved consolidation goal

Executor selected **Consolidate + fixes**, then **Move tests; retire shim**. [engine-consolidation.puml](engine-consolidation.puml) is the approved contract. [architecture.md](architecture.md#current-layout--move-tests-retire-shim) records current ownership and pending layout verification. The earlier scoped Bun receipts describe the pre-move consolidation snapshot, not a fresh layout PASS. Native/runtime/training qualifications remain separate.

`packages/starchess-core` owns one geometry/physics implementation. Its product root preserves SCFEN, SAN, packed replay, AI, helpers and app-facing timeline results. `@chess-coach/starchess-core/engine` exposes the narrow pure native facade. Product incoming-action admission stays soft, while native ML admission enforces classical dependencies. Validation may differ; physical resolution may not. Adding or omitting `ResolutionEffects` cannot select validation or alter physical behavior.

The approved layout retires all 27 `packages/game-core/src` forwards and its private package manifest. `packages/starchess-core/tests/native` owns all 37 retained files: 25 tests, five corpus helpers and seven JSON fixtures. Tests import the canonical `/engine` facade and explicit host-only `/causal-producer` where needed. `canonical-exports.test.ts` replaces the former compatibility check with canonical ownership/API checks and producer-free product/native closures. The seven fixtures retain byte/mode identity and raw historical source fields. The local `Square` union belongs to `starchess-core/src/model/square.ts`; product vision retains its `{ fen() }` input shape.

This document and `game-core.puml` retain their filenames so existing source `SPEC:` pointers still resolve. They no longer identify a live `game-core` runtime workspace. All 153 canonical core source files remain unchanged during this layout task; no cosmetic pointer moves are required. Current command: `bun test packages/starchess-core/tests/native`. The package's Bun-only `test:native` script remains separate from product Vitest `src/__tests__`. Fresh layout verification is pending under `artifacts/engine-layout`; historical fixtures, proof commands and frozen receipts remain untouched.

### Approved corrections and regression obligations

| Correction | Required rule and rationale | Required regression |
|---|---|---|
| Live own-Marine promotion guard | After earlier mutations, a queued promotion coordinate may hold no piece, a different unit or an enemy replacement. Promote only a surviving Marine of the action's own color at the live destination. A stale action cannot create material or transform a replacement. Apply the same rule with and without journaling. | Exercise the stale/replaced destination and a valid surviving own Marine through product and native facades; compare sink/no-sink physical results. |
| Delayed-swap mine synchronization | A delayed swap can detonate a mine after the phase-three snapshot was created. Retiring it only from the working mine list leaves stale `phase3.mines`, so the returned `afterAll` snapshot can resurrect a spent mine. Synchronize each actual removal into the phase-three result while preserving mine order, multiplicity and actual actor casualties. | Exercise a delayed swap onto a hostile mine; assert the casualty and removal in intermediate/final results and causal journal, with sink/no-sink parity. |

The `engine-consolidation.test.ts`, `compatibility-exports.test.ts` and `shared-engine.e2e.test.ts` suites passed within historical scoped Bun verification after the collector and codec corrections, before the test move and shim retirement. That pass is neither fresh layout verification nor native/runtime/training qualification. Preserve `afterPending`, `afterB`, `bMoves`, `fMoves`, events and the public result shape except for those two corrections. `GameSession` retains mineral banks, paid receipts and recipient projection; policy feature generation and Rust learning contracts do not move into the kernel.

## Scope and provenance

The historical clean rebuild selectively adapted canonical rules into `packages/game-core` from `packages/starchess-core` at `b4b241481fb12de4a7344e6dba8eda775af57675`. The approved consolidation supersedes that implementation ownership, not its retained behavioral contracts or historical provenance.

Those slices retained typed actions and snapshots, board occupancy and attack geometry, native classical moves, mine helpers, cumulative fog, path reveals, special costs, material accounting, gas overlays, planning clocks and terminal outcomes. The consolidated owner retains those rules. Product AI remains at the product root rather than entering the pure native barrel.

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

## Historical verification

The following results describe the earlier clean-rebuild source. They are not fresh regressions for consolidation or this layout, do not qualify reconstructed source and do not authorize another install, native run or training job. [architecture.md](architecture.md#current-consolidation-verification--scoped-bun-pass) records the separate historical consolidation pass. Paths below remain as recorded at the time; current retained test paths start with `packages/starchess-core/tests/native`.

`packages/game-core/tests` used Bun's built-in test runner. That pass required no third-party test framework or legacy installation. Pinned TypeScript 5.9.3 checked both source and tests, with Bun 1.4.0 type definitions. The operator explicitly approved anonymous public npm resolution with lifecycle scripts disabled. The pass recorded its cache and install log in `/tmp/opencode/chess-coach-ii-bun-T3kcLM/`. Its `bun.lock` contained five public development packages and the local workspace link. No legacy suite result verifies this layout.

A bounded direct comparison against the original canonical modules matched 98,304 attack queries across both colors, all piece types, all origins/targets and blocked/unblocked fixtures. It also matched placement/material/check enumeration and 51 turn-index cases for income, clocks, bank estimates and terminal outcomes. That comparison used the old worktree only as a read-only reference; persisted tests have no dependency on its paths.

`tests/fixtures/canonical-primitives.json` records fingerprints generated from the original modules at the recorded reference commit. `tests/canonical.test.ts` reconstructs the same corpus: file-major square order, both colors, piece order p/n/b/r/q/k, all source squares, then unblocked/blocked boards. Blockers occupy b2/c4/d5/e3/f6/g7; an opposite-color BattleShip occupies h8 unless the actor does. Move cases run without extras, then with source-square siege and mines w:c3/b:f6. Vision cases run tank then siege mode and sort lit/revealed sets. Each result contributes JSON plus LF to SHA-256. Shape cases cover all destinations for each actor. The corpus contains 1,536 boards and 49,152 shape queries.

`tests/planning.e2e.test.ts` exercises the public planning primitives from simulator placement through fog filtering to recipient move generation and shape acceptance. This is a package-level integration case, not a complete game, policy, process-isolation or training e2e claim.
