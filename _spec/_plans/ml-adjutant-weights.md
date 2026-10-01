# ML Adjutant — weights, combination coverage, and planning horizons

Status: **PLANNED learning contract. Historical Phase 2 hermetic verification PASSED; not a learned PASS.**
R0 full implementation post-image adversarial review is **REVIEWED / READY TO MERGE: no**;
the [R0 ledger](PLAN-ml-adjutant.md#r0-findings-ledger--full-implementation-post-image-review) holds **15 pending findings: 7 HIGH + 8 MEDIUM**.
Security rereview is **UNRECORDED**. [R1.1–R1.8 selections and nine follow-up directions](ml-adjutant-r1-recipe.md) are **RECORDED**, but contract freeze is **INCOMPLETE**.
No approved run or training authorization exists; R2–R8 remain pending and unimplemented; weights **NONE**.
Executor selected **Broader first trained ranker**. The FIRST Phase 3 training run requires
a separately versioned combination generator and authorized economic/positional interactions,
including an own-loss lineage ledger and confirmed opponent-loss knowledge with explicit fog uncertainty.
Start at **horizon 1**. Planning across **three simultaneous planning windows** is a separate future milestone.
Current `challenge-features-v1` is an inspectable Phase 2 contract, **not sufficient for this first trained ranker**.

Owners: [roadmap](PLAN-ml-adjutant.md), [R1 recipe decisions](ml-adjutant-r1-recipe.md), [strict challenge](ml-adjutant-challenge.md),
[Policy-contract boundary](../packages/starchess-arena/ml-adjutant-policy-contracts.puml).
This document authorizes no training code, model/artifact publication, registry activation, or browser rollout.
The selected training owner is `packages/starchess-training`, not yet created; any proposed npm name is not approved.
Follow-up A selects purpose-based authorized `/observations`, `/candidates`, `/features`, and `/artifacts` interface suffixes.
Npm ID, exact package assignment/full export paths, and signatures remain TBD; this does not assign all artifact logic to arena.
Select `training → arena authorized public contracts → pure core`, with no core/browser ML dependencies.
Current arena root exports expose unrestricted `SideContext` and no challenge contracts; design a dedicated observation-only public API.
Keep trusted host/opponent context separate. Deliberately extend future dependency closure, export resolution,
source-inventory partitions/entrypoints, hermetic capture/installed-store context, and CI; no config/export changes occur here.
Future public exports/inventory/layer policies and hermetic package-context capture must refresh for the selected training/v2 closure.
Do not blindly relax the unused baseline's execution→contracts restriction or publish unrestricted `SideContext` as a model interface.

**Decision/freeze boundary:** the [front nine-detail table and glossary/readings](ml-adjutant-r1-recipe.md#nine-detail-decision-record--accepted-directions-not-a-completed-freeze)
records A–I; this document carries the corresponding technical contract below.
Architecture task `ses_f06d4c62cffe4MgE59PmzWw1rO` retains **R1 contract freeze INCOMPLETE** until the remaining exact fields freeze.
No implementation, run, validation result, or new permission follows from those selections.

## 1. What a weight means

Let `h` be the side's authorized observation history, including its permitted current observation.
Let `c` be one proposed ordered action queue, not an isolated destination square.
For a frozen feature version `v` with ordered names `N_v = (n_1, …, n_d)`:

```text
φ_v(h,c) ∈ ℝ^d
w_v     ∈ ℝ^d
s_w(h,c) = w_vᵀ φ_v(h,c) = Σ_i w_v[i] φ_v(h,c)[i]
selected = argmax_c s_w(h,c)       # canonical queue key breaks exact ties
```

Each coefficient belongs to a **named feature** and applies to every candidate carrying that feature.
There is no independent learned entry for every move, every combination, or every node of a planning tree.
Changing feature names, order, meaning, normalization, or interactions requires a new version and aligned weights.
Different queues may share summaries; equal vectors necessarily receive equal linear scores.

`baselineScore` is the separately exposed handcrafted baseline ranking value.
It is **not learned**, is **not a feature**, and must not be silently added to learned logits or used as a rescue policy.
Core gas costs, mineral costs, scheduling constraints, and `addScAction` legality remain rules, never parameters to learn.

For any candidate-independent term `a(h)`:

```text
[a(h) + wᵀφ(h,c₁)] - [a(h) + wᵀφ(h,c₂)]
  = wᵀ[φ(h,c₁) - φ(h,c₂)]
```

Observation-only linear terms and a shared bias cancel in both argmax comparisons and softmax probabilities.
For example, simply adding current mineral bank or unknown-square count cannot make a linear ranker
choose different actions under different resources or fog. A bank margin also contributes only its
candidate-dependent spend component when the bank is identical across candidates.
The broader first ranker therefore needs **candidate × context interactions in v2**, not merely more global scalars.

## 2. Current inspected Phase 2 contract — no weights

| Surface | Current source contract | Limit |
|---|---|---|
| Observation | `challenge-observation-v1`, codec `challenge-observation-codec-v1` | Own resources/units/modes/mines, 64 authorized cells, square sightings; not a complete enemy board or valid fog-filtered SCFEN. |
| Candidate | `challenge-candidate-codec-v1` | Ordered intents, canonical key, recomputed requested own minerals/gas; structural encoding is not admission. |
| Kind vocabulary | `classical`, `deploy`, `stimStep`, `spiderMine`, `charonMissiles`, `siegeMode`, `tacticalJump` | All seven encode; this does not mean the generator proposes all seven. |
| Timing | Classical `C`; specials `B` or `F` | Array order remains significant inside simultaneous B/C/F settlement. |
| Queue encoding bound | `MAX_QUEUE_ACTIONS = 65` | A serialization bound, not 65 legal actions per window and not an exhaustive-search guarantee. |
| Current generator | `baseline-v1` | Classical singleton, Marine (`p`) deployment singleton at B, and pass only; no general combination generation. |
| Comparator | `score-desc-key-asc-v1` | Finite score descending, canonical key ascending. |
| Features | `challenge-features-v1` | Named arrays: observation **1623**, action row **64**, ranker **158**; weights **NONE**. |
| Ranker aggregation | Globals + sums + `(index+1)` position-weighted action sums | Ordered action rows retain more information than the lossy fixed-width ranker summaries. |

Sources: `packages/starchess-arena/src/challengeContract/{validation,observationCodec,candidateCodec,features,coverage}.ts`.
Feature arrays and normalization scales live in `FEATURE_SCHEMA`; this plan does not duplicate a numeric weight artifact.
Current memory records sightings by square, not unique enemy identities, paid investments, or confirmed destruction.
The own-loss lineage ledger and opponent confirmed-loss schema remain **pending**.

**Persisted in-image coverage, not winning coverage:**
18/282 exact recorded queues; 204/576 singleton intents; 282/282 reference queues structurally encode;
282/282 reference feature encodings; maximum 48 baseline proposals.
The population is recorded White authorized historical observations, not live counterplay or legal/winning completeness.
The fourteen both-seat/seven-kind fixtures exercise structural encoding, not legal or tactical coverage.
These counts are representability. They are persisted in the imported Phase 2 coverage report.
They do not establish a learned PASS or FIRST-training readiness.

## 3. All actions and all combinations: exact domain versus bounded implementation

Define `A_v(h)` as the versioned, finite domain of side-correct action intents expressible from authorized facts.
It covers every supported kind, native timing, actor, destination, deployment unit, and promotion option.
An intent aimed into fog may remain expressible without asserting that the target is clear or the intent admissible.
Do not use hidden host answers to remove, reorder, or score these intents.

Define `Q_v(h)` as the **conceptual domain** of ordered queues over `A_v(h)`, including pass, under
versioned rules-derived bounds and constraints decidable from authorized inputs.
Same actions in different order/timing can be different queues. Do not replace ordered queues with unordered sets.
The exact private admissible domain `Q_rule(S)` belongs to the host's full state `S`;
the policy cannot observe it or ask repeated hidden-legality questions to reconstruct it.

```text
G_v(h; b, seed) ⊆ Q_v(h)                 # implemented proposal set
b = finite, versioned generation budgets
G_v need not equal Q_v or Q_rule(S)
```

The FIRST Phase 3 generator must have its **own version**, distinct from `baseline-v1` and the candidate codec.
It must propose all supported action families and meaningful same-window compositions, including special+classical,
deploy+classical, mine+relocate, timing/order alternatives, and resource-constrained multi-action queues.
Native rules determine possible combinations; this plan does not assert arbitrary cross-products are legal.
Document deterministic deduplication, canonical ordering, pruning, per-family limits, and pass retention.
R1 selects **family-quota composition**, **512 unique candidates including pass**, and
**2048 attempted extensions including duplicates and pruned extensions** per call.
The current rules-derived queue-length ceiling is **4** (gas maximum 3 / minimum special cost 1 + at most one classical),
not an admission guarantee or a change to the codec bound of 65.
Follow-up B selects **composition emphasis** when all seven canonical families are available:
**48 capacity slots each (336 total) + 175 shared composition slots + 1 pass = 512**.
Capacity is neither mandatory emission nor a unique-output guarantee; the 2048-attempt counter always includes duplicates/pruned extensions.
Freeze available-family detection, canonical family order/redistribution when unavailable, shared-pool eligibility/traversal/distribution,
single quota ownership for mixed queues, pass reservation, ordered timing/same-actor compositions, authorized pruning,
canonical content-hash identity/deduplication, and exact counters before training.
First-action-kind/first-special ownership was not selected and remains TBD; counting one queue in two pools does not make two unique candidates.

For tractable fixtures enumerate the full conceptual domain and compare bounded output against that reference.
For larger cases report omitted families, pruning reasons, queue lengths, timings, units, and ordering alternatives.
An encoding success, proposal count, or recorded-membership percentage never proves exhaustive legal coverage.

One policy call produces **one selected proposal**. Only then does the host privately stage the entire queue.
An admission failure fails the match; no hidden probes, next-candidate retries, prefix salvage, or strategic rescue.
The opponent chooses simultaneously from the same turn-open precommit state, not after seeing this selection.

## 4. Horizon 1 first; conditional plans up to 3 windows later

`H` counts simultaneous planning windows, not individual B/C/F actions, classical chess plies, or turn numbers.
Both sides choose queues for one window; the host settles them together through core rules.
Turn-open chips may update observations or terminate a game without consuming a planning ordinal.

At **H=1**, rank current candidate queues using current authorized history and candidate-context features.
This includes same-window combinations but does not claim a resolved future board, opponent response, or lookahead search.
The FIRST trained ranker uses this horizon after the broader generator and v2 schemas freeze.

The separate future **H=1..3 search milestone** defines a conditional policy tree:

```text
Π_H : reachable authorized histories h_t → proposed queues c_t
branch = (authorized future observation, permitted history update)
transition hypothesis = (belief-consistent hidden state, opponent queue hypothesis)
H decreases only after a simultaneous planning window
```

A three-window plan is not a fixed sequence `c₁,c₂,c₃` evaluated on future recorded snapshots.
Its later decisions depend on what the side observes after simultaneous settlement.
Opponent hypotheses and hidden-state beliefs must derive only from authorized history.
Never substitute the actual private opponent queue, strategic KVS, full hidden state, or future corpus trace.
Do not run authoritative full-state admission probes as a policy-side simulator.

Specify the exact conceptual belief/history tree separately from its finite approximation.
A future bounded beam may prune branches and sample hypotheses; it cannot claim exact enumeration of every future.
Freeze horizon, beam width, node/branch limits, hypotheses per node, simulation count, seed streams,
terminal handling, numerical aggregation, and tie-breaking under a search version.
Probabilities require a defined calibrated forecast; otherwise report categorical hypotheses and sensitivity,
not an invented expected value or entropy reduction. Search-invariance tests remain proposed.

## 5. Authorized economics and trade losses required before FIRST training

Keep four quantities distinct:

| Quantity | Definition | Availability |
|---|---|---|
| Requested spend | Sum of rule mineral/gas costs in a proposal | Current candidate encoding; not evidence that a debit occurred. |
| Actual paid investment | Host-confirmed own mineral debit attached to a unit lineage | Required new authorized own ledger; only after successful admission/debit. |
| Paid investment lost | Cumulative paid own investment retired by confirmed destruction | Required new ledger; count each lineage investment once. |
| Replacement value | Present unit type's nominal rule cost | Positional valuation proxy, not historical payment. |

Conceptually, for authorized own lineage `ℓ`:

```text
I_ℓ = Σ confirmed own mineral debits assigned to ℓ
L_own_paid = Σ I_ℓ retired on confirmed own destruction
L_own_replacement = Σ ruleReplacementValue(type_at_loss)
```

Opening-endowed units start with zero actual paid investment.
Free promotion changes replacement value but does not create a mineral payment.
Promotion/transform/movement preserve lineage; transfers do not duplicate accumulated investment.
Record separately any newly paid debit, surviving investment, destroyed replacement value, and own CC/HP damage.
Reconcile ledger totals against host-confirmed own bank debits after settlement and chips.
Gas usage is a separate rule resource, not mineral investment.
The ledger requires a versioned authorized event/identity contract and tests; current square sightings cannot provide it.
R1 selects **combined authorized events→ledger plus normalized side-authorized snapshots with consistency checks**.
Follow-up D selects **boundary batches**: authorized ordered events plus normalized snapshots at relevant chip/settlement boundaries,
reconciled before consumption. The host owns actual debits and issues own lineage IDs.
Use side-local authorized event sequences; ID/sequence counts or gaps must not leak hidden events.
Exact authorized payload/order, ID formula, sequence/deduplication rules, visible-loss confirmation,
same-turn chip/batch ordering, rollback/no-debit behavior, and reconciliation/mismatch semantics remain to freeze.
The zero paid basis of opening units/free promotion and separate investment/replacement quantities are selected; their fields remain TBD.
Raw full-resolve events remain host-private.
Private KVS, queues, and full snapshots never become model channels.

Opponent losses are **confirmed-loss lower bounds**, with separate uncertainty state.
Count only side-authorized destruction witnesses; deduplicate confirmed identities/events across repeated sightings.
Visible nominal replacement value does not reveal actual opponent investment.
A witnessed paid deployment may support a documented lower bound only under a frozen authorization rule.
Unknown cost remains unknown. Do not reconstruct an exact enemy bank or investment ledger from privileged KVS.
Fog disappearance, absent stale sightings, or a speculative ray hit is not confirmed destruction.

First-training v2 features must express candidate-dependent economics: requested spend × own liquidity,
resource margin × deployment purpose, own exposure × paid investment/replacement value,
confirmed enemy-loss lower bound × candidate trade opportunity, and categorical uncertainty × tactical risk.
Use authorized projected effects or explicit hypotheses, not undisclosed actual future effects.
Expose lost investment and replacement value separately so a free promoted unit does not masquerade as paid capital.

## 6. Vision, attack lines, and priority families

First-training v2 needs positional interactions, not merely target type and movement coordinates.
It must encode authorized ray geometry, candidate-induced own exposure, reachable pressure, protection,
known occupancy, unknown blockers, and observation-supported tactical opportunities.
An unknown intermediate square is **not known-clear**; a Battleship reveal does not reveal every intervening blocker.
Separate known-open, known-blocked, and uncertain rays and keep remembered observations dated.
Unknown enemy modes/mines remain unknown. Categorical confidence is the default unless a calibrated forecast is defined.

Exploration features may measure newly lit/visited square proxies, stale-sighting approach, or authorized coverage gain.
Label these **novelty/coverage proxies**, not information-theoretic entropy reduction.
They require candidate-context interactions, since current unknown-square count alone cancels in linear comparisons.

| Strategy label | Shared feature family / candidate-context interaction | Not implied |
|---|---|---|
| Exploration | Novelty proxy × reveal capability, stale sightings × approach, unknown ray × scouting opportunity | Exact enemy localization or entropy minimization. |
| Survival | Own CC/HP vulnerability × exposure/interposition/escape; threatened investment × protection | A learned relaxation of admission rules or a guaranteed safe fog move. |
| Offense | Observed enemy CC/units × pressure/capture geometry; confirmed losses × opportunity | Hidden enemy targets, exact enemy economy, or certain damage. |
| Tactics | Same-window timing/order synergy, promotion opportunity, mine/ray interactions, trade cost/risk | Exhaustive combinations or three-window search. |

Labels group contributions `contribution_f(h,c) = Σ_{i∈family_f} w[i]φ_i(h,c)` for explanation.
They do not create one independent weight per strategy, enforce a fixed lexicographic order, or reproduce strategic posture weights.
Any future exploration/survival/offense presets are separately versioned **configuration**, not trained coefficients.
Pin presets, resource rules, and feature/generator versions separately; changing a preset never changes legality.
Hard survival filtering would alter the proposal contract and needs its own review/version, not an undocumented model override.

## 7. Proposed outcome-driven Phase 3 learning — not implemented

**Prerequisite:** implement and freeze the broader combination generator, own-loss/opponent-knowledge contracts,
and `φ_v2` names, dimensions, scales, interactions, and collision limitations.
The exact v2 names and dimension `d_v2` remain **unsettled**. There is no promise to publish a 158-value trained artifact.
R1 selects **typed feature blocks plus a fixed flat ordered manifest**.
Follow-up C selects **action-position blocks** holding candidate-context at four rules-derived positions with order preservation
and distinct unknown-versus-absent masks. Four derives from gas 3 plus one classical, not an additional numeric approval.
Retain queue-level combo/timing synergy and candidate×economic/vision/tactics/exploration interactions;
linear position-only coefficients do not create nonlinear interactions automatically.
Actual v2 version strings, names/dimension, scales/masks, flattening order, interaction set/calculus,
and public artifact schema remain TBD; the selected structure does not freeze those contracts.

Selected first direction: **SGD + REINFORCE**, with linear logits and stable softmax over generated candidates.
Follow-up H selects **summed episode gradients**, **L2 once per episode update**, and a **per-seed all-history mean**
of past eligible completed returns with **startup 0**. The objective is not a per-length mean; recent-100 and EMA were not selected.
The selected loss/SGD direction below still needs the exact eligibility and data/update ordering contract:

```text
m_t = max_{c∈G_v(h_t)} s_w(h_t,c)
π_w(c|h_t) = exp((s_w(h_t,c)-m_t)/τ)
             / Σ_{k∈G_v(h_t)} exp((s_w(h_t,k)-m_t)/τ)
R = +1 actual candidate win; 0 actual draw; -1 actual candidate loss
R = -1 policy/challenge failure, including selected-queue admission/resource or policy-contract failure
b = mean(past eligible completed returns for this seed), or 0 if history is empty
A = stopGradient(R-b)
L = -A Σ_t log π_w(c_t|h_t) + λ||w||²/2
∇_w L = -(A/τ) Σ_t [φ(h_t,c_t)-Σ_c π_w(c|h_t)φ(h_t,c)] + λw
w' = w - η∇_w L
```

Fix `b` before sampling the current episode; update baseline history only after eligible completion.
Exact baseline-history ordering relative to the SGD update remains TBD; never mix seeds or use the current return in its own baseline.
It is action-independent and cannot incorporate the current candidate choice or reward before that choice.
Use candidate-side rewards from **newly executed games**, never historical White winner labels.
Store the sampled failed selection as a decision when assigning queue-failure reward.
Follow-up F classifies infrastructure/provenance aborts separately and **stops ALL training**, not just a batch or one seed.
Preserve consumed-attempt counters and diagnostics; abort the episode without fabricated reward or partial gradient update.
All started attempts count toward the per-artifact 1000 cap, including incomplete/aborted attempts.
No unlimited infrastructure retry or automatic resume is authorized, even from a verified checkpoint;
any new continuation requires explicit decisions and preservation of the remaining budget.
Every such failure still fails the strict gate. Initial training uses terminal returns, not unapproved dense shaping.
Softmax sampling belongs to training; frozen evaluation uses score argmax with the pinned comparator and inference seed 0.

**Selected experimental profile, not validated or approved for a run:** zero-initialize all `d_v2` coefficients;
float64 CPU; **SGD** with `η=0.001`, `τ=1`, L2 `λ=0.0001`, **one complete episode per update**, **no clipping**.
**Adam and imitation/teacher bootstrap are not selected.** Any later warm-start requires a separate decision and authorized-label audit.
Use **five independent master seeds 101..105** and **five independent artifacts**, with **no automatic weight average**.
Initial maximum: **1000 episodes per artifact**, total ceiling **5000**, not 1000 total or 3000;
follow-up F counts **all started attempts**, not just successful completions, against that ceiling.
Derive separate named selection, environment-settlement, policy-sampling, and opponent streams from each master;
follow-up E selects **SHA-256 plus existing `mulberry32`**. Versioned master+stream-label encoding, endianness/byte-to-seed mapping,
domain separation, collision scope/rejection policy, and lifecycle/reset semantics remain TBD before actual derived seeds can be pinned.
Record derived seeds after freeze and reject collisions under that policy. Specify the deterministic generator's stream as unused.
Keep gate pins unchanged: corpus arena 0, inference 0 reset per match, live arena 0..17 in both seats; H=1 first, H≤3 later.
Do not reuse gate-selection metadata or hash IDs as input features.
Follow-up G **prospectively names the final VALID artifact from master 101 primary before seed comparisons**.
Keep the other four independent artifacts for variability; do not average, choose a best gate result, or substitute another seed/diagnostic checkpoint if 101 fails.
Diagnostic checkpoints occur **every 100 STARTED ATTEMPTS**, saving complete verified training state at eligible boundaries,
not mid-episode partial rewards. Exact phase/counter/failure/save-boundary semantics remain TBD.
Q7 asked for the **model-selection contract**, not a separate curriculum choice; its main question proposed alternating corpus/live slots and live candidate seats.
Curriculum mixture/order remains **a proposal, NOT separately selected/approved or frozen**, awaiting an explicit R1 decision.
**Only if that alternating proposal is later chosen** and reaches the full 1000 attempts, the illustrative allocation is **500 corpus + 500 live**, with **250 live per seat**; this is not a selected schedule.
Case order/shuffle, opponent selection/initialization, slot/seat counter boundaries, and stopping semantics remain TBD.
This selects no new development suite, model average, all-five-artifact gate, or held-out claim for the training-used 18.

Baseline eligibility for policy failures/empty-decision episodes/infrastructure aborts, zero-decision updates,
incomplete-episode handling, exact failure taxonomy, and baseline-history/SGD ordering remain TBD.
Freeze started-attempt/completion/cap counters, epoch 0..1000 identifiers, exact stopping/checkpoint details and the pending curriculum mixture/order decision,
artifact validity/selection types, versions/metadata and candidate/pruning counters. All gate failures stay counted.
Persist gradient, numerical, coverage, runtime, reload/provenance validation plus exact semantic freeze before an approved run.
The [eight-section R1 record with nine follow-up details](ml-adjutant-r1-recipe.md) owns the concept readings and remaining freeze items; R1 is not complete.

## 8. Planned artifact and inference contract

The eventual artifact contains aligned `featureVersion`, ordered `featureNames`, `dimension`, finite `weights`,
generator/observation/candidate/ledger versions, horizon/configuration, and training provenance.
Validate exact names **and order**, vector length, supported versions, and finite coefficients/scores before selection.
Reject mismatches explicitly; never pad, truncate, relabel silently, or fall back to the heuristic inside the learned gate.

Hash the final artifact bytes externally in the evidence envelope/sidecar.
Do not put the artifact's own byte hash inside those same bytes.
Provenance pins optimizer/loss/initialization, training seeds and RNG algorithms, datasets, selection schedule,
core rules, strategic revision, source inventory partitions, runtime/dependency artifacts, candidate budgets,
feature schema and ledger authorization, and training reward/failure handling.
Load one immutable artifact before evaluation; allow no online updates, per-case tuning, hidden rescue, or missing-model fallback.
Use the prospectively selected final valid seed-101 primary; retained variability artifacts and diagnostic checkpoints are not fallback candidates.
Pin the selected SHA-256/`mulberry32` derivation only after exact encoding/mapping/collision/lifecycle fields freeze.
Product fallback remains separate future work. The strict denominator remains 18 corpus + 36 live matches.

## 9. Future persistent acceptance — proposed, not done

Follow-up I selects **small-to-large diagnostic order**: gradient/finite difference → numeric extremes → exhaustive small-domain fixtures
→ capped worst-case runtime → artifact reload/provenance.
Every specialist privacy/noninterference, ledger/conservation, phase, and Phase 1 host-resource check remains mandatory regardless of ordering.
Arithmetic-first diagnostics do not waive noninterference. Exact tolerances, fixture manifest, runtime hardware/deadlines,
and test acceptance criteria remain TBD; no new numeric limits or executed validation are recorded.

| Proposed check | Required evidence |
|---|---|
| Broader generator | Seven-kind/timing/unit/promotion coverage; ordered compositions; finite budgets; exact small-domain references; omissions disclosed; hidden-state invariant pruning and ordering. |
| v2 interactions | Resource/vision/threat context changes candidate preferences via interactions; observation-only terms cancel; names/order/scales finite and frozen. |
| Own economic ledger | Paid deploy, rollback/no debit on rejection, endowed opening units, free promotion, lineage preservation, one-time loss retirement, chip updates, debit conservation. |
| Opponent knowledge | Confirmed destruction only; stale/fog disappearance remains uncertain; identity/event deduplication; lower bounds never exact enemy bank/investment. |
| Rays and exploration | Unknown blockers cannot become clear; reveal versus visibility distinction; dated memory; categorical confidence; novelty is not entropy. |
| Persistent learning | Analytic/finite-difference gradient direction, stable softmax, preceding-episode baseline independence, reproducible nonzero updates from outcome rewards, serialization/reload and artifact hash alignment. |
| Frozen inference | Finite/version/name/length rejection; argmax ties; one private admission; no rescue/fallback/online update; invariant selection for identical authorized history. |
| Future H≤3 search | Conditional future observation branches, simultaneous opponent hypotheses, chips without ordinals, bounded deterministic beam, invariance to actual hidden state/queue/future trace. |
| Challenge | All 54 cases retained, integrity and semantic reruns, actual terminal truth, strict failures; no held-out claim for the training-used corpus. |

These tests are acceptance requirements, not existing passing test results.
Historical Phase 2 hermetic execution passed. Weights remain NONE; R1 selections do not approve a run.
The broader combination generator and authorized economy/position interactions remain a Phase 3 prerequisite, not implemented.
Three-turn planning remains a later milestone.
Both renamed diagrams and the edited spec map passed PlantUML `checkonly`.
Rename-only adversarial review is **READY: yes**.
Full implementation post-image adversarial review is **REVIEWED / READY TO MERGE: no**, with **7 HIGH + 8 MEDIUM pending**.
Post-image security rereview remains **UNRECORDED**. R0 assurance remains blocked; close R0–R5 before training.
