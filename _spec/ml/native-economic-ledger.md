# Native economic ledger — foundation goals and reasoning

**2026-10-17 · CLOSING STILL BLOCKED PENDING REVALIDATION · ALL THREE SOURCE REPAIRS HANDED OFF / SPECIFIC RED→TRAINING-LEAF GREEN · SOURCES FROZEN · FRESH WHOLE GATE STARTING / RESULT PENDING · REREVIEWS FORBIDDEN UNTIL PASS.**

Executor selected **Ledger first (Recommended)**: establish engine-driven accounting and replaceable future encoder inputs before full economic belief/features or a learner.
The [PR plan](../_plans/native-economic-ledger.md) owns delivery scope, acceptance, planned tests and the reviewer lock.
This document owns the accepted v2 boundary and reasoning. §9.3 preserves the actual **pre-repair** gate; §9.5 records the subsequent blocking findings and current repair lock, not repaired-source proof or final acceptance.
The late handoff's base Rust/Node modules, controls and shared fixture now exist; this author read their source to author the existing two diagram owners, not to conduct a closing review.
The original v3 receipt records29 PASS commands and matching identity3640bb…, but that run predates the adversarial HIGH/MEDIUM/LOW findings. Earlier leaves and that actual whole pass remain historical, never stitched into repair proof.
The additional host-only terminal training closeout in §7.3 is now present in the completed host handoff, including checked chronology, nullable report output and controls in the same three existing files.
The original whole run independently recorded **279 Rust /150 Node /668 core**. Actual security/DevOps approvals bind that input only; adversarial returned `READY TO MERGE:no`, and the lead has invoked no rereviews.
All three minimal source repairs are now handed off with their specific persisted failures executed before each fix and a supplied **152 unfiltered training PASS** leaf, including history42/contracts36, all-targets check, Clippy-Dwarnings and owned fmt.
The Node producer leaf is separately152/types/lint PASS. The actual fixed-fixture v2 native-journal host control is present with its pre-fix RED; no host post-repair GREEN is claimed before the fresh full run.
The lead has read the repair/control handoffs and frozen source; a complete `cargo xtask check` is **STARTING** in the background, result/receipt/new identity pending. No reviewer has resolved the findings yet.

## 1. Scope, history and non-goals

[Unverified] The lead reports the last requested commit/push completed at published HEAD `df968b5c33b432a3901f8cb91296b06deb394230`.
This author performs no Git operation or verification of that report.
The completed [native runner milestone](native-runner.md) remains frozen, including its earlier repository-state statements.
Current navigation supplies chronology without rewriting those historical bodies.

The old G3/G4 proof records source `f5ad0c3ea838cec3ff537e6533c9404fe5e5b7d6f89355f4cc07579a6365099f`, all 29 commands, 180 Rust / 93 Node / 668 core tests and three bounded READY closing reviews, as supplied by the lead.
Those receipts establish only their original baseline scope. The later ledger receipt in §9.3 is also now historical pre-repair evidence, not a current repaired-source or training-readiness pass.
Baseline N1–N3 closure does not close the distinct legacy R4 N1–N7 HIGH candidates, M2, inventory or resource/public-closure stops.
No new ledger gate borrows their passing results or reviewer verdicts.
[Unverified] The lead separately reports 30 root-xtask leaf tests plus Clippy/fmt PASS; this result and the shared-contract leaf's 32 do not constitute a whole economic-ledger gate or a combined test total.

Deliver calculated entitlement, exact own accounting, authorized observations, witnessed losses and causal lineage as a reusable foundation.
Do not require a production hidden-economy estimator, posterior, PMF, payout calibration, 418 feature encoder or learner core to complete this slice.
Do not claim parity with the frozen 418 interface, its feature semantics or its eventual wire boundary.
Those contracts remain frozen and pending, not superseded by an underspecified new ledger.
No synthetic 418 padding or `ready:true` field supplies missing semantics.

Keep the six-owner [graph](projects.yaml), project status files, [legacy R4 record](R4.md), accepted bodies, historical failures, pins, evidence and corpora unchanged.
Retain the existing two Rust [training](../packages/training/burn-compat.puml) / [arena](../apps/arena/burn-compat.puml) diagram owners. Their latest pre-gate bytes, including lead-aligned lifecycle-neutral status headers/legends, passed syntax/bounded SVG checks in the same source identity; this post-gate pass changes only the two ledger Markdown documents.
Source contains instructions, `SPEC:` pointers, directives and WHAT labels, not copied reasoning from this document.
The ledger and host closeout do not change game rules, production legacy consumers, raw grants/history, frozen D+B truth labels or baseline W/D/L.
Preserve serialized v1/v2 bytes, closed grammar, live mutation semantics and replay logic, not an impossible blanket freeze of every adapter source file.
The accepted implementation permits passive fixed-transport extraction to `apps/arena/src/worker_transport.rs` and integration in `engine_v2.rs` without wire/behaviour changes.

The original ledger-slice grant authorized none of the empirical/training/publication operations deferred at that checkpoint; preserve that historical scope.
Executor has now separately authorized verified milestone **commit + push**, held by the lead until the ledger HIGH repair/fresh gate/resolving reviews, and selected **Training-ready (Recommended)** for following pre-training implementation and required bounded LOCAL empirical work (§11).
That later grant permits required local collection, belief-table fitting/calibration, profiling and container validation, not actual policy training, activation, deployment, engine/frozen-contract changes or protected corpus/data rewriting. No new operation is claimed executed by this authoring pass.
This authoring task runs no commands, tests, renders, hashes, reviewers or nested agents and writes no implementation or evidence.

## 2. Native authority: defaults, fixtures and rule facts

### 2.1 One source of economic rules

The current source anchors are `packages/starchess-core/src/rules/constants.ts`, `rules/economy.ts`, `rules/specials/registry.ts` and the public exports in `src/index.ts` / `src/planning-v1.ts`.
Node must import their native defaults/helpers rather than authoring another rule table in Rust.
Rust must validate bounded, versioned facts and use them for accounting; Rust must not become an independent authoritative income calculator.

| Native fact | Current value/behaviour to preserve |
|---|---|
| `OPENING_STORED_MATERIAL` | 3 minerals per seat at the public default opening. |
| `MAX_STORED_MATERIAL` | Bank cap 12. |
| `incomeForTurn(turn)` | 1 through turn 10; 2 through turn 20; 3 later. Native `applyStoredIncome` normalizes its turn argument to at least 1. |
| `energyForTurn(turn)` | Same tier schedule, normalizing turn 0 to tier 1; capacity refills instead of accumulating. |
| `UNIT_COST` | Native `k:1, p:1, n:3, b:3, r:5, q:9`; accounting must not change the CC cost. |
| `specialGasCost` | Native special-specific debit, not a blanket one-gas replacement table. |
| `MAX_MINES_PER_SIDE` | 3 entities; duplicate squares still consume entity capacity. |

The frozen serializable `LedgerRules` version is `arena-economic-rules-v1`, with fields:

```text
version
openingBankDefault
unitCosts { p, n, b, r, q, k }
mineralBankCap
mineEntityCap
maxTurn
incomeByTurn[46]
gasCapacityByTurn[46]
```

Node constructs the 46-entry turn tables from actual native helpers, including index 0, rather than copying a tier formula into Rust.
Rust consumes the native-derived tables and closed bounded facts; a caller cannot select arbitrary rules or override constants.
Native admission supplies each accepted action's exact mineral/gas facts; do not add an unfrozen special-cost table to `LedgerRules`.
Settlement entitlement uses the native profile income table at the actual settled turn.
Gas reset/refill facts use native values at their actual boundaries.
Initial and settled snapshot `gasIncome` agree with the profile at their current native turn; a normal playable open refills the capacity already updated by settlement.
The technical turn-open validation carries the previous snapshot's `gasIncome`; preserve game-ending raw snapshots as specified only in [Appendix A](#appendix-a-regression-only-game-ending-native-turn-start), rather than treating their counter as a new playable turn.
Rules travel only in `economic.start` success, not again in each operation.
Reject a mismatched profile rather than silently substituting Rust defaults.
For ordinary replacement accounting the king contributes 0; native `unitCosts.k = 1` and separate CC lives remain unchanged.

### 2.2 Distinguish a default opening from a fixed fixture origin

Preserve `apps/arena/engine/fixtures.ts` exactly:

| Fixture | Native starting turn / mineral bank | Ledger origin requirement |
|---|---|---|
| `tiny-v1` | 0 / 3 for both seats | Use the actual native state and opening endowed units. |
| `standard-v1` | 0 / 3 for both seats | Use the actual native state; do not elevate it to the only supported ledger fixture. |
| `all-actors-v1` | 21 / 12 for both seats | Start accounting at this declared native origin, not a fabricated replay of turns 0–21. |

A fixture's starting pieces are endowed with paid mineral basis 0, irrespective of their current replacement value.
A later-turn fixture's bank is its actual opening ledger bank; it does not prove a prior purchase or income history.
The ledger origin is explicitly `record-initial-forward`.
Keep the public default opening 3 in the rule profile while separately carrying the actual recipient origin receipt.
Do not overwrite a fixed fixture bank with the default.
Test the actual engine opening constructed from public defaults/helpers in addition to the unchanged fixed fixtures.

The new ledger should structurally support all three fixed fixtures.
A canonical-standard restriction needed by a future complete belief model is not a ledger restriction.
Test-only causal edge states may exercise free promotion, duplicate mines and terminal chips without changing a corpus or an existing fixture.
If an unchanged native companion rejects a state, report that explicit limitation; do not change the core or erase multiplicity to manufacture support.

## 3. Frozen boundary, atomic groups and causal locators

Native turn is not an income-event counter.
Existing `apps/arena/engine/session.ts` and `replay.ts` retain banks across native results and apply `applyStoredIncome` exactly once after settlement using `rawResolve.next.turn`.
Their nonterminal/terminal begin path applies no mineral grant, even if begin chips advance the native turn.
The new independent economic reconstruction must agree with those recorded operations without importing either live mutation implementation.

### 3.1 Boundary time and sequence

