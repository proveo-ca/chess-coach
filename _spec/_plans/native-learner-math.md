# F2 — native learner mathematics: goals and acceptance

**2026-10-18 · BOUNDED F2 VERIFICATION/REVIEW COMPLETE ·67a26 v5 PASS:29 COMMANDS / RUST367 / NODE189 / CORE668 · ALL3 CURRENT FINAL REVIEWS READY, FINDINGS NONE · PUBLICATION AUTHORIZED, NOT EXECUTED · trainingReady:false.**

The [math contract and reasoning](../ml/native-learner-math.md) owns exact APIs/formulas, finite/stable f64 behavior, streaming/sampling/atomicity and resource/admission gaps.
This plan owns delivery, ownership, independent oracles, acceptance and the complete-gate lock.
The complete87-line lead-persisted `f2-learner-math-freeze.md` was read. Architect `ses_eb7c5d187ffenpvgElk95FZ8ut` completed the final pure-math dependency plan; backend/DevOps read-only advisories are now DONE with no contradiction/fork/open human choice. They supply source/design guidance, not F2 execution proof.

## 1. Actual published prerequisite

The lead actually published **8d908d4c96641403f6161f118458ca66f2305a04**,29 files, parent b47befd021bef04eea0bfe20a9308a71aa20f09f, by successful non-force origin push. The lead confirmed local HEAD/remote equality and clean status **at that publication checkpoint**, before these F2 goal edits.
The [completed F1 base](native-feature-seams.md) retains its d389/v4 proof:29 commands,343 Rust/189 Node/668 core, ALL3 current READY/no findings and Node LOW resolved. This establishes bounded F1, **not F2 tests or learner/training readiness**.
The user authorized the verified milestone commit/push loop toward Training-ready. Actual policy training, activation and deployment remain unapproved.

## 2. Exact delivery boundary

| Implement in F2 | Explicitly do not implement/admit |
|---|---|
| Pure deterministic f64 linear logits, stable softmax/logP and explicit-uniform sampling. | No RNG/state/seed scheduling, native candidate selection authority or new Node production path. |
| Streaming decision statistics and atomic summed episode statistics capped at64 decisions. | No retained feature matrix, native episodes, ACK/eligibility marker, runtime coordinator or event/protocol change. |
| Frozen REINFORCE+single-L2 **arithmetic proposals**, detached from input weights. | No actual weight commit, baseline insertion, checkpoint/artifact, decoder/serialization or policy SGD run. |
| Independent scalar/finite-difference/test-only Burn f64 numerical controls. | No fitted model, trained-policy artifact, native-game update or synthetic score offered as policy readiness. |
| Source-bounded numerical evidence with explicit deferred resource/authority proofs. | No planning-meter allowance/exemption, cache/transport/geometry wiring, fitting/calibration/container work or readiness promotion. |

Preserve dependencies/pins, native engine, Node production, old synthetic model/scorer/baseline behavior, frozen R3/R4 bodies/Configuration26/Versions21/418 semantics/labels, protected fixtures/corpus/evidence and existing graph/status/history.
F2 is a **pure learner-math core**, not a complete learner or permission to use proposed weights.

<a id="3-planned-source-ownership--not-landed-files"></a>
## 3. Actual source ownership and completed handoffs

Both new files/narrow integration were read before freeze. The current complete v5 receipt supplies one actual unchanged-input F2 invoice (§5), not a sum of earlier leaves; ALL3 final current F2 reviews are now DONE/READY, findings NONE.

| Owner | Actual path/change |
|---|---|
| Rust math/test authors | `packages/training/src/learner_math.rs` / `packages/training/tests/learner_math.rs` LANDED; pure scalar production math and independent numerical controls, no production Burn backend. |
| Lead | Only `pub mod learner_math` in existing lib.rs; minimal xtask cumulative identity/exact nonempty-target/v5 normal+init metadata integration and accurate tooling README scope. Only lead owns shared integration files; no parser redesign/dependency/Node/config/model.rs change. |
| Spec keeper, current evidence update | Only these two F2 Markdown docs/shared navigation prefixes. No source/config/tests/index/PUML or normative goal/recipe edit after PASS; covers38/59 remain frozen. |
| Lead pre-freeze follow-up | DONE: arena FEATURE_GATE/legend use stable shared-verifier wording; arena coverage/index remain unchanged. |

Use existing dependencies; test-only Burn0.22 Flex is already part of the numerical verification context, not permission for a backend factory or dependency/pin change. Keep source comments instructional/WHAT-only; keep reasoning here.

## 4. Frozen acceptance matrix

Accepted goals/APIs/recipe/resource constraints below remain unchanged. Current complete v5 gate PASS29/367 Rust/189 Node/668 core and ALL3 final READY/no findings bind the same67a26 source. Bounded F2 verification/review is COMPLETE; publication is authorized but not executed, and no full learner/authority/resource/readiness claim follows.

| ID | Required behavior |
|---|---|
| F2-1 · minimal API | Exact Vector418/private Distribution/DecisionStatistics/EpisodeStatistics/MathError/proposal functions in detailed §2. LEARNING_RATE=.001, POLICY_TEMPERATURE=1, L2=.0001, zero initial θ/no bias; no recipe options. |
| F2-2 · finite deterministic math | Validate EVERY product/add intermediate, not just final sums; reduce coordinates/candidates ascending. Finite-only domain, no reuse of compat MAX_ABS_VALUE1e6 or zero-normalization/clipping/substitution. No entropy/Adam/shaping/teacher initialization. |
| F2-3 · stable distribution |1..512 finite logits; max-shifted softmax/log-sum-exp, direct **shifted** finite logP, never log(rounded p). Individual p may underflow0; p∈[0,1], sum error≤1e-12, order unchanged. |
| F2-4 · sampling |Explicit finite u∈[0,1), first CDF **strictly greater** than u; leading/trailing zero-p rows never selected, last-NONZERO fallback only within frozen rounding tolerance. Singleton still validates uniform; no RNG. |
| F2-5 · streaming statistics |Callback once/index ascending on success, no matrix; δ=φselected−Σpφ. On callback error only the visited prefix runs/no partial returned stats; propagate error without promising rollback of trusted FnMut side effects. |
| F2-6 · atomic episode SUM |≤64 sampled decisions, SUM δ/logP without averaging. Stage count/all vector additions/logP before mutation; decision65/nonfinite/overflow preserves prior state and counters. |
| F2-7 · proposal equation |For finite frozen θ, baseline[-1,1], R:i8 exactly−1/0/+1: A=R−b; L=−AΣlogP+λ·normSquared(θ)/2; g=−Aδsum+λθ; θ′=θ−.001g. L2 once; nonzero_pg uses computed PG terms ONLY, no epsilon, signed zeros count zero—not gradient/L2/observed movement. Never mutate θ. |
| F2-8 · zero decisions |Validate supplied θ/b/R, then None with no gradient/L2/update; do not compute overflowing L2 on an otherwise finite zero-sample input. No baseline insertion or committed state exists in F2. |
| F2-9 · numerical oracles |All418 coordinate-wise profile-A central differences plus independent fixed multi-decision scalar SUM objective/gradient and test-only Burn0.22 Flex explicitF64/no bias/autodiff/synthetic SGD cross-check. No self-derived oracle or native policy-training claim. |
| F2-10 · resource boundary |Module-owned O(512+418) numeric buffers/fixed temporaries, no matrix. No planning meter/new budget/admission. Future applicable complete schedule must account actual math/validation/copy work; particular naive over-cap schedules are rejected, not a global impossibility claim. |
| F2-11 · authority/preservation |All proposals/statistics are arithmetic data, not native/ACK/eligibility/commit permission. Frozen external contracts/data/model unchanged. Geometry/native-source reuse/permits/labels/collector/offline closure remain deferred. |
| F2-12 · verification gate |New v5/native-learner-math full unchanged-input gate retains all29 checks/F1 controls/unfiltered suites/preservation/2PUML+SVG/index/identity, adds exact nonempty learner_math target and two explicit new identity files. All3 fresh closing only after PASS. |

