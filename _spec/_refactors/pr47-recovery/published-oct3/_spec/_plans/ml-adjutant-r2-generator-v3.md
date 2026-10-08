# ML Adjutant — accepted R2 generator V3 amendment

Status: **ACCEPTED; R2 IN PROGRESS, NOT CLOSED. Full fresh R2 verification PENDING.**
Authority: Executor approved actual R2 implementation, the consolidated explicit V1 bridge,
FULL verification, pinned SHA dependency, versioned generator amendment, and PureV1WireSubpath.
Architect consultation: `sefdd2b57bffezmRpWceSr1DLWJ`, updated accepted amendment as reported by Executor.
This document records those selections; it introduces no new choice or implementation permission for R3–R8.
This spec-only pass edits no source, tests, CI, package README, lockfile, evidence, corpus, or Orrery files.
**R2 final passed counts: NONE recorded.** No fresh image, digest, marker, runtime result, or READY verdict is claimed.
Weights/model: **NONE**. Keep **H=1**; training remains unauthorized.

Owning diagram: [candidate-generation.puml](../packages/starchess-training/candidate-generation.puml).
Historical design: [R1 exact contracts](ml-adjutant-r1-contracts.md), especially §§3–4 and §8.
Roadmap: [PLAN-ml-adjutant.md](PLAN-ml-adjutant.md).
Historical assurance: [execution revisions](ml-adjutant-execution-revisions.md).

## 1. Amendment scope and precedence

`challenge-composition-v3` supersedes `challenge-composition-v2` **only for this R2 bridge generator**.
Do not retroactively rewrite the frozen V2 domain, its report versions, or historical evidence.
V3 changes two generator-domain rules: structural potential promotion and prefix mine reservation.
It also establishes the explicit V1 public bridge and fresh three-package assurance graph.
It changes no native gameplay, admission, resolver, error, price, or wire-format rule.
R1 §8's other primitive constraints, quota B, traversal, accounting, canonical identity, and closure remain binding.
Future history/economic/feature contracts retain their prior design status and separate amendment gates.

R0 remains historically **CLOSED**, with **A01–A15 CLOSED (7 HIGH + 8 MEDIUM)**.
Captured-source changes do not automatically reopen those findings.
They do require fresh R2 freeze/verification/publication; R0's old image cannot authorize the new graph.
Preserve all R0/Phase 1/Phase 2/pre-rename evidence bytes and pins, including closure JSON.

## 2. Public imports and strict V1 bridge

Keep `packages/starchess-training`, private `@chess-coach/starchess-training`, version `0.0.1`.
The implemented R2 public target is `/candidates`; no training root barrel or wildcard export is approved.

| Public target | R2 contract |
|---|---|
| `@chess-coach/starchess-arena/observations` | Strict existing `AuthorizedObservation` V1 DTO validation and codec bridge; preserve `challenge-observation-v1` and `challenge-observation-codec-v1`. No history/ledger fabrication. |
| `@chess-coach/starchess-arena/intent-codec-v1` | Narrow shared pure wire subpath: V1 action validation, canonical candidate key, requested spend, encoding/decoding, and necessary V1 types/constants. Preserve old bytes, limits and errors. |
| `@chess-coach/starchess-training/candidates` | `composeCandidatesFromObservationV1` and public `decodeCandidate`; public decoding delegates to the shared V1 decoder. |

```ts
composeCandidatesFromObservationV1(observation: AuthorizedObservation): CandidateBatchV3;
decodeCandidate(value: unknown, side: Side): EncodedCandidate; // delegates to V1 wire
```

`CandidateBatchV3` has the R1 batch fields and closed diagnostics schema, with
`version: 'challenge-composition-v3'`; candidates remain `challenge-candidate-codec-v1`.
Validate the V1 observation first; return detached immutable records and key-byte-sorted candidates with pass once.
Keep `MAX_QUEUE_ACTIONS=65` and `score-desc-key-asc-v1`; generation remains capped at four actions.
Retain the V1 observation codec's existing string interface; do not silently replace it with V2 byte signatures.

