/**
 * StarChess classical resolve — attack then move (simultaneous dual plans).
 * Fog: visible targets attack; fogged occupancy → move collision capture/occupy.
 *
 * Compatibility facade — implementation lives in `@chess-coach/starchess-core`.
 * // SPEC: _spec/apps/ui/starchess/resolve.puml
 */
export type {
  ClassicalPlan,
  ResolvePromotion,
  ResolveAttack,
  ResolveMove,
  ResolveTurnInput,
  ResolveTurnResult,
  PathRevealSnap,
  PathRevealApply,
} from "@chess-coach/starchess-core";
export {
  applyPathRevealAttack,
  applyPendingKingShots,
  resolveTurn,
} from "@chess-coach/starchess-core";
