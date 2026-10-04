# R2 — approved V1 bridge and candidate generation V3

Status: **WIP / IMPLEMENTED IN PROGRESS; full fresh verification and R2 closure PENDING.**
Scope: observation-only generation and its package graph, native helper extraction, pins, and full fresh verification.
This document records the accepted TUI directions without reopening alternatives.
No learned policy, SGD execution, training run, model artifact, or registry activation is authorized here.

Owning diagram: [candidate-generation.puml](../packages/starchess-training/candidate-generation.puml).
Assurance diagram: [ml-adjutant-policy-contracts.puml](../packages/starchess-arena/ml-adjutant-policy-contracts.puml).
Roadmap: [PLAN-ml-adjutant.md](PLAN-ml-adjutant.md).
Prior approved future design: [ml-adjutant-r1-contracts.md](ml-adjutant-r1-contracts.md), especially §8.
Historical execution contract: [ml-adjutant-execution-revisions.md](ml-adjutant-execution-revisions.md).

## 1. Authority and recovery boundary

Executor reports the latest R2 source checkpoint was recovered from `cc6` after a workspace reset.
The current training/bridge/native/verification pieces exist again; this replaces the earlier R0-only `0c6` checkpoint description as current source status.
R0 evidence and partial logs remain historical; archived logs and `/tmp` images are absent.
The original R0 closure, counts, review verdicts, and image/archive hashes remain immutable **historical records**, not CURRENT proof of the recovered tree or R2.
Do not rewrite restored evidence, substitute old output for a missing R2 run, or claim the historical image still exists.
R2 requires a new captured-source/dependency image and fresh verification/publication.
This spec pass reads source and changes only `_spec/` and root `PLAN.md`; it executes no tests, recomputes no hashes, and publishes no evidence.
Old completion markers cannot authorize current closure or live-pin assertions.

### Latest source checkpoint — not a verification result

- Source contains the private training package, four-promotion V3 domain, root-guard family availability, pure V1 bridge, inventory v2, execution pins v3, verification v3, and public-closure tooling.
- Executor reports the native owner's **19** strict test-type errors are fixed and the lead resolved **two** legacy fixture boundary casts.
- These repair reports do not constitute a new full strict run or test result.
- Prior full host counts were **469 core / 811 arena / 50 training**; `r2-assertion-floors-v1` records them as floors, not current passing totals.
- The next source gate reruns all three full suites, all three package typechecks, every direct strict core/arena input and both scripts, Node checks, and public closure.
- No fresh R2 dependency/source image, full frozen verification, publication, or closing review exists yet.
- Current devops discovery: `infra.test.mjs` has **six tests (five static + one actual Docker)**; `scripts/challenge-infrastructure-evidence.mjs` still expects **five**. The lead must repair the exact six ordered-title contract before fresh infrastructure capture; no passing infrastructure envelope is claimed.
- The lead appends the new package and public-closure check to root CI before freeze; spec-keeper edits no source, CI, package README, or evidence.

Accepted directions:

| Decision | Accepted contract |
|---|---|
| Bridge | Implement against authorized observation V1 now; do not fake V2 history, ledger, or provenance. |
| SHA dependency | Exact `@noble/hashes` **`2.4.0`**, never `^`/`~`; synchronous `sha256` from `@noble/hashes/sha2.js`. |
| Package | Private `@chess-coach/starchess-training` **`0.0.1`**, path `packages/starchess-training`. |
| Public training surface | **Only `/candidates`** in R2; no root, wildcard, `/features`, `/events`, or `/artifacts` export. |
| Public export maps | Exact core `['.']`, arena `['.','./observations','./intent-codec-v1']`, training `['./candidates']`; no extra keys, aliases, wildcards, or conditional escape targets. |
| Generator | `composeCandidatesFromObservationV1` returns `CandidateBatchV3`, version `challenge-composition-v3`. |
| Quota/diagnostics | Profile **B** and its exact closed diagnostics remain unchanged. |
| Native rules | Share pure native helpers; do not change actual engine grammar, admission, or resolve semantics. |
| Verification | Full fresh cycle, not a focused-test substitute: package-graph inventory v2, execution pins v3, verification v3. |

Executor reports official README verification of the SHA package's MIT license, zero runtime dependencies, synchronous SHA-256, and `sha2.js` import subpath.
This is the accepted dependency research record, not an independent network lookup or installed-byte measurement in this pass.
Build must bind actual installed package/version/exports/license and lock/store bytes in the fresh closure.
Use no WebCrypto promise, Node crypto, or bespoke SHA implementation in the model-facing closure.
Node crypto may remain in host verification tooling.

## 2. Pure shared arena surfaces and compatibility

Arena owns `@chess-coach/starchess-arena/intent-codec-v1` and `@chess-coach/starchess-arena/observations`.
The former owns pure candidate V1 encoding/decoding, action validation, canonical action keys, requested spend, and comparator semantics.
The latter owns V1 authorized DTO types, canonical squares, observation validation, and observation byte encoding/decoding.
Both transitive public closures must be pure and browser-safe.
They must not import the arena root barrel, `challenge/baseline`, host observation projection, corpus, admission, supervisor, filesystem/process APIs, or training.
Extract shared canonicalization, detached-copy/freezing, square registries, and schema helpers without importing a host module merely because that module currently exports a pure function.
Keep host projection private; validation does not authenticate a producer.
Public DTO wrappers inspect and detach own data before validation; they reject getters, symbols, hidden metadata, sparse arrays and unsupported prototypes without reading caller properties.
Legacy facades retain their existing acceptance behavior; public descriptor validation is not a claim that every legacy metadata/accessor case has identical rejection semantics.

