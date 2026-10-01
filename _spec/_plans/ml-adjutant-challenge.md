# ML Adjutant — strict recorded-queue and live strategic challenge

Status: **Phase 1 IMPLEMENTED and VERIFIED in `packages/starchess-arena` by tests and persisted
baseline executions; both Phase 1 reviews READY: yes. Phase 2 hermetic verification PASSED.
This is not a learned PASS. Post-image adversarial and security rereview is not yet recorded.
Phase 3+ PLANNED and unimplemented.**
Owner roadmap: [PLAN-ml-adjutant.md](PLAN-ml-adjutant.md).
Harness boundary: [ml-adjutant-challenge-harness.puml](../packages/starchess-arena/ml-adjutant-challenge-harness.puml).
Policy-contract boundary: [ml-adjutant-policy-contracts.puml](../packages/starchess-arena/ml-adjutant-policy-contracts.puml).
FIRST-training/weights contract: [ml-adjutant-weights.md](ml-adjutant-weights.md).
This document defines learned acceptance and records the separately verified non-learned baseline.
The lead reports adversarial READY: yes with no remaining findings and security READY: yes
for the trusted non-learned scope. No trained artifact or learned PASS is claimed.

## 1. Decision and scope

The accepted plan uses **18 current cases** and Executor selected **STRICT RECORDED QUEUES**.
Blue = White = exported player = `w`; the corpus candidate is Black/Red = `b`.
Beat BOTH the recorded White corpus and separately executing live strategic.

The earlier workspace/parent and tracked-inventory audit found only the pinned export below.
Executor now reports external `/starchess-match-history-20260922-222825.json` was found and
parsed: **96 games, not the previously described 100**. Only its count is reported; its hashes,
IDs, duplicates, provenance, rules, and executable trace compatibility remain unaudited.
Do not silently add those games, infer a 118-case dataset, or change manifest v1. Any expansion
requires a separate audit and approved new pinned manifest/version. The denominator remains
**18 corpus cases and 36 live strategic matches**.

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
358 raw snapshots parse; 358 repaired snapshots decode; all 18 snapshot/resolve cardinalities align; all 18 SC-SAN
comparisons match exactly; all 18 terminal result labels match. Record repair and decode are
not action admission or simulation. Phase 1 now supplies separate current-rule baseline execution
and rerun evidence below; it includes strict queue-rejection failures. Training remains unimplemented.

The [manifest](../corpora/ml-adjutant-corpus.manifest.json) pins all 18 actual IDs, source
provenance, extraction version, canonical opening, source ordering, and White trace hashes.
White queues remain source references rather than duplicate action payloads. Filter the referenced
resolve queues by planning ordinal using the manifest's extraction contract.
Keep IDs and source results host-side for reports; do not expose them as candidate features.
Preserve the original export unchanged and fail audit on any pin/count mismatch.
Preserve manifest `audit.currentRuleReexecution = "pending"` and
`audit.candidateWinrate = "not measured"` as the original Phase 0 historical audit statuses.
The persisted [baseline-report.json](../evidence/ml-adjutant-phase1/baseline-report.json)
**supersedes those pending statements separately for this measured Phase 1 baseline**.
It does not rewrite historical audit statuses, establish universal trace compatibility, or create
a new corpus manifest version. [verification.json](../evidence/ml-adjutant-phase1/verification.json)
binds the raw report hash to actual integrity-test paths, hashes, purposes, and static commands.

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

Live strategic remains a trusted host-side opponent with its existing algorithm and context.
This is distinct from the non-learned candidate baseline, which must obey the same observation-safe
proposal interface as the learned candidate. An unchanged full-snapshot strategic candidate does
not prove this interface honest. Phase 1 owns the minimal interface; phase 2 adds numeric features.

Arena Phase 1 implements that boundary in `src/challenge/observation.ts` and `baseline.ts`.
`baseline-v1` ranks classical singleton queues, Marine deployment singleton queues, and pass
using only authorized observed occupancy, own modes/mines/resources, fixed heuristic scores,
and canonical-key tie-breaking. It does not reuse strategic candidates, learn weights, or obtain
alternate proposals from hidden admission results. A selected rejection fails the case.
Candidate memory is sightings-only, separate from opening-seeded strategic KVS and other
host-private strategic ledgers; those ledgers must not supply candidate history.
Phase 2 codecs/numeric features exist, and hermetic verification passed; training, learned models/artifacts,
and browser integration remain unimplemented. These new contracts do not expand `baseline-v1` generation.
Phase 1 emits `modelArtifact = null`, `learnedGateEligible = false`, `fallbackCount = 0`;
baseline performance validates plumbing and comparison only, never learned acceptance.

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

### Phase 2 contract and FIRST-training boundary

Inspected `src/challengeContract/{validation,observationCodec,candidateCodec,features,coverage}.ts`
versions strict observations, ordered candidate intents, requested own spend, canonical ranking, and named features.
Current dimensions are observation **1623**, action row **64**, ranker **158**; weights **NONE**.
`baselineScore` is handcrafted, not learned and not a feature. The codec supports seven kinds;
the generator covers only classical singletons, Marine deployment singletons at B, and pass.
The **65-action encoding limit** proves neither legality nor exhaustive combinations.

Executor chose **Broader first trained ranker**, not training directly on these minimal v1 summaries.
Before FIRST Phase 3 training, freeze a separately versioned combination generator and v2 economic/positional
interactions, own paid-investment/loss lineage ledger, and confirmed opponent-loss lower bounds with uncertainty.
Weights are shared named-feature coefficients `s_w(h,c)=wᵀφ_version(h,c)`, never one entry per move or tree node.
Observation-constant terms cancel in linear comparisons, so context must interact with candidate features.
Rules/gas/mineral costs are never learned. Exact v2 names/dimensions/budgets remain unsettled until freeze.

Start at **H=1**. A separate future milestone covers conditional plans across up to **three simultaneous
planning windows** using future authorized observations, history, and belief/opponent hypotheses.
Chips do not consume planning ordinals. Distinguish exact conceptual domains from finite versioned beam budgets;
ban future traces, actual private queues, full hidden state, and policy-side hidden admission probes.

Distinguish requested spend, actual own paid investment lost, and replacement value; endowed opening units
and free promotions are not paid investments. Opponent fog disappearance is not confirmed destruction,
and confirmed loss lower bounds never reveal an exact enemy bank or privileged KVS ledger.
Unknown ray blockers remain uncertain, confidence stays categorical without a calibrated forecast,
and exploration novelty proxies are not entropy reduction. The weights contract specifies these requirements.

The proposed training objective uses stable softmax, actual candidate-side outcome/queue-failure rewards,
an action-independent previous-episode-mean baseline, and `L=-A Σ log π + λ||w||²/2`.
Initialization/optimizer/seeds/provenance and an externally hashed, finite, exactly name-aligned artifact remain planned.
No 158-value artifact, trained performance, online updates, model fallback, or registry activation is promised here.

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
- Own-loss/opponent-knowledge versions, v2 names/scales/interactions, separate combination-generator version,
  horizon and finite generation/search configuration before learned evaluation.
- Opening, complete schedule, arena RNG convention, and inference seed 0 per match.
- Numerical inference/match watchdog budgets in versioned harness configuration.

Approved Phase 1 standard configuration is `CHALLENGE_CONFIG` version `phase1-v1`:

| Budget / invariant | Pin |
|---|---|
| Startup deadline | 10000 ms |
| Per candidate/strategic plan deadline | 10000 ms |
| Match deadline after child ready | 300000 ms; progress does not renew it |
| Planning-window cap | 64 |
| Recorded-ply cap, including chips | 128 |
| Proposal cap | 4096 |
| JSONL protocol message cap (`maxIpcMessages`) | 2048 |
| Raw stdout frame cap before `JSON.parse` | 16777216 bytes |
| Progress/non-completion message cap | 1048576 bytes per message |
| Completion message cap | 16777216 bytes per message |
| Merge order | White then Black, preserving each queue's array order; fresh host sequences |
| Inference seed / feed / movetime | 0 / off / 0 ms |

Each side stages independently against the frozen turn-open snapshot and its own opening
resources for that window. The host commits only a successful pair with exact deployment debits
before current income; it verifies strategic's reported spend against admitted costs.
Parent `supervisor.ts` spawns `worker.ts` with **stdin/stdout JSONL pipes**, not a Node
`process.send` channel. It bounds raw frames to 16 MiB before `JSON.parse`, then validates
ready/progress/completion messages and enforces the 1 MiB progress, 16 MiB completion,
2048-message, and 128-ply caps. It uses `SIGKILL` on finish/failure and returns only after
child close/reap. Deadline, protocol, and
crash failures retain validated partial plies with `outcome = null`, not a fabricated win.
Failure counters derive from accepted plies: planning ordinal counts non-chip resolves and
turn comes from the latest accepted `resolve.next`, or the opening when none exists. A crash
before the next phase announcement must not regress these counters.
Startup and match deadlines plus per-plan deadlines bound synchronous loops and unresolved
promises. Repeated identical phase messages do not renew the planning deadline.
`integrity.ts` reexecutes each accepted ply prefix and completion against authoritative full
resolve payloads, resource transitions, and actual terminal outcomes. Forged resolve/resources
or outcomes and `script-contract` failures invalidate execution integrity. Protocol-size/count
caps remain fixed by configuration. Corpus validation binds consumed White queues to the
actual audited trace windows; stop turn and planning ordinal must match reexecuted progress.
Recorded White rejection details must match current-rule staging of that window.
`publication.ts` fsyncs a private temporary file before exclusive hardlink publication, unlinks
the temporary file, and fsyncs the containing directory; it never overwrites an existing report.
Test budget overrides do not establish a standard-budget baseline result.

