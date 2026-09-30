# PLAN — ML Adjutant: learn a ranker and prove the strict challenge

Status: **Preparatory catalog IMPLEMENTED and VERIFIED**, with the baseline full-app lint exception below.
Challenge phases 0–4 and optional phases 5–6 remain **PLANNED and unimplemented**.
Core `ai/definitions.ts` now owns all five IDs, canonical labels, and derived guards.
The app implements disabled placeholder entries and explicit unavailable admission for known
placeholder URLs or sessions. This completes the preparatory catalog, not a learning player.
The corpus schema audit below is complete; executable compatibility, training, and challenge
wins are not. Stockfish retirement is not an acceptance prerequisite.

Scope: a proposed top-level **`ml/`** training workspace. `ml` is workspace/tooling shorthand,
**not an Adjutant registry ID or a URL alias**. The exact future player ID is **`machine-learning`**.
The arena's `ScriptPlayer` remains its execution contract; the app consumes the core-derived
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
| [`packages/starchess-core/src/__tests__/adjutantDefinitions.test.ts`](../../packages/starchess-core/src/__tests__/adjutantDefinitions.test.ts) | EMPTY metadata shape, all-ID recognition, ready-only admission, rejection of `ml` and unknown inputs |
| [`apps/starchess/src/__tests__/singleOpponent.test.ts`](../../apps/starchess/src/__tests__/singleOpponent.test.ts) | App guards and distinct playable script execution |
| [`apps/starchess/src/__tests__/newGameSetupStore.test.tsx`](../../apps/starchess/src/__tests__/newGameSetupStore.test.tsx) | Disabled placeholder options, playable selection/Start, persisted setup |
| [`apps/starchess/src/__tests__/matchSessionStore.test.ts`](../../apps/starchess/src/__tests__/matchSessionStore.test.ts) | Preserve known placeholders for admission; retain legacy/unknown session handling |
| [`apps/starchess/src/__tests__/matchTitle.test.ts`](../../apps/starchess/src/__tests__/matchTitle.test.ts) | Canonical labels and safe unknown-record fallback |
| [`apps/e2e/tests/starchess/starchess-opponents.spec.ts`](../../apps/e2e/tests/starchess/starchess-opponents.spec.ts) | Browser selection, placeholder URL/session blocks, unchanged stored data, strategic rematch, setup normalization |

---

## Judgment of the original phases

The accepted architect review replaces Elo-first delivery with a pinned, executable challenge.
The normative acceptance contract is [ml-adjutant-challenge.md](ml-adjutant-challenge.md).

| Original phase | Judgment | Replacement |
|---|---|---|
| 1 — Elo ladder | Useful for comparative strength, inadequate for the named corpus and a 100% requirement. An average rating cannot excuse one failed case. | Strict serial harness in phase 1; exhaustive perfect gate in phase 4; optional Elo in phase 6. |
| 2 — Vectorisation | Keep observation isolation and candidate encoding. A new textual grammar or tensor architecture is not the first prerequisite. Enumeration alone does not guarantee legal admission. | Minimal versioned observation/features and ranked queues in phase 2, with authoritative commit gating. |
| 3 — Parallel + determinized play | Two separate scaling/search concerns, not prerequisites for proving 54 finite matches. | Serial first; worker pools and belief-world sampling remain separate optional phase-6 tasks. |
| 4 — Native evaluator | Outcome-based learning belongs in the core path. Replacing the classical projection or deleting Stockfish does not prove this challenge. | Frozen learned ranker in phase 3; evaluator/feed replacement remains optional phase 6. |
| 5 — Player | Too late: replay and candidate adapters are needed before training. Browser rollout and runtime fallback are distinct product work. | Adapters begin in phase 1, learned adapter in phase 3; browser integration remains optional phase 6. |

## Closed decisions and evidence boundary

- **Use 18 now, not 118.** The lead's workspace/parent glob and tracked-inventory audit found
  only `starchess-match-history-20260929-203446.json`. The supposed additional 100 exports
  remain unaudited and unavailable; this plan invents no missing path.
- **Blue = White = recorded player (`w`).** The corpus supplies white queues; the candidate
  counterplays as black/red (`b`). This is not a replay of the historical black strategic moves.
- **STRICT RECORDED QUEUES.** A rejected action, unaffordable full queue, or exhaustion before
  terminal fails that case. No substitution, truncation, skipped case, or dropped action is allowed.
- **Win both suites.** Require 18/18 corpus wins AND 36/36 live strategic wins AND integrity
  tests. Random samples and Elo do not replace exhaustive acceptance.
- **Start with a learned linear ranker.** Defer neural-network complexity until separate held-out
  measurements justify it. Defer textual `SCOBS`, worker pools, and determinization.

The lead separately owns the **PLANNED** manifest
`_spec/corpora/ml-adjutant-corpus.manifest.json`, including all 18 case IDs and provenance.
This docs-only change does not create it or assert that it exists.

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
No queue-admission benchmark, training run, or challenge match has been performed.

## Invariants (non-negotiable)

- **Core never depends on ML.** Dependency flows `ml/ → arena → core`; core stays pure,
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
| Deterministic settlement | `packages/starchess-arena/src/run/runMatch.ts`, `beginScTurn`, `endScTurn`, `mulberry32`; new benchmark adapter must isolate precommit inputs rather than expose sequential mutations. |
| Player contract | `packages/starchess-arena/src/players/types.ts`: `ScriptPlayer` / `SideContext`; the unrestricted snapshot and both-side bank stay host-side, not model-side. |
| Live opponent | `packages/starchess-arena/src/players/strategic.ts`: execute `strategicScript` with feed off, not a recorded response. |
| Candidate/application seam | `packages/starchess-core/src/ai/strategic/orchestrator.ts`: audit observation-safe reuse of `strategicCandidates`; gate through `applyCandidate` / `addScAction` and explicit host affordability. |
| Visibility and memory | `getSideVision`, strategic witness/tracking, runner/attacker memory, and CC intel provide building blocks; audit each exported feature and candidate channel. |
| Terminal truth | `packages/starchess-core/src/outcome.ts`: `scOutcome`, including actual turn-45 HP decisions; historical winner labels are not benchmark outcomes. |
| Product admission | Existing registry and app guards remain as verified above; no new playable option in this slice. |

## Phase 0 — Pin and audit the available corpus

**Deliverables.** Lead creates the 18-case manifest with source hash/size/version/timestamp,
case IDs, opening, white planning queues, trace hashes, and extraction/repair provenance.
Preserve the source export unchanged. Validate all pins and counts before every gate.

**Done when.** The manifest audit reproduces the supplied schema facts and makes each queue's
planning ordinal inspectable. Mark executable compatibility as pending until phase 1 tests it.
If the additional 100 become available, audit their actual locations, hashes, IDs, duplicates,
rules, and trace compatibility before approving a new versioned 118-case challenge.
Do not silently expand the existing denominator.

## Phase 1 — Strict serial harness, adapters, and baseline

**Deliverables.** Implement the white recorded-queue adapter, isolated candidate adapter,
turn-open observation boundary, atomic queue validation, hosted bank ledger, deterministic
settlement, terminal-first checks, and failure reports specified in the challenge document.
Pin numerical inference/match watchdog budgets in versioned harness configuration before runs.

Run a non-learned strategic baseline through this same candidate boundary. Report its actual
18-case and 36-match results, including admission/exhaustion failures; do not assume wins.
Use it to validate plumbing and provide a comparison, not to satisfy the learned gate.

**Done when.** Integrity tests and deterministic reruns pass; baseline reports enumerate every
scheduled case. Full-state/metadata leakage and white-first queue/bank exposure tests must pass
before creating training examples. A strict trace failure remains visible and can block the
challenge; a report alone is not proof that all traces support winning counterplay.

## Phase 2 — Minimal observation, feature, and candidate contract

**Deliverables.** Version a structured authorized observation and numeric feature encoder.
Include own resources/units, visibility, revealed opponent facts, authorized siege/mine facts,
turn information, and side-memory/belief features only where that side can know them.
Represent unknown facts explicitly. Do not pretend a fog-filtered placement is a valid SCFEN.

Version candidate queues, relative action order/timing, own spend, feature semantics, and stable
tie-breaking. Reuse existing candidate machinery only after membership/order/score leakage
audits pass; remove full-state dependencies from the model-facing candidate interface.
Validate the chosen queue authoritatively without exposing hidden legality probes to the policy.

