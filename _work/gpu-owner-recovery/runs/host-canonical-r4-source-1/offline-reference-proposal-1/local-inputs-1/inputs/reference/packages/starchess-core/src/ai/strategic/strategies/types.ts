// SPEC: _spec/apps/starchess/core/adjutant/strategic/strategic-architecture.puml
/**
 * The strategic strategy contract — the same two questions as the naive
 * `Strategy`, but typed against the strategic context so a strategy can read
 * the known-vs-seen dials (`kvs`, `cheesePromotion`, `winning`) in addition to
 * everything the naive context already carries.
 */

import type { Candidate, MoveEval, StrategicCtx } from "../context";
import type { StrategyId } from "../../strategies/types";
import { asCandidate } from "../../strategies/types";

export type { StrategyId };

export { asCandidate };

/**
 * Concerns the strategic script adds that have no naive twin, so they are
 * declared here rather than widening the naive `StrategyId` with an id the
 * naive registry can never carry.
 */
export type StrategicOnlyId = "runners" | "attackers";

export type StrategicStrategy = {
  id: StrategyId | StrategicOnlyId;
  /** Plans this concern proposes on its own (B-timing specials, deploys). */
  generate?: (ctx: StrategicCtx) => Candidate[];
  /** This concern's contribution to a classical move's score. */
  score?: (ev: MoveEval, ctx: StrategicCtx) => number;
};