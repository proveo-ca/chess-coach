# F4 — checked numerical joint math: accepted contracts and reasoning

**2026-10-18 · BOUNDED F4 VERIFICATION/REVIEW/PUBLICATION COMPLETE ·721e v7 PASS:29 COMMANDS / RUST416 / NODE189 / CORE668 · ALL3 FINAL F4 REVIEWS READY, FINDINGS NONE · PUBLISHED59e1eff1 / MATCHED HEAD=REMOTE / CLEAN AT CHECKPOINT · trainingReady:false.**

Lead committed/non-force pushed **59e1eff1a10072b6594fff3a65e2e6b3b5ff7a24**, `feat(training): add checked joint normalization and readout`,16 files,parent29018157e40bb11d558599a21409623bfbec1a83. Before commit, the462-input current-source identity joined721e; final navigation/preservation/whitespace/exact16 checks passed. Actual post-push local HEAD/remote matched full59e1 and tree was CLEAN **at that checkpoint**, before [F5 goals](native-transition-tables.md); bounded F4 publication establishes no F5/readiness proof.

The [PR plan](../_plans/native-joint-math.md) owns acceptance, file ownership, independent tests and gate order.
The complete80-line accepted architect/backend/DevOps freeze was read at:
`/tmp/proveo-opencode-runtime-cache-1000-21d690750d3738af14d58c25/tmp/opencode/f4-joint-math-freeze.md`.
Architect `ses_eb7c5d187ffenpvgElk95FZ8ut` and final static clarifications establish no unresolved ordering/semantic fork. Both actual Rust files/lib/root integration were read before freeze; accepted API/math/1e−12 tolerance/work profile are unchanged. The [existing training owner](../packages/training/burn-compat.puml) documents structure; [complete v7 proof](#current-f4-evidence), ALL3 final READY/no findings and publication59e1 are actual lead/reviewer results, not stitched leaves/F3 approval or keeper reruns. This publication-status update changes no source/config/tests/index/PUML or normative contract.

## 1. Actual published prerequisite and scope

The lead actually published **29018157e40bb11d558599a21409623bfbec1a83**,16 files,parentbf4d67431d8731b7c69419accece4a63bbd96ba9, by successful non-force origin push; post-push HEAD/remote equality and clean status were confirmed **at that checkpoint**, before these F4 goals. Earlierbf4d/8d/b47/user4990 remain preserved.
The [completed F3 base](native-accounting-kernel.md#92-current-complete-unchanged-input-v6-gate--pass) retains460-input d771/v6 source join,29 PASS commands/392 Rust/189 Node/668 core and ALL3 current READY/no findings. That is bounded F3, **not F4 proof or readiness**.

F4 checks a supplied7501-cell numeric joint/mask, normalizes caller-ALREADY-aggregated/observation-restricted masses once and computes readout-only temperature/means/quantiles/balance/material uncertainty.
NumericSupport is **not authentic publicSupport/native truth**. NumericJoint is not a posterior-transition/state authority or fitted/calibrated artifact. The API cannot authenticate upstream aggregation, observation restriction, source qualification or grant chronology.
No source aggregation/joint prediction/cohort/backoff/likelihood/spatial support/components247/rebanding/labels/collector/permits/full418/geometry/container or new allowance is implemented here. Preserve F3 source/law, frozen contracts/Configuration26/Versions21/native/legacy/model/Node/dependencies/pins/labels/corpus/evidence; no actual policy-training/activation/deployment grant.

<a id="2-exact-planned-api-and-private-ownership"></a>
## 2. Exact implemented API and private ownership

Reuse F3 canonical dimension/index constants/layout:577×bank+material, D0..576/B0..12/N7501. Potential D+B ranges0..588. Reuse caller LedgerWork/LedgerError, not a new meter/source permission.

```rust
#[derive(Debug, PartialEq, Eq)]
pub enum JointMathError {
    Shape, Domain, NonFinite, Underflow, EmptyMass, EmptySupport, Work(LedgerError)
}
pub type JointMathResult<T> = Result<T,JointMathError>;
#[derive(Clone, Copy, Debug, PartialEq, Eq)]
pub struct NumericCertainty {
    pub material: Option<u16>, pub potential: Option<u16>,
}
pub struct NumericSupport { /* private7501 bools + cached certainty */ }
impl NumericSupport {
    pub fn from_cells(cells: &[bool], work: &mut LedgerWork) -> JointMathResult<Self>;
    pub fn cells(&self) -> &[bool];
    pub fn certainty(&self) -> NumericCertainty;
}
pub struct NumericJoint { /* private7501 normalized masses + owned NumericSupport */ }
impl NumericJoint {
    pub fn probabilities(&self) -> &[f64];
    pub fn support(&self) -> &NumericSupport;
}
#[derive(Debug)]
pub struct ReadoutTemperature { /* private checked index/value */ }
impl ReadoutTemperature {
    pub fn from_index(index: u16, work: &mut LedgerWork) -> JointMathResult<Self>;
    pub fn index(&self) -> u16;
    pub fn value(&self) -> f64;
}
#[derive(Debug, PartialEq)]
pub struct NumericReadout {
    pub mean_d: f64, pub mean_potential: f64,
    pub quantiles_d: [u16;4], pub quantiles_potential: [u16;4],
    pub balance: f64, pub uncertainty: f64,
}
pub fn normalize_aggregate(
    masses: &[f64], support: &NumericSupport, work: &mut LedgerWork
) -> JointMathResult<NumericJoint>;
pub fn readout_copy(
    joint: &NumericJoint, own_replacement: u16,
    temperature: &ReadoutTemperature, work: &mut LedgerWork
) -> JointMathResult<NumericReadout>;
```

Private support/joint/temperature invariants are established by these checked constructors only, with borrowed O(1) readouts and no hidden rescans. No unchecked state/authority field, deep-copy Clone without work, serialization/Float64Hex/codec/artifact/boundary/permit/source reference is added. NumericCertainty's trivial Copy does not authorize cloning7501-cell buffers.
Normalization owns its detached probability/mask copies and cached certainty; original mask mutation cannot affect the owned result. readout_copy returns ONLY a small summary, not a tempered joint exposed for recursive state feedback.

## 3. Numeric supplied support and target certainty

NumericSupport::from_cells requires **exactly7501 bools and at least one true cell**. Shape rejection precedes proportional scan/allocation; empty valid-length mask is EmptySupport after the reserved work.
Scan **EVERY true supplied cell**, including cells whose current/later PMF is zero. Cache target certainty independently for D and P=D+B: a target is Some(integer) iff every true cell shares that integer; otherwise None. Once a differing value appears, variation is irreversible—later cells matching an earlier value cannot restore certainty. Keep unseen versus varied state distinct internally.
This is certainty of the **numeric supplied mask**, not a claim the mask came from the real count-independent public-support algorithm or contains native truth. Broad mask plus model point mass is **not certain**; fitted zeros/temperature cannot prune supported states.

| Mask states (D,B) | Numeric certainty |
|---|---|
| (4,0),(4,12) |D Some4/P None |
| (4,0),(0,4) |P Some4/D None |
| Singleton(576,12) |D Some576/P Some588 |
| Vary both targets |Both None, even if PMF is a point mass |

certainty() is cached/O(1). No unmetered deep copy or convenience getter scan is used to recreate these invariants.

## 4. One global normalization of already aggregated masses

normalize_aggregate requires exact7501 masses, all finite/nonnegative, **every positive mass inside supplied support**, finite total>0. Signed zero is zero, not a new rejection/codec rule. All-zero numeric mass is EmptyMass, distinct from empty Boolean support.
Traverse bank then material, sum direct input masses, divide each ONCE by the positive total, reject positive division underflow and require normalized sum1±1e−12. Reject nonfinite/negative/outside-mask input and nonfinite total; no overflow-rescue scaling, clipping, flooring, dropping, residual patch or implicit per-source normalization.

```text
total = Σ_j alreadyAggregatedRestrictedMass[j]
p[j] = mass[j] / total
```

The caller must have aggregated source contributions/restricted observations already; successful numeric checking cannot authenticate that history. Concrete distinction: prior(.5,.5), sourceA retained.25 atD0/sourceB1 atD1 produce aggregate(.125,.5); global normalization gives(.2,.8), **not(.5,.5)** from separately normalized sources.
raw(2×f64::MAX) has an overflowing total and MUST fail, even if a rescaled ratio could be manufactured. raw(2,minSubnormal) must refuse positive division underflow, not silently turn the tiny positive into an original zero or remove its support.
Owned NumericJoint stores the established normalized invariant; readout does not normalize that input a second time. The normalized result/mask remain numeric data, not a complete estimator/posterior transition.

## 5. Readout-only temperature and nonrecursive summaries

### 5.1 Checked index and private tempered scratch

ReadoutTemperature::from_index accepts0..1000:

```text
τ(i) = .25 * 16^(i/1000)
τ(0) = .25 exactly; τ(1000) = 4 exactly
for positive p[j]: l[j] = ln(p[j]) / τ
m = max positive l[j]
e[j] = exp(l[j]-m)
pτ[j] = e[j] / Σ e
```

All1001 indices follow the monotone formula/exact endpoints; algebraic anchors include.5/1/2 at250/500/750. Index is numeric choice only, not fitted/calibrated temperature authority.
Use **one privateN scratch** for log/max→exp/total→division, preserving original zeros. Reject positive exp/div underflow and nonfinite arithmetic **even when another cell retains mass**; never floor/drop/prune a tiny positive cell or change source support.
Dominant+tiny positive valid joint atτ.25 must refuse when exp/div underflows; τ4 retains the tiny positive. Normalize-sum tolerance1e−12 applies to input/tempered/marginals in already charged passes; private NumericJoint owns the input invariant, so do not renormalize it again or add an unbilled scan.
Joint probabilities/support must stay **BITWISE unchanged, including−0 sign**. No new Float64Hex/signed-zero canonicalization rule exists here. τ1 private scratch need not reproduce source bits after log/exp, but the source joint MUST remain identical.
Return **ONLY NumericReadout**. No tempered NumericJoint/state/API escapes that could recurse into the next transition; callers receive no new boundary/source/native permit.

### 5.2 Marginals, quantiles, means, balance and uncertainty

Build D marginal577 bins0..576 and P=D+B marginal589 bins0..588 (M1166 total). Preserve their normalized sums within1e−12 using charged passes, without residual repair or model-zero support inference.

```text
quantile output order = [.05, .95, .025, .975]
q(target,a) = smallest integer with ascending CDF >= a
mean_d = Σ_D D * marginalD[D]
mean_potential = Σ_P P * marginalP[P]
balance = own_replacement - mean_d
uncertainty = (q(D,.975)-q(D,.025)) / 2
```

Quantiles preserve frozen array order, not sorted probability order. Repeated target records/gaps/exactCDF equality must choose the smallest reaching integer. Means are expectations, **not modes/medians/midpoints**; uncertainty uses MATERIAL interval only, never potential interval.
own_replacement must be≤576, checked after header before proportional work. It is a supplied numeric value, **not a calculation of actual own pieces or CC exclusion**; genuine bound valuation remains future adapter work.
Actual readout computes finite-checked compensated weighted means during the SAME canonical bank/material N-pass that builds both marginals. Compensation uses scalar state, no secondN scan/heap buffer or marginal rescan, and leaves the accepted16N block/total fees unchanged. The mean formulas above state the mathematical expectations, not an extra implementation pass.
For a supplied-mask-certain target ONLY, compute ALL quantiles first, then certain_mean checks every corresponding quantile against that cached integer; mismatch refuses NonFinite, **never fills/repairs the quantiles**. Only after that check does its mean become the exact integer. Never derive certainty from a point PMF/zeros/temperature or bypass normalization/nonfinite/underflow checks. Singleton(576,12) gives exact576/588; equalD0/D576 mass gives material uncertainty288.

## 6. Exact precharge profile — native-joint-math-work-v1

Caller SAME LedgerWork, frozen inclusive1048576/no new constructor/reset/refund/allowance/cache/hidden startup. Reserve before covered stack/heap initialization/allocation/scan/copy/math/mutation; **unused reserved work remains spent**. Source audit plus safe budget/error observations must substantiate ordering, not only invoice equality or allocator instrumentation.

```text
N = 7501
M = 577+589 = 1166
initialization = 4/lane; heap allocation = 192 each
```

| Operation | Exact full total | Ordering/covered work |
|---|---|---|
| Support |128+192+28N = **210348** |Header128 first; wrong length rejects before proportional work, then reserve remainder210220 before allocation/init4N+support/certainty scan24N. |
| Normalize |128+2×192+40N = **300552** |Header128 first, wrong length before scans/allocation, remainder300424 before covered work: init8N/input16N/div+sum12N/owned support copy4N. Two allocations, cached certainty copied without rescanning. |
| Temperature |**160** |Header128 BEFORE index check; valid index then reserves32 before computation/stores. Bad index does not spend a hidden full scan. |
| Readout |256+3×192+4(N+M)+56N+32M = **492868** |Header256 BEFORE bounded ownReplacement check; reserve full remainder492612 before covered work. Exactly3 allocations: oneN scratch/two marginals; no unbilled secondN clone. |

Readout pass units are log/input-sum/max16N, exp/total12N, division/sum12N, marginal/mean16N, and four quantiles×8/lane across both marginals (=32M). Fixed header/parameter/temperature/result stores are included; no additional getter rescan, second normalization or deep-copy Clone hides work.
The marginal/mean16N engineering block includes finite-checked compensation in that same pass. Source audit checks the structural block schedule and covered ordering, **not a D1 scalar-operation invoice**; no cap/fee reduction, extra buffer/scan or hidden work relocation was used to resolve the dense-mean control.
For valid-shape requests the whole remainder is reserved before arithmetic even if a later data error stops early. Bad support/normalize length spends header only; invalid temperature index spends128; invalid ownReplacement spends256. Prior charges persist on Work failure; no refund for unused reservation or partial NumericJoint/readout publication.

```text
numeric support + normalize + temperature + readout
  = 210348+300552+160+492868 = 1003928
headroom under1048576 = 44648
simple F3 point453120 + numeric chain1003928 = 1457048 > 1048576
```

The actual SAME-meter F3+F4 control uses **valid shape/domain** structural data and returns Work/BUDGET, not an unrelated Domain/Shape error. The supplied PASS retains spent prefix964436 (F3point453120 +support210348 +normalize300552 +temperature160 +readout header256); full readout remainder is refused without refund. Fresh meters cannot claim composition fit. Standalone success and composition refusal prove neither complete runtime admission nor global impossibility.
No fee/cap reduction/hidden work relocation/reset/truncation is permitted. This engineering schedule is **not D1/full-window proof**. Future shared-buffer transition+history+bindings+ALLcandidate features/readout needs a positive complete source-audited invoice. Frozen1M/10s/300s including3 cleanup/separate generator2048 remain unchanged; verifier deadlines do not replace them.

<a id="7-independent-testsoracles--planned-not-run"></a>
<a id="7-independent-oracletest-controls--implemented-supplied-leaves-green"></a>
## 7. Independent oracle/test controls — included in current complete v7 PASS

Actual `packages/training/tests/joint_math.rs` (1104 lines) contains22 independent controls. Direct normalization compares all7501 probability bits to an independent total/division oracle and tests global-vs-per-source normalization; expected values do not come from production F4 helpers or legacy production normalization.
The readout oracle uses independent ratio/power temperature and **SORTED target records**, grouping repeated targets/gaps/exactCDF boundaries for reference means/quantiles rather than the production marginal helper/CDF loop. Set-based certainty examines all true supplied cells independently; model point mass with broad true mask remains uncertain.
Cover D-only/P-only/both/neither with supported zero-PMF states and irreversible variation; singleton576/12→576/588; equalD0/D576 uncertainty288; all1001temps/endpoints/monotonic/formula/algebraic anchors/point+uniform invariants and unchanged source joint/support bits including−0.
Required errors: empty/wrong mask/masses, all-zero total, outside-mask positive/negative/NaN/∞, raw2×MAX total overflow, raw2+minSubnormal division underflow, tiny-positive τ.25 exp/div refusal versusτ4 retention. A certainty override may not hide invalid sums or underflow.
Exact/one-below/precharge tests check headers before length/own bounds, full remainder before covered work, spent prior/unused reservation and valid SAME-meter F3+numeric-chain Work refusal. Use source audit+safe budget/error observations, **not allocator instrumentation/new production observer or unsafe allocator**. Reuse only the existing rules golden as STRUCTURAL composition data, not native execution/truth authority; no new fixture.
Two safe private source-unit controls additionally test certain_mean's each-quantile mismatch refusal without mutation and readout's inconsistent cached certainty after full reservation. They exercise private malformed state only, without adding an unchecked public constructor or production observer.
STOP on oracle disagreement/uncovered work/unsupported math, caller-mask masquerading as genuine support, or a claim that numeric counts establish fitted qualification. Keeper runs no tests/experiments/hash/render in this reconciliation; actual source and supplied execution claims stay distinct.

## 8. Future complete-evaluator feasibility and readiness exclusions

Before later runtime wiring require separately established: (1) qualified numeric cohort tables with A1 feasibility for at least one cohort source/group qualification/backoff plus independent source/provenance binding—F3 global row checks are NOT that; (2) shared buffers with Γ once, bank/material source order, weighted headstock+sparse accumulation and Boolean support independently INCLUDING supported zero-PMF states, then suffix/restrict/likelihood/normalize ONCE; (3) positive complete source-audited invoice across source/cohort/row/branch/scatter/output/allocate/readout/history/binding/ALLcandidate work.
Shared buffers alone are not fit proof, and the particular over-budget compositions reject **those compositions**, not the design globally. No source aggregation/complete estimator/cohort/likelihood/spatial support/components247/rebanding/fitting/calibration/labels/collector/permits/full418/geometry/container/resource closure is implemented in F4.
Fitted24k belief acceptance and actual full software/features/privacy/resource/authority closure remain pretraining. Actual policy training needs separate later approval; learned transfer/admission follows training, not a circular pretraining prerequisite. Legacy R4/inventory/public-closure/authority stops remain unwaived; activation/deployment separate and trainingReady:false unchanged.

<a id="9-planned-identity-v7-gate-and-current-handoff"></a>
<a id="9-actual-integration-leaf-evidence-and-pending-whole-gate"></a>
<a id="9-actual-integration-complete-v7-proof-and-pending-closing"></a>
## 9. Actual integration, complete v7 proof and final closing

Both assigned paths **EXIST/LANDED**, were read completely and carry top-line references to the existing training owner:

```text
packages/training/src/joint_math.rs
packages/training/tests/joint_math.rs
```

Actual lib.rs exports pub mod joint_math without a retained scorer/host/CLI call into it; package/tooling READMEs accurately bound the numeric-only scope. Shared root constants/assertions now use **`rust-training-verification-v7` / `native-joint-math`** in normal/init receipts. Cumulative REQUIRED and mutation/restore/delete tests add both actual joint files while keeping ALL14 F1–F3 inputs; exact nonempty token tests/joint_math.rs joins the retained missing/zero/lookalike/name-summary controls. No parser redesign/new test-total prediction/readiness command/dependency/Node/config/timeout/F3 source change.
The actual complete F4 run retains ALL29 jobs/F1–F3 controls/actual Node registerHooks JSON capability probe/MJS runtime+lint/15-case geometry import guard/full unfiltered old+new Rust+Node+core/static/build/selected CPU dependencies/before+after protected tracked+untracked preservation/both syntax+boundsSVG/index/whitespace/matching content identity. This is one whole invoice, not a stitched leaf total. Normal/init receipts retain exactly:

```text
full-training-closure
genuine-native-authority
whole-decision-adequacy
calibration
training-readiness
```

Actual complete unchanged-input721e/v7 PASS was followed by ALL3 fresh final F4 read-only reviews, DONE/READY, findings NONE, then final462-input source721e/metadata/preservation checks and actual publication59e1. Later source/config/test/index/PUML changes require their whole gate before rereview. F3 d771/v6 proof/approvals are not F4 evidence.
Before the gate, the existing training owner/index extended **40→42** with exactly the two actual joint-file literals/fingerprint null. Current full-run syntax/bounded-SVG/index42/59 checks PASS; arena59/all44 nontraining entries/metadata/order/unresolved list and existing22 note bodies/FK records/stable labels stay preserved. This evidence pass changes none of those verified inputs or normative rules.

<a id="current-f4-evidence"></a>
<a id="91-current-supplied-leaf-evidence--not-a-whole-invoice"></a>
### 9.1 Current complete unchanged-input v7 gate — PASS

Actual lead **sh_14df74861001rWGXf5pJMEvmD3 DONE/PASS** produced the [PRESENT receipt.json](/tmp/proveo-opencode-runtime-cache-1000-21d690750d3738af14d58c25/tmp/opencode/rust-training-104208-1792309414300374720-0/receipt.json), read for this update. Parent machine assertions joined the receipt/required-target invoice. Keeper runs no commands/tests/hashes/renders; this is actual whole F4 proof, not leaves added together or borrowed F3 proof.

| Receipt field | Actual current value |
|---|---|
| Version / scope |`rust-training-verification-v7` / `native-joint-math` |
| Status / reviewEligible |`PASS` / `true` |
| error / identityError |`null` / `null` |
| Fixed results |29/29 PASS/exit0/reaped, no timeout/cleanup/reap failure |

```text
inputSha256 == inputSha256After ==
721ec1f67bf2d738649da61b68ca19464a9f86c4b20a2ff42c9ef9a3e892123a
```

| Current unfiltered scope | Actual PASS count |
|---|---|
| Rust workspace/all targets |416 =arena106 +training278 +xtask32 across23 binaries |
| Node engine |189 |
| Native core |668 |

| Required target/filepath | Included count | Purpose; subsets, not extra totals |
|---|---|---|
| `packages/training/tests/joint_math.rs` |22 |Independent all7501 direct normalization/all1001 temperatures/SORTED target-record means+quantiles/certainty/isolation/errors/exact work/same-meter controls |
| `packages/training/src/joint_math.rs` private units |2 within training library11 |Computed quantile mismatch refuses without repair; inconsistent cached certainty refuses after full reservation |
| Training all targets |278 |254 retained +22 integration +2 private guards; ALL already included in workspace416 |
| `tooling/xtask` |32 |Cumulative identity/mutation/delete/exact target/receipt/retained invoice controls, included in416 |
| `packages/training/tests/accounting_kernel.rs` |25 |Retained independent point-flow/support/raw-mass/fee controls |
| `packages/training/tests/feature_input.rs` |29 |Retained ordered innovations/replay/private seed/atomic shared-work controls |
| `packages/training/tests/feature_manifest.rs` |11 |Retained exact418 metadata/oracles/length-gated validation/work |
| `packages/training/tests/learner_math.rs` |24 |Retained independent scalar/FD/test-only Burn numerical proposals |
| `packages/training/tests/ledger_contracts.rs` |42 |Retained closed economic facts/native origin modes/nullability |
| `packages/training/tests/ledger_history.rs` |49 |Retained lineage/accounting/memory/conservation/replay/work |
| `apps/arena/tests/economic_replay.rs` |9 |Retained native economic/terminal closeout correspondence |
| `apps/arena/tests/readiness.rs` |4 |Retained bounded CLI/readiness-negative diagnostics |

All old/new required targets ran nonempty/unfiltered;22+2 are INCLUDED in278, not added to416. All static/fmt/all-targets check/Clippy-Dwarnings/types/warnings-denied lint/build/selected CPU dependencies/protected tracked+untracked preservation BEFORE+AFTER/index42/59/both PUML syntax+boundsSVG/receipt-time whitespace PASS in that SAME run. Actual Node capability stdout was read: `{"version":"v22.23.2","registerHooks":true}`. All five exact notEstablished families remain unchanged.
Numeric chain1003928/headroom44648 and valid SAME-meter F3+chain Work refusal/spent964436 passed without Domain/Shape substitution/fresh meter. Allocation ordering remains **SOURCE AUDIT + safe budget/error observations, NOT allocator instrumentation**. These controls establish neither genuine publicSupport/native truth/calibrated temperature/full estimator nor D1/full-window/runtime/readiness admission.

Two pre-gate implementation controls are resolved without revising the frozen API/math/tolerance/invoices: certain_mean now checks computed quantiles instead of filling them, with the two safe private guards including an inconsistency reproduction; dense mean accumulation now uses finite-checked compensation in the SAME canonical N pass. Independent B's all-mask/raw j%19+1/τ1 case previously differed by1.31e−12, beyond unchanged1e−12 (21/22); lead's exact integer raw sum74980/D numerator21593141 corroborated the oracle, and unchanged22/22 now passes. No independent assertion was weakened, no secondN scan/heap added and no fee changed. These are resolved current implementation controls, not open closing findings, fitted/native provenance or D1 scalar proof.

<a id="current-f4-closing"></a>
<a id="92-current-fresh-f4-closing-and-capture--verdicts-pending"></a>
### 9.2 Current final F4 closing and capture — ALL3 READY

ALL3 fresh **F4** final read-only reviews are **DONE/READY, findings NONE**, bound to actual721e/v7 source/whole proof, not earlier F3 verdicts in the same sessions. **Bounded numeric verification/review/publication is COMPLETE** at59e1; no LOW or pending F4 review blocker. These verdicts do not cover F5.

| Reviewer/session | Actual current F4 status |
|---|---|
| Adversarial `ses_eb7cb724effe5uE3Hebn2Gb0wF` |DONE **`READY TO MERGE:yes`**, findings NONE; complete current16-path F4 diff, bounded numeric normalization/summary only. |
| Security `ses_eb7cb7218ffePBBBS1MqCmBCtM` |DONE **`READY TO MERGE:yes`**, findings NONE; ALL16/four new/surroundings scope COMPLETE. Mask certainty/domain/finite+underflow/index/preallocation/immutability/summary authority and actual current29/416/189/668/721e receipt+logs/identities inspected; no commands/edits. |
| DevOps `ses_eb7cb7206ffe1XrslbW4r6OyGq` |DONE **`READY TO MERGE:yes`**, findings NONE; actual16/current v7 receipt+raw logs/source precharge/cumulative identity+nonempty target/five exclusions inspected; no independent rerun/edit. |

Optional property PMF/mask/underflow/budget tests remain non-blocking and **not executed proof**. Approvals establish only the identified numerical normalization/summary primitive; supplied masks are not genuine publicSupport/native truth, temperature indices are not calibrated, and engineering source audit is NOT allocator instrumentation/D1/full runtime fit/readiness admission. All five notEstablished families persist.

After PASS lead explicitly STAGED all16 F4 paths, including4 new files, with cached-whitespace PASS. Complete HEAD-relative capture, including all new files, was supplied UPFRONT to all three current reviewers. Inventory/base-head files were read; capture sizes/SHA256 values below are lead-supplied, not computed by keeper:

| Current capture artifact | Supplied identity |
|---|---|
| `/tmp/proveo-opencode-runtime-cache-1000-21d690750d3738af14d58c25/tmp/opencode/f4-closing-review-EpSrex/head.diff` |145465 bytes; SHA256 `bf5a79d5b3ffe722c2f3fc4fc8f4dd15133fb3fcd81cc7012f9a6b734e985618` |
| Same directory `changed-paths.txt` |16 paths; SHA256 `0d8fb80cc3fd1ed1447ad29363df1863c7636f85452f58b853fa12f092c7382b` |
| Same directory `base-head.txt` |29018157e40bb11d558599a21409623bfbec1a83 |

The complete16-path F4 scope was fully reviewed; source/config/test/index/PUML bytes stayed unchanged through publication, and later Markdown metadata received final checks. **F4 publication is COMPLETE:59e1eff1a10072b6594fff3a65e2e6b3b5ff7a24**. Lead joined462-input source identity to721e, checked final navigation/whitespace/protected scope/exact16 inventory, restaged/committed/non-force pushed, then verified actual full HEAD=remote/CLEAN checkpoint. [F5 goals](native-transition-tables.md) follow that publication; no future hash/self-hash loop or F5 proof is invented.

### 9.3 Separate preflight and current handoff

Separate lead preflight PASS, **not extra29 invoice jobs**:45 index entries/all44 nontraining entries+metadata preserved,42/59 literal covers/SPEC/file agreement;22 old note bodies byte-unchanged/2–5 lines/max46 columns and historical FK records unchanged; PLAN suffix4+/README first2+suffix6+ byte-exact to29018157; exact4 then-new files/clean new+tracked whitespace/protected F3/native/legacy/model/Node/config/dependencies/locks/data preserved. This evidence-only pass edits no notes/index/PUML/protected inputs or normative API/math/tolerance/work fees.
F4 whole721e/v7 PASS29/416/189/668, ALL3 final READY/no findings and publication59e1 are **DONE**. Next selected delivery is [F5 goals/acceptance](../_plans/native-transition-tables.md), with implementation/tests/v8 gate/ALL3 fresh reviews/publication planned/not run; no F5 source presence/PASS/future hash is claimed. This goals handoff adds two F5 Markdown docs/shared navigation prefixes and small F4 publication-status metadata only; keeper runs no commands/tests/hashes/renders/agents/Git/progress polls. Normative F4 API/math/tolerance/fees, five notEstablished families and trainingReady:false remain unchanged.
