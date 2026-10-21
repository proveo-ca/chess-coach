# F8 — owned normalization and categorical banded joints: accepted contract

**2026-10-21 · BOUNDED F8 VERIFICATION/REVIEW/PUBLICATION COMPLETE · HISTORICAL e540 v11 PASS29/550 RUST/189 NODE/668 CORE · ALL3 FINAL F8 READY/NONE · PUBLISHED e3fa7d99 / MATCHED HEAD=REMOTE / CLEAN AT PUBLICATION CHECKPOINT · trainingReady:false.**

Lead reported verified publication **e3fa7d9947d6b631cdd972596949385d5ad8e759**, `feat(training): normalize owned joints and retain categorical bands`,18 files,parent ed4a. Final470-source join e540/whole-v11/ALL3 READY/NONE/exact18/nav/preservation/whitespace/cached checks preceded commit/NON-FORCE push and full HEAD=remote/CLEAN checkpoint. Receipt/capture/read statements below record that historical revision, NOT current temporary-file availability or an Oct21 rerun. [F9 mapping](native-ingress-authority.md) is now MAPPING ACCEPTED/NOT IMPLEMENTED; later plan/invoice/operational gates still block implementation/execution.

The [PR plan](../_plans/native-banded-joint.md) owns sequential authorship, acceptance/oracles and gate order. Both CURRENT accepted external documents were read FULLY:
- `/tmp/proveo-opencode-runtime-cache-1000-21d690750d3738af14d58c25/tmp/opencode/f8-banded-joint-freeze.md` (54 lines).
- `/tmp/proveo-opencode-runtime-cache-1000-21d690750d3738af14d58c25/tmp/opencode/f8-banded-joint-addendum.md` (54 lines).

