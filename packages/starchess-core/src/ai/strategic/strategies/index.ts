/**
 * Strategic strategy registry and the two aggregate passes the strategic
 * orchestrator runs — mirrors the naive registry (`../strategies/index.ts`)
 * with the strategic strategy set swapped in.
 *
 * Registry order is the tie-break order: plans proposed earlier win an exact
 * score tie (the final ranking sort is stable). Economy stays first, exactly
 * as in naive. The remaining concerns (mapControl · captures · survival ·
 * checks · threats) land in later passes.
 *
 * // SPEC: _spec/apps/starchess/core/adjutant/strategic/strategic-architecture.puml
 */

import { specialGasCost } from "../../../scfen";
import type { ScSpecialKind } from "../../../model/types";
import type { Candidate, Move, MoveEval } from "../../context";
import type { StrategicCtx } from "../context";
import { evaluateMove } from "../../context";
import { STRATEGIES as NAIVE_STRATEGIES } from "../../strategies";
import { economy } from "./economy";
import type { StrategicStrategy } from "./types";

export { economy };
export * from "./economy";
export { asCandidate, type StrategyId } from "./types";
export type { StrategicStrategy } from "./types";

/** Deploys lead (mirrors naive tie-break order). */
export const STRATEGIES: readonly StrategicStrategy[] = [economy];

/**
 * Every B-timing plan the strategic strategies propose, gas-filtered.
 */
export const generateCandidates = (ctx: StrategicCtx): Candidate[] => {
  const out: Candidate[] = [];
  for (const strategy of STRATEGIES) {
    if (!strategy.generate) continue;
    out.push(...strategy.generate(ctx));
  }
  return out.filter(
    (c) => specialGasCost(c.actions[0]!.kind as ScSpecialKind) <= ctx.gas,
  );
};

/**
 * A classical move's score across the strategic concerns.
 *
 * Until the strategic passes for mapControl · captures · survival · checks ·
 * threats land, classical-move scoring delegates to the naive concern set
 * (whose `score(ev)` methods are typed over `AdjutantCtx`, a supertype of
 * `StrategicCtx`). Strategic `score` layers in as each category is upgraded.
 */
type ScoreSource = { score?: (ev: MoveEval, ctx: StrategicCtx) => number };
const SCORE_SOURCES: readonly ScoreSource[] = [...STRATEGIES, ...NAIVE_STRATEGIES];

export const scoreMove = (move: Move, ctx: StrategicCtx): number => {
  const ev = evaluateMove(move, ctx);
  if (!ev) return Number.NEGATIVE_INFINITY;
  let total = 0;
  for (const strategy of SCORE_SOURCES) {
    if (!strategy.score) continue;
    total += strategy.score(ev, ctx);
  }
  return total;
};