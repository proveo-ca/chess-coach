# Shared native job resource contract

## Approved design change

The operator explicitly replaced the bespoke 1,048,576-unit DIRECT work meter with standard OS CPU/memory limits for one shared BOTH-seat job. Do not claim numerical equivalence between byte caps, CPU time, CPU bandwidth and the retired work units. Production host provisioning, game execution and training remain unauthorized. A separate one-shot synthetic proof grant appears below.

Executor subsequently selected the supported-runtime current-profile rebaseline (C1) and Headroom design ceilings (C2). The production design uses `cpu.max=400000 100000`, memory 8,589,934,592 bytes, no extra swap (`memory.swap.max=0`), 512 tasks and a 2,147,483,648-byte `/tmp` tmpfs charged within the same memory budget. Apply these aggregate ceilings to both seats, the independent reference, scoring children and every descendant. They are selected design values, not observed production controls or measured capacity. Exact remaining output/storage/FD/policy/recipe inputs and actual qualification remain pending. See [runtime-plan.md](runtime-plan.md).

Executor reports 40 GB host RAM and 16 CPU threads, with an absolute allocation ceiling of 24 GB RAM and 12 CPU threads. Keep those operator limits even if daemon-reported totals are larger. Keep C2 at 4 CPU / 8 GiB; this instruction does not increase it. Conservatively interpret the RAM ceiling as 24,000,000,000 bytes unless Executor explicitly selects binary units. Account for all concurrent owned jobs and control-plane headroom together. Tmpfs already counts inside job memory and must not become an extra allowance. The final execution packet must select an operator-approved logical-CPU set within the 12-thread maximum; quota alone does not restrict eligible CPUs. No CPU IDs or effective cpuset have been established.

Retain the original absolute S0+10s and S0+300s boundaries, the final 3s cleanup reserve, and no budget or clock reset after failure. A child scorer, a second seat or a replacement process receives no new deadline. Abort the admitted job on failure rather than silently restarting it.

## Enforcement requirements

- Use a supported OS/runtime backend built on aggregate process-group controls, such as Linux cgroup v2 through a standard service/container manager.
- Put both seats and all job descendants under the same CPU, memory and task envelope. Include game production, feature encoding, checkpoint loading, inference and future learning work. Do not run game work outside the envelope.
- Specify concrete CPU bandwidth/quota, memory, swap and task limits before admission. No guessed defaults or implicit unlimited values establish readiness.
- Keep the trusted absolute-deadline supervisor outside the job's failure domain. It performs control-plane work only, not unaccounted game processing.
- Verify child inheritance, limit reporting, resource-exhaustion failure and whole-job cleanup on the actual host. Per-process `prlimit` alone does not establish aggregate BOTH-seat limits.
- Treat resource control and untrusted-code security as separate properties. Do not infer a secure sandbox from CPU/memory limits alone. Never expose a manager socket or broad private filesystem mounts to game processes.

CPUQuota/cgroup `cpu.max` limits bandwidth per scheduling period, not lifetime instruction count. MemoryMax/`memory.max` bounds cgroup memory; swap and task controllers need explicit policy too. Preserve absolute wall-time bounds independently of manager process-start timing.

## Host boundary

Read-only discovery found no `systemd-run`, `systemctl`, user manager bus or Podman in this realm. The cgroup v2 filesystem is mounted rw, but its root directory is uid 0/gid 0 and mode 0555. No writable delegated job subtree has been established.

`/usr/bin/docker` and `/var/run/docker.sock` exist. The socket is uid 0/gid 1001, mode 0660; this process belongs to group 1001. Under a fresh read-only grant, two bounded queries used an empty anonymous configuration in `/tmp/opencode/chess-coach-ii-docker-readonly-NGP9WR/` and the explicit local Unix socket. The daemon reports Docker 29.7.2, cgroupfs driver, cgroup v2, and CPU-quota, memory-limit and PID-limit support.

Those reports do not verify enforcement. No saved context, credentials or existing workload was inspected.

Under the fresh C3 grant, exactly two further projected version/info queries completed once each in 78.161 ms using new empty configuration/home directories in `/tmp/opencode/chess-coach-ii-headroom-inventory-4VrUut/`. They report client/server 29.7.2, API 1.55 and cgroupfs/v2. Both clients exited 0 with EOF/reap; no container or image operation occurred. Do not persist sampled RAM as a planning limit. This metadata does not establish current headroom or C2 fit/enforcement. Retain the operator's 24 GB / 12-thread hard ceiling and check headroom at admission. The C3 read-only grant is consumed. See [host-inventory-request.md](host-inventory-request.md).

