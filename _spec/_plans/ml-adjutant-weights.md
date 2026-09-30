# ML Adjutant — weights, combination coverage, and planning horizons

Status: **PLANNED learning contract; Phase 2 implementation ACTIVE, verification and reviews PENDING.**
Executor selected **Broader first trained ranker**. The FIRST Phase 3 training run requires
a separately versioned combination generator and authorized economic/positional interactions,
including an own-loss lineage ledger and confirmed opponent-loss knowledge with explicit fog uncertainty.
Start at **horizon 1**. Planning across **three simultaneous planning windows** is a separate future milestone.
Current `challenge-features-v1` is an inspectable Phase 2 contract, **not sufficient for this first trained ranker**.

Owners: [roadmap](PLAN-ml-adjutant.md), [strict challenge](ml-adjutant-challenge.md),
[Phase 2 boundary](../packages/starchess-arena/ml-adjutant-phase2.puml).
This document authorizes no training code, model/artifact publication, registry activation, or browser rollout.

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

**Lead-reported preliminary host coverage, not final hermetic evidence:**
18/282 exact recorded queues; 204/576 singleton intents; 282/282 reference queues structurally encode;
282/282 reference feature encodings; maximum 48 baseline proposals.
The population is recorded White authorized historical observations, not live counterplay or legal/winning completeness.
The fourteen both-seat/seven-kind fixtures exercise structural encoding, not legal or tactical coverage.
Do not promote these counts to verified Phase 2 acceptance until final source-image checks persist them.

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
Freeze numeric proposal/expansion/queue-length budgets before training; they remain unsettled here.

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

Proposed first recipe: linear logits with a numerically stable softmax over the generated candidates:

```text
m_t = max_{c∈G_v(h_t)} s_w(h_t,c)
π_w(c|h_t) = exp((s_w(h_t,c)-m_t)/τ)
             / Σ_{k∈G_v(h_t)} exp((s_w(h_t,k)-m_t)/τ)
R = +1 actual candidate win; 0 actual draw; -1 actual candidate loss
R = -1 selected-queue admission/resource failure or policy-contract failure
b = previous completed-valid-episode reward mean (empty history: 0)
A = stopGradient(R-b)
L = -A Σ_t log π_w(c_t|h_t) + λ||w||²/2
∇_w L = -(A/τ) Σ_t [φ(h_t,c_t)-Σ_c π_w(c|h_t)φ(h_t,c)] + λw
```

Fix `b` before sampling the current episode/batch; update its historical mean only afterward.
It is action-independent and cannot incorporate the current candidate choice or reward before that choice.
Use candidate-side rewards from **newly executed games**, never historical White winner labels.
Store the sampled failed selection as a decision when assigning queue-failure reward.
Classify infrastructure/provenance failures separately and abort the training batch; do not turn them into wins or fabricate outcomes.
Every such failure still fails the strict gate. Initial training uses terminal returns, not unapproved dense shaping.
Softmax sampling belongs to training; frozen evaluation uses score argmax with the pinned comparator and inference seed 0.

Proposed defaults, all **PLANNED** until packaging and run configuration freeze:
zero-initialize all `d_v2` coefficients; float64 CPU arithmetic; `τ=1`; Adam with
`η=0.001`, `β₁=0.9`, `β₂=0.999`, `ε=1e-8`; loss regularization `λ=0.0001`.
Freeze update count, episode cap, batches, clipping policy, and numeric generation budgets before the first run.
Derive named training-selection, policy-sampling, opponent, and simulation streams from a pinned master seed;
persist the derivation algorithm and actual seeds. Do not reuse gate-selection metadata as an input feature.
Optional teacher warm-start requires a separate authorized-label audit and explicit objective; it is not today's baseline score.

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
Product fallback remains separate future work. The strict denominator remains 18 corpus + 36 live matches.

## 9. Future persistent acceptance — proposed, not done

| Proposed check | Required evidence |
|---|---|
| Broader generator | Seven-kind/timing/unit/promotion coverage; ordered compositions; finite budgets; exact small-domain references; omissions disclosed; hidden-state invariant pruning and ordering. |
| v2 interactions | Resource/vision/threat context changes candidate preferences via interactions; observation-only terms cancel; names/order/scales finite and frozen. |
| Own economic ledger | Paid deploy, rollback/no debit on rejection, endowed opening units, free promotion, lineage preservation, one-time loss retirement, chip updates, debit conservation. |
| Opponent knowledge | Confirmed destruction only; stale/fog disappearance remains uncertain; identity/event deduplication; lower bounds never exact enemy bank/investment. |
| Rays and exploration | Unknown blockers cannot become clear; reveal versus visibility distinction; dated memory; categorical confidence; novelty is not entropy. |
| Persistent learning | Analytic/finite-difference gradient direction, stable softmax, previous-mean baseline independence, reproducible nonzero updates from outcome rewards, serialization/reload and artifact hash alignment. |
| Frozen inference | Finite/version/name/length rejection; argmax ties; one private admission; no rescue/fallback/online update; invariant selection for identical authorized history. |
| Future H≤3 search | Conditional future observation branches, simultaneous opponent hypotheses, chips without ordinals, bounded deterministic beam, invariance to actual hidden state/queue/future trace. |
| Challenge | All 54 cases retained, integrity and semantic reruns, actual terminal truth, strict failures; no held-out claim for the training-used corpus. |

These tests are acceptance requirements, not existing passing test results.
Phase 2 final hermetic execution, static checks, PlantUML rendering, adversarial review, and security review remain PENDING.
