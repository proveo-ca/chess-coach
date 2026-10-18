# Native economic ledger — current contract and reasoning

**2026-10-18 · BOUNDED LEDGER PUBLISHED b47befd021bef04eea0bfe20a9308a71aa20f09f ·258d GATE PASS:29 COMMANDS / RUST301 / NODE175 / CORE668 · ALL3 READY / NO FINDINGS · LEDGER-ADV-4 RESOLVED · trainingReady:false · SEPARATE F1 GOALS ACTIVE, IMPLEMENTATION PLANNED.**

The [PR plan](../_plans/native-economic-ledger.md) owns forward delivery/acceptance.
This document owns the selected current contract and reasoning, not obsolete unfinished-ledger branches.
The lead executed the current complete gate; this evidence-only Markdown pass reads its present receipt without executing commands, tests, hashes, renders or reviews. No normative contract/source/diagram/index input changes here.

<a id="1-scope-history-and-non-goals"></a>
## 1. Scope and authority

Executor selected **Revise v1 in place**: update all producers/consumers/tests of the unfinished economic schema together, retaining current protocol/schema IDs and files with **no backward compatibility**.
The final architect freeze supplies required native-own origin modes; there is no pending contract-choice TUI, dual economic version, legacy parser or inference fallback.
Deliver calculated entitlement, exact own receipts/lineage, authorized observations and witnessed losses as a replaceable foundation, not a full hidden-economy estimator,418 encoder, posterior/PMF or learner.

Preserve existing **arena-engine-v1/v2**, closed legacy DTOs/RunRecord bytes/live mutation/replay, native rules/UI, baseline selectors/seeding/reports, frozen418/D+B contracts, pins, corpus/evidence and six-owner graph/status files.
Passive fixed-transport extraction into `worker_transport.rs` and unchanged-wire integration in `engine_v2.rs` remain allowed; preserving legacy behavior does not require every adapter source byte to be frozen.
The frozen [native runner](native-runner.md) retains its own proof scope; baseline closure is not legacy R4 N1–N7/M2, inventory or resource/public-closure closure.
The user4990d951 commit is preserved; the lead actually published the verified16-file ledger repair as b47befd021bef04eea0bfe20a9308a71aa20f09f (§9). Separate F1 goals now follow that completed publication, without borrowing its proof.

## 2. Native authority: defaults, fixtures and rule facts

### 2.1 One source of economic rules

Node imports native constants/helpers from `packages/starchess-core/src/rules/{constants,economy}.ts`, `rules/specials/registry.ts` and public `src/{index,planning-v1}.ts` exports.
Rust validates/uses bounded native-derived facts, not an independent authoritative economy formula.

| Native fact | Contract |
|---|---|
| Opening minerals / cap | Public default3 per seat / cap12. |
| Income / gas | Native turn tables:1 through10,2 through20,3 later; helpers normalize their opening-turn arguments. Gas refills capacity rather than accumulating. |
| Unit costs | `k:1,p:1,n:3,b:3,r:5,q:9`; ordinary king replacement is0, separate from native CC cost/lives. |
| Action gas | Exact native special-specific accepted debit, not a blanket one-gas table. |
| Mines | Native cap3 entities, including duplicate-square entities. |

