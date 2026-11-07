# Mandatory GPU learning readiness

Status: GPU LEARNING REQUIRED / SHARED-GPU HOST DOCKER DESIGN SELECTED / BACKEND AND TARGET UNQUALIFIED / `trainingReady:false`.

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
The current manifests and executable entrypoints select CPU Flex and remain the verified CPU reference foundation.
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
