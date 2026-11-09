# Mandatory GPU learning readiness

## CURRENT priority amendment — 2026-11-09

The [canonical training-first roadmap](gate-closure.md#current-precedence-amendment--accepted-2026-11-09) and [functional readiness checklist](readiness.md#current-precedence--training-functional-readiness-2026-11-09) take precedence over mixed full-assurance prerequisites below.
Real F64 GPU feasibility, all 4,670 coordinates/tolerances, exact C12 scoring/backward/SGD/reload, unchanged CPU Flex/master initialization and cooperative ceilings/coexistence on the host's reported in-use 8 GB GPU remain functional requirements.
ALL security/privacy/isolation, custody/provenance and strict stop/escape/crash qualification follow the completed planned training phase and validated results; do not restore them through runtime-closure, observer or cleanup wording below.
Ordinary bounded execution, truthful output evidence and existing functional correctness tests remain.
This plan disables no configuration.
CPU fallback remains excluded; actual GPU work stays outside the coding sandbox.
The retained status/evidence below change neither the reported 0/3 diagnostics, absent binding, full-pipeline halt nor `trainingReady:false`.
This amendment renews no execution, acquisition, installation, runtime-change or training grant.

<a id="current-input-inventory"></a>

## CURRENT input inventory — operator-reported metadata PASS; all attempt grants consumed, details pending

Executor freshly selected `Inventory inputs Recommended`; the separate [input request](../_work/gpu-owner-recovery/qualification/input-request.json) records two bounded scopes, not a new complete build or acquisition packet.
The [owning diagram](gpu-qualification.puml) separates completed coding metadata from the new **operator-reported completed** Rust pull/inspection; both one-shot allowances are now consumed.
This docs pass reads sources and retained evidence only; it runs no command, test, render, LLVM/native program, network request, host operation or agent.
The broader [host-input packet](../_work/gpu-owner-recovery/qualification/host-inputs.json) retains its original all-false approvals and old `ABSENT` observation as historical projections.
The original request, prior coding outcomes and review/approval records remain byte-unchanged; the new operator report controls current reported acquisition state, not those retained projections.
This current section supersedes older Rust-absence and pending-pull wording below; those statements retain only their capture-time scope.

### Completed coding-prefix metadata — one consumed, zero remaining

The [metadata receipt](../_work/gpu-owner-recovery/runs/gpu-qualification-input-inventory-1/receipt.json) records **`PASS_METADATA_ONLY`**, `sourceChanged:false`, a complete walk, exit 0, **one invocation consumed / zero remaining**, and no retry.
Its [retained NDJSON stdout](../_work/gpu-owner-recovery/runs/gpu-qualification-input-inventory-1/command.stdout) reports **2,684 entries = 137 directories + 2,545 files + 2 symlinks + 0 other**.
The resolved root equals the existing coding-prefix candidate; both nested symlink targets (`bin/ld64.lld` and `bin/lld-link` → `lld`) were recorded, not traversed.
The summary's **331,823 metadata bytes exclude the final summary line**; stdout contains **332,260 bytes** including that line, and stderr is empty.
**329,242,172 apparent regular-file bytes** sum each directory entry; they do not establish allocated storage, unique/deduplicated bytes or a selected/staged input size.
No prefix payload was opened, read or hashed; no LLVM executable/query, compilation, copy, staging or automatic selection occurred.
Source and captured-stream hashes remain ordinary receipt evidence, not prefix-payload inspection.
The original request remains unchanged as its authority projection; this completed coding allowance is **SPENT**, not replay permission.

The [walker](../_work/gpu-owner-recovery/qualification/input-inventory.ts) uses root `realpath`, `lstat`, directory iteration and recorded `readlink` targets only.
Its approved ceilings were 20,000 entries, 10 MiB retained output and 60 seconds; unchanged `runBounded` retains at most 4 MiB per stream, while the worker caps metadata NDJSON at `4 MiB - 64 KiB` to reserve summary space.
It keeps one streamed inventory rather than duplicating a full inventory file, and exclusive evidence-directory creation plus the worker marker prevents replay within that retained run.
This is bounded metadata evidence, not compiler usability, native/static link/ABI, relocation, payload integrity, image or GPU proof.
This docs pass does not claim completed-metadata post-outcome review acceptance.

### Standalone input-helper source proof — source-3, not qualification source-2

The [input-helper source-3 receipt](../_work/gpu-owner-recovery/runs/gpu-input-inventory-source-3/receipt.json) records **`PASS_INPUT_SOURCE_ONLY`**, `sourceChanged:false`, 11 bound sources and three stages at exit 0.
Its [raw unit summary](../_work/gpu-owner-recovery/runs/gpu-input-inventory-source-3/unit/command.stderr) confirms **8 mocked/static tests / 64 assertions**; strict qualification types and direct existing Fish **4.9.3** `--no-config --no-execute` syntax also pass.
These checks executed neither the metadata inventory nor the host packet, images, LLVM, compilation or GPU work.
The [verifier](../_work/gpu-owner-recovery/qualification/verify-inputs.ts) distinguishes available Fish from an actually launched syntax stage and records the launch before awaiting its result.
The final [tests](../_work/gpu-owner-recovery/qualification/input-inventory.test.ts) also cover host receipt write/read/output failure handling without running Docker.

- [Input-helper source-1](../_work/gpu-owner-recovery/runs/gpu-input-inventory-source-1/receipt.json) remains **FAIL**: `Bun.which` selected a Mise shim that encountered the root config's untrusted status before Fish parsed the script.
  Its [classification](../_work/gpu-owner-recovery/runs/gpu-input-inventory-source-1/classification.json) explicitly records **syntax NOT established**, despite the original receipt's misleading `fishSyntaxChecked:true` field; neither record is rewritten.
  No trust, installation, prefix inventory or host operation followed that failure.
- [Input-helper source-2](../_work/gpu-owner-recovery/runs/gpu-input-inventory-source-2/receipt.json) remains historical PASS at **7 tests / 59 assertions**, direct Fish syntax and strict types, before the final MEDIUM receipt-failure and LOW syntax-attempt accounting fixes.
- Input-helper source-3 supplies the final **8/64** source proof; it does not replace or combine with the earlier qualification runner's **32/223 + four typechecks** below.
  The parent reports no app/Rust/math/production-recipe edits and no changes to that prior 64-native-input scope; this docs pass does not rerun or rehash its old qualification manifest.

The lead reports adversarial `ses_e3db08ecaffe7JpgpwIKHCgyMl` READY with both findings resolved, security `ses_e3db08ecaffd8jrnYUsS9UQS84` READY **within this new grant**, and DevOps `ses_e3ec46b44ffe7CbnV5rwv23shT` READY source-only.
Those source/pre-execution verdicts are not completed-metadata record acceptance or actual host outcome acceptance.

### Operator-reported result — PASS summary, authority consumed, detailed outputs unreceived

The [operator paste](../_work/gpu-owner-recovery/runs/host-builder-inputs-1/operator-paste.txt) and [normalized observation](../_work/gpu-owner-recovery/runs/host-builder-inputs-1/operator-observation.json) record **`OPERATOR_REPORTED_INPUT_METADATA_PASS_AUTHORITY_CONSUMED_DETAILS_PENDING`** and reported `PASS_INPUT_METADATA_ONLY`.
These are newly retained coding-side records normalized from pasted output, **not original host files**; creating this local evidence directory did not transfer the operator's phase outputs.

| Operator-reported field | Result / limit |
|---|---|
| Exact Rust image | `docker.io/library/rust@sha256:4c2fd73ef19c5ef9d54bee03b06b2839a392604fbfcd578ed948b71b37c1d7fb` |
| Frozen lock SHA | `77f674cc26a01f26558fd99c45bdcd5566017be05833fce1d39cae98cda05955` |
| Pull / combined inspection / image inspection / container / cleanup exits | All reported `0` |
| Container and cleanup | One of each; CID `9411a17c3a9f678b625749a6c86668afba5b778d87d6822f67119c674e24f32f` |
| Started / finished | `1794266630` / `1794266641`; 11 reported wall seconds, not independent per-phase deadline proof |
| Remaining authority | **One pull / one container / one cleanup CONSUMED; zero remaining**, no automatic retry |
| Compilation / GPU execution / training readiness | Reported `false` |

This report **clears the pinned Rust-image acquisition blocker at report scope**; do not describe the current state as image still absent, pull pending or an unexecuted available grant.
It does not establish compiled builder ABI/native linking, a built qualification image, actual GPU work or training readiness.
The last confirmed published source is `2c17a189ecba08cb7078ea8daf991317d09c3ef1`; the observation leaves the actual operator-executed source commit unknown.
That unknown does not add a hardened source-custody gate.
This docs pass claims no post-record review acceptance.

**Still unreceived:** `image.stdout`, `image.stderr`, `inspection.stdout`, `inspection.stderr`.
Consequently image OS/architecture/local image ID, compiler versions, libc version and C++ standard-library path remain `null` in the normalized record; the PASS summary is not those detailed facts.
The next functional input-selection handoff requests these **existing four output files only**, without Docker, compiler, pull or container replay.
This is ordinary missing functional detail, not a new hardware, network, security or strong-custody prerequisite.

The unchanged [Fish source](../_work/gpu-owner-recovery/qualification/inspect-builder.fish) retains the consumed contract: pull <=600 seconds; combined image/non-CUDA inspection <=60 seconds at 1 CPU / 1 GiB; separate saved-exact-CID cleanup <=30 seconds.
It specifies per-command tool/library result handling and plaintext phase/receipt evidence without host Bun, compilation, GPU, installation or staging.
Those prescribed bounds and source declarations are not independently verified by the pasted 11-second summary.
The original request and older approval projections remain history, **NOT RERUN**; the report grants no new install/acquisition, LLVM query/prefix-payload read, copy/staging, build, GPU or training operation.
The coding agent must not invoke Docker or any host tool or repeat the spent coding inventory/LLVM queries.
The broader host packet remains unresolved: LLVM selection, CUDARC, libdevice, builder/runtime selections, transfer/staging choices and remaining build/resource bounds stay unapproved.
Continue this bounded inventory and consolidated input resolution without adding full-assurance gates; staging, builds, actual GPU qualification and training still need separate explicit scope.
ALL security/privacy/isolation hardening remains LAST, after **ALL planned training completes and results validate**; full-assurance gates remain OPEN and `trainingReady:false` remains unchanged.

<a id="current-qualification-source-and-flags"></a>

## Qualification source snapshot — source-2 checks and source-only reviews READY

Executor selected `Prepare + query Recommended` in the parent session.
The [preparation request](../_work/gpu-owner-recovery/qualification/request.json) authorizes the qualification source target, persisted tests/spec and consolidated input packet, plus one exact five-query non-CUDA LLVM batch.
[gpu-qualification.puml](gpu-qualification.puml) owns this concern; [gpu-build.puml](gpu-build.puml) retains the separate prepared-bridge and production-recipe history.
This docs pass reads sources and existing evidence only; it runs no command, render, test, native program, query, image or host operation, network request, archive operation or agent.

### Implemented source contract — host qualification remains unrun

- The separate [qualification Dockerfile](../tooling/runtime/Dockerfile.gpu-qualification) leaves both production Dockerfiles and existing recipe tests unchanged.
  Its future CPU/GPU builds use locked, offline Cargo `--no-run --message-format=json`; they do not run tests during image construction.
  CPU uses default features across both packages; GPU selects `gpu-prepared-llvm` for the existing `finite_difference` and `gpu` integration targets.
- CPU and GPU outputs remain separate at `/build/native/target-cpu` and `/build/native/target-gpu`, copied to those same absolute runtime paths so embedded `CARGO_BIN_EXE` policy subprocess locations survive.
  Both final stages apply `chown` to `/build/native/_work` **after** their copies and before `USER 1000:1000`, preserving scratch/evidence ownership by design rather than claiming an executed image-write check.
  The runtime overlay must supply libdevice; the host driver still supplies `libcuda` without replacement.
- The [Bun runner](../tooling/runtime/qualification.ts) admits only matching `compiler-artifact` records with exact package IDs, test profiles, features and mode-specific executable prefixes.
  Each Cargo log must end with one successful `build-finished`; Docker must separately accept Cargo's exit status.
  Build-script records never select executables, and complete unique harness coverage plus all three policy binary paths is mandatory.
- GPU feasibility reuses the first two existing exact ignored tests: nonzero F64 scoring/record round trip, then direct backward/SGD/update/reload.
  GPU full reuses all six in order: that same pair, the active 2,335-coordinate sweep, inactive 2,335-coordinate sweep, exact redundant learning channels, then exact policy-channel subprocess agreement/reload.
  Each GPU invocation must report exactly one pass, zero failures and zero ignored tests; zero-match execution fails.
- CPU regression freezes 16 default-feature harnesses and their individual expected counts: 22 learning + 17 policy-io = 39 tests.
  A known zero-test CPU harness is valid; an empty aggregate or missing harness is not substitute regression evidence.
  **Current-generation native CPU regression and all GPU campaigns remain UNRUN.**
- Each campaign runs serially through the two unchanged copied supervision files, [runBounded](../_work/gpu-owner-recovery/verify.ts) and [command-supervisor.ts](../_work/gpu-owner-recovery/command-supervisor.ts), with 4 MiB per stream, first-failure STOP and no retry or automatic feasibility-to-full escalation.
  Explicit positive per-test, total and cleanup-reserve budgets are mandatory, with `totalMs >= steps * perTestMs + cleanupReserveMs`.
  These limits cover **the test loop only**, not preflight, final source checks or receipt work; `proposedLimitsNotApproved.scope` is `TEST_LOOP_ONLY_NOT_OVERALL_HOST_INVOCATION` and `overallHostInvocationMs` remains `null`.
  GPU child environment retains `CUDA_PATH` plus host-injected `LD_LIBRARY_PATH` and visible-device variables when present; it does not fall back to the old default environment that omits CUDA.
- A future invocation requires fresh `chess-coach.host-qualification-approval.v1`, `hostExecutionApproved:true`, matching image mode, `maximumCampaignInvocations:1`, approved source-manifest SHA and `approval.runId === CLI label`.
  `validateHostApproval` rejects the same approval under a different label; exclusive `mkdir` rejects an existing run directory within retained persistent evidence.
  This is a functional one-attempt contract, not hardened cross-container anti-replay or physical-custody proof.
  The generation manifest binds root Cargo files, every crate manifest/Rust source, runner, recipe, input contract and both supervision files; runtime compares source inventory before and after execution.
  Host receipt fields now retain `approvalSha256`, `runId` and `testLoopLimits` alongside source/artifact identity.
  Even `PASS_TESTS_ONLY` keeps all training/readiness qualification flags false.
- `recordAttempt` appends `STARTED` before command execution and stores the command result before reading output streams.
  A later capture failure retains attempt identity, argv, timeout and available exit code, and the host runner classifies it as `FAIL_EXECUTION`, not `FAIL_PREFLIGHT`.
  The static verifier's post-run `checkSources` catches deleted/unreadable bound inputs and returns `sourceChanged:true` plus failure data, allowing its terminal `FAIL_SOURCE_ONLY` receipt rather than losing the outcome to that read exception.

F64, all 4,670 coordinates at `eps=1e-6`, `atol=1e-8`, `rtol=1e-5`, exact C12 with no tolerance substitution, CPU Flex initialization and masters `101..105` remain unchanged.
No new toy fixture, model/mathematics change, activation or training dispatch follows.

### Current source-2 evidence — source-only readiness, not host acceptance

The [source-2 receipt](../_work/gpu-owner-recovery/runs/gpu-qualification-source-2/receipt.json) records **`PASS_SOURCE_ONLY`**, `failure:null`, `sourceChanged:false`, five stages at exit 0, 277 bound inputs and 64 native-manifest inputs.
Its [raw test stderr](../_work/gpu-owner-recovery/runs/gpu-qualification-source-2/tests/command.stderr) confirms **32 tests / 223 assertions**: 18 qualification cases + 9 existing recipe cases + 5 prepared-verifier cases, followed by four successful typechecks.
The receipt records zero Cargo/LLVM invocations, native compilation, downloads, image operations or host/GPU operations in those static checks.
Its manifest SHA-256 is `48d4c9705a02d775d6f58a3bce58346e34a8f43e58e604dcdbcd0de5dda72f3b`; the equal 277-input count does **not** identify it with either the prior source-1 or older local-6 manifest.
The four added cases cover run-ID binding, capture-failure attempt retention, unreadable-source terminal failure data and the retained LLVM receipt contract.
The LLVM receipt case reads JSON only; it does not execute LLVM, repeat a query or renew authority.
The [source-1 receipt](../_work/gpu-owner-recovery/runs/gpu-qualification-source-1/receipt.json), its [28-test / 201-assertion summary](../_work/gpu-owner-recovery/runs/gpu-qualification-source-1/tests/command.stderr) and manifest `f493636ab6d2b03816553671db77ea2ad736f2b6b21f7d836c461ec57aa6eac9` remain immutable **HISTORICAL PRE-REVIEW-FIX** evidence, not the current source proof.

The lead reports these final source-only review outcomes; this docs pass invokes no reviewer:

| Reviewer session | Reported source-only outcome |
|---|---|
| Adversarial `ses_e3dde36f7ffe7zUOt5TLO5go8p` | READY; HIGH approval replay and both MEDIUM attempt/capture and unreadable-source reporting findings resolved |
| Security `ses_e3dde36f6ffeV2dAqWyTQ89u5u` | READY; no findings in this source-only fix scope, not physical-custody or runtime assurance |
| Backend `ses_e3df78573ffeXo04nE7v4wNCrB` | No functional findings |
| DevOps `ses_e3ec46b44ffe7CbnV5rwv23shT` | READY source-only; LOW test-loop/whole-host-invocation budget ambiguity resolved by explicit scope and null overall bound |

Source-only READY does not qualify actual native Cargo artifact compatibility, compiled linking/ABI, image usability, current native CPU regression or GPU behavior.
This pass claims no fresh verification, completed-record/hash-integrity acceptance, host operation approval or training readiness.

The separate [LLVM flag receipt](../_work/gpu-owner-recovery/runs/gpu-qualification-llvm-flags-1/receipt.json) records **`PASS_FLAGS_ONLY`**, five PASS/exit-0 results, `sourceChanged:false`, batch closed and **CONSUMED five invocations / zero remaining**, with no retry.
The exact existing coding-prefix `llvm-config --link-static` queries were `--cxxflags`, `--includedir`, `--libdir`, `--libs`, `--system-libs`, each bounded to 10 seconds with first-failure STOP.
The lead completed that native non-CUDA batch; this docs pass does not repeat it or the already-consumed version query.
Retained outputs report C++17, `_GLIBCXX_USE_CXX11_ABI=1`, `-fno-exceptions`, coding-prefix include/lib paths and NVPTX CodeGen/Desc/Info libraries.
**`--system-libs` reports only `-lrt -ldl -lm`**; it does not prove the C++ standard-library/runtime closure, dynamically loaded dependencies, compiled ABI compatibility, static linking or relocation/copy readiness.
The prefix remains unmodified, uncopied and unselected; the receipt records no compilation, download, image or host/GPU operation and keeps `trainingReady:false`.

### Consolidated host inputs — choices and bounds still unresolved

The [host input packet](../_work/gpu-owner-recovery/qualification/host-inputs.json) consolidates context roles, image pins, exact campaign ordering/paths and proposed limits without approving any operation.
All its acquisition, installation, context-copy/staging, image-build, host-execution, GPU-execution and training approval fields are **false**.
LLVM selection, builder/runtime overlays, CUDARC binding and libdevice source/hash remain unresolved; transfer/staging choices and build/overall-host-invocation/context/image/disk/CPU-memory bounds and cooperative GPU ceilings/telemetry are still incomplete.
Proposed per-campaign timings are not approved bounds, so this is **not a complete approved runnable host packet**.
The Rust pin's old `ABSENT` field remains unchanged only as historical projection; the current operator report records successful acquisition, with detailed image/compiler outputs still unreceived. Bun was last reported cached, not freshly inspected here, with no new Bun grant.
Continue consolidated input resolution by obtaining the four existing operator output files, not helper hardening, new library-by-library approvals or an assurance gauntlet.
No pull/container/cleanup allowance remains; any further acquisition, transfer/staging, native build, image operation, host/GPU campaign or training needs separate explicit scope. Prior Rust-install, Cargo-fetch, LLVM-metadata/version and visibility grants remain consumed, as do the flag-query batch and coding metadata walk.
Canonical init/BOTH/independent-reference/orderly-close proof, integrated R4, operational activation/five-master scheduling and accepted selected-path telemetry/coexistence remain outside this qualification.
ALL security/privacy/isolation hardening remains LAST, after **ALL planned training completes and its results validate**; full-assurance Gate0/F9/R4 stay OPEN and `trainingReady:false` remains unchanged.

## Prepared/offline bridge snapshot — locked cache and three feature trees PASS; no compilation

The local-6 evidence below retains its completed prepared-bridge scope; it is historical relative to the newly added qualification generation, not invalidated evidence for unchanged inputs.
It neither covers the new qualification files nor establishes a current whole-generation native build or CPU regression result.

[gpu-build.puml](gpu-build.puml) documents the optional [GPU recipe](../tooling/runtime/Dockerfile.gpu), [input contract](../tooling/runtime/gpu-build-inputs.json), static recipe tests and scoped local verification evidence.
Executor explicitly selected `Reuse LLVM Recommended` in the parent session; the [implementation request](../_work/gpu-owner-recovery/gpu-functional-prepared-llvm-implementation-request.json) authorizes source implementation, static checks and available offline Cargo graph checks only.
Executor accepted public `xtask` use outside its primary upstream purpose; this remains source-supported use, not a documented external-prefix API or build qualification.
The prepared bridge exists in source; both the coding Rust-toolchain grant and the later frozen-lock cache-fetch grant completed once and are consumed. The exact cache fetch and three separate offline feature trees passed; no further fetch/retry/download, provisioning, package upgrade, compilation, LLVM/prefix staging/selection, image/host/GPU work or training is authorized.

- `crates/learning/Cargo.toml` adds `gpu-prepared-llvm = ["gpu-cuda", "dep:tracel-llvm-bundler"]` and optional **host build dependency** `tracel-llvm-bundler =23.1.0-4` with public `xtask`; policy-io forwards the new feature to learning alongside `gpu-cuda`.
- Both default feature lists remain empty; existing `gpu-cuda` feature declarations and the CPU Dockerfile remain unchanged. This static source fact is not a fresh CPU numerical/regression result.
- `Cargo.lock` adds only learning's edge to the already pinned bundler; the lead reports no registry/version changes.
- The opt-in GPU recipe retains the same three pinned stages, three policy binaries and six reference bundles; it now selects `-p chess-coach-policy-io --features gpu-prepared-llvm`.
- `CUDARC_CUDA_VERSION` has no default and must match the contract's supported encoded list; its selected value remains `null`.
- With `XDG_DATA_HOME=/opt/tracel-data`, the prepared-only recipe declares a prefix at `/opt/tracel-data/tracel/tracel-llvm-23.1.0-4`; it retains executable-config and `23.1.0` version guards, but removes marker admission only for this explicit prepared mode. No prefix has actually been copied or selected, and no marker is fabricated.
- Input contract `chess-coach.gpu-build-inputs.v2` declares `feature:gpu-prepared-llvm`, `llvm.mode:prepared-offline`, `installationMarkerRequired:false` and the exact bundler/`xtask` installer bypass. Ordinary `gpu-cuda` declarations still use the upstream installer route; native CubeCL shim compilation and static linking remain necessary and unrun.
- Prepared builder/runtime rootfs overlays precede application inputs/outputs; runtime `CUDA_PATH=/usr/local/cuda` has a nonempty `nvvm/libdevice/libdevice.10.bc` guard. Actual ELF dependencies, dynamically loaded userspace libraries and host-driver `libcuda` injection still need functional qualification; no host-driver replacement or copy is invented.
- Bound versions remain Burn `0.22.0`, `burn-cuda` `0.22.1`, CubeCL `0.11.3`, LLVM bundle `23.1.0-4` and CUDARC `0.19.10`, with the declared `cubecl-llvm-nvptx` route. Backend/F64 capability metadata is not actual kernel proof and permits no dependency/backend/precision substitution.

The input contract remains `AWAITING_PREPARED_INPUT_SELECTION`: LLVM, builder-dependency and runtime-dependency selections and `CUDARC_CUDA_VERSION` are `null`; libdevice remains missing/unselected, the pinned Rust image was absent at the last received inspection with no approved acquisition/pull, and all qualification flags remain `false`.
[Inference] Reviewed Cargo resolver source permits host-feature unification across selected packages in one invocation; unchanged ordinary `gpu-cuda` declarations do not prove installer isolation when prepared mode is also selected in that invocation.
Local-6 now supplies actual resolved feature-tree evidence for the three separate modes, not just declarations or mocks. Compiled host-unit dependency coupling/sharing, native/static linking, ABI/NVPTX kernels, relocation and the actual build remain unqualified.

<a id="current-scoped-rust-recovery"></a>

### Coding Rust result — installed; local-5 failure historical; install grant consumed

Executor selected `Provision Rust Recommended`; automatic completion has now been received for `gpu-prepared-llvm-mise-1`.
The [actual execution receipt](../_work/gpu-owner-recovery/runs/gpu-prepared-llvm-mise-1/receipt.json) records **`TOOLCHAIN_INSTALLED_OFFLINE_GRAPHS_NOT_VERIFIED`**, `sourceChanged:false`, eight preflight PASS results and one install PASS at exit 0; the [outcome record](../_work/gpu-owner-recovery/runs/gpu-prepared-llvm-mise-1/outcome.json) records **CONSUMED: one install, zero remaining**, not overall graph success.
The [original request](../_work/gpu-owner-recovery/prepared-llvm-mise/request.json) remains byte-unchanged as its original authority projection; it authorizes no repeat install, helper replay, dependency acquisition or retry, and no installer/Cargo advice was followed to remove `--offline`.
This docs pass reads completed evidence manually only; it runs no command, test, native query, download or retry.

| Consumed boundary | Recorded contract / result |
|---|---|
| Toolchain and location | Coding environment only; Rust `1.95.0`, minimal profile, configured `rustfmt`/`clippy`, `targets:[]`, host `x86_64-unknown-linux-gnu`; reuse repository-owned cache/Mise/rustup/Cargo homes, not root/global/host configuration |
| Fresh scope checks | All eight preflights PASS: exact existing config/sole path/tool, repo rustup/Cargo homes and host; trust stayed scoped to repo-owned Mise state, not root/global/host configuration |
| Bounded attempt | One `mise install --jobs 1 core:rust` at exit 0 under its 600-second client deadline after unchanged-config reread; one consumed, no retry/fallback or runner repair; per-step bounds do not prove physical hard stop |
| Install evidence | Raw stderr reports `rustc 1.95.0 (59807616e 2026-04-14)` installed, downloading five components for the configured minimal + rustfmt/Clippy setup; the exact repo Cargo/rustc pair is now available and was selected, not the old global Mise link |
| Offline recheck | Actual local-5 ran six static stages successfully, then one prepared Cargo tree at exit 101; first-failure STOP prevented ordinary-CUDA and CPU tree attempts |
| Success ceiling | Install PASS alone was not graph PASS: local-5 obtained no complete tree. The later separate local-6 passes below supply tree-only evidence, not compiled host coupling, linking or GPU readiness |
| Downloads and exclusions | Rust-toolchain acquisition completed; that phase neither authorized nor performed project-dependency downloads. The separate later cache grant below does not renew any toolchain/LLVM/archive/image/host/GPU/training authority |

The new [provision driver](../_work/gpu-owner-recovery/prepared-llvm-mise/provision.ts), [mock tests](../_work/gpu-owner-recovery/prepared-llvm-mise/provision.test.ts) and [strict configuration](../_work/gpu-owner-recovery/prepared-llvm-mise/tsconfig.json) import only existing `prepare`/`environment` from the old provision module and reuse `runBounded`; they do not invoke the historical main or repair the runner.
The [source-only receipt](../_work/gpu-owner-recovery/runs/gpu-prepared-llvm-mise-source-1/receipt.json) records `PASS_SOURCE_PREINSTALL_ONLY`: 7 mocked tests / 46 assertions and strict helper types both exit 0, zero Mise commands/install invocations/downloads in **those checks**, and all 277 prepared-source hashes unchanged with zero mismatches.
Those mock/type results remain preinstall source evidence only; actual outcomes come from the separate execution/local-5 receipts, and app source, CPU/GPU F64 mathematics, all 4,670 coordinates, exact C12, initialization and cooperative policy remain unchanged.
Pre-execution adversarial `ses_e3e4db93fffe3vnYU3U3f7pPFD` accepted source/authority and security `ses_e3e4db930ffeG4ZPzaPQNdpunU` accepted only this fresh explicit grant; neither supplies native qualification or a completion result.
The existing `.gitignore` excludes `_work/gpu-owner-recovery/cache/`; cached toolchain payloads/binaries remain outside tracked evidence, and this docs pass changes no ignore rule.
The [raw install stderr](../_work/gpu-owner-recovery/runs/gpu-prepared-llvm-mise-1/install/command.stderr) retains the redirected-HOME/euid-home-mismatch `error:` lines and the missing-`cc` warning despite install exit 0; do not delete, relabel or hide them.
That C-toolchain warning does not establish a C compiler prerequisite for this graph check: the actual graph failure reports registry resolution, not linking, and no C compiler installation is approved.
The [integrity receipt](../_work/gpu-owner-recovery/runs/gpu-prepared-llvm-mise-1/integrity-check.json) records **`PASS_RECORD_INTEGRITY_ONLY`**, 34 streams and 285 source hashes (277 prepared + eight helper inputs); it preserves install PASS and graph FAIL, not overall installation/graph qualification or post-outcome runtime acceptance.
Post-outcome adversarial `ses_e3e4db93fffe3vnYU3U3f7pPFD` and security `ses_e3e4db930ffeG4ZPzaPQNdpunU` accept these completed-operation records only; neither accepts graph/build/GPU qualification or further execution.

<a id="current-locked-cache-fetch"></a>

### Completed locked cache fetch — PASS, three offline trees PASS; grant consumed

Executor selected `Fetch cache Recommended`; automatic completion has now been received for `gpu-prepared-llvm-cache-1`.
The [actual execution receipt](../_work/gpu-owner-recovery/runs/gpu-prepared-llvm-cache-1/receipt.json) records **`CACHE_AND_FEATURE_TREES_PASS_NO_COMPILATION`**, `failure:null`, `sourceChanged:false`, 282 bound inputs, 671 approved registry entries and both fetch/offline-verifier steps PASS at exit 0.
The [outcome](../_work/gpu-owner-recovery/runs/gpu-prepared-llvm-cache-1/outcome.json) records **CONSUMED: one fetch / zero remaining**, unchanged frozen lock and three passed offline modes; no further fetch, retry, tool install or download scope remains.
The [original request](../_work/gpu-owner-recovery/prepared-llvm-cache/request.json) retains its approved authority projection unchanged; it is not replay permission. This docs pass reads completed evidence only and runs no command, test, native query, download or retry.

| Consumed authority | Recorded contract / result |
|---|---|
| Frozen input | `Cargo.lock` remained unchanged at SHA-256 `77f674cc26a01f26558fd99c45bdcd5566017be05833fce1d39cae98cda05955`; 675 packages = four workspace + 671 registry package versions |
| Registry admission | Only `registry+https://github.com/rust-lang/crates.io-index` with locked identities and checksums; no Git/private dependencies, lock repair or package upgrades |
| Entry budget | At most 671 locked registry package versions, **not** an HTTP-request or byte cap; index metadata may contain other version records without selecting upgrades or changing the frozen lock |
| One fetch | Exact installed repo Rust `1.95.0` Cargo: `fetch --locked --target x86_64-unknown-linux-gnu`, one invocation PASS at exit 0 under its 600-second client deadline; fixed run `gpu-prepared-llvm-cache-1`, one consumed / zero remaining |
| Recorded fetch environment | Fetch-specific clone of the exported environment bound repo rustup/Cargo homes, exact paired `RUSTC` and pinned-bin PATH, with `CARGO_NET_OFFLINE=false`, `CARGO_NET_RETRY=0`, `CARGO_HTTP_TIMEOUT=30`, `CARGO_REGISTRIES_CRATES_IO_PROTOCOL=sparse`, `RUSTUP_AUTO_INSTALL=0`; shared exported/root/static environment remained unchanged |
| Stop and stability | First failure STOP; retain partial cache, no retries/fallback, lock removal/repair or toolchain substitution. Post-fetch lock/source stability checks also run on failed-fetch result paths; changed or unreadable bound inputs stop verification, and helper sources remain separately bound |
| Executed local-6 | Fetch PASS with unchanged inputs invoked the existing prepared verifier as `gpu-prepared-llvm-local-6`, under its 780-second wrapper deadline; six static stages and **three separate OFFLINE** prepared/ordinary-CUDA/CPU trees all exit 0 |
| Final admission | Pure `graphResultVerified` accepted three expected PASS trees and exact repo Cargo/rustc binding with `sourcesChangedDuringRun:false`; outer `sourceChanged:false` preserves all 282 bound inputs, including the unchanged 277 prepared sources. Actual feature-tree PASS supplies no compiled host coupling, native linking or GPU readiness |

The [fetch helper](../_work/gpu-owner-recovery/prepared-llvm-cache/fetch.ts), [mock tests](../_work/gpu-owner-recovery/prepared-llvm-cache/fetch.test.ts) and [strict helper configuration](../_work/gpu-owner-recovery/prepared-llvm-cache/tsconfig.json) reuse existing `prepare`/`environment`, `runBounded`, the verifier and pure graph-result predicate; they call no Mise install and do not rerun the historical provision main or repair the runner.
The [registry manifest](../_work/gpu-owner-recovery/runs/gpu-prepared-llvm-cache-1/registry-manifest.json) records 671 frozen names/versions/checksums at the exact approved registry source. The outcome reports **568 `Downloaded` name/version messages** in [raw fetch stderr](../_work/gpu-owner-recovery/runs/gpu-prepared-llvm-cache-1/fetch/command.stderr), all within that manifest; it explicitly does **not** claim all 671 entries were downloaded, an HTTP/byte total or acquisition outside the frozen set.
The [integrity receipt](../_work/gpu-owner-recovery/runs/gpu-prepared-llvm-cache-1/integrity-check.json) records **`PASS_RECORD_STREAM_AND_SOURCE_INTEGRITY_ONLY`**: 22 streams, all 282 bound fetch-source hashes and all 277 prepared-source hashes checked unchanged, no repeated fetch/native query. This is record/stream/source integrity only, not compiled host-unit, ABI, relocation, kernel, image or GPU qualification.
Source-declared failure states distinguish `FAIL_BOUND_INPUT_CHANGED`, `FAIL_FETCH`, and successful fetch without accepted verification (`CACHE_FETCHED_OFFLINE_GRAPHS_NOT_VERIFIED`); none supplies permission to retry, bypass offline checks or relabel the prior graph failure.
The [latest prefetch-only receipt](../_work/gpu-owner-recovery/runs/gpu-prepared-llvm-cache-source-2/receipt.json) records **`PASS_SOURCE_PREFETCH_ONLY`**: [unit stderr](../_work/gpu-owner-recovery/runs/gpu-prepared-llvm-cache-source-2/unit/command.stderr) confirms 8 mocked cases / 23 assertions, strict helper types exit 0, `sourceChanged:false`, all 277 prepared-source hashes unchanged with no prior mismatches, and **zero real fetch invocations/downloads** in those checks.
The helper's new folder/source proof remains separate from the unchanged 277-input prepared manifest; no app, feature, F64/C12, initialization or cooperative-policy change follows.
The earlier [cache-source-1 receipt](../_work/gpu-owner-recovery/runs/gpu-prepared-llvm-cache-source-1/receipt.json) remains historical PASS at 6 mocked cases / 16 assertions, before two adversarial MEDIUM failure-reporting fixes and their regression cases; it is not the latest source proof.
The lead reports both findings resolved: unreadable bound sources now yield bounded changed-input failure, and missing/invalid verifier receipts preserve successful-fetch/unverified-graph scope rather than a preflight label. These are source/test changes, not edits to runtime evidence files or proof of actual fetch failure handling.
The lead reports final pre-execution adversarial `ses_e3e279074ffecatzIlWgyKAeHe` READY with both findings resolved and security `ses_e3e279068ffdYBUGpvUXWkOlML` READY **within this explicit grant only**. Neither verdict accepts an actual network/Cargo outcome, native graph/build, GPU qualification or any post-outcome record for this new attempt.
The [completed-record review](../_work/gpu-owner-recovery/runs/gpu-prepared-llvm-cache-1/review.json) records adversarial `ses_e3e279074ffecatzIlWgyKAeHe` and security `ses_e3e279068ffdYBUGpvUXWkOlML` READY for the cache/feature-tree records only; it accepts no compilation, GPU/training qualification or further operation.
Normal locked crates.io metadata and `.crate` download/unpack were approved within the completed one-fetch grant; they are **not** the halted LLVM release-archive pipeline, and no per-crate body security-audit gate is required. That grant is now consumed and supplies no additional acquisition.
Package upgrades, compilation, native/CPU numerical/e2e tests, LLVM bundles or old archive capture/replay, prefix staging/selection, images, host/GPU operations, training and Rust/toolchain reinstallation remain excluded; the Mise install grant stays consumed and `trainingReady:false` stays unchanged.

### Current completed graph recheck — local-6 static and three feature trees PASS

The [current local-6 receipt](../_work/gpu-owner-recovery/runs/gpu-prepared-llvm-local-6/receipt.json) records **`PASS_STATIC_AND_FEATURE_TREE_ONLY`**, `graphStatus:PASS_FEATURE_TREE_ONLY` and `staticChecksPassed:true`: six static stages exit 0, 14 cases / 109 assertions plus four typechecks, 277 unchanged inputs and `sourcesChangedDuringRun:false`; all three actual Cargo trees exit 0 with `expectedFeatureTextPresent:true`.
Its source-manifest SHA-256 is `710a658592d3f7ef89f04a654f0d30213315eb33ba8a0f927c24061db1a01fba`.
Earlier prepared-mode receipts remain immutable history: local-1 predates pin refinement, local-2 predates paired binding, local-3 predates pure tests, and [local-4](../_work/gpu-owner-recovery/runs/gpu-prepared-llvm-local-4/receipt.json) is preinstallation `PASS_STATIC_GRAPH_UNAVAILABLE` / `UNAVAILABLE_CARGO`. The [local-5 receipt](../_work/gpu-owner-recovery/runs/gpu-prepared-llvm-local-5/receipt.json) retains `FAIL_OR_INCOMPLETE_GRAPH`: one prepared tree exit 101, stdout 0, first reported uncached bundler; ordinary-CUDA/CPU trees did not run in **that** phase. Local-6's later PASS changes neither earlier receipt nor historical CPU regression scope.
The [nested verifier](../_work/gpu-owner-recovery/prepared-llvm/verify.ts), [pure helper tests](../_work/gpu-owner-recovery/prepared-llvm/verify.test.ts) and [configuration](../_work/gpu-owner-recovery/prepared-llvm/tsconfig.json) reuse existing `runBounded`; the configuration includes `*.ts`, and this slice changes no lifecycle implementation or qualification.

| Recorded stage | Result / scope |
|---|---|
| `recipe` | PASS: 9 cases / 97 assertions; prepared feature/host dependency/pin, unchanged defaults and ordinary `gpu-cuda`, mode-specific guards and no fake marker/manual feature environment/`DOCS_RS` |
| `verifier-tests` | PASS: 5 pure cases / 12 assertions; paired binding, missing rustc, unversioned substitution rejection, unavailable Cargo and static-environment immutability; no native tool query |
| `types-source` | PASS, exit 0: `tsconfig.json` |
| `types-tests` | PASS, exit 0: `tsconfig.tests.json` |
| `types-tools` | PASS, exit 0: `_work/gpu-owner-recovery/tsconfig.json` |
| `types-verifier` | PASS, exit 0: `_work/gpu-owner-recovery/prepared-llvm/tsconfig.json` |
| `graph-prepared` | **PASS**, actual repo Cargo tree exit 0; `--locked --offline`, target `x86_64-unknown-linux-gnu`, package `chess-coach-policy-io`, `gpu-prepared-llvm`; exact versions and bundler `xtask` present |
| `graph-ordinary-cuda` | **PASS**, separate actual offline tree exit 0 with `gpu-cuda`; same exact LLVM/bundler versions, bundler `xtask` absent per matched predicate |
| `graph-cpu` | **PASS**, separate actual offline tree exit 0 with `--no-default-features`; bundler absent per matched predicate, not a native CPU regression test |
| CPU numerical tests, native/cross-language e2e and GPU tests | Not run: the consumed grant covered static/offline feature trees only, not compilation; actual GPU execution stays host-only under separate authority |

At local-4's preinstallation snapshot the checked Cargo/rustc candidates were unavailable; local-5 observed restored tool availability but encountered the cache miss. Local-6 now records three passed trees using the installed repo pair at `_work/gpu-owner-recovery/cache/rustup/toolchains/1.95.0-x86_64-unknown-linux-gnu/bin/`, exact `RUSTC` and pinned-bin PATH, not the old global Mise link or a reinstall. Tool/cache availability for this tree task is no longer the current blocker.
Only `_work/gpu-owner-recovery/cache/rustup/toolchains/1.95.0-x86_64-unknown-linux-gnu/bin/cargo` and `/home/agent/toolchains/linux-amd64/.local/share/mise/installs/rust/1.95.0/bin/cargo` are eligible for future graph probes, and each also requires an executable `rustc` in the same `bin` directory (`X_OK` for both).
The unversioned `/usr/local/bin/cargo`, `/usr/bin/cargo` and `/bin/cargo` checks are diagnostic only; the helper cannot select them as an automatic toolchain substitute.
The lead reports an adversarial MEDIUM finding for missing `RUSTC`/PATH binding; the helper now derives a separate graph environment with `RUSTC` set to that exact paired rustc and the selected Cargo `bin` prepended to PATH.
Each stage receipt records its actual environment; local-6 binds the exact repo pair with `CARGO_NET_OFFLINE=true` without mutating root/static environment. Three resolved feature trees now provide positive tree-only evidence, not compiled host-unit coupling or native/linking proof.

| Observed local-6 tree-only predicate; all three PASS | Recorded resolved feature text |
|---|---|
| Prepared mode | [Actual stdout](../_work/gpu-owner-recovery/runs/gpu-prepared-llvm-local-6/graph-prepared/command.stdout) contains `cubecl-llvm v0.11.3`, `tracel-llvm-bundler v23.1.0-4` and bundler `xtask` at line 2429 |
| Ordinary CUDA mode | [Actual stdout](../_work/gpu-owner-recovery/runs/gpu-prepared-llvm-local-6/graph-ordinary-cuda/command.stdout) contains both exact crate/version strings; matched predicate requires bundler `xtask` absent |
| CPU mode | [Actual stdout](../_work/gpu-owner-recovery/runs/gpu-prepared-llvm-local-6/graph-cpu/command.stdout) passes the bundler-absent predicate |

The historical [local-5 graph stderr](../_work/gpu-owner-recovery/runs/gpu-prepared-llvm-local-5/graph-prepared/command.stderr) still reports `no matching package named tracel-llvm-bundler found`, location `crates.io index`; it identified the first cache miss, not absent Cargo, broken LLVM or the only missing crate. It is not the current graph result.
Local-6 has three PASS results, with all expected text predicates matched; this establishes actual resolved feature-tree evidence but not compiled host-unit sharing, static linking/ABI, NVPTX kernels, relocation, image readiness or fresh native CPU regression.
Local-5's generic online-retry advice was not followed. The later separately approved locked fetch completed once, offline graph predicates remained offline, and both install/fetch grants now have zero remaining invocations.
The lead reports backend `ses_e3eb390a0ffevPYsyX7nd2VlAn` and monorepo coordinator `ses_e3e975903ffemhEzKAbgl5dmRP` accept static source wiring, and DevOps `ses_e3ec46b44ffe7CbnV5rwv23shT` reports source READY yes; none supplies graph/build/operational qualification.
The lead reports security `ses_e3e8e2af2ffeghBA7pJPnxjio9` READY for source/static scope only; this accepts no native graph, build, host/GPU qualification or broader operation.
Adversarial `ses_e3e8e2af9ffea4WmRI4iPfFWdJ` reports the MEDIUM binding finding resolved and READY for the source-only slice; security reconfirms the same limited scope after the fix and pure tests.
The [scoped review record](../_work/gpu-owner-recovery/gpu-functional-prepared-llvm-source-review.json) records those source-phase verdicts without accepting the then-unavailable graph, native build or GPU qualification; later local-6 evidence does not retroactively broaden them.

Exactly six baseline paths changed: `Cargo.lock`, both learning/policy-io Cargo manifests, `packages/runtime/tests/gpu-recipe.test.ts`, `tooling/runtime/Dockerfile.gpu` and `tooling/runtime/gpu-build-inputs.json`.
Run stability is not baseline identity: the current receipt's `sourcesChangedDuringRun:false` does not restore the old 273-input manifest's applicability.
The prior `gpu-functional-local-3` CPU/F64 evidence is now **HISTORICAL, PRE-PREPARED GENERATION**, not current whole-generation evidence; no fresh CPU numerical or CPU-behavior regression proof follows.
All earlier unchanged-273-hash statements below describe their recorded pre-prepared phases, not the current source tree; their receipts remain immutable.

<a id="current-local-evidence--gpu-functional-local-3-only"></a>

### Historical local-3 — pre-prepared CPU/F64 generation

The [historical receipt](../_work/gpu-owner-recovery/runs/gpu-functional-local-3/receipt.json) records `PASS`, all six stages at exit 0, `sourceChanged:false`, and scope `LOCAL_RECIPE_TYPES_AND_DEFAULT_CPU_ONLY` for that earlier generation.
It records 273 selected source inputs with manifest SHA-256 `3e5b58c02eeab08783051e087c57381dc0059605c2de6b07fac70e240bf09d45`.
Its retained stdout/stderr confirm the following bounded results; empty typecheck streams accompany the receipt's exit-0 statuses.

| Stage under `_work/gpu-owner-recovery/runs/gpu-functional-local-3/` | Recorded result | Scope |
|---|---|---|
| `recipe` | PASS: 8 tests / 83 assertions | Static GPU recipe/input-contract checks, not a GPU build or execution |
| `types-source` | PASS | `tsconfig.json` |
| `types-tests` | PASS | `tsconfig.tests.json` |
| `types-tools` | PASS | `_work/gpu-owner-recovery/tsconfig.json`; includes `gpu-functional-verify.ts` itself |
| `cpu` | PASS: 39 learning/policy-io tests | Default CPU Flex F64; two 2,335-coordinate sweeps cover all 4,670 coordinates at unchanged `eps=1e-6`, `atol=1e-8`, `rtol=1e-5` |
| `cpu-recipe` | PASS: 2 tests | CPU `chess-coach-host-facts` recipe tests, not actual host execution |

Preserve [local-1 FAIL](../_work/gpu-owner-recovery/runs/gpu-functional-local-1/receipt.json) and its streams: `types-tests` exited 2 with three TS2339 errors in the new recipe test before its typing correction.
[Local-2 PASS](../_work/gpu-owner-recovery/runs/gpu-functional-local-2/receipt.json) remains an earlier 272-input, five-stage generation with 8 recipe tests / 82 assertions.
It predates the two LOW source-coverage corrections: builder-root-before-LLVM ordering coverage, and tooling/verifier typecheck plus tooling-config manifest coverage.
Local-3 supplied that pre-prepared generation's result; its six now-changed inputs prevent promotion to current whole-generation proof, and no earlier receipt is rewritten.
Those results qualified the earlier local source/test stage only, not current CPU regression, image construction, selected-host GPU capability, training dispatch, full assurance or review acceptance.
The retained scoped adversarial, DevOps and security source-wiring acceptance in `_work/gpu-owner-recovery/gpu-functional-source-review.json` belongs to that earlier slice; it does not accept the prepared implementation.
This acceptance supplies no image, runtime, activation or training qualification.
The operator has supplied GPU/driver and Docker-runtime metadata in [the normalized host-observation record](../_work/gpu-owner-recovery/gpu-functional-host-observations.json); these are operator-reported facts, not an agent-run host verification or selected bindings.
The lookup packet, nested tests and later operator records sit outside the local-3 manifest; the prior visibility-record integrity check confirmed its 273 inputs unchanged without a new CPU test run.
That receipt does not validate the later LLVM inventory records; their separate record-only check confirms consistency and unchanged 273 functional / 6 lookup / 4 syntax source hashes without executing LLVM or rerunning tests.
That metadata-only check predates the separately approved version execution and integration review below; their separate integrity receipt validates the new records and streams without repeating the version probe.

The existing six ignored host GPU tests remain unrun evidence targets: two sweeps in `crates/learning/tests/finite_difference.rs` and four score/update/channel/reload tests in `crates/policy-io/tests/gpu.rs`.
Future selected-host verification must retain F64, all 4,670 coordinates at `eps=1e-6`, `atol=1e-8`, `rtol=1e-5`, actual scoring/backward/SGD/reload and exact C12 digests; CPU Flex/master `101..105` initialization and all model/objective/RNG/curriculum/checkpoint/eligibility semantics stay unchanged.

### Known functional activation gap — recipe is not training enablement

`tooling/runtime/Dockerfile.gpu:49` retains the application CMD `/app/packages/runtime/src/job.ts` through the existing init; `packages/runtime/src/job.ts:11` accepts only `native-proof`.
The actual `gpuJobMain` at `packages/runtime/src/gpu-job.ts:142` throws `SOURCE_ONLY_DISABLED`, and `crates/gpu-owner/src/main.rs:10` retains its disabled operational main.
The recipe has neither approved nor implemented activation of those normal GPU training paths.
After selected-host GPU capability is established, activation remains separately scoped functional implementation/wiring with ordinary source/test/readiness verification and separate execution/training authority.
It is not deferred security hardening, a new audit gauntlet, or an extra decision before the current prepared-input choice.

Executor's original `Cached-image probe (Recommended)` selection led to an operator-reported cache-inspection stop: both exact pinned images were missing, so the unchanged [Fish packet](../_work/gpu-owner-recovery/gpu-container-visibility.fish) created no container and ran no GPU query.
Executor then selected `Bun only (Recommended)`; the [first renewal](../_work/gpu-owner-recovery/gpu-container-visibility-renewal.json) retains its original pending status byte-unchanged, but the [historical operator result](#historical-bun-only-operator-result--authority-consumed) records **CONSUMED: one pull and one container attempt; zero remaining under that grant**.
That historical Bun pull succeeded; its OCI launcher lookup failed before any container process or GPU query started. The separate [renewal-2 result](#current-cached-visibility-result--renewal-2-consumed-packet-fail) now reports process startup and GPU enumeration, but the complete query packet **FAILS at exit 6**; its one-attempt authority is also **CONSUMED, zero remaining**.
Executor's metadata/version invocations and coding Rust install are consumed. The [completed locked-cache fetch](#current-locked-cache-fetch) and three offline feature trees now PASS with the fetch grant consumed; they supply no GPU probe, native compilation, runtime repair or additional acquisition authority.
No context-assembly helper is added by this spec pass, and neither version-only success nor source-only review implies prepared inputs or automatic selection.
The coding Rust provisioning and frozen-lock cache-fetch grants are consumed; no fetch/retry/download or tool install remains approved. No further probe, image pull/container/build, old LLVM archive read/rehash/mount/capture, acquisition, configuration change, restart, upgrade, compilation, staging/selection, native/host/GPU operation, training or publication is authorized without separate explicit scope. Both visibility grants remain spent, the prior full-pipeline hold remains and actual GPU work stays outside the coding sandbox.
Do not require reenacting the old isolated Bun/archive pipeline; its requests remain unchanged, diagnostics remain 0/3 with no accepted binding, and the full request stays halted.
Native capture, pidfd/cgroup/strict-stop work and ALL security/privacy hardening and isolation remain LAST, after **COMPLETE PLANNED TRAINING AND VALIDATE RESULTS**.

### Current host observations — received, operator-reported metadata only

[The host-observation record](../_work/gpu-owner-recovery/gpu-functional-host-observations.json) is normalized from pasted operator output, not an original machine capture.
Its displayed `Sun 08 Nov 2026 08:13:50 PM MST` GPU time and `08:14:01 PM MST` Docker time are not independently attested execution times.

| Reported field | Operator-reported value |
|---|---|
| GPU | NVIDIA GeForce RTX 3070 Laptop GPU |
| UUID | `GPU-713c95e0-6952-a576-794b-9ef1fb527ff0` |
| Driver | `615.78.08` |
| VRAM | 8,192 MiB total; 7,742 MiB free at the reported snapshot |
| Docker | `linux/x86_64`; runtime names `io.containerd.runc.v2`, `nvidia`, `runc` |
| NVIDIA runtime path | `nvidia-container-runtime`, reported registered, not functionally qualified |

Free VRAM is neither a reservation nor a sustained availability or admitted-fit guarantee.
The record cites [NVIDIA minor-version compatibility](https://docs.nvidia.com/deploy/cuda-compatibility/minor-version-compatibility.html): CUDA 13.x has a minimum driver branch of 580, so reported branch 615 meets that family floor only.
This comparison establishes neither an exact CUDA API/PTX ceiling nor actual F64 scoring, backward, SGD, reload or C12 agreement.
`13000` is an **ADVISORY candidate only**, not a selected CUDARC binding or compatible-input proof; the CUDA version and all three prepared-input selections remain `null`.
No global `selectedUuid`, host binding or Gate0 acceptance follows from this reported identity.

The consumed operator-only Bun pull and visibility attempt were functional work, not a security inspection, GPU-kernel test or training activation.
The first visibility paste reports only a container object and OCI launcher failure; the latest separate paste reports a started process, `/usr/bin/nvidia-smi` and the correct GPU CSV, followed by `No devices were found` and overall query exit 6.
This positive enumeration/memory snapshot does not turn the complete packet into PASS or establish Bun/CUDA numerical behavior; the failure cause remains unknown.
No host commands or operator tools ran through this agent; no Rust pull, image build, LLVM/libdevice preparation, native CUDA compilation or training is authorized.
The local-3 273-input source verification is historical pre-prepared evidence; six current baseline inputs changed, and lookup source checks below cover only their recorded earlier scope.

### Historical visibility packet — unchanged, authority consumed

The original [request](../_work/gpu-owner-recovery/gpu-container-visibility-request.json) and [packet](../_work/gpu-owner-recovery/gpu-container-visibility.fish) remain byte-unchanged, including the original no-pull rule and retained request status.
The limits below describe the historical probe, not a runnable handoff or remaining authority.
The original cache guard stopped before container creation; renewal-1 spent its separate one-pull/one-container allowance and failed at launcher lookup, while renewal-2 later spent its one cached attempt with process startup but query exit 6.
**HISTORICAL — NOT RERUN:** both renewals are consumed with zero remaining; neither the unchanged no-pull packet nor any retained pending status supplies replay authority. The coding agent must not invoke Docker or any host tool, even for metadata.

| Historical approved operation | Exact boundary |
|---|---|
| Cached-image inspection | Inspect the request's pinned Rust and Bun images with 10-second client deadlines each and a three-second kill-after. Bun must already exist as `linux/amd64`, or stop without pull/substitution; report missing Rust for later input selection without pulling it. |
| One conditional container | Use only the pinned cached Bun base, `nvidia` runtime, GPU UUID `GPU-713c95e0-6952-a576-794b-9ef1fb527ff0`, UID/GID `1000:1000` and `compute,utility` driver capabilities. No additional user mounts. |
| Metadata and ordinary caps | Resolve `nvidia-smi`, collect its fixed GPU CSV and UUID-scoped memory query only; use `--pull=never`, 2 CPUs, `512m` memory and 64 PIDs. These are probe limits, not production runtime or containment qualification. |
| Client deadline | The Docker query client has 30 seconds plus a three-second kill-after. This does not guarantee a physical hard stop, daemon/container termination or a hard return from native work. |
| Cleanup | A 10-second client deadline plus three-second kill-after applies only to force-removing the valid 64-hex CID recorded in this attempt's fresh CID file. Missing/invalid CID or failed cleanup remains unverified; do not target other containers. |
| Output | Use the packet's fresh `_work/gpu-owner-recovery/runs/host-visibility-XXXXXXXX` directory for query/cleanup streams, CID and reported exit statuses; no evidence directory is created by this spec pass. |

The unchanged probe packet itself grants no pull; the separate first renewal is consumed and grants no repeat pull/probe, Rust pull, image build, install, additional user mount, libdevice/LLVM archive operation, native CUDA compilation, CUDA kernel, training or host configuration change.
It supplies no new isolation/containment proof and does not reopen deferred hardening work.
Driver branch 615 still establishes only the reported CUDA 13.x family-floor comparison; the exact API/PTX ceiling, CUDARC binding version and three prepared-input selections remain unestablished/unselected.
The operator packet and runtime-lookup source checks are outside the existing local-3 result; that PASS is not operator execution, GPU visibility, activation or training acceptance.
The complete visibility packet has not passed; retained `containerGpuVisibilityEstablished:false` is not a denial of the latest reported enumeration, and `trainingReady:false` remains unchanged. Old diagnostic cases remain 0/3 unspent and the full pipeline remains halted.
ALL security/privacy hardening and isolation remain LAST, after completed planned training and validated results.

#### Operator cache-inspection result — not a runtime or CUDA failure

[The retained operator observation](../_work/gpu-owner-recovery/runs/gpu-container-visibility-host-inspection-1/operator-observation.json) is normalized from pasted output, not an original machine capture, and reports packet checkout `17a0ed9cf`.
Both pinned-image inspections returned exit 1 with `No such image`; the Bun result was empty, so the conditional prevented all container creation and in-container GPU queries.
Recorded counts are zero containers and zero GPU queries; query and cleanup exit codes are `null` because those operations never ran.
This establishes a reported cache prerequisite failure only, not NVIDIA runtime, CUDA, F64 or cleanup failure; the result itself grants no pull.
Missing Rust remains informational for this Bun-only probe and must not require a Rust pull or block the probe after Bun is successfully acquired.

#### Public registry metadata — declarations, not executed image versions

[The registry record](../_work/gpu-owner-recovery/gpu-functional-base-image-metadata.json) records public Docker Hub manifest/config metadata only: both exact pinned digest requests returned HTTP 200 with matching digest headers, OCI platform manifests and `linux/amd64` metadata.

| Exact pin from the record | Metadata-declared version | Compressed layers |
|---|---|---|
| Bun | OCI version label `1.4.0`; revision `34cbb9a40b4bd1bd767d134a7065e66c2432a676` | 7 layers; 89,195,521 bytes |
| Rust | Config environment `RUST_VERSION=1.95.0` | 5 layers; 563,746,315 bytes |

These are manifest/config declarations, not versions executed in an image; no layer payload was fetched and no image was pulled or container created by those metadata reads.
Compressed-layer sums are neither exact network-transfer totals nor unpacked disk requirements.
No base-image metadata implies GPU capability, selected compiler inputs or permission to acquire Rust.

### Historical Bun-only operator result — authority consumed

The [historical first visibility observation](../_work/gpu-owner-recovery/runs/gpu-container-visibility-host-probe-1/operator-observation.json) normalizes the retained [operator paste](../_work/gpu-owner-recovery/runs/gpu-container-visibility-host-probe-1/operator-paste.txt), not original machine files; the executed source commit remains unknown.
The original request, renewal, packet and earlier syntax receipts remain byte-unchanged; their pending statuses are historical, not current unspent authority.
The historical acquisition command remains in the renewal record for traceability, **not rerun**.

| Historical operator-reported result | Boundary |
|---|---|
| Bun pull succeeded; inspect exit 0, `linux/amd64` | Exact digest `sha256:18639686662e5cd8a963ffb967dd130034a2a2d076a52e65dfd4fe18f75cc038`; no numeric pull exit was supplied and no Bun version executed |
| Rust inspect exit 1, missing | Expected informational result; no Rust pull authorized |
| One container object created | CID `48633c91974748c087e2f49c511b91d746f7379a80af7863b788fd6b53b30a0b`; no container process started |
| OCI launcher lookup failed | `exec: "nvidia-container-runtime": executable file not found in $PATH`; query exit 127, zero started in-container GPU queries |
| Cleanup exit 0 | Operator-reported removal only; original `_work/gpu-owner-recovery/runs/host-visibility-tRp94up1` machine files were not received |
| First renewal authority **CONSUMED** | One pull / one container attempt used; zero remaining under that grant; the separate renewal-2 is now also consumed |

The lookup failure does not distinguish missing installation, a service PATH issue or a different daemon execution host; the root cause remains undetermined.
No `nvidia-smi`, CUDA kernel or Bun application ran, so no Bun/CUDA numerical failure or GPU proof follows.
Engine version, effective daemon endpoint, default runtime, daemon/containerd PATH and NVIDIA hook mode remain unknown after the later partial lookup; `runc 1.5.2` is not the Docker Engine version.
`containerGpuVisibilityEstablished` and `trainingReady` remain `false`; CUDA and all three prepared-input selections remain `null`.
Existing gpu-functional-local-3 and visibility-local-1 syntax receipts remain unchanged and cover neither runtime-lookup source checks nor the later operator lookup records.
ALL security/privacy hardening and isolation remain LAST, after completed planned training and validated results.

<a id="current-cached-visibility-renewal--operator-only-pending"></a>

#### Current cached visibility result — renewal-2 consumed, packet FAIL

The later [partial paste](../_work/gpu-owner-recovery/runs/gpu-runtime-lookup-host-2/operator-paste.txt) and [normalized observation](../_work/gpu-owner-recovery/runs/gpu-runtime-lookup-host-2/operator-observation.json) supersede the first lookup's shell-tool availability summary, not its retained historical bytes.
They are operator-reported metadata, not original machine captures; installation history, the source commit and exact executed handoff remain unknown.

| Prior host-2 lookup result | Boundary |
|---|---|
| RPM query exit 0: `nvidia-container-toolkit`, `nvidia-container-toolkit-base`, `libnvidia-container-tools`, `libnvidia-container1`, all `1.20.1-1.x86_64`; ctk-owner exit 0 identifies the base RPM | Reports the shell machine's installed packages; supplies no installation actions or runtime qualification |
| All six path lookups exit 0 under `/usr/bin`: `nvidia-container-runtime`, `nvidia-container-runtime-hook`, `nvidia-container-cli`, `nvidia-cdi-hook`, `nvidia-ctk`, `runc` | Does not establish the physical daemon host, daemon/containerd PATH or a successful launcher |
| Context show/inspect exit 0: `default`, `unix:///var/run/docker.sock`; info exit 0 | `DOCKER_HOST`/`DOCKER_CONTEXT`, version fields/exit and formatted info values remain omitted; effective endpoint, Engine and default runtime remain unknown |

After explicitly offering three routes in the parent session, the lead received Executor's actual selection `One visibility probe`; this was not child-agent advice.
The separate [renewal-2](../_work/gpu-owner-recovery/gpu-container-visibility-renewal-2.json) retains **APPROVED_OPERATOR_CACHED_IMAGE_VISIBILITY_ATTEMPT_PENDING** byte-unchanged as history, not current authority.
The [new normalized observation](../_work/gpu-owner-recovery/runs/gpu-container-visibility-host-probe-2/operator-observation.json) and [operator paste](../_work/gpu-owner-recovery/runs/gpu-container-visibility-host-probe-2/operator-paste.txt) record **FAIL_QUERY_EXIT_6_WITH_GPU_ENUMERATION_REPORTED_AUTHORITY_CONSUMED**.
They are operator-reported output, not original host machine files; the executed source commit remains unknown.

| Latest operator-reported result | Meaning / limit |
|---|---|
| Rust inspect exit 1, `No such image` | Expected informational missing pin; no Rust pull approved |
| Bun inspect exit 0, `linux/amd64` | Exact cached pin `sha256:18639686662e5cd8a963ffb967dd130034a2a2d076a52e65dfd4fe18f75cc038`; no new pull or executed Bun version follows |
| Container process started; `nvidia-smi=/usr/bin/nvidia-smi` | Distinct from the first attempt's pre-process OCI launcher failure; does not explain or rewrite that historical failure |
| CSV: NVIDIA GeForce RTX 3070 Laptop GPU | UUID `GPU-713c95e0-6952-a576-794b-9ef1fb527ff0`, driver `615.78.08`, total 8,192 MiB / free 7,742 MiB; positive enumeration and memory snapshot, not a reservation or admitted fit |
| Then `No devices were found`; overall query exit 6 | Complete visibility packet **FAIL**, not PASS; individual command exit codes and the UUID memory-detail result were not supplied |
| CID `ccb4eea1008855df75383447e27e4d02dddc8852d0a9f2c537b6b0e692c18f3c`; cleanup exit 0 | Operator reports cleanup success; original `_work/gpu-owner-recovery/runs/host-visibility-A2lyzIc2` machine files were not received |
| Renewal-2 **CONSUMED** | One invocation / one container used, zero remaining, zero pulls authorized and no automatic retry |

The unchanged packet's final source command scopes memory detail through `-i "$NVIDIA_VISIBLE_DEVICES" -q -d MEMORY`; this is the **apparent**, not independently proved, failure step.
The paste omits the actual in-container `NVIDIA_VISIBLE_DEVICES` value and per-command exit codes, so it cannot independently attribute exit 6 to that command; the cause remains unknown.
Do not diagnose a mapping, environment or driver bug from this output.
The lead-supplied [NVIDIA return-value reference](https://docs.nvidia.com/deploy/nvidia-smi/index.html#return-value) supports UUID selection with `-i` and defines exit 6 as a query to find an object being unsuccessful; that definition does not identify the cause here.

**HISTORICAL — NOT RERUN:** the original request, both renewal records, packet and old receipts remain byte-unchanged; all retained pending statuses describe earlier authority generations, and both attempt grants are now spent.
No new probe, pull, runtime/image substitution, retry, install, configuration change, restart, image build, archive operation, compiler/native execution, CUDA kernel, training or full-pipeline renewal is granted; the coding agent runs no host/GPU command.
The [renewal-2-local-1 receipt](../_work/gpu-owner-recovery/runs/gpu-container-visibility-renewal-2-local-1/receipt.json) is historical pre-attempt record-integrity PASS for its three records and 4 syntax / 6 lookup / 273 functional source hashes, not validation of these two later operator records.
Adversarial `ses_e3ef69e6bfferfNKS5hDky5X6K` and security `ses_e3ef69e63ffe3gge4Idewgy4nV` accepted the earlier scoped handoff, not the new result or runtime/GPU qualification.
The [current local receipt](../_work/gpu-owner-recovery/runs/gpu-container-visibility-host-probe-2-local-1/receipt.json) records PASS for record/paste consistency, consumed authority, unchanged 4 syntax / 6 lookup / 3 renewal / 273 functional source hashes, preserved literal UUID telemetry selection and matching diagram/index coverage; it executes no host/GPU command and reruns no tests.
Adversarial `ses_e3ee00270ffeTZYU4IG9C79aM7` and security `ses_e3ee00264ffd1cJ7tuxc7DZ8OP` accept this docs/data scope, not the failed packet or operational/GPU qualification.
The new records change no source/test/verifier or prior receipt; no new CPU test is required by this observation.

##### Actual cooperative telemetry contract — qualification still pending

[`crates/gpu-owner/src/telemetry.rs:6–11`](../crates/gpu-owner/src/telemetry.rs) explicitly constructs literal `--id={uuid}`, `--query-gpu=uuid,driver_version,memory.total,memory.used,memory.free` and `--format=csv,noheader,nounits`; it is not an unscoped all-visible-device provider.
Its decoder requires one bounded ASCII line and exact expected UUID/driver agreement before accepting numeric memory fields.
The packet's apparent environment-scoped memory-detail failure neither qualifies nor fails this distinct literal-UUID CSV provider.
Actual selected-path functional telemetry qualification remains pending before training, alongside unchanged cooperative selector/eligibility, ceilings and host coexistence; it is not a prerequisite for read-only input planning.
No extra NVML gauntlet or archived Bun audit precedes that planning.
The full packet remains FAIL, no actual CUDA GPU code or F64 work is established, and `trainingReady:false` remains unchanged.
F64, all 4,670 coordinates/tolerances, exact C12 and CPU Flex/master `101..105` initialization remain unchanged; ALL security/privacy hardening and isolation remain LAST, after completed planned training and validated results.

#### Historical first partial runtime lookup — operator-reported only

The earlier [partial operator paste](../_work/gpu-owner-recovery/runs/gpu-runtime-lookup-host-1/operator-paste.txt) and [normalized observation](../_work/gpu-owner-recovery/runs/gpu-runtime-lookup-host-1/operator-observation.json) retain `OPERATOR_REPORTED_PARTIAL_LOOKUP_REQUIRED_HEADER_FIELDS_MISSING`, not an original machine capture or current shell inventory.
The source commit and exact executed handoff remain unknown: the paste does not attest inline handoff versus repository script.

| Partial operator-reported result | Boundary / missing evidence |
|---|---|
| Context show/inspect exit 0; `default`, `unix:///var/run/docker.sock` | Reported context endpoint only; exported `DOCKER_HOST`/`DOCKER_CONTEXT` lines were omitted, so the effective endpoint and physical daemon host remain unknown |
| Docker info exit 0 | Formatted values omitted; all version values and version exit omitted; Engine version, server OS, default runtime and current runtime map remain unknown |
| Shell OS: Fedora Linux 44 Workstation | Describes the shell machine, not an established daemon execution host |
| Shell PATH: `nvidia-container-runtime`, `nvidia-container-runtime-hook`, `nvidia-container-cli` each exit 127 with empty path | Does not establish installed RPMs, daemon/containerd PATH or the daemon-side cause |
| Shell PATH: `nvidia-ctk` and `runc` exit 0 at `/usr/bin`; executable candidates also reported under `/bin` | Path/executable checks only; no tool-execution, package-owner or base-only-installation proof |

No RPM inventory, package-owner result or `nvidia-cdi-hook` lookup was supplied; daemon-side root cause remains unknown.
The [record-only check](../_work/gpu-owner-recovery/runs/gpu-runtime-lookup-host-record-local-2/receipt.json) passes paste consistency and unchanged six lookup / 273 functional source hashes; it reruns no tests or host commands.
The earlier record-local-1 receipt predates the correction from an asserted CDI lookup history to the supplied result's absence; retain it as prior-generation evidence only.
At this historical generation, the next lead/operator decision concerned missing existing headers or a small read-only RPM/package-owner inventory, not a new prerequisite gauntlet; that record issued no operation or authority.
The first pull/probe allowance and the separate renewal-2 are both consumed with zero remaining; neither grants a further attempt, runc variant, install, configuration/restart/tool/driver change or training.

##### Repository handoff source and local evidence — unchanged

[gpu-runtime-lookup.fish](../_work/gpu-owner-recovery/gpu-runtime-lookup.fish) remains operator-handoff source; the partial paste does not prove execution of that exact script or supply fresh authority.
It reports only exported `DOCKER_HOST`/`DOCKER_CONTEXT` values (`set -qx`; otherwise `<unset>`), Docker version/info/current context/context endpoint with at most four 10-second client deadlines plus three-second kill-after, and shell-machine `/etc/os-release` and fixed path checks.
The five names are `nvidia-container-runtime`, `nvidia-container-runtime-hook`, `nvidia-container-cli`, `nvidia-ctk` and `runc`; the six directories are `/usr/bin`, `/usr/sbin`, `/usr/local/bin`, `/usr/local/sbin`, `/bin` and `/sbin`.
It resolves/checks paths without executing those tools or starting a container; client/context and shell-machine paths do not prove the daemon execution host or daemon/containerd PATH.
No shell access to a remote daemon host is supplied or assumed, and a context endpoint need not be the effective endpoint under environment overrides.
The current [lookup-local-3 receipt](../_work/gpu-owner-recovery/runs/gpu-runtime-lookup-local-3/receipt.json) records `PASS`, scope `FISH_SYNTAX_STATIC_TESTS_AND_TEST_TYPES_ONLY`, and `sourceChanged:false`.
Under `_work/gpu-owner-recovery/tests/`, `gpu-runtime-lookup.test.ts` and `verify-runtime-lookup.ts` use strict `tsconfig.json`; Fish `4.9.3 --no-config --no-execute`, [five static tests / 53 assertions](../_work/gpu-owner-recovery/runs/gpu-runtime-lookup-local-3/static-tests.stderr), and test/verifier typechecking all exit 0.
The verifier records six input SHA-256s and stdout/stderr with 10/30/30-second stage deadlines plus three-second kill-after; it freshly rechecks all 273 prior gpu-functional-local-3 source hashes with zero mismatches.
The original gpu-functional-local-3 inputs/evidence stay unchanged; this is no new CPU test run and requires no full CPU rerun.
Earlier [lookup-local-2 PASS](../_work/gpu-owner-recovery/runs/gpu-runtime-lookup-local-2/receipt.json) recorded 52 assertions before the exported-environment fix and regression assertion.
Preserve [lookup-local-1 FAIL](../_work/gpu-owner-recovery/runs/gpu-runtime-lookup-local-1/receipt.json): Fish syntax exit 0, four static passes/one failure because the negative regex matched `build` in the `SPEC:` filename, not a forbidden command; typechecking did not run.
The corrected test excludes the `SPEC:` line; the pointer and original packet remain intact.
Within the unchanged **LOCAL** receipt, `lookupPacketExecuted`, `dockerCommandsExecuted` and `cudaGpuCodeExecuted` remain `false`; these scoped flags do not negate the separate partial operator report.
The two first-lookup operator files lie outside its six hashed inputs and the older 273-input CPU manifest; no source/test/verifier or receipt changed, and no tests were rerun for that docs-only addition.
The lead reports adversarial `ses_e41520899ffeQKIuTNgX9L1MpP` READY yes after the LOW stale-doc fix and security `ses_e41520898ffer9yrOkXEAM23ZI` READY yes for the narrow operator proposal.
DevOps `ses_e415ccaf5ffeKtkUCGX1sfkYVh` confirms proposal-only readiness after the exported-variable correction covered by lookup-local-3.
These scoped source/proposal reviews grant no operational authority or GPU qualification; the later partial report supplies shell/context observations, not established daemon-host facts.

##### Prior DevOps read-only upstream research — not host inventory

- The lead reports prior official-source research of [NVIDIA's v1.20.1 RPM spec](https://github.com/NVIDIA/nvidia-container-toolkit/blob/v1.20.1/packaging/rpm/SPECS/nvidia-container-toolkit.spec#L159-L169): the base package supplies `nvidia-ctk`, the runtime and CDI hook; the full toolkit adds the legacy hook and a `libnvidia-container-tools` dependency, which supplies the CLI. `nvidia-ctk` alone therefore does **not** prove base-only installation: the upstream base also supplies the runtime unresolved by the first historical shell PATH lookup.
- NVIDIA publishes [Fedora DNF instructions](https://docs.nvidia.com/datacenter/cloud-native/container-toolkit/latest/install-guide.html#with-dnf-rhel-centos-fedora-amazon-linux), but its [tested-platform table](https://docs.nvidia.com/datacenter/cloud-native/container-toolkit/latest/supported-platforms.html) does not list Fedora. These sources do not qualify Fedora 44 or identify installed packages here.

**Candidate only:** a later explicit `--runtime=runc` + `--gpus` route depends on the actual Engine's NVIDIA hook registration and required executables; it is neither selected nor approved, and current evidence neither rules it in nor rules it out.
Legacy handling uses `nvidia-container-runtime-hook`; [pinned modern Moby](https://github.com/moby/moby/blob/561a5a9b36f971b4b543e1aac3efda12998a6e33/daemon/devices_nvidia_linux.go#L38-L79) also recognizes `nvidia-cdi-hook` independently, per the lead's prior DevOps research.
The first lookup supplied no `nvidia-cdi-hook` result; the later paste supplies its shell path but still no Engine version or actual Engine hook-registration proof, so neither a working route nor a universal legacy-only restriction follows.
Omitting `--runtime` does not establish runc because the default runtime is unknown.
Retained upstream references: [Moby v27.5.1 NVIDIA hook registration](https://github.com/moby/moby/blob/v27.5.1/daemon/nvidia_linux.go) and [NVIDIA's direct `--gpus` mode caveat](https://github.com/NVIDIA/nvidia-container-toolkit/blob/main/cmd/nvidia-container-runtime/README.md#notes-on-using-the-docker-cli).
These references describe candidates, not this unknown Engine/host; they grant no operation or publication by themselves.

#### Local packet syntax evidence — no packet commands executed

[The syntax-only receipt](../_work/gpu-owner-recovery/runs/gpu-container-visibility-local-1/receipt.json) records Fish `4.9.3` with `--no-config --no-execute`, `PASS`, exit 0, and scope `FISH_SYNTAX_ONLY_NO_PACKET_COMMAND_EXECUTION`.
It records four artifact SHA-256s: the Fish packet, visibility request, normalized host observations and compiler-candidate inventory.
This proves only the recorded syntax check; it executed no Docker commands and establishes no image availability, container launch, NVML visibility, compiler usability or native/GPU qualification.
The earlier visibility-handoff DevOps READY covered proposal source only; current lookup review dispositions appear above, not as host/GPU qualification.
Those checks are distinct from recipe/source-wiring acceptance; the original request retains `APPROVED_OPERATOR_EXECUTION_PENDING` unchanged as history, while both later operator attempts have consumed their separate grants. Renewal-2 reports enumeration but complete-packet FAIL, not a pending attempt or accepted visibility qualification.

<a id="coding-realm-compiler-candidate--directory-metadata-only-unselected"></a>
<a id="current-compiler-prefix-inventory"></a>

### Coding-realm LLVM metadata phase — consumed, unchanged

Executor explicitly selected `Oh yes, existing LLVM then (recommended #1)` after the scope explanation.
The [inventory request](../_work/gpu-owner-recovery/gpu-functional-llvm-prefix-inventory-request.json) records `AUTHORIZED_METADATA_PASS_CONSUMED`: one coding-environment metadata pass used, zero remaining, no automatic retry.
The [new metadata record](../_work/gpu-owner-recovery/runs/gpu-functional-llvm-prefix-inventory-1/metadata.json) and [stat transcript](../_work/gpu-owner-recovery/runs/gpu-functional-llvm-prefix-inventory-1/stat-transcript.txt) normalize actual agent stat/directory-tool returns, not operator-host observations or original raw stream files.
They cover only this exact prefix:

`/home/agent/toolchains/linux-amd64/.local/share/mise/installs/github-tracel-ai-tracel-llvm/23.1.0-4`

| Captured metadata | Meaning / limit |
|---|---|
| Prefix, `bin`, `include`, `lib` and `include/llvm` are directories | Fixed-path layout evidence only; no full-tree or installed-version proof |
| `bin/llvm-config` is a regular file, 362,392 bytes, mode `755` | Not execution, actual-version verification, ELF inspection or dependency/link-closure proof |
| `libLLVMNVPTXCodeGen.a`, `libLLVMNVPTXDesc.a`, `libLLVMNVPTXInfo.a`, `libLLVMCore.a` and `libLLVMSupport.a` are positive-size regular files | Metadata only; no library/archive bytes read or compiler usability established |
| `.tracel-llvm-installed` and `share` return `ENOENT`; layout stat phase exits 1 | Preserve the historical failure; the marker blocked the then-current recipe, not the later prepared-only mode or proof of a broken LLVM installation |
| 13 fixed stat paths; four directory listings, at most 64 entries each, relative depth at most 2; 73 names retained | `lib` stops at its first 64 names and is explicitly truncated; no full-tree inventory |
| Four stat-client invocations, each with a 10-second deadline plus three-second kill-after | Per-client bounds only; no aggregate hard deadline was enforced or claimed |

At inventory time the GPU recipe required the upstream marker, so retained `NOT_READY_FOR_CURRENT_RECIPE` status describes that earlier recipe, not today's prepared-only mode.
The current [`Dockerfile.gpu:16–18`](../tooling/runtime/Dockerfile.gpu) retains executable-config/version guards and selects `gpu-prepared-llvm` without marker admission; the later source request, not either probe, approved that explicit mode change.
No marker content was read or fabricated; the prefix remains unstaged/unselected, and neither missing historical cache metadata nor version success requires mandatory redownload or extra host installs.
The old [compiler-candidate JSON](../_work/gpu-owner-recovery/gpu-functional-compiler-candidates.json) stays byte-unchanged as historical directory-only evidence hashed by the old syntax receipt; the new records supersede that knowledge without selecting the prefix.
This metadata phase executed no LLVM, read no file contents or archive bytes, copied/downloaded nothing and traversed no symlink targets; those unchanged phase-local flags do not deny the later separately approved version execution.
The single-pass permission is consumed and grants no further metadata read, native probe, copy, acquisition, installation or configuration change.
The [record-only check](../_work/gpu-owner-recovery/runs/gpu-functional-llvm-prefix-inventory-1/record-check.json) records PASS for request/metadata/transcript consistency and unchanged 273 functional / 6 lookup / 4 syntax source hashes; it preserves layout-stat exit 1 and the truncated library listing, executes no LLVM and reruns no tests.
Adversarial `ses_e3eb7aea6ffebo6aRh5VVuBKIj` and security `ses_e3eb7ae97ffeGv1dFaz9Od9N4i` accept this metadata/docs scope, not LLVM selection, execution or GPU qualification.

<a id="current-llvm-version-and-integration"></a>

### Retained LLVM version result — version-only PASS, no build proof

Executor actually selected `Verify version Recommended` in the parent session, approving one exact non-CUDA version invocation plus source-only CubeCL integration review.
The [version request](../_work/gpu-owner-recovery/gpu-functional-llvm-version-request.json) retains `APPROVED_ONE_NON_CUDA_VERSION_PROBE_PENDING` as the original authority projection; it is not current unspent permission.
The [receipt](../_work/gpu-owner-recovery/runs/gpu-functional-llvm-version-1/receipt.json), [stdout](../_work/gpu-owner-recovery/runs/gpu-functional-llvm-version-1/command.stdout) and [empty stderr](../_work/gpu-owner-recovery/runs/gpu-functional-llvm-version-1/command.stderr) record **PASS_VERSION_ONLY; CONSUMED: one invocation, zero remaining**, with no automatic retry.

| Recorded result | Scope / limit |
|---|---|
| Exact recorded prefix `bin/llvm-config --version`; exit 0; stdout `23.1.0` plus newline (7 bytes); stderr 0 bytes | Establishes that this coding-environment native program ran and reported the expected version, not compilation, linker closure, GPU capability or host inputs |
| 10-second client deadline plus three-second kill-after | Bounds this one client invocation; establishes no physical hard-stop guarantee or renewed execution grant |
| `PATH=/usr/local/bin:/usr/bin:/bin`, `LANG=C`, `LC_ALL=C` | Recorded minimal environment, not a selected container build/runtime environment |
| `nativeNonCudaProgramExecuted:true`; `prefixModified:false`, `prefixSelected:false`, `markerCreated:false` | No compiler build, copy, download, archive-byte access, host/GPU operation or training followed; `trainingReady:false` remains unchanged |

The old candidate, metadata request/records, record-check and syntax evidence remain unchanged historical phases; their no-LLVM-execution flags describe those phases only.
The [version integrity check](../_work/gpu-owner-recovery/runs/gpu-functional-llvm-version-1/integrity-check.json) records PASS for the exact one-invocation authority, captured stdout/stderr bytes and hashes, unimplemented proposal, unchanged prior source hashes and matching diagram/index coverage; it repeats no probe, reruns no tests and proves no project graph or GPU build.
Adversarial `ses_e3ea24973ffe02t83o0wqJK0EE` and security `ses_e3ea24967ffdwKa0LTUepgBPxd` accept this records/research scope, not integration implementation or operational/GPU qualification.

#### Historical source-only CubeCL review — proposal record unchanged

The [primary review record](../_work/gpu-owner-recovery/gpu-functional-llvm-integration-review.json) cites released upstream source and Cargo `1.95.0` resolver source, not a local dependency build or verified project graph.
At that phase architect `ses_e3eea8cfeffecDxOMiTQwd2chs` and backend `ses_e3eb390a0ffevPYsyX7nd2VlAn` recommended a proposal only; the JSON retains that historical `PROPOSED_NOT_APPROVED_OR_IMPLEMENTED` status byte-unchanged.
The later implementation request and current source/evidence above supersede its approval/implementation state without rewriting the research record or claiming a verified project graph.

| Reviewed source / proposal | Finding and boundary |
|---|---|
| [CubeCL LLVM `0.11.3` build script](https://docs.rs/crate/cubecl-llvm/0.11.3/source/build.rs) and [bundler `23.1.0-4` source](https://docs.rs/crate/tracel-llvm-bundler/23.1.0-4/source/build.rs) | GPU shims use the bundler's `llvm_path()` and `link()`; its fixed XDG suffix is `tracel/tracel-llvm-23.1.0-4`, and an absent marker normally triggers installation |
| `LLVM_SYS_231_PREFIX` alone | Does not redirect this chain; the reviewed `llvm-sys` no-linking/disabled-target-initialization combination returns before config lookup; skipping checksum download does not skip archive installation |
| Public bundler `xtask = []` feature | Skips the bundler installer only; CubeCL native shim compilation and static linking remain. This source-supported use lies outside its primary xtask-tooling purpose; it is not a documented external-prefix API |
| **PROPOSED**, explicit `gpu-prepared-llvm` feature | Learning feature edges: `gpu-cuda` + `dep:tracel-llvm-bundler`; optional **host build dependency** `tracel-llvm-bundler =23.1.0-4` with `xtask`; policy-io forwards `gpu-cuda` + `chess-coach-learning/gpu-prepared-llvm` |
| **REVIEW-TIME PROPOSAL**, prepared/offline recipe mode | Supply a prepared prefix at `/opt/tracel-data/tracel/tracel-llvm-23.1.0-4`; remove marker admission only in that explicit mode and retain the version guard, CPU defaults, `gpu-cuda` and pinned versions. That proposal is now implemented in source only; no prefix is actually supplied |

[Inference] The reviewed [Cargo resolver source](https://github.com/rust-lang/cargo/blob/rust-1.95.0/src/cargo/core/resolver/features.rs#L629-L668) indicates that the optional host build dependency can activate host features without adding a learning `build.rs`; this is not verified against the project's actual selected host-feature graph.
The review records a no-op build-script alternative with additional CPU build-script overhead, not a proven requirement.
Historical local dependency-source paths were unavailable; the review read source HTTP documents and acquired no dependency crate archives.
Never substitute a fake marker, `DOCS_RS`, manually set `CARGO_FEATURE_XTASK`, or an unverified `LLVM_SYS_231_PREFIX` bypass for a genuine integration.
The version/research phase changed no recipe, manifest, prefix or selection; the separately authorized prepared source implementation followed, but still establishes no native/GPU build qualification.

<a id="current-prepared-input-route-choice--planning-only"></a>
<a id="current-prepared-input-decision"></a>

### Current prepared-input route — tools/cache and feature trees PASS; inputs unselected

The lead reports architect `ses_e3eea8cfeffecDxOMiTQwd2chs` accepts read-only input planning from the reported CSV without a new metadata gauntlet; complete-packet FAIL and future actual functional telemetry/GPU validation remain explicit.
Both the metadata pass and separately approved version invocation are **CONSUMED**, not pending or renewable by this document.
Executor selected `Reuse LLVM Recommended`; the source/static/offline-graph scope is accepted, not a pending bridge-choice question.
The implementation request accepts the public-feature primary-purpose exception, but grants no compilation, prefix copy/selection, acquisition, marker creation, image/host/GPU operation or training.
Executor's later Rust-toolchain grant is **CONSUMED**, one install / zero remaining; it does not cover project dependency restoration/acquisition or another verifier/helper invocation, and selects no LLVM or image input.

| Current state | Boundary |
|---|---|
| Prepared bridge source | Implemented under the separate request; unchanged 277-source manifest, six static stages PASS and scoped source acceptance retained; local-6 now proves separate-mode feature trees, not compiled host/native/GPU qualification |
| Scoped Rust tool recovery | Completed install PASS at exit 0, repo Cargo/rustc available; overall helper status remains `TOOLCHAIN_INSTALLED_OFFLINE_GRAPHS_NOT_VERIFIED`, consumed grant, no reinstall |
| Locked registry-cache grant | Completed `CACHE_AND_FEATURE_TREES_PASS_NO_COMPILATION`, fetch/offline-verifier exit 0; **CONSUMED one fetch / zero remaining**, 282 bound sources unchanged, no additional downloads |
| Latest completed offline project graph | Local-6 `PASS_STATIC_AND_FEATURE_TREE_ONLY` / `PASS_FEATURE_TREE_ONLY`: three separate actual offline trees exit 0 with all predicates matched, unchanged 277-source manifest; local-5 FAIL stays historical |
| Operational qualification | Rust provisioning does not select LLVM/builder/runtime/CUDARC inputs or a Rust image; no compilation, prefix staging, image/host/GPU work or training; no broader operation grant follows |

Prepared LLVM and builder/runtime inputs remain unselected, the prefix uncopied/unstaged and libdevice missing/unselected; all three selections and `CUDARC_CUDA_VERSION` remain `null`. The GPU image is unbuilt; the pinned Rust image was absent at the last received inspection, with no approved acquisition/pull.
Input planning changes no F64/4,670-coordinate/tolerance/C12 or CPU Flex/master `101..105` contract, cooperative selector/eligibility, ceilings or host coexistence requirement.
The visibility packet remains FAIL at exit 6 despite positive enumeration, and actual literal-UUID telemetry qualification remains pending; no old Bun/archive pipeline is revived.
Defer signature/provenance assurance with ALL security/privacy hardening and isolation until LAST, after completed planned training and validated results; add no new assurance gauntlet before this functional integration decision.
The selected tool/cache task is complete with positive actual feature-tree evidence; remaining functional work concerns prepared input selection/staging and actual compiled API/ABI binding, not missing Cargo or this prior cache-resolution failure.
Any further acquisition/cache operation, compilation, staging/selection, native LLVM, image or host/GPU work requires separate explicit scope; no automatic proposal or operation is approved here, and all old retry advice/grants remain spent. `trainingReady:false` remains unchanged.

Status: `SOURCE_RECONSTRUCTED` / `VERIFIED_TEST_SUBSETS` / `PREPARED_SOURCE_REVIEWS_ACCEPTED_SCOPED` / `PREPARED_STATIC_PASS` / `RUST_TOOLCHAIN_PROVISIONED` / `LOCKED_CACHE_AND_FEATURE_TREES_PASS_NO_COMPILATION` / `INSTALL_AND_FETCH_AUTHORITY_CONSUMED` / `AWAITING_PREPARED_INPUT_SELECTION` / GPU LEARNING REQUIRED / SHARED-GPU HOST DOCKER DESIGN SELECTED / BACKEND AND TARGET UNQUALIFIED / `trainingReady:false`.

## CURRENT restored GPU goals

[recovery.md](recovery.md) records accepted retained scope, missing bytes, consumed grants, and historical-only test/review reports.
[gpu-owner.md](gpu-owner.md) and [gpu-cooperative-policy.md](gpu-cooperative-policy.md) record the connected disabled-owner/job and cooperative-policy source contracts.
Corrected owner/job/policy source is connected; 72 owner cases including 15 lifecycle and 19 observation cases pass, with locked/offline Clippy and direct rustfmt checks.
Persisted Rust C1 security, authenticated TypeScript packet-5 security, scoped integer-contract, and final adversarial verdicts accept reviewed source only; authenticated reference guards retain 25/194, and no source slice establishes GPU or operational readiness.
The parent reports nine reconstructed CUDA leaf files and six ignored actual-GPU fixtures, without fresh compilation; app initialization remains unchanged.
Restore optional CUDA score/channel selection in F64 without CPU fallback; keep default CPU Flex and master-101..105 initialization unchanged.
Retain all 4,670 finite differences, `eps=1e-6`, `atol=1e-8`, `rtol=1e-5`, and exact C12 digests.
The historical `cubek-fft 0.3.1` and four lock-list approval is reconstructed history, not permission for new network or dependency acquisition.
Libdevice archive bytes are currently missing and its acquisition grant is consumed.
Do not assume earlier extracted bytes or LLVM/GNU caches remain available.
The cooperative policy rejects expired old leases before accepting replacement telemetry and cannot reserve VRAM or guarantee uninterrupted host use.
Legacy NVIDIA runtime/device-request injection is only a candidate with independently required inventory; inspect cannot certify hidden OCI/loader closure.
Actual UUID, thresholds, controls/paths, state/evidence locations, provider, image, proc permissions, provider caching, and Gate0 acceptance remain unset.
Both ordinary new mains remain disabled; all host/GPU/image/capture/build/production/acquisition/training/publication operations remain denied without fresh exact grants.
Historical input restoration recorded `TOOLCHAIN_OWNER_DEFAULT_CPU_RESTORED` / `LOCKED_INPUTS_RESTORED_AND_FRESHLY_VERIFIED`: Rust `1.95.0` minimal/rustfmt/Clippy, restored Zig `0.15.2` CPU linker, and selected locked owner/default-CPU inputs under scoped minimal-config mise trust; root mise remains untrusted/unchanged.
That earlier restoration status is not current build/GPU readiness: local-4 absence and local-5 cache failure are historical, while the separate install/cache grants now completed and local-6 passed three actual offline feature trees; no compiled host coupling, build or fresh CPU regression follows.
Zig restoration changes no CUDA compiler route and supplies no CUDA/LLVM/NVIDIA/SDK/image/host/GPU grant.
Retained [bounded receipts](verification.md#preferred-corrected-source-receipts) also record 39 CPU tests / all 4,670 finite differences, policy 352/1,262, bridge 27/388, authenticated reference guards 25/194, runner/audit 12/72, and passing snapshot typechecks with `sourceChanged:false`.
The guard compares the exact original-tree/stage-0 index set without worktree/cached diffs or source clean/textconv execution; prior 13/88 evidence remains `PRE_FILTER_EXECUTION_FIX`.
The [implemented repair](reference/object-graph-authentication.puml) authenticates raw commit/tree ancestry and refuses missing objects without lazy acquisition; 25/194 and affected test types pass with current scoped source acceptance, while prior 16/108 remains `PRE_OBJECT_GRAPH_AUTHENTICATION`.
The Rust shared-policy case passes all 33 reconstructed traces; 61 contradiction mutations remain inside one wire case, not extra top-level tests or historical-byte recovery.
The earlier TypeScript security verdict is historical before physical-reference pinning and integer regressions; it closes no current review gate.
The corrected workspace/lock/frozen-file audit now includes required actual `policy-initialize.rs`; earlier 38-case passes remain `PRE_SECURITY_AND_INTEGER_CORRECTION`, and the 70-case checkpoint remains `PRE_LINK_COUNT_GUARD`.
Held-leaf `nlink()==0` under stable ancestors proves namespace unlinking, not inode destruction; actual cgroupfs link-count semantics and non-atomic state/Docker bind behavior remain unqualified.
Actual storage, GPU/driver coexistence, CUDA inputs, Gate0/F9/R4, and full legacy Bun/C14/native proof remain open; no operational grant follows from source passes.
All twelve selected `closure-*-1` reruns pass with `sourceChanged:false`, and `closure-verification-integrity-2` validates complete closing manifests/raw streams, all 198 packet-5 inputs, and the accepted 27-input Rust/root-Cargo scope while preserving the first historical whole-packet mismatch FAIL.
The current frozen-boundary audit and final three-diagram render `source-accepted-diagrams-2` pass; `closure.json` separately indexes staged namespace/scoped-whitespace evidence.
The production Dockerfile stays CPU-only; actual GPU F64/C12, storage fsync and driver/proc/cgroupfs/coexistence qualification remain absent, with no renewal of consumed CUDA/LLVM/NVIDIA/libdevice acquisition authority.
The earlier investigation and verification language below is historical context, not a fresh recovered implementation claim.

Executor requires the admitted execution target to access the GPU and reports 8 GB VRAM.
Executor selected `Host uses the GPU` and `GPU learning (Recommended)`.
This changes the readiness acceptance condition, not host-operation authority.
Executor then selected `Host Docker GPU job (Recommended)`.
Host mise remains the entrypoint and the coding agent remains in sbx.
The selected training target is a supported shared-GPU host Docker container, replacing the earlier dedicated-training-sbx design.
Keep the active GPU attached to its host driver.
Executor also selected host-backed private state; no actual filesystem, GPU identity, Docker endpoint or runtime installation has been selected or qualified.
Executor subsequently supplied NVIDIA identity, driver and 8,192 MiB total-memory observations in the operator-reported admission packet; see [host-entrypoint.md](host-entrypoint.md#received-observations-and-provenance-boundary).
These reported observations do not independently select or qualify the device, runtime or measured availability.
Do not infer device availability or display ownership from capacity, vendor or the additional Intel `i915` device.
Do not detach a host/display GPU, enable experimental settings, load modules, bind PCI devices, install drivers or build a driver bundle without a separate exact approved plan.

## Official findings

- https://docs.docker.com/ai/sandboxes/configuration/gpu-passthrough/
- https://docs.docker.com/ai/sandboxes/configuration/environment-files/
- https://docs.rs/crate/burn/0.22.0/source/
- https://docs.rs/crate/burn-cuda/0.22.1/source/
- https://docs.docker.com/engine/containers/resource_constraints/
- https://docs.nvidia.com/datacenter/cloud-native/container-toolkit/latest/docker-specialized.html
- https://docs.nvidia.com/deploy/nvidia-smi/index.html

Docker documents experimental local GPU passthrough through VFIO on x86_64 Linux with NVIDIA hardware.
Its supported setup requires an unused/headless or additional GPU, IOMMU and kernel modules, feature flags, and a driver/module bundle matching the sbx guest kernel.
The `--gpu` option remains hidden until the experimental and GPU feature flags are enabled.
GPU assignment takes effect at sandbox creation, not when reattaching to an existing sandbox.
The documented VFIO path assigns the device to the VM instead of the host driver.
It is not a shared-GPU substitute for a device the host actively uses.
The installed ordinary create help did not expose `--gpu`.
Do not silently enable settings to change that result.

Burn documents CUDA through its standard `cuda` feature and runtime `Device` selection.
The CUDA backend describes a CUDA 12.x runtime dependency.
The fetched 0.22.0 rustdoc pages report documentation build failures; use exact released source for API/feature checks rather than importing a newer release's working API as proof.
No backend declaration or device enumeration proves actual F64 support, model/update correctness or VRAM fit on this host.
The retained manifests and executable entrypoints select CPU Flex as the CPU reference foundation; fresh verification is pending.
The current lockfile records Burn facade 0.22.0, `burn-cuda` 0.22.1 and CubeCL 0.11.3; optional lockfile membership does not mean a CUDA build was selected.
[Unverified] The backend investigation reports an unsupported-F64 test in `burn-cuda` 0.22.1 and F64 registration in CubeCL 0.11.3.
End-to-end feasibility remains unresolved; neither finding alone proves absolute impossibility or working Burn model/gradient/record support on this target.
Do not change dependencies, select deprecated LibTorch, reduce precision or waive numerical checks on the strength of this investigation.
NVIDIA documents Docker GPU selection by UUID/index and runtime-managed driver capability injection.
Its `compute` and `utility` capabilities support CUDA and NVML without requesting display/graphics capabilities.
The operator-reported NVIDIA device makes this a candidate, not a selected runtime; the required supported runtime must still be identified or separately approved for installation.
Do not use the documentation's `--gpus all`, `--privileged`, `--rm`, or unpinned image examples as approved job commands.
The future exact packet must account for GPU device access, driver-library injection, selected device identity and supported VRAM policy without weakening C2/C8/C13.

## Runtime alternatives (shared-GPU host container selected)

| Proposal | Consequence | Separate evidence / authority |
|---|---|---|
| Shared-GPU host container (selected) | Keep host mise as entrypoint and the coding agent in sbx; run the isolated learning job through a supported host GPU container runtime instead of VFIO | Executor amended the design only; select vendor/backend/driver/image/device mapping; retain C2/C8/C13/C15 and host-backed state; obtain exact host grants |
| Separate GPU for training sbx | Keep dedicated sbx execution using a genuinely unused supported NVIDIA card | Confirm hardware availability, exact sbx/guest-kernel/driver bundle and controlled VFIO setup under fresh grants; never rebind the in-use card |
| Keep GPU gate blocked | Keep the current execution design without unsafe detachment or CPU fallback | Continue source/metadata work; readiness remains false until a safe GPU target or execution amendment is supplied |

## Required GPU evidence

1. Independently select the real GPU identity, vendor/backend, driver and complete supported runtime/library closure.
2. Expose the selected GPU inside the actual admitted learning job, not just on the host or in an unrelated probe container.
3. Prove real F64 allocation/forward/scoring/backward/SGD, declared numerical checks, record reload and C12 redundant learner agreement with bounded synthetic fixtures.
4. Preserve the model, objective, initialization/master seeds, baselines, sampling, tolerances and checkpoint semantics.
5. Measure/enforce the selected supported VRAM/memory policy and coexistence with host use; do not treat a sampled free-VRAM reading as a planning limit or guaranteed reservation.
6. Preserve the 24,000,000,000-byte host RAM ceiling, 12-thread ceiling, C2 job envelope, original clocks, fixed permits and final three-second cleanup.
7. Qualify owned process/device-context cleanup and retained failure evidence without GPU resets or operational retry.

Do not silently use F32/TF32, CPU training, a remote GPU service, privileged host execution or a different model to close the gate.
If strict F64 or another retained obligation cannot be met on the selected supported GPU path, keep readiness false and present the actual decision boundary.
Actual game-data collection and training remain unauthorized.

## Received admission metadata and next source slice

`host:admission-facts` records the selected Docker client version, Linux self CPU/RAM/kernel/membership metadata, an existing private-state parent filesystem and read-only GPU identity metadata.
The optional NVIDIA query selects only index, UUID, name, total memory, driver version and PCI bus ID.
It never uses the unqualified `nvidia-smi` summary, compute-process/accounting queries, resets, setters, clock controls, GPU kernels or model work.
Tool absence is not proof of absent hardware.
The packet explicitly reports GPU learning required, GPU qualification absent and `trainingReady:false`.
The operator report has arrived; actual backend/runtime selection and GPU qualification remain open under later separate grants.
Executor selected `Commit + push (Recommended)` for the 19-file admission/GPU source/spec/test phase and the exact one-shot operator-run metadata command in [host-entrypoint.md](host-entrypoint.md).
Its retained provenance leaves the executed source commit, exact invocation and execution timestamp unknown; see [verification.md](verification.md#operator-reported-admission-evidence).
This approval grants no host execution to the coding agent and no installation, daemon query, container, storage creation, GPU change, qualification or training.
The Python CLI proposal failed review and was removed; the [Rust fixed Unix HTTP API v2 collector](host-runtime-inventory-request.md) has accepted Rust/handoff-source reviews, a verified local static asset and passing musl/task/configuration tests, while actual-host staging/execution approvals remain pending.
The metadata-helper musl/LLVM tooling change selects no CUDA/model dependency or feature and supplies no GPU build, host execution or F64 qualification.
No registered operator packet or host/publication grant follows, and the old Python fixture counts prove no Rust or GPU readiness.
