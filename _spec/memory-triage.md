# Memory scope and process triage

Status: PROCESS INSPECTION AUTHORIZED AND COMPLETED / NO TERMINATION PERFORMED.

Executor subsequently explicitly instructed RAM cleanup in this realm.
The bounded process inspection found no stale build/game/browser workers.
The active OpenCode ancestry and system services remained running.
Cleanup used `POSIX_FADV_DONTNEED` only on this session's owned regular build-cache files under the current `target/`, temporary Zig cache and anonymous Cargo registry.
It skipped symlinks, shared hardlinks and foreign-owned files.
It deleted no files and killed no processes.
No transient RAM quantity becomes a planning limit or source configuration.

## Field semantics

- [Docker Engine API v1.55](https://docs.docker.com/reference/api/engine/version/v1.55.yaml), `MemTotal`: total physical memory available on the daemon host, in bytes; not a current free-memory measurement.
- [Linux proc documentation](https://docs.kernel.org/filesystems/proc.html#meminfo): `MemTotal` is total usable RAM; `MemAvailable` estimates headroom for new applications without swapping.

Terminating processes can reclaim usage/headroom, not increase physical capacity or a fixed cgroup memory limit.
Executor reports a 40 GB physical host and permits at most 24 GB RAM / 12 CPU threads.
Do not assume current-realm process cleanup changes the daemon's memory scope.
Do not persist transient RAM readings as planning limits.

The selected job remains 4 CPU / 8 GiB.
The 24 GB figure is a hard upper ceiling, not a requirement to allocate or free that amount.
Keep tmpfs within the selected job memory budget.

## Proposed read-only snapshot

Use ordinary unprivileged reads in this realm only.
Bound the snapshot to 10 seconds plus 2 seconds for its owned helper cleanup.
Enumerate at most 4,096 visible PID entries.
Retain at most 64 KiB of projected evidence in a new private directory under `/tmp/opencode/`.
Report partial/unreadable/racing entries rather than escalating privilege or claiming completeness.

Allow these sources only:

| Source | Retained projection |
|---|---|
| `/proc/meminfo` | MemTotal, MemAvailable, MemFree, Buffers, Cached, SReclaimable, SwapTotal, SwapFree |
| `/proc/self/cgroup` | Current realm's cgroup membership; no parent-tree traversal |
| `/proc/self/status` | PID/PPID/UID and Cpus_allowed_list |
| Fixed `/sys/fs/cgroup/{memory.max,memory.current,memory.swap.max,memory.swap.current,cpu.max,cpuset.cpus.effective}` | Current exposed cgroup limits/usage/CPU set; absent files remain unverified |
| Visible `/proc/PID/status` and `/proc/PID/stat` | PID, PPID, UID, name, state, RSS, swap, thread count and start-time identity; top 25 RSS entries only in the report |

Do not read command arguments, environment, executable/root/cwd links, FD contents, maps, process memory, credentials, daemon logs or workload metadata.
Do not call Docker, list containers, alter cgroups, clear caches or change limits.
Perform no termination in this snapshot.

RSS rankings identify candidates for investigation.
Shared pages prevent treating summed RSS as exact reclaimable memory.
PID/name/UID alone does not prove that a process belongs to this session or is unnecessary.
Do not equate this realm's cgroup/CPU view with the Docker daemon's host without evidence.

## Any later termination

Present exact targets, current process start-time identity, role/ownership evidence, expected memory benefit and a graceful stop command for separate approval.
Exclude the active harness/agent, its ancestry, daemon/system services and user/other-session workloads unless Executor explicitly approves those exact targets.
Recheck identity immediately before any signal and stop on PID reuse or uncertain ownership.
Never run broad `pkill`, name-based cleanup, an all-process kill or cache dropping.
Preserve user work and evidence.
Do not promise 24 GB available memory before observing actual memory scope and headroom.

Source implementation can continue without this optional cleanup investigation.
Runtime admission still requires actual capacity/fit and enforcement evidence.
