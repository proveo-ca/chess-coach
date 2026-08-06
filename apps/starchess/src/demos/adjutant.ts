/**
 * Adjutant — deterministic StarChess opponent planner.
 * Compatibility facade — implementation lives in `@chess-coach/starchess-core`.
 * // SPEC: _spec/apps/ui/starchess/starchess-mode.puml, _spec/apps/ui/starchess/demos.puml
 */
export {
  adjutant,
  kingHuntBrain,
  type AdjutantResult,
  type AdjutantContext,
  type KingHuntBrainResult,
  type KingHuntBrainContext,
} from "@chess-coach/starchess-core";
