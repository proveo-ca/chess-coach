/**
 * Deep SCFEN validators — SC_BASELINE_FEN + SC_SPECIAL.
 *
 * Compatibility facade — implementation lives in `@chess-coach/starchess-core`.
 */
export {
  ScValidateError,
  assertBaselineFen,
  assertClassicalBaseline,
  assertSpecialLegal,
  assertActionDeep,
} from "@chess-coach/starchess-core";
