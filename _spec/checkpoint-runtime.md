# C11: private standard SQLite completion transactions

Status: SQLITE SELECTED / SOURCE IMPLEMENTATION / NOT EPISODE ELIGIBILITY OR TRAINING AUTHORITY.

Executor selected `SQLite transaction (Recommended)` in C11.
Use Bun's supported SQLite binding, ordinary SQL transactions and unique attempt keys.
Store Burn-native records and bounded closed versioned JSON rather than a custom checkpoint codec or transaction registry.
Keep the store private to the in-envelope coordinator.
The outside supervisor may retain/export bounded bytes but performs no game production, reference reconstruction, feature work or learning.

## Retained state machine

Each master uses C10's exact initial seed and independently selected native record.
Masters remain serial 101..105 with independent baseline/counters and four derived streams.
Curriculum A retains even corpus / odd live STARTED slots, alternating live seats, canonical new episodes and 18-case descending Fisher–Yates shuffles.
Only STARTED consumes the schedule/corpus/live cursors and selection draws.
Persist its descriptor, frozen baseline and model identity durably before any episode launch.
An infrastructure/storage/integrity failure stops all masters without retry or resume.

The whole-match owner, not SQL, schemas, a claimed return or method name, proves eligible completion and exact ACK prefixes.
The store checks that completion matches its owned pending descriptor/model/baseline and stream prefixes.
Commit model, baseline, counters, completed streams, control and journal/history references in one supported SQLite transaction.
Use one unique completion per attempt.
Do not store or resume pending gradient buffers.

Zero-choice verified completion advances verifiedCompleted and known control/streams/journal references only.
It performs no PG, L2, baseline insertion or checkpoint publication.
A nonempty completion applies one independently verified native proposal, increments eligible/update/baseline counters once and inserts its return only after the frozen-baseline update.
Keep `nonzeroPGUpdates` separate from L2-only changes.

## Checkpoints and export

Keep cadence 100 and delayed fulfillment: a zero-choice due slot waits for the next eligible completion.
Save the exact actual epoch and completed state, not a fabricated round number.
Fulfill its bucket only inside the successful durable transaction.
Attempt 1000 never creates slot 1001.
Final master validity still requires 1000 STARTED and verified completions, no abort and at least one nonzero policy-gradient update.
The formal primary remains master 101 only after all five valid serial runs; no seed/checkpoint fallback exists.

Retain only current native models and periodic native checkpoints in the bounded SQLite file.
Historical episode/model/audit references require separately retained bounded private evidence bytes from the actual owner.
A reference/hash alone does not establish that those bytes were registered or verified.
The store does not manufacture provenance expectations.
Only the selected config/native record may leave through the inference API.
Never expose the SQLite database, scheduling/RNG metadata, corpus/future queues or private histories to scoring.

Use FULL synchronous SQLite transactions, foreign keys and an explicit file/page bound.
Reject an existing database at creation.
Provide read-only diagnostics rather than an operational resume API.
Treat ambiguous commit durability as abort-all even if read-only inspection later finds committed bytes.
SQLite's internal rollback/recovery does not authorize an operational retry.
Qualify actual target filesystem durability and storage/FD fit separately under C9.

Synthetic schema/schedule/store fixtures may construct explicitly synthetic completion inputs.
They verify transaction semantics only and cannot establish genuine episode eligibility, artifact validity or `trainingReady:true`.

## Integrated owner and retained publication

`TrainingCoordinator` commits STARTED before constructing any match/learner process dependency.
It constructs `MatchSession` from that owned descriptor/model/stream state and accepts no completion report as an authority source.
The separate-process synthetic fixture now verifies one actual child/frozen scorer/two-Burn-learner transaction through retained journal/history/proposal files and a SQLite completion commit.
The source retains every known completed stream and advances the baseline only after the compared proposal passes.
SQL/byte-publication/reentry/deadline failures stop all without reopening or retrying the store.

C13 selects the dedicated private state mount in [state-persistence.md](state-persistence.md).
The publisher reserves 128 MiB for the 64 MiB SQLite database and bounded DELETE-journal surface inside C9's 4 GiB packet ceiling.
It counts retained payload bytes/entries and does not infer physical filesystem fit or durability from those ceilings.

The store serializes master initialization and rejects an incomplete five-master final selection.
Final model metadata and the external five-master envelope use closed versioned schemas.
The coordinator writes bounded native/config/artifact files and returns the formal primary only after all five checked final states and final publication checks pass.
Synthetic final-metadata tests do not certify that five real 1000-attempt runs occurred.
No game-data training or full-experiment storage-fit claim follows.
