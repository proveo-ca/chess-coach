# GPU owner and separate GPU job — reconstructed source contract

CURRENT: `SOURCE_RECONSTRUCTED` / `VERIFIED_TEST_SUBSETS` / `SOURCE_REVIEWS_ACCEPTED_SCOPED` / OPERATIONAL QUALIFICATION OPEN / `trainingReady:false`.

The owner, protocol, job, and fixtures are reconstructed and connected; source-review and operational acceptance remain separate.
`runs/closure-owner-1/` beneath `_work/gpu-owner-recovery/` freshly records 72 passing Rust cases, including 15 lifecycle and 19 observation cases, with `sourceChanged:false`; `corrected-source-owner-final-2` remains a distinct accepted-review evidence generation.
`closure-owner-clippy-1` and `closure-owner-format-1` pass locked/offline Clippy `-D warnings` and direct Rust 1.95 rustfmt checks for their recorded owner manifest; `closure-bridge-1` retains 27 tests / 388 assertions.
`_work/gpu-owner-recovery/security-rust-review.json` persists current Rust source-security acceptance under C1 in session `ses_e462ed1aeffefugdBMBe16ejE1`.
The [implemented authenticated reference guard](reference/object-graph-authentication.puml) retains 25 tests / 194 assertions plus affected test types; persisted packet-5 TypeScript security and final adversarial verdicts now accept their reviewed source-only scopes.
`backend-integer-review.json` separately accepts the scoped integer/byte-commitment contract, not global lexical JSON parity; no source verdict grants operations, training, publication, or Git commit/push authority.
The earlier TypeScript security verdict is historical before physical-reference pinning and integer regressions.
See [recovery.md](recovery.md), [gpu-owner.puml](gpu-owner.puml), and the sibling [pure policy contract](gpu-cooperative-policy.md).
Actual target inputs and Gate0 acceptance remain unset.
No operational command is authorized by this document.

## Boundaries and disabled entrypoints

The reconstructed owner lives in isolated `crates/gpu-owner`, with `#![forbid(unsafe_code)]`.
Its only root-workspace change is membership.
Use crate-local `rustix = 1.1.6` features `fs`, `event`, `process`, and `time`, plus existing locked registry versions of Serde, `serde_json`, SHA-256, and development-only tempfile.
Keep `serde_json` `raw_value` and empty-feature declarations owner-local; do not change the workspace's application dependency features.
Do not depend on host-facts, Burn, game, model, or learning crates from the owner.
No hand-written unsafe syscall or imported numeric-PID authority replaces supported APIs.

`host-gpu-owner --help` may print bounded help.
Every other ordinary-main invocation must remain `SOURCE_ONLY_DISABLED`, including a supplied input manifest and expected SHA-256.
The test-facing `run_once` API must not activate main.
The ordinary Bun GPU-job main also remains disabled.
`packages/runtime/src/gpu-job.ts` exports the test-facing job loop and contains that disabled ordinary main in the same file.
Do not split the recovered job into an extra main or new attempt-wrapper source files.
Use repository-owned bounded test runners and synthetic adapters, not an enabled host launch command.

The existing Python F9 supervisor, native-only `job.ts`, C5 Dockerfile, metadata source, and existing state validators remain frozen.
The new GPU path is separate; it must not introduce learning into F9 or turn historical metadata authorization into execution authority.
The exact protocol boundary is `packages/contracts/src/gpu-job.ts`, tested by `packages/contracts/tests/gpu-job.test.ts`.
Runtime tests live in `packages/runtime/tests/gpu-job.test.ts` and `packages/runtime/tests/fixed-attempt-gpu-owner.test.ts`.
Repository-owned owner fixtures live under `packages/runtime/tests/fixtures/gpu-owner/`.
The affected integration boundaries are `packages/runtime/src/fixed-attempt.ts`, `packages/runtime/src/training-coordinator.ts`, and the startup hook in `packages/runtime/src/match-session.ts`.
Parent owns root Cargo membership/lock changes; the reconstructed CUDA leaf manifests do not select root CUDA features or authorize acquisition.

## Public test-facing owner API