`arena-economic-rules-v1` fields remain `version,openingBankDefault,unitCosts{p,n,b,r,q,k},mineralBankCap,mineEntityCap,maxTurn,incomeByTurn[46],gasCapacityByTurn[46]`.
Construct both46-entry tables from native helpers including index0, supply rules only at `economic.start`, and reject profile mismatch rather than substitute Rust defaults/caller-selected rules.
General validation can check bounded `maxTurn+1` tables; production still uses its fixed native constructor, not profile overrides or a new special-cost schema.
Initial/settled snapshot gasIncome agrees with its current-turn profile; playable open carries/refills the preceding snapshot's updated capacity.
Game-ending begin is a raw-preservation case in [Appendix A](#appendix-a-regression-only-game-ending-native-turn-start), not a second playable schedule.

### 2.2 Distinguish a default opening from a fixed fixture origin

| Unchanged fixture | Native turn / bank per seat |
|---|---|
| `tiny-v1` |0 /3 |
| `standard-v1` |0 /3 |
| `all-actors-v1` |21 /12 |

Use actual `apps/arena/engine/fixtures.ts` state/bank and endowed starting pieces with **paid basis0**. Origin is `record-initial-forward`.
A later fixture turn supplies no prior purchase/grant history; do not replace its bank with default3 or restrict the ledger to standard-v1 for a future belief model.
Test actual native default initialization separately. Test-only edge states may exercise promotion/mines/terminal chips without changing corpus/fixtures or exposing custom-board production admission.
If the unchanged companion rejects an edge state, report/refuse that limitation rather than alter native rules or collapse multiplicity.

<a id="3-frozen-boundary-atomic-groups-and-causal-locators"></a>
## 3. Current boundary, atomic groups and causal locators

Native turn is not an income-event counter. Retain the bank outside raw transitions and apply native stored income exactly once at actual settlement using `rawResolve.next.turn`.
Begin applies no mineral grant, including terminal begin counter advances.

### 3.1 Boundary time and sequence

`arena-economic-boundary-v1` retains `version,side,ordinal,phase,turn,planningOrdinal,grantOrdinal,seqBefore,seqThrough,groups,snapshot`.
`phase` is `initial|turn-open|settled`; snapshot is the **unchanged AuthorizedView v2**, not a place to add economic fields.

| Boundary | Invariant |
|---|---|
| Initial | Boundary/planning/grant/sequence counters0, groups empty; actual fixture snapshot/endowment. |
| Window k open | Planning/grant k; playable gas refills carried previous capacity. A requested-operation terminal return remains raw terminal truth, not an intent. |
| Window k settled | Planning/grant advance to k+1; action refs retain admitted k. Native end gas0, settled gasIncome/next capacity from native profile. |
| Recipient sequence | Contiguous authorized groups after hidden-empty filtering; never raw frame positions or gaps. |

**NORMAL SETTLEMENTS — public turns1,11,21, equally for both seats:**

| Playable turns | Actual nonterminal settlement | Nominal mineral entitlement White / Black | Next capacity each seat |
|---|---|---|---|
| **1–10** | **0→1** | **1 /1** | **1** |
| **11–20** | **10→11** | **2 /2** | **2** |
| **21–45** | **20→21** | **3 /3** | **3** |

Initialization is endowment, **not a grant**. Settlement updates capacity; end available gas0; next playable open refills that capacity.
Actual mineral credit can differ between seats or be zero because of cap12. Each real settlement still emits one public Settlement/grant and advances grantOrdinal exactly once, including terminal end and zero-credit cases.
Do not filter a zero-credit public grant as an empty private group or sum numeric turns since zero to infer income.
Rejected pairs emit no Admission/debit/end/Settlement/grant. Unconfirmed operations cannot acquire grants merely because a recorded counter advanced.
Turn21 fixture initialization cannot replace the actual20→21 grant control; raw terminal-begin checks in Appendix A cannot replace any normal threshold crossing.

### 3.2 Atomic group grammar

Closed group fields are `kind,seq` and their variant payload; JSON fields use camelCase and tags kebab-case.

| Kind | Payload |
|---|---|
| Admission | `actions[{actionRef{planningOrdinal,acceptedActionOrdinal},action,minerals,gas}]` |
| Effects | `beforeOwn,afterOwn,facts`, from actual native causal effects, not final-board differences. |
| Vision | `turn,changes`, at most64 changed cells. |
| Settlement | `entitlement,credited,gasBeforeReset,nextGasCapacity` |

At most2048 groups and2048 total admission/effect entries per boundary; complete replies also fit1 MiB. Oversize refuses wholly: no chunks, truncation or dropped groups.

### 3.3 Own geometry and locator subjects

```text
OwnGeometry:
  units[{square,type,mode:tank|siege|null}]
  mines[{square,slot}]
  ccLives
UnitSubject: {kind:before-unit,square}
           | {kind:born-unit,actionRef}
MineSubject: {kind:before-mine,square,slot}
           | {kind:born-mine,actionRef}
```

Units use canonical file-major order. Filter mines to recipient OWN entities before per-square occurrence slots0..n-1, then sort by `(square,slot)`.
Slots preserve duplicate-square multiplicity, not global native identity/order gaps or lasting lineage IDs.
Node publishes own locators/native facts only. Rust mints durable recipient-local IDs from filtered history, resolves whole immutable `beforeOwn` plus same-group births, stages all effects, then reconciles complete `afterOwn`.
Swaps and same-square replacements may have transient occupancy collisions; do not reject them by reconciling after each fact.
Reject missing/ambiguous/wrong/retired subjects and final geometry mismatch. Rust never consults private native IDs or uses afterOwn as mode-origin authority.

### 3.4 Closed effect facts

| Effect kind | Fields beyond kind |
|---|---|
| `unit-born` | `actionRef,square,type,mode` |
| `unit-moved` | `subject,from,to` |
| `unit-transformed` | `subject,fromType,toType,toMode` |
| `unit-mode-changed` | `subject,before,after` |
| `unit-destroyed` | `subject,square,type` |
| `deployment-unmaterialized` | `actionRef` |
| `mine-born` | `actionRef,square` |
| `mine-removed` | `subject` |
| `cc-lives-changed` | `before,after` |
| `enemy-destruction-witnessed` | `square,type,ownActionRef` (required-nullable) |

**In-place explicit-origin rule:** `mode` and `toMode` are REQUIRED keys. They hold non-null `tank|siege` iff the birth/destination type is rook; every non-rook requires explicit null. Omission is invalid, not compatibility/defaulting.

| Origin | Native-only construction |
|---|---|
| Birth | Copy the actual recipient-owned `create.entity.tankMode` for rook; null otherwise. Do not inherit from a predecessor by square/ownership. |
| Transform | Follow that actual OWN native entity's transform trace. Use the first subsequent actual mode-change `before`; otherwise actual death entity mode; otherwise the unique matching native frame-after entity mode. Null iff destination is non-rook. |
| Continuation | Starting at that origin, validate **all** subsequent same-entity mode-change `before→after` links, then compare death/frame terminal anchor after those changes. Never stitch chronology across entities. |

The unique native frame-after entity is a bounded private same-identity anchor, **not** an arbitrary authorized afterOwn inference. No final mode can overwrite an earlier transient origin across real later changes.
The producer validates recipient-owned same-entity lineage, mode chains and endpoints **before public sorting**. Missing/conflicting anchors, identity reuse, repeated type-entry and post-retirement effects fail closed; another entity's mode or chronology cannot repair them.
Native creates/transforms may establish Siege without a separate mode-change event. Explicit origin facts therefore carry information that recipient preimages and final surviving occupancy cannot supply, especially on enemy replacement or immediate destruction.
Rust directly installs birth `mode` / transformation `to_mode`, preserves exact before continuity, and records current mode in the full lost unit. Complete afterOwn is a reconciliation check only.
There is no Tank default, unresolved-mode state, postimage-origin resolver, constrained heuristic, optional-absence path, dual parser or ambiguous-refusal substitute for the native value. Truly contradictory/malformed traces still fail closed.
Promotion retains identity/paid basis with no mineral debit; new deployment retains its new ID/actual paid disposition. These semantics and native rules do not change.
Filter empty private groups before sequence allocation; order by recipient-visible keys while preserving each subject's actual causal order. Native IDs/frame indexes/effect keys/private sort gaps never cross the authorized boundary.

## 4. Calculated, seen, captured and lost are different facts

### 4.1 Calculated: entitlement and native costs, not omniscience

Both seats share nominal entitlement, not necessarily actual cap-limited credits. Host-native verification can check both banks privately; recipient history gets only its exact own bank/credits and public nominal facts.
Observed spend/replacement costs/witnessed loss do not establish hidden enemy bank or purchase history.

```text
originBank + sum(actualMineralCredits) - sum(acceptedMineralDebits)
  = currentOwnBank
paidMineralDebits = survivingPaidBasis + destroyedPaidBasis + wastedPaidBasis

gasBeforeReset = openAvailableGas - sum(acceptedOwnGasDebits)
unusedDiscard = gasBeforeReset
native end available gas = 0
next playable open gasIncome = previous snapshot.gasIncome
next playable open available gas = carried updated capacity
```

Keep debit and settlement-credit receipts/causal refs distinct; use checked integer arithmetic and reject negative/overflowing/unmatched/inconsistent payments.
Settlement `nextGasCapacity` does not credit available gas into a native end snapshot. Discard unused gas, never add it to minerals or carry it as wealth.
Validate initial/settled gasIncome against current-turn profile and playable open against the previous accepted snapshot; preserve terminal-begin raw fields separately.

### 4.2 Seen: current authorized cells plus timestamped memory

Current observations describe authorized squares at their exact checkpoints. Memory records the last observation/turn, not present hidden occupancy or unique persistent enemy identity.
Repeat sightings update evidence, never mint assets or prove all remembered units coexist. Unknown cells preserve memory; lit own/empty cells and matching witnessed death clear it.
Only lit observations add everLit; authorized refreshes update lastObservedTurn without exposing hidden checkpoint counts.
Own units/mines are exact local lineage; enemy memory remains square assertions. IDs/sequences depend only on filtered facts, not hidden global allocation.

### 4.3 Captured: witnessed enemy ordinary loss

Require actual native destruction and the matching causal-before victim, authorized by visibility at that position or a real matching consumed capture proof.
Fog disappearance/final differences/stale memory/planned targets/deferred private queries cannot manufacture a witness or actor attribution.
Required-nullable `ownActionRef` binds an actual native **recipient source action**, not killer ownership; null when no authorized recipient binding exists, never an enemy action ref.
Name the non-null subset `ownActionCausedWitnessedEnemyDestruction`. A mine-trigger source can be the victim's action; this does not establish who killed it.
Enemy type/replacement value does not reveal paid basis: endowment/free promotion remain possible. Keep CC shots/lives separate.

### 4.4 Lost: exact own paid basis, separate replacement and waste

Every accepted deployment payment binds exactly one native disposition: materialized entity basis or paid wasted deployment, never a refund/fabricated death.
Materialized then destroyed in the same group retains both causal birth and loss, including exact mode at loss from explicit origin plus actual continuations.
Endowed basis0; free promotion retains existing identity/basis. Death moves that basis surviving→destroyed exactly once; replacement value is a separate current-cost fact.
CC lives remain separate and ordinary king replacement0 while native cost.k stays1. Seen/captured facts mint no own bank/paid receipt.

## 5. Independent reconstruction and authorization pipeline

### 5.1 Single economic pass, not policy replay

`arena ledger --record <file>` uses fixed `apps/arena/engine/worker-economic.ts` / `arena-economic-v1` and **one independent native-consequence pass**.
It does not call `replay_record`, regenerate selectors/candidates/seeds, verify policy choices or construct `VerifiedRun`; report `policyVerification:not-executed`. Existing `arena replay` retains native+policy verification.
Read the existing record host-side without rewriting it. Reconstruct its fixed fixture/admitted queues with unchanged `initializeProvenance`, `beginTurnWithProvenance`, `endTurnWithProvenance` and native income helpers, not live session mutation/commit or recorded successor states as an oracle.
Compare **every** recorded initial/open/committed/settled state/view/bank/grant/raw begin/resolve/request/rejection/final stop/outcome, including terminal/window-limit/checked-failed-prefix tails.
Keep native rejection witness/prefix without receipts/debits/settlement/grant; an unconfirmed mutation is not executed to fabricate a verified tail.
No production import from legacy arena/training or `.test.ts` oracle; existing public V3 legacy export oracle stays test-only.

### 5.2 Fixed protocol and file responsibilities

```text
request = {protocol,id,op,...operationFields}
success = {protocol,id,ok:true,result}
failure = {protocol,id,ok:false,error:{code,message,context,witness}}
protocol = arena-economic-v1
```

Failure context/witness keys are REQUIRED NULLABLE; codes remain `BAD_REQUEST,STATE,STALE_CONTEXT,NATIVE_REJECTION,ENGINE_FAILURE,LIMIT`.
All nested objects stay closed. Enforce strictly increasing u32 request IDs, one outstanding request and exact protocol/id/result-kind correlation.

| Request | Success result |
|---|---|
| `economic.start{fixture}` | `{kind:started,session,fixture,initial,outcome,rules,boundaries:{w,b}}` |
| `economic.open{planningOrdinal}` planning | `{kind:planning,context,views:{w,b},begin,boundaries:{w,b}}` |
| open terminal | `{kind:terminal,session,outcome,image,begin,boundaries}` |
| `economic.settle{context,requests:{w,b}}` | `{kind:committed,context,begin,settlement,boundaries:{w,b}}` |
| `economic.close{}` | `{kind:closed,session,pendingBegin,image,outcome}` |

Start initial/native outcome are host comparison facts; outcome is required-nullable and rules appear only at start. Initial authorized boundaries retain fixture endowment/zero counters.
Planning begin is host-only raw BeginRecord beside authorized views, never a live-policy widening. Terminal begin/boundaries are required-nullable: new terminal begin supplies both; preexisting terminal without new begin supplies null/null and no duplicate boundary.
Settle stages both queues against the same post-begin state; bind refs before resolution and compare companion nativeResult to original rawResolve **before restoring retained bank**, then grant native income once.
Group order is admission→native effects/vision→settlement; action refs retain admitted planning ordinal.
NATIVE_REJECTION returns exact existing witness, not successful pass/empty settlement; preserve checked opening prefix/clear pending begin according to close semantics.
Close pendingBegin/outcome are required-nullable; close emits **no new boundaries**, clears worker and accepts successful EOF only after closed.
Native initial/begin/settlement/image/outcome/SCFEN/banks/provenance stay host-only. Rust fold receives checked rules/authorized boundaries, not private truth.
Production accepts no custom board/provenance/module/snapshot/executable paths; custom fixtures remain test-internal.

| Existing allocation | Paths |
|---|---|
| Rust ledger | `packages/training/src/ledger/{mod,contracts,history,work}.rs` |
| Shared controls/fixture | `packages/training/tests/{ledger_contracts,ledger_history}.rs`, `tests/fixtures/ledger-boundaries.json` |
| Node path/tests | `apps/arena/engine/{economic-wire,economic-replay,economic-project,worker-economic}.ts`, `engine/test/{economic-project,economic-replay,worker-economic}.test.ts` |
| Host/client/transport/controls | `apps/arena/src/{economic,economic_client,worker_transport}.rs`, `tests/{economic_replay,readiness}.rs`, `tests/support/economic.rs` |

No new module/file/golden rewrite or coverage expansion belongs to this revision.

### 5.3 Filter before sequence allocation; Rust owns durable IDs

```text
RunRecord host comparison
 -> independent native consequences + private causal trace
 -> recipient authorization + OWN explicit native origin modes
 -> contiguous seq / group-local locators / no lasting native IDs
 -> closed authorized boundary pair
 -> Rust direct mode facts / lineage / accounting / atomic publication
 -> host-private complete-run capability OR scoped failed prefix
```

Use actual causal-before/path-visibility checkpoints and consumed-target proof; final visibility/unconsumed probes do not authorize transient facts.
Two private histories with the same authorized facts must yield byte-identical authorized histories, ordering, sequences, local IDs and authorized-input refusals. Private-only diagnostic differences stay outside model DTOs.
Never publish SCFEN/opponent resources/provenance/global IDs/frame gaps/hidden masks as model inputs or proof-like public identifiers.

## 6. Deterministic history, identity and resource bounds

### 6.1 Strict closed facts and transactional folding

Reject missing/unknown/duplicate keys, positional/unit-map aliases, invalid tags, nonfinite/out-of-range numbers and oversized arrays/strings before trusting facts.
Bind host session/record and checked recipient/rules/phase/ordinals; reject foreign/stale/swapped/gapped/reordered/changed inputs.
Retain **only the last pair's full canonical bytes** (sorted object keys, array order preserved). Identical immediate current pair is a charged idempotent no-op; conflicting current pair rejects; older pair rejects SEQUENCE.
No digest-only key, whole-episode canonical retention, duplicate payment/ID/loss minting or meter reset. Repeated RPC IDs fail transport independently.
At `last.turn >= rules.max_turn`, reject distinct successors even with live CCs; charged identical current duplication remains allowed at horizon including initial45/custom-max1.
Generic Pair requires both keys even for nullable/nested values.
Resolve immutable preimages/same-group births, directly fold explicit origin/continuation facts, reconcile afterOwn only at whole-group completion, and validate/precharge/conserve the complete pair **before either seat publishes**.
Failure retains only prior checked pairs, no half-pair or full-record capability for a rejected tail; spent work is not refunded.

### 6.2 Actual shared contract API and lead-frozen history API

`ContractResult<T> = Result<T,LedgerError>`; use shared object `Pair<T>{w,b}`.
Contract entrypoints remain `LedgerRules::validate(work)`, `EconomicBoundary::validate(rules,work)`, `decode_boundary(bytes,rules,work)`, `canonical_boundary_bytes(boundary,work)` and `OwnGeometry::from_snapshot(snapshot,work)`.
Each owns its required charges; earlier validation/serialization does not waive another call's work. Data validation proves neither native provenance nor history conservation.

```rust
LedgerPair::initialize(rules, &Pair<EconomicBoundary>, &mut LedgerWork)
    -> ContractResult<Self>
advance(&self, &Pair<EconomicBoundary>, &mut LedgerWork)
    -> ContractResult<Self>
reports(&self, &mut LedgerWork) -> ContractResult<Pair<SideLedgerReport>>
rules(&self) -> &LedgerRules
last_boundaries(&self) -> &Pair<EconomicBoundary>
```

Keep state private/checked and advance immutable/atomic. `LedgerPair` alone is not host-private `VerifiedEconomicRun`.
SideLedgerReport camelCase roots are `side,scope,boundaryOrdinal,nativeTurn,planningOrdinal,grantOrdinal,sequenceThrough,calculated,seen,witnessedEnemyDestruction,ownLost,ownUnits,ownMines`; scope is record-initial-forward.

| Region | Meaning |
|---|---|
| calculated | Origin/nominal/actual/capped mineral totals, paid conservation, gas debits/discard/refills, own material, accepted/deployment/settlement receipts. |
| seen | Current cells/material, everLit, enemy CC squares and timestamped/stale square memory. |
| witnessedEnemyDestruction | Witness receipts/totals and own-source-action subset, not killer ownership/paid enemy basis. |
| ownLost/ownUnits | Exact paid basis, separate replacement/native costs, identity/origin/birth/type-change/loss including exact transient loss mode; paid waste separate. |
| ownMines | Active/removed local lineage, same-square slots and action/endowment origins. |

Host closeout is a separate projection, not a change to these raw reports/equations.

### 6.3 Fixed worker and bounded transport

Use fixed worker/cwd `apps/arena`, scrub execution-affecting inherited environment including NODE_OPTIONS, and allow no shell/eval/caller scripts/installations/automatic mutation retry.
This is trusted built-in Linux/Unix worker discipline, not hostile-code containment or universal portability.

| Bound | Unchanged contract |
|---|---|
| Request / reply / stderr |64 KiB each request /1 MiB each reply /64 KiB cumulative stderr; strict UTF-8/framing/IDs. |
| Record / report stdout |16 MiB each; record remains host-side, no dataset/evidence output writes. |
| Lifecycle | One absolute300 seconds **including3 seconds cleanup**, not300+3 or renewed per RPC. |
| Window transaction | One absolute10 seconds across operations/helpers/both seats; only next window renews. |
| Public projection |2048 groups/total admission+effect entries;64 changes/Vision;1-MiB reply also applies. |
| Private native projection | Existing1152-effect/70-entity/16-MiB native limits, bounded indexes and finite checks; no new logical Node fee/meter. |

The completed producer uses bounded per-frame maps and same-entity lists; forward transformation scans may repeat under the existing **1152 total native effects** ceiling with time checks during scans and the absolute10-second deadline. There is **no8-transform cap**, no new Node logical fee and no new meter; do not raise native caps opportunistically.
Reject malformed/extra/wrong-ID replies, EOF/UTF-8/byte/deadline excess; close/reap explicitly. Oversize refuses wholly, no chunks/truncation/dropped events or substituted engine/pass/state.
No wall-clock/headroom/capacity-adequacy claim follows from logical bounds or tests alone.

### 6.4 Actual shared fees and one work meter per reconstructed window

**One inclusive1048576 logical LedgerWork meter plus one absolute10-second deadline per reconstructed window**, shared by BOTH recipients, not per seat/RPC/boundary or whole match.
First transaction includes initial+open+settle; subsequent windows open+settle. Terminal/rejected/unsettled close keeps current accounting and grants nothing absent an actual terminal end settlement.
Frames/helpers/RPCs/duplicates do not reset/renew/replace allowances. Only beginning the next reconstructed window starts a fresh meter/deadline.
Precharge authorized decode/validation, identity/observation allocation, traversal/arithmetic/mutation with checked integers. Private native execution/raw-host comparisons remain separately byte/time bounded outside logical ledger work.
Host may conservatively precharge whole reply bytes before parse to avoid uncharged public allocation, carrying the same meter into fold; this does not prove whole-engine capacity.

| Shared work.rs fee | Units |
|---|---|
| Input byte / table entry |1 each |
| Cell / unit / mine (including own siege-list entries) |8 each |
| Accepted action / effect |16 each |
| Group / boundary |8 /64 |
| Rules |32 + entries in both tables |
| Canonical output byte |3 plus own boundary traversal |
| History base/cell/memory |128 /16 /32 |
| History state/report item |192 /320 |
| Profile clone / identity byte |64+8 per table entry /1 |
| Fold fact / accepted action |64 /192 |
| Geometry / lookup / arithmetic item |32 /2 /32 |

Geometry/snapshot/boundary charges traverse their actual units/mines/cells/groups/actions/facts/vision entries; canonical bytes also charge their boundary processing.
API remains `new,with_limit,used,remaining,limit,charge,preflight_bytes,charge_rules,charge_geometry,charge_snapshot,charge_boundary`; with_limit permits only1..=1048576.
Individual charge failure leaves used unchanged; composite failure keeps earlier successful charges, and pair rollback refunds nothing.
The completed Rust revision **removes** obsolete own-rook inheritance scratch/pre-scan and its extra2-per-fact reservation; no new origin resolver/traversal replaces it. Shared constants and other lookup/fact/geometry/arithmetic applications remain unchanged; existing byte/canonical fees cover the added fields.
Host receipt remains `{ordinal,scope:both-recipients-window-transaction,used,limit}`. Chronology charges64/event and16/seat grant match; terminal checked assembly/projection64+2×16+64=160 uses the existing transaction meter.
Preserve separate composition attempt cap2048. Neither logical counter establishes process memory/runtime adequacy or closes legacy resource stops.

## 7. Verification evidence and readiness diagnostics

### 7.1 Capability construction, not caller certification

Only host-private `VerifiedEconomicRun` after complete terminal/window-limit native correspondence, authorized lineage/conservation through the claimed boundary and clean worker exit supplies full verified-ledger evidence.
No public checked history/serialized ready/verified/receipt ID substitutes for it. Private NativeChronology stages AwaitingBegin/Intent/Terminal and CheckedTerminalAccounting gate terminal closeout.
Failed/unconfirmed planning/bridge tails retain checked prefix/pending operation only; native rejection remains a failed prefix, not full VerifiedEconomicRun or promoted W/D/L.
Distinguish verified native terminal from verified host window limit; never invent a draw or alter evaluation's conserved denominator.

### 7.2 Diagnostics must check facts

Checks serialize `{id,scope,status,reason,receiptRef}`, status `pass|fail|not-executed`, examined boundary/range and actual evidence references.
ReceiptRef is actual `{session,whiteBoundaryOrdinal,blackBoundaryOrdinal,completedWindows}`, not an invented external path.
IDs include native-defaults-profile,ordered-causal-history,mineral-conservation,paid-basis-conservation,sequence-identity,native-correspondence,protocol-bounds,clean-exit,full-record-coverage.
Prefix checks may pass their confirmed range while full coverage fails. Missing/unexecuted evidence stays explicit; computed failure reasoning remains outside authorized model inputs when private.

Report `arena-economic-report-v1` remains `assurance:NON_ADMITTED,learned:false,modelArtifact:null,trainingReady:false,scope:record-initial-forward,policyVerification:not-executed`.
Policy verification belongs to arena replay, never a passing ledger check. Full418 semantics/parity, belief/PMF, calibration/learner, runtime/resource/authority readiness and learned admission remain unexecuted/deferred, not supplied by this ledger.
CLI exit0 means complete economic verification/clean exit only; exit1 means refusal/rejection/prefix/runtime/tamper/cleanup failure; exit2 invalid args/config/schema. A gate PASS would not certify arbitrary future records or training readiness.

### 7.3 Host-only terminal training closeout

Preserve separate host-private `terminal_training_closeout(&VerifiedEconomicRun)->Option<TerminalTrainingCloseout>` in `apps/arena/src/economic.rs`.
It constrains terminal intent resources without rolling back native income or changing engine/UI/protocol/rewards. There is no current learner or measured training-bias result; reward remains WDL-only±1/0, no resource shaping/bootstrap.

`terminalTrainingCloseout` is REQUIRED NULLABLE in the same report:

```text
version: arena-terminal-training-closeout-v1
terminalPhase: initial | begin | end
excludedReceipt: {
  grantOrdinal, sourcePlanningOrdinal, settledTurn,
  reason: terminal-at-end | terminal-at-following-check
} | null
seats: {
  w: {excludedMineralCredit,eligibleMineralCredits,trainingClosingBank},
  b: {excludedMineralCredit,eligibleMineralCredits,trainingClosingBank}
}
terminalGasRefillEligible: false
usableGas: {w:0,b:0}
```

Some requires complete verified **native terminal**, checked phase/receipt chronology and clean exit. Window-limit/trailing Planning, rejection, unknown mutation, failed/unresolved prefix or absent complete proof returns None.
NativeChronology checks source planning context, settled turn, exact grant ordinal/actual credited amounts and both boundary clocks before CheckedTerminalAccounting; no deserialized proof flag grants eligibility.

| Terminal chronology | Exact treatment |
|---|---|
| Direct terminal end | Exclude that settlement's **actual credited amount**, bound to receipt/source ordinal. Raw settlement/grant/history unchanged. |
| Fatal following begin | Exclude only the matching preceding actual credit whose intent never opened, not a tier inferred from final game-over counter. |
| Initial terminal | No excluded receipt; preserve endowed opening bank, excludedReceipt:null. |
| Matching begin passes | Release preceding credit before any feature construction; never exclude older already-usable income. |

```text
eligibleMineralCredits = rawActualCredits - excludedActualCredit
trainingClosingBank = rawClosingBank - excludedActualCredit
```

Use checked integer subtraction per seat and bind exact grantOrdinal/sourcePlanningOrdinal/settledTurn/reason even when credit0.
Normal nominal schedule/capped receipts remain raw native truth. Closeout never rewrites grants, refunds gas, changes promotion/paid basis or raw conservation.
usableGas0 means **no terminal intent budget**, not native capacity/expense rollback.
Required actual-native following-check case: initial turn9, kings e1/c3,lives1/1,bank3; White `C e1→d2`/Black pass settles at10 with credit1/bank4/no outcome; following begin ends at raw11 with bank4 and no intent. Training bank is3, **not2 inferred from tier11**.
Node actual-native phase controls and Rust synthetic private chronology controls have different assurance scopes; synthetic controls are not production custom-board admission.
Keep closeout outside AuthorizedFeatureHistory, WDL rewards, frozen D+B truth, calibration and terminal bootstrap permissions. Raw provenance/grants/history and replay/evaluation stay unchanged; closeout grants no model/training authority.

<a id="8-pre-repair-proof-obligations-and-current-repairrereview-lock"></a>
## 8. Proof obligations and conditional review lock

Retain the [PR test matrix](../_plans/native-economic-ledger.md#5-persisted-test-obligations), including actual default opening/all fixtures/45-window pass-pass,0→1/10→11/20→21 nominal grants and next capacities for BOTH seats,9→10/44→45,cap asymmetry/zero-credit/horizon and Appendix A raw edges.
Add required mode shape/canonical negatives, own/enemy/empty predecessor origins, free paid/endowed promotion, same-entity mode chains/terminal anchors, transient birth/transform/death, retired/wrong subjects, contradictions and atomic replay/cap controls.
Retain exact closeout receipt/math/null-prefix/released-income controls and isolation from raw history/WDL/D+B/features. Keep actual Node-native evidence separate from Rust synthetic proofs.
Both actual own/enemy full-native-journal replacement controls are GREEN within the **current complete29-command gate**, whose Rust301 includes arena106/training165/xtask30 alongside Node175/core668. This is one unchanged-input root run, not stitched leaves.
After all code/spec handoffs and input freeze, the lead completed static/build/dependency, unfiltered Rust/Node/core, required nonempty targets, before/after legacy/evidence/dependency/index preservation, coverage, both owner checkonly/bounded SVG, whitespace and matching before/after258d identity: **all PASS** (§9.3). Separate lead note/navigation preflight also PASS; those checks are not fixed-invoice commands.
Only then invoke **ALL3** resolving adversarial/security/DevOps rereviews. Any subsequent source/configuration/test/index/diagram edit requires the complete gate again; no stitched receipts or skipped/filtered target unlocks review. Markdown-only evidence/status updates preserve verified inputs and require fresh whitespace/preservation checks.
That actual PASS unlocked the three fresh rereviews, now **ALL3 DONE/READY**, findings NONE; HIGH-4 explicitly RESOLVED and security's full scope inspection complete. This completes bounded ledger/terminal-closeout verification and review, not full learner/runtime/training readiness or publication.

<a id="9-accepted-freeze-execution-evidence-and-closing-lifecycle"></a>
## 9. Current handoffs, actual evidence and limits

### 9.1 Implementation handoffs

<a id="91-lead-supplied-leaf-chronology--never-a-whole-gate-invoice"></a>
<a id="92-new-shared-golden-fidelity-repair--scoped-regression-receipts"></a>

| Supplied handoff | Actual scope / limit |
|---|---|
| Final architect freeze | DONE: in-place required mode/toMode, native-only origins, direct Rust continuity and unchanged fees/caps/deadlines. Actual producer uses bounded maps/same-entity lists and deadline-checked repeated scans under1152 total effects, not an8-transform cap. |
| Shared contracts | DONE: Rust contracts +ledger_contracts tests +Node wire. Required strict mode/nullability controls GREEN within contract42 in the current complete gate. |
| Rust history `ses_eb7ffcc3effel6q0ggWIqfGJdc` | DONE, history.rs/ledger_history.rs consumer changes. Direct fields, exact continuity/loss mode, removed scratch/pre-scan/reservation; seven added history functions. Current complete gate includes training165/history49/contracts42 and all-targets check/Clippy-Dwarnings/fmt PASS. |
| Node `ses_eb7f1c3fbffeMsCCBwYIcAyS5I` | DONE, economic-project.ts +three economic test files. Current complete gate unfilteredNode175/types/warnings-denied lint PASS includes actual cross-owner/native promotion/privacy controls under the revised producer. |
| Host within current root gate | **Unfilteredarena106 PASS** =60lib+9economic_replay+4readiness+9replay+10runner+7schedule+7smoke,0failed/ignored/filtered. Actual own/enemy replacement journals/raw bytes/EOF/conservation GREEN;45-window/threshold/policy separation/closeout/CLI/readiness/old native+policy replay controls ran within Rust301. |
| Shared golden | Existing fixture remains unchanged in this revision; no unresolved golden-gas repair or corpus rewrite is assigned. |

Current totals come from the single present receipt in §9.3, not arithmetic combining independent handoff runs. No execution is repeated by this documentation pass.

<a id="95-actual-findings-required-reasoning-and-repair-handoffs"></a>
<a id="ledger-adv-4--high-native-producer-repro-actual-rust-fixcontract-decision-pending"></a>
<a id="92-open-ledger-adv-4--actual-native-premise-and-host-red"></a>
<a id="92-ledger-adv-4--native-regression-redgreen-review-closure-pending"></a>
### 9.2 LEDGER-ADV-4 — native regression RED→GREEN, RESOLVED

HIGH-4 is not static-only now. In `all-actors-v1`, window0 White pass/Black `C d8→d2`+`F siegeMode from d8`; window1 White `B deploy r e1→d2`/Black pass; following open23 has a new **White Siege Rook d2**.
NativeReplay matches every record. White beforeOwn has no d2 unit and afterOwn r/Siege; UnitBorn and visible enemy death share ownRef(1,0), old Black Siege Rook retires, native birth has a new ID/Siege with **no mode-change event**.
Debit5 minerals/1 gas; banks12/12→7/12→10/12, credit3/0. Hidden-d8-Siege control gives byte-identical White boundaries/observations.
Additional actual-native promotion control: White pawn a7 captures Black rook b8 and promotes to r; marked/unmarked predecessor controls produce p/null→r/Siege or Tank, **same native identity**, no mode-change event, debit0/banks6/6.
Current **Node175/types/warnings-denied lint PASS includes the revised producer** and these native replacement/promotion/privacy controls as part of the complete unchanged-input gate in §9.3.
The new full-native-journal host counterexample was actually executed RED: **0 pass/1 fail/59 filtered, exit101, CONSERVATION whole-afterOwn mismatch**. Native journals/normal EOF/raw-byte comparisons passed before the fold. This is targeted host evidence, not an unfiltered full-host run.
Rust explicit-mode and Node producer repairs are DONE. Both actual own/enemy replacement regressions are **GREEN within current whole-gate arena106/Rust301**, preserving native journals/raw bytes/clean EOF/conservation. Current258d adversarial review explicitly **RESOLVES LEDGER-ADV-4**, with no new findings; security and DevOps also returned current READY, completing all3 bounded closing reviews.

<a id="93-historical-complete-whole-gate--pre-repair-pass--matching-original-input"></a>
<a id="94-actual-first-closing-cycle--adversarial-no--current-closing-blocked"></a>
<a id="94-actual-first-closing-cycle--historical-pre-repair-dispositions"></a>
<a id="96-observed-post-repair-run--raw-artifacts-lost-source-join-checkpoint-retained"></a>
<a id="93-prior-observed-proof--not-verification-of-the-revised-inputs"></a>
### 9.3 Current complete unchanged-input gate — PASS

Lead execution **sh_14d22f3bb001z0KzLRlx3wHIG2 DONE/PASS** produced the actual [current receipt.json](/tmp/proveo-opencode-runtime-cache-1000-21d690750d3738af14d58c25/tmp/opencode/rust-training-20315-1792295503171478138-0/receipt.json).
The receipt is **PRESENT and was read** for this update; it is not reconstructed from a lost artifact or inferred from a source join.

| Receipt field | Actual current value |
|---|---|
| Version / scope | `rust-training-verification-v3` / `native-economic-ledger` |
| Status / reviewEligible | `PASS` / `true` |
| error / identityError | `null` / `null` |
| Command results |29/29 PASS, exit0/reaped, no work timeout, signal, cleanup error or cleanup timeout |

```text
inputSha256 == inputSha256After ==
258d4126e0641365f53b173a3415674412b095c6500238b0fafb0e0f446eb76e
```

The content identity binds the frozen source/configuration/tests/locks/index/diagram inputs before and after that single run. Markdown/target/node_modules/.generated/external theme bytes remain excluded by the receipt policy; this is not a hermetic-theme claim or a new hash computed here.

| Current unfiltered test scope | Actual count / result |
|---|---|
| Rust workspace/all targets | **301 PASS** =arena106 +training165 +xtask30 |
| Node engine | **175 PASS** |
| Native core | **668 PASS** |
| Required `packages/training/tests/ledger_contracts.rs` |42, nonempty/included in training165 |
| Required `packages/training/tests/ledger_history.rs` |49, nonempty/included in training165 |
| Required `apps/arena/tests/economic_replay.rs` |9, nonempty/included in arena106 |
| Required `apps/arena/tests/readiness.rs` |4, nonempty/included in arena106 |

No required tests were skipped/ignored/filtered. Counts are this root run's invoice, not stitched leaf totals; the required-target rows are subsets, not extra tests.

| Fixed-invoice command groups | Actual result |
|---|---|
| Seven pinned-tool version checks |PASS |
| Tracked/untracked legacy preservation before execution |PASS |
| Baseline lock/package/index preservation, with covers30/54 and43-entry preservation |PASS |
| Engine types/lint |PASS |
| Rust fmt/all-targets check/Clippy-Dwarnings |PASS |
| Selected CPU dependencies/workspace build |PASS |
| Unfiltered Rust/Node/core tests |PASS |
| Both owner PlantUML syntax jobs |PASS |
| Both bounded SVG jobs |PASS |
| Tracked/untracked legacy preservation after execution |PASS |
| Receipt-time whitespace |PASS |

Separate **lead-executed preflight PASS**, not extra commands in the29-result invoice:22 notes,2–5 lines/max46 columns, note bodies byte-unchanged, PLAN historical suffix4+ and README first2+suffix6+ byte-exact to HEAD.
Source/configuration/test/index/diagram inputs stayed unchanged through ledger publication. Lead completed final metadata whitespace/navigation/scope checks and the current-input join before committing b47befd0. This258d proof remains the bounded completed ledger base, not verification of later F1 work.

<a id="97-latest-post-repair-closing-cycle--new-high-4-blocks-closing"></a>
<a id="94-current-closing-lock"></a>
### 9.4 Current closing — ALL3 READY, bounded ledger COMPLETE

The actual current258d whole PASS unlocked fresh read-only rereviews in the same three sessions. **All three actual final current dispositions are READY**, findings NONE, not borrowed earlier verdicts or a version waiver.

| Fresh resolving review | Actual current status |
|---|---|
| Adversarial `ses_eb7cb724effe5uE3Hebn2Gb0wF` |**DONE `READY TO MERGE:yes`**, LEDGER-ADV-4 **RESOLVED**, new findings NONE. Cites native birth-mode projector→direct Rust fold and actual native-journal regression; bounded NON_ADMITTED ledger/terminal closeout only, not training readiness. |
| Security `ses_eb7cb7218ffePBBBS1MqCmBCtM` |**DONE `READY TO MERGE:yes`**, findings NONE/risk low. All16 inventory paths/captured HEAD diff against4990d951 plus surrounding source and current29/301/175/668 receipt/matching258d inspected; prior scope limitation **RESOLVED**. Read-only source/diff/receipt inspection, no independent gate rerun. Bounded NON_ADMITTED ledger/terminal closeout only. |
| DevOps `ses_eb7cb7206ffe1XrslbW4r6OyGq` |**DONE `READY TO MERGE:yes`**, findings NONE. Current258d source/receipt/raw logs,29/301/175/668, origin bounds/deadline/no8-cap/no new meter, direct fold/precharges, identity/targets/native conservation/raw bytes/clean exit inspected. No independent gate rerun or container/hermetic/runtime/full-learner approval. |

Security completed the supplied16-file inventory/HEAD-diff scope inspection against4990d951; that scope gap is resolved, not an open defect. The captured diff may precede later Markdown status metadata, but no verified source/code/diagram/index or normative contract changed after the gate.
Optional property-based native-mode-chain/hidden-twin strengthening remains non-blocking and is **not executed proof**. These approvals establish no container/hermetic/runtime/full-learner or training readiness.

| Gate/closure boundary | Actual now | After verification/review closure — publication boundary |
|---|---|---|
| Complete verification |29/301 Rust/175 Node/668 core PASS, present258d receipt |Retain that unchanged-input proof; repeat whole gate if source/config/tests/index/diagrams change. |
| HIGH-4 |Code fixed/native regression/full gate GREEN; current adversarial explicitly RESOLVED |Resolution is already received; do not relabel it unresolved because a different review is incomplete. |
| Closing reviews |ALL3 current final reviews DONE/READY, findings NONE |Bounded ledger/terminal-closeout verification and review COMPLETE; no pending review blocker. |
| Markdown follow-up |Lead final whitespace/navigation/scope checks and current-input join completed before ledger commit |Later F1 goals are separate post-publication edits, not additional ledger execution proof. |
| Publication |DONE lead b47befd021bef04eea0bfe20a9308a71aa20f09f,16 files/non-force push from preserved4990d951; HEAD=remote/clean at publication |No ledger publication hold remains; do not claim later F1 goal/source changes in that commit. |
| F1/readiness |Separate F1 assignment active/goals persisted, implementation PLANNED; trainingReady:false/NON_ADMITTED |Ledger proof is not new F1 implementation/test/runtime/readiness proof. |

HIGH-4 resolution and **all-three bounded closing approvals are actual and COMPLETE**. Lead publication **b47befd021bef04eea0bfe20a9308a71aa20f09f is actual and COMPLETE**; the lead confirmed post-push HEAD/remote equality and clean status at that checkpoint. Separate F1 goals are now assigned before implementation; no final training readiness follows.

<a id="98-user-performed-publication--not-all-closing-acceptance"></a>
### 9.5 User publication

The user personally staged/committed/pushed **4990d951034632d68307d3bb06c9d99e68b60da3**, `feat: economic ledgers & training prep`,39 files, parent `df968b5c33b432a3901f8cb91296b06deb394230`, to origin/feat-ml-adjuntant.
The lead confirmed clean/matching remote **at that publication checkpoint**, not after subsequent edits. Current258d verification and ALL3 approvals apply to the follow-up; they do not retroactively place these changes in the user commit.
The lead subsequently committed the16-file verified repair as **b47befd021bef04eea0bfe20a9308a71aa20f09f** and successfully non-force pushed origin4990d951→b47befd0, then confirmed actual HEAD/remote equality and clean status. User4990d951 remains preserved, not amended/rebased; these later F1 goal edits are not included in b47befd0 without a later actual commit.

## 10. Diagram authoring and readability register

The existing [training](../packages/training/burn-compat.puml) and [arena](../apps/arena/burn-compat.puml) explicit-origin labels and stable status comments were frozen **before** the current258d gate. This pass edits neither diagram. Retained synthetic compatibility/baseline graphs and **all22 note bodies remain byte-unchanged**.
Current gate covers30/54, baseline43/index preservation and both owner syntax/bounded SVG jobs PASS. No covers/index bytes/entries/order/fingerprints/unresolved metadata change in this evidence-only update.
The ledger delivery created no F1 source/fixture/owner. The separate F1 assignment now persists [PR goals](../_plans/native-feature-seams.md) and [contracts/reasoning](native-feature-seams.md) only; source implementation remains planned. Shared navigation edits stay prefix-only, preserving historical suffix bytes.
Separate lead preflight verified22 notes fit2–5 lines/max46 columns with byte-unchanged bodies; it is not a fixed-invoice command. No reasoning note is written/rewritten here; the unchanged eight-note FK register below is retained, not recomputed.
FK uses `0.39*(words/sentences)+11.8*(syllables/words)-15.59` on markup-free text; prior syllable counts are pronunciation-based estimates, not verification receipts.

| Existing reasoning note | Words / sentences / syllables | Retained FK |
|---|---|---|
| training/burn-compat.puml · bottom of LEDGER_CONTRACTS |31 /2 /52 |10.2 |
| training/burn-compat.puml · bottom of LEDGER_HISTORY |30 /2 /55 |11.9 |
| training/burn-compat.puml · bottom of LEDGER_WORK |32 /2 /58 |12.0 |
| arena/burn-compat.puml · bottom of REPLAY_NATIVE |33 /2 /57 |11.2 |
| arena/burn-compat.puml · bottom of ECO_PROJECT |31 /2 /57 |12.2 |
| arena/burn-compat.puml · bottom of ECO_HOST |30 /2 /54 |11.5 |
| arena/burn-compat.puml · bottom of CLOSEOUT |32 /2 /57 |11.7 |
| arena/burn-compat.puml · right of CLOSEOUT |34 /2 /59 |11.5 |

Syntax/bounded SVG/receipt-time whitespace/matching source identity PASS belong to the completed ledger gate; note/navigation PASS belongs to separate lead preflight. Lead completed publication metadata checks before b47befd0; later F1 edits do not extend that proof. This documentation pass runs no tests/hash/render/command/Git/agent/review/progress poll.

## 11. Following milestone authority — Training-ready selected, policy training excluded

Executor selected **Training-ready**: future features/belief/Rust learner and required bounded **LOCAL** collection, belief-table fitting/calibration, profiling and container validation.
Six pre-training gates remain real418 authorized features/belief, actual Rust learner, authorized calibration, full end-to-end correctness, runtime/resource/authority closure and final complete readiness review. Ledger facts/zero-padding cannot fill them or close legacy resource stops.
Only after these gates may **separate explicit human policy-training approval** authorize training; learned-model admission follows training. No activation/deployment/engine/frozen-contract/protected-corpus rewrite or WDL/D+B/closeout change is authorized.

<a id="99-immediate-next-scope--f1-freeze-done-work-parked"></a>
<a id="f1--freeze-done-implementation-parked"></a>
### F1 — separate goals active, implementation PLANNED

Ledger repair/publication/full proof/ALL3 reviews are DONE. F1 freeze plus manifest-fee/private-seed addendum are DONE, and its separate goals-first assignment is now active: [PR goals](../_plans/native-feature-seams.md) / [contracts and reasoning](native-feature-seams.md). Planned F1 source/tests/gate are NOT LANDED/NOT RUN; this is not new source or authority/readiness closure in the ledger delivery.

### 11.1 Future readiness image authority — Offline local capture selected

Build a **separate** image from explicitly allowlisted installed tools/runtime files **without downloads**; missing components STOP. Exclude credentials/unrelated files and measure captured identities.
Pinned-base acquisition/offline-bundle alternatives were not selected. No image-network install/acquisition, privilege change or fallback follows; separate mise tool-restoration authority does not relax image restrictions.
Future planning must specify new-generation tools/licenses/loaders/native libraries, build/runtime split, identities/size/headroom and actual container proof without changing legacy pins.
No image recipe/build/run, current Docker/headroom result or full container/runtime proof is supplied here.

## Appendix A. Regression only: game-ending native turn-start

**NOT A NORMAL TURN TRANSITION / NO NEXT PLAYABLE TURN.**

Preserve the raw final snapshot when native turn-start ends the game before another round settles. These cases are not mineral-income rules, next-turn gas entitlements or changes to the normal1/2/3 schedule.
The supplied unchanged-native adjacent-CC/one-life probes at origins0/10/20 produce phase O, terminal outcome and CC lives0/0:

| Final game-over counter change | Raw final gas/gasIncome, both seats (not next capacity) | Additional settlement/grant |
|---|---|---|
|0→1 |1 /1 |None; grantOrdinal unchanged |
|10→11 |1 /1 |None; grantOrdinal unchanged |
|20→21 |2 /2 |None; grantOrdinal unchanged |

BoundaryPhase::TurnOpen / phase:turn-open names the **requested operation**. Native phase O/outcome means game over, not an opened playable turn; no next decision can spend those final gas fields.
Keep the native result byte-exact rather than rewriting from the incremented counter's profile. No further native end, mineral income, Settlement group or grant follows that check.
Ad hoc probes are not persisted regression proof or a new gate; retain existing contract/history/Node raw-fidelity controls in the corrected-source gate. Host closeout §7.3 remains a separate safe projection, not raw mutation or a native-engine bug/rule change.
