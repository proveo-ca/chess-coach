# C16 proposal: calculate Gate0 host bindings from read-only observations

Status: C16 AUTHORIZED AND COMPLETED ONCE / GRANT CONSUMED / SBX-LOCAL OBSERVATIONS ONLY.

Executor subsequently clarified that this helper ran inside sbx, not on the actual provisioning host.
Retain every observation and proposal below as sbx-local historical evidence only.
Do not promote its CPU IDs, memory, filesystems, daemon/helper name match or executable paths to actual host authority.
The active host-executed mise handoff is [host-entrypoint.md](host-entrypoint.md).

Executor selected `Run exact C16 inventory`.
The exact read-only attempt completed in 172.403 ms with natural helper/client exits, EOF and reap.
It retained 4,978 payload bytes in `/tmp/opencode/chess-coach-ii-c16-binding-inventory-aybj247w/`.
No container, mount, cgroup, workload operation, capture, image build or training occurred.

The daemon reports 16 CPUs, 20,445,216,768 bytes RAM, cgroupfs/v2 and `/var/lib/docker`.
The helper/daemon hostnames match, but the observation binding remains `UNQUALIFIED_EQUAL_NAME`.
The observed CPU intersection is 0..15.
The unapproved calculated proposal is eligible IDs 0..11, job 0..3 and disjoint outside-control IDs 4..5.
C2 plus a proposed 2 GiB outside reserve totals 10,737,418,240 bytes, below both the hard 24,000,000,000-byte ceiling and the daemon's reported total.
This is arithmetic, not an effective outside-control admission result.

The instantaneous filesystem observations reported 8,170,786,816 available bytes at the workspace/`/tmp/opencode` filesystem and 23,870,377,984 at `/var/lib/docker`.
Do not persist those free-space samples as planning limits or claim they reserve capacity.
Neither observation supplies a qualified C13 private target or backing for C15's complete 200 GiB planning ceiling.
The self membership is under a concrete `/docker/<id>` child, while the root cgroup resource-limit files are absent in this view.
A fresh exact self-path/mount-view observation is required before choosing a parent or accepting this as the daemon-host view.
Do not reuse C16 for that follow-up.

Executor stated that the host values are unknown and must be calculated.
Do not ask Executor to invent CPU IDs, headroom or filesystem mappings.
Calculate a proposed binding set from bounded observations, then retain operator approval and effective qualification as distinct requirements.
The consumed C3/C4 grants do not authorize these new reads.

## Proposed exact first-stage scope

The retained scope below is historical and consumed.

Use one fresh private evidence directory under `/tmp/opencode/`.
Run these two `/usr/bin/docker` commands once each with the fixed local socket, a fresh empty configuration/home and a credential/proxy-free environment.
Permit normal read-only API negotiation.
Retain only the formatted projection, bounded stderr, exact commands and lifecycle receipts.

```text
/usr/bin/docker --config NEW_EMPTY_CONFIG --host unix:///var/run/docker.sock version --format '{{json .Client.Version}} {{json .Server.Version}} {{json .Server.APIVersion}}'
/usr/bin/docker --config NEW_EMPTY_CONFIG --host unix:///var/run/docker.sock info --format '{{json .Name}} {{json .NCPU}} {{json .MemTotal}} {{json .CgroupDriver}} {{json .CgroupVersion}} {{json .DockerRootDir}} {{json .OperatingSystem}} {{json .KernelVersion}}'
```

Use Python standard-library reads for only the following current-realm sources:

| Exact source | Retained projection |
|---|---|
| `/proc/sys/kernel/hostname` | Current helper hostname, compared with the daemon's projected name only to detect mismatch |
| `/proc/meminfo` | MemTotal, MemAvailable, SwapTotal, SwapFree |
| `/proc/self/status` | Cpus_allowed_list and Uid only |
| `/proc/self/cgroup` | This helper's own cgroup-v2 membership |
| `/sys/devices/system/cpu/online`, `/sys/devices/system/cpu/present` | Bounded explicit online/present CPU ID sets |
| `/sys/fs/cgroup/cpuset.cpus.effective`, `cpu.max`, `memory.max`, `memory.current`, `memory.swap.max`, `memory.swap.current`, `pids.max`, `pids.current` | Current exposed cgroup values; no ancestor traversal or writes |
| Current workspace root, `/tmp/opencode/` | Filesystem `statvfs` capacity/free-byte/free-inode metadata only; no directory walk or file content scan |
| Exact projected absolute `DockerRootDir`, if readable here | One `statvfs` metadata call only; absence/denial/mismatched view remains unresolved |
| `/usr/bin/python3`, `/usr/bin/docker` | File type, length, SHA-256 and resolved selected executable path; no execution beyond the two Docker commands and the Python inventory helper |

Do not inspect any other process, container, arguments, environment, credentials, logs, cgroup tree, directory tree, filesystem contents or workload metadata.
Do not list, inspect, start, stop or remove workloads.
Do not create containers, capture images, build images, mount filesystems, provision directories on the daemon host, alter limits, clear caches or run stress/game/training work.

## Bounds and stop rule

- Use `GOMAXPROCS=2` for owned Docker clients.
- Bound each Docker command to 10 seconds.
- Bound the complete collection to 30 seconds plus a final 2-second owned-helper/client cleanup reserve.
- Bound each command's combined stdout/stderr to 64 KiB.
- Bound each proc/cgroup file read to 64 KiB.
- Bound retained total new evidence to 1 MiB.
- Read each listed source at most once per attempt.
- Preserve unavailable/denied fields explicitly rather than retrying, escalating or substituting a backend.
- Stop after a command failure or deadline, preserve evidence and terminate only the attempt's owned query/helper process group.

## Calculations and scope safeguards

Compute candidate CPU IDs from the observed online/present/helper-affinity/effective-cpuset intersection, bounded to at most the operator's 12-thread ceiling.
Present a proposed job subset and disjoint outside-control subset rather than equating quota with affinity.
Check C2's 8 GiB job RAM plus a separately bounded outside-control proposal against the 24,000,000,000-byte aggregate ceiling and observed instantaneous headroom.
Treat headroom as a new admission observation, never a persisted planning limit.
Report free bytes/inodes against C15's selected persistent-payload ceiling and separate filesystem/metadata/build/evidence overhead.
Do not allocate the proposed space or claim a successful `statvfs` reserves capacity.

A different daemon/helper hostname proves that the current helper view cannot be accepted as the daemon-host view.
An equal hostname alone does not prove namespace or filesystem identity.
Do not promote current-realm proc/cgroup/statvfs values to host authority without an independently established daemon-host observation binding.
If the session lacks that view, emit an operator-run version of this same bounded helper for the actual daemon host.
Do not bypass the boundary with a privileged container, existing workload exec, host mount or unapproved SSH connection.

This first stage can calculate proposals and identify which observations are missing.
It cannot approve a new cgroup parent/state directory or establish effective controls, durability, process isolation or cold F9 proof.
Any additional exact host path/provisioning request follows only from the retained first-stage result and requires its own grant.
