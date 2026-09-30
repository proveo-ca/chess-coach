# PLAN — ML Adjutant: learn a ranker and prove the strict challenge

Status: **Preparatory catalog IMPLEMENTED and VERIFIED**, with the baseline full-app lint exception below.
Phase 0 provenance is **IMPLEMENTED** with persisted audit verification.
Phase 1 is **IMPLEMENTED and VERIFIED in `packages/starchess-arena`** by tests and persisted
baseline execution evidence. The lead reports both Phase 1 reviews **READY: yes**:
adversarial has no remaining findings; security approves the trusted non-learned scope.
The final Phase 1 PlantUML diagram passed `checkonly`.
Phase 2 implementation is **ACTIVE**; final hermetic verification and both reviews are **PENDING**.
Phase 3 learning, Phase 4 learned acceptance, and optional phases 5–6 remain **PLANNED and unimplemented**.
Core `ai/definitions.ts` now owns all five IDs, canonical labels, and derived guards.
The app implements disabled placeholder entries and explicit unavailable admission for known
placeholder URLs or sessions. This completes the preparatory catalog, not a learning player.
The corpus schema audit and Phase 1 baseline execution verification are complete. Strict queue
failures remain visible; universal trace compatibility, training, and learned challenge wins
are not established. Stockfish retirement is not an acceptance prerequisite.

Scope: arena-owned Phases 1–2, with a proposed top-level **`ml/`** training workspace for Phase 3 onward. `ml` is workspace/tooling shorthand,
**not an Adjutant registry ID or a URL alias**. The exact future player ID is **`machine-learning`**.
Phase 1 isolates candidates behind `CandidatePolicy` / `AuthorizedObservation`; live strategic
retains the arena's trusted `ScriptPlayer` execution contract. The app consumes the core-derived
`AdjutantKind` and `PlayableAdjutantKind` through `apps/starchess/src/types/newGame.ts`.

## Implemented preparatory contract (no learning implementation)

- Core owns the metadata registry in `packages/starchess-core/src/ai/definitions.ts` and exports
  its derived types and guards. `ADJUTANT_DEFINITIONS` marks `naive` and `strategic` as `ready`;
  `PlayableAdjutantKind` and its guard admit only those entries.
- `machine-learning`, `rlhf`, and `rlcd` are **EMPTY metadata definitions**, not executable
  scripts, model loaders, training implementations, or strategic fallbacks. Their source status
  is `placeholder`; EMPTY describes their unimplemented behavior, not a status literal.
- New Game lists all five canonical labels from the registry. The last three entries remain
  disabled and marked not implemented; only playable choices can start a match.
- A recognized placeholder opponent from a URL or session, including a direct
  `/single?opponent=machine-learning` URL,
  displays an explicit unavailable state and cannot mount a live match. Unknown/missing values
  retain legacy resolution: saved session opponent, otherwise `naive`.
- Catalog metadata introduces **no runtime ML dependency** into core or the app.

Owning contract: [`adjutant-definitions.puml`](../packages/starchess-core/adjutant-definitions.puml).
App flow: [`menu-flow.puml`](../apps/starchess/menu-flow.puml).
Selector layout: [`wireframe.puml`](../apps/starchess/wireframe.puml).
Deepening learning architecture remains later work; this catalog does not complete any phase below.

## Preparatory milestone verification

| Check | Result and scope |
|---|---|
| Core unit suite | **53 files / 426 tests passed** |
| App unit suite | **108 files / 791 tests passed**, before the final unknown-record label regression |
| Final label regression run | **10 focused label tests passed** in `matchTitle.test.ts`; no subsequent full-app 792-test run is claimed |
| Browser opponent suite | **10 tests passed** in `starchess-opponents.spec.ts` |
| Typechecks | Core, app, and e2e passed |
| Scoped static checks | Changed-file oxlint, dependency checks, and CSS checks passed |
| PlantUML | All four changed `.puml` files passed `checkonly` |
| Full app lint | **Fails on the existing baseline only:** five unchanged `no-raw-timer` violations in `apps/starchess/src/hooks/useVfxProbe.ts` at lines **23, 26, 28, 64, 75** |
| Adversarial review | Sole MEDIUM finding fixed: unknown persisted opponents use `find(...)?.label ?? "Adjutant (Script)"`; regression added; rereview **READY: yes** |
| Security review | Current-source scope **READY: yes**, no findings |

The baseline full-app lint failure remains explicit; it does not mark scoped checks as failing
or authorize unrelated timer cleanup.

| Verification reference | Contract pinned |
|---|---|
| [`packages/starchess-core/src/__tests__/adjutantDefinitions.test.ts`](../../../packages/starchess-core/src/__tests__/adjutantDefinitions.test.ts) | EMPTY metadata shape, all-ID recognition, ready-only admission, rejection of `ml` and unknown inputs |
| [`apps/starchess/src/__tests__/singleOpponent.test.ts`](../../../apps/starchess/src/__tests__/singleOpponent.test.ts) | App guards and distinct playable script execution |
| [`apps/starchess/src/__tests__/newGameSetupStore.test.tsx`](../../../apps/starchess/src/__tests__/newGameSetupStore.test.tsx) | Disabled placeholder options, playable selection/Start, persisted setup |
| [`apps/starchess/src/__tests__/matchSessionStore.test.ts`](../../../apps/starchess/src/__tests__/matchSessionStore.test.ts) | Preserve known placeholders for admission; retain legacy/unknown session handling |
| [`apps/starchess/src/__tests__/matchTitle.test.ts`](../../../apps/starchess/src/__tests__/matchTitle.test.ts) | Canonical labels and safe unknown-record fallback |
| [`apps/e2e/tests/starchess/starchess-opponents.spec.ts`](../../../apps/e2e/tests/starchess/starchess-opponents.spec.ts) | Browser selection, placeholder URL/session blocks, unchanged stored data, strategic rematch, setup normalization |

---

## Judgment of the original phases

The accepted architect review replaces Elo-first delivery with a pinned, executable challenge.
The normative acceptance contract is [ml-adjutant-challenge.md](ml-adjutant-challenge.md).
Executor selected **Broader first trained ranker**:
[ml-adjutant-weights.md](ml-adjutant-weights.md) specifies the shared coefficients, combination domain,
authorized economy/loss knowledge, vision interactions, and proposed outcome-driven training.
FIRST Phase 3 training requires a separately versioned broader combination generator and v2 economic/positional
interactions, including an own-loss lineage ledger and confirmed opponent-loss lower bounds with fog uncertainty.
Start at **H=1**; conditional plans across **three simultaneous planning windows** remain a separate future milestone.
Current features v1 are not an adequate first-trained-ranker contract.

| Original phase | Judgment | Replacement |
|---|---|---|
| 1 — Elo ladder | Useful for comparative strength, inadequate for the named corpus and a 100% requirement. An average rating cannot excuse one failed case. | Strict serial harness in phase 1; exhaustive perfect gate in phase 4; optional Elo in phase 6. |
| 2 — Vectorisation | Keep observation isolation and candidate encoding. A new textual grammar or tensor architecture is not the first prerequisite. Enumeration alone does not guarantee legal admission. | Inspectable v1 codecs/features in phase 2; broader combinations and authorized v2 interactions/ledger must freeze before FIRST phase-3 training. |
| 3 — Parallel + determinized play | Two separate scaling/search concerns, not prerequisites for proving 54 finite matches. | Serial first; worker pools and belief-world sampling remain separate optional phase-6 tasks. |
| 4 — Native evaluator | Outcome-based learning belongs in the core path. Replacing the classical projection or deleting Stockfish does not prove this challenge. | Frozen learned ranker in phase 3; evaluator/feed replacement remains optional phase 6. |
| 5 — Player | Too late: replay and candidate adapters are needed before training. Browser rollout and runtime fallback are distinct product work. | Adapters begin in phase 1, learned adapter in phase 3; browser integration remains optional phase 6. |

## Closed decisions and evidence boundary

- **Keep the pinned 18.** The earlier workspace/parent and tracked-inventory audit found
  only `starchess-match-history-20260929-203446.json`. Executor now reports that external
  `/starchess-match-history-20260922-222825.json` was found and parsed: **96 games, not 100**.
  Only its count is reported; provenance, duplicates, rules, and trace compatibility remain
  unaudited. It does not alter the 18-case corpus, the 36-match live schedule, or manifest v1.
- **Blue = White = recorded player (`w`).** The corpus supplies white queues; the candidate
  counterplays as black/red (`b`). This is not a replay of the historical black strategic moves.
- **STRICT RECORDED QUEUES.** A rejected action, unaffordable full queue, or exhaustion before
  terminal fails that case. No substitution, truncation, skipped case, or dropped action is allowed.
- **Win both suites.** Require 18/18 corpus wins AND 36/36 live strategic wins AND integrity
  tests. Random samples and Elo do not replace exhaustive acceptance.
- **Start with a learned linear ranker.** Defer neural-network complexity until separate held-out
  measurements justify it. Require the broader generator and authorized v2 interactions/ledger first,
  at horizon 1. Defer textual `SCOBS`, worker pools, and three-window belief/search implementation.

The [pinned manifest](../corpora/ml-adjutant-corpus.manifest.json) records all 18 case IDs,
source references, trace hashes, provenance, and the paired strategic schedule.
`packages/starchess-arena/src/__tests__/corpusManifest.test.ts` persists its integrity audit.

The lead reports this completed JSON/core codec audit:

| Evidence | Result |
|---|---|
| Source pin | SHA-256 `e6770cb032aa76dc05432c7a49e61c4905d1a1f7b859aa860a090821213e7ae6`; 664540 bytes; export version 1 |
| Export timestamp | `2026-09-30T03:34:45.997Z` |
| Cases | 18 unique IDs; every player is `w`; every opponent is `strategic`; 17 historical white wins and 1 draw |
| Trace diversity | 18 unique white trace hashes; one canonical opening |
| Planning/settlement | 340 settled plies = 58 `ev-begin` chip plies + 282 planning windows |
| White actions | 576 = 266 classical + 113 stimStep + 132 deploy + 40 spiderMine + 23 siegeMode + 2 tacticalJump |
| Current codec audit | `historyFromRecord` / `parseScFen` / `scsanOf` / `scOutcome`: 358 raw snapshots parse, 358 repaired snapshots decode, 18 histories align, 18 SC-SAN comparisons match exactly, 18 terminal result labels match |

Those checks validate recorded structure and labels. They do **not** validate current-rule queue
admission, reexecution against a diverging opponent, learning, or achieved candidate wins.
The separate [Phase 1 baseline report](../evidence/ml-adjutant-phase1/baseline-report.json)
now records current-rule execution and all 54 semantic rerun comparisons. Training remains
unimplemented. Keep manifest `audit.currentRuleReexecution = "pending"` and
`audit.candidateWinrate = "not measured"` unchanged as historical Phase 0 audit statuses.
The new execution evidence **supersedes those pending statements separately for the measured
baseline**, not by rewriting the original manifest or claiming universal trace compatibility.
The report includes 16 strict queue-rejection failures and does not establish a learned win.

## Invariants (non-negotiable)

- **Core never depends on ML.** Phase 1 flows `arena → core`; later training flows `ml/ → arena → core`. Core stays pure,
  browser-safe, and free of model runtimes. `ml/` remains proposed workspace/tooling shorthand.
- **Legality is never learned.** A model ranks action queues. `addScAction` and the host's gas
  and mineral checks authorize the full queue. `strategicCandidates` proposes ranked candidates;
  `applyCandidate` can return `null`. Enumeration is not an admission guarantee.
- **Train and infer on authorized observations.** Hide full fog state, hidden mines, the current
  enemy queue, enemy bank/gas deltas, future traces, and record identity/result metadata.
  Candidate membership, ordering, scores, and features must not leak those hidden inputs.
- **Both sides plan from the same turn-open precommit state.** The existing arena's white-first
  mutation is not sufficient isolation. The benchmark host derives both inputs before planning
  and validates/merges the resulting queues privately in stable host order.
- **Freeze evaluation.** Pin model artifact hash, rules, strategic revision, observation/candidate
  versions, opening, seeds, and budgets. Compare `scfens`, resolves, and results, excluding generated
  IDs/timestamps. No online weight updates occur during a gate match.
- **Keep two fallback contracts separate.** A future implemented product player may degrade to
  `strategic` when no model/runtime is available. Today's EMPTY definition remains unavailable.
  The learned benchmark forbids that fallback and requires `fallbackCount = 0`; missing weights,
  inference failure, or rejected selected queue fails rather than invoking another policy.
- **Fail honestly on incompatibility.** Capturing a historical white actor can make its next
  recorded queue inadmissible. Report the failure; do not weaken strict replay to claim a win.

## Existing seams and gaps

| Need | Existing seam / required work |
|---|---|
| Deterministic settlement | `challenge/runChallengeMatch.ts` isolates precommit inputs and uses `beginScTurn` / `endScTurn` / `mulberry32`; `challenge/integrity.ts` reexecutes evidence. The legacy `run/runMatch.ts` remains distinct. |
| Player contract | `packages/starchess-arena/src/players/types.ts`: `ScriptPlayer` / `SideContext`; the unrestricted snapshot and both-side bank stay host-side, not model-side. |
| Live opponent | `packages/starchess-arena/src/players/strategic.ts`: execute `strategicScript` with feed off, not a recorded response. |
| Candidate/application seam | Phase 1 `challenge/baseline.ts` uses authorized observed occupancy and own modes/mines for classical singletons, Marine deployment singletons, and pass; fixed heuristic scores, no strategic candidate reuse. `challenge/admission.ts` stages full queues through `addScAction` and exact host affordability. Later strategic reuse requires its own leakage audit. |
| Visibility and memory | `challenge/observation.ts` keeps candidate sightings separate from private strategic KVS/CC intel/runner/attacker ledgers; opening-seeded strategic KVS must not enter candidate memory. Phase 2 numeric codecs/features now exist; own lineage/loss and confirmed opponent-loss contracts remain pending before FIRST training. |
| Terminal truth | `packages/starchess-core/src/outcome.ts`: `scOutcome`, including actual turn-45 HP decisions; historical winner labels are not benchmark outcomes. |
| Product admission | Existing registry and app guards remain as verified above; no new playable option in this slice. |

## Phase 0 — Pin and audit the available corpus

**Deliverables.** The 18-case manifest pins source hash/size/version/timestamp, case IDs,
opening, White queue source references, trace hashes, and extraction provenance.
Preserve the source export unchanged. Validate all pins and counts before every gate.