`crates/gpu-owner/src/lib.rs` exports `RawLaunchRequest`, `Report`, `run_once`, and `run_once_with`; the ordinary main does not dispatch them.
`RawLaunchRequest` carries `input_manifest: String` and independently expected `expected_manifest_sha256: String`, preserving original manifest bytes.
`run_once(request) -> Result<Report>` supplies `Boottime` and `LinuxWaiter`; `run_once_with(request, clock, waiter)` exposes the supported test-facing clock/wait boundary without changing the original S0 or deadlines.
Both capture S0 before request preparation; a failed clock/budget capture can return an error before a report exists.
`Report` retains `success`, `first_failure`, `cleanup_errors`, `proposal_json`, `cgroup_gone`, `all_helpers_reaped`, `origin_ns`, and `training_ready`.
Serialized report fields retain their snake_case names; `origin_ns` serializes as a decimal string and `training_ready` remains false, including a successful synthetic fixture.
Report success requires a proposal with no retained first failure, successful required cleanup/reaps/cgroup disappearance, and no evidence failure; it is not an acceptance or readiness flag.

## Closed owner input

`OwnerInput` is closed camelCase JSON with version `chess-coach.gpu-owner.v1`.
Reject duplicate decoded keys recursively, unknown/missing fields, invalid UTF-8, unsafe numeric values, unsupported role provenance, and symlink paths.
The independently supplied expected SHA-256 binds the **original manifest bytes**, not reserialized JSON.
Role provenance is closed JSON with hash binding; it is neither proof of truth nor authorization.

```text
OwnerInput {
  version,
  ownership: { sessionId, attemptId, containerName, ownershipToken },
  outsideControl: {
    admissionReceipt: FileExpectation,
    expectedSelfEnvelope: {
      cpus, cpuQuota, memoryMaxBytes,
      aggregateParent, aggregateCpus, aggregateCpuQuota,
      aggregateMemoryMaxBytes
    }
  },
  docker: {
    executable: FileExpectation,
    anonymousConfigDirectory,
    endpointUnixSocket,
    cgroupParentArgument
  },
  observation: {
    procRoot, cgroupRoot, approvedJobParentAbsolutePath,
    expectedOutsideControlCgroupAbsolutePath
  },
  job: {
    imageId, runtimeClosure,
    gpuProfile: { mode, cpus, injectionInventory },
    stateHostSource, jobInputJson, jobInputRef: ByteRef,
    expectedDescriptorSha256, initialModelId
  },
  cooperative: {
    selectedUuid, startupMinFreeBytes, runningStopBelowFreeBytes,
    samplePeriodNs, maxSampleAgeNs
  },
  telemetry: {
    kind, executable: FileExpectation, runtimeClosure,
    expectedDriver, queryBudgetNs, refreshIntervalNs,
    schedulingReserveNs
  },
  evidence: { exclusivePacketRoot }
}

FileExpectation { path, byteLength, sha256 }
```

`FileExpectation.byteLength` and other JSON numeric quantities must be safe JSON integers with role-specific bounds.
`ByteRef` binds exact original bytes and their independently expected identity, not merely a parsed object.
Policy bigints use canonical unsigned decimal strings in the signed-i64 range.
`memoryMaxBytes` and `aggregateMemoryMaxBytes` also use that canonical decimal representation; `Decimal` is a Rust type, not a field-name suffix.
`Q = queryBudgetNs`, `I = refreshIntervalNs`, and `J = schedulingReserveNs` are notation for the exact wire fields, not alternate JSON keys.
Never infer an omitted actual input from a development path, CPU count, earlier host sample, device index, or default target.
The launch `cgroupParentArgument` is a selected `*.slice` argument.
It is distinct from the approved **absolute host job-parent observation path**; do not derive one by treating the other as a host filesystem path.

Reject `exclusivePacketRoot == stateHostSource` and any packet root descending from `stateHostSource` before registered-file reads or any filesystem/helper effects.
Sibling roots remain allowed; containment must not let a job's writable `/state` bind reach the owner's evidence packet.

## File and helper custody under C1

Open every ancestor with descriptor-relative `openat` and `NOFOLLOW`; reject unsafe/missing ancestors and substituted leaves.
Keep pinned executable files `CLOEXEC` in the owner.
Execute the pinned file through `/proc/<ownerPID>/fd/N`, with no fallback to its original path.
Apply the selected safe supported process/group APIs and bound helper pipes, output, exit, and reap.
Stop owned helper groups **before** reaping their leaders so surviving descendants cannot escape group cleanup.
Do not target an unrelated group, PID, executable pathname, or collision.

