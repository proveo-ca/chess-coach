# R4 authority chain — implementation prerequisites

Status: **PLAN / PRODUCTION AUTHORITY BLOCKED**.

Executor selected authority-chain planning and native-acquisition tracing before implementation.
Executor separately selected public-closure enforcement before independent source-inventory enforcement.
This record changes no frozen body or execution permission.

## Required chain

```text
independent host expected references
  -> physically retained registered artifact bytes
  -> immutable source + installed/runtime/tool/configuration snapshots
  -> independently recomputed complete source inventory
  -> independently recomputed public closure + exact B1 enforcement
  -> actual image/configuration/execution binding
  -> fixed dispatch in the same canonical loaded graph
  -> separate parent/child realm-local source seals
  -> genuine ACK-bound permits and private planning scopes
  -> one prepaid planning ledger per checked decision
  -> hosted A2 computation + independent parent verification
  -> ACK and publication of staged results
```

File hashes and periodic drift checks establish observed byte identities.
They do not establish continuing immutable loading or a genuine source seal.
The host diagnostic runner must keep these claims separate.

## Current source gates

| Gate | Current source / required repair |
|---|---|
| Source/public audit agreement | `sourceBootstrap.ts` independently compares the recomputed inventory and public closure. The current five-root report does not establish the seven-root R4 public surface. |
| B1 acquisition | Both actual auditors must restrict `createPlanningLedger`, `LedgerPair` and `LedgerOwner` to the exact production `planningScope.ts` importer after binding/effect propagation. A policy declaration or test-only check is insufficient. |
| Actual image execution | `sourceBootstrap.ts` ends runtime checks with `RUNTIME_IMAGE_BINDING_UNSUPPORTED`. Independently measured current image/configuration and actual execution must replace that rejection with enforced checks. |
| Fixed dispatch | `sourceModuleLoader.mjs` ends cold startup with `RUNTIME_IMAGE_BINDING_UNSUPPORTED`. Dispatch must use the verified canonical graph rather than an independently imported implementation. |
| Continuing validity | Seals remain realm-local. Reload, changed runtime/source/configuration, alternate loader, revocation or graph substitution must invalidate scopes and publication. |
| Planning feasibility | Current source quotations exceed the unchanged cap. Authority work cannot conceal or waive this separate blocker. |

## Inspected native acquisition seam

This trace records inspected source and installed package metadata.
It records no executed acquisition, worker launch or image measurement.

```text
@chess-coach/starchess-core "."
  -> packages/starchess-core/src/index.ts
  -> named reexports from ./replay/packed
  -> packages/starchess-core/src/replay/packed.ts
  -> import { deflateSync, inflateSync, strFromU8, strToU8 } from "fflate"
  -> installed fflate 0.8.3 package exports
  -> node -> import -> default -> ./esm/index.mjs
```

The inspected Node ESM member imports `createRequire` from `module`.
It calls `createRequire('/')` and acquires `worker_threads`.
Its asynchronous worker branch contains `new Worker(..., {eval:true})`.
The presence of that branch is not evidence that synchronous packing launches a worker.
The existing loader permits `node:module` acquisition only for its two auditor modules.
The native dependency therefore cannot receive an inferred loader exception.

The installed package also declares `./lib/node.cjs` for the Node require branch.
Neither that alternative branch nor a browser target supplies compatibility by implication.
Do not substitute a browser alias, patch the vendor, tree-shake an unaudited path or waive Worker-eval restrictions.

## Implementation order and stop conditions

### Complete decision-stage inventory

The inventory below locates required work.
It does not claim independently audited scalar adequacy or a disjoint feasible total.

| Stage | Source owner | Audit obligation |
|---|---|---|
| Startup authority/model preparation | `sourceBootstrap.ts`, `startupScope.ts`, `sourceModuleLoader.mjs` | Separate supervised startup from planning. Prepare no history reduction, decision-dependent cache, candidate, feature or sample during startup. |
| Permit admission and ledger bootstrap | `planningScope.ts`, `ownedKernel.ts` | Bind genuine permit/model/seal identities, charge constructor and gate/control work, preserve one authoritative two-field ledger. |
| R3 chain traversal | `planningScope.ts`, arena `r3Session.ts` | Charge visit/node work before callbacks, retain ordered pending boundaries, preserve synchronous borrow and reader expiry. |
| Raw field/byte reconstruction | `economicAdapter.ts`, `ownedR4Schema.ts`, `ownedKernel.ts` | Charge field checks, byte reads/copies/hash/canonical validation and receipt construction. Reconcile the per-byte ingress envelopes with enclosing allowances. |
| Candidate generation and receiving validation | `candidates.ts`, `economicAdapter.ts` | Keep existing native/generator ownership separate. Charge new R4 receiving copies, membership/key/spend checks, hashes and receipt publication. |
| Initial and pending reductions | `features.ts`, `economic/belief.ts`, `evaluator.ts`, `innovation.ts` | Charge all pending initial/open/settled boundaries, complete Boolean support, immutable summaries, validation and state publication on the same ledger. |
| Economic readout | `economic/readout.ts`, `spatial.ts` | Charge complete support/graph visits, calibrated readout mechanics, spatial masks, finite conversions and result receipts. A fitted/calibrated artifact remains a separate missing prerequisite. |
| Candidate feature construction | `feature/encoder.ts`, `economic.ts`, `promotion.ts`, `relations.ts`, `projection.ts` | Preserve all historical370/economic12/promotion36 formulas. Audit real recomputation versus authorized immutable-result reuse without warming decision work at startup. |
| Flattening | `feature/manifest.ts` | Charge fresh418 allocation initialization, all418 stores, traversal and control for every actual flatten call. Returned mutable buffers confer no retained immutable-content authority. |
| Weight checks and scoring | `economicAdapter.ts` | Audit weight decoding/hash, numeric buffers, dot products, logits and finite checks. A blanket upstream allowance does not demonstrate adequate disjoint coverage. |
| Softmax and sampling | `economicAdapter.ts`, `episodeRng.ts` | Audit probability normalization, RNG restoration/draw, cumulative selection, underflow/finite checks and exact stream state changes. |
| Gradient/selected recomputation | `economicAdapter.ts` | Audit the second candidate pass, weighted accumulator and selected-candidate third flatten. Do not add overlapping batch/store witnesses into a supposedly disjoint invoice. |
| Journal/result staging | `economicAdapter.ts`, `episodeVerification.ts` | Audit canonical journal materialization, registry joins and publication checks. Publish no accepted successor before complete independent verification/ACK. |
| Failure/closure work | `ownedKernel.ts`, `planningScope.ts`, `episodeSupervisor.ts` | Prepay gate credits and bounded error/closure/reap paths. Retain original errors and prior debits. Reset/refund/deadline renewal remain forbidden. |
| Parent replica | `episodeVerification.ts` and its local planning scope | Independently reconstruct/recompute under its own genuine replica ledger. Trust neither worker usage nor transferred structural/source receipts. |

Each unresolved obligation keeps whole-schedule adequacy and feasibility open.
Static arithmetic, helper-effect tests and eventual host timing measurements serve different proof roles.

1. Establish the complete source-bound schedule audit and retain independent infeasibility witnesses.
2. Repair public-closure B1 enforcement first and test complete acquisition/escape vectors.
3. Repair source-inventory independently without sharing a verification verdict or weakening existing guards.
4. Complete `/features` and the inference `/artifacts` contract as one atomic public-surface increment.
5. Review a concrete compliant native acquisition seam before changing loading behavior.
6. Implement independently measured image/configuration joins and fixed same-graph dispatch.
7. Test cold genuine parent/child seals, model bindings, permits and all hosted A2 entries.
8. Run full frozen-source verification on the host and obtain both full-R4 closing reviews.

Stop pipeline activation while the complete schedule is infeasible or unproven.
Stop source-seal issuance while either actual auditor, immutable loading or image/dispatch binding remains unproven.
The new host scripts may gather diagnostics without lifting either stop.
Existing rejection tests and earlier bounded READY verdicts are not positive production proof.

Heavy verification belongs on the host.
No collection, fitting, calibration, transfer, training, global R5, publication, deployment or registry activation follows.