`arena-economic-boundary-v1` carries the following frozen fields:

```text
version, side, ordinal, phase, turn
planningOrdinal, grantOrdinal, seqBefore, seqThrough
groups, snapshot
phase = initial | turn-open | settled
snapshot = existing AuthorizedView v2, unchanged
```

| Boundary | Time/sequence invariant |
|---|---|
| Initial | Boundary/planning/grant/sequence counters are zero and groups are empty. Native turn/snapshot reflect the fixture, including turn 21 for `all-actors-v1`; `gasIncome` agrees with the current-turn native profile. |
| Window k turn-open | `planningOrdinal=k`, `grantOrdinal=k`. A playable open refills the preceding settled capacity; the requested-operation boundary can also describe a game-over return, whose raw preservation belongs to [Appendix A](#appendix-a-regression-only-game-ending-native-turn-start), not the normal schedule. |
| Window k settled | Boundary planning/grant ordinals advance to k+1; action refs retain admitted k. `gasIncome` agrees with the settled-turn profile; native end available gas is 0. |
| Recipient sequence | `seqBefore`/`seqThrough` delimit contiguous authorized groups, allocated only after filtering empty private groups. Hidden native frame positions never determine public gaps. |

**NORMAL SETTLEMENTS — public schedule for turns 1, 11 and 21.**
Node constructs these nominal facts from native helpers/profile tables; Rust does not own a duplicate schedule.
Each row applies equally to both seats at an actual settlement, not merely when a turn number appears in a snapshot.

| Normal playable turns / tier starts at | Actual nonterminal settlement crossing | Nominal mineral entitlement, White / Black | Next playable-turn gas capacity, each seat |
|---|---|---|---|
| **1–10 / turn 1** | **0 → 1** | **1 / 1** | **1** |
| **11–20 / turn 11** | **10 → 11** | **2 / 2** | **2** |
| **21–45 / turn 21** | **20 → 21** | **3 / 3** | **3** |

Turn 0 initialization supplies the fixture bank/endowment and zero grant ordinal; it is **not** an income grant.
The first actual 0→1 settlement grants nominal 1 and sets next capacity 1, rather than treating initialization as the first grant.
At 10→11 settlement the nominal entitlement/next capacity become 2; at 20→21 settlement they become 3.
These capacity updates occur after **settle**; native end available gas remains 0 and the following **open** refills the carried updated capacity.
Gas capacity/reset is not additive wealth.

Equal nominal entitlement does not imply equal actual credits: cap-limited credits may differ or be zero.
A real settlement still emits one grant fact and advances its grant ordinal exactly once even when actual credit is zero.
[Unverified] The lead executed ad hoc native pass-settlement probes for all three origins 0/10/20: they produced turns 1/11/21, nominal entitlement 1/2/3, actual credits 1/2/3 from bank 3, and next capacity 1/2/3.
Those early observations remain ad hoc history, not the proof now supplied by the actual persisted threshold controls in the complete gate.

A capped credit of zero still consumes its one grant ordinal.
A zero-credit Settlement remains a public grant fact, not an empty private group to filter out.
An actual terminal end settlement still grants once.
An abandoned/unverified operation cannot acquire a grant because the turn appears to have advanced.
Rejected pairs emit no Admission receipts, mineral/gas debits, Settlement group or grant.
Do not derive cumulative income by summing every numeric native turn since zero or by comparing only final banks.
Snapshot observation v2 stays closed and unchanged; economic facts live in the new boundary, not new fields on that old DTO.
Game-ending native turn-start returns are isolated raw-snapshot preservation cases in [Appendix A](#appendix-a-regression-only-game-ending-native-turn-start), not another public economy schedule or a next playable turn.

### 3.2 Atomic group grammar

Each closed `AtomicGroup` has `kind` and `seq` plus its variant payload:

| Kind | Payload |
|---|---|
| Admission | `actions: AcceptedOwnAction[]`, each with `actionRef{planningOrdinal,acceptedActionOrdinal}`, `action`, `minerals`, `gas`. |
| Effects | `beforeOwn`, `afterOwn`, `facts`. These are native causal facts, not inferred final-board differences. |
| Vision | `turn`, `changes`; at most 64 changed cells. Memory records square assertions, not a unique enemy population. |
| Settlement | `entitlement`, `credited`, `gasBeforeReset`, `nextGasCapacity`. |

At most 2048 groups and 2048 total admission/effect entries fit a boundary; the independent 1-MiB reply bound also applies.
Oversized complete output refuses; there is no chunking, loss truncation or dropped-group fallback.
The actual shared contracts serialize object fields in camelCase and group/subject/effect tags in kebab-case, with closed object decoding and required nullable fields.
Use those definitions rather than permissive shape aliases.

### 3.3 Own geometry and locator subjects

```text
OwnGeometry:
  units[{square,type,mode: tank | siege | null}]
  mines[{square,slot}]
  ccLives

UnitSubject:
  {kind: before-unit, square}
  {kind: born-unit, actionRef}

MineSubject:
  {kind: before-mine, square, slot}
  {kind: born-mine, actionRef}
```

Units use canonical file-major square order.
Filter native mine order to the recipient's own entities before assigning per-square occurrence slots 0..n-1; output mines sorted by `(square,slot)`.
Slots preserve duplicate-square entity multiplicity without exposing global native mine identities or order gaps.
They are group-local locators, not durable lineage IDs.

Node emits locators and native causal facts only: no durable IDs, paid basis or ledger-state arithmetic.
Rust resolves subjects against the **whole immutable `beforeOwn` plus same-group births**, mints durable recipient-local IDs and stages the entire group before reconciling `afterOwn`.
Do not mutate occupancy after every fact and reject an intermediate collision: simultaneous swaps and same-cell destruction/replacement can be valid once the whole group is applied.
Reject a missing/ambiguous subject or final geometry mismatch rather than consulting private global identity in Rust.
Native mode fidelity is also required: same-cell new-rook replacement can preserve native Siege without a separate mode-change fact. The handed-off repair inherits mode **only** for an authorized same-square old-Rook retirement plus new-Rook birth, using the immutable preimage and explicit mode facts, not arbitrary postimage mode. The new unit receives a new ID/paid5 basis distinct from the endowed old unit's basis0; unrelated/empty-square negatives remain Tank. Reviewer closure for LEDGER-ADV-1 awaits the new whole pass/rereview.

### 3.4 Closed effect facts

| Effect kind | Fields beyond `kind` |
|---|---|
| `unit-born` | `actionRef, square, type` |
| `unit-moved` | `subject, from, to` |
| `unit-transformed` | `subject, fromType, toType` |
| `unit-mode-changed` | `subject, before, after` |
| `unit-destroyed` | `subject, square, type` |
| `deployment-unmaterialized` | `actionRef` |
| `mine-born` | `actionRef, square` |
| `mine-removed` | `subject` |
| `cc-lives-changed` | `before, after` |
| `enemy-destruction-witnessed` | `square, type, ownActionRef` with `ownActionRef` required-nullable |

Filter empty private groups before assigning recipient `seq`.
Order facts by recipient-visible keys while respecting causal order for each subject; native IDs, raw frame indexes, source-effect keys and private sort-key gaps cannot cross the boundary.
Rust owns lasting identity/accounting; Node owns causal authorization/projection.

## 4. Calculated, seen, captured and lost are different facts

### 4.1 Calculated: entitlement and native costs, not omniscience

Both seats use the same **nominal** grant schedule at each settlement.
The amount actually credited can differ because their retained banks can hit cap at different times.
For host verification, native `applyStoredIncome` supplies both transitions; the recipient ledger receives only its own exact actual credit and public nominal facts.
Equal nominal entitlement never licenses an exact hidden opponent bank or an exact opponent credit history.
Observed spend, a captured unit or a visible replacement price does not supply that missing history.

For recipient `s`, use exact integer receipt accounting:

```text
originBank[s] + sum(actualMineralCredits[s])
              - sum(acceptedMineralDebits[s]) = currentOwnBank[s]

paidMineralDebits[s] = survivingPaidBasis[s]
                    + destroyedPaidBasis[s]
                    + wastedPaidBasis[s]
```

Pre-settlement debits and settlement credits remain separate receipts with distinct causal references.
Reject negative/overflowing balances, prices inconsistent with native facts or unmatched payments.
Do not reconstruct actual credits from the nominal schedule alone.
The host can verify cap arithmetic privately without publishing the opposing bank.

Gas is a per-turn budget, not cumulative wealth:

```text
gasBeforeReset = openAvailableGas - sum(acceptedOwnGasDebits)
unusedDiscard = gasBeforeReset
native end available gas = 0
next open gasIncome = previous snapshot.gasIncome
next open available gas = that carried native capacity
```

The Settlement group's `nextGasCapacity` describes the native settled capacity; it does not credit spendable gas into a settled snapshot that native end resets to 0.
In normal play, the previous snapshot is the newly settled snapshot with its updated capacity; the following playable open refills that capacity.
Check initial/settled `gasIncome` against the current-turn profile and open `gasIncome`/available gas against the carried previous snapshot instead.
Actual 0→1 / 10→11 / 20→21 settlements set next capacity 1 / 2 / 3. The separate game-over raw-snapshot check is in [Appendix A](#appendix-a-regression-only-game-ending-native-turn-start), not this next-playable-turn calculation.
Discard unused gas rather than carrying it as wealth or adding a gas grant to minerals.
Rejected admission pairs create no accepted gas-debit receipt.

### 4.2 Seen: current authorized cells plus timestamped memory

Current observations describe only recipient-authorized squares at their exact boundary/checkpoint.
Memory records what the recipient last observed and when; it does not assert current occupancy behind fog.
Repeated sightings update evidence without adding another economic asset or another member of an inferred enemy population.
Do not sum square memories as if all remembered units coexist or have unique persistent identity.
Unknown cells preserve last-seen assertions; lit own/empty cells and matching witnessed death clear the corresponding memory.
Only lit observations add `everLit` coverage; refreshed authorized visibility updates `lastObservedTurn` without exposing private-only checkpoint counts.

Rust tracks own entities exactly from filtered locators, including the mine multiset.
Enemy memory consists of timestamped square assertions, not private persistent entity IDs or unique-population claims.
Recipient-local durable IDs and contiguous group sequences must not reveal global entity counters, omitted hidden events, global frame gaps or source-effect keys.
Rust ID minting depends on filtered authorized history, not hidden allocation order; Node does not mint lasting IDs.

### 4.3 Captured: witnessed enemy ordinary loss

Require actual ordinary-unit destruction and its matching causal-before victim.
Recipient visibility at that causal position or a real matching consumed capture proof must authorize the witness.
A unit absent from a later board, a stale memory or a hidden death is not a witnessed capture.
Final-board differences cannot establish transient visibility or the causal actor.

The witnessed effect's `ownActionRef` identifies a native **recipient source action**, not the owner of a killer.
Keep it required-nullable: use an authorized recipient action reference when native source binding proves one, otherwise null; never expose an enemy action reference.
Report the non-null subset as `ownActionCausedWitnessedEnemyDestruction`, not an unqualified kill-ownership statistic.
A mine-trigger effect can bind to its victim's action; that source attribution does not prove killer ownership.
Planned targets, final geometry and hidden native queries cannot manufacture attribution or a witness.
Do not infer the enemy unit's paid basis from its type; it may have been endowed or freely promoted.
Native current ordinary replacement value can remain a separately labeled valuation fact.
Keep CC shots/lives separate from ordinary captured material.

### 4.4 Lost: exact own paid basis, separate replacement and waste

Accepted own deployment payment must bind to exactly one native deployment disposition.
If materialized, move that payment into the created own entity's surviving paid basis.
If not materialized, record paid wasted deployment; a charged but unrealized deployment is not a free refund or a fabricated destroyed unit.
If the materialized entity dies later in the same settlement, preserve its creation and destruction lineage rather than classifying it from the final board alone.

Opening endowed entities have paid basis 0.
Promotion creates no mineral debit and preserves the entity's paid basis, even when its current replacement cost changes.
When an own ordinary entity dies, move its exact existing basis from surviving to destroyed once.
Report current ordinary replacement value separately; it answers a different question from sunk payment.
CC-life changes belong in their own ledger and ordinary king replacement is 0; preserve native `UNIT_COST.k = 1` unchanged.
No captured/seen fact increases an own bank or creates a paid receipt.

## 5. Independent reconstruction and authorization pipeline

### 5.1 Single economic pass, not policy replay

The accepted additive path is `arena ledger --record <file>`, one fixed `worker-economic.ts` process with `arena-economic-v1` and one independent native-consequence reconstruction.
This **supersedes** the earlier two-pass/native+policy prerequisite: ledger does not call existing `replay_record`, regenerate selectors/candidates/seeds, certify policy choices or construct `VerifiedRun`.
The report must explicitly state `policyVerification:not-executed`.
Existing `arena replay` remains the independent native+policy verification owner; no ledger capability implies that separate result.

Do not change serialized `arena-engine-v1` / `arena-engine-v2` bytes, closed DTOs, live mutation semantics, replay logic, `arena-run-v1`, baseline suite/evaluation reports, selectors or seeding.
Add the ledger command/help separately without altering existing command behaviour.
Passive fixed-transport extraction into `worker_transport.rs` with `engine_v2.rs` integration is allowed implementation work; it must preserve protocol, limits and behaviour.
Do not add economic payloads to an old closed wire object or describe this permitted extraction as a requirement to preserve those source files byte-for-byte.

The host reads the existing up-to-16-MiB record without rewriting it.
Economic reconstruction starts independently from its fixed fixture, stages recorded queues through actual native admission and invokes unchanged `initializeProvenance`, `beginTurnWithProvenance` and `endTurnWithProvenance`.
Bind admitted planning/action ordinals and seats to actual native action sequences.
For rejected pairs, preserve native rejection evidence but produce no admission/debit/settlement/grant receipts.
Retain private provenance across calls; no endpoint accepts caller-supplied hidden state, provenance or an executable.

Compare **every** recorded native initial/open/committed/settled state, authorized view, bank, grant, raw begin/resolve, request, rejection witness, final stop and outcome against reconstruction.
Include trailing begin/close facts for terminals, window limits and checked failed prefixes; a host window limit is not a native draw.
Use the same retained-bank/native-income convention without using recorded snapshots as successor authority.
New causal frames come from the unchanged companions, not a nonexistent old-record field.
No production import from old `packages/starchess-arena` or `packages/starchess-training` is permitted.
Never import a `.test.ts` module as an oracle; the existing test-only legacy public V3 export oracle stays test-only and unchanged.

### 5.2 Fixed protocol and file responsibilities

The exact approved integration handoff is persisted below so the contract does not depend on a temporary coordination file.
Its supplied origin is `/tmp/proveo-opencode-runtime-cache-1000-21d690750d3738af14d58c25/tmp/opencode/economic-ledger-wire-handoff.md`.

```text
request = {protocol,id,op,...operationFields}
success = {protocol,id,ok:true,result}
failure = {protocol,id,ok:false,error:{code,message,context,witness}}
protocol = arena-economic-v1
```

`context` and `witness` are REQUIRED NULLABLE on every failure.
Error-code strings are `BAD_REQUEST`, `STATE`, `STALE_CONTEXT`, `NATIVE_REJECTION`, `ENGINE_FAILURE`, `LIMIT`; reuse existing context/witness/raw-record structures without widening old parsers.
All new nested objects remain closed; reject unknown/duplicate keys, positional arrays and unit-map aliases.
The fixed worker enforces strictly increasing u32 request IDs, one outstanding request and exact protocol/id/expected-result-kind correlation.

| Operation / request fields | Exact success result fields |
|---|---|
| `economic.start {fixture}` | `{kind:"started",session,fixture,initial,outcome,rules,boundaries:{w,b}}` |
| `economic.open {planningOrdinal}` — planning | `{kind:"planning",context,views:{w,b},begin,boundaries:{w,b}}` |
| `economic.open {planningOrdinal}` — terminal | `{kind:"terminal",session,outcome,image,begin,boundaries}` |
| `economic.settle {context,requests:{w,b}}` | `{kind:"committed",context,begin,settlement,boundaries:{w,b}}` |
| `economic.close {}` | `{kind:"closed",session,pendingBegin,image,outcome}` |

Start's `initial:StateImage` and required-nullable `outcome:Outcome|null` are host comparison facts; `rules` appears **only** here.
Its authorized initial boundaries have zero ordinal/planning/grant/sequence counters and empty groups, retaining the actual fixture endowment.
Planning open returns a host-only `BeginRecord`, including native raw begin/SCFEN/banks, alongside authorized views/boundaries from the same post-begin state.
This offline command already has recorded selections; returning native begin truth here does not widen the live v2 policy protocol.
Its gas capacity/refill is the actual carried previous-snapshot value, not a mandatory lookup at the post-begin turn.

Terminal open requires `begin:BeginRecord|null` and `boundaries:Pair<EconomicBoundary>|null`, both present even when null.
A new terminal begin supplies both; observing a preexisting terminal with no new begin supplies null for both and issues no duplicate boundary.
Terminal `outcome` and `image` remain actual host-native facts.

Settle stages both queues atomically against the same post-begin state and derives bindings from pre-resolution accepted native actions.
Compare `companion.nativeResult` to original `rawResolve` **before** restoring the retained stored bank; then apply native income once.
Keep the existing `SettlementRecord` shape; order authorized groups admission → native causal effects/vision → settlement.
Accepted refs retain the original planning ordinal even though settled planning/grant ordinals advance.
A native rejection returns `NATIVE_REJECTION` with the exact existing `RejectionWitness`, not a successful empty/pass settlement: no new receipts, debits, end, grant or settled boundary.
Preserve the checked opening prefix and clear pending begin as existing rejection/close semantics require.

Close's `pendingBegin` and `outcome` are REQUIRED NULLABLE, with the existing close semantics.
Close returns **no new boundaries** because open already projected any begin; clear the active worker and accept successful EOF only after closed.
For an uncertain original mutation, reconstruct only the confirmed record prefix, never execute an unconfirmed settlement to fabricate truth.

Native `initial`, `begin`, `settlement`, `image`, outcome, private SCFEN/banks and rejection truth are host-only siblings of authorized DTOs, never model inputs.
Host comparisons check all recorded native facts; Rust history receives only checked authorized boundaries/rules, not full private results.
No production operation accepts custom boards, module paths, arbitrary snapshot paths, executable paths or caller-provided private provenance; custom fixtures remain test-internal, not exported wire options.

| Owner | Accepted file allocation; target paths are not current existence/proof claims |
|---|---|
| Rust rules/contracts/history/work | `packages/training/src/ledger/{mod,contracts,history,work}.rs` |
| Rust shared controls/fixture | `packages/training/tests/ledger_contracts.rs`, `packages/training/tests/ledger_history.rs`, `packages/training/tests/fixtures/ledger-boundaries.json` |
| Node wire/reconstruction/projection/worker | `apps/arena/engine/{economic-wire,economic-replay,economic-project,worker-economic}.ts` |
| Node controls | `apps/arena/engine/test/{economic-project,economic-replay,worker-economic}.test.ts` |
| Rust economic orchestration/client/transport | `apps/arena/src/{economic,economic_client,worker_transport}.rs`; passive `engine_v2.rs` integration and module/CLI/help wiring |
| Rust economic/diagnostic controls | `apps/arena/tests/{economic_replay,readiness}.rs` |
| Lead | Root xtask identity/invoices/scope; actual late source discovery and the two existing diagram/index owners |

### 5.3 Filter before sequence allocation; Rust owns durable IDs

```text
existing RunRecord (host only)
  -> ONE independent native-consequence companion reconstruction
  -> exact comparison of recorded native facts (host only)
  -> private frames / visibility checkpoints / action bindings
  -> Node recipient authorization filter
  -> contiguous group seq + own-geometry locators, no lasting IDs
  -> closed authorized boundary pair
  -> Rust whole-group lineage, durable IDs, conservation, atomic pair publication
  -> private VerifiedEconomicRun only for complete eligible records
  -> scoped diagnostics; policyVerification:not-executed
```

Full SCFEN, opponent resources, private provenance, engine entity counters and unfiltered causal frames remain host-verification inputs only.
Neither future models nor the authorized fold API receive those private payloads.
Host-only proof references must not be smuggled into public IDs or timestamps.
A host report may retain private diagnostics, but that report cannot serve as an authorized model DTO.

Use exact native causal-before/path-visibility checkpoints and consumed-target proofs for transient authorized vision.
Private queries or deferred probes that native execution did not consume cannot manufacture a public observation or destruction witness.
A destruction witness uses its causal-before visibility key and actual bound effect, not the final snapshot's visibility.
Filter private facts/empty groups before recipient sequence allocation and visible-key ordering; only Rust mints lasting local entity IDs after decoding authorized locators.
Two private histories with the same authorized facts must produce byte-identical authorized histories, including numbering, ID choices, ordering and refusals attributable to authorized input.
Private-only diagnostic differences must stay outside that boundary.

## 6. Deterministic history, identity and resource bounds

### 6.1 Strict closed facts and transactional folding

The final DTOs must be data-only, object-shaped and closed at every nested/tagged layer.
Reject unknown/missing/duplicate keys, unit-map enum aliases, positional object arrays, invalid tags, nonfinite or out-of-range numbers and oversized arrays/strings before trusting their facts.
Retain exact required-nullable semantics and canonical serialization; a convenient Serde/JavaScript alias is not a protocol extension.

Host orchestration binds the record and reconstruction session; checked history binds recipients, rules and ordered boundary pairs.
Distinguish transport request IDs, group sequences, boundary ordinals and entity lineage IDs.
Reject foreign/stale sessions, recipient swaps, changed rules, out-of-order phases/windows, gaps and reordered receipts.
The bounded history interface retains only the **last boundary pair's complete canonical bytes**, with sorted object keys and preserved array order.
An immediately repeated, byte-identical pair at the current ordinal is an idempotent, charged no-op; a conflicting current-ordinal pair rejects.
An older pair rejects explicitly with `SEQUENCE`, even if it once appeared unchanged; do not keep a whole canonical episode to accept arbitrary historical duplicates.
Never substitute a digest-only identity key, mint repeated payments/losses or reset the current-window meter for duplicate checking.
Repeated RPC IDs still fail transport validation independently of this immediate-pair rule.
This is a bounded **new** history interface, not legacy wire compatibility or an amendment to a frozen older belief/duplicate contract.
Reject every distinct successor when the last turn is `>= rules.max_turn`, including a draw with both CCs alive; no new opening/refill may follow. The repair preserves charged identical-current-pair duplication, including initial45/custom-max1 controls, and leaves raw terminal-end grants unchanged. LEDGER-ADV-2 source/leaf repair is handed off; reviewer closure is pending.
Generic `Pair<Option<T>>` requires **both keys**, even for null values. The handed-off `required_value` repair enforces explicit keys for generic/nested pairs while preserving unknown/duplicate/array rejection and public shapes; LEDGER-ADV-3 reviewer closure is pending.

Resolve each Effects group's subjects from immutable before-geometry plus same-group births, stage all effects and reconcile final after-geometry before committing that group.
Validate/precharge the complete boundary pair and check conservation for both recipients before publishing either recipient's new boundary.
An error retains previously verified boundary pairs only; it cannot publish half of the rejected pair or issue full-record capability for an unverified tail.
Groups/batches never span transport chunks; an oversized operation refuses in full.

### 6.2 Actual shared contract API and lead-frozen history API

The completed shared source handoff is `packages/training/src/ledger/{mod,contracts,work,history}.rs`; the shared golden is `packages/training/tests/fixtures/ledger-boundaries.json`.
This author read those files and runs no tests or commands.
`ContractResult<T>` is `Result<T,LedgerError>`; the shared `Pair<T>` requires `{w,b}`, not a positional/old-record alias. The generic optional-value missing-key defect has a handed-off `required_value` repair with specific RED→contract-leaf GREEN; whole-source/reviewer closure remains pending.

| Actual public contract operation | Work/validation boundary |
|---|---|
| `LedgerRules::validate(&self, work)` | Charges rules and checks physical bounds/table structure; it does not authenticate native provenance or independently prove the fixed Node constructor's values. |
| `EconomicBoundary::validate(&self, rules, work)` | Validates/charges rules, boundary/groups and snapshot agreement; it is not a history fold or native-authority constructor. |
| `decode_boundary(bytes, rules, work)` | Preflights bytes before decoding, then validates the closed boundary; returns `ContractResult<EconomicBoundary>`. |
| `canonical_boundary_bytes(boundary, work)` | Charges boundary processing and canonical bytes; returns complete sorted-object-key JSON bytes with array order preserved, not a hash or native certificate. |
| `OwnGeometry::from_snapshot(snapshot, work)` | Charges and validates the authorized snapshot before producing own units/mine occurrence slots; it does not consult hidden geometry. |

`LedgerRules` also exposes native-table readout through `income_at` / `gas_capacity_at` and `non_cc_replacement`, with king replacement 0.
The general validator permits bounded table profiles with `maxTurn+1` entries; production still accepts only its fixed native-constructed rules, not caller-selected profile overrides.
Phase-aware gas validation preserves initial/settled profile agreement and checks a playable open against its previous accepted snapshot's updated capacity.
The requested-operation phase also covers a final game-over result; its raw preservation controls in [Appendix A](#appendix-a-regression-only-game-ending-native-turn-start) passed the complete bounded gate without changing the normal schedule.
Do not waive a function's own charges because a preceding layer already validated or serialized the same value.

`history.rs` now supplies these public checked-history methods; source presence and supplied leaf results do not constitute native authority or a fresh whole-gate proof:

```rust
LedgerPair::initialize(
    rules: LedgerRules,
    boundaries: &training_native::ledger::contracts::Pair<EconomicBoundary>,
    work: &mut LedgerWork,
) -> ContractResult<Self>

advance(&self, boundaries: &Pair<EconomicBoundary>, work: &mut LedgerWork)
    -> ContractResult<Self>
reports(&self, work: &mut LedgerWork)
    -> ContractResult<Pair<SideLedgerReport>>
rules(&self) -> &LedgerRules
last_boundaries(&self) -> &Pair<EconomicBoundary>
```

Use the shared contract `Pair` in every signature.
`advance` stages both recipients and returns a new checked successor without mutating/publishing a partial input pair.
Keep history fields private and construction checked; a successfully constructed `LedgerPair` is **not** native authority or a host-private `VerifiedEconomicRun`.

`SideLedgerReport` serializes its root in camelCase with exactly the frozen fields:

```text
side, scope, boundaryOrdinal, nativeTurn
planningOrdinal, grantOrdinal, sequenceThrough
calculated, seen, witnessedEnemyDestruction, ownLost
ownUnits, ownMines
scope = record-initial-forward
```

The present nested source reports are:

| Report region | Source-owned contents |
|---|---|
| `calculated` | Origin; nominal/actual/capped mineral totals and paid conservation; gas debits/discard/refills; own material; accepted actions, deployment dispositions and settlement receipts. |
| `seen` | Current authorized cells/material, ever-lit squares, enemy CC squares and last-seen/stale square assertions. |
| `witnessedEnemyDestruction` | Witness totals and local witness receipts; own-source-action subset, not killer ownership or exact enemy paid basis. |
| `ownLost` / `ownUnits` | Exact own paid basis, separate replacement/native costs, origins, births, type changes and losses; paid wasted deployment remains separate. |
| `ownMines` | Active/removed local entity lineage, same-square occurrence slots and action/endowment origins. |

These are raw authorized-history readouts. The terminal training closeout in §7.3 is a separate host projection and must not change these reports or their conservation equations.

### 6.3 Fixed worker and bounded transport

Use fixed `apps/arena/engine/worker-economic.ts`, cwd `apps/arena`, and scrub inherited execution-affecting environment such as `NODE_OPTIONS`.
No shell, eval, caller-selected scripts/executables, installations or automatic mutation retry is allowed.
The boundary covers trusted built-in Linux/Unix workers, not hostile-code containment or universal portability.

| Bound | Required handling |
|---|---|
| Requests | At most 64 KiB each; small fixture/context/action-queue operations, not the full original transcript. |
| Replies | At most 1 MiB each; strict UTF-8/framing, correlated protocol/request ID and expected result kind. |
| Stderr | At most 64 KiB cumulative; diagnostics are data. |
| Total analysis/worker time | ONE absolute 300-second lifecycle including a reserved 3 seconds for cleanup, not 300+3, two 300-second workers or renewal per operation. |
| Window/history transaction time | ONE absolute 10-second deadline shared across that transaction's operations, helpers and both recipients. Only the next reconstructed window starts a new transaction deadline. |
| Record | Existing up-to-16-MiB record remains host-side; requests do not forward it whole. |
| Projected boundary | At most 2048 groups / 2048 total admission+effect entries; each Vision changes array at most 64. Reply must also fit 1 MiB. Oversize refuses: NO CHUNKS, dropped events, truncation or arbitrary native-cap increases. |
| Report stdout | At most 16 MiB, separate from the 1-MiB worker reply bound; no dataset/evidence output writes. |

Use increasing bounded request IDs, one outstanding request, exact response correlation and explicit close/reap status.
Reject malformed/extra replies, repeated or mismatched IDs, EOF, invalid UTF-8 and byte/deadline excess.
Do not retry an uncertain mutation or convert transport failure into pass, a substituted engine, a missing event or a fabricated final state.
No timing-fit or capacity-adequacy claim precedes actual scoped evidence.

### 6.4 Actual shared fees and one work meter per reconstructed window

The frozen correction is **ONE inclusive 1048576 logical ledger-work meter and ONE absolute 10-second deadline per reconstructed window/history transaction**, not one meter for an entire multi-window match and not a separate meter for each seat/RPC/boundary.

| Transaction | Included operations and reset rule |
|---|---|
| First | Initial + open + settle share the same meter/deadline. An initial/terminal/rejected path closes without fabricating a settlement or grant. |
| Subsequent window | Open + settle share one fresh meter/deadline, created only when the next reconstructed window begins. |
| Terminal/rejected/unsettled close | Retain the current transaction's accounting; close without a grant unless an actual terminal end settlement granted it. |
| Frames/RPCs/helpers/duplicates | Never reset, renew or replace the current meter/deadline. Both recipients share it. |

Precharge authorized public history decoding/validation, identity and observation preallocation, traversal, arithmetic and mutation before charged work, with checked integer arithmetic.
Private native execution and raw host-truth comparisons remain separately byte/time bounded **outside** the logical ledger-work meter; the absolute window/total lifecycle bounds still apply.
The host may conservatively precharge complete reply bytes before parsing, including native-host bytes, to avoid allocating uncharged public payloads; carry the **same** `LedgerWork` into the fold.
This conservative public-allocation charge does not turn private native execution/raw-host verification into a logical whole-engine adequacy proof.
Use the completed shared fees below rather than inventing different host/Node tables.
Exhaustion/deadline refusal preserves previously verified boundary pairs and accepts no rejected update; never hide a truncated loss/event history.

| Actual `work.rs` fee | Units |
|---|---|
| Input byte / table entry | 1 each |
| Cell / unit / mine entry | 8 each; own siege-list entries use the unit-entry fee |
| Accepted action / effect fact | 16 each |
| Atomic group | 8 |
| Boundary base | 64 |
| Rules | 32 + entries in both native tables |
| Canonical output byte | 3, in addition to boundary traversal charges |

`charge_geometry` bills its units/mines; `charge_snapshot` bills cells, own pieces, mines and siege entries.
`charge_boundary` bills its base/snapshot, each group, admission actions, both Effects geometries plus facts, and Vision changed cells.
`canonical_boundary_bytes` performs its own boundary charge plus canonical byte charge; do not replace complete-byte identity with a cheaper digest or skip required charges.

The actual public meter API is `new`, `with_limit`, `used`, `remaining`, `limit`, `charge`, `preflight_bytes`, `charge_rules`, `charge_geometry`, `charge_snapshot`, `charge_boundary`.
`new` fixes 1048576; `with_limit` accepts only 1..=1048576, allowing a lower bound but never a cap increase or a production caller override.
An individual failed `charge` leaves `used` unchanged; a failing composite charge keeps all earlier successful charges.
History rollback restores no spent work: pair-state atomicity does not refund prior charges or grant a fresh meter.
The present `history.rs` adds these conservative logical fees to the shared work API; both recipients still consume the **same per-window meter**, never a fresh meter per helper/RPC:

| History charge | Units |
|---|---|
| State base / cell / memory slot | 128 / 16 / 32 |
| State item / report item | 192 / 320 |
| Profile clone | 64 + 8 per table entry |
| Identity byte | 1 |
| Fold fact / accepted action | 64 / 192 |
| Geometry item / lookup item / arithmetic item | 32 / 2 / 32 |

The mode-fidelity repair adds a pre-scan charged before traversal at the **existing lookup fee2 per fact**. This is an additional fee application for actual work, not a new constant, raised cap, public API/wire change or meter reset; promotion semantics remain unchanged.
The host's work receipt is `{ordinal,scope,used,limit}`, with scope `both-recipients-window-transaction`.
Present host chronology charges 64 per matched event and 16 per seat's grant match.
Checked terminal-accounting assembly charges 64 plus 2×16 seat checks plus 64 for projection = **160**, against that same existing transaction meter; it does not reset work or deadlines.
Logical fees do not charge private native execution as public history, prove full-418 decision adequacy or close legacy resource stops.

The existing composition attempt cap **2048** remains separate and unchanged.
Neither counter replaces, replenishes or waives the other.
Native companion ceilings and existing history limits remain unchanged; if inadequate, escalate rather than raise them opportunistically.
A logical counter and passing cap tests do not establish whole-process memory, wall-clock fit or closure of legacy R4 resource stops.

## 7. Verification evidence and readiness diagnostics

### 7.1 Capability construction, not caller certification

Only host-private `VerifiedEconomicRun` construction after agreement can create full verified-ledger evidence.
Require complete terminal/window-limit **native-consequence** reconstruction matching the record, authorized history/lineage/conservation through the final claimed boundary and confirmed clean worker exit.
Ledger does not invoke `replay_record`, certify policy choices or construct `VerifiedRun`; its report explicitly says `policyVerification:not-executed`.
Do not deserialize a public `ready`, `verified` or receipt-ID string as this capability.
The checked public history API is frozen in §6.2; its successful construction alone cannot issue this host-private capability.
The base host constructs its private capability only after native tail checks, ledger agreement and clean worker exit.
The host now retains private `NativeChronology` stages `AwaitingBegin`, `Intent` and `Terminal`, and constructs `CheckedTerminalAccounting` before a terminal projection can be attached to `VerifiedEconomicRun`.
A serialized Boolean cannot supply that proof; cleanup must also confirm a clean exit before closeout is published.

An unverified planning/bridge failure may retain an independently checked prefix and explicit pending operation.
It remains a failed record as a whole, with no full verified ledger or promoted terminal W/D/L.
A native rejection can have a confirmed native prefix/rejection witness but remains prefix-only, with no full `VerifiedEconomicRun` or successful full-ledger claim.
Retain verified terminal versus verified window-limit distinctions without inventing a draw.
The additive report does not modify existing evaluation or its conserved denominator.

### 7.2 Diagnostics must check facts

A diagnostic check must have a stable ID, declared scope, status `pass | fail | not-executed`, examined boundary/range and actual receipt/evidence references where available.
Computed failures must explain the violated invariant without revealing private evidence to a model-facing consumer.
Missing or unexecuted evidence stays explicit; do not invent receipt paths or report an unevaluated check as passing.
The present base host serializes checks as `{id,scope,status,reason,receiptRef}`.
An actual `receiptRef` contains `{session,whiteBoundaryOrdinal,blackBoundaryOrdinal,completedWindows}`, not an invented external receipt path.
Implemented check IDs include `native-defaults-profile`, `ordered-causal-history`, `mineral-conservation`, `paid-basis-conservation`, `sequence-identity`, `native-correspondence`, `protocol-bounds`, `clean-exit` and `full-record-coverage`.
Prefix checks may pass only their confirmed boundary scope while full-record coverage fails; the deferred checks remain explicitly unexecuted.

| Diagnostic scope | Source contract / fresh integrated proof disposition |
|---|---|
| Native defaults/profile | Historical pre-repair PASS at3640bb…; repaired-input complete rerun PENDING; runtime evidence stays record-scoped. |
| Record/native consequences | Historical declared-case PASS; valid native Siege replacement now exposes a blocking mismatch. Repair/full rerun PENDING; policy selection still outside ledger. |
| Policy-choice verification | `policyVerification:not-executed` by this command; existing `arena replay` owns independent native+policy verification. Never include this as a passing ledger check. |
| Authorization/causality | Pre-repair PASS retained; current repaired-input full proof PENDING. |
| History/conservation | Three source repairs and specific RED→training152 leaf GREEN handed off; current whole/reviewer closure PENDING. |
| Full-record coverage | Actual fixed-fixture v2 native journal→fold control present with pre-fix RED; host post-repair GREEN not claimed before fresh whole result. |
| Terminal closeout | Prior source/control evidence retains3640bb… scope; new complete-source proof PENDING. Runtime terminal-only private evidence/null-prefix semantics remain unchanged. |
| Feature semantics/parity | Full frozen 418 semantics and future encoder parity PENDING / NOT EXECUTED. |
| Belief/PMF/posterior | Production estimator, support and PMF proof PENDING / NOT EXECUTED; not required production machinery in this slice. |
| Calibration/learner | Payout calibration, learner core and learned acceptance PENDING / NOT EXECUTED. |
| Resource adequacy | Actual whole-cap/runtime adequacy and independent legacy resource stops PENDING / NOT EXECUTED. |
| Authority/admission | Required runtime proof and actual policy-training authority remain outstanding. The separate following-work/bounded LOCAL empirical grant is recorded in §11; it is not policy training or learned admission. Learned admission remains NOT EXECUTED and follows training. |

Runtime ledger checks may pass only for their actual examined scope with private evidence; the repository gate alone does not certify an arbitrary future record.
That result will not fill the deferred rows or certify training.
The chosen report version is `arena-economic-report-v1`, with `assurance:NON_ADMITTED`, `learned:false`, `modelArtifact:null`, `trainingReady:false`, `scope:record-initial-forward` and `policyVerification:not-executed`.
The host report is not a future model DTO; keep private native comparisons outside authorized history inputs.
Bound stdout to 16 MiB and keep existing 64-KiB config / 16-MiB record input limits without dataset/evidence writes.

| CLI exit | Chosen scope |
|---|---|
| 0 | Complete terminal/window-limit economic verification, conserved ledgers and clean worker exit only; training readiness remains false. |
| 1 | Prefix-only, refusal, native rejection, runtime/tamper/cleanup failure or unverified tail; no full verified-ledger claim. |
| 2 | Invalid arguments, configuration or schema. |

These choices require no new user decision and do not change existing commands or policy-verification ownership.
A summary Boolean is not a substitute for the check/evidence matrix or a private capability.

### 7.3 Host-only terminal training closeout

Executor's later authorization asks whether game-over resources can affect training and requires termination to precede any further intent use.
Completed architect/backend consultations selected a **separate host training-closeout safe view**, not a rollback of native income or a game-engine/UI/protocol change.
There is no current learner or measured training-bias finding: the reward contract remains WDL-only ±1/0, with no resource shaping or terminal bootstrap.
This safeguard constrains usable terminal resources; it does not establish that statistical bias has been measured or eliminated.
The skipped game-over presentation detour stays skipped; Appendix A remains the existing coherent raw-fidelity reference.

Present host-private API in existing `apps/arena/src/economic.rs`:

```rust
fn terminal_training_closeout(
    run: &VerifiedEconomicRun,
) -> Option<TerminalTrainingCloseout>
```

The same unpublished `arena-economic-report-v1` now carries REQUIRED NULLABLE `terminalTrainingCloseout`.
Its non-null object is:

```text
version: arena-terminal-training-closeout-v1
terminalPhase: initial | begin | end
excludedReceipt: {
  grantOrdinal,
  sourcePlanningOrdinal,
  settledTurn,
  reason: terminal-at-end | terminal-at-following-check
} | null
seats: {
  w: {excludedMineralCredit, eligibleMineralCredits, trainingClosingBank},
  b: {excludedMineralCredit, eligibleMineralCredits, trainingClosingBank}
}
terminalGasRefillEligible: false
usableGas: {w: 0, b: 0}
```

Return `Some` **only** for a complete verified native terminal with clean worker exit, using host-private checked terminal/receipt chronology.
Return `None` for a verified window limit, native rejection, unknown mutation, failed/unresolved prefix or absent complete terminal proof.
In particular, a trailing window-limit `OpenReply::Planning` is not a terminal closeout.
Do not infer eligibility from serialized report flags or public checked-history construction.
`NativeChronology` checks the original source planning context, settled turn, exact grant ordinal/credited amounts and both boundary clocks before producing `CheckedTerminalAccounting`; neither is an untrusted deserialized proof flag.

| Checked terminal chronology | Closeout behaviour |
|---|---|
| Direct terminal end | Exclude that actual settlement's credited minerals, bound to its receipt and original source planning ordinal. Raw settlement/grant/history stays unchanged. |
| Fatal following begin | Exclude only the matching preceding settlement's actual credit, because its corresponding intent never opened. Do not choose an amount from the final game-over counter's tier. |
| Terminal at initial origin | Exclude no receipt; preserve endowed opening bank. Complete initial terminal proof may still produce a closeout with `excludedReceipt:null`. |
| Matching begin passes | Release its preceding credit before any feature construction; never exclude older income that already reached a usable intent. |

For each seat, checked integer subtraction gives:

```text
eligibleMineralCredits = rawActualCredits - excludedActualCredit
trainingClosingBank = rawClosingBank - excludedActualCredit
```

Bind the exclusion to the exact `grantOrdinal`, `sourcePlanningOrdinal`, `settledTurn` and reason, even when actual credit was zero.
The normal public nominal schedule and capped actual-credit receipts remain raw native truth; closeout does not rewrite a nominal grant, refund paid gas, change promotion basis or alter own paid-basis accounting.
`usableGas:{w:0,b:0}` means no remaining terminal intent budget, **not** a refund or subtraction of native capacities/expenses.

The supplied native phase-ordering reproductions include a fatal begin that refills a zero-available raw snapshot before ending, and this exact following-check case in the existing Node controls:
initial turn9, kings e1/c3, lives1/1, bank3; white `C e1→d2` / black pass settles at turn10 with actual credit1 each, raw bank4 and no outcome; the following begin ends at raw counter11 without an intent, preserving raw bank4.
The required closeout excludes **that actual credit1**, yielding training bank3, never bank2 from a counter11 tier-2 inference.
The Rust host includes checked-chronology controls for this case; the earlier host104 leaf is retained below, and the new complete gate reran all104 arena tests within Rust279.
Those Rust unit controls are explicitly **synthetic proof controls**, not production custom-board admission or a substitute for the Node producer's actual native phase-ordering regressions.

Keep this final projection **outside** `AuthorizedFeatureHistory`, WDL rewards, frozen D+B truth labels, calibration and terminal-feature bootstrap permissions.
It is a separate host report view, not a model input or authority/training grant.
Node economic protocol, closed boundaries, engine/UI, raw provenance/grants/history and existing replay/evaluation stay unchanged.
The completed host handoff changes only existing `apps/arena/src/economic.rs` and `apps/arena/tests/{economic_replay,readiness}.rs`; no new literal coverage input is needed.
Implementation/closeout controls passed the original3640bb… gate only. Actual adversarial NO blocks current closing; fresh repaired-source proof and resolving rereviews are pending. Security/DevOps approvals are pre-repair/revision-scoped, and non-admitted markers stay unchanged.

## 8. Pre-repair proof obligations and current repair/rereview lock

The original v3 gate passed its then-present tests in the [PR acceptance matrix](../_plans/native-economic-ledger.md#5-persisted-test-obligations--pre-repair-pass-retained-fresh-gate-pending). It did not contain the subsequent three review-specific controls and does not prove a repair; preserve it as history and add the assigned persisted RED/minimal-repair evidence before the new whole run.
Include actual-public-default opening and 45-window uniform pass/pass economic reconstruction controls, all three unchanged fixed fixtures, atomic swaps/replacements, both-recipient failure rollback and all cap/terminal-begin/end edges.
Require these three distinct threshold regressions, with both seats' public nominal schedule and exact grant presence/ordinal asserted:

| Required NORMAL SETTLEMENT crossing | Ordinary grant / next-playable-turn assertions | Proof scope / current requirement |
|---|---|---|
| **0 → 1** | Entitlement 1 each; next capacity 1; one grant/ordinal advance; native end gas0, next playable open refill1 | Pre-repair PASS; fresh repaired-input rerun PENDING |
| **10 → 11** | Entitlement 2 each; next capacity 2; one grant/ordinal advance; native end gas0, next playable open refill2 | Pre-repair PASS; fresh repaired-input rerun PENDING |
| **20 → 21** | Entitlement 3 each; next capacity 3; one grant/ordinal advance; native end gas0, next playable open refill3 | Pre-repair PASS; fresh repaired-input rerun PENDING |

Retain 9→10 and 44→45 controls alongside the three required threshold crossings, plus cap asymmetry and zero-credit grant cases.
Starting `all-actors-v1` at turn21/bank12 tests initialization/endowment, **not** the actual 20→21 settlement grant; it cannot substitute for that row.
Retain independent `arena replay` controls separately; do not call them inside ledger or count their policy proof as ledger proof.
This author runs no test and invents no future test total.
Actual producer/contract/history threshold and raw-fidelity controls participated in the complete passing run; no turn21 initialization or earlier leaf substituted for a required settlement crossing.
Separately retain the raw game-over preservation controls in [Appendix A](#appendix-a-regression-only-game-ending-native-turn-start); these do not replace any ordinary settlement row above.
The same complete run includes direct-terminal-end/fatal-following-begin/initial-terminal, zero-credit identity, passed-begin release, window-limit/prefix nullability and no raw-history/reward/label/feature leakage controls. Node actual native-phase tests and Rust synthetic proof controls retain their different assurance scopes.

The accepted file allocation in §5.2 replaces earlier tentative suite labels with `ledger_contracts`, `ledger_history`, `economic_replay`, `readiness` and the named Node controls/JSON fixture.
The historical receipt's exact scope is `native-economic-ledger`, version `rust-training-verification-v3`; its nonempty target counts34/37/9/4 and Node150 remain attached to that input, not an invented repair total.
Its matching identity binds that run's source/config/test/diagram inputs. Node producer tests have since changed; no new matching whole-gate identity/count is supplied, and the new complete run must preserve every existing control plus the repair regressions.
Preserve serialized fixed protocols, live/replay behaviour, baseline reports, legacy packages, native engine bytes, dependencies, frozen bodies, graph/status files, corpus and evidence.
Allow only the specified passive shared fixed-transport extraction and its unchanged-wire integration in existing adapter code.
Use synthetic private fixtures for destructive-path/output negatives, never protected repository data.

The preceding authoring extended only the existing training/arena owners and their matching index entries after the actual inputs existed, preserving old covers and unrelated metadata/order.
All 20 new literal coverage inputs were read as existing files, including `apps/arena/tests/support/economic.rs`; 19 source/test files carry the owning top-level `SPEC:` pointer, while the JSON fixture is normal spec-side coverage without a source comment.
The training owner added seven literals and arena thirteen, totals30/54; coverage and baseline43-entry preservation passed the gate. No covers, index entries or fingerprints change in this Markdown-only sync.
The lead completed root/source/core/preservation/checkonly/bounded-SVG checks in one matching-input invoice; this author reads its receipt but reruns none.

**CURRENT CLOSING STILL BLOCKED PENDING REVALIDATION: source repairs for all three findings are handed off with specific RED→training-leaf GREEN; source is now frozen and the complete gate is STARTING/result PENDING. Actual adversarial NO has not been replaced by a resolving rereview. Old `reviewEligible:true` applies only to the first cycle; rereviews remain FORBIDDEN until the new whole PASS.**
The general rule remains: reviewers are **FORBIDDEN until all required checks pass on one unchanged input**; a leaf or partial invoice cannot unlock them.
After any source repair, repeat the complete matching-source gate before a rereview.
Consultations are design input only; do not invoke reviewers to choose an API or replace missing tests.

## 9. Accepted freeze, execution evidence and closing lifecycle

The architect v2 boundary and §7.3's additional narrow host safeguard are accepted.
Base source, public history methods, nested reports, history fees, exact wire grammar, checked base capability and diagnostic structures are present; they are no longer unresolved API questions.
The completed terminal closeout handoff supplies private chronology, checked accounting, function, required-nullable report field and host controls in the same existing source/test files.
Original and repair handoffs now have no missing literal input/new file. All three source fixes and training/Node leaves are handed off; current closing waits for the new complete gate and resolving rereviews, not another speculative implementation claim (§9.5).

### 9.1 Lead-supplied leaf chronology — never a whole-gate invoice

[Unverified] The following are supplied execution scopes, not this author's tests, hashes or closing verdicts; do not combine them into a new passing total:

| Leaf scope | Supplied result / limit |
|---|---|
| Prior shared construction | Earlier 32-test/check/Clippy result remains historical, before the later capacity/fixture corrections. |
| Base Node handoff | 57 new / 150 unfiltered Node tests, types/check and lint PASS at that handoff; not a new whole-source run after later fixture/host changes. |
| Latest shared fixture + training | 34 contract + 37 history controls within **145 unfiltered training PASS**, Clippy with warnings denied and owned fmt PASS after the new-golden repair. |
| Latest native/golden Node control | `economic-replay.test.ts` **22/22 PASS** after that repair; not an unfiltered all-Node or whole-gate rerun. |
| Superseded base Rust host | 95 tests/check/Clippy/fmt PASS before terminal closeout; historical leaf only, never summed with104. |
| Current completed Rust host handoff | **104 unfiltered arena tests PASS**, all-targets check, Clippy with warnings denied and owned fmt PASS including terminal closeout; still a leaf, not a whole/source+diagram/preservation invoice. |
| Root xtask leaf | 30 tests/Clippy/fmt PASS before full integration; historical leaf, followed by the also-now-pre-repair whole pass in §9.3. |

The native phase-capacity mismatch was reproduced as `BAD_INPUT`, then repaired in the base contract/history handling with persisted controls; the engine and schemas/fees did not change.
The closeout host handoff is `ses_eb7f00288ffeuK9o1Yf9R4852Y`, as supplied by the lead; its104 supersedes host95 only within the host leaf.
All supplied leaves keep their source scope, are never summed into §9.3's historical total and do not prove repair source. Current blocked closing/repair lifecycle is §§9.4–9.5.

### 9.2 New shared golden fidelity repair — scoped regression receipts

The new shared unit fixture, not any frozen legacy fixture/corpus, had a settled snapshot gas field of 1 while unchanged native end produced 0.
[Unverified] The lead retained these targeted failures: the persisted Node actual c2→c3 snapshot comparison failed that exact gas difference with 21 other file tests passing; the positive history golden fold failed `CONSERVATION` with 36 other history tests passing.
The repair changed only that JSON gas field to 0 and kept the negative as a **local mutation to 1 after the valid fold**, not a patched positive clone.
The current files this author read contain the corrected field and direct positive fixture fold.
[Unverified] The lead reports Node economic-replay 22/22 and unfiltered training145, Clippy-Dwarnings/owned fmt PASS under execution `sh_148243b94001WHnW4p35Lvaify` after correction.
This closes the supplied **new-fixture gas mismatch** at its leaf scope; it is not a production defect repair, an unresolved golden-gas issue or whole-ledger/closeout proof.

### 9.3 Historical complete whole gate — pre-repair PASS / matching original input

The actual `cargo xtask check` receipt is [`receipt.json`](/tmp/proveo-opencode-runtime-cache-1000-21d690750d3738af14d58c25/tmp/opencode/rust-training-132138-1792212605122677906-0/receipt.json).
**PRE-REPAIR EVIDENCE ONLY.** The subsequent actual review found three missing cases. Its PASS/identity and `reviewEligible:true` remain truthful for that original input and first review cycle, not current repair-source/rereview eligibility.
This author read that artifact; the lead executed the gate and machine-checked its completion. The author executes no command or hash calculation.

| Receipt field | Actual recorded value |
|---|---|
| `version` / `scope` | `rust-training-verification-v3` / `native-economic-ledger` |
| `status` / `reviewEligible` | `PASS` / `true` |
| `inputSha256` | `3640bb02798ae3df3cf7242488e696ff26eedebcf351ffd979f1018656576363` |
| `inputSha256After` | `3640bb02798ae3df3cf7242488e696ff26eedebcf351ffd979f1018656576363` |
| `error` / `identityError` | `null` / `null` |
| Command results | All29 PASS, exit0, signal null, work timeout false, cleanup errors null, cleanup timeout false, reaped true |
| Unfiltered tests | **Rust279** from one `rust-tests` invoice = arena104 +training145 +xtask30; **Node150**, **core668**; no skipped/filtered required tests |

The test split is the single run's actual binaries, not arithmetic joining the earlier leaf receipts.
Its required ledger integration binaries are:

| Persisted required Rust target | Actual nonempty count |
|---|---|
| `packages/training/tests/ledger_contracts.rs` | 34 |
| `packages/training/tests/ledger_history.rs` | 37 |
| `apps/arena/tests/economic_replay.rs` | 9 |
| `apps/arena/tests/readiness.rs` | 4 |

The29-command invoice records these exact groups:

| Commands / proof scope | Result |
|---|---|
| `version-rustc`, `version-cargo`, `version-node`, `version-pnpm`, `version-tsgo`, `version-oxlint`, `version-cc` | PASS, seven exact-version checks |
| `legacy-preservation`, `legacy-untracked` | PASS, protected tracked/untracked inputs before execution |
| `baseline-lock`, `baseline-package`, `baseline-spec-index` plus internal coverage validation | PASS, existing lock/package and43 old spec entries preserved; owner covers remain30/54 |
| `lint-engine`, `types-engine` | PASS, adapter source and tests |
| `rust-format`, `rust-check`, `rust-lint` | PASS, workspace/all targets; Clippy warnings denied |
| `selected-native-dependencies`, `rust-build` | PASS, selected dependency controls and workspace build |
| `rust-tests`, `engine-tests`, `core-tests` | PASS, actual unfiltered279/150/668 above, all required new targets nonempty |
| `diagram-training`, `diagram-arena` | PASS, both current owner PlantUML checkonly jobs |
| `render-training`, `render-arena` | PASS, bounded private SVG artifacts in the receipt directory; no hermetic mutable-theme claim |
| `legacy-preservation-after`, `legacy-untracked-after` | PASS, protected tracked/untracked inputs still unchanged afterward |
| `whitespace` | PASS for the receipt-time working input |

The normal0→1/10→11/20→21 crossings, initial turn0 endowment distinction, cap/zero-credit events, native raw preservation and checked terminal closeout controls are included in that unchanged-source test proof.
Node actual native-phase coverage and Rust synthetic chronology controls remain distinguished; no production custom-board admission or measured training-bias reduction follows.
The identity includes the **latest pre-gate diagram bytes**, after the lead aligned only their status headers/legends; actual covers and FK note bodies stayed unchanged.
Its identity policy explicitly excludes Markdown, target/node_modules/.generated and external theme bytes. This two-file Markdown lifecycle sync neither changes that source identity nor creates a self-hash or a new run; receipt-time whitespace is not a new whitespace test of this later edit.

The lead separately supplied a read-only note-box result: **22 notes PASS**,2–5 lines each, at most50 columns, maximum46. That output is not a30th command or another result inside the fixed29-command invoice, and this author did not run it.
The source was unchanged during that original invoice/first review scope. Subsequent Node tests and the four owned contracts/history repair files are now handed off and frozen for a new full run; no new identity is inferred before its receipt.
That run performed no real policy training, empirical fitting/calibration/profiling, corpus rewriting, activation, deployment, commit/push or publication. The later user grant in §11 is separate from this historical proof, not retroactive operation evidence.

### 9.4 Actual first closing cycle — adversarial NO / current closing BLOCKED

The lead invoked all three reviewers after §9.3's whole pass. Their actual dispositions bind original source3640bb…; current repair-source verification/rereviews are not supplied.

| Review / session | Actual supplied disposition | Method / scope |
|---|---|---|
| Adversarial · `ses_eb7cb724effe5uE3Hebn2Gb0wF` | DONE; actual `READY TO MERGE:no`; HIGH +MEDIUM +LOW findings | Actual review result, not executed regression evidence; assignments in §9.5, no status polling |
| Security · `ses_eb7cb7218ffePBBBS1MqCmBCtM` | PRE-REPAIR DONE; `READY TO MERGE: yes` at3640bb… only, bounded NON_ADMITTED ledger; no concrete findings, risk low | Read-only inspection of all20 new inputs/matching receipt; no command/test/hash rerun/edit; no repaired-source review supplied |
| DevOps · `ses_eb7cb7206ffe1XrslbW4r6OyGq` | PRE-REPAIR DONE; `READY TO MERGE: yes` at3640bb… only, bounded ledger; no concrete build/verification findings | Read-only source/persisted log inspection; no commands/rerun/edit; no repaired-source review supplied |

Security examined strict parsing/allocation, shared budgets, privacy filtering, cleanup/failure rollback, private authority and terminal-closeout isolation.
Its suggested multi-window cross-language hidden-twin property tests are **optional strengthening**, not a new HIGH/blocker, required repair or already-executed suite.
DevOps cited `identity.rs:8–85` for input binding, `invoices.rs:11–107` for retained/nonempty targets and no ignored/filtered tests, and `worker_transport.rs:104–123` for fixed workers/PATH-only environment, alongside the actual279/150/668 preservation/diagram invoice.
These are supplied review results, not independent test executions or this author's broad merge/readiness verdict.
The actual adversarial NO blocks closing despite the two revision-scoped approvals; neither is a risk waiver or a review of repair source.
The lead has invoked no rereviews and requires all repair handoffs plus a complete fresh unchanged-source PASS first. No all-reviews-ready, new proof count or final ledger acceptance is claimed.

### 9.5 Actual findings, required reasoning and repair handoffs

These local tracking IDs do not reuse historical baselineN1–N3 or legacyR4 N1–N7. Source locations below belong to the **pre-repair** review input.

| Local ID / severity | Actual review finding | Required invariant / current state |
|---|---|---|
| LEDGER-ADV-1 · HIGH | Original `packages/training/src/ledger/history.rs:1031` hardcoded new Rook to Tank and rejected native d1 Siege-preserving replacement. | Specific persisted RED executed before fix. Handed-off repair inherits only from authorized same-square old-Rook retirement/new-Rook birth, preserving explicit mode facts and new-ID/paid5 versus endowed0 identity; empty/unrelated negatives retained. Source +training-leaf GREEN, **reviewer closure pending**. |
| LEDGER-ADV-2 · MEDIUM | Original `history.rs:435` ignored the declared max-turn draw when CCs remained alive. | Specific RED before fix. `last.turn >= rules.max_turn` now blocks new ordinals while charged identical-current duplicates remain allowed, including initial45/custom-max1; raw terminal-end grant unchanged. Source +leaf GREEN, **reviewer closure pending**. |
| LEDGER-ADV-3 · LOW | Original `contracts.rs:194` defaulted missing nullable Pair keys to None. | Specific RED before fix. Generic `required_value` now requires both keys, including nullable/nested pairs; shape/canonical and unknown/duplicate/array controls retained. Source +leaf GREEN, **reviewer closure pending**. |

The first review findings stay recorded. The new actual handoff now supplies all three **specific persisted RED-before-fix** regressions and their source/leaf repairs, not a resolving reviewer verdict.
History handoff `ses_eb7ffcc3effel6q0ggWIqfGJdc` changed only `src/ledger/{contracts,history}.rs` and `tests/{ledger_contracts,ledger_history}.rs` under `packages/training`; public API/wire shapes and all fee constants remain unchanged.

| Additional regression owner | Actual handoff / outstanding proof |
|---|---|
| Node producer tests | **DONE**, two new native controls: all-actors d1 Siege→same-cell own Rook replacement retains Siege without a mode-change fact, native mineral/gas debit5/1, bank12→7→10 with actual credit3; empty d2 new Rook remains Tank as the guard control. Supplied unfilteredNode152/types/lint PASS is a leaf only, not the Rust fix or fresh whole gate. |
| Rust host tests | Actual fixed-fixture v2 native-journal `RunRecord`→economic-fold regression is present; its actual native pre-fix RED is retained. Lead read this control; **post-repair host GREEN is not claimed** until the new full run. |
| Rust history/contracts repairs | **DONE source handoff**: all three specific persisted RED-before-fix cases, minimal repairs, **152 unfiltered training PASS** including history42/contracts36, all-targets check, Clippy-Dwarnings and owned fmt. Leaf scope only, not the new whole gate. |

The lead read completed repair files, the host native-journal control and Node handoff; **sources are now frozen** and the full `cargo xtask check` is **STARTING** in the background. No new shell checkpoint/receipt/hash/result is supplied yet; this author does not poll for one.
No new files exist from these repairs, so coverage remains30/54. This author edits only the two ledger Markdown files; no source/PlantUML/index edit follows the freeze.
Mandatory order is all repair handoffs/evidence → fresh ALL-static/unfiltered-Rust+Node+core/preservation/coverage/diagram + matching-before/after-identity gate PASS → required read-only rereviews → verified milestone publication → following feature implementation.
The HIGH source repair is handed off but not reviewer-closed or waived. Commit/push remains held for the fresh whole result and resolving rereviews; no rereview, new full PASS, commit or push is claimed here.

## 10. Diagram authoring and readability register

The preceding authoring pass extended only the existing training/arena diagrams; baseline synthetic/composition/runner contracts remain, and `native-runner.md` stays the frozen historical proof owner.
The new delivery points to this document and its PR plan; existing diagram bytes passed the original pre-repair gate in §9.3. New repaired-input validation remains pending, with diagrams/index untouched by this two-MD task.
This post-gate pass edits **only** the two ledger Markdown documents, not PlantUML/index/source/tests/navigation/graph/status or frozen bodies.
All old covers remain unchanged before the new literal suffixes. No unrelated index entry, ordering, fingerprint or unresolved metadata changes.
New diagram notes use two sentences, five lines and at most 45 text columns; unchanged notes already fit the 2–5-line/50-column box.
FK uses `0.39*(words/sentences)+11.8*(syllables/words)-15.59` on markup-free text, splitting hyphenated words; pronunciation-based syllable counts are explicit readability estimates, not source-verification receipts.

| Diagram / authored reasoning note | Words / sentences / syllables | FK |
|---|---|---|
| training/burn-compat.puml · bottom of LEDGER_CONTRACTS | 31 / 2 / 52 | 10.2 |
| training/burn-compat.puml · bottom of LEDGER_HISTORY | 30 / 2 / 55 | 11.9 |
| training/burn-compat.puml · bottom of LEDGER_WORK | 32 / 2 / 58 | 12.0 |
| arena/burn-compat.puml · bottom of REPLAY_NATIVE, rewritten to distinguish VerifiedRun | 33 / 2 / 57 | 11.2 |
| arena/burn-compat.puml · bottom of ECO_PROJECT | 31 / 2 / 57 | 12.2 |
| arena/burn-compat.puml · bottom of ECO_HOST | 30 / 2 / 54 | 11.5 |
| arena/burn-compat.puml · bottom of CLOSEOUT | 32 / 2 / 57 | 11.7 |
| arena/burn-compat.puml · right of CLOSEOUT | 34 / 2 / 59 | 11.5 |

Readability arithmetic is not a renderer run. Original syntax/bounded-render and note-box proof remains attached to3640bb…; it does not unlock current repair rereviews without a fresh complete pass. This author invokes no reviewer, command, test, render or hash.

## 11. Following milestone authority — Training-ready selected, policy training excluded

The earlier question about readiness alone authorized no operation. Executor subsequently requested verified milestone **commit & push**, continuation toward final readiness, and an interactive TUI with **at least three proposals** for pending decisions.
The lead prompted three target options; Executor actually selected **Training-ready (Recommended)**: complete features/belief, Rust learner and all pre-training gates; authorize required bounded **LOCAL** data collection, belief-table fitting/calibration, profiling and container validation; stop before actual policy training, activation or deployment.
This current grant supersedes the earlier ledger-slice operating prohibition for that following work only; it changes no historical/frozen body or proof scope and is not a `trainingReady:true` result.
Verified milestone commit/push is authorized but **HELD** pending fresh whole proof and resolving review closure of the handed-off HIGH/other repairs. No new commit/push, empirical run or feature implementation is claimed here.

The six readiness gates remain distinct and unverified:

| Pre-training gate | Current disposition |
|---|---|
| Real418 authorized belief/features | Following implementation authorized by selected target; NOT implemented/verified by this ledger handoff, whose facts/padding do not supply full semantics/PMF support |
| Actual Rust learner | Following implementation authorized; no actual policy-training run permitted by that selection |
| Authorized calibration | Required bounded LOCAL belief-table fitting/calibration authorized; NOT EXECUTED or proven here; no protected-corpus/data rewrite |
| End-to-end correctness | Required for full learning path/consumers; NOT verified by the pre-repair ledger invoice |
| Required runtime closure / resource and authority proof | Required bounded local profiling/container validation authorized; proof NOT supplied, and legacy R4 audit/resource stops remain open |
| Final readiness review | NOT EXECUTED for the complete learner/evidence; ledger-only closing reviews cannot substitute |

After all six, a **separate explicit human policy-training approval** remains required. Learned-artifact/model admission follows training, not a circular pre-training prerequisite. Current `trainingReady:false` and not-executed readiness checks remain unchanged; no activation/deployment, engine/frozen-contract/corpus rewrite or WDL/D+B/closeout change is authorized.
Source work remains **ledger repair/verification/rereviews/publication first, following features next**. The lead's read-only next-goal consultations are architect `ses_eb7c5d187ffenpvgElk95FZ8ut`, backend `ses_eb7c5d103ffeKgoXs6bOMvg7bU` and DevOps planning `ses_eb7c5d023ffeE5K3XtJAsaNhda`; their advice is pending, and no next-readiness plan is written in this handoff.
This is an authority/target record, not that future plan, an API freeze or an execution result. Keeper still owns only the two ledger Markdown files and invokes no commands/agents/reviews or progress polls.

### 11.1 Future readiness image authority — Offline local capture selected

After a three-proposal image TUI, Executor actually selected **Offline local capture (Recommended)**: build a **separate** image from explicitly captured installed tools/runtime files **without downloads**, stop if required components are missing, record measured identities and exclude credentials/unrelated host files.
The pinned-base acquisition and provided-offline-bundle alternatives were **not selected**; no network acquisition/install, privilege-change or fallback grant follows.
[Unverified] The lead's read-only preflight found Docker daemon reachable at29.7.2/cgroupv2, a successful empty image listing (zero images), and12151791616 bytes free in approved temporary storage.
That preflight is **not** a pull/build/run, image identity, headroom proof or actual container/enforcement verification.
The future architect plan must define the narrow allowlist, fixed tools/licenses/loader/native libraries, build/runtime split, measured identities/size headroom and actual container proof for a new image generation, not reuse or modify a legacy pin identity.
No recipe or new readiness plan is authored here; no image is claimed built and no policy-training/activation/deployment authority is added.

## Appendix A. Regression only: game-ending native turn-start

**NOT A NORMAL TURN TRANSITION / NO NEXT PLAYABLE TURN.**

These cases preserve the raw final snapshot when the native turn-start check ends the game before another round can settle.
They are not mineral-income rules, next-turn gas entitlements or a proposal to change the normal 1/2/3 schedule.
Do not present the final counter change as opening a playable turn.

[Unverified] The lead executed unchanged native adjacent-CC probes with one life per CC at all three origins 0/10/20, alongside the normal pass-settlement probes recorded in §3.1.
The game-ending results had native phase `O`, terminal outcome and CC lives 0/0, with these exact raw fields for both seats:

| Final game-over counter change | Raw final snapshot gas/gasIncome (not next-turn capacity) | No additional settlement/grant |
|---|---|---|
| 0 → 1 | gas 1 / gasIncome 1, both seats | None; grant ordinal unchanged |
| 10 → 11 | gas 1 / gasIncome 1, both seats | None; grant ordinal unchanged |
| 20 → 21 | gas 2 / gasIncome 2, both seats | None; grant ordinal unchanged |

`BoundaryPhase::TurnOpen` / `phase:"turn-open"` names the requested operation in the economic boundary.
The host-native phase `O` and terminal outcome mean **game over**, not an opened playable turn; there is no next decision that can spend these final gas fields.
Keep the native result byte-exact instead of rewriting its fields from the incremented counter's profile table.
No additional native end, mineral-income application, Settlement group or grant follows this game-ending check.

The lead's ad hoc probes cover all three origins, but they are not persisted regression tests, a repair result or a new whole-gate receipt.
Base contract/history and Node raw-preservation controls are present with the supplied leaf scopes in §9; present host closeout remains a separate projection in §7.3.
This is not a native-engine bug, an accepted rule modification, a DTO/fee change or a new user decision.
Raw-preservation/closeout controls passed the historical pre-repair gate in §9.3. All three source repairs now have handed-off RED→training-leaf GREEN evidence, but actual adversarial NO remains unresolved by rereview; fresh whole proof is starting/result pending. The conditional prohibition on rereviews before a whole pass remains unchanged.