Pin state and anonymous-config directories with retained FDs and path identities; recheck both before working manager commands, after create, and immediately before start delivery.
A state substitution stops ordinary work without becoming a prerequisite for exactly owned cleanup.
A config substitution may block an unsafe manager CLI invocation, but it cannot block local helper stop/reap.
These checks detect observed replacement under C1; they are not atomic Docker bind resolution and tolerate no hostile path aliases as qualified behavior.

Natural EOF must precede any termination that could cause it, or helper success could authenticate a stream that only the owner closed.
After observing leader exit, perform a bounded nonblocking final drain; quota exhaustion defers group kill/reap and never manufactures EOF.
If a stream would block without EOF, mark the helper forced before owned-group termination; EOF caused by that termination cannot restore `natural_clean`.
Always stop the owned group before leader reap, including a naturally exited leader with surviving descendants.

C1 trusts the selected helpers, manager, and kernel.
Pinning does not establish kernel/proc custody, prevent trusted in-place mutation, or certify hidden loader/runtime dependencies.
Actual proc permissions and the ability to execute through the pinned owner-FD path remain unqualified.
Runtime closures, tool identities, and permissions require independent registration and actual qualification under later grants.

## Origin, polling, and resource admission

`run_once` accepts the raw request and captures `CLOCK_BOOTTIME` S0 **before** validation, manifest/file hashing, adapter construction, evidence setup, or any launch-causal work.
Never renew S0 after rejection, helper delay, query, launch, startup, or failure.
Use absolute BOOTTIME `timerfd` plus `pidfd` and nonblocking stdin/stdout/stderr polling.
Timer expiry wins over simultaneous readable/writable helper progress.
One event loop multiplexes manager, attach, telemetry, and timers; blocking helper I/O cannot suspend deadline authority.

| Boundary | Required behavior |
|---|---|
| `< S0+10s` | Complete bounded start delivery, close stdin, and accept valid startup before cold admission expires |
| `S0+297s` | End ordinary work and begin cleanup with the original three-second reserve |
| `< S0+300s` | Finish required owned removal, helper reaps, and exact cgroup disappearance; otherwise fail |

Expiry can only be acted on when execution is scheduled.
Do not claim uninterrupted host responsiveness, exact-deadline action while unscheduled, actual suspend qualification, or reserved VRAM.

Keep aggregate CPU affinity/control at no more than 12 eligible threads and RAM at no more than 24,000,000,000 bytes, including outside control-plane headroom.
The job retains C2: four CPUs/quota equivalent, 8 GiB memory, zero extra swap, 512 PIDs, and a 2 GiB `/tmp` charged inside the same memory ceiling.
Keep all other retained C2/C8/C9/C13 security, output, inode, FD, mount, and deadline limits.
C13 permits only the selected private state bind, not a socket, cache, home, or observation mount.

Read the actual outside self envelope and aggregate parent; compare them with independently supplied expectations.
Reject overlap between outside control and the job subtree.
Bind the owned init to the approved C8 leaf and check membership, C2 leaf controls, and stricter CPU/RAM ancestor controls.
Keep proc/cgroup roots and approved parent identities stable throughout observation and cleanup.
An empty cgroup or successful Docker removal is not absence.
Retain File identities for every intermediate ancestor and the owned leaf, not just observation roots and the approved parent.
Validate the chain before/after bind and on every `gone` check; missing, replaced, or symlinked intermediate ancestors are faults, not evidence of cleanup.
Commit custody only after a successful first bind; repeated binding must validate the same custody without accumulating retained FDs.
Only final-component `ENOENT` under a stable chain may mean gone, and only if metadata on the held leaf reports `nlink() == 0`.
A renamed leaf can disappear from its old pathname while remaining linked elsewhere; that is not removal and must fail.
This proves namespace unlinking, not inode destruction, because the retained FD keeps the inode alive.
Actual cgroupfs link-count semantics remain unqualified; an unsupported target blocks qualification rather than weakening the guard.

## Candidate legacy NVIDIA profile

Only `mode: "legacy-nvidia-device-request.v1"` is a candidate here.
Use `runtime=nvidia` and exactly one DeviceRequest:

```json
{
  "Count": 0,
  "DeviceIDs": ["<exact selected UUID>"],
  "Capabilities": [["gpu"]],
  "Options": {}
}
```

Set `NVIDIA_VISIBLE_DEVICES` to that exact UUID and `NVIDIA_DRIVER_CAPABILITIES` to `compute` only.
Reject `all`, CDI, extra device requests/devices, injected worker sockets, cache/home mounts, privilege, and unapproved mounts.
The required `injectionInventory` must be independently supplied before any actual run.
Docker inspect alone does not prove hidden OCI injection, driver/library/loader closure, or the inventory's completeness.
No actual inventory, image, UUID, provider, or effective runtime is selected by this recovery document.

## Registered telemetry adapter

Only `kind: "registered-nvidia-smi-query.v1"` is admitted by the reconstructed goal.
Pin the expected executable/runtime closure and driver independently.
Use the fixed UUID-filtered query with exactly five fields, in order: `uuid,driver_version,memory.total,memory.used,memory.free`.
Accept exactly one ASCII CSV line with integer MiB counts, checked conversion to bytes, expected driver, and exact UUID.
Require positive total and individually `used <= total` and `free <= total`; do **not** require `used + free == total`.
Require zero exit, natural EOF, and successful reap before accepting the sample.
Summary/process/accounting queries, GPU kernels, setters, resets, and unfiltered enumeration are not this adapter.

Anchor `observedBoottimeNs` at query-request start `q0` conservatively, not at result receipt.
This is not a hardware timestamp or proof against provider caching.
Require positive `I`, `Q`, and `J` with `I+Q+J < samplePeriodNs <= maxSampleAgeNs`.
Launch the next query at `q0+I`, no later than `nextCheck-Q-J`; no grace follows a missed budget.
At most one query may be outstanding while all other helper and deadline events remain serviced.
Apply [gpu-cooperative-policy.md](gpu-cooperative-policy.md) for old-expiry precedence, thresholds, identity, stable total, terminal latching, and once-only actions.

## Separate Bun GPU-job wire

The job accepts no work until stdin reaches EOF after one bounded start frame.
Before EOF, perform **none** of the embedded-input parsing, model preparation, state/scratch creation, coordinator/factory construction, or child creation.
The outer wire is closed and identity-bound:

```text
boot {
  version: "chess-coach.gpu-job.v1", sessionId, kind: "boot"
}

start {
  version: "chess-coach.gpu-job.v1", sessionId,
  operation: "run-attempt", attemptId,
  inputJson, inputSha256, ownerElapsedNs
} + LF + stdin EOF

startup {
  version: "chess-coach.gpu-job.v1", sessionId, kind: "startup",
  attemptId, inputSha256, descriptorSha256, initialModelId
}

proposal {
  version: "chess-coach.gpu-job.v1", sessionId,
  kind: "attempt-proposal", attemptId, inputSha256,
  descriptorSha256, proposalJson, proposalSha256
}
```

`ownerElapsedNs` is a canonical unsigned signed-i64-range decimal string.
Successful protocol completion requires natural EOF and zero exit.
There is no `close` or `closed` message.
Do not accept startup on queued start intent, partial delivery, or forced pipe closure.
The owner must have completed the bounded write and closed stdin successfully before accepting startup.
Malformed, premature, mismatched, duplicate, late, or nonzero-exit traffic fails the attempt.

The bound embedded input and proposal are closed:

```text
{
  version: "chess-coach.gpu-attempt-input.v1",
  bindings, modelConfig, recordRef, initialStateSha256,
  expectedDescriptorSha256, initialModelId
}

{
  version: "chess-coach.gpu-attempt-proposal.v1",
  descriptor, initialModelId, state
}
```

Require `modelConfig.recordSha256 == recordRef.sha256 == initialModelId`.
Compare the exact initial snapshot and derived descriptor **before** creating the real fixed factory.
Default two-argument factory call paths stay unchanged.
A third argument may convey a trusted internal layout only; never accept that argument from the wire.
An optional bounded `onStarted` callback may run only after learners begin and verified initial state matches, but before open.

Run exactly one fresh master-101 ordinal-0 `runAttempt`.
Do not finalize, run an experiment loop, resume, retry, or start other masters.
Keep all game, curriculum, state transition, and learning work inside the job.
The local safety clock is `ownerElapsedNs + (localNow - localBoot)`.
Do not compare serialized BOOTTIME to Bun `hrtime`, or reset the owner's deadline authority at boot.

