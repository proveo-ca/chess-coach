# ML Adjutant — R3 native-seam addendum

Status: **PROPOSAL / NOT APPROVED / NOT IMPLEMENTED.** Executor selected **“Review seam addendum (Recommended)”** after the read-only R3 architecture consultation. That selection authorizes drafting and review. It does not accept the proposed normative changes below. R3 implementation remains blocked on the exact seam decision. No collection, fitting, calibration, transfer, training, evidence publication or registry activation is authorized.

Authority: [original contracts](ml-adjutant-r3-contracts.md) §§3–7, [primary-owner migration](ml-adjutant-spec-file-migration.md), and [R3 roadmap](PLAN-ml-adjutant.md#immediate-ordered-next-actions--train-the-first-broader-adjutant). The original frozen contract, economic amendment, corrective annex and historical evidence remain unchanged. The sections below become effective only after an actual Executor acceptance of this addendum.

## 1. Exact proposed scope

| Section | Targeted clarification or amendment |
|---|---|
| §2 | Define the unchanged End companion signature as the post-Begin settlement seam, with the existing native `skipTurnStartChecks:true` invocation. |
| §3 | Permit named host-only companion exports through existing core `.`, while retaining the exact two-subpath export map and excluding the seam from model closures. |
| §§4–5 | Close the private record, identity issuance, source bindings, local references and digest bytes. |
| §6 | Separate speculative rule-evaluation probes from committed observation occurrences; narrow the original blanket path-image promise. |
| §7 | Define a total recipient event merge consistent with native causal execution and existing income boundaries. |
| §8 | Define bounded transactional publication and duplicate behavior. |

This proposal changes no native rule, normal native function signature/result, public event variant, public ID grammar, observation/history version, Configuration key, Versions key, generator, feature registry or policy horizon. Its private record refinements retain `engine-provenance-v1`. Its explicit path-authority narrowing is a proposed amendment, not a claim that the original text already supplied these rules.

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

`nativeResult` equals the complete reference result before normalization, serialization or projection. Equality includes array order, own-property presence, optional fields and every intermediate native result object. The recorder does not decorate, freeze or rewrite the native result. It detaches and freezes the private records separately. Native errors retain their original class/code/message. Provenance failures publish no companion or boundary. Core imports no arena modules.

The host enforces `initialize → begin → successful pair commit → end → begin → …`. Initialization requires an empty queue. Begin requires stage `before-begin`, native phase `P`, an empty queue and nonterminal `scOutcome`. End requires stage `after-begin`, phase `P`, the matching committed queue and matching bindings. A terminal opening receives initialization and the initial boundary only. A terminal Begin receives its scheduled turn-open boundary and no decision or End. Stages never authenticate a producer/session.

Source: [native options and checks](../../packages/starchess-core/src/resolve/submit-turn.ts), [existing host Begin/End order](../../packages/starchess-arena/src/challenge/runChallengeMatch.ts).

## 3. Host-only access through the existing root

Core's package export map stays exactly `{'.':'./src/index.ts','./planning-v1':'./src/planning-v1.ts'}`. Core `.` adds named runtime exports `initializeProvenance`, `beginTurnWithProvenance`, and `endTurnWithProvenance`.

The associated root type exports are exactly `EngineProvenance`, `EngineEntity`, `ActionBindings`, `ResolvedActionBinding`, `TrustedEffectFrame`, `VisibilityImage`, `VisibilityCheckpoint`, and `ProvenanceCompanion`. Query/certificate helper types stay implementation-private.

Here “private” means host-only and excluded from model dependency closure. This explicitly clarifies the original prohibition on a public host export. It grants no new host subpath, wildcard, cross-package relative/deep import or `/planning-v1` export. Arena host modules consume named core-root imports. Arena `/observations`, `/events`, training `/candidates` and future model entries cannot import/reexport the seam. Both public-closure and source-inventory audits reject runtime and type-only model edges to core `.` and private provenance implementations. Core remains browser-pure.

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
  resolvedActions:ResolvedActionBinding[0..8],
  lastCall:{queries:PathQueryRecord[0..4],discoveries:DiscoveryCertificate[0..2]}
}
```

Initialization requires a valid bounded native state: turn `0..45`, unique occupied squares, exactly one CC per side, gas/gasIncome `0..3` and at most three mines per side. Parser success alone does not establish these preconditions. Initialization sets `callOrdinal=0`, `initialTurn=turn`, and empty resolved/query/certificate arrays. It sets stage from `scOutcome`, not phase alone.

Each successful wrapper increments `callOrdinal` once and replaces `lastCall`. Begin clears resolved actions and emits no path query/certificate. Let `s=floor(callOrdinal/2)`:

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

Bind the primary effective actor at its actual native execution site: native B order/origin; C after B rewriting; F after native origin selection. A B-created C actor uses its explicit birth ID. A replacement at the execution origin uses the actual replacement ID. A skipped action or absent actor uses null. Fire-and-forget Charon can retain a source action with null actor. A fizzle after selecting a live actor retains that actor ID. These associations add no rules guard.

Every affected entity retains its own actual ID independently of the primary actor. `sourceActionSeq:null` means a native automatic effect without a queued source, never an unknown substitute for a known source. Later automatic effects use the native-established source association where one exists. Ambiguous actual identity/source fails infrastructure validation.

## 5. Trace structure, bytes and bounds

Frames retain the original exact fields `{sourceEffectKey,phase,before,after,effects,beforeVisibilityKey,afterVisibilityKey}`. Effects retain their original variants and `sourceActionSeq`; destruction adds the original causal visibility key. Frame phases remain unchanged.

Keys are `engine:call:<callOrdinal>:frame:<ordinal>` and `engine:call:<callOrdinal>:image:<ordinal>`. Per-kind ordinals are zero-based and contiguous. All references resolve locally. Frames follow actual semantic native commit order, including a C movement commit after deferred path application. They do not follow animation order or a sorted phase registry.

Apply each frame atomically by identity. Preserve simultaneous swaps and multi-removal. Validate occupancy after the frame, not after serial public events. Scratch-map copying and ghost cleanup produce no duplicate effect. Collision cues alone produce no movement effect. Creation/transformation initializes mode from native state without fabricating a toggle.

Split an actual birth and that entity's later death into distinct frames. The death's causal image contains the live created identity. A crush and replacement birth may share a frame because they involve different IDs. All victims in an atomic multi-removal use one common pre-effect image.

Every accepted deploy supplies one disposition. Actual creation supplies its ID even if it later dies. Native skipped/fizzled deployment supplies null. Terminal-C F skips emit disposition-only F frames at the actual skip branch; they execute no F action.

An ordinary frame contains an effect or disposition. A successful deferred application may use an equal-state zero-effect frame as a certificate anchor. At most two such extra frames exist. Probes and scratch synchronization create no frame.

For each frame, emit before-frame, any certified discovery cursors, then after-frame checkpoints. Before/after images equal the frame states. All causal checkpoints precede the destruction commit. Each emitted checkpoint has one image with the same contiguous ordinal. Equal states at different occurrences retain distinct local keys. Every image has a checkpoint; every frame and certificate key resolves locally.

### 5.1 Structural ceilings

| Per wrapper | Inclusive ceiling |
|---|---:|
| Classical plans | 2 |
| Path helper queries | 4 |
| Intermediate evaluations per query / total | 6 / 24 |
| Successful deferred applications | 2 |
| Certified discovery cursors per application / total | 6 / 12 |
| Actual unit creations / destructions | 2 / 66 |
| Committed unit moves / transforms / mode changes | 520 / 8 / 530 |
| Mine creations / removals | 6 / 12 |
| CC-life changes / deployment dispositions | 6 / 2 |
| Total effects | 1152 |
| Frames | 1154 |
| Before/after checkpoints | 2308 |
| All checkpoints / images | 2320 / 2320 |
| Entities per image | 70 |

Each of two native classical plans permits one memoized scan query and one reveal query. Rays have at most six intermediates. Begin has no path allowance. The movement envelope is `Q*(U+1)`; the mode envelope adds `Q+2`. These conservative structural envelopes grant no permission to add records. Actual records/counts must equal native reexecution. A query patch, observation cursor and synchronization count as no identity effect.

### 5.2 Canonical digest

The companion keeps its exact five fields. Digest input stays exactly `{provenance,frames,visibilityImages,visibilityCheckpoints}`. Query diagnostics and certificates enter through `provenance.lastCall`. Add no root field, self-hash, Versions key or profile-B persistence codec.

Canonical JSON sorts object keys and preserves array order. Integers have canonical finite JSON values. Encode UTF-8 without BOM, whitespace, LF or undefined. Require exact raw-byte re-encoding equality. SHA-256 covers these physical bytes externally. The host compares its independently reexecuted `{byteLength,sha256}`; native results and public batches still receive separate comparisons.

Retain the 16,777,216-byte private host/completion cap. Check raw length and nested cardinalities before declared allocations. Overflow aborts without dropping records. These structural bounds do not certify measured memory/runtime or full-cap serialization feasibility.

## 6. Visibility authority and exact causal images

### 6.1 Occurrence classes

| Class | Carrier | Recipient projection |
|---|---|---|
| Evaluation probe | Compact `lastCall.queries` | Never. |
| Committed state | Frame before/after images | Apply recipient vision. |
| Committed discovery | Certified application cursor images | Apply recipient vision. |
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
  consumption:'not-deferred'|'deferred-skipped'|
              'applied-certified'|'applied-uncertified'
}
```

Query ordinal is its array index. Record actual resolver-owned `pathRevealSteps` invocations only. Memoized scan reuse creates no second query. Helpers that never execute intermediate evaluations have an empty evaluated prefix. Standalone helper use outside the trusted wrapper grants no observation authority.

Capture the exact query placement-source state with native-carried IDs. It can precede later committed mutations. At evaluated step `j`, require `mid=rayBetween(from,to)[j]`. Replay the native computational patch: remove the base actor from `from`, remove any base occupant at `mid` computationally, then place the same actor ID at `mid`. The displaced occupant remains fully recoverable in `base`; it does not die, move or retire. This virtual board never becomes a committed `FrameImage` or visibility image.

`evaluatedSteps` equals the actual visited prefix. A nonnull return equals its final length and final true result; earlier results are false. A null return contains all actual intermediate evaluations with false results. Native current source returns no zero step. Capture before testing native return; do not rerun or extend helpers for audit.

The mode mask uses canonical squares `a1,…,h8`; index `i` occupies bit `7-(i%8)` of byte `floor(i/8)`. Encode eight bytes as 16 lowercase hex characters. Capture all native-carrier square memberships, including empty/non-Tank squares that a virtual Tank can occupy. Do not invoke an arbitrary mode callback 64 extra times. This seam supports the native-owned set/default only. Default mode requires zero mask. Absent mines require an empty list; supplied mines preserve actual array order and per-side cap. Query overrides can be stale computational inputs, not live ledger facts.

