# ML Adjutant — selected execution and evidence revisions

Status: **A08–A10 repairs IMPLEMENTED in source; adversarial/security rereview and fresh evidence refresh PENDING.**
R0 remains **READY TO MERGE: no**. A01–A07 and A11–A15 remain open. Training is not authorized.
These selections repair Phase 1 assurance and its Phase 0 corpus-pin boundary.
Source now contains the selected repairs. They are not rereviewed, evidence-refreshed, or training authorization.
The [R0 ledger](PLAN-ml-adjutant.md#r0-findings-ledger--full-implementation-post-image-review)
remains **READY TO MERGE: no**. A01–A07 and A11–A15 remain open. A08–A10 are repaired pending rereview.
Security rereview remains **UNRECORDED**; weights remain **NONE**; training is not ready.
Historical **54 executions + 54 reruns** and old pins remain unchanged.
Focused arena tests after the repair: **435 passed, 2 failed**. Both failures are stale live-pin equality checks against phase2 evidence.

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
**[Inference] R0 reports that changed phase/ordinal/turn/side announcements can renew or clear a stalled plan's timer.**
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

**Pending tests.** Extend existing `packages/starchess-arena/src/__tests__/challengeWatchdog.test.ts` and its child fixtures.
Use a real child changing announcements without actual progress; prove the original 10-second decision limit does not move.
Cover unknown/forged steps, late matching replies, terminal chips, and bogus ordinal advances.
Preserve bounded frames, accepted-progress failure counters, and reap-before-return coverage.
No new fixture or passing result is claimed.

**Readings.** [Challenge §7: budgets and execution](ml-adjutant-challenge.md#7-frozen-artifact-outcomes-and-failure-semantics),
[§8: integrity checks](ml-adjutant-challenge.md#8-required-integrity-verification),
[Node timers](https://nodejs.org/api/timers.html#scheduling-timers), and
[Node child processes](https://nodejs.org/api/child_process.html#child-process).

## A09: Host-audited trusted corpus roster

**Concept.** An ID is a label; a hash is a content fingerprint; a manifest is the trusted roster of approved exercises.
A hash identifies bytes, not who deserves trust: a student's fingerprint claim cannot replace the teacher's exercise book.
**[Inference] R0 reports that standalone integrity can accept relabeled cases or garbage hashes without pinned corpus identity.**
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

**Pending tests.** Extend existing `packages/starchess-arena/src/__tests__/challengeEvidence.test.ts`.
Reject malformed/unknown IDs, relabels, forged hashes, and tampered trace prefixes using independent audited context.
Cover partial evidence, early terminal with unused trailing queues, action timing/order, and chip ordinals.
No new fixture or passing result is claimed.

**Readings.** [Pinned manifest](../corpora/ml-adjutant-corpus.manifest.json),
[challenge §8](ml-adjutant-challenge.md#8-required-integrity-verification), and
[Node hashes](https://nodejs.org/api/crypto.html#class-hash).

## A10: Validate first, then four exclusive buckets

**Concept.** The StarChess engine remains the deterministic rules authority through SCFEN and native execution.
From a valid SCFEN, the engine can determine whether the board is terminal and its outcome if so.
That snapshot alone does not prove the action history, resource accounting, approved source intents, or task identity.
The host checks the working and roster, like a teacher counting every assigned exercise after marking it.
**[Inference] R0 reports that reporting integrity-gates wins but counts losses/draws from labels and failures from stop kind.**
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

**Pending tests.** Extend existing `packages/starchess-arena/src/__tests__/challengeEvidence.test.ts` for reporting.
Cover fake terminal wins/draws/losses, labels contradicting SCFEN, missing/duplicate/unexpected cases, and `sum(buckets) = N`.
Exercise actual engine reexecution and ledger/trace checks, not just pure count fixtures.
A proposed `caseSchedule` helper/context and four-bucket API remain unfrozen and must reuse the same engine APIs.
No new helper, fixture, or passing result is claimed.

**Readings.** [Actual core outcome authority](../../packages/starchess-core/src/outcome.ts),
[challenge §7](ml-adjutant-challenge.md#7-frozen-artifact-outcomes-and-failure-semantics),
[§8](ml-adjutant-challenge.md#8-required-integrity-verification), and
[§9: reports](ml-adjutant-challenge.md#9-reporting-and-evidence-limits).

## Readiness and unchanged boundaries

Use the [roadmap ledger](PLAN-ml-adjutant.md#r0-findings-ledger--full-implementation-post-image-review) for all obligations.
A01–A07 and A11–A15 have source repairs pending rereview. None is closed. A14 reuses the existing 16,777,216-byte completion cap. A13 keeps a committed destination if parent durability fails.
After repairs and source/image freeze, refresh whole-code/test evidence, core/arena suites, strict TypeScript,
infrastructure including actual Docker, **54 executions + 54 reruns**, and full adversarial/security rereviews **READY: yes**.
Keep old evidence and pins immutable. This repair does not refresh the frozen image or authorize training.
R1 design choices remain **SGD + REINFORCE**, five independent seeds, and **1000 episodes per artifact / 5000 total**.
R0–R5 must still close before R6 training; R6–R7 precede learned R8 execution.