### 2.1 Bounded detached DTO inspection and immutable registry

`src/challengeContract/validation.ts::inspectDto` uses fresh call-local counters, an ancestor set, and a shared-subtree memo for each inspection.
The root starts at depth **0**; the maximum accepted depth is **16**.
Limit total root/node/edge visits to **8192**; each incoming visit counts even when it hits the memo.
Limit cumulative string values and own-property keys to **1048576 UTF-8 bytes (1 MiB)**; this is a byte budget, not a character count or per-string allowance.
Check own-key budgets before collecting descriptors and array length/density before allocating copies.
Reject accessors without invoking getters; reject cycles, symbols, hidden metadata, sparse arrays and unsupported prototypes before closed V1 schema validation.
Check ancestors **before** memo lookup so a cycle cannot masquerade as a shared subtree.
Memoize each completed detached subtree with its height; reuse its copy and require `incomingDepth + subtreeHeight <= 16` on every incoming path.
Shared DAG subtrees retain detached shared identity without repeated recursive expansion or descendant byte charging; memo hits still consume visits.
Public observation encode validates the strict observation DTO; public action validation, spend and candidate decode inspect before property reads.
The legacy private wire facade retains its existing acceptance behavior.

`ACTION_KINDS` is **runtime frozen at declaration**, not merely TypeScript `readonly`.
Its exact order remains `[classical,deploy,stimStep,spiderMine,charonMissiles,siegeMode,tacticalJump]`.
Public consumers must not mutate the registry or change generation order through a shared export.

### 2.2 Exact public export maps and pure closure roots

These are exact key-to-target maps, not minimum required subpaths:

| Package | Exact `exports` map |
|---|---|
| `@chess-coach/starchess-core` | `{ ".": "./src/index.ts" }` |
| `@chess-coach/starchess-arena` | `{ ".": "./src/index.ts", "./observations": "./src/observations.ts", "./intent-codec-v1": "./src/intent-codec-v1.ts" }` |
| `@chess-coach/starchess-training` | `{ "./candidates": "./src/candidates.ts" }` |

The pure closure audit roots are **core `.`**, **arena `./observations` and `./intent-codec-v1`**, and **training `./candidates`**.
Arena `.` stays the existing host barrel; export-map presence does not make it a pure model entrypoint.
Every transitive pure closure uses **static ESM imports/reexports only**.
Reject **all runtime dynamic imports, including `import('./literal-target')`**; a literal target is not a static import and does not receive an exception.
Reject CommonJS, computed loaders, Node/process acquisition, host/baseline/coordinator reachability, private cross-package bypasses, and forbidden reverse edges.
Audit type edges under the explicit graph policy without turning erased types into runtime loader permission.
`hermetic/public-closure.mjs` and command 11 own the persisted closure report; installed dependency bytes and export resolution remain part of fresh host remeasurement.

The existing `challengeContract/candidateCodec.ts` remains a compatibility facade for existing internal callers.
It may keep baseline-specific adapters outside the new pure codec surface.
Do not expose `encodeBaselineCandidates` through the shared pure intent codec or route training through baseline generation.
Retain candidate version `challenge-candidate-codec-v1`, `MAX_QUEUE_ACTIONS=65`, canonical action-array key bytes, derived spend, V1 error behavior, and `score-desc-key-asc-v1`.
Observation remains `challenge-observation-v1` / `challenge-observation-codec-v1`, including unknown/lit/revealed cells and dated square memory.
The generator's **four-slot** ceiling does not amend the codec's independent 65-action representability ceiling.
No V2 observation fields, paid ledger, `everLit`, economic state, or calibration state are synthesized in R2.

```ts
// Existing source signature; AuthorizedObservationV1 is the validated V1 DTO.
composeCandidatesFromObservationV1(observation: AuthorizedObservationV1): CandidateBatchV3;

type CandidateBatchV3 = {
  version: 'challenge-composition-v3';
  candidates: readonly EncodedCandidate[]; // 1..512, pass once, key-byte sorted
  diagnostics: CandidateDiagnostics;      // exact closed profile-B record below
};
```

Validate and detach the input before traversal; return detached immutable plain-object/array results.
Preserve action-array order and authored coordinates in every emitted key.
Training owns composition only; arena owns shared DTO/codec semantics; core owns native geometry/rules.
No core→arena/training or arena→training dependency is allowed.
Training `/candidates` may reach only the authorized arena subpaths, pure native helpers, and the pinned pure SHA subpath.
No unrestricted `SideContext`, full SCFEN, hidden queue, enemy bank, future trace, corpus identity, or hidden occupancy enters generation.

## 3. V3 primitive amendment — promotion and prefix reservations

