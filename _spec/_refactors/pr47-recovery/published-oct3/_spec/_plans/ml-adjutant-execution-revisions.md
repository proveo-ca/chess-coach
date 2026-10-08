# ML Adjutant — selected execution and evidence revisions

Status: **R0 CLOSED within accepted non-learned execution/evidence assurance.**
Scope of the completed gates/results below: **immutable historical R0 generation**, not the changed R2 source graph.
The [accepted R2 V3 amendment](ml-adjutant-r2-generator-v3.md) now owns implementation IN PROGRESS and pending fresh three-package assurance: inventory V2, execution pins V3, exact eleven-command hermetic verification V3, baseline/contract/migration V2, and `_spec/evidence/ml-adjutant-r2-refresh`. No old evidence bytes or closure IDs are changed; no fresh R2 passing result is claimed.
All **A01–A15 CLOSED**; original **7 HIGH + 8 MEDIUM** remain recorded as historical findings.
These selections repair Phase 1/2 assurance and the Phase 0 corpus-pin boundary.
Closure joins source repairs, new frozen verification, validated publication, and final reviews; it is not training authorization.
The [R0 ledger](PLAN-ml-adjutant.md#r0-findings-ledger--full-implementation-post-image-review)
now references unchanged [closure JSON](../evidence/ml-adjutant-r0-closure.json) as current authority.
Final adversarial `ses_efe0ed67dffew2su1gZIUaDy23` and security `ses_efe0ed520ffeOEg3kd6jAtN33i` both returned **READY TO CLOSE R0: yes**.
Reviewers read source/captured records without independently recomputing hashes or executing tests.
Weights remain **NONE**; training is not ready. This spec pass runs no tests and changes no evidence.
Current frozen result: **426/426 core, 689/689 arena**, zero failed/pending/todo; **107 Node tests**, no failures/skips.
All **8 exact commands**, including **3 static checks and both scripts**, passed; **54 executions + 54 semantic reruns**, migration parity true.
Actual Docker infrastructure passed **5/5**, no skips, on the new dependency image.
Host post-publication checks passed **13/13**, no skips, including both live source-pin comparisons previously deferred against history.

## R0 ordered closure gate — completed

1. **Completed:** full implementation adversarial and security pre-freeze READY reviews.
2. **Completed:** reviewed source/tests/control/dependency freeze and new image build.
3. **Completed:** actual Docker infrastructure, full core/arena suites, and required static/strict checks.
4. **Completed:** **54 baseline executions + 54 independent reruns** under the frozen image with artifact bindings validated.
5. **Completed:** publication and reader validation at **`_spec/evidence/ml-adjutant-r0-refresh`**.
6. **Completed:** final adversarial and security post-publication **READY TO CLOSE R0: yes** reviews.

The fresh host destination is **published**, stays outside captured source, and holds **24 artifacts**.
Lead reports marker commit and confirmed durability; marker SHA-256 is
`33ac25cc582ee154179b3321091368858a6c0d65ee36df4eec02e85f8ff1d34d`.
Current source image: `sha256:3550d1cc2b98d9ae757937a9e45e1ba89b6e84459106a491a61af9e183968f72`.
New dependency image: `sha256:8c5f7da07b82554325e64b8c99f36fa43ac213b470f8537a819ff464c2f657d6`.
Captured source SHA-256: `b2b9e360fd5c2ecc0fbad667d5155ac56c3efd8603f3c09941982dadc5372147`.
[Current verification](../evidence/ml-adjutant-r0-refresh/verification.json) records the exact eight command vectors and artifact inventory.
[Current image assurance](../evidence/ml-adjutant-r0-refresh/image-assurance.json) binds the retained build/run/export envelopes.
See [roadmap identity table](PLAN-ml-adjutant.md#r0-closure--current-frozen-evidence) for exact image/archive sizes, archive hash, and Node binary pin.
Runtime working output remains **`/app/_spec/evidence/ml-adjutant-phase2`**.
Preserve Phase 1 original bytes/pins and the existing Phase 2 bundle **in place, immutable**.
Evidence at historical Phase 1/2 paths still measures its old source, not these repairs.
Review or image failure returns to the repair loop; no gate may substitute for a later one.
Preserve failed run `/tmp/opencode/starchess-hermetic-run-Bv2jRa`; lead records a default 5s test timeout, unchanged assertions, then a 30s test timeout, clear source rereviews, and new passing freeze/build.
Fixed policy deadlines remain unchanged. Executor approved `_spec/evidence` private ancestor mode **0700**; historical file bytes remain unchanged.
Later captured-source edits restart freeze/verification; this docs-only update touches no captured file.

## A01–A07 and A11–A15: reviewed implementation contracts

The following states the implementation contracts verified under current R0 closure, not a trained-model contract.
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
Pin the official base Node **22.23.2** binary SHA-256 to `3517c2df0b2f8cd7f422b4b8450ef81c6889f08eb03e281d6de9079b15e6a327`.
The retained export measures that binary at **124836408 bytes**, approximately **124.84 MB**; it is not the image/archive byte count.
Host-copied binary bytes and dependency/store/tool/source/control trees establish the measurements; image-resident Node/proxy JSON self-claims do not.
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
`createRequire` accepts the module's own `import.meta.url`; only `hermetic/closure.mjs` has the reviewed literal `/app/packages/starchess-arena/package.json` anchor, restricted to external-only loader edges.
The declared esbuild/tsx resolution expression and supervisor's exact tsx resolver remain narrow reviewed seams, not general computed-loader permission.
Conservatively reject unsupported loader APIs/alternate factories, import-metadata writes/escapes, string evaluation, reflective constructor acquisition, wrapper/type-erasure escapes, mutable receiver aliases, and unsupported destructuring.
The sole descriptor-call seam is existing `challengeContract/validation.ts` array validation: exactly `Object.getOwnPropertyDescriptor(value, String(index))`, with dense own data-index checks.
That exception does not authorize arbitrary descriptor/constructor access. Static policy checks do **not** prove arbitrary-JavaScript sandboxing.

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
Fresh evidence now exists; both live source-pin comparisons passed in the **13/13** post-publication host checks, no skips.

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

**Verified obligations.** `packages/starchess-arena/src/__tests__/challengeWatchdog.test.ts` and child fixtures belong to the passing frozen arena suite.
Use a real child changing announcements without actual progress; prove the original 10-second decision limit does not move.
Cover unknown/forged steps, late matching replies, terminal chips, and bogus ordinal advances.
Preserve bounded frames, accepted-progress failure counters, and reap-before-return coverage.
**A08 CLOSED**, with current frozen verification and both final reviews recorded in [closure JSON](../evidence/ml-adjutant-r0-closure.json).

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

**Verified obligations.** `packages/starchess-arena/src/__tests__/challengeEvidence.test.ts` belongs to the passing frozen arena suite.
Reject malformed/unknown IDs, relabels, forged hashes, and tampered trace prefixes using independent audited context.
Cover partial evidence, early terminal with unused trailing queues, action timing/order, and chip ordinals.
**A09 CLOSED**, with current frozen verification and both final reviews recorded in [closure JSON](../evidence/ml-adjutant-r0-closure.json).

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

**Verified obligations.** `packages/starchess-arena/src/__tests__/challengeEvidence.test.ts` reporting regressions belong to the passing frozen arena suite.
Cover fake terminal wins/draws/losses, labels contradicting SCFEN, missing/duplicate/unexpected cases, and `sum(buckets) = N`.
Exercise actual engine reexecution and ledger/trace checks, not just pure count fixtures.
`classifyScheduledEvidence`, `expectedSchedule`, and trusted context now implement four-bucket accounting using the same engine APIs.
**A10 CLOSED**, with current frozen verification and both final reviews recorded in [closure JSON](../evidence/ml-adjutant-r0-closure.json).

**Readings.** [Actual core outcome authority](../../packages/starchess-core/src/outcome.ts),
[challenge §7](ml-adjutant-challenge.md#7-frozen-artifact-outcomes-and-failure-semantics),
[§8](ml-adjutant-challenge.md#8-required-integrity-verification), and
[§9: reports](ml-adjutant-challenge.md#9-reporting-and-evidence-limits).

## Readiness and unchanged boundaries

Use the [roadmap ledger](PLAN-ml-adjutant.md#r0-findings-ledger--full-implementation-post-image-review) for all obligations.
All **A01–A15 CLOSED**, supported by the [current closure authority](../evidence/ml-adjutant-r0-closure.json).
A14 uses the selected shared larger limits; A13 retains bytes after logical marker commit when durability fails.
The ordered pre-freeze review → new image/actual Docker/full suites/static → **54+54** → validated publication → post-review gate above is complete.
Keep old evidence and pins immutable. The refreshed R0 image does not authorize training.
R1 design choices remain **SGD + REINFORCE**, five independent seeds, and **1000 episodes per artifact / 5000 total**.
R0 is closed; the R1 calibrated turn-aware economic amendment and R2–R5 readiness must close before explicit R6 approval.
The public opening remains **4 deployed + 3 banked = 7**, CC excluded and endowed paid basis zero; it is future H=1 belief work, not native provenance frames or H3 search.
Prior v2 **370** fields remain design-frozen, not a supplied calibrated model. R6–R7 precede learned R8 execution; registry `machine-learning` stays disabled.
Trusted host/daemon and no malicious same-UID mutation remain assumptions; retained host envelopes/archive stay under `/tmp/opencode`.
