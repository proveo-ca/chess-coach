# Gate0 / F9 / R4 closure contract

## CURRENT precedence amendment — accepted 2026-11-09

Executor's latest explicit priority is **training first on a supported functional path; ALL security/privacy hardening and isolation come LAST, after the planned training phase is complete and its results are validated**.
Do not resume hardening after one episode or a first checkpoint while the accepted training plan remains unfinished.
This accepted policy supersedes earlier pretraining sequencing, including the prior strict STOP, escaped-group and dual-crash requirements.
It accepts neither an implementation nor a gate result.
The architect advisory in session `ses_e43068215ffeuugrCoynxn0LkH` supports this training-first ordering.

The newly selected **training-functional profile** is distinct from the retained **full-assurance profile** below.
Historical exact-contract and amended full-assurance Gate0/F9/R4 remain OPEN; functional acceptance must never be reported as their PASS or closure.
The older matrices, C1 implementation packet, critical path and execution-packet requirements below retain their full-assurance meaning, not authority to restore pretraining hardening gates.
Where their present-tense instructions conflict with this amendment, this amendment governs current roadmap priority.
Read [readiness.md](readiness.md#current-precedence--training-functional-readiness-2026-11-09), [recovery.md](recovery.md#current-priority--training-first-2026-11-09) and [gate-closure.puml](gate-closure.puml) with this distinction.

### Current accepted critical path

Every phase below is planned work, not a new execution grant or a claim that its exit condition passed.

| Phase | Deliverable | Functional exit condition / authority boundary |
|---|---|---|
| 0 | One bounded upfront inventory of training-critical dependencies and blockers | Record dependency, current evidence, genuine functional blocker, required proof and separate approval; accept and freeze the functional gate set before implementation or operations |
| 1 | Supported runtime/toolchain and actual GPU feasibility on the selected host-backed shared-GPU Docker container path | Establish the chosen path's actual startup, build/runtime compatibility and F64 GPU feasibility; determine whether it needs any part of the old isolated diagnostic pipeline rather than mandating completion of that pipeline |
| 2 | Functional canonical init/BOTH/reference/close evidence and integrated R4 game/model/economic correctness | Obtain genuine source-bound canonical init/open/pass, BOTH histories, independent reference comparison and orderly close/EOF/reap; verify recipient facts, economic conservation, scoring/context, episode/artifact binding and deterministic game eligibility on the selected path |
| 3 | Actual GPU F64 numerical and learner validation | Retain all 4,670 finite-difference coordinates at `eps=1e-6`, `atol=1e-8`, `rtol=1e-5`; prove actual GPU scoring, backward, SGD, checkpoint reload and exact C12 redundant-learner digest agreement; leave CPU Flex and master initialization unchanged |
| 4 | Accepted functional readiness, then **COMPLETE PLANNED TRAINING AND VALIDATE RESULTS** | Explicitly accept the frozen functional evidence; obtain a separate explicit training-execution grant before any training; complete the authorized planned training phase and validate its results under the unchanged model, five-master experiment, learning and eligibility contracts |
| LAST | **ALL security/privacy hardening, isolation and full-assurance qualification** | Only after completion of the planned training phase and validation of its results: separately scope, approve, implement and qualify runtime-domain security, isolation, custody/provenance assurance and final full-assurance acceptance; no historical finding or gate passes by deferral |

### Phase 0 — bounded dependency/blocker inventory

Use one inventory for the selected functional path, not a new open-ended prerequisite audit at each slice.
The rows below identify known evidence gaps; they do not establish missing host facts or approve a concrete implementation.

| Dependency | Current evidence | Genuine functional blocker | Required proof | Separate approval |
|---|---|---|---|---|
| Selected supported runtime/toolchain | CPU recipe and Rust source/manifests remain unchanged; optional GPU recipe source and [local-3 scoped PASS](gpu-readiness.md#current-local-evidence--gpu-functional-local-3-only) remain separate from host proof; the original cache miss remains historical; the [latest operator result](gpu-readiness.md#current-bun-only-operator-result--authority-consumed) reports exact Bun pull success/inspect 0 `linux/amd64`, Rust inspect 1 missing, one container object and OCI `nvidia-container-runtime` lookup failure before process/GPU-query start; query 127, cleanup 0 are pasted reports, not received host machine files; see [gpu-build.puml](gpu-build.puml) | Missing installation versus service PATH versus execution-host location remains unknown; no Bun/CUDA numerical failure is established; missing Rust authorizes no pull; the optional recipe is not a built image and CUDA/three prepared inputs/F64 remain unqualified/unselected | Future selected-input GPU-feature build plus actual host GPU F64 execution on the chosen supported path; retain phase 3 numerical/C12 proof and compatibility, not full isolated-root qualification; the [read-only lookup proposal](gpu-readiness.md#proposed-read-only-runtime-lookup--not-executed) remains unexecuted despite [lookup-local-3 syntax/static/type PASS](../_work/gpu-owner-recovery/runs/gpu-runtime-lookup-local-3/receipt.json), and shell/client paths cannot establish daemon-host PATH; explicit runc + GPU selection is only an unapproved legacy/CDI/Engine-dependent candidate, not a selected route | Bun-only authority is **CONSUMED: pull 1/probe 1, zero remaining**; original pending request/renewal bytes remain historical; no retry, new pull/container, install, configuration change, restart, build, LLVM/libdevice/archive work, CUDA kernel, training, full-pipeline renewal or publication is approved |
| Functional GPU training activation | `tooling/runtime/Dockerfile.gpu:50` retains `job.ts`; `packages/runtime/src/job.ts:11` permits only `native-proof`; `packages/runtime/src/gpu-job.ts:142` and `crates/gpu-owner/src/main.rs:10` retain `SOURCE_ONLY_DISABLED` normal mains | The recipe does not enable or connect the operational GPU training path; this known activation gap is functional work, not deferred security hardening or a new pre-input-selection gate | After selected-host GPU capability proof, separately implement and verify the approved activation/wiring through ordinary source/test/readiness checks; preserve numerical/model contracts and keep capability proof distinct from training enablement | No activation design/change is approved or implemented by the recipe; later activation work and actual execution/training require their own explicit scope/authority; the Bun-pull/visibility renewal is consumed and the compatible-input route remains unselected |
| Bun on that functional path | The private quarantine Bun audit aborted; cause remains `UNDETERMINED`; diagnostics remain 0/3 with no accepted binding | The abort is a functional blocker only if the chosen path depends on the failing behavior; its relevance remains unresolved | Determine that dependency and prove required startup/work on the selected supported path; do not require completing the old isolated diagnostic pipeline by default | A fresh explicit scope decision before any diagnostic, alternative runtime operation or replay; existing blocked requests do not suffice |
| Canonical game/reference and integrated R4 | Retained source/synthetic receipts do not supply actual selected-path integrated proof | Missing actual functional init/BOTH/reference/close and game/model/economic evidence | Phase 2 proof and existing functional negatives, without adding new privacy/isolation assurance | Separate exact runtime/reference verification grant |
| F64 GPU and C12 learner path | Recorded CPU evidence covers 4,670 coordinates; actual GPU F64/C12 remains unqualified | Missing real required GPU computation, numerical agreement and update/reload evidence | Phase 3 actual F64 scoring/backward/SGD/reload and exact C12 digest comparison | Separate bounded actual-GPU verification grant; no CPU or reduced-precision fallback |
| Bounded execution, coexistence and ordinary outputs | Host uses the reported GPU; the [received operator snapshot](gpu-readiness.md#current-host-observations--received-operator-reported-metadata-only) reports an RTX 3070 Laptop GPU with 8,192 MiB total / 7,742 MiB free, not a reservation or fit qualification; actual admitted target and state/output locations remain unresolved | Insufficient capacity, unsupported ordinary limits or failure to produce/reload the required functional outputs | Selected-path resource/VRAM fit, ordinary bounded job controls and truthful output/checkpoint receipts | Exact resource, target and output scope before execution; no new cgroup/custody proof prerequisite |

Accept the bounded inventory's proof requirements explicitly before using it as the functional readiness checklist.
Freeze those accepted functional gates to prevent scope ratcheting.
Route every newly identified security/privacy/isolation requirement to LAST, even when a review rates it HIGH; retain its finding, severity and deferred disposition rather than fabricating a fix or PASS.
Reopen the functional inventory only for a demonstrated training-critical correctness or supported-path feasibility blocker, with its evidence, minimal proof and explicit approval recorded.
Do not disguise a deferred assurance requirement as a functional dependency.

### Retained correctness and operational limits

Game/model correctness remains pretraining work; new privacy/security hardening does not.
Keep genuine recipient-authorized facts, hidden-fact exclusion, history/lineage, economic accounting, existing privacy-twin/noninterference tests, deterministic replay and game eligibility unchanged.
Do not remove or relabel existing functional tests, alter model inputs or expose hidden facts by calling that a privacy deferral.
Keep the model/objective, master seeds `101..105`, initialization, RNG/curriculum, sampling, baselines, checkpoint binding/reload, reward/failure classification and retained experiment contracts unchanged.
Infrastructure, timeout or failed-output episodes cannot become learned rewards.

Keep ordinary bounded-resource execution, original clocks/deadlines, bounded cleanup and honest failure reporting.
Retain C2 job ceilings, aggregate 24,000,000,000-byte RAM / 12-thread ceilings, output bounds and the final three-second cleanup reserve; do not renew clocks or retry automatically.
Preserve GPU cooperative admission/operational ceilings and coexistence with the host's reported in-use 8 GB GPU; a free-VRAM sample is neither a reservation nor guaranteed availability.
Keep the GPU attached to its host driver; CPU fallback and actual GPU work inside the coding sandbox remain excluded.
Ordinary output/receipt evidence must identify the work, result and failure scope truthfully; end-to-end hardened capture is not a pretraining dependency.
Require genuine successful close/EOF/reap for the functional positive; do not substitute forced removal or claim unconditional physical termination.

Defer strict physical-stop guarantees, escaped-group and dual-crash proof, native bridge/pidfd/cgroup/service/helper implementation, bwrap/namespace qualification, hardened read-only closures, anti-race/custody proofs, private custody storage, provenance-assurance qualification and runtime-domain security acceptance to LAST.
No new isolation or hardened capture/storage mechanism becomes a covert pretraining gate.
This roadmap does not remove or disable any existing configuration, safeguard or source path.

### Reviews, observed status and authority

AGENTS.md implementation reviews remain process requirements after feasible authorized verification.
Scope applicable reviews to functional correctness, the frozen supported-path gates and an explicit deferred assurance backlog; review participation does not require security hardening first.
Executor's latest instruction already supplies the policy decision to defer security/privacy/isolation-hardening findings until LAST.
Keep such findings open/deferred with their original severity; do not claim reviewer acceptance, clear an old HIGH, or reopen the same policy-deferral question merely because it is HIGH.
A genuine functional-correctness finding still requires resolution or its own explicit human decision.

Observed status remains **0/3 diagnostic cases, no accepted diagnostic binding, full pipeline halted, `trainingReady:false`**.
Only future explicitly accepted functional proof can change the observed readiness result; this plan cannot set that flag.
The unspent diagnostic allowance does not authorize invoking the existing blocked pipeline.
The full LLVM/archive request remains halted; no execution grant is renewed or inferred.
This amendment authorizes no source/tooling/request/receipt changes, archive acquisition/capture/replay, downloads, runtime upgrades, helper compilation, credentials, host/GPU inspection, process launch, native load, test, render, training or publication.
Any future implementation or operation needs its own applicable explicit scope and execution approval.

## Retained full-assurance contract — historical sequencing, not pretraining gates

All original text below remains intact for traceability.
Its historical grants, findings, gate matrices and proposed ordering do not override the current amendment or renew authority.

## Status and authority

Gate0 is OPEN.
F9 is OPEN.
R4 is OPEN.
`trainingReady:false` remains in force.

This matrix records retained obligations, explicit rebuild decisions and unresolved contract changes.
It does not accept its own proposal or authorize execution.
Historical contracts and evidence remain unchanged in the reference worktree at `b4b241481fb12de4a7344e6dba8eda775af57675`.
No historical gate result or operational grant transfers to this branch.

The current development grant covers bounded Rust/Cargo/Bun implementation, synthetic tests and static analysis.
Game-data collection, training, production host operations and deployment remain unauthorized.
Executor separately approved commit/publication of the current 19-file admission/GPU phase and its exact one-shot operator-run metadata packet; no broader publication or host operation follows.
The one-container synthetic Docker grant is consumed.
AGENTS.md requires adversarial review after implementation and feasible verification, before completion.
This runtime/permissions slice also requires security review; resolve BLOCKER/HIGH findings before completion or obtain the human decision required by AGENTS.md.

## Historical acceptance sources

The following paths are relative to `/home/gu1lty/Projects/proveo/chess-coach/`.

| Source | Governing scope |
|---|---|
| `_spec/_plans/native-ingress-rust-first-full-plan-packet.md`, §8, especially lines 583–604 | Gate0 design/prerequisite acceptance; separate capture, build, runtime qualification and Native proof |
| `_spec/_plans/native-ingress-gate0-checker.md`, §§2,4–6 | 36-record inventory; mechanical readiness never grants acceptance; finalization remains unapproved |
| `_spec/_plans/native-ingress-authority.md`, N1–N10 | Accepted historical F9 mapping; native-only proof, confinement, handoff, opening, lifecycle and negatives |
| `_spec/_plans/ml-adjutant-r4-economic-amendment.md`, §§3–12 | Historical economic model, features, binding and verification |
| `_spec/_plans/ml-adjutant-r4-economic-corrective-annex.md`, A1–A7 | Historical schema, independent expectations, economic/spatial calculus and statistical acceptance |
| `_spec/_plans/ml-adjutant-r4-owned-ingress-addendum.md`, O2–O10 | Historical owned ingress, permits, handoff, accounting and combined authority |
| `_spec/_plans/ml-adjutant-r4-weights.md`, §§3–9 | Candidate coverage, lineage, knowledge, objective, frozen inference and persistent validation |
| `_spec/_plans/PLAN-ml-adjutant.md`, lines 538–588 | R4 implementation versus R5 readiness, R6 training, R7 artifact and R8 challenge |

## Explicitly approved replacements

These rows record existing decisions, not newly inferred waivers.

| Historical implementation | Approved current implementation | Retained acceptance obligation |
|---|---|---|
| Bespoke DIRECT scalar meter, tariffs and prepaid ownership bootstrap | Shared standard OS CPU/memory/task envelope | BOTH-seat aggregate coverage; original S0+10s / S0+300s; final 3s cleanup; no reset after failure; real enforcement evidence |
| Custom compiler/linker/bootstrap/kernel infrastructure | Standard Cargo/Burn and supported runtime controls | Independent selected inputs, reproducible recipe, selected dependency/native closure and actual execution verification |
| V2 observation wire, Float64Hex and bespoke codecs | Versioned Zod/JSON Schema and standard JSON/Serde | Bounded validated data, recipient isolation, sequence/replay integrity and no schema-as-authority claim |
| 7,501-state estimator and old 418 feature meanings | `chess-coach.features.v1`, 2,271 coordinates | Genuine authorized facts, explicit unknown/memory channels, economic conservation, no hidden inputs or invented calibrated estimates |
| Historical linear scorer/checkpoint | Burn Linear(2271,32) → ReLU → Linear(32,1), native record | F64; state-dependent preferences; exact configuration/layout/checkpoint binding; incompatible artifacts fail |
| Eight-lane/family quotas and 2,048 attempted extensions | `chess-coach.enumeration.v1`, depth-cyclic FIFO / round-robin, 4,096 attempts | Pass; four actions maximum; 512 candidates maximum; recipient-only pruning; documented bounded coverage |
| Old provenance companion/frame wire and bespoke ownership machinery | Typed TypeScript/Zod causal journal | Stable identities, actual mutation causes, action references, deployment dispositions and causal recipient visibility |

The removed estimator's 24,000-group fitting, temperature calibration and probability-coverage calculations cannot verify the new representation.
Do not fabricate replacement probability outputs or report those historical checks as passed.
The gate-profile decision below must make this supersession explicit before current R4 closure.
Actual rule-level promotion/origin behavior remains required even though the old promotion-feature formulas are replaced.

## Accepted decision C1: amended current-branch profile

Executor selected `Rebaseline (Recommended)` in the interactive gate-profile question.
Proposal A below now governs current-branch Gate0/F9/R4 closure.
Alternatives B and C remain unselected reference.
Historical exact-contract results remain unchanged.
This choice accepts the stated supersessions and trust premise, not the unfinished implementation packet, concrete resource limits, any gate result or an operational grant.

Replacing DIRECT or the feature layout does not establish a replacement for every historical F9 trust requirement.
The original requirements include protected opened-object → actual exec/loading custody, actual daemon-used init identity, creator A before PID-derived `/proc`, separate B, Rust-only authority types, both main/reference process identities, and each independent FD0/1/2 route.
Current source implements none of that full qualification.

### Proposal A: explicitly rebaseline the current profile

Use Gate0/F9/R4 for the explicitly amended current-branch profile.
Keep historical exact-contract results OPEN rather than retroactively marking them passed.
Accept the selected supported runtime, host kernel, manager and operator-controlled immutable artifact store as trusted infrastructure.
Exclude a malicious host/daemon/administrator or hostile mutation of that infrastructure from the claim.
Do not claim kernel-witness or same-opened-object attestation.

Freeze an independent source/test/lockfile/build/runtime/reference expectation set before execution claims.
Replace prior-branch F8 publication and legacy named-auditor prerequisites with an independently registered current source snapshot and current selected-closure/partition/static audits.
Apply the active AGENTS.md review gates before implementation completion; do not defer reviews until training readiness.
Local gate closure does not require or authorize Git publication.
Build a read-only, offline runtime from the selected captured closure.
Fix the output-registration method before build; register actual artifacts after build and before qualification.
Use a pinned image-contained init with supported process supervision, rather than asserting identity of an unmeasured daemon-injected init.
Define exact policy controls without weakening nonroot, network, mount, namespace or capability restrictions by implication.

Replace creator A/B, kernel G1 consume and imported-FD custody with supported-runtime process creation, owned process handles and supervisor-created pipes.
Verify main/reference separation, inherited stdio endpoints, isolation, process death and complete reap under that declared trust premise.
Keep independent source-bound reference execution and comparison.
Select the reference from the frozen canonical rules snapshot, not the main worker's claimed output or a second invocation of the new resolver.
Pin the reference adapter and its dependency closure independently.
Hashes/manifests alone remain insufficient evidence of actual selected runtime behavior.
Keep all data/session/recipient/sequence/close/EOF/deadline negatives.

Replace ownership-registry/visitor mechanics with bounded serialized recipient batches and a private transactional coordinator.
Preserve independent expectations, no model-selected paths/entrypoints, genuine session/boundary/candidate binding, no partial BOTH-seat commit and no post-close use.
Replace old F1 implementation/wire identity with one current recipient-ledger pair initialized once and advanced from the actual ordered boundaries, with independent economic comparison and no replayed facts or reset.
This proposal changes mechanism-specific guarantees and records that change explicitly.
It does not claim equivalent kernel-level assurance.

The same rebaseline explicitly removes estimator-only R4 calibration/spatial-feature requirements and retains rule correctness, lineage, paid accounting, witnessed losses, noninterference, version binding and numerical validation for the approved new model.
It replaces the old Rust-only host/Node topology with the approved TypeScript game/policy and Rust Burn split.

### Alternative B: retain exact historical F9

Keep protected-backing custody, creator A/B, actual daemon init, Rust-only host controls and original FD proof strength.
The current supported-runtime design does not supply a qualified implementation of those mechanisms.
Require a separately accepted design and explicit scope/privilege approvals before implementing them.
Do not silently revive archived kernel/bootstrap machinery.

### Alternative C: name separate successor gates

Keep historical Gate0/F9/R4 OPEN.
Apply proposal A only to separately named `runtime-plan-v1`, `native-proof-v1` and `policy-pipeline-v1` gates.
Do not describe successor success as historical-gate closure.

The actual interactive selection, not this document's self-declaration, supplies the C1 decision.

## Gate0 closure matrix

Current design decisions C8–C14 are recorded in [supervision.md](supervision.md), [runtime-output-limits.md](runtime-output-limits.md), [learning-runtime.md](learning-runtime.md), [checkpoint-runtime.md](checkpoint-runtime.md), [state-persistence.md](state-persistence.md) and [reference-bundles.md](reference-bundles.md).
The final input/output-registration method and deliberately unset host bindings are in [gate0-packet.md](gate0-packet.md).
Executor selected host-executed mise for preflight/seeding/provisioning and initially selected sbx for training execution; see [host-entrypoint.md](host-entrypoint.md).
Executor then made real F64 GPU learning mandatory, reported an in-use GPU, selected host-backed state and amended learning execution to a supported shared-GPU host Docker job.
No VFIO rebind, GPU runtime installation, creation, qualification or training authority follows from that design choice.
C16/C17 remain consumed sbx-local receipts, not actual host bindings or capacity limits.
The metadata-only task and tighter fixed-write storage bound do not close a gate or grant an operation.
The admission/GPU phase's earlier 74-test Python suite includes 16 admission tests for bounded metadata collection and synthetic CLI behavior, not GPU implementation or computation.
Its current source/static/synthetic evidence is indexed in [verification.md](verification.md).
Executor selected `Commit + push (Recommended)` for this 19-file phase and the exact delegated one-shot host facts packet.
Executor returned `PASS_METADATA_ONLY` admission facts; [host-entrypoint.md](host-entrypoint.md#received-observations-and-provenance-boundary) records reported identities and [verification.md](verification.md#operator-reported-admission-evidence) preserves the unknown source/invocation/time provenance.
The Python CLI proposal is superseded and removed; the [Rust fixed-API v2 collector](host-runtime-inventory-request.md) has accepted Rust/handoff-source reviews, a locally frozen/inspected static asset, release-musl 72 tests and passing prebuilt-task/configuration checks, while actual-host registration and all publication/transfer/query grants remain pending.
No design selection grants an operation or accepts the packet.

The original 36 IDs remain a traceability inventory, not a requirement to recreate the old checker or build DAG.
All current acceptance rows remain OPEN.

| Historical records | Current closure artifact / acceptance | Current gap |
|---|---|---|
| `PLAN`, `VERIFICATION` | Exact current file/API/test plan, gate-profile decision and Executor acceptance | [runtime-plan.md](runtime-plan.md) assigns the draft APIs/tests; its acceptance checklist remains open |
| `INPUTS`, `RECIPE`, `OUTPUT_METHOD` | Independently expected source/tests/locks/reference; pinned supported build recipe; pre-build output-registration method | Exact selected capture, recipe and independent registration roles remain unset |
| `UNITS`, `U-ROOT`, `U-RESOLVE` | Selected Cargo + TypeScript resolution inventory and host/model partition | Current development inventories include native, policy, whole-match, selected old source and control-plane imports; final captured/bundled/runtime closure remains unregistered |
| `PRODUCERS`, `U-PRODUCER`, `U-QUERY`, `U-GENERATED`, `U-MACRO`, `U-METADATA`, `U-LINK`, `U-NATIVE` | Standard Cargo/compiler evidence for selected producers, generated outputs and native dependencies | Lockfile membership alone does not establish the selected graph |
| `TRUST`, `G1`, `CREATOR.A`, `INIT.B` | Explicit C1 trust/guarantee decision and exact runtime/init/launcher controls | C1 accepted; exact selected runtime/init/launcher packet remains open |
| `NODE.MAIN`, `NODE.REFERENCE`, `FD.MAIN.0/1/2`, `FD.REFERENCE.0/1/2` | Exact main/reference topology and independent owned I/O plan under selected profile | Fixed workers/job, staged coordinator, bounded JSONL and owned pipes implemented; captured/qualified runtime remains absent |
| `S0`, `FIRST_EFFECT`, `INVOICE` | Original deadline origin before launch-causal work; shared resource admission before game work; no renewed budget | Outside standard supervisor, boot barrier and C8 observer pass fake fixtures; actual admitted runtime and enforcement qualification remain absent |
| `FIT`, `U-BOUNDS`, `U-ENFORCE` | Concrete CPU/memory/swap/tasks/tmp/output/storage/FD bounds; selected GPU/VRAM coexistence; peak coexistence and whole-job cleanup design | C2/C9/C15 retain the design ceilings; fixed writes plus outside evidence and 8 GiB planning allowance total 191,396,683,776 usable bytes; actual host Docker/GPU runtime, IDs, view, durable target/headroom and effective enforcement remain open |
| `U-HANDOFF` | Versioned recipient/session/sequence transactional protocol and independent reference comparison | Actual-mutation producer/journal/recipients and staged BOTH protocol implemented; reference init/open/pass fixtures pass; cold confined independent process proof remains unrun |
| `AUDITS` | Current source/dependency/native-closure, partition and negative audit results | Historical passes do not transfer; active AGENTS.md adversarial/security review gates apply before completion |

Gate0 closes on explicit acceptance of the complete selected-profile design and prerequisites.
It does not require runtime results before their separately approved launch.
It does not itself authorize capture, image building, runtime qualification or native proof.
Existing development approval remains separate from that future operational sequence.

## F9 closure matrix

| Historical scope | Required current evidence | Current state |
|---|---|---|
| N1/N2 native-only scope | Native verification cannot score, sample, prepare model episodes or train; private/recipient partition tests | Fixed native-only job/worker source and standard Bun closure checks exclude policy/scoring/learning dispatch; captured/live qualification remains open |
| N3/N4 expectations/loading | Current selected graph, capture, actual runtime/loading confinement, exact policy/init and effective controls under accepted C1 | C1 accepted; no production qualification |
| N5/N7 handoff/lifecycle | Genuine session and boundary bindings; wrong side/session/cursor/replay/reentry/close refusal; atomic BOTH commit | Staged runtime cursors, reentry/close and BOTH publication after both ACKs pass synthetic tests; real confined lifecycle remains pending |
| N6 canonical opening | Actual native init: banks 3/3; CC e1/e8; Marines c2–f2/c7–f7; endowed paid basis 0; no initial grant; combat replacement 4 per side | Canonical constructor and both initial recipient producers pass source tests; cold F9 process proof remains unrun |
| N6 causal laws | Final geometric cells versus transient assertions; casualty-before-delta order; mine multiplicity; stable recipient lineage; native origin/promotion rules; private labels excluded | Canonical B/C/F physics, journal/producer privacy, explicit bank/receipt ownership and source replay have persisted tests; supervised native/reference evidence remains pending |
| N8 positive proof | Cold source-bound init for BOTH; actual turn-open + pass/pass settlement; independently launched reference reconstruction/comparison; one recipient pair initialized once and advanced from actual ordered boundaries; clean close/EOF/reap | Not run; synthetic observations and forced Docker removal cannot substitute |
| N8 time/resources | Same original S0 through cold 10s proof and 300s lifecycle, final 3s cleanup; aggregate main/reference/children limits; bounded outputs/storage | Partial synthetic limit proof only; deadline-triggered cleanup and kernel disappearance unverified |
| N9 negative proof | Substituted inputs/runtime/init/entrypoint; worker-selected expectations; mutable/unsupported loading; stale contexts; reordered/tampered boundaries; post-close use; model dispatch; incomplete cleanup | Artifact/protocol/stdio/policy/closure/job/fake-manager negatives exist; selected-image/effective-host negative qualification remains absent |
| N10 operations | Fresh exact capture/build/qualification/native-proof grants and retained failure evidence | No grant supplied by this matrix |

F9 closes only after actual selected-profile runtime qualification and positive/negative native evidence pass.
A forced-removal cleanup negative cannot supply the genuine clean-close positive.
F9 grants no model or training permission.

## R4 closure matrix

| Retained obligation | Existing foundation | Missing closure evidence |
|---|---|---|
| Canonical game/causal source | Rules, queue edits, collision fingerprints, 122,160 classical cases, 11,045 full-turn cases and matching actual-mutation sink outcomes | Independent supervised source-bound reference/protocol comparison |
| Recipient-local history | Actual continuing init/open/settled data, local IDs, standard closed batches, privacy twins and deterministic source-bound replay | Runtime-owned sessions/cursors, genuine process-close boundary and supervised independent comparison |
| Own paid accounting | Explicit bank owner, actual accepted debits and capped grants, receipt dispositions, promotion/crush/mine retirement and paid conservation tests | Native/runtime transaction ownership, adversarial protocol/replay audit and independent comparison |
| Opponent knowledge | Actual pre-destruction witnesses and target-only consumption, deduplication, casualty-memory/dead-vision tests and private paid-history separation | Supervised producer/reference and protocol-substitution evidence |
| Candidate/context scoring | Approved enumerator/encoding, hidden twins, frozen argmax/ties, exact sampling/ACK/admission and checked whole-match barriers | Actual captured immutable runtime, effective bounds and qualified native/learner integration |
| Independent artifact binding | Model config, feature version/layout/dimensions and exact checkpoint SHA-256 | Supervisor-selected expectations through the real coordinator; session/model/version substitution and stale-episode rejection |
| Numerical validation | C6/C7, redundant logical-F64 proposals/reload and real synthetic whole-match/Burn/SQL completion pass | Actual selected GPU F64 scoring/learning, unchanged numerical checks and redundant learner agreement; GPU runtime/VRAM/cleanup and final artifact qualification remain open |
| Phase/atomicity controls | Closed child-owned match loop, owner native/decision/stop reconstruction, C12 learners, retained private journal bytes, atomic C11 completion and C13 source publisher | Actual durable state/clock/process-group/descendant qualification; complete final-envelope/initialization path qualification remains open |

R4 is implementation closure for the accepted current profile, not successful game-data training.
The original R5 cross-cutting readiness checks remain a separate verification stage.
Any change to retained validation tolerances, training experiment, reward/eligibility, RNG/curriculum, checkpoint protocol or strict challenge requires its own explicit decision.
The model replacement does not silently waive those downstream contracts.

## Critical path and proposed file plan

Unimplemented paths in this table remain PROPOSED.
Canonical initialization and initial recipient production now exist; their persisted tests are indexed in [verification.md](verification.md).
Persisted synthetic resolver fixtures do not authorize collection or a gameplay rollout.

| Order | Deliverable | Source / test targets | Exit condition / boundary |
|---:|---|---|---|
| 1 | Select current versus exact versus separately named gates | This document; [gate-closure.puml](gate-closure.puml) | COMPLETE: Executor selected proposal A; no host execution |
| 2 | Full implementation/runtime packet | [runtime-plan.md](runtime-plan.md); `_spec/native-job.md`; actual source/API inventory | Draft persisted; exact identities/closure/limits/registration and Executor Gate0 acceptance remain open |
| 3 | Canonical init and complete simultaneous mutations | `packages/game-core/src/initialization.ts`, `classical-resolution.ts`, `resolve.ts`, `causal-events.ts`, `causal-producer.ts`; persisted initialization/classical/turn/causal tests | Source fixtures pass canonical physics and actual-mutation identity/visibility integration; independent runtime evidence remains separate |
| 4 | Trusted recipients, economics and replay | Implemented `packages/contracts/src/recipient.ts`, `recipient-codec.ts`, `game-session.ts`; persisted privacy, codec, bank/session/replay and policy-noninterference tests | Source fixtures pass BOTH conservation, causal knowledge, deterministic replay and twins; runtime-owned protocol remains pending |
| 5 | Native proof coordinator and reference worker | Implemented `native-session.ts`, `reference-driver.ts`, `reference-worker.ts`, `current-driver.ts`, `process-transport.ts`; protocol/process/reference/closure fixtures | Synthetic checks and pinned in-process reference fingerprints pass; live confined proof remains unrun |
| 6 | Supported supervisor and frozen artifact selection | Implemented outside supervisor/evidence writer, native job and artifact guards; C13 state-mount checker; fake-manager/job/artifact fixtures | Actual CPU IDs/cgroup/observation view, private storage, outside admission and Gate0 acceptance remain open |
| 7 | Capture/build → output registration → live qualification → native proof | Exact separately approved commands and private append-only evidence paths from order 2 | Actual limits/loading/init/stdio/deadline/cleanup negatives and cold BOTH positive; close F9 only after pass |
| 8 | Bind genuine observations and immutable model to policy/admission | Whole-match worker/session, fixed dependency factory, two native learners, private publisher and SQLite coordinator | Actual separate-process synthetic completion/update/retained-journal/SQL integration passes; no actual corpus/strategic rollout, durable target or confined qualification |
| 9 | Cross-cutting technical readiness | `_spec/verification.md` plus persisted current tests/e2e/static evidence | Current R5-equivalent verification; `trainingReady` changes only on evidence; each implementation slice already requires applicable AGENTS.md reviews |

Independent source tasks may proceed under the development grant after applicable contract decisions.
The linked gate-closure diagram now applies active AGENTS adversarial and security review gates.
Those gates apply to each implementation slice before completion, not only at the final readiness stage shown in the diagram; [verification.md](verification.md#blocked-docker-metadata-proposal-python-verification) retains its render receipt alongside the superseded Python verification and failed review.
Do not turn this sequence into a prohibition on already approved synthetic development.
Do not run a canonical live game or reference rollout merely because its source tests exist.

## Fresh execution packet required later

Before requesting host execution, supply the exact command/allowlist, source/build/runtime identities, reference identity, CPU quota/period, memory/swap/tasks, tmp/output/storage/FD ceilings, owned resources, allowed side effects, absolute deadlines, cleanup/absence verification and stop-without-retry behavior.
Keep runtime qualification separate from the native-game proof.
Declare whether any required kernel-level cleanup observation needs additional host access.
Do not assume the BusyBox limits, historical 2 CPU / 4 GiB / 256 PID profile, or synthetic removal evidence establishes the current production envelope.

## Non-goals for these three gates

Product/UI migration, optional H≤3 search, estimator-only fitting, actual policy training, the five-run experiment, learned 54/54 wins, deployment and publication do not become prerequisites merely because they appear later in the historical roadmap.
Training still requires its own downstream readiness and execution approval.
Never label a foundation slice `Gate0 CLOSED`, `F9 CLOSED`, `R4 CLOSED` or `trainingReady:true`.