Canonical family order is
`K=[classical,deploy,stimStep,spiderMine,charonMissiles,siegeMode,tacticalJump]`.
Primitive order is family, authored actor square, timing (B/F, C only for classical), target, unit, promotion.
Squares order `a1..a8,b1..b8,…,h1..h8`; deployment-unit order is **`p,n,b,r,q`** and promotion order is **`n,b,r,q`**; absent fields precede present fields.
`D(O,P)` depends only on validated V1 observation `O` and the **already appended** own prefix `P`.
Current preturn typed own actors authorize specials; earlier B arrivals/births may supply classical actors only.
Own projected C promotion never grants a new special permission.
Use native `UNIT_COST` and `specialGasCost`: total requested minerals ≤ own bank and gas ≤ own current gas.
Permit at most one C and one special per native authored-origin actor, with generated length ≤4.

| Family | Emitted domain and unchanged native constraints |
|---|---|
| classical | C with mandatory `to`, native shape, no `unit`; current own actor or supported preceding B arrival/birth. Apply the Marine promotion amendment below. |
| deploy | Current own k, B/F, `to` + unit `p,n,b,r,q`; radius-1 ring about append-time CC anchor. Exclude anchor and known CC squares; nonCC occupied targets remain crushable. |
| stimStep | Current own p, B/F, `to=marineSingleTarget(authoredFrom,side)`; no off-board intent. Authored last-rank target emits only four promotions `n,b,r,q`, otherwise omit promotion. Keep native prefix-only occupancy exceptions and F-after-C last-rank restriction. |
| spiderMine | Current own n, B/F; no `to`, `unit`, or `promotion`. Use the stored append-time mine anchor and reservations below. |
| charonMissiles | Current own b, B/F, mandatory on-board diagonal `to` from append-time native anchor; no unit/promotion, ship-presence, hidden-blocker, or hidden-occupancy filter. |
| siegeMode | Current own r, B/F; native toggle, no `to`, `unit`, or `promotion`. Earlier B toggle supplies native effective Siege constraints for C. |
| tacticalJump | Current own q, B/F, every distinct on-board `to` except known occupied; retain unknown squares. No unit/promotion. |

### 3.1 Marine classical promotion closure

**Explicit historical amendment — Executor approved NATIVE FOUR PROMOTION.** The earlier future generator contract requested five promotions `p,n,b,r,q`; that draft did not describe implemented native grammar.
The accepted generator now emits exactly **`n,b,r,q`**, excluding `p`; deployment still offers **five** units `p,n,b,r,q`.
This scoped override applies to generator promotion choices only; V1 codec representability, native grammar, and the frozen future 370-field feature registry are unchanged.
Reject a quiet drop-in `p→q` swap: it disguises the contract amendment and does not preserve distinct option identity.

For a Marine classical intent, test **authored target last rank OR potential structural after-B matching rewrite target last rank**.
Use only an earlier matching own B in `P`, its native matching/order rules, and the native structural coordinate transformation.
For stim matching, require the native same-file forward shape (one step, or start-rank double) and on-board shifted target.
For tactical-jump matching, retain native `B.to=C.to` matching and on-board shifted target.
This promotion test ignores the resolver's actual occupancy-dependent decision to perform the rewrite.
If either target is last rank, emit **only four** intents with promotion `n,b,r,q`; emit neither `p` nor a promotion-less fifth alternative.
Otherwise emit only the promotion-less intent.
Keep original authored `from` and `to`; the structural target is not the emitted coordinate or a new observed board.
Do not filter potential promotion variants by hidden occupancy or claim that the rewrite will execute.
A B appended later cannot retroactively add promotion choices, repair, reject, or regenerate an earlier C.
This amendment expands generator representability without altering engine grammar or actual rewrite/admission behavior.

### 3.2 Mine cap and anchor collisions

At each spiderMine append, reserve **current own mines + valid earlier spiderMine intents in `P`**.
If that count is **≥3**, reject the append under `pruned.mineCap`.
Reserve earlier drops regardless of whether later private combat might prevent a drop or remove a mine.
Do not infer refunds from fizzle, collision, movement, mine contact, or terminal resolution.
Each valid earlier drop retains its own anchor from the moment it was appended.
An F mine's anchor is `C.to` only when an earlier same-side, same-authored-actor C already exists in its prefix; otherwise it is authored `from`.
If the current anchor collides with a current own mine or any stored earlier-drop anchor, reject under `pruned.ownOccupancy`.
Apply guard priority first: when both cap and collision fail, count **mineCap**, not both.
Do not use hidden enemy mines as a filter.
A C appended later must not relocate, revalidate, refund, or collide-test an earlier F drop anew.

### 3.3 Native append-time anchors

For F Charon/mine and native F CC deployment rules, use an **earlier own same-actor C.to**, otherwise the authored origin.
Store each action's native append-time anchor in private traversal state, not extra candidate fields.
Never rewrite old anchors when a later action arrives.
For F stim, retain the native post-C `marineSingleTarget(C.to,side)` last-rank rejection when that C is already in the prefix.
Keep the native B chain-head and F same-actor C occupancy exceptions.
Do not retrovalidate a previous F against a C appended later.
Classical occupancy uses native B vacancy/transit/exact gasPair rules and effective B Siege; unknown cells remain uncertain.
Shared native helpers must accept authorized maps/unknown masks without full-state legality probes or fake partial SCFEN.
Actual validators/resolvers retain their actual-board checks; the promotion structural test is explicitly not a replacement occupancy oracle.