Compiler companions allowed without semantic forks: Distribution may expose conventional is_empty() (always false for valid construction); EpisodeStatistics may implement Default identical to new(). No alternative state/configuration/constructor authority follows.

<a id="5-planned-test-purpose-and-independent-oracle-matrix--not-run"></a>
<a id="5-persisted-numerical-controls--supplied-leaves-green-whole-gate-pending"></a>
## 5. Persisted numerical controls — current complete v5 gate PASS

All new numerical controls exist in `packages/training/tests/learner_math.rs`; fixtures remain test-local, not corpus/policy artifacts. Current proof below is the actual lead-executed full receipt, read without keeper reruns.

| Controls | Purpose / acceptance |
|---|---|
| All418 fixed basis-pair derivatives |For every coordinate use +e_i/−e_i, θ=0 and a fixed sampled index. ε=1e−6, atol=1e−8, rtol=1e−5; apply the exact frozen per-coordinate rule in detailed §6. No resampling/regeneration. |
| Independent multi-decision scalar reference |Hold features/selected indices/return/baseline fixed; independently RECOMPUTE likelihood at θ±ε, never reuse cached episode.log_probability_sum. Detect SUM versus mean/L2 duplication/nondegenerate advantage. No production-derived expected values or resampling. |
| Test-only Burn0.22 Flex explicitF64 |No-bias live graph/autodiff before host extraction and synthetic SGD(.001) agree with independent scalar math. λ appears only in objective, not optimizer decay; do not copy compat bias/MSE/.125. Numerical diagnostics, not policy training. |
| Reward direction / L2 / nonzero_pg |At θ=0/two distinct candidates, positive advantage increases selected logP and negative decreases it. Test single L2 application and regularization-only changes with nonzero_pg=false; do not add a configurable production λ. |
| Stable numeric extremes |[1e308,1e308]→p=.5/logP=−ln2, not0; [0,−1000] selected1 permits p0/finite logP; [−1e308,1e308] rejects shift overflow NonFinite; every product/add checked, not just final sums. |
| Sampling |Explicit uniform endpoints/domain, exact CDF boundaries/strict>, singleton with uniform, canonical order and last-nonzero rounding fallback; never select a zero-p tail. |
| Streaming callbacks |Exact ascending once-per-index visits including p0; on error visited prefix only/no partial stats, no claim that external callback side effects roll back. Validate every row/intermediate, no retained matrix. |
| Atomicity / isolation / zero choices |64 success/65 refusal; overflow at coordinate417 or summed logP preserves ALL old fields; input θ unchanged; finite1e308 θ with zero episode gives None before norm/L2 after input-domain checks. |
| Shape/domain/error cases |Shape:empty/513 logits/OOB selected; Domain:invalid finite uniform/baseline/return; NonFinite:NaN/∞/any intermediate overflow; DecisionLimit:65. Isolate invalid inputs, do not assert multi-invalid precedence. |

The fixed tolerance is not a universal dense arbitrary-tensor guarantee. Resource/authority/privacy/full-feature/runtime/fitting gates are separate, not converted into numeric tolerance or passing F2 checks.

<a id="actual-handoffs-and-supplied-execution-scopes"></a>
### Actual current whole-run evidence

Lead **sh_14d9ca465001oUg9fuIARE9ldq DONE/PASS**; [current receipt.json](/tmp/proveo-opencode-runtime-cache-1000-21d690750d3738af14d58c25/tmp/opencode/rust-training-68111-1792303474072266737-0/receipt.json) is PRESENT/read. Version/scope `rust-training-verification-v5` / `native-learner-math`, reviewEligible:true, error:null, identityError:null; all29 results PASS/exit0/reaped, no timeout/cleanup/reap failure.

```text
inputSha256 == inputSha256After ==
67a26d84b1ea4b6e03a86886a4c1df683b15f20534fdee7c466764a4a93c20ca
```

