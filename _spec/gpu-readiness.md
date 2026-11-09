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
The operator has supplied GPU/driver and Docker-runtime metadata in [the normalized host-observation record](../_work/gpu-owner-recovery/gpu-functional-host-observations.json); these are operator-reported facts, not an agent-run host verification or selected bindings.
The new lookup packet and nested tests sit outside the local-3 manifest; its 273 inputs remain unchanged and need no full rerun for this slice.

The existing six ignored host GPU tests remain unrun evidence targets: two sweeps in `crates/learning/tests/finite_difference.rs` and four score/update/channel/reload tests in `crates/policy-io/tests/gpu.rs`.
Future selected-host verification must retain F64, all 4,670 coordinates at `eps=1e-6`, `atol=1e-8`, `rtol=1e-5`, actual scoring/backward/SGD/reload and exact C12 digests; CPU Flex/master `101..105` initialization and all model/objective/RNG/curriculum/checkpoint/eligibility semantics stay unchanged.

### Known functional activation gap — recipe is not training enablement

`tooling/runtime/Dockerfile.gpu:50` retains the application CMD `/app/packages/runtime/src/job.ts` through the existing init; `packages/runtime/src/job.ts:11` accepts only `native-proof`.
The actual `gpuJobMain` at `packages/runtime/src/gpu-job.ts:142` throws `SOURCE_ONLY_DISABLED`, and `crates/gpu-owner/src/main.rs:10` retains its disabled operational main.
The recipe has neither approved nor implemented activation of those normal GPU training paths.
After selected-host GPU capability is established, activation remains separately scoped functional implementation/wiring with ordinary source/test/readiness verification and separate execution/training authority.
It is not deferred security hardening, a new audit gauntlet, or an extra decision before the current prepared-input choice.

