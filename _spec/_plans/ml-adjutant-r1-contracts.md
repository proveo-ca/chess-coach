# ML Adjutant — exact remaining R1 contracts

Status: **PROPOSED DRAFT — paper contract proposal, NOT accepted or implemented.**
R0: **all 15 findings PENDING: 7 HIGH + 8 MEDIUM; READY TO MERGE: no.**
Security rereview: **UNRECORDED**. Learned model / weights: **NONE**.
R1 contract freeze remains **INCOMPLETE until Executor chooses the profiles and approves the common contract**.
R2–R5 still require implementation and persisted validation; R6 training is not authorized.
This document records no build, training, registry activation, test result, new hash, or evidence.
Only this new document changes; the recipe, weights ledger, PLAN, diagrams, corpus, and evidence remain unchanged.

## 1. Authority, vocabulary, and decision boundary

Every normative sentence below describes a **proposed future contract**, unless explicitly labeled an existing selection or source fact.
Approval can freeze the future R1 design; it cannot certify that the corresponding source or adapter exists.
Native SCFEN parsing, `addScAction`, `beginScTurn`, `endScTurn`, and `scOutcome` remain the rules and outcome authority.
The host supplies pure bookkeeping, trusted-source binding, authorization, supervision, and verification, not a second rules engine.

| Term | Student definition |
|---|---|
| Authorized history | What this side has legitimately learned, including current observation and previously lit squares. |
| Boundary batch | A scheduled bundle of authorized events and one snapshot, checked before the policy sees it. |
| Lineage | A unit's identity through actual movement and transformation, independent of its square. |
| Receipt / disposition | Proof of an actual debit / whether the paid deployment actually created an entity. |
| Paid basis / replacement | Actual own minerals invested / a present-type valuation proxy; these are different quantities. |
| Nominal projection | A conditional own-intent hypothesis, not a predicted or resolved future board. |
| Feature / coefficient | A named numeric measurement / its shared learned multiplier, not a move-specific neuron. |
| Quota / work cap | Capacity for retained unique queues / a bound on attempted generation work. |
| Logit / softmax | A linear candidate score / the normalized sampling distribution over this call's candidates. |
| REINFORCE / baseline | Outcome-driven policy-gradient learning / a prior-return mean reducing gradient variance. |
| Eligible completion | Verified completion with at least one verified sampled decision; only this can update learning. |
| STARTED / checkpoint | A durably consumed attempt / a complete diagnostic learner-state image, not a fallback model. |
| Provenance / content reference | Trusted evidence of origin and execution / a reference to bytes measured later by the host. |

Existing selections remain: `packages/starchess-training`; `H=1`; seven action families; four action positions;
`7×48 + 175 + 1 pass = 512` maximum retained unique queues; `2048` attempted extensions including duplicates/pruned;
authorized events plus snapshots; SHA-256 + `mulberry32`; masters `101..105`; infrastructure abort stops ALL training;
per-seed all-history eligible-return mean, startup `b=0`; summed episode gradient; L2 once per update;
float64 CPU, zero weights, `η=.001`, `τ=1`, `λ=.0001`, no clipping; at most `1000` STARTED attempts/master, `5000` total;
final VALID seed-101 primary, diagnostic cadence every `100` STARTED attempts, no best/switch/fallback and no H3 work.
Full snapshots, hidden legality, corpus identity, future traces, and unrestricted opponent context never become model inputs.
Core remains browser-pure; Node ML/tooling belongs outside core and browser dependency closures.

## 2. Approval slots — no profile is selected by this draft

| Slot | Choices supplied for the upcoming TUI | Draft recommendation |
|---|---|---|
| `PROFILECHOICE_API` | A: arena observations/events; training candidates/features/artifacts. B: arena observations/events/candidates/features; training artifacts. C: arena observations/private projection; training events reducer/candidates/features/artifacts. | A |
| `PROFILECHOICE_PROVENANCE` | A: generic private native companion. B: persistent private engine entity IDs. C: defer provenance and leave R1 incomplete. | A |
| `PROFILECHOICE_QUOTA` | A: first non-classical owner, inactive capacity to compositions. B: first action owner, inactive capacity to active families. C: minimum canonical owner, split inactive capacity. | A |
| `PROFILECHOICE_CURRICULUM` | A: alternating corpus/live. B: 200 corpus warmup then alternating corpus/live. C: corpus/live-White/live-Black cycle. | A |
| `PROFILECHOICE_VALIDATION` | A: standard central differences. B: stricter central differences. C: both prescribed step sizes. | A |
| `PROFILECHOICE_COMMON` | A: approve the complete common contract, including npm identity, 370 fields, RNG, eligibility and checkpoint rules. B: request explicit amendments before approval. C: defer freeze; keep first training blocked. | A, subject to review |

The common npm proposal is **private** `@chess-coach/starchess-training`, version `0.0.1`; it needs approval in every API profile.
API suffixes name TypeScript import surfaces, **not HTTP routes**.
The all-five completion prerequisite proposed below is a training-protocol validity rule, not a new all-five-artifact gate.
Only `PROFILECHOICE_*` values await design choices; future measured references are runtime data, not invented pins.

## 3. Package ownership, exports, and dependency closure

All paths below are proposed exact npm import specifiers, not filesystem URLs.

| Profile | Exact proposed public imports |
|---|---|
| A | `@chess-coach/starchess-arena/observations`, `@chess-coach/starchess-arena/events`; `@chess-coach/starchess-training/candidates`, `@chess-coach/starchess-training/features`, `@chess-coach/starchess-training/artifacts`. |
| B | `@chess-coach/starchess-arena/observations`, `@chess-coach/starchess-arena/events`, `@chess-coach/starchess-arena/candidates`, `@chess-coach/starchess-arena/features`; `@chess-coach/starchess-training/artifacts`. |
| C | `@chess-coach/starchess-arena/observations`; `@chess-coach/starchess-training/events`, `@chess-coach/starchess-training/candidates`, `@chess-coach/starchess-training/features`, `@chess-coach/starchess-training/artifacts`. Arena owns DTOs; its boundary projection stays private. |

There is no wildcard export, training root barrel, public host export, deep-import escape, or public unrestricted `SideContext`.
All model-facing entries expose only authorized DTOs, pure validation/composition/encoding, and inference-safe artifacts.
In C, `/events` implements a pure ledger reducer over arena DTOs; it cannot produce or authorize native events.
The host adapter, trainer coordinator, corpus loader, filesystem codecs, checkpoint control, and execution context stay private.
Dependency direction stays training → arena authorized contracts → pure core; profile B adds no arena → training edge.
Node crypto belongs to host tooling; browser-safe model codecs use pure byte operations without Node filesystem or process imports.
Future exports must close under static ESM import/reexport edges with no CommonJS, dynamic loader, or unknown-extension bypass.
Unsupported loaders fail the inventory audit; hashing an executable file never substitutes for auditing its edges.
Audit partitions are `core-rules`, `arena-authorized`, `arena-host`, `training-model`, `training-coordinator`, and `verification-tooling`.
Entrypoints comprise every selected public subpath plus the private episode/worker/coordinator/verification entrypoints.
Capture their transitive source, tests, configs, package metadata, lockfile, tools, installed trees and offline pnpm store closure.
CI must verify export resolution, forbidden edges, typechecks, affected suites, inventory rejection fixtures, and hermetic execution.
Extend existing acquisition/capture roots deliberately for training; do not merely relax execution→contracts restrictions.
The existing `packages/*` workspace pattern already covers the future folder; no workspace/config edit occurs here.

## 4. Versioned DTOs, functions, and errors

| Contract | Proposed version |
|---|---|
| Snapshot / observation codec / history | `challenge-observation-v2` / `challenge-observation-codec-v2` / `challenge-history-v2` |
| Batch / economic ledger / provenance | `challenge-boundary-batch-v1` / `challenge-economic-ledger-v1` / `engine-provenance-v1` |
| Generator / own projection / features | `challenge-composition-v2` / `authorized-own-projection-v1` / `challenge-features-v2` |
| Feature manifest / inference artifact | `challenge-feature-manifest-v2` / `starchess-training-artifact-v1` |
| RNG / checkpoint / episode IPC | `starchess-training-rng-v1` / `starchess-training-checkpoint-v1` / `starchess-training-episode-v1` |
| Optimizer / loss / eligibility | `starchess-sgd-float64-v1` / `starchess-reinforce-sum-v1` / `starchess-training-eligibility-v1` |
| Recipe / host configuration | `starchess-training-recipe-v1` / `starchess-training-host-v1` |
| Readiness fixtures | `training-readiness-fixtures-v1` |

Keep `challenge-candidate-codec-v1`, `MAX_QUEUE_ACTIONS=65`, and `score-desc-key-asc-v1`; generation's ceiling is separately four.
All DTO object fields are exact: reject unknown/missing fields, sparse arrays, getters, invalid enums, nonfinite numbers, and side mismatches.
`Side='w'|'b'`; `Square` is `[a-h][1-8]`; public ordinals/counters are nonnegative safe integers.
`AuthorizedHistory={version:'challenge-history-v2',currentAuthorizedSnapshotV2,economicState,everLit}`.
`everLit` is sorted unique squares, accumulated only from actually authorized `lit` cells, never piece-only reveals or nominal projections.
`economicState` is the reconciled ledger state defined in §7; the current snapshot is defined in §6.