**Done when.** The manifest audit reproduces the supplied schema facts and makes each queue's
planning ordinal inspectable. Its historical executable audit status remains pending; Phase 1
now supplies separate measured execution evidence, including strict incompatibility failures.
The manifest and persisted corpus audit test implement this provenance slice.
Audit the newly located external 96-game export's hashes, IDs, duplicates, rules, and trace
compatibility before proposing any expanded challenge and approving a new manifest version.
Do not silently expand the existing denominator.

## Phase 1 — Strict serial harness, adapters, and baseline

**Status: IMPLEMENTED and VERIFIED; both reviews READY: yes.** Arena owns this phase, not `ml/`.
Owning diagram: [`ml-adjutant-phase1.puml`](../packages/starchess-arena/ml-adjutant-phase1.puml).
Source inspection found `src/challenge/{types,config,corpus,observation,baseline,admission,
runChallengeMatch,schedule,supervisor,worker,integrity,publication,evidence}.ts` and the separate
`src/cli/challenge.ts` in `packages/starchess-arena`. The new implementation modules cite the
owning diagram. Do not conflate the challenge CLI with existing `src/cli/main.ts` or change the
legacy runner contract.

**Deliverables.** Implement the white recorded-queue adapter, isolated candidate adapter,
turn-open observation boundary, atomic queue validation, hosted bank ledger, deterministic
settlement, terminal-first checks, and failure reports specified in the challenge document.
Approved `CHALLENGE_CONFIG` version `phase1-v1` pins startup and per-plan deadlines to
**10000 ms each**, match deadline to **300000 ms**, and caps to **64 planning windows,
128 recorded plies, 4096 proposals**. Inference seed is 0; feed is off; `movetimeMs = 0`.
IPC caps are **2048 messages**, **1048576 bytes per progress/non-completion message**, and
**16777216 bytes per completion message**. They are part of the final configuration pin.
The parent receives spawned-child **stdin/stdout JSONL pipes**, not a Node `process.send`
channel. It bounds each raw stdout frame to **16777216 bytes before `JSON.parse`**, then
enforces parsed-message limits and the 128-ply cap before accepting evidence.
Standard baseline reports must use these budgets; test overrides are not standard-run evidence.

The inspected host derives both inputs from one frozen turn-open state, stages each whole queue
independently, and commits **w then b in array order** with fresh sequences and exact deployment
debits before current income. Terminal checks precede trace exhaustion and host caps. Chip plies
update evidence and private memory without consuming a planning ordinal. Parent supervision uses
hard kill and waits for child close/reap; validated progress retains partial evidence on failure.
Failure turn and planning ordinal derive from accepted plies rather than the child's last phase
announcement; a crash before the next phase cannot discard the accepted progress counters.
`integrity.ts` authoritatively reexecutes full resolve payloads, staged queues, exact resources,
and real terminal outcomes; forged evidence and `script-contract` stops invalidate execution
integrity. Corpus validation binds consumed White queues to actual audited trace windows and
requires complete-evidence stop turn/ordinal consistency. White rejection evidence is checked
against authoritative staging of the corresponding recorded window.
`publication.ts` writes and fsyncs a private temporary file, then publishes with an exclusive
hardlink, unlinks the temp file, and fsyncs the containing directory. It preserves an existing
report and removes temporary files on write failure.
The persisted tests and evidence below verify these Phase 1 contracts.

Phase 1 owns a minimal observation-safe proposal interface and deterministic non-learned baseline.
Phase 2 extends that interface with versioned numerical features and learned-ranking inputs.
The existing full-snapshot `strategicScript` remains the trusted opponent; calling it unchanged
does not establish an observation-honest candidate baseline.
`baseline-v1` proposes only classical singleton queues, Marine deployment singleton queues, and
pass. It uses observed occupancy and own modes/mines/resources with fixed heuristic ranking and
canonical-key tie-breaking, not learned weights or strategic candidate reuse. Candidate memory
contains side-authorized sightings only; strategic ledgers remain host-private. Phase 2 now adds numeric
codecs/features without expanding baseline generation. Training, models, learned artifacts, and browser integration
remain unimplemented. The Phase 1 diagram's later-work labels describe its historical verification boundary,
not the current Phase 2 implementation status.
Baseline evidence fixes `modelArtifact = null`, `learnedGateEligible = false`, `fallbackCount = 0`;
even a baseline win cannot satisfy the learned gate.

The observation-safe baseline ran through this boundary on every scheduled case twice under
the final pins. Results validate plumbing and provide a comparison, not learned acceptance:

| Suite | Scheduled | Candidate wins | Terminal losses | Queue-rejection failures |
|---|---|---|---|---|
| Strict recorded White corpus | 18 | 0 | 2 | 16 |
| Live strategic, both candidate seats | 36 | 0 | 36 | 0 |

There were no draws. All **54/54 semantic rerun comparisons match**;
`executionIntegrity = true`, `learnedGateEligible = false`, and `learnedChallengePass = false`.
Every failure remains in the denominator. These results do not prove every trace can support
winning counterplay, nor that a queue failure under this baseline makes a trace universally infeasible.

### Phase 1 implementation verification