## 4. Deterministic bounded traversal — profile B unchanged

Maximum retained capacity is **`7×48+175+1 pass=512`**; attempted extensions are capped at **2048**; queues have at most **four** action slots.
Reserve pass once before traversal; it consumes one unique slot and no append work.
First action's kind owns every nonempty queue.
Active means at least one singleton passes **all authorized root append guards** against `P=[]`, including resources, mine cap, and known own/observed occupancy constraints.
A raw primitive cursor yielding its first action does not establish availability.
Probe each family's finite singleton domain until the first guard-valid action or exhaustion; record cursor pulls separately from traversal attempts.
Availability probes neither retain candidates nor enqueue continuations, perform hidden admission, or become free queue-composition work.
All subsequent lane append attempts, including invalid/duplicate/owner/quota skips, remain counted within **2048**.
Redistribute inactive family reservations to active families one slot per canonical round; shared capacity stays 175.
If no family is active, put all 511 nonpass slots in shared capacity and emit only pass after exhaustion.
Proven family exhaustion transfers unused capacity to shared; proven shared exhaustion transfers unused capacity to nonexhausted families in canonical rounds.
A work cap or full quota does not prove iterator exhaustion.

Traverse **eight lanes**, K followed by `shared-composition`, in canonical round-robin.
Each lane holds four FIFO frontiers `F[0..3]`, one empty root at depth 0, and cyclic depth cursor initially 0.
Each node stores its prefix, stored append-time anchors/reservations, and a lazy canonical-domain cursor.
Select the first nonempty frontier at/after the depth cursor modulo four; discard exhausted nodes without restarting their domain.
One logical lane visit performs exactly **one append attempt**, increments work before guards, advances the domain cursor, and sets depth cursor to `(chosenDepth+1)%4`.
The parent stays FIFO-front until its domain exhausts.
A guard-valid queue of length <4 enqueues a continuation even when duplicate, wrong-owner, or quota-full retention skips it.
Invalid extensions enqueue no child; no fifth action is attempted.
Shared retention requires length ≥2; family retention permits length 1..4 with matching owner.
Global exact key-byte deduplication precedes retained-quota consumption; an emitted queue spends one funding pool only.
Hash canonical UTF-8 action-key bytes with synchronous SHA-256; compare exact bytes on hash collision.
SHA digest is a lookup accelerator, not a replacement for canonical key or equality.
Final candidates sort ascending by canonical key bytes, not hash, score, or arrival order.
Every repeated lane append counts, including duplicate, pruned, owner-skipped, and quota-skipped work.
Bound state to eight roots plus at most 2048 continuation nodes and finite authorized primitive cursors.
Stop before attempt 2049, at 512 retained uniques, or after every lane proves exhausted.
This is bounded proposal generation, not exhaustive actual legality or winning coverage.
Exactly one selected whole queue reaches private admission; no rescue candidate, retry, or prefix salvage follows rejection.

## 5. Exact closed diagnostics B — no schema amendment

All counters are nonnegative safe integers; reject extra/missing keys and noncanonical/sparse arrays.
The following is the existing profile-B schema, not a free-form metrics bag:

```text
CandidateDiagnostics = {
  profile: "B",
  attemptedExtensions: Int[0,2048], uniqueIncludingPass: Int[1,512],
  retainedNonPass: Int[0,511],
  duplicates: Int[0,2048], ownerSkipped: Int[0,2048], quotaSkipped: Int[0,2048],
  pruned: { actor, shape, timing, resources, mineCap, ownOccupancy: Int[0,2048] },
  activeFamilies: Kind[0..7], exhaustedLanes: Lane[0..8],
  pools: PoolRecord[8], retainedByOwner: KindCounts,
  retainedByLength: { "1", "2", "3", "4": Int[0,511] },
  attemptCapReached: boolean, capacityCapReached: boolean,
  stopReason: "capacity-cap" | "attempt-cap" | "exhausted"
}
Lane = Kind | "shared-composition"
PoolRecord = {
  id: Lane, initialCapacity: Int[0,511], finalCapacity: Int[0,511],
  retained: Int[0,511], exhausted: boolean
}
KindCounts = exactly the seven K keys, each Int[0,511]
```

Order families/lanes/pools canonically; `activeFamilies`/`exhaustedLanes` are unique.
Initial capacities follow initial redistribution; final capacities include only proven-exhaustion transfers.
Funding counts and semantic owner counts remain distinct.
Classify each attempt once under guard priority `actor,shape,timing,resources,mineCap,ownOccupancy`, then owner/short-shared, retained-key duplicate, quota, or retainedNonPass.
Malformed side/fields/codec/version abort the generator contract rather than adding a seventh pruning reason.
Map actor-type failures→actor; geometry/anchor/mode/promotion→shape; phase/C-count/special-origin→timing; requested spend→resources; mine reservation cap→mineCap; known forbidden occupancy/own mine-anchor collision→ownOccupancy.

