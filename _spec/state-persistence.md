# C13: dedicated private state mount

Status: DEDICATED STATE MOUNT SELECTED / SOURCE AND SYNTHETIC WORK ONLY / NO MOUNT OR STORAGE GRANT.

Executor subsequently selected host-backed private state for the shared-GPU host Docker learning target.
The earlier training-sbx placement no longer governs learning execution.
Keep the exact one-source `/state` policy, exclusive experiment roots and failed-evidence retention unchanged.
The host filesystem/path and its durability/capacity remain unqualified; no directory or mount has been created by this decision.

Executor selected `Dedicated state mount` in C13.
Explicitly amend the policy-job mount design to allow one operator-selected private read/write state directory at fixed `/state`.
Keep SQLite, private journals and the completion owner inside C2.
Keep the image read-only and `/tmp` charged to the same RAM budget.
No home tree, cache, manager socket, credentials, arbitrary worker path or additional mount follows from this selection.
The native-only F9 job retains its existing tmpfs-only policy.

Register the exact dedicated host source, owner, filesystem, byte/inode/FD admission and supported durability behavior before any live use.
Neither a source path string nor a successful temporary-directory fixture supplies that evidence.
Never remove the state directory during job cleanup.
Open a new exclusive experiment directory and refuse existing SQLite databases.
Keep no operational resume path.

## Publication ownership

Persist STARTED in the selected FULL-synchronous SQLite transaction before creating the episode child or learners.
The coordinator owns the descriptor, current model and consumed stream prefixes.
Retain each master's initial native record and config outside mutable SQLite rows in that master's first fixed packet.
Construct the checked whole-match session from trusted fixed process dependencies rather than accepting completion-shaped JSON.
Require match/scorer and both learners to close/reap before publishing a completed update.
Then release only the owned tmpfs config/record pair before completion publication.
Preserve scratch inputs after setup or lifecycle failure.
After successful release, later publication failure still retains the input model's private initial/proposal bytes and SQLite state.
Keep failed/private evidence and unknown files untouched.

Write exclusive bounded journal/history/model evidence with standard filesystem APIs and fsync.
Hash the actual physical journal bytes in append order.
Keep the journal's global record ordinal and exact cumulative byte count tied to those retained segments.
Preserve failed staging files and consumed reservations.
Only then commit their refs, native proposal, streams, baseline and counters through SQLite once.
No post-publication failure permits a replacement episode, store reopen, overwritten evidence or renewed deadline.

All work, filesystem writes and SQLite durability checks consume the already-supplied original clock budget.
The mount changes persistence, not deadlines or job lifetime.
Crossing a deadline during a blocking durability operation aborts all even if read-only diagnostics later reveal committed bytes.
An actual durable target and original-clock operational qualification remain required.

C9's 4 GiB new-packet and 16,384-entry ceilings remain unchanged.
Count retained private evidence and reserve the bounded SQLite database/journal surface inside those limits.
Exhaustion aborts all.
Do not infer that a full five-master experiment fits these ceilings from a small synthetic episode.
Any separately sized future training allocation requires an explicit decision and execution grant.

## C15: fixed evidence packet boundaries

Executor selected `Fixed 100-slot packets` in C15.
The single-experiment packet was structurally insufficient: 5,000 nonempty completions require more than 30,000 retained files/directories.
Use exactly 50 prospectively declared packet slots, indexed `(master-101)*10 + floor(startedOrdinal/100)`.
Each packet covers exactly one master's fixed block of 100 STARTED slots.
Each retains C9's 4 GiB / 16,384-entry ceiling.
The aggregate retained-payload ceiling is 200 GiB = 214,748,364,800 bytes, including the 128 MiB SQLite reservation in packet zero.
Final artifact publication uses packet 49 rather than inventing a 51st packet.
An exhausted packet closes publication for every packet and aborts all.
Never create a replacement packet after failure or relabel an attempt to change its fixed packet assignment.
This changes persistent evidence planning only.
It increases neither RAM/CPU nor per-attempt/file/stream limits and grants no allocation or training operation.
Actual host storage capacity, filesystem metadata overhead and the future allocation remain separately approved and qualified prerequisites.

## Enforced pipeline write bound

`packages/runtime/src/storage-bounds.ts` derives a tighter bound from the coordinator's fixed writes rather than summing every configured packet ceiling.
Each STARTED slot retains at most 4 KiB descriptor, 17 MiB normalized journal, 16 MiB history, 1 MiB proposal record and 4 KiB proposal config.
The 512-record journal guard exceeds the maximum 393 fixed/native/permit/decision/stop records from 64 planning windows.
It does not truncate evidence.
Retain five initial model/config pairs, five bounded final artifact/config/record sets and one experiment envelope.
Reserve the existing 128 MiB SQLite/database-journal surface and one 64 MiB abort diagnostic.
The first failure aborts all rather than adding failure packets.
Include the separate 4 GiB outside evidence packet and an 8 GiB filesystem/headroom planning allowance when proposing usable capacity.
The allowance is not a measurement or filesystem qualification.
Keep all fifty packet ceilings, no rollover and the separate capture/build scratch obligation.
Capacity admission compares actual free usable bytes and entries with this bound on the approved target.
No successful experiment, lossless retention fit on an actual target or usable host allocation follows from this arithmetic alone.
