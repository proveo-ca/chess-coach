/**
 * SCFEN parse / format / queue codec (no turn resolve / replay).
 */
export {
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
  toClassicFen,
} from "./codec";

export type { ScPhaseCode, ScFenSnapshot, ScAction, ScTurnQueue, ScFenError } from "../model/types";