## Closed state predicates and exact descriptor commitment

Add strict GPU-boundary validation without changing frozen existing state validators.
Both Bun and Rust must reject unknown fields and mirror the existing `trainingStateShape` predicates, including closed nested shapes, counter inequalities/equalities, control bounds/permutation uniqueness, history counts, and stream-prefix relationships.
Keep `initializationSeed == master`, `started == scheduleCursor`, `liveOrdinal == floor(started/2)`, and the existing due/fulfilled-bucket predicates.
Rust uses `u128` intermediate arithmetic for the stream-prefix relation `(root + drawCount * 0x6d2b79f5) mod 2^32`; a digest-only wrapper is insufficient.
Receiver checks treat valid RNG roots as opaque and accept any schema-valid corpus permutation.
They do not derive roots from the master, replay Fisher–Yates, derive cursor/epoch transitions, replay learning/model updates or journals, or impose additional descriptor/state relationships absent from the accepted boundary.
Keep the accepted first-attempt proposal bindings: descriptor master `101`, ordinal `0`, descriptor model equal to `initialModelId`, state master `101`, and `started == verifiedCompleted == 1`, plus the owner's existing outer/input bindings.
Do not turn schema-valid alternative baseline/schedule, model, journal, update, or RNG values into new replay predicates.
Bind the initial state, record, descriptor, model identity, input SHA-256, session, and attempt before work.
The actual producer still pins the exact initial snapshot, real record, and independently derived descriptor before factory creation, then runs exactly one real attempt inside the job.
This receiver-fidelity correction does not weaken producer pins or move learning outside the job.

For each proposal, recursively reject duplicate **decoded** JSON keys before accepting semantic fields.
Hash the exact `descriptor` token bytes from the **same original proposal JSON** in both languages.
Exclude whitespace outside the descriptor token while retaining whitespace and escapes within it.
Rust borrows `serde_json::value::RawValue` directly from that original input; do not use `from_value` or a reserialized `Value`.
Bun captures the top-level token with a bounded parser that recognizes escaped/decoded field names and nested JSON.
Do not use regex extraction, semantic reserialization, or independently supplied replacement descriptor bytes.
The full proposal SHA-256 separately commits the exact `proposalJson` bytes.

### Integer spelling and immutable byte commitments

Rust typed integer readers inspect original `RawValue` tokens and map only the exact numeric token `-0` to semantic zero.
Apply that rule to scalar, list-element, and required-nullable integers while retaining target-type bounds and safe-count ceilings of `2^53 - 1` where required.
Canonical unsigned decimal strings, including times, still reject `"-0"`; numeric `-0` is not an alternate time-string encoding.
Capture schedule fields as raw tokens before decoding the closed concrete variant so Serde's intermediate content representation cannot lose the original integer spelling.
Rust integer targets still reject fractional/exponent tokens such as `-0.0`, `-0e0`, `1.0`, and `1e0`; existing Bun `z.int` accepts mathematically integral spellings.
Do not claim global lexical JSON parity between these validators or change the frozen existing state validators to create it.
Normalization changes only semantic integer decoding, never the manifest/proposal/descriptor bytes or hashes.
Changing a descriptor's token to `-0` requires the exact new descriptor pin; refreshing the enclosing proposal hash alone must still fail the old descriptor pin.

## Evidence and cleanup are separate authorities

Keep Balanced evidence ceilings: 512 MiB per attempt, 64 MiB per file, 4 GiB per packet, and 16,384 directory-inclusive entries.
Reserve bytes and entries before every write.
Keep partial files and partial buffers, account for full received bytes, and never overwrite or silently truncate into success.
Use an exclusive packet root; actual storage fit and durability remain unqualified.

Ordinary storage/serialization failure stops normal work and latches failure.
Once evidence I/O has failed, skip further serialization/I/O through that failed sink.
Use an explicit internal cleanup mode: only its evidence writes become best-effort.
Cleanup mode must not weaken ownership checks or turn ordinary work's storage failures into warnings.
A cleanup evidence failure still makes the outcome failed; best-effort permits cleanup to continue, not acceptance.
Keep the first reason and record subsequent cleanup faults separately where possible.
Failure must never fabricate successful completion, durable evidence, or accepted qualification.

