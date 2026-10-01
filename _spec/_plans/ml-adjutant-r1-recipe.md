# ML Adjutant — R1 concept decisions and experimental recipe

Status: **R1.1–R1.8 original choices and nine remaining-concept directions RECORDED; contract freeze INCOMPLETE.**
This record preserves Executor's eight original choices and records the accepted answers to nine follow-up TUI questions.
It does not complete R1 or authorize implementation, dependency/export changes, training, an approved run, or publication.
R2–R8 remain pending and unimplemented. Weights remain **NONE**.
The [roadmap](PLAN-ml-adjutant.md) retains R0 **REVIEWED / BLOCKED** with **7 HIGH + 8 MEDIUM** pending;
security rereview remains **UNRECORDED**. Complete R0–R5 before training at R6.

The selected numeric values form an **experimental profile**, not validated performance settings.
Freeze exact semantics and persist gradient, numerical, coverage, and runtime validation before approving a run.
Readings below support concept review; they are not executable evidence or claims of achieved strength.

## Nine-detail decision record — accepted directions, not a completed freeze

The architecture direction is compatible with task `ses_f06d4c62cffe4MgE59PmzWw1rO`: **R1 contract freeze remains INCOMPLETE**.
Each selection below replaces only its decided field; the remaining-field lists in R1.1–R1.8 still gate implementation/readiness.

| Detail | Accepted direction | Glossary / local reading |
|---|---|---|
| A — Public API | **Purpose-based interfaces:** authorized `/observations`, `/candidates`, `/features`, `/artifacts` suffixes; package assignment, npm ID, signatures, and closure/CI remain TBD. | Public API = approved import surface, not host-private state. [Weights §8](ml-adjutant-weights.md#8-planned-artifact-and-inference-contract). |
| B — Quotas | **Composition emphasis:** when all seven canonical families are available, `7×48 + 175 + 1 pass = 512` capacity; `2048` attempted extensions still includes duplicates/pruned. Mixed-queue ownership and shared-pool mechanics remain TBD. | Capacity = upper allocation, not mandatory emission or unique-output proof. [Weights §3](ml-adjutant-weights.md#3-all-actions-and-all-combinations-exact-domain-versus-bounded-implementation). |
| C — Features | **Action-position blocks:** ordered candidate-context blocks at four rules-derived positions, unknown/absent masks, plus queue synergy and explicit interactions; exact manifest/dimension remain TBD. | Interaction = candidate-dependent context effect, not automatic nonlinear behavior from linear positional weights. [Weights §5](ml-adjutant-weights.md#5-authorized-economics-and-trade-losses-required-before-first-training), [§6](ml-adjutant-weights.md#6-vision-attack-lines-and-priority-families). |
| D — Ledger | **Boundary batches:** authorized ordered events plus normalized snapshots at relevant chip/settlement boundaries; reconcile before consumption. Payload/order/ID/mismatch details remain TBD. | Lineage = host-issued own identity retained through movement/transformation; paid basis ≠ replacement value. [Weights §5](ml-adjutant-weights.md#5-authorized-economics-and-trade-losses-required-before-first-training). |
| E — RNG | **Hash derivation:** SHA-256 plus existing `mulberry32`, versioned master+stream-label derivation; encoding/mapping/collision/reset policy remains TBD before pinning derived seeds. | Stream = separate named random sequence for one responsibility. [Weights §7](ml-adjutant-weights.md#7-proposed-outcome-driven-phase-3-learning--not-implemented), [§8](ml-adjutant-weights.md#8-planned-artifact-and-inference-contract). |
| F — Failure | **Stop experiment:** infrastructure/provenance abort stops ALL training; every started attempt consumes the per-artifact cap. Failure/update eligibility details remain TBD. | Abort ≠ policy/challenge return `−1`; no fabricated reward or partial gradient. [Weights §7](ml-adjutant-weights.md#7-proposed-outcome-driven-phase-3-learning--not-implemented). |
| G — Selection | **Preselect seed 101:** its final VALID artifact is prospectively primary; four others measure variability. Diagnostic cadence is every 100 STARTED ATTEMPTS. Curriculum mixture/order still awaits an explicit R1 decision; the alternating pattern is an illustrative proposal, not separately selected/approved or frozen. | Primary = chosen before comparisons; diagnostic checkpoint ≠ fallback artifact. [Weights §7](ml-adjutant-weights.md#7-proposed-outcome-driven-phase-3-learning--not-implemented), [§8](ml-adjutant-weights.md#8-planned-artifact-and-inference-contract). |
| H — Learning | **All-history mean:** per-seed mean of past eligible completed returns, startup `0`, fixed before sampling; summed episode gradient and L2 once per episode update. Eligibility/update ordering remains TBD. | Baseline reduces variance; it is not a per-length mean objective. [Weights §7](ml-adjutant-weights.md#7-proposed-outcome-driven-phase-3-learning--not-implemented). |
| I — Validation | **Small-to-large:** gradient/finite difference → numeric extremes → exhaustive small fixtures → capped worst-case runtime → reload/provenance. All privacy/ledger/Phase 1 resource checks remain required; exact criteria remain TBD. | Finite difference approximates a derivative to check the analytic gradient. [Weights §9](ml-adjutant-weights.md#9-future-persistent-acceptance--proposed-not-done). |

**Remaining-field freeze.** A direction is not an exact data or execution contract.
Freeze all explicitly remaining API/package/closure, quota/traversal/identity, v2 manifest, ledger reconciliation,
RNG mapping/lifecycle, failure/budget/update, curriculum/checkpoint/stopping, and validation fields below before R1 closes.
Do not fill them with proposed first-action-kind/first-special ownership, guessed feature counts, derived seeds,
new tolerances, new runtime numbers, or inferred approvals. No development suite, model average, or all-five-artifact gate was selected.

**Additional readings for the new fields.** Local weights §§3, 5, 6, 7, 8, and 9 above own the contracts.
For the gradient/variance concepts, see [Sutton et al. (1999)](https://papers.nips.cc/paper/1713-policy-gradient-methods-for-reinforcement-learning-with-function-approximation)
and [Williams (1992)](https://doi.org/10.1007/BF00992696).
For numerical derivative checks, see [SciPy `check_grad`](https://docs.scipy.org/doc/scipy/reference/generated/scipy.optimize.check_grad.html).
These math readings supply explanations, not a dependency choice, fetched-source verification, or test evidence.

## R1.1 — Dedicated training package

**Concept.** Ownership separates the learner and its tooling from the pure rules engine and the trusted match host.
A workspace folder, npm package identity, and public export layout are separate decisions.

**User choice.** Select `packages/starchess-training` as the dedicated training owner.
The path is selected; the npm ID remains **TBD**, and any proposed npm name is not approved.
Follow-up A selects **purpose-based interfaces** with authorized `/observations`, `/candidates`, `/features`, and `/artifacts` suffixes.
Exact package assignment, full import paths, and signatures remain **TBD**.
The folder does not exist. Historical `ml/` notation is superseded ownership shorthand, not a registry ID or URL alias.
The future player ID remains `machine-learning`.

**Reason and boundary.** Keep training dependencies outside core and the browser.
The selected dependency direction is `training → arena authorized public contracts → pure core`.
`pnpm-workspace.yaml` already includes `packages/*`; selecting the folder requires no workspace-pattern change today.
Arena's current root exports expose unrestricted `SideContext` and do not export the challenge contracts.
Design an observation-only public API before a learner imports them.
Keep host `ScriptPlayer` execution and opponent context separate; neither unrestricted context nor private host data is model-facing.
Purpose-based exports do not place all artifact logic in arena or approve unrestricted `SideContext` publication.

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

**Remaining freeze items.** Approve npm identity, package assignment/full export paths, authorized public API/types/signatures, host/learner adapter separation,
dependency closure, audit partitions/entrypoints, hermetic capture/store context, and CI scope.
No package, dependency, new export, or projected diagram entry is implemented here.

## R1.2 — Family-quota composition

**Concept.** A bounded generator reserves proposal capacity across action families and composes ordered queues.
Family quotas prevent one abundant family from consuming every slot; they do not prove legal or exhaustive coverage.

**User choice.** Select family-quota composition for all seven supported kinds and meaningful same-window combinations.
Follow-up B selects **composition emphasis**: when all seven canonical families are available,
reserve **48 slots per family = 336**, **175 shared composition slots**, and **1 pass slot**, totaling **512**.
These numbers allocate capacity; they do not require emission or guarantee 512 unique outputs.
The **2048 attempted-extension** cap always includes duplicates and pruned extensions.

**Reason and boundary.** Broaden candidates beyond the current classical/Marine-deploy singletons and pass.
Retain order and timing, including B→C and C→F compositions, rather than flattening queues into unordered sets.
Freeze same-actor composition semantics against native rules; do not invent permission for multiple specials on one actor.
Apply only authorized own-resource and actor/shape rules when pruning.
Hidden host probes may not influence membership, ordering, scoring, or pruning.
Only the selected whole queue reaches private host admission; a rejection permits no next-candidate rescue.

Current resource rules imply a same-window queue-length ceiling of **4**: maximum gas **3**, minimum special cost **1**,
and at most **1 classical** imply at most three specials plus one classical.
This is a rules-derived ceiling, not an additional user-selected generator setting; freeze its versioned enforcement contract.
This bound does not guarantee four actions can be admitted.
The codec's `MAX_QUEUE_ACTIONS = 65` stays unchanged; encoding capacity is a different contract.

**Readings.** [Weights §3: conceptual and bounded domains](ml-adjutant-weights.md#3-all-actions-and-all-combinations-exact-domain-versus-bounded-implementation),
[§6: priority families](ml-adjutant-weights.md#6-vision-attack-lines-and-priority-families),
[§9: coverage verification](ml-adjutant-weights.md#9-future-persistent-acceptance--proposed-not-done), and
[native queue shape/order](../packages/starchess-core/scfen-queue.puml).

**Remaining freeze items.** Define available-family detection, canonical family order and redistribution when families are unavailable,
the single quota-owner rule for mixed queues, shared-pool eligibility/traversal/distribution, pass reservation,
canonical composition traversal, timing extensions, same-actor handling, B→C/C→F composition semantics,
authorized pruning rules, deduplication order, and exhaustive small-fixture references.
Neither first-action-kind nor first-special ownership was selected by the TUI; both remain TBD proposals.
Counting one queue against two pools never makes it two unique candidates; freeze canonical content-hash identity/deduplication semantics.
Report omitted families and pruning rather than claiming completeness.

## R1.3 — Typed feature blocks and a fixed flat manifest

**Concept.** Typed blocks express semantic feature families; a fixed ordered manifest flattens them into the linear ranker's vector.
Every weight aligns with a named feature, not a particular move or queue.

**User choice.** Select typed feature blocks plus a fixed flat ordered manifest for v2.
Follow-up C selects **action-position blocks** containing candidate-context at each of the four rules-derived positions.
Preserve action order and distinguish unknown from absent through masks.
Four positions derive from the existing gas-3 plus one-classical ceiling; no additional numeric setting is approved.

**Reason and boundary.** Preserve inspectable feature ownership while making vector alignment exact and reproducible.
Candidate-independent scalars cancel in linear ranking and softmax; v2 must include genuine candidate×context interactions.
Authorized economic, ray/vision, tactical, and exploration inputs must retain masks and uncertainty.
Novelty/coverage proxies do not assert entropy reduction or hidden-state knowledge.
Retain queue-level combo/timing synergy and candidate×economic/vision/tactics/exploration interactions.
Linear position-only weights do not automatically supply nonlinear interactions between positions.
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
Follow-up D selects **boundary batches**: authorized ordered events plus normalized snapshots at relevant chip/settlement boundaries.
Reconcile the batch before feature or learner consumption.

**Reason and boundary.** Current square-sighting memory cannot identify paid investments or confirmed destruction by lineage.
In the selected design, the host owns actual debits and authorized lineage/event production.
Use host-issued own lineage IDs and side-local authorized event sequences; identifiers/sequence gaps must not disclose hidden event counts.
Own paid loss differs from replacement valuation: opening endowments have zero paid basis, and free promotion creates no payment.
Movement and transformation preserve lineage; confirmed destruction retires investment once.
Rejected/rolled-back admission produces no debit.
Opponent loss stays a witnessed lower bound with explicit uncertainty, never an exact opponent bank or investment ledger.
Fog disappearance alone does not confirm a loss.
Private KVS, private queues, and full snapshots never become model channels.
Raw events containing full resolved information remain private; only authorized normalized batches cross the model boundary.

**Readings.** [Weights §2: current memory limitation](ml-adjutant-weights.md#2-current-inspected-phase-2-contract--no-weights),
[§5: investment and confirmed-loss semantics](ml-adjutant-weights.md#5-authorized-economics-and-trade-losses-required-before-first-training),
[§9: ledger verification](ml-adjutant-weights.md#9-future-persistent-acceptance--proposed-not-done), and
[roadmap invariants](PLAN-ml-adjutant.md#invariants-non-negotiable).

**Remaining freeze items.** Define event authorization/payloads, lineage ID formula, side-local sequence/order and deduplication,
visible-loss confirmation and opponent lower-bound rules, uncertainty representation, zero opening/free-promotion paid-basis encoding,
separate replacement/investment fields, same-turn chip/batch ordering, rollback/no-debit events,
and event/snapshot reconciliation and mismatch semantics. Persist conservation and whole-channel noninterference checks.

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
canonical content-hash uniqueness, pass reservation, stopping behavior, counter/version metadata, and pruning categories.
Validate small-domain coverage and worst-case runtime; counts and encodings alone do not demonstrate winning coverage.

## R1.6 — SGD with REINFORCE outcome rewards

**Concept.** REINFORCE learns from sampled actions and actual episode returns; SGD applies the loss gradient directly.
An action-independent baseline reduces gradient variance without using the current episode's choices or reward in advance.

**User choice.** Select **SGD + REINFORCE**, not Adam and not imitation bootstrap.
Use terminal candidate-side rewards **+1 win / 0 draw / −1 loss or policy/challenge failure**.
Follow-up H selects the **per-seed all-history mean of past eligible completed returns**, with **startup baseline 0**.
Fix it before the current episode samples actions; incorporate its return only after eligible completion.
Do not mix seeds or use the current episode's return in its own baseline. Recent-100 and EMA baselines were not selected.
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
Follow-up H selects the **summed episode gradient**, not a per-length mean objective, and **L2 once per episode update**.
The [loss/gradient](ml-adjutant-weights.md#7-proposed-outcome-driven-phase-3-learning--not-implemented)
is `L = −A Σ_t log π + λ||w||²/2`, with `w′ = w − η∇L`; freeze the remaining data/update conventions before running.
Infrastructure/provenance aborts are not fake wins or fabricated policy outcomes.
Follow-up F selects **stop the experiment**: an infrastructure/provenance abort stops **ALL training**, not just a batch or one seed.
Preserve consumed-attempt counters and diagnostics; abort the episode without fabricated reward or a partial gradient update.
Every started attempt counts toward the per-artifact 1000 cap; every gate failure remains in the strict denominator.
Policy/challenge failures retain the failed sampled choice and reward `−1`.
No unlimited infrastructure retry or automatic resume is authorized, even from a verified checkpoint.
Any new continuation requires explicit decisions and preservation of the remaining budget.
Dense reward shaping, teacher warm-start, and Adam are not selected for this profile.

**Readings.** [Weights §7: loss and baseline](ml-adjutant-weights.md#7-proposed-outcome-driven-phase-3-learning--not-implemented),
[§9: gradient/numerical verification](ml-adjutant-weights.md#9-future-persistent-acceptance--proposed-not-done),
[Sutton et al. (1999), policy-gradient methods](https://papers.nips.cc/paper/1713-policy-gradient-methods-for-reinforcement-learning-with-function-approximation), and
[Williams (1992), REINFORCE](https://doi.org/10.1007/BF00992696).

**Remaining freeze items.** Define the eligible-completion data contract and baseline-history ordering relative to the SGD update.
Freeze the exact failure taxonomy, baseline eligibility for policy failures/empty-decision episodes/aborts,
zero-decision update and incomplete-episode handling, and started-attempt counter boundaries/budget accounting.
The sum objective, L2-once convention, SGD direction, all-history aggregation, and startup 0 are selected, not unresolved alternatives.
Persist analytic/finite-difference gradient checks, update direction, baseline independence, stable-softmax/finite-value checks,
and runtime validation for the selected no-clipping profile. The numeric selection establishes no performance claim.

## R1.7 — Five independent seeded artifacts

**Concept.** Independent training seeds produce separately auditable runs and artifacts.
Training randomness and fixed gate randomness serve different roles and must not share accidental state.

**User choice.** Select exactly **five training master seeds: 101, 102, 103, 104, 105**.
Produce **five independent artifacts**; do not automatically average their weights.
Start at **H=1**; **H≤3** remains later work, without changing gate seeds.
Follow-up G **prospectively preselects the final VALID artifact from master 101 as primary before seed comparisons**.
Retain the other four independent artifacts for variability, not averaging or best-gate cherry-picking.
If 101 fails, neither another seed nor a diagnostic checkpoint becomes a fallback primary.
Do not choose or tune an artifact opportunistically from gate results.

**Reason and boundary.** Expose variability rather than concealing it in an unapproved averaged model.
Derive separate named **selection**, **environment-settlement**, **policy-sampling**, and **opponent** streams
from each training master. Follow-up E selects **SHA-256 hash derivation plus existing `mulberry32`**;
the exact derivation encoding/mapping/lifecycle remains **TBD**.
Specify the generator stream as **unused** for the selected deterministic generator; never leave its status implicit.
Keep fixed gate pins: **corpus arena seed 0**, **inference seed 0 reset per match**,
and **live arena seeds 0..17 with both candidate seats** (36 live cases).
No new seed schedule or held-out claim is introduced for the pinned 18-case corpus.
Hash IDs and gate-selection metadata never become policy features.

**Readings.** [Weights §7: training versus inference](ml-adjutant-weights.md#7-proposed-outcome-driven-phase-3-learning--not-implemented),
[§8: provenance and freeze](ml-adjutant-weights.md#8-planned-artifact-and-inference-contract),
[roadmap invariants](PLAN-ml-adjutant.md#invariants-non-negotiable), and
[Henderson et al., Deep Reinforcement Learning that Matters (v3)](https://arxiv.org/abs/1709.06560v3).

**Remaining freeze items.** Define versioned master+stream-label encoding, endianness/byte-to-seed mapping,
domain separation, collision scope/rejection policy, stream lifecycle/reset semantics, and reproducibility checks.
Record actual derived seeds only after those fields freeze; reject collisions under the frozen policy.
Freeze derivation version metadata and final-artifact validity/selection types without reopening the selected primary rule.

## R1.8 — Per-artifact episode ceiling and frozen gate

**Concept.** A finite episode ceiling bounds initial training work; it neither guarantees a useful model nor authorizes a run.
The training stopping rule, checkpoint save boundaries, and final-artifact validity require exact semantics.

**User choice.** Select an initial maximum of **1000 episodes PER artifact**.
With five independent artifacts, the total ceiling is **5000 episodes**.
This is **not 1000 total** and **not 3000 total**.
Follow-up F clarifies cap accounting: **all started attempts count**, including aborted/incomplete attempts; the cap is not 1000 successful completions.
Follow-up G selects diagnostic checkpoint cadence **every 100 STARTED ATTEMPTS**.
Save complete verified training state at an eligible boundary, never a mid-episode partial-reward state.

Q7 asked which **model-selection contract** to use; its main question proposed alternating corpus/live slots and live candidate seats without separately asking for a curriculum choice.
Curriculum mixture/order remains **a proposal, NOT separately selected/approved or frozen**, awaiting an explicit R1 decision.
**Only if that alternating proposal is later chosen** and reaches the full **1000 attempts**, the illustrative allocation is **500 corpus + 500 live**, with **250 live attempts per candidate seat**; this is not a selected schedule.
Case order/shuffle, opponent selection/initialization, counter boundaries, and exact stopping semantics remain TBD.
The user selected no new development suite, model average, or all-five-artifact gate.

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

**Remaining freeze items.** Define exact started-attempt/completion/cap counters and epoch identifiers from initialization at 0 through at most 1000 attempts,
stopping criteria, checkpoint phase/counters/failure handling and eligible save boundaries,
curriculum mixture/order decision, case order/shuffle/opponent selection/initialization and slot/seat counter boundaries,
artifact validity/selection types, schema/version metadata, and candidate/pruning counters.
Any future continuation needs a new decision and remaining-budget preservation; no automatic retry/resume policy is selected.
Follow-up I selects **small-to-large validation**: gradient/finite difference → numeric extremes → exhaustive small-domain fixtures
→ capped worst-case runtime → artifact reload/provenance.
Require all specialist privacy/noninterference, ledger/conservation, phase, and Phase 1 host-resource checks regardless of diagnostic order.
Freeze exact tolerances, fixture manifest, runtime hardware/deadlines, and test acceptance criteria; no new numeric limits or runs are approved.
Persist all validation before approving R6.
R1 selections are recorded; exact contracts, validation, R0 closure, and R2–R5 implementation/readiness remain incomplete.