| Current same-input scope | Actual PASS / purpose |
|---|---|
| Rust workspace/all targets |367 =arena106 +training229 +xtask32 across21 binaries; required targets nonempty/unfiltered |
| Node engine / native core |189 /668, unfiltered |
| `packages/training/tests/learner_math.rs` |24, independent scalar/FD/test-only Burn F64 numerical, stability/sampling/callback/atomicity/zero-sample controls; included in training229 |
| Required retained F1/ledger/economic/readiness targets |29/11/42/49/9/4, included in their workspace totals |
| Finite differences / Burn |12,958 comparisons=31 fixtures×418 coordinates; all418 basis axes across7 batches×4 cases+3 sparse multi-decision fixtures. Actual test-only no-bias live F64/autodiff/synthetic SGD(.001); numerical diagnostics, NOT policy training/native episode updates/artifacts. |

This is one actual whole invoice, not stitched leaves or published F1 proof. All static/types/lint/fmt/all-targets check/Clippy-Dwarnings/build/selected CPU dependencies/locks/protected tracked+untracked preservation before+after/index38/59+44 nontraining entries/both PUML syntax+boundsSVG/receipt-time whitespace PASS. Actual Node stdout was read: `{"version":"v22.23.2","registerHooks":true}`. The exact five notEstablished scopes and all frozen resource/authority exclusions remain unchanged.
After PASS the lead staged the complete17 F2 paths, including all4 new files, passed cached whitespace and supplied the full17-path capture upfront to all three fresh reviewers. Source/config/tests/index/PUML bytes remain unchanged after PASS; these later Markdown status edits need final metadata checks/restaging before publication, not an invented new source hash or run.

No concrete F2 API/recipe/source mismatch was identified in the inspected production/test surface. This is not closing review. The lead corrected the reported arena shared-verifier label drift before freeze without changing its coverage/index entry.
Separate lead preflight PASS, **not extra29 invoice commands**: literal covers38/59/source files/pointers/index agree;45 entries/all44 nontraining entries including arena/top metadata unchanged;22 byte-unchanged notes fit2–5 lines/max46 columns; PLAN suffix4+ and README first2+suffix6+ byte-exact to HEAD8d; exact4 then-new untracked math-source/test+F2-doc files had expected inventory/no trailing whitespace and tracked diff whitespace PASS. Protected native/legacy/dependencies/locks/Node/config/model/corpus/evidence remain unchanged. Keeper runs no commands/tests/hash/render/agents/Git or reviewer polling.

## 6. Resource admission remains separate

The accepted freeze identifies particular naive schedules that do not fit the inclusive1048576 planning allowance:

- F1 minimum helper schedules alone:512×2048=1048576, before history/copies/features/queue construction.
- Conditional dense scalar schedule: dot428032 +weighted statistics428032 +vector stores214016 =1070080, already over cap **if all those operations belong to that inclusive scope**.

These reject those schedules, **not the frozen design globally**. F2 neither wires geometry nor introduces cache/transport/source-authority code, a meter reset/new allowance, cap raise, omitted support or hidden work.
Before future wiring, require a positive complete charged schedule bound to actual immutable native results/expected source references and complete operand/occupancy/projection dependencies. Charge lookup/binding/copy/store/recompute work; whole-queue caching does not fix512 distinct misses. No startup/precompute/native-table or generator-relabeling authority shortcut is admitted.
There is no current decision fork. If later no compliant complete schedule can be shown, STOP and present an exact amendment-or-deferral TUI with≥3 proposals; never silently relax frozen caps.

## 7. Implementation, v5 gate and review order

1. **DONE prerequisite:** actual F1 publication8d908d4c with bounded d389 proof/ALL3 READY. It does not pass F2.
2. **DONE freeze/goals/advice:** pure-math ordering and API/recipe are accepted; backend/DevOps read-only advice is DONE, no contradiction/normative fork/open choice. No source/tests/experiments ran in those advisories.
3. **DONE implementation:** pure scalar module and independent test file are present/read; supplied24 math/229 training leaves GREEN. No real native/eligible episode, weight commit or policy-training operation exists in F2.
4. **DONE root/spec sync:** lib exports learner_math; shared v5/native-learner-math constants/normal+init assertions, cumulative12 required inputs/mutation+restore+delete loop, exact nonempty learner_math target and existing mismatch/capability/import/MJS controls are present. Training owner/index append only the two actual math paths, fingerprint null. Arena shared-verifier labels are stable; its59 covers/index entry remain unchanged.
5. **DONE whole gate:** actual complete v5/native-learner-math run PASS at matching67a26 identity, all29 checks/unfiltered367/189/668. Normal+init metadata/five notEstablished families remain fixed; note/navigation preflight is separate, not added invoice commands.
6. **DONE closing:** ALL3 final current F2 read-only reviews READY, findings NONE, matching67a26/v5 proof; no F1 approval is borrowed. Any source/config/test/index/diagram change requires the entire gate again before rereview; only Markdown evidence/status edits proceed with final metadata/preservation checks.
7. **AUTHORIZED, NOT EXECUTED F2 publication:** verification/reviews are complete. After this handoff lead will perform final source-identity join67a26/navigation-suffix/whitespace/protected-scope checks, explicitly restage17 paths, commit/non-force push and verify actual remote/clean status. HEAD remains published8d until a later actual commit; no future hash is invented.

## 8. Current state and completion boundary

| Item | Status |
|---|---|
| Published F1 prerequisite |DONE8d908d4c96641403f6161f118458ca66f2305a04; bounded F1 evidence only |
| F2 freeze/goals |ACCEPTED / PERSISTED |
| Backend/DevOps read-only advice |DONE; source/design only, no contradiction/normative ordering fork or execution proof |
| F2 source/test/lib/xtask |LANDED / ALL SOURCE HANDOFFS DONE, uncommitted |
| Training owner/index coverage |DONE36→38, two actual literals/fingerprint null; arena59/other entries untouched |
| Current numerical/test proof |Math24/training229/xtask32 included in actual whole Rust367, not stitched leaves |
| Arena shared-verifier labels |RECONCILED before freeze; no arena coverage/index change |
| Complete v5 gate |DONE/PASS29 commands/367 Rust/189 Node/668 core, present67a26 receipt/matching before+after identity |
| ALL3 fresh F2 reviews |DONE/READY on current67a26 source, findings NONE; bounded verification/review COMPLETE, no review blocker |
| F2 capture/publication |Full17-path scope COMPLETE; publication AUTHORIZED, NOT EXECUTED, awaiting final metadata/hash-join/restage17/commit/non-force push |
| Full learner/training readiness/actual policy training |NOT ESTABLISHED / NOT AUTHORIZED by F2 |

F2 completion will mean pure numerical code/proposals with identified bounded v5 evidence/review/publication, not a complete learner, native episode authority, runtime/resource admission, fitted belief/calibration or training readiness. Actual policy SGD/formal primary require separate later approval; learned transfer/admission follows training, not a circular pre-training prerequisite.

<a id="current-fresh-f2-closing--verdicts-pending"></a>
### Current F2 closing — ALL3 READY, findings NONE

| Read-only reviewer/session | Actual current F2 disposition |
|---|---|
| Adversarial `ses_eb7cb724effe5uE3Hebn2Gb0wF` |DONE `READY TO MERGE:yes`, findings NONE; complete current17-path F2 diff |
| Security `ses_eb7cb7218ffePBBBS1MqCmBCtM` |DONE `READY TO MERGE:yes`, findings NONE; all17 paths/four new files/surrounding source and current v5 receipt/logs inspected, scope COMPLETE; read-only/no independent gate rerun/edit |
| DevOps `ses_eb7cb7206ffe1XrslbW4r6OyGq` |DONE `READY TO MERGE:yes`, findings NONE; cumulative inputs/exact targets/v5 metadata/five exclusions/current17 scope/receipt+logs/identity inspected, no independent gate rerun/edit |

The [current17-path capture](../ml/native-learner-math.md#93-current-f2-closing-and-capture) is against published8d and includes all new files. All current approvals are actual67a26/v5 F2 verdicts, not old F1 approvals. Optional property/extreme/append-rollback strengthening is non-blocking/not executed proof. No F2 publication or native-policy update/training is claimed; F3 repo docs/source remain outside this evidence update and require actual F2 publication first.