```ts
interface CandidatePolicyV2 {
  choose(history: AuthorizedHistory, rng: () => number):
    readonly ScActionInput[] | Promise<readonly ScActionInput[]>;
}
validateObservation(value: unknown): AuthorizedSnapshotV2;
decodeObservation(bytes: Uint8Array): AuthorizedSnapshotV2;
encodeObservation(snapshot: AuthorizedSnapshotV2): Uint8Array;
validateBoundaryBatch(value: unknown): AuthorizedBoundaryBatch;
reconcileBoundary(previous: ReconciledBoundaryState | null, batch: AuthorizedBoundaryBatch): ReconciledBoundaryState;
advanceHistory(previous: AuthorizedHistory | null, boundary: ReconciledBoundaryState): AuthorizedHistory;
composeCandidates(history: AuthorizedHistory): CandidateBatch;
decodeCandidate(value: unknown, side: Side): EncodedCandidate; // existing codec v1
encodeFeatures(history: AuthorizedHistory, candidate: EncodedCandidate): FeatureBlocks;
flattenFeatures(blocks: FeatureBlocks): Float64Array;
validateArtifact(value: unknown, expectedManifest: FeatureManifest): ValidatedArtifact;
decodeArtifact(bytes: Uint8Array, expectedManifest: FeatureManifest): ValidatedArtifact;
encodeArtifact(artifact: ValidatedArtifact): Uint8Array;
inferenceWeights(artifact: ValidatedArtifact): Float64Array;
```

Use **history**, not observation alone: novelty needs `everLit` and economic interactions need the reconciled ledger.
`/observations` owns observation validation/bytes and all authorized DTO definitions; `/events` owns batch validation/reconciliation/history advancement.
`/candidates` owns composition and candidate decoding; `/features` owns typed encoding/flattening; `/artifacts` owns inference artifact validation/bytes/copies.
In C, arena `/observations` also owns batch schema validation; training `/events` owns reduction/advancement and reexports that validator without host projection.
Observation bytes wrap `{codecVersion:'challenge-observation-codec-v2',observation:snapshot}` in canonical UTF-8 JSON.
Objects/arrays returned by validation are immutable detached copies; every typed-array return is a fresh caller-owned copy.
`FeatureBlocks={version:'challenge-features-v2',queue:Queue34,positions:readonly [Position84,Position84,Position84,Position84]}`.
`CandidateBatch={version:'challenge-composition-v2',candidates,diagnostics}`; retained candidates are key-byte sorted and contain pass once.
Diagnostics include profile, unique/work counts, per-pool capacity/retained/active/exhausted, rejection counts by category, and stop reason.
No diagnostic becomes a feature or carries hidden admission results.
Private functions are `runEpisode(request,policy,TrustedExecutionContext): Promise<HostEpisodeRecord>` and `verifyEpisode(record,TrustedExecutionContext): VerifiedEpisode`.
`HostEpisodeRecord` contains full snapshots and private context; it is never passed to `choose`, features, or artifact scorers.
No runtime validator grants authorization: valid JSON must still arrive from the trusted host/channel bound to this session.

Use the existing throwing style: `ContractError(path,code)`, `name='ContractError'`, message `${code}: ${path}`; no Result/throw mixture.

| Stable code | Meaning |
|---|---|
| `VERSION` / `SCHEMA` / `JSON` | Unsupported version / wrong fields or types / invalid JSON. |
| `SIZE` / `ARRAY` / `NUMBER` / `NONFINITE` | Pre-parse size cap / malformed array / invalid integer or domain / nonfinite arithmetic. |
| `SIDE` / `ORDER` / `CARDINALITY` / `DERIVED` | Wrong recipient / noncanonical ordering / wrong count / recomputed field differs. |
| `CONSISTENCY` / `IDENTITY` / `CONSERVATION` | Snapshot-ledger disagreement / illegal ID lifecycle / economic identity violated. |
| `SEQUENCE` / `DUPLICATE` / `SESSION` / `PROVENANCE` | Gap or ordinal error / conflicting duplicate / wrong trusted binding / ambiguous causal identity. |
| `MANIFEST` / `RNG` / `NUMERIC` / `PROTOCOL` | Names/scales alignment / invalid root or journal / unstable update / invalid host transition. |

Preserve existing codec-v1 error behavior; the new v2 boundary adds the stable codes above rather than silently changing v1.
Host-private paths/details are stripped from model-facing diagnostics; an error never publishes a partly advanced history.
Authorized observation/batch/candidate/artifact codecs inherit the existing `1_048_576` byte cap; checkpoint/host completion uses `16_777_216`.
Check raw lengths before decoding/parsing or allocating declared arrays; stream journals rather than retaining unbounded evidence in memory.

## 5. Native causal provenance — profiles A/B/C

Current native result arrays group attacks, moves, promotions, mine triggers, and special events; they are not a complete ordered mutation trace.
Actual path-reveal intermediates, simultaneous swaps/collisions, and create-then-die events require native causal hooks, not animation reconstruction.
Host code must not infer identity from square/type continuity or fabricate a deployment birth from its receipt.

| Profile | Proposed native seam and compatibility |
|---|---|
| A | Private generic companion: `initializeProvenance(snapshot)`, `beginTurnWithProvenance({snapshot,provenance})`, `endTurnWithProvenance({snapshot,provenance,actionBindings})`. Each wrapper returns the SAME native Begin/End result plus updated private provenance and ordered atomic frames. Normal resolver output stays unchanged. |
| B | Thread persistent entity IDs through native execution context and private codec `engine-provenance-snapshot-v1`. IDs remain non-model data. This has a larger snapshot/replay compatibility cost than A. |
| C | Defer the causal seam. R1 freeze remains incomplete and first training stays blocked; there is NEVER a square/type heuristic fallback. |

For A/B, native mutation code owns generic provenance without ML, reward, paid-cost, or curriculum knowledge.
`EngineEntity` is a discriminated union: `{id,kind:'unit',side,type,square,tankMode:'tank'|'siege'|null}` or `{id,kind:'mine',side,square}`.
`actionBindings` maps private native action sequences to per-side `OwnActionRef={planningOrdinal,acceptedActionOrdinal}` after whole-pair commit.
The native binding follows rewritten B/C/F actor references; original queue square alone is not a sufficient causal reference.
`TrustedEffectFrame={sourceEffectKey,phase,before,after,effects}` uses private full entity boards and both CC-life values for `before/after`.
`phase='turn-open'|'B'|'C-attack'|'C-move'|'C-path-reveal'|'C-promotion'|'F'`; order follows actual native execution, including B/F transformations within their phase.
`effects` consists of explicit unit-create/move/transform/destroy, tank-mode-change, mine-create/remove, CC-lives-change, and deployment-disposition records.
Every entity effect refers to the actual native entity ID; create includes its entity, move includes from/to, transform old/new type, destroy the before entity.
Mode/CC effects include before/after values; deployment disposition binds the private action to `materializedEntityId:string|null`.
Frame images are `{entities:readonly EngineEntity[],ccLives:{w:number,b:number}}`; entities are private-ID-sorted, with exact unit/mine identity and modes.
Each effect carries `sourceActionSeq:number|null`; null denotes a native automatic effect without a queued action, not a guessed source binding.
The exact private effect variants add these fields to that common source field:

| Private `kind` | Fields |
|---|---|
| `unit-create` | `entity:UnitEngineEntity` |
| `unit-move` | `entityId,from,to` |
| `unit-transform` | `entityId,fromType,toType` |
| `unit-destroy` | `entity:UnitEngineEntity` at its native loss point |
| `tank-mode-change` | `entityId,before:'tank'\|'siege',after:'tank'\|'siege'` |
| `mine-create` | `entity:MineEngineEntity` |
| `mine-remove` | `entityId` |
| `cc-lives-change` | `side,before,after` |
| `deployment-disposition` | `materializedEntityId:string\|null`; sourceActionSeq must bind the accepted deploy. |

Deployment `materializedEntityId=null` means unmaterialized, not invisible: F skipped after terminal C or a genuine native fizzle may have no creation at all.
Resolve preexisting identities against a frame's **before** image; newly created IDs bind to explicit native creation references, including create-then-die within a frame.
Apply the frame atomically; do not serialize a swap as destructive sequential overwrites or infer a victim by the after-image square.
Provenance initialization and every frame must reconcile exactly with the corresponding native snapshot, modes, mines and CC lives.
No source effect key, private frame count, full board, private ID, opponent queue, or hidden cause crosses authorization.
Generic pure engine hooks require R2–R5 implementation/review; selecting this seam does not claim that current core supplies it.

## 6. Public boundaries, IDs, snapshot, and event union

`AuthorizedBoundaryBatch={version:'challenge-boundary-batch-v1',side,ordinal,phase,turn,planningOrdinal,seqBefore,seqThrough,events,snapshot}`.
`phase='initial'|'turn-open'|'settled'`; ordinal starts at 0 for initial and advances by one at each scheduled published boundary.
Publish exactly one initial batch, one after **every** turn-open including optional chip, and one after each completed settlement, even with no events.
There is no extra chip-only boundary dependent on a hidden effect's existence; a terminal turn-open publishes its scheduled batch and no decision follows.
Planning ordinal starts at 0, increments only after settlement, and does not advance for a chip; settled batch carries the post-settlement ordinal.
Events have common `{kind,seq}` with contiguous recipient-local `seq` starting at 1 **after** authorization filtering.
`seqBefore` equals the prior `seqThrough`; `seqThrough=seqBefore+events.length`; hidden enemy events never consume these counters.

Public IDs are deterministic recipient-local strings; opening units use `${side}:unit:opening:${square}` in canonical own-square order.
Created units use `${side}:unit:created:${ownSideCreationCounter}`, starting at 1, incremented only for actual authorized own creations.
Opening/created mines use the analogous `${side}:mine:opening:${square}` / `${side}:mine:created:${ownMineCreationCounter}` namespaces.
Receipt IDs are `${side}:receipt:${planningOrdinal}:${acceptedActionOrdinal}`; accepted action ordinal is zero-based own-array position.
Witness IDs are `${side}:witness:${ownWitnessCounter}`, starting at 1 after authorization; they identify witnessed losses, not trackable enemy units.
No ID uses global sequence/count, case ID, seed, hidden queue, or a private counter with visible gaps.
Host-private session binding is opaque and stays outside the model DTO; host private entity→public lineage maps are not features.

| Authorized event `kind` | Exact additional fields |
|---|---|
| `own-paid-receipt` | `receiptId, actionRef:OwnActionRef, unit:SpawnPiece, requestedSquare, minerals` |
| `own-gas-debited` | `actionRef:OwnActionRef, gas` |
| `own-unit-endowed` | `id, square, type, paidBasis:0` |
| `own-unit-created` | `lineageId, receiptId, square, type` |
| `own-deployment-unmaterialized` | `receiptId, paidMinerals` |
| `own-unit-moved` | `id, from, to` |
| `own-unit-transformed` | `id, fromType, toType, paidDelta:0` |
| `own-unit-mode-changed` | `id, mode:'tank'\|'siege'` |
| `own-unit-destroyed` | `id, typeAtLoss, square, retiredPaidBasis` |
| `own-mine-endowed` / `own-mine-created` | `mineId, actionRef:OwnActionRef\|null, square`; endowed uses null, created binds its own action. |
| `own-mine-removed` | `mineId` |
| `own-income` | `actualCreditedMinerals` |
| `own-cc-lives-changed` | `before, after` |
| `enemy-unit-destruction-witnessed` | `witnessId, square, type, replacementLowerBound, paidLowerBound:0` |

Receipts/gas events precede the corresponding committed native effects in the settled batch; they appear only after **successful whole-pair commit**.
Native effect order determines the authorized effect order, with canonical own-ID order inside an atomic frame and native causal suborder for one ID; credited income follows native settlement.
Every public batch applies transactionally by identity; intermediate occupancy checks cannot turn an atomic swap into a spurious destruction.
Enemy-loss authorization requires the live victim to be authorized at the actual causal frame using native vision with own modes/mines, or a source-authorized destruction witness.
The host privately deduplicates the victim entity's destruction; the witness contains no enemy tracking ID or unseen root-cause attribution.
Fog disappearance, an empty cell, an animation cue, and partial damage/zero claimed damage cannot establish an enemy death.
Replacement lower bound uses witnessed type's valuation; enemy actual paid investment stays unknown with a conservative paid lower bound of zero.

`AuthorizedSnapshotV2` retains v1 `{side,turn,own,cells,memory}`, changes `version` to `challenge-observation-v2`, and adds `ownUnitLineage,ownMineLineage,economicState`.
`own` retains exact minerals/gas/gasIncome/ccLives/pieces/mines/siegedTanks; cells remain 64 canonical squares with unknown/lit/revealed distinctions.
`memory` retains dated enemy square sightings, not unique enemy identities; revealed pieces do not assert an empty/clear surrounding ray.
`ownUnitLineage` contains live `{id,square,type,paidBasis,replacementValue}` sorted by square; types/modes reconcile with `own` and cells.
`ownMineLineage` contains live `{mineId,square}` sorted by square; mines remain a separate inventory and never receive paid-unit basis.
Initial endowed events enumerate own units/mines canonically; initial cumulative debits, destroyed/wasted totals and enemy losses are zero.

## 7. Receipt ledger, conservation, and transactional reconciliation

`EconomicState={version:'challenge-economic-ledger-v1',side,ownPaidDebits,ownPaidSurviving,ownPaidDestroyed,ownPaidWasted,ownReplacementDestroyed,enemyLoss,receipts,retiredOwnIds}`.
`enemyLoss={confirmedUnitCount,replacementLowerBound,paidLowerBound:0,upper:'unknown',completeness:'witnessed-only'}`.
Receipts are canonical-ID-sorted `{receiptId,actionRef,unit,requestedSquare,minerals,disposition}` records.
`disposition={kind:'materialized',lineageId}` or `{kind:'unmaterialized'}`; no receipt remains unresolved at a published closed boundary.
`retiredOwnIds` is sorted unique retired own unit lineage IDs; it prevents duplicate retirement without exposing enemy identities.
Snapshot economic state equals the pure reducer's complete state; host-private witness/entity deduplication stays outside it.
Host debits accepted deployment minerals exactly from `UNIT_COST`; accepted gas debit uses native special cost, not a learned valuation.
Opening paid basis is 0, free promotion paid delta is 0, movement/transform preserves lineage, and a confirmed destruction retires basis exactly once.
Replacement value is `UNIT_COST[type]` for spawn types and **0 for CC**: CC is nonpurchasable, and its HP stays a separate resource.
This proxy does not change native `UNIT_COST.k` or any game price/rule.
Validate actual native creation for every materialized receipt, including creation followed immediately by mine death or crushing.
An unmaterialized deployment retires its debit as paid waste; never invent birth+death where no entity existed.

```text
ownPaidDebits = ownPaidSurviving + ownPaidDestroyed + ownPaidWasted
ownPaidSurviving = sum(live own lineage paidBasis)
ownPaidDestroyed = sum(retired lineage basis, each retirement once)
ownReplacementDestroyed = sum(type-at-loss replacement proxy, once per destroyed unit)
```

Check these identities exactly at every closed boundary, together with resources, modes, mines, own entities, receipts, and CC lives.
Use actual capped credited income; gas reset/refill follows native begin/end boundary rules, not a fabricated SCFEN partial helper.
Rejected/rolled-back pair admission publishes no receipts, debits, accepted bindings, or native effects; requested spend is not payment.
`reconcileBoundary` stages an ephemeral next state and commits only after all validations; it never mutates the preceding batch/history.
`ReconciledBoundaryState={snapshot,economicState,ordinal,phase,planningOrdinal,seqThrough,lastBatchBytes}` retains live identity facts and duplicate/sequence state, not merely economic totals.
This reducer state is caller-owned audit state, **not** a field of `AuthorizedHistory`; trusted session binding wraps it privately without entering features.
Replay of the last identical canonical raw batch hash is idempotent; require byte equality as well as hash equality.
A conflicting duplicate, sequence gap, invalid ordinal/phase, session mismatch, or ambiguous provenance aborts ALL training before publication.
Initial is accepted only with null prior state in the trusted session; another initial or a batch from another episode cannot reset a live ledger.
The host checks session/sequence and calls reconciliation before `advanceHistory`; advancing history alone never authenticates an arbitrary JSON batch.
`advanceHistory` consumes the checked boundary and atomically returns snapshot, reconciled ledger and `everLit`; it publishes nothing on error.

## 8. Candidate domain, deterministic quota profiles, and work accounting

Canonical family order `K=[classical,deploy,stimStep,spiderMine,charonMissiles,siegeMode,tacticalJump]`; use `C` as the classical family abbreviation.
Each family lane traverses queues owned by that family; the shared composition lane traverses queues of length ≥2.
An emitted queue consumes **one** funding pool only; family visits use their owner pool, shared visits use shared capacity.
Global key-byte deduplication precedes retained-quota consumption; the same queue in two lanes is never retained twice.
Reserve pass before traversal; pass consumes 1 unique slot and no attempted extension.
Available family means an authorized singleton intent iterator is nonempty, not that hidden admission would accept it.

| Profile | Family owner for a nonempty queue | Initial inactive-family redistribution |
|---|---|---|
| A | First non-classical kind in array order, otherwise classical. | Release each inactive 48 to the shared composition pool. |
| B | First action's kind. | Redistribute inactive 48s among active family lanes in canonical round-robin; shared stays 175. |
| C | Minimum canonical kind appearing anywhere in the queue. | Split aggregate released capacity: floor(half) to active canonical round-robin, remainder to compositions. Odd capacity goes to compositions. |

