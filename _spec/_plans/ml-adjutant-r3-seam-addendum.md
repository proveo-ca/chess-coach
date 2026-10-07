# ML Adjutant — R3 native-seam addendum

Status: **REVISED PROPOSAL / NATIVE MINE-CARRIER DIRECTION BLOCKED / NOT APPROVED / NOT IMPLEMENTED.** Executor selected **“Review seam addendum (Recommended)”**, then **“Native-fix proposal (Recommended)”**, **“Consumed facts (Recommended)”**, and **“Support multiplicity (Recommended)”**. Those selections authorize drafting/review, not acceptance or source edits. Latest architecture/backend/security reviews returned paired design YES. Adversarial review found a delayed-swap path that removes mines from one working carrier but returns them in authoritative `afterAll`, which conflicts with mandatory filter-to-retirement accounting. Its disposition remains open. Spec review requested the confined A4 reference correction recorded below. Final review/exact acceptance remain pending. R3 implementation remains blocked. No collection, fitting, calibration, transfer, training, evidence publication or registry activation is authorized.

Authority: [original contracts](ml-adjutant-r3-contracts.md) §§3–7, [primary-owner migration](ml-adjutant-spec-file-migration.md), and [R3 roadmap](PLAN-ml-adjutant.md#immediate-ordered-next-actions--train-the-first-broader-adjutant). The original frozen contract, [economic amendment](ml-adjutant-r4-economic-amendment.md), [corrective annex](ml-adjutant-r4-economic-corrective-annex.md) and historical evidence remain unchanged. This revision requires positive closing reviews and actual exact-text Executor acceptance before it takes effect. Design acceptance alone does not authorize implementation; a later decision can grant both only if it names both grants.

## 1. Exact proposed scope

| Section | Targeted clarification or amendment |
|---|---|
| §2 | Define the unchanged End companion signature as the post-Begin settlement seam, with the existing native `skipTurnStartChecks:true` invocation. |
| §3 | Permit named host-only companion exports through existing core `.`, while retaining the exact two-subpath export map and excluding the seam from model closures. |
| §§4–5 | Close the private record, identity issuance, source bindings, local references and digest bytes. |
| §4.4 | Preserve actual mine multiplicity and native occurrence order; distinguish unique locations from entity quantity. |
| §6 | Keep speculative probes private; authorize only the exact target operand of a successfully consumed native discovery operation. |
| §7 | Define a total recipient event merge consistent with native causal execution and existing income boundaries. |
| §8 | Define bounded transactional publication and duplicate behavior. |
| §9.1 | Explicitly bind future R4 innovations, support, features and provenance to the amended public history semantics. |
| §9.2 | Add a V2-history candidate entry and counted pure planning constructor as R3 integration dependencies; preserve legacy V1 behavior. |

The paired [promotion correction](ml-adjutant-r3-native-promotion-fix.md) is the sole proposed native behavior amendment. Companion parity uses that explicitly accepted resolver if the correction receives approval. Normal native API/result schemas, public event fields/ID grammar, observation/history version, Configuration/Versions keys, generator, feature registry and policy horizon stay unchanged. Private records retain `engine-provenance-v1`.

The target-only law explicitly changes authorization semantics: a successfully consumed native target fact supplements committed geometric visibility. It removes incidental full-prefix discovery coverage. It changes the meaning of a normalized singleton `lit` target and clears a matching remembered sighting on an authorized enemy death. It does not authorize a synthetic board, geometric ray clearance or incidental cells. The original frozen rules do not already permit these exceptions.

### 1.1 Explicit proposed supersession map

| Frozen rule | Proposed replacement | Unchanged remainder |
|---|---|---|
| [Contracts §3](ml-adjutant-r3-contracts.md#3-package-ownership-exports-and-dependency-closure), prohibition on a public host export | §3 enumerates companion names on existing host-only core `.`. This is a scoped export amendment. | No host subpath, deep import, wildcard, model reexport or Node core dependency. |
| [Contracts §5](ml-adjutant-r3-contracts.md#5-native-causal-provenance--profiles-abc), companion End invocation | §2 fixes the comparison to the existing post-Begin native End with `skipTurnStartChecks:true`. | Normal native APIs/results and original companion input keys. |
| §5, entity table/counter and unspecified private allocation | §§4–5 close private state, IDs, bindings, ordering and local keys. | No private keys become policy inputs; parent reexecution supplies authority. |
| §5, closed FrameImage `{entities,ccLives}` | §4.4 adds private `nativeMineOrder` to FrameImage and provenance for native occurrence selection. | Unit uniqueness, per-side entry cap, private-only identities and complete digest binding. |
| §§6–7, square-sorted own mine lineages/audit and snapshot reconciliation | §4.4 retains every live mine ID; orders by `(square,id)` and reconciles unique `own.mines` locations separately from quantity. Initial own mine locations remain unique. | Existing public DTO fields, opening/created ID grammar, no paid-unit mine basis. |
| §5, creation then death within a frame | §5 requires atomic replacement birth/crush, followed by a distinct actual newborn-death frame. | Actual creation remains necessary; no birth inferred from payment. |
| §5, actual path images and blanket checkpoint coverage | §§5–6 keep probes private, use committed before/after images and add separately bound consumed-target proofs without cursor images. | No animation-derived witness; complete native identity accounting. |
| [Contracts §6](ml-adjutant-r3-contracts.md#6-public-boundaries-ids-snapshot-and-event-union), ONLY geometric causal-image authorization | §6.3 permits committed geometric witness OR the associated acting-side consumed capture proof. The real causal preimage still proves identity, not fabricated geometric visibility. | Actual native destruction/type/cost/dedup; no CC/mine/fog-disappearance unit witness. |
| §6, geometric-only vision deltas / transient lit history | §6.3 normalizes one consumed target to `lit` and adds only that square to authorized memory/everLit. No prefix or incidental observations. | Final snapshot uses native geometric cells; ordinary piece-only reveal stays outside everLit. |
| §6, memory retained on unknown cells | An authorized enemy-unit-loss event clears an existing same-square/same-type sighting before later vision updates. This closes consumed and geometric casualty sightings uniformly. | No fabricated `lit:null`, enemy identity tracking or subsequent-occupant disclosure. |
| §6, canonical own-ID order inside an atomic frame | §7 retains combined own unit/mine ID order and fixes placement of vision, CC, dispositions, enemy witnesses and income. | Native causal suborder per identity; seq assigned after authorization. |
| [Contracts §7](ml-adjutant-r3-contracts.md#7-receipt-ledger-conservation-and-transactional-reconciliation), transactional replay/session rules | §8 makes last-byte-identical replay/no-reissue and older-nonlast rejection explicit. | No session/producer authentication from JSON; conservation and atomic history advancement. |
| R2 V1 generator bridge / future history composition | §9.2 adds only `composeCandidatesFromHistoryV2` on existing `/candidates` plus counted constructor/type on core `/planning-v1`. Amended inference uses that history entry. | Legacy V1 function/bytes, CandidateBatchV3, diagnostics B, 512/2048/four slots and native promotion/deploy grammar. |

## 2. Fixed post-Begin companion

The signatures are exactly:

```ts
initializeProvenance(snapshot: ScFenSnapshot): EngineProvenance;
beginTurnWithProvenance(input: {
  snapshot: ScFenSnapshot;
  provenance: EngineProvenance;
}): ProvenanceCompanion<BeginScTurnResult>;
endTurnWithProvenance(input: {
  snapshot: ScFenSnapshot;
  provenance: EngineProvenance;
  actionBindings: ActionBindings;
}): ProvenanceCompanion<EndScTurnResult>;
```

`ProvenanceCompanion<R>` contains exactly `{nativeResult:R,provenance,frames,visibilityImages,visibilityCheckpoints}`.

The Begin reference invocation is `beginScTurn(input.snapshot)`. The End reference invocation is `endScTurn(input.snapshot,{skipTurnStartChecks:true})`. End accepts only a successfully whole-pair-committed snapshot after a checked nonterminal Begin. The companion accepts no options field. The normal native APIs retain both existing invocation modes.

`nativeResult` equals the complete reference result before normalization, serialization or projection. If approved, the paired promotion guard changes that reference resolver's values as explicitly scoped in its proposal. Equality includes array order, own-property presence, optional fields and every intermediate native result object. The recorder does not decorate, freeze or rewrite the native result. It detaches and freezes the private records separately. Native errors retain their original class/code/message. Provenance failures publish no companion or boundary. Core imports no arena modules.

The host enforces `initialize → begin → successful pair commit → end → begin → …`. Initialization requires an empty queue. Begin requires stage `before-begin`, native phase `P`, an empty queue and nonterminal `scOutcome`. End requires stage `after-begin`, phase `P`, the matching committed queue and matching bindings. A terminal opening receives initialization and the initial boundary only. A terminal Begin receives its scheduled turn-open boundary and no decision or End. Stages never authenticate a producer/session.

Source: [native options and checks](../../packages/starchess-core/src/resolve/submit-turn.ts), [existing host Begin/End order](../../packages/starchess-arena/src/challenge/runChallengeMatch.ts).

## 3. Host-only access through the existing root

Core's package export map stays exactly `{'.':'./src/index.ts','./planning-v1':'./src/planning-v1.ts'}`. Core `.` adds named runtime exports `initializeProvenance`, `beginTurnWithProvenance`, and `endTurnWithProvenance`.

The associated root type exports are exactly `EngineProvenance`, `EngineEntity`, `ActionBindings`, `ResolvedActionBinding`, `TrustedEffectFrame`, `VisibilityImage`, `VisibilityCheckpoint`, and `ProvenanceCompanion`. Query/consumed-proof helper types stay implementation-private.

Here “private” means host-only and excluded from model dependency closure. This proposes a scoped amendment to the original prohibition on a public host export. It grants no new host subpath, wildcard, cross-package relative/deep import or `/planning-v1` export. Arena host modules consume named core-root imports. Arena `/observations`, `/events`, training `/candidates` and future model entries cannot import/reexport the seam. Both public-closure and source-inventory audits reject runtime and type-only model edges to core `.` and private provenance implementations. Core remains browser-pure.

## 4. Closed private provenance and source identity

All private objects are recursively closed detached plain records. Arrays are dense. Reject getters, inherited substitutes, invalid domains, extra/missing fields, duplicate IDs and unresolved references. `Int[a,b]` is an inclusive safe integer. `Side='w'|'b'`; squares and unit/mine variants retain the original contract domains. Canonical square order is `a1,a2,…,h8`. ID ordering compares UTF-8 bytes.

### 4.1 Lifecycle and bounds

```text
U=64 board squares; M=3 mines/side; G=3 maximum gas;
Q=2*(1+G)=8 successfully committed actions;
W=64 host planning windows; T=45 native terminal turn;
R=min(W,T-initialTurn) remaining End calls.

EngineProvenance={
  version:'engine-provenance-v1',
  initialTurn:Int[0,45],turn:Int[initialTurn,45],
  stage:'before-begin'|'after-begin'|'terminal',
  callOrdinal:Int[0,2*R],
  unitCounter:Int[0,U+2*R],mineCounter:Int[0,2*M+2*G*R],
  entities:EngineEntity[0..70],ccLives:{w:Int[0,3],b:Int[0,3]},
  nativeMineOrder:MineId[0..6],
  resolvedActions:ResolvedActionBinding[0..8],
  lastCall:{queries:PathQueryRecord[0..4],consumedFacts:ConsumedTargetProof[0..2]}
}
```

Initialization requires a valid bounded native state: turn `0..45`, unique occupied squares, exactly one CC per side, gas/gasIncome `0..3`, at most three mines per side and unique mine squares within each side. Opposing mines may share a square where native rules allow it. Duplicate same-side mine locations fail seam preflight; they cannot receive unique frozen opening IDs. This does not change native parsing or promise support for every native-parsed snapshot. Initialization sets `callOrdinal=0`, `initialTurn=turn`, and empty resolved/query/consumed-fact arrays. It sets stage from `scOutcome`, not phase alone.

Each successful wrapper increments `callOrdinal` once and replaces `lastCall`. Begin clears resolved actions and emits no path query/consumed fact. Let `s=floor(callOrdinal/2)`:

| State | Relationship |
|---|---|
| `before-begin` | `callOrdinal=2*s`, `turn=initialTurn+s`, `s<R`, `scOutcome=null`. |
| `after-begin` | `callOrdinal=2*s+1`, `turn=initialTurn+s`, `s<R`, `scOutcome=null`. |
| Terminal after End | `callOrdinal=2*s`, `turn=initialTurn+s`, `scOutcome!=null`. |
| Terminal after Begin | `callOrdinal=2*s+1`, `turn=initialTurn+s+1`, `s<R`, at least one CC life value is zero. |
| Terminal opening | `callOrdinal=0`, `turn=initialTurn`, `scOutcome!=null`. |

A native turn-45 result is terminal even if its unchanged phase is `P`. No Begin follows the maximum remaining End. Global ceilings are 90 calls, 154 issued unit IDs and 276 issued mine IDs.

### 4.2 Entity IDs

Private IDs are `engine:unit:<positive canonical decimal>` and `engine:mine:<positive canonical decimal>`. Counters are independent by kind. Initialization issues unit IDs by canonical square, then mine IDs by side `w,b` and canonical square. Actual creation increments its kind's counter once before allocating. Destruction never decrements counters. IDs never repeat.

The live table is private-ID-byte-sorted. Units occupy unique squares. Mines obey native per-side caps. Non-Tanks have `tankMode:null`; Tanks use the native mode carrier. The live table and CC lives reconcile with the corresponding authoritative native state. The recorder never derives identity from consecutive square/type snapshots.

For `s=floor(callOrdinal/2)`, require `unitCounter≤U+2*s` and `mineCounter≤2*M+2*G*s`. Valid preturn admission allows one deploy per side: exactly one preturn CC supplies its authored origin, and one-special-per-origin prevents another deploy. Native movement changes the append anchor, not that preturn actor permission. At most three specials per side create mines. These bounds include create-then-die. They do not change the candidate codec's independent 65-action representation bound.

### 4.3 Action bindings

```text
ActionBindings = [0..8] of {
  sourceActionSeq:Int[0,7],side:Side,
  actionRef:{planningOrdinal:Int[0,63],acceptedActionOrdinal:Int[0,3]}
}
ResolvedActionBinding = same fields + {effectiveActorId:UnitId|null}
```

Bindings cover every committed action exactly once in merged contiguous native `seq` order. Side and accepted own-array ordinal match the committed intents. All planning ordinals equal the pre-settlement host ordinal. Create bindings only after successful whole-pair commit.

Bind the primary effective actor at its actual native lookup site: native B order/origin; C after B rewriting; F after native origin selection. Record the actual live entity returned by that lookup, including a replacement, even when a subsequent side/type/occupancy guard skips the effect. Null means the native path never reached an actor lookup or that lookup returned no entity. A terminal-skip action therefore uses null; an own Tank replaced by an own Marine before F siegeMode retains the Marine lookup ID even though the type guard skips. Fire-and-forget Charon retains its source even without an actor. The association never grants side/type permission or proves the actor caused an effect; affected identities bind independently. These records add no rules guard.

Every affected entity retains its own actual ID independently of the primary actor. `sourceActionSeq:null` means a native automatic effect without a queued source, never an unknown substitute for a known source. Later automatic effects use the native-established source association where one exists. Ambiguous actual identity/source fails infrastructure validation. Return `resolvedActions` in the original contiguous source-sequence order after collecting execution-site associations.

### 4.4 Mine multiplicity, order and removal

Each actual native mine-array occurrence is one entity. Continuation allows same-side same-square multiplicity. The native cap remains three entries per side, not three locations. Keep the initialization-only uniqueness requirement and existing opening ID grammar. Actual appends allocate one new private/public own mine ID and increment the creation counter even at an already occupied own mine location or before immediate removal.

`ownMineLineage` and `OwnMineAuditState.liveOwnMines` each contain every live own `{mineId,square}` in dense arrays of length `0..3`. IDs are unique; squares may repeat. Order by canonical square, then mine-ID UTF-8 bytes. Reconcile those arrays exactly by identity/location. Require `own.mines=canonicalSortUnique(ownMineLineage.map(x=>x.square))`. Unique location projection does not encode capacity. Retired IDs remain sorted unique and never reused. Mines receive no paid-unit basis.

Add exactly `nativeMineOrder:MineId[0..6]` to EngineProvenance AND every FrameImage. It contains all and only that state's mine IDs exactly once in native input-array order. Resolving them to `{color:entity.side,at:entity.square}` reproduces that native array. Initialize order from actual input occurrences while issuing IDs in the separately specified canonical initialization order. Append at actual birth; apply actual native filters to ordered occurrence bindings; preserve survivor order. Copied maps/arrays preserve occurrence association, not new identities. Query bases inherit FrameImage order; captured vision mine arrays preserve actual argument order and multiplicity. Native order enters canonical digest bytes and never public DTOs.

Native `mineAt` selects the first array occurrence at a square, including a friendly entry before a hostile entry. Bind that selection by input occurrence index, not inferred color/square continuity. For non-inert `withoutMine`, let `spent=hit.kind==='detonated'?(hit.chaseFrom??hit.at):hit.at`; remove EVERY actual input occurrence at `spent`, across both sides, exactly as the native square filter does. Inert removes none. Other explicit native square filters remove all corresponding occurrences. Record one removal per actual ID in one atomic mutation. Public own events retire each affected own ID; a location remains until no live own occurrence remains. Presentation sorting never changes native selection/removal order. Scratch synchronization performs no repeated retirement.

Live limits remain six total/70 frame entities; creation at most six/End and removal at most twelve/End, charging each initial or born entity once. One native removal can retire six co-located mines. This law changes representation/count transport, not native duplicate creation or refund rules.

Source: [native mine array/count/first lookup](../../packages/starchess-core/src/board/mines.ts), [actual all-square removal](../../packages/starchess-core/src/board/mine-contact.ts), [F append/rewrite](../../packages/starchess-core/src/resolve/submit-turn.ts), [location-only V1 observation](../../packages/starchess-arena/src/challenge/observation.ts).

## 5. Trace structure, bytes and bounds

Frames retain the original exact fields `{sourceEffectKey,phase,before,after,effects,beforeVisibilityKey,afterVisibilityKey}`. Effects retain their original variants and `sourceActionSeq`; destruction adds the original causal visibility key. Frame phases remain unchanged.

Keys use the successful call's incremented output ordinal: `engine:call:<callOrdinal>:frame:<ordinal>` and `engine:call:<callOrdinal>:image:<ordinal>`. Per-kind ordinals are zero-based and contiguous. Output references resolve within that output companion. Frames follow actual semantic native commit order, including a C movement commit after deferred path application. They do not follow animation order or a sorted phase registry.

Incoming provenance can retain `lastCall` references to the previously checked output. Do not resolve those previous keys against the next call's new arrays. Validate their closed shape/key grammar at wrapper entry; the trusted host binds the entire incoming record to its previously fully checked companion. Validate the prior references when checking that prior companion. The next wrapper replaces `lastCall`. A standalone reusable record never establishes the missing prior companion's authority.

Apply each frame atomically by identity. Preserve simultaneous swaps and multi-removal. Validate occupancy after the frame, not after serial public events. Scratch-map copying and ghost cleanup produce no duplicate effect. Collision cues alone produce no movement effect. Creation/transformation initializes mode from native state without fabricating a toggle.

Split an actual birth and that entity's later death into distinct frames. The death's causal image contains the live created identity. A native replacement write MUST place its occupant destruction and replacement birth in one atomic frame. It cannot create an intermediate empty-square observation. All victims in an atomic multi-removal use one common pre-effect image.

Mandatory semantic frame boundaries are:

| Native operation | Frame partition |
|---|---|
| Deployment replacement write | One frame for crush, birth and materialized disposition; one later frame for actual newborn mine death/removal. |
| Unit relocation | One frame for actual occupancy transfer; a later landed-live frame for actual arrival mine destruction/removal. |
| Jump/mutual collision or C removal wave | One atomic frame for that operation's affected identities; no sequential victim observations. |
| Native Tank toggle or valid same-side promotion write | One frame per actual mode/transform write. |
| Deferred successful application | One atomic frame for application capture/CC damage and native relocation; subsequent approach-mine mutation is a distinct frame. |
| Own mine creation/removal or CC damage outside the above | One frame per actual native semantic mutation, including its inherently simultaneous effects. |
| Skipped paid deployment | One disposition-only frame at its actual skip/return branch. |
| Scratch-map synchronization | No semantic frame. |

Within a private atomic frame, sort entity effect blocks by private ID bytes across units/mines; preserve native emission order within one identity. Emit CC effects after entity blocks in side order `w,b`; preserve each side's causal order. Emit deployment dispositions last by source action sequence. This ordering describes an atomic mutation, not serial occupancy updates.

The native side-changing promotion identified in §10.1 is addressed only by the separately accepted paired correction. Do not model its old behavior as an ambiguous identity, new birth/death or ownership-transfer event.

Every accepted deploy supplies one disposition. Actual creation supplies its ID even if it later dies. Native skipped/fizzled deployment supplies null. Terminal-C F skips emit disposition-only F frames at the actual skip branch; they execute no F action.

Every frame contains an actual effect or deployment disposition. A successful deferred capture has a real destruction; a successful CC shot has real damage in the fixed nonterminal seam. Consumed facts create no separate frame or zero-effect anchor. Probes and scratch synchronization create no frame.

For each frame, emit before-frame then after-frame checkpoints. Before/after images equal the frame states. All causal checkpoints precede destruction commit. Each checkpoint has one image with the same contiguous ordinal. Equal states at different occurrences retain distinct keys. Every image has a checkpoint; every frame and consumed-proof key resolves within the corresponding output companion. No synthetic cursor or path-prefix checkpoint exists.

### 5.1 Structural ceilings

| Per wrapper | Inclusive ceiling |
|---|---:|
| Classical plans | 2 |
| Path helper queries | 4 |
| Intermediate evaluations per query / total | 6 / 24 |
| Successful deferred applications | 2 |
| Consumed target facts / target cells per fact | 2 / 1 |
| Actual unit creations / destructions | 2 / 66 |
| Committed unit moves / transforms / mode changes | 520 / 8 / 530 |
| Mine creations / removals | 6 / 12 |
| CC-life changes / deployment dispositions | 6 / 2 |
| Total effects | 1152 |
| Frames | 1152 |
| Before/after checkpoints | 2304 |
| All checkpoints / images | 2304 / 2304 |
| Synthetic cursor images | 0 |
| Entities per image | 70 |

Each of two native classical plans permits one memoized scan query and one reveal query. Rays have at most six intermediates. Each plan selects at most one outcome, so End has at most two consumed facts. Begin has no query/fact allowance. The movement envelope is `Q*(U+1)`; the mode envelope adds `Q+2`. These conservative structural envelopes grant no permission to add records. Actual records/counts must equal native reexecution. A query patch and synchronization count as no identity effect.

### 5.2 Canonical digest

The companion keeps its exact five fields. Digest input stays exactly `{provenance,frames,visibilityImages,visibilityCheckpoints}`. Queries and consumed proofs enter through `provenance.lastCall`. Add no root field, self-hash, Versions key or profile-B persistence codec.

Canonical JSON sorts object keys and preserves array order. Integers have canonical finite JSON values. Encode UTF-8 without BOM, whitespace, LF or undefined. Require exact raw-byte re-encoding equality. SHA-256 covers these physical bytes externally. The host compares its independently reexecuted `{byteLength,sha256}`; native results and public batches still receive separate comparisons.

Retain the 16,777,216-byte private host/completion cap. Check raw length and nested cardinalities before declared allocations. Overflow aborts without dropping records. These structural bounds do not certify measured memory/runtime or full-cap serialization feasibility.

## 6. Visibility authority and exact causal images

### 6.1 Occurrence classes

| Class | Carrier | Recipient projection |
|---|---|---|
| Evaluation probe | Compact `lastCall.queries` | Never. |
| Committed state | Frame before/after images | Apply recipient vision. |
| Consumed discovery fact | `lastCall.consumedFacts` with exact application association | Acting-side target only under §6.3. |
| Scratch synchronization | Native bookkeeping | Never. |

Helper evaluation or consumption is not occurrence authority. A successful Boolean, animation cue or equal placement string never authenticates an observation. Parent reexecution reproduces the classification. Scheduled final snapshot folding covers empty wrappers without invented probe/checkpoint counts.

### 6.2 Compact query representation

```text
VisionMine={color:Side,at:Square}
CapturedVisionInputs={
  modeSource:'default-tank'|'native-sieged-set',siegeMaskHex:LowerHex16,
  mineSource:'absent'|'provided',mines:VisionMine[0..6]
}
QueryEvaluation={mid:Square,visible:boolean}
PathQueryRecord={
  sourceActionSeq:Int[0,7],site:'scan-ray'|'reveal-to',
  base:FrameImage,from:Square,to:Square,side:Side,target:Square,
  visionInputs:CapturedVisionInputs,evaluatedSteps:QueryEvaluation[0..6],
  returnedStep:Int[1,6]|null,
  consumption:'not-deferred'|'deferred-skipped'|'applied-consumed'
}
```

Query ordinal is its array index. Record actual resolver-owned `pathRevealSteps` invocations only. Memoized scan reuse creates no second query. Helpers that never execute intermediate evaluations have an empty evaluated prefix. Standalone helper use outside the trusted wrapper grants no observation authority.

Capture the exact query placement-source state with native-carried IDs. It can precede later committed mutations. At evaluated step `j`, require `mid=rayBetween(from,to)[j]`. Replay the native computational patch: remove the base actor from `from`, remove any base occupant at `mid` computationally, then place the same actor ID at `mid`. The displaced occupant remains fully recoverable in `base`; it does not die, move or retire. This virtual board never becomes a committed `FrameImage` or visibility image.

`evaluatedSteps` equals the actual visited prefix. A nonnull return equals its final length and final true result; earlier results are false. A null return contains all actual intermediate evaluations with false results. Native current source returns no zero step. Capture before testing native return; do not rerun or extend helpers for audit.

The mode mask uses canonical squares `a1,…,h8`; index `i` occupies bit `7-(i%8)` of byte `floor(i/8)`. Encode eight bytes as 16 lowercase hex characters. Capture all native-carrier square memberships, including empty/non-Tank squares that a virtual Tank can occupy. Do not invoke an arbitrary mode callback 64 extra times. This seam supports the native-owned set/default only. Default mode requires zero mask. Absent mines require an empty list; supplied mines preserve actual array order and per-side cap. Query overrides can be stale computational inputs, not live ledger facts.

Consumption records the final native disposition. `not-deferred` supplied no deferred approach. `deferred-skipped` supplied an approach that skipped or returned `fired:false`. `applied-consumed` requires `fired:true` and exactly one matching consumed-target proof. Other statuses have no proof. Source query association is branch-carried, not reconstructed by coordinate matching.

### 6.3 Consumed target facts — proposed replacement

A successfully consumed deferred capture or CC shot authorizes exactly its queried target to the native query's acting side. Require the exact resolver-owned positive query, its association with the selected native branch, completed native skip/operand guards, and application `fired:true`. Successful consumption issues a proof even when the public target delta is empty.

Do not gate the fact on intervening occupancy, query/application ID equality, returned-step value, discovery coordinate, mode mask or recomputed visibility. Do not build an overlay. Failed/skipped/superseded/unconsumed approaches issue no fact. A subsequent approach mine cannot revoke an already successful target operation.

```text
ConsumedTargetProof={
  queryOrdinal:Int[0,3],sourceActionSeq:Int[0,7],side:Side,
  operation:'capture'|'cc-shot',frameKey:FrameKey,
  causalBeforeVisibilityKey:ImageKey,
  evaluationActorId:UnitId,evaluationTargetId:UnitId,
  appliedActorId:UnitId,appliedTargetId:UnitId,
  turn:Int[0,44],
  targetCell:{square:Square,visibility:'lit',piece:{type:UnitType,color:Side}}
}
```

Proofs follow application-frame execution order. They have unique query/frame associations, at most one per side/End. Query, selected classical action, application frame, side and source sequence agree. The turn equals End input turn. The causal key equals the ordinary committed frame-before key. Evaluation IDs refer to captured query operands; applied IDs refer to the actual consumed native operands. Every `applied-consumed` query has exactly one proof, and other dispositions have none. Parent reexecution reconstructs all fields.

#### Branch association and target value

| Selected native branch | Exact consumed query | Target operand |
|---|---|---|
| `rayContactOutcome` capture approach | Contact's `scan-ray` query | `contact.at`, contact victim descriptor. |
| `enemyCCSquare` blocker-capture approach | That branch's `reveal-to` query | Blocker, not authored CC destination. |
| `targetOnDestination` capture approach | That branch's `reveal-to` query | `plan.to`, target victim descriptor. |
| `slideIntoFog` CC-shot approach | CC contact's `scan-ray` query | CC contact square, opposing `k`. |

Carry the query ordinal through native internal branch/application association without decorating normal result schemas. Cached scan reuse keeps its original association. Do not retrospectively choose a positive query by matching coordinates.

For capture, target square equals query target and operation `to`. Target type/color equals the selected operation's query-derived victim descriptor and actual frame-before victim. The helper's `fired:true` guarantees actual actor/victim descriptor checks. Capture type is a spawn type and color is the opposite side. For CC shot, the validated target is opposing `k` at the queried square; target side agrees with the native damage target.

Different evaluation/application IDs with the same validated descriptors neither suppress the fact nor publish an identity status. Bind actual destruction/dedup to the applied target, never the evaluation target. Incorrectly claimed IDs/descriptors/source associations fail provenance integrity; inequality between two correctly recorded IDs is not an integrity failure. Read no later replacement/F occupant for this fact.

#### Recipient projection and casualty closure

Normalize the one target to `visibility:'lit'` independent of the query's lit-versus-revealed mechanism. This explicitly authorizes full identification of that one cell; it asserts neither geometric illumination, empty route nor neighboring vision.

For the acting recipient, after ordinary frame-before projection and immediately before authorized application effects, patch only the target in the accepted projection. Emit existing `vision-witness` with `[targetCell]` iff the cell changes. Fold its sighting at the proof turn and add only that square to `everLit`. An unchanged target emits no new event; ordinary final snapshot folding refreshes an unchanged current sighting. Facts produce no extra public refresh when no cell change occurs. All public memory changes must be derivable from public events/snapshot alone.

The other recipient receives no consumed fact or consumed-derived loss witness. It retains ordinary committed vision and own lifecycle/accounting. No recipient-specific query reevaluation occurs.

Authorize an actual enemy destruction when either original committed geometric visibility proves it OR a consumed proof has matching acting recipient, capture operation, application frame, actual victim ID, square and type/color. The real causal preimage still contains the live victim. This is an explicit exception to the original ONLY `getSideVision` witness rule; do not invent geometric visibility in that preimage. Both authorities deduplicate to one witness. Native spawn replacement cost and paid lower bound zero remain unchanged. CC facts create no unit-loss witness. The proof grants no authority to subsequent mine death, collisions or unrelated casualties.

On every authorized `enemy-unit-destruction-witnessed`, clear an existing memory sighting with the same square/type before processing later vision updates. This public reducer rule closes consumed and ordinary witnessed deaths uniformly; it tracks no enemy identity and discloses no later occupant. Do not manufacture `lit:null`. An actual later authorized sighting can repopulate memory. Final snapshot cells still come from native geometry; final memory/everLit reflect only accepted public events and snapshot.

#### Exact noninterference and lost coverage

Let `D` be recipient-filtered ordered successful facts `(side,turn,operation,targetSquare,targetType,targetColor)`. For valid trusted executions with identical preceding recipient state, ordinary authorized committed projections/lifecycle/resource facts and `D`, require byte-identical public batches, memory, everLit, loss projection, IDs and seq. Publication depends on none of query ordinal, ID equality, step/discovery, prefix occupancy, stale mode/mine inputs, probe mechanism or unrelated evaluated/refreshed entities. Private digests may differ.

Successful step-3/step-5 and hidden-prefix occupancy twins with the same `D` produce the same target fact and witness. The law does not hide a different actual native success/target descriptor or independently authorized committed observation.

Lost coverage is explicit: no evaluated/prefix images, incidental sightings, virtual own positions, empty cells, ray clearance, surrounding lighting or unrelated Battleship reveals. No masked overlay recovers them. Target-only facts add at most two singleton deltas across both recipients per End, no images/checkpoints/frames, and no new public fields. This exception requires exact-text approval.

### 6.4 Native causal cases

| Operation | Causal pre-destruction image |
|---|---|
| C attack wave | One common live pre-wave image containing every wave victim, vision source and pre-wave mine. |
| Successfully consumed deferred capture | Actual committed pre-mutation image for identity; target-only proof can separately authorize the acting-side casualty. |
| Ordinary landing capture | Live pre-capture image; arriving actor stays at its last distinct native position. |
| Mutual/jump collision | Common live pre-removal image; participants occupy distinct pre-effect positions. |
| Arrival/chase mine | Landed live victim immediately before removal; spending mine still exists. |
| Deployment crush | Live pre-replacement occupant; unborn replacement contributes no vision. |
| Newborn immediate mine death | Post-creation, pre-removal image with newborn alive. |
| Held mine | Actual position where native execution resolves the held blast. |
| Turn-open/special destruction | Actual live pre-removal image at the mutation site. |
| Dropped/skipped/superseded plan or ghost cleanup | No new image/effect for that plan or synchronization. |

The C wave applies removals atomically. Subsequent observations use authoritative post-wave occupancy. `board`, `pmap`, and `phase3` denote different native epochs; copied/stale maps cannot resurrect victims or supply visibility sources. Native `afterMove` remains part of complete result comparison even when it retains an earlier path-victim representation. It is not an additional observation epoch. Do not combine old placement with newer mines/lives into an invented state.

Do not interpolate quiet movement, leaper flight or collision markers. Failed path application grants no approach observations. Fallback movement grants only its actual committed observations. A chase wake tile is not the destruction square. A collision before mine arrival does not spend that mine. CC damage and mine removal never create enemy-unit-loss witnesses.

Source: [probe evaluation](../../packages/starchess-core/src/board/vision.ts), [scan memoization/consumption](../../packages/starchess-core/src/board/ray-scan.ts), [C waves and deferred application](../../packages/starchess-core/src/resolve/resolve-turn.ts), [B/F births/collisions/mines](../../packages/starchess-core/src/resolve/submit-turn.ts).

## 7. Deterministic recipient event merge

Initial boundary: own-unit endowments by canonical square, then own-mine endowments by canonical square. Fold the initial snapshot as the recipient baseline. Invent no checkpoint or vision event solely for initialization.

Settled debit prefix: traverse the recipient's accepted own actions by own-array ordinal. For deploy emit paid receipt, then gas debit. For every other special emit gas debit. Classical emits no debit. Use exact native `UNIT_COST` and `specialGasCost`; cross-check committed mineral/gas deltas. All debits precede native effects. Action refs carry ordinal `p`; settled snapshot/batch carries `p+1`.

Consume checkpoints in execution order. Emit the nonempty committed before-frame delta. At a consumed application, emit its acting-side target-only delta next. Immediately before after-frame, emit authorized effects in the order below, then its nonempty committed after-frame delta. Frames do not overlap. After-frame order equals frame order. Consumed facts add no checkpoint.

Inside a frame emit: combined own-unit/own-mine blocks by recipient-public ID bytes; own CC-life changes in native causal order; unmaterialized deployments by accepted-action ordinal; witnessed enemy losses by canonical `(square,type)` order. This preserves the original canonical own-ID ordering across both identity kinds. Preserve native causal order within an identity block. Allocate own creation IDs in actual creation order before this presentation sort. A materialized disposition closes via `own-unit-created`; add no public disposition variant. Deduplicate actual enemy destruction lifecycles privately. Never sort public witnesses by hidden IDs.

Every delta contains changed canonical-square-ordered cells only. Compare with the same recipient's previous accepted projection. Fold transient-inclusive memory/`everLit` through the original reducer. Piece-only reveals do not add `everLit`. Remove empty deltas and unauthorized effects before assigning contiguous recipient seq. Private keys/counts never enter DTOs or public allocation.

After effects/checkpoints, grant hosted income exactly once per completed settlement using the existing `grantStoredIncome(committedBank,nativeResult.next.turn)`. Emit one `own-income` equal to `afterGrant[side]-committedBank[side]`, including zero, as the final event. Terminal settlement keeps this existing grant. Initial and turn-open, including terminal Begin, grant no income.

Fold final snapshot cells through the same observation reducer without inventing another event. Reconcile modes/resources, mines, entities, receipts, CC lives and exact paid conservation before publication.

## 8. Transaction and replay

Stage the native companion, resource facts, private→public identity maps, recipient counters, events, ledger/mine/vision state, snapshot/history and canonical bytes together. Whole-pair commit permits staging, not partial public publication. Commit the successor only after full validation and required host verification. Provenance, authorization, reconciliation and publication-integrity failures preserve previous public state/counters and private diagnostics; they publish no partial history or learning return. R3 implements no learner. This does not supersede the original later eligibility rules for proved native/challenge failures and their verified ACKed prefixes.

The last canonical batch is idempotent only when bytes and SHA-256 both match. Return its already-checked state; reissue no IDs, callbacks, receipts, income or seq advancement. A conflicting last duplicate fails. An older nonlast ordinal fails sequence validation. Identical pure wrapper inputs produce the same output without ambient counters.

Trusted session binding remains outside DTOs. A structurally identical batch from another episode fails that binding. Keep public caps 2048 events, 64 changes/witness and 1MiB/batch. Overflow aborts without dropping knowledge.

Lifetime host audit ceilings under `W=64`: own receipts `≤W`; retired own unit IDs `≤U+W`; own mine creations `≤G*W`; retired mine IDs `≤M+G*W`; enemy witnessed units `≤U+W`; memory/everLit `≤U`; live own mines `≤M`. These bounds add no public keys.

## 9. Required implementation verification

No fixture, test file or passing result is claimed here. The proposed persisted tests are:

| Proposed test filepath | Independent purpose |
|---|---|
| `packages/starchess-core/src/__tests__/provenance.test.ts` | Full traced/untraced native equality; turn-45/terminal chips; private counters; atomic replacement and later newborn death; swaps/collisions; B/C/F actor/source association; skipped F disposition; explicit approved disposition of native ownership-changing promotion. |
| `packages/starchess-core/src/__tests__/provenanceQueries.test.ts` | Actual helper prefix/memoization; 4-query/24-evaluation/2-fact ceilings; captured mode/mine epochs; exact branch-carried association; consumed descriptors versus actual lifecycle; no speculative/ghost observations. |
| `packages/starchess-arena/src/__tests__/challengeObservationV2.test.ts` | Closed schemas, canonical bounded bytes, detached copies and exact V1 preservation. |
| `packages/starchess-arena/src/__tests__/challengeEconomicLedger.test.ts` | Exact paid conservation, transactional identities/mines/vision, wrong/gapped/conflicting batches and idempotence. |
| `packages/starchess-core/src/__tests__/provenanceMines.test.ts` | Actual stacked mine births; first-occurrence friendly/hostile order; all-matching native removals; private occurrence order; no duplicate lifecycle from synchronization. |
| `packages/starchess-training/src/__tests__/candidatesHistoryV2.test.ts` | Derived live quantity versus unique locations, prefix reservations/root availability, count-field forgery rejection and exact V1 parity for equivalent unique inventories. |
| `packages/starchess-arena/src/__tests__/challengeBoundariesV2.test.ts` | Exact initial/open/settled schedule, total merge, debit/receipt disposition, capped zero income and parent reexecution. |
| `packages/starchess-arena/src/__tests__/challengeProvenancePrivacy.test.ts` | Hidden prefix-occupancy and retired enemy-mode twins; target-only moved-Battleship exclusion; descriptor-preserving identity substitution; consumed capture→mine/F replacement memory closure; nonacting recipient isolation; forged proof/image/binding; model-closure exclusion. |

Required counterexamples include adjacent-ally virtual overwrite; stationary siege probe; discovery square occupied after ordinary movement; failed/superseded path application; dead C-wave vision source; stale `afterMove`; collision before mine arrival; create-then-mine-death versus unmaterialized F. They are source-derived fixture obligations, not executed exploit results.

Implementation checks include all three package typechecks, strict test-file typechecking, core/arena/training suites, exact public-closure checks and affected inventory/isolation regressions. Preserve immutable R2 evidence and its checks. A new assurance generation requires its own namespace/authorization. Local R3 tests do not close aggregate R5 readiness.

### 9.1 Explicit downstream R4 disposition

This proposed paired authority changes the public-input semantics consumed by future R4. Preserve the economic protected bodies; acceptance of this addendum supplies only the scoped input-law precedence below. It does not implement R4, alter the 418 registry or authorize data/calibration operations.

| Frozen consumer / definition | Required use of the amended R3 boundary |
|---|---|
| Economic amendment public observation/current-board constraints and calibration lit bins | Use final snapshot geometric cells only. A transient normalized consumed target is not a blanket geometric lit mask or final lit-bin count. |
| Economic amendment §§4–5 ordered `Y1/Y2/Y3` innovation reduction | Replay amended public events and memory order. Consumed singleton assertions can contribute to `Y1`; actual authorized deaths to `Y2`. Clear same-square/type remembered sightings at death before later deltas; compute `Y3` from that resulting running public memory, without fabricating a lit-empty innovation. |
| Economic amendment promotion/Marine observations and corrective annex A4 persistent support | A consumed Marine assertion is an authorized transient anchor. Casualty square-memory clearing never deletes all persistent anonymous witnessed/unlocated frontier possibilities. Apply A4's existing phase propagation and current-observation pruning; apply only the existing aggregate loss constraints to economic quantities. Invent no casualty-specific frontier reducer or enemy ID. |
| Original contracts §§9–10 novelty/stale approach | Retain every historical feature name/index/formula/mask/scale. Their `everLit` includes only geometric lit and approved singleton targets; stale memory uses amended public casualty clearing. Incidental removed prefix sights do not reappear through feature projection. |
| Future estimator/recipe/native/source/provenance binding and R5 truth containment/calibration | Bind the paired accepted authorization law and corrected native source independently. Recompute support, innovations and verification from that law. Historical source/evidence or a model fitted under older observation authority cannot certify it. Add no Configuration/Versions key or automatic fitted-artifact migration. |

This disposition changes inputs and source-law binding, not the probabilistic architecture, bin tree, feature calculus, policy horizon, optimizer or operational permission. R5 must persist public-only casualty-memory replay, `Y1/Y2/Y3`, anonymous-frontier preservation and novelty/stale-memory regressions under the accepted pair. The economic amendment and annex remain frozen outside this explicit dependency scope.

### 9.2 Exact V2-history count transport and generator dependency

Add one runtime export on existing training `/candidates`:

```ts
composeCandidatesFromHistoryV2(history: AuthorizedHistory): CandidateBatchV3;
```

Retain `composeCandidatesFromObservationV1` signature and bytes for unchanged valid V1 inputs. Retain composition-v3, candidate codec v1 and diagnostics B. Add no package subpath, Configuration/Versions key, count callback, override or public prepared-call entry. Existing R2 source/allowlist/evidence bytes remain historical; current implementation/audits will receive a separately reviewed additive delta.

V1 knows locations and cannot certify actual mine quantity under multiplicity. Amended episode-v2 generation and parent recomputation use ONLY the history entry, with no fallback to V1. This is a minimal R3 integration dependency before amended candidate decisions, not R4 belief/features or training.

On existing core `/planning-v1`, retain `PlanningKnowledge` and legacy `knownAppendFailure` behavior. Add exactly:

```ts
type CountedPlanningKnowledge =
  Readonly<PlanningKnowledge> & Readonly<{ownMineCount:number}>;
countedPlanningKnowledge(
  knowledge: PlanningKnowledge,
  ownMineInventorySquares: readonly Square[],
): CountedPlanningKnowledge;
```

Inventory squares are dense `0..3` valid squares with repetition allowed. Their location set equals `knowledge.ownMines`. Return exactly the existing five fields plus runtime-readonly `ownMineCount=ownMineInventorySquares.length`; accept no supplied count override. Copy planning maps/sets and their DTO values into detached constructor-owned state. The constructor validates, not authenticates.

The history entry validates/detaches the exact four-key history, V2 snapshot, ledger equality, recipient consistency, live mine ID/order/multiplicity law and everLit. Derive inventory solely from `currentAuthorizedSnapshotV2.ownMineLineage.map(x=>x.square)`. Build current known pieces/unknown mask/mine locations/own siege modes from that snapshot, not stale memory. The parent independently checks the quantity equals its checked boundary's live mine audit length. Audit state stays private; no extra history field or function argument carries it.

Reuse existing primitives, prefix `{actions,anchors,mineAnchors}`, lanes, FIFO/depth cursors, canonical field/key order, profile B ownership, redistribution, pass, four actions, 512 uniques, 2048 attempts, hashing/collision checks and diagnostic identities. Extract one private prepared traversal shared by V1 legacy knowledge/count=`ownMines.size` and V2 counted knowledge/count=live lineage length. Do not run V1 traversal and filter its completed output.

At root probes AND every lane append keep guard priority `actor,shape,timing,resources,mineCap,ownOccupancy`. After resources, for spiderMine reject `mineCap` iff `ownMineCount+state.mineAnchors.length>=MAX_MINES_PER_SIDE`. Then compute the current action's native append-time anchor and reject `ownOccupancy` when it is an existing own location or prior stored reservation. Each valid mine append reserves ONE additional entity and its stored append-time location. Count every reservation without deduplication; do not subtract hypothetical removals or recompute previous anchors after later C. Legacy location-based cap cannot exceed this counted cap because actual count is at least unique locations.

Required fixtures: three IDs/one location makes Spider inactive; two IDs/one location allows one further reservation; resources precede cap; duplicate current/reserved anchor becomes ownOccupancy unless cap fails first; root/lane guards use the same count; unique equivalent inventories reproduce entire V1 candidate/diagnostic bytes. Reject forged count/history fields, malformed lineage, inconsistent location projection and private audit mismatch. Preserve F-before-C native multiplicity without retrovalidating stored anchors.

## 10. Review and decision ledger

| Review | Task | Scope / disposition |
|---|---|---|
| Architect consultation | `ses_eec78096cffeMkpMxeH0Yz2wt6` | Read-only author guidance for wrapper, root access, private records, digest, merge and bounds; not an independent final verdict. |
| Backend consultation | `ses_eec780908ffeZeOvzGT0ah2tLD` | Read-only source-derived probe/commit distinction and causal-image proposal; no tests or native execution. |
| Architecture first pass | `ses_eec78096cffeMkpMxeH0Yz2wt6` | **READY FOR EXECUTOR SEAM DECISION: no**. Four HIGH: native ownership change, cursor mode representation, certificate viewer/mapping and optional frame partition. Author consultation is not a closing clearance. |
| Adversarial first pass | `ses_eec4b5d28ffeFSK3KuDIKfzBdv` | **READY FOR EXECUTOR SEAM DECISION: no / READY TO MERGE: no**. Four HIGH: optional replacement partition, reusable prior-reference scope, duplicate opening mine locations and refreshed discovery authority. Two MEDIUM: lost transient knowledge coverage and own-ID ordering. |
| Security first pass | `ses_eec4b5c3dffeuiVNlh9BpgideH` | **READY FOR EXECUTOR SEAM DECISION: no**. Two HIGH: hidden-occupancy eligibility channel and synthetic/stale-mode discovery authority. |
| Spec first pass | `ses_eec7808f6ffed4yCzKVOuYK5fZ` | **SPEC STATUS: blocked / READY FOR EXECUTOR SEAM DECISION: no**. Two HIGH: exact supersession map and undefined certification viewer. Two MEDIUM: private array/key ordering and missing closing architecture gate. |
| Spec blocked-record check | `ses_eec7808f6ffed4yCzKVOuYK5fZ` | **READY TO PRESENT BLOCKER DIRECTIONS: yes / SPEC STATUS: blocked**. Confirms faithful blocked lifecycle and source-derived ownership conflict; does not clear discovery semantics or authorize acceptance. |
| Native-fix author consultation | `ses_eec78096cffeMkpMxeH0Yz2wt6` | Read-only live Marine/color guard and exact fixture proposal after Executor's direction selection. |
| Consumed-fact author consultation | `ses_eec780908ffeZeOvzGT0ah2tLD` | Read-only query-derived target/type agreement, actual lifecycle binding, sparse projection and noninterference proposal. |
| Consumed-fact security guidance | `ses_eec4b5c3dffeuiVNlh9BpgideH` | Advisory criteria for target-only authority, no occupancy/mode/ID-equality gate and explicit target-sighting closure; not a closing verdict. |
| Target-only security rereview | `ses_eec4b5c3dffeuiVNlh9BpgideH` | **READY FOR EXECUTOR PAIRED DESIGN DECISION: yes**; original two security HIGHs resolved at design level, no new security HIGH/BLOCKER. Read-only paired text/source; no native execution. This verdict precedes subsequent mine/dependency wording revisions. |
| Target-only spec rereview | `ses_eec7808f6ffed4yCzKVOuYK5fZ` | **READY FOR EXECUTOR PAIRED DESIGN DECISION: yes**, conditioned on other closing reviews and fresh document checks; design unaccepted. This verdict precedes subsequent mine/dependency revisions. |
| Target-only adversarial rereview | `ses_eec4b5d28ffeFSK3KuDIKfzBdv` | **READY FOR EXECUTOR PAIRED DESIGN DECISION: no / READY TO MERGE: no**. One new HIGH: same-side mine multiplicity from admitted execution. Two MEDIUM: lookup-versus-skip actor association and sequenced fixture staging wording. |
| Target-only architecture rereview | `ses_eec78096cffeMkpMxeH0Yz2wt6` | **READY FOR EXECUTOR PAIRED DESIGN DECISION: no**. Two HIGH: mine multiplicity closure and explicit downstream R4 input disposition. Promotion/target-only ownership/cursor issues resolved within stated scope. |
| Mine multiplicity/count author guidance | `ses_eec780908ffeZeOvzGT0ah2tLD`, `ses_eec78096cffeMkpMxeH0Yz2wt6` | Read-only ordered occurrence/projection/removal law and one additive history entry/count constructor after Executor direction. Architect reports §9.1 resolves earlier R4-disposition HIGH at design level; this is not final paired clearance. |
| Multiplicity architecture/backend/security rereviews | `ses_eec78096cffeMkpMxeH0Yz2wt6`, `ses_eec780908ffeZeOvzGT0ah2tLD`, `ses_eec4b5c3dffeuiVNlh9BpgideH` | Each returned **READY FOR EXECUTOR PAIRED DESIGN DECISION: yes** for the multiplicity revision; read-only text/source, no execution. These verdicts precede the newly recorded delayed-swap carrier blocker and later disposition. |
| Multiplicity adversarial rereview | `ses_eec4b5d28ffeFSK3KuDIKfzBdv` | **READY FOR EXECUTOR PAIRED DESIGN DECISION: no / READY TO MERGE: no**. One HIGH: local delayed-swap mine filters retire identities that survive in final native `afterAll`. |
| Multiplicity spec rereview | `ses_eec7808f6ffed4yCzKVOuYK5fZ` | **READY FOR EXECUTOR PAIRED DESIGN DECISION: no**. One MEDIUM: undefined A4 death-reduction reference. Lead replaced it with existing phase propagation/current-observation pruning and aggregate economic loss constraints. |
| Final carrier-disposition paired rereviews | Pending | Settle the actual native result versus transient-carrier retirement law; review the exact corrected pair. |

All first-pass reviewers read source/content without tests, hashes or native execution. The lead revised replacement partition, opening mine uniqueness, prior-reference scope, private ordering, combined public own-ID order, supersession and lifecycle wording. Executor then selected native-fix and consumed-fact drafting directions. The lead replaced the rejected certificate/overlay law and its dependent carriers/bounds with §6.3 target-only proofs plus the paired guard proposal. Those revisions are not closing-review passes. Original NO verdicts remain intact.

### 10.1 First-pass findings and replacement disposition

**[Inference] The following counterexamples derive from inspected source and read-only reviews; no fixture/exploit has executed.**

| ID | Severity / origin | First-pass conflict | Proposed replacement / current disposition |
|---|---|---|---|
| R3-SEAM-01 | HIGH / architect | Held White gas promotion can recolor a paid Black replacement; frozen lineage/events encode no ownership transfer. | Executor selected native-fix drafting. Paired proposal adds only actual own-Marine/color eligibility at the write. Exact acceptance/build and closing review remain pending. |
| R3-SEAM-02 | HIGH / security | Mecha a1→h8 with hidden Hoverbike f5→d4 versus f5→d6 can produce identical successful captures but different overlay eligibility/public knowledge. | Target-only proof has no hidden-prefix occupancy gate. Re-review pending. |
| R3-SEAM-03 | HIGH / security + architect | Retired enemy siege membership can alter a virtual own Tank's step/mode/status and public coverage. | No overlay/certificate or mask-based publication gate. Normalize identical consumed target facts independent of step/mechanism. Re-review pending. |
| R3-SEAM-04 | HIGH / adversarial | Refreshing the query board after ordinary movement can disclose an unrelated Battleship h5→b5. | Publish query-derived target descriptor only, value-confirmed by successful native application; no unrelated cells. Re-review pending. |
| R3-SEAM-05 | HIGH / architect + spec | Global certificate had an undefined recipient and incomplete source/query association. | Acting side is exact native `query.side`; explicit branch-carried query, classical source and application binding; no global certificate. Re-review pending. |

Source anchors: [held promotion and B replacement](../../packages/starchess-core/src/resolve/submit-turn.ts) (`applyGasPromotion`, `heldExtraSteps` fallback, `placeUnit`); [probe patches](../../packages/starchess-core/src/board/vision.ts) (`pathRevealSteps`); [ordinary movement and deferred capture](../../packages/starchess-core/src/resolve/resolve-turn.ts) (`moveWave`, `applyPathRevealAttack`, `phase3`).

### 10.2 Mine-inventory finding and proposed disposition

**[Inference] Two read-only reviews found accepted native queues that create multiple same-side mines at one square. No fixture has executed.**

One source-derived fixture starts with White Hoverbike a3, own mine b5 and CC e1; Black CC e8. Append White F spiderMine from a3 BEFORE White C a3→b5. Admission checks original anchor a3. C lands on b5 without detonating the own mine. F rewrites its actual anchor to b5 and appends a second own mine; native count two remains within cap three.

Another appends C toward an enemy CC before F mine: intended C movement provides an append-time empty anchor, native C drops, and actual F anchor reverts onto an existing own mine.

Current native arrays retain both mines while V1 observation/planning retain unique square locations. Opening-only uniqueness cannot prevent this admitted result. The unresolved relationships are actual native mine count, live mine IDs/same-square ordering, `ownMineLineage`/audit state, retained unique `own.mines` locations and generator count/feasibility guards.

Executor selected **Support multiplicity** for drafting/review. §4.4 records every native mine occurrence, private order, actual removal and unique public locations. §9.2 transports actual live quantity into one additive history-entry generator while preserving V1 compatibility. No new native mine guard or deduplication rule is proposed. Closing review remains pending; direction selection is not acceptance of these exact additions.

### 10.3 Delayed-swap native carrier conflict

**[Inference] The latest adversarial source review found the following unexecuted counterexample.** White CC e1/sieged Tank a1/mine a1; Black CC e8/sieged Tank a8/mine a8; reciprocal C intents a1→a8 and a8→a1. Deferred approach application skips sieged origins. The delayed swap moves both units and triggers destination mines. It filters local `mines` but updates only `phase3.placement`; final `afterAll.mines` returns `phase3.mines`, retaining the original mines without an actual append.

Mandatory retirement for every local filter would therefore require resurrecting retired IDs at final reconciliation. Do not invent births or reuse IDs. Current §4.4's filter accounting requires an exact authoritative-carrier disposition before implementation.

Source: [delayed swap and final mine return](../../packages/starchess-core/src/resolve/resolve-turn.ts), native skip at `1119`, swap/filter at `1171–1201`, placement-only synchronization at `1213`, final mine carrier at `1285–1288`.

Available direction proposals: preserve returned native inventory and explicitly classify noncommitted working-carrier filters; separately propose a mine-carrier synchronization correction that changes returned native results; or declare the known path unsupported without full R3 readiness. No direction has been selected for this finding.

Executor selected two drafting directions, not exact acceptance: native promotion correction and consumed-discovery facts. Their current exact texts require closing review and the later design decision. The original unsafe overlay text was replaced; its first-pass negative verdicts and counterexample obligations remain recorded above. No unselected unsupported-case, ownership-schema or native-observation design became a runtime alternative.

No Executor acceptance of the proposed normative text has occurred. Earlier positive verdicts do not clear the delayed-swap carrier blocker or later revisions. After its direction and final paired positive reviews/document checks, present exact proposals for design acceptance and a separately explicit implementation grant before changing source.

Lead document checks of the preceding blocked-record revision returned PASS for `git diff --no-index --check /dev/null _spec/_plans/ml-adjutant-r3-seam-addendum.md`, `git diff --check`, and `git diff --cached --check`. They do not check this later target-only revision. Package tests and native reproductions did not run because the accepted scope was drafting/read-only review. Repeat document checks after subsequent edits.
