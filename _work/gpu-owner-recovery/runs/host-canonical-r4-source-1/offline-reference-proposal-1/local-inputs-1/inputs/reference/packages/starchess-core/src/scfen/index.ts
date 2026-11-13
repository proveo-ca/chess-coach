/**
 * SCFEN parse / format / queue codec (no turn resolve / replay).
 */
export {
  hasExactCCPair,
  specialGasCost,
  snapFromPlacement,
  formatSpecialsUsedExtra,
  parseSpecialsUsedExtra,
  formatSiegedTanksExtra,
  parseSiegedTanksExtra,
  formatPendingCCShotsExtra,
  parsePendingCCShotsExtra,
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
  toClassicFen,
} from "./codec";
export {
  LEGACY_FIELD_NAMES,
  LEGACY_SPECIAL_KINDS,
  currentKind,
  migrateLegacyNames,
} from "./legacyKinds";

export type { ScPhaseCode, ScFenSnapshot, ScAction, ScTurnQueue, ScFenError } from "../model/types";
