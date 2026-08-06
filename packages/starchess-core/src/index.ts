/**
 * @chess-coach/starchess-core — pure StarChess rules (no SolidJS / DOM).
 *
 * Extraction is incremental: modules move here from apps/ui/src/starchess
 * behind temporary re-export facades. See PLAN.md Phase 1.
 */

export type { Square } from "./model/square";
export type {
  StarChessColor,
  PieceColor,
  StarChessPiece,
  RookMode,
  ScPhaseCode,
  SpawnPiece,
  ScActionTiming,
  ScSpecialKind,
  SpecialKind,
  ScAction,
  ScActionInput,
  DistributiveOmit,
  ScTurnQueue,
  ScMine,
  ScFenSnapshot,
  ScPendingKingShot,
  ScFenErrorCode,
  ScFenError,
  ClassicalPlan,
  PlayerEconomy,
} from "./model/types";

export { scOutcome, type ScOutcome } from "./outcome";

export {
  KING_MAX_LIVES,
  MAX_STORED_MATERIAL,
  MAX_DEPLOYED_MATERIAL,
  TURN_TIMEOUT_MS,
  UNIT_COST,
  incomeForTurn,
  energyForTurn,
  SPECIAL_ENERGY_COST,
  CHARON_GAS_COST,
} from "./rules/constants";

export {
  deployedMaterialFromPlacement,
  placementFromFen,
  deployedMaterialFromFen,
  deployedMaterialFromMap,
} from "./rules/economy";

export type { ScPiece } from "./board/placement";
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
} from "./board/placement";

export { toClassicFen } from "./board/classicFen";

export {
  MAX_MINES_PER_SIDE,
  rayBetween,
  firstBlockerOnRay,
  pathContactSquares,
  minesFor,
  mineAt,
  formatMinesExtra,
  parseMinesExtra,
  assertMineCap,
} from "./board/mines";

export { isRookSiegedAfterB, rookModeAfterB } from "./board/siege";

export {
  pawnDoubleTarget,
  pawnSingleTarget,
  isPawnStartRank,
  canClassicalPawnDouble,
  canScPawnSingle,
} from "./rules/specials/pawnDouble";

export { adjacentSquares } from "./rules/specials/adjacent";

export {
  charonTargetQueen,
  charonTargetQueenFromPlacement,
  placementAfterCharon,
} from "./rules/specials/bishopCharon";

export {
  SPECIAL_REGISTRY,
  specialGasCost,
  type SpecialRegistryEntry,
} from "./rules/specials/registry";

export type { ScMove, ScMoveOptions } from "./board/moves";
export { scMovesFrom, scMovesFor, isScMoveShape } from "./board/moves";

export {
  ScValidateError,
  assertBaselineFen,
  assertClassicalBaseline,
  assertSpecialLegal,
  assertActionDeep,
} from "./rules/validation";

export {
  AddScActionError,
  RemoveScActionError,
  addScAction,
  removeScAction,
  addScMove,
  addScMoveSan,
  type AddScActionErrorCode,
  type RemoveScActionErrorCode,
} from "./commands/queue-action";

export type {
  ResolvePromotion,
  ResolveAttack,
  ResolveMove,
  ResolveTurnInput,
  ResolveTurnResult,
  PathRevealSnap,
  PathRevealApply,
} from "./resolve/resolve-turn";
export {
  applyPathRevealAttack,
  applyPendingKingShots,
  resolveTurn,
} from "./resolve/resolve-turn";

export type { ResolveEvent, EndScTurnResult } from "./resolve/submit-turn";
export { endScTurn } from "./resolve/submit-turn";

export {
  hasExactKingPair,
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
} from "./scfen";

export type { ScFenValidation, ScFenReplayResult } from "./replay/validate-history";
export {
  replayScFen,
  replayScFenHistory,
  validateScFenHistory,
} from "./replay/validate-history";

export type { NerdVision, PathVisionOpts } from "./board/vision";
export {
  getNerdVision,
  getSideVision,
  getNerdVisibleSquares,
  pathRevealsTarget,
  pathRevealSteps,
  isPieceVisibleToSide,
  isMoverVisibleToSide,
} from "./board/vision";

export {
  adjutant,
  kingHuntBrain,
  type AdjutantResult,
  type AdjutantContext,
  type KingHuntBrainResult,
  type KingHuntBrainContext,
} from "./ai/adjutant";