All profiles start with active family capacity 48, shared capacity 175, and pass capacity 1 before redistribution.
Proven complete family-iterator exhaustion releases unused family capacity to compositions; a work cap is NOT evidence of exhaustion.
Proven composition-iterator exhaustion redistributes unused shared capacity among nonexhausted families, one slot/family/canonical round.
No active/nonexhausted recipient means unused capacity remains unused; retained capacity is an upper bound, never a required count.
Traverse seven family lanes plus shared lane in canonical round-robin, one attempted append per live-lane visit.
Family desired lengths cycle `1,2,3,4`; shared desired lengths cycle `2,3,4`; exhausted length iterators are skipped deterministically.
For each length, enumerate prefix-dependent intent index tuples by increasing index sum, then lexicographic indices; indices are zero-based.
Intent order is family K, actor square, timing `B,F` (only `C` for classical), destination square, unit, promotion; absent fields sort before present values.
Squares order `a1,a2,…,a8,b1,…,h8`; spawn/promotion order `p,n,b,r,q`; no-promotion precedes those choices when permitted.
Repeated prefix work counts again: increment work **before every prefix+intent attempted append**, including invalid, duplicate, owner-ineligible and quota-full attempts.
Each visit advances its iterator even if it prunes or finds a duplicate; retain no partial queue as a substitute for its rejected extension.
Retain per-lane/per-length tuple and prefix cursors across visits; each scheduled visit advances exactly one append, not a hidden full-queue search.
Apply owner/quota retention checks at completed desired length; do not prune a prefix merely because later actions can change its final owner.
Stop before attempted append 2049, or at 512 retained uniques, or after proven iterator exhaustion; counters never conceal dedup/pruning work.
Derive canonical key from existing codec-v1 canonical action-array bytes, SHA-256 those raw bytes, and compare raw bytes on hash collision.
Hashes accelerate identity, not replace exact key-byte comparison; final scoring/sampling order is ascending canonical key bytes.

Prune only authorized side/resource/queue-shape/actor/anchor/intent constraints; retain uncertainty in cells, enemy modes and hidden mines.
Native pure shape helpers must accept authorized maps plus unknown masks; do not pass invalid fog-filtered SCFEN to actual resolve/admission.
At most one C and one special per native-origin actor; total requested minerals ≤own bank, gas ≤own gas, generated length ≤4.
Special actors remain native types: deploy k, stimStep p, spiderMine n, charonMissiles b, siegeMode r, tacticalJump q.
Deployment/Charon/F mine origin and B→C coordinate rewrites follow native own anchors, not a generic positional rewrite invented by the trainer.
B-created classical actors remain expressible where native queue rules permit them; current pre-C special actor checks cannot grant a future promoted actor new permission.
Known illegal F-promotion→special chains are pruned as own-rule failures; unknown hidden occupancy must not be queried to decide membership.
Pruning categories are `side`, `shape`, `own-resources`, `own-actor`, `own-anchor`, `own-mode`, `own-mine`, `promotion`, `owner`, `quota`, and `duplicate`.
Report omissions, per-kind/timing/length coverage and cap termination; this bounded generator does not prove exhaustive legality or winning coverage.
Exactly one selected whole queue reaches private admission, with no next-candidate rescue, prefix salvage, or hidden probing.

## 9. Authorized own projection and geometric proxy calculus

`authorized-own-projection-v1` maintains own nominal units/modes/mines and actor tokens separately from the fixed current observed-enemy layer.
Tokens identify an existing own lineage or a local hypothetical B birth by queue index; tokens/IDs are never numeric features.
Process the candidate through native B/C/F own-anchor/origin rules; array position remains the feature slot, even when settlement order differs.
For slot i, its before/after states bracket that own action in the canonical own-only phase schedule; exclude later-phase actions from its prefix.
Conditionally move/transform/create own hypotheses, but never simulate combat, opponent decisions, actual births/captures, or hidden truth.
Nominal overlap with a fixed observed enemy is an explicit hypothetical overlap, not deletion of that observed enemy fact.
Do not update cells, observed memory, ledger, or `everLit` from hypotheses; nominal investment is requested cost, not confirmed paid basis.
Reusable native pure shape/vision/ray helpers accept authorized maps and unknown masks; full-world resolve is never a feature oracle.

Threat/pressure/protection/exposure are **stationary geometric proxies**, not legality, damage, calibrated probability or future attack predictions.
Sources include only currently observed enemy units; stale sightings and unseen attackers never become live threat sources.
An enemy Tank's unknown mode uses compatible possibilities `{tank,siege}`: intersection with known-clear path is known, union-minus-known is possible.
For any source/target pair, a known intermediate blocker excludes the relation; an unknown intermediate makes it possible, never known.
A nominal own blocker can add a conditional obstacle; it cannot erase a current observed blocker or convert unknown into known-empty.
Known and possible relation sets are disjoint; count distinct source→target pairs only once across compatible modes.
Use native stationary attack geometry without fabricating a hidden hostile mine, classical legality probe, or certain capture at the landing square.
Ray applies only to ray-based classical/Charon geometry; a known blocker dominates uncertainty, otherwise unknown dominates open.
Applicable empty intermediate set is vacuously open; airborne/jump/nonray intermediates are empty, with no fabricated terrain knowledge.
Path counts use **current** known-empty/known-occupied/unknown intermediates; target-square facts are encoded separately.
`Lit(Q)` is geometric own-hypothesis lit squares plus own nominal mines; exclude Mecha's piece-only Battleship pings from lit novelty.
`New(Q)=Lit(Q) \ everLit`; singleton projections begin independently from the same authorized history.
For stale approach choose the most recent enemy remembered square, tie canonical square; use positive Chebyshev distance reduction from actor-before to actor-after.
This uses a square sighting, not an enemy identity count; no memory means age/approach zero.
Per-slot exposure counts stationary observed enemies related to that nominal actor after its prefix; pressure counts its known reachable observed targets.
Protection compares before/after this hypothesis: positive reduction in distinct threatened own NONCC tokens; CC protection is known-exposed→not-known-exposed.
All conditional own geometry keeps the nominal mask; no proxy claims that the core will realize its hypothesis.

## 10. Scales, typed masks, and exact 370-field flattening

Proposed manifest dimension is **370**, not v1's 158 and not an arbitrary neuron count: `34 + 4×84 = 370`.
Flatten queue first, then positions `0,1,2,3`; expanded names are `queue.<name>` and `position.<i>.<name>`.
Expand `.K` in family K order, `.P` in `[p,n,b,r,q,k]`, `.S` in `[none,p,n,b,r,q]`; expand comma lists left-to-right.
For queue row j (zero-based), index=j; position i local row k has index `34+84*i+k`.
These expansion rules and the following ordered tables define **every** manifest name and index without unnamed dimensions.

| Symbol | Exact proposed scale/context |
|---|---|
| `M,G,T,L,V` | `MAX_STORED_MATERIAL=12`, maximum gas `3`, `MAX_GAME_TURNS=45`, `CC_MAX_LIVES=3`, maximum spawn cost `9`. |
| `PaidScale,ReplacementScale` | `M×4×64=3072`, `V×4×64=2304`; conservative normalization scales, not game caps. |
| `D,W,ER,EP` | own paid destroyed/PaidScale; own paid wasted/PaidScale; enemy replacement lower bound/ReplacementScale; enemy paid lower bound/PaidScale=`0`. |
| `B,A,U,Cv` | own bank/M; own gas/G; current unknown cells/64; `1-ownCCLives/L`. |
| `MM,GM,s` | `(bank-wholeRequestedMinerals)/M`; `(gas-wholeRequestedGas)/G`; `(wholeRequestedMinerals/M+wholeRequestedGas/G)/2`. |
| `PK` | Whole nominal own→currently observed NONCC enemy **known relation-pair count/4096**, maximum `64×64`; never silently divide/cap it by 64. |

Indicators are 0/1; signed synergy may be negative; all other scales use the domains above without clipping.
Reject nonfinite/out-of-domain values; validate exact integer/resource constraints before normalization, never round invalid state into validity.
Position coordinates are absolute zero-based file/rank indices divided by 7, not side-rotated coordinates.
Actor paid/replacement values divide by M; per-action mineral/gas costs divide by M/G; path and unit/source counts divide by 64.
Memory age is `(turn-observedTurn)/T`; stale approach is positive Chebyshev reduction/7; newly-lit count divides by 64.
An absent action slot is all 84 zeros; a present action without a target sets `target.absent=1`, not `target.unknown`.
Deploy/promotion S one-hot uses `none` when absent; target P one-hot uses current observed target only, never stale memory type.
Actor known means an actual own lineage matches the nominal prefix's own actor token; absent means no actor token, not fog uncertainty.
Actor nominal is 1 when its hypothesized position/type differs from current facts or it is a hypothetical B-born actor.
`actor.paidKnown=1` only for existing actual own lineage, including known zero basis; hypothetical births use paidKnown=0 and actor.paid=0.
Actor type reflects its supported own-intent hypothesis; tank-mode-known/sieged apply only to a Tank actor, and non-Tank masks are zero.

### Ordered position block — 84 names per position

| Local indices | Count | Names (prefix `position.<i>.`) | Value/calculus |
|---|---:|---|---|
| 0 | 1 | `present` | 1 for a present action. |
| 1–10 | 10 | `kind.K`; `timing.B,timing.C,timing.F` | Kind and native timing one-hots. |
| 11–15 | 5 | `from.file,from.rank,to.present,to.file,to.rank` | Original authored coordinates; absent to has presence/coordinates 0. |
| 16–27 | 12 | `deployUnit.S`; `promotion.S` | Spawn/promotion one-hots including none. |
| 28–39 | 12 | `actor.known,actor.absent,actor.nominal,actor.paidKnown`; `actor.type.P`; `actor.tankMode.known,actor.tankMode.sieged` | Actor masks/type per projection contract. |
| 40–50 | 11 | `target.absent,target.unknown,target.knownEmpty,target.own,target.enemy`; `target.type.P` | Current knowledge at authored to; absent/unknown/empty have type all zero. |
| 51–52 | 2 | `target.memory.present,target.memory.age` | Dated enemy memory at authored to, independent of live target masks. |
| 53–54 | 2 | `cost.minerals,cost.gas` | Native requested action cost/M,G. |
| 55–56 | 2 | `actor.paid,actor.replacement` | Existing confirmed basis/M or 0; nominal actor current-type proxy/M, CC=0. |
| 57–60 | 4 | `ray.applicable,ray.open,ray.blocked,ray.uncertain` | Applicable and mutually exclusive status; all zero when inapplicable. |
| 61–63 | 3 | `path.knownEmpty,path.knownOccupied,path.unknown` | Current intermediate-square counts/64. |
| 64–65 | 2 | `nominal.newlyLit,nominal.staleApproach` | Prefix New count/64; selected stale-square approach/7. |
| 66–67 | 2 | `exposure.known,exposure.possible` | After-prefix stationary enemy-source counts to this actor/64. |
| 68–69 | 2 | `pressure.units,pressure.cc` | Known distinct observed NONCC targets/64; known observed enemy CC relation indicator. |
| 70–71 | 2 | `protection.units,protection.cc` | Positive threatened-own-NONCC reduction/64; CC protection indicator. |
| 72–83 | 12 | `ix.spendLiquidity,ix.gasAvailability,ix.deployMargin,ix.exposurePaidKnown,ix.exposurePaidPossible,ix.exposureReplacement,ix.tradeEnemyLoss,ix.ccPressureRisk,ix.noveltyReveal,ix.uncertainRayCost,ix.staleApproachAge,ix.protectionPaidLoss` | Exact ordered formulas below. |

```text
spendLiquidity       = cost.minerals * B
gasAvailability      = cost.gas * A
deployMargin         = I(kind=deploy) * MM
exposurePaidKnown    = exposure.known * actor.paid * actor.paidKnown
exposurePaidPossible = exposure.possible * actor.paid * actor.paidKnown
exposureReplacement  = exposure.known * actor.replacement
tradeEnemyLoss       = pressure.units * ER
ccPressureRisk       = pressure.cc * Cv
noveltyReveal        = nominal.newlyLit * I(nominal actor type=b [Mecha])
uncertainRayCost     = ray.uncertain * (cost.minerals+cost.gas)/2
staleApproachAge     = nominal.staleApproach * selectedStaleMemoryAge
protectionPaidLoss   = protection.units * D
```

`selectedStaleMemoryAge` belongs to the most-recent remembered square selected in §9, not necessarily `target.memory.age`.
The position counts sum `1+10+5+12+12+11+2+2+2+4+3+2+2+2+2+12=84`.

### Ordered queue block — all 34 names

Let n be action count; m/g be whole requested normalized costs; b/c/f be B/C/F counts; d be deploy count.
Every pair feature counts unordered authored index pairs `i<j`, divides by 6, and uses the same native-bound own actor token.
Pair predicates are symmetric except timing inversion; hypothetical deploy child tokens identify the local B birth, not its CC deploy actor.

| Index | Name (prefix `queue.`) | Exact value |
|---:|---|---|
| 0 | `pass` | `I(n=0)` |
| 1 | `actionCount` | `n/4` |
| 2 | `requestedMinerals` | `m=totalRequestedMinerals/M` |
| 3 | `requestedGas` | `g=totalRequestedGas/G` |
| 4 | `timing.BCount` | `b/4` |
| 5 | `timing.CCount` | `c/4` |
| 6 | `timing.FCount` | `f/4` |
| 7 | `mineralMargin` | `MM` |
| 8 | `gasMargin` | `GM` |
| 9 | `nominal.deployCrushOwnPaid` | Sum basis of distinct CURRENT own lineages hypothetically overwritten by permitted own deploy hypotheses /PaidScale. |
| 10 | `nominal.deployCrushOwnReplacement` | Sum current-type proxy of the same distinct current own lineages /ReplacementScale. |
| 11 | `nominal.newlyLit` | `NL=cardinality(New(whole projection))/64` |
| 12 | `nominal.ccExposureKnown` | `CK=known stationary enemy-source relations to own CC/64` |
| 13 | `nominal.ccExposurePossible` | `CP=possible, disjoint-from-known relations to own CC/64` |
| 14 | `nominal.ccProtection` | `I(pre CC known exposed AND post CC not known exposed)` |
| 15 | `pair.sameActor` | Pairs sharing an existing lineage or local hypothetical birth token /6. |
| 16 | `pair.BC` | B special + C on same actor pairs /6. |
| 17 | `pair.CF` | C + F special on same actor pairs /6. |
| 18 | `pair.mineRelocate` | spiderMine + same-actor C relocation pairs /6. |
| 19 | `pair.deployMove` | B deploy + C using its local hypothetical child actor pairs /6. |
| 20 | `pair.timingInversions` | Pairs i<j with phaseRank(action[i])>phaseRank(action[j]), B=0/C=1/F=2, /6. |
| 21 | `nominal.visionSynergy` | `(cardinality(New(whole))-sum_i cardinality(New(singleton_i)))/256` |
| 22 | `ix.spendOwnPaidLoss` | `s*D` |
| 23 | `ix.tradeEnemyPaidBound` | `PK*EP` (explicit constant-zero conservative bound, not exact enemy payment). |
| 24 | `ix.tradeEnemyReplacementBound` | `PK*ER` |
| 25 | `ix.noveltyUnknown` | `NL*U` |
| 26 | `ix.ccExposureVulnerability` | `(CK+CP)*Cv` |
| 27 | `ix.mineRelocateUnknown` | `pair.mineRelocate*U` |
| 28 | `ix.spendTurn` | `s*turn/T` |
| 29 | `ix.passVulnerability` | `pass*Cv` |
| 30 | `ix.deployGasIncome` | `(d/4)*gasIncome/G` |
| 31 | `ix.pressureLossUncertainty` | `PK*I(enemyLoss.upper='unknown')` |
| 32 | `ix.spendOwnPaidWaste` | `s*W` |
| 33 | `ix.deployOwnPaidWaste` | `(d/4)*W` |

Whole projection crushing is a valuation hypothesis, not evidence of actual loss; count each current lineage once and exclude hypothetical child payment.
Queue context-only portions may cancel in candidate comparisons; the manifest explicitly includes candidate×context interactions instead of claiming all 370 entries are independently expressive.
Exclude blanket observation vectors, shared bias, `baselineScore`, raw IDs, seeds, clocks, opponent bank, corpus metadata and private control state.
Different queues may still have identical vectors and scores; exact ties use canonical key order, and no expressiveness/completeness proof is claimed.

## 11. RNG derivation, state, sampling, and whole-episode ownership

Common proposal: payload is UTF-8 `JSON.stringify(['starchess-training-rng-v1',masterInteger,label])`, with no BOM, LF or spaces.
Labels are exactly `selection`, `environment-settlement`, `policy-sampling`, `opponent`; take SHA-256's first four bytes as unsigned big-endian uint32.
Compute the 20 master×label roots only after approval and persist the measured table; reject ANY collision across all 20, with no salt/rederivation.
Zero is permitted; policy/corpus IDs and source identities are never derivation inputs; there is no fifth derived generator root.

```text
state = (state + 0x6d2b79f5) >>> 0
t = state
t = Math.imul(t ^ (t >>> 15), t | 1)
t ^= t + Math.imul(t ^ (t >>> 7), t | 61)
u = ((t ^ (t >>> 14)) >>> 0) / 4294967296
```

Serialized stream state is `{root:uint32,state:uint32,drawCount:uint53}`; initial state=root, count=0, restore resumes at the next increment.
Selection persists across corpus epochs; policy persists across attempts; opponent persists across live episodes and makes no corpus draws.
Environment-settlement is derived but **UNUSED** for fixed canonical opening/native deterministic settlement: state=root, draws=0.
Generator is explicitly `{root:null,state:null,drawCount:0,status:'unused'}`; do not quietly introduce random candidate traversal.
Require bounded, predeclared output parity against existing exported `mulberry32` and restore-next-draw parity; claim no unbounded parity beyond safe counters.
Parent owns weights, episode-start baseline, roots and serialized states; the same child owns the WHOLE match.
Child receives frozen episode weights and policy/opponent start-state snapshots, advances those streams privately and returns draw journals/final states.
Parent reconstructs draws, verifies counts/final states, and commits them exactly once with the verified completed episode.
There is no parent per-decision policy loop, `env.step`, or status-driven deadline renewal.