Cleanup pumping is drain/reap-only: it never advances queued stdin, sets `write_complete`, or closes stdin merely because cleanup began.
Cleanup watches exclude stdin `POLLOUT`, since completing or closing a deferred start frame could release job work after the original failure.
An explicit owned helper kill may close its stdin; that action is not successful delivery or startup authority.
Newly encountered cleanup pipe/output faults enter `Report.cleanup_errors` while draining continues and the first work failure stays unchanged.
An already-latched fault is not re-emitted solely because it remains latched; encountering another fault still requires reporting it.

Cleanup ordering is a retained critical correction:

1. Keep attach alive through ownership inspection and C8 binding.
2. Inspect ownership even when evidence storage has failed.
3. Require the exact owned label/token and selected image before authorizing removal; wrong label or image means **never remove**, including after storage failure.
4. Once bound, stop the owned attach helper without waiting for EOF.
5. Remove the exact owned container ID concurrently with bounded draining; do not wait for attach EOF to start removal.
6. Stop owned helper groups before leader reap, finish helper reaps, and require exact cgroup-path disappearance under stable observation identities before the original final deadline.

Ambiguous creation does not authorize deleting a name collision.
Later inspection/cleanup faults cannot replace the first failure or enable a retry.
No cleanup reset, unrelated container removal, broad process kill, GPU reset, or clock renewal is permitted.

## Verified synthetic subsets and remaining gates

Use fake manager/query helpers and bounded fake proc/cgroup trees to verify owner sequencing without host inspection.
Cover evidence failures at ownership inspection, helper stop, remove, drain, and final observation; wrong-owner/image collisions must never be removed.
Cover attach held open, blocked stdin, complete-write versus queued-write races, timer/readiness ties, group-descendant cleanup, missing/replaced ancestors, and exact path absence versus empty membership.
Cover raw descriptor token equivalence across languages, escaped duplicate keys, whitespace, malformed JSON, and complete state/RNG-prefix rejection.
Use real SQLite, the real fixed factory and MatchWorker, plus two fake Bun learners for the separate job integration.
Do not invoke actual GPU or native learner/scorer binaries in that fixture.
Keep all new temporary fixtures and bounded receipts inside the repository.
The latest owner suite has 3 JSON unit, 13 adapter, 2 CLI, 1 conformance, 8 contract, 15 lifecycle, 19 observation, and 11 wire cases: 72 top-level cases, zero failures.
The 33 shared traces and 61 contradiction mutations live inside single conformance/wire cases; neither count adds top-level tests or recreates the historical 165-test report.
Connected CPU fixtures traverse real Rust -> fake Docker -> real Bun GPU loop/SQLite/coordinator/factory/MatchWorker/two fake learners for one attempt, without actual GPU or native policy processes.
Post-SQLite trailing/nonzero output, evidence failure with wrong image/label, incomplete-write startup, and empty-retained-cgroup negatives pass.
The earlier 38-case pass is `PRE_SECURITY_AND_INTEGER_CORRECTION`; the 70-case checkpoint is `PRE_LINK_COUNT_GUARD` and verifies neither of the two added leaf-rename cases.
The correction ledger and namespace guard follow architect-approved plans; `security-rust-review.json` persists `READY_TO_MERGE_RUST_SOURCE_SECURITY_GATE_ONLY` for the current 72-case/Clippy/fmt source under C1.
That Rust verdict clears its original three findings and reviewed custody/numeric corrections without qualifying actual GPU/runtime/filesystem/proc/cgroupfs/atomic-bind/hostile-alias behavior.
The previous 16/108 snapshot remains `PRE_OBJECT_GRAPH_AUTHENTICATION`; current authenticated-reference TypeScript security and final adversarial verdicts independently accept packet-5 source scope, as recorded in [verification.md](verification.md#current-scoped-source-review-acceptance).
Repository-local Rust 1.95.0 minimal/rustfmt/Clippy, Zig 0.15.2 CPU linking, and selected owner/default-CPU inputs are restored and offline verified as recorded in [recovery.md](recovery.md).
That grant permits scoped development setup and source verification, not CUDA/LLVM/NVIDIA/SDK input restoration or any actual host/GPU/image/production/capture/training/publication operation.
