/**
 * Adjutant (SCRIPT STRATEGIC) — public entry.
 *
 * A parallel opponent planner to naive `adjutant` (see `ai/adjutant.ts`),
 * layering the known-vs-seen material model and strategic override dials on
 * top of the shared naive context / plans. Same legality guarantees: commits
 * only through `addScAction`, guarded by `clearsCheck`, fully deterministic.
 *
 * Usage mirrors naive:
 *
 *   strategicAdjutant(snap, { color, storedFor, kvs })
 *
 * `kvs` is the host-maintained known-vs-seen accumulator; omit it for a
 * deterministic one-turn estimate.
 *
 * // SPEC: _spec/apps/starchess/core/adjutant/strategic/strategic-architecture.puml
 */

export { strategicAdjutant } from "./orchestrator";
export type { StrategicResult } from "./orchestrator";
export { buildStrategicCtx } from "./context";
export type { StrategicCtx, StrategicAdjutantContext } from "./context";
export {
  seedKnownVsSeen,
  knownForTurn,
  combineKnownVsSeen,
  estimateKnownVsSeen,
  detectCheesePromotion,
  hasHiddenMaterial,
  hiddenMaterial,
  isWinning,
} from "./intel";
export type { KnownVsSeen } from "./intel";