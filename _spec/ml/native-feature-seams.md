# F1 — native feature seams: accepted contracts and reasoning

**2026-10-18 · BOUNDED F1 PUBLISHED8d908d4c96641403f6161f118458ca66f2305a04 · d389 v4 PASS:29 COMMANDS / RUST343 / NODE189 / CORE668 · ALL3 READY/NO FINDINGS · NODE LOW RESOLVED · trainingReady:false · SEPARATE F2 GOALS ACTIVE.**

The [PR plan](../_plans/native-feature-seams.md) owns acceptance, file ownership, verification matrix and gate order.
This document persists the complete accepted freeze and final work/private-seed addendum from architect `ses_eb7c5d187ffenpvgElk95FZ8ut`, including the latest compatible memory/witness clarifications, reread in full from the lead-persisted file:
`/tmp/proveo-opencode-runtime-cache-1000-21d690750d3738af14d58c25/tmp/opencode/f1-implementation-freeze.md`.
No unresolved TUI remains. Accepted F1 contracts/signatures/fee goals are unchanged. The Node prerequisite guard fix has now passed the **entire post-guard d389 v4 gate**, including its actual builtin capability probe. This four-Markdown evidence update reads the present receipt/stdout; keeper runs no verification and edits no source/config/tests/PUML/index or review verdict.

## 1. Scope, published prerequisite and preservation

The completed ledger base b47befd021bef04eea0bfe20a9308a71aa20f09f/preserved user4990d951 preceded F1. The lead now actually committed/pushed F1 as **8d908d4c96641403f6161f118458ca66f2305a04**,29 files,parent b47, non-force origin push, with post-push HEAD/remote equality and clean status at that checkpoint. Separate F2 goals now follow this completed bounded F1 publication, not new F2 source/proof.
The [bounded ledger base](native-economic-ledger.md) retains its v3/native-economic-ledger receipt,258d identity,29 PASS commands/301 Rust/175 Node/668 core and ALL3 READY/no findings/HIGH-4 RESOLVED. Those are **ledger evidence, not F1 evidence**; later F1 source changes require a new v4 scope/run.

F1 delivers structural checked inputs/ordered innovations, standalone **unwired** native geometry helpers, and an exact418 **metadata** registry/manifest. It delivers no populated encoder, belief/PMF/support/frontier model, learner, collector/permits, calibration/fitting, container/image work, genuine native authority, runtime closure or readiness promotion.
Preserve native engine/legacy production sources and exports, Configuration26/Versions21, frozen370+48 meanings/scales/masks/formulas, D+B/native labels, WDL/terminal-closeout invariants, dependencies, corpus/evidence/pins, and external frozen history/graph/status files.
Broader Training-ready authority permits later separately scoped work, not policy training/activation/deployment and not expansion of this F1 slice.
Source carries instructions/WHAT labels/directives and existing pointers; the why and failure rules live here.

## 2. Checked feature-input boundary

Reuse existing `Side::{White,Black}`, `Square`, `UnitType`, `TankMode`, `AuthorizedView`, `EconomicBoundary`, shared `Pair`, `LedgerRules`, `LedgerWork`, `BoundaryPhase`, `LastSeenAssertion` and ledger `ContractResult`; do not fork their grammar/types.
Consume the **current revised explicit** `UnitBorn.mode` / `UnitTransformed.toMode` contract. There is no default, unresolved mode, old economic decoder or inference compatibility path.

<a id="21-exact-planned-rust-public-surface"></a>
### 2.1 Exact Rust public surface — source present

```rust
pub const FEATURE_INPUT_VERSION: &str = "native-feature-input-v1";
pub struct FeatureInputPair { /* private checked LedgerPair + latest innovation pair */ }
#[derive(Clone, Copy, Debug, PartialEq, Eq)]
pub enum AdvanceDisposition { Advanced, Replayed }
#[derive(Clone, Copy, Debug, PartialEq, Eq)]
pub struct OwnUnitId(/* private u32 */);
#[derive(Clone, Copy, Debug, PartialEq, Eq)]
pub struct OwnMineId(/* private u32 */);
pub struct FeatureOwnUnit {
    pub id: OwnUnitId, pub square: Square, pub kind: UnitType,
    pub mode: Option<TankMode>, pub paid_basis: u32,
}
pub struct FeatureOwnMine { pub id: OwnMineId, pub square: Square, pub slot: u32 }
#[derive(Clone, Copy, Debug, PartialEq, Eq)]
pub struct BoundaryStamp {
    pub ordinal: u32, pub phase: BoundaryPhase, pub turn: u32,
    pub planning_ordinal: u32, pub grant_ordinal: u32, pub seq_through: u32,
}
pub struct FeatureGrant {
    pub grant_ordinal: u32, pub settled_turn: u32,
    pub entitlement: u32, pub credited: u32,
}
pub struct BoundaryInnovation {
    pub values: [u32;3], pub bins: [u8;3],
    pub marine_anchors: [bool;64], pub own_geometry: [bool;64],
    pub grant: Option<FeatureGrant>,
}
pub struct FeatureInput {
    pub version: &'static str, pub stamp: BoundaryStamp, pub view: AuthorizedView,
    pub own_units: Vec<FeatureOwnUnit>, pub own_mines: Vec<FeatureOwnMine>,
    pub memory: [Option<LastSeenAssertion>;64], pub ever_lit: [bool;64],
    pub own_paid_destroyed: u64, pub own_paid_wasted: u64,
    pub enemy_replacement_loss_lower_bound: u64,
    pub innovation: BoundaryInnovation,
}
impl FeatureInputPair {
    pub fn initialize(rules: LedgerRules, initial: &Pair<EconomicBoundary>,
                      work: &mut LedgerWork) -> ContractResult<Self>;
    pub fn advance(&mut self, next: &Pair<EconomicBoundary>,
                   work: &mut LedgerWork) -> ContractResult<AdvanceDisposition>;
    pub fn input(&self, side: Side, work: &mut LedgerWork) -> ContractResult<FeatureInput>;
    pub fn last_boundaries(&self) -> &Pair<EconomicBoundary>;
    pub fn rules(&self) -> &LedgerRules;
}
```

