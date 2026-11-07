# Supported-runtime closure packet

Status: DRAFT / NOT GATE0 ACCEPTED / NO EXECUTION GRANT.

## Authority and scope

Executor selected proposal A / C1 in [gate-closure.md](gate-closure.md).
Use that amended profile rather than the historical kernel/opened-object attestation contract.
Keep all canonical, causal, recipient, economic, phase, version, deadline and cleanup obligations.
Treat hashes, typed values, schema validation and manager responses as individual evidence, not self-issued acceptance.

This packet assigns proposed source/API/test boundaries.
It does not claim that unimplemented paths exist or that current development artifacts form the final runtime closure.
Source implementation and bounded synthetic tests remain under the existing development grant.
Runtime capture/build, manager operations, native gameplay proof, data collection and training require their own applicable approvals.

## Proposed topology

```text
trusted Python standard-library deadline supervisor
  clock + exact expectations + bounded control/evidence I/O only
  |
  +-- supported Docker manager -- one admitted resource/security envelope
        pinned image-contained init
          +-- TypeScript private coordinator
                +-- current game worker / genuine recipient producer
                +-- independently pinned canonical reference worker
                +-- Rust policy-score child (R4 mode only; forbidden in F9)
```

The supervisor performs no game production, reference reconstruction, feature work or learning outside the job.
Both seats, the coordinator, reference, scoring child and all descendants share one CPU/memory/swap/task envelope.
The manager and host kernel remain trusted infrastructure under C1.
This plan grants no daemon configuration change, socket exposure, privileged container, namespace sharing or host mutation.

Use the runtime versions already selected for development as the proposed application target: Bun 1.4.0 and Rust 1.95.0 with the current lockfiles.
Pin the final base image, runtime/native libraries and image-contained init independently before capture/build approval.
No image or init identity is selected by a worker request.
C5 selected the official Bun base design family.
[runtime-inputs.md](runtime-inputs.md) and [runtime-inputs.json](runtime-inputs.json) record independently identified immutable base/builder candidates and the init's published checksum.
Only public metadata/checksum text was read; no layers, executables, Docker operations or builds ran.
The exact candidates remain subject to final packet acceptance, captured-byte checks and native/loading audits.
No final application image or effective runtime closure has been registered yet.

## Source and API assignments

The native/policy/learner/observer source and synthetic fixtures exist where marked below.
Unimplemented live e2e, whole-match and registration work remains proposed.

| File | Private API / responsibility | Persisted test target |
|---|---|---|
| `packages/game-core/src/initialization.ts` | `createCanonicalGame()`; actual approved opening and zero-paid endowed identities; implemented | `packages/game-core/tests/initialization.test.ts`; passes |
| `packages/contracts/src/initialization.ts` | `canonicalInitialObservation(side)` on the separate producer subpath; implemented | `packages/contracts/tests/initialization.test.ts`; passes |
| `packages/game-core/src/causal-events.ts`, `causal-producer.ts` | Implemented private stable unit/mine identities, action references and ordered actual-mutation effects | `packages/game-core/tests/causal-events.test.ts`, `causal-parity.test.ts` |
| `packages/game-core/src/classical-resolution.ts`, `resolve.ts` | Implemented complete B/C/F, collision, mine, origin and promotion physics | `packages/game-core/tests/classical-resolution.test.ts`, `canonical-classical.test.ts`, `turn-resolution.test.ts`, `canonical-turn.test.ts`, `turn-resolution.e2e.test.ts` |
| `packages/contracts/src/causal-journal.ts` | Implemented bounded private standard JSON/Zod state/journal data and JSON Schema exports | `packages/contracts/tests/causal-journal.test.ts` |
| `packages/contracts/src/recipient.ts`, `recipient-codec.ts` | Implemented continuing recipient reduction, side-local IDs/receipts/witnesses and bounded public batches | `packages/contracts/tests/recipient-privacy.test.ts`, `recipient-codec.test.ts` |
| `packages/contracts/src/game-session.ts` | Implemented explicit bank owner, atomic BOTH data successors and deterministic source-level record replay; no runtime authority | `packages/contracts/tests/game-session.test.ts`, `packages/policy/tests/recipient-noninterference.e2e.test.ts` |
| `packages/contracts/src/native-protocol.ts` | Versioned closed bounded native verification requests/results; no executable selectors or verified flags | `packages/contracts/tests/native-protocol.test.ts` |
| `packages/runtime/src/artifacts.ts` | Implemented independent manifest expectation, role/path/length/digest guards and bounded verification; no runtime registration authority | `packages/runtime/tests/artifacts.test.ts` |
| `packages/runtime/src/native-session.ts` | Implemented private lifecycle, exact recipient/session/cursor bindings and staged atomic BOTH commit | `packages/runtime/tests/native-session.test.ts`; live native proof remains unimplemented/unrun |
| `packages/runtime/src/game-worker.ts`, `current-driver.ts`, `worker.ts` | Implemented fixed entrypoint/current rules and generic staged worker; private native data stays inside the job | Protocol, job and Bun closure fixtures; live source-bound proof remains gated |
| `packages/runtime/src/reference-worker.ts`, `reference-driver.ts` | Implemented fixed reference init/open/pass adapter; no current-resolver fallback in runtime closure | `packages/runtime/tests/reference.test.ts`, `closure.test.ts`; captured reference qualification remains gated |
| `packages/runtime/src/policy-session.ts`, `rng.ts` | Implemented frozen model/history/candidate reconstruction, sampling/argmax, tentative RNG, ACK and one admission | `packages/runtime/tests/policy-session.test.ts`, `rng.test.ts`; whole-match classification remains unfinished |
| `packages/runtime/src/native-learner.ts`, `crates/policy-io/src/channel.rs` | Implemented frozen scoring/ACK accumulation and uncommitted record proposals; no eligibility-by-wire claim | Rust channel fixtures; `packages/runtime/tests/native-learner.e2e.test.ts` uses synthetic records |
| `packages/runtime/src/job.ts`, `framing.ts`, `process-transport.ts` | Fixed native-only boot barrier and owned child stdio | Native-only job/process fixtures; F9 never dispatches the separate match worker |
| `match-worker.ts`, `match-session.ts`, `match-process.ts`, `fixed-attempt.ts` | Closed whole-match barriers, owner reconstruction/stop proof and owned process-group cutoff | Synthetic matches and actual separate child/scorer/two-Burn-learner process fixture; no confined qualification |
| `training-coordinator.ts`, `private-state.ts`, `training-store.ts` | Durable STARTED, retained proof bytes, native update/SQLite completion, checkpoint/final-envelope source | Temporary-directory SQL/publication/deadline tests; C13 actual state target remains unselected/unqualified |
| `tooling/runtime/supervise.py` | Implemented outside deadline, bounded manager/stdio and C8 read-only cgroup observer | `tooling/runtime/tests/test_supervise.py` uses fake manager/filesystem and bounded synthetic tools; live host e2e remains unimplemented/unrun |

Keep the deadline supervisor outside the job failure domain.
Keep the application coordinator inside the job.
Use supported subprocess/process APIs and supervisor-created pipes rather than imported numeric-PID FD authority.
The exact selected Python interpreter and its closure belong in the control-plane execution packet.

## Independent expectations and build outputs

1. Executor freezes the expected source/test/lockfile/feature-layout/recipe/reference roles before worker claims.
2. Enumerate the selected Cargo graph using locked/offline standard Cargo metadata and build output.
3. Enumerate the actual TypeScript runtime/type-only/reexport graph using the pinned compiler plus current partition checks.
4. Identify generated Rust/build-script/proc-macro/native outputs from the selected supported build; do not construct a replacement compiler DAG.
5. Separate development/build tools, immutable runtime files, control-plane files and model-facing modules.
6. Specify the output-registration method, required roles, lengths and constraints before the capture/build request.
7. After separately approved capture/build, register actual runtime/image/init/worker/model/reference identities before qualification selection.
8. Reject changes to registered source, recipe, locks, workers or policy rather than silently refreshing expectations.

The reference adapter must execute the frozen canonical rules snapshot at `b4b241481fb12de4a7344e6dba8eda775af57675` or a separately accepted independently expected successor.
Copy only the selected rules closure during its approved capture.
Do not mutate the old worktree or migrate its operational tooling.
Current development reference reads and persisted fixtures do not constitute a captured qualified reference runtime.

## Policy and resource decisions still required

Preserve network none, nonroot execution, read-only root, private PID/IPC namespaces, dropped capabilities, no added capabilities, no-new-privileges, no restart and explicitly bounded temporary/output surfaces.
Expose no manager socket, credentials, home tree, broad cache or user-selected mount to a worker.
Use the pinned image-contained init rather than an unverified daemon-injected init.
Reject unsupported controls instead of weakening the policy.

Executor selected the Headroom envelope in the actual C2 question.
Use a proposed production CPU quota of 400,000 µs per 100,000 µs period, memory and memory+swap of 8,589,934,592 bytes, 512 tasks and a 2,147,483,648-byte `/tmp` tmpfs.
These selected design ceilings do not establish host capacity, fit or effective enforcement.
The consumed BusyBox 1 CPU / 128 MiB / 32 task proof does not size this job.

### Operator hard host ceiling

