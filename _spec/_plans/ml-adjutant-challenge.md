# ML Adjutant — strict recorded-queue and live strategic challenge

Status: **PLANNED; no executable compatibility, trained artifact, or win-rate result yet.**
Owner roadmap: [PLAN-ml-adjutant.md](PLAN-ml-adjutant.md).
This document defines acceptance, not implemented behavior.

## 1. Decision and scope

Executor chose **18 current cases** and **STRICT RECORDED QUEUES**.
Blue = White = exported player = `w`; the corpus candidate is Black/Red = `b`.
Beat BOTH the recorded White corpus and separately executing live strategic.

The supposed 18+100 exports do not establish an available 118-case dataset.
The lead's workspace/parent glob and tracked-inventory audit found only the named export below.
Do not invent a missing path or silently change the denominator. A future 118-case challenge
requires locating and auditing the actual additional exports, checking duplicates and executable
compatibility, and approving a new pinned manifest/version.

Required initial claim:

```
18/18 terminal candidate wins against strict recorded White queues
AND 36/36 terminal candidate wins against live strategic
AND all integrity tests pass
AND learned-policy fallbackCount == 0
```

This is a finite benchmark claim, not a universal guarantee. Strict replay may be infeasible
against some counterplay; preserve that fact as a failure rather than relaxing the contract.

## 2. Corpus provenance and completed audit

| Field | Pin / lead-reported audit result |
|---|---|
| Available source | Repo-root `starchess-match-history-20260929-203446.json` |
| SHA-256 | `e6770cb032aa76dc05432c7a49e61c4905d1a1f7b859aa860a090821213e7ae6` |
| Bytes / export version | 664540 / 1 |
| `exportedAt` | `2026-09-30T03:34:45.997Z` |
| Case identity | 18 unique IDs, all player `w`, all opponent `strategic` |
| Historical outcomes | 17 white wins, 1 draw; provenance only, never candidate scores |
| Trace/opening diversity | 18 unique white trace hashes, 1 canonical opening |
| Settlement counts | 340 settled plies, including 58 `ev-begin` chip plies; 282 planning windows |
| White action count | 576 total: classical 266, stimStep 113, deploy 132, spiderMine 40, siegeMode 23, tacticalJump 2 |

Canonical opening, exact:

```text
SCFEN|4k3/2pppp2/8/8/8/8/2PPPP2/4K3|0|33|P|G:11:11|B:3:3|Q:w:;b:
```

The lead ran current-core `historyFromRecord`, `parseScFen`, `scsanOf`, and `scOutcome` checks:
358 raw snapshots parse; 358 repaired snapshots decode; all 18 histories align; all 18 SC-SAN
comparisons match exactly; all 18 terminal result labels match. Record repair and decode are
not action admission or simulation. No current-rule queue reexecution, training, baseline
benchmark, or learned challenge run has occurred.

The [manifest](../corpora/ml-adjutant-corpus.manifest.json) pins all 18 actual IDs, source
provenance, extraction version, canonical opening, source ordering, and White trace hashes.
White queues remain source references rather than duplicate action payloads. Filter the referenced
resolve queues by planning ordinal using the manifest's extraction contract.
Keep IDs and source results host-side for reports; do not expose them as candidate features.
Preserve the original export unchanged and fail audit on any pin/count mismatch.

## 3. Selection and exhaustive scheduling

**Sample-one mode** selects a trace privately and uniformly using:

```text
index = floor(mulberry32(selectionSeed)() * 18)
```

This defines uniform index selection under a uniform RNG output, not equal coverage for every
small seed batch. The host maps the index through the pinned manifest order. The candidate
receives no case ID, index, selection seed, future trace, or historical result.

Keep training selection on a separate seeded RNG stream from gate selection, arena seat RNGs,
and inference. Log seeds host-side. Random sampling is training/smoke-test support only.
Exhaustive gate mode iterates all 18 manifest cases exactly once, not 18 random draws.
Pin corpus arena seed 0 and inference seed 0 per match for the initial gate.

## 4. Strict recorded White adapter

### Extraction and indexing

- Start each case at its recorded `scfens[0]`; the audited cases share the canonical opening.
- Extract only White's recorded action intents. Never replay historical Black queues.
- Index queues by **planning-window ordinal**, excluding `ev-begin` chip plies. Do not index
  by raw snapshot offset or `turn`: a terminal chip can advance the turn without planning.
- Preserve each White action's intent fields, timing, and stable relative order. Strip source
  `seq` and let the host assign fresh sequence numbers in a pinned deterministic merge order.
- Preserve an explicit recorded empty planning queue if present; distinguish it from missing
  data or exhaustion. Do not infer a pass from a missing record.