**RESERVED, UNIMPLEMENTED:** `composeCandidates(historyV2)` and arena `/events`, training `/features` and `/artifacts`.
Do not export throwing placeholders, empty stubs, fake economic fields, fake `everLit`, or automatic V1→historyV2 adapters.
The reserved history signature in R1 is not the R2 bridge signature.
The previous 370-field feature registry stays frozen **future V2**, not an actual R2 feature encoder.
Current V1 encodings represent all seven kinds; representability is not generated membership or winning coverage.

### PureV1WireSubpath boundary

Extract shared wire behavior rather than copying it into training.
The old arena `challengeContract/candidateCodec.ts` must delegate its wire functions to that same implementation.
Its `encodeBaselineCandidates`/`baselineProposals` integration remains host-private outside the pure subpath closure.
Split pure canonicalization, strict validation, DTOs, and square ordering where their current owners import host projection/config.
Do not reexport the arena root, unrestricted `SideContext`, baseline proposals/scores, observation producer, corpus loader,
source inventory, supervisor, filesystem, process, Node crypto, or private admission through either public bridge.
Audit both runtime and type import/reexport edges; a type-only host import is not a permitted public escape.
Native pure helpers may consume authorized maps plus unknown masks, not a fabricated partial SCFEN.
Exactly one selected whole queue reaches private host admission; no probes, admission retries, salvage, or rescue.

## 3. V3 potential promotion — exactly five choices

For each appended classical Marine intent, determine its actor at append time using current authorized own actors
or native-supported **earlier** B arrivals/births.
Let `lastRank(w)=8`, `lastRank(b)=1`.
Promotion is in the domain iff the append-time actor is a Marine and either:

1. the authored `to` is on that side's last rank; or
2. `classicalRewriteCoordinatesAfterB(earlierPrefixB, authoredC)` returns structural coordinates whose `to` is on that last rank.

Emit **exactly `[p,n,b,r,q]`**, in that order, for a promotion-domain intent.
There is **no sixth omitted/none choice** when either predicate holds.
Otherwise omit promotion, rather than inventing a choice for an unrelated nonpromotion intent.
Retain authored `from`/`to` in the action, key, and wire encoding; structural coordinates identify potential promotion only.
The structural rewrite uses the first matching earlier same-side B relocation and native shape/on-board rules.
Do not filter the potential-promotion predicate by occupancy, actor survival, opponent interference, or a predicted successful B arrival.
Other authorized shape/timing/resource/occupancy guards still classify the append normally.
Do not retroactively grant promotion from a B appended after C.
StimStep's authored last-rank domain likewise uses the five promotion values; preserve R1's F-stim timing refusal.
An earlier promotion does not grant a preturn actor permission for a later special of its transformed type.
Native admission may reject a generated choice; V3 does not widen native promotion permission to make the proposal succeed.

Required witnesses include both colors, direct last rank, B-shifted last rank with unchanged authored coordinates,
structurally off-board/ineligible rewrites, concealed/known interference, and C-before-B without retroactive promotion.
Test the explicit `p` choice and the absence of an omitted sixth alternative at the domain level.
Bounded retention may omit domain members; report domain coverage and retained membership separately.

## 4. V3 prefix mine reservations

Maintain prefix-local reservations for **all valid earlier own spiderMine intents**, independent of retention/funding outcome.
For a proposed mine append, compute its anchor from the prefix that already exists:
`F` uses only an earlier same-actor C target; `B`, or `F` without that C, uses the authored origin.
Store the earlier intent's anchor at its own append time; later C nodes cannot move that reservation.

```text
reservedCount = currentOwnMineCount + validEarlierMineIntentCount
reservedCount >= 3                         => mineCap
anchor in currentOwnMines or reservedAnchors => ownOccupancy
```

Check actor → shape → timing → resources → mineCap → ownOccupancy, then retention classification.
Thus `mineCap` wins when both count and anchor collide; anchor collision remains lower-priority `ownOccupancy`.
After a valid append, add exactly one immutable count/anchor reservation to its continuation prefix.
Copies for separate prefixes/lanes must not share mutable reservation state.
Do not reserve an invalid intent, count a child twice, or remove a valid reservation because the queue was dedup/owner/quota skipped.
Do not refund capacity/anchors for speculative fizzles, anticipated actor death, or hidden enemy-mine removal.
Current own mine inventory remains the authorized boundary inventory throughout composition.
This is conservative generator bookkeeping, not a native future-mine simulation or changed native cap.

Required witnesses include current counts 0..3, multiple distinct actors, same-anchor collisions, count+collision priority,
F-after-same-actor-C, F-before-C immutable anchor, unrelated C, speculative fizzle, hidden removal, and branch isolation.

## 5. Frozen quota B, traversal, diagnostics, and identity

Inherit R1 §8's exact closure; do not substitute beam search, eager Cartesian products, or a new diagnostic schema.

- `K=[classical,deploy,stimStep,spiderMine,charonMissiles,siegeMode,tacticalJump]`.
- First action's kind owns every nonempty queue. Each family starts at 48, shared composition at 175, pass at 1: `7×48+175+1=512`.
- Redistribute inactive family capacity to active families in canonical round-robin. Shared remains 175 initially; with no active family all 511 non-pass slots sit in shared.
- Only proven iterator exhaustion transfers unused capacity. Work/cap termination never proves exhaustion.
- Traverse eight lanes in canonical round-robin. Each lane has four cyclic FIFO depth frontiers and its own persistent depth cursor.
- Each logical visit performs one append attempt; increment before validation. Stop before attempt 2049, at 512 uniques, or proven exhaustion.
- Preserve lazy intent cursors and FIFO parent positions. A valid length<4 prefix always enqueues its continuation, even after owner/duplicate/quota skips.
- Invalid appends produce no continuation. One C, one special per native authored origin, native costs and authorized budgets remain binding.
- Classify once in the fixed guard priority, then owner/short-shared skip, retained-key duplicate, quota skip, or retained output.
- Reserve pass before traversal; it consumes no append work. Global dedup consumes one funding pool per retained queue.
- Hash canonical V1 action-array UTF-8 bytes with SHA-256; compare the raw bytes on hash collision. Output order compares key bytes, not digests.
- Preserve canonical square/field/unit/promotion order, exact `CandidateDiagnostics` keys, pool ordering and stop precedence from R1 §8.

```text
attemptedExtensions = sum(pruned) + ownerSkipped + duplicates + quotaSkipped + retainedNonPass
uniqueIncludingPass = 1 + retainedNonPass
                    = 1 + sum(retainedByOwner)
                    = 1 + sum(pools.retained)
                    = 1 + sum(retainedByLength)
sum(initialCapacity) = sum(finalCapacity) = 511
```

Capacity has stop-reason precedence over attempt cap when both are reached.
The generator is deterministic; it uses no RNG stream and receives no hidden host legality results.

## 6. Pinned synchronous SHA-256 dependency

Select **exact `@noble/hashes: '2.4.0'`**, not `latest`, `^`, or `~`.
Use `import { sha256 } from '@noble/hashes/sha2.js'` over `Uint8Array`; do not use asynchronous WebCrypto or Node crypto in the model closure.
Metadata/README/code/license read in this docs pass confirm MIT, zero runtime dependencies, ESM, the `sha2.js` export,
and Node `>=20.19.0`; the pinned Node `22.23.2` satisfies that declared engine requirement.
This checks metadata compatibility, not a completed install, runtime test, signature verification, or supply-chain audit.

Official registry artifact integrity:

```text
sha512-X5XaVWZIBCT7HHZGm5I7ZQXDwLG+bGXuSrMQAW+7Zvl87h1kmc1ZB1VSRJcpUfoUrGQp4Fkoxm5kZ+Ms+aW+eA==
```

Build must persist the exact lockfile resolution/integrity and capture the acquired package, installed tree and offline store later.
Do not invent a tarball SHA-256, installed-tree digest, or new image digest here.
The tagged README attributes the independent Cure53 audit to **v1.0.0, January 2022**.
It does **not** establish that v2.4.0 has an independent third-party security audit.

