# F3 — point-source accounting kernels: accepted contracts and reasoning

**2026-10-18 · BOUNDED F3 VERIFICATION/REVIEW COMPLETE · d771 v6 PASS:29 COMMANDS / RUST392 / NODE189 / CORE668 · ALL3 CURRENT FINAL REVIEWS READY, FINDINGS NONE · PUBLICATION AUTHORIZED, NOT EXECUTED · trainingReady:false.**

The [PR plan](../_plans/native-accounting-kernel.md) owns acceptance, ownership, independent tests and gate order.
The complete updated lead-persisted freeze, including final row/profile/storage-endpoint clarifications, was read at:
`/tmp/proveo-opencode-runtime-cache-1000-21d690750d3738af14d58c25/tmp/opencode/f3-accounting-kernel-freeze.md`.
Architect `ses_eb7c5d187ffenpvgElk95FZ8ut` has frozen this point-source foundation; backend/DevOps read-only advisories are DONE/incorporated, with no algebraic contradiction/architecture fork/open ordering choice. This supplies neither execution proof nor a change to the frozen law.
Both actual Rust files/narrow integration were read before freeze; accepted API/accounting law/work profile/exclusions are unchanged. Current complete d771/v6 proof and ALL3 final READY/no findings are actual lead/reviewer results, not keeper reruns. This evidence-only update changes no source/config/tests/index/PUML or normative contract; publication is authorized but unexecuted.

## 1. Actual published prerequisite and scope