The opaque u32 IDs have no public constructor/numeric conversion. Consumers use recipient-local equality, not global identity, native counters or capability tests; equality across unbound histories supplies no genuine join.
FeatureInput is detached data. Neither its public fields, report JSON nor a successfully checked FeatureInputPair authenticates native execution or creates a permit.
No new decoder/trait/session selector/RPC/worker or permit-shaped JSON belongs to this surface.

### 2.2 Retained state, replay and atomic publication

Own exactly one checked LedgerPair and the latest innovation pair, **no additional episode log**. Delegate rules, recipients, phase/sequence, conservation and full-byte replay validation to LedgerPair.
Stage the next checked ledger and BOTH innovation results before replacing retained state. Any failure preserves both prior recipients/latest innovations; failed work stays consumed.
An identical immediate current pair returns **charged Replayed**, preserving the latest innovation **including its existing grant**, without recomputing/replacing it or consuming income again. Do not replace replayed values with zeros or the grant with None. Conflicting current bytes return IDENTITY; old/gap/reordered inputs use the existing ledger errors, not a new permissive history policy.
Initial input establishes checked memory/lineage with innovation values zero and grant None.
Readout copies are detached/precharged. Keep established rook modes, canonical unit order and mine occurrences; no source inference or report serializer recreates them.
Unchanged bounds:2048 groups/entries,64 cells/change-set,≤64 own units,≤3 own mines and1-MiB boundary bytes.

## 3. Ordered boundary innovations

Replay checked groups in their **original order**, then reconcile final cells/memory against the staged checked extraction. Final observations cannot replace causal order or double-count assertions already represented by groups.

| Output | Exact rule |
|---|---|
| Y1=`values[0]` |Replacement sum of distinct new typed enemy assertions; deduplicate `(square,type,observationTurn)`, seeded from prior memory. A continuously visible unchanged occupant is not new solely because time advanced. |
| Y2=`values[1]` |Sum each NEW checked enemy-destruction-witnessed **FACT ENTRY**. Clear matching square/type memory at that entry **before** later vision deltas. Count even identical square/type entries in one Effects group separately: use group plus fact-array position, never LedgerPosition alone, square/type or group deduplication. |
| Y3=`values[2]` |Count distinct remembered squares actually observed as lit:null while memory exists. Casualty clearing itself adds no Y3. |
| Y1/Y2 bins |0 /1–3 /4–8 /≥9 map to bin0/1/2/3. |
| Y3 bins |0 /1 /≥2 map to bin0/1/2. |
| marine_anchors |New transient Marine assertions, not merely final surviving assertions. |
| own_geometry |Union authorized OWN nonCC/mine squares from prior/current views, effect geometries/facts and vision changes. |
| grant |None initially/at turn-open; one checked settlement FeatureGrant, never duplicated on replay. |

Unknown retains memory; lit own/empty clears it; enemy assertion updates it. A casualty-before-empty order must not manufacture Y3 from memory already cleared, and later legitimate vision deltas must still be processed.
Always refresh final-snapshot memory to the boundary turn, even with no new Vision group and zero Y1. Unchanged visible or revealed→lit same-type continuity refreshes memory, **not new Y1**; final cells must not double-count represented assertions.
The fixed assertion bitmap covers prior/current boundary turns, whose checked transition has delta≤1. Seed bits only for memory timestamps **inside** that window; older stale memory remains memory and must never become a negative/out-of-window bit index. No unbounded assertion-history set is needed.
Turn-open is **observation-only**: no economic transition/grant, movement-envelope propagation or births. Settlement exposes its checked grant exactly once.
There are no anonymous frontiers in F1 and therefore no frontier-erasure algorithm. Current shape/conservation checks cannot authenticate a forged causal witness; genuine later native authority must bind real evidence (§8).

## 4. Crate-private checked seed extraction

All extraction types/methods belong to existing `ledger/history.rs`. **History imports nothing from feature_input**; feature_input imports crate-private parts. This keeps dependency direction from the adapter toward the checked history it consumes.