```text
attemptedExtensions = sum(pruned) + ownerSkipped + duplicates + quotaSkipped + retainedNonPass
uniqueIncludingPass = 1 + retainedNonPass
                    = 1 + sum(retainedByOwner)
                    = 1 + sum(pools.retained)
                    = 1 + sum(retainedByLength)
sum(initialCapacity) = sum(finalCapacity) = 511
each pool.retained <= pool.finalCapacity
attemptCapReached  <=> attemptedExtensions = 2048
capacityCapReached <=> uniqueIncludingPass = 512
```

Capacity takes stopReason precedence if both caps coincide.
`exhausted` requires all lanes proven exhausted with neither stopping cap.
Diagnostics contain no hidden admission result and do not become features.

## 6. Version amendment and package-graph closure

| Surface | Recovered/historical version | Approved R2 target |
|---|---|---|
| Source inventory | `challenge-source-inventory-v1`, three partitions | **`challenge-source-inventory-v2`**, explicit package/export graph and public closure |
| Execution pins | `challenge-execution-pins-v2` | **`challenge-execution-pins-v3`**, binds inventory v2 and R2 public surfaces/generator/SHA closure |
| Verification envelope | `hermetic-verification-v2`, eight commands | **`hermetic-verification-v3`**, exactly eleven ordered commands |
| Composition | Frozen future `challenge-composition-v2` | **`challenge-composition-v3`** with V1 bridge and §3 amendment |
| Observation/intent codec | V1 | **Unchanged V1** |
| Broader history/features/optimizer | Frozen future contracts | **Pending**, not implemented by this bridge |

Version numbers belong to their own contracts; inventory v2 does not mean observation v2 or features v2.
Implement a real package/export graph, not one permissive exception from old execution into all contracts.
Inventory v2 audits declared entries, static import/reexport edges (including type edges), unique file ownership, export resolution, installed external subpaths, and explicit forbidden edges.
Separate core-rules, arena-authorized, arena-host, training-model, training-coordinator, and verification-tooling ownership; R2 creates no trainer coordinator entrypoint.
Retain supported host-only lexical loader seams and fail closed on unsupported loaders, deep imports, unknown executable extensions, and alias escapes.
Public authorized/model closures allow pure static ESM dependencies only, without CommonJS/dynamic-loader/Node/global-process escapes; reject literal runtime dynamic imports as well as computed ones.
Include every selected public entrypoint and private challenge/worker/verification entrypoint in graph roots.
Capture training source/tests/configs/metadata, native helper changes, scripts, lockfile, installed dependencies, offline store, and tool/control bytes.
Bind actual `@noble/hashes` 2.4.0 `sha2.js` transitive installed closure and export resolution; package README claims do not replace measured dependency bytes.
Keep content-derived hashes; no mtime pins or invented counts/digests.
Teach migration/validator/importer/tests the new closed schemas explicitly; do not accept historical v2 envelopes as fresh R2 verification.
Preserve old fixture bytes and original-baseline pins; pin new execution separately.

## 7. Full eleven-command verification v3 — source manifest, execution pending

**IMPLEMENTED manifest, not fresh run or passing.** `packages/starchess-arena/hermetic/verification-plan.mjs` owns exact vectors; build must freeze its expanded input lists before execution.
For the vectors below define `A=/app/packages/starchess-arena`, `P=/app/packages`, `O=/app/_spec/evidence/ml-adjutant-r2-refresh`, and `T=/app/packages/starchess-training`.
Expand these symbols to absolute paths; they are notation, not shell variables or commands executed by this spec pass.
Use the new R2 runtime/host namespace outside captured source, never over restored R0/Phase 1/Phase 2 history.

| # | Executable / cwd | Exact source argv or deterministic expansion |
|---|---|---|
| 1 | `A/node_modules/.bin/tsx` / `/app` | `[A/src/cli/challenge.ts,--suite,all,--rerun,--out,O/baseline-report.json]` |
| 2 | `A/node_modules/.bin/tsx` / `/app` | `[/app/scripts/challenge-contract-evidence.ts]` |
| 3 | `P/starchess-core/node_modules/.bin/tsc` / `P/starchess-core` | `[-p,tsconfig.json,--noEmit]` |
| 4 | `A/node_modules/.bin/tsc` / `A` | `[-p,tsconfig.json,--noEmit]` |
| 5 | `T/node_modules/.bin/tsc` / `T` | `[-p,tsconfig.json,--noEmit]` |
| 6 | `A/node_modules/.bin/tsc` / `A` | `[--noEmit,--allowImportingTsExtensions,--target,ES2022,--module,ESNext,--moduleResolution,Bundler,--strict,--skipLibCheck,...strictInputs]` |
| 7 | Core package-bin `vitest` / core cwd | `vitestArgs(starchess-core)` |
| 8 | Arena package-bin `vitest` / arena cwd | `vitestArgs(starchess-arena)` |
| 9 | Training package-bin `vitest` / training cwd | `vitestArgs(starchess-training)` |
| 10 | `/usr/local/bin/node` / `/app` | `[--test,A/hermetic/evidence-bundle.test.mjs,A/hermetic/image-measurement.test.mjs,A/hermetic/tar.test.mjs]` |
| 11 | `/usr/local/bin/node` / `/app` | `[/app/scripts/check-public-closure.mjs]`; exact stdout becomes `O/public-closure-report.json`, version `public-closure-v1` |