Stable log-sum-exp computes log-probabilities directly from logits; individual exponential underflow to probability 0 is allowed.
Sample in canonical candidate order with **one uniform draw per valid sampled decision, including single pass**.
Choose first cumulative probability strictly greater than u; choose last nonzero candidate only for cumulative rounding within `1e-12` sum tolerance.
Reject nonfinite logits/log-probabilities, invalid probabilities or sum error >`1e-12`; never use `log(roundedProbability)`.
Weights and baseline stay frozen throughout the episode; evaluate by frozen argmax, not softmax sampling.
Gate seeds remain corpus arena 0, inference 0 reset per match, live arena 0..17 both seats; existing w seed / b bitwise-complement seat mapping stays unchanged.

## 12. Trusted episode protocol and fixed supervision

Private `EpisodeRequest` binds version, private attempt ID, master/started ordinal, frozen weights/manifest reference, baseline, selected schedule descriptor, and four stream states.
Host-only `TrustedExecutionContext` binds audited corpus roster, native rules/config, opponent revision, schedule and session; report JSON cannot supply authority.
`HostEpisodeRecord` carries that binding, full native snapshots/results/resource trail, private frames/action bindings, authorized batches, decision journal and stop proof.
`VerifiedEpisode` contains checked classification, sampled-decision count, score accumulator, stream end states, public-history audit refs and verified journal-prefix ref.
All refs stay host-side; only `AuthorizedHistory` and policy RNG callback cross `choose`.

Private JSONL messages use `version='starchess-training-episode-v1'`, `attemptId`, monotonically increasing `messageOrdinal`, and discriminated `kind`.
Kinds are `ready`, `decision-start`, `decision-result`, `settlement`, `complete`; optional informational phase messages have no deadline authority.
Decision-start/result bind `{planningOrdinal,turn,side}`; start references the verified turn-open state, result includes ordered actions, recomputed requested spend and journal entry.
Settlement includes the next full native result/resource/provenance payload; complete includes stop proof, journals and final RNG states.
Parent allows only ready→scheduled start→matching result→next scheduled side or checked settlement→next ordinal/complete transitions.
A terminal turn-open permits completion without a decision; corpus White intents bind to the trusted recorded window, not an invented policy-start event.
The child computes both plans from the same frozen turn-open precommit state; parent checks progress, not interactive environment stepping.
Start a fixed deadline when the expected decision starts; repeated/changing status cannot renew, clear, or advance it.
Startup 10s, candidate or strategic decision 10s, match 300s after ready remain unchanged; no additional window deadline.
Use host monotonic elapsed time, reject matching late results, and kill/reap a blocked child before returning validated partial diagnostics.
Node callbacks are not real-time guarantees; status receipt never overrides elapsed-time rejection.
Preserve 64 windows, 128 recorded plies, 4096 proposal cap, 2048 IPC messages, progress 1MiB and completion/pre-parse frame 16MiB.
Decoder bounds raw frames before JSON parse, then validates typed message/array caps; no protocol override earns standard-run credit.
Verified sampled entries retain canonical candidate/features/selected key/logit distribution/uniform draw and frozen-weight binding; malformed entries are infrastructure failures.
Full native reexecution validates outcomes/resources; the host independently reconstructs public batches, feature values, sampling and score accumulator.
Trusted corpus context loads/audits the pinned 18-ID roster once, checks actual trace hashes and the complete consumed White prefix, and ignores unused trailing queues only after real terminal.
Fixed gate schedule owns N=54 (18 corpus+36 live), or approved partial N=18/36; validate every row before assigning exactly one win/loss/draw/failure bucket.
Missing/invalid/duplicate/unexpected records invalidate acceptance; anomalies cannot increase N or remove failures: `wins+losses+draws+failures=N`.

## 13. Failure, eligibility, durable attempts, and SGD

Static preflight happens before STARTED and cannot fabricate an attempt or learned return.
Before child launch, durably append the attempt descriptor and consume started ordinal/curriculum cursor; every launched attempt consumes the cap.
Private attempt IDs provide exactly-once commit keys; counters are started, verifiedCompleted, eligibleCompleted, updates, nonzeroPGUpdates, baselineCount and baselineSum.
At attempt start `b=baselineSum/baselineCount`, or 0 if count=0; child gets this frozen value and current frozen θ.

| Existing `stop.kind` | Verified policy/challenge classification | Infrastructure/provenance classification: abort ALL |
|---|---|---|
| `terminal` | Native verified candidate win/draw/loss gives `+1/0/-1`. | Invalid terminal claim, replay/resource/identity disagreement. |
| `queue-rejected` | Structurally valid sampled candidate rejected by actual core/resource admission gives -1; valid trusted recorded White queue rejected on the genuinely diverged board also gives -1. | Malformed sample, host submitted different data, wrong trace/suite, invalid strategic opponent queue/contract. |
| `trace-exhausted` | Audited corpus truly exhausted on a verified nonterminal prefix gives -1. | Wrong roster, premature cursor/exhaustion, bad request/trace binding. |
| `watchdog` | Parent proves candidate's fixed 10s deadline expired with ≥1 verified sampled-decision prefix: -1. | Startup/opponent/match/unattributed timeout, unverified journal, late/protocol mismatch. |
| `progress-limit` | Actual current frozen cap reached on verified nonterminal progress: -1. | Config overrides, false counters, altered protocol limits. |
| `exception` | No generic unexpected throw becomes reward; a separately proved known policy behavior failure uses `script-contract` classification. | Unknown exception, numeric/codec/adapter/dataset/transport/source mismatch or software bug. |
| `script-contract` | Only a documented candidate behavior failure with legitimate sampled intended choice and verified prior journal can give -1. | Opponent/host/version/protocol error, malformed sample, wrong distribution, adapter-mutated step; never learn software bugs. |

A valid zero-sampled terminal/challenge failure records diagnostic reward but performs **NO SGD, NO L2, NO baseline insertion**.
Eligibility requires verified completion, one or more verified sampled decisions, and a valid native outcome or proved policy/challenge failure.
Infrastructure abort grants no current reward, gradient, baseline insertion or retry; preserve STARTED/cursor/validated journal-prefix diagnostics and stop all masters.
Storage failure also aborts ALL; no implicit continuation exists even if 101 previously finished.

```text
scoreAccum = sum_decisions [φ(selected) - sum_candidates π(candidate)*φ(candidate)] / τ
R ∈ {+1,0,-1}; advantage = R - frozenEpisodeStartBaseline
gradient = -advantage * scoreAccum + λ * frozenEpisodeWeights
proposedWeights = frozenEpisodeWeights - .001 * gradient
L = -(R-b) * sum_decisions log π(selected) + λ*||w||²/2
```

Accumulate float64 without per-length averaging; apply L2 λ=.0001 once, and no clipping/Adam/teacher initialization/dense shaping.
Parent recomputes all terms; finite-check inputs, accumulator, gradient and proposed weights before a commit.
Commit weights, verified counters, completed stream states, verified journal prefix, current return and baseline sum/count **atomically once**.
Baseline inserts the current return only after the proposal passes verification; it never affects its own sampling/update baseline.
`nonzeroPGUpdates` increments only when outcome-driven `-(R-b)*scoreAccum` has a nonzero coordinate, not for L2-only change.
Diagnostic zero-choice completions increment verifiedCompleted only; they do not masquerade as policy learning.
No partial-episode update, failed-sample repair, unlimited retry, per-decision parent learner loop, or automatic operational resume is permitted.

## 14. Curriculum profiles and immutable scheduling

Masters run serially in ascending order 101..105, each with new zero weights, empty baseline and independently derived root states.
Let `a=0..999` be the STARTED slot; live occurrence l starts at 0 and advances only on a live STARTED slot.

| Profile | Exact schedule at full 1000 STARTED slots | Allocation |
|---|---|---|
| A | Even a corpus, odd a live; live l even candidate White, odd candidate Black. | 500 corpus, 250 live White, 250 live Black. |
| B | a<200 corpus; thereafter `(a-200)` even corpus, odd live; live seats alternate by l. | 600 corpus, 200 live White, 200 live Black; NOT 600 corpus followed by 400 live. |
| C | `a%3=0` corpus, `1` live White, `2` live Black. | 334 corpus, 333 live White, 333 live Black. |

Every episode starts from the pinned canonical opening, bank 3:3, empty queues, fresh own history/ledger and fresh trusted strategic memory.
Reset opponent private MC/strategic memory per episode, but do NOT reset the persistent selection/policy/opponent streams.
Corpus candidate is always Black; White actions come exclusively from the trusted trace, never historical winner labels.
For each corpus epoch, begin with the 18-case manifest order and descending Fisher–Yates i=17..1, one selection draw per swap, `j=floor(u*(i+1))`.
Consume that permutation once, then reshuffle a fresh manifest-order array; selection never draws for live slots.
Advance corpus cursor/live ordinal/schedule cursor on STARTED, not success; no adaptive gate-feedback curriculum or optimizer-driven case allocation.
Live opponent is the pinned trusted strategic implementation with feed off and movetimeMs=0, using the persistent opponent stream.
Training source IDs/allocation become host metadata only after profile approval; no corpus ID/result/private future queue enters the model.
These training-used cases are not held-out acceptance evidence; the unchanged gate remains exactly 18 corpus + 36 live with semantic reruns.

