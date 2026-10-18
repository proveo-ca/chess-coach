# F5 — numerical transition tables and source terms: accepted contracts

**2026-10-18 · BOUNDED F5 VERIFICATION/REVIEW/PUBLICATION COMPLETE ·3c1a v8 PASS:29 COMMANDS / RUST447 / NODE189 / CORE668 · ALL3 FINAL F5 REVIEWS READY, FINDINGS NONE · PUBLISHED723e4066 / MATCHED HEAD=REMOTE / CLEAN AT CHECKPOINT · trainingReady:false.**

Lead committed/NON-FORCE pushed **723e4066618aea7cc9818920b35b1e6e2c79a8cd**, `feat(training): add qualified numerical transition tables`,16 files,parent59e1eff1a10072b6594fff3a65e2e6b3b5ff7a24. Before commit,464-input source joined3c1a and whole-v8/ALL3 final READY/exact16/navigation/preservation/whitespace/cached checks passed. Actual post-push full HEAD/remote matched723e and tree was CLEAN **at that checkpoint**, before [F6 goals](native-joint-accounting.md); bounded F5 publication establishes no F6/readiness proof.

The [PR plan](../_plans/native-transition-tables.md) owns ownership, acceptance/oracles and gate order. Both current accepted external architect documents were reread completely, including completed backend/DevOps and final transient-storage clarifications:
- `/tmp/proveo-opencode-runtime-cache-1000-21d690750d3738af14d58c25/tmp/opencode/f5-transition-tables-freeze.md` (108 lines).
- `/tmp/proveo-opencode-runtime-cache-1000-21d690750d3738af14d58c25/tmp/opencode/f5-transition-tables-addendum.md` (44 lines).

