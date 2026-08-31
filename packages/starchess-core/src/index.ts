/**
 * @chess-coach/starchess-core — pure StarChess rules (no SolidJS / DOM).
 *
 * Owns rules formerly under apps/ui/src/starchess (deleted in Phase 6).
 * UI/PWA: apps/starchess. Rules specs: _spec/packages/starchess-core. Product/UI: _spec/apps/starchess.
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
  MAX_GAME_TURNS,
  TURN_TIMEOUT_MS,
  UNIT_COST,
  incomeForTurn,
  energyForTurn,
  turnTimeoutMsForTurn,
  SPECIAL_ENERGY_COST,
  CHARON_GAS_COST,
  QUEEN_WARP_GAS_COST,
} from "./rules/constants";

export {
  deployedMaterialFromPlacement,
  placementFromFen,
  deployedMaterialFromFen,
  deployedMaterialFromMap,
  applyStoredIncome,
  OPENING_STORED_MATERIAL,
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
  pawnSingleTarget,
  canPawnDoubleStep,
} from "./rules/specials/pawnDouble";

export { adjacentSquares, spawnKingAnchor } from "./rules/specials/adjacent";

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
export {
  scMovesFrom,
  scMovesFor,
  isScMoveShape,
  canClassicalPawnDouble,
} from "./board/moves";

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
  applyPathRevealKingShot,
  applyPendingKingShots,
  resolveTurn,
} from "./resolve/resolve-turn";

export type { ResolveEvent, EndScTurnResult, EndScTurnOptions, BeginScTurnResult } from "./resolve/submit-turn";
export {
  endScTurn,
  beginScTurn,
  refillTurnGas,
  rewriteClassicalAfterB,
} from "./resolve/submit-turn";

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
  queueGasSpent,
  normalizeSnapGas,
  formatScFen,
  parseScFen,
  validateScFen,
  classicFenFromSc,
} from "./scfen";

export type {
  ScFenValidation,
  ScFenReplayResult,
} from "./replay/validate-history";
export {
  replayScFen,
  replayScFenHistory,
  validateScFenHistory,
} from "./replay/validate-history";

export type { FenProjection } from "./replay/fen";
export { scfenToFen } from "./replay/fen";

export type {
  ArenaGameRecord,
  ArenaOutcome,
  ArenaRecordStatus,
  ArenaRunSummary,
} from "./replay/record";
export {
  historyFromRecord,
  makeArenaRecordId,
  recordFromRun,
  validateArenaRecord,
  type ArenaRecordValidation,
} from "./replay/record";

export type { SideVision, NerdVision, PathVisionOpts, VisionBoard } from "./board/vision";
export {
  visionMap,
  getUnitVision,
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
  type AdjutantResult,
  type AdjutantContext,
} from "./ai/adjutant";

export { DEFAULT_RNG, mulberry32, type Rng } from "./ai/context/rng";

export {
  strategicAdjutant,
  strategicCandidates,
  applyCandidate,
  buildStrategicCtx,
  getCCBestGuess,
  emptyCCIntel,
  type CCIntel,
  seedKnownVsSeen,
  knownForTurn,
  combineKnownVsSeen,
  estimateKnownVsSeen,
  detectCheesePromotion,
  hasHiddenMaterial,
  hiddenMaterial,
  isWinning,
  type StrategicResult,
  type StrategicCandidatesResult,
  type Candidate,
  type StrategicCtx,
  type StrategicAdjutantContext,
  type KnownVsSeen,
} from "./ai/strategic";