Executor reports 40 GB total host RAM and 16 CPU threads.
Executor allows at most 24 GB RAM and 12 CPU threads for aggregate allocations.
Treat that ceiling as authoritative even if a daemon reports larger totals.
Do not raise C2's 4 CPU / 8 GiB envelope.
Until units are further specified, use at most 24,000,000,000 bytes rather than rounding 24 GB up to 24 GiB.
Include concurrent jobs, reference processes and control-plane headroom in aggregate admission.
Never count tmpfs as extra RAM outside the memory ceiling.
Freeze an operator-approved eligible CPU set before execution; keep its size at most 12 and use only the subset assigned to this job.
Do not infer CPU IDs from a CPU count or equate bandwidth quota with a hard thread-affinity limit.
Exact CPU IDs, availability and effective cpuset remain unverified.

[memory-triage.md](memory-triage.md) separates total memory, available headroom and current-realm cgroup limits.
The optional process snapshot and any exact-target termination require fresh scoped approval.
Do not treat a process name or large RSS as permission to terminate it.

### Decision C2: proposed aggregate job ceilings

| Proposal | CPU quota / period | Memory = memory+swap | Tasks | `/tmp` tmpfs |
|---|---:|---:|---:|---:|
| Historical envelope | 200,000 / 100,000 µs | 4 GiB = 4,294,967,296 bytes; no extra swap | 256 | 1 GiB = 1,073,741,824 bytes |
| Lean envelope | 100,000 / 100,000 µs | 2 GiB = 2,147,483,648 bytes; no extra swap | 128 | 512 MiB = 536,870,912 bytes |
| Headroom envelope | 400,000 / 100,000 µs | 8 GiB = 8,589,934,592 bytes; no extra swap | 512 | 2 GiB = 2,147,483,648 bytes |

These are proposed whole-job ceilings for BOTH seats, reference and descendants, not per-process allowances or passing capacity measurements.
Tmpfs consumes the same cgroup memory budget; it is not an extra memory allowance.
Each proposal keeps original deadlines and final cleanup reserve unchanged.
Selecting a proposal authorizes neither provisioning nor execution.
C2 selection: Headroom.
Historical and Lean remain unselected reference.

[host-inventory-request.md](host-inventory-request.md) records a fresh, bounded, read-only capacity/component receipt request.
Executor authorized and completed that exact C3 request.
The receipt records Docker 29.7.2, API 1.55 and cgroupfs/v2.
It created no container and supplies no enforcement or runtime qualification result.
Its grant is consumed.
Do not persist sampled RAM as a fixed planning limit.
Check current headroom at admission while retaining the operator's hard ceilings.

Set exact stdout/stderr, per-message, retained evidence, storage/inode and FD ceilings in the final command packet.
Keep the existing observation/configuration/checkpoint/inference byte caps distinct from aggregate OS admission.

Before admitting the real job, verify all selected effective limits and descendant membership on the actual backend.
Keep resource control separate from hostile-code security claims.
Describe the supported observation used to prove descendant quiescence and cgroup disappearance.
If that observation needs additional host access, request it explicitly rather than inferring it from Docker removal.

C8 selects the narrowly scoped outside observer in [supervision.md](supervision.md).
Its source checks owned init membership, effective limits and exact path disappearance while the observation root/approved parent stay stable.
Actual host CPU IDs, the approved cgroup parent, observer access and effective behavior remain unverified.
No real `/proc`, cgroup or Docker access follows from C8.

## Time and lifecycle

Use one trusted host clock in the outside supervisor for the original origin and its deadline decisions.
The proposed Linux implementation uses Python's standard `time.clock_gettime_ns(CLOCK_BOOTTIME)` so suspend time remains included.
Require that clock during qualification; no silent clock-domain fallback or Rust `Instant` deserialization exists.

Capture S0 before per-attempt launch-causal manager calls, runtime selection, job-specific validation and process creation.
Independently registered build inputs/outputs remain pre-existing prerequisites, not a build launched inside the 10-second native window.
Do not obtain a fresh origin after a failed query, launch, recipient or reference.

| Boundary | Required behavior |
|---|---|
| `S0+10s` | Complete the cold F9 launch, BOTH init/open/pass window, independent comparison and initial recipient-pair fold; postcheck before any accepted result |
| `S0+297s` | Stop normal work and begin whole-job cleanup; preserve the final 3 seconds |
| `S0+300s` | Complete the supervised lifecycle and required absence/reap checks or fail qualification |
| Failure | Revoke the attempt, preserve evidence, stop the owned job, perform bounded cleanup; no replacement job, clock renewal or automatic retry |