The lead actually committed/non-force pushed **bf4d67431d8731b7c69419accece4a63bbd96ba9**,17 files,parent8d908d4c96641403f6161f118458ca66f2305a04; actual post-push HEAD/remote matched and working tree was clean **at that checkpoint**, before these F3 goals. Earlier8d/b47/user4990 remain preserved.
The [completed F2 proof](native-learner-math.md#92-current-complete-unchanged-input-v5-gate--pass) is67a26/v5/458-input source join,29 PASS commands/367 Rust/189 Node/668 core, ALL3 fresh READY/no findings. It is bounded F2, **not F3 proof/full learner/training readiness**.

F3 implements only joint indexing, distinct growth sums, point-source accounting branches, positive headstock/suffix flow for **ONE source point with input mass1**, and independent Boolean point accounting reachability.
It does not implement a complete joint transition, cohort qualification/components247/backoff/evidence likelihood/CC-Marine spatial envelopes, sequence/grant authentication, posterior/global normalization/rebanding/quantiles/temperatures, fitting/artifacts/Float64Hex/labels/collector/permits/full418/geometry transport/container work.
Preserve frozen R3/R4 bodies/Configuration26/Versions21/native engine/legacy/model/Node production/dependencies/pins/fixtures/corpus/evidence. There is no policy-training/activation/deployment grant, new planning allowance or native permission.

<a id="2-exact-planned-typed-api--not-source-presence"></a>
## 2. Exact typed API — implemented point-output library

Reuse existing LedgerRules/LedgerWork/LedgerError. Inputs/outputs below are numeric DATA, not authenticated observations, source cohorts, fitted tables, grants, runtime support authority or scheduler objects. No serialization/production codec is added.

```rust
pub const MATERIAL_CEILING: u16 = 576;
pub const BANK_CEILING: u8 = 12;
pub const JOINT_SIZE: usize = 7501;
#[derive(Clone, Copy, Debug)]
pub struct AccountingPoint { pub material: u16, pub bank: u8 }
#[derive(Clone, Copy, Debug)]
pub enum NumericGrant { None, AtNativeTurn(u32) }
#[derive(Clone, Copy, Debug)]
pub struct PointAccountingInput {
    pub source: AccountingPoint, pub input_turn: u32,
    pub visible_before: u16, pub marines_before: u8, pub witnessed_loss: u16,
    pub destination_lower: u16, pub destination_upper: u16, pub grant: NumericGrant,
}
#[derive(Clone, Copy, Debug)]
pub struct NumericTransitionRow {
    pub spend: u8, pub created: u8, pub wasted: u8,
    pub growth: u8, pub destroyed: u16, pub count: f64,
}
pub enum AccountingError {
    Domain, UnsupportedProfile, NonFinite, Underflow, Work(LedgerError)
}
pub type AccountingResult<T> = Result<T, AccountingError>;
pub struct PointSupport { /* private exactly7501 bools */ }
impl PointSupport {
    pub fn cells(&self) -> &[bool];
    pub fn is_empty(&self) -> bool;
}
pub struct PointAccountingFlow {
    /* private exactly7501 nonnegative masses, support, retained mass, unconditioned Z */
}
impl PointAccountingFlow {
    pub fn masses(&self) -> &[f64];
    pub fn support(&self) -> &PointSupport;
    pub fn retained_mass(&self) -> f64;
    pub fn feasible_tuple_count(&self) -> u32;
}
pub fn joint_index(point: AccountingPoint, work: &mut LedgerWork)
    -> AccountingResult<usize>;
pub fn growth_support(opportunities: u8, work: &mut LedgerWork)
    -> AccountingResult<[bool;33]>;
pub fn accounting_point_support(
    rules: &LedgerRules, input: &PointAccountingInput, work: &mut LedgerWork
) -> AccountingResult<PointSupport>;
pub fn accounting_point_flow(
    rules: &LedgerRules, input: &PointAccountingInput,
    rows: &[NumericTransitionRow], work: &mut LedgerWork
) -> AccountingResult<Option<PointAccountingFlow>>;
```

Support/masses are private fixed-length7501 results exposed by borrowed slices/readouts, not public unchecked posterior/state constructors. Actual empty/retained/Z fields are cached at construction for O(1) readouts, no hidden uncharged rescans. Staged private results return only on success; errors expose no partial support/flow. Eliminated source flow is None, not a valid normalized posterior.

## 3. Domain checks and native-derived rule boundary

Let D/B be source material/bank; V=visible_before, Np=marines_before, L=witnessed_loss, lo/hi destination bounds. Before proportional row work/allocation, precheck:

```text
0 ≤ D ≤ 576; 0 ≤ B ≤ 12
V ≤ D
Np ≤ 64 and Np ≤ V
0 ≤ lo ≤ hi ≤ 576
L ≤ 617
rows.len ≤ 8192
joint_index(D,B) = 577*B + D
```

Typed unsigned fields do not excuse arithmetic checks or out-of-range validation. Opportunities for growth_support are0..4; mask indices0..32 represent numeric growth, not counts of construction paths.
Validate every row against these exact **GLOBAL** constraints, independently of whether it can occur from THIS source:

```text
s,c,w ∈ 0..9; g ∈ 0..32; d ∈ 0..617
0 < count ≤ 14400, finite binary64
s ∈ {0,1,3,5,9}; c ∈ {0,s}; w=s-c; g even
STRICT unique lexicographic order (s,c,w,g,d), EXCLUDING count
rows.len ≤ 8192
```

Three gates stay distinct: **global validity→THIS-source feasibility→L/destination conditioning**. Globally valid but source-infeasible rows are ignored for N/scatter, not Domain; source-feasible rows excluded by L/destination still contribute N/Den. Validate global domains/order/counts for ALL inspected rows even if retained support will be empty. Counts cannot disguise duplicate tuples.
F3 has no cohort descriptor. The separate fitted-table requirement that a row be feasible for at least one cohort source (correctiveA1) is **not this numeric API's qualification rule**; do not call these rows a validated fitted model or impose a guessed source/cohort restriction.
Existing LedgerRules.validate uses the **same work**, charges additional, and is necessary but insufficient for the F3 profile: require bankCap12 and **BOTH gas and nominal-income tiers1..3**. Lower bank cap or income0 may pass generic ledger validation but are UnsupportedProfile here. Read gas_capacity_at(input_turn)/income_at(grant_turn) from tables, not a Rust tier formula/piece-price authority.
Do **not** require max_turn==45 or canonical table bytes; existing validated bounded lengths/indices apply. AtNativeTurn(t) is numeric lookup only: no t==input_turn+1, settlement/stale/duplicate/grant-provenance claim. Rules validation is structural, not native authority; no source signature/cost-table capture is introduced.
Visible material/Marine count/destination bounds will later need genuine bound authorized adapters; a caller-provided number does not prove an observation. F3 does not value native pieces or replace native admission/cost helpers.

## 4. Frozen distinct accounting law

Use the accepted [accounting relaxation in amendment §4](../_plans/ml-adjutant-r4-economic-amendment.md#4-boundary-updates-and-accounting-support), without changing its frozen body. e is the native-derived public gas tier for the numeric input:

```text
s ∈ {0,1,3,5,9}, s ≤ B
c ∈ {0,s}; (s=0,c=0) appears ONCE
w = s-c
M = min(4, 1+e-I(s>0), Np+D-V+I(c=1))
g ∈ Γ_M
J = D+c+g
max(0,J-576) ≤ d ≤ J
D' = J-d
B' = B-s                         if NumericGrant::None
B' = min(12,B-s+nativeIncome(t))  if AtNativeTurn(t)
```

ΓM contains **distinct numeric sums of up toM increments from{0,2,4,8}**, M≤4. Padding unused opportunities with0 gives the same set. Boolean DP deduplicates paths; two sequences producing the same g do not create separate `(s,c,w,g,d)` tuples or extra pseudocount.
Every `(s,c,g)` branch defines one w/all valid d; different branches reaching the same destination still contribute separately when complete tuples differ. **617 is a STORAGE/row-domain ceiling, not a reachable-J assertion**: supported e≤3 and positive spend give M≤3/g≤24, so feasible J≤609; s0 gives J≤608. Material outputs remain0..576/bank0..12. Never fabricate feasible spend9+growth32 to reach617; that globally valid row can be THIS-source infeasible.
This is a **frozen statistical conservative relaxation**, not exact hidden-board legality or an alternative authoritative price/deployment/promotion rule. No private native labels supply runtime support.

## 5. Positive point-source flow and independent support

### 5.1 Unconditioned source normalizer

Source mass is implicitly1. F(x) is the complete **distinct source-feasible tuple set BEFORE L/lo/hi filtering**:

```text
Z = |F(x)|
N = sum(count(row) for globally valid SOURCE-FEASIBLE rows)
Den = N + 0.5*Z
```

Equivalently each distinct `(s,c,g)` branch contributes `min(J,576)+1` valid d values to Z. feasible_tuple_count() exposes this **unconditioned** Z, never retained destination count.
Source-infeasible rows contribute neither N nor scatter, but every inspected row still validates globally/orders/counts and pays its scanning charges. Duplicate/count rows cannot multiply a source tuple.
**Never recompute Den after L or destination filters.** Source-feasible rows filtered from destinations remain in N; globally valid source-infeasible rows do not. Empty rows give an alpha-only numerical kernel, not a fitted/calibrated/cohort-qualified model.
Exact oracle example: D3/B0/V3/Np0/e1 givesM0/g0/J3/Z4. Sparse row(0,0,0,0,d0,count2) givesN2/Den4; L2 and dest0..1 retain.125 each/total.25, **not.5 or1**. A globally valid spend1 row at B0 still validates/pays scans but adds no N/scatter.

### 5.2 Headstock/sparse scatter/positive suffix

```text
for each DISTINCT (s,c,g):
    headstock[B',J] += 0.5/Den
for each SOURCE-FEASIBLE row:
    if d ≥ L: sparse[B',J-d] += count/Den
descending POSITIVE suffix reduction over material0..617
apply L and destination bounds, retaining UNNORMALIZED evidence mass
```

The alpha contribution at output material r uses positive suffix at r+L, within0..576/lo..hi, encoding d=J−r≥L without subtraction. Compute r+L with **widened checked arithmetic** (up to1193); if>617 use zero BEFORE indexing, never panic/wrap. Sparse rows retain their explicit d and the same denominator.
Unconditioned full flow totals1 within1e−12. Conditioning on witnessed-loss/destination bounds may reduce retained_mass(), but output is **not renormalized**. No posterior/global-normalization API exists here.
Reject nonfinite arithmetic and actual positive division/product underflow; never silently drop tiny contributions. A computed min-positive row count/Den underflow must fail **even when alpha background mass is positive**. Nonempty Boolean support/numeric-zero mass also fails. Eliminated support yields None only after required row validation, not a way to hide malformed rows or call a zero posterior valid. No partial output escapes on errors.
Later joint evaluation must aggregate source contributions **before global normalization** and handle aggregate-zero refusal. It must not loop F3's full7501-lane output allocations once for every one of7501 source states; this point API is not that complete evaluator.

### 5.3 Boolean accounting support is not model support

accounting_point_support accepts **NO rows/counts**. Its OR branches use only the accounting law/native-derived grant/L/destination constraints, never numeric masses, count/model zeros, temperature or fitting qualification.
Flow may share branch construction with support, but support bits are independently Boolean, never derived from `mass>0`. Valid count changes may alter masses, **never support**.
PointSupport is only point-source accounting reachability, **not EconomicBeliefState.publicSupport**. It omits spatial/evidence/CC/Marine constraints and cannot establish native truth containment or complete transition authority.

### 5.4 Numeric grant and call sequencing are hypothetical

Each call computes a new numeric hypothesis; each branch applies at most **one explicit supplied NumericGrant**. No retained source/episode/boundary state, grant cache, duplicate/stale/session selector or scheduler exists.
None is no grant; AtNativeTurn selects table arithmetic, not authenticated settlement chronology. Observational/native-adapter/grant binding remains **NOT AUTHENTICATED**. Turn-open must not call this settled kernel as an economic state advance.

## 6. Exact shared work profile — native-accounting-kernel-work-v1

All calls use caller **SAME LedgerWork**, with no constructor/reset/refill/new allowance/refund. Existing rules-validation charges remain additional. AccountingError::Work preserves all already-spent work; failure publishes no partial data.
Precharge **before covered scans, fixed STACK initialization, heap allocation/initialization, copies or mutations**, using checked metadata/fixed bounds. Recalculation is charged again, even for a repeated branch/helper path. Readout/convenience rescans must not hide extra work; source audit must account actual loops/order, not only final invoice equality.

| Block | Frozen engineering units |
|---|---|
| Public entry/header |128 |
| Bounded parameter/index arithmetic block |32 |
| Existing rules validation |Existing charges, additional |
| Scalar/bool buffer initialization, including stack |4/lane |
| Heap buffer allocation |192 each |
| Γ DP attempt |32 |
| Accounting branch visit, each recalculation |64 |
| Row validation/order/feasibility pass |64/row |
| Feasibility flags initialization |4/row |
| Sparse scatter pass |32 per INSPECTED row, including infeasible/skipped rows |
| Combined numerical/Boolean suffix lane |16 |
| Destination mass/support/reduction lane |24 |

| Fixed physical bound | Size |
|---|---|
| Bank/headstock lanes |13×618=8034 |
| Output joint lanes |13×577=7501 |
| Γ masks |5×33 |
| Sparse rows |≤8192 |

8192 is a **physical input ceiling**, not a guarantee it fits the remaining1048576 allowance. A maximum-sized request may legitimately return Work/BUDGET; never truncate rows/support, return a prefix/partial flow, raise a cap or reset the meter.
Independent invoice/exact/one-below tests must cover before allocation/rows/scatter/suffix/destination, and safe test-only effects/source audit must substantiate ordering. Do not add a new unsafe allocator or public production observer merely for these tests.
This is a bounded engineering work profile, **not D1 scalar-invoice or complete per-decision adequacy proof**. Frozen inclusive1048576 pending-history+all-candidate economic/features,10-second transaction/300-second lifecycle including3 cleanup and separate generator2048 limits remain unchanged. The verifier's600-second command timeout does not replace production10/300 limits.

<a id="7-independent-oracletest-requirements--not-run"></a>
<a id="7-independent-oracletest-controls--implemented-supplied-numerical-leaves-pass"></a>
## 7. Independent oracle/test controls — included in current complete v6 PASS

Actual `packages/training/tests/accounting_kernel.rs` independently enumerates growth **sequences**, dedupes numeric growth/COMPLETE tuples, explicit d/direct weights. Γ2 growth8 from0+8/8+0/4+4 is ONE numeric growth/one tuple pseudocount. Expected values use no production branch/suffix helper or legacy normalization, preserving raw evidence mass.
Compare **every7501 mass lane/support bit**, not selected coordinates/dimension. Exhaust D0..4/B0..3/all3 gas tiers/all validV,Np; retain D576/B12,617 STORAGE/index/row bounds, actual feasible J≤609 and guarded r+L beyond617. Test globally valid spend9/growth32 as source-infeasible, not fake reachable617; table-driven grants/no-grant/cap and bounded noncanonical profiles remain numeric, unauthenticated.
Required controls include repeated growth explanations/zero-spend c0 once, Den unchanged under L/bounds, globally valid but source-infeasible rows, valid count changes/mass vs invariant support, empty retained support None vs underflow/zero numeric refusal, malformed order/duplicates/NaN/∞/nonpositive/count caps, same-meter refusal before all covered operations and no partial/truncated output.
Native income/gas **table changes** must affect arithmetic; copied Rust tier formulas do not pass. Reuse the unchanged native rules golden only as **STRUCTURAL test data**, not actual native execution, true source containment or an authenticated observation/grant.
Independent tests and source audit must demonstrate every charged block and precharge order, not create an artificial no-budget-excess dataset or infer process/runtime adequacy from a logical counter. STOP on law/oracle disagreement, uncovered real work or silent truncation; do not repair the frozen contract around a bug.

## 8. Deferred estimator/authority/readiness boundaries

This slice omits the complete joint source PMF/prior/components247/cohort qualification/backoff, innovation/evidence likelihoods, CC/Marine spatial envelopes/anonymous support, Bayesian normalization/rebanding/quantiles/temperatures, fitted artifact/Float64Hex/codecs, private labels/collector/permits/eligible markers, full418 encoding, geometry transport/source capture/cache and container/runtime closure.
Full belief/features/software/resource/authority and frozen24k-group belief-fit acceptance remain before separate policy-training approval. Actual policy SGD/formal primary require separate approval; learned transfer/admission follows training, not a circular pre-training prerequisite. Activation/deployment remain separate; legacy R4 N1–N7/M2/inventory/public-closure/authority stops remain unwaived.
Prior geometry/dense arithmetic over-cap counterexamples reject **those naive schedules**, not the design globally. No current ordering/resource-amendment fork exists, no budget exemption is granted, and trainingReady:false remains unchanged.

<a id="9-planned-identity-gate-and-current-handoff"></a>
## 9. Actual source, integration and current evidence limits

Both assigned new paths now exist, were read completely and have top-line pointers to the existing training owner:

```text
packages/training/src/accounting_kernel.rs
packages/training/tests/accounting_kernel.rs
```

Actual lib.rs exports pub mod accounting_kernel without altering the retained scorer. Root uses shared v6/native-accounting-kernel constants in normal+init receipts/assertions and accurately scoped README text. Cumulative REQUIRED adds both accounting files and mutation/restore/delete controls while **retaining all12 F1/F2 inputs**; exact nonempty token tests/accounting_kernel.rs joins the existing missing/zero/lookalike/name-summary guards, with no parser redesign/new test-total prediction.
Retain ALL29 old checks/F1+F2 controls/full unfiltered old+new Rust/Node/core, actual Node registerHooks JSON probe, MJS runtime+lint/15-case geometry import guard, static/build/dependencies/before+after protected tracked+untracked preservation, both owner syntax+boundsSVG/index/whitespace and matching content-derived before/after identity. No new readiness command/dependency/Node/config/timeout extension/backend/allowance.
Actual current complete receipt metadata is **`rust-training-verification-v6` / `native-accounting-kernel`** (§9.2); normal AND initialization-failure paths retain exactly:

```text
full-training-closure
genuine-native-authority
whole-decision-adequacy
calibration
training-readiness
```

Actual complete unchanged-input d771/v6 PASS was followed by ALL3 fresh final F3 read-only reviews, now DONE/READY, findings NONE. Source/config/test/index/diagram changes require whole gate again before rereview; final metadata/preservation checks still precede the authorized, unexecuted publication. F2's67a26/v5 approvals are not current F3 evidence.
Before the gate, the two actual math/kernel-file edges were added to the training owner/index,38→40/fingerprint null; arena59/its entry/all44 nontraining entries/unresolved metadata remain preserved. Stable cumulative verifier labels were fixed before PASS. This evidence update creates no source/fixture/dependency/data/owner or index/PUML change.
Backend's earlier source inspection found the one-deployment premise consistent with native/frozen dependencies but executed no containment experiment; the current independent oracle also remains numerical/structural, not native truth or fitted qualification.

### 9.1 Bounded source-to-contract observations

Actual parameters precharge entry/header and bounded arithmetic before row-proportional work, use existing rules.validate/same meter plus the additional nominal-income profile scan, then read gas_capacity_at(input_turn)/income_at(grant_turn) TABLE values. Validation is structural, never native-source/grant provenance. No price/tier formula or chronology authority is substituted.
Global row-domain/strict tuple ordering checks precede THIS-source placement; globally valid source-infeasible rows are scanned/charged but omitted from N/scatter. Source-feasible rows populate N before any L/destination filter. Initial branch enumeration computes unconditioned Z/retained Boolean feasibility; eliminated support returns None only after required row checks and before numeric output allocation.
Nonempty flow uses staged alpha headstock/independent Boolean stock, separate positive sparse ratios, another charged branch pass, descending combined numerical/Boolean suffix and final mass/support reduction. Cached empty/retained/Z readouts are constant-time. Underflow refuses even against positive background; no partial output, reset, allowance or silent truncation.
Source audit confirms growth fixed-stack precharge before initialization; heap/flags/rows/scatter/suffix/destination reservations precede covered work and branch recalculations bill again. Safe budget/error observations and independent fee traces supplement this audit; no allocator instrumentation/unsafe allocator or public production observer was introduced. These observations are not D1 or full-window/candidate resource admission.
No concrete mismatch with the accepted F3 API/accounting law/work profile was identified in the inspected surface. That is not adversarial/security/DevOps closing or actual native execution/truth containment.

<a id="92-supplied-actual-component-results--not-a-whole-invoice"></a>
### 9.2 Current complete unchanged-input v6 gate — PASS

Actual lead **sh_14dcdf198001MIN353I1aw9kon DONE/PASS** produced the [PRESENT current receipt.json](/tmp/proveo-opencode-runtime-cache-1000-21d690750d3738af14d58c25/tmp/opencode/rust-training-84286-1792306705120615084-0/receipt.json), read for this update. This is one actual same-input F3 run, not stitched leaves or borrowed F2 proof; keeper runs no commands/tests/hashes/renders.

| Receipt field | Actual current value |
|---|---|
| Version / scope |`rust-training-verification-v6` / `native-accounting-kernel` |
| Status / reviewEligible |`PASS` / `true` |
| error / identityError |`null` / `null` |
| Fixed command results |29/29 PASS/exit0/reaped, no timeout/cleanup/reap failure |

```text
inputSha256 == inputSha256After ==
d77127d001d2b5a4aa6a40f19f9b4b8a961b68bff798a0507e80f9f42fcf13d3
```

| Current unfiltered scope | Actual PASS count |
|---|---|
| Rust workspace/all targets |392 =arena106 +training254 +xtask32 across22 binaries |
| Node engine |189 |
| Native core |668 |

| Required target filepath | Nonempty count | Purpose; subset of totals |
|---|---|---|
| `packages/training/tests/accounting_kernel.rs` |25 |Independent direct sequence/dedup/complete-tuple point-flow/support oracle and exact safe work/error controls |
| `packages/training/tests/feature_input.rs` |29 |Retained ordered structural inputs/innovations/private seed/replay/atomic work |
| `packages/training/tests/feature_manifest.rs` |11 |Retained exact418 metadata/oracles/length-gated validation/allocation/work |
| `packages/training/tests/learner_math.rs` |24 |Retained independent scalar/FD/test-only Burn numerical proposals, not policy training |
| `packages/training/tests/ledger_contracts.rs` |42 |Retained closed economic facts/required modes/nullability |
| `packages/training/tests/ledger_history.rs` |49 |Retained lineage/accounting/memory/conservation/replay/work |
| `apps/arena/tests/economic_replay.rs` |9 |Retained native economic/terminal closeout correspondence |
| `apps/arena/tests/readiness.rs` |4 |Retained scoped CLI/readiness-negative diagnostics |

All required targets ran nonempty/unfiltered; rows above are included subsets, not extra tests added to392. All static/fmt/all-targets check/Clippy-Dwarnings/types/warnings-denied lint/build/selected CPU dependencies/locks/protected tracked+untracked preservation **before and after**, both PUML checkonly+boundsSVG/index40/59/receipt-time whitespace PASS. Actual Node capability stdout was read: `{"version":"v22.23.2","registerHooks":true}`; all retained F1/F2 guard/runtime controls remain in scope.
The current receipt carries the exact five unchanged notEstablished families: `full-training-closure`, `genuine-native-authority`, `whole-decision-adequacy`, `calibration`, `training-readiness`. Current point-source output remains numeric DATA/raw retained mass, not full posterior/publicSupport/fitted qualification/native truth/D1/full-window or learner/readiness admission.
Accounting25 contains420 source combinations/2520 flow cases/840 standalone support comparisons, every7501 lane/bit or None on elimination; unconditioned totals1±1e−12 and exact.125+.125=.25 retained fixture. Domain/profile/order/count/underflow/grant TABLE/J≤609/storage617/widened r+L1193 controls and independent fee traces/one-below/prior-work/8192-row BUDGET refusal passed. Allocation ordering remains **source audit+safe budget/error observations, NOT instrumentation**; no partial/truncated output/new allowance is admitted.

<a id="93-current-f3-closing-and-capture"></a>
<a id="93-current-fresh-f3-closing-and-capture--verdicts-pending"></a>
### 9.3 Current F3 closing and capture — ALL3 READY

All three fresh **F3** final read-only reviews are now **DONE/READY, findings NONE**, bound to actual d771/v6 source/whole proof, not old F2 approvals. **Bounded point-kernel verification/review is COMPLETE; no pending review blocker.** Publication remains separately authorized/unexecuted.

| Reviewer/session | Actual current F3 status |
|---|---|
| Adversarial `ses_eb7cb724effe5uE3Hebn2Gb0wF` |DONE **`READY TO MERGE:yes`**, findings NONE; complete16-path diff, bounded point accounting only. |
| Security `ses_eb7cb7218ffePBBBS1MqCmBCtM` |DONE **`READY TO MERGE:yes`**, findings NONE; scope COMPLETE all16/four new/surrounding source. Bounds/tuple uniqueness/index/finite+underflow/count-independent support/shared-meter precharge/partial refusal and current29/392/189/668/d771 receipt+logs inspected; read-only/no commands or edits. |
| DevOps `ses_eb7cb7206ffe1XrslbW4r6OyGq` |DONE **`READY TO MERGE:yes`**, findings NONE; complete16 scope/current actual v6 receipt+raw logs/29/392/189/668/matching d771, stack/row/heap precharge/cumulative required inputs+target inspected; no independent rerun/edit. |

Optional malformed-row/budget fuzzing remains non-blocking and **not executed proof**. These approvals establish only the identified numerical point primitive, not posterior/full publicSupport/fitted qualification/native truth/D1/full-window/runtime/calibration/readiness admission; all five notEstablished scopes persist.

Lead explicitly staged the complete16 F3 paths, including4 new files, and cached-whitespace PASS after the gate; source/config/tests/index/PUML bytes stayed unchanged. All current reviewers received the full capture upfront against publishedbf4d. Artifact identities below are lead-supplied, not generated/hashed by keeper:

| Current F3 capture artifact | Supplied identity |
|---|---|
| `/tmp/proveo-opencode-runtime-cache-1000-21d690750d3738af14d58c25/tmp/opencode/f3-closing-review-2VNKcI/head.diff` |152517 bytes; SHA256 `1ea04bd675a4da25e21535abe94f67ad60bfd25c96e9efd2c87cf057f02c1b45` |
| Same directory `changed-paths.txt` |16 paths; SHA256 `889f415ff317521ab8cc71b143f3ece50332a0333c32cc22a0de0f2b1c975c89` |
| Same directory `base-head.txt` |bf4d67431d8731b7c69419accece4a63bbd96ba9 |

This current16-path scope is fully reviewed; later Markdown status metadata may be newer, but no source/config/test/index/PUML byte changed after PASS. **F3 publication is AUTHORIZED BUT NOT EXECUTED**. Lead will read final docs, join current source d771/navigation suffixes/whitespace/protected scope, restage explicit16, commit/non-force push and verify actual remote/clean publication. HEAD remains publishedbf4d until an actual later commit; no future hash/self-hash loop or current F3 push is invented. No F4 repo docs/source are assigned or created before actual F3 publication.

## 10. Current coverage, notes and next gate

Current covers remain training**40**/arena**59**, index45/all44 nontraining entries/top metadata/order/unresolved list preserved. Both actual kernel-file edges were added before the current complete gate; this evidence-only pass edits no source/config/tests/index/PUML/coverage.
Separate lead preflight PASS, **not extra29 invoice commands**: literal cover/pointer/file agreement,45 entries/all44 nontraining metadata unchanged,22 old notes byte-unchanged/2–5 lines/max46 columns, historical PLAN suffix4+ and README first2+suffix6+ unchanged to bf4d, exact4 then-new files/no whitespace, protected native/legacy/model/Node/config/dependencies/locks/corpus/evidence unchanged. No new/reworked note or FK estimate; both actual syntax/bounded SVG/index/identity/receipt-time whitespace PASS belong to the current whole v6 run.
Next: lead final metadata/preservation/current-source join, restage16 and perform the authorized verified publication. Current d771 whole PASS29/392/189/668 and ALL3 final READY/no findings are DONE; no pending review blocker, actual F3 commit/push or future hash is claimed. F2 bf4d/67a26 remains only the completed base. Any source/config/test/index/diagram change after PASS requires the entire gate again before reviews; no F4 repo work is created here.
This update touches only the two F3 Markdown documents/shared navigation prefixes, evidence/status only; normative law/API/work units/authority/resource exclusions stay unchanged. No commands/tests/hash/render/agents/reviews/Git/progress polls run. Historical suffixes remain untouched, all five notEstablished gaps/unauthenticated inputs+grants/raw point-output scope/trainingReady:false unchanged.
