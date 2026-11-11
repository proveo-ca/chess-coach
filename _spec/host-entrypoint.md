# Host-executed mise → shared-GPU host Docker

Status: OPERATOR METADATA RECEIVED / RUST SOURCE AND LOCAL STATIC PREPARATION VERIFIED / PREBUILT TASK IMPLEMENTED AND SOURCE REVIEWS ACCEPTED / NO APPROVED RUNNABLE HOST HANDOFF OR NEW HOST, PUBLICATION, PROVISIONING OR TRAINING GRANT.

Executor selected `Run host preflight (Recommended)` at the host-interface handoff.
The selected route is operator execution on the actual host and return of its bounded stdout/stderr report.
Executor explicitly directed delegation of host commands to Executor, who runs them and reports outputs.
The agent prepares exact scoped host commands but executes only authorized sbx development work in this session.
Executor returned the failed host reports described below.
Executor returned the successful v2 metadata/root-help report described below.
Executor returned the installed six-subcommand help report and the admission metadata report; actual resource/storage/GPU admission remains pending.
Do not execute the task in the coding sbx and present it as completion of that selection.
The agent has not run the actual host preflight.

## Operator-reported failures and selected correction

Executor reported host mise `2026.5.16` rejecting task-level `output` in commit `b7efca20018b77af8829a9d0a8420874dfd8de38`.
That parse failure occurred before Python or a fixed tool query ran.
Executor then independently updated host mise to `2026.11.3`.
The next operator-run attempt returned `BLOCKED` with `Host preflight: EXECUTABLE_BOUND_OR_KIND` for mise.
That v1 report supplies no observed file type or size.
Do not infer which half of the combined check failed.
No sbx query followed that failure.
Preserve both failed attempts rather than treating the mise update or a later successful metadata query as erasing them.

Executor selected `Metadata plus bounded hash` and `Commit and push` for the correction.
Version 2 reports resolved target metadata before opening executable contents.
It hashes regular files of at most 128 MiB using an unbuffered bounded streaming reader.
It reports `sha256:null`, `bytesRead:0` and `hashStatus:SKIPPED_SIZE_BOUND` for larger regular files, then continues the fixed help/version discovery.
It rejects non-regular targets before opening them, with their observed mode/type/size retained.
It retains metadata on read failure and refuses a completed hash when size/mtime changes during the bounded read.
It executes each selected command path rather than substituting its resolved target path, preserving basename-dispatched symlink behavior.
It disables mise automatic installation in the query environment as well as the outer task invocation.
This decision changes discovery metadata only, not final artifact registration, provisioning authority or training readiness.
Any corrected actual-host invocation is a fresh operator action, never an automatic retry or reset of the failed attempt.

Executor selected `mise` as the host entrypoint for preflight, seeding and provisioning.
The earlier host mise → dedicated training sbx design is superseded for training by Executor's explicit GPU decision.
The selected current design is host mise → supported shared-GPU host Docker learning job, with host-backed private state.
The active coding sbx remains unchanged and is not the host or training target.
This selects architecture, not provisioning, capture/build, qualification or training execution authority.
Keep the existing supported supervisor and original clock contract rather than replacing them with mise task timeouts.

## Available task

### Root preflight: completed by Executor

Run from the selected source snapshot on the actual host:

```sh
MISE_AUTO_INSTALL=false MISE_TASK_RUN_AUTO_INSTALL=false mise run host:preflight --confirm-host
```