`vitestArgs(name)=[run,--config,/tmp/<name>.vitest.mts,--configLoader,native,--maxWorkers,2,--reporter=default,--reporter=json,--outputFile,O/vitest-<name>.json]`.
Each temporary config preserves the package's test config and routes cache to `/tmp`; do not remove assertions, tests, or exclusions to manufacture success.
`strictInputs` is the frozen, sorted, unique absolute list of **all core and arena `src/__tests__/**/*.ts` and `*.tsx` inputs**, including fixtures, followed by both `/app/scripts/challenge-contract-evidence.ts` and `/app/scripts/challenge-validate-baseline.ts`.
Training has its separate full package typecheck and test commands; do not substitute them for the direct strict core/arena test check.
Record the expanded list, not a wildcard or loose command predicate, and reject omitted/substituted inputs.
Command 11 audits approved export resolution and the static closure against the v2 package graph; persist positive export/closure checks and forbidden-edge rejection results.
It must check codec/observation compatibility, training `/candidates` only, exact SHA subpath/version, and absence of host/core-reverse/training-reverse edges.

The earlier proposal put infra tests into command 10; the current v3 manifest instead runs exactly the three Node files above and requires a **separate host/daemon infra run**.
Run `HERMETIC_DEPENDENCY_IMAGE=sha256:<fresh-dependency-image> node --test packages/starchess-arena/hermetic/infra.test.mjs` on the trusted host.
Docker-dependent probes cannot pass through skips, unavailable-daemon fallback, or a nested-container self-claim.
Bind their fresh logs/image identity independently; never add a Docker socket, capabilities, or network to policy execution.
Join actual host infrastructure results to v3 assurance; the eleven commands alone do not close this gate.

### 7.1 Mandatory independent actual Docker infrastructure envelope

`scripts/challenge-infrastructure-evidence.mjs` captures **`r2-infrastructure-verification-v1`** on the trusted host against the immutable **captured dependency image**, not the final source-image ID.
`scripts/challenge-import-evidence.mjs` requires **`--infrastructure`**; absence is not optional and a policy-container self-claim is not a substitute.
Bind the exact host executable/cwd/argv and `HERMETIC_DEPENDENCY_IMAGE`, zero exit/no signal, nontruncated stdout/stderr bytes/hashes, TAP recount, host Node/script/test identities, daemon image/container inspections, probe report, all probe command logs, and actual probe Vitest assertion recount.
Independently remeasure dependency-image installed/store/tool/control bytes and join them to `build.frozenDependency`, current capture controls, and the final source-image dependency measurements before publication.
Publish the validated envelope as **`host-infrastructure.json`**, its bound artifacts under **`host-infrastructure/`**, and the infrastructure reference in **`r2-image-assurance-v1`**.
No daemon-unavailable skip, synthetic TAP success, old R0 log, nested-container claim, or eleven-command-only run closes this gate.

**Current source mismatch — repair pending:** whole-file inspection confirms **six** `infra.test.mjs` tests, in the exact order below; five are static and the final test performs actual Docker execution.
The capture script still declares `INFRASTRUCTURE_TESTS = 5` and checks only the Docker title, not the complete title vector.
The lead owns the source repair to require **all six titles in order**, exact numbering `1..6`, TAP plan `1..6`, `tests=pass=6`, `suites=0`, and `fail=cancelled=skipped=todo=0`; reject omissions, additions, renames, reordering and duplicate titles.
The six-test contract supersedes neither historical R0 **5/5** records nor their unchanged bytes.

| Order | Kind | Exact test title |
|---|---|---|
| 1 | Static | `Dockerfile pins the official platform and isolates offline installation from acquisition` |
| 2 | Static | `context keeps the original lock and workspace links without root dependencies or host stores` |
| 3 | Static | `current verification freezes eleven exact commands and the complete strict source invoice` |
| 4 | Static | `runtime capture preserves JSONC config closure, tests, fixtures, and rejects escaping paths or ancestor symlinks` |
| 5 | Static | `CLI rejects mount injection and public output parents and preserves bounded success/failure logs` |
| 6 | Actual Docker | `Docker enforces policy, fresh temporary inventory, and logged offline TS/Vitest` |

Fresh image creation, infrastructure capture, current evidence, acceptance and R2 closure remain **PENDING**.
No learned acceptance or training is authorized or claimed.

### 7.2 Frozen execution and closure obligations

Bind all eleven executable/cwd/full-argv records, exits/signals, log bytes and hashes, exact test-report paths, and actual assertion recounts.
Require fresh **54 executions + 54 semantic reruns** of unchanged `baseline-v1` and **semantic parity with the original pinned 54-case baseline**.
Do not replace that baseline with V3 candidates or normalize away gameplay differences to make extraction pass.
The fresh native helper and codec extraction must preserve actual original baseline behavior as well as V1 key/spend/error/byte semantics.
Report generated membership/omissions separately from codec representability and benchmark wins.
Carry every loss/rejection/timeout in its original denominator; no passing R2 counts exist yet.
Perform independent unstarted-container source/dependency/tool/Node-byte measurement, pre/post manifest equality, new validated marker publication, and adversarial/security review before R2 closure.
No fresh image IDs, artifact hashes, passing test totals, or reviewer verdicts are assigned by this document.
Required v3 artifacts include baseline, contract, original coverage, pin migration, `r2-composition-report.json`, `public-closure-report.json`, and all three Vitest JSON reports.
The baseline validator consumes exactly `[baseline,original,originalVerification,migration,coverage,contract,r2report,frozenRoot]`.

