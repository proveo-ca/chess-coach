/**
 * The strategy contract.
 *
 * A strategy answers at most two questions about a planning turn:
 *  - `generate` — which plans does this concern put on the table? (deploys,
 *    gas specials, escapes)
 *  - `score` — how much does this concern like a given classical move?
 *
 * Strategies never read the snapshot directly and never branch on posture:
 * every input comes from {@link AdjutantCtx}, and the posture-dependent dials
 * arrive pre-resolved in `ctx.weights`.
 *
 * // SPEC: _spec/apps/starchess/core/adjutant/naive/opponent-strategy.puml
 */

import type { AdjutantCtx, Candidate, MoveEval } from "../context";

export type StrategyId =
  | "checks"
  | "captures"
  | "threats"
  | "survival"
  | "mapControl"
  | "economy";

export type Strategy = {
  id: StrategyId;
  /** Plans this concern proposes on its own (B-timing specials, deploys). */
  generate?: (ctx: AdjutantCtx) => Candidate[];
  /** This concern's contribution to a classical move's score. */
  score?: (ev: MoveEval, ctx: AdjutantCtx) => number;
};

/** Build a single-action candidate. */
export const asCandidate = (
  action: Candidate["actions"][number],
  score: number,
  spendMinerals?: number,
): Candidate => ({
  actions: [action],
  score,
  ...(spendMinerals != null ? { spendMinerals } : {}),
});