## 15. Checkpoint bytes, save boundaries, and final validity

Checkpoint proposal is `starchess-training-checkpoint-v1`, host-only diagnostic state; `/artifacts` cannot decode/expose it as an inference model.
Pure checkpoint validation/serde performs no filesystem I/O; the coordinator owns storage, audit references and private controls.
`dueBucket=floor(startedAttempts/100)`; after a verified **sampled eligible complete update**, save if dueBucket>fulfilledBucket and then fulfill dueBucket.
If STARTED attempt 100 has no sample, delay: a valid eligible attempt 101 saves with `actualEpoch=101`, not a fabricated epoch 100.
Do not save an unfinished/aborted episode or a zero-choice L2-only checkpoint; preserve consumed abort diagnostics separately.
At STARTED 1000, stop regardless of checkpoint eligibility; a zero-choice 1000 never authorizes attempt 1001 to catch up.
A final VALID artifact can still finish without a checkpoint at 1000 if all validity conditions below hold.

| Checkpoint field | Exact meaning |
|---|---|
| `version,status,master,actualEpoch` | Checkpoint version, status=`diagnostic`, master 101..105, actual STARTED count at saved boundary. |
| `counters` | started/verifiedCompleted/eligibleCompleted/updates/nonzeroPGUpdates/baselineCount/baselineSum; no omitted consumed attempts. |
| `weights,orderedFeatureNames,manifestHash` | Exactly 370 binary64 weight encodings, complete ordered manifest names, measured manifest content reference. |
| `versions,config` | All DTO/codec/generator/projection/ledger/RNG/optimizer/loss/config versions, chosen profiles, scales, H=1, budgets and experimental numeric values. |
| `rng` | All four labeled `{root,state,drawCount,status}` records and explicit null-root/state generator record. |
| `hostControl` | Corpus permutation/cursor/epoch, STARTED schedule cursor, live ordinal, dueBucket/fulfilledBucket; never exposed by inference decoding. |
| `journalRef` | External byte-prefix length/hash/last-record ordinal, including durable STARTED descriptors and exactly-once completion records. |
| `authorizedHistoryRefs,nextModelHistory` | Completed public-history audit references; `nextModelHistory=null` because the next episode starts fresh. |
| `provenanceRefs` | Measured source/test/dependency/store/tool/image/corpus/core/strategic/config/recipe references and their versions, not fabricated current hashes. |

Private full SCFEN, traces, future corpus queues, opponent KVS and causal boards do not belong in model data; external host audit artifacts may hold them separately.
`hostControl` and RNG tables never flow through checkpoint→inference paths; descriptive provenance and scorer inputs are distinct schemas.
All persisted float fields use IEEE-754 binary64 big-endian **16 lowercase hex digits**, including weights/config floats; preserve signed zero exactly.
`weights` is an ordered array of exact `{hex:string}` records; other persisted float-valued fields use the same hex-string encoding at their declared field paths.
Metadata integers, seeds/states/counters and integral reward baselineSum remain validated JSON integers.
Canonical JSON recursively sorts object keys and preserves arrays, with no BOM/whitespace/LF/undefined or duplicate keys.
Reject noncanonical/duplicate-key bytes by raw re-encode equality, applying raw size caps before parse and allocation.
The serializer header is outside self-hashing bytes; hash the physical canonical artifact externally, never include its own hash inside itself.
Previous-checkpoint external byte hashes may form a chain; new measurements must come from actual future bytes, not this document.
Publication must use an exclusive atomic durable bundle contract with fault verification; R0 A11–A13 must be FIXED before checkpoint reuse claims.
If publication/storage cannot establish an unambiguous durable commit, abort all training and preserve host diagnostics; do not auto-retry or reinterpret ambiguous state as successful.

`starchess-training-artifact-v1` exact envelope is `{version,status,master,dimension,featureVersion,featureNames,manifest,weights,versions,configuration,trainingSummary,provenanceRefs}`.
`status='VALID'`; dimension=370; manifest includes version, expanded names, scales and meanings; weights use the same binary64 encoding.
`versions` has exact keys `snapshot,observationCodec,history,batch,ledger,provenance,candidateCodec,generator,projection,features,featureManifest,comparator,rng,episodeProtocol,checkpoint,artifact,optimizer,loss,eligibility,recipe,hostConfig`; values match §4.
`configuration` has exact keys `profiles,horizon,dimension,uniqueCap,workCap,maxGeneratedActions,familyCapacity,compositionCapacity,passCapacity,maxStartedPerMaster,masters,checkpointCadence,initialization,arithmetic,optimizer,learningRate,temperature,l2,clipping,baseline,emptyDecision,abortPolicy,primaryMaster,openingRef,hostLimits,validation`.
Those values are the approved profiles, 1, 370, 512, 2048, 4, 48, 175, 1, 1000, [101,102,103,104,105], 100, `zeros`, `float64-cpu`, `SGD`, .001, 1, .0001, `none`, `per-seed-all-history-eligible-mean`, `diagnostic-only`, `stop-all`, 101, and the opening/limits/validation bindings above, respectively.
`profiles={api,provenance,quota,curriculum,validation}` holds chosen A/B/C literals; deferred provenance C cannot appear in a VALID artifact.
`hostLimits` retains the exact named numeric budget fields from current `CHALLENGE_CONFIG`; `validation={profile,epsilon,atol,rtol}` uses §16, with epsilon an ordered array ([1e-6] or [1e-6,1e-5]).
Measured byte references are `{byteLength,sha256}` with safe nonnegative length and exactly 64 lowercase hash hex digits; `openingRef` binds the pinned canonical opening bytes, never a new opening.
`trainingSummary` contains verified counters/recipe-profile references, not per-case private corpus controls or RNG state tables.
Inference validation checks names/order/dimension/versions/scales/config, finite decoded coefficients and supported H=1; no pad/truncate/relabel/fallback.
`inferenceWeights` supplies only detached float64 coefficients to the scorer; host provenance is not concatenated to features.
Final VALID seed requires exactly 1000 STARTED and 1000 verified completions, no infrastructure abort, ≥1 nonzero outcome-driven PG update and exact reload validation.
Complete all five valid serial runs before designating the prospectively chosen **final VALID 101** primary; unfinished protocol has no formal primary.
Prior finished bytes may remain diagnostic; no best seed, seed switch, checkpoint fallback, automatic averaging, or best-gate selection exists.
This proposal adds no all-five evaluation gate: evaluate the frozen primary once under the existing exhaustive strict gate with no online changes.

## 16. Validation profiles and explicit acceptance calculus

Run the proposed diagnostics small-to-large: gradient → numeric extremes → exhaustive small-domain → capped runtime → reload/provenance.
Privacy, ledger/conservation, phase/admission and Phase 1 resource checks remain mandatory in every profile.

| Profile | Central finite-difference ε | atol | rtol | Pass rule |
|---|---|---|---|---|
| A | `1e-6` | `1e-8` | `1e-5` | Every declared fixture/coordinate passes. |
| B | `1e-6` | `1e-9` | `1e-6` | Every declared fixture/coordinate passes stricter tolerance. |
| C | BOTH `1e-6` AND `1e-5` | `1e-8` | `1e-5` | Both step sizes pass independently on the same fixed fixtures. |

`gFD_i=(L(θ+εe_i)-L(θ-εe_i))/(2ε)`; require `|gAnalytic_i-gFD_i|≤atol+rtol*max(|gAnalytic_i|,|gFD_i|)`.
Hold actions/candidate sets/features/return/baseline fixed while perturbing θ; never resample or regenerate inside a derivative check.
Declare 1–4 decisions, 2–4 candidates/decision, toy features in [-1,1], weights in [-.25,.25]; sparse bounded-logit fixtures avoid cancellation.
For every one of 370 coordinates, use a fixed basis-pair fixture with features `+e_i,-e_i`, θ=0 and one decision; include zero-gradient and regularization-only cases.
Also use independent fixed multi-decision fixtures to test the SUM objective; no dense arbitrary-tensor universal tolerance claim is made.
Positive-advantage nondegenerate one-decision/two-candidate θ=0 fixture must increase the selected log-probability after α=.001; negative advantage must decrease it.
L2 at θ=0 contributes zero; separate λ=0 and λ=.0001 fixtures test regularization once, not once per decision.
Stable-softmax fixtures require finite log-probabilities, probabilities in [0,1], sum error≤1e-12 and logits including ±1000; underflow probability zero is allowed.
Any nonfinite feature/score/probability/accumulator/gradient/proposed weight always aborts, never clips.
Layout checks require unique 34/84/370 names/indices, exact block order, absent masks, nominal/paid-known masks and detached Float64Array copy semantics.
Hold θ constant during an episode and verify its before/after byte hash; only parent completion commit can change coefficients.
Exact conservation, IDs, root roster, units/resources, versions, budget accounting and privacy use **no numerical tolerance**.
Generator fixtures independently enumerate small authorized domains; disclose budget omissions instead of claiming bounded output exhaustive in every case.
Ghost-hidden-state twins with equal authorized histories must yield byte-identical public batches/candidates/features/choices, with no private-ID or filtered-sequence gaps.
Include private case IDs/future queues/opponent memory changes that do not change authorized facts; they cannot influence policy channels.
Checkpoint validation reloads exact bits/counters/RNG next draw and reproduces a controlled resumed-fixture prefix; this does not authorize operational resume.
Test nonzero PG independently of L2-only change; at least one outcome-driven update must be reproducible before final VALID eligibility.