## 8. Required persisted R2 checks and build handoff

| Verification concern | Persisted source checks; fresh full execution pending |
|---|---|
| V1 compatibility | Old/new observation bytes, candidate keys/spend/errors/comparator and codec 65 ceiling; bounded depth-16/8192-visit/1-MiB UTF-8 inspection, memoized shared-subtree height checks, cycles/accessors rejection, frozen ACTION_KINDS and malformed schemas. |
| Marine promotion | Authored-last OR potential rewritten-last, both colors, exact n/b/r/q, no p or unpromoted alternative, native matching/off-board exceptions, unknown/occupied paired worlds, original coordinates, late-B nonretroactivity. |
| Mine reservations | Current+prior cap boundaries 0..3, current/current-prior/prior-prior anchor collisions, F with earlier same-actor C, F before later C, unrelated C, no hidden enemy-mine filter/refunds, guard priority. |
| Native anchors/phase | B heads/vacancy/transit/exact gasPair, B toggle/Siege, deployment crush/CC exclusions, F Charon and stim constraints, preturn special actor type and all seven families. |
| Traversal/diagnostics | Root-guard feasible family availability with finite separately metered probes; eight-lane RR, cyclic depth/FIFO laziness, continuation after valid skips, counted duplicates/pruning/owner/quota, exact six guard keys, transfers only on proven exhaustion, pass once, 512/2048/four-slot caps and closed count identities. |
| Identity/privacy | Exact bytes despite forced hash collision, SHA known vectors, stable sorted results, hidden-world noninterference, no full-state admission probes or retries. |
| Coverage/performance | Exhaustive small authorized fixture domains and actual membership/omissions; capped worst-case work/state/runtime under existing policy deadlines. No asserted exhaustive full-state legality. |
| Closure/assurance | Three-package full suites/typechecks, strict direct inputs + two scripts, exact export maps, static-only closures including literal dynamic-import rejection, mandatory independent six-title actual Docker envelope tied to the captured dependency image, v2 graph/v3 pin rejection fixtures, fresh image/source measurement/publication, original 54 parity and 54+54 reruns. |

Build owns all package/source/test/config/lock/CI and verifier changes above; this spec pass changes none.
The canonical concern link is `_spec/packages/starchess-training/candidate-generation.puml`; the lead owns source-side `SPEC:` replacements and preserves unrelated pointers.
Spec-side coverage includes current native/arena owners, actual training source/tests/metadata, graph controls, and diagnostics.
No captured source/config/README inside packages or evidence bytes are edited in this spec pass.
No source prose was migrated or removal requested in this pass.
No existing `specNotesEnforced`/`TestSpecNotesFitTheBox` implementation was found in the targeted source scan; if build supplies that ratchet, its source edit belongs to build.
`_spec/template.txt` is absent; Executor should fetch and commit the standard template once from `https://raw.githubusercontent.com/proveo-ca/spec/refs/heads/main/_spec/template.txt`.
This pass uses the existing repo identity theme and performs no URL fetch.
No shell or renderer tool is available to spec-keeper; theme/checkonly validation is not claimed.
Manual note-body measurement (markup stripped; two sentences each) gives:

| Diagram anchor | Words / syllables / sentences | Flesch–Kincaid grade |
|---|---|---|
| `candidate-generation.puml` · note bottom of OBS | 31 / 54 / 2 | **11.0** |
| `candidate-generation.puml` · note bottom of DTO | 30 / 56 / 2 | **12.3** |
| `candidate-generation.puml` · note bottom of PREFIX | 31 / 56 / 2 | **11.8** |
| `candidate-generation.puml` · note right of LANES | 31 / 56 / 2 | **11.8** |
| `candidate-generation.puml` · note bottom of CLOSURE | 29 / 51 / 2 | **10.8** |
| `candidate-generation.puml` · note bottom of INFRA | 29 / 52 / 2 | **11.2** |

All six reasoning notes have two sentences in five lines with at most 50 columns; structural label notes have two to four lines within the same width limit.

### 8.1 Promotion illustrations and bounded omissions

`scripts/r2-composition-evidence.ts` defines both-seat promotion fixtures with **four** reference queues, `n,b,r,q`.
Its report separates primitive membership from retained membership and reports actual omitted primitive keys, per-owner retention, quotas, work/cap histograms, and guard diagnostics.
`r2CompositionEvidence.test.ts` currently expects all four primitive promotion references but zero retained references at the 2048 attempt cap for each fixture seat.
These are authored illustration/assertion expectations, not passing proof or a claim that a fresh report was generated in this pass.
Generate and independently remeasure `r2-composition-report-v1` during the new full verification cycle; record any actual bounded omissions without concealing them.
Existing five-value codec representability loops are not generator promotion claims and do not authorize `p` generation.

### 8.2 Prior pointer audit and current build-only navigation/CI/rendering handoff

