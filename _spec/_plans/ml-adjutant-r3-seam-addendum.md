# ML Adjutant — R3 native-seam addendum

Status: **REVIEW-BLOCKED PROPOSAL / NOT APPROVED / NOT IMPLEMENTED.** Executor selected **“Review seam addendum (Recommended)”** after the read-only R3 architecture consultation. That selection authorizes drafting and review. It does not accept the proposed normative changes below. Architecture, adversarial, security and spec first passes returned **READY FOR EXECUTOR SEAM DECISION: no**. Discovery authority and an unrepresentable native ownership transition require direction before another closing review. R3 implementation remains blocked. No collection, fitting, calibration, transfer, training, evidence publication or registry activation is authorized.

Authority: [original contracts](ml-adjutant-r3-contracts.md) §§3–7, [primary-owner migration](ml-adjutant-spec-file-migration.md), and [R3 roadmap](PLAN-ml-adjutant.md#immediate-ordered-next-actions--train-the-first-broader-adjutant). The original frozen contract, [economic amendment](ml-adjutant-r4-economic-amendment.md), [corrective annex](ml-adjutant-r4-economic-corrective-annex.md) and historical evidence remain unchanged. This blocked revision cannot become effective by acceptance of its current text. A corrected revision requires positive closing reviews and actual exact-text Executor acceptance. Design acceptance alone does not authorize implementation; a later decision can grant both only if it names both grants.

## 1. Exact proposed scope

| Section | Targeted clarification or amendment |
|---|---|
| §2 | Define the unchanged End companion signature as the post-Begin settlement seam, with the existing native `skipTurnStartChecks:true` invocation. |
| §3 | Permit named host-only companion exports through existing core `.`, while retaining the exact two-subpath export map and excluding the seam from model closures. |
| §§4–5 | Close the private record, identity issuance, source bindings, local references and digest bytes. |
| §6 | Separate speculative rule-evaluation probes from committed observation occurrences; narrow the original blanket path-image promise. |
| §7 | Define a total recipient event merge consistent with native causal execution and existing income boundaries. |
| §8 | Define bounded transactional publication and duplicate behavior. |

This proposal changes no native rule, normal native function signature/result, public event variant, public ID grammar, observation/history version, Configuration key, Versions key, generator, feature registry or policy horizon. Its private record refinements retain `engine-provenance-v1`. The reviewed discovery proposal both removes some original checkpoint coverage and introduces reconstructed live-context overlay authority. It is not merely a narrowing. Review rejected that authority; §6.3 awaits replacement rather than acceptance.

### 1.1 Explicit proposed supersession map

| Frozen rule | Proposed replacement | Unchanged remainder |
|---|---|---|
| [Contracts §3](ml-adjutant-r3-contracts.md#3-package-ownership-exports-and-dependency-closure), prohibition on a public host export | §3 enumerates companion names on existing host-only core `.`. This is a scoped export amendment. | No host subpath, deep import, wildcard, model reexport or Node core dependency. |
| [Contracts §5](ml-adjutant-r3-contracts.md#5-native-causal-provenance--profiles-abc), companion End invocation | §2 fixes the comparison to the existing post-Begin native End with `skipTurnStartChecks:true`. | Normal native APIs/results and original companion input keys. |
| §5, entity table/counter and unspecified private allocation | §§4–5 close private state, IDs, bindings, ordering and local keys. | No private keys become policy inputs; parent reexecution supplies authority. |
| §5, creation then death within a frame | §5 requires atomic replacement birth/crush, followed by a distinct actual newborn-death frame. | Actual creation remains necessary; no birth inferred from payment. |
| §5, actual path images and blanket checkpoint coverage | §§5–6 distinguish nonprojectable evaluated probes from committed occurrences. §6.3's reconstructed discovery proposal is review-blocked and has no accepted replacement. | No animation-derived witness; native output parity; complete actual identity accounting. |
| [Contracts §6](ml-adjutant-r3-contracts.md#6-public-boundaries-ids-snapshot-and-event-union), intermediate causal-image and transient-history authority | §6.3 proposed refreshed cursor authority and omitted uncertified cursors. Review rejected it. The required replacement remains an open design decision. | Actual enemy destruction plus authorized causal visibility; no CC/mine/fog-disappearance unit witness. |
| §6, canonical own-ID order inside an atomic frame | §7 retains combined own unit/mine ID order and fixes placement of vision, CC, dispositions, enemy witnesses and income. | Native causal suborder per identity; seq assigned after authorization. |
| [Contracts §7](ml-adjutant-r3-contracts.md#7-receipt-ledger-conservation-and-transactional-reconciliation), transactional replay/session rules | §8 makes last-byte-identical replay/no-reissue and older-nonlast rejection explicit. | No session/producer authentication from JSON; conservation and atomic history advancement. |

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

Initialization requires a valid bounded native state: turn `0..45`, unique occupied squares, exactly one CC per side, gas/gasIncome `0..3`, at most three mines per side and unique mine squares within each side. Opposing mines may share a square where native rules allow it. Duplicate same-side mine locations fail seam preflight; they cannot receive unique frozen opening IDs. This does not change native parsing or promise support for every native-parsed snapshot. Initialization sets `callOrdinal=0`, `initialTurn=turn`, and empty resolved/query/certificate arrays. It sets stage from `scOutcome`, not phase alone.

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

Every affected entity retains its own actual ID independently of the primary actor. `sourceActionSeq:null` means a native automatic effect without a queued source, never an unknown substitute for a known source. Later automatic effects use the native-established source association where one exists. Ambiguous actual identity/source fails infrastructure validation. Return `resolvedActions` in the original contiguous source-sequence order after collecting execution-site associations.

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

The native side-changing promotion identified in §10.1 has no frame representation under the frozen effect/event union. The table does not silently classify it as a valid same-side transform or provenance ambiguity. Its disposition remains a blocking decision.

Every accepted deploy supplies one disposition. Actual creation supplies its ID even if it later dies. Native skipped/fizzled deployment supplies null. Terminal-C F skips emit disposition-only F frames at the actual skip branch; they execute no F action.

An ordinary frame contains an effect or disposition. A successful deferred application may use an equal-state zero-effect frame as a certificate anchor. At most two such extra frames exist. Probes and scratch synchronization create no frame.

For each frame, emit before-frame, any certified discovery cursors, then after-frame checkpoints. Before/after images equal the frame states. All causal checkpoints precede the destruction commit. Each emitted checkpoint has one image with the same contiguous ordinal. Equal states at different occurrences retain distinct local keys. Every image has a checkpoint; every frame and certificate key resolves within the corresponding output companion.

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

### 6.3 Reviewed discovery certificate proposal — BLOCKED

The following records the reviewed proposal, not an acceptable normative replacement. Architecture found an undefined certification viewer and a mode/image mismatch. Adversarial/security review found refreshed-overlay knowledge expansion and hidden-state eligibility channels. The proposed cursor coverage also changes memory/`everLit`, not only casualty witnesses. §10.1 records the blocking counterexamples. Do not implement, accept or describe this subsection as ready until a replacement resolves those findings.

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
| `packages/starchess-core/src/__tests__/provenanceQueries.test.ts` | Actual helper prefix/memoization; 4/24/2/12 ceilings; captured mode/mine epochs; certificate predicates; correct causal images and no speculative/ghost observations. |
| `packages/starchess-arena/src/__tests__/challengeObservationV2.test.ts` | Closed schemas, canonical bounded bytes, detached copies and exact V1 preservation. |
| `packages/starchess-arena/src/__tests__/challengeEconomicLedger.test.ts` | Exact paid conservation, transactional identities/mines/vision, wrong/gapped/conflicting batches and idempotence. |
| `packages/starchess-arena/src/__tests__/challengeBoundariesV2.test.ts` | Exact initial/open/settled schedule, total merge, debit/receipt disposition, capped zero income and parent reexecution. |
| `packages/starchess-arena/src/__tests__/challengeProvenancePrivacy.test.ts` | Hidden cursor-occupancy and retired enemy-mode twins; refreshed-board disclosure; probe/private-counter twins; no mode/mines epoch mixing; forged images/certificates/bindings and model-closure exclusion. |

Required counterexamples include adjacent-ally virtual overwrite; stationary siege probe; discovery square occupied after ordinary movement; failed/superseded path application; dead C-wave vision source; stale `afterMove`; collision before mine arrival; create-then-mine-death versus unmaterialized F. They are source-derived fixture obligations, not executed exploit results.

Implementation checks include all three package typechecks, strict test-file typechecking, core/arena/training suites, exact public-closure checks and affected inventory/isolation regressions. Preserve immutable R2 evidence and its checks. A new assurance generation requires its own namespace/authorization. Local R3 tests do not close aggregate R5 readiness.

## 10. Review and decision ledger

| Review | Task | Scope / disposition |
|---|---|---|
| Architect consultation | `ses_eec78096cffeMkpMxeH0Yz2wt6` | Read-only author guidance for wrapper, root access, private records, digest, merge and bounds; not an independent final verdict. |
| Backend consultation | `ses_eec780908ffeZeOvzGT0ah2tLD` | Read-only source-derived probe/commit distinction and causal-image proposal; no tests or native execution. |
| Architecture first pass | `ses_eec78096cffeMkpMxeH0Yz2wt6` | **READY FOR EXECUTOR SEAM DECISION: no**. Four HIGH: native ownership change, cursor mode representation, certificate viewer/mapping and optional frame partition. Author consultation is not a closing clearance. |
| Adversarial first pass | `ses_eec4b5d28ffeFSK3KuDIKfzBdv` | **READY FOR EXECUTOR SEAM DECISION: no / READY TO MERGE: no**. Four HIGH: optional replacement partition, reusable prior-reference scope, duplicate opening mine locations and refreshed discovery authority. Two MEDIUM: lost transient knowledge coverage and own-ID ordering. |
| Security first pass | `ses_eec4b5c3dffeuiVNlh9BpgideH` | **READY FOR EXECUTOR SEAM DECISION: no**. Two HIGH: hidden-occupancy eligibility channel and synthetic/stale-mode discovery authority. |
| Spec first pass | `ses_eec7808f6ffed4yCzKVOuYK5fZ` | **SPEC STATUS: blocked / READY FOR EXECUTOR SEAM DECISION: no**. Two HIGH: exact supersession map and undefined certification viewer. Two MEDIUM: private array/key ordering and missing closing architecture gate. |
| Closing architecture/adversarial/security/spec rereviews | Pending | Resolve the substantive decisions, replace §6.3, and rereview the exact revision. |

All first-pass reviewers read source/content without tests, hashes or native execution. The lead revised replacement partition, opening mine uniqueness, prior-reference validation scope, private array/key order, combined public own-ID order, supersession mapping and lifecycle wording. Those revisions are not closing-review passes. Original NO verdicts remain intact.

### 10.1 Unresolved substantive findings

**[Inference] The following counterexamples derive from inspected source and read-only reviews; no fixture/exploit has executed.**

| ID | Severity / origin | Concrete conflict | Required decision |
|---|---|---|---|
| R3-SEAM-01 | HIGH / architect | White B held stim `e7→e8` plus C `e7→f8`; Black B deploy from CC `f7→e8` crushes White's mover and creates a paid Black Marine. Held fallback later calls White's promotion helper on the live Black replacement. `applyGasPromotion` writes White type/color without checking the replaced actor's side. Frozen `unit-transform` and authorized lineage/receipt variants encode no ownership transfer. | Separately review a native-fix proposal; or define an explicit unsupported-case boundary without full R3 readiness; or amend ownership/ledger schemas. Do not fabricate birth/death, relabel the transition ambiguous or silently change native behavior. |
| R3-SEAM-02 | HIGH / security | White Mecha `a1→h8` against Marine `h8`; Black Hoverbike `f5→d4` versus `f5→d6`. Native deferred capture succeeds in both, but the hidden occupancy of a prefix square controls whether §6.3 emits discovery deltas/witnesses. Original/final recipient observations can match. | Replace hidden-state-conditioned full-board overlay authorization with an exact noninterfering discovery rule or an explicitly approved committed-image-only scope. |
| R3-SEAM-03 | HIGH / security + architect | A crushed enemy siege Tank can leave a square mask consumed by a virtual own Tank. Keeping the mask transfers enemy mode into overlay vision; normalizing it can make certificate success reveal the hidden mode. The proposed overlay's unit mode can also disagree with the mask used to certify it. | Specify one representable authorized discovery context; do not treat stale square-mode computation or its certificate result as recipient knowledge. |
| R3-SEAM-04 | HIGH / adversarial | Native queries precede ordinary movement. Rebuilding their cursor from later live state can disclose a Battleship that moved `h5→b5`, which neither the original probe nor the actual origin/final vision observed. | Do not call refreshed overlay authority merely a narrowing. Review an exact consumed-fact or committed-observation replacement. |
| R3-SEAM-05 | HIGH / architect + spec | One global private certificate uses undefined “recipient” vision and lacks exact query/application association constraints. | A replacement must identify its acting viewer, source action, unique native consumed query, frame and recomputed status. No recipient-dependent private global status. |

Source anchors: [held promotion and B replacement](../../packages/starchess-core/src/resolve/submit-turn.ts) (`applyGasPromotion`, `heldExtraSteps` fallback, `placeUnit`); [probe patches](../../packages/starchess-core/src/board/vision.ts) (`pathRevealSteps`); [ordinary movement and deferred capture](../../packages/starchess-core/src/resolve/resolve-turn.ts) (`moveWave`, `applyPathRevealAttack`, `phase3`).

The ownership and visibility directions are independent choices. A narrowly authorized consumed-discovery-fact design, a committed-image-only design, or a separately amended native observation seam all require exact-text review before acceptance. Native-fix, unsupported-case and ownership-schema directions also require explicit scope. Current proposed records/ceilings may require revision after those choices.

No Executor acceptance of the proposed normative text has occurred. No reviewer pass, implementation, calibrated readiness or operation permission follows from this draft. Ask for direction on the unresolved findings, not acceptance of the review-blocked text. After a corrected revision receives positive closing reviews and lead document checks, present its exact seam decision before implementing R3.
