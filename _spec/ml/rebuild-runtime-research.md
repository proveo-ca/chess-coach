# No-Python ML runtime shortlist — native Rust Burn + Node engine bridge selected

**[Unverified] Metadata 2026-10-17: CODE CHECKS PASS / THREE CLOSING REVIEWS READY / BOUNDED SYNTHETIC CHECKS + REVIEWS CLOSED.**
This authoring pass records upstream documentation, source, releases, issues and forum links supplied by the lead.
It does not independently fetch those sources or execute a runtime.
All rankings below are **[Inference]** against the requested constraints, not measured performance comparisons.

## Selection constraints and current decision

Our implementation must avoid Python and support CPU binary64 arithmetic, autodiff, actual SGD and native checkpoint serialization.
Executor later clarified that upstream dependencies may use Python; this does not change the selected Flex runtime.
Bun was optional to the ML library comparison, not a Burn requirement.
Executor canceled Bun adoption for this milestone and selected Rust for ML, arena policy, CLI, tests and verification.
Only a thin Node/tsx adapter executes the unchanged TypeScript engine; it does not score candidates or train a model.
Pre-existing Bun uses elsewhere remain untouched.
The selected project direction is a full replacement in `packages/training` and `apps/arena`, with legacy deletion last after parity and a Git rollback boundary.
Executor selected **Burn first**, with the [bounded compatibility proof](../_plans/burn-flex-compat.md) before that full rebuild.
No alternative activates automatically if the proof fails.

| Rank | Candidate | Supplied upstream capability | Project-specific judgment |
|---|---|---|---|
| 1 | Burn `0.22.0`, Flex | Pure-Rust CPU backend with `f64`; autodiff, optimizer and checkpoint building blocks. | **[Inference]** Best first proof for the requested Rust/no-Python boundary without a C++ tensor-library dependency; direct Rust integration also removes the Bun scoring wrapper. |
| 2 | LibTorch, C++ frontend | Native C++ training API, double tensors, autograd/optimizers and official prebuilt CPU distribution without a Python runtime requirement. | **[Inference]** Strong fallback candidate, with an additional C++ toolchain and native distribution/integration surface to establish. |
| 3 | Candle `0.11.0`, Rust | CPU `f64`, autodiff and plain SGD; CPU `set_seed` is unsupported in the supplied source. | **[Inference]** Plausible for deterministic fixed-weight fixtures, but the documented CPU seed limitation and optimizer scope need explicit treatment before a broader learner. |

These are libraries for implementing a learner, not complete StarChess learning algorithms.
No memory, latency, throughput or cross-run determinism measurement was supplied for this checkout.
The current receipt below records fresh frozen-input Rust/Node checks after three MEDIUM repairs; all older Rust/Bun receipts remain historical only.
No learned weight set or production model artifact is claimed.

## 1. Burn `0.22.0` / Flex — selected candidate

The supplied release record dates `0.22.0` to **2026-10-06**.
The supplied Flex documentation identifies a native-library-free Rust backend and `f64` support.
Burn documents custom training loops, which avoids treating its higher-level training harness as a prerequisite for the small proof.
Its RL crate supplies building blocks, not the project's candidate generator, simultaneous-planning algorithm or admission model.

The historical seeding issue below is **closed**.
Its supplied disposition points to device seeding; it is not evidence that this project's determinism has been tested.
The initial proof uses explicit fixed parameters and fixed rows rather than random initialization.

| Source | Purpose |
|---|---|
| [Release `v0.22.0`](https://github.com/tracel-ai/burn/releases/tag/v0.22.0) | Supplied version and release-date basis. |
| [Pinned Flex source/README](https://github.com/tracel-ai/burn/tree/v0.22.0/crates/burn-flex) | Selected pure-Rust CPU backend and binary64 capability. |
| [Backend documentation](https://burn.dev/books/burn/building-blocks/backend.html) | Backend/dtype/device model. |
| [Custom training loop](https://burn.dev/books/burn/custom-training-loop.html) | Autodiff and optimizer integration without assuming the full training harness. |
| [Pinned RL building blocks](https://github.com/tracel-ai/burn/tree/v0.22.0/crates/burn-rl) | Scope distinction between library primitives and a project learner. |
| [Seeding issue #2312](https://github.com/tracel-ai/burn/issues/2312) | Historical issue and device-seeding disposition, not local determinism proof. |

The selected proof pins Rust `1.95.0` and Burn `0.22.0`, selecting `std`, `flex`, `optim` and `store` without default features.
It configures `f64` before tensor construction and checks real autodiff, real SGD and real Burnpack serialization.
The selected arena calls `training_native::score_synthetic_f64` directly, while retaining the standalone Rust scorer protocol as a separate test surface.
One root Cargo workspace owns `packages/training`, `apps/arena` and `tooling/xtask`, with one reused root Cargo lock.
The Rust arena validates the limited observation, constructs two padded feature rows and selects the canonical maximum.
The Node bridge only reconstructs the tiny engine fixture, projects native fog and performs atomic admission/bank settlement through two bounded one-shot `open`/`settle` calls.
Full settlement truth arrives after selection for reporting, never as scorer input; this is not a stateful match runner.
See the [training diagram](../packages/training/burn-compat.puml) and [arena diagram](../apps/arena/burn-compat.puml).

## 2. LibTorch / C++ frontend — second candidate, not installed by this selection

The supplied official frontend documentation describes native C++ model construction, training and optimizer APIs.
The official installation path provides prebuilt CPU LibTorch distributions without requiring Python execution for the C++ consumer.
The supplied repository record identifies latest version `2.14.1`, dated **2026-09-30**, with a BSD-style license.
That reported latest version is research context, not a project dependency pin or a downloaded artifact identity.

The forum discussion distinguishes a standalone LibTorch application from a Python-hosted custom C++ extension.
Using the latter would not satisfy the no-Python runtime boundary merely because some operations are written in C++.

| Source | Purpose |
|---|---|
| [Official C++ frontend](https://docs.pytorch.org/cppdocs/frontend.html) | Native training/autograd/optimizer surface. |
| [Official installation](https://docs.pytorch.org/cppdocs/installing.html) | Standalone prebuilt CPU distribution path. |
| [PyTorch repository](https://github.com/pytorch/pytorch) | Supplied release/license context. |
| [C++ extensions versus LibTorch forum discussion](https://discuss.pytorch.org/t/custom-c-extensions-vs-libtorch/133909) | Packaging and Python-host boundary distinction. |

**[Inference]** A future LibTorch choice would need its own pinned toolchain/distribution, binary64 fixture, checkpoint and process-boundary proof.
Burn's selection grants none of that acquisition or implementation work.

## 3. Candle `0.11.0` — third candidate, not installed by this selection

The supplied crate record dates `0.11.0` to **2026-06-26**.
The supplied pinned CPU implementation rejects `set_seed` as unsupported.
The supplied optimizer source provides plain SGD without an SGD momentum option.
The current synthetic proof requires no momentum, so that omission alone does not disqualify Candle for the fixture.
The CPU seeding limitation still needs treatment before any future seeded-learning contract.

The historical benchmark issue concerns debug versus release execution.
Its release-mode resolution is not a benchmark of this project and supplies no comparative speed claim.

| Source | Purpose |
|---|---|
| [Pinned Candle `0.11.0` tree](https://github.com/huggingface/candle/tree/0.11.0) | Versioned project source. |
| [Pinned CPU backend](https://github.com/huggingface/candle/blob/0.11.0/candle-core/src/cpu_backend/mod.rs) | CPU dtype and unsupported `set_seed` behavior. |
| [Pinned optimizer implementation](https://github.com/huggingface/candle/blob/0.11.0/candle-nn/src/optim.rs) | Actual SGD implementation and optimizer scope. |
| [Historical performance issue #1383](https://github.com/huggingface/candle/issues/1383) | Debug/release context only; no local performance evidence. |

**[Inference]** Candle remains a candidate for a separately approved proof, not a silent runtime fallback.

## Exclusions from the learner shortlist

- **TensorFlow.js:** the supplied [float64 issue #8634](https://github.com/tensorflow/tfjs/issues/8634) was closed without implementing float64 in August 2026; the supplied source reading found no float64 entry in its `DataTypeMap`. JavaScript `number` alone does not establish binary64 tensor operations. This fails the requested learner dtype constraint.
- **ONNX Runtime JavaScript:** the supplied [JavaScript documentation](https://onnxruntime.ai/docs/get-started/with-javascript/) describes an inference option, not the requested JavaScript learner/training API. Keep it separate from the learner ranking; do not infer training support from model execution.

## Installation and evidence boundary

[mise Rust documentation](https://mise.jdx.dev/lang/rust.html) supplies the scoped toolchain-management reference.
Mise `2026.9.1` was present; Cargo, rustc, rustup, and a native linker were absent.
Executor approved scoped mise installation of Rust `1.95.0` and Zig `0.15.2`.
Both installations completed in the runtime cache without sudo or shell-profile changes.
Burn's disabled optional LibTorch branch prevented fresh lock generation because all `zip ^0.6` releases were yanked.
The exact `zip 0.6.6` checksum in Burn's release lock matched crates.io in the supplied earlier record; the selected migration reuses that resolution in the root lock.
The final Rust gate records `zip`, `tch`, `torch-sys`, and `burn-tch` outside the selected normal/build graph.
This is dependency resolution metadata, not permission to enable another runtime.

The [current gate table](../_plans/burn-flex-compat.md#7-lead-owned-gates--pass-bounded-reviews-closed) records repaired-source code checks PASS at
`/tmp/proveo-opencode-runtime-cache-1000-21d690750d3738af14d58c25/tmp/opencode/rust-training-52254-1792198270804750420-0/receipt.json`.
Its before/after input identities both equal `bf42b7c3020d5f55b87fd14a35b24ec502ae83cb7a4f92882bfc9ab9ad58d7f6`, with `status:PASS`, `reviewEligible:true`, `error:null` and `identityError:null`.
All 24 commands exited `0`, with signal `null` and no timeout; Rust 76, Node adapter 27 and fresh unfiltered core 668 tests passed without failures, ignored, skipped, filtered or todo tests.
The Rust total is training library 9 + training protocol 12 + arena library 21 + arena CLI integration 7 + xtask library 27, not reused counts from earlier generations.
The lead reports unchanged source/configuration/dependencies throughout the invoice and preservation of legacy/evidence bytes, old pnpm resolutions, root Nx dependency and all 43 old spec entries.
Other existing app/server consumer suites were not rerun because their source and resolved dependencies were unaffected; preservation is not a test-suite PASS.

The Rust verifier owns this invoice without a Node/Bun verification helper; Node only bridges the unchanged engine and runs its adapter tests.
Oxlint and tsgo passed on all adapter source/tests under the core-compatible `strict:true` profile; `skipLibCheck` covers dependency declarations, not excluded own files.
The superseded Bun profile's `exactOptionalPropertyTypes` and `noUncheckedIndexedAccess` flags are not enabled in the current Node profile; Rust owns the semantically validated typed policy boundary.
The direct fixed-weight CPU f64 scorer produced CLI scores `[1.875, 2.875]`, chose king `f1`, and settled bank `3` → `4` through two fixed Node/tsx processes.
All three supplied closing reviews followed that complete gate on the same unchanged `bf42…` source; all report bounded READY.
The adversarial result closes all three prior MEDIUM findings; the targeted DevOps result also closes M1.
The lead reports no source changes after the freeze or those closing results.
Markdown and third-party remote theme bytes are outside the source-identity policy, so this metadata sync does not change `bf42…` or imply hermetic rendering assurance.

The [supplied closing-review table](../_plans/burn-flex-compat.md#75-supplied-closing-reviews--bounded-synthetic-milestone) records adversarial `ses_eb8bb56ffffeXDM7vxt53Y2oU5`, security `ses_eb8bb55ddffeYYYws1w8tDwlEq` and DevOps `ses_eb8bb551cffeJgWzcW3zqdkfL3`.
Their method was read-only static inspection, without commands, tests, network execution or independent hash reruns.
Adversarial reported no additional findings within the bounded milestone; security reported no actionable findings and LOW residual risk; targeted DevOps reported no new findings.
Security's retained gate-log-growth cap is LOW future hardening, not an unresolved HIGH or a withheld closing result.
The [final same-source confirmation](/tmp/proveo-opencode-runtime-cache-1000-21d690750d3738af14d58c25/tmp/opencode/rust-training-56262-1792199153186602997-0/receipt.json) passed all 24 commands with the same `bf42…` identity and 76 Rust, 27 Node adapter and 668 core tests.
The final whitespace check passed; no commit or push ran.

The lead's [repair-control record](../_plans/burn-flex-compat.md#74-repair-control-evidence--medium-findings-closed-by-supplied-reviews) preserves all three closed findings and their scoped RED/GREEN evidence separately from the complete invoice.
Verifier jobs now own a fresh Unix process group through `process_group(0)` and safe `rustix` `1.1.5` process APIs, with guarded group identity and bounded group termination/reaping on timeout or wait failure.
Their unchanged 600-second total includes 597 seconds work and a 3-second cleanup reserve; receipts separately retain cleanup errors, cleanup timeout, reaping and actual exit/signal.
Only trusted descendants remaining in the owned group are covered; group escape and sandbox assurance are excluded.
Node's parser now matches Rust's tiny action domain (`e1` → `d1|f1`) before native admission, while native atomicity/refusal helpers remain unchanged.
The test oracle now uses pinned `tempfile` `3.27.0` exclusive random-name 0600 files, flushed and held through Node completion, with symlink-preservation and cleanup regressions.
These verifier/test dependencies do not alter Burn's selected training graph; the Linux/Unix Node bridge retains its 30-second total including 3 seconds reap reserve, without Windows portability claims.

The old receipt at `/tmp/proveo-opencode-runtime-cache-1000-21d690750d3738af14d58c25/tmp/opencode/burn-compat-1elp9d/receipt.json`,
input SHA-256 `d250c88e223ec678ad1f1834b8f40d517fd9c971b9e1531c10e8b5c814419eea`, retains its historical 20 passes, native 21, Bun unit 57, Bun integration 8 and core 668 only.
Its old review eligibility does not apply to the Rust migration; the lead canceled the old adversarial/security reviews without a closing result.
The earlier Rust checkpoints `e633…` and `6dbd24f497fce8a84df7de945774eda692181eadfccd0754e4fdd58727a8cba5` are also historical; none are combined for current `bf42…` eligibility.
The `6dbd…` receipt remains at `/tmp/proveo-opencode-runtime-cache-1000-21d690750d3738af14d58c25/tmp/opencode/rust-training-46248-1792196686700950188-0/receipt.json` with its older Rust 72/Node 24/core 668 scope.
Its adversarial review declined closure with three MEDIUM findings; prior security/DevOps positive results were scoped to that input, with DevOps also identifying group cleanup.
This author supplies no execution or verdict; width 418 remains synthetic padding rather than the R4 encoder.
The bounded compatibility migration checks and supplied closing reviews are closed, not the whole branch or full replacement.
Learned weights remain NONE, `modelArtifact:null`, `fullRunner:false`, and assurance NON_ADMITTED; historical UI registry behavior remains unchanged.
The checks and reviews establish no R4 readiness, calibration, learned model or whole-branch merge approval.
Full replacement, stateful runner integration, consumer migration and legacy cleanup remain deferred; deletion stays last after parity and a Git rollback boundary.
No real training/data collection, profiling, activation, model artifact, publication or Git operation follows.
