# Host-executed mise → supported sbx

Status: OPERATOR-REPORTED ROOT HELP RECEIVED / SUBCOMMAND CONTRACT PENDING / NO PROVISIONING OR TRAINING GRANT.

Executor selected `Run host preflight (Recommended)` at the host-interface handoff.
The selected route is operator execution on the actual host and return of its bounded stdout/stderr report.
Executor explicitly directed delegation of host commands to Executor, who runs them and reports outputs.
The agent prepares exact scoped host commands but executes only authorized sbx development work in this session.
Executor returned the failed host reports described below.
Executor returned the successful v2 metadata/root-help report described below.
The installed subcommand contract and actual resource/storage admission remain pending.
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
The host entrypoint calls supported `sbx` operations for a dedicated admitted training sandbox.
The active coding sbx is not that host or training sandbox.
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

### Next metadata task: fixed subcommand help

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
No host subcommand report has arrived yet.

## Unimplemented operational tasks

Keep host seeding/provisioning/training operations unwired until the installed create/exec/lifecycle contract, supported storage controls and actual target are supplied and the applicable operation is separately approved.
Do not invent `sbx` disk, mount, resource, image, lifecycle or execution flags.
Do not add an arbitrary shell/argv escape hatch that bypasses the fixed supported runtime contract.
After interface selection, freeze exact host targets, disk units/usable capacity, private-state mapping, control-plane ownership and lifecycle.
Then request only the separately scoped operations needed for the next open gate.
Do not make training a dependency or post-task of preflight/provisioning.
Do not use caching, task skipping or a prior success receipt to waive live qualification.

C16/C17 retain their original sbx-local observations and consumed grants.
They do not select the actual host's CPU IDs, memory, cgroup parent, device identity or `sbx` interface.
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