The [independent verification record](../evidence/ml-adjutant-phase1/verification.json) records
actual test paths, SHA-256 hashes, purposes, static commands, and the raw baseline report hash.
It binds [baseline-report.json](../evidence/ml-adjutant-phase1/baseline-report.json) to SHA-256
`940387370040f88888e9dfe0bb86ad9d4a8be88854df507120f34b22ee2d362b`.
The execution report pins core rules, challenge/CLI sources, strategic/ledger sources, dependency
lock, runtime configuration, Node version, configuration, opening, schedule, and RNG conventions.
Report rows retain complete host-private `match.trace` data so `summarize` and integrity
revalidation work standalone. The schedule summary still omits trace payloads. This report-side
retention does not expose identity, results, metadata, or future queues to `CandidatePolicy`.

| Check | Result and scope |
|---|---|
| Arena final full suite | **17 files / 164 tests passed after all source and test changes** |
| Arena typecheck | **Passed** |
| Core full suite / typecheck | **53 files / 426 tests passed; typecheck passed** |
| Direct strict TypeScript check of challenge tests | **Passed**; exact command and workdir in verification.json |
| Full-suite CLI with `--suite all --rerun` | **54 supervised first executions + 54 reruns; 54/54 semantic comparisons equal** under final pins |
| PlantUML final diagram | **`plantuml -checkonly` passed** |
| Phase 1 adversarial rereview | Lead reports **READY: yes**, no remaining findings |
| Phase 1 security rereview | Lead reports **READY: yes** for trusted non-learned execution |

**Done when.** Integrity tests and deterministic reruns pass; baseline reports enumerate every
scheduled case. Full-state/metadata leakage and white-first queue/bank exposure tests must pass
before creating training examples. A strict trace failure remains visible and can block the
challenge; a report alone is not proof that all traces support winning counterplay.

## Phase 2 — Authorized codecs/features, coverage, and partitioned execution pins

**Status: ACTIVE implementation; final verification and adversarial/security reviews PENDING.**
Owning diagram: [ml-adjutant-phase2.puml](../packages/starchess-arena/ml-adjutant-phase2.puml).
Weights/future training boundary: [ml-adjutant-weights.md](ml-adjutant-weights.md).
Executor selected partitioned execution pins, then a hermetic image, and approved pull/build downloads.
This approval does not authorize training or model/registry activation.

**Inspected source.** Arena `src/challengeContract/{validation,observationCodec,candidateCodec,features,coverage}.ts`
implements strict authorized observation/candidate codecs, named numeric feature arrays, and historical coverage diagnostics.
Observation cells preserve unknown/lit/revealed distinctions and dated square sightings.
Candidate arrays preserve relative order and B/C/F timing with canonical keys and recomputed requested own spend.
The codec supports all seven kinds; the current generator still proposes only classical singletons,
Marine deployment singletons at B, and pass. `MAX_QUEUE_ACTIONS=65` bounds encoding, not legal queue length
or exhaustive coverage. One selected proposal goes to private host admission; no hidden probes or rescue.

`challenge-features-v1` names **1623 observation**, **64 action-row**, and **158 ranker** entries;
weights are **NONE**. `baselineScore` is handcrafted and not part of the feature vector.
Sums and position-weighted sums can collide; observation-only terms cancel in linear candidate comparisons.
These v1 inputs do not satisfy the accepted broader FIRST-training requirements.

**Lead-reported preliminary host coverage:** exact queues 18/282; singleton intents 204/576;
reference codec and feature representability each 282/282; maximum 48 proposals.
These historical White membership/encoding counts do not establish live counterplay, legal completeness,
winning queues, or final hermetic acceptance. Reproduce and persist them under the final source image.

### Pin partition and import audit contract

`src/challenge/sourceInventory.ts` generates a complete explicit file inventory over declared roots,
with every included file assigned exactly once to:

| Partition | Scope |
|---|---|
| execution | All core source + arena source except `challengeContract`, excluding package `__tests__` trees. |
| contracts | Arena `src/challengeContract/`. |
| diagnostics | Root `scripts/` + arena `hermetic/`. |

The AST audit resolves relative imports, declared externals/workspace exports, type/import/export/require
edges, the worker URL, and supported loader forms. Execution cannot import contracts or diagnostics;
contracts cannot import diagnostics. The declared esbuild closure-loader pattern is supported explicitly;
this is not a proof for arbitrary computed loaders. Do not pin a transient source-file count in prose.
Runtime configuration captures present and absent optional configs and recursive relative tsconfig inheritance.
Content-derived partition hashes replace the old partial source digests in `challenge-execution-pins-v2`.
Installed `node_modules`, store, tools, and captured tests/source receive separate hermetic artifact manifests
outside the project pin; the image ID belongs to the external assurance envelope.

### Immutable Phase 1 and Phase 2 migration

Preserve Phase 1 evidence bytes exactly:

```text
baseline-report.json SHA-256
940387370040f88888e9dfe0bb86ad9d4a8be88854df507120f34b22ee2d362b
verification.json SHA-256
55d965afa71d775ff6ee1e95b6650a27d0ce759b966a81c43a3bb364236c7508
```