Canonical source concern token: **`_spec/packages/starchess-training/candidate-generation.puml`**.
Native/training pointers already using this token need no edit.
The prior pass recorded the token replacements below; this table is historical handoff, not a claim that all citations remain unresolved in the current tree.
Build revalidates each before any replacement and preserves every other `SPEC:` token and surrounding source.

| Source file | Token to replace |
|---|---|
| `packages/starchess-arena/hermetic/verification-plan.mjs` | `_spec/training/candidate-generation.puml` |
| `packages/starchess-arena/hermetic/workspace-policy.mjs` | `_spec/training/candidate-generation.puml` |
| `packages/starchess-arena/src/__tests__/r2CompositionEvidence.test.ts` | `_spec/training/candidate-generation.puml` |
| `scripts/r2-composition-evidence.ts` | `_spec/training/candidate-generation.puml` |
| `packages/starchess-arena/src/authorized/v1/canonical.ts` | `_spec/packages/starchess-arena/newgeneration.puml` |
| `packages/starchess-arena/src/authorized/v1/observationCodec.ts` | `_spec/packages/starchess-arena/newgeneration.puml` |
| `packages/starchess-arena/src/authorized/v1/squares.ts` | `_spec/packages/starchess-arena/newgeneration.puml` |
| `packages/starchess-arena/src/authorized/v1/types.ts` | `_spec/packages/starchess-arena/newgeneration.puml` |
| `packages/starchess-arena/src/challengeContract/candidateWire.ts` | `_spec/packages/starchess-arena/newgeneration.puml` |
| `packages/starchess-arena/src/challengeContract/validation.ts` | `_spec/packages/starchess-arena/newgeneration.puml` |
| `packages/starchess-arena/src/intent-codec-v1.ts` | `_spec/packages/starchess-arena/newgeneration.puml` |
| `packages/starchess-arena/src/observations.ts` | `_spec/packages/starchess-arena/newgeneration.puml` |
| `packages/starchess-arena/src/__tests__/intentCodecV1Bridge.test.ts` | `_spec/packages/starchess-arena/newgeneration.puml` |
| `packages/starchess-arena/src/__tests__/observationV1Bridge.test.ts` | `_spec/packages/starchess-arena/newgeneration.puml` |
| `packages/starchess-arena/src/__tests__/publicV1BridgeIsolation.test.ts` | `_spec/packages/starchess-arena/newgeneration.puml` |

The prior pass confirmed **15** citations by reading their whole source files; this pass observes canonical replacements in the public wrappers and validation owner it read.
The index retains the earlier unresolved groups pending a whole-file reconciliation of every recorded citing file; do not treat them as freshly confirmed live pointers.
No stub is created for `newgeneration.puml`.
The index's pre-existing `turn-input-sequence.puml` unresolved row remains explicit triage; both that spec and its recorded `marineGasArm.ts` citing path are absent in this tree, so this pass does not claim a live source pointer there.
The existing empty-coverage `_spec/apps/starchess/core/index.puml` remains unchanged human triage.

Root `README.md` belongs to build, not spec-keeper; add current navigation to this amendment and both owning diagrams without changing unrelated README prose.
Root `PLAN.md` now links this amendment and the canonical diagram, marks R2 WIP / verification PENDING, and labels its retained R0 proof block historical rather than current.
The package hermetic README is also lead-only captured source; replace its stale 19-error command-6 blocker with the reported fixes/two resolved casts and the pending new full run, not a passing claim.
Root CI must include the training full suite/typecheck and `node scripts/check-public-closure.mjs`; no CI edit occurs here.

Lead/build validation commands, from repository root; **not executed by spec-keeper**:

```sh
plantuml -checkonly _spec/packages/starchess-training/candidate-generation.puml _spec/packages/starchess-arena/ml-adjutant-policy-contracts.puml
plantuml -tsvg _spec/packages/starchess-training/candidate-generation.puml _spec/packages/starchess-arena/ml-adjutant-policy-contracts.puml
```

Renderer availability is unverified; these commands specify both diagrams without claiming installation or render success.
No source note-ratchet implementation was found; if the lead adds `specNotesEnforced`, include the candidate-generation diagram edited here and the policy-contracts diagram edited in the prior pass.
This pass splits the oversized DTO note, adds shared-subtree, static-closure and independent-infrastructure reasoning notes, preserves the existing reasoning, and manually checks the candidate diagram's 2–5-line/50-column note boxes.
It edits no source prose, publishes no evidence, and claims no renderer/test execution.

## 9. Unchanged future readiness gates

Horizon remains **H=1**; no learned policy, SGD, trained weights, or training evidence exists.
R3 authorized ledger and R4 features/calibrated turn-aware belief remain future work.
Public turn-0 prior is **4 surviving deployed combat replacement + 3 banked minerals = 7**, excluding CC; opening paid basis is zero.
Keep deployed/banked components separate and use native actual income-grant boundaries, not turn/observation counters.
Belief architecture/calibration data/objective/thresholds and their versioned feature amendment remain pending.
R2 V3 generation does not silently amend the prior 370-field registry or implement that belief.
R1 economic amendment plus R3–R5 readiness must close before explicit R6 approval; R7 precedes R8 learned acceptance.
