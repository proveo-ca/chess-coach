/**
 * StarChess FEN dialect (StarChess-only). Classic FEN is a one-way render export —
 * never the rules oracle.
 *
 * Compatibility facade — parse/format + replay live in `@chess-coach/starchess-core`.
 * // SPEC: _spec/apps/ui/starchess/scfen-wire.puml, _spec/apps/ui/starchess/scfen-queue.puml
 * Wire / tickets: STARCHESS_FEN.md
 */

export type {
  ScPhaseCode,
  ScFenSnapshot,
  ScAction,
  ScTurnQueue,
  ScFenError,
  ScFenValidation,
  ScFenReplayResult,
} from "@chess-coach/starchess-core";

export {
  toClassicFen,
  hasExactKingPair,
  specialGasCost,
  snapFromPlacement,
  formatSpecialsUsedExtra,
  parseSpecialsUsedExtra,
  formatSiegedRooksExtra,
  parseSiegedRooksExtra,
  formatPendingKingShotsExtra,
  parsePendingKingShotsExtra,
  formatQueueField,
  parseQueueField,
  assertQueueShape,
  assertQueueGas,
  formatScFen,
  parseScFen,
  validateScFen,
  classicFenFromSc,
  replayScFen,
  replayScFenHistory,
  validateScFenHistory,
} from "@chess-coach/starchess-core";
