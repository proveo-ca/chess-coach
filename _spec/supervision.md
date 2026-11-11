# C8: outside supervision and read-only cgroup observation

Status: C8 SELECTED / `SOURCE_RECONSTRUCTED` / `VERIFIED_TEST_SUBSETS` / `SOURCE_REVIEWS_ACCEPTED_SCOPED` / `trainingReady:false` / NO HOST EXECUTION AUTHORITY.

## CURRENT separate GPU-owner source contract

[recovery.md](recovery.md) labels earlier source/test reports historical after loss of external work and logs.
The existing Python F9 supervisor and native-only job remain unchanged.
[gpu-owner.md](gpu-owner.md) and [gpu-owner.puml](gpu-owner.puml) define corrected connected Rust-owner/Bun-job source; 72 cases, Clippy/rustfmt and 25/194 reference guards retain accepted current Rust/TypeScript/backend/adversarial source-only review scopes.
[gpu-cooperative-policy.md](gpu-cooperative-policy.md) supplies the pure VRAM lease gate, not a reservation or uninterrupted-host guarantee.
The new owner captures BOOTTIME before validation/hashing/adapters/evidence and gives absolute timer expiry priority over I/O readiness.
It must inspect ownership and clean up exactly owned resources even after evidence failure, with best-effort evidence restricted to explicit internal cleanup mode.
Wrong labels or image always prohibit removal.
Keep attach alive through ownership inspection/C8 binding, then stop its helper without waiting for EOF and remove the exact owned ID while draining concurrently.
Finish helper group stop/reap and exact cgroup-path disappearance under stable roots/parent before the original final boundary.
Startup requires completed bounded start delivery and actual stdin closure; queued intent cannot release the cold deadline.
Actual controls/paths/provider/image remain unset; both ordinary GPU mains remain disabled.
The 15 lifecycle cases and 19 observation cases cover deferred-start cleanup, evidence/state separation, directory/ancestor/leaf replacement, and honest namespace removal; they qualify no real proc permissions, host controls, GPU, runtime, or publication.
Selected development setup is `TOOLCHAIN_OWNER_DEFAULT_CPU_RESTORED` / `LOCKED_INPUTS_RESTORED_AND_FRESHLY_VERIFIED`, limited to repository-local Rust `1.95.0` minimal/rustfmt/Clippy, restored Zig `0.15.2` CPU linking, and selected locked owner/default-CPU inputs; Zig changes no CUDA compiler route.
Fresh bounded owner/policy/bridge/CPU/reference/harness/typecheck and earlier diagram render receipts are recorded in [verification.md](verification.md#fresh-repository-owned-recovery-evidence); no slice supplies operational owner qualification.
Cleanup pumping only drains/reaps: it neither writes/closes deferred stdin nor advances `write_complete`, excludes stdin `POLLOUT`, and reports newly encountered cleanup faults without replacing the first failure.
Natural EOF must precede any EOF-producing termination; quota-exhausted final draining defers kill/reap and forced EOF never becomes natural success.
Observation retains every intermediate ancestor and the leaf; final-component absence requires stable custody plus held-leaf `nlink()==0`, not merely a renamed pathname or empty cgroup.
This proves namespace unlinking while the held FD keeps the inode alive; actual cgroupfs link-count behavior and atomic Docker bind custody remain unqualified.
Fresh closure reference guards pass 25/194 and affected test types, while closure runner/audit tests pass 12/72; current TypeScript security/final adversarial packet-5 source verdicts are accepted, and prior 16/108 remains `PRE_OBJECT_GRAPH_AUTHENTICATION`.
The reference validator compares exact original-tree/stage-0 index entries, never worktree/cached diffs or source clean/textconv pipelines; prior 13/88 evidence is `PRE_FILTER_EXECUTION_FIX`.
The [implemented raw-object guard](reference/object-graph-authentication.puml) authenticates commit/tree ancestry, bounded complete path inventory, and missing-object refusal without lazy fetching; owned corruption/canary, parser/cache and named graph-bound cases pass without a full C14/native qualification claim.
The corrected frozen-file audit includes required actual `policy-initialize.rs` plus listed F9/collector/native-job/state boundaries; no frozen-source contract changed, and `source-accepted-diagrams-2` passes all three final acceptance-label diagrams.

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