Verified references:
- <https://registry.npmjs.org/@noble/hashes/2.4.0>
- <https://raw.githubusercontent.com/paulmillr/noble-hashes/2.4.0/README.md>
- <https://raw.githubusercontent.com/paulmillr/noble-hashes/2.4.0/src/sha2.ts>
- <https://raw.githubusercontent.com/paulmillr/noble-hashes/2.4.0/LICENSE>

## 7. Source ownership and current landing boundary

The following maps required source/test owners, not proof that every target exists or has passed.
Missing planned targets stay **PENDING**; reconcile exact new module names/coverage when build lands them.

| Owner / source paths | Required contract / verification |
|---|---|
| Core `src/rules/planning-intents.ts`, `src/rules/planning-order.ts`, `src/index.ts` | Shared pure `PlanningKnowledge`, `classicalActorAt`, `appendTimeSpecialAnchor`, `knownAppendFailure`, `classicalRewriteCoordinatesAfterB`; preserve private native rules/results/errors. |
| Core `src/rules/specials/adjacent.ts`, `mechaCharon.ts`; `src/board/moves.ts`, `siege.ts` | Map-based spawn/aim, move shape, B-effective siege and vacancy helpers; no host/model dependencies. |
| Core `src/rules/validation.ts`, `src/resolve/submit-turn.ts` | Native extraction compatibility and unchanged admission/resolution. |
| Core `src/__tests__/planningIntents.test.ts`, `planningOrder.test.ts` | Native/map parity, immutable inputs, soft-admission distinctions, refusal codes/messages, structural versus actual rewrite. |
| Arena `src/observations.ts`, `src/intent-codec-v1.ts`, `src/challengeContract/**` | Planned bridge entry targets and pure shared V1 extraction; old codec delegates without baseline leakage. |
| Arena `src/__tests__/challenge*.test.ts` | Persist V1 byte/error regression, export/closure negatives, source-inventory/pin/import validation and unchanged baseline parity. |
| Training `src/candidates.ts`, `src/candidates/**`, `src/__tests__/*.test.ts` | Planned `/candidates` entry and private generator modules; persist primitive-domain, promotion, reservation, traversal/counters, digest collision, noninterference and worst-case tests. |
| Arena `src/challenge/sourceInventory.ts`, `evidence.ts`, `pinMigration.ts`; root `scripts/challenge-*.ts`, `challenge-import-evidence.mjs` | Deliberate new graph/version support and independent validation, not blanket partition exemptions. |
| Arena `hermetic/**`; three package manifests/configs; root lockfile | Full acquisition/capture/installed-store context and exact command/output binding for new graph. |

Read-confirmed at this pass: the core planning helpers and their two test files exist.
Four whole-file-confirmed `SPEC:` citations target the new diagram: both planning modules and both planning test files.
The training package is absent in this read; arena package exports currently expose only its root.
The read helper still permits promotion values `[q,r,b,n]` and counts current mines only.
Those are intermediate pre-amendment source facts, **not** the V3 five-choice/reservation implementation.
Keep native permission separate from V3 proposal-domain changes when completing the helper API.
No intermediate core-only pass count qualifies as full R2 verification; this document records none.

## 8. Three-package source graph and versioned assurance

Acquire, capture, and verify **core + arena + training**, including package metadata/configs/tests, lockfile,
tool bytes, each package's installed dependencies, and the offline pnpm store.
Keep six source partitions: `core-rules`, `arena-authorized`, `arena-host`, `training-model`,
`training-coordinator`, `verification-tooling`.
R2 need not implement a coordinator to reserve its partition; do not stub one.
Register public `/observations`, `/intent-codec-v1`, `/candidates` and actual private host/tool entrypoints explicitly.
Public transitive closure may reach pure core and selected pure SHA bytes only; no model→host/coordinator/tooling edge.
Core/browser gain no training/ML dependency. Do not relax old restrictions across all arena contracts.