Architect `ses_eb7c5d187ffenpvgElk95FZ8ut` left no pending decision/public API/math/cap/order fork. Frozen paid LOGICAL storage/drop order/API/math/count order/fees/caps remain unchanged. Both actual Rust files/lib/root integration were read completely before freeze; the [existing training owner](../packages/training/burn-compat.puml) documents structure. [Complete v8 proof](#current-f5-evidence), ALL3 final READY/no findings and actual publication723e are lead/reviewer results, not stitched leaves/F4 approval or keeper reruns. This publication-status update changes no source/config/tests/index/PUML or normative F5 contract.

## 1. Published prerequisite and numerical-only scope

Lead committed/non-force pushed **59e1eff1a10072b6594fff3a65e2e6b3b5ff7a24**, `feat(training): add checked joint normalization and readout`,16 files,parent29018157e40bb11d558599a21409623bfbec1a83. Actual post-push HEAD/remote matched full59e1 and tree was CLEAN **at that checkpoint**, before F5 edits. The [completed F4 base](native-joint-math.md#current-f4-evidence) retains462-input721e/v7 source join/29 PASS commands/416 Rust/189 Node/668 core/ALL3 fresh READY/NONE and final nav/preservation/whitespace/exact16 checks. Earlier29018157/bf4d/8d/b47/user4990 remain preserved; none is F5 proof/readiness.
F5 builds counts from supplied grouped numeric rows, derives distinct contributing groups/group qualification/backoff, and returns selected-source Z/N/Den WITHOUT7501-flow allocation. This is not an empirical fit run, native label producer, ancestry/hash selection/independence proof, authenticated fitted artifact, joint estimator or runtime permission.
No evidence table/likelihood/spatial genuine publicSupport/joint flow/calibration/collector/permit/geometry/full feature/runtime admission work. Preserve F3/F4 source/law, frozen contracts/Configuration26/Versions21/native/legacy/model/Node/deps/locks/pins/labels/corpus/data/evidence; no new fixture/codec/production legacy import or policy-training/activation/deployment grant.

<a id="2-exact-planned-api-and-private-representation"></a>
## 2. Exact implemented API and private representation

Reuse LedgerRules/LedgerWork/LedgerError and F3 AccountingPoint/NumericTransitionRow/distinct growth support, not an alternative rule authority or new work allowance.

```rust
#[derive(Clone, Copy, Debug, PartialEq, Eq, PartialOrd, Ord)]
pub struct NumericOutcome {
    pub spend: u8, pub created: u8, pub wasted: u8,
    pub growth: u8, pub destroyed: u16,
}
#[derive(Clone, Copy, Debug)]
pub struct NumericFitRow {
    pub node_index: u8, pub source: AccountingPoint, pub input_turn: u32,
    pub visible_before: u16, pub marines_before: u8, pub outcome: NumericOutcome,
}
#[derive(Clone, Copy, Debug)]
pub struct NumericFitGroup<'a> {
    pub slot: u16, pub selected_rows: &'a [NumericFitRow],
}
#[derive(Clone, Copy, Debug, PartialEq, Eq)]
pub enum TransitionCohort {
    BankBandTier { bank: u8, band: u8, tier: u8 },
    BankTier { bank: u8, tier: u8 }, Bank { bank: u8 }, Global,
}
pub struct NumericTransitionTable { /* private cohort/groups/rows/reserved_slots */ }
impl NumericTransitionTable {
    pub fn cohort(&self) -> TransitionCohort;
    pub fn groups(&self) -> u16;
    pub fn rows(&self) -> &[NumericTransitionRow];
}
pub struct NumericTransitions { /* private tables/copied profile/growth metadata */ }
#[derive(Clone, Copy, Debug)]
pub struct NumericSourceContext {
    pub input_turn: u32, pub visible_before: u16, pub marines_before: u8,
}
#[derive(Clone, Copy, Debug, PartialEq)]
pub struct SourceTerms {
    pub cohort: TransitionCohort, pub feasible_tuple_count: u32,
    pub fitted_count_sum: f64, pub denominator: f64,
}
#[derive(Debug, PartialEq, Eq)]
pub enum TableError {
    Domain, Order, InfeasibleSource, Capacity, NonFinite, Work(LedgerError),
}
pub type TableResult<T> = Result<T, TableError>;
pub fn build_numeric_transitions(
    rules: &LedgerRules, final_node_count: u8,
    groups: &[NumericFitGroup<'_>], work: &mut LedgerWork,
) -> TableResult<NumericTransitions>;
impl NumericTransitions {
    pub fn tables(&self) -> &[NumericTransitionTable];
    pub fn select(
        &self, source: AccountingPoint, input_turn: u32, work: &mut LedgerWork,
    ) -> TableResult<&NumericTransitionTable>;
    pub fn source_terms(
        &self, source: AccountingPoint, context: &NumericSourceContext,
        work: &mut LedgerWork,
    ) -> TableResult<SourceTerms>;
}
```

NumericTransitionTable privately owns cohort/groups:u16/canonical rows:Vec<NumericTransitionRow>/reserved_slots:usize. NumericTransitions owns exactly794 tables, explicitly copied LedgerRules profile and GrowthMetadata. Private TableBuilder separately tracks last_group:[Option<u16>;794], occupied_rows and paid_slots. Its cfg(test)-only peak_live_slots/maximum_old_slots support safe logical-storage units, not a production observer. Published table/collection custom Debug formats only small metadata/lengths without row/profile scans or deep copies.
GrowthMetadata has minimum_opportunities:[u8;33] (5 means unreachable), cardinality_prefix:[[u8;34];5], growth_sum_prefix:[[u16;34];5]. Prefix k covers growth0..k−1, prefix0 empty. Borrowed tables()/rows() and cached metadata getters perform no hidden copy/scan/sort; effective query lookups/arithmetic remain billed. No unmetered deep Clone, serde/Float64Hex/ByteRef/artifact/FROZEN/calibration/authority field.

## 3. Input validation, fractional counts and distinct groups

Precheck≤14400 supplied groups and final_node_count3..12 before proportional work. Slots are STRICTLY increasing0..14399; each group supplies0..final_node_count selected rows, with node_index STRICTLY increasing and0≤node_index<final_node_count. No implicit sort/duplicate resolution or native selection/authenticity inference.
Charge each group header32 BEFORE slot/order/rowcount checks, including EMPTY groups. Empty groups consume input accounting but contribute no row/group qualification. A nonempty group pays another32 BEFORE calculating one cached positive binary64 weight1/r, where r is its COMPLETE supplied selected_rows length, including rows that map to other cohorts.
Validate EVERY outcome against the frozen F3 global tuple domains: s,c,w0..9, s∈{0,1,3,5,9}, c∈{0,s}, w=s−c, g0..32/even, d0..617. The named source/context uses checked D0..576/B0..12/V≤D/Np≤64 and Np≤V, model-turn domain0..45 and existing copied-table index/profile constraints; its outcome must be feasible from THAT source. Unlike F3 query rows, an infeasible fit-row witness rejects InfeasibleSource, not ignore-and-continue. Globally valid unreachable g30 also refuses InfeasibleSource.
Each valid row contributes the SAME1/r to its source's four cohorts in order BBT→BT→B→Global. Process groupSlot→nodeIndex→cohortLevel, ordinary left-to-right positive f64 addition. Maintain rows lexicographically by COMPLETE tuple(s,c,w,g,d), excluding count, incrementally during build; no final sort/regroup/duplicate merge. No integer/dyadic assumption, Kahan, bucket reassociation, clipping/drop, chunk-total merge or residual repair to force repeated1/r to exact1.
Count DISTINCT contributing slots ONCE/table: charge qualification32 on EVERY contribution BEFORE reading last_group, then conditionally increment groups/update that slot. Several nodes/outcomes in one slot may add counts but cannot increment that table's groups again. Qualification is not fractional count sum or count-derived weight.
Numeric A1 means every output outcome has at least ONE supplied source witness IN its cohort that makes it feasible. It does not require EVERY source in the cohort to support it, excuse an invalid provided witness, establish statistical independence/native truth or authenticate genuine settled labels.

## 4. All794 cohorts, bands, model tiers and backoff

Keep ALL794 cohorts, including unused ones, in one contiguous Vec with no index-map vector. tables() borrows exactly this index order; unused groups0/rows empty/paid reserved_slots0, zero input leaves ALL794 empty.

```text
bank0..12, band0..18, tier0..2; widen to usize before checked index math
BBT = 57*bank + 3*band + tier      0..740
BT  = 741 + 3*bank + tier         741..779
B   = 780 + bank                 780..792
Global = 793
```

The19 material-band lower endpoints are `[0,1,2,3,4,6,8,12,16,24,32,48,64,96,128,192,256,384,512]`. Each band ends just before the next lower endpoint; the final band includes576. Cohorts use source bank/material band, not destination stock.
MODEL turn tiers are turns0..10→0,11..20→1,21..45→2. They are statistical labels, **not native gas/income tier formulas**. Copy/validate the supplied numerical gas/income profile (supported values1..3); queries read actual gas TABLE at the input turn. For example numeric gas3 at turn0 still has model-tier0. Existing rules/profile constraints remain structural, not canonical native bytes/provenance or a copied Rust income authority.

```text
select BBT if groups>=32
else BT if groups>=32
else B if groups>=32
else Global, even if groups=0/rows=[]
```

select uses group qualification ONLY. source_terms invokes the private checked selector ONCE; a qualified selected table with zero query-feasible count stays selected with N0 and alpha-only Den. No extra fallback on query infeasibility/probability/evidence. Empty Global is a zero-count numerical prior, not a calibrated fitted model.

## 5. Private widened feasibility intervals and exact source terms

Let D/B be source material/bank, e the actual copied gas TABLE value, V visible_before, Np marines_before. Let m(g) be the MIN opportunities needed for g in DISTINCT sums from up to4 increments{0,2,4,8}; it is not ceil(g/8). m6=2,m14=3,m22=4;30 is unreachable.
For a globally valid outcome, require s≤B and reachable m(g)≤4 and m(g)≤1+e−I(s>0). With WIDENED checked signed arithmetic:

```text
lo = max(0, V, V-Np-I(c==1)+m(g), d-c-g)
hi = min(576, 576+d-c-g)
```

Intersect with the material band for a banded cohort; an empty interval is infeasible. The supplied fit source D must be in the appropriate interval. Never prematurely unsigned-wrap/saturate the negative terms; no witnessed-loss L/destination conditioning enters this helper or a source denominator. Interval helper stays PRIVATE.
source_terms validates point/context/copied profile, reads actual gas, selects ONCE, and computes unconditioned Z. For each allowed DISTINCT(s,c), zero-spend c0 once:

```text
M = min(4, 1+e-I(s>0), Np+D-V+I(c==1))
j0 = D+c
low = { g in Γ_M : j0+g<=576 }; high = Γ_M minus low
Z(s,c) = count(low)*(j0+1) + sum(low growth) + count(high)*577
Z = sum all allowed (s,c) branch cardinalities
N = ordinary canonical-row-order sum of selected counts with D inside their intervals
Den = N + .5*Z
```

Use cardinality/growth-sum prefixes and checked NONNEGATIVE integer arithmetic for Z; no destruction enumeration, probability subtraction, headstock or output7501-flow allocation. m/growth sets count numeric sums, not construction multiplicity. Source D575/B0/V575/Np1/e1/no counts gives Γ1 and **Z=576+3×577=2307**.
N scans each selected table row ONCE in canonical tuple order with inspected-row32 PLUS interval128/owed index lookups. Query-infeasible rows add no count; this does not invalidate their earlier cohort witness or cause another select. Check positive finite row counts, finite nonnegative N and positive finite Den; **N may be0**. No interval/count buckets, integer-count/exact-sum substitution, Kahan or chunk-total reassociation. F5 never calls F3 full flow or F4 normalize/readout, and SourceTerms is not a posterior/evidence update.

## 6. Exact engineering precharge and explicit storage addendum

Every call uses caller SAME LedgerWork, inclusive1048576; no constructor/reset/refill/refund/extra allowance/cache exemption/hidden startup. Precharge BEFORE covered initialization/allocation/copy/check/search/shift/math/mutation/publication; check supplied cardinalities before proportional work. Existing LedgerRules.validate charges FIRST and remains ADDITIONAL; copied profile validation is structural, not native identity.

| Block | Frozen engineering units / ordering |
|---|---|
| Public entry |128 |
| Parameter/source/cohort arithmetic block |32; effective metadata/index lookups also billed |
| Metadata/buffer initialization |4/logical lane |
| Heap allocation |192 each |
| Selected fit-row validation |64/row |
| Source interval |128/evaluation |
| Cohort contribution/index access |32 |
| Tuple search |16/comparison; reserve14 comparisons=224/search, return Found OR insertion position, no second contains search |
| Group header / nonempty weight |32 EVERY header including empty, then32 only nonempty before cached1/r |
| New-row copy |64 |
| Insertion shifts |64 per shifted row |
| New length/global occupied-row mutation |32 |
| Existing positive count update |32 BEFORE checked addition |
| Distinct-group qualification |32 EVERY contribution BEFORE last_group read, including repeated same-slot contributions |
| Final table validation/ownership move |32/table+64/occupied row, no hidden sort/shrink/regroup/merge |
| Source-query N scan |32/INSPECTED row PLUS128 interval/effective lookup charges; canonical once-through |

### 6.1 Fixed tables, growth metadata, copied profile and final move

```text
table logical9 lanes = cohort tag/payload4 + groups1 + Vec descriptor3 + reserved1
builder last_group = 2 lanes/table
table allocation/init/key construction:
  192 + 4*(3 + 9*794 + 2*794) + 32*794 = 60548

growth_support(m) for ALL m0..4 on SAME work:
  sum(952 + 4224*m) = 47000
growth metadata = 33 + 170 + 170 = 373 lanes
metadata init = 4*373 = 1492
summary scan = 8*5*33 = 1320
total growth = 49812

profile fixed = 11 scalar + 2*3 Vec-descriptor lanes = 17
before bounded allocation/copy/domain checks, ni income and ng gas elements:
  2*192 + 4*(17+ni+ng) + 32*(ni+ng)

final fixed metadata/profile/Vec descriptor ownership move:
  4*(373+17+3) = 1572
plus final 32/table + 64/occupied row
```

Reserve tables before allocation/init/key construction, with NO separate index-map vector. Process each returned F3 growth33 mask ONCE and discard, no regeneration/retained extra mask; repeated F3 generation itself is fully billed. Copy owned income/gas vectors explicitly, no unmetered rules.clone. Reserve final fixed1572 BEFORE ownership move, not an additional hidden deep copy. Existing-rule validation fees are not included in these displayed constants.

### 6.2 Occupied rows, paid capacity and incremental insertion

8192 is the TOTAL occupied sparse-row ceiling ACROSS all transition tables, counting the same outcome's different cohort copies separately. It is not8192 per table or a new future evidence allowance: the later combined transition+evidence artifact shares8192; F5 creates no evidence tables.
For the contribution's table, let L=rows.len and C=reserved_slots (PAID capacity),0≤L≤C≤8192. One paid binary search224 returns Found or insertion position p. On Found, charge32 before positive count addition; no new occupied slot/allocation even at the global ceiling. On a distinct outcome, check GLOBAL occupied8192 cap BEFORE any new-row allocation. Never borrow allocator overcapacity as free logical C.

```text
if L==C:
  Cnew = 1 if C==0 else min(2*C,8192)
  prepay 192 + 4*6*Cnew + 64*L + 32 BEFORE allocation/copy/replacement
  allocate NewVec with capacity>=Cnew
  copy old L rows preserving order/count bits, replace vector
  DROP OLD buffer before insertion/metadata update or another cohort growth
  paid C becomes Cnew ONLY; no count aggregation during copy

before insertion at p:
  prepay 64 + 64*(L-p) + 32
  then new-row copy / shifts / length+global-row mutation
```

Count six row lanes for conservative initialization even though spare storage remains uninitialized; allowance stays spent. No implicit reserve/doubling, allocator-capacity-dependent fee, unsafe_set_len or uncharged copy/shift. Maintain canonical rows on EVERY insertion; final validation/move cannot hide a sort/shrink/reallocation/regroup/duplicate merge. Charge qualification32 on EVERY contribution before reading last_group, whether Found or inserted.
Confirmed **paid persistent row-capacity sum≤16384 (=2×8192)** derives from occupied rows, not a new occupied-row cap. The global8192 guard BEFORE allocation prevents growing a full8192 vector, so temporary old paid capacity≤4096; logical live row slots DURING replacement≤16384+4096=20480. Enforce guard→precharge→allocate NEW→copy OLD→replace→DROP OLD→insert/update metadata, with OLD dropped before another cohort can grow. Copies preserve row order/count BITS, **NO aggregation**; the existing64L old-copy fee covers them, no new fee/API/cap.
These are PAID LOGICAL slot bounds, **not allocator over-allocation, allocator-retained memory, RSS or runtime proof**. Test peak logical live storage across growth using safe private units/source audit if needed, not a new production observer or unsafe allocator. Do not keep old buffers for later cohort growth or count them as already dropped before replacement.
All errors publish NONE/retain spent work; no partially built tables, input truncation, fractional-count drop or budget refill. Source audit must cover real scans/copies/growth/order plus safe budget/error controls, **not allocator instrumentation/D1/full-window or complete14400-group offline driver/loading admission**. Large physically valid inputs may legitimately Work-refuse.

<a id="7-independent-controls--planned-not-run"></a>
<a id="7-independent-controls--implemented-supplied-leaves-green"></a>
## 7. Independent controls — included in current complete v8 PASS

Actual `packages/training/tests/transition_tables.rs` (1876 lines) contains27 independent controls. Its growth-sequence→distinct COMPLETE-tuple sets/direct destruction enumeration check source feasibility/Z/N/Den without production interval/prefix/F3 full-flow/F4 readout or legacy production oracles.12180 comparisons consist of5460 combined/isolated selected-outcome cases over420 small contexts plus6720 cases sweeping all16 reachable growths over those420 contexts; these are comparison CASES inside27 tests, not extra test counts. Stock-cap boundary/Z2307 and SOME-source versus bad supplied-witness controls remain separate cases.
Cover all794 direct indices/empty tables/global793, all19 bands/turn10→11/20→21, numeric gas3 at turn0 independent of model-tier0, caller profile mutation isolation; fractional r including rows elsewhere/repeated tuples/canonical count-add order, once-per-slot/table qualification and31/32 at ALL backoff levels. Include zero-row header charging/globalempty alpha-only and qualified selected N0 with NO query fallback.
Require occupied copies across four cohorts/global cap before distinct allocation/found update at ceiling, paidC1/doubling/cap growth/old bitwise copies/shifts/no final sort, fixed60548/growth49812/profile/final1572 invoices, empty headers/every-contribution qualification, exact/one-below/prior-charge retention/no partial outputs. Four actual private source-unit guards cover growth metadata/exact fees/min opportunities; Found-vs-new at occupied ceiling; preallocation pointer preservation/old count bits and order; largest replacement/following cohort growth within logical storage bounds. They use safe private state and cfg(test) logical peaks/source audit, **NOT allocator/RSS instrumentation**, a production observer or unsafe allocator. No new fixture/native fit run/true labels/authority claim.
STOP on oracle mismatch, uncovered copies/growth/checks, implicit capacity growth, count reassociation/chunk-total merges, cap overflow/truncation or group slots treated as independence. Exact order/domain/cap/count semantics cannot be waived around a test failure.

## 8. Future factoring memo — no floating-order or runtime authorization

The external memo gives46737 pre-growth algebraic visits:577×(1+2×3+2×5+4×7+4×9). Positive grouping A[M,B′,D+c] could save repeated algebra; naive five dense sheets use38090 lanes. These are feasibility observations, NOT an audited positive complete invoice or permission to execute grouped floating headstock/N buckets.
Frozen A3 canonical order still binds fractional f64 counts/N/headstock: `((.5+2^-54)+2^-54) != .5+(2^-54+2^-54)`. No grouped float headstock, dyadic/integer-count assumption, bucket subtraction, Kahan or exact-sum substitution is authorized. A future offline driver must preserve canonical contributions/accumulator state, not independently rounded chunk totals.
Only proven order-equivalent optimization or a later EXPLICIT narrow arithmetic-order amendment can change that path. If reassociation becomes necessary, parent must offer at least3 choices: preserve order/pursue compatible optimization; explicitly amend narrow arithmetic order with renewed numerical+statistical evidence/unchanged math/caps; defer aggregation with readiness blocked. No TUI is needed just to implement current F5 tables/sourceTerms.
Full runtime wiring still requires a **positive complete source-audited invoice** for history/source/backoffN/positive numeric+independent Boolean/suffix/restrict/likelihood/globalnorm/readout/binding/ALLcandidate features≤1048576. Frozen10s/300s including3 cleanup/separate generator2048 persist. No tariff reduction/cap raise/truncation/hidden startup/generator-work exemption. Keep this memo separate from current F5 permission.

<a id="9-planned-source-v8-gate-and-current-handoff"></a>
<a id="9-actual-integration-source-observations-and-pending-whole-gate"></a>
<a id="9-actual-integration-complete-v8-proof-and-pending-closing"></a>
## 9. Actual integration, complete v8 proof and final closing

Both assigned new Rust files **EXIST/LANDED**, were read completely and have top-line pointers to the existing training owner:

```text
packages/training/src/transition_tables.rs
packages/training/tests/transition_tables.rs
```

Actual lib.rs exports pub mod transition_tables without a retained scorer/host/CLI call into it; package/tooling READMEs bound the numerical-only scope. Shared root constants/assertions use **`rust-training-verification-v8` / `native-transition-tables`** in normal/init-failure paths. BOTH actual files are cumulative nonremovable identity inputs with independent mutation/restore/delete controls, retaining ALL16 F1–F4 inputs. Exact nonempty tests/transition_tables.rs joins retained missing/zero/lookalike/name-summary checks; no parser redesign/future test-total prediction/readiness command or timeout/dependency/Node/config/F3/F4 source change.
The actual whole F5 run retains ALL29 jobs/F1–F4 targets/full unfiltered Rust+Node+core/static/fmt/check/Clippy-Dwarnings/types/lint/build/selected CPU dependencies/actual Node hook JSON capability probe/15-case import guard/MJS runtime+lint/before+after protected tracked+untracked preservation/both PUML syntax+boundsSVG/index/whitespace/content identity. This is one unchanged-input invoice, not summed leaf counts. Normal AND init-failure metadata keep exactly:

```text
full-training-closure
genuine-native-authority
whole-decision-adequacy
calibration
training-readiness
```

Before the gate, the existing training owner/index extended **42→44**, exactly the two actual literals/fingerprint null; current complete-run syntax/bounded-SVG/index44/59 checks PASS. Arena59/all44 other entries/metadata/order/unresolved list/22 notes/FK/stable labels remain preserved. This evidence pass changes none of those verified inputs; note/nav/inventory preflight is separate from29 jobs.
Actual whole unchanged-input3c1a/v8 PASS was followed by ALL3 fresh final F5 read-only reviews, DONE/READY/no findings, then final464-input source3c1a/metadata/preservation checks/restaging and actual publication723e. Later source/config/test/index/PUML changes require their whole gate before rereview. No prior F4 proof/approval or future hash supplies F5 evidence.

### 9.1 Bounded source-to-contract observations

Actual builder precharges entry128/parameter32 before cardinality checks, then existing rules.validate/additional charges and explicit profile-copy reservation before supported-domain checks/vector copies. copy_profile enforces cap12 and income/gas1..3 in addition to generic rules validation; shorter bounded noncanonical profiles remain supported when query indices exist. Native TABLE reads/profile isolation are structural, not canonical native identity/provenance or copied tier authority.
TableBuilder creates ALL794 index-ordered cohorts after60548 precharge, no index-map vector; GrowthMetadata initializes before same-meter F3 m0..4 generation and each one-pass summary. Every group pays its header, nonempty weight uses COMPLETE r, each provided source witness is checked before the four ordered contributions. One prepaid search returns Found/Insert; ordinary additions preserve canonical count BITS/order, qualification pays on every contribution before last_group read.
Global occupied cap precedes distinct growth; paid C controls explicit replacement despite allocator overcapacity. All growth allocation/init/old-copy/metadata fees precede NewVec/copy; std::mem::replace then drop(old) precedes paid metadata/insertion/subsequent cohort growth. Final prepaid validation/move scans canonical rows without sort/shrink/merge. cfg(test) peaks/source audit and safe budget/pointer/error controls support LOGICAL bounds, not physical allocator/RSS instrumentation or D1/full fitter/runtime fit.
source_terms selects ONCE by groups only, uses checked widened private intervals/charged min-opportunity lookups, integer Γ-prefix Z and canonical selected-row N. Qualified N0 remains selected; no L/destination conditioning/full7501 outputs/F3 flow/F4 readout. Borrowed getters/small Debug hide no row/profile rescan or deep clone. No concrete production-to-frozen-API/math/order/fee/cap discrepancy was identified in this bounded inspection; this is not closing review.

<a id="current-f5-evidence"></a>
<a id="92-current-supplied-leaf-evidence--not-a-whole-invoice"></a>
### 9.2 Current complete unchanged-input v8 gate — PASS

Actual lead **sh_14e2aac170016sctMqoSQNOc1j DONE/PASS** produced the [PRESENT receipt.json](/tmp/proveo-opencode-runtime-cache-1000-21d690750d3738af14d58c25/tmp/opencode/rust-training-122836-1792312782177446396-0/receipt.json), read for this update. Parent machine assertions validated the actual receipt/required-target invoice. This is ONE whole F5 run, not stitched leaves or borrowed F4 proof; keeper runs no commands/tests/hashes/renders.

| Receipt field | Actual current value |
|---|---|
| Version / scope |`rust-training-verification-v8` / `native-transition-tables` |
| Status / reviewEligible |`PASS` / `true` |
| error / identityError |`null` / `null` |
| Fixed results |29/29 PASS/exit0/reaped; no timeout/cleanup/reap errors |

```text
inputSha256 == inputSha256After ==
3c1a2ef0ec03043ccb20fb154e58a0936b1b6f9b41e3ac6d6440af9edef3d513
```

| Current unfiltered scope | Actual PASS count |
|---|---|
| Rust workspace/all targets |447 =arena106 +training309 +xtask32 across24 binaries |
| Node engine |189 |
| Native core |668 |

| Required target/filepath | Included count | Purpose; subsets, not extra totals |
|---|---|---|
| `packages/training/tests/transition_tables.rs` |27 |12180 sequence/complete-tuple comparison CASES inside27; all794 cohort indices/all577 D mappings/fractional count BITS/backoff31→32/N0/profile isolation/min growth/Z2307/work |
| `packages/training/src/transition_tables.rs` private units |4 within training library15 |Exact growth metadata fees; cap Found-vs-new; preallocation pointer/old bits; largest replacement/following growth logical bounds |
| Training all targets |309 |278 retained +27 integration +4 private guards; ALL included in447, not added again |
| `tooling/xtask` |32 |Cumulative identity/mutation/delete/exact target/receipt/retained invoice controls; included in447 |
| `packages/training/tests/joint_math.rs` |22 |Retained numeric mask/global normalization/nonrecursive summary controls |
| `packages/training/tests/accounting_kernel.rs` |25 |Retained independent point-flow/support/raw-mass/fee controls |
| `packages/training/tests/feature_input.rs` |29 |Retained ordered innovations/replay/private seed/shared-work controls |
| `packages/training/tests/feature_manifest.rs` |11 |Retained exact418 metadata/oracles/length-gated validation/work |
| `packages/training/tests/learner_math.rs` |24 |Retained scalar/FD/test-only Burn numerical proposal controls |
| `packages/training/tests/ledger_contracts.rs` |42 |Retained closed economic facts/native origin modes/nullability |
| `packages/training/tests/ledger_history.rs` |49 |Retained lineage/accounting/memory/conservation/replay/work |
| `apps/arena/tests/economic_replay.rs` |9 |Retained native economic/terminal closeout correspondence |
| `apps/arena/tests/readiness.rs` |4 |Retained bounded CLI/readiness-negative diagnostics |

All required old/new targets ran nonempty/unfiltered;12180 cases are INSIDE27,27+4 are INSIDE309,309/root32 are INSIDE447. All static/fmt/all-targets check/Clippy-Dwarnings/types/warnings-denied lint/build/selected CPU dependencies/protected tracked+untracked preservation BEFORE+AFTER/index44/59/both PUML syntax+boundsSVG/receipt-time whitespace PASS in that SAME run. Actual Node capability stdout was read: `{"version":"v22.23.2","registerHooks":true}`; all five exact notEstablished families persist.
Allocation/storage assurance remains **SOURCE AUDIT + safe budget/errors/pointers/cfg(test) logical peaks, NOT allocator/RSS instrumentation**, D1/full fitter/runtime-fit admission. Logical capacity limits are not physical memory proof. Canonical fractional counts/supplied numeric witnesses do not establish empirical fit, ancestry/independence/hash selection, native authority, fitted artifacts, full joint/likelihood/spatial support/calibration/readiness.

An earlier test-only explicit_counter_loop lint was resolved with enumerate(), retaining assertions/order without suppression. No production math/API/fee/cap/count-order or numerical assertion was changed to fit a test. Source and execution claims remain distinct: keeper read the complete1154-line production/1876-line test files and root integration, but ran no verification.

<a id="current-f5-closing"></a>
<a id="93-current-fresh-f5-closing-and-capture--verdicts-pending"></a>
<a id="93-current-f5-closing--devops-ready-adversarialsecurity-pending"></a>
### 9.3 Current final F5 closing and capture — ALL3 READY

ALL3 fresh **F5** final read-only reviews are **DONE/READY, findings NONE**, bound to actual3c1a/v8 source/whole proof, not earlier F4 verdicts in the same sessions. **Bounded verification/review/publication is COMPLETE** at723e; no LOW or pending F5 review blocker. These verdicts do not cover F6.

| Reviewer/session | Actual current F5 status |
|---|---|
| Adversarial `ses_eb7cb724effe5uE3Hebn2Gb0wF` |DONE **`READY TO MERGE:yes`**, findings NONE; complete current16-path F5 diff, bounded numeric transition/qualification/backoff/sourceTerms only. |
| Security `ses_eb7cb7218ffePBBBS1MqCmBCtM` |DONE **`READY TO MERGE:yes`**, findings NONE; ALL16/four new/surroundings scope COMPLETE. Validation/widened intervals/qualification+backoff/canonical counts/guarded growth/cap/precharge/partial refusal/authority and actual new29/447 Rust/189 Node/668 core/3c1a receipt+logs/identities inspected; no commands/edits. |
| DevOps `ses_eb7cb7206ffe1XrslbW4r6OyGq` |DONE **`READY TO MERGE:yes`**, findings NONE. Complete16-path scope and PRESENT new v8 receipt+raw logs29/447 Rust/189 Node/668 core/matching3c1a identity/reviewEligible inspected; occupied-cap guard/prepaid copy/growth/insertion/drop OLD/cumulative inputs/nonempty target reviewed. No independent rerun/edits. |

Optional property group/order/cap/budget tests remain non-blocking and **not executed proof**. Approvals remain bounded numeric tables/sourceTerms only: **not allocator/RSS instrumentation, D1/full fitter/runtime fit, native label production/ancestry/hash selection/fitted-artifact authority, calibration or readiness admission**. All five notEstablished families persist; no completed F4 verdict is reused as F5 approval.

After PASS lead explicitly STAGED all16 F5 paths, including4 new files, with cached-whitespace PASS; the complete HEAD-relative snapshot, including ALL new files, was supplied UPFRONT to all three reviewers. Inventory/base-head were read; artifact size/SHA256 below are lead-supplied, not computed by keeper:

| Current closing artifact | Supplied identity |
|---|---|
| `/tmp/proveo-opencode-runtime-cache-1000-21d690750d3738af14d58c25/tmp/opencode/f5-closing-review-OW5Uiw/head.diff` |202942 bytes; SHA256 `d3e123506bad12411d49e856c493d6817b219b854931a5f0ad1f6aa186ffeb9c` |
| Same directory `changed-paths.txt` |16 paths; SHA256 `060fff094fc1be4e9e9e4325c7db107b82184a844c96211cec0fde9b8ba85902` |
| Same directory `base-head.txt` |59e1eff1a10072b6594fff3a65e2e6b3b5ff7a24 |

The complete16-path F5 scope was fully reviewed; source/config/tests/index/PUML bytes stayed unchanged through publication and later Markdown metadata received final checks. **F5 publication is COMPLETE:723e4066618aea7cc9818920b35b1e6e2c79a8cd**. Lead joined464-input source to3c1a, completed final nav/whitespace/protected-scope/exact16/cached checks/restaging, committed/NON-FORCE pushed and verified actual full HEAD=remote/CLEAN checkpoint. [F6 goals](native-joint-accounting.md) follow that publication; no future hash/self-hash loop or F6 proof is invented.

### 9.4 Separate preflight and current handoff

Separate actual lead preflight PASS, **not extra29 invoice jobs**:45 entries/all44 nontraining entries+metadata unchanged, literal44/59 covers/SPEC/file agreement;22 unchanged note bodies/2–5 lines/max46 columns/FK unchanged; historical nav suffixes byte-exact to59e1; expected4 then-new files/clean new+tracked whitespace/protected F3/F4/native/legacy/model/Node/config/dependencies/locks/corpus/evidence preserved. This evidence-only pass changes no notes/index/PUML/protected inputs/normative API/math/count order/fees/caps.
F5 whole3c1a/v8 PASS29/447/189/668, ALL3 final READY/no findings and publication723e are **DONE**. Next selected delivery is [F6 goals/acceptance](../_plans/native-joint-accounting.md), with source/tests/v9 gate/ALL3 fresh reviews/publication planned/not run; no F6 source presence/PASS/future hash or complete-estimator/default-likelihood claim. Five exclusions/trainingReady:false/legacy R4 stops persist; fitted24k belief acceptance remains pretraining, policy training requires separate approval, learned transfer follows training. This goals handoff adds two F6 docs/shared navigation prefixes/small F5 publication metadata only; no source/config/tests/index/PUML/normative F5 math/API/order/fees/caps/commands/tests/hashes/renders/agents/Git/progress polling.