Accepted architect/domain advice, the [existing training owner](../packages/training/burn-compat.puml), [historical e540 evidence](#current-f8-evidence), ALL3 F8 READY/NONE and publication e3fa retain bounded same-input F8 scope. This small publication-status/restoration framing update changes no F8 normative API/math/fees/order/caps or source/config/tests/index/PUML, and claims no newly available receipt/native proof.

## 1. Actual prerequisite and numerical-only scope

Lead committed/NON-FORCE pushed **ed4aebd233a5d91db2af4d2a6b4cd4470befb744**, `feat(training): pair numerical evidence tables and weighting`,18 files,parent4158065da37fd867b572a17d2f6271d687519584. Actual post-push full HEAD/remote matched ed4a and tree was CLEAN **at that checkpoint**, before F8 edits. Before commit,468-input source joined a6f6; whole-v10 ALL29/517 Rust/189 Node/668 core/ALL3 current READY/NONE/exact18/nav/preservation/whitespace/cached checks passed. [F7 proof](native-evidence-tables.md#current-f7-evidence) is bounded NUMERIC tables/weighting, NOT F8/readiness; preserve4158065d/723e/59e1/29018157/bf4d/8d/b47/user4990.
F8 connects consumed F7 EvidenceWeightedAccounting→ONE owned global normalization→consumed NumericJoint→categorical banded representation→borrowed, detached UNTEMPERED expansion for future numerical use. It is NOT EconomicBeliefState/opening/history initialization/genuine publicSupport/native authority or an integrated estimator. F4 temperature readout uses a PRIVATE COPY only, never recursive feedback.
Frozen representation is **FULL discrete conditional PMFs, NOT Gaussians**: no mu/sigma/variance floor/cell integration/approximation/new kernel. No public raw-component constructor/deep Clone/serde/codec/artifact/session/boundary/permission. Preserve public F4/F7 outputs/BITS/invoices/failure prefixes/old quantile guards, frozen R3/R4 bodies/Configuration26/Versions21/native/legacy/model/Node/config/dependencies/locks/pins/corpus/data/evidence. Native D+B labels/terminal-closeout truth stay unchanged; no policy-training/activation/deployment approval.

## 2. Exact implemented public API and private representation

Reuse F7 EvidenceWeightedAccounting, F4 NumericJoint/NumericSupport/JointMathError/JointMathResult and caller LedgerWork/LedgerError. No component fields become public or unchecked input.

```rust
pub struct NumericBandComponent {
    /* private bank, band, mass, FULL conditional Vec<f64> */
}
impl NumericBandComponent {
    pub fn bank(&self) -> u8;
    pub fn band(&self) -> u8;
    pub fn mass(&self) -> f64;
    pub fn conditional(&self) -> &[f64];
}
pub struct NumericBandedJoint {
    /* private components + owned NumericSupport */
}
impl NumericBandedJoint {
    pub fn components(&self) -> &[NumericBandComponent];
    pub fn support(&self) -> &NumericSupport;
}
pub enum BandError {
    Domain, NonFinite, Underflow,
    Joint(JointMathError), Work(LedgerError),
}
pub type BandResult<T> = Result<T, BandError>;
pub fn normalize_weighted(
    weighted: EvidenceWeightedAccounting, work: &mut LedgerWork,
) -> BandResult<NumericJoint>;
pub fn reband_joint(
    joint: NumericJoint, work: &mut LedgerWork,
) -> BandResult<NumericBandedJoint>;
pub fn expand_joint(
    banded: &NumericBandedJoint, work: &mut LedgerWork,
) -> BandResult<NumericJoint>;
```

Getters borrow/copy cached scalars in O(1), no deep clone/scan. NumericBandedJoint owns components AND the existing checked support; its support/cached certainty are not inferred from PMF zeros. Full conditional entries include zeros; positive components are unique and bank/band sorted. No public hand-authored component/vector constructor or authority status/codec is introduced.

## 3. Exact categorical domain, order and partial-domain refusal

```text
N = 13*577 = 7501; bank0..12; material D0..576
band starts = [0,1,2,3,4,6,8,12,16,24,32,48,64,96,128,192,256,384,512]
band widths = [1,1,1,1,2,2,4,4,8,8,16,16,32,32,64,64,128,128,65]
SUM widths = 577; final band512..576 has width65
C = positive bank/band components, 1..247
L = SUM FULL widths of positive components, L<=7501
```

Canonical traversal is bank→band→D ascending. For each band use ORDINARY binary64 `mass=SUM p(B,D)`. If mass==0 omit that component ONLY, never Boolean support. Otherwise require strict finite mass∈(0,1], retain EVERY full-band cell and compute `conditional[offset]=p(B,D)/mass` in ascending D. Each conditional must be finite∈[0,1]; positive arithmetic erased to0 refuses Underflow. Conditional sum and the positive-component-order mass sum each satisfy `abs(sum-1)<=1e-12`.
No Kahan/reassociation/residual-to1 repair/clamp/floor/tail drop/new tolerance/mean-sigma approximation. Component mass may exceed1 through rounding EVEN when a valid F4 joint has global sum1±1e-12. **Reject strict mass>1.** This is an allowed PARTIAL DOMAIN of reband_joint, not a claim every NumericJoint can reband successfully, not an impossible-case assumption and not permission to clamp/renormalize around failure.
Expansion uses the specified canonical `p(B,D)=component.mass*conditional[offset]`, with checked domains/positive underflow/nonfinite/outside-mask/index/store. Omitted bands remain initialized ZERO. Validate the final dense normalized SUM, **NO division by another total**. Reband→expand roundtrip need NOT reproduce original BITS: compare against independent specified ordinary SUM/DIV/MUL, never broad-tolerance/residual repair or Gaussian oracles.
Mask storage/cached certainty retain EVERY true cell including zero-PMF support. Zero-mass band omission is not mask pruning. Rebanding/expansion are untempered; private-copy F4 readouts cannot feed back their temperature or alter the banded model.

## 4. Exact implemented private bridges and error mapping

A owns the new module plus ONLY narrow existing F7/F4 bridge/helper/private units SEQUENTIALLY. B owns ONLY new integration tests, lead lib/root. Module-private representation fields remain private except crate-visible PARTS fields; no public unchecked constructor/production observer/unsafe allocator.

```rust
// Inside evidence_tables.rs:
pub(crate) struct WeightedAccountingParts {
    pub(crate) masses: Vec<f64>,
    pub(crate) accounting_cells: Vec<bool>,
    pub(crate) retained_mass: f64,
}
impl EvidenceWeightedAccounting {
    pub(crate) fn into_numeric_parts(
        self, work: &mut LedgerWork,
    ) -> Result<WeightedAccountingParts, LedgerError>;
}

// Inside joint_math.rs:
pub(crate) struct JointOwnedParts {
    pub(crate) probabilities: Vec<f64>,
    pub(crate) support: NumericSupport,
}
pub(crate) fn normalize_aggregate_owned(
    masses: Vec<f64>, cells: Vec<bool>, work: &mut LedgerWork,
) -> JointMathResult<NumericJoint>;
impl NumericJoint {
    pub(crate) fn into_owned_parts(
        self, work: &mut LedgerWork,
    ) -> Result<JointOwnedParts, LedgerError>;
}
impl NumericSupport {
    pub(crate) fn copy_checked(
        &self, work: &mut LedgerWork,
    ) -> JointMathResult<NumericSupport>;
}
pub(crate) fn from_normalized_owned(
    probabilities: Vec<f64>, support: NumericSupport,
    work: &mut LedgerWork,
) -> JointMathResult<NumericJoint>;
```

F7 parts charge32 BEFORE destructure/MOVE SAME two heaps+cached retained scalar. No clone/replacement7501 arrays; cachedRetained never substitutes for canonical recomputed TOTAL. F4 joint extraction charges32 BEFORE destructure/MOVE probability Vec+existing NumericSupport and its cached certainty. This is numerical ownership, not native authority/unchecked permission.
Map LedgerError→BandError::Work; JointMathError::Work(error)→BandError::Work(error), Joint Underflow→Band Underflow, Joint NonFinite→Band NonFinite; every other Joint error→BandError::Joint(error). Preserve typed Budget payloads/no string conversions. Consuming failure may DROP owned input/temporary buffers and returns NO partial result; it is NOT rollback of the consumed argument or a coordinator transaction. Borrowed banded models/priors remain immutable.

## 5. Exact owned F4 helpers and normalization invoice

Engineering profile **`native-banded-joint-work-v1`**, SAME inclusive caller1048576 LedgerWork. Header before metadata/length checks; rest prepay before covered stack/heap/copy/scans/math/mutation/moves. No reset/refund/new allowance/discount/truncation/hidden startup exemption; unused charged work stays spent. Actual helpers match these frozen invoices, with source reads and reported independent leaf controls below, NOT whole-v11/runtime admission.

### 5.1 normalize_aggregate_owned —390180

1. Charge header128. Check BOTH mass/mask lengths==7501 using metadata BEFORE proportional access; reject mismatches with typed Joint error.
2. Prepay **52N=(24 certainty+16 validation+12 normalization)N** BEFORE scans/mutation. Derive certainty from ALL Boolean mask cells, independent of PMF, with empty-mask refusal.
3. Canonical ordinary mass total: finite/nonnegative, positive masses inside mask, finite TOTAL>0; zero total is EmptyMass. Cached F7 retained value grants no scan exemption.
4. Ascending INPLACE division by that ONE global TOTAL; check finite divisions, positive underflow and normalized sum1±1e-12. MOVE original probability/mask buffers into NumericJoint/NumericSupport with correct ALL-mask cached certainty.

No heap allocation/array initialization/replacement support clone/Kahan/clipping/residual repair/extra temperature operation. F8 normalize_weighted costs **128 entry+F7parts32+390180=390340**.
Old public support+normalize costs **510900**, versus owned F4 helper390180: saving **120720** comes from ACTUAL elimination of THREE replacement allocations plus initialization/copy/redundant headers, not a discounted tariff. Source shows the old from_cells allocation plus two old public normalize arrays, whereas owned normalization allocates none; safe private/integration controls compare old numeric BITS and SAME live mass/mask pointers. This is source/pointer structure, not allocator instrumentation. Old PUBLIC F4/F7 arithmetic/BITS/invoices/failure prefixes stay unchanged.

### 5.2 NumericSupport::copy_checked —60328

Charge128, check length BEFORE allocating; prepay allocation192+8N before ONE fresh Boolean buffer initialization/copy. Copy ALREADY checked cached certainty; do NOT rederive it, infer it from PMF or allocate a second support vector. `128+192+8*7501=60328`.

### 5.3 from_normalized_owned —120144

Charge128, check probability/support lengths FIRST; prepay16N before finite/nonnegative/positive-inside-mask/finite-positive-total/normalized sum1±1e-12 validation. MOVE the supplied probability Vec+checked support/cached certainty. **NO allocation and NO DIVISION.** `128+16*7501=120144`. Immutable private component/conditional invariants do not waive this final dense validation.

## 6. Exact reband_joint phases —129332+248C+28L

1. Entry128/check fixed metadata; JointOwnedParts extraction32 BEFORE destructure/MOVE. BORROW compile-time19-band table by REFERENCE, not an unbilled19-array copy/sweep; reference/index setup belongs to header/band blocks.
2. Prepay scratch **4*247=988 BEFORE ONE247-f64 array**, then band headers32*247 and band-mass scan16N BEFORE covered work. Bank→band→D ordinary SUM caches247 masses/C positives/L full widths and the component-order TOTAL of POSITIVE component masses. Enforce strict mass(0,1] or zero omission; no clamp.
3. Prepay component Vec **192+24C BEFORE capacity EXACTC**. For EACH positive band of width w prepay **192+4w+24w+32 BEFORE exact-width conditional allocation/fill**, all w DIV/domain/positive-underflow/store/SUM/completion work, INCLUDING zeros. No implicit Vec growth, per-source vectors, extra247 scratch or deep support copy.
4. End32 validates the CACHED global component TOTAL1±1e-12; NO component rescan/re-sum/hidden band sweep. MOVE40 BEFORE final components/existing support ownership. Construct successful banded output, then DROP old dense probabilities ONLY AFTER all component/check/construction success. Existing support allocation/pointer and cached certainty move unchanged.

```text
fixed = 128+32+988+32*247+16N+192+32+40 =129332
components = (24 metadata+192 conditional allocation+32 completion)*C =248C
conditional initialization/math = (4+24)*L =28L
TOTAL =129332+248C+28L; C<=247,L<=7501 -> max400616
```

Logical reband peak is old denseN+conditionalL+componentsC+scratch247+ONE maskN. No retained second dense/per-source array. This is logical structure, NOT allocator/RSS measurement. Consumed input may be dropped on failure; no partial banded result/rollback promise.

## 7. Exact expand_joint phases —210796+32C+16L

1. Entry128 fixed metadata/reference. Prepay **192+4N BEFORE ONE new probability Vec zero-init**; omitted bands retain initialized ZERO.
2. EACH component header32 precedes bank/band canonical unique order/domain/exact full width checks. Prepay **16w BEFORE each product loop**: conditional finite∈[0,1], mass finite∈(0,1], specified mass×conditional, positive underflow/nonfinite/outside-existing-mask-positive refusal, checked canonical index/store. No per-cell public F3 joint_index helper or extra N array.
3. Pay support.copy_checked60328, THEN from_normalized_owned120144. NO immutable conditional/component-total recomputation/re-sum, NO second global DIV/residual adjustment. Final dense-N normalized validation is explicitly paid by the constructor; checked support certainty is preserved in detached output.

```text
fixed =128+192+4N+60328+120144 =210796
TOTAL =210796+32C+16L; C<=247,L<=7501 -> max338716
```

Expansion intentionally creates detached probability/mask storage, leaves borrowed banded components/support unchanged and uses no deep Clone shortcut. Pointer checks compare new storage with LIVE banded conditional/support allocations, NOT freed original dense addresses that an allocator may reuse. Roundtrip correctness is specified SUM/DIV/MUL, not original-bit identity or another normalization.

## 8. Actual independent oracles and resource/authority limits

Independent hardcoded bands/widths cover DiracD5→band4..5/[0,1], D576→final65/offset64, sparse interior/trailing zeros, cross-bank/band boundaries/all247 uniform components/full7501 conditional entries. Uniform reference uses ORDINARY specified band SUM then DIV, not assumed exact1/width. Controls check zero-mass omission with preserved true zero-PMF mask/cached certainty; exact specified roundtrip DIV/MUL/no Gaussian oracle/no broad repair/no residual patch.
Test F4-valid global-tolerance input whose component sum exceeds1: strict Domain refusal is allowed partial-domain failure, never clamp/assume impossible. Cover conditional domains/zero TOTAL/empty mask/outside-support positive/NaNInf/Underflow; safe private invalid fixtures may defend otherwise unreachable invariants without public unchecked constructors or production observers.
Owned norm must match OLD public canonical numeric results while moving BOTH mass/mask pointers; existing support allocation moves through reband. Expanded dense/mask pointers detach from LIVE banded storage; F4 private-copy temperature readout leaves banded/support unchanged/no feedback/PMF-derived certainty. Exact/one-below controls must fail BEFORE stack/heap/scans/copies/moves; retain prior charges/no refunds. Old public F4/F7 BITS/fees/failure prefixes/old quantile guards remain exact.

```text
full-support wrapper normalization390340
  + reband maximum400616
  + expansion maximum338716
  =1129672 >1048576 SAME caller meter
```

This valid maximal-shape composition may Budget-refuse; no reset/refund/discount/cap raise/truncation/new allowance/startup exemption follows. It establishes neither composed-window fit nor GLOBAL impossibility. Future F6/F7+genuine prior/history/source/recipient/grant/artifact bindings+normalization/reband/expand/readout+ALLcandidate features still require a positive COMPLETE invoice. No hidden startup/generator-work relocation/fee-cap-policy waiver; frozen1M/10s/300s including3 cleanup/separate generator2048 remain unchanged.
Safe private/source audit/error/pointer/logical-capacity controls are NOT allocator instrumentation/RSS/D1/full fitter/runtime-container admission; no new production observer/unsafe allocator. Borrowed models stay immutable; consuming error/no partial output is not coordinator transaction/argument rollback.
Genuine prior/history initialization/spatial CC+Marine frontier/native publicSupport/codec/calibration artifact/real fit/full418/geometry/runtime containers/unwaived R4 resource/authority closure remain separate. Native D+B labels/terminal-closeout truth remain preserved. Frozen24k belief acceptance remains pretraining; actual policy training/activation/deployment need separate approval, learned transfer/admission follows training. No genuine belief/full estimator/calibration/readiness/native permission is established.

## 9. Actual source/root/coverage integration and completed whole gate

F8 actual paths, **HANDOFFS DONE / PUBLISHED e3fa**:

```text
packages/training/src/banded_joint.rs
packages/training/tests/banded_joint.rs
```

A completed new module+ONLY narrow existing evidence_tables.rs weighted MOVE/private controls and joint_math.rs owned helpers/private controls sequentially; B completed ONLY new tests; lead integrated lib/root/package+tool READMEs. No F3/F5/F6/Node/config/dependency/new fixture/model/native/protocol/data/pin changes. Existing bridge files remain covered/identity-bound; old public F4/F7 BITS/outputs/fees/failure prefixes and numerical tolerance/order stay unchanged.
Shared normal+init receipts/assertions use **`rust-training-verification-v11` / `native-banded-joint`**; BOTH new required identity/mutation/restore/delete inputs KEEP22 F1–F7/already-bound bridges are present. Exact nonempty tests/banded_joint.rs joins missing/zero/lookalike/name-summary guards. No parser/dependency/Node/config/timeout/readiness-command or hardcoded future totals change. The PRESENT actual v11 receipt below now establishes whole-gate PASS, not merely integrated logic.
Retain ALL29 previous jobs/actual Node capability hook/import guard/MJS/prior numeric/full unfiltered Rust+Node+core/static/fmt/check/Clippy-Dwarnings/types/lint/build/CPU dependencies/BEFORE+AFTER tracked+untracked preservation/two syntax+bounded SVG/index/whitespace/content identity. Normal/init metadata retain exactly:

```text
full-training-closure
genuine-native-authority
whole-decision-adequacy
calibration
training-readiness
```

After final handoffs, keeper read FULL516-line module/FULL1056-line integration/narrow F4F7 bridges+private controls/root. Prior training owner/index48→50 added exactly two actual literals/null, retaining bridge edges. Arena59/all44 other entries/metadata/stable labels/22 old notes/FK remain preserved; no new note. Categorical ownership graph keeps masks/P0 separate and adds no genuine belief/host/CLI/native permission/init/spatial/encoder/fit artifact/runtime closure edge. Whole-v11 syntax+bounded SVG/index/identity PASS; separate lead preflight confirms45 entries/44 nontraining+metadata/literal50/59+SPEC files/22 byte-unchanged2–5-line notes max46/nav suffix byte-exact ed4a/exact4 new files/whitespace/protected F3F5F6/native/legacy/model/Node/config/deps/pins/data. That preflight is NOT extra29 commands.
Historical unchanged-input e540/v11 PASS preceded ALL3 F8 READY/NONE/complete18, then final470-source join e540/metadata/preservation checks/restaging and publication e3fa. Later source fixes require their whole gate; no current temp availability/new verification/F9 approval is inferred.
Bounded F8 verification/review/publication is COMPLETE: historical29/550/189/668 + ALL3 READY/NONE + e3fa. API/math/fees/caps/order/tolerance and five exclusions/trainingReady:false remain unchanged. Current F9 mapping-acceptance metadata changes no source/config/tests/index/PUML/normative F8 body or proof scope and grants no F9 implementation/operations/new proof.

<a id="current-f8-evidence"></a>
## Current F8 whole-v11 evidence

Actual shell `sh_14fb412ea001dL4Nu60G6Zj2nR` completed DONE/PASS. Keeper read the PRESENT996-line receipt fully, raw Rust running/summary/private-control rows and binary inventory, actual Node capability stdout and closing18-path inventory/base-head. No keeper reruns/hash computation/review polling occurred. The lead machine-asserted the full invoice; this is ONE whole unchanged-input F8 run, not author-local leaf totals or published F7 proof.

Receipt: `/tmp/proveo-opencode-runtime-cache-1000-21d690750d3738af14d58c25/tmp/opencode/rust-training-187563-1792338564203577100-0/receipt.json`.

```text
version: rust-training-verification-v11
scope: native-banded-joint
status: PASS
reviewEligible: true
error: null
identityError: null
inputSha256:      e5406570e975f192c09d73bb38e8a4b0ad1e346f514c2c958088b61d99a48027
inputSha256After: e5406570e975f192c09d73bb38e8a4b0ad1e346f514c2c958088b61d99a48027
commands: 29/29 PASS / exit0 / reaped:true
timedOut:false / cleanupTimedOut:false / cleanupError:null / signal:null
Rust: 550 = arena106 + training412 + xtask32 / 27 binaries
Node: 189 / core: 668
```

ALL old/new required targets are unfiltered/nonempty; zero-test standalone main binaries in the27-binary inventory are not required integration targets. Raw Rust summaries show zero failed/ignored/filtered. Actual Node stdout is `{"version":"v22.23.2","registerHooks":true}`. Whole static/fmt/check/Clippy-all-targets-Dwarnings/types/lint/build/selected CPUdeps/Node hook/import/MJS/prior numeric/BEFORE+AFTER tracked+untracked preservation/index50/59/two PUML syntax+bounded SVG/whitespace PASS in this SAME29-job run. External theme bytes remain unbound; this is not hermetic/container/resource closure.

| Current evidence | Actual bounded status / limits |
|---|---|
| A/B source handoffs |DONE/PUBLISHED e3fa:516-line banded_joint.rs/1056-line tests/banded_joint.rs; narrow F7 weighted-parts MOVE/F4 owned helpers/private units; lib export/root metadata/identity/target/package+tool READMEs integrated. |
| Independent B target |23/23 PASS in actual whole-v11: hardcoded19-band SUM/DIV/MUL BITS/ALL247 components+7501 entries/full conditional zeros/strict partial domain/mask+certainty/no second norm/live-pointer MOVE+detachment/exact work/same-meter Budget. This23 is INCLUDED in412 training, itself INCLUDED in550 Rust. |
| Final unfiltered training |412 all-target PASS, zero failed/ignored/filtered:379 retained+23 new integration+10 new private units, all INCLUDED in550. Whole fmt/check/Clippy-all-targets-Dwarnings PASS; no extra23/10 added to412/550. |
| Ten safe private units |3 banded+5 joint_math+2 evidence_tables units defend malformed shapes/domains/NaNInf/empty mask/zero total/positive underflow/strict mass>1/ownership/precharge/typed Budget/no extra DIV. Actual raw private-control rows PASS; invalid fixtures introduce no public unchecked constructor/production observer/unsafe allocator/native admission. Included in412/550, not extra10. |
| Ownership/savings |Weighted-parts32→owned helper390180 preserves BOTH live heaps, wrapper390340 recomputes canonical TOTAL/ALL-mask certainty. Source removes THREE real old replacement allocations/init/copies/headers, saving120720 versus old510900 helper chain, not a discounted tariff/RSS measurement. Existing support moves through reband; expansion detaches against LIVE banded storage. |
| Root integration |32 unfiltered tests INCLUDED in550; whole workspace check/Clippy PASS. Shared v11 normal/init five exclusions/two NEW mutation-delete inputs KEEP22/exact nonempty target/ALL29 retained controls are exercised in actual whole-v11, not inferred from leaves. |
| Whole v11 / final reviews / publication |Historical whole PASS e540 + ALL3 F8 READY/NONE + publication e3fa DONE; matched/clean publication checkpoint. F7 prerequisites are not F8 proof; F8 is not F9 proof. No current receipt availability inferred. |

Reband129332+248C+28L/max400616, expand210796+32C+16L/max338716, owned wrapper390340, support copy60328/from-normalized120144 NO DIV remain exact. Full-support chain1129672>1M SAME-meter Budget refusal is included in actual whole-v11, not full-window admission/global impossibility. Consuming error may DROP input/no partial output, not rollback/coordinator transaction; borrowed banded models stay unchanged. Source-backed replacement elimination is NOT a tariff discount; source audit+safe pointer/private/error/logical-capacity controls are NOT allocator instrumentation/RSS/D1/full pipeline/runtime-container admission.
Five exact notEstablished families above/trainingReady:false persist. No genuine belief/native authority/authentic support/codec/artifact/empirical fit/calibration/full estimator/readiness or policy-training/activation/deployment approval. Frozen24k belief acceptance remains pretraining; learned transfer/admission follows training.
After verified F8 publication, the user accepted the exact [F9 mapping](../_plans/native-ingress-authority.md) only. It remains NOT IMPLEMENTED; later scoped plan/invoice/operational approvals are still required. No planning permit/contract relaxation/capture work follows.

<a id="current-f8-closing"></a>
## Current F8 closing capture and final review matrix

Lead staged explicit18 F8 paths AFTER whole PASS, including4 new files/existing F4/F7 bridges; cached-whitespace check PASS. Code/config/tests/index/PUML are FROZEN/unchanged after PASS. Complete closing capture supplied to all three fresh read-only F8 reviews upfront:

```text
directory: /tmp/proveo-opencode-runtime-cache-1000-21d690750d3738af14d58c25/tmp/opencode/f8-closing-review-5vJ7tx
head.diff: 187405 bytes
head.diff SHA256: 22dede0a3a424d09819fe501210a5690ef7692b0dbeb51561843337567e597d7
changed-paths.txt: 18 paths
inventory SHA256: 4dedebfd065f50b2fa00be45a12b7ff3e3a0c8234d2c1ba04f234a3921edbdfe
base-head.txt: ed4aebd233a5d91db2af4d2a6b4cd4470befb744
```

Historical capture identities/reads/preflight outcomes retain their recorded scopes; no current temporary capture availability is asserted. Final470-source join e540/nav/protected-scope/whitespace/exact18/cached checks/restaging preceded publication e3fa, not a self-hash loop/new run. Historical capture base remains ed4a.

| Fresh F8 reviewer | Session | Actual current verdict |
|---|---|---|
| Adversarial |`ses_eb7cb724effe5uE3Hebn2Gb0wF` |DONE / READY yes / findings NONE; complete18 diff, bounded owned normalization/categorical reband/untempered expansion |
| Security |`ses_eb7cb7218ffePBBBS1MqCmBCtM` |DONE / READY yes / findings NONE; all18 incl4 new/surroundings, ownership/shape-domain/mask certainty/canonical SUM-DIV-MUL/underflow/detach/prepay/no partial output; no new egress/dependency/credential surface; actual v11 receipt/logs29/550(training412)/189/668/e540/reviewEligible/errorsnull; no commands/edits/reruns |
| DevOps |`ses_eb7cb7206ffe1XrslbW4r6OyGq` |DONE / READY yes / findings NONE; complete18/current v11 raw29/550/189/668/27 binaries/matching e540 identities/reviewEligible; owned prepay/exact allocation/expansion NO DIV/cumulative identity-target guards; no edits/reruns |

ALL3 final F8 reviews are DONE/READY/no findings on the SAME complete18-path scope/PRESENT e540-v11 proof. Material final verdicts are current F8 approvals, NOT older F7 approvals in these sessions. Security/DevOps reported no reruns/edits; reviews add no independent execution proof. Optional strict-domain/underflow/budget property hardening is non-blocking/NOT executed proof; no LOW or pending F8 review blocker remains. Code/config/test/index/PUML changes require WHOLE repeat before rereview; all such bytes stay FROZEN/unchanged after PASS.
**F8 publication is COMPLETE: e3fa7d9947d6b631cdd972596949385d5ad8e759.** Lead reported final470-source join e540/checks/restaging/commit/NON-FORCE push and actual full HEAD=remote/CLEAN at that historical checkpoint. No new gate/current receipt availability/hash measurement/Git verification occurred in this restoration.
Bounded F8 proof/review/publication retains categorical FULL vectors/strict partial domain/MOVE/source-backed savings/public F4F7 fees and its exclusions. No allocator/RSS/D1/window-fit/full estimator/native/runtime-container/calibration/readiness/training approval follows. Five exclusions/trainingReady:false persist; F9 mapping-only acceptance is complete, implementation/operations remain blocked by later gates.