Requires existing `mise`, `python3` and `sbx` on the host's PATH.
The task never installs missing tools.
The parser fixture uses an empty offline mise tool directory to verify that preflight does not require seeded Bun/Rust installations.
It executes exactly `mise --version` and `sbx --help` using the selected executable paths.
It reads at most 128 MiB per eligible selected executable for standard SHA-256/length/path metadata.
It reports type/size without reading contents for larger regular files.
Missing/skipped hashes cannot satisfy an independently selected final tool/artifact identity requirement.
Each command has a 10-second deadline, a combined 65,536-byte stdout/stderr ceiling and at most two seconds to kill/reap its owned group on failure.
It supplies no stdin, credentials, real home directory or tool-specific configuration.
The Python entrypoint disables environment-based Python configuration, user-site imports and bytecode-cache writes.
It prints one JSON report to stdout and retains bounded error prefixes in that report.
The task does not create report directories or overwrite prior evidence.
The operator retains stdout and stderr outside the reference tree under a fresh exclusive evidence name.
Do not run it from the coding sbx and promote the result to host evidence.
`--confirm-host` records an operator assertion, not a discovered or qualified host identity.
`PASS_METADATA_ONLY` never means fully hashed, provisioned, admitted, qualified or training-ready.
Unsupported help, missing tools, output exhaustion and deadline failure stop without an alternative command or automatic retry.

`mise run host:preflight --help` only displays the Python parser help.
Development verification may execute that parser and synthetic subprocess fixtures inside sbx.
Those checks do not invoke a real host `sbx` command.

## Received v2 host report

Executor reported `PASS_METADATA_ONLY` after the corrected parser help succeeded.
The reported mise executable is `/home/gu1lty/.local/bin/mise`, version `2026.11.3`, length 177,830,976 bytes.
The reported sbx executable is `/usr/bin/sbx`, length 163,042,432 bytes.
Both are regular files above 134,217,728 bytes and correctly report `SKIPPED_SIZE_BOUND`, zero content bytes read and no SHA-256.
The root help identifies Docker Sandboxes and lists `version`, `create`, `exec`, `stop`, `rm` and `cp` among its supported verbs.
It does not identify the installed sbx version or expose those verbs' exact options.
The two query receipts report exit zero, natural completion and reap.
Their stderr retains failed initialization attempts under the unavailable synthetic home: mise reports `failed create_dir_all` and sbx reports `mkdir /nonexistent: permission denied`.
Do not hide these warnings, grant real-home/credential access to silence them, or promote metadata success to a guarantee that arbitrary CLI help has no initialization effects.
No daemon query, provisioning, workload operation or training appears in this report's fixed query list.
These remain operator-reported observations rather than independently selected artifact identities or effective runtime qualification.

### Fixed subcommand help: completed by Executor

Executor selected `Commit and push task (Recommended)` for this new fixed help packet.
This authorizes publication and the delegated metadata handoff, not any provisioning or workload operation.

```sh
MISE_AUTO_INSTALL=false MISE_TASK_RUN_AUTO_INSTALL=false mise run host:sbx-contract --confirm-host
```

The source task executes only the selected sbx path with the six fixed argument lists `version --help`, `create --help`, `exec --help`, `stop --help`, `rm --help` and `cp --help`, in that order.
It does not execute any listed operation without `--help`.
It selects/observes the sbx executable once, preserves its selected invocation path and reuses the existing bounded query helper.
Each query keeps the 10-second / 65,536-byte combined-output bound and two-second owned cleanup limit.
The six output prefixes total at most 393,216 raw bytes before JSON encoding/metadata.
The first failure preserves all earlier receipts and stops before later help pages.
The task accepts no arbitrary operation, sandbox name, backend flag, target path or forwarded argv.
It creates no persistent report directory and invokes no `ls`, `diagnose`, login, settings, daemon, cloud, create, exec, stop or removal operation.
Executor retains stdout/stderr and delegates no host execution to this agent.
This is a new metadata packet, not a retry or reset of the completed root preflight.
Executor returned `PASS_METADATA_ONLY` for all six queries, with the same explicitly skipped sbx hash and denied-home initialization warnings.
The received help confirms mountless creation and built-in `shell`, explicit `--cpus`, binary-unit `--memory`, `--pull`, `--skills`, host workspace arguments and structured version output.
It also confirms that CPU zero selects all host CPUs, exec auto-starts a stopped sandbox, detached exec is unsupported, stop retains state and removal deletes local sandbox state.
Cloud stop/removal completion semantics cannot prove the unchanged three-second owned cleanup obligation.
No command without `--help` ran in that packet.

## Selected state and GPU execution amendment

Executor selected `Host-backed state (Recommended)` after installed-contract discovery.
Use an independently selected private host filesystem/path and expose only the exact state source to the C13 job at `/state`.
No host target exists by virtue of this decision.
Do not create state inside the source/reference worktree or silently substitute the coding sbx's filesystems.

Executor requires actual GPU learning, reports 8 GB VRAM, and states the host uses the GPU.
Docker's documented VFIO path needs an unused NVIDIA device and is not the selected approach.
Executor selected the shared-GPU host Docker job instead, preserving host driver attachment and this coding sbx.
No GPU vendor, backend, driver installation, actual Docker endpoint, resource enforcement or GPU qualification follows from that design choice.
See [gpu-readiness.md](gpu-readiness.md).

## Admission facts: operator report received

Status: OPERATOR-REPORTED `PASS_METADATA_ONLY` / SOURCE COMMIT, EXECUTED INVOCATION AND EXECUTION TIMESTAMP UNKNOWN / ADMISSION UNQUALIFIED.
The earlier publication/host-help approvals did not authorize this hardware/filesystem/GPU packet.
Executor subsequently selected `Commit + push (Recommended)` for this 19-file admission/GPU source/spec/test phase and the exact one-shot metadata packet below.
That scoped approval permitted publication of the admission/GPU phase to `feat-ml-adjuntant-ii` over HTTPS and operator execution of its exact metadata command.
It does not delegate host execution to the coding agent or approve a different parent/path invocation, installation, daemon query, container, allocation, GPU change, qualification or training.
The approved one-shot handoff command was:

```sh
MISE_AUTO_INSTALL=false MISE_TASK_RUN_AUTO_INSTALL=false mise run host:admission-facts --confirm-host
```

The source task performs no create, exec, daemon query, image, allocation, mount, formatting or training operation.
It collects hardware/filesystem facts before Docker client discovery so missing Docker cannot erase those facts.
It then queries only the selected Docker CLI's `--version`, which is the local client-version command.
It reads the fixed Linux self/CPU/memory/mount metadata and selected filesystem metadata below.
If `nvidia-smi` exists, it queries only fixed non-process identity/capacity/driver fields through the same 10-second / 65,536-byte bounded helper.
It neither installs missing GPU tools nor interprets their absence as no GPU.
It reads no arbitrary home contents, Docker credentials, other process data, workload lists, block-device contents, settings or driver configuration.
It preserves metadata/failure receipts and never retries or resets.

| Surface | Exact observation / bound |
|---|---|
| Caller | UID/GID/effective IDs, self scheduler affinity (at most 8,192 IDs), kernel release and machine architecture |
| `/proc/meminfo` | At most 64 KiB plus one oversize-detection byte; retain only total/available RAM and total/free swap, converted from reported kB |
| CPU `online`, `present`; `/proc/self/cgroup` | Fixed files under `/sys/devices/system/cpu/` and `/proc`; at most 64 KiB plus one oversize-detection byte each |
| `/proc/self/mountinfo` | At most 256 KiB plus one detection byte; retain only selected-filesystem mountpoint, major/minor, type and mount options, not sources or superoptions |
| Filesystem targets | `lstat`/resolved-directory checks and `statvfs` for this source snapshot root and the selected existing state parent; no directory-content listing or creation |
| State parent selection | Explicit `--state-parent /EXISTING/ABSOLUTE/PARENT`, otherwise `XDG_STATE_HOME` or `~/.local/state`; reject relative/parent-traversal paths, symlinks, missing directories and source overlap; never invent a fallback filesystem |
| DRM inventory | At most 256 `/sys/class/drm` directory entries and 16 matching `cardN` devices; only vendor/device/class/VRAM metadata files (4 KiB + detection byte each) and driver symlink basename |
| NVIDIA query | `--query-gpu=index,uuid,name,memory.total,driver_version,pci.bus_id --format=csv,noheader,nounits`; no summary or process/accounting query |

The application-root name below the state parent is a proposal, not an existing allocation, selected mount or permission to create it.
Free-byte, inode, RAM and GPU readings are time-local observations, not reserved capacity or planning ceilings.
The report keeps runtime admission and GPU qualification false.
The actual Docker daemon/socket, complete GPU runtime, captured inputs, target ownership/durability and original-clock qualification still require independent selection and exact fresh grants.
If the selected existing parent is absent or rejected, retain the blocked report and stop without creating it, substituting another path or automatically retrying.
Only an independently supplied existing absolute parent may replace the default through `--state-parent` in a separately selected exact invocation.

### Received observations and provenance boundary

Executor supplied a complete `chess-coach.host-admission-facts.v1` JSON message reporting `PASS_METADATA_ONLY`.
The preserved message is `/tmp/opencode/chess-coach-operator-host-admission-FenA0l/operator-message.json`.
See [verification.md](verification.md#operator-reported-admission-evidence) for its digest, provenance gaps and derived-summary distinction.
The execution realm remains `OPERATOR_ASSERTED_HOST_UNQUALIFIED`, not an independently qualified host identity.
Its runtime admission is false, GPU qualification is `NOT_QUALIFIED`, and provisioning authorization, training authorization and training readiness remain false.

| Reported surface | Operator-reported observation; not an approved binding |
|---|---|
| Caller and kernel | Real/effective UID/GID 1000; kernel `7.2.13-200.fc44.x86_64`; CPU IDs 0–15 |
| RAM | Total 41,706,151,936 bytes; available 24,247,398,400 bytes |
| Swap | Total 8,589,930,496 bytes; free 5,878,820,864 bytes; no waiver of the job's zero-extra-swap policy |
| NVIDIA GPU | `NVIDIA GeForce RTX 3070 Laptop GPU`; 8,192 MiB; driver `615.78.08` |
| Other DRM device | Intel `i915` is present; this does not identify display ownership or available NVIDIA capacity |
| Docker client | `/usr/bin/docker`; version `29.9.2`, build `a82e528`; reported SHA-256 `1aa503f7404a95fcec56614f5e0b7672d6f0cc29888182a1d4ab5ab72e6d14c1`; no daemon query |
| Existing state parent | An existing operator-reported parent; the application root remains only a proposal, not an allocation |
| Shared filesystem | State parent and workspace share the `/home` btrfs pool; capacity 996,914,757,632 bytes; available 236,845,432,832 bytes |
| Entry counters | Both `availableEntries` and `freeEntries` report zero; do not infer exhausted btrfs inodes or qualified entry capacity |

Keep persistent GPU/PCI identifiers, filesystem/device/inode identities and account-specific inventory paths only in the private operator report linked above.
This public-bound summary intentionally omits those identifiers; the private receipt remains unchanged.
These observations neither select the final GPU/daemon/state identities nor reserve CPU, RAM, VRAM or filesystem capacity.
Do not add the two filesystem samples: they describe one shared pool.
Keep the 24,000,000,000-byte / 12-thread aggregate ceiling and all existing Gate0/F9/R4 obligations.

## Docker runtime metadata: Rust v2 source implemented

The earlier source-only Python `host:docker-runtime-facts` proposal passed synthetic checks but failed adversarial review and is now superseded.
HIGH findings cover unregistered CLI plugin execution and help's possible daemon contact/hidden failures; MEDIUM findings cover socket/executable metadata-to-use races.
The source-only [Rust fixed Unix HTTP API v2 collector](host-runtime-inventory-request.md) now exists in `crates/host-facts`.
Its supplied 72-test pass includes socket replacement proof, the BOOTTIME timerfd backstop, pinned ordinary-mount-ID observation binding and bounded HTTP fixtures without Docker CLI/plugin/child execution.
The 72-test Rust source, format/Clippy and retained Python/Bun receipts pass, and both source-review verdicts are READY; these accept source only, not an operator packet or host operation.
Executor approved necessary coding-sandbox tooling installation through `mise install`; the lead reports Rust 1.95 installed, without any host installation or execution grant.
The lead removed only the added Python runtime profile/helpers/test/task; all three earlier Python tasks remain intact, and a fresh 74-test post-mise/handoff rerun passes.
Retain the 97/98-test Python receipts as failed-proposal history, never Rust evidence.
The verified local static-musl asset and its fixed expectations are documented in [host-runtime-inventory-request.md](host-runtime-inventory-request.md#verified-local-static-artifact--not-distribution-approval); local ELF/privacy/smoke and release-musl 72-test results do not qualify the actual host.
The architect accepted the prebuilt-task source plan, and `host:docker-runtime-facts` now exists with one literal digest-qualified run path and no implicit build/install/download/staging or confirmation.
The new closed artifact expectations and four persisted Bun handoff tests pass; the combined Bun set passes 26 tests, full TypeScript passes, and both targeted mise/metadata/test source reviews accept preparation.
The relative target-store path is proposed only; no approved actual-host deployment, HTTPS publication/transfer or exact host-invocation grant exists, so there is NO APPROVED RUNNABLE HOST HANDOFF.
Mise retains Rust 1.95.0/minimal/rustfmt/Clippy plus llvm-tools/musl target, both auto-install settings false and the original Python task bodies; the diff now also includes the prebuilt task.

Executor selected `HTTPS operator packets` as transport.
[Unverified] DevOps reports that gh identified public repository `proveo-ca/chess-coach`, zero repository runners and only the DependencyGraph workflow.
That observation creates no runner or host execution endpoint and authorizes no workflow, credential handling or publication.
Keep this session in the coding sbx; do not substitute sbx-local metadata for the operator packet.

## Unimplemented operational tasks

Keep host seeding/provisioning/training operations unwired until the actual Docker daemon/GPU runtime, supported storage/resource controls and host targets are supplied and the applicable operation is separately approved.
Retain the completed sbx help as historical metadata, not the selected learning launch interface.
Do not invent Docker/GPU runtime or sbx disk, mount, resource, image, lifecycle or execution flags.
Do not add an arbitrary shell/argv escape hatch that bypasses the fixed supported runtime contract.
After interface selection, freeze exact host targets, disk units/usable capacity, private-state mapping, control-plane ownership and lifecycle.
Then request only the separately scoped operations needed for the next open gate.
Do not make training a dependency or post-task of preflight/provisioning.
Do not use caching, task skipping or a prior success receipt to waive live qualification.

C16/C17 retain their original sbx-local observations and consumed grants.
They do not select the actual host's CPU IDs, memory, cgroup parent, GPU identity or Docker endpoint.
C19 remains authorized but unexecuted and paused after the realm correction.
Executor states that the host can provision `200gb`.
The exact units and actual admitted usable capacity remain unset.
See [storage-admission-decision.md](storage-admission-decision.md) for the enforced pipeline write bound, distinct from C15's configured ceilings.

## Official task documentation

- https://mise.jdx.dev/tasks/
- https://mise.jdx.dev/tasks/task-configuration.html
- https://mise.jdx.dev/configuration/settings.html#task.run_auto_install

Docker Sandboxes storage/lifecycle findings and their limits are in [sbx-interface-research.md](sbx-interface-research.md).

Use `raw_args` to forward Python parser arguments.
Use the older-supported `raw` task flag to avoid prefixing the JSON report.
Do not add task-level `output`; the reported host mise 2026.5.16 schema rejects it.
The persisted schema guard uses that reported field allowlist; it does not claim execution against an installed 2026.5.16 binary.
Disable task auto-install as well as general auto-install.
Use ordinary task ordering only after the operational interface and grants exist.