Executor's original `Cached-image probe (Recommended)` selection led to an operator-reported cache-inspection stop: both exact pinned images were missing, so the unchanged [Fish packet](../_work/gpu-owner-recovery/gpu-container-visibility.fish) created no container and ran no GPU query.
Executor then selected `Bun only (Recommended)`; the [renewal](../_work/gpu-owner-recovery/gpu-container-visibility-renewal.json) retains its original pending status byte-unchanged, but the [latest operator result](#current-bun-only-operator-result--authority-consumed) records **CONSUMED: one pull and one container attempt; zero remaining**.
The reported Bun pull succeeded; OCI launcher lookup failed before any container process or GPU query started. No retry or new acquisition/container authority remains, and coding-agent host execution stays forbidden.
The later choice of compatible prepared compiler/library/LLVM/libdevice inputs and explicit CUDA bindings, versus narrow fresh authority to prepare the exact cached LLVM archive/libdevice inputs, remains unresolved.
No context-assembly helper is added by this spec pass, and no input preparation is inferred before that selection.
No further pull, container, image build, real-archive read/rehash/mount, capture, acquisition/download, install, configuration change, restart, upgrade, helper compilation, native/host/GPU operation, training or publication is authorized here; the prior full-pipeline hold remains in force and actual GPU work stays outside the coding sandbox.
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
The latest paste reports a container object but no started container process or `nvidia-smi`; it establishes neither GPU visibility nor Bun/CUDA numerical failure.
No host commands or operator tools ran through this agent; no Rust pull, image build, LLVM/libdevice preparation, native CUDA compilation or training is authorized.
The unchanged local-3 273-input source verification remains separate evidence; the new lookup has its own scoped verification below.

### Historical visibility packet — unchanged, authority consumed

The original [request](../_work/gpu-owner-recovery/gpu-container-visibility-request.json) and [packet](../_work/gpu-owner-recovery/gpu-container-visibility.fish) remain byte-unchanged, including the original no-pull rule and retained request status.
The limits below describe the historical probe, not a runnable handoff or remaining authority.
The original cache guard stopped before container creation; the later renewed attempt consumed its separate one-pull/one-container allowance and failed at launcher lookup.
Do not rerun either handoff; the coding agent must not invoke Docker or any host tool, even for metadata.

| Historical approved operation | Exact boundary |
|---|---|
| Cached-image inspection | Inspect the request's pinned Rust and Bun images with 10-second client deadlines each and a three-second kill-after. Bun must already exist as `linux/amd64`, or stop without pull/substitution; report missing Rust for later input selection without pulling it. |
| One conditional container | Use only the pinned cached Bun base, `nvidia` runtime, GPU UUID `GPU-713c95e0-6952-a576-794b-9ef1fb527ff0`, UID/GID `1000:1000` and `compute,utility` driver capabilities. No additional user mounts. |
| Metadata and ordinary caps | Resolve `nvidia-smi`, collect its fixed GPU CSV and UUID-scoped memory query only; use `--pull=never`, 2 CPUs, `512m` memory and 64 PIDs. These are probe limits, not production runtime or containment qualification. |
| Client deadline | The Docker query client has 30 seconds plus a three-second kill-after. This does not guarantee a physical hard stop, daemon/container termination or a hard return from native work. |
| Cleanup | A 10-second client deadline plus three-second kill-after applies only to force-removing the valid 64-hex CID recorded in this attempt's fresh CID file. Missing/invalid CID or failed cleanup remains unverified; do not target other containers. |
| Output | Use the packet's fresh `_work/gpu-owner-recovery/runs/host-visibility-XXXXXXXX` directory for query/cleanup streams, CID and reported exit statuses; no evidence directory is created by this spec pass. |

The unchanged probe packet itself grants no pull; the separate renewal is consumed and grants no repeat pull/probe, Rust pull, image build, install, additional user mount, libdevice/LLVM archive operation, native CUDA compilation, CUDA kernel, training or host configuration change.
It supplies no new isolation/containment proof and does not reopen deferred hardening work.
Driver branch 615 still establishes only the reported CUDA 13.x family-floor comparison; the exact API/PTX ceiling, CUDARC binding version and three prepared-input selections remain unestablished/unselected.
The operator packet and runtime-lookup source checks are outside the existing local-3 result; that PASS is not operator execution, GPU visibility, activation or training acceptance.
`containerGpuVisibilityEstablished` and `trainingReady` remain `false`; old diagnostic cases remain 0/3 unspent and the full pipeline remains halted.
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

### CURRENT Bun-only operator result — authority consumed

The [latest observation](../_work/gpu-owner-recovery/runs/gpu-container-visibility-host-probe-1/operator-observation.json) normalizes the retained [operator paste](../_work/gpu-owner-recovery/runs/gpu-container-visibility-host-probe-1/operator-paste.txt), not original machine files; the executed source commit remains unknown.
The original request, renewal, packet and earlier syntax receipts remain byte-unchanged; their pending statuses are historical, not current unspent authority.
The historical acquisition command remains in the renewal record for traceability, **not rerun**.

| Latest operator-reported result | Boundary |
|---|---|
| Bun pull succeeded; inspect exit 0, `linux/amd64` | Exact digest `sha256:18639686662e5cd8a963ffb967dd130034a2a2d076a52e65dfd4fe18f75cc038`; no numeric pull exit was supplied and no Bun version executed |
| Rust inspect exit 1, missing | Expected informational result; no Rust pull authorized |
| One container object created | CID `48633c91974748c087e2f49c511b91d746f7379a80af7863b788fd6b53b30a0b`; no container process started |
| OCI launcher lookup failed | `exec: "nvidia-container-runtime": executable file not found in $PATH`; query exit 127, zero started in-container GPU queries |
| Cleanup exit 0 | Operator-reported removal only; original `_work/gpu-owner-recovery/runs/host-visibility-tRp94up1` machine files were not received |
| Authority **CONSUMED** | One pull / one container attempt used; zero remaining; no retry, new pull/container, install, configuration change or restart |

The lookup failure does not distinguish missing installation, a service PATH issue or a different daemon execution host; the root cause remains undetermined.
No `nvidia-smi`, CUDA kernel or Bun application ran, so no Bun/CUDA numerical failure or GPU proof follows.
Engine version, effective daemon endpoint, default runtime, daemon/containerd PATH and NVIDIA hook mode remain unknown after the later partial lookup; `runc 1.5.2` is not the Docker Engine version.
`containerGpuVisibilityEstablished` and `trainingReady` remain `false`; CUDA and all three prepared-input selections remain `null`.
Existing gpu-functional-local-3 and visibility-local-1 syntax receipts remain unchanged and cover neither runtime-lookup source checks nor the latest partial operator lookup.
ALL security/privacy hardening and isolation remain LAST, after completed planned training and validated results.

#### Current partial runtime lookup — operator-reported only

The [partial operator paste](../_work/gpu-owner-recovery/runs/gpu-runtime-lookup-host-1/operator-paste.txt) and [normalized observation](../_work/gpu-owner-recovery/runs/gpu-runtime-lookup-host-1/operator-observation.json) now supply `OPERATOR_REPORTED_PARTIAL_LOOKUP_REQUIRED_HEADER_FIELDS_MISSING`, not an original machine capture or host qualification.
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
The next lead/operator decision is limited to the missing existing header lines or a small read-only RPM/package-owner inventory, not a new prerequisite gauntlet; this update issues no operation or authority.
The prior pull/probe allowance remains consumed with zero remaining; no retry, runc variant, install, configuration/restart/tool/driver change or training follows.

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
The two new operator files lie outside its six hashed inputs and the older 273-input CPU manifest; no source/test/verifier or receipt changed, and no tests were rerun for this docs-only addition.
The lead reports adversarial `ses_e41520899ffeQKIuTNgX9L1MpP` READY yes after the LOW stale-doc fix and security `ses_e41520898ffer9yrOkXEAM23ZI` READY yes for the narrow operator proposal.
DevOps `ses_e415ccaf5ffeKtkUCGX1sfkYVh` confirms proposal-only readiness after the exported-variable correction covered by lookup-local-3.
These scoped source/proposal reviews grant no operational authority or GPU qualification; the later partial report supplies shell/context observations, not established daemon-host facts.

##### Prior DevOps read-only upstream research — not host inventory

- The lead reports prior official-source research of [NVIDIA's v1.20.1 RPM spec](https://github.com/NVIDIA/nvidia-container-toolkit/blob/v1.20.1/packaging/rpm/SPECS/nvidia-container-toolkit.spec#L159-L169): the base package supplies `nvidia-ctk`, the runtime and CDI hook; the full toolkit adds the legacy hook and a `libnvidia-container-tools` dependency, which supplies the CLI. `nvidia-ctk` alone therefore does **not** prove base-only installation: the upstream base also supplies the runtime unresolved by this shell PATH lookup.
- NVIDIA publishes [Fedora DNF instructions](https://docs.nvidia.com/datacenter/cloud-native/container-toolkit/latest/install-guide.html#with-dnf-rhel-centos-fedora-amazon-linux), but its [tested-platform table](https://docs.nvidia.com/datacenter/cloud-native/container-toolkit/latest/supported-platforms.html) does not list Fedora. These sources do not qualify Fedora 44 or identify installed packages here.

**Candidate only:** a later explicit `--runtime=runc` + `--gpus` route depends on the actual Engine's NVIDIA hook registration and required executables; it is neither selected nor approved, and current evidence neither rules it in nor rules it out.
Legacy handling uses `nvidia-container-runtime-hook`; [pinned modern Moby](https://github.com/moby/moby/blob/561a5a9b36f971b4b543e1aac3efda12998a6e33/daemon/devices_nvidia_linux.go#L38-L79) also recognizes `nvidia-cdi-hook` independently, per the lead's prior DevOps research.
The Engine version is missing and no `nvidia-cdi-hook` result was supplied; neither a working route nor a universal legacy-only restriction follows.
Omitting `--runtime` does not establish runc because the default runtime is unknown.
Retained upstream references: [Moby v27.5.1 NVIDIA hook registration](https://github.com/moby/moby/blob/v27.5.1/daemon/nvidia_linux.go) and [NVIDIA's direct `--gpus` mode caveat](https://github.com/NVIDIA/nvidia-container-toolkit/blob/main/cmd/nvidia-container-runtime/README.md#notes-on-using-the-docker-cli).
These references describe candidates, not this unknown Engine/host; no new operation or publication is approved.

#### Local packet syntax evidence — no packet commands executed

[The syntax-only receipt](../_work/gpu-owner-recovery/runs/gpu-container-visibility-local-1/receipt.json) records Fish `4.9.3` with `--no-config --no-execute`, `PASS`, exit 0, and scope `FISH_SYNTAX_ONLY_NO_PACKET_COMMAND_EXECUTION`.
It records four artifact SHA-256s: the Fish packet, visibility request, normalized host observations and compiler-candidate inventory.
This proves only the recorded syntax check; it executed no Docker commands and establishes no image availability, container launch, NVML visibility, compiler usability or native/GPU qualification.
The earlier visibility-handoff DevOps READY covered proposal source only; current lookup review dispositions appear above, not as host/GPU qualification.
Those checks are distinct from recipe/source-wiring acceptance; the original request retains `APPROVED_OPERATOR_EXECUTION_PENDING` unchanged, but the later operator result records consumed acquisition/probe authority and no established visibility.

### Coding-realm compiler candidate — directory metadata only, unselected

[The compiler-candidate record](../_work/gpu-owner-recovery/gpu-functional-compiler-candidates.json) reports only an existing coding-realm Mise version directory named `23.1.0-4`:

`/home/agent/toolchains/linux-amd64/.local/share/mise/installs/github-tracel-ai-tracel-llvm/23.1.0-4`

The directory name is not verification of a genuine installed LLVM prefix, usable compiler, compatible dependency set or operator-host input.
The record marks installation verification, `llvm-config` execution, copying and selection false; its scope is directory metadata only, not LLVM-file inspection, archive access, new acquisition or native CUDA compilation.
This is a candidate for a later explicitly approved functional source inventory that might avoid new acquisition, not permission to read/copy/execute its LLVM files now or a new security-hardening gate.
The CUDA version and all three prepared-input selections remain `null`; selected-host F64 coordinates remain zero, and the reported driver 615 versus family minimum 580 still supplies no exact API/PTX or kernel proof.
No host inputs, runtime readiness, activation or training enablement follow from the candidate or the syntax receipt.

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
