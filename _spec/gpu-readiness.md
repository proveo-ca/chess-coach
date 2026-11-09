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

## CURRENT local GPU build slice — local verification passed, inputs pending

[gpu-build.puml](gpu-build.puml) documents the optional [GPU recipe](../tooling/runtime/Dockerfile.gpu), [input contract](../tooling/runtime/gpu-build-inputs.json), static recipe tests and scoped local verification evidence.
The architect-accepted opt-in recipe now exists in source; it is not a built image or host/GPU qualification.
The CPU Dockerfile and all Rust source/manifests remain unchanged in this slice.

- The recipe retains the same three pinned stages, three policy binaries and six reference bundles; only the GPU recipe selects `-p chess-coach-policy-io --features gpu-cuda`.
- `CUDARC_CUDA_VERSION` has no default and must match the contract's supported encoded list; its selected value remains `null`.
- With `XDG_DATA_HOME=/opt/tracel-data`, consume a genuinely prepared LLVM `23.1.0-4` prefix at `/opt/tracel-data/tracel/tracel-llvm-23.1.0-4`; require its existing `.tracel-llvm-installed` marker and `llvm-config --version` equal to `23.1.0`, without fabricating installation evidence.
- Prepared builder/runtime rootfs overlays precede application inputs/outputs; runtime `CUDA_PATH=/usr/local/cuda` has a nonempty `nvvm/libdevice/libdevice.10.bc` guard. Actual ELF dependencies, dynamically loaded userspace libraries and host-driver `libcuda` injection still need functional qualification; no host-driver replacement or copy is invented.
- Bound versions remain Burn `0.22.0`, `burn-cuda` `0.22.1`, CubeCL `0.11.3`, LLVM bundle `23.1.0-4` and CUDARC `0.19.10`, with the declared `cubecl-llvm-nvptx` route. Backend/F64 capability metadata is not actual kernel proof and permits no dependency/backend/precision substitution.

The input contract remains `AWAITING_PREPARED_INPUT_SELECTION`: LLVM, builder-dependency and runtime-dependency selections are `null`; `imageBuilt`, `actualHostExecuted`, `cudaGpuCodeExecuted` and `trainingReady` are all `false`.
`packages/runtime/tests/gpu-recipe.test.ts` checks source declarations; `_work/gpu-owner-recovery/gpu-functional-verify.ts` now checks recipe, source/test/tooling types, default CPU and CPU-recipe stages using existing `runBounded`, without a cancellation repair or lifecycle qualification claim.

### Current local evidence — `gpu-functional-local-3` only

The [current receipt](../_work/gpu-owner-recovery/runs/gpu-functional-local-3/receipt.json) records `PASS`, all six stages at exit 0, `sourceChanged:false`, and scope `LOCAL_RECIPE_TYPES_AND_DEFAULT_CPU_ONLY`.
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
Only local-3 supplies the current generation's local verification result; neither earlier receipt is rewritten or promoted to current evidence.
These results qualify the ordinary local source/test stage only, not image construction, selected-host GPU capability, training dispatch, full assurance or review acceptance.
The lead confirms scoped adversarial, DevOps and security source-wiring acceptance in `_work/gpu-owner-recovery/gpu-functional-source-review.json`; run 3 satisfies the security review's local-verification condition.
This acceptance supplies no image, runtime, activation or training qualification.
The next operator verification collects GPU/driver and Docker-runtime metadata before selecting explicit CUDA bindings and prepared compiler inputs; the record lists the two read-only command proposals, neither executed by the agent.
The local manifest does not capture `_spec/` documents; this documentation-only update neither changes that source generation nor calls for rerunning its commands.

The existing six ignored host GPU tests remain unrun evidence targets: two sweeps in `crates/learning/tests/finite_difference.rs` and four score/update/channel/reload tests in `crates/policy-io/tests/gpu.rs`.
Future selected-host verification must retain F64, all 4,670 coordinates at `eps=1e-6`, `atol=1e-8`, `rtol=1e-5`, actual scoring/backward/SGD/reload and exact C12 digests; CPU Flex/master `101..105` initialization and all model/objective/RNG/curriculum/checkpoint/eligibility semantics stay unchanged.

### Known functional activation gap — recipe is not training enablement

`tooling/runtime/Dockerfile.gpu:50` retains the application CMD `/app/packages/runtime/src/job.ts` through the existing init; `packages/runtime/src/job.ts:11` accepts only `native-proof`.
The actual `gpuJobMain` at `packages/runtime/src/gpu-job.ts:142` throws `SOURCE_ONLY_DISABLED`, and `crates/gpu-owner/src/main.rs:10` retains its disabled operational main.
The recipe has neither approved nor implemented activation of those normal GPU training paths.
After selected-host GPU capability is established, activation remains separately scoped functional implementation/wiring with ordinary source/test/readiness verification and separate execution/training authority.
It is not deferred security hardening, a new audit gauntlet, or an extra decision before the current prepared-input choice.

The next genuine decision selects prepared compiler/library/LLVM/libdevice inputs and the explicit CUDA version, or grants narrow fresh authority to prepare the exact cached LLVM archive/libdevice inputs.
No context-assembly helper is added by this spec pass, and no input preparation is inferred before that selection.
No image build, real-archive read/rehash/mount, capture, acquisition, download, upgrade, helper compilation, native/host/GPU operation or training is authorized here; the prior hold remains in force, no grant is renewed, and actual GPU work stays outside the coding sandbox.
Do not require reenacting the old isolated Bun/archive pipeline; its requests remain unchanged, diagnostics remain 0/3 with no accepted binding, and the full request stays halted.
Native capture, pidfd/cgroup/strict-stop work and ALL security/privacy hardening and isolation remain LAST, after **COMPLETE PLANNED TRAINING AND VALIDATE RESULTS**.

Status: `SOURCE_RECONSTRUCTED` / `VERIFIED_TEST_SUBSETS` / `SOURCE_REVIEWS_ACCEPTED_SCOPED` / GPU LEARNING REQUIRED / SHARED-GPU HOST DOCKER DESIGN SELECTED / BACKEND AND TARGET UNQUALIFIED / `trainingReady:false`.

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
Selected input restoration is `TOOLCHAIN_OWNER_DEFAULT_CPU_RESTORED` / `LOCKED_INPUTS_RESTORED_AND_FRESHLY_VERIFIED`: Rust `1.95.0` minimal/rustfmt/Clippy, restored Zig `0.15.2` CPU linker, and selected locked owner/default-CPU inputs under scoped minimal-config mise trust; root mise remains untrusted/unchanged.
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