`src/challenge/pinMigration.ts` and `scripts/challenge-contract-evidence.ts` implement migration checks.
Write a **new Phase 2 baseline** under v2 pins, not a rewritten Phase 1 report.
Require 54 current executions + 54 reruns, exact schedule/integrity, and semantic comparison with all
54 original rows. Persist `contract-report.json`, `coverage.json`, and `pin-migration.json` only from that run;
the runner publishes final `verification.json` after checks succeed. None of these final results is claimed yet.

### Hermetic assurance progress and remaining handoff

**Lead-reported dependency image verification only:** official Node **22.23.2**, `linux/amd64`,
platform digest `sha256:43aeff40f4afc22e83f7589a2f37e111cff5ca84529571f1c8415bcc5fcc21b2`;
pnpm **10.33.0** registry-tool bytes pinned in `hermetic/pins.json` to SHA-256
`bfcc1bcbad279b13a516c446a75b3c58b6904b45d57a1951411015e50b751a80` plus SHA-512 integrity;
**126 locked packages**, fresh-store acquisition, then offline frozen installation with network none.
The **final source image is NOT BUILT**. Dependency preflight is not final source verification.

The final capture retains core/arena source, tests/fixtures, diagnostics/infrastructure, configs,
the pinned corpus, and immutable Phase 1 evidence; it excludes host dependency trees, secrets, and caches.
Manifests record source/test, installed-tree, store, and tool bytes outside their inventoried roots.
Run the final immutable image with network none, read-only root, UID 10001, capabilities dropped,
no runtime installs, and only the dedicated Phase 2 evidence output writable besides temporary storage.
Recompute manifests before and after execution; preserve the Docker/runtime assurance envelope externally.

**Done when (PENDING).** The lead freezes source, builds/preflights the final image, runs the new full baseline
and diagnostic/migration sequence, passes core/arena typechecks and suites, and records unchanged artifact manifests.
Verify observation round trips, finite/name-aligned features, hidden-state invariant candidate channels,
whole-queue admission/gas/minerals, partition completeness/import boundaries, and immutable migration parity.
Render/check the Phase 2 diagram; obtain adversarial and security reviews on the final sources and evidence.
This phase remains non-learned even when all checks pass. Broader generation and v2 economics/position are
required **before FIRST Phase 3 training**, not implied complete by this Phase 2 slice.

## Phase 3 — Learn and freeze a ranker from outcomes

**Status: PLANNED, no training implementation or artifact.**
**Prerequisite:** freeze a separately versioned broader combination generator and v2 feature names/dimensions,
authorized own-loss lineage ledger, confirmed opponent-loss lower bounds/uncertainty, and economic/vision/positional
candidate-context interactions. Current 158-entry v1 ranker inputs do not meet this prerequisite.
The exact v2 names/dimension and generation budgets remain unsettled; freeze them before FIRST training.
Use horizon **1** initially; three conditional simultaneous planning windows remain a separate future milestone.