## 17. Runtime, evidence, and readiness fixture manifest

Use the existing Docker profile: 2 CPUs, 4GiB memory and memory+swap, 256 PIDs, UID/GID 10001:10001, `/tmp` tmpfs 1GiB mode 1777 with nosuid/nodev, network none, read-only root, no-new-privileges, cap-drop and init.
Record actual provider/tool versions, CPU/ISA, runtime, image/config, and code identity; two-CPU limits are not a fabricated hardware performance measurement.
Capped worst-case generator/feature calls must finish inside the existing 10s decision deadline on the frozen recorded environment.
Verify actual Docker mount/resource/network enforcement and fixed monotonic deadline behavior, including late callback results and reap-before-return.
R0 A14/A15 remain open until validated pre-parse/aggregate allocation and exact mount policy reject their negative fixtures; no current robustness claim follows here.
Readiness requires the training closure captured into the refreshed offline dependency/image context and both adversarial/security reviews recorded READY.
No fixture file, source pin, HMAC/SHA digest, executed command or passing count is manufactured here; future evidence records actual bytes and outcomes.

Proposed `training-readiness-fixtures-v1` lists these stable fixture IDs; implementation later binds each to measured source/input/output references.

| ID | Required independently checked case |
|---|---|
| `paid-F-terminal-skip` | Accepted F deployment debit with terminal C and no entity: receipt becomes wasted, no invented birth/death. |
| `materialized-immediate-death` | Actual creation then immediate mine death versus true unmaterialized disposition. |
| `atomic-identity-swaps-collisions` | Native swaps, mutual collisions and jump collision preserve/retire actual identities atomically. |
| `promotion-lineage-paid-zero` | Opening/free promotion paid basis zero, type changes replacement value, paid lineage retires once. |
| `mine-mode-cc-boundaries` | Own mine identity/inventory, siege toggles, CC damage, gas refill and optional terminal turn-open chip. |
| `witness-fog-noninterference` | Causal-frame authorized death, fog disappearance not death, unseen events do not change public counters/IDs. |
| `unknown-ray-stationary-proxy` | Unknown blocker stays uncertain; enemy mode intersection/union, fixed observed layer, no hidden attackers. |
| `nominal-mask-paid-known` | B-born actor has nominal=1/paidKnown=0; existing endowed zero basis has paidKnown=1. |
| `v2-layout-copy-interactions` | Full 34+4×84 names/indexes, absent/unknown distinction, economic/vision interactions, copy/no-mutation. |
| `quota-independent-small-domain` | All seven families, timing/order/composition, dedup, owner redistribution and 512/2048 caps against independent domains. |
| `zero-decision-delayed-checkpoint` | No gradient/L2/baseline at zero choices; due 100 saves actual 101; zero-choice 1000 cannot launch 1001. |
| `seed-table-stream-resume` | Actual accepted 20-root table/vectors, collision rejection, existing-export parity and restore-next-draw. |
| `stable-softmax-summed-SGD` | Analytic/FD profiles, ±1000 logits, reward direction, prior baseline, λ once, outcome-driven nonzero PG. |
| `whole-child-parent-protocol` | Frozen episode θ, private stream journal verification, forged progress/late replies, fixed deadline, no env.step. |
| `metadata-ledger-preparse-publication` | Trusted roster/case exclusion, duplicate/gap/conservation rejection, pre-parse limits and atomic publication/storage fault injection. |

Future evidence must join source-before/after identities, fixture manifest, raw test bytes, tool/dependency closure and image measurements without fabricated hashes.
Existing evidence and historical pins remain immutable; old successes do not prove these proposed negative regressions pass.

## 18. Source-reading map and original authorities

The source facts used here were read locally; proposed APIs/version strings/seams above are not claims of current exports.

| Reading reference | What it anchors |
|---|---|
| [Original R1 recipe](ml-adjutant-r1-recipe.md) | Eight existing choices, nine accepted directions, unselected remaining fields and experimental numbers. |
| [Weights ledger](ml-adjutant-weights.md) | Coefficient meaning, cancellation, broader first ranker, own paid/replacement distinction and original outcome objective. |
| [Execution/evidence guide](ml-adjutant-execution-revisions.md) | A08 fixed checked deadlines, A09 host-audited roster, A10 native validation plus fixed-N accounting. |
| [Roadmap / R0 ledger](PLAN-ml-adjutant.md#r0-findings-ledger--full-implementation-post-image-review) | All 15 pending findings, historical scope, R0–R5 prerequisites; not amended by this draft. |
| [Strict challenge](ml-adjutant-challenge.md) | Unchanged acceptance boundary and strict failure denominator. |
| [DTOs](../../packages/starchess-arena/src/challenge/types.ts), [observation codec](../../packages/starchess-arena/src/challengeContract/observationCodec.ts), [validation](../../packages/starchess-arena/src/challengeContract/validation.ts) | Current v1 observation-only signature, masks, exact validation and throwing `ContractError` style. |
| [Candidate codec](../../packages/starchess-arena/src/challengeContract/candidateCodec.ts), [config](../../packages/starchess-arena/src/challenge/config.ts) | Seven kinds, codec bound 65, canonical keys, costs, comparator and current resource/IPC caps. |
| [Episode runner](../../packages/starchess-arena/src/challenge/runChallengeMatch.ts), [admission](../../packages/starchess-arena/src/challenge/admission.ts), [schedule](../../packages/starchess-arena/src/challenge/schedule.ts) | Whole-match child-side work, same precommit observations, whole-pair debit and fixed gate seed/seat mapping. |
| [Native begin/end](../../packages/starchess-core/src/resolve/submit-turn.ts), [classical resolve](../../packages/starchess-core/src/resolve/resolve-turn.ts) | Current grouped arrays, actual B/C/F rewrites, swaps/collisions, F skip on terminal C and causal-hook requirement. |
| [Queue append](../../packages/starchess-core/src/commands/queue-action.ts), [native validation](../../packages/starchess-core/src/rules/validation.ts) | Own actor types/anchors, B-created C actors, one-special origin and special admission restrictions. |
| [Vision](../../packages/starchess-core/src/board/vision.ts), [constants](../../packages/starchess-core/src/rules/constants.ts), [RNG](../../packages/starchess-core/src/ai/context/rng.ts) | Lit versus piece-only reveal, rule scales/costs, existing `mulberry32` arithmetic. |
| [Registry](../../packages/starchess-core/src/ai/definitions.ts), [arena metadata](../../packages/starchess-arena/package.json), [workspace](../../pnpm-workspace.yaml) | ML remains placeholder; current arena ID is private; future folder fits packages/*. |
| [Hermetic execution guide](../../packages/starchess-arena/hermetic/README.md) | Existing execution/acquisition owner; training closure must be added and verified later. |
| [Node Crypto Hash](https://nodejs.org/api/crypto.html#class-hash), [pnpm 10 workspaces](https://pnpm.io/10.x/workspaces) | Official implementation readings for future derivation tooling/workspace closure; not fetched or executed evidence in this task. |

## 19. Next TUI and freeze acceptance checklist

```text
R1 proposal approval — no implementation or run permission
  API:         [A recommended] [B] [C]
  Provenance:  [A recommended] [B] [C defer/incomplete]
  Quota:       [A recommended] [B] [C]
  Curriculum:  [A recommended] [B] [C]
  Validation:  [A standard]    [B strict] [C both steps]
  Common:      [A approve exact common contract]
               [B specify amendments before freeze]
               [C defer; first training stays blocked]
```

Record Executor's choices before changing original documents; do not convert recommendations into implicit selections.
Common approval explicitly includes npm name/version, the complete 370-field calculus, trusted frame contract, serialized RNG, zero-choice exclusion, five-run validity and checkpoint bytes.
Profile provenance C prevents a completed R1 freeze even if the other slots are selected.
After choices, re-review the exact cross-profile combination and only then request synchronized recipe/weights/PLAN updates in a separate authorized task.
R1 design acceptance still leaves native hooks, adapters, package exports, DTOs, generation, ledger, features and all R2–R5 tests unimplemented here.
R0 closure plus persisted R2–R5 readiness and explicit training approval precede R6; frozen artifact/adapter R7 precedes learned strict R8.
This paper contract ends with **no trained weights, no new hashes, no passing validation claim, and no altered existing authority**.
