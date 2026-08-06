/**
 * SC-native classical move generator — authoritative SC legality for human
 * input and the brain. chess.js is not consulted.
 *
 * Compatibility facade — implementation lives in `@chess-coach/starchess-core`.
 * // SPEC: _spec/apps/ui/starchess/sc-moves.puml
 */
export type { ScMove, ScMoveOptions } from "@chess-coach/starchess-core";
export { scMovesFrom, scMovesFor, isScMoveShape } from "@chess-coach/starchess-core";