Consumption records the final native disposition. `not-deferred` supplied no deferred approach. `deferred-skipped` supplied an approach that skipped or returned `fired:false`. Applied statuses require `fired:true` and exactly one matching certificate. Other statuses have no certificate.

### 6.3 Discovery certificate and chronology

```text
DiscoveryCertificate={
  queryOrdinal:Int[0,3],operation:'capture'|'cc-shot',frameKey:FrameKey,
  actorEntityId:UnitId,targetEntityId:UnitId,landing:Square,
  visionInputs:CapturedVisionInputs,status:'certified'|'uncertified',
  cursorImageKeys:ImageKey[0..6]
}
```

A certificate exists only for an actually successful deferred application. It records the actual selected actor/target IDs and native landing: capture target or CC `stopAt`. Its vision inputs use the actual live preoperation context and mines, never the query's stale overrides.

Certify exactly when all these predicates hold:

1. The associated query returned positive step `m`.
2. Actual actor and target equal their query-base identities.
3. Actual preoperation positions/types satisfy the successful operation's native association.
4. The first `m` queried intermediates form a prefix of the native route to landing.
5. Every cursor square is unit-empty in the actual live preoperation board.
6. Recomputed actual-context recipient vision at the final cursor lights or reveals the actual target.

Validate the whole certificate before admitting any cursor. A certified certificate names exactly `m` images in prefix order. An uncertified certificate names none. Missing/ambiguous actual identity aborts; an ordinary false certificate predicate does not alter or abort native execution.

