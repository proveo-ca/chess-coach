// SPEC: _spec/apps/starchess/core/adjutant/strategic/strategic-architecture.puml
/**
 * Strategic strategy registry and the two aggregate passes the orchestrator runs.
 */

import { specialGasCost } from "../../../scfen";
import type { ScSpecialKind } from "../../../model/types";
import type { Candidate, Move, MoveEval } from "../../context";
import type { StrategicCtx } from "../context";
import { evaluateMove } from "../../context";
import { STRATEGIES as NAIVE_STRATEGIES } from "../../strategies";
import { attackers } from "./attackers";
import { captures } from "./captures";
import { checks } from "./checks";
import { economy } from "./economy";
import { runners } from "./runners";
import { survival } from "./survival";
import { threats } from "./threats";
import type { StrategicStrategy } from "./types";

export { attackers, captures, checks, economy, runners, survival, threats };
export * from "./economy";
export * from "./runners";
export * from "./attackers";
export { asCandidate, type StrategyId, type StrategicOnlyId } from "./types";
export type { StrategicStrategy } from "./types";

/** Registry order is the tie-break order for an exact score tie. */
export const STRATEGIES: readonly StrategicStrategy[] = [
  economy,
  attackers,
  runners,
  captures,
  survival,
  threats,
  checks,
];

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

/** A classical move's score across the strategic concerns. */
type ScoreSource = { score?: (ev: MoveEval, ctx: StrategicCtx) => number };
const STRATEGIC_IDS = new Set(STRATEGIES.map((s) => s.id));
const NAIVE_NOT_OVERRIDDEN = NAIVE_STRATEGIES.filter((s) => !STRATEGIC_IDS.has(s.id));
const SCORE_SOURCES: readonly ScoreSource[] = [...STRATEGIES, ...NAIVE_NOT_OVERRIDDEN];

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