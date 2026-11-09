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

<a id="current-input-inventory"></a>

#### Current input inventory — coding metadata spent; operator-only Rust packet unexecuted

Executor freshly selected `Inventory inputs Recommended`; [input-request.json](../_work/gpu-owner-recovery/qualification/input-request.json), the [current readiness section](gpu-readiness.md#current-input-inventory) and [owning diagram](gpu-qualification.puml) separate the two narrow allowances.
The [actual coding receipt](../_work/gpu-owner-recovery/runs/gpu-qualification-input-inventory-1/receipt.json) records **`PASS_METADATA_ONLY`**, `sourceChanged:false`, complete **2,684 entries = 137 directories + 2,545 files + 2 symlinks**, and **one invocation consumed / zero remaining**.
It retained 331,823 metadata bytes before the final summary, 332,260 stdout bytes including that summary and zero stderr bytes; 329,242,172 apparent regular-file bytes sum directory entries, not allocated/deduplicated storage.
The resolved root matches the existing candidate, nested symlink targets were recorded without traversal, and no prefix payload read/hash, LLVM execution/query, compile, copy, staging or automatic selection occurred.
The source uses an exclusive run/worker marker, 20,000-entry / 60-second / 10-MiB grant ceilings and unchanged 4-MiB-per-stream supervision, with 64 KiB reserved inside stdout for its final summary and no duplicate full inventory file.
The request's original authority projection stays unchanged; this coding metadata allowance is SPENT, not replay permission or completed-record review acceptance.

The separate [input-helper source-3 proof](../_work/gpu-owner-recovery/runs/gpu-input-inventory-source-3/receipt.json) records **8 mocked/static tests / 64 assertions**, strict qualification types and direct existing Fish 4.9.3 syntax, all three stages exit 0, `sourceChanged:false`; those checks executed no inventory/host/image/LLVM/build/GPU operation.
Input-helper source-1 remains FAIL at a Mise shim's trust error before Fish parsing; its [classification](../_work/gpu-owner-recovery/runs/gpu-input-inventory-source-1/classification.json) preserves syntax **NOT established**, without rewriting the misleading old counter or trusting/installing anything.
Input-helper source-2's 7/59 PASS is historical before final MEDIUM receipt-write/read/output failure handling and LOW actual-launched-syntax accounting fixes.
The lead reports adversarial `ses_e3db08ecaffe7JpgpwIKHCgyMl` READY after both fixes, security `ses_e3db08ecaffd8jrnYUsS9UQS84` READY within this grant and DevOps `ses_e3ec46b44ffe7CbnV5rwv23shT` READY source-only, not completed-metadata post-outcome or host acceptance.
The unchanged qualification source-2 snapshot below remains separate at 32/223 + four types and its prior 64-native-input scope; no app/Rust/math/production-recipe change or new CPU/GPU qualification follows.

**Operator host only, approved but UNEXECUTED:** one exact pinned Rust pull <=600s, then only on success one combined image-facts/non-CUDA-container inspection <=60s at 1 CPU / 1 GiB, and at most one saved-exact-CID cleanup <=30s.
The [Fish packet](../_work/gpu-owner-recovery/qualification/inspect-builder.fish) records compiler/tool paths and versions, libc/OS/image facts and a resolved C++ library-path query, not actual compilation/linking; missing tools or unresolved standard-library paths fail.
It requires the explicit operator-host environment, approved repo root/frozen lock and existing runs parent, preserves separate phase streams/statuses and a plaintext root receipt, and cannot turn receipt write/read/output failure into PASS; it needs no host Bun.
No original host files have been received; host-checkout script availability is unverified, and the grant authorizes neither an agent host call nor publishing, transferring or copying the handoff file.
One pull and one container remain available only within this exact operator scope; no extra approval is invented for that already selected action.
The broader host-inputs.json all-false projection remains unchanged; this separate request is the narrow Rust-pull/metadata exception, not a complete acquisition/build/GPU packet.
All other acquisitions, LLVM/CUDARC/libdevice/builder/runtime selections, transfer/resource bounds, staging, builds, actual GPU work and training remain unapproved.
Continue the bounded inventory rather than adding assurance gates; ALL hardening stays LAST after ALL planned training completes and results validate, full assurance stays OPEN and `trainingReady:false` stays unchanged.

<a id="current-qualification-source-and-flags"></a>

#### Qualification source and flags snapshot — no native/GPU or training acceptance

Executor selected `Prepare + query Recommended`; the [new owning diagram](gpu-qualification.puml) and [current readiness section](gpu-readiness.md#current-qualification-source-and-flags) document the separate qualification recipe/runner, persisted tests and [consolidated host input packet](../_work/gpu-owner-recovery/qualification/host-inputs.json).
Both production recipes, existing recipe tests and all six Rust GPU fixtures/mathematics remain unchanged.
The [current source-2 receipt](../_work/gpu-owner-recovery/runs/gpu-qualification-source-2/receipt.json) records `PASS_SOURCE_ONLY`: **32 tests / 223 assertions plus four typechecks**, five stages exit 0, `failure:null`, `sourceChanged:false`, 277 bound inputs / 64 native inputs and manifest SHA-256 `48d4c9705a02d775d6f58a3bce58346e34a8f43e58e604dcdbcd0de5dda72f3b`.
Those static checks ran zero Cargo/LLVM/native-build/image/host/GPU operations; the new LLVM-receipt case reads JSON only and repeats no query.
The [source-1 receipt](../_work/gpu-owner-recovery/runs/gpu-qualification-source-1/receipt.json) remains immutable historical pre-review-fix evidence at 28 tests / 201 assertions, not current source proof.
The HIGH approval-replay fix requires `approval.runId === CLI label` plus exclusive directory creation within retained persistent evidence; the same approval cannot select a different label, and the same existing directory cannot be reused.
This functional one-attempt scope is not hardened cross-container anti-replay or physical custody assurance.
The two MEDIUM fixes retain `STARTED`/attempt data and the command result before stream capture, classify later capture failure as `FAIL_EXECUTION` with available exit code, and turn post-check unreadable/deleted source inputs into changed-source/failure data for a terminal static failure receipt.
Both final recipe stages now restore `_work` ownership after all copies; host receipts record approval SHA, run ID and test-loop limits.
The lead reports final adversarial `ses_e3dde36f7ffe7zUOt5TLO5go8p` READY with all three findings resolved, security `ses_e3dde36f6ffeV2dAqWyTQ89u5u` READY without findings, backend `ses_e3df78573ffeXo04nE7v4wNCrB` without functional findings and DevOps `ses_e3ec46b44ffe7CbnV5rwv23shT` READY; all verdicts stay **source-only**.
DevOps's LOW budget ambiguity is resolved by `TEST_LOOP_ONLY_NOT_OVERALL_HOST_INVOCATION`: preflight and final receipt/source work fall outside the loop clock, while `overallHostInvocationMs` remains null and unapproved.
None of this qualifies actual native Cargo artifacts, compiled linking/ABI, image usability, current native CPU regression, GPU behavior or completed-record/hash-integrity acceptance.
The separate [flag-query receipt](../_work/gpu-owner-recovery/runs/gpu-qualification-llvm-flags-1/receipt.json) records `PASS_FLAGS_ONLY`: five exact non-CUDA `llvm-config --link-static` queries, 10 seconds each, first-failure STOP, **five consumed / zero remaining**, no version replay or prefix modification/copy/selection.
Reported C++17/GNU C++11 ABI 1 flags, NVPTX libraries and only `-lrt -ldl -lm` system libraries do not qualify compiled linking/ABI, relocation, C++ runtime or dynamic dependency closure.
Future GPU feasibility runs the score/round-trip and direct backward/SGD/reload pair; separately approved full qualification runs that pair, both 2,335-coordinate sweeps and the two exact C12 fixtures in fixed order.
Future CPU regression checks 16 default-feature harnesses with frozen counts totaling 39 tests; the old CPU39 receipt stays historical pre-prepared evidence, and current-generation CPU/GPU campaigns remain UNRUN.
The packet leaves every operation approval false, all LLVM/builder/runtime/CUDARC/libdevice selections unresolved and transfer/staging choices and several resource bounds incomplete; proposed pins and loop timings do not form a complete exact acquisition packet or approved runnable host packet.
Next work is consolidated functional input resolution and explicit approval, not helper hardening, per-library approval gates or a new assurance prerequisite.
Except for the exact pending operator-only Rust inventory above, every further acquisition, staging/transfer, native/image build, host/GPU campaign and training operation needs fresh explicit scope; all previous install/fetch/metadata/version/visibility grants, the five-query batch and the new coding metadata walk remain consumed.
The [prepared local-6 snapshot](gpu-build.puml) remains evidence for its recorded unchanged inputs, not for the new whole qualification generation.
Canonical init/BOTH/reference/orderly-close, integrated R4, activation/five-master scheduling and accepted functional telemetry/coexistence remain outside qualification; no test pass sets `trainingReady:true`.
ALL security/privacy/isolation hardening remains LAST, after **ALL planned training completes and results validate**; full-assurance Gate0/F9/R4 remain OPEN.
The older runtime/toolchain chronology below retains its original phase-specific evidence and exclusions; the current inventory section supersedes its global no-Rust-acquisition wording only for the exact approved, unexecuted operator exception.

#### Current runtime/toolchain replacement — renewal-2 consumed

The [latest visibility result](gpu-readiness.md#current-cached-visibility-result--renewal-2-consumed-packet-fail) reports a started container process and `/usr/bin/nvidia-smi`, correct RTX 3070 Laptop UUID/driver CSV and 8,192 MiB total / 7,742 MiB free snapshot, then `No devices were found`; query exit 6 makes the complete packet **FAIL**, while cleanup exit 0 is operator-reported only.
Rust inspect 1 reports the expected absent pin without approved pull; Bun inspect 0 reports the exact cached `linux/amd64` pin. Original host files were not received.
Renewal-2 is **CONSUMED: one invocation / one container, zero remaining**; its retained pending bytes are historical, as are the immutable original request, renewal-1, packet and old receipts. **NOT RERUN.**
The last source command's environment-scoped UUID memory-detail query is only the apparent failure step: neither the actual in-container device value nor individual command exits were captured, so attribution is unproved and the cause remains unknown. Do not diagnose a mapping, environment or driver bug.
The first OCI launcher failure remains a distinct historical failure, not a PASS rewritten from the later process startup.

Executor explicitly selected existing LLVM (recommended option 1), and its [one bounded coding-prefix metadata pass](gpu-readiness.md#current-compiler-prefix-inventory) is now **CONSUMED, zero remaining**; it is not a pending route or permission for another inspection.
The [request](../_work/gpu-owner-recovery/gpu-functional-llvm-prefix-inventory-request.json), [metadata](../_work/gpu-owner-recovery/runs/gpu-functional-llvm-prefix-inventory-1/metadata.json) and [stat transcript](../_work/gpu-owner-recovery/runs/gpu-functional-llvm-prefix-inventory-1/stat-transcript.txt) record actual coding-environment metadata-tool returns, normalized rather than original raw streams: 13 fixed stat paths and four directory listings capped at 64 entries/depth 2, with 73 names retained and `lib` truncated at 64.
Four stat-client invocations each had a 10-second deadline plus three-second kill-after; no aggregate hard deadline was enforced.
The prefix, `bin`, `include`, `lib` and `include/llvm` are directories; `bin/llvm-config` is regular, 362,392 bytes, mode `755`; NVPTX CodeGen/Desc/Info and Core/Support `.a` files are positive-size regular files. That metadata phase used no file/archive bytes, symlink targets or LLVM execution; its unchanged flags do not describe the later version phase.
The marker `.tracel-llvm-installed` and `share` returned `ENOENT`, preserving layout stat exit 1; the capture-time `NOT_READY_FOR_CURRENT_RECIPE` status referred to the older marker-requiring recipe, not the later explicit prepared-only mode.
Genuine installation, usable compiler and ELF/link closure remain unverified; no marker content was read or fabricated. The old candidate JSON, metadata records/check and syntax receipt remain immutable historical phases, not current whole-generation source evidence.
Executor then actually selected `Verify version Recommended`, approving one exact coding-prefix `llvm-config --version` with a 10-second client deadline plus three-second kill-after and source-only CubeCL integration review. The [request](../_work/gpu-owner-recovery/gpu-functional-llvm-version-request.json) retains its original pending authority projection, while the [receipt](../_work/gpu-owner-recovery/runs/gpu-functional-llvm-version-1/receipt.json), [stdout](../_work/gpu-owner-recovery/runs/gpu-functional-llvm-version-1/command.stdout) and [empty stderr](../_work/gpu-owner-recovery/runs/gpu-functional-llvm-version-1/command.stderr) record **PASS_VERSION_ONLY: `23.1.0`, exit 0; CONSUMED one invocation, zero remaining** under minimal PATH and `LANG=LC_ALL=C`. A non-CUDA native program ran, but no compilation, prefix modification/copy, marker creation, input selection, host/GPU work or training followed; the grant supplies no retry.
The [source-only review](../_work/gpu-owner-recovery/gpu-functional-llvm-integration-review.json) reports that CubeCL `0.11.3` uses bundler `llvm_path()` and `link()`, the fixed XDG suffix and absent-marker installer path; `LLVM_SYS_231_PREFIX` alone does not redirect this chain. Public bundler `xtask=[]` skips the installer only, leaving native shims/static linking; this source-supported use is not a documented external-prefix API.
The review JSON retains its historical **PROPOSED, NOT APPROVED OR IMPLEMENTED** state unchanged; Executor subsequently selected `Reuse LLVM Recommended` and separately [authorized implementation](../_work/gpu-owner-recovery/gpu-functional-prepared-llvm-implementation-request.json), accepting public `xtask` use outside its primary upstream purpose without calling it a documented external-prefix API.
Current source adds learning's optional host build dependency on exact bundler `23.1.0-4` with `xtask` and policy-io's `gpu-prepared-llvm` forwarding; `Cargo.lock` adds only learning's existing-bundler edge, with no registry/version changes reported. The prepared-only GPU recipe now selects that feature, removes marker admission only for that mode and retains executable-config/version/fixed-XDG/nonempty-libdevice guards; input contract v2 records the mode and bypass with every selection still null.
Both CPU defaults and ordinary `gpu-cuda` declarations remain unchanged; ordinary CUDA retains the upstream installer route. Native shim compilation/static linking remain required and unrun; same-invocation host-feature unification can affect shared consumers, so unchanged ordinary feature declarations are not per-package installer-isolation proof.
[Inference] Inspected Cargo `1.95.0` resolver source supports host-feature activation without a learning `build.rs`; that earlier source review did not establish the actual graph, while local-6 now supplies separate-mode feature-tree evidence, not compiled host-unit coupling. The no-op build-script alternative adds CPU overhead; historical dependency sources were unavailable in that review, and no archives were acquired in that phase. Never substitute a fake marker, `DOCS_RS` or manual `CARGO_FEATURE_XTASK`.
The [current completed graph receipt, local-6](../_work/gpu-owner-recovery/runs/gpu-prepared-llvm-local-6/receipt.json), records **`PASS_STATIC_AND_FEATURE_TREE_ONLY`** / `graphStatus:PASS_FEATURE_TREE_ONLY`: six static stages exit 0, recipe 9/97 and pure helper 5/12 total 14 cases / 109 assertions plus four typechecks, 277 unchanged inputs with manifest SHA-256 `710a658592d3f7ef89f04a654f0d30213315eb33ba8a0f927c24061db1a01fba`, and `sourcesChangedDuringRun:false`. All three separate actual `Cargo tree --locked --offline` modes passed at exit 0 with `expectedFeatureTextPresent:true`; existing runner logic and the six prepared bridge inputs remain unchanged.
Earlier prepared receipts remain unchanged history: local-1 before pin refinement, local-2 before paired binding, local-3 before pure tests, local-4's preinstallation `UNAVAILABLE_CARGO`, and [local-5 `FAIL_OR_INCOMPLETE_GRAPH`](../_work/gpu-owner-recovery/runs/gpu-prepared-llvm-local-5/receipt.json) at its first reported uncached bundler. Those are not the latest feature-tree result or fresh CPU regression proof.
The lead reports an adversarial MEDIUM missing-binding finding; future graphs now require eligible known Rust `1.95.0` Cargo and same-bin rustc, both `X_OK`, plus exact paired `RUSTC` and pinned-bin PATH prefix in a separate graph environment. Stage receipts record the actual environment passed without mutating root/static environment; pure fixtures cover binding, missing rustc, unversioned/no-Cargo rejection and immutability, not actual toolchain coupling.
At that preinstallation snapshot all five checked Cargo candidates and both paired-rustc checks were unavailable, with zero native queries, `graphEnvironment:null` and `graphs:[]`; these selected-path observations are neither global/permanent absence nor the outcome of the later authorized installation. Unversioned PATH candidates remain diagnostic only, never substitution; the earlier missing repo cache/global Mise symlink report remains historical evidence.
Executor's one scoped `Provision Rust Recommended` grant has completed: the [actual receipt](../_work/gpu-owner-recovery/runs/gpu-prepared-llvm-mise-1/receipt.json) records **`TOOLCHAIN_INSTALLED_OFFLINE_GRAPHS_NOT_VERIFIED`**, eight preflight PASS results, install exit 0 and `sourceChanged:false`; the [outcome](../_work/gpu-owner-recovery/runs/gpu-prepared-llvm-mise-1/outcome.json) records **CONSUMED one install / zero remaining**. The original request remains immutable as its authority projection, not replay permission; no Rust reinstall, helper retry or dependency acquisition follows.
The [source driver](../_work/gpu-owner-recovery/prepared-llvm-mise/provision.ts) uses only existing `prepare`/`environment` and `runBounded`, not the old main or a runner repair. It validates the existing exact two-line Mise config, fresh sole config path/tool and repo rustup/Cargo homes/host, scopes trust to repository Mise state, runs eight preflight commands at 10 seconds each, rereads the config unchanged and permits one `mise install --jobs 1 core:rust` with a 600-second client deadline; exclusive run ID, first failure STOP, no retry/fallback.
Raw [install stderr](../_work/gpu-owner-recovery/runs/gpu-prepared-llvm-mise-1/install/command.stderr) reports five components and `rustc 1.95.0 (59807616e 2026-04-14)` installed for the configured minimal + rustfmt/Clippy setup. Its HOME/euid-mismatch `error:` lines and missing-`cc` warning remain intact despite exit 0; that warning establishes no C compiler prerequisite for this graph check or permission to install one.
After install PASS, local-5 selected the exact available repo Cargo/rustc pair and ran **one** actual `Cargo tree --locked --offline` for prepared mode, target `x86_64-unknown-linux-gnu`, package policy-io; exit 101 and stdout 0 bytes report `no matching package named tracel-llvm-bundler found`, location `crates.io index`. Ordinary-CUDA/CPU graphs did not run after first failure. This is a first reported project-registry cache miss, not absent Cargo, broken LLVM, a complete missing-dependency inventory or native/link/GPU proof; neither Cargo's online-retry advice nor an installer retry was followed.
The [preinstall source receipt](../_work/gpu-owner-recovery/runs/gpu-prepared-llvm-mise-source-1/receipt.json) records `PASS_SOURCE_PREINSTALL_ONLY`, 7 mocked cases / 46 assertions plus strict helper types at exit 0, zero Mise/install/download operations in those checks and all 277 prepared-source hashes unchanged. Pre-execution adversarial `ses_e3e4db93fffe3vnYU3U3f7pPFD` accepted source/authority and security `ses_e3e4db930ffeG4ZPzaPQNdpunU` accepted only the new explicit grant, not native qualification; cached payloads remain excluded by the existing repo-cache ignore rule.
Local-6's [prepared stdout](../_work/gpu-owner-recovery/runs/gpu-prepared-llvm-local-6/graph-prepared/command.stdout) contains `cubecl-llvm v0.11.3`, `tracel-llvm-bundler v23.1.0-4` and bundler `xtask` at line 2429; [ordinary-CUDA stdout](../_work/gpu-owner-recovery/runs/gpu-prepared-llvm-local-6/graph-ordinary-cuda/command.stdout) passes the same-version/`xtask`-absent predicate, and [CPU stdout](../_work/gpu-owner-recovery/runs/gpu-prepared-llvm-local-6/graph-cpu/command.stdout) passes the bundler-absent predicate. This is positive actual resolved feature-tree evidence, not compiled host dependency sharing/coupling, static-link/ABI, NVPTX kernel, relocation, native CPU regression, image or GPU/training proof.
The [integrity receipt](../_work/gpu-owner-recovery/runs/gpu-prepared-llvm-mise-1/integrity-check.json) records **`PASS_RECORD_INTEGRITY_ONLY`**, 34 checked streams and 285 source hashes (277 prepared + eight helper inputs), preserving install PASS and graph FAIL. Recorded Mise/local-5 post-outcome adversarial/security acceptance covers these records only, not runtime/graph/build/GPU qualification or further operations; it does not apply to the new cache attempt below.
Executor selected `Fetch cache Recommended`; automatic completion has now arrived for `gpu-prepared-llvm-cache-1`. The [actual cache receipt](../_work/gpu-owner-recovery/runs/gpu-prepared-llvm-cache-1/receipt.json) records **`CACHE_AND_FEATURE_TREES_PASS_NO_COMPILATION`**, `failure:null`, `sourceChanged:false`, 282 bound sources and fetch/offline-verifier exit 0. The [outcome](../_work/gpu-owner-recovery/runs/gpu-prepared-llvm-cache-1/outcome.json) records **CONSUMED one fetch / zero remaining**; the [original request](../_work/gpu-owner-recovery/prepared-llvm-cache/request.json) remains immutable as its authority projection, not replay permission. This docs pass reads completed evidence only and executes nothing.
Frozen `Cargo.lock` remained unchanged at SHA-256 `77f674cc26a01f26558fd99c45bdcd5566017be05833fce1d39cae98cda05955`: 675 packages = four workspace + 671 checksummed registry package versions at `registry+https://github.com/rust-lang/crates.io-index`, recorded in the [registry manifest](../_work/gpu-owner-recovery/runs/gpu-prepared-llvm-cache-1/registry-manifest.json); no Git/private dependencies, upgrades or lock repair. The outcome reports 568 `Downloaded` name/version messages in [raw fetch stderr](../_work/gpu-owner-recovery/runs/gpu-prepared-llvm-cache-1/fetch/command.stderr), all within the approved manifest, **not** a claim that all 671 entries were downloaded. The limit counts package versions, not HTTP requests/bytes; metadata containing other version records does not select upgrades.
The [helper](../_work/gpu-owner-recovery/prepared-llvm-cache/fetch.ts) clones the exported environment for the fetch only, binds exact repo `RUSTC`/pinned-bin PATH/homes, and sets `CARGO_NET_OFFLINE=false`, `CARGO_NET_RETRY=0`, `CARGO_HTTP_TIMEOUT=30`, sparse protocol and `RUSTUP_AUTO_INSTALL=0`; shared/root/static environment remains unchanged. Fixed exclusive run, first failure STOP, retained partial cache and post-fetch lock/source stability checks on failure-result paths permit no retry, lock removal/repair, toolchain substitution or Mise reinstall.
The one installed repo Rust `1.95.0` `fetch --locked --target x86_64-unknown-linux-gnu` passed under its 600-second client deadline, without reinstalling tools. Its unchanged-input success invoked existing local-6 static checks and **three separate OFFLINE** trees under the 780-second wrapper deadline; pure `graphResultVerified` accepted three PASS trees, exact repo Cargo/rustc and unchanged prepared/helper inputs. This completes the approved cache/tree task, not native compilation or further execution authority.
The [cache integrity receipt](../_work/gpu-owner-recovery/runs/gpu-prepared-llvm-cache-1/integrity-check.json) records **`PASS_RECORD_STREAM_AND_SOURCE_INTEGRITY_ONLY`**: 22 streams, 282 bound fetch-source hashes and 277 prepared-source hashes checked unchanged; no repeated fetch/native query. This is records/streams/source integrity only, not compiled host-unit, native/link/ABI/kernel, image, GPU or CPU-regression qualification.
The [latest prefetch source receipt](../_work/gpu-owner-recovery/runs/gpu-prepared-llvm-cache-source-2/receipt.json) is **`PASS_SOURCE_PREFETCH_ONLY`**: [mock tests](../_work/gpu-owner-recovery/prepared-llvm-cache/fetch.test.ts) report 8 cases / 23 assertions, [strict helper types](../_work/gpu-owner-recovery/prepared-llvm-cache/tsconfig.json) exit 0, zero real fetches/downloads in those checks and all 277 prepared hashes unchanged; new helper-folder/source proof remains separate. Cache-source-1 PASS at 6/16 is historical before two MEDIUM failure-reporting fixes/regressions for unreadable bound inputs and missing verifier receipts; no runtime evidence files were edited by those fixes.
Pre-execution adversarial and security READY remain source/grant-scoped. The separate [completed-record review](../_work/gpu-owner-recovery/runs/gpu-prepared-llvm-cache-1/review.json) records post-outcome READY for cache/feature-tree records only, not native-build/GPU qualification or further operations. Normal locked `.crate` download/unpack belonged to the now-consumed fetch grant, not the halted LLVM release-archive pipeline; no per-crate body security-audit gate applies. See [the completed cache boundary](gpu-readiness.md#current-locked-cache-fetch) and [owning diagram](gpu-build.puml).
Exactly six baseline inputs changed: `Cargo.lock`, both Cargo manifests, recipe tests, GPU recipe and input contract. Prior local-3 273-input CPU/F64 evidence is **HISTORICAL PRE-PREPARED GENERATION**, not current whole-generation or CPU-behavior regression proof; earlier metadata/version integrity receipts remain correct for their recorded phases, not fresh current-source validation. No CPU numerical tests or native/e2e compilation ran; compilation is outside the grant and actual GPU tests remain host-only under separate authority.
The [scoped source-review record](../_work/gpu-owner-recovery/gpu-functional-prepared-llvm-source-review.json) records backend and monorepo static acceptance plus DevOps, adversarial and security READY for source/static scope only, not graph/build/operational qualification. Adversarial recheck resolves the MEDIUM binding finding; no new operation or input selection follows.
The lead reports architect `ses_e3eea8cfeffecDxOMiTQwd2chs` accepts read-only input planning from the CSV without another metadata/NVML gauntlet or archived Bun audit; this preserves packet FAIL and later actual functional telemetry/GPU proof.
Actual `crates/gpu-owner/src/telemetry.rs:6–11` uses literal `--id={uuid}` with UUID/driver/total/used/free CSV and strict UUID/driver decoding; the packet's apparent environment-scoped detail failure neither qualifies nor fails this different provider. Selected-path functional telemetry qualification still precedes training, not input planning; cooperative selector/eligibility remains unchanged.
The LLVM candidate remains unselected after bounded metadata and version-only execution; both grants are consumed and authorize no further metadata/native inspection, content read, copy, archive access, download or symlink-target traversal. Prepared LLVM/builder/runtime inputs and CUDA selection remain null, libdevice remains missing/unselected and the GPU image remains unbuilt. The pinned Rust image was absent at the last received inspection, with no approved acquisition/pull.
Both Rust install and locked-cache fetch grants are consumed; no further fetch/retry/download, tool install or acquisition is authorized. Remaining functional work concerns prepared input preparation/selection/staging and actual compiled API/ABI binding, not tooling availability or the historical cache miss; any such operation, compilation, native LLVM, image or host/GPU work needs separate explicit scope, with no automatically approved proposal. All prepared selections/CUDARC remain null, prefix uncopied/unstaged, libdevice missing/unselected and the pinned Rust image historically absent without acquisition authority; F64/all 4,670 coordinates/tolerances/exact C12 and CPU Flex/master `101..105` remain unchanged, with `trainingReady:false`. ALL security/privacy hardening and isolation remain LAST, after completed planned training and validated results.
The metadata record-check and later version integrity-check retain their historical PASS scopes; their then-unchanged 273-input source claims predate the six prepared-mode edits. This docs pass adds no tests/source/code or fresh verification claim and rewrites no earlier evidence.
Defer signature/provenance assurance with ALL security/privacy hardening and isolation until LAST, after completed planned training and validated results; do not revive the old Bun/archive pipeline or add an assurance gauntlet to this functional integration gap.

**HISTORICAL — NOT RERUN:** only the `Selected supported runtime/toolchain` row in the retained table below preserves the pre-attempt inventory generation. Its `PENDING`, launch-unknown and probe-permission wording is superseded by the current replacement above and supplies zero remaining authority; the other dependency rows keep their stated functional scope.

| Dependency | Current evidence | Genuine functional blocker | Required proof | Separate approval |
|---|---|---|---|---|
| Selected supported runtime/toolchain | CPU recipe and Rust source/manifests remain unchanged; optional GPU recipe [local-3 scoped PASS](gpu-readiness.md#current-local-evidence--gpu-functional-local-3-only) is not host proof; the [historical Bun attempt](gpu-readiness.md#historical-bun-only-operator-result--authority-consumed) failed before process/GPU-query start; the [current host-2 report and renewal](gpu-readiness.md#current-cached-visibility-renewal--operator-only-pending) supply all four RPMs `1.20.1-1.x86_64` / package query 0, ctk owner base RPM / exit 0, and all six tools at `/usr/bin` / exit 0; first lookup misses remain historical; see [gpu-build.puml](gpu-build.puml) | Installation history is not supplied; reported shell availability establishes neither physical daemon host, daemon PATH nor successful launch; `default`/Unix-socket context and info exit 0 omit DOCKER overrides, version fields/exit and formatted info values, leaving Engine/default runtime/effective endpoint unknown; no GPU visibility/F64 or selected CUDA/prepared-input proof | Renewal-2 permits the same unchanged cached-Bun metadata attempt with explicit `--runtime=nvidia` plus `--gpus`; fresh Engine/default-runtime facts need not block it because the default runtime is not used; actual launch remains unknown until the attempt; later selected-input build and GPU F64 execution retain phase 3 numerical/C12 requirements; no new prerequisite gauntlet or runc substitution; lead local checks for the three new records/prior-proof integrity are pending, not PASS; six lookup inputs / 273 functional source hashes remain unchanged, requiring no new CPU test | Parent explicitly offered three routes and Executor selected `One visibility probe`; [renewal-2](../_work/gpu-owner-recovery/gpu-container-visibility-renewal-2.json) is **PENDING, not executed**: operator-only, one fresh invocation / at most one container, zero pulls, unchanged exact Bun pin/UUID/packet/resource caps/deadlines/fresh-CID cleanup, no retry; first pull/probe grant stays **CONSUMED, zero remaining** and old request/renewal/receipts stay unchanged; no substitution, install, configuration/restart, build, archives, native/CUDA kernel, training, full-pipeline renewal or agent host/GPU calls; existing host-checkout Fish file needs no new Git pull/publication |
| Functional GPU training activation | `tooling/runtime/Dockerfile.gpu:49` retains `job.ts`; `packages/runtime/src/job.ts:11` permits only `native-proof`; `packages/runtime/src/gpu-job.ts:142` and `crates/gpu-owner/src/main.rs:10` retain `SOURCE_ONLY_DISABLED` normal mains | The prepared recipe still does not enable or connect operational GPU training; this known activation gap is functional work, not deferred security hardening or a new input-planning gate | After selected-host GPU capability proof, separately implement and verify approved activation/wiring through ordinary source/test/readiness checks; preserve numerical/model contracts and keep capability distinct from training enablement | Rust installation, locked fetch and three separate local-6 feature trees passed; this is not activation/build/GPU/training approval, and all install/fetch/visibility/metadata/version authority is consumed |
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