Insert certified cursor occurrences between the actual frame-before checkpoint and its semantic commit, after native application establishes success. Construct each cursor independently from the same authoritative frame-before state by relocating the actual actor only in the observation overlay. Preserve the live target, other entities, CC lives and current mines. Evaluate mode at the overlay square using the actual-context mask.

Cursor overlays advance no turn, planning ordinal, resource, ID counter or committed identity. Emit no `unit-move` or mode toggle for a cursor. Apply actual native movement from the actual origin, not discovery. Add no artificial return-to-origin observation. Use `point:'path-visibility'` and the application frame key. Phases follow actual native execution, not query evaluation order.

For certified capture, the final cursor image is the victim's causal image. If certification fails, use the actual native frame-before image with no discovery-derived authority. This expressly narrows the original unconditional intermediate-image promise. The native outcome remains identical. Missing visibility proof suppresses only the enemy-loss witness; own confirmed accounting still follows actual destruction.

### 6.4 Native causal cases

| Operation | Causal pre-destruction image |
|---|---|
| C attack wave | One common live pre-wave image containing every wave victim, vision source and pre-wave mine. |
| Certified deferred capture | Final certified discovery cursor with mover at discovery and actual victim alive at target. |
| Uncertified executed deferred capture | Actual native pre-mutation image. |
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

Consume checkpoints in execution order. Emit a nonempty public cell delta at before-frame and certified path checkpoints. Immediately before an after-frame checkpoint emit its authorized effects, then that checkpoint's nonempty cell delta. Frames do not overlap. After-frame order equals frame order.

Inside a frame emit: own-unit blocks by recipient-public ID; own-mine blocks by recipient-public ID; own CC-life changes in native causal order; unmaterialized deployments by accepted-action ordinal; witnessed enemy losses by canonical `(square,type)` order. Preserve native causal order within an identity block. Allocate own creation IDs in actual creation order before this presentation sort. A materialized disposition closes via `own-unit-created`; add no public disposition variant. Deduplicate actual enemy destruction lifecycles privately. Never sort public witnesses by hidden IDs.

Every delta contains changed canonical-square-ordered cells only. Compare with the same recipient's previous accepted projection. Fold transient-inclusive memory/`everLit` through the original reducer. Piece-only reveals do not add `everLit`. Remove empty deltas and unauthorized effects before assigning contiguous recipient seq. Private keys/counts never enter DTOs or public allocation.

After effects/checkpoints, grant hosted income exactly once per completed settlement using the existing `grantStoredIncome(committedBank,nativeResult.next.turn)`. Emit one `own-income` equal to `afterGrant[side]-committedBank[side]`, including zero, as the final event. Terminal settlement keeps this existing grant. Initial and turn-open, including terminal Begin, grant no income.

Fold final snapshot cells through the same observation reducer without inventing another event. Reconcile modes/resources, mines, entities, receipts, CC lives and exact paid conservation before publication.

## 8. Transaction and replay

Stage the native companion, resource facts, private→public identity maps, recipient counters, events, ledger/mine/vision state, snapshot/history and canonical bytes together. Whole-pair commit permits staging, not partial public publication. Commit the successor only after full validation and required host verification. Failures preserve previous public state/counters and private diagnostics; they publish no partial history or learning return.