**Deliverables.** Fit `s_w(h,c) = wᵀφ_version(h,c)` through an explicit training loss.
Coefficients are shared named-feature weights, not per-move or per-combination-tree entries.
The [weights contract](ml-adjutant-weights.md#7-proposed-outcome-driven-phase-3-learning--not-implemented)
proposes stable-softmax policy gradient with actual candidate-side rewards, previous-episode-mean baseline,
`L = -A Σ log π + λ||w||²/2`, initialization/optimizer/seeds, and external artifact hashing.
All training choices remain planned; rule legality/gas/mineral costs never become learned parameters.
Add a `ScriptPlayer`-compatible adapter that receives only the authorized interface, selects a
queue using the learned scores, and delegates authoritative commit to the host.
Keep candidate selection genuinely learned; a fallback strategic decision does not count.

White demonstrations or strategic teacher labels can optionally bootstrap the learner.
Train counterplay using newly executed games and terminal candidate-side outcome rewards.
Use a separate seeded training-selection stream; do not feed game IDs, corpus indexes, future
white actions, or historical outcomes into the policy. Log optimizer/loss, training seeds,
dataset versions, candidate coverage, and model artifact hash.

**Done when.** Persistent tests verify broader combination coverage, authorized loss-ledger conservation,
uncertainty/ray semantics, and context interactions before a repeatable training run produces changed learned
weights and a frozen, finite, exactly name-aligned v2 artifact with external hash and provenance.
Evaluate it without online updates using inference seed 0 per match. Publish failures as well as
wins. Add a small neural network only if separate held-out results justify the added complexity.
The 18 cases may be used for training/regression; they are not held-out generalization evidence.

## Phase 4 — Exhaustive perfect gate

Run the [challenge contract](ml-adjutant-challenge.md) on one frozen candidate:

```
PASS = corpusWins == 18
    && liveStrategicWins == 36
    && integrityTestsPass
    && fallbackCount == 0
```

Draws, losses, errors, rejected queues, timeouts, premature stalls, and preterminal exhaustion
fail. Publish the pinned configuration, all 54 case results, failure reasons, deterministic
rerun comparison, and zero-fallback evidence. A true `scOutcome` turn-cap HP win counts;
a host-created stall draw or historical label does not.

**Done when.** All clauses pass in executable verification. The resulting claim is **100% on
these finite, pinned suites**, not universal strength, unseen-seed success, or guaranteed feasibility.
No such pass is currently claimed.

## Phase 5 — Optional human preference learning (RLHF)

Collect explicit human A/B preferences between plans presented under the same authorized
observation. Fit a preference reward model and fine-tune the policy with both preference and
win objectives plus regularization to the frozen baseline. Rerun phase 4 after any model change.
Successful white games alone are not preference pairs. This phase does not activate the `rlhf`
catalog entry; product integration requires its own implementation and review.

## Phase 6 — Optional scale, search, evaluation, and product work

These are separate follow-up tasks, not prerequisites or substitutes for phase 4:

- Worker pools/self-play throughput with seed sharding and serial/parallel semantic parity.
- Belief-consistent determinization using authorized memory only. Simultaneous planning needs
  joint-action reasoning; alternating minimax/MCTS cannot be used unchanged. A separately versioned H=1..3
  conditional history tree/beam uses future authorized observations and opponent hypotheses, never future traces,
  actual private queues, or full hidden state. Freeze finite search budgets and persist search-invariance tests.
- Elo with uncertainty, draws worth half a point, broader openings/seeds, and future held-out
  cases. Same numeric arena seed across swapped seats does not mean identical RNG streams.
- Native StarChess evaluator/feed experiments. Classical FEN omits relevant variant mechanics;
  any replacement must define score perspective explicitly. Stockfish deletion is independent.
- Browser budgets, model distribution, worker/WebGPU support, explainability, and explicit
  product fallback. Implement `machine-learning` before changing registry readiness; never add
  an `ml` alias. Keep `rlcd` EMPTY: this plan defines no RLCD algorithm or runtime.

`ml/` remains proposed ownership notation for Phase 3+; Phases 1–2 ownership is settled in arena.
Lead/build must settle later training packaging and workspace configuration before that work.
This spec slice changes neither source nor package configuration. Browser and scale
decisions must not hold the serial learning challenge hostage.

## Beginner explanation — where learning and weights come from

**ML is broader than a neural network.** The first ranker multiplies each candidate feature by
a learned weight and sums the products. An optimizer changes `w` to reduce a specified loss
using examples or outcomes. That already constitutes machine learning; manually fixing those
weights would remain a hand-tuned script. A small neural network replaces the linear formula
with layers whose weights are optimized by the same loss-driven principle.

**Winning White examples are not a Black counterpolicy.** Imitation can teach recognizable
planning patterns, but replaying White's successes does not teach how Black defeats them.
New executions provide candidate-side rewards for counterplay. Neither model type can select
a winning queue absent from its candidate set or recover evidence omitted from its observation.

**RLHF needs actual preferences.** For an observation `o` and plans `A`/`B` where a human prefers
`A`, train reward-model parameters `phi` with
`Lpref = -log sigmoid(r_phi(o, A) - r_phi(o, B))`. Then optimize the policy using predicted
preference reward plus the win objective and regularization toward the baseline. The optimizer
learns reward-model and policy weights; they do not emerge from 18 unranked games. The 17 white
wins and one draw supply demonstrations/outcomes, not human preference comparisons.

## Planned verification and pending ownership

The corpus provenance test and all ten Phase 1 integrity-test files below exist.
Their results are persisted in [verification.json](../evidence/ml-adjutant-phase1/verification.json).
All `ml/` paths below remain **PROPOSED** for Phase 3+, pending the training packaging decision.
No Phase 1 placeholder test path is presented as an existing arena test.

| Existing / proposed test/report path | Phase | Verification purpose |
|---|---|---|
| `packages/starchess-arena/src/__tests__/corpusManifest.test.ts` (EXISTS) | 0 | Pins, 18 unique cases/traces, action counts, snapshot/resolve cardinality, codec/result checks, and source provenance. |
| `packages/starchess-arena/src/__tests__/challengeCorpus.test.ts` (PASSED) | 1 | Manifest/source pins, extraction, explicit empty queues, chip ordinals, private selection, and exhaustive schedule. |
| `packages/starchess-arena/src/__tests__/strictRecordedQueues.test.ts` (PASSED) | 1 | Atomic rejection, order/sequence, gas, no retries, frustrated intents versus missing actors. |
| `packages/starchess-arena/src/__tests__/resourceLedger.test.ts` (PASSED) | 1 | Exact deployment affordability/debits, income tiers, ledger continuity, and cap. |
| `packages/starchess-arena/src/__tests__/challengeLifecycle.test.ts` (PASSED) | 1 | Terminal-first checks, chips, exhaustion, and genuine turn-45 outcomes. |
| `packages/starchess-arena/src/__tests__/observationIsolation.test.ts` (PASSED) | 1 | Both-seat precommit inputs, mutation isolation, and private trace invariance. |
| `packages/starchess-arena/src/__tests__/challengeObservation.test.ts` (PASSED) | 1 | Hidden-state proposal/ranking invariance, authorized sightings, and Battleship pings. |
| `packages/starchess-arena/src/__tests__/challengeWatchdog.test.ts` (PASSED) | 1 | Real-child hangs/crashes, fixed deadlines, JSONL frame bounds before parsing, accepted-ply failure counters, and reap before return. |
| `packages/starchess-arena/src/__tests__/challengeEvidence.test.ts` (PASSED) | 1 | Semantic determinism, production worker, strict trace identity/stop consistency, authoritative reexecution, and forged outcome/resource rejection. |
| `packages/starchess-arena/src/__tests__/challengeSuites.test.ts` (PASSED) | 1 | Persisted 54-case execution with complete host-private traces, standalone revalidation, source/runtime pins, and every rerun semantic hash. |
| `packages/starchess-arena/src/__tests__/challengePublication.test.ts` (PASSED) | 1 | Atomic/durable exclusive publication with directory fsync, serialization-failure cleanup, and preservation of existing reports. |
| `packages/starchess-arena/src/__tests__/fixtures/{challengeWorker,challengeStartupHang,challengeBeforeReady}.ts` (EXIST) | 1 | Child-process fixtures used by watchdog tests; not independent verification results. |
| `_spec/evidence/ml-adjutant-phase1/baseline-report.json` (PERSISTED) | 1 | All 18 corpus and 36 live cases, final pins/budgets, failures, integrity results, and deterministic rerun comparison; separate from historical manifest audit. |
| `_spec/evidence/ml-adjutant-phase1/verification.json` (PERSISTED) | 1 | Independent commands/results, actual ten integrity-test paths with hashes/purposes, and raw report SHA-256. |
| `packages/starchess-arena/src/__tests__/challengeObservationCodec.test.ts` (EXISTS, final verification PENDING) | 2 | Observation round trips, schema/unknown/visibility and memory semantics. |
| `packages/starchess-arena/src/__tests__/challengeCandidateCodec.test.ts` (EXISTS, final verification PENDING) | 2 | Ordered kind/timing/spend encoding, canonical keys, structural bounds and comparator. |
| `packages/starchess-arena/src/__tests__/challengeFeatures.test.ts` (EXISTS, final verification PENDING) | 2 | Named finite vectors, authorized inputs, normalization and historical coverage. |
| `packages/starchess-arena/src/__tests__/challengeContractAdmission.test.ts` (EXISTS, final verification PENDING) | 2 | Codec proposals remain distinct from host whole-queue legality/resource gates. |
| `packages/starchess-arena/src/__tests__/challengeSourceInventory.test.ts` (EXISTS, final verification PENDING) | 2 | Complete partitioned source/config inventory, import boundaries and loader policy. |
| `packages/starchess-arena/src/__tests__/challengePinMigration.test.ts` (EXISTS, final verification PENDING) | 2 | Immutable Phase 1 byte pins, new v2 baseline and all-row semantic migration parity. |
| `packages/starchess-arena/hermetic/infra.test.mjs` (EXISTS; lead reports dependency verification only) | 2 | Restricted real-container policy, allowlisted capture, tools/dependency/store assurance; final source-image run pending. |
| `_spec/evidence/ml-adjutant-phase2/{baseline-report,contract-report,coverage,pin-migration,verification}.json` (REQUIRED outputs, not claimed verified) | 2 | Final hermetic 54+54 execution, original 54-row parity, contracts/coverage/pins and persisted command evidence. |
| `ml/player/__tests__/learnedRanker.test.ts` | 3 | Loss-driven weight changes, frozen artifacts, selected-queue admission, no fallback/online updates. |
| `ml/harness/__tests__/perfectGate.test.ts` | 4 | Exactly 18 corpus + 36 live strategic wins; every non-win/integrity failure fails the gate. |
| `ml/preference/__tests__/preferenceLoss.test.ts` | 5, optional | Same-observation human pairs, preference-loss direction, policy regularization. |

**Final handoff:** both Phase 1 reviews are lead-reported READY: yes. The lead will run
`plantuml -checkonly` on the finalized diagram after this edit; spec-keeper does not execute
shell commands. Implementation/tests/reports and review readiness do not constitute a learned PASS.
**Phase 2 remains ACTIVE, final verification/reviews PENDING. Phase 3+ remains planned and unimplemented**;
reviewers must verify legality, isolation, and zero-fallback learned evidence independently of the non-learned baseline.
The broader FIRST-training prerequisites and all proposed persistent learning/economy/search tests in
[ml-adjutant-weights.md](ml-adjutant-weights.md#9-future-persistent-acceptance--proposed-not-done) remain pending.
The challenge document specifies additional adversarial integrity cases.
Corpus provenance verification does not establish a learned player's performance.
