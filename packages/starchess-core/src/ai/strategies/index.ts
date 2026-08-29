/**
 * The strategy registry, and the two aggregate passes the orchestrator runs:
 * collect every proposed plan, and score every classical move.
 *
 * Registry order is the tie-break order — plans proposed earlier win an exact
 * score tie, because the final ranking sort is stable.
 *
 * // SPEC: _spec/apps/starchess/core/adjutant/naive/opponent-strategy.puml
 */

import { specialGasCost } from "../../scfen";
import type { ScSpecialKind } from "../../model/types";
import type { AdjutantCtx, Candidate, Move } from "../context";
import { evaluateMove } from "../context";
import { captures } from "./captures";
import { checks } from "./checks";
import { economy } from "./economy";
import { mapControl } from "./mapControl";
import { survival } from "./survival";
import { threats } from "./threats";
import type { Strategy } from "./types";

export { captures, checks, economy, mapControl, survival, threats };
export * from "./types";

/** Deploys lead, then territory, then the strike concerns. */
export const STRATEGIES: readonly Strategy[] = [
  economy,
  mapControl,
  captures,
  survival,
  checks,
  threats,
];

/**
 * Every B-timing plan the strategies propose, filtered to what this turn's gas
 * budget can actually pay for.
 */
export const generateCandidates = (ctx: AdjutantCtx): Candidate[] => {
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
 * A classical move's score: the sum of what every concern makes of it.
 * Returns `-Infinity` for a move whose mover is not on the board.
 */
export const scoreMove = (move: Move, ctx: AdjutantCtx): number => {
  const ev = evaluateMove(move, ctx);
  if (!ev) return Number.NEGATIVE_INFINITY;

  let total = 0;
  for (const strategy of STRATEGIES) {
    if (!strategy.score) continue;
    total += strategy.score(ev, ctx);
  }
  return total;
};