### Execution against a diverging board

1. Process authoritative turn-open checks and record any chip resolve.
2. Call `scOutcome` on the current board before requesting another White queue or candidate plan.
3. If already terminal, score the actual outcome; unused trailing recorded queues are irrelevant.
4. Otherwise derive both sides' inputs from the same turn-open precommit state.
5. Stage White's next entire recorded queue on a private copy through `addScAction`, including
   gas checks and explicit host mineral affordability. Validate the candidate's selected queue
   separately against its own turn-open resources.
6. Only after successful full-queue validation, commit both staged queues and bank spends in
   stable host order, assign sequences, and resolve simultaneously through current core rules.
7. Thread settlement, gas, bank/income, and authorized side memories forward; check terminal
   after settlement. Increment the White planning ordinal only for a consumed planning window.

Never reset the historical board, resources, or future bank after divergence. Do not copy
historical SCFENs over the live board to make later intents fit. The recorded actions remain
intents, not guaranteed historical effects.

### Atomicity and resources

If any White action fails admission, reject the **whole queue** and fail the case with its
ordinal, action position, and engine/resource reason. Roll back all staged actions and debits.
Never drop an illegal suffix, skip a captured actor, substitute strategic play, or accept the
remaining prefix. The same atomic admission/resource rules apply to the chosen candidate queue.

Reconstruct the host mineral bank from opening `B:3:3`, then apply actual deploy spends and
current income rules over the new execution. Historical future balances are not an oracle.
The host must prove affordability before debit; a helper clamping an insufficient bank to zero
is not evidence that a deployment was legal. Track gas through authoritative current-core rules.

An admitted action may fail to achieve its intent during simultaneous resolution, for example
because the opponent moved or captured its actor in that same resolution. Record that effect;
it is not itself a trace-admission failure. By contrast, a historical actor already missing at
the next queue's admission can make strict replay fail. Report it without redefining a win.

Exhaustion while `scOutcome` is `null` fails, even if material or HP favors the candidate.
Terminal-first evaluation prevents a real terminal win from being mislabeled exhaustion.

## 5. Turn-open observation and candidate isolation

Current `packages/starchess-arena/src/run/runMatch.ts` plans `w` then `b`, mutating the snapshot
and debiting White's bank before Black's call. `SideContext` also carries both banks and a full
snapshot. Those are host execution seams, not an authorized ML input contract.

The new benchmark adapter must snapshot turn-open state once and derive both side views before
either plan commits. White's recorded queue stays private while Black chooses. Live strategic
also plans from the precommit snapshot/context, not the opponent's updated queue or spend.
The host may validate/merge in stable order afterward; it must not feed that intermediate state
back into the same-window policy. Keep strategic's existing pinned algorithm and feed-off
configuration; do not silently replace it with a different learned opponent.

The model-facing observation includes only own facts, permitted visibility/public facts, own
resources, and side-authorized memory/belief history. Exclude:

- Full unfogged enemy placement and hidden mines or other hidden-state fields.
- Current opponent queue, opponent bank, and same-window gas/spend deltas.
- Future White intents, future historical snapshots, trace identity/index, timestamps, export
  metadata, source result labels, and manifest/source paths.
- Candidate membership, ordering, strategic scores, features, or legality masks derived from
  hidden full-state facts. Removing hidden observation channels alone is insufficient.

For two host states with the same authorized side observation and authorized history, assert
equal encoded features, candidate membership/order/scores, and learned inference outputs under
the same inference seed. Vary hidden placement/mines, enemy queue/bank, and record metadata.
Candidate generation must use authorized inputs; audit any reuse of `strategicCandidates`.
Do not give the policy repeated hidden-state admission probes or select another candidate using
a hidden admission response.

The policy ranks observation-safe proposed queues; enumeration does not guarantee legality.
Host `addScAction`/gas/mineral checks remain authoritative. In the learned gate a rejected
selected queue fails the match, rather than trying a replacement candidate or strategic fallback.

## 6. Separate live strategic suite

Execute the pinned `strategicScript` with `feed = null` and `movetimeMs = 0` against the frozen
candidate. Do not reuse the historical opponent's actions or infer live strength from corpus wins.
Use the canonical opening and numeric arena seeds `0..17` in each pairing:

| Pairing | Seeds | Matches |
|---|---|---|
| Candidate `w`, live strategic `b` | 0 through 17 | 18 |
| Live strategic `w`, candidate `b` | 0 through 17 | 18 |
| Total | Both seats per numeric seed | 36 |