```rust
pub(crate) struct LedgerFeatureUnit {
    pub(crate) id: u32, pub(crate) square: Square, pub(crate) kind: UnitType,
    pub(crate) mode: Option<TankMode>, pub(crate) paid_basis: u32,
}
pub(crate) struct LedgerFeatureMine {
    pub(crate) id: u32, pub(crate) occurrence: MineOccurrence,
}
pub(crate) struct LedgerFeatureParts {
    pub(crate) view: AuthorizedView,
    pub(crate) units: Vec<LedgerFeatureUnit>, pub(crate) mines: Vec<LedgerFeatureMine>,
    pub(crate) memory: [Option<LastSeenAssertion>;64], pub(crate) ever_lit: [bool;64],
    pub(crate) own_paid_destroyed: u64, pub(crate) own_paid_wasted: u64,
    pub(crate) enemy_replacement_loss_lower_bound: u64,
}
impl LedgerPair {
    pub(crate) fn feature_parts(&self, side: Side, work: &mut LedgerWork)
        -> ContractResult<LedgerFeatureParts>;
}
```

Copy only the selected checked SideState/current matching boundary. Do not call reports()/paid_totals convenience paths, serialize reports, or copy historical loss/receipt/type-history DTOs just to seed an adapter; those extra scans/copies do not implement the narrow fee profile.
Cells appear exactly once in view.cells64. Active ledger units can be retained unsorted: sort the **detached copied** units≤64 file-major, never reorder retained ledger state. Memory64/everLit64 remain bounded.
Mines≤3 use existing checked mine_locators ordering `(square,id)` and canonical occurrence slots. Removal may renumber a survivor's slot while its opaque ID remains the same; derive the ID from checked entity identity, **not the slot**.
Compute checked u64 totals directly: own_paid_destroyed sums loss.unit.paid; own_paid_wasted sums minerals of **Wasted** deployment dispositions only; enemy_replacement_loss_lower_bound sums rules.non_cc_replacement(witness.kind). Preserve native-derived values, not a copied rule table or exact enemy payment claim. Established rook modes are Some; never infer/default them.
Return detached parts without another retained log. Wrap raw IDs into opaque vectors and **move** view/memory/everLit into the public adapter without an additional clone.
LastSeenAssertion is the exact existing type with `square,kind,color,last_observed_turn`; no field is dropped and no private native identity/authority field is added.

## 5. Exact Rust work schedule — native-feature-seams-work-v1

Every Rust operation uses the **same caller `&mut LedgerWork`**. No constructor/reset/new allowance; existing ledger fees remain additional/unchanged.
The inclusive1048576 allowance is per reconstructed window across **both recipients**, including adapters. Future full planning history/helpers/belief/features must share that same inclusive allowance; F1 establishes neither its complete adequacy nor D1 scalar-invoice/runtime closure.
Precharge before scans/allocation/initialization/copy/mutation, with checked-integer invoices. Failure preserves prior charges and both-seat state atomicity; rollback is not a refund.

| Added operation | Exact prepaid units |
|---|---|
| Input initialize/advance entry |128 |
| Selected checked seed extraction |128 + existing charge_snapshot(view) +16×64 cells +32×64 memory +1×64 everLit +192×(active units+mines) +32×(scanned losses+deployments+witnesses) |
| Existing mine_locators work |Separate existing charges; not waived by extraction invoice |
| Private→public opaque-ID vectors |128 +192×(active units+mines) |
| Innovation scratch, per recipient |128 +768 assertion bits +3×64 set bits |
| Group visit |8 |
| Effect fact processing |128 |
| Effect subject lookup initialization, each Effects group |16×64 |
| Before/after geometry element visit |16 |
| Vision/final-cell observation |100/cell |
| Final cell+memory reconciliation |32/square |
| Detached innovation readout |128 +3×64 |

Source and independent tests must substantiate actual conservative operations, not merely cite this table. Byte/canonical/history/validation charges already owed by the ledger stay additional.
Do not turn Node's standalone prepaid callback into a claim that a Rust↔Node meter/transport has been wired; no such transport is implemented in F1.

## 6. Standalone Node geometry — UNWIRED

Import only `packages/starchess-core/src/planning-v1.ts` and permitted local data definitions. No full-core root/private projector/legacy arena-training/FS/process imports, Rust trait, RPC, worker or existing closed-wire change.

<a id="61-exact-planned-helper-api"></a>
### 6.1 Exact helper API — source present, standalone UNWIRED

```ts
type GeometryCharge = (units: number) => void;
type Side = 'w'|'b';
type Unit = 'p'|'n'|'b'|'r'|'q'|'k';
type Spawn = Exclude<Unit,'k'>;
type Promotion = 'n'|'b'|'r'|'q';
type Timing = 'B'|'C'|'F';
type Kind = 'classical'|'deploy'|'stimStep'|'spiderMine'|
            'charonMissiles'|'siegeMode'|'tacticalJump';
declare const queueBrand: unique symbol;
export type FeatureQueue = Readonly<{[queueBrand]: true}>;
export function emptyFeatureQueue(side: Side, charge: GeometryCharge): FeatureQueue;
export function appendFeatureAction(
  queue: FeatureQueue, kind: Kind, timing: Timing, from: Square, to: Square|null,
  unit: Spawn|null, promotion: Promotion|null, charge: GeometryCharge
): FeatureQueue;
export function nativeOwnSchedule(queue: FeatureQueue, charge: GeometryCharge): Readonly<{
  bOrder: readonly number[];
  classical: Readonly<{
    index: number; rewrite: Readonly<{from: Square; to: Square}>|null
  }>|null;
}>;
export function nativeAttackShape(
  unit: Unit, side: Side, from: Square, to: Square, charge: GeometryCharge
): boolean;
export function nativeRay(from: Square, to: Square, charge: GeometryCharge): readonly Square[];
export function nativeUnitLit(
  unit: Unit, side: Side, source: Square, mode: 'tank'|'siege'|null,
  charge: GeometryCharge
): readonly Square[];
```

