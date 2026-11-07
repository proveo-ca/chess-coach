# Host provisioning and calculated storage/admission boundary

Status: C18 SEPARATE PRIVATE BACKING + HOST MISE ENTRYPOINT SELECTED / NO PROVISIONING AUTHORITY / `trainingReady:false`.

Executor selected `Separate private backing` in C18.
Prepare the exact provisioning/admission handoff below.
This selection grants no device access, filesystem creation, mount, controller write, image operation or training.

C16/C17 observed and retained sbx-local CPU, memory, cgroup-view and writable-filesystem metadata under consumed exact read-only grants.
Executor subsequently clarified that this session is sbx and the actual host can provision `200gb` of disk.
Do not promote those sbx values to actual host capacity, CPU IDs, cgroup bindings or provisioning limits.
Executor selected host-executed `mise` for preflight/seeding/provisioning and supported `sbx` for training execution.
The metadata-only entrypoint and missing host-interface handoff are in [host-entrypoint.md](host-entrypoint.md).
No actual host provisioning, device, durable target or effective outside-control admission has been selected or qualified.

## C18 alternatives (historical; separate backing selected)

| Proposal | Source/contract effect | Separate authority still required |
|---|---|---|
| Separate private backing | Keep C15's fifty fixed packets and 200 GiB aggregate payload ceiling; preserve all evidence and the read-only reference | Provision/present independently selected durable private backing for the declared envelope plus actual filesystem overhead; admit outside controls; approve exact paths before mount/qualification |
| Recalculate constrained retention fit | Explicitly rebaseline physical storage planning to an observed smaller private target; evaluate supported lossless compression without deleting evidence or weakening failure semantics | Freeze the new bounded representation/accounting contract, prove full-experiment fit or keep it OPEN, then obtain exact target/allocation/qualification grants |
| Qualification-only storage first | Keep bounded qualification/source evidence separate from unprovisioned full-experiment retention | Approve only a bounded qualification target; retain the full-experiment storage readiness blocker and `trainingReady:false` |

The 200 GiB figure is a ceiling, not an already approved physical reservation or a claim that all runs consume that amount.
The sbx-local free-space samples do not limit what the host can provision.
The enforced fixed-write bound below refines physical capacity planning without reducing C15's ceilings or discarding evidence.
Do not manufacture capacity with a sparse file, delete historical evidence, place state in the reference worktree, or create a host volume/cgroup without a fresh exact grant.

The outside-control RAM proposal remains 2 GiB.
C16's CPU proposals 4..5 for control and 0..3 for the job remain sbx-local proposals, not actual host placement.
The observed sbx helper's cgroup lacked those effective limits.
Actual supported outside-control admission/enforcement must precede any claim that it bounds the supervisor and manager clients.
No process migration or host-controller write has been authorized or performed.

## C18 operator provisioning/admission handoff

The proposed new state target is `/srv/chess-coach/state` on a separate durable filesystem.
The proposed outside evidence target is `/srv/chess-coach/control-evidence` on that separate backing, outside the read-only reference and Docker's managed data tree.
These are prospective names, not claims that those paths or backing already exist.
Do not create ordinary directories on the observed 8 GB overlay and misreport them as a new disk.

Before any write/mount request, identify the actual existing or newly presented backing by an operator-approved stable filesystem/device identity.
Never format or reuse an unidentified device or infer that an unmounted device is empty.
No formatting command is proposed or authorized here.

| Surface | Exact proposed admission contract |
|---|---|
| Configured private payload ceiling | 50 fixed packets × 4 GiB = 214,748,364,800 bytes, including the existing 128 MiB database/DELETE-journal reservation |
| Enforced fixed writes per STARTED slot | 35,659,776 bytes: 17 MiB journal + 16 MiB history + 1 MiB proposal + two 4 KiB descriptor/config bounds |
| Private pipeline bound | 178,511,781,888 bytes: 5,000 slots + 128 MiB database/journal + one 64 MiB failure diagnostic + five initial pairs + five final bounded sets + 1 MiB experiment envelope |
| Outside qualification/evidence packet | At most 4 GiB = 4,294,967,296 bytes under C9, separate from private experiment accounting |
| Combined pipeline payload bound | 182,806,749,184 bytes |
| Filesystem/headroom planning allowance | 8,589,934,592 bytes = 8 GiB; qualification must establish adequacy on the selected filesystem |
| Proposed required free usable capacity | 191,396,683,776 bytes; compare actual free usable bytes, not nominal device size |
| Entries | 835,600 free entries: all fifty private packet ceilings + one outside packet + 16 directory/metadata entries |
| Ownership | Fresh exclusive private paths; state writable by numeric UID/GID 1000 only; outside packet owned by the selected supervisor identity; no symlink source substitution |
| Job CPU/memory | Actual host CPU IDs unset; quota 400000/100000, 8 GiB RAM, zero extra swap, 512 tasks, 2 GiB charged tmpfs |
| Outside-control CPU/memory | Actual host CPU IDs unset; proposed quota 200000/100000, 2 GiB RAM, zero extra swap; require effective supported enforcement rather than a reservation label |
| Aggregate | Actual eligible IDs unset, at most 12 threads; retain the hard 24,000,000,000-byte RAM ceiling and current physical/admission checks for concurrent work |
| Job cgroup parent/view | Actual host view unset; sbx-local `/docker`, `/proc` and `/sys/fs/cgroup` are not accepted host bindings |
| Outside-control group | Select through the supported host interface; do not migrate the active agent, unrelated processes or existing workloads |

The earlier 204 GiB / 219,043,332,096-byte figure summed configured private/outside ceilings.
It is not the demonstrated minimum storage requirement for this fixed pipeline.
The tighter bound keeps the same packets, maximum per-file limits, failure preservation and no rollover.
The 512-record/17 MiB segment and 4 KiB descriptor/config guards make its fixed-write terms explicit.
Initial native records now persist outside mutable SQLite rows.
Owned scratch duplicates are removed only after verified lifecycle closure.
Setup/lifecycle failures preserve scratch in charged tmpfs until the failed job ends.
Later publication failure still retains the input model's private initial/proposal bytes and SQLite state.
The arithmetic fits below both nominal decimal 200 GB and 200 GiB without resolving the host's units or usable allocation.
No real 5,000-attempt experiment or admitted filesystem fit has been demonstrated.
Actual metadata/headroom adequacy and available bytes/inodes must be qualified on the selected new target.
Image/capture/build scratch remain separately bounded and admitted; do not silently charge them to private state or omit them from capacity checks.

Host-executed `mise` must first expose the real `sbx` help/identity or supported interface documentation before an exact provisioning command can be formed.
The current sbx session supplies neither a host executor nor authority to provision backing.
C19 remains unexecuted and paused; do not replace the host handoff with another sbx-local block-device inventory.
If no backing is available through the approved interface, this is a genuine infrastructure/tools boundary, not a missing TypeScript flag.

After backing selection, propose the exact create/ownership/mount/control operations and rollback-free failure cleanup for explicit approval.
Retain all state and evidence after failure.
Gate0 accepts the complete design/prerequisite packet rather than granting runtime operations.
Verify effective paths, controls and durability under separate qualification grants before F9/R4/readiness closure.