## One-shot synthetic proof grant

The operator separately authorized at most one new proof container, using an anonymously resolved/pulled official BusyBox digest. The limits are 1 CPU, 128 MiB RAM, no extra swap and 32 tasks. Require network none, no user-supplied host mounts, nonroot uid/gid 65534, read-only rootfs, all capabilities dropped and no-new-privileges. The running proof receives at most 30 seconds plus a final 3-second cleanup reserve. No existing workloads, game data, training, publication or privileged-mode operations enter this grant. These are synthetic limits, not production defaults or production admission.

Evidence stays outside the repository in `/tmp/opencode/chess-coach-ii-native-proof-O4SCbD/`. Public metadata resolved the official linux/amd64 image to `docker.io/library/busybox@sha256:b7f3d86d6e84fc17718c48bcde1450807faa2d56704205c697b4bd5df7b9e29f`. Its anonymous pull succeeded using fresh Docker configuration and home directories.

The one-shot harness validates Docker configuration before start and effective cgroup limits before stress. It attempts four bounded CPU workers, at most 40 child launches against the 32-task cap, and bounded synthetic allocation against the 128 MiB cap. It checks child inheritance and kernel throttle/rejection/OOM counters. A final live sleeping descendant supplies the cleanup target. The supervisor retains an absolute monotonic cutoff and removes only its labeled proof container. A persistent exclusive attempt marker prevents a second creation attempt. Do not retry with weaker controls if the proof fails.

## Synthetic results

The single container `94d19ecf9ce565ebb8b99fbe52cde9157b4e581a05edbe1e32a30737585c756e` passed. The harness created no replacement container. No game data or training ran.

| Check | Observed result |
|---|---|
| Pre-start configuration | Exact pinned image, nonroot user, network none, read-only rootfs, no user mounts, dropped capabilities, no-new-privileges, restart disabled and approved resource values |
| Effective limits | `cpu.max=100000 100000`, `memory.max=134217728`, `memory.swap.max=0`, `pids.max=32` |
| Child inheritance | Same private cgroup, matching limits, uid/gid 65534, zero capability sets, no-new-privileges and seccomp filter active |
| CPU pressure | Four workers used 3.078163 CPU seconds over a 3.02-second measured wall interval; `nr_throttled` increased by 30 |
| Task exhaustion | `pids.events:max` increased by 1; launch-pressure shell exited 2 |
| Memory exhaustion | Peak reached 134217728 bytes; 36 max-limit events; 1 OOM kill; allocator exited 137 |
| Rootfs write | Denied |
| Cleanup | Removed the live container with a sleeping descendant; Docker then reported that exact container absent |
| Timing | 7413.102 ms before cleanup; 62.666 ms cleanup; 7476.106 ms total; absolute cutoff did not fire |

CPU bandwidth uses scheduling periods, not an exact lifetime CPU-seconds meter. Do not interpret the short measurement's period-boundary allowance as a replacement instruction count.

`result.json`, `configuration.stdout.txt`, `attached-payload.stdout.txt`, `cleanup-remove.*`, `cleanup-absence.*` and `evidence-sha256.json` preserve the actual result. The evidence index hashes 34 files. The temporary assertion tests passed 2 tests with 15 assertions before execution; the payload passed shell syntax checking. These checks are local proof artifacts, not a reusable production runtime or persisted project e2e suite.

Cleanup verification covers Docker's successful force-removal and subsequent absence response while the proof included a live descendant. The private namespace exposed cgroup mount root `/`; it did not expose an independently addressable host cgroup path. Independent post-removal kernel-cgroup disappearance remains unverified. The proof did not exercise deadline-triggered cleanup because it finished before the cutoff. It does not establish hostile-code containment, production resource sizing, production deadline supervision, or a complete BOTH-seat game job.

Production admission and `trainingReady` remain false. C2 now selects core production design ceilings; remaining exact bounds, host capacity/fit, fresh host-operation authorization, a supervised game/learning pipeline and applicable verification remain pending. The one-shot proof grant is consumed; do not perform another host execution under it.

Do not repair sudo, alter host permissions or reuse old operational grants to cross this boundary. Runtime admission and training readiness remain false until the approved selected backend and design limits pass host verification.

## References

- https://www.freedesktop.org/software/systemd/man/latest/systemd.resource-control.html
- https://docs.kernel.org/admin-guide/cgroup-v2.html
- https://docs.docker.com/engine/containers/resource_constraints/
