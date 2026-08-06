/**
 * Spider Mine helpers — path contact, caps, SCFEN M: packing.
 *
 * Compatibility facade — implementation lives in `@chess-coach/starchess-core`.
 * // SPEC: _spec/apps/ui/starchess/scfen-wire.puml, _spec/apps/ui/starchess/resolve.puml
 */
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
} from "@chess-coach/starchess-core";
