# F2 — native learner mathematics: accepted contracts and reasoning

**2026-10-18 · BOUNDED F2 VERIFICATION/REVIEW COMPLETE ·67a26 v5 PASS:29 COMMANDS / RUST367 / NODE189 / CORE668 · ALL3 CURRENT FINAL REVIEWS READY, FINDINGS NONE · PUBLICATION AUTHORIZED, NOT EXECUTED · trainingReady:false.**

The [PR plan](../_plans/native-learner-math.md) owns acceptance, source ownership, test-purpose matrix and gate order.
This document persists the full87-line read-only architect freeze from `ses_eb7c5d187ffenpvgElk95FZ8ut`, read in full at:
`/tmp/proveo-opencode-runtime-cache-1000-21d690750d3738af14d58c25/tmp/opencode/f2-learner-math-freeze.md`.
No human ordering choice remains open. Backend/DevOps read-only advisories are DONE with no contradiction or normative fork; source/design advice supplies neither F2 execution proof nor permission to change the recipe.
The production module/test/narrow integration were read before freeze. Accepted APIs/formulas/finite rules/resource exclusions are unchanged; current complete67a26/v5 proof and ALL3 final READY are actual lead/reviewer results, not keeper reruns. This pass updates only four Markdown surfaces after PASS, never source/config/tests/index/PUML or normative goals/recipe.

## 1. Published prerequisite, scope and non-goals

The lead actually published F1 as **8d908d4c96641403f6161f118458ca66f2305a04**,29 files, parent b47befd021bef04eea0bfe20a9308a71aa20f09f, by successful non-force origin push. HEAD/remote matched and the tree was clean at that publication checkpoint, **before these F2 goal edits**.
F1's [d389/v4 receipt and ALL3 READY](native-feature-seams.md#92-current-complete-unchanged-input-v4-gate--pass),29 commands/343 Rust/189 Node/668 core with Node LOW resolved, remain bounded **F1 evidence only**. F2 needs a new v5 source-bound run/reviews; no F2 code/test/receipt/hash exists by implication.

Implement deterministic **production scalar Rust f64** logits/distributions, explicit-uniform sampling, streamed/summed statistics and detached arithmetic SGD proposals; Burn is a TEST-ONLY independent cross-check. The frozen R3 contract does not require a production Burn backend here. This is numerical correctness, **not actual policy training, eligible episode processing or permission to commit weights**.
Do not add Node production/dependencies, model.rs/synthetic scorer/baseline changes, new recipe options, backend factory, feature encoder/belief/support/geometry/cache/transport, native episodes/ACK/coordinator/eligibility marker, private labels/permits, RNG/checkpoints/artifacts/CLI/serialization, fitting/calibration/container/runtime closure or readiness promotion.
Preserve pins/dependencies/native engine, frozen R3/R4 bodies/Configuration26/Versions21/418 meanings/labels, protected corpus/evidence/fixtures and external legacy history/graph/status.
Source comments remain instructions/WHAT labels/directives; this document owns reasoning.

<a id="2-exact-planned-api--not-source-presence-claims"></a>
## 2. Exact API — implemented pure scalar source

All numeric coordinates are f64. Cardinality418 is part of the type, not a new runtime manifest/codec/authority version.