The last canonical batch is idempotent only when bytes and SHA-256 both match. Return its already-checked state; reissue no IDs, callbacks, receipts, income or seq advancement. A conflicting last duplicate fails. An older nonlast ordinal fails sequence validation. Identical pure wrapper inputs produce the same output without ambient counters.

Trusted session binding remains outside DTOs. A structurally identical batch from another episode fails that binding. Keep public caps 2048 events, 64 changes/witness and 1MiB/batch. Overflow aborts without dropping knowledge.

Lifetime host audit ceilings under `W=64`: own receipts `≤W`; retired own unit IDs `≤U+W`; own mine creations `≤G*W`; retired mine IDs `≤M+G*W`; enemy witnessed units `≤U+W`; memory/everLit `≤U`; live own mines `≤M`. These bounds add no public keys.

## 9. Required implementation verification

No fixture, test file or passing result is claimed here. The proposed persisted tests are:

| Proposed test filepath | Independent purpose |
|---|---|
| `packages/starchess-core/src/__tests__/provenance.test.ts` | Full traced/untraced native equality; turn-45/terminal chips; private counters; births/deaths; atomic swaps/collisions; B/C/F actor/source association; skipped F disposition. |
| `packages/starchess-core/src/__tests__/provenanceQueries.test.ts` | Actual helper prefix/memoization; 4/24/2/12 ceilings; captured mode/mine epochs; certificate predicates; correct causal images and no speculative/ghost observations. |
| `packages/starchess-arena/src/__tests__/challengeObservationV2.test.ts` | Closed schemas, canonical bounded bytes, detached copies and exact V1 preservation. |
| `packages/starchess-arena/src/__tests__/challengeEconomicLedger.test.ts` | Exact paid conservation, transactional identities/mines/vision, wrong/gapped/conflicting batches and idempotence. |
| `packages/starchess-arena/src/__tests__/challengeBoundariesV2.test.ts` | Exact initial/open/settled schedule, total merge, debit/receipt disposition, capped zero income and parent reexecution. |
| `packages/starchess-arena/src/__tests__/challengeProvenancePrivacy.test.ts` | Hidden-state/probe/private-counter twins, no mode/mines epoch mixing, forged images/certificates/bindings and model-closure exclusion. |

Required counterexamples include adjacent-ally virtual overwrite; stationary siege probe; discovery square occupied after ordinary movement; failed/superseded path application; dead C-wave vision source; stale `afterMove`; collision before mine arrival; create-then-mine-death versus unmaterialized F. They are source-derived fixture obligations, not executed exploit results.

Implementation checks include all three package typechecks, strict test-file typechecking, core/arena/training suites, exact public-closure checks and affected inventory/isolation regressions. Preserve immutable R2 evidence and its checks. A new assurance generation requires its own namespace/authorization. Local R3 tests do not close aggregate R5 readiness.

## 10. Review and decision ledger

| Review | Task | Scope / disposition |
|---|---|---|
| Architect consultation | `ses_eec78096cffeMkpMxeH0Yz2wt6` | Read-only author guidance for wrapper, root access, private records, digest, merge and bounds; not an independent final verdict. |
| Backend consultation | `ses_eec780908ffeZeOvzGT0ah2tLD` | Read-only source-derived probe/commit distinction and causal-image proposal; no tests or native execution. |
| Adversarial review | Pending | Persisted addendum and cited source; no implementation claim. |
| Security review | Pending | Probe authorization, private identity/digest, hidden-input channels and trust boundary. |
| Spec review | Pending | Frozen-body preservation, exact supersession and stage/lifecycle accuracy. |

No Executor acceptance of the proposed normative text has occurred. No reviewer pass, implementation, calibrated readiness or operation permission follows from this draft. After positive reviews and lead document checks, present the exact addendum for the seam decision before implementing R3.