### Phase 2 pin migration and hermetic execution — verification PASSED

Executor selected partitioned execution pins then a hermetic image, with pull/build downloads approved.
`challenge/sourceInventory.ts` inventories all declared root files in execution (all core and arena source
except contracts, excluding package tests), contracts (`challengeContract`), and diagnostics (root scripts/hermetic).
The AST import audit covers relative/declared external/workspace imports, worker loading, and explicitly supported
loader patterns, including the declared esbuild closure case; it does not certify arbitrary computed loaders.
`challenge-execution-pins-v2` carries partition/config hashes; tests, installed modules, tools, store, and captured
source bytes receive additional hermetic manifests outside the project pin. Do not assert a fixed source count.

Preserve Phase 1 original report SHA-256
`940387370040f88888e9dfe0bb86ad9d4a8be88854df507120f34b22ee2d362b`
and original verification SHA-256
`55d965afa71d775ff6ee1e95b6650a27d0ce759b966a81c43a3bb364236c7508`.
The new Phase 2 baseline ran **54 current executions + 54 reruns** and compared all 54 rows semantically
against the original report using `pinMigration.ts`. Phase 1 evidence was not overwritten.
[pin-migration.json](../evidence/ml-adjutant-phase2/pin-migration.json) records `semanticParity = true`,
`executionIntegrity = true`, and `deterministicRerun = true`.
[verification.json](../evidence/ml-adjutant-phase2/verification.json) records `"passed": true`.
Current baseline SHA-256 is `5de86d94caaa626402b73ac9fa8f6bbc7a9b111e69a8b3801461380635cbd87f`.
The [pre-rename bundle](../evidence/ml-adjutant-phase2-before-diagram-rename/verification.json)
is historical and byte-preserved; the [current bundle](../evidence/ml-adjutant-phase2/verification.json)
records fresh standard hermetic execution after diagram-reference relocation.
The [relocation record](PLAN-ml-adjutant.md#diagram-reference-relocation--historical-versus-current-evidence)
separates archived pins from current pins and records the lead-reported pointer-only proof.

The final source image is `sha256:e7f9ea8ac211c93804bd1125ed28fb7e165a160c4155ca70404c81f9e431710d`.
The lead reports a fresh standard dependency image `sha256:4c9d45b04f325a2d912cb34ebc982f139f057a2f2fb6d779ac2ef59f29ea987d`.
Official Node **22.23.2** bookworm-slim `linux/amd64` platform digest
`sha256:43aeff40f4afc22e83f7589a2f37e111cff5ca84529571f1c8415bcc5fcc21b2`.
pnpm **10.33.0** tool bytes stay pinned. The earlier dependency preflight recorded **126 locked packages**,
fresh-store acquisition, and offline frozen install with network none.
The image run passed network-none, read-only, and nonroot.
In-image vitest passed core **426/426** and arena **434/434**.
In-image core typecheck, arena typecheck, and the strict test `tsc` passed.
The lead reports infrastructure **5/5 tests passed**, including the actual Docker test with no skips.
The lead reports host-after-import current-evidence checks **7 tests / 2 files passed**, and arena typecheck passed.
Imported evidence includes baseline, verification, pin-migration, coverage, contract, and image-assurance reports.
The external archive SHA-256 `64d6277f439f7cdfb82ecb2c6a230f735c5c7f3588d7f13082a30b430e6d07f7` is not in the repo.
The lead reports its path as `/tmp/opencode/starchess-hermetic-export-k1KYQO/image.tar`.

Persisted coverage is **18/282 exact queues**, **204/576 singleton intents**,
**282/282 reference codec and feature encodings**, and **48 maximum proposals**.
These counts describe historical White observations and structural membership, not live counterplay,
admission, exhaustive combinations, or learned success. They are representability, not winning coverage.
Pre-freeze findings were fixed before this freeze: loader escapes, dense arrays, provenance, capture containment, and importer completeness.
Final rename adversarial review is running; no READY verdict is recorded.
Post-image security rereview remains unrecorded.
Fresh PlantUML `checkonly` of both renamed diagrams and the edited spec map belongs to the lead.
This pass does not claim a learned PASS.

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
All ten Phase 1 integrity-test files now exist and passed as recorded in
[verification.json](../evidence/ml-adjutant-phase1/verification.json). The Phase 1 arena full run passed
**164 tests / 17 files after all source and test changes**; core passed **426 / 53**;
both typechecks and the direct strict test TypeScript check passed. Those counts are historical.
The Phase 2 image passed arena vitest **434/434** and core vitest **426/426**.
The lead reports host-after-import current-evidence checks **7 tests / 2 files passed**, and arena typecheck passed.
Actual paths and purposes are
listed in [PLAN-ml-adjutant.md](PLAN-ml-adjutant.md#planned-verification-and-pending-ownership).
Phase 2 feature encoders exist and hermetic verification passed; post-image rereview is not yet recorded;
broader generator/v2 ledger/interaction tests and Phase 3–4 learned execution checks remain planned.
Phase 1 tests do not implement or verify a trained policy. The lead reports both Phase 1
reviews READY: yes; adversarial has no remaining findings and security covers trusted non-learned execution.

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
| Supervision | Startup stall, synchronous loop, unresolved promise, fixed deadlines, bounded raw JSONL before parsing, malformed/before-ready messages, accepted-ply counters across crashes, partial evidence, and reap before return. |
| Evidence integrity | Authoritative full resolve/resource reexecution, actual terminal truth, White trace-window binding, stop turn/ordinal consistency, forged evidence rejected, and script-contract invalidation. |
| Publication | Fsynced private temporary JSON, exclusive hardlink, temp unlink followed by containing-directory fsync, existing report preserved, and cleanup on serialization failure. |

## 9. Reporting and evidence limits

Publish the pins and integrity results with one row per corpus case and per live seed/seat.
Include candidate side, actual terminal outcome or failure reason, planning ordinal/failed
action where applicable, fallback count, and reproducibility result. Report historical source
outcomes separately from executed outcomes. Keep private metadata in host reports, not policy inputs.
Persist complete host-private `match.trace` data on each corpus report row so standalone
`summarize` and integrity revalidation retain the actual White-window references. The schedule
summary may omit those payloads. Candidate inputs still exclude metadata and future queues;
report retention does not relax the authorized observation boundary.

Phase 1 `src/challenge/evidence.ts`, `integrity.ts`, `publication.ts`, and separate
`src/cli/challenge.ts` exist. The full-suite CLI executed all **54 supervised matches twice**
under final pins; **54/54 normalized semantic comparisons are equal**.

| Measured non-learned baseline | Scheduled | Candidate wins | Terminal losses | Queue-rejection failures |
|---|---|---|---|---|
| Recorded White corpus | 18 | 0 | 2 | 16 |
| Live strategic | 36 | 0 | 36 | 0 |

No draws occurred. The persisted report records `executionIntegrity = true`,
`learnedGateEligible = false`, `modelArtifact = null`, and `learnedChallengePass = false`.
Failures stay in the denominator. This validates harness execution and reproducibility, not
learned strength or universal feasibility/infeasibility of strict replay.
The report pins rules, challenge/CLI sources, strategic/ledger sources, dependency lock, runtime
configuration, Node version, final watchdogs, schedule, and RNG conventions.
The independent verification record binds raw report SHA-256
`940387370040f88888e9dfe0bb86ad9d4a8be88854df507120f34b22ee2d362b`.
The final Phase 1 PlantUML diagram passed `checkonly`. Adversarial and security rereviews are
**READY: yes** within the trusted non-learned Phase 1 scope.

If all clauses pass, say **100% wins on the pinned 18-case corpus and 36-match live strategic
suite**. If any clause fails, say FAIL and identify it; do not exclude the failing case to retain
a 100% headline. A random successful sample cannot establish the exhaustive claim.

These 18 cases may be used for training and regression. Prevent metadata/game-ID memorization,
but do not call this training-used suite held-out generalization evidence. Separate future
held-out exports/openings/seeds are needed for broader claims. Optional Elo or RLHF experiments
cannot replace this gate or supply a missing win. No learned executable PASS is currently claimed.
Phase 2 hermetic verification passed and does not satisfy this gate.