### 6.2 Ownership, delegation and prepaid work

Private captured-intrinsic WeakMap storage owns queue identities. Reject foreign/proxy/copied identity **before property inspection**; a structural brand alone is not runtime provenance.
Validate primitive side/square/grammar/nullable applicability,≤4 actions and≤1 C. Construct/freeze detached internal actions/results; this is structural geometry, not native legality/admission/candidate-membership proof.

| Operation | Native delegation and result boundary | Full prepaid units |
|---|---|---|
| Empty |Owned empty queue for validated side |128 |
| Append, resulting length n |Detached immutable result; no native admission |512+192n |
| Schedule, length n |orderBHeadsFirst +classicalRewriteCoordinatesAfterB, authored indices as seq;≤2 native calls |2048+256n² |
| Attack shape |attacksSquare with singleton attacker map;≤1 call, not isScMoveShape/pawn-forward movement and not occupancy/ray-clear proof |512 |
| Ray |Native ordering, endpoints excluded,≤6 squares;≤1 call |512 |
| Vision |Singleton unit/map, explicit rook tankModeFor/non-rook null; getUnitVision sets→sorted unique canonical litSquares≤64, ignore revealedPieces;≤1 call |8192 |

Rust's later projection will own F-actor association/conditional occupancy; F1 does not implement that future layer.
The trusted charge callback receives the full fixed invoice **before construction/native calls**. Callback refusal performs none of the covered operation; no helper-local allowance, renewal or decision-dependent cache/table exists.
Invalid primitives raise FeatureGeometryError('BAD_INPUT'); foreign identity raises 'PROVENANCE'. Native exceptions propagate, with no fallback/rescue or synthetic result.
Exact-charge/refusal-before-native tests must check these boundaries, not infer them from successful helper outputs.

## 7. Exact418 metadata registry — NOT an encoder

<a id="71-exact-planned-rust-metadata-surface"></a>
### 7.1 Exact Rust metadata surface — source present

```rust
pub const FEATURE_MANIFEST_VERSION: &str = "challenge-feature-manifest-v3";
pub const HISTORICAL_DIMENSION: usize = 370;
pub const FEATURE_DIMENSION: usize = 418;
pub struct FeatureDescriptor {
    pub index: usize, pub name: &'static str,
    pub meaning_id: &'static str, pub scale_id: &'static str,
}
pub fn feature_registry_v3() -> &'static [FeatureDescriptor;418];
pub fn feature_manifest_v3(work: &mut LedgerWork) -> ContractResult<FeatureManifestV3>;
pub fn validate_manifest_v3(value: &FeatureManifestV3, work: &mut LedgerWork)
    -> ContractResult<()>;
pub struct FeatureManifestV3 {
    pub version: String, pub dimension: usize, pub names: Vec<String>,
    pub entries: Vec<ManifestEntry>, pub scales: FeatureScales,
}
pub struct ManifestEntry { pub name: String, pub meaning_id: String, pub scale_id: String }
pub struct FeatureScales {
    pub minerals: u32, pub gas: u32, pub turn: u32, pub cc_lives: u32,
    pub max_spawn: u32, pub paid: u32, pub replacement: u32,
    pub coords: u32, pub squares: u32, pub actions: u32, pub pairs: u32,
    pub relation_pairs: u32, pub vision_overlap: u32, pub files: u32,
}
```

Manifest has **exactly five fields**: version,dimension,names,entries,scales. Each entry is exactly name,meaningId,scaleId; serialize camelCase if serialization is provided.
No Deserialize, production codec, formula/mask/value field, dtype/domain metadata or arbitrary extension belongs to this new manifest. Tests may inspect fixtures without creating another production decoder.
Output Strings/Vecs are detached, never shared mutable output. Registry accessor is static/allocation-free, not proof of any computed feature value/mask/formula.

| Scale key | Frozen value | Scale key | Frozen value |
|---|---|---|---|
| minerals |12 |gas |3 |
| turn |45 |ccLives |3 |
| maxSpawn |9 |paid |3072 |
| replacement |2304 |coords |7 |
| squares |64 |actions |4 |
| pairs |6 |relationPairs |4096 |
| visionOverlap |256 |files |8 |

### 7.2 Full coordinate/meaning expansion

