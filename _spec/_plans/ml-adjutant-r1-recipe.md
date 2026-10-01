# ML Adjutant — R1 concept decisions and experimental recipe

Status: **R1.1–R1.8 direction choices RECORDED; contract freeze INCOMPLETE.**
This record consolidates Executor's answers to the eight concept questions.
It does not complete R1 or authorize implementation, dependency/export changes, training, an approved run, or publication.
R2–R8 remain pending and unimplemented. Weights remain **NONE**.
The [roadmap](PLAN-ml-adjutant.md) retains R0 **REVIEWED / BLOCKED** with **7 HIGH + 8 MEDIUM** pending;
security rereview remains **UNRECORDED**. Complete R0–R5 before training at R6.

The selected numeric values form an **experimental profile**, not validated performance settings.
Freeze exact semantics and persist gradient, numerical, coverage, and runtime validation before approving a run.
Readings below support concept review; they are not executable evidence or claims of achieved strength.

## R1.1 — Dedicated training package

**Concept.** Ownership separates the learner and its tooling from the pure rules engine and the trusted match host.
A workspace folder, npm package identity, and public export layout are separate decisions.

**User choice.** Select `packages/starchess-training` as the dedicated training owner.
The path is selected; the npm ID and public export layout remain **TBD**.
The folder does not exist. Historical `ml/` notation is superseded ownership shorthand, not a registry ID or URL alias.
The future player ID remains `machine-learning`.

**Reason and boundary.** Keep training dependencies outside core and the browser.
The selected dependency direction is `training → arena authorized public contracts → pure core`.
`pnpm-workspace.yaml` already includes `packages/*`; selecting the folder requires no workspace-pattern change today.
Arena's current root exports expose unrestricted `SideContext` and do not export the challenge contracts.
Design an observation-only public API before a learner imports them.
Keep host `ScriptPlayer` execution and opponent context separate; neither unrestricted context nor private host data is model-facing.

Current source inventory covers core/arena plus root scripts and arena hermetic diagnostics, not the future training path.
Current offline dependency acquisition covers only core and arena.
Future implementation must deliberately extend dependency closure, export resolution, source-inventory roots/partitions/entrypoints,
hermetic source/test/config capture, installed-tree/store context, and CI verification to the training closure.
Do not blindly relax the current execution→contracts restriction for the unused baseline.
This record changes none of those configurations.

**Readings.** [Weights §2: current boundary](ml-adjutant-weights.md#2-current-inspected-phase-2-contract--no-weights),
[§8: artifact contract](ml-adjutant-weights.md#8-planned-artifact-and-inference-contract),
[roadmap invariants](PLAN-ml-adjutant.md#invariants-non-negotiable), and
[pnpm 10 workspaces](https://pnpm.io/10.x/workspaces).

**Remaining freeze items.** Approve npm identity, authorized public API/types and export paths, host/learner adapter separation,
dependency closure, audit partitions/entrypoints, hermetic capture/store context, and CI scope.
No package, dependency, new export, or projected diagram entry is implemented here.

## R1.2 — Family-quota composition

**Concept.** A bounded generator reserves proposal capacity across action families and composes ordered queues.
Family quotas prevent one abundant family from consuming every slot; they do not prove legal or exhaustive coverage.

**User choice.** Select family-quota composition for all seven supported kinds and meaningful same-window combinations.
No numeric quota allocation is selected.

**Reason and boundary.** Broaden candidates beyond the current classical/Marine-deploy singletons and pass.
Retain order and timing, including B→C and C→F compositions, rather than flattening queues into unordered sets.
Freeze same-actor composition semantics against native rules; do not invent permission for multiple specials on one actor.
Apply only authorized own-resource and actor/shape rules when pruning.
Hidden host probes may not influence membership, ordering, scoring, or pruning.
Only the selected whole queue reaches private host admission; a rejection permits no next-candidate rescue.

The approved generation queue-length upper bound is **4**: current maximum gas **3**, minimum special cost **1**,
and at most **1 classical** imply at most three specials plus one classical.
This bound does not guarantee four actions can be admitted.
The codec's `MAX_QUEUE_ACTIONS = 65` stays unchanged; encoding capacity is a different contract.

**Readings.** [Weights §3: conceptual and bounded domains](ml-adjutant-weights.md#3-all-actions-and-all-combinations-exact-domain-versus-bounded-implementation),
[§6: priority families](ml-adjutant-weights.md#6-vision-attack-lines-and-priority-families),
[§9: coverage verification](ml-adjutant-weights.md#9-future-persistent-acceptance--proposed-not-done), and
[native queue shape/order](../packages/starchess-core/scfen-queue.puml).

**Remaining freeze items.** Define available-family detection, quota allocation and redistribution order,
canonical composition traversal, timing extensions, same-actor handling, B→C/C→F composition semantics,
authorized pruning rules, deduplication order, and exhaustive small-fixture references.
Report omitted families and pruning rather than claiming completeness.

## R1.3 — Typed feature blocks and a fixed flat manifest

**Concept.** Typed blocks express semantic feature families; a fixed ordered manifest flattens them into the linear ranker's vector.
Every weight aligns with a named feature, not a particular move or queue.

**User choice.** Select typed feature blocks plus a fixed flat ordered manifest for v2.

**Reason and boundary.** Preserve inspectable feature ownership while making vector alignment exact and reproducible.
Candidate-independent scalars cancel in linear ranking and softmax; v2 must include genuine candidate×context interactions.
Authorized economic, ray/vision, tactical, and exploration inputs must retain masks and uncertainty.
Novelty/coverage proxies do not assert entropy reduction or hidden-state knowledge.
The current **158** ranker entries belong to v1, not the future v2 dimension.

**Readings.** [Weights §1: coefficient semantics and cancellation](ml-adjutant-weights.md#1-what-a-weight-means),
[§5: economic interactions](ml-adjutant-weights.md#5-authorized-economics-and-trade-losses-required-before-first-training),
[§6: positional interactions](ml-adjutant-weights.md#6-vision-attack-lines-and-priority-families), and
[§8: exact artifact alignment](ml-adjutant-weights.md#8-planned-artifact-and-inference-contract).

**Remaining freeze items.** Define actual v2 version strings, typed block schemas, feature names, dimension,
scales, knowledge masks, flattening order, interaction set and calculus, aggregation/collision limitations,
and the public artifact schema. Persist finite-value, alignment, cancellation, and interaction tests.
Do not publish a guessed dimension or treat proposed field names as final schema.

## R1.4 — Authorized event ledger plus normalized snapshots

**Concept.** Events preserve paid-debit and lineage history; normalized side-authorized snapshots describe current observable state.
Consistency checks join these complementary views without exposing host-private truth.

**User choice.** Select combined authorized events→ledger and normalized snapshots with consistency checks.

**Reason and boundary.** Current square-sighting memory cannot identify paid investments or confirmed destruction by lineage.
In the selected design, the host owns actual debits and authorized lineage/event production.
Own paid loss differs from replacement valuation: opening endowments have zero paid basis, and free promotion creates no payment.
Movement and transformation preserve lineage; confirmed destruction retires investment once.
Rejected/rolled-back admission produces no debit.
Opponent loss stays a witnessed lower bound with explicit uncertainty, never an exact opponent bank or investment ledger.
Fog disappearance alone does not confirm a loss.
Private KVS, private queues, and full snapshots never become model channels.

**Readings.** [Weights §2: current memory limitation](ml-adjutant-weights.md#2-current-inspected-phase-2-contract--no-weights),
[§5: investment and confirmed-loss semantics](ml-adjutant-weights.md#5-authorized-economics-and-trade-losses-required-before-first-training),
[§9: ledger verification](ml-adjutant-weights.md#9-future-persistent-acceptance--proposed-not-done), and
[roadmap invariants](PLAN-ml-adjutant.md#invariants-non-negotiable).

**Remaining freeze items.** Define event authorization and payloads, lineage IDs, event ordering and deduplication,
visible-loss confirmation and opponent lower-bound rules, uncertainty representation, opening paid basis,
replacement versus investment fields, same-turn chip ordering, rollback/no-debit events,
and event/snapshot reconciliation semantics. Persist conservation and whole-channel noninterference checks.

## R1.5 — Finite proposal and attempt budgets

**Concept.** A retained-candidate cap bounds scoring cost; an attempted-extension cap bounds generator work even when proposals duplicate or prune.
These are different counters.

**User choice.** Select a standard cap of **512 unique candidates INCLUDING pass** per policy call
and **2048 attempted extensions INCLUDING duplicates and pruned extensions**.
These are caps, not requirements to emit 512 candidates or exhaust 2048 attempts.

**Reason and boundary.** Pass consumes one retained slot and must survive quotas and truncation.
Deduplication or pruning cannot hide generator work from the attempt limit.
Combine these caps with R1.2's **4-action** generation upper bound without changing the **65-action** codec bound.
No hidden-legality retry budget exists.

**Readings.** [Weights §3: bounded generation](ml-adjutant-weights.md#3-all-actions-and-all-combinations-exact-domain-versus-bounded-implementation),
[§4: horizon semantics](ml-adjutant-weights.md#4-horizon-1-first-conditional-plans-up-to-3-windows-later), and
[§9: reference coverage](ml-adjutant-weights.md#9-future-persistent-acceptance--proposed-not-done).

**Remaining freeze items.** Specify exact counter increments, family quota interaction, extension traversal/truncation,
canonical uniqueness, pass reservation, stopping behavior, counter/version metadata, and pruning categories.
Validate small-domain coverage and worst-case runtime; counts and encodings alone do not demonstrate winning coverage.

## R1.6 — SGD with REINFORCE outcome rewards

**Concept.** REINFORCE learns from sampled actions and actual episode returns; SGD applies the loss gradient directly.
An action-independent baseline reduces gradient variance without using the current episode's choices or reward in advance.

**User choice.** Select **SGD + REINFORCE**, not Adam and not imitation bootstrap.
Use terminal candidate-side rewards **+1 win / 0 draw / −1 loss or policy/challenge failure**.
Derive the baseline from preceding episodes and fix it before the current episode samples actions.
Select this experimental profile:

| Setting | Selected value |
|---|---|
| Initialization | Zero for every v2 coefficient |
| Arithmetic | float64 CPU |
| Learning rate | `η = 0.001` |
| Softmax temperature | `τ = 1` |
| L2 coefficient | `λ = 0.0001` |
| Update cadence | One complete episode per update |
| Gradient clipping | None |

**Reason and boundary.** Learn shared linear weights from newly executed candidate outcomes rather than historical White winner labels.
Keep stable softmax sampling in training and frozen score argmax in evaluation.
The [existing proposed loss/gradient](ml-adjutant-weights.md#7-proposed-outcome-driven-phase-3-learning--not-implemented)
uses `L = −A Σ_t log π + λ||w||²/2`; freeze its exact implementation conventions before running.
Infrastructure/provenance aborts are not fake wins or fabricated policy outcomes.
The existing recipe aborts their training batch; every gate failure remains in the strict denominator.
Dense reward shaping, teacher warm-start, and Adam are not selected for this profile.

**Readings.** [Weights §7: loss and baseline](ml-adjutant-weights.md#7-proposed-outcome-driven-phase-3-learning--not-implemented),
[§9: gradient/numerical verification](ml-adjutant-weights.md#9-future-persistent-acceptance--proposed-not-done),
[Sutton et al. (1999), policy-gradient methods](https://papers.nips.cc/paper/1713-policy-gradient-methods-for-reinforcement-learning-with-function-approximation), and
[Williams (1992), REINFORCE](https://doi.org/10.1007/BF00992696).

**Remaining freeze items.** Resolve gradient sum versus mean and episode-length treatment;
define the exact SGD update and L2 conventions consistently with the displayed loss/gradient.
Define baseline-eligible completions, startup value and historical aggregation rules,
policy/challenge failure classification versus infrastructure aborts, incomplete-episode treatment, and budget accounting.
Persist analytic/finite-difference gradient checks, update direction, baseline independence, stable-softmax/finite-value checks,
and runtime validation for the selected no-clipping profile. The numeric selection establishes no performance claim.

## R1.7 — Five independent seeded artifacts

**Concept.** Independent training seeds produce separately auditable runs and artifacts.
Training randomness and fixed gate randomness serve different roles and must not share accidental state.

**User choice.** Select exactly **five training master seeds: 101, 102, 103, 104, 105**.
Produce **five independent artifacts**; do not automatically average their weights.
Start at **H=1**; **H≤3** remains later work, without changing gate seeds.

**Reason and boundary.** Expose variability rather than concealing it in an unapproved averaged model.
Derive separate named **selection**, **environment-settlement**, **policy-sampling**, and **opponent** streams
from each training master; the derivation algorithm remains **TBD**.
Specify the generator stream as **unused** for the selected deterministic generator; never leave its status implicit.
Keep fixed gate pins: **corpus arena seed 0**, **inference seed 0 reset per match**,
and **live arena seeds 0..17 with both candidate seats** (36 live cases).
No new seed schedule or held-out claim is introduced for the pinned 18-case corpus.

**Readings.** [Weights §7: training versus inference](ml-adjutant-weights.md#7-proposed-outcome-driven-phase-3-learning--not-implemented),
[§8: provenance and freeze](ml-adjutant-weights.md#8-planned-artifact-and-inference-contract),
[roadmap invariants](PLAN-ml-adjutant.md#invariants-non-negotiable), and
[Henderson et al., Deep Reinforcement Learning that Matters (v3)](https://arxiv.org/abs/1709.06560v3).

**Remaining freeze items.** Define RNG algorithms, derivation/domain separation, stream lifecycle/reset semantics,
actual derived seeds and version metadata, and reproducibility checks.
Freeze the artifact-selection rule **before comparing seeds**; that rule remains **TBD**.
Do not choose or tune an artifact opportunistically from gate results.

## R1.8 — Per-artifact episode ceiling and frozen gate

**Concept.** A finite episode ceiling bounds initial training work; it neither guarantees a useful model nor authorizes a run.
The training stopping rule, checkpoint policy, and final artifact choice require explicit semantics.

**User choice.** Select an initial maximum of **1000 episodes PER artifact**.
With five independent artifacts, the total ceiling is **5000 episodes**.
This is **not 1000 total** and **not 3000 total**.

**Reason and boundary.** Bound the first experiment while keeping each master-seed run independent.
One complete episode per update does not approve an unlimited infrastructure-retry budget.
Freeze failure accounting before running; never silently allocate infrastructure failures outside the cap.
The pinned corpus may support training/regression plus a live-strategic curriculum, not held-out acceptance claims.
Load the selected trained artifact once for its gate with **weights frozen**.
No online updates, heuristic/strategic fallback, or hidden next-candidate rescue may repair a failed selected queue.
The strict gate still requires **18/18 corpus + 36/36 live wins**, integrity, semantic reruns, and `fallbackCount = 0`.

**Readings.** [Weights §7: episode/update recipe](ml-adjutant-weights.md#7-proposed-outcome-driven-phase-3-learning--not-implemented),
[§8: immutable artifact](ml-adjutant-weights.md#8-planned-artifact-and-inference-contract),
[§9: persistent acceptance](ml-adjutant-weights.md#9-future-persistent-acceptance--proposed-not-done), and
[roadmap Phase 4 gate](PLAN-ml-adjutant.md#phase-4-exhaustive-perfect-gate).

**Remaining freeze items.** Define episode/cap accounting for every completion and abort, finite retry handling,
epoch identifiers from initialization at 0 through at most 1000 episodes, stopping criteria and checkpoints,
curriculum/data selection and seats, selection types, schema/version metadata, and candidate/pruning counters.
Persist gradient, numerical, coverage, runtime, provenance, and artifact reload validation before approving R6.
R1 selections are recorded; exact contracts, validation, R0 closure, and R2–R5 implementation/readiness remain incomplete.
