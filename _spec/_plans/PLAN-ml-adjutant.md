# PLAN — ML Adjutant: learn a ranker and prove the strict challenge

Status: **Phases 0–2 implemented; recorded test/hermetic verification PASSED historically. Current R0 assurance BLOCKED.**
**NOT training-ready: weights NONE; no learned model, runtime readiness, or learned acceptance.**
Full implementation post-image adversarial review is **REVIEWED / READY TO MERGE: no**
(task `ses_f07c45365ffew0wJ58yFHXAye5`); security rereview remains **UNRECORDED**.
The [R0 findings ledger](#r0-findings-ledger--full-implementation-post-image-review) records
**15 pending findings: 7 HIGH + 8 MEDIUM**. R1 future **design contract is FROZEN**, not implemented or validated.
R2–R8 remain pending and unimplemented; no implementation review findings/results are claimed for those actions.
The [R1 recipe](ml-adjutant-r1-recipe.md) preserves the original eight choices and nine follow-up directions; [exact contracts](ml-adjutant-r1-contracts.md) record Executor's approved final profiles and common semantics.
Prior corrected-draft document-only rereviews: adversarial `ses_f061f5cf2ffe4PAinuWeFgHP8f` **READY freeze-candidate: yes**; security `ses_f061f5c50fferpU272G6KbdWLw` **docs freeze candidate READY**, as reported by lead.
Those verdicts do not close R0 or substitute for full implementation rereviews. Lead arranges synchronized-document rereview; no new verdict is recorded here.
This update changes no code, build/run permissions, evidence, historical pins, or projected diagram/source entries.
Source inventory and source-reading anchors remain frozen historical evidence, not a fresh inspection.

## Exact approved R1 profile record — future design only

| Slot | Selected | Exact approved contract |
|---|---|---|
| `PROFILECHOICE_API` | A | Split by owner, StarChess only: arena `/observations` and `/events`; training `/candidates`, `/features` and `/artifacts`. |
| `PROFILECHOICE_QUOTA` | B | First action's kind owns a nonempty queue; inactive family capacity goes to active families in canonical round-robin; shared capacity stays 175. |
| `PROFILECHOICE_PROVENANCE` | A | Private generic native companion hooks; unchanged normal native result, with private causal frames and visibility checkpoints. |
| `PROFILECHOICE_CURRICULUM` | A | Even STARTED slot corpus, odd slot live; live seats alternate White/Black: 500 corpus + 250 live White + 250 live Black at 1000. |
| `PROFILECHOICE_VALIDATION` | A | Central differences: `eps=1e-6`, `atol=1e-8`, `rtol=1e-5`, using contracts §16's coordinate-wise pass rule. |
| `PROFILECHOICE_COMMON` | A | Full approval of contracts §§3–17 and C01–C17, including exact schemas, 370 features, RNG, eligibility, five-run completion and checkpoint rules. |

Keep the selected `packages/starchess-training`, private `@chess-coach/starchess-training` version `0.0.1`; StarChess-only / “starchess-coach” scope does not rename that identity.
Only `{api:'A',provenance:'A',quota:'B',curriculum:'A',validation:'A'}` is approved for future runtime metadata; other profiles remain rejected reference in contracts, not selectable switches/fallback.
COMMON A includes 370 features; paid surviving/destroyed/wasted; transient authorized vision/causal loss; parent ACK/fixed deadlines; exact Float64 binary64 hex; SHA-256 UTF-8 JSON-array/UInt32BE; mine lifetime/2048-event batch cap; closed nested metadata; zero-sample PG/L2/baseline exclusion; durable checkpoints; and all-five valid completion before formal final-valid-101 primary, not five evaluation gates.

## Current status ledger

| Area | Completed boundary / remaining boundary |
|---|---|
| Preparatory catalog + Phase 0 | Core owns all five IDs, labels, and guards; only `naive`/`strategic` are ready. App placeholders remain disabled/unavailable. Provenance pins **18** cases; no corpus expansion. The full-app lint baseline exception remains below. |
| Phase 1 | Strict isolated serial harness, whole-queue atomic admission, exact resources, watchdogs, publication, and provenance implemented with historical verification. Historical Phase 1 reviews remain lead-reported **READY: yes** for that non-learned scope. Current R0 findings A08–A10 reopen watchdog/corpus/evidence assurance; they do not rewrite old test results. |
| Phase 2 | All **7** kinds encode; feature v1 dimensions are **1623 observation / 64 action-row / 158 ranker**. Historical partitioned-pin/hermetic verification passed: **434/434 arena**, **426/426 core**, **54 executions + 54 reruns**, all semantic comparisons equal. Current R0 findings A01–A07 and A11–A15 block import/audit/provenance/hermetic/publication assurance. |
| R0 current assurance | Full implementation adversarial review **READY TO MERGE: no**; **7 HIGH + 8 MEDIUM pending**. Security rereview **UNRECORDED**. Source-derived counterexamples are **[Inference], not executed proof**; the reviewer inspected historical results rather than independently rerunning them. |
| Coverage ≠ generation ≠ wins | Codec and feature representability each **282/282**; generated exact full queues **18/282**, singleton intents **204/576**. `baseline-v1` still proposes classical/Marine-deploy singletons and pass. Candidate wins remain **0/18 corpus + 0/36 live**; strict failures stay counted. |
| Documentation completed | [Weights contract](ml-adjutant-weights.md) defines the broader first ranker; the generic study guide is published as **OPEN, unmerged** [Orrery PR #12](https://github.com/proveo-ca/orrery/pull/12). Neither implements learning. |
| R1 design decisions | [Recipe](ml-adjutant-r1-recipe.md) and [exact contracts](ml-adjutant-r1-contracts.md): future design **FROZEN** with API A / quota B / provenance A / curriculum A / validation A / COMMON A. StarChess-only private `@chess-coach/starchess-training` `0.0.1` retains selected path. Exports/hooks/DTOs/validation remain unimplemented; no build/run permission. |
| Phase 3 / learned Phase 4 | Broader generation, authorized loss ledger, candidate-conditioned v2, training, frozen artifact/adapter, and learned eligibility/tests remain **PLANNED and unimplemented**. The existing 54-case scheduling/report machinery is not learned acceptance. |

Current owning diagrams are [`ml-adjutant-challenge-harness.puml`](../packages/starchess-arena/ml-adjutant-challenge-harness.puml)
and [`ml-adjutant-policy-contracts.puml`](../packages/starchess-arena/ml-adjutant-policy-contracts.puml).
Their rename and spec-map `checkonly` passed as reported below.
The current [image assurance](../evidence/ml-adjutant-phase2/image-assurance.json) pins image
`sha256:e7f9ea8ac211c93804bd1125ed28fb7e165a160c4155ca70404c81f9e431710d`;
[verification](../evidence/ml-adjutant-phase2/verification.json) records baseline SHA-256
`5de86d94caaa626402b73ac9fa8f6bbc7a9b111e69a8b3801461380635cbd87f`.
These are the already-recorded current pins, not a new run or current R0 approval.
Phase 1 and the pre-rename Phase 2 archive remain immutable.

## Immediate ordered next actions — Train the first broader Adjutant

R0's adversarial review has been performed; remediation, regression verification, and review closure remain pending.
R1 future design freeze is complete; implementation and validation readiness are not. R2–R8 remain pending and unimplemented.
Complete **R0–R5 before the first training run at R6**; use **H=1**. No training is authorized.

0. **R0 — REVIEWED / BLOCKED: close full implementation post-image review.** Adversarial task `ses_f07c45365ffew0wJ58yFHXAye5` returned **READY TO MERGE: no**. Investigate and resolve all A01–A15 in the [R0 ledger](#r0-findings-ledger--full-implementation-post-image-review), persist meaningful negative regressions, refresh frozen-source/image evidence, and obtain recorded adversarial and security rereviews **READY: yes**. Security remains **UNRECORDED**. Rename-only approval and Orrery documentation review cover different scopes; neither substitutes for these verdicts.
1. **R1 — Future design contract FROZEN; readiness not established.** [Recipe](ml-adjutant-r1-recipe.md) and [contracts](ml-adjutant-r1-contracts.md) preserve eight original choices/nine follow-ups and now freeze API A, quota B, provenance A, curriculum A, validation A and COMMON A. Retain `packages/starchess-training`, private `@chess-coach/starchess-training` `0.0.1`, H=1, `7×48+175+1=512` unique capacity, 2048 counted append attempts, four action slots, 370 ordered features, authorized ledger/native companion, SHA-256/`mulberry32`, all-history baseline/startup 0, summed REINFORCE gradient/L2 once and stop-ALL aborts. The frozen experimental profile keeps zero initialization, float64 CPU, `η=.001`, `τ=1`, `λ=.0001`, one eligible episode per update and no clipping. Five serial masters 101..105 each consume at most 1000 STARTED slots; curriculum A allocates 500 corpus / 250 live White / 250 live Black at the cap; all five must finish VALID before formal final-valid-101 primary. Numeric/gradient/performance validation and R0/R2–R5 remain pending; no build/run is approved.
2. **R2 — Implement broader observation-only generation.** Cover all kinds and meaningful ordered B/C/F chains with deterministic bounded composition, deduplication, pruning, and pass retention. Measure exhaustive small-fixture domains and actual generated membership separately; never use full-state legality probes or admission retries.
3. **R3 — Implement authorized economics.** Track own lineage, confirmed paid debits, and paid-investment loss separately from replacement valuation. Track only observed/confirmed opponent-loss bounds with explicit unknowns; do not import private strategic KVS or infer an exact enemy ledger.
4. **R4 — Implement candidate-conditioned feature v2.** Add economic, vision/attack-ray, tactical, and exploration interactions with knowledge masks, normalization, and frozen ordered names/dimensions. Observation-only terms and the shared bank component of budget margins cancel in linear ranking; extra global scalars do not supply candidate-context preferences.
5. **R5 — Persist readiness verification.** Use gradient/finite-difference → numeric-extremes → exhaustive-small-fixture → capped-worst-case-runtime → reload/provenance. Validation A freezes `eps=1e-6`, `atol=1e-8`, `rtol=1e-5` and contracts §§16–17's fixtures/pass rules, inherited fixed deadlines and Docker resources. Require every privacy/noninterference, ledger/conservation, phase, host-resource/atomicity, uncertainty/unknown-ray and v2 interaction check. Actual hardware/provider measurements and numerical/runtime results remain future evidence. Refresh execution/capture pins and hermetic evidence after implementation changes; preserve historical bundles.
6. **R6 — Train the linear policy from actual outcomes.** Use the current 18 as training/regression plus a live-strategic curriculum, not held-out evidence. Separate training-selection/policy RNG streams from gate streams; persist data metadata, recipe, seeds, loss/update history, and provenance.
7. **R7 — Freeze the real learned artifact and adapter.** Validate finite, exactly aligned v2 weights and an external artifact hash; implement a `ScriptPlayer`-compatible authorized adapter. Allow no online updates, heuristic/strategic rescue, or missing-model fallback in the learned gate.
8. **R8 — Execute learned Phase 4.** Run every pinned case with the frozen artifact, integrity checks, and semantic reruns. Require **18/18 corpus + 36/36 live wins**, `fallbackCount = 0`; retain every loss, rejection, timeout, and other failure in the denominator.

**Separate optional follow-up after R0:** audit the external **96-game count-only** export for provenance,
duplicates, rules, and trace compatibility. No admission/dedup audit or gate expansion has completed;
this audit is not first-model readiness. Three-window belief/search, RLHF, Elo, UI/runtime rollout,
and Stockfish retirement do not block the first model.

Scope: arena-owned Phases 1–2, with selected dedicated **`packages/starchess-training`** ownership for Phase 3 onward.
The reviewed historical inventory did not contain the training package; this freeze creates no package or APIs. Approved identity is private `@chess-coach/starchess-training` `0.0.1`.
API A freezes future `@chess-coach/starchess-arena/observations` and `/events`, plus `@chess-coach/starchess-training/candidates`, `/features`, `/artifacts`; contracts §§3–4 specify exact signatures and closure.
Do not route all artifact logic into arena or publish unrestricted `SideContext` as a model interface.
Historical `ml/` ownership shorthand is superseded,
**not an Adjutant registry ID or a URL alias**. The exact future player ID is **`machine-learning`**.
Phase 1 isolates candidates behind `CandidatePolicy` / `AuthorizedObservation`; live strategic
retains the arena's trusted `ScriptPlayer` execution contract. The app consumes the core-derived
`AdjutantKind` and `PlayableAdjutantKind` through `apps/starchess/src/types/newGame.ts`.

### Phase ownership and gates — R0–R8 are not all Phase 2

These actions repair existing assurance or prepare/execute later phases; they are not nine new Phase 2 findings.
All **A01–A15 belong to the same R0 review**, not to R1–R8.

| Action / current status | Phase ownership | Required gate |
|---|---|---|
| R0 — REVIEWED / BLOCKED | Cross-cutting Phase 1/2 remediation. A08–A10 own Phase 1 execution/watchdog/corpus/evidence and the Phase 0 corpus-pin contract. A01–A07, A11–A15 own the current Phase 2 import/audit/provenance/hermetic/publication layer. | Investigate and resolve every finding with meaningful negative fixtures; refresh evidence and obtain both adversarial/security READY verdicts before R6. Every later phase reuses this assurance boundary. |
| R1 — Future design FROZEN; not runtime-ready | Cross-cutting architecture and Phase 3 design preparation; [recipe](ml-adjutant-r1-recipe.md) and [exact contracts](ml-adjutant-r1-contracts.md) record approved profiles/common semantics. | Design freeze advances independently of R0 repairs, but supplies no implementation/validation evidence. Implement and persist R2–R5, close all R0 findings and obtain explicit training approval before R6. Do not accept a model freeze with the known-bad importer. |
| R2 — PENDING; not performed | Broader generation extends Phase 2 policy contracts as an accepted **FIRST Phase 3 training prerequisite**. | Implement, version, and verify before R6. Current v1 Phase 2 completion does not mean broader generation is complete. |
| R3 — PENDING; not performed | Authorized economics/lineage/loss extends Phase 2 policy contracts as an accepted **FIRST Phase 3 training prerequisite**. | Implement and verify the authorized ledger/uncertainty contract before R6. |
| R4 — PENDING; not performed | Candidate-conditioned v2 extends Phase 2 policy contracts as an accepted **FIRST Phase 3 training prerequisite**. | Implement, verify, and freeze ordered v2 names/dimensions before R6; current v1 does not satisfy it. |
| R5 — PENDING; not performed | Cross-cutting repair/regression verification plus new broader-model readiness checks. | Persist passing readiness checks and current frozen-source/hermetic evidence before R6. Historical PASSED suites do not demonstrate rejection of the newly identified counterexamples. |
| R6 — PENDING; not performed | Phase 3 training. | Start only after R0–R5 close; persist actual-outcome training and provenance at H=1. |
| R7 — PENDING; not performed | Phase 3 learned artifact/runtime adapter. | Complete artifact/adapter validation and freeze before R8; no online updates or rescue fallback. |
| R8 — PENDING; not performed | Phase 4 execution. | Execute only after R6–R7 complete; require 18/18 + 36/36 wins, integrity, semantic reruns, and `fallbackCount = 0`. |

**Do not wait until Phase 4 to repair R0.** Close R0–R5 before training, then complete R6–R7 before R8.
“Apply all R0–R8 before Phase 4” is false: **R8 is performed in Phase 4**.
No unstarted action has a review finding or a passing result in this session.
H≤3 belief/search remains optional later work. R1 future design/experimental numeric requirements are frozen,
not an implementation authorization, validated performance profile, task date or approved run.

### R0 findings ledger — full implementation post-image review

Review task: `ses_f07c45365ffew0wJ58yFHXAye5`. Verdict: **READY TO MERGE: no**.
The reviewer assigned **7 HIGH and 8 MEDIUM**, with **no BLOCKER-severity finding**.
Completion still blocks on the negative verdict and mandatory HIGH review gate.
There are no LOW findings in this review; none is silently deferred.

**[Inference] All counterexamples below are source-derived reviewer findings, not executed exploit or regression proof.**
The reviewer inspected recorded **426 core / 434 arena** passes and **54 executions + 54 semantic reruns**;
the reviewer did **not** independently rerun them. This docs-only correction executes no tests.
The historical review's source reads confirmed the cited file/line anchors, not hypothetical execution outcomes; this approval pass does not refresh those anchors or source inventory.
Every obligation below is **PENDING**, not a claim that code or tests have been repaired.
Source locations are repo-root-relative; `packages/starchess-arena/` is the arena owner.

| Stable ID | Severity | Source location | Owning phase / domain | Source-derived finding | Pending verify/repair obligation |
|---|---|---|---|---|---|
| A01 | HIGH | `scripts/challenge-import-evidence.mjs:118` | Phase 2 import/provenance; backend | [Inference] Import trusts baseline/migration flags and lengths instead of authoritative schedule, reexecution, rerun, and corpus validation. The test fixture supplies rows `0..53` and comparisons `{ equal: true }`. | Reject invented/duplicate/missing schedule rows, forged integrity/parity, and unbound corpus data; independently validate scheduled evidence and recompute semantic comparisons against authoritative inputs. |
| A02 | HIGH | `scripts/challenge-import-evidence.mjs:69` | Phase 2 verification inventory; backend/devops | [Inference] Loose command predicates do not bind executable, complete arguments, strict-check inputs, or test coverage; fake/partial verification can qualify. | Persist negative command/argument/input/coverage fixtures and enforce the approved complete verification inventory rather than matching isolated argument tokens. |
| A03 | HIGH | `scripts/challenge-import-evidence.mjs:91` | Phase 2 verification provenance; backend | [Inference] `command.tests.sha256` and recomputed Vitest metadata are not bound. Replacing raw failure JSON and updating its artifact checksum can leave self-reported passing counts accepted. | Bind each test command to its actual JSON bytes/hash and recompute success/counts; reject failure JSON with forged passing metadata and updated checksums. |
| A04 | HIGH | `scripts/challenge-import-evidence.mjs:125` | Phase 2 capture/image provenance; devops | [Inference] Current capture is compared with `build.capture`, but neither is joined to image measurements / `verification.assurance.sourceSha256`, allowing stale execution. | Bind current capture, build capture, measured image source, and execution verification to one source identity; reject stale execution paired with refreshed capture metadata. |
| A05 | HIGH | `scripts/challenge-import-evidence.mjs:106` | Phase 2 archive/image identity; devops | [Inference] Export validation checks only the envelope checksum, not actual image identity. The fixture uses literal `image-bytes` as its accepted archive. | Validate archive structure/content identity against the expected image; reject non-image bytes and a valid archive of another image despite matching envelope checksums. |
| A06 | HIGH | `packages/starchess-arena/src/challenge/sourceInventory.ts:234` | Phase 2 dependency audit; backend | [Inference] Default `node:module` import and module namespace aliases escape loader tracking, bypassing execution→contracts restrictions. | Persist default-import and namespace-alias loader regressions; audit their actual edges or reject unsupported loader forms before accepting the inventory. |
| A07 | HIGH | `packages/starchess-arena/src/challenge/sourceInventory.ts:209` | Phase 2 dependency audit; backend | [Inference] Node CommonJS unknown-extension fallback can execute `require("./helper.txt")`; the target is hashed but skipped by AST auditing, bypassing partitions. | Persist an unknown-extension executable-helper regression; audit executable contents/edges or reject this loading path instead of treating hashing as dependency validation. |
| A08 | MEDIUM | `packages/starchess-arena/src/challenge/supervisor.ts` permit deadline | Phase 1 watchdog/execution; backend | [Inference] Changed phase announcements renewed the plan deadline without validated progress. | **REPAIR IMPLEMENTED, REREVIEW PENDING.** Parent arms the original deadline before each `challenge-worker-v2` permit; status cannot renew it. Focused watchdog tests passed. Fresh image evidence and rereview remain open. |
| A09 | MEDIUM | `packages/starchess-arena/src/challenge/integrity.ts` | Phase 1 corpus/evidence + Phase 0 pin contract; backend | [Inference] Supplied trace hash/case ID were not pinned to actual corpus identity. | **REPAIR IMPLEMENTED, REREVIEW PENDING.** `executionIntegrity` binds rows to `loadTrustedExecutionContext`; forged context and forged trace tests passed. Fresh evidence and rereview remain open. |
| A10 | MEDIUM | `packages/starchess-arena/src/challenge/evidence.ts` | Phase 1 evidence accounting + Phase 0 pin contract; backend | [Inference] Integrity gated only wins; losses/draws used labels and failures used stop kind. | **REPAIR IMPLEMENTED, REREVIEW PENDING.** Roster classification uses validated exclusive buckets. Known-ID anomalies stay local; unattributable rows fail the selected roster. Focused tests passed. Rereview remains open. |
| A11 | MEDIUM | `scripts/challenge-import-evidence.mjs:149` | Phase 2 atomic import publication; backend/systems | [Inference] An existence check followed by rename can overwrite a raced-in empty destination directory, violating no-overwrite. | Persist a destination-creation race regression and implement approved exclusive publication; preserve any destination created by a competitor. |
| A12 | MEDIUM | `scripts/challenge-import-evidence.mjs:147` | Phase 2 import crash durability; backend/systems | [Inference] Nested log directories and the destination parent lack fsync; crash durability is not established by fsync of the staging root alone. | Persist filesystem-operation/fault regressions and establish durable nested directory entries and the parent publication entry, not merely file contents. |
| A13 | MEDIUM | `scripts/challenge-import-evidence.mjs:154` | Phase 2 publication failure semantics; backend/systems | [Inference] Post-rename fsync failure sits outside rollback, leaving a published destination while throwing and blocking retry. | Inject post-rename fsync failure; define and verify approved cleanup or explicit committed-state recovery semantics so failure does not leave ambiguous publication/retry state. |
| A14 | MEDIUM | `scripts/challenge-import-evidence.mjs:15` | Phase 2 importer resource bounds; backend | [Inference] JSON is read before size validation and all artifact bytes remain retained without individual/aggregate allocation caps. | Approve finite limits and persist oversized-JSON/artifact/aggregate regressions; enforce bounds before allocation/parse and bound total retained bytes. No new numeric limits are approved here. |
| A15 | MEDIUM | `packages/starchess-arena/hermetic/policy.mjs:34` | Phase 2 hermetic mount policy; devops | [Inference] Additional tmpfs/source overlays can pass mount validation, and `/tmp` size/mode are not enforced. | Persist unexpected tmpfs/source-overlay and altered `/tmp` size/mode regressions; enforce the exact approved mount set and temporary-storage configuration with actual Docker verification. |

The A01 and A05 fixture observations are in
`packages/starchess-arena/src/__tests__/challengeEvidenceImport.test.ts:34,46,78–86`.
Reading that fixture confirms its contents, not an independent execution of it.

### R0 remediation and re-verification — pending diagnostic order

This grouping records suggested diagnostic order, **not a newly approved implementation recipe**:

1. Audited identity and authoritative validation: **A01, A03, A04, A05, A09, A10**.
2. Complete verification inventory: **A02**.
3. Dependency/loader audit: **A06, A07**.
4. Runtime bounds, watchdog progress, and mounts: **A08, A14, A15**.
5. Atomic publication and crash/failure durability: **A11–A13**.

Executor requests revisiting these existing pre-training / Phase 1–2 adversarial findings while Orrery proceeds independently; that request closes no finding.
Lead/build must investigate each finding under the accepted architecture and route repairs to the
most specific domain owner. Persist true adversarial negative regressions before claiming closure;
old PASSED fixtures do not demonstrate that these counterexamples fail safely.
After code freeze, rehash fresh source/dependency/configuration captures, rebuild the hermetic image,
and execute the complete **54 + 54** baseline/rerun schedule while preserving all historical bundles.
Rerun core/arena suites, strict TypeScript checks, and infrastructure checks including **actual Docker**;
bind all current capture, image, command/test/log, archive, and execution artifacts.
Record the new commands/results and obtain full implementation adversarial **and security** rereviews
**READY: yes** before closing R0. No repair, refreshed hash, run, or rereview is claimed here.
The later first-training gate still requires R1–R5; R0 closure alone does not authorize R6.

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

These historical catalog-only checks and scoped approvals remain unchanged in outcome;
they do not substitute for current R0 full implementation assurance.

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
| Security review | Historical preparatory catalog source scope **READY: yes**, no findings |

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
Executor selected **Broader first trained ranker**:
[ml-adjutant-weights.md](ml-adjutant-weights.md) specifies the shared coefficients, combination domain,
authorized economy/loss knowledge, vision interactions and frozen future outcome-driven training design.
FIRST Phase 3 training requires a separately versioned broader combination generator and v2 economic/positional
interactions, including an own-loss lineage ledger and confirmed opponent-loss lower bounds with fog uncertainty.
Start at **H=1**; conditional plans across **three simultaneous planning windows** remain a separate future milestone.
Current features v1 are not an adequate first-trained-ranker contract.

### Completed learning documentation — not executable readiness

[ml-adjutant-weights.md](ml-adjutant-weights.md) now defines shared coefficients, the combination domain,
planning horizons, authorized economics/loss, vision/attack/tactical priorities, and the proposed learning/artifact contract.
Weights are not per-move lookup entries. Own paid-investment loss differs from replacement value;
enemy confirmed-loss bounds and unknown attack rays retain uncertainty. Candidate-independent observation
and shared budget-margin components cancel in linear comparisons, requiring genuine v2 interactions.
Executor accepted broader combinations/v2 at **H=1**; three-window belief/search stays later.
The concept documentation, [R1 recipe](ml-adjutant-r1-recipe.md) and [exact future contracts](ml-adjutant-r1-contracts.md) are design-frozen; implementation and persistent readiness checks remain incomplete.

The generic **Auditable Policy Learning** study guide, PlantUML/SVG, exercises/rubric, README discovery,
and context-generator coverage are authored in Orrery. The contribution reports source-verified academic/official
references and passing generator checks with frozen fixture oracles unchanged.
[PR #12 files](https://github.com/proveo-ca/orrery/pull/12/files) contains
`_spec/study-cases/auditable-policy-learning.md` and
`_spec/study-cases/6-post-training/auditable-policy-learning.puml` plus its SVG.
Publication is on `docs/auditable-policy-learning`, commit `790ff3843860a9d980519504dd4354619882cbca`.
GitHub's checked PR state is **OPEN**, `merged_at = null`; this is not a merged-main claim.
Its documentation/sourcing/security approvals do not review this project's post-image implementation
or change executable contracts, runtime readiness, training evidence, or learned acceptance.

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

- **Core never depends on ML.** Phase 1 flows `arena → core`; selected future training flows
  `packages/starchess-training → arena authorized public contracts → pure core`. Core and browser gain no ML dependencies.
  The training package and dedicated observation-only public API remain unimplemented; unrestricted host/opponent context never faces the model.
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
Separately and optionally after R0, audit the newly located external 96-game export's hashes, IDs,
duplicates, rules, and trace compatibility before proposing an expanded challenge and approving a new
manifest version. This is not first-training readiness. Do not silently expand the existing denominator.

## Phase 1 — Strict serial harness, adapters, and baseline

**Status: IMPLEMENTED; historical verification PASSED and both scoped Phase 1 reviews READY: yes.**
**Current R0 assurance BLOCKED:** A08–A10 require watchdog/corpus/evidence repair and re-verification.
Arena owns this phase, not the selected future training package. Historical scoped approvals are not a current full implementation verdict.
Owning diagram: [`ml-adjutant-challenge-harness.puml`](../packages/starchess-arena/ml-adjutant-challenge-harness.puml).
**Selected repair directions, not completed repairs:** [execution and evidence revisions](ml-adjutant-execution-revisions.md)
records A08 checked state/phase steps with fixed existing per-decision deadlines, A09 a host-audited
corpus roster loaded once and injected into validation, and A10 engine-backed validation before
exclusive win/loss/draw/failure accounting against the trusted schedule. Core remains the rules/outcome
authority; host bookkeeping does not create a second rules engine. Exact protocols/APIs, implementation,
and negative tests remain **PENDING**; no budget, code, or training authorization follows.
The record explains concepts, alternatives, readings, and pending checks; normative challenge/diagrams
and historical evidence/pins remain unchanged. R0 still holds all **15 pending: 7 HIGH + 8 MEDIUM**,
**READY TO MERGE: no**, security **UNRECORDED**, weights **NONE**.
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
The persisted tests and evidence below record historical verification of these Phase 1 contracts.
Their passing results do not establish rejection of the newly identified A08–A10 counterexamples.
In particular, standalone corpus identity and all-row summary accounting remain R0 repair obligations.

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

### Phase 1 implementation verification — historical

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
| Phase 1 adversarial rereview | Historical lead report **READY: yes**, no remaining findings in that scope; not the current R0 verdict |
| Phase 1 security rereview | Historical lead report **READY: yes** for trusted non-learned execution; current full implementation security rereview remains UNRECORDED |

**Done when.** Integrity tests and deterministic reruns pass; baseline reports enumerate every
scheduled case. Full-state/metadata leakage and white-first queue/bank exposure tests must pass
before creating training examples. A strict trace failure remains visible and can block the
challenge; a report alone is not proof that all traces support winning counterplay.

## Phase 2 — Authorized codecs/features, coverage, and partitioned execution pins

**Status: historical hermetic verification PASSED. Not a learned PASS. Current R0 assurance BLOCKED.**
Full implementation post-image adversarial review is recorded **READY TO MERGE: no** with A01–A15;
security rereview remains **UNRECORDED**. Phase 2 owns A01–A07 and A11–A15, not all R0 findings.
Owning diagram: [ml-adjutant-policy-contracts.puml](../packages/starchess-arena/ml-adjutant-policy-contracts.puml).
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

**Persisted in-image coverage:** exact queues 18/282; singleton intents 204/576;
reference codec and feature representability each 282/282; maximum 48 proposals.
These historical White membership/encoding counts do not establish live counterplay, legal completeness,
or winning queues. They are representability, not winning coverage.
The counts are persisted in [coverage.json](../evidence/ml-adjutant-phase2/coverage.json).

### Pin partition and import audit contract

The following describes the implemented/intended audit contract, not a current R0 approval.
A06–A07 identify loader/extension gaps in its enforcement; A01–A05 identify import/provenance gaps.

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
The runner published final `verification.json` only after those checks succeeded.
[verification.json](../evidence/ml-adjutant-phase2/verification.json) records `"passed": true`.
Current baseline SHA-256 is `5de86d94caaa626402b73ac9fa8f6bbc7a9b111e69a8b3801461380635cbd87f`.

### Diagram-reference relocation — historical versus current evidence

The [pre-rename bundle](../evidence/ml-adjutant-phase2-before-diagram-rename/verification.json)
remains historical and byte-preserved.
The [current bundle](../evidence/ml-adjutant-phase2/verification.json) records a fresh standard hermetic run after the SPEC-pointer rename.
Phase 1 evidence and its originally executed diagram command remain immutable.
The lead reports checksum verification of all 20 archived runtime artifacts, including restoration of the original raw Vitest JSON bytes.
The lead reports that reversing only the SPEC-name replacements reproduced the old manifest hashes for all 122 inventoried source files.
The lead also reports equality of all 54 old/current semantic rerun comparison entries.
These checks supplement fresh execution; they do not waive current byte-pin or capture checks.

| Historical archive only | Recorded pin |
|---|---|
| Pre-rename baseline | `e3aa24c03bd3225b56d0d96bdd357e681354fd16fec0267e9d7bc9af9e43306e` |
| Pre-rename source image | `sha256:54f85a0d129667d8d00975daaf0755c801a442eb1e0046797c403dcaea426f95` |
| Pre-rename dependency image | `sha256:979ae1a1536d1beb0006ca8285a2a6f7a4b35c24c0ecb031b1e59935bdf156a0` |
| Pre-rename external image archive | `babe14d848bad14c13604736f2fa02c10f201d668388762b50d5440576187e3a` |

### Hermetic assurance — historical final source image passed

The final source image is `sha256:e7f9ea8ac211c93804bd1125ed28fb7e165a160c4155ca70404c81f9e431710d`.
The lead reports a fresh standard dependency image `sha256:4c9d45b04f325a2d912cb34ebc982f139f057a2f2fb6d779ac2ef59f29ea987d`.
Official Node **22.23.2** bookworm-slim, `linux/amd64`, platform digest
`sha256:43aeff40f4afc22e83f7589a2f37e111cff5ca84529571f1c8415bcc5fcc21b2`.
pnpm **10.33.0** registry-tool bytes remain pinned in `hermetic/pins.json` to SHA-256
`bfcc1bcbad279b13a516c446a75b3c58b6904b45d57a1951411015e50b751a80` plus SHA-512 integrity.
The earlier dependency preflight recorded **126 locked packages**, fresh-store acquisition, then offline frozen installation with network none.

The image run passed network-none, read-only root, and nonroot.
Capture retained core/arena source, tests/fixtures, diagnostics/infrastructure, configs,
the pinned corpus, and immutable Phase 1 evidence. It excluded host dependency trees, secrets, and caches.
Manifests record source/test, installed-tree, store, and tool bytes outside their inventoried roots.
The run used UID 10001, dropped capabilities, no runtime installs, and only the dedicated Phase 2 evidence output writable besides temporary storage.
[image-assurance.json](../evidence/ml-adjutant-phase2/image-assurance.json) records the inspected image id and archive SHA-256
`64d6277f439f7cdfb82ecb2c6a230f735c5c7f3588d7f13082a30b430e6d07f7`.
That archive is external and not in the repo. The lead reports its path as `/tmp/opencode/starchess-hermetic-export-k1KYQO/image.tar`.

**Passed in that image.** New full baseline: 54 executions plus 54 reruns, semantic rerun equal,
`executionIntegrity = true`, `learnedGateEligible = false`, `learnedChallengePass = false`.
Results are unchanged: corpus 18 scheduled, 0 wins, 2 terminal losses, 16 queue-rejected;
live strategic 36 scheduled, 0 wins, 36 terminal losses.
In-image vitest passed core **426/426** and arena **434/434**.
In-image core typecheck, arena typecheck, and the strict test `tsc` passed.
The lead reports infrastructure **5/5 tests passed**, including the actual Docker test with no skips.
The lead reports host-after-import current-evidence checks **7 tests / 2 files passed**, and arena typecheck passed.
Imported evidence includes `baseline-report.json`, `verification.json`, `pin-migration.json`,
`coverage.json`, `contract-report.json`, and `image-assurance.json`.
Phase 1 baseline SHA-256 `940387370040f88888e9dfe0bb86ad9d4a8be88854df507120f34b22ee2d362b`
and verification SHA-256 `55d965afa71d775ff6ee1e95b6650a27d0ce759b966a81c43a3bb364236c7508` are unchanged.
`pin-migration.json` records `semanticParity = true` against those original bytes.

**Not claimed.** This historical pass is neither learned acceptance nor current R0 approval. Weights remain **NONE**.
The lead historically reported pre-freeze adversarial, security, and devops findings fixed before this freeze:
loader escapes, dense arrays, provenance, capture containment, and importer completeness.
That earlier scoped closure does not close the new A01–A15 ledger.
Historical rename-only adversarial review remains **READY: yes**.
Full implementation post-image adversarial review is now **REVIEWED / READY TO MERGE: no**
(task `ses_f07c45365ffew0wJ58yFHXAye5`); security rereview remains **UNRECORDED**.
Do not treat this section or rename-only approval as a full implementation READY verdict.
An earlier PlantUML `checkonly` predates relocation and this evidence update.
Both renamed diagrams and the edited spec map passed `plantuml -checkonly`.
Broader generation and v2 economics/position remain required **before FIRST Phase 3 training**.
This Phase 2 slice does not implement them. Three-turn planning remains a later milestone.

## Phase 3 — Learn and freeze a ranker from outcomes

### Next delivery milestone — Train the first broader Adjutant

Follow the [ordered R0–R8 actions](#immediate-ordered-next-actions--train-the-first-broader-adjutant),
not a second parallel checklist. Three-window search is a later milestone.
No training run or learned artifact exists yet.

**Training-ready means:** R0–R5 have recorded passing evidence, ownership/packaging is approved,
the broader generator and authorized ledger/v2 interfaces are implemented and frozen, and the
loss/optimizer/seed recipe plus finite numeric budgets are settled. Persist integrity, noninterference,
conservation, uncertainty/ray, interaction, and gradient checks before starting optimization.
Documentation completion or a baseline image pass alone does not meet this definition.

**Status: PLANNED, no training implementation or artifact.**
**Prerequisite:** freeze a separately versioned broader combination generator and v2 feature names/dimensions,
authorized own-loss lineage ledger, confirmed opponent-loss lower bounds/uncertainty, and economic/vision/positional
candidate-context interactions. Current 158-entry v1 ranker inputs do not meet this prerequisite.
The exact future v2 names/calculus are frozen at **370** (`34+4×84`) in contracts §§9–10,15. R1 selects 512 unique candidates including pass,
2048 attempted extensions including duplicates/pruned, and a rules-derived generation queue-length upper bound of 4;
when all seven canonical families are available, capacity is **48 each (336) + 175 shared composition + 1 pass = 512**.
These are capacity limits, not required emissions or unique-output guarantees.
Contracts §8 freezes quota **B**, first action's kind ownership and inactive-to-active canonical redistribution, with shared capacity 175 unchanged.
It specifies canonical family/traversal order, shared-lane eligibility, byte-exact dedup, pass, pruning and counters. Rejected ownership profiles are reference only; one retained queue uses one funding pool.
The codec bound stays 65. Typed v2 action-position blocks preserve order and unknown/absent masks at four rules-derived positions;
keep queue combo/timing synergy and candidate×economic/vision/tactics/exploration interactions, not linear position-only weights.
Contracts §§4,9–10,15 freeze exact names/scales/masks/versions/dimension; do not reuse v1's 158 as a v2 count.
Ledger boundary batches reconcile authorized ordered events and normalized chip/settlement snapshots before consumption.
Host-issued own lineage IDs and side-local sequences must not leak hidden counts/gaps; raw full-resolve information remains private.
Contracts §§5–7 freeze provenance **A**, private native causal/visibility hooks and exact payload/order/IDs/mismatch semantics; own opening/free-promotion paid basis is zero and investment stays separate from replacement value.
Paid debits equal surviving+destroyed+wasted; unmaterialized deployments are waste, never invented births/deaths. Transient authorized vision updates memory/everLit; loss witnesses require actual causal pre-destruction visibility.
Use horizon **1** initially; three conditional simultaneous planning windows remain a separate future milestone.

**Deliverables.** Fit `s_w(h,c) = wᵀφ_version(h,c)` through an explicit training loss.
Coefficients are shared named-feature weights, not per-move or per-combination-tree entries.
The [weights contract](ml-adjutant-weights.md#7-proposed-outcome-driven-phase-3-learning--not-implemented)
specifies selected stable-softmax policy gradient with actual candidate-side rewards and a **per-seed all-history mean of past eligible completed returns**,
startup baseline **0**, held fixed before sampling; only add the current return after eligible completion.
The selected objective sums decisions: `L = -A Σ_t log π + λ||w||²/2`; apply L2 once per episode update and `w′ = w − η∇L`.
No per-length mean, recent-100/EMA baseline, mixed-seed history, or current-return baseline is selected.
The [R1 record](ml-adjutant-r1-recipe.md) selects SGD + REINFORCE with zero initialization, float64 CPU,
`η=0.001`, `τ=1`, L2 `λ=0.0001`, one complete episode per update, and no clipping.
Five independent masters 101..105 produce five artifacts, each capped at 1000 episodes (5000 total), counting **ALL started attempts**.
Infrastructure/provenance abort stops **ALL training**, preserves consumed-attempt counters/diagnostics, and aborts the episode
without fabricated reward or partial gradient update; proved eligible native/challenge failures use `−1` with verified ACKed sampled choices retained. Software/contract failures instead abort ALL.
No unlimited retry or automatic checkpoint resume is approved; any new continuation requires decisions and remaining-budget preservation.
Use selected **SHA-256 + existing `mulberry32`** with separate selection/environment-settlement/policy-sampling/opponent streams;
deterministic generation leaves its RNG stream unused with no derived root. Contracts §11 freezes UTF-8 `JSON.stringify(['starchess-training-rng-v1',masterInteger,label])`, first four SHA-256 bytes unsigned big-endian uint32 and persistent selection/policy/opponent lifecycle; environment-settlement is derived but unused.
Future tooling must measure/persist all 20 roots and reject any collision without salt/rederivation. No actual derived numeric seeds are pinned in this approval pass.
Gate corpus arena 0, inference 0 reset per match, and live arena 0..17 both seats remain unchanged; hash IDs never become features.
Prospectively select the **final VALID seed-101 artifact as primary before comparisons**; four others measure variability.
All five serial runs must complete VALID before formal primary designation; a later-master abort cannot fall back to finished 101. No average, best-gate cherry-pick, alternate-seed/checkpoint fallback, new development suite or all-five-artifact evaluation gate is selected.
Diagnostic checkpoint cadence is **every 100 STARTED ATTEMPTS**, with complete verified state saved at eligible boundaries, not mid-partial-reward updates.
Curriculum **A** is now explicitly approved: even STARTED slot corpus, odd live; live seats alternate White/Black. At 1000 slots allocation is **500 corpus + 250 live White + 250 live Black** per master; early abort does not claim full allocation, and the training-used 18 are not held out.
Contracts §§12–15 freeze proof-based failure/eligibility, atomic baseline/SGD/RNG/journal/counter commit, STARTED cursor/budget, manifest-order Fisher–Yates epochs, fresh episode memory, checkpoints and final validity.
Eligibility requires verified completion and ≥1 parent-ACKed verified sampled decision; zero-sample completions perform **no SGD, no L2, no baseline insertion**. Parent permits/ACKs verify compact prefixes under fixed before-write deadlines, with no status renewal or unACKed update.
Persist finite floats as exact binary64 big-endian Float64Hex with signed zero; close all 26 Configuration and 21 Versions keys. Publish checkpoints durably before fulfilling buckets; eligible attempt 101 may save delayed bucket 100, and zero-choice attempt 1000 cannot launch attempt 1001.
Final VALID requires started=verifiedCompleted=1000, no abort, ≥1 nonzero outcome-driven PG update, finite registry-aligned weights and bit-exact reload; all-five completion precedes the COMPLETE envelope/formal 101 primary, not five evaluation gates.
Validate gradients, numerics, coverage, and runtime before approving a run; rule legality/gas/mineral costs never become learned parameters.
Add a `ScriptPlayer`-compatible adapter that receives only the authorized interface, selects a
queue using the learned scores, and delegates authoritative commit to the host.
Keep candidate selection genuinely learned; a fallback strategic decision does not count.

Imitation/teacher bootstrap and Adam are not selected for this profile; any later change requires a separate decision and authorized-label audit.
Train counterplay using newly executed games and terminal candidate-side outcome rewards.
Use a separate seeded training-selection stream; do not feed game IDs, corpus indexes, future
white actions, or historical outcomes into the policy. Log optimizer/loss, training seeds,
dataset versions, candidate coverage, and model artifact hash.

**Done when (first trained model, not Phase 4 PASS).** Persistent tests verify broader combination coverage, authorized loss-ledger conservation,
uncertainty/ray semantics, and context interactions before a repeatable seeded training run produces changed learned
weights and a frozen, finite, exactly name-aligned v2 artifact with external hash and provenance.
Retain the actual recipe, seeds, data identity, loss, and optimizer-update history with that artifact.
Evaluate it without online updates using inference seed 0 per match. Publish failures as well as
wins. Add a small neural network only if separate held-out results justify the added complexity.
The 18 cases may be used for training/regression; they are not held-out generalization evidence.

## Phase 4 — Exhaustive perfect gate

**Status: learned acceptance PLANNED.** Existing Phase 1 scheduling, supervision, and report/integrity
machinery already exercises all 54 baseline cases. Learned runner eligibility, adapter/artifact validation,
dedicated learned tests, and actual learned acceptance remain pending; zero-fallback baseline execution is not proof of learning.

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

`packages/starchess-training` is the selected, uncreated Phase 3+ owner; Phases 1–2 ownership stays in arena.
Lead/build must implement the approved npm identity, API A paths/signatures and deliberate dependency/export-resolution/source-inventory/layer-policy/hermetic package-context/installed-store/CI requirements in contracts §§3–4.
The frozen historical capture/dependency closure covers core/arena, not the future training folder; `packages/*` already covers the future workspace path.
Do not blindly relax the unused baseline graph's execution→contracts restriction while adding the future training/v2 closure.
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
All PASSED/in-image results below are **historical records**, not reruns in this docs-only correction
or passing evidence for A01–A15 negative regressions. Current R0 assurance remains blocked.
Future learner paths below are **PROPOSED** under the selected `packages/starchess-training/src/__tests__` owner.
The historical inventory contains no training source/test files; exact future DTOs/signatures/public exports are frozen in contracts §§3–4, but these proposed test paths are not implemented evidence.
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
| `packages/starchess-arena/src/__tests__/challengeObservationCodec.test.ts` (EXISTS; in-image arena vitest 434/434 passed) | 2 | Observation round trips, schema/unknown/visibility and memory semantics. |
| `packages/starchess-arena/src/__tests__/challengeCandidateCodec.test.ts` (EXISTS; in-image arena vitest 434/434 passed) | 2 | Ordered kind/timing/spend encoding, canonical keys, structural bounds and comparator. |
| `packages/starchess-arena/src/__tests__/challengeFeatures.test.ts` (EXISTS; in-image arena vitest 434/434 passed) | 2 | Named finite vectors, authorized inputs, normalization and historical coverage. |
| `packages/starchess-arena/src/__tests__/challengeContractAdmission.test.ts` (EXISTS; in-image arena vitest 434/434 passed) | 2 | Codec proposals remain distinct from host whole-queue legality/resource gates. |
| `packages/starchess-arena/src/__tests__/challengeContractCoverage.test.ts` (EXISTS; in-image arena vitest 434/434 passed) | 2 | Reproduce 282/282 codec/features versus 18/282 queue and 204/576 intent membership; bind contract/coverage evidence to current pins and all-row migration. |
| `packages/starchess-arena/src/__tests__/challengeEvidenceImport.test.ts` (EXISTS; in-image arena vitest 434/434 passed) | 2 | Validate image/capture/artifact/log identities before publication; reject unsafe paths, capture drift, and incomplete inventories. |
| `packages/starchess-arena/src/__tests__/challengeSourceInventory.test.ts` (EXISTS; in-image arena vitest 434/434 passed) | 2 | Complete partitioned source/config inventory, import boundaries and loader policy. |
| `packages/starchess-arena/src/__tests__/challengePinMigration.test.ts` (EXISTS; in-image arena vitest 434/434 passed) | 2 | Immutable Phase 1 byte pins, new v2 baseline and all-row semantic migration parity. |
| `packages/starchess-arena/hermetic/infra.test.mjs` (EXISTS; not one of the seven recorded in-image commands) | 2 | Restricted real-container policy, allowlisted capture, tools/dependency/store assurance. The final image run passed network-none, read-only, and nonroot. |
| `_spec/evidence/ml-adjutant-phase2/{baseline-report,contract-report,coverage,pin-migration,verification,image-assurance}.json` (IMPORTED; verification passed) | 2 | Hermetic 54+54 execution, original 54-row parity, contracts/coverage/pins, image id, and persisted command evidence. Not a learned PASS. |
| `packages/starchess-training/src/__tests__/learnedRanker.test.ts` (PROPOSED) | 3 | Loss-driven weight changes, frozen artifacts, selected-queue admission, no fallback/online updates. |
| `packages/starchess-training/src/__tests__/perfectGate.test.ts` (PROPOSED) | 4 | Exactly 18 corpus + 36 live strategic wins; every non-win/integrity failure fails the gate. |
| `packages/starchess-training/src/__tests__/preferenceLoss.test.ts` (PROPOSED) | 5, optional | Same-observation human pairs, preference-loss direction, policy regularization. |

**Final handoff:** both historical Phase 1 reviews are lead-reported READY: yes.
Both renamed diagrams and the edited spec map passed `plantuml -checkonly`.
Hermetic execution does not constitute a learned PASS or a full implementation post-image READY verdict.
Historical rename-only adversarial review remains **READY: yes**.
Full implementation post-image adversarial review is **REVIEWED / READY TO MERGE: no**
(task `ses_f07c45365ffew0wJ58yFHXAye5`); security rereview remains **UNRECORDED**.
The [R0 ledger](#r0-findings-ledger--full-implementation-post-image-review) holds **7 HIGH + 8 MEDIUM**, all pending.
**Phases 0–2 retain historical implementation/test/hermetic PASSES; current R0 assurance is BLOCKED.
Phase 3+ remains planned and unimplemented; weights NONE; NOT training-ready**;
reviewers must verify legality, isolation, and zero-fallback learned evidence independently of the non-learned baseline.
Resolve R0 with regressions, refreshed evidence, and both READY rereviews before first training at R6;
complete R1–R5 before R6 and R6–R7 before R8. R8 executes Phase 4, not a prerequisite to it.
The broader FIRST-training prerequisites and all proposed persistent learning/economy/search tests in
[ml-adjutant-weights.md](ml-adjutant-weights.md#9-future-persistent-acceptance--proposed-not-done) remain pending.
The challenge document specifies additional adversarial integrity cases.
Corpus provenance verification does not establish a learned player's performance.
