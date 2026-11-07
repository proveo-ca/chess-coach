# Host-executed mise → supported sbx

Status: EXECUTOR-SELECTED ARCHITECTURE / PREFLIGHT SOURCE VERIFIED SEPARATELY / HOST INTERFACE STILL MISSING.

Executor selected `Run host preflight (Recommended)` at the host-interface handoff.
The selected route is operator execution on the actual host and return of its bounded stdout/stderr report.
Executor explicitly directed delegation of host commands to Executor, who runs them and reports outputs.
The agent prepares exact scoped host commands but executes only authorized sbx development work in this session.
No host report or host execution integration has arrived in this session.
Do not execute the task in the coding sbx and present it as completion of that selection.
No host preflight grant has been consumed here.

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
It executes exactly `mise --version` and `sbx --help` using the selected resolved executable paths.
It reads at most 128 MiB per selected executable for standard SHA-256/length/path metadata.
Each command has a 10-second deadline, a combined 65,536-byte stdout/stderr ceiling and at most two seconds to kill/reap its owned group on failure.
It supplies no stdin, credentials, real home directory or tool-specific configuration.
The Python entrypoint disables environment-based Python configuration, user-site imports and bytecode-cache writes.
It prints one JSON report to stdout and retains bounded error prefixes in that report.
The task does not create report directories or overwrite prior evidence.
The operator retains stdout and stderr outside the reference tree under a fresh exclusive evidence name.
Do not run it from the coding sbx and promote the result to host evidence.
`--confirm-host` records an operator assertion, not a discovered or qualified host identity.
`PASS_METADATA_ONLY` never means provisioned, admitted, qualified or training-ready.
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
Disable task auto-install as well as general auto-install.
Use ordinary task ordering only after the operational interface and grants exist.