The arena seat RNG convention is `w: mulberry32(seed)`, `b: mulberry32(~seed)`.
Paired matches share the **numeric arena seed**, not identical streams swapped between players.
Keep selection and training RNG streams separate. Reset candidate inference seed 0 per match.
The isolated precommit adapter is required in both suites, regardless of the candidate's seat.

## 7. Frozen artifact, outcomes, and failure semantics

Pin before gate execution:

- Manifest/source hashes and extraction/repair version.
- Candidate artifact SHA-256, training provenance, and learned-ranker configuration.
- Core rules revision, benchmark adapter revision, and strategic script revision.
- Observation/feature and candidate enumeration/ordering versions.
- Opening, complete schedule, arena RNG convention, and inference seed 0 per match.
- Numerical inference/match watchdog budgets in versioned harness configuration.

No model updates, configuration tuning, trace replacement, or strategic candidate fallback may
occur within the gate. A changed artifact/configuration requires rerunning the whole gate.
Missing model/runtime or nonfinite scores fail; product fallback cannot earn learned wins.

Count a win only when authoritative current-core `scOutcome` names the candidate as winner at
an actual terminal board. This includes genuine turn-45 HP wins under core rules. Do not return
historical labels, award a win for favorable material, or force an early host-cap outcome.

Every draw, loss, exception, queue/resource rejection, timeout, premature stall, and preterminal
exhaustion fails the required case. A `stall`/aborted record is not a win even if a host synthesizes
an outcome. Emit an explicit reason and retain every scheduled case in the denominator.
Integrity failures invalidate acceptance even if all match result labels say "win".

Deterministic reruns compare normalized `scfens`, resolve payloads, and terminal results.
Exclude generated match/record IDs and timestamps from semantic equality; preserve those fields
as provenance. Same pins and seeds must reproduce the same semantic executions.

## 8. Required integrity verification

`packages/starchess-arena/src/__tests__/corpusManifest.test.ts` persists the provenance/codec audit.
The executable challenge checks below remain **PLANNED**, not completed tests. Proposed test paths and phase ownership are
listed in [PLAN-ml-adjutant.md](PLAN-ml-adjutant.md#planned-verification-and-pending-ownership).

| Check | Required adversarial cases |
|---|---|
| Provenance and selection | Bad hash/count, duplicate ID/trace, deterministic sample mapping, private index, exhaustive iteration with no omission/duplication. |
| Extraction | Chip vs planning ordinal, terminal chip advancing turn, action timing/order preserved, source seq replaced, explicit empty queue distinct from missing data. |
| Strict atomicity | Rejected first/middle/last action, gas shortfall, insufficient minerals, captured historical actor, whole-queue rollback, no substitution or dropped action. |
| Settlement vs admission | Admitted intent frustrated by simultaneous opponent action does not become a trace-invalid report; later missing-actor admission fails explicitly. |
| Ledger | Opening bank 3:3, actual deployment debits and current income, divergence without historical bank reset, clamped debit cannot prove affordability. |
| Terminal/exhaustion | Candidate terminal win before next queue request, terminal chip, trailing unused queues, preterminal exhaustion, actual 45-turn HP win/draw, premature host cap. |
| Observation/candidate leakage | Same authorized history with hidden enemy placement/mines changed, enemy bank/queue changed, metadata/future trace changed; invariant features and candidate membership/order/scores. |
| Simultaneous input isolation | Both views derived before commits; candidate in both seats cannot observe prior same-window queue, gas, or bank delta. |
| Learned execution | Artifact frozen, inference seed reset, weight updates absent, no missing-model rescue, no strategic replacement or next-candidate rescue after rejection, fallback count zero. |
| Determinism and schedule | Semantic rerun equality, exact 18+36 schedule, feed off, seat RNG convention, all failures retained in denominators. |

## 9. Reporting and evidence limits

Publish the pins and integrity results with one row per corpus case and per live seed/seat.
Include candidate side, actual terminal outcome or failure reason, planning ordinal/failed
action where applicable, fallback count, and reproducibility result. Report historical source
outcomes separately from executed outcomes. Keep private metadata in host reports, not policy inputs.

If all clauses pass, say **100% wins on the pinned 18-case corpus and 36-match live strategic
suite**. If any clause fails, say FAIL and identify it; do not exclude the failing case to retain
a 100% headline. A random successful sample cannot establish the exhaustive claim.

These 18 cases may be used for training and regression. Prevent metadata/game-ID memorization,
but do not call this training-used suite held-out generalization evidence. Separate future
held-out exports/openings/seeds are needed for broader claims. Optional Elo or RLHF experiments
cannot replace this gate or supply a missing win. No executable PASS is currently claimed.
