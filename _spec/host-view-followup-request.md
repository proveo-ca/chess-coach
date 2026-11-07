# C17 proposal: resolve the observed self-cgroup and filesystem view

Status: C17 AUTHORIZED AND COMPLETED ONCE / GRANT CONSUMED / STORAGE AND LIVE QUALIFICATION STILL OPEN.

Executor subsequently clarified that these observations came from sbx, not the actual provisioning host.
All view/capacity/CPU proposals below remain sbx-local historical evidence.
They do not constrain host provisioning or choose actual host controls.
The host-executed mise handoff supersedes another sbx-local inventory; see [host-entrypoint.md](host-entrypoint.md).

Executor selected `Run exact C17 follow-up`.
The bounded read-only attempt completed in 22.109 ms with natural EOF/reap and 4,945 retained payload bytes.
Evidence remains in `/tmp/opencode/chess-coach-ii-c17-host-view-eq6jopxw/`.
The self membership matched C16 exactly.
No Docker call, directory/process/workload listing, controller write, mount or provisioning occurred.

The observed cgroup2 mount has root `/` at `/sys/fs/cgroup` and is writable in the helper's view.
Root and `/docker` advertise and enable cpuset/cpu/memory/pids controllers.
`/docker` is an existing non-symlink directory with observed inode 19 on device 22.
The observed self child has unlimited CPU/memory/task settings rather than C2's selected limits.
These facts support a proposed observer view `/proc` + `/sys/fs/cgroup` and an existing parent `/docker`.
They do not prove actual manager-reported owned-container PID binding or effective C2 controls before a separately approved live qualification.

The writable filesystem projection found:

| Existing mount | Capacity / observed available bytes | Consequence |
|---|---:|---|
| `/` overlay | 20,957,446,144 / 8,168,341,504 | Development overlay; not a qualified durable C13 target |
| `/var/lib/docker` ext4 | 25,185,042,432 / 23,870,377,984 | Existing daemon-owned filesystem; no permission to create arbitrary state inside it |
| Read-only reference worktree mount | 52,521,566,208 / 49,006,899,200 | Preserve the reference read-only; do not allocate training state here |

No observed filesystem backs C15's full 214,748,364,800-byte aggregate planning ceiling.
That ceiling is not a performed allocation or a promise that every byte will be used.
The currently observed filesystems cannot be accepted as full-ceiling backing without an explicitly different storage/retention/fit contract.
Free-space samples are observations, not durable reservations or future admission guarantees.
An actual separate private target and its storage allocation/durability remain unresolved.

The exact read-only scope below is historical and consumed.

C16 computed CPU/RAM proposals but did not establish the exact observer/cgroup/storage view.
Do not ask Executor to guess these paths.
Use the exact observed membership and bounded mount metadata to calculate the next proposal.

## Exact read-only scope

Use one Python standard-library helper with one new private evidence directory under `/tmp/opencode/`.
Make no Docker call and perform no directory/process/workload listing.
Read only these paths once each, bounded to 64 KiB per ordinary file:

- `/proc/self/mountinfo`, retaining only cgroup/cgroup2 entries and writable local filesystem entries needed for the listed capacity projections; bound this input to 256 KiB and reject excess.
- `/proc/self/cgroup`, to require that the exact C16 self membership still matches before selecting any self-path reads.
- `/sys/fs/cgroup/cgroup.controllers` and `/sys/fs/cgroup/cgroup.subtree_control`.
- `/sys/fs/cgroup/docker/cgroup.controllers`, `cgroup.subtree_control` and `cpuset.cpus.effective`.
- The following files only under the exact already observed path `/sys/fs/cgroup/docker/34a06450976a7fd5baf99e5f9a85ff3f6cd12d3b0cc542157d2b86b5ea5b05e4/`: `cgroup.controllers`, `cgroup.subtree_control`, `cpuset.cpus.effective`, `cpu.max`, `memory.max`, `memory.current`, `memory.swap.max`, `memory.swap.current`, `pids.max`, `pids.current`.

Obtain directory metadata, not contents, for the three exact cgroup paths above and `/var/lib/docker`.
Use `statvfs` on at most eight writable non-proc/sys/dev filesystem mountpoints reported by that bounded `mountinfo` projection.
Exclude tmpfs from a durable-state proposal.
Do not inspect filesystem contents or automatically create a state directory.
Do not read `cgroup.procs`, any other PID, process namespace/environment/argument/maps/memory files, credentials or logs.
Do not traverse cgroup parents beyond the three exact paths or enumerate their children.

## Bounds and meaning

Bound the complete helper to 10 seconds plus 2 seconds for owned-helper kill/reap.
Bound retained evidence to 256 KiB.
Preserve denial/absence/mismatch without retry, path substitution or privilege escalation.
If self membership changed, stop without reading the stale self path.
Create no container, cgroup, mount, host directory or storage allocation.
Modify no controller or workload.

Calculate whether the visible mount root maps the exact self path and which observed existing filesystem could back a private target.
Report actual constraints and proposed paths rather than promoting a same-hostname guess to observer authority.
This read-only result still cannot provision/delegate a parent, reserve storage or prove actual owned-container PID/cgroup observation.
If the current view cannot establish those prerequisites, prepare an operator-run helper for the actual daemon host instead of bypassing confinement.
