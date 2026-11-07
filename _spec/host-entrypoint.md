# Host-executed mise → supported sbx

Status: EXECUTOR-SELECTED ARCHITECTURE / PREFLIGHT SOURCE VERIFIED SEPARATELY / HOST INTERFACE STILL MISSING.

Executor selected `Run host preflight (Recommended)` at the host-interface handoff.
The selected route is operator execution on the actual host and return of its bounded stdout/stderr report.
Executor explicitly directed delegation of host commands to Executor, who runs them and reports outputs.
The agent prepares exact scoped host commands but executes only authorized sbx development work in this session.
Executor returned the failed host reports described below.
No successful host sbx help/identity report or host execution integration has arrived in this session.
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

## Unimplemented operational tasks

Keep host seeding/provisioning/training operations unwired until the real host CLI/help or official interface documentation is supplied.
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

Use `raw_args` to forward Python parser arguments.
Use the older-supported `raw` task flag to avoid prefixing the JSON report.
Do not add task-level `output`; the reported host mise 2026.5.16 schema rejects it.
The persisted schema guard uses that reported field allowlist; it does not claim execution against an installed 2026.5.16 binary.
Disable task auto-install as well as general auto-install.
Use ordinary task ordering only after the operational interface and grants exist.
