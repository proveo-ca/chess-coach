# C9: bounded runtime I/O and evidence storage

Status: BALANCED SELECTED / SOURCE ENFORCEMENT AND SYNTHETIC TESTS / NO ALLOCATION OR EXECUTION GRANT.

Executor selected `Balanced (Recommended)` in the C9 interactive decision.
Balanced governs the design.
Tight and Expanded remain unselected reference.

These profiles fill the remaining output/storage/inode/FD design fields.
Every profile preserves C2: quota 400000/100000, 8 GiB RAM, zero extra swap, 512 tasks and a 2 GiB `/tmp` tmpfs charged inside RAM.
Every profile preserves the 24,000,000,000-byte / 12-eligible-CPU aggregate host ceiling and all original deadlines.
These are ceilings, not capacity, physical-fit, performance or effective-enforcement claims.

| Proposed profile | Per-process open FDs | `/tmp` inodes | Per-written-file size | Whole-job attached stdout / stderr | New private evidence per attempt | New evidence per exact packet / new files |
|---|---:|---:|---:|---:|---:|---:|
| Tight | 128 | 4,096 | 32 MiB | 16 MiB / 1 MiB | 128 MiB | 1 GiB / 4,096 |
| Balanced | 256 | 16,384 | 64 MiB | 64 MiB / 8 MiB | 512 MiB | 4 GiB / 16,384 |
| Expanded | 512 | 32,768 | 128 MiB | 128 MiB / 16 MiB | 1 GiB | 8 GiB / 32,768 |

Balanced remains subject to actual admission and qualification.
Selection accepts neither a guessed host CPU set nor a cgroup parent.
The final packet still needs exact operator-approved CPU IDs, the daemon-host observation view, the approved cgroup parent, current capacity and an exclusive private evidence location.

## Distinct surfaces

- Enforce per-process FDs and written-file size through supported ulimits.
- Enforce tmpfs size and inode limits through the selected Docker mount.
- Bound whole-job attached streams in the outside standard supervisor.
- Bound each control-plane command's stdout/stderr to 1 MiB each.
- Keep existing 1 MiB progress, 8 MiB inference/learning and 16 MiB native/completion frame caps unchanged.
- Keep native child stream caps distinct from attached coordinator streams.
- Keep private evidence budgets distinct from scratch tmpfs and immutable artifact/build input sizes.
- Count compact journals and actual retained private proof/evidence bytes, not omitted feature matrices or silently truncated data.
- Check every prospective exclusive write against both attempt and packet budgets before publication.
- Treat exhaustion, storage error or ambiguous durability as failure without learned reward, retry, overwrite or deletion of previous evidence.

Per-process FD limits do not establish a single kernel-enforced aggregate FD controller.
At 512 tasks, the conservative FD-slot upper bounds are 65,536 / 131,072 / 262,144 respectively before separately bounded outside controls.
Do not report those mathematical ceilings as observed use or physical fit.
The final outside control-plane admission must include its own process/FD/memory/CPU headroom inside the aggregate operator ceiling.

The new-evidence packet budget does not authorize deleting or moving historical evidence.
It does not authorize a game-data training storage allocation or a new operational attempt after failure.
Each exact future packet must enumerate its allowed attempts and stop behavior before execution.

## Source enforcement

`Limits.balanced()` fixes the selected ulimit/tmpfs/attached-output/progress settings and rejects profile substitution.
`tooling/runtime/evidence.py` uses exclusive owner-generated files, standard SHA-256, fsync and bounded packet/attempt/file/entry counters.
The packet counts directories against the 16,384-entry ceiling as well as regular files.
It creates an exclusive packet root and never reuses or overwrites a previous attempt path.
It consumes byte/entry reservations before writing and preserves partial files after failure.
Any write, durability or exhaustion failure closes the evidence packet to all further publication.
Storage failure still permits bounded owned-job cleanup and cannot become a positive qualification result.

The supervisor captures S0 before creating attempt-specific evidence or issuing a manager call.
It persists STARTED before launch, exact bounded frames, observed admission, lifecycle, failure prefixes and cleanup observations.
Manager commands use a fresh empty explicit Docker configuration, the fixed local socket and a credential-free environment with `GOMAXPROCS=2`.
Command receipts distinguish received bytes from retained prefixes on exhaustion.
Cleanup cannot delete an unrelated name collision without the exact fresh attempt label and selected image.

These source counters bound retained payload bytes and created entries.
They do not prove host free space, filesystem metadata/block overhead, physical fit, kernel aggregate-FD enforcement or durable storage behavior on the future target.
Actual storage and outside control-plane headroom admission remain open.
Synthetic fixture tests use smaller budgets without extending the selected production maxima.

C15 prospectively assigns the future five-master experiment to exactly fifty 100-STARTED-slot private evidence packets.
Each packet retains these Balanced ceilings.
The separately selected aggregate retained-payload planning ceiling is 200 GiB, including the private SQLite reservation.
No packet rollover follows failure or exhaustion.
No storage allocation or full-experiment physical-fit result follows from that design decision.
See [state-persistence.md](state-persistence.md).
The fixed coordinator-write bound is tighter than the sum of configured packet ceilings.
It preserves initial records outside mutable SQLite rows and removes only successful owned tmpfs model inputs after verified lifecycle closure.
See [storage-admission-decision.md](storage-admission-decision.md) for the 191,396,683,776-byte free-usable proposal and its unqualified 8 GiB planning allowance.
Executor's actual-host `200gb` statement is not constrained by sbx-local free-space samples.
