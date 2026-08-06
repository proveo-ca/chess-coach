/**
 * @chess-coach/starchess-core — pure StarChess rules (no SolidJS / DOM).
 *
 * Extraction is incremental: modules move here from apps/ui/src/starchess
 * behind temporary re-export facades. See PLAN.md Phase 1.
 */
export { scOutcome, type ScOutcome, type StarChessColor } from "./outcome";