| Block | Exact index/order | Name / meaning |
|---|---|---|
| Queue34 |j=0..33 |`queue.<orderedName>`, `q:j` |
| Four Position84 blocks |34+84i+k, i=0..3,k=0..83 |`position.<i>.<orderedName>`, `p:k` |
| Economic12 |370+j,j=0..11 |`economic.<orderedName>`, `e:j` |
| Promotion36 |382+6k+3c+h−1; k=0..5,c=0..1,h=1..3 |`promotion.<kernel>.<channel>.h<h>`, `promo:k:c:h`, scaleId files |

Promotion kernel order is exposure,blockerAdded,blockerRemoved,attackCoverAdded,attackCoverRemoved,visionAdded; channels witnessed,unlocated; horizons1,2,3.
Preserve **all original0..369 names/meanings/scales**, including position `promotion.p`; that metadata coordinate does not make p a promotion generator option. Native generator options remain n,b,r,q.
The trusted ordered normative source is frozen [contracts §§10,15](../_plans/ml-adjutant-r3-contracts.md) plus [economic amendment §§7–8](../_plans/ml-adjutant-r4-economic-amendment.md). Queue/position expansion orders and every scaleId come from those tables, not caller prose or a locally convenient registry.
Composite scale IDs remain fixed pipeline labels; the14 numeric scales are not an extensible formula language. F1 does not compute historical370/economic12/promotion36 values, masks or formulas or claim their parity.

### 7.3 Two separate required oracles

1. **Actual legacy production readout, test-only.** Existing `apps/arena/engine/test/feature-manifest-legacy.mjs` directly imports the exported arrow functions from production source and calls `featureManifestV3(createStartupArtifactContext())`:

```ts
import { featureManifestV3 } from '../../../../packages/starchess-training/src/feature/manifest.ts';
import { createStartupArtifactContext } from '../../../../packages/starchess-training/src/economic/ownedKernel.ts';
const manifest = featureManifestV3(createStartupArtifactContext());
```

Those exports were read in their actual source; do not invent a missing package `/features` export, invoke an absent convenience API, or import `.test.ts` helpers as an oracle. This dependency is test-only; no F1 production import from protected legacy arena/training is allowed. Structural startup context is **not genuine runtime authority**.

2. **Independent Rust normative expansion.** Actual `packages/training/tests/feature_manifest.rs` expands the ordered contract tables/meaning/scale rules from the two frozen documents, independently of production Rust registry constants. Comparing the implementation to expected values derived from itself is not this oracle.

Both must match all418 entries/names/scales and existing `packages/training/tests/fixtures/feature-manifest-v3.json`; persisted tests assert full agreement and supplied leaves are GREEN. A normative-versus-legacy mismatch remains **STOP/escalate**, not permission to silently select an oracle or rewrite protected semantics/exports.
This establishes metadata alignment only; successful fixture comparison proves no encoder value/mask/formula or private authority.

### 7.4 Exact manifest invoices and allocation discipline

Use **trusted compile-time expected bytes only**:

```text
D = 418
V = expected version UTF8 length
S = V + sum_i(2*expectedName[i].len
              + expectedMeaning[i].len + expectedScaleId[i].len)
```

S includes both independently owned name copies. Rust string lengths here count UTF8 bytes; never scan caller strings to derive an invoice.
Engineering units are base/control128, bounded lane32, allocation192, string copy/initialization4 per byte and byte comparison2 per byte.

| Operation | Exact invoice / ordering |
|---|---|
| BUILD |1673 String allocations+2 Vec allocations; reserve the ENTIRE `128+192*1675+32*(5+14+418+418)+4*S = 349088+4*S` before any allocation/copy. Construct directly; no implicit validation. |
| VALIDATE root |Precharge288 before root metadata; check dimension/vector lengths/version-byte-length through bounded constant metadata accesses. |
| VALIDATE version |Precharge2V before version bytes. |
| VALIDATE scales |Precharge14×32 before typed scale comparison. |
| VALIDATE each418 lane |Precharge160 before bounded lane/four string-length checks. Wrong lengths fail **before byte scans**; then precharge2×combined expected four string lengths before equal-length comparisons. |
| Successful VALIDATE total |`67616+2*S`, incremental prepaid steps, not clone/build/serialization. |

Validation is zero-copy: no clone/concat/format/caller-sized iteration, scanning a huge mismatching string before its length gate, or copying offending caller strings into errors.
Wrong version/dimension returns UNSUPPORTED; wrong counts/names/meanings/scales IDENTITY; insufficient work BUDGET. Errors remain fixed/bounded; charges already spent remain spent, with no refund/new meter.
Independent tests calculate expected invoices from trusted normative expected bytes and verify exact-cap success and one-below refusal, not only a production constant against itself.

## 8. Future native authority and private labels — DOCUMENT ONLY

Structurally checked data is **not NativeVerified authority**. F1 cannot authenticate a forged causal witness or obtain genuine source truth merely from report JSON, public constructors, opaque ID equality or a startup context.
Later private coordination must separately bind:

```text
genuine accepted permit
 <-> actual native session/context
 <-> exact boundary bytes + recipient
 <-> expected estimator/manifest/authority references
 <-> generated candidate batch
```

