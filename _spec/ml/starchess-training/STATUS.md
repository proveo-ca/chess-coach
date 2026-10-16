# starchess-training — current status

**[Unverified] 2026-10-16 · current lead-observed partial source; full R4 BLOCKED / weights NONE.**

## Responsibility

- Own [`@chess-coach/starchess-training`](../../../packages/starchess-training/package.json), candidate generation/composition, economic/feature modules, and private coordinator accounting.
- Depend on arena, core, and exact `jssha` **3.3.2**.
- Restrict model imports to authorized arena leaves and pure core planning; never import host-private state, even as types.
- Let the native core decide legality and the host admit proposals; accounting is not a second rules engine.

## Current findings

- Candidate/composition, economic, feature, and coordinator source **exists partially**; “all R4 unimplemented” is stale.
- The only package export is `/candidates`; `/features` and inference `/artifacts` remain missing from the atomic **seven-root** obligation.
- Current five-root refusal and four public HIGH controls are [arena-owned blockers](../starchess-arena/STATUS.md), not training admission proof.
- Whole-decision budget adequacy remains open under the unchanged **1048576** cap; retained quotes do not prove a complete schedule fits.
- Exact B1 restriction, immutable source loading/runtime-image binding, continuing seals, and same-graph dispatch remain open.
- Both auditors must restrict `createPlanningLedger` / `LedgerPair` / `LedgerOwner` to the exact production `coordinator/planningScope.ts` importer; B1 is not a generic constructor exception.
- Genuine cold permits/model binding, hosted A2, and independent parent verification/ACK have no complete genuine-path proof.
- Amended **418**-feature numerical/readiness calibration and global R5 remain pending; **H=1** stays fixed.
- Weights remain **NONE**; R6–R8 have not started and ML remains disabled.

## Latest suggested repairs

R4 mapping: [T1 and the ordered repair plan](../R4.md#ordered-next-implementation--pending-source-owner-work) retain this consumer's cap/B1/image/seven-root/cold-authority obligations.
[P1](../R4.md#p1)–[P8](../R4.md#p8) belong to independent arena auditors, not a training-owned shared solver.
Numerical/noninterference/conservation work below remains an existing R4 prerequisite; it creates no R5/training expansion.

1. Prove whole-decision disjoint scheduling and all charged work fit the unchanged cap; retain failed quotes without reclassifying them as proof.
2. Complete exact B1/source authority, immutable loading/image binding, continuing seals, same-graph dispatch, and the genuine cold permit/model/A2/parent-ACK chain.
3. Expose `/features` and `/artifacts` only atomically with all seven roots and both independent auditor proofs; add neither export in this docs task.
4. Persist and verify authorized-scope 418-feature numerical, noninterference, and conservation controls; distinguish implementation tests from separately authorized calibration/global R5 execution.

These repairs preserve accepted contracts and add no fitting, training, collection, execution, or activation permission.

## Verification + References

- No fresh complete training/types/full46 verification runs in this documentation task.
- Earlier full-suite counts and static review verdicts retain their old source scopes; none certifies this final integrated snapshot.
- [Candidate entry](../../../packages/starchess-training/src/candidates.ts) and [composition](../../../packages/starchess-training/src/composition.ts).
- [Economic source](../../../packages/starchess-training/src/economic/) and [feature source](../../../packages/starchess-training/src/feature/).
- [Private coordinator](../../../packages/starchess-training/src/coordinator/); its existence is not real runtime authority.
- [Original implementation ledger](../../_plans/ml-adjutant-r4-implementation.md) and [authority chain](../../_plans/ml-adjutant-r4-authority-chain.md).
- [HOST delegation](../../_plans/ml-adjutant-r4-host-delegation.md) and [exact B1 clarification](../../_plans/ml-adjutant-r4-accounting-bootstrap-clarification.md).
- [Accepted economic base](../../_plans/ml-adjutant-r4-economic-amendment.md), [A1–A7 correction](../../_plans/ml-adjutant-r4-economic-corrective-annex.md), and [owned-ingress D1](../../_plans/ml-adjutant-r4-owned-ingress-addendum.md).
- [Accepted episode request](../../_plans/ml-adjutant-r4-episode-request-completion.md).
- [Current ownership overview](../overview.puml).
