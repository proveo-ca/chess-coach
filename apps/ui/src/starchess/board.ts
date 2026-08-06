/**
 * StarChess board occupancy helpers (rules-side).
 *
 * Compatibility facade — implementation lives in `@chess-coach/starchess-core`.
 * // SPEC: _spec/apps/ui/starchess/resolve.puml
 */
export type { ScPiece } from "@chess-coach/starchess-core";
export {
  sq,
  parseSquare,
  placementToMap,
  rookSquaresInPlacement,
  mapToPlacement,
  attacksSquare,
  isSquareAttackedBy,
  findKing,
  collectLegalKingChecks,
  isKingInCheck,
  classicFenFromPlacement,
} from "@chess-coach/starchess-core";
