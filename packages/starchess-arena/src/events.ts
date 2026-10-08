// SPEC: _spec/packages/starchess-arena/authorized-economic-boundaries.puml
export { validateBoundaryBatch } from "./authorized/v2/batch";
export { reconcileBoundary, advanceHistory } from "./authorized/v2/reducer";
export type { AuthorizedEvent, AuthorizedBoundaryBatch, BoundaryPhase, EconomicState, OwnMineAuditState, ReconciledBoundaryState, AuthorizedHistory, OwnActionRef } from "./authorized/v2/types";
