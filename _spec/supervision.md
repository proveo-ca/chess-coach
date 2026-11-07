# C8: outside supervision and read-only cgroup observation

Status: C8 SELECTED / SOURCE AND SYNTHETIC TESTS / NO HOST EXECUTION AUTHORITY.

Executor selected `Read-only cgroup observer` in the C8 decision.
Keep Docker as the supported manager under C1.
The selected source/design permits an outside observer to bind the manager-reported owned init PID to its host cgroup-v2 path while the job waits at a boot barrier.
Any real `/proc/<owned-init-pid>/cgroup`, `/sys/fs/cgroup/<owned-path>` or Docker access still needs a fresh exact scoped grant.
C8 authorizes no host inspection, provisioning or execution.

## Source boundaries

`tooling/runtime/supervise.py` uses Python standard subprocess, selectors and `CLOCK_BOOTTIME` APIs.
It captures S0 before per-attempt validation and manager calls.
One owner consumes one attempt and cannot restart it.
The cold result must arrive strictly before S0+10s.
Normal lifecycle work ends at S0+297s.
Cleanup and the exact owned cgroup's disappearance must pass before S0+300s.
The source keeps C2's exact quota, 8 GiB RAM, zero extra swap, 512 tasks and 2 GiB charged tmpfs.
It requires explicit selected CPU IDs.
C9 selects the Balanced byte/inode/FD/evidence ceilings in [runtime-output-limits.md](runtime-output-limits.md).
Synthetic CPU IDs and fake cgroup paths are not production placement decisions.

The manager adapter fixes nonroot, no-network, read-only root, private namespaces, dropped capabilities, no-new-privileges, no restart and image-contained init.
It forbids pulling at launch and uses only a pre-registered image ID.
It does not mount a home tree, manager socket, host cache or observation filesystem inside the job.
One fresh host-selected Docker label scopes ambiguous-create cleanup to the owned attempt.
It does not use a worker-supplied cleanup target or remove an unrelated name collision.

The observer checks the exact owned cgroup under an independently approved nonroot parent.
It checks actual CPU quota, memory, swap, task limits and effective CPU IDs before releasing game work.
It reads bounded cgroup membership trees and rejects symlinks, wrong membership and changed observation-root/parent identity.
An empty or unpopulated cgroup is not disappearance.
Docker removal is not disappearance.
The exact bound path must cease to exist while the observation root and approved parent remain stable.
This relies on C1's trusted host/manager and cannot prove against hostile cgroup migration by that trusted infrastructure.

`packages/runtime/src/job.ts` emits a boot frame before creating game/reference children.
It accepts only one closed native-proof start command and fixed session.
It launches fixed current/reference paths with independently owned pipes inside the admitted job.
It completes only after BOTH init/open/pass comparison and both natural close/EOF/reap receipts.
It dispatches no policy, scoring, sampling, model preparation or learning.
Its boot-origin `hrtime` safety guard does not transfer clock authority from the outside supervisor.
The outside S0 and `CLOCK_BOOTTIME` checks remain authoritative across launch, barrier time, suspend and cleanup.
No child clock, status or command extends them.

## Verification and remaining boundaries

`tooling/runtime/tests/test_supervise.py` uses fake manager replies, temporary fake proc/cgroup trees and bounded synthetic Python subprocesses.
It performs no real Docker call or host proc/cgroup inspection.
`packages/runtime/tests/job.test.ts` uses explicitly synthetic owned game transports.
Neither suite supplies F9, runtime-fit, actual process isolation or effective host enforcement evidence.

The actual control-plane interpreter/stdlib/manager closure and storage/evidence target remain unregistered.
The exact approved host CPU IDs, eligible cgroup parent, daemon-host observation view, physical headroom and private evidence location remain unresolved.
The C9 source writer uses bounded exclusive durable publication and fails closed without retry or overwrite.
Its synthetic fixtures do not qualify actual filesystem durability or host storage fit.
Complete the selected closure audits, whole-match learning integration and final Gate0 packet before any capture/build or live qualification request.
Keep all historical failed attempts and operational grants unchanged.