| R2 required version | Disposition |
|---|---|
| `challenge-source-inventory-v2` | New three-package/six-partition inventory with audited entry/edge closure. |
| `challenge-execution-pins-v3` | Binds new inventory plus acquired dependency/capture identities; old V2 pins stay historical. |
| `hermetic-verification-v3` | Exact eleven-command inventory below, full three suites and independent raw-output validation. |
| `phase2-baseline-report-v2` | Fresh non-learned `baseline-v1` execution envelope for new pins/namespace; does not replace the baseline policy with V3. |
| `phase2-contract-report-v2` | Fresh contract/source/dependency/bridge/generator provenance under the new graph. |
| `challenge-pin-migration-v2` | New authoritative migration report; historical V1 migration bytes remain immutable. |

Fresh baseline still runs **54 executions + 54 independent semantic reruns** and must preserve old baseline semantics.
Generator coverage is separate evidence; generation success does not imply native legality, a trained policy, or wins.
Extend the existing contract-evidence script to include generator/domain/retained-membership diagnostics without a new command slot.
Do not invent a separate report script or silently grow the eleven-command inventory.
Maintain the seven-input authoritative baseline validator, now matching explicit current versions/context.
Refresh both the producer and independent importer/test readers; never accept new versions by unchecked relabeling.

### Exact eleven-command FULL inventory — required, not executed

Definitions for the exact expansion below: `A=/app/packages/starchess-arena`,
`O=/app/_spec/evidence/ml-adjutant-r2-refresh`.
Executable paths are absolute; record each cwd and full argument vector, lengths, hashes and output artifacts.
No shell expansion executes these commands in this spec pass.
`I` is the lexically sorted full-path list of arena `challenge*.test.ts` plus
`observationIsolation.test.ts`, `resourceLedger.test.ts`, `strictRecordedQueues.test.ts`.
`T` is the lexically sorted full-path list of all training `src/__tests__/*.test.ts`.
Resolve `I`/`T` from the frozen capture, and independently require the identical complete lists in the importer.

| # | Executable / cwd | Exact argument vector after expansion |
|---|---|---|
| 1 | `A/node_modules/.bin/tsx` / `/app` | `[A+'/src/cli/challenge.ts','--suite','all','--rerun','--out',O+'/baseline-report.json']` |
| 2 | `A/node_modules/.bin/tsx` / `/app` | `['/app/scripts/challenge-contract-evidence.ts']` |
| 3 | `/app/packages/starchess-core/node_modules/.bin/tsc` / `/app/packages/starchess-core` | `['-p','tsconfig.json','--noEmit']` |
| 4 | `A/node_modules/.bin/tsc` / `A` | `['-p','tsconfig.json','--noEmit']` |
| 5 | `/app/packages/starchess-training/node_modules/.bin/tsc` / `/app/packages/starchess-training` | `['-p','tsconfig.json','--noEmit']` |
| 6 | `A/node_modules/.bin/tsc` / `A` | `['--noEmit','--target','ES2022','--module','ESNext','--moduleResolution','Bundler','--strict','--skipLibCheck',...I,'/app/scripts/challenge-contract-evidence.ts','/app/scripts/challenge-validate-baseline.ts']` |
| 7 | `/app/packages/starchess-training/node_modules/.bin/tsc` / `/app/packages/starchess-training` | `['--noEmit','--target','ES2022','--module','ESNext','--moduleResolution','Bundler','--strict','--skipLibCheck',...T]` |
| 8 | `/app/packages/starchess-core/node_modules/.bin/vitest` / `/app/packages/starchess-core` | `['run','--config','/tmp/starchess-core.vitest.mts','--configLoader','native','--maxWorkers','2','--reporter=default','--reporter=json','--outputFile',O+'/vitest-starchess-core.json']` |
| 9 | `A/node_modules/.bin/vitest` / `A` | `['run','--config','/tmp/starchess-arena.vitest.mts','--configLoader','native','--maxWorkers','2','--reporter=default','--reporter=json','--outputFile',O+'/vitest-starchess-arena.json']` |
| 10 | `/app/packages/starchess-training/node_modules/.bin/vitest` / `/app/packages/starchess-training` | `['run','--config','/tmp/starchess-training.vitest.mts','--configLoader','native','--maxWorkers','2','--reporter=default','--reporter=json','--outputFile',O+'/vitest-starchess-training.json']` |
| 11 | `/usr/local/bin/node` / `/app` | `['--test',A+'/hermetic/evidence-bundle.test.mjs',A+'/hermetic/image-measurement.test.mjs',A+'/hermetic/tar.test.mjs',A+'/hermetic/public-subpaths.test.mjs']` |

