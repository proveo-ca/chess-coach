// SPEC: _spec/apps/starchess/starchess-mode.puml, _spec/apps/starchess/demos.puml, _spec/apps/starchess/core/adjutant/naive/opponent-strategy.puml
/**
 * Adjutant — deterministic StarChess opponent planner (Command Center (CC) Hunt / Single Player).
 * Feeds the live `autoQueueOpponent` slot (pure; no Solid / store deps).
 *
 * This file orchestrates and nothing else. One planning turn is:
 *
 *  1. `context/` reads the SCFEN into every input variable the planner uses —
 *     fog vision, Command Center (CC) intel, tactical attack maps, supply, hub control.
 *  2. `resolvePosture` picks expand / seek / hunt, which selects the contextual
 *     weight set the strategies are scored against.
 *  3. `strategies/` propose plans (deploys, gas specials, escapes) and score
 *     every classical move. Each strategy owns one concern: checks, captures,
 *     threats, survival, map control, economy.
 *  4. `plans/` composes same-turn B+C packages from those pieces.
 *  5. Every plan is guarded against leaving our Command Center (CC) on a chip-capable ray,
 *     ranked, and committed through the SCFEN appenders.
 *
 * Color-agnostic: plays `ctx.color` (default `"b"` for backward compatibility).
 * Deterministic.
 */

import { addScAction, AddScActionError } from "../commands/queue-action";
import type { PieceColor, ScFenSnapshot } from "../model/types";
import {
  buildAdjutantCtx,
  type AdjutantContext,
  type AdjutantResult,
  type Candidate,
} from "./context";
import { clearsCheck } from "./plans/simulate";
import {
  pawnGasStacks,
  sideMoves,
  spawnCaptureStacks,
  spawnStacks,
  specialClassicalStacks,
} from "./plans/stacks";
import { asCandidate, generateCandidates, scoreMove } from "./strategies";
import { KING_SAFETY } from "./strategies/survival";

export type { AdjutantContext, AdjutantResult };

/**
 * Decide one plan for an open planning window (our side = `ctx.color`, default black).
 * Returns the input snapshot untouched when our side already queued, the phase is
 * not P, or no action scores above nothing.
 */
export const adjutant = (
  snap: ScFenSnapshot,
  ctx?: AdjutantContext,
): AdjutantResult => {
  const us: PieceColor = ctx?.color ?? "b";

  if (snap.phase !== "P") return { snapshot: snap };
  if (snap.queue?.actions.some((a) => a.color === us)) return { snapshot: snap };

  const c = buildAdjutantCtx(snap, ctx);
  if (!c) return { snapshot: snap };

  // Strategies propose; the orchestrator composes.
  const specials = generateCandidates(c);
  const moves = sideMoves(c);
  const moveCandidates: Candidate[] = moves.map((m) =>
    asCandidate(
      {
        timing: "C",
        kind: "classical",
        color: c.us,
        from: m.from,
        to: m.to,
        ...(m.promotion ? { promotion: m.promotion } : {}),
      },
      scoreMove(m, c),
    ),
  );
  const stacks = [
    ...pawnGasStacks(c, moves),
    ...spawnStacks(specials, moveCandidates),
    ...spawnCaptureStacks(specials, c),
    ...specialClassicalStacks(specials, moveCandidates, c),
  ];

  /**
   * Protect the Command Center (CC) above all, as a single uniform rule: any plan that leaves
   * the Command Center (CC) on a chip-capable ray is crushed by KING_SAFETY. This covers all
   * three cases at once — fleeing a real check, interposing / capturing the
   * checker, and (in the quiet case) not self-exposing a pinned piece, which
   * raw `attacksSquare` cannot see because it ignores absolute pins.
   */
  const guarded = [...specials, ...stacks, ...moveCandidates].map((cand) =>
    clearsCheck(c.map, cand.actions, c.sieged, c.us, c.enemy)
      ? cand
      : { ...cand, score: cand.score - KING_SAFETY },
  );

  // Specials / stacks lead the pool, so they win exact score ties.
  const ranked = [...guarded].sort((a, b) => b.score - a.score);

  // Commit through the SCFEN appenders; skip illegal stacks (try next-best).
  for (const chosen of ranked) {
    try {
      let next: ScFenSnapshot = { ...snap, queue: snap.queue ?? { actions: [] } };
      for (const action of chosen.actions) {
        next = addScAction({ snapshot: next, action }).snapshot;
      }
      return chosen.spendMinerals
        ? { snapshot: next, spendMinerals: { color: c.us, amount: chosen.spendMinerals } }
        : { snapshot: next };
    } catch (e) {
      if (e instanceof AddScActionError) continue;
      throw e;
    }
  }
  return { snapshot: snap };
};
