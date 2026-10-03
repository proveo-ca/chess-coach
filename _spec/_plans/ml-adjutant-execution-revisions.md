# ML Adjutant — selected execution and evidence revisions

Status: **R0 PENDING REREVIEW; all A01–A15 source repairs IMPLEMENTED PROVISIONALLY.**
R0 remains **READY TO MERGE: no**. All **15 findings (7 HIGH + 8 MEDIUM)** remain pending.
These selections repair Phase 1/2 assurance and the Phase 0 corpus-pin boundary.
Source implementation is not review closure, refreshed image evidence, or training authorization.
The [R0 ledger](PLAN-ml-adjutant.md#r0-findings-ledger--full-implementation-post-image-review)
remains **READY TO MERGE: no**. No A01–A15 finding is CLOSED; source proof of closure is **NONE**.
Security rereview remains **UNRECORDED**; weights remain **NONE**; training is not ready.
Historical **54 executions + 54 reruns** and old pins remain unchanged.
Lead-reported preliminary checks: **571 arena tests passed; 2 live-pin checks deferred against locked history; 92 hermetic tests passed**.
Those deferred tests are not fake passes. This spec pass runs no tests.
Fresh full-core/static verification remains pending; the lead's core check is in progress.
No fresh **426 core** result, both-typecheck completion, image, publication, or measured new pin is claimed.

## R0 goals and ordered closure gate

1. Obtain full implementation adversarial **and security pre-freeze reviews READY: yes**.
2. Freeze the reviewed source/tests/control/dependency capture and build a **new image**.
3. Verify infrastructure with **actual Docker**, full core/arena suites, and all required static/strict checks.
4. Execute **54 baseline cases + 54 independent reruns** under that frozen image and validate every artifact binding.
5. Publish and reader-validate the new bundle at **`_spec/evidence/ml-adjutant-r0-refresh`**.
6. Obtain full implementation adversarial **and security post-publication reviews READY: yes**.

The fresh host destination is **not created yet** and stays outside captured source.
Runtime working output remains **`/app/_spec/evidence/ml-adjutant-phase2`**.
Preserve Phase 1 original bytes/pins and the existing Phase 2 bundle **in place, immutable**.
Raw evidence at the current historical paths still measures old source, not these repairs.
Review or image failure returns to the repair loop; no gate may substitute for a later one.

## A01–A07 and A11–A15: provisional implementation contracts

The following is the selected implementation report and verification goal, not a closure verdict.
The [policy-contract diagram](../packages/starchess-arena/ml-adjutant-policy-contracts.puml) owns these module boundaries.
Reasoning belongs here and in diagrams, not new source prose; existing module `SPEC:` pointers corroborate coverage.

### Shared larger limits — `evidence-limits.mjs`

`packages/starchess-arena/hermetic/evidence-limits.mjs` is the exact shared limit authority.
These importer/archive limits do not change the watchdog/IPC budgets below.

| Field | Selected limit | Bytes / count |
|---|---|---|
| `fileBytes` | 16 MiB per retained file | 16,777,216 |
| `retainedBytes` | 64 MiB aggregate retained bytes | 67,108,864 |
| `archiveBytes` | 512 MiB archive | 536,870,912 |
| `scanBytes` | 2 GiB scan/expansion budget | 2,147,483,648 |
| `metadataBytes` | 16 MiB metadata | 16,777,216 |
| `entries` | 262,144 entries | 262,144 |
| `pathBytes` | 4096 UTF-8 path bytes | 4096 |

Check bounds before allocation/parsing; charge aggregate budgets during scans and decompression.
Oversize input must fail closed without treating an envelope hash as content validation.

### Archive identity — `tar.mjs`

Use bounded USTAR/PAX scans with Docker-save / OCI-compatible identity binding.
Bind configuration and layer descriptors **positionally** to the ordered `rootfs.diff_ids`.
Repeated identical empty-layer references are allowed only when every position matches the ordered diffIDs.
That allowance never permits duplicate actual tar entry paths; reject those paths.
Verify checksums, sizes, safe paths, metadata, and compressed expansion within the shared budgets.
Compatibility is not a claim to accept every arbitrary OCI layout or computed loader.

### Independent image measurement — `image-measurement.mjs`

Never execute an image-resident binary to measure the image's truth.
Host Docker inspection creates an **unstarted** container, verifies created/not-running/PID 0, and copies bounded tar streams.
The trusted host scans those streams and reconstructs source, installed dependencies, store/tools, and control manifests.
Join measured identity to current capture, build capture, runtime assurance, and export identity before import.
Reap/remove the measurement container and host scratch data without starting its entrypoint.

### Exact importer verification and seven-input validation

`scripts/challenge-import-evidence.mjs` requires **`hermetic-verification-v2`**, exactly eight ordered commands.
Bind executable, cwd, complete argument vector, output paths, stdout/stderr lengths and hashes to actual bytes.
Independently recount Vitest assertions; bind the **full `command.tests.path`** to the exact command output path and hash.
Forged success/counts or changed failure JSON must not qualify after merely updating checksums.

| Command | Required operation |
|---|---|
| 1 | Arena `tsx` challenge CLI: `--suite all --rerun --out /app/_spec/evidence/ml-adjutant-phase2/baseline-report.json`. |
| 2 | Arena `tsx` runs `/app/scripts/challenge-contract-evidence.ts`. |
| 3–4 | Core then arena `tsc -p tsconfig.json --noEmit` in their exact package cwd. |
| 5 | Arena `tsc --noEmit --target ES2022 --module ESNext --moduleResolution Bundler --strict --skipLibCheck`, then all sorted `challenge*.test.ts` plus `observationIsolation.test.ts`, `resourceLedger.test.ts`, `strictRecordedQueues.test.ts` using full arena paths, then **both** `/app/scripts/challenge-contract-evidence.ts` and `/app/scripts/challenge-validate-baseline.ts`. The validator's own extensionless TS imports remain covered. |
| 6–7 | Full core then arena package-bin `vitest run --config /tmp/<package>.vitest.mts --configLoader native --maxWorkers 2 --reporter=default --reporter=json --outputFile /app/_spec/evidence/ml-adjutant-phase2/vitest-<package>.json` in exact package cwd; `<package>` is `starchess-core` then `starchess-arena`. |
| 8 | Trusted **`/usr/local/bin/node --test`** runs arena hermetic `evidence-bundle.test.mjs`, `image-measurement.test.mjs`, and `tar.test.mjs`, in that order from `/app`. |

`scripts/challenge-validate-baseline.ts` receives exactly seven inputs:
`[currentBaseline, originalBaseline, originalVerification, migration, coverage, contract, frozenSourceRoot]`.
Validate the trusted full ordered roster, all **54** row/match/trace identities, authoritative replay, rerun metadata, and normalized hashes.
Recompute full summary/accounting and migration semantic parity against original pinned bytes.
Rebuild source inventory from the captured root; recompute coverage **twice** and require exact full contract equality.
Consistent rerun metadata is not independent proof that a rerun happened; the fresh execution gate remains mandatory.

### Lexical source audit — A06/A07

`sourceInventory.ts` now uses lexical binding identities and a fixed-point alias scan.
It supports static types, transparent wrappers, namespace identifiers, and supported literal loader calls.
Fail closed on unsupported loader escapes/computed calls and unknown-extension CommonJS execution.
Hashing a helper without auditing its executable edges does not establish partition isolation.

### Selected publication — `evidence-bundle.mjs`

Executor selected **completion-marker publication**, not an atomic pointer or native directory rename.
Claim the destination with exclusive `mkdir`; write/fsync every file and a canonical inventory-marker temporary file.
Sync deep nested directories first, then the bundle root **before** committing the marker.
An exclusive atomic hardlink to **`.publication-complete`** is the **logical commit**.
Unlink the temporary marker, then sync the bundle root and destination parent.
Directory contents may be visible before commit; **atomic directory visibility is not claimed**.
Readers require the completion marker, closed schema, canonical inventory, exact lengths/hashes, and no extra/missing artifacts.
Precommit cleanup may remove only the publisher's own claimed destination, never a raced-in competitor.
Postcommit failures retain committed bytes and report structured state/phase/target with durability **unconfirmed**.
The trust boundary requires a canonical parent and private host-owned ancestor without malicious same-UID mutation.

### Same-generation tests and narrow historical normalization

Tests use **`HERMETIC_OUTPUT_DIRECTORY`** for runtime working output with **no fallback** to host history.
On the host, prefer the fresh R0 directory when it exists and require marker validation; otherwise use the locked historical Phase 2 pinned fixture.
An existing incomplete/invalid fresh directory fails; it must not silently fall back to old evidence.
The two legacy live-pin comparisons remain explicitly deferred until fresh evidence exists.

For historical semantic parity, normalize away **only** trace-owned `rejectedQueue` on a **corpus White queue-rejection** after validating equality with the trusted trace.
Preserve `sourcePlyIndex` and all nonrecorded-side rejection witnesses.
This removes redundant validated witness bytes, not a changed rejection rule or rewritten historical semantic hash.

## Four useful terms

| Term | Plain-English meaning / analogy |
|---|---|
| Watchdog | A timer in the supervising parent process; a referee's stopwatch outside the player's control. |
| Worker | The child process doing match work; the player whose work the parent checks. |
| Corpus | The pinned collection of recorded games; an approved exercise book, not an arbitrary submitted answer. |
| Integrity | An authoritative check of execution and identity; checking the working, not just the final answer. |

## A08: Checked steps with fixed decision deadlines

**Concept.** A status announcement says what the worker claims it is doing; it does not prove progress.
A **state machine** allows only the expected next steps, like a checklist whose boxes require evidence.
**[Inference] The historical R0 review reported that changed phase/ordinal/turn/side announcements could renew or clear a stalled plan's timer.**
This is a source-derived counterexample, not an executed exploit.

| Choice | Direction and trade-off |
|---|---|
| **Selected: checked steps, fixed deadlines (recommended)** | Validate progress before advancing; keep existing per-decision budgets. |
| Not selected: parent-owned per-decision requests | Parent explicitly requests each decision; requires larger orchestration changes. |
| Not selected: additional fixed whole-window deadline | Bounds the entire window separately; scope and budget need approval. |

**Selected boundary.** Identify each decision by match + `planningOrdinal` + side (`DecisionIdentity`).
Use one fixed **10-second deadline for that policy decision**; repeated or changed status cannot renew or clear it.
Advance to the next side only after a checked decision-result payload consistent with admission/resolve.
Advance the planning ordinal only after authoritative parent-validated settlement.
Chip plies, including a terminal chip, do not consume a planning ordinal or invent another decision.
Contradictory phase messages are protocol errors. Repeated matching status cannot renew a deadline.

Implemented transport is `challenge-worker-v2`.
The parent arms a `process.hrtime.bigint()` deadline before writing each permit.
The child waits for that permit before preparing the corresponding policy or opponent decision.
A matching decision received at or after the deadline is a plan timeout.

Preserve startup **10 seconds**, each candidate **or** strategic plan **10 seconds**, and match **300 seconds after ready**.
No additional window deadline or invented 20-second budget is selected.
Preserve the existing planning, ply, proposal, message, and pre-parse frame caps.
Node timers do not promise millisecond-real-time scheduling; check elapsed time and reject even a matching reply received late.
Kill and reap a blocked child before returning; retain only validated partial progress.
Both sides still receive the same turn-open precommit observations.
Admission feedback must never request another policy candidate; a rejected selection fails atomically.

**Rereview goals.** Inspect the implemented `packages/starchess-arena/src/__tests__/challengeWatchdog.test.ts` and child fixtures.
Use a real child changing announcements without actual progress; prove the original 10-second decision limit does not move.
Cover unknown/forged steps, late matching replies, terminal chips, and bogus ordinal advances.
Preserve bounded frames, accepted-progress failure counters, and reap-before-return coverage.
Source/tests are provisional; no independent closure proof or fresh-image pass is claimed.

**Readings.** [Challenge §7: budgets and execution](ml-adjutant-challenge.md#7-frozen-artifact-outcomes-and-failure-semantics),
[§8: integrity checks](ml-adjutant-challenge.md#8-required-integrity-verification),
[Node timers](https://nodejs.org/api/timers.html#scheduling-timers), and
[Node child processes](https://nodejs.org/api/child_process.html#child-process).

## A09: Host-audited trusted corpus roster

**Concept.** An ID is a label; a hash is a content fingerprint; a manifest is the trusted roster of approved exercises.
A hash identifies bytes, not who deserves trust: a student's fingerprint claim cannot replace the teacher's exercise book.
**[Inference] The historical R0 review reported that standalone integrity could accept relabeled cases or garbage hashes without pinned corpus identity.**
This is a source-derived counterexample, not an executed exploit.

| Choice | Direction and trade-off |
|---|---|
| **Selected: load/audit once, inject trusted context (recommended)** | Host builds an audited roster and validators reuse it. |
| Not selected: re-audit on every validation | Rechecks files frequently; adds repeated file work. |
| Not selected: hash-keyed content-addressed IDs | Makes content identity the lookup key; requires a versioned identity/API change. |

**Selected boundary.** Load and audit the pinned corpus once in a trusted host context.
Build stable lookup for the **18 approved IDs**; recompute expected trace identity from actual audited data.
Compare supplied record identity and consumed White intents against that trusted trace, not the report's self-declared ID/hash.
Reject unknown IDs, relabels, and garbage hashes.
The expected hash anchor is the pinned host manifest, never the worker's claim.
Do not accept a report-supplied `trustedContext` as authority.

Validate the full consumed prefix, including source references, action kind, timing, ordered intents, and planning windows.
Exclude chip plies from planning ordinals; check partial/rejection evidence against the appropriate trusted window.
When the engine reaches terminal early, unused trailing recorded queues remain irrelevant.
Implemented context is an opaque `trusted-execution-context-v1` token. A forged object is not a roster.
Original manifest/hash/source pins stay unchanged.
R1 model inputs must never receive future traces, corpus IDs, or hashes; trust context remains host-private.

**Rereview goals.** Inspect the implemented `packages/starchess-arena/src/__tests__/challengeEvidence.test.ts`.
Reject malformed/unknown IDs, relabels, forged hashes, and tampered trace prefixes using independent audited context.
Cover partial evidence, early terminal with unused trailing queues, action timing/order, and chip ordinals.
Source/tests are provisional; no independent closure proof or fresh-image pass is claimed.

**Readings.** [Pinned manifest](../corpora/ml-adjutant-corpus.manifest.json),
[challenge §8](ml-adjutant-challenge.md#8-required-integrity-verification), and
[Node hashes](https://nodejs.org/api/crypto.html#class-hash).

## A10: Validate first, then four exclusive buckets

**Concept.** The StarChess engine remains the deterministic rules authority through SCFEN and native execution.
From a valid SCFEN, the engine can determine whether the board is terminal and its outcome if so.
That snapshot alone does not prove the action history, resource accounting, approved source intents, or task identity.
The host checks the working and roster, like a teacher counting every assigned exercise after marking it.
**[Inference] The historical R0 review reported that reporting integrity-gated wins but counted losses/draws from labels and failures from stop kind.**
This is a source-derived counterexample, not an executed exploit.

All three offered reporting variants use engine-backed validation:

| Choice | Direction and trade-off |
|---|---|
| **Selected: win / loss / draw / failure (recommended)** | Validate first; assign each scheduled case one exclusive bucket. |
| Not selected: verified outcome × evidence quality | Separates two dimensions; needs a more complex reporting contract. |
| Not selected: append-only validated event journal | Derives reports from checked events; requires larger storage/protocol changes. |

**Selected boundary.** Use the existing integrity reexecution for **every** row before classification.
Core SCFEN parsing, begin/submit/resolve, and `scOutcome` remain the only rules/outcome authority.
Host mineral-ledger, resource/time, trace-binding, and identity checks complement core; neither host nor trainer duplicates the rules engine.
Bind evidence to the trusted expected schedule, not a schedule supplied by the report.
The full roster fixes **N = 54: 18 corpus + 36 live**; approved partial modes fix N to **18 or 36**.

Missing or invalid records count as failure; duplicates earn no extra credit; unexpected rows cannot grow N.
Every schedule anomaly invalidates acceptance and requires failure accounting within the trusted roster.
Each expected case appears exactly once in the buckets: `wins + losses + draws + failures = N`.
A raw JSON outcome label is not a verified board outcome.
An integrity mismatch gives no outcome credit; retain raw claims only as separate diagnostics if useful.
Implemented anomaly rule: missing, duplicate, or mismatched known IDs fail that expected case. Unattributable extra or malformed rows fail the entire selected roster.

For a learner: **9 valid wins + 1 invalid submission = 10 scheduled cases, 1 failure**, not 100% wins after dropping it.
This example sets no new benchmark size or budget.
Phase 4 still requires integrity even for a favorable partial board.
Never score historical labels or force an early host-cap result; never expose validation as a policy rescue channel.
The learned gate remains **18/18 corpus + 36/36 live wins**, semantic reruns, and `fallbackCount = 0`.

**Rereview goals.** Inspect the implemented `packages/starchess-arena/src/__tests__/challengeEvidence.test.ts` reporting regressions.
Cover fake terminal wins/draws/losses, labels contradicting SCFEN, missing/duplicate/unexpected cases, and `sum(buckets) = N`.
Exercise actual engine reexecution and ledger/trace checks, not just pure count fixtures.
`classifyScheduledEvidence`, `expectedSchedule`, and trusted context now implement four-bucket accounting using the same engine APIs.
Source/tests are provisional; no independent closure proof or fresh-image pass is claimed.

**Readings.** [Actual core outcome authority](../../packages/starchess-core/src/outcome.ts),
[challenge §7](ml-adjutant-challenge.md#7-frozen-artifact-outcomes-and-failure-semantics),
[§8](ml-adjutant-challenge.md#8-required-integrity-verification), and
[§9: reports](ml-adjutant-challenge.md#9-reporting-and-evidence-limits).

## Readiness and unchanged boundaries

Use the [roadmap ledger](PLAN-ml-adjutant.md#r0-findings-ledger--full-implementation-post-image-review) for all obligations.
All A01–A15 source repairs remain provisional and **PENDING REREVIEW**; closure proof is **NONE**.
A14 uses the selected shared larger limits; A13 retains bytes after logical marker commit when durability fails.
Follow the ordered pre-freeze review → new image/actual Docker/full suites/static → **54 + 54** → validated publication → post-review gate above.
Keep old evidence and pins immutable. This repair does not refresh the frozen image or authorize training.
R1 design choices remain **SGD + REINFORCE**, five independent seeds, and **1000 episodes per artifact / 5000 total**.
R0–R5 must still close before R6 training; R6–R7 precede learned R8 execution.