**Done when.** Encode/decode preserves authorized observation semantics, hidden-state changes
leave model inputs and candidate channels invariant, and admission/gas/mineral tests pass.
A minimal inspectable structure is sufficient; textual grammar, planes, and factored heads are
not prerequisites. Candidate coverage limits strength and must be measured rather than assumed.

## Phase 3 — Learn and freeze a ranker from outcomes

**Deliverables.** Fit `score(o, c) = w · features(o, c)` through an explicit training loss.
Add a `ScriptPlayer`-compatible adapter that receives only the authorized interface, selects a
queue using the learned scores, and delegates authoritative commit to the host.
Keep candidate selection genuinely learned; a fallback strategic decision does not count.

White demonstrations or strategic teacher labels can optionally bootstrap the learner.
Train counterplay using newly executed games and terminal candidate-side outcome rewards.
Use a separate seeded training-selection stream; do not feed game IDs, corpus indexes, future
white actions, or historical outcomes into the policy. Log optimizer/loss, training seeds,
dataset versions, candidate coverage, and model artifact hash.

**Done when.** A repeatable training run produces changed learned weights and a frozen artifact.
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
  joint-action reasoning; alternating minimax/MCTS cannot be used unchanged.
- Elo with uncertainty, draws worth half a point, broader openings/seeds, and future held-out
  cases. Same numeric arena seed across swapped seats does not mean identical RNG streams.
- Native StarChess evaluator/feed experiments. Classical FEN omits relevant variant mechanics;
  any replacement must define score perspective explicitly. Stockfish deletion is independent.
- Browser budgets, model distribution, worker/WebGPU support, explainability, and explicit
  product fallback. Implement `machine-learning` before changing registry readiness; never add
  an `ml` alias. Keep `rlcd` EMPTY: this plan defines no RLCD algorithm or runtime.

`ml/` remains proposed ownership notation. Lead/build must settle packaging and workspace
configuration before source work; this docs-only slice changes neither. Browser and scale
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

All test paths below are **PROPOSED**, not claims about existing files or executed tests.
`ml/` paths describe proposed responsibilities pending the packaging decision.

| Proposed test/report path | Phase | Verification purpose |
|---|---|---|
| `ml/harness/__tests__/corpusAudit.test.ts` | 0 | Pins, 18 unique cases/traces, action counts, extraction alignment, and source provenance. |
| `ml/harness/__tests__/strictRecordedQueues.test.ts` | 1 | Planning ordinals vs chip plies, terminal-first behavior, seq reassignment, full-queue rollback, missing actor, affordability, exhaustion, and no substitutions. |
| `ml/harness/__tests__/observationIsolation.test.ts` | 1–2 | Same precommit inputs; no enemy queue/bank deltas or future trace/metadata; hidden-state invariance across features and candidate membership/order/scores. |
| `ml/harness/__tests__/resourceLedger.test.ts` | 1 | Opening bank, deploy spends, income, gas; reject insufficiency rather than accept clamped debit. |
| `ml/harness/__tests__/determinism.test.ts` | 1–4 | Seeded reruns match `scfens`/resolves/results, excluding IDs/timestamps. |
| `ml/codec/__tests__/authorizedFeatures.test.ts` | 2 | Versioned observation round trip, unknowns, authorized memory, queue feature coverage. |
| `ml/player/__tests__/learnedRanker.test.ts` | 3 | Loss-driven weight changes, frozen artifacts, selected-queue admission, no fallback/online updates. |
| `ml/harness/__tests__/perfectGate.test.ts` | 4 | Exactly 18 corpus + 36 live strategic wins; every non-win/integrity failure fails the gate. |
| `ml/preference/__tests__/preferenceLoss.test.ts` | 5, optional | Same-observation human pairs, preference-loss direction, policy regularization. |

**Pending executable work:** lead publishes the manifest; build implements phases 1–4 and
persists the tests; reviewers verify legality, isolation, and zero-fallback evidence.
The challenge document specifies additional adversarial integrity cases.
This plan edit is not an Upgrade Complete claim and does not redo unrelated diagrams.