Those native joins/permit issuance are explicitly **UNIMPLEMENTED** in F1; no serialized readiness flag or fake capability fills them. Configuration26/Versions21/frozen-model fields remain unchanged.
Private native execution's actual source/destination D,B and s,c,w,g,d may flow to later fitting/verification **only**, not authorized model input or public feature history.
Birth versus paid waste/free promotion/type-at-loss requires actual causal lineage, not final-board differences or a label guessed from type. Terminal training closeout **never changes frozen native D+B truth labels**.
No private-label codec/module/version/exported constructor, production label implementation or collector/permit API is added here.

<a id="9-planned-files-tests-and-verification-scope"></a>
## 9. Actual files, supplied execution and required whole verification

The [ownership table](../_plans/native-feature-seams.md#3-planned-ownership--not-a-landed-file-inventory) now records actual source handoffs. `src/lib.rs` exports both new modules; history owns the narrow crate-private seed definitions/extractor and imports no feature_input code. Root integration owns lib/Oxlint/xtask; no reverse dependency or source edit is introduced by this spec sync.
Required controls are the [persisted test matrix](../_plans/native-feature-seams.md#5-persisted-verification-matrix--all-not-run): ordered transient/casualty/memory/grants/replay/both-seat rollback, established modes/mine IDs, detached output/same-meter failures/hidden twins; native geometry grammar/ownership/delegation/call bounds/prepaid refusal; exact418 independent expansion/legacy readout/scales/mutations/oversized strings/independent invoices.
Explicit new input assertions must cover two identical square/type witness **fact entries in one group** counted twice by Y2, stale memory outside the bitmap, revealed→lit continuity, unchanged final-snapshot timestamp refresh/Y1 zero, same opaque mine ID after slot reassignment, second-seat **adapter** failure rollback and exhaustion before adapter allocation. Replay must retain the previous innovation/grant unchanged.
Existing ledger_history transient/memory/casualty/mine/replay/rollback/budget/explicit-mode controls are independent behavior references, not a substitute for these F1 assertions or F1 execution proof. Backend compatibility advice found no memory-law/normative fork.
The actual feature-input fixture is explicitly **hand-authored structural** and exercises two identical witness fact entries/transient vision, not an actual native execution fixture. Its origin label is asserted by tests. Neither fixture data nor metadata alignment wires genuine native authority.
Existing ledger/core/native-policy controls stay unfiltered and intact. No fixture-generated dimension check substitutes for full coordinate equality, and no fresh leaf replaces the whole gate.

The actual current complete post-guard receipt is **`rust-training-verification-v4` / `native-feature-seams`**, PASS at matching d389 (§9.2). Shared version/scope constants remain in **both normal and initialization-failure receipt paths**, with the five notEstablished scopes; future real readiness verification remains separate/unimplemented.
Retain all29 existing command checks, unfiltered old/new Rust/Node/core targets, required old targets plus **new nonempty feature_input/feature_manifest and Node controls**, dependency/legacy/evidence/index preservation, both owner syntax/bounded SVG, whitespace and matching content-derived before/after identity.
Required Rust-target detection matches the **exact full source-path token** (`split_whitespace().next()`), not startsWith, basename coincidence, substring or lookalike. Current post-guard whole verification executed all required new/retained targets nonempty/unfiltered; persisted controls reject missing/zero/lookalike targets and binary-name/summary cardinality mismatch.

The source identity REQUIRED list now explicitly includes these **ten actual new F1 inputs**; existing history/lib/xtask/config inputs remain covered in addition:

```text
packages/training/src/feature_input.rs
packages/training/src/feature_manifest.rs
packages/training/tests/feature_input.rs
packages/training/tests/feature_manifest.rs
packages/training/tests/fixtures/feature-input-boundaries.json
packages/training/tests/fixtures/feature-manifest-v3.json
apps/arena/engine/feature-geometry.ts
apps/arena/engine/test/feature-geometry.test.ts
apps/arena/engine/test/feature-manifest-legacy.mjs
apps/arena/engine/test/feature-manifest.test.ts
```

The test-only MJS legacy reader stays outside tsgo's input graph; **bounded Node/tsx runtime tests and lint included it** in the current complete post-guard PASS. Actual child settings remain PATH-only environment,10-second timeout/1-MiB maxBuffer, zero exit/no signal, strictly empty stderr, bounded nonempty single JSON stdout. No directory-wide legacy-import exception or protected package export/dependency change is introduced.
Actual `oxlint.training.json` restricts only feature-geometry.ts with caseSensitive:true and the wildcard group `**` /`!@chess-coach/starchess-core/planning-v1`, also denying the full core root. Existing overrides remain intact. A persisted xtask test copies the **actual config** to the same relative module path and runs the pinned linter across15 allowed/rejected module cases, including deep core/case variants/legacy/private/host/prefixed+bare builtins/arbitrary packages; this is not a textual regex-only assertion.
Normal and initialization-failure receipt paths share the actual v4/scope constants and exact notEstablished strings: `full-training-closure`, `genuine-native-authority`, `whole-decision-adequacy`, `calibration`, `training-readiness`. The actual current receipt carries exactly those five entries; a Node test-capability check establishes no native-runtime or learning authority.
After the guard change, the lead repeated the **entire** v4 gate at d389, followed by ALL3 fresh final read-only reviews now **DONE/READY**, findings NONE and Node LOW explicitly RESOLVED. No old ledger/bc238 approval substitutes. Any later source/config/test/index/diagram change requires another full repeat before rereview; final metadata checks still precede authorized F1 publication.

<a id="91-current-supplied-leaves-and-bounded-corrections"></a>
<a id="91-implemented-controls-within-the-current-complete-proof"></a>
### 9.1 Implemented structural controls — unchanged by the harness fix

F1 source handoffs/lib/metadata/geometry/oracle/private-seed integration remain implemented. The Node guard fix passed current complete d389 verification, including unfiltered xtask32; DevOps explicitly resolved the LOW in its current final READY review. No F1 source bytes changed after PASS.
Manifest controls independently assert all418 metadata coordinates, S25864/BUILD452544/VALIDATE119344 and1675 successful build allocations. Allocation capture uses **test-only System/GlobalAlloc**, not a production allocator or process-capacity proof; the registry remains a compile-time static array. Opaque IDs remain equality-only recipient data, not native capabilities.
Persisted controls retain final snapshot refresh with is_delta:false/no second Y1, actual-config case-sensitive import refusal, and the PATH-only bounded legacy reader without ignoring stderr/warnings. Native delegate instrumentation remains test-only, checking full prepayment/call ceilings/refusal before covered construction/native calls and exception propagation.
These controls, even with a complete passing run, do not authenticate native source permits, compute feature values or establish decision/runtime/learning readiness.

<a id="92-current-complete-unchanged-input-v4-gate--pass"></a>
<a id="92-current-node-prerequisite-fix-and-complete-revalidation-pending"></a>
### 9.2 Current complete post-guard v4 gate — PASS

**DevOps LOW explicitly RESOLVED** after the complete post-guard gate and current final rereview. Native-delegate instrumentation uses node:module.registerHooks; the narrow guard tests actual capability instead of major-only Node22 acceptance. No runtime/API/fee/pin/frozen configuration or helper-loader change occurred. All current approvals bind d389, not the earlier pre-guard bc238 revision.

Actual xtask source retains **version-node as ONE of the same29 commands** and probes the builtin module rather than inferring availability from a minor version:

```text
{version:process.version,
 registerHooks:typeof nodeModule.registerHooks === 'function'}
```

It requires **exactly two fields**, a string version whose parsed Node major≥22 and registerHooks:Boolean true; Node22/23 without the capability STOP in preflight. Actual current [version-node.stdout](/tmp/proveo-opencode-runtime-cache-1000-21d690750d3738af14d58c25/tmp/opencode/rust-training-55914-1792300517664274865-0/version-node.stdout) was read:

```json
{"version":"v22.23.2","registerHooks":true}
```

The actual builtin-eval guard job PASS is one of29, not a separate added command or only a leaf. Capability/shape positive and negative unit cases also ran within current unfiltered xtask32.

Actual lead **sh_14d6f87e8001Uf3N35ImwhceeJ DONE/PASS** produced the [PRESENT current receipt.json](/tmp/proveo-opencode-runtime-cache-1000-21d690750d3738af14d58c25/tmp/opencode/rust-training-55914-1792300517664274865-0/receipt.json), read for this update. Version/scope: `rust-training-verification-v4` / `native-feature-seams`; status PASS, reviewEligible:true, error:null, identityError:null. All29 results PASS/exit0/reaped, with no work/cleanup timeout, signal or cleanup/reap failure.

```text
inputSha256 == inputSha256After ==
d389d0141fc2deb8c83d012dd8aca7d8f65161ebebe45dd7b512c54e3ad39528
```

| Current complete-run scope | Actual PASS count |
|---|---|
| Rust workspace/all targets |343 =arena106 +training205 +xtask32 across20 binaries |
| Node engine |189, including geometry/native-delegate controls and actual legacy metadata readout |
| Native core |668 |

| Required target filepath | Current nonempty count | Purpose; subset of totals |
|---|---|---|
| `packages/training/tests/feature_input.rs` |29 |Ordered structural innovations/memory/grants, private seed/opaque IDs, replay/atomic rollback/precharge |
| `packages/training/tests/feature_manifest.rs` |11 |Independent418 metadata expansion/oracle/detached outputs/length gates/exact work and allocations |
| `packages/training/tests/ledger_contracts.rs` /`ledger_history.rs` |42 /49 |Retained strict economic facts/explicit modes/accounting/lineage/conservation/history |
| `apps/arena/tests/economic_replay.rs` /`readiness.rs` |9 /4 |Retained native economic/closeout correspondence and scoped CLI/readiness negatives |

All required targets ran nonempty/unfiltered; totals are this one unchanged-input post-guard invoice, not stitched leaves or earlier bc238/ledger runs. All static/types/lint/fmt/all-targets check/Clippy-Dwarnings/build/selected CPU dependencies/locks/protected tracked+untracked preservation **before and after**, index36/59+other43 preservation, both PUML syntax/bounded SVG and receipt-time whitespace PASS.
The exact five notEstablished values remain `full-training-closure`, `genuine-native-authority`, `whole-decision-adequacy`, `calibration`, `training-readiness`. Root manifests/locks/native/legacy corpus/evidence/pins, goals/APIs/fees/data-copy/oracle semantics and private-label DOCUMENT ONLY scope are unchanged; actual runtime/authority/learner/readiness closure is still unestablished.
F1 source/config/tests/PUML/index stayed source-bound to d389 through actual publication8d908d4c; the29-path review capture/cached-whitespace checkpoint belongs to that completed delivery. Note/navigation checks remain separate preflight, never extra29 commands. Later F2 goal edits do not extend this bounded F1 proof or create a new execution/hash claim.

<a id="93-current-f1-closing-and-capture"></a>
### 9.3 Current F1 closing and capture

The complete post-guard d389 v4 PASS was followed by **ALL3 actual current final read-only reviews READY, findings NONE**. Node LOW is explicitly RESOLVED; no review blocker remains. These are current d389 approvals, not borrowed bc238 dispositions.

| Reviewer/session | Actual current F1 status |
|---|---|
| Adversarial `ses_eb7cb724effe5uE3Hebn2Gb0wF` |DONE **`READY TO MERGE:yes`**, findings NONE; current guard/new receipt/actual Node capability probe inspected. |
| Security `ses_eb7cb7218ffePBBBS1MqCmBCtM` |DONE **`READY TO MERGE:yes`**, findings NONE; full29 scope complete/reconciled with prior review plus guard/README delta. Current d389 receipt/logs/Node22.23.2/true inspected; constant builtin probe accepts no caller code/module path and missing capability stops preflight. Read-only, no independent gate rerun/edit. |
| DevOps `ses_eb7cb7206ffe1XrslbW4r6OyGq` |DONE **`READY TO MERGE:yes`**, findings NONE; previous LOW **explicitly RESOLVED**, citing lib115–119/341–360, tests387–403 and tooling README9–10. Current updated29 scope/d389 receipt+logs/29/343/189/668/matching identity/actual registerHooks:true inspected; five notEstablished scopes retained, no independent gate rerun/edit. |

Optional real-runtime capability-matrix hardening is non-blocking and **not executed proof**. These bounded F1 approvals establish no genuine authority/full encoder/learner/resource/calibration/training readiness beyond the fixed five notEstablished boundaries.

All29 F1 paths, including the latest guard/documentation changes, were restaged and passed cached whitespace; the lead supplied this fresh full capture upfront to all current reviewers, based on published b47. These artifact identities are lead-supplied, not hashes generated here:

| Current post-guard capture | Supplied identity |
|---|---|
| `/tmp/proveo-opencode-runtime-cache-1000-21d690750d3738af14d58c25/tmp/opencode/f1-node-guard-review-Z3mqNM/head.diff` |357012 bytes; SHA256 `e426b251f525e188e399f331a778b556731644692d6299948fba1cc26ddd3401` |
| Same directory `changed-paths.txt` |29 paths; SHA256 `c52453657ddaf7c1cbdd50c10fb01110f85665e19441a44fa8c184864128013b` |
| Base HEAD |b47befd021bef04eea0bfe20a9308a71aa20f09f |

The fully reviewed d389 F1 scope is now **PUBLISHED**: lead commit **8d908d4c96641403f6161f118458ca66f2305a04**,29 files,parent b47, successful non-force origin pushb47→8d908d4c, actual post-push HEAD/remote match and clean checkpoint. **Bounded F1 verification/review/publication are COMPLETE**, ALL3 READY/LOW resolved; no publication hold remains. Later F2 goals are not claimed in that commit without a future actual commit, and trainingReady:false is unchanged.

## 10. Current coverage, notes and handoff boundary

The existing training owner covers**36**, arena**59**, including the actual `oxlint.training.json` guard, with45 entries/other43/unrelated metadata/unresolved list unchanged. Their complete preservation/syntax/bounded SVG checks PASS in current d389 verification. This pass edits **no covers, index entry or PUML**.
Both owners now show actual F1 library-only inputs/private seeds/shared work/static metadata, and standalone UNWIRED Node helpers/test-only legacy reader/config guard. No new owner diagram or runtime/CLI/live-policy/native-permission/RPC edge is created. Stable status headers point to Markdown rather than embedding a gate result that would force a post-gate diagram change.
**Notes/FK:** all22 existing bodies and retained scores remain unchanged, with no new/reworked note. Current syntax/SVG/index proof belongs to the actual complete d389 gate; note/navigation box/preservation checks remain separate preflight, not extra29 commands.
This update owns only the two F1 Markdown documents and shared navigation prefixes, changing current status and the test prerequisite clarification. It runs no commands/tests/hash/render/Git/agents/reviews/progress polls. PLAN suffix4+ and README first2/suffix6+ stay untouched by prefix-only patches; keeper makes no source/config/test/diagram/index edit.
F1 publication8d908d4c/current d389 proof/ALL3 READY/LOW resolution are DONE. Next assigned slice is the separate [F2 math PR goals](../_plans/native-learner-math.md)/[contract and resource boundaries](native-learner-math.md), persisted before implementation; F2 source/test/v5 gate remain PLANNED/NOT RUN. F1 proof is not F2 verification, and trainingReady:false remains unchanged. No source/PUML/index or verified F1 contract changes in this publication-status sync.