The outside supervisor enforces deadlines even if a worker blocks its JavaScript event loop.
Internal timeout/status messages cannot extend an absolute boundary.
The later policy protocol must preserve its existing nonrenewing per-permit deadline within the remaining job lifetime.
Do not reinterpret F9's cold 10-second window as permission to renew episode clocks.

## Native proof transaction

F9 mode permits exactly canonical initialization, both recipient initial outputs, turn-open, pass/pass settlement, independent reconstruction/comparison and close.
It forbids model artifact preparation, feature encoding, scoring, sampling, A2 dispatch and learning.
Its request supplies no hidden board, provenance, executable path, module selector or expected-reference replacement.

Compare authoritative board/resources/raw consequences, genuine public observations, ordered causal batches, bank/grant/accounting facts and stop classifications.
Initialize one current BOTH-recipient ledger pair once.
Advance it from the actual ordered open and settled boundaries.
Retain identical replay without reissuing facts; reject gaps, wrong recipients, stale sessions and conflicting bytes.
Publish no half-committed pair or post-close successor.

Require a genuine orderly close, stdin closure, drained stdout/stderr EOF and observed successful child reap for the positive proof.
Test forced termination, descendant persistence and deadline cleanup separately as negatives.
Never substitute force removal for a positive close/EOF/reap.

## Qualification and failure matrix

The persisted host e2e suite must require explicit live-operation selection.
Do not silently skip missing required host evidence and report a full qualification PASS.

| Evidence family | Required cases |
|---|---|
| Input/artifact selection | Wrong source/lock/runtime/image/init/policy/entrypoint/model/reference; worker-nominated expectations; unsupported mutable/dynamic loading |
| Process and stdio | Main/reference isolation, wrong child/session, substituted endpoints, stdout/stderr byte exhaustion, early EOF, blocked input, nonzero exit and reap failure |
| Native boundaries | BOTH canonical opening, real open/pass settlement, wrong side/cursor, duplicate/conflicting/reordered/tampered batches and independent comparison failure |
| Phases | Model dispatch in F9, startup doing episode work, stale model version, nonmember selection, second hidden admission, rescue/fallback and post-close use |
| Aggregate resources | CPU pressure, memory/swap/task exhaustion, child inheritance, exact effective settings and no game work outside the envelope |
| Deadlines/cleanup | Expired origin, cold-window overrun, blocked worker, final reserve, original-clock continuity, timeout-triggered kill, live descendants and independent whole-job disappearance |

Local fake-manager tests may verify bounded supervisor behavior.
They cannot supply actual runtime/loading/enforcement/init/stdio/native proof.

## Gate0 acceptance checklist

- COMPLETE: explicit current-profile C1 decision.
- COMPLETE: current game/policy/contract foundation static tests, including canonical initialization.
- OPEN: complete selected mixed-closure and model/host partition inventory/audit.
- PARTIAL: C5 identifies immutable official Bun/Rust image candidates and the image-contained init's published checksum with a standard recipe proposal; actual captured bytes, native/control-plane closure and final exact recipe acceptance remain open.
- OPEN: independent expected-input registration roles and exact post-build output-registration method.
- PARTIAL: C2/C9 fix CPU/memory/swap/tasks/tmpfs/output/storage/FD design ceilings; actual CPU IDs, capacity/physical fit, state target and outside headroom remain open.
- PARTIAL: native/policy/whole-match/Burn/SQL/private-publication source and synthetic fixtures exist; final captured closure, actual durability/loading/isolation/clock/cleanup qualification remain open.
- OPEN: Executor acceptance of the final exact packet.

[gate0-packet.md](gate0-packet.md) fixes the proposed input/output-registration procedure and lists the exact missing host bindings.
C14 selects the six supported Bun reference bundles in [reference-bundles.md](reference-bundles.md).
Executor initially selected host-executed mise preflight/seeding/provisioning calling supported sbx for training.
Executor subsequently required actual F64 GPU learning, reported that the host uses its GPU, selected host-backed state, and amended the learning target to a supported shared-GPU host Docker job.
The coding agent stays in sbx and the active GPU stays attached to the host driver.
The GPU backend/image/driver/library/device/VRAM roles and actual target admission remain open; see [gpu-readiness.md](gpu-readiness.md).
[host-entrypoint.md](host-entrypoint.md) records the metadata-only task and actual host-interface boundary.
Do not reuse sbx-local C16/C17 capacity/view proposals as actual host bindings.
[storage-admission-decision.md](storage-admission-decision.md) separates C15 ceilings from the enforced fixed-write storage proposal.

Gate0 accepts design and current prerequisites, not future runtime results.
Actual runtime qualification and native proof retain separate exact operational approvals.
R4 requires the complete resolver/recipient/economics/policy implementation and its verification.
The initialized canonical fixture and this packet close none of the three gates.
