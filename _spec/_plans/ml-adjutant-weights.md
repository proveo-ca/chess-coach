# ML Adjutant — weights, combination coverage, and planning horizons

Status: **Prior future R1 learning design FROZEN; new economic amendment PENDING. NOT implemented or validated. Historical Phase 2 hermetic verification PASSED; not a learned PASS.**
R0 full implementation post-image adversarial review is **REVIEWED / READY TO MERGE: no**;
the [R0 ledger](PLAN-ml-adjutant.md#r0-findings-ledger--full-implementation-post-image-review) holds **15 pending findings: 7 HIGH + 8 MEDIUM**.
Full implementation security rereview is **UNRECORDED**. [R1 selections](ml-adjutant-r1-recipe.md) and [exact contracts](ml-adjutant-r1-contracts.md) are **FROZEN as future design**, not implementation/readiness approval.
No approved run or training authorization exists; R2–R8 remain pending and unimplemented; weights **NONE**.
Executor selected **Broader first trained ranker**. The FIRST Phase 3 training run requires
a separately versioned combination generator and authorized economic/positional interactions,
including an own-loss lineage ledger and confirmed opponent-loss knowledge with explicit fog uncertainty.
Start at **horizon 1**. Planning across **three simultaneous planning windows** is a separate future milestone.
Current `challenge-features-v1` is an inspectable Phase 2 contract, **not sufficient for this first trained ranker**.
**New economic extension: SELECTED DIRECTION, NOT implemented or design-complete.** Executor selected a calibrated belief model for surviving enemy deployed material; [§5.1](#51-selected-economic-extension--calibrated-surviving-material-belief) adds a pre-training amendment/readiness gate beyond the prior frozen 370-field contract.

Owners: [roadmap](PLAN-ml-adjutant.md), [R1 recipe decisions](ml-adjutant-r1-recipe.md), [strict challenge](ml-adjutant-challenge.md),
[Policy-contract boundary](../packages/starchess-arena/ml-adjutant-policy-contracts.puml).
This document authorizes no training code, model/artifact publication, registry activation, or browser rollout.
The approved training owner remains `packages/starchess-training`, private `@chess-coach/starchess-training` version `0.0.1`, with StarChess-only scope and no inferred “starchess-coach” rename.
API A freezes future arena `@chess-coach/starchess-arena/observations` and `/events`; training `@chess-coach/starchess-training/candidates`, `/features`, `/artifacts`.
Contracts §§3–4 define exact signatures/closure; this approval creates no package or exports and does not assign artifact logic to arena.
Select `training → arena authorized public contracts → pure core`, with no core/browser ML dependencies.
Current arena root exports expose unrestricted `SideContext` and no challenge contracts; design a dedicated observation-only public API.
Keep trusted host/opponent context separate. Deliberately extend future dependency closure, export resolution,
source-inventory partitions/entrypoints, hermetic capture/installed-store context, and CI; no config/export changes occur here.
Future public exports/inventory/layer policies and hermetic package-context capture must refresh for the selected training/v2 closure.
Do not blindly relax the unused baseline's execution→contracts restriction or publish unrestricted `SideContext` as a model interface.

**Decision/freeze boundary:** the [recipe](ml-adjutant-r1-recipe.md) preserves the original choices and follow-ups; the [exact R1 contracts](ml-adjutant-r1-contracts.md) own the approved future schemas/calculus and retained rejected alternatives.
Source inventory and source facts here remain frozen historical evidence; no source refresh or new identity is claimed.

| Slot | Selected | Exact approved contract |
|---|---|---|
| `PROFILECHOICE_API` | A | Split by owner, StarChess only: arena `/observations` and `/events`; training `/candidates`, `/features` and `/artifacts`. |
| `PROFILECHOICE_QUOTA` | B | First action's kind owns a nonempty queue; inactive family capacity goes to active families in canonical round-robin; shared capacity stays 175. |
| `PROFILECHOICE_PROVENANCE` | A | Private generic native companion hooks; unchanged normal native result, with private causal frames and visibility checkpoints. |
| `PROFILECHOICE_CURRICULUM` | A | Even STARTED slot corpus, odd slot live; live seats alternate White/Black: 500 corpus + 250 live White + 250 live Black at 1000. |
| `PROFILECHOICE_VALIDATION` | A | Central differences: `eps=1e-6`, `atol=1e-8`, `rtol=1e-5`, using contracts §16's coordinate-wise pass rule. |
| `PROFILECHOICE_COMMON` | A | Full approval of contracts §§3–17 and C01–C17, including exact schemas, 370 features, RNG, eligibility, five-run completion and checkpoint rules. |

Only `{api:'A',provenance:'A',quota:'B',curriculum:'A',validation:'A'}` is approved runtime metadata for this recipe; alternatives are rejected reference, never switches/fallback.
COMMON A includes the 370-feature registry; paid surviving/destroyed/wasted; transient authorized vision and causal loss witnesses; parent ACK/fixed deadlines; exact Float64 binary64 hex; SHA-256 UTF-8 JSON-array/UInt32BE; mine lifetime and 2048-event batch cap; closed nested metadata; zero-sample PG/L2/baseline exclusion; durable checkpoints; and all-five valid completion before formal final-valid-101 primary.
Lead reported document-only adversarial `ses_f061f5cf2ffe4PAinuWeFgHP8f` **READY freeze-candidate: yes** and security `ses_f061f5c50fferpU272G6KbdWLw` **docs freeze candidate READY** before Executor approved the design.
Those prior corrected-draft verdicts do not close R0 or replace full implementation rereview. Lead arranges synchronized-document rereview; this pass claims no new verdict.
No implementation, run, validation result or training permission follows from design freeze.

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
Contracts §8 freezes quota **B**: first action's kind owns each nonempty queue; inactive 48s redistribute to active families in canonical round-robin; shared remains 175.
The same section defines available families, canonical FIFO/depth-cursor traversal, prefix-native timing/actors, pass, authorized pruning priority, exact counters and hash plus raw-byte dedup.
First-nonclassical/minimum-canonical ownership remain rejected reference. One retained queue uses one funding pool; counting it in two pools cannot create two unique candidates.

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
Record separately any newly paid debit, surviving/destroyed/wasted investment, destroyed replacement value and own CC/HP damage.
Contracts §§5–7 freeze actual receipt dispositions and `ownPaidDebits=ownPaidSurviving+ownPaidDestroyed+ownPaidWasted`; an unmaterialized paid deployment is waste, not a fabricated birth/death.
Reconcile ledger totals against host-confirmed own bank debits after settlement and chips.
Gas usage is a separate rule resource, not mineral investment.
The ledger requires a versioned authorized event/identity contract and tests; current square sightings cannot provide it.
R1 selects **combined authorized events→ledger plus normalized side-authorized snapshots with consistency checks**.
Follow-up D selects **boundary batches**: authorized ordered events plus normalized snapshots at relevant chip/settlement boundaries,
reconciled before consumption. The host owns actual debits and issues own lineage IDs.
Use side-local authorized event sequences; ID/sequence counts or gaps must not leak hidden events.
Contracts §§5–7 freeze private native companion **A**, causal frames/visibility checkpoints, exact payloads/IDs/order/dedup, mine lifetime, scheduled initial/turn-open/settled batches and transactional reconciliation/mismatch semantics.
Authorized transient vision survives in memory/everLit even when final cells become unknown; piece-only reveals do not add everLit.
Zero opening/free-promotion paid basis and separate paid/replacement fields are frozen design, not implemented ledger evidence.
Raw full-resolve events remain host-private.
Private KVS, queues, and full snapshots never become model channels.

Opponent losses are **confirmed-loss lower bounds**, with separate uncertainty state.
Count only side-authorized destruction witnesses; deduplicate confirmed identities/events across repeated sightings.
Visible nominal replacement value does not reveal actual opponent investment.
The approved rule requires actual native destruction plus visibility of the live victim in its causal pre-destruction image; no visibility proof means no witness.
Enemy paid lower bound is exactly **0**, replacement lower bound is known spawn cost, and upper remains unknown; no alternate paid-deploy witness rule is selected.
Do not reconstruct an exact enemy bank or investment ledger from privileged KVS.
Fog disappearance, absent stale sightings, or a speculative ray hit is not confirmed destruction.

First-training v2 features must express candidate-dependent economics: requested spend × own liquidity,
resource margin × deployment purpose, own exposure × paid investment/replacement value,
confirmed enemy-loss lower bound × candidate trade opportunity, and categorical uncertainty × tactical risk.
Use authorized projected effects or explicit hypotheses, not undisclosed actual future effects.
Expose lost investment and replacement value separately so a free promoted unit does not masquerade as paid capital.

### 5.1 Selected economic extension — calibrated surviving-material belief

**SELECTED DIRECTION — NOT implemented; exact amendment pending.** Executor chose **Calibrated belief model** over visible-lower-bound and memory-heuristic alternatives.
SGD learns coefficients for supplied features; it does not create a missing material comparison or establish belief calibration.
The frozen 370-field v2 manifest covers own costs/investment/exposure and witnessed enemy **loss** lower bounds, not a comparison of current surviving deployed material.

Required extension: derive a calibrated distribution/interval, or a calibrated expected value with explicit uncertainty, for enemy **surviving deployed replacement material** from authorized history only.
Own surviving deployed combat replacement material is known from current own non-CC units under the same replacement valuation; keep CC HP separate.
Compare like valuation with like valuation; never compare exact own historical payments against estimated enemy replacement value.
Enemy actual historical payment remains unknown.
Keep own paid debits and surviving/destroyed/wasted investment separate from this material balance and from witnessed enemy-loss bounds.
Hidden actual state, enemy bank, current enemy queue, and future traces never become policy inputs.

**Selected turn-aware opening constraint — NOT implemented.** At the standard public opening, turn 0: enemy combat replacement `4` (four Marines, `p=1` each) + available minerals `3` = economic potential `7`.
This public default prior excludes CC, uses no hidden oracle or corpus IDs, and is not a reset target for later turns or sightings.
Opening Marines are endowed with actual paid basis `0`; replacement `4` is not a debit.
Keep surviving deployed material and available bank as separate components; infer their joint estimate and uncertainty from authorized history rather than replacing both with the total `7`.
`UNIT_COST.k=1` and `deployedMaterialFromPlacement` includes CC; do not reuse that helper blindly for this combat-only scope or change engine valuation.
Use native `incomeForTurn(t)`: `t<=10 → +1`, `t<=20 → +2`, otherwise `+3`; apply `applyStoredIncome`'s bank cap `12` only at actual income-grant boundaries.
A nonterminal turn-open chip grants no extra income; a terminal chip can advance the turn without granting income.
Do not accrue income by planning ordinal, observation count, frame count, or every turn-number change; use native turn and grant-boundary semantics.
Infer latent enemy bank/spend, destruction, waste, and promotion from authorized history; never substitute actual hidden enemy accounting.
Carry belief memory forward; do not count movement or repeated sightings as new deployments.

Supply **candidate × material-balance/uncertainty interactions** for spend, deployment, trade, and protection; a raw context-only balance term cancels in linear ranking and softmax.
This belief requirement keeps **H=1** and does not select three-window search.
Exact probabilistic architecture, feature dictionary/versions, calibration bins/data/objective, and acceptance thresholds remain **NOT CHOSEN**.
R1 must approve a new versioned amendment without silently changing the frozen 370-field names/count/meaning; R4 implements its belief/features and R5 persists calibration, valuation, interaction, and noninterference checks before R6.
R5 must also verify the public opening split, CC exclusion/zero paid basis, turn tiers/cap/grant boundaries, and memory without resets or double-counted sightings.
The [contracts extension](ml-adjutant-r1-contracts.md#21-selected-economic-extension--amendment-pending), [choice record](ml-adjutant-r1-recipe.md#selected-economic-extension--calibrated-belief-model), and [roadmap gate](PLAN-ml-adjutant.md#selected-economic-extension--pre-training-gate) record the same pending boundary.

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

<a id="7-proposed-outcome-driven-phase-3-learning--not-implemented"></a>

## 7. Frozen future outcome-driven Phase 3 learning — not implemented

**Prerequisite:** implement and validate the frozen broader generator, own-loss/opponent-knowledge contracts and `φ_v2` names, dimensions, scales, interactions and collision limitations.
The frozen future dimension is **370**, `34+4×84`, with every name/index/formula defined in contracts §§9–10,15. No 158-value v1 trained artifact satisfies this recipe.
That prior freeze does not satisfy [§5.1's newly selected economic extension](#51-selected-economic-extension--calibrated-surviving-material-belief); its versioned amendment and R4/R5 readiness gate must also close before FIRST training.
R1 selects **typed feature blocks plus a fixed flat ordered manifest**.
Follow-up C selects **action-position blocks** holding candidate-context at four rules-derived positions with order preservation
and distinct unknown-versus-absent masks. Four derives from gas 3 plus one classical, not an additional numeric approval.
Retain queue-level combo/timing synergy and candidate×economic/vision/tactics/exploration interactions;
linear position-only coefficients do not create nonlinear interactions automatically.
Contracts §§4,9–10,15 freeze version strings, typed Queue34/Position84 blocks, names/order/scales/masks, interactions/calculus and exact artifact schema; validation remains future.

Selected first direction: **SGD + REINFORCE**, with linear logits and stable softmax over generated candidates.
Follow-up H selects **summed episode gradients**, **L2 once per episode update**, and a **per-seed all-history mean**
of past eligible completed returns with **startup 0**. The objective is not a per-length mean; recent-100 and EMA were not selected.
Contracts §§12–13 freeze the exact eligibility and atomic data/update ordering for this selected loss/SGD direction:

```text
m_t = max_{c∈G_v(h_t)} s_w(h_t,c)
π_w(c|h_t) = exp((s_w(h_t,c)-m_t)/τ)
             / Σ_{k∈G_v(h_t)} exp((s_w(h_t,k)-m_t)/τ)
R = +1 actual candidate win; 0 actual draw; -1 actual candidate loss
R = -1 proved eligible native/challenge failure on verified accepted choices; not software/contract failure
b = mean(past eligible completed returns for this seed), or 0 if history is empty
A = stopGradient(R-b)
L = -A Σ_t log π_w(c_t|h_t) + λ||w||²/2
∇_w L = -(A/τ) Σ_t [φ(h_t,c_t)-Σ_c π_w(c|h_t)φ(h_t,c)] + λw
w' = w - η∇_w L
```

Fix `b` before sampling the current episode; update baseline history only after eligible completion.
Atomically commit verified weights, counters, ACKed stream/journal/control state and current-return baseline insertion once after proposal verification; never mix seeds or use the current return in its own baseline.
It is action-independent and cannot incorporate the current candidate choice or reward before that choice.
Use candidate-side rewards from **newly executed games**, never historical White winner labels.
Store the ACKed verified selected member as a decision for proved native admission/resource rejection; malformed output, nonmember choice, exception/script-contract or unverified stop instead aborts ALL.
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
follow-up E selects **SHA-256 plus existing `mulberry32`**. Contracts §11 freezes UTF-8 `JSON.stringify(['starchess-training-rng-v1',masterInteger,label])`, SHA-256 first four bytes unsigned big-endian uint32, domain separation and lifecycle.
Future tooling must measure/persist all 20 roots and reject any cross-roster collision with no salt/rederivation; no actual derived seeds are pinned here.
Selection/policy/opponent persist; environment-settlement is derived but unused; deterministic generator has no derived root and stays unused.
Keep gate pins unchanged: corpus arena 0, inference 0 reset per match, live arena 0..17 in both seats; H=1 first, H≤3 later.
Do not reuse gate-selection metadata or hash IDs as input features.
Follow-up G **prospectively names the final VALID artifact from master 101 primary before seed comparisons**.
Keep the other four independent artifacts for variability; do not average, choose a best gate result, or substitute another seed/diagnostic checkpoint if 101 fails.
Diagnostic checkpoints occur **every 100 STARTED ATTEMPTS**, saving complete verified training state at eligible boundaries,
not mid-episode partial rewards. Contracts §15 freezes save phases/counters/durability: delayed bucket100 may save eligible101; zero-choice1000 cannot launch1001; publication failure aborts ALL.
Explicit approval now selects curriculum **A**, superseding Q7's earlier unselected illustration: even STARTED slot corpus, odd live, live White/Black alternating.
At 1000 STARTED slots: **500 corpus + 250 live White + 250 live Black** per master; early abort does not imply full allocation.
Contracts §14 freezes ascending serial masters, manifest-order Fisher–Yates epochs, fresh episode history/strategic memory, persistent streams and cursor consumption on STARTED.
This selects no new development suite, model average, all-five-artifact evaluation gate or held-out claim for the training-used 18; all-five VALID completion is a protocol requirement.

Contracts §§12–15 freeze proof-based eligibility, exact counters, stopping, checkpoint/final validity and versions/metadata.
Verified completion with ≥1 parent-ACKed verified sampled decision is eligible; zero-sample terminal/challenge failure is diagnostic-only with **no SGD, no L2, no baseline insertion**.
Parent permits and ACKs verify compact decision/prefix journals under fixed before-write 10s deadlines; no status renewal, unACKed draw/update, parent env.step or next-candidate rescue is allowed.
All gate failures stay counted. Persist gradient, numerical, coverage, runtime and reload/provenance validation before an approved run.
The [R1 recipe](ml-adjutant-r1-recipe.md) owns concept readings; [exact contracts](ml-adjutant-r1-contracts.md) own the **FROZEN future design**, not implementation/readiness.

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
Persist measured SHA-256/`mulberry32` roots only after implementing the frozen derivation/collision/lifecycle rules; approval supplies no numeric roots.
Contracts §15 uses exact finite binary64 big-endian Float64Hex for all persisted float fields, preserving signed zero; schemas close 26 Configuration keys and 21 Versions keys.
Final VALID requires started=verifiedCompleted=1000, no abort, ≥1 nonzero outcome-driven PG update, finite aligned coefficients and bit-exact verified reload.
All five valid serial runs must finish before the COMPLETE experiment envelope/formal final-valid-101 primary; a later-master abort forbids fallback to finished101.
This prerequisite is not five evaluation gates; only the formal primary runs the unchanged strict 18+36 gate and reruns.
Product fallback remains separate future work. The strict denominator remains 18 corpus + 36 live matches.

<a id="9-future-persistent-acceptance--proposed-not-done"></a>

## 9. Frozen future persistent acceptance — not performed

Follow-up I selects **small-to-large diagnostic order**: gradient/finite difference → numeric extremes → exhaustive small-domain fixtures
→ capped worst-case runtime → artifact reload/provenance.
Every specialist privacy/noninterference, ledger/conservation, phase, and Phase 1 host-resource check remains mandatory regardless of ordering.
Arithmetic-first diagnostics do not waive noninterference. Validation **A** freezes central differences `eps=1e-6`, `atol=1e-8`, `rtol=1e-5` with `|gAnalytic-gFD|≤atol+rtol*max(|gAnalytic|,|gFD|)` on every declared coordinate/fixture.
Contracts §§16–17 define fixed basis/multi-decision fixtures and acceptance requirements, including the inherited 10s deadline and Docker resources.
Actual hardware/provider identity, performance measurements and passing numerical results remain future evidence; no executed validation is recorded.

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
