/**
 * End / timeout path — resolve one planning SCFEN snap into the next.
 *
 * Compatibility facade — implementation lives in `@chess-coach/starchess-core`.
 * // SPEC: _spec/apps/ui/starchess/turn-queue-sequence.puml, _spec/apps/ui/starchess/resolve.puml
 */
export type {
  EndScTurnResult,
  EndScTurnOptions,
  BeginScTurnResult,
} from "@chess-coach/starchess-core";
export { endScTurn, beginScTurn } from "@chess-coach/starchess-core";