`public-subpaths.test.mjs` is a **planned** persisted public-closure checker target, not an existing/passing test claim.
It must check actual npm subpath resolution and transitive forbidden edges for all three public bridge entries,
with negative fixtures; source name matching alone does not prove pure closure.
Command 11 runs all in-image hermetic unit modules, including the new checker.
The Docker-dependent `infra.test.mjs` remains a separate mandatory **host actual-Docker gate**, not a skipped in-image substitute.
Retain network-none/read-only/nonroot/resources, actual mount checks, host image measurement/export binding,
and post-publication reader/source-pin tests against the current image/context.
Recount full raw Vitest and Node outputs, reject failed/pending/todo/skipped mandatory checks, and bind all logs/artifacts.
No subset, prior core-only result, old eight-command inventory, fabricated count, or stale marker satisfies FULL.

## 9. Fresh R2 publication and closure gate

Use the new host namespace **`_spec/evidence/ml-adjutant-r2-refresh`**, outside captured source.
Use the same logical/runtime namespace at `/app/_spec/evidence/ml-adjutant-r2-refresh` for new report references/readers.
Do not rename, overwrite, or silently fall back to R0/Phase 2 evidence.
Switch `HERMETIC_OUTPUT_DIRECTORY`, output exclusions, tests and independent reader validation to the current R2 image/context.
Within the R2 gate, absent/incomplete/invalid fresh output fails; an old marked bundle is not a fallback.
Historical readers may validate old bundles only in explicitly selected historical contexts, never as current R2 proof.
Retain completion-marker logical commit, exclusive ownership, canonical bounded inventory, fsync ordering and postcommit failure semantics.

Required order: complete source/tests → adversarial + security READY → freeze source/dependencies/control →
new dependency/source images → FULL eleven commands + actual Docker gates + **54+54** baseline parity →
independent import/marker publication → current-image host readers/source-pin checks → final post-publication reviews.
Review failures return to build; new captured edits require another freeze and fresh proof.
Keep `learnedGateEligible=false`, no model artifact, no learned PASS, and no registry activation.
**All fresh R2 hashes/results/counts/publication/closure remain PENDING.**

## 10. Remaining pre-training gates and spec handoff

R3 authorized lineage/paid/loss ledger, R4 features/belief, and R5 readiness remain future work.
The economic amendment remains unfrozen: calibrated turn-aware enemy surviving combat replacement plus latent bank,
public opening **4+3=7**, CC exclusion, zero endowed paid basis, native income tiers/cap at actual grant boundaries,
equivalent own/enemy replacement valuation, uncertainty/interactions, and memory without sighting double-counts.
Do not silently alter the prior 370-field manifest or imply V3 generation implements these requirements.
No R6 training, weights, artifact, H3 search, commit, push, publishing, or deployment is authorized by this spec pass.

Spec-side coverage intentionally includes pending arena/training bridge sources alongside landed native helpers.
Existing native semantics specs keep their coverage; creating this concern does not transfer their rules ownership.
Build owns source pointers and any future source/test/config changes; four native citations already resolve here.
No source prose is migrated or requested for removal in this amendment.
`TestSpecNotesFitTheBox` / `specNotesEnforced` were not found in this repository scan; no ratchet test is edited.
Lead/build must run native PlantUML `checkonly` and the spec skill's SPEC-map check CLI when artifacts are ready.
This keeper runs no shell and claims neither rendering nor runtime verification.
`_spec/template.txt` is absent. Executor: fetch and commit the proveo template once from
<https://raw.githubusercontent.com/proveo-ca/spec/refs/heads/main/_spec/template.txt>.
This pass did not fetch the template URL or alter repository rules.