```rust
pub type Vector418 = [f64;418];
pub const LEARNING_RATE: f64 = 0.001;
pub const POLICY_TEMPERATURE: f64 = 1.0;
pub const L2: f64 = 0.0001;
#[derive(Clone, Copy, Debug, PartialEq, Eq)]
pub enum MathError { Shape, Domain, NonFinite, DecisionLimit }
pub type MathResult<T> = Result<T,MathError>;

pub struct Distribution { /* private probabilities/log probabilities */ }
impl Distribution {
    pub fn len(&self) -> usize;
    pub fn probabilities(&self) -> &[f64];
    pub fn log_probabilities(&self) -> &[f64];
}
pub struct DecisionStatistics { /* private delta418 + selected logP */ }
pub struct EpisodeStatistics { /* private count/summed delta/summed logP */ }
impl EpisodeStatistics {
    pub fn new() -> Self;
    pub fn append(&mut self, decision: &DecisionStatistics) -> MathResult<()>;
    pub fn sampled_decisions(&self) -> usize;
    pub fn score_accumulator(&self) -> &Vector418;
    pub fn log_probability_sum(&self) -> f64;
}
pub struct SgdProposal {
    pub gradient: Vector418,
    pub proposed_weights: Vector418,
    pub objective: f64,
    pub nonzero_pg: bool,
}
pub fn zero_weights() -> Vector418;
pub fn linear_logit(weights: &Vector418, features: &Vector418) -> MathResult<f64>;
pub fn softmax(logits: &[f64]) -> MathResult<Distribution>;
pub fn sample_index(distribution: &Distribution, uniform: f64) -> MathResult<usize>;
pub fn decision_statistics(
    distribution: &Distribution,
    selected: usize,
    feature_at: impl FnMut(usize) -> MathResult<Vector418>
) -> MathResult<DecisionStatistics>;
pub fn sgd_proposal(
    frozen_weights: &Vector418,
    frozen_baseline: f64,
    return_value: i8,
    episode: &EpisodeStatistics
) -> MathResult<Option<SgdProposal>>;
```

Distribution/statistics fields stay private; no decoder, serialization, public unchecked-state constructor, capability marker or configurable recipe is added. SgdProposal's public arrays are ordinary arithmetic data, not commit authority.
The allowed compiler companions are present: Distribution::is_empty() is false for every valid construction, and EpisodeStatistics::default() calls new()'s exact zero state. Neither opens an alternate configuration/state path.
zero_weights supplies zero θ, no bias coordinate/teacher initialization. Use the fixed constants, not caller-selected temperature/rate/regularizer or a training backend factory.

| Isolated error family | Required mapping |
|---|---|
| Shape |Empty/513 logits or out-of-bounds selected index |
| Domain |Invalid **finite** uniform, baseline or return domain |
| NonFinite |NaN/∞ input or any nonfinite product/add/reduction/intermediate |
| DecisionLimit |Attempted65th append |

Do not infer/assert a precedence contract for multiply invalid inputs; isolate negative fixtures except the explicit zero-sample input-validation-before-L2 rule.

## 3. Finite deterministic distributions and explicit sampling

### 3.1 Linear and stable softmax calculus

Reduce coordinates/candidates ascending. Validate **EVERY product and addition intermediate**, not just a final scalar/vector; all supplied features/weights/logits must be finite. Do not import the old compat MAX_ABS_VALUE1e6 limit, normalize to zero or silently clip/repair; F2's domain is finite-only with intermediate checks.

```text
linear_logit(θ, φ) = Σ_i=0..417 θ_i φ_i
n = logits.len, 1 ≤ n ≤ 512
m = max_j logits_j
s_j = (logits_j - m) / POLICY_TEMPERATURE
e_j = exp(s_j)
Z_shifted = Σ_j e_j
logP_j = s_j - ln(Z_shifted)
P_j = e_j / Z_shifted
```

Temperature is fixed1. Compute logP **directly from shifted values**, not log(rounded P) and not subtraction from a rounded large unshifted log-sum. With ±1000 separation P may underflow0 while logP remains finite; very large equal finite logits must still retain the correct finite logP rather than cancel to zero.
Allow individual P=0, but require every logP finite, all P finite/in[0,1] and `abs(ΣP−1)≤1e−12`. Preserve input order and reject nonfinite intermediates even when the original inputs were finite. Empty/>512 input is invalid; no empty Distribution is constructed.
The max-shifted sum avoids exponential overflow; it does not waive finite checks for subtraction, products, reductions or later gradients/objectives.

| Required extreme fixture | Result |
|---|---|
| [1e308,1e308] |P=.5 each/logP=−ln2, not0 from rounded unshifted subtraction |
| [0,−1000], selected index1 |Individual P underflows0, direct logP remains finite/valid statistics input |
| [−1e308,1e308] |Shift subtraction overflows: NonFinite, no rescue despite finite original logits |

