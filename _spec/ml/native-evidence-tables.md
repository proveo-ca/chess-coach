# F7 — paired numerical evidence tables and weighting: accepted contract

**2026-10-18 · BOUNDED F7 VERIFICATION/REVIEW COMPLETE · a6f6 v10 PASS:29/29 COMMANDS /517 RUST /189 NODE /668 CORE · ALL3 CURRENT FINAL F7 REVIEWS READY, FINDINGS NONE · PUBLICATION AUTHORIZED, NOT EXECUTED · trainingReady:false.**

The [PR plan](../_plans/native-evidence-tables.md) owns sequential authorship, acceptance/oracles and gate order. Both CURRENT accepted external documents were read FULLY:
- `/tmp/proveo-opencode-runtime-cache-1000-21d690750d3738af14d58c25/tmp/opencode/f7-evidence-tables-freeze.md` (70 lines).
- `/tmp/proveo-opencode-runtime-cache-1000-21d690750d3738af14d58c25/tmp/opencode/f7-evidence-tables-addendum.md` (52 lines).

Architect `ses_eb7c5d187ffenpvgElk95FZ8ut` plus Backend/DevOps static advice are DONE/compatible, no normative fork/current TUI. Goals preceded authors; handoffs implement the unchanged private projection/cache/cap/math/work contract below. The [existing training owner](../packages/training/burn-compat.puml), [current complete F7 proof](#current-f7-evidence) and ALL3 final F7 READY/no findings establish actual bounded same-input verification/review, not stitched leaves/F6 approval. This evidence-only update changes no source/config/tests/index/PUML/normative contract; publication remains authorized but unexecuted.

## 1. Actual prerequisite and numerical-only scope

Lead committed/NON-FORCE pushed **4158065da37fd867b572a17d2f6271d687519584**, `feat(training): aggregate canonical raw joint accounting`,17 files,parent723e4066618aea7cc9818920b35b1e6e2c79a8cd. Actual post-push full HEAD/remote matched4158065d and tree was CLEAN **at that checkpoint**, before F7 edits. Before commit,466-input source joined7bc9; whole v9/29 PASS commands/478 Rust/189 Node/668 core/ALL3 current READY/NONE/exact17/nav/preservation/whitespace/cached checks passed. [F6 proof](native-joint-accounting.md#current-f6-evidence) is bounded RAW/private bridge, not F7/readiness; preserve723e/59e1/29018157/bf4d/8d/b47/user4990.
F7 pairs supplied numerical transition/evidence fit rows and applies qualified NUMERIC likelihood **AFTER ALL-source RAW accounting, BEFORE ONE LATER global normalization**. It does not normalize/reband/read out/calibrate/create an authenticated estimator. Code000 neutrality is the EXPLICIT validated frozen law, never an implicit default for missing evidence/model/invalid input.
No empirical fit run/native label producer/ancestry/independence/hash selection/authenticated artifact/Float64Hex/serde/FROZEN status/native permission/genuine publicSupport/calibration/readiness claim. Preserve public F5/F6 outputs/count BITS/canonical order/fees/failure prefixes, frozen R3/R4 bodies/Configuration26/Versions21/native/legacy/model/Node/dependencies/locks/pins/corpus/data/evidence. Native D+B labels/unused terminal-credit truth stay unchanged; no policy-training/activation/deployment approval.

## 2. Exact implemented public API and private ownership

Reuse F5 NumericFitRow/AccountingPoint/TransitionCohort/NumericTransitions/TableError, F6 RawJointAccounting and caller LedgerRules/LedgerWork/LedgerError.

```rust
#[derive(Clone, Copy, Debug, PartialEq, Eq, PartialOrd, Ord)]
pub struct InnovationCode { /* private3 bins */ }
impl InnovationCode {
    pub fn from_bins(bins: [u8;3], work: &mut LedgerWork) -> EvidenceResult<Self>;
    pub fn bins(&self) -> [u8;3];
    pub fn is_zero(&self) -> bool;
}
pub struct NumericEconomicFitRow {
    pub transition: NumericFitRow,
    pub destination: AccountingPoint,
    pub boundary_turn: u32,
    pub innovation: InnovationCode,
}
pub struct NumericEconomicFitGroup<'a> {
    pub slot: u16, pub selected_rows: &'a [NumericEconomicFitRow],
}
pub struct NumericEvidenceTable { /* private cohort/groups/counts48/occupied */ }
impl NumericEvidenceTable {
    pub fn cohort(&self) -> TransitionCohort;
    pub fn groups(&self) -> u16;
    pub fn counts(&self) -> &[f64;48];
    pub fn occupied_rows(&self) -> u8;
}
pub struct NumericEconomicTables {
    /* private owned NumericTransitions/794 evidence tables/cached COMBINED occupancy */
}
impl NumericEconomicTables {
    pub fn transitions(&self) -> &NumericTransitions;
    pub fn evidence_tables(&self) -> &[NumericEvidenceTable];
    pub fn occupied_sparse_rows(&self) -> usize;
    pub fn evidence_likelihood(
        &self, destination: AccountingPoint, boundary_turn: u32,
        innovation: InnovationCode, work: &mut LedgerWork,
    ) -> EvidenceResult<f64>;
}
pub struct EvidenceWeightedAccounting {
    /* private MOVED mass/mask buffers/finite positive retained mass */
}
impl EvidenceWeightedAccounting {
    pub fn masses(&self) -> &[f64];
    pub fn accounting_cells(&self) -> &[bool];
    pub fn retained_mass(&self) -> f64;
}
pub enum EvidenceError {
    Domain, Order, Capacity, NonFinite, Underflow, EmptyMass,
    Table(TableError), Work(LedgerError),
}
pub type EvidenceResult<T> = Result<T, EvidenceError>;
pub fn build_numeric_economic_tables(
    rules: &LedgerRules, final_node_count: u8,
    groups: &[NumericEconomicFitGroup<'_>], work: &mut LedgerWork,
) -> EvidenceResult<NumericEconomicTables>;
pub fn weight_evidence(
    raw: RawJointAccounting, tables: &NumericEconomicTables,
    boundary_turn: u32, innovation: InnovationCode, work: &mut LedgerWork,
) -> EvidenceResult<EvidenceWeightedAccounting>;
```

InnovationCode constructor pays128 entry+32 bounded checks, requires y1,y2∈0..3/y3∈0..2; private bins remain checked. Index `(4*y1+y2)*3+y3` spans ALL48 canonical codes. F1 semantics remain assertions≠births/clears≠deaths/point PMF≠certainty. No code/action/material correlation constraint is inferred from a valid bin.
Own exactly794 index-ordered evidence tables alongside the owned NumericTransitions. Borrowed/cached getters perform no clone/sort/scan; combined occupied count is constructor-derived PRIVATE state, not a caller argument. Counts are48 dense binary64 values/table; ZERO means absent sparse row, POSITIVE means one occupied code category. Dense38112 numeric cells are not occupied rows, artifact serialization/presence policy or memory/RSS proof.
weight_evidence takes raw BY VALUE. Only its two returned heaps move into EvidenceWeightedAccounting; no clone/new7501 replacement, unchanged Boolean mask BITS including true P0 cells. Errors publish no partial model/weighted output and do not return consumed raw. Typed Table/Work errors retain their payloads, never string-convert away Budget identity.

## 3. Exact private bridges and sequential authorship

Author A sequentially owns NEW evidence_tables.rs PLUS ONLY narrow existing F5 loans/private units and F6 move bridge/private units, never concurrent existing-file writers. Independent B owns ONLY NEW tests/evidence_tables.rs; lead serializes lib/root. Public F5/F6 recipes/outputs/BITS/invoices remain unchanged.

```rust
// Inside transition_tables.rs / impl NumericTransitions:
pub(crate) fn occupied_sparse_rows(
    &self, work: &mut LedgerWork,
) -> TableResult<usize>;
pub(crate) fn borrow_material_bands(
    &self, work: &mut LedgerWork,
) -> TableResult<&[u16;19]>;
pub(crate) fn numeric_cohort_path(
    &self, point: AccountingPoint, boundary_turn: u32,
    work: &mut LedgerWork,
) -> TableResult<[usize;4]>;
// Retain existing borrow_numeric_profile(&self, work) -> TableResult<&LedgerRules>.

// Inside joint_accounting.rs:
pub(crate) struct RawAccountingParts {
    pub(crate) masses: Vec<f64>,
    pub(crate) accounting_cells: Vec<bool>,
    pub(crate) retained_mass: f64,
}
impl RawJointAccounting {
    pub(crate) fn into_numeric_parts(
        self, work: &mut LedgerWork,
    ) -> Result<RawAccountingParts, LedgerError>;
}
```

F5 occupancy loan precharges **25440=32+32×794** BEFORE checked table-LENGTH metadata summation: no row-value clone/scan. Call ONCE for actual transition occupancy, save privately and seed the combined counter; no forged occupied parameter. Any second F5 occupancy rescan owes25440 again, not a free final helper. Bands loan32; retain existing profile loan32.
numeric_cohort_path costs **192=construct32+existing checked_source32+4×32 key/index**, reusing DEST point/BOUNDARY turn with V0/Np0. Return the four statistical indices, NO qualification/row feasibility/Z/N. Its existing paid gas read is profile-domain checking, **not evidence gas conditioning** or a copied native-tier formula.
F6 into_numeric_parts charges32 BEFORE destructuring; MOVE exactly two RETURNED buffers+scalar, never headstock/Γ/new arrays. Map failure DIRECTLY to EvidenceError::Work preserving Budget, no string conversion or consumed-raw return. Safe private pointer-equality/failed-precharge units may inspect ownership; no public escape/production observer/unsafe allocator.

## 4. One compound roster, destination law and exact projection

Reuse F5 roster bounds/order:≤14400 strict slots0..14399, final_node_count3..12, each group0..finalnodes rows, strict node indices0≤node<finalnodes. One COMPOUND roster supplies both families' SAME complete selected_rows length r, including rows in other cohorts. Empty groups are preserved/charged and qualify neither. Both families add ordinary positive binary64 fractions in slot→node→cohort order, no Kahan/clipping/drop/residual-to1 repair/chunk-total merge.
Transition cohorts are INPUT bank/material band/INPUT model-turn tier. Evidence cohorts are DEST bank/material band/BOUNDARY model-turn tier, with the same794 index layout/19 band endpoints as F5; statistical turn tiers0..10/11..20/21..45 are NOT native gas/income formulas.
For declared numeric settled fit rows, validate checked destination arithmetic:

```text
destination.D = source.D + c + g - d
destination.B = min(12, source.B - s + NOMINAL income_at(boundary_turn))
```

Use the checked owned numerical profile's NATIVE NOMINAL income TABLE, not recipient credited receipt or terminalTrainingCloseout credit. No requirement boundary_turn=input_turn+1/native chronology/authenticated grant follows. Exact example under canonical numeric profile: input D3/B3/turn10, outcome(s3,c3,w0,g0,d0), boundary11→DEST D6/B2, different bank/band/model tier. It is numeric arithmetic, not native execution.
F5 transition fitting additionally requires provided-source feasible action tuples/A1 witness; evidence fitting requires valid code and numeric DEST witness only, no invented code-action/material/hidden-action feasibility rule. Later authentic fitter must establish labels/ancestry/split/hash selection/boundaries separately.

### 4.1 EXACTLY two temporary vectors; all repeated passes charged

Pass1 before allocation: entry128/root32, group header32 EVERY group including EMPTY, compound preflight64 EACH row. Validate all slots/order/cardinalities/nodes/declared destination bounds/code/boundary turn and checked total `R≤14400×12` BEFORE proportional allocation. Let G be supplied group count; no unchecked overflow/cardinality shortcut.
Reserve fixed teardown32 BEFORE temporary allocation. Pass2 precharges `192+12+4*11R+64R` BEFORE flat Vec<NumericFitRow> allocation/init/copy; group header32 EVERY reread. The11 row lanes and3-lane Vec descriptor are explicit. Copy transition members in canonical input order; complete flat construction before any slices borrow it, NEVER grow after borrowing.
Pass3 precharges `192+12+4*3G` BEFORE descriptor Vec<NumericFitGroup<'_>> allocation/init; header32 EVERY reread including empty. Use ONE checked offset, borrow flat slices using original lengths, require final offset==R. No offset Vec/per-group heaps/table clone/sort. Invoke UNCHANGED F5 builder with full existing fees ADDITIONAL; DROP descriptor Vec BEFORE flat rows after it returns, retain no temporary references. Evidence then rereads ORIGINAL compound groups/complete r, not aggregated transition counts.

## 5. Evidence counts, qualification, shared cap and likelihood

All794 tables have dense48 ZERO-owned arrays, groups0/occupied0 when untouched. A positive code count is one occupied sparse row; every different cohort copy counts separately. NumericEconomicTables privately caches **combined transition+evidence occupancy≤8192**, seeded by the REAL25440-paid F5 metadata loan, not a caller-supplied counter or a second8192 allowance. This is the future combined artifact's shared cap, not artifact bytes/RSS admission.
Per original group pay header32 even EMPTY, nonempty weight32 before cached1/r. Revalidate each compound row64, boundary income TABLE lookup32, destination equation32, code index32, and DEST cohort path192; all earlier preflight/F5 validation costs remain owed. Each of four contributions pays cohort index32/code-cell access32. If cell is absent, check combined<8192 BEFORE new-positive creation64/occupancy mutation32. Count calculation/store32 is owed EVERY contribution, including Found updates at ceiling. Qualification32 is owed EVERY contribution BEFORE last_group read; increment groups once per slot/table only.
Reserve ALL applicable creation/occupancy/count/qualification blocks BEFORE changing count/group/occupied state. No partial state published, no count drop/truncation/sort/regroup/merge. Positive counts stay finite; fractional additions follow original slot/node/level order, not chunk totals or integer assumptions.
Destination group qualification uses BBT≥32→BT≥32→B≥32→Global, no source-conditioned selection or code-presence/probability fallback. A selected table with requested C=0 STAYS selected. Code000 FIT rows contribute counts/groups and ALL other-code denominators normally.

```text
LL(y | destination,boundary) = (C[y]+.5) / (SUM ALL48 C in canonical code order +24)
```

Do NOT replace24 with occupied×.5, infer qualification from count mass or normalize categorical API calls. Code000 INFERENCE first validates destination/code/turn and owned profile turn bound, THEN returns explicit1 with NO cohort qualification/count scan.000 is not a missing-model default; invalid destination/turn/max_turn refuses before bypass. Effective48 calls including000=1 do NOT sum1.
Concrete nonzero-code results: empty Global→1/48; one Global group consisting only of unit000→absent nonzero1/50; selected qualified local32 unit000→absent nonzero1/112 EVEN if lower fallback contains requested code. Positive smoothing/count sums use ordinary canonical code-order binary64, no Kahan/floor/clipping/reassociation.

## 6. Exact engineering invoices — SAME caller LedgerWork

SAME inclusive1048576/no reset/refund/new allowance/discount/exemption/hidden startup/generator relocation. Precharge before each covered allocation/copy/access/check/scan/mutation/ownership transfer. Repeated passes/loans/validations are charged AGAIN; unused charged work stays spent. Physically permitted inputs may legitimately Budget-refuse without row drop/partial model. No full14400-group offline driver/empirical-fit/D1/full-window/RSS admission.

### 6.1 Construction/projection/private-loan ledger

| Block | Exact units / rule |
|---|---|
| Public builder/code constructor |128 entry+32 bounded root/code checks |
| Projection Pass1 |32 EVERY group header+64 EACH compound preflight row; checked R before alloc |
| Temporary teardown |32 BEFORE temp allocation |
| Flat projection Pass2 |192+12+4*11R+64R before allocation/copy;32 EVERY group reread |
| Descriptor projection Pass3 |192+12+4*3G before allocation/init;32 EVERY group reread; one offset/final==R |
| Unchanged F5 builder |ALL old fees ADDITIONAL, no free source/profile/count work |
| Actual transition occupancy loan |25440 ONCE before794 table-length metadata reads; no rows/float copy/scan |
| Profile / bands loans |32 EACH when accessed, no unbilled clone/revalidation shortcut |
| numeric_cohort_path |192, construct32+checked_source32+4*32 indices, DEST/BOUNDARY/V0/Np0 |
| Evidence fixed allocation/init/keys |192+4*(3+56*794)+32*794=203468 BEFORE covered work |
| Evidence group |Header32 EVERY group incl empty; nonempty weight32 |
| Evidence row |Validation64+boundary income32+destination equation32+code index32+cohort path192 |
| EACH cohort contribution |Index32+code-cell access32; qualification32 EVERY contribution before last_group read |
| New positive code |Shared-cap guard BEFORE creation64+occupancy mutation32 |
| Count calculation/store |32 EVERY contribution, Found included; all applicable mutation fees reserved first |
| Final table metadata |32/table |
| Final POPULATED counts |32*48=1536 before FULL canonical count validation; no occupied-only shortcut |
| Final untouched EMPTY table |Constructor-owned zero invariant, NO48 rescan; prove invariant |
| Final ownership move |4*(393 transition-object lanes+3 evidence Vec descriptor+1 combined)=1588 BEFORE move, no794×48 clone |

Evidence table54 lanes=cohort key4+groups1+occupied1+counts48; separate builder last_group2 lanes/table yields56. No extra map/offset/per-group vector. Final paid metadata sums actual evidence occupancy, compares SAVED real transition occupancy+evidence==cached combined≤8192. Do not silently rescan F5; if required, pay25440 again. Error paths publish NONE and retain spent work.

### 6.2 Public evidence_likelihood query

| Order | Units |
|---|---:|
| Entry |128 |
| Destination/code/boundary checks |32 |
| Profile loan |32 |
| Profile turn bound |32 |
| THEN000 bypass |No qual/count scan, return1; TOTAL224 |
| Nonzero DEST cohort path |192 |
| Qualification/index examination |32 per examined level q∈1..4 |
| Canonical ALL48 count sum |1536 |
| Target count/smoothing/division checks |32 |
| TOTAL nonzero |1984+32q |

No selected-missing-code fallback, gas-tier likelihood formula or free repeated profile/cohort validation.000 counts remain inside SUM48 for OTHER codes; do not force effective API48 sum1.

### 6.3 weight_evidence ownership/application/cache

Before any bypass, validate boundary/code/profile context: root `128 entry+32 context+32 profile loan+32 profile bound+32 parts transfer+32 shape gate=288`. The32 transfer precedes destructure/MOVE; error consumes raw, no partial output/raw return. Prepay `32*7501=240032` before FULL destination bank→D scan; each lane covers mass/mask read/guard/zero/cursor condition/canonical retained addition. End retained checks32+seven-lane output MOVE28.
CODE000: preserve ALL mass/mask BITS, explicitly recompute/check canonical retained mass; NO band loan/cache/init/qualification/query/count scan/MUL. Successful full invoice **240380**. Explicit law only, not implicit likelihood1 for another code/context.
NONZERO: extra band loan32/cache initialization1976 BEFORE fixed247 Option<f64> entries (494 logical lanes), bank header/reset32×13=416, band advance32×234=7488 EVEN across zero lanes. Cache local to ONE immutable model/boundary-turn/code invocation, index by bank×band; at most247 misses. Not a reusable global/startup/decision cache/native capability.
For EVERY POSITIVE cell pay cache-index read32+checked product/store32, even a HIT. MISS pays the FULL public query1984+32q (including repeated context/profile/cohort/count scans) PLUS cache store32 before mutation. HIT avoids query/count rescan only; no unpaid index/product/cursor work. Weight is rawmass×qualified LL AFTER all-source aggregation; mask bits/P0-supported cells NEVER prune/change. Reject nonfinite arithmetic, actual positive multiplication erased to0, and recomputed zero total (EmptyMass), no floor/clipping/partial output.

```text
CODE000 full success: 288+240032+32+28 = 240380
NONZERO full success: 250292 +64*P +SUM cache misses(2016+32q)
P = positive mass cells; q = examined qualification levels1..4
```

MOVE the same two F6 output buffers into the seven-lane weighted output; nonzero cache is fixed local storage, not another7501 heap. Canonical per-cell multiplication/retained order and fractional LL/count sum order remain fixed. Physical max may Budget-refuse; no tariff discount/new meter/cache exemption. A positive complete F6→F7→later F4/history/bindings/ALLfeatures invoice is still required before admission.

## 7. Actual independent oracles/regressions — included in whole-v10 proof

B's ONLY new integration file independently tallies ALL794×48 counts/groups/positive occupancy from original compound records/complete r in canonical order, compares fractional BITS, then independently computes qualification/SUM48/LL and destination weighting. It includes source-input versus DEST-boundary bank/band/tier mapping, all code indices, repeated/empty groups,31/32 at all levels and the input3/B3/turn10→dest6/B2/boundary11 nominal-income case. No invented evidence action/code feasibility or recipient-credit/terminal-closeout substitution.
Required anchors:000 FIT counts/groups/other-code denominator but validated INFERENCE bypass1; empty Global nonzero1/48/one000 group absent1/50/qualified local32×000 absent1/112 despite lower code presence; selected missing code no fallback; effective48 calls NOT categorical sum1; invalid destination/profile max_turn BEFORE000. Exact public query000224/nonzero1984+32q, repeated validation charged.
Check real transition-occupancy loan seed/no forged root counter, every cohort copy/shared8192 Found-vs-new guard before mutation/final cached equality, constructor-owned empty zeros versus populated48 scans, two projection temporaries/full original r/reread headers/drop descriptor before flat/no grow-after-borrow/partial model refusal. A may safely seed private dense capacity for units, no public escape/observer/unsafe allocator.
Application controls: pointer equality BOTH MOVED raw buffers, same mask BITS/P0 support,000 mass BITS/recomputed retained/no cache/query/MUL; nonzero independent raw×LL/positive underflow/nonfinite/zero total/no partial result; cache misses full query/hits still index-product paid, model/turn/code changes isolated between calls. Source audit+safe error/budget/private/pointer checks establish structure, NOT allocator/RSS instrumentation/D1/full-window admission.
Old F5/F6 public outputs/BITS/invoices/failure prefixes MUST remain exact. Into-parts32 before destructure/failed transfers consume raw and preserve typed Budget, no string conversion. Exact/one-below/prior charges/unused work retained/no reset/refund/sort/count merges/truncation. STOP on oracle disagreement/uncovered work/source-conditioned LL/double cap/mixed r/mask pruning or changing old fees/assertions to fit the implementation.

## 8. Remaining software/authority/resource/readiness boundary

All rows/codes/destinations/profile/cohorts/counts are supplied numerical DATA, not actual empirical fitting/authentic native labels/ancestry/independence/hash selection/artifact codec/calibration/genuine spatial publicSupport/permits. Native D+B labels and unused terminal credit truth remain preserved; numerical nominal destination arithmetic authenticates no boundary/grant history.
Still require genuine native history/source/recipient/grant/artifact bindings/spatial support/full418/geometry, positive COMPLETE source-audited composed runtime invoice including history/F6/F7/later F4/ALLcandidate features, actual runtime/container closure and frozen24k belief-fit acceptance. Dense storage/shared row accounting/local caching/pointer equality do NOT provide RSS/D1/full-window evidence. Frozen1M/10s/300s including3 cleanup/separate generator2048 remain unchanged; no fee/cap/time waiver/unbilled startup/generator relocation.
Actual policy training/activation/deployment have NO approval; learned transfer/admission follows separately authorized training, not a circular pretraining prerequisite. Legacy R4/inventory/public-closure/resource/authority stops/five exclusions/trainingReady:false persist. No current ordering fork/TUI or canonical math amendment.

## 9. Actual source/root/coverage integration and completed whole gate

NEW actual paths, **HANDOFFS DONE / UNCOMMITTED**:

```text
packages/training/src/evidence_tables.rs
packages/training/tests/evidence_tables.rs
```

A completed new module+ONLY narrow existing F5 loans/private units and F6 move/private units sequentially; B completed ONLY new independent tests; lead integrated lib/root and accurate package/tool READMEs. Existing bridges remain covered/identity-bound, not extra new paths/public schema. No F3/F4/Node/config/dependency/model/native/protocol/data/pin/fixture changes.
Shared normal+init receipts/assertions use **`rust-training-verification-v10` / `native-evidence-tables`**; BOTH new required inputs+independent mutation/restore/delete KEEP20 F1–F6/current bridges are integrated. Exact nonempty tests/evidence_tables.rs reuses missing/zero/lookalike/name-summary guards; no parser/dependency/Node/timeout/readiness-command or hardcoded future test-total change. The PRESENT actual v10 receipt below now establishes whole-gate PASS, not merely integrated logic.
Retain ALL29 earlier jobs/actual Node hook capability/import guard/MJS runtime+lint/prior numeric/full unfiltered Rust+Node+core/static/fmt/check/Clippy-Dwarnings/types/lint/build/CPU dependencies/before+after tracked+untracked preservation/both syntax+boundsSVG/index/whitespace/content identity. Normal/init metadata keep exactly:

```text
full-training-closure
genuine-native-authority
whole-decision-adequacy
calibration
training-readiness
```

After actual handoffs, keeper read the FULL825-line evidence module/2185-line independent integration, narrow F5 loans/private units/F6 move/error units/root integration. Prior training owner/index46→48 added EXACTLY two new literals/null and retained bridge edges. Arena59/all44 other entries/metadata/stable labels/22 old note bodies/FK remain preserved; no new note. Paired-roster→owned transitions+DEST evidence/shared cap→qualified LL→MOVED RAW graph stops BEFORE later normalization, with no estimator/host/CLI/native/artifact/ancestry/publicSupport/runtime-closure edge. Whole-v10 syntax+bounded SVG/index/identity PASS; separate lead preflight confirms45 entries/44 nontraining+metadata/literal48/59/SPEC files/22 byte-unchanged2–5-line notes max46 columns/historical nav byte-exact4158065d/expected4 new/whitespace/protected inputs. That separate preflight is NOT extra29 jobs.
Actual whole unchanged-input a6f6/v10 PASS preceded ALL3 fresh final F7 read-only reviews, now DONE/READY/no findings on complete18-path scope supplied upfront. Codediff/source/config/test/index/PUML fixes require WHOLE repeat before rereview; final metadata/preservation/current-source join/checks/restaging precede authorized, unexecuted publication. Prior F6 proof/approvals remain prerequisites, not F7 approval.
Current complete freeze/exact addendum/domain static clarifications remain **PERSISTED/ACCEPTED**, no normative fork/current TUI; public API/math/fees/caps/order stay unchanged. Bounded F7 verification/review is COMPLETE: whole29/517/189/668 and ALL3 current final READY/NONE, no LOW or pending review blocker. Handoffs remain uncommitted, publication authorized/NOT EXECUTED. This pass owns ONLY two F7 Markdown docs/shared nav prefixes; no source/config/tests/index/PUML/F6 docs/normative edits/commands/hashes/renders/agents/Git/template fetch. Later source-identity-excluded Markdown needs lead checks/restaging, not a self-hash loop. Final verdicts arrived through material callbacks, no polling; no future publication hash/native authority/runtime admission/readiness invented.

<a id="current-f7-evidence"></a>
## Current F7 whole-v10 evidence

Actual shell `sh_14ea0c2ca001tYal91tjFuCWq1` completed DONE/PASS. Keeper read the PRESENT991-line receipt fully, raw Rust running/summary/private-control rows and binary inventory, actual Node capability stdout, and closing18-path inventory/base-head. No keeper reruns/hash computation or review polling occurred. The lead machine-asserted the full invoice; this is ONE whole unchanged-input F7 run, not author-local leaf totals or published F6 proof.

Receipt: `/tmp/proveo-opencode-runtime-cache-1000-21d690750d3738af14d58c25/tmp/opencode/rust-training-164060-1792320521221708526-0/receipt.json`.

```text
version: rust-training-verification-v10
scope: native-evidence-tables
status: PASS
reviewEligible: true
error: null
identityError: null
inputSha256:      a6f62727347f875099f8d254f33c300ff4fb796096b985af3f323d0ce37f142b
inputSha256After: a6f62727347f875099f8d254f33c300ff4fb796096b985af3f323d0ce37f142b
commands: 29/29 PASS / exit0 / reaped:true
timedOut:false / cleanupTimedOut:false / cleanupError:null / signal:null
Rust: 517 = arena106 + training379 + xtask32 / 26 binaries
Node: 189 / core: 668
```

ALL old/new required targets are unfiltered/nonempty; zero-test standalone main binaries in the26-binary inventory are not required integration targets. Raw Rust summaries show zero failed/ignored/filtered. Actual Node stdout is `{"version":"v22.23.2","registerHooks":true}`. Whole static/fmt/check/Clippy-all-targets-Dwarnings/types/lint/build/selected CPU dependencies/Node hook/import/MJS/prior numeric/BEFORE+AFTER tracked+untracked preservation/index48/59/two PUML syntax+bounded SVG/whitespace PASS in this SAME29-job run. It does not bind external theme bytes or establish hermetic/container/resource closure.

| Current evidence | Actual bounded status / limits |
|---|---|
| A/B handoffs |DONE, uncommitted:825-line new module/2185-line new integration; F5 private metadata/band/path loans and F6 charged move/private units; lib export and shared root integration. No production discrepancy reported. |
| Independent B integration |29/29 PASS in actual whole-v10; original-roster paired complete-r ALL794×48 counts/BITS/once-per-slot/qualification/source-vs-DEST/000 fit-query/cache isolation/pointer MOVE/mask/P0/reachable public underflow/exact invoices/dense Budget. This29 is INCLUDED in training379, itself INCLUDED in Rust517. |
| Final unfiltered training |379 PASS, zero failures/ignored/filtered:340 retained+29 new integration+10 new private units. The10 include8 earlier private units+2 final raw-error controls; no extra39/29/10 added to379/517. Whole fmt/check/all-target Clippy-Dwarnings PASS. |
| Final safe private error controls |Raw NaN or all-zero masses with stale positive retained cache exercise BOTH000/nonzero paths under exact/one-below scan/end-check prefixes/prior spend. Actual raw test rows PASS; these defend INVALID private fixtures, not native admission. NonFinite/EmptyMass remain distinct from typed Budget; no public unchecked constructor/production observer/unsafe allocator/partial output. |
| Root integration |32 unfiltered tests INCLUDED in517; whole workspace check/Clippy PASS. Normal/init five exclusions/BOTH new required identity mutation-delete inputs KEEP20 old/bridges/exact nonempty target and ALL29 retained controls are exercised in actual whole-v10, not inferred from leaves. |
| Superseded local reports |368/20 and377/29 precede final controls; they are NOT current totals or whole proof. Earlier B unused-field Clippy finding was fixed structurally without assertion/order weakening. |
| Whole v10 / current final reviews / publication |WHOLE PASS a6f6 + ALL3 fresh final F7 READY/NONE DONE; bounded verification/review COMPLETE, no LOW or pending review blocker. Publication AUTHORIZED/NOT EXECUTED/uncommitted; published F6base4158065d/7bc9-v9 proof/F6 approvals are prerequisites ONLY. |

Public query fees remain000224/nonzero1984+32q; weighting remains000240380/nonzero250292+64P+Σmiss(2016+32q), with construction203468/final1588 PLUS projection/old F5/loans/all variable fees on SAME1M. Fixed logical allocation/source audit+safe budget/error/pointer tests are NOT allocator instrumentation/RSS/D1/full fitter/complete F6→F7→later F4+history+ALLfeatures runtime admission. Valid physical maxima may Budget-refuse without reset/refund/discount/new allowance/support truncation.
Five exact notEstablished families above and trainingReady:false persist. Fitted24k belief acceptance remains pretraining; learned transfer/admission follows actual separately approved policy training. No real fit/artifact/native producer/authenticated support/ancestry/hash selection/calibration/activation/deployment/readiness proof is established.

<a id="current-f7-closing"></a>
## Current F7 closing capture and final review matrix

Lead staged explicit18 F7 paths AFTER whole PASS, including4 new files and existing F5/F6 bridges; cached-whitespace check PASS. Source/config/tests/index/PUML bytes stayed unchanged after PASS. Complete capture supplied to all three fresh read-only reviews upfront:

```text
directory: /tmp/proveo-opencode-runtime-cache-1000-21d690750d3738af14d58c25/tmp/opencode/f7-closing-review-5cDuQd
head.diff: 224233 bytes
head.diff SHA256: 660888a52371006267d3b1af8fc1a8bd58dcab8cf5ab00f7a4e4fdeff7bb12a9
changed-paths.txt: 18 paths
inventory SHA256: 910414797dbf49b6a17fdffe99f981d7c50c5c63329041c36715b91a2944608d
base-head.txt: 4158065da37fd867b572a17d2f6271d687519584
```

Byte/hash capture identities and staging/preflight outcomes are lead-supplied, not keeper-computed. Keeper read the18-path inventory/base-head and confirmed18 diff file headers, including all new files/both existing bridges; this is not a claim to reread every captured diff hunk. Later four-Markdown status may be newer than captured/staged metadata and needs final lead checks/restaging before any publication. These Markdown edits are excluded from source identity; no future self-hash or F7 publication hash is invented.

| Fresh F7 reviewer | Session | Actual current verdict |
|---|---|---|
| Adversarial |`ses_eb7cb724effe5uE3Hebn2Gb0wF` |DONE / READY yes / findings NONE; complete18 diff, bounded paired numerical tables/post-aggregation weighting only |
| Security |`ses_eb7cb7218ffePBBBS1MqCmBCtM` |DONE / READY yes / findings NONE; all18 incl4 new/surroundings, shared cap/lifetimes/DEST qualification/canonical counts/consumed ownership/cache isolation/masks/prepay/numerical refusal; PRESENT v10 receipt/logs29/517(training379)/189/668, matching a6f6/reviewEligible; no new egress/dependency/credential surface |
| DevOps |`ses_eb7cb7206ffe1XrslbW4r6OyGq` |DONE / READY yes / findings NONE; complete18/current v10 receipt/raw logs29/517/189/668/26 binaries/a6f6/reviewEligible; prepaid two-Vec projection/shared cap/MOVE/cache hit-miss/product fees/cumulative input-target guards inspected |

ALL3 final F7 reviews are DONE/READY/no findings on the SAME complete18-path scope and PRESENT a6f6/v10 proof. Material final verdicts are current F7 approvals, NOT older F6 approvals in these sessions. Reviewers ran no independent reruns/edits; optional cap/cache/budget property hardening is non-blocking/NOT executed proof. No LOW or pending review blocker remains. Source/config/test/index/PUML changes require WHOLE repeat before rereview; source/config/tests/index/PUML bytes stayed unchanged after PASS.
**F7 publication is AUTHORIZED BUT NOT EXECUTED.** Lead will read final docs, rehash/join current468-input source to a6f6, check nav suffixes/whitespace/protected scope/exact18/no unexpected untracked paths, restage18/cached-check, make a meaningful non-amend commit/NON-FORCE push and verify actual remote HEAD/clean checkpoint. HEAD remains published4158065da37fd867b572a17d2f6271d687519584 until an actual later commit; no future hash/self-hash loop or F7 push invented. No polling/commands/commit/push occurred in this keeper pass.
Bounded verification/review remains NUMERIC only before ONE LATER normalization; no empirical fit/authenticated labels/ancestry/cohort independence/artifact/native authority/authentic support/full estimator/allocator-RSS/D1/full fitter/composed-window/runtime-container/calibration/readiness or policy-training/activation/deployment approval. Five exclusions/trainingReady:false persist. F8 freeze/exact private ownership addendum/Backend+DevOps advice are DONE external-only; no F8 repository goals/source before actual verified F7 publication.
