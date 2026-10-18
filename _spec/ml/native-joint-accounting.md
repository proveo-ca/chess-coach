# F6 — canonical shared-buffer raw joint accounting: accepted contract

**2026-10-18 · BOUNDED F6 VERIFICATION/REVIEW COMPLETE ·7bc9 v9 PASS:29 COMMANDS / RUST478 / NODE189 / CORE668 · ALL3 CURRENT FINAL F6 REVIEWS READY, FINDINGS NONE · PUBLICATION AUTHORIZED, NOT EXECUTED · trainingReady:false.**

The [PR plan](../_plans/native-joint-accounting.md) owns authorship, acceptance/oracles and gate order. Both accepted external architect documents were read FULLY:
- `/tmp/proveo-opencode-runtime-cache-1000-21d690750d3738af14d58c25/tmp/opencode/f6-joint-accounting-freeze.md` (80 lines).
- `/tmp/proveo-opencode-runtime-cache-1000-21d690750d3738af14d58c25/tmp/opencode/f6-joint-accounting-addendum.md` (67 lines).

Architect `ses_eb7c5d187ffenpvgElk95FZ8ut` selected canonical A3/F5 arithmetic, **NO new arithmetic-order amendment/TUI required**. Static advisories/handoffs/source/root reads preceded freeze; math/API/fees/caps/count-N and contributor order remain unchanged, grouped float unauthorized. The [existing training owner](../packages/training/burn-compat.puml) documents structure; [current complete v9 proof](#current-f6-evidence) plus ALL3 final READY/no findings establish actual bounded same-input F6 verification/review, not stitched leaves/F5 approval. This evidence-only update changes no source/config/tests/index/PUML or normative contract; publication remains authorized but unexecuted.

## 1. Actual prerequisite and component boundary

Lead committed/NON-FORCE pushed **723e4066618aea7cc9818920b35b1e6e2c79a8cd**, `feat(training): add qualified numerical transition tables`,16 files,parent59e1eff1a10072b6594fff3a65e2e6b3b5ff7a24. Actual post-push full HEAD/remote matched723e and tree was CLEAN **at that checkpoint**, before F6 edits. Before commit,464-input source joined3c1a; whole v8/29 PASS commands/447 Rust/189 Node/668 core/ALL3 fresh READY/NONE/exact16/nav/preservation/whitespace/cached checks passed. [F5 proof](native-transition-tables.md#current-f5-evidence) remains bounded numerical tables/sourceTerms, not F6/full estimator/readiness; earlier59e1/29018157/bf4d/8d/b47/user4990 remain preserved.
F6 connects F4 NumericJoint and F5 NumericTransitions to ONE all-source RAW accounting aggregate with independent Boolean accounting reachability and buffers allocated ONCE. It is a material prior→all-source accounting component, **not** a complete estimator/evidence/default likelihood1.
Mandatory later pipeline: **all sources→loss/current-board restrictions→QUALIFIED evidence likelihood→ONE global normalization→reband/readout**. This API STOPS BEFORE likelihood/global normalization; it adds no reband/readout or implicit neutral evidence. No genuine publicSupport/native truth/observational/recipient/grant chronology/artifact/calibration/permit authority follows from supplied numerical inputs or checked types.
Preserve F3/F4, public F5 build/select/source_terms results/count BITS/order/invoices, frozen contracts/Configuration26/Versions21/native/legacy/model/Node/deps/locks/pins/labels/corpus/data/evidence. No new fixture/artifact codec/native protocol/empirical label producer or policy-training/activation/deployment grant.

<a id="2-exact-planned-public-api"></a>
## 2. Exact implemented public API

Reuse F4 NumericJoint, F5 NumericTransitions/NumericSourceContext, F3 NumericGrant and caller LedgerWork/LedgerError.

```rust
#[derive(Clone, Copy, Debug)]
pub struct NumericAccountingStep {
    pub context: NumericSourceContext,
    pub grant: NumericGrant,
    pub witnessed_loss: u16,
    pub destination_lower: u16,
    pub destination_upper: u16,
}
pub struct RawJointAccounting {
    /* private exactly7501 masses/Boolean cells/finite positive cached retained mass */
}
impl RawJointAccounting {
    pub fn masses(&self) -> &[f64];
    pub fn accounting_cells(&self) -> &[bool];
    pub fn retained_mass(&self) -> f64;
}
#[derive(Debug, PartialEq, Eq)]
pub enum JointAccountingError {
    Domain, NonFinite, Underflow, EmptySupport, EmptyMass,
    Table(TableError), Work(LedgerError),
}
pub type JointAccountingResult<T> = Result<T, JointAccountingError>;
pub fn aggregate_accounting(
    prior: &NumericJoint, transitions: &NumericTransitions,
    step: &NumericAccountingStep, work: &mut LedgerWork,
) -> JointAccountingResult<RawJointAccounting>;
```

These seven error families distinguish invalid numeric domain/nonfinite/positive underflow/empty Boolean reachability/zero aggregate mass/delegated table/work failure. Actual private Vec buffers return only on success with finite positive cached retained_mass; borrowed readouts are O(1) and custom small Debug formats only retained mass, no hidden deep Clone/scan/normalization/serde/Float64Hex/EconomicBeliefState/authority field. No partial output escapes. RawJointAccounting is not an unchecked posterior/native support constructor.

<a id="3-exact-planned-crate-private-f5-bridge-and-ownership"></a>
## 3. Exact implemented crate-private F5 bridge and ownership

Author A completed the new aggregation file PLUS narrow existing `packages/training/src/transition_tables.rs` bridge/shared-M/private regressions sequentially. Author B completed ONLY new `packages/training/tests/joint_accounting.rs`; lead integrated lib/root. Existing F5 public API/schema/outputs/count BITS/invoices remain preserved, not redesigned. All actual files were read; no source is edited by this spec reconciliation.

```rust
pub(crate) struct NumericAccountingSource {
    checked: CheckedSource,
    context: NumericSourceContext,
}
pub(crate) struct PreparedNumericSource<'a> {
    terms: SourceTerms,
    source: NumericAccountingSource,
    table: &'a NumericTransitionTable,
    growth: &'a GrowthMetadata,
}
impl NumericTransitions {
    pub(crate) fn borrow_numeric_profile(
        &self, work: &mut LedgerWork,
    ) -> TableResult<&LedgerRules>;
    pub(crate) fn borrow_growth_minimums(
        &self, work: &mut LedgerWork,
    ) -> TableResult<&[u8;33]>;
    pub(crate) fn accounting_source(
        &self, point: AccountingPoint, context: &NumericSourceContext,
        work: &mut LedgerWork,
    ) -> TableResult<NumericAccountingSource>;
    pub(crate) fn prepare_aggregation_source<'a>(
        &'a self, point: AccountingPoint, context: &NumericSourceContext,
        work: &mut LedgerWork,
    ) -> TableResult<PreparedNumericSource<'a>>;
}
impl NumericAccountingSource {
    pub(crate) fn point(&self) -> AccountingPoint;
    pub(crate) fn opportunities(
        &self, spend: u8, created: u8, work: &mut LedgerWork,
    ) -> TableResult<usize>;
}
impl PreparedNumericSource<'_> {
    pub(crate) fn terms(&self) -> SourceTerms;
    pub(crate) fn accounting(&self) -> &NumericAccountingSource;
    pub(crate) fn rows(&self) -> &[NumericTransitionRow];
    pub(crate) fn row_feasible(
        &self, row_index: usize, work: &mut LedgerWork,
    ) -> TableResult<bool>;
}
```

ALL fields stay MODULE-PRIVATE, including in pub(crate) structs. Getters borrow/POD-copy ONLY, no scans/alloc/clone/qualification/validation or private GrowthMetadata exposure outside its module. This is a numerical internal handle, not a public raw-source capability/permission.
Positive preparation follows the LITERAL route: call existing PUBLIC source_terms ONCE→accounting_source paid repeated check→paid DIRECT index from returned terms.cohort→borrow that table/growth→construct handle. No second select/qualification/tuple-count/N scan. Own SourceTerms POD; borrow selected canonical rows/profile/growth immutable. row_feasible accepts an index into ONLY its own table, reuses EXISTING source_interval and selected-BBT band rule, and bills recalculation rather than copying an equation into F6.
Extract the old inline M expression VERBATIM into module-private `opportunities_prepaid(source: CheckedSource, context: &NumericSourceContext, spend: u8, created: u8) -> TableResult<usize>`, with NO internal work charge. Old tuple_count retains its old32 charge at the EXACT old position then calls this helper; it MUST NOT call the newly charged wrapper. New NumericAccountingSource.opportunities charges32, validates allowed branch labels/resources, then invokes the same helper. Preserve old public integer results/count/N order/charge boundaries with exact and one-below regressions.

## 4. Input/domain and numerical authority

Require valid NumericSourceContext/model turn/copied profile; Np≤V,Np≤64,L=witnessed_loss≤617 and0≤destination_lower≤destination_upper≤576. For EVERY true prior support cell require D≥V, including P=0: incompatible support returns Domain, never silently delete it. Reuse checked D0..576/B0..12/source-context constraints.
NumericJoint already has private checked7501 shape/normalized probabilities/supplied mask; do not renormalize/mutate it or infer native provenance. Visit/read every source lane under the paid8N scan; unsupported zero lanes may skip ONLY after that paid inspection. Supported zero PMFs remain part of independent Boolean accounting. Prior and table bytes/BITS remain unchanged on success or refusal.
Read gas/grant income from the SAME NumericTransitions object's owned copied profile, not another supplied rules object or native tier formula. A profile loan is not revalidation/native authentication. Pay global context/profile/input-turn gas/grant checks AND repeated per-source checks; global validation does not prepay each source. NumericGrant::None applies no credit; AtNativeTurn(t) checks owned-profile max_turn/table index and reads that income TABLE. It does NOT require t=input_turn+1 or authenticate native settlement chronology, a default grant or an inferred next turn.

## 5. Canonical shared-buffer raw algorithm

Allocate EXACTLY FOUR heaps ONCE: head f64[8034], BooleanHead bool[8034], sparse/final masses f64[7501], output bool[7501]. Dimensions are13×618/13×577. Reuse sparse storage as final output; no second output array/per-source7501 buffers or full F3 point-flow calls. Materialize sorted Γ lists ONCE from immutable F5 minimum-opportunity metadata into170 FIXED slots (165 growth slots+5 lengths), checking minimum[g]≤M. Prepay loans/init/reads/build, no hidden startup.
Visit sources in bank0..12 then D0..576 order. Each supported active source pays setup32. Positive P invokes prepare_aggregation_source once for existing UNCONDITIONED Z/N/Den/canonical selected rows. Supported P0 invokes ONLY accounting_source/opportunities: NO table qualification/rows/counts/Z/N/Den/model-dependent costs. Both paths contribute Boolean law; count changes cannot alter zero-PMF reachability or introduce model-dependent P0 path costs.
For a positive source compute background ONCE, before its branch traversal. For each allowed DISTINCT(s,c) in lexicographic order, s∈{0,1,3,5,9},s≤B,c∈{0,s},zero-spend c0 ONCE; the prepaid shared M helper supplies opportunities. Visit DISTINCT g∈sorted Γ_M in ascending order:

```text
positive-source setup ONCE:
  background = (.5*P) / Den
for each DISTINCT (s,c,g) in LEX order:
  J = D+c+g
  B' = B-s                                if grant=None
  B' = min(12, B-s+ownedIncome(t))           if AtNativeTurn(t)
  BooleanHead[B',J] = true
  if P>0: head[B',J] += SAME background     canonical source/branch order
```

The displayed background definition is computed once before reuse across that positive source's branches, not recalculated with a different association. No FMA/Kahan/pre-growth grouping/bucket totals/cancellation or implicit probability clipping. BooleanHead has no count/P dependence.
For EACH canonical selected row of a positive source, pay inspection64 and existing borrowed row_feasible reevaluation. Even source-infeasible/loss-filtered inspected rows stay billed; sourceTerms N/Den were computed BEFORE any L/destination conditioning. If source-feasible and d≥L:

```text
contribution = (P*C(row)) / Den             MULTIPLY FIRST, THEN DIVIDE
sparse[B',J-d] += contribution              canonical source/row order
```

After ALL sources, for each bank:

```text
suffix[bank,617] = head[bank,617]
for j = 616 down to 0:
  suffix[bank,j] = head[bank,j] + suffix[bank,j+1]
  BooleanSuffix[bank,j] = BooleanHead[bank,j] OR BooleanSuffix[bank,j+1]
```

Reuse head arrays in place. This exact A3 addition direction is a contract, not permission to reorder a reduction. Seed BooleanSuffix617 from BooleanHead617 analogously.
Traverse destination bank then D. Widen/check D+L (up to1193) BEFORE indexing: if>617 use zero/false; otherwise suffix lookup. Compute `mass=sparse[bank,D]+suffix[bank,D+L]` with that guard; derive Boolean accounting reachability independently and apply destination bounds to BOTH mask/mass. Accumulate retained mass in the same canonical bank/D order; never per-source normalize or add likelihood here.
Reject negative/nonfinite arithmetic, ACTUAL positive product/division underflow, positive mass outside Boolean reachability, empty aggregate mask or numeric-zero aggregate retained total. **Empty Boolean mask→EmptySupport; reachable but total mass0→EmptyMass; individual true Boolean cell with mass0 is ALLOWED**, including cells reached only from supported zero-PMF sources. Do not import F3 unit-point nonempty-numerical-zero rejection into each aggregate cell/source. No probability floor/pruning/certainty inference/partial output; prior/tables stay immutable.
Concrete single-fault cases: a positive source eliminated by L while a supported P0 source still reaches destinations gives **EmptyMass**, not Underflow; all sources eliminated with normal finite arithmetic gives **EmptySupport**. Underflow requires an EXECUTED positive product/division that erases to0. In a valid normalized prior with P=minsubnormal atD0/B0 (remaining mass elsewhere), V=Np0 and an empty table, (.5*P) erases0 and MUST refuse even though reassociating(.5/Den)*P could rescue it. Preserve multiply-then-divide, never rescue via reassociation. Do not assert error precedence for multiple independent invalidities; use isolated-error controls.

## 6. Exact engineering work — native-joint-accounting-work-v1

Caller SAME LedgerWork/inclusive1048576, no reset/refund/new allowance/exclusion/hidden startup/generator-work relocation/support truncation. Reserve each block BEFORE its covered work; prior/unused charged work stays spent. These are engineering blocks, not a D1 scalar/full-window/RSS admission proof.

| F6 block | Units |
|---|---:|
| Entry |128 |
| Parameter/profile/index block |32 each |
| Heap buffer allocation |192 each, EXACT4 |
| Buffer initialization |4/lane |
| Prior source scan |8/lane, ALL7501 |
| Γ fixed storage initialization |4×170=680 |
| Γ inspect/materialize |8×165=1320 |
| Active source setup |32 |
| Allowed(s,c) setup |32 via opportunities wrapper, NOT another duplicate32 |
| Distinct growth contribution |64; destination-bank/stock/index arithmetic included |
| Positive source background arithmetic |32 ONCE/source |
| Selected-row inspection/scatter |64 EVERY inspected row, INCLUDING infeasible/loss-filtered |
| Combined numerical/Boolean suffix |16/lane,8034 |
| Destination restriction/mass/bool/reduction |24/lane,7501 |
| F5 sourceTerms/row feasibility/metadata |Existing owed charges ADDITIONAL, never discounted |

```text
fixed F6 full-pass census =
  128 + 4*192 + 4*(2*8034+2*7501) + 8*7501
  + 16*8034 + 24*7501 + 4*170 + 8*165
  = 495752
```

495752 is NOT the whole F6 invoice. It excludes the additional step/profile/index/loan/source/branch/background/selected-row/F5-query work below. Domain/Work refusal may stop before later passes; no unperformed-work/PASS assumption or refund follows.

### 6.1 Exact bridge and global checks — additional charges

| Operation | Exact additional charge / rule |
|---|---|
| borrow_numeric_profile |32 before loan, no revalidation/native authentication |
| borrow_growth_minimums |32 ONCE before array loan, not an uncharged metadata getter |
| accounting_source |Existing checked_source32 +handle construction32 =64; NO qualification/rows/N/Z/Den |
| prepare_aggregation_source |EXISTING source_terms invoice +64 repeated source check/handle +32 DIRECT cohort index/loan +32 prepared handle = OLD+128 |
| Valid row_feasible |32 index access +existing interval128 +existing minimum lookup32 =192, even infeasible |
| Invalid row index |32 before error, NO interval charge |
| opportunities wrapper |32 per allowed(s,c), IS F6 setup charge; old public tuple_count retains ONLY its old32 before prepaid helper |
| F6 inspect + valid reevaluation |64+192=256 EXTRA per inspected selected row beyond old N scan, including infeasible/loss-filtered |
| Global step/context |32 |
| Input-turn gas TABLE check |32, in addition to profile loan |
| Numeric grant branch |32 for None/AtNativeTurn branch |
| AtNativeTurn income TABLE lookup |Additional32 |

Pay step/context32/profile loan32/input gas check32/grant branch32 plus the AtNativeTurn lookup32 when applicable. Per-source checked_source/gas/band/context work is owed AGAIN even after global validation; do not silently share it for free.
Bulk Γ uses loan32+680 initialization+1320 five-by33 scan/materialization. Its2000 fixed work is already in495752, loan32 additional. This NEVER replaces/discounts old F5 minimum32 inside intervals/public queries. Getters return borrowed data/POD fields only, no arrays copied for free or repeated qualification/N scans hidden in helpers.

### 6.2 Composition is not admitted

```text
fixed F6 + FULL standalone F4 chain
  = 495752 + 1003928 = 1499680 > 1048576
```

That particular composition already exceeds1M BEFORE extra F6 variable/bridge fees; it is NOT an admitted whole-window schedule or a global impossibility proof. Dense canonical F6 alone may legitimately Work/BUDGET-refuse. Do not refill/reset/drop support/truncate/raise caps/discount tariffs.
Future fusion/reuse must ELIMINATE actual duplicated allocation/copy/validation/scans, not merely relabel work as cached/startup/generator activity. Require a positive COMPLETE source-audited invoice including genuine history/source/N/aggregation/qualified likelihood/globalnorm/readout/bindings/ALLcandidate features before runtime wiring. Frozen10s/300s including3 cleanup/separate generator2048 remain unchanged.

<a id="7-independent-references-and-preservation-controls--planned-not-run"></a>
<a id="7-independent-referencespreservation-controls--implemented-supplied-leaves-green"></a>
## 7. Independent references/preservation controls — included in complete v9 PASS

Actual `packages/training/tests/joint_accounting.rs` contains27 independent controls. Oracle1 independently enumerates small multisource DISTINCT complete tuples/direct weights and compares ALL7501 output lanes at unchanged mathematical1e−12, without per-source normalization. Direct one-source F3 parity is likewise MATHEMATICAL tolerance because tuple-weight sums can round differently. Separate Oracle2 independently creates canonical contributor records, sorts source/branch or source/tuple keys, then reduces head/sparse/suffix/destination/retained graph and compares BITS. Its independent expected table counts/Den use a reference BTreeMap/complete tuples, not the production bridge. Both references are required; tolerance does not waive graph BITS/work/support/domain obligations.
Required cases: tolerance-based one-source F3 parity PLUS independent canonical BITWISE graph; unequal multisource retained evidence; source-specific Den/selected qualified N0/fractional canonical N; every supported D≥V including P0; P0 support without qualification/N/rows/model-dependent costs; valid count changes mass NOT mask; loss/current bounds AFTER source Den; minsubnormal(.5*P) underflow with no reassociation rescue; EmptyMass when only P0 reachability survives/EmptySupport when all sources eliminated under finite arithmetic; no global precedence for independent invalidities; other product/DIV/nonfinite/negative/outside-bool cases; immutable inputs; four shared heaps/construction sites independent of active-source count; Γ170/165 once; exact/one-below/prior work/dense SAME-meter Budget refusal.
Core source traversal NEVER calls full F3 point flow per source. Existing rules golden is STRUCTURAL test data only, not native execution/truth containment. No new fixture/private label/native producer or artifact qualification claim. Source audit+safe budget/error/private controls establish ordering/logical allocations, **not allocator/RSS instrumentation**, a new production observer or an unsafe allocator.
Four new safe private F5 regression units preserve old public build/select/source_terms results/count BITS/cohort/N/Z/Den/invoices/exact-one-below boundaries after M-helper extraction; prepared OLD+128/qualifiedN0 same cohort/row valid192 even infeasible or invalid32; accounting_source64 NO qual/N and wrapper32; failed loans before access/no bulk-minimum discount. Existing table/storage regressions remain. Any failure stops implementation, not an excuse to revise the public F5 contract/fees. Final supplied training340 includes these four new guards; they are not extra tests added to340 or allocator instrumentation.

## 8. Canonical arithmetic and remaining admission

Recommended F6 preserves A3/F5 ordinary count/N order, so NO arithmetic-order amendment/new TUI is required. Grouped pre-growth headstock/N remains UNAUTHORIZED: `((.5+2^-54)+2^-54) != .5+(2^-54+2^-54)`. No FMA/Kahan/regrouping/cancellation/buckets/per-source posterior normalization substitutes for the specified graph.
If grouped floating execution is requested BEFORE order-equivalence proof, STOP for parent TUI≥3 choices: canonical/order-equivalent optimization; narrow amendment naming EXACT A3 reduction clauses with renewed numerical/statistical evidence; defer aggregation with readiness blocked. No blanket floating waiver; kernel/count-N order unless explicitly changed/support independence/caps/labels/unrelated profiles stay untouched.
Qualified evidence tables/likelihood, genuine history/source/recipient/grant/artifact bindings, complete spatial support/features, positive WHOLE-window invoice/runtime/containers and frozen24k belief-fit acceptance remain required. F6 is RAW accounting, not complete estimator/native authority/calibration/readiness. Actual policy training/activation/deployment need separate approval; learned transfer/admission follows training, not a circular pretraining requirement. Legacy R4/inventory/public-closure/resource/authority stops remain unwaived and trainingReady:false unchanged.

<a id="9-planned-sourceintegration-v9-gate-and-current-handoff"></a>
<a id="9-actual-integration-source-observations-and-pending-whole-gate"></a>
<a id="9-actual-integration-complete-v9-proof-and-pending-closing"></a>
## 9. Actual integration, complete v9 proof and final closing

Both NEW assigned paths **EXIST/LANDED**, were read completely and carry top-line references to the existing training owner:

```text
packages/training/src/joint_accounting.rs
packages/training/tests/joint_accounting.rs
```

Aggregate source is450 lines, existing transition_tables.rs including the narrow bridge/private regressions1514 lines, independent new tests1771 lines; all were read completely. Source author A completed aggregate+bridge sequentially, B independently completed new tests. No F3/F4/Node/config/dependency/new fixture/native protocol/model/data/pin/artifact change. Existing F5 edge/public schema/behavior/invoices remain preserved.
Actual lib.rs exports pub mod joint_accounting without a retained scorer/host/CLI integration; package/tooling READMEs bound RAW/private-preservation scope. Shared root constants/assertions now use **`rust-training-verification-v9` / `native-joint-accounting`** in normal AND init-failure paths. Both NEW files join REQUIRED and independent mutation/restore/delete controls, KEEP ALL18 F1–F5/current bridge identity. Exact nonempty tests/joint_accounting.rs joins missing/zero/lookalike/name-summary guards; no parser redesign/predicted totals/readiness command/timeout extension.
The actual whole F6 run retains ALL29 earlier jobs/F1–F5 targets/full unfiltered Rust+Node+core/actual Node hook JSON capability probe/15-case import guard/MJS runtime+lint/static/fmt/check/Clippy-Dwarnings/types/lint/build/selected CPU dependencies/before+after protected tracked+untracked preservation/both syntax+boundsSVG/index/whitespace/content identity. This is ONE unchanged-input invoice, not summed leaf counts. Normal/init metadata retain exactly:

```text
full-training-closure
genuine-native-authority
whole-decision-adequacy
calibration
training-readiness
```

Before the gate, existing training owner/index extended **44→46** with EXACTLY two NEW actual literals/fingerprint null, retaining the F5 bridge edge. Actual whole-run syntax/bounded-SVG/index46/59 checks PASS; arena59/all44 other entries/metadata/order/unresolved list/22 notes/FK/stable labels remain preserved. Note/nav/inventory preflight is separate from29 jobs; this evidence pass changes none of those verified inputs.
Actual whole unchanged-input7bc9/v9 PASS was followed by ALL3 fresh final F6 read-only reviews, now DONE/READY, findings NONE. Source/config/test/index/PUML changes require WHOLE repeat before rereview; final metadata/preservation checks/restaging still precede authorized, unexecuted publication. No prior F5 proof/approval or future hash supplies current F6 evidence.

### 9.1 Bounded source-to-contract observations

aggregate_accounting precharges header/step checks, profile loan/global gas/grant checks, single min-array loan/Γ170 initialization/165 materialization, then exactly FOUR shared buffer construction sites. It charges all7501 source inspections before canonical bank/D traversal; every true D<V refuses (P0 included), rather than prunes. Positive sources prepare old public source_terms ONCE+128; P0 calls only accounting_source64/opportunities32, never qualification/rows/N/Z/count-dependent access/cost.
Positive background executes checked .5*P then division ONCE/source; branches add the identical scalar in lex(s,c,g) order. Every selected row pays64 plus valid bridge reevaluation192, even infeasible/loss-filtered, before canonical feasible(P*C)/Den scatter. All-source completion precedes descending head[j]+head[j+1]/Boolean OR; widened D+L guard1193/617 precedes destination lookup/both bounds/canonical retained sum. Raw cached readouts/small Debug have no scan/normalization/copy; inputs remain immutable and errors return no partial result.
The bridge owns SourceTerms POD and borrows only the selected table/growth; preparation literally calls existing public source_terms, paid repeated source check/direct returned-cohort lookup/handle, no second qualification/N scan. row_feasible reuses old interval with BBT band only and old minimum charge; opportunities_prepaid contains the extracted old expression, old tuple_count keeps its32 in place, new wrapper32 IS pair setup. Public F5 fields/count/N order/output/invoice controls remain intact.
Source audit+safe budget/error/private controls substantiate prepaid construction/lookups/arithmetic and source-count-independent four-buffer structure, **NOT allocator/RSS instrumentation**, D1/full-window/RSS/complete fitter/runtime admission.495752 remains fixed subtotal ONLY; ALL additional global/profile/source/branch/row/old F5 work remains billed. Dense same-meter refusal and the1499680 fixed-F6+standalone-F4 composition limit reject those schedules, not the design globally. No concrete frozen-math/API/fee/cap/order discrepancy was identified in this bounded inspection; this is not closing review.

<a id="current-f6-evidence"></a>
<a id="92-current-supplied-final-leaf-evidence--not-a-whole-invoice"></a>
### 9.2 Current complete unchanged-input v9 gate — PASS

Actual lead **sh_14e627036001j6EeBuPa55u4DB DONE/PASS** produced the [PRESENT receipt.json](/tmp/proveo-opencode-runtime-cache-1000-21d690750d3738af14d58c25/tmp/opencode/rust-training-141819-1792316436849605560-0/receipt.json), read for this update. Parent assertions validated the actual full invoice. This is ONE whole F6 run, not stitched leaves/old F5 proof; keeper runs no commands/tests/hashes/renders.

| Receipt field | Actual current value |
|---|---|
| Version / scope |`rust-training-verification-v9` / `native-joint-accounting` |
| Status / reviewEligible |`PASS` / `true` |
| error / identityError |`null` / `null` |
| Fixed results |29/29 PASS/exit0/reaped; no timeout/cleanup/reap errors |

```text
inputSha256 == inputSha256After ==
7bc9323d6e5b58772dfbb4763a76a9afc5786ec4d5e50a7bc398d9ba42c72e06
```

| Current unfiltered scope | Actual PASS count |
|---|---|
| Rust workspace/all targets |478 =arena106 +training340 +xtask32 across25 binaries |
| Node engine |189 |
| Native core |668 |

| Required target/filepath | Included count | Purpose; subsets, not extra totals |
|---|---|---|
| `packages/training/tests/joint_accounting.rs` |27 |ALL7501 lanes/120 multisource CASES inside suite: independent distinct-tuple math1e−12/F3 tolerance PLUS separate canonical graph BITS; reassociation/FMA/MUL-DIV/P0/errors/work controls |
| `packages/training/src/transition_tables.rs` new bridge units |4 within training library19 |Old outputs/invoices/one-below; OLD+128/qualifiedN0/valid192-invalid32; accounting_source64/wrapper32/no qualification; failed loans/no minimum discount |
| Training all targets |340 |309 retained +27 integration +4 new bridge units; ALL included in478, not added again |
| `tooling/xtask` |32 |Cumulative identity/mutation/delete/exact target/receipt/retained invoice controls; included in478 |
| `packages/training/tests/transition_tables.rs` |27 |Retained fractional count BITS/group qualification/backoff/sourceTerms/paid-storage controls |
| `packages/training/tests/joint_math.rs` |22 |Retained numeric mask/global normalization/nonrecursive summary controls |
| `packages/training/tests/accounting_kernel.rs` |25 |Retained point-flow/support/raw retained mass/work controls |
| `packages/training/tests/feature_input.rs` |29 |Retained ordered innovations/replay/private seed/shared-work controls |
| `packages/training/tests/feature_manifest.rs` |11 |Retained exact418 metadata/oracles/length-gated validation/work |
| `packages/training/tests/learner_math.rs` |24 |Retained scalar/FD/test-only Burn numerical proposal controls |
| `packages/training/tests/ledger_contracts.rs` |42 |Retained closed economic facts/native origin modes/nullability |
| `packages/training/tests/ledger_history.rs` |49 |Retained lineage/accounting/memory/conservation/replay/work |
| `apps/arena/tests/economic_replay.rs` |9 |Retained native economic/terminal closeout correspondence |
| `apps/arena/tests/readiness.rs` |4 |Retained bounded CLI/readiness-negative diagnostics |

All required old/new targets ran nonempty/unfiltered.120 oracle cases are INSIDE27;27+4 are INSIDE340;340/root32 are INSIDE478. Old author-local revision subsets are not current whole proof. All static/fmt/all-targets check/Clippy-Dwarnings/types/warnings-denied lint/build/selected CPU dependencies/protected tracked+untracked preservation BEFORE+AFTER/index46/59/both PUML syntax+boundsSVG/receipt-time whitespace PASS in that SAME run. Actual Node capability stdout read `{"version":"v22.23.2","registerHooks":true}`; all five exact notEstablished families persist.
Public F5 outputs/count BITS/invoices/exact-one-below and canonical RAW/math parity controls passed within the current whole run. RAW still stops before QUALIFIED evidence likelihood/global norm/reband/readout, with no default likelihood1/genuine support/full-estimator/native-binding/calibration/readiness claim. Fixed495752 is ONLY subtotal with ALL global/bridge/source/branch/row fees owed on SAME1M meter; source audit+safe budget/error/private controls are **NOT allocator/RSS instrumentation or D1/full-window/runtime-fit proof**.

The earlier test-only E0618 prior/step binding-name correction weakened no assertion/order/tolerance and changed no production/fees. Keeper read the complete450 aggregate/1514 bridge-source/1771 independent-test lines and root integration before freeze, but ran no verification in this evidence pass.

<a id="current-f6-closing"></a>
<a id="93-current-fresh-f6-closing-and-capture--verdicts-pending"></a>
<a id="93-current-f6-closing--devops-ready-adversarialsecurity-pending"></a>
### 9.3 Current final F6 closing and capture — ALL3 READY

ALL3 fresh **F6** final read-only reviews are now **DONE/READY, findings NONE**, bound to actual7bc9/v9 source/whole proof, not earlier F5 verdicts in these same sessions. **Bounded verification/review is COMPLETE; no LOW or pending review blocker.** Publication remains separately authorized/unexecuted.

| Reviewer/session | Actual current F6 status |
|---|---|
| Adversarial `ses_eb7cb724effe5uE3Hebn2Gb0wF` |DONE **`READY TO MERGE:yes`**, findings NONE; complete current17-path F6 diff, bounded RAW accounting/private F5 bridge only. |
| Security `ses_eb7cb7218ffePBBBS1MqCmBCtM` |DONE **`READY TO MERGE:yes`**, findings NONE; scope COMPLETE ALL17/four new/surroundings. Validation/bridge ownership/P0 support/canonical math/underflow/index/precharge/input isolation/partial refusal and PRESENT v9 receipt+logs29/478 Rust/189 Node/668 core/matching7bc9 identities/reviewEligible inspected; no commands/edits/reruns/agents. |
| DevOps `ses_eb7cb7206ffe1XrslbW4r6OyGq` |DONE **`READY TO MERGE:yes`**, findings NONE. Complete17 scope/new v9 receipt+raw logs29/478 Rust/189 Node/668 core/25 bins/matching7bc9 identity/reviewEligible inspected; four shared heaps/prepaid allocation+scans/sourceTerms ONCE/row charges/cumulative identity+nonempty target reviewed. No independent rerun/edits. |

Optional property support/underflow/budget tests remain non-blocking and **not executed proof**. Approvals remain bounded RAW accounting/private F5 bridge only: **not allocator/RSS instrumentation, D1/native authority/full estimator/runtime-container-hermetic/calibration/readiness or policy-training approval**. All five notEstablished families persist; no completed F5 verdict supplies F6 approval.

After PASS lead explicitly STAGED all17 F6 paths including4 new files/cached-whitespace PASS. The complete HEAD-relative capture includes ALL new files AND narrow existing F5 bridge and reached every reviewer upfront. Inventory/base-head files were read; artifact size/SHA256 below are lead-supplied, not computed by keeper:

| Current closing artifact | Supplied identity |
|---|---|
| `/tmp/proveo-opencode-runtime-cache-1000-21d690750d3738af14d58c25/tmp/opencode/f6-closing-review-Egvggq/head.diff` |200534 bytes; SHA256 `8a542775747fd3d40d660e546d8577cb04be6eb8d461fd5f38565355205c43b2` |
| Same directory `changed-paths.txt` |17 paths; SHA256 `90c59c73c8ecc22944ad787eba052bbe625ddf6f472493d14062e501b2a39844` |
| Same directory `base-head.txt` |723e4066618aea7cc9818920b35b1e6e2c79a8cd |

The complete17-path F6 scope is now fully reviewed; no source/config/test/index/PUML changed after PASS. Later four-Markdown status may be newer than the snapshot. **F6 publication is AUTHORIZED BUT NOT EXECUTED**. Lead will read final docs, rehash/join current466-input source to7bc9, check nav suffixes/whitespace/protected scope/exact17 inventory/no unexpected untracked paths, restage17/cached-check, make a meaningful non-amend commit/NON-FORCE push and verify actual remote HEAD/clean checkpoint. HEAD remains published F5base723e until an actual later commit; no future hash/self-hash loop or current F6 push is invented.

### 9.4 Separate preflight and current handoff

Separate actual lead preflight PASS, **not extra29 invoice commands**:45 index entries/all44 nontraining entries+metadata unchanged, literal46/59 covers/SPEC/file agreement;22 byte-unchanged notes/2–5 lines/max46 columns/FK unchanged; historical nav suffixes byte-exact to723e; expected4 then-new files/whitespace/protected F3/F4/native/legacy/model/Node/config/dependencies/locks/data preserved. This evidence-only pass edits no notes/index/PUML/protected inputs/normative math/API/count-N and contributor order/fees/caps.
Current handoff: implementation/integration/architecture/WHOLE7bc9 v9 proof **DONE/PASS29/478/189/668**, ALL3 current final F6 reviews **DONE/READY, findings NONE**, no pending review blocker. Next: lead final metadata/preservation/current-source join/checks, restage17 and perform authorized verified publication; no actual F6 commit/push/future hash claimed. RAW remains before qualified likelihood/global norm, no implicit1/full estimator/genuine support/native authority/resource-runtime/calibration/readiness or training approval. F7 freeze/private addendum/static advice stays external; no F7 repo goals/source before actual F6 publication. Five exclusions/trainingReady:false/legacy R4 stops persist. Keeper touches ONLY two F6 Markdown docs/nav prefixes; no source/config/tests/index/PUML/math/API/fee/order/cap edits or commands/tests/hashes/renders/agents/Git/polling/template fetch.