### 3.2 Sampling boundary

Accept one explicit finite uniform **0≤u<1**, even for a singleton Distribution. F2 draws **no RNG**, owns no seed/stream state and cannot reconstruct a real sampling history.
Traverse candidates ascending, accumulating probabilities; return the first index whose CDF is **strictly greater than u**. A zero-p entry cannot win because its CDF does not advance. Exact CDF equality moves to the next supported interval, not the preceding one.
If a valid normalized Distribution exhausts traversal only because of floating rounding **within the frozen1e−12 sum tolerance**, use the **last index with nonzero probability** fallback, never a trailing zero-p slot. Leading zero-p entries also never win. This is not rescue for invalid/out-of-tolerance distribution/uniform or permission to renormalize/clamp.
The returned index proves neither generated-candidate membership, native admission, ACK nor eligibility.

## 4. Streamed decisions and atomic summed episode state

### 4.1 Decision statistics without a retained matrix

Validate selected index against the Distribution. On successful traversal call feature_at **exactly once per index, ascending**, including zero-p rows; validate each full418 vector and all weighted/summed intermediates.

```text
δ = φ_selected - Σ_j P_j φ_j
selectedLogP = Distribution.log_probabilities[selected]
```

Hold only bounded weighted/selected/working vectors, not an n×418 matrix or retained callback/row history. At temperature1 this is the score-function term; do not add an alternate temperature recipe or silently change to a mean over candidates.
Propagate callback errors without hiding/retrying them: only the visited prefix runs and no partial DecisionStatistics is returned. **Do not promise rollback of side effects inside trusted FnMut**. It is composition code, not a sandbox/native capability; module-owned bounds do not constrain arbitrary callback behavior.
Selected logP comes from the stable log-probability array, so a rounded zero selected probability does not force log(0). Whether any real sampler legitimately selected that row is future coordination/authority work, not authenticated here.

### 4.2 EpisodeStatistics ≤64 and all-or-nothing append

new() establishes count0, δsum[418]=0 and sumLogP0. Append **SUMS**, never averages or divides by episode length:

```text
δsum_new = δsum_old + decision.δ
sumLogP_new = sumLogP_old + decision.selectedLogP
count_new = count_old + 1, count_new ≤ 64
```

Stage proposed count, all418 additions and summed logP before mutating any retained field. Decision65, a late overflow specifically at coordinate417 or summed-logP overflow must preserve **ALL** previous count/vector/logP fields. No partial coordinate update or rollback fiction is allowed.
No native episode log/ACK/control stream, eligibility count or private scheduling state is retained. A syntactically valid statistics object is still arithmetic data, not evidence of real accepted decisions.

## 5. Fixed REINFORCE/L2 arithmetic proposals, not updates

Validate finite θ418, finite baseline **b∈[-1,1]** and i8 return **R exactly−1/0/+1**. θ and b are borrowed frozen inputs; this module never mutates/commits them or inserts the current return into a baseline.
For one or more summed decisions, with λ=L2 and α=LEARNING_RATE:

```text
A = R - b
L = -A * sumLogP + λ * (Σ_i θ_i²) / 2
g_i = -A * δsum_i + λ * θ_i
θ'_i = θ_i - 0.001 * g_i
nonzero_pg = exists i: (-A * δsum_i) != 0
```

Apply L2 **once per proposal**, not per decision. nonzero_pg examines the **computed PG term only**, without epsilon: +0/−0 both count zero. It is not derived from total gradient, L2 or whether rounded proposed weights moved; regularization-only motion is not outcome-driven learning.
Finite-check objective, gradient, proposed weights and every intermediate; no clipping/averaging/entropy/resource shaping/bias/Adam or reward reinterpretation. Return detached arrays; input θ remains unchanged on success or failure.

### Zero sampled decisions

Validate θ finite/b,R domains, then return **None** for count0 **before** norm/L2/gradient/update work. Finite1e308 weights whose squared norm would overflow still reach None without forming that norm. Invalid supplied θ/b/R rejects; zero choices do not legalize invalid inputs.
There is no baseline insertion, checkpoint or state commit on this path—or any F2 path. None is not a native diagnostic-completion permission; that classification belongs to a future genuine coordinator.

### Separate future authority

The frozen future coordinator must bind actual eligible ACK/native completion to the exact frozen weights/baseline/features/distribution before any atomic learning-state commit. F2 does not implement that binding, return classification, durability or permission.
Reference the existing frozen [SGD/eligibility calculus §13](../_plans/ml-adjutant-r3-contracts.md#13-failure-eligibility-durable-attempts-and-sgd) without rewriting its header/body. Its native/ACK/baseline/checkpoint obligations remain deferred, not waived by a passing arithmetic proposal.

## 6. Independent numerical oracles and frozen validation-A rule

Required tests now exist in `packages/training/tests/learner_math.rs`; supplied numerical execution is recorded in §9, not rerun here. Frozen [contracts §16](../_plans/ml-adjutant-r3-contracts.md#16-validation-profiles-and-explicit-acceptance-calculus) and [economic amendment §12](../_plans/ml-adjutant-r4-economic-amendment.md#12-inclusive-work-verification-and-closure) remain unchanged references for all418 coordinates and the exact criterion, not a claim of global learner validation/closure.

```text
ε = 1e-6, atol = 1e-8, rtol = 1e-5
gFD_i = (L(θ+εe_i) - L(θ-εe_i)) / (2ε)
abs(gAnalytic_i-gFD_i)
  ≤ atol + rtol * max(abs(gAnalytic_i), abs(gFD_i))
```

Every declared fixture and **every one of418 coordinates** must pass, not a mean error, aggregate norm or convenient sampled subset. Hold actions/candidate sets/features/return/baseline fixed during perturbation; no RNG/resampling/regeneration inside derivative checks.
Use fixed +e_i/−e_i basis-pair fixtures at θ=0, including zero-gradient and regularization-only cases. Also use independent fixed multi-decision scalar fixtures to detect SUM-versus-mean/L2-once errors; bounded sparse fixtures avoid cancellation. This is not a universal arbitrary dense-tensor tolerance claim or a tolerance for identity/conservation/resource/authority checks.
The scalar reference independently recomputes softmax selected logP/objective under perturbed θ; differentiating a cached constant sumLogP would not test the PG term. Do not derive expected results solely by calling the production functions under test.
Test-only **Burn0.22 Flex explicitF64/no-bias live graph/autodiff plus synthetic SGD(.001)** cross-check scalar/analytic results. Differentiate the LIVE graph before host extraction; λ belongs only in the objective, never optimizer decay as well. Existing model.rs compatibility patterns are reference mechanics, not permission to copy bias/MSE/.125 into the new oracle. This is numerical diagnostics, not actual policy training/native-game updates/fitted artifacts or a production scorer change.
At θ=0/two distinct vectors, λθ=0: one positive-advantage step raises selected logP and the paired negative case lowers it. Do not generalize that fixture to arbitrary regularized θ. Keep λ fixed in production; test-only independent references may isolate the L2 contribution without adding a new configuration option.
Retain ±1000/large-finite/equal-logit/underflow-p0 cases, all sampling boundary/fallback/singleton/order controls, exact callback order/count/error propagation/no matrix, malformed/nonfinite/overflow rejection,64/65 atomic rollback, θ isolation and zero None/no-L2 controls from the [test-purpose matrix](../_plans/native-learner-math.md#5-planned-test-purpose-and-independent-oracle-matrix--not-run).

## 7. Resource bound and deferred geometry feasibility — not admission

F2 owns **O(512+418) numeric buffers plus fixed temporaries**, never a retained512×418 matrix. That memory shape is not whole-process/runtime closure or permission to allocate unbounded callback/test-backend state.
F2 introduces **no planning meter/new allowance/exemption**. Future integrated scoring/distribution/statistics/validation must be counted in its applicable complete schedule; pure arithmetic cannot hide work by being outside an existing signature's meter today.
The frozen inclusive planning allowance remains1048576. Two exact conditional warnings from the accepted plan:

| Particular schedule | Bound / implication |
|---|---|
| Minimum F1 schedule helper once for each512 candidates |512×2048=1048576 **alone**, before history/copy/features/queue construction. Do not wire per-candidate helpers with resets or omitted support. |
| Conditional dense scalar dot +weighted stats +vector stores |512×418×2=428032 each for dot/stats, plus512×418=214016 stores; total1070080>1048576 **if all operations belong to that inclusive scope**, before features/history. |

These reject the **particular naive schedules**, not the frozen design globally. No impossibility verdict, cap waiver or current resource-amendment choice follows. Streaming memory alone does not prove charged arithmetic fit.

Before later geometry wiring, require a **positive complete charged source-bound reuse schedule**:

- Bind immutable native results to actual expectedSourceRefs/native source identity and **all** primitive operands; occupancy-dependent results also bind authorized/projection dependencies. Equality-only F1 IDs/startup data are not genuine native-source authority.
- Charge lookup/binding/copy/store/recalculation and cache construction; whole-queue caching does not fix512 distinct misses. No uncharged precompute/table, caller-declared cache hit or tariff cut supplies proof.
- Batched native interfaces need audited actual cost, not just a lower label. Reuse generation annotations only when already computed for unchanged generation; never relabel new feature work as generation to bypass accounting.
- Captured native-derived tables need demonstrated derivation, independent expected bytes, native source/load authority and processing charges. Offline/startup existence alone grants neither authority nor allowance.
- Any new worker needs its own separately frozen protocol; legacy wires remain closed. **No cache/transport/geometry/source-authority implementation belongs to F2.**

Do not reset meters, truncate support, raise caps, copy native rules or pad synthetic readiness. If a later complete compliant schedule cannot be shown, STOP and present exact amendment-or-deferral alternatives with≥3 proposals. No such human fork is currently pending.

## 8. Deferred genuine authority and global readiness

SgdProposal/statistics are **DATA, NOT PERMISSION**. No public decoder/capability flag/eligible marker/nativeEpisode/ACK/baseline/checkpoint/artifact/weights-commit path appears in F2. Genuine future coordination must separately verify actual native completion/eligible ACK prefix and frozen source/artifact/state bindings.
The accepted dependency order places independent belief/support kernels and geometry feasibility after this math slice; neither is silently implemented here. Nominal projection/full historical370+amended48, genuine episode/ACK/durability, collector/private labels/offline closure and fitted calibration remain separate work, not this document's implementation roadmap.

| Before separate policy-training approval | Not established by F2 |
|---|---|
| Numeric correctness plus real full418 features/belief/privacy/conservation |F2 addresses only identified pure numerical functions, not the full pipeline. |
| Fitted belief acceptance over the frozen24k-group scope |No collection/fitting/calibration/data rewrite runs here. |
| Genuine episode/ACK/eligibility/durability implementation |No source permission/native runtime completion is supplied by a math result. |
| Complete decision resource proof and actual offline-container closure |No new allowance, geometry cache/transport or container work here. |
| Complete reviews of actual identified implementation/evidence |Future F2 v5 review is bounded numerical evidence, not global closure. |

Actual policy SGD and formal primary101 require **separate later human approval**. Learned4800-group transfer/admission follows training and is not a circular pre-training prerequisite; activation/deployment remain separate. Legacy R4 HIGH/inventory/resource/authority stops remain unwaived.

<a id="9-planned-identity-verification-and-current-status"></a>
<a id="9-actual-source-handoffs-supplied-numerical-evidence-and-pending-whole-gate"></a>
## 9. Actual F2 verification and current completion status

Both assigned new source/test files now exist, were read completely and carry the existing training owner pointer:

```text
packages/training/src/learner_math.rs
packages/training/tests/learner_math.rs
```

Actual lib.rs exports **pub mod learner_math** without changing the old scorer. Actual xtask REQUIRED adds both math files cumulatively, retaining ALL10 F1 inputs; the persisted mutation/restore/deletion loop covers all12. The existing exact-token/nonempty target table includes **tests/learner_math.rs**, retaining missing/zero/lookalike negatives and binary-name/summary mismatch rejection, not a redesigned parser.
ALL29 jobs/actual Node registerHooks JSON probe/15-case geometry import matrix/MJS runtime+lint/F1 targets remain. No Node production/dependency/config/pin/model.rs or backend-factory/readiness-command change is introduced. Conventional helpers are implemented without lint allows.
Root code uses shared **`rust-training-verification-v5` / `native-learner-math`** constants/assertions in normal AND initialization-failure receipts. Actual current complete v5 PASS is recorded below; it retains this exact unchanged notEstablished list:

```text
full-training-closure
genuine-native-authority
whole-decision-adequacy
calibration
training-readiness
```

Retain **all29 existing checks**, full unfiltered Rust/Node/core including new nonempty learner_math, existing F1/invoice/import controls, static/build/selected dependencies, before+after legacy/corpus/evidence/lock preservation, both owner syntax/bounded SVG/index/whitespace and matching content-derived before/after identity. Separate note/navigation preflight is not a new invoice command; no readiness command is added.
The actual complete67a26/v5 PASS unlocked ALL3 fresh F2 reviews, now final READY/no findings. Any source/config/test/index/diagram change requires the whole gate again before rereview, then final metadata/preservation checks and authorized verified commit/non-force push. F1 v4 approvals are not current F2 evidence.
Before the gate, keeper appended the two actual math literals to the existing training owner/index,36→38/fingerprint null. Arena59/other44 nontraining entries/unrelated metadata/order/unresolved list remain preserved. This current evidence pass changes no source/coverage/index/PUML or owner.

Actual tooling README describes pure418 math plus retained seams/ledger/compatibility, explicitly excluding complete coordinator/eligibility/features/calibration/resource/runtime/readiness closure. It does not claim a complete production learner or permanently deny that identified math can be verified.

### 9.1 Source-to-contract observations

Production learner_math.rs is scalar Rust with no Burn import or planning meter: private checked Distribution/statistics, explicit uniform sampling, once-per-index streaming callback, every finite intermediate checked, all-fields-staged append≤64, one L2 and PG-only flag, zero-count None before norm/L2 after domain checks, detached proposal/input-weight isolation. No genuine episode/ACK/eligibility/baseline/checkpoint/weights commit authority is exported.
The tests independently recalculate scalar likelihood/objective at perturbed weights with fixed features/selected indices, not cached episode logP. Actual Burn is **test-only** Flex F64/no bias/live graph/autodiff before host extraction and synthetic SGD(.001), with L2 only in the objective and no optimizer-decay duplicate. The old production compat model/bias/.125 path is unchanged.
No concrete mismatch with the accepted F2 API/recipe was identified in this bounded source inspection; that is not adversarial/security/DevOps closing or an admission proof.

<a id="92-supplied-actual-execution-scopes--no-stitched-whole-total"></a>
### 9.2 Current complete unchanged-input v5 gate — PASS

Actual lead **sh_14d9ca465001oUg9fuIARE9ldq DONE/PASS** produced the [PRESENT current receipt.json](/tmp/proveo-opencode-runtime-cache-1000-21d690750d3738af14d58c25/tmp/opencode/rust-training-68111-1792303474072266737-0/receipt.json), read for this evidence update. This is actual whole-run proof, not arithmetic stitching of earlier leaves or borrowed F1 verification.

| Receipt field | Actual current value |
|---|---|
| Version / scope |`rust-training-verification-v5` / `native-learner-math` |
| Status / reviewEligible |`PASS` / `true` |
| error / identityError |`null` / `null` |
| Fixed command results |29/29 PASS/exit0/reaped, no timeout/cleanup/reap failure |

```text
inputSha256 == inputSha256After ==
67a26d84b1ea4b6e03a86886a4c1df683b15f20534fdee7c466764a4a93c20ca
```

| Current unfiltered scope | Actual PASS count |
|---|---|
| Rust workspace/all targets |367 =arena106 +training229 +xtask32 across21 binaries |
| Node engine |189 |
| Native core |668 |

| Required target filepath | Nonempty count | Purpose; subset of workspace totals |
|---|---|---|
| `packages/training/tests/learner_math.rs` |24 |Independent scalar/FD/Burn numerical math, stable logP/sampling/callback/atomicity/zero/proposal-isolation controls |
| `packages/training/tests/feature_input.rs` |29 |Retained ordered structural inputs/innovations/private seed/replay/atomicity/work |
| `packages/training/tests/feature_manifest.rs` |11 |Retained exact418 metadata/oracles/length-gated validation/allocation/work |
| `packages/training/tests/ledger_contracts.rs` |42 |Retained strict economic facts/required modes/nullability |
| `packages/training/tests/ledger_history.rs` |49 |Retained accounting/lineage/memory/conservation/replay/work |
| `apps/arena/tests/economic_replay.rs` |9 |Retained native economic/terminal closeout correspondence |
| `apps/arena/tests/readiness.rs` |4 |Retained bounded CLI/readiness-negative diagnostics, not learning readiness |

All required targets ran nonempty/unfiltered; the counts above are this same-input run's subsets, never extra tests added to367. All static/types/warnings-denied lint/fmt/all-targets check/Clippy-Dwarnings/build/selected CPU dependencies/locks/protected tracked+untracked preservation **before and after**, index38/59/all44 nontraining entries, both PUML checkonly/bounded SVG and receipt-time whitespace PASS. Frozen Node preflight stdout was read: `{"version":"v22.23.2","registerHooks":true}`; all F1 import/runtime controls remain retained.
The exact five notEstablished values remain `full-training-closure`, `genuine-native-authority`, `whole-decision-adequacy`, `calibration`, `training-readiness`. None of this establishes native authority, actual full learner/features, decision-resource/calibration/runtime closure or actual policy training.
Math24 includes **12,958 central-difference comparisons=31 declared fixtures×418 coordinates**, at ε1e−6/atol1e−8/rtol1e−5. Seven≤64-decision basis batches cover all418 active axes, each reward−1/0/+1 plus regularization-only (28), plus3 sparse multi-decision fixtures. EVERY fixture checks EVERY coordinate, including zeros, with independent likelihood recomputation and no resampling. Actual test-only Burn0.22 Flex F64/no-bias live-graph/autodiff/synthetic SGD(.001) matches independent scalar/production math; numerical diagnostics, **NOT policy updates/native sessions/training/artifacts**. Conditional resource examples in §7 still reject particular schedules, not the design globally.

<a id="93-current-f2-closing-and-capture"></a>
### 9.3 Current F2 closing — ALL3 READY, findings NONE

All three fresh current F2 final read-only verdicts bind the actual67a26/v5 whole proof/source, not older F1/d389 approvals. **Bounded F2 numerical verification/review is COMPLETE; no review blocker remains.**

| Current reviewer/session | Actual final F2 disposition/method |
|---|---|
| Adversarial `ses_eb7cb724effe5uE3Hebn2Gb0wF` |DONE **`READY TO MERGE:yes`**, findings NONE; complete17-path current F2 diff. Arithmetic math/proposals only, not full learner/authority/resource/calibration/readiness. |
| Security `ses_eb7cb7218ffePBBBS1MqCmBCtM` |DONE **`READY TO MERGE:yes`**, findings NONE; ALL17 captured paths/four new files/surrounding source scope COMPLETE. Finite/bounds/sampling/trusted callbacks/atomic append/detached proposal/authority and current present v5 receipt+logs/29/367/189/668/matching67a26 inspected. Read-only/no commands or edits, no independent gate rerun. |
| DevOps `ses_eb7cb7206ffe1XrslbW4r6OyGq` |DONE **`READY TO MERGE:yes`**, findings NONE; cumulative F1+F2 required sources/exact nonempty targets/v5 normal+init metadata/five exclusions/current17 scope/receipt+raw logs/identity/reviewEligible inspected; no independent gate rerun/edit. |

Optional property/extreme/append-rollback strengthening is non-blocking and **not executed proof**. No source writer or reviewer remains active after these verdicts.
Lead staged the complete17 F2 paths (all4 new source/test/docs included), passed cached whitespace and provided this full capture upfront, based on published8d. These capture identities are lead-supplied, not hashes generated here:

| Current capture artifact | Supplied identity |
|---|---|
| `/tmp/proveo-opencode-runtime-cache-1000-21d690750d3738af14d58c25/tmp/opencode/f2-closing-review-6RWqUE/head.diff` |139363 bytes; SHA256 `b6fc9c734a79c27bb2c1fde42326f43e2f70d32cfb8f35ac3bba0eb305db4ee0` |
| Same directory `changed-paths.txt` |17 paths; SHA256 `17a862cbf9f3ee9dbb978e98af3444e309f9fdd45fe311a21c044d3f432b3774` |
| Base HEAD |8d908d4c96641403f6161f118458ca66f2305a04 |

Source/config/tests/index/PUML bytes are unchanged after67a26 PASS. Later Markdown status metadata may be newer than this reviewed capture and needs final metadata checks/restaging; it does not change source identity or create a self-hash loop. **F2 publication is AUTHORIZED BUT NOT EXECUTED**: lead will final-check the67a26 source join/navigation suffixes/whitespace/protected scope, explicitly restage17, commit/non-force push and verify actual remote/clean status. HEAD remains published8d until that actual later commit; no future hash is invented. trainingReady:false and all deferred proofs remain unchanged.

## 10. Current coverage, notes and shared-verifier labels

Current covers remain training**38**/arena**59**, all45 index entries/all44 nontraining entries/top metadata preserved. Both actual math-file edges were added before the current full gate; this evidence-only update edits no index/PUML/source/config/tests/coverage.
No reasoning note is added/rewritten: all22 existing note bodies and retained FK estimates are unchanged. Current both syntax/bounded SVG/index/identity PASS belong to the actual complete v5 run, not a new keeper command; separate note/navigation preflight is not an extra29 invoice job.
The lead reconciled the reported arena shared-verifier label drift before freeze. FEATURE_GATE and its two scope-exclusion legend labels now use stable cumulative-verifier wording; arena coverage/index remain unchanged. There is no dual v4 runtime.
Separate lead preflight PASS (outside the29-command invoice): covers38/59/index literals/source pointers/files agree; all45 entries/all44 nontraining entries including arena/top metadata unchanged;22 note bodies byte-unchanged/2–5 lines/max46 columns; historical PLAN suffix4+ and README first2+suffix6+ byte-exact to HEAD8d; exact4 new untracked math source/test+two F2 docs have expected inventory/no trailing whitespace, tracked diff whitespace PASS. Protected native/legacy/dependencies/locks/Node/config/model/corpus/evidence remain unchanged.
Current handoff: label drift was RESOLVED before the67a26 run; complete v5 PASS29/367/189/668 and ALL3 current final READY/no findings are DONE. Bounded verification/review is COMPLETE, publication authorized/unexecuted; full learner/genuine authority/decision-resource/calibration/readiness closure remains unestablished, trainingReady:false unchanged. No F3 repo docs/source are assigned or created here before actual F2 publication.
This pass touches only the two F2 Markdown documents and shared navigation prefixes, evidence/status only. It runs no commands/tests/hashes/renders/agents/reviews/Git/progress polls and changes no source/index/PUML or frozen normative goal/recipe. Historical navigation suffixes stay byte-untouched through prefix-only patches.
