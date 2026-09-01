// SPEC: _spec/apps/starchess/core/adjutant/strategic/strategic-architecture.puml
/**
 * Adjutant (SCRIPT STRATEGIC) — orchestrator for the strategic difficulty.
 *
 * Mirrors the naive `adjutant.ts` orchestration exactly (same turn shape,
 * same legality gates, same commit path through `addScAction`) but drives the
 * strategic context and the strategic strategy set:
 *
 *   1. `strategic/context.ts` builds the naive context plus the known-vs-seen
 *      material model (`kvs`, `cheesePromotion`, `winning`).
 *   2. `strategic/strategies/` propose plans and score classical moves against
 *      those dials (economy first, other concerns in later passes).
 *   3. `plans/` (reused from naive) composes same-turn B+C stacks.
 *   4. Every plan is guarded against leaving our Command Center (CC) on a chip-capable ray
 *      (`clearsCheck`), ranked, and committed through `addScAction`.
 *
 * Deterministic. Returns the input snapshot untouched in the same situations
 * as naive (not our planning phase, our side already queued, no Command Center (CC), or
 * nothing scored).
 */

import { addScAction, AddScActionError } from "../../commands/queue-action";
import type { PieceColor, ScFenSnapshot } from "../../model/types";
import type { Candidate } from "../context";
import { buildStrategicCtx, type StrategicAdjutantContext } from "./context";
import { clearsCheck } from "../plans/simulate";
import {
  pawnGasStacks,
  sideMoves,
  spawnCaptureStacks,
  spawnStacks,
  specialClassicalStacks,
} from "../plans/stacks";
import { asCandidate, generateCandidates, scoreMove } from "./strategies";
import { KING_SAFETY } from "../strategies/survival";

export type StrategicResult = {
  snapshot: ScFenSnapshot;
  /** Minerals to debit when a spawn was queued (Command Center deploy). */
  spendMinerals?: { color: PieceColor; amount: number };
};

/** Context needed to (re)build the guarded, ranked candidate list. */
export type StrategicCandidatesResult = {
  us: PieceColor;
  candidates: Candidate[];
};

/**
 * Build the strategic adjutant's guarded + ranked candidate list for an open
 * planning window (`ctx.color`, default black). `null` when our side already
 * queued, the phase is not P, or the strategic context cannot be built.
 *
 * Pure and deterministic — the strategic *scores* are ranked but not yet
 * committed, so a caller (e.g. an engine feed) can re-rank or prune them
 * before picking. `strategicAdjutant` commits the top scoring legal one.
 */
export const strategicCandidates = (
  snap: ScFenSnapshot,
  ctx?: StrategicAdjutantContext,
): StrategicCandidatesResult | null => {
  const us: PieceColor = ctx?.color ?? "b";

  if (snap.phase !== "P") return null;
  if (snap.queue?.actions.some((a) => a.color === us)) return null;

  const c = buildStrategicCtx(snap, ctx);
  if (!c) return null;

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
   * The same uniform Command Center (CC)-safety rule as naive: any plan that leaves the Command Center (CC)
   * on a chip-capable ray is crushed by KING_SAFETY. Covers fleeing a real
   * check, interposing / capturing the checker, and quiet self-exposure via
   * absolute pins.
   */
  const guarded = [...specials, ...stacks, ...moveCandidates].map((cand) =>
    clearsCheck(c.map, cand.actions, c.sieged, c.us, c.enemy)
      ? cand
      : { ...cand, score: cand.score - KING_SAFETY },
  );

  const ranked = [...guarded].sort((a, b) => b.score - a.score);
  return { us, candidates: ranked };
};

/**
 * Commit one scored candidate through `addScAction`, returning the resulting
 * `StrategicResult` or `null` when the plan is illegal (an `AddScActionError`
 * is caught and the caller falls through to the next candidate).
 */
export const applyCandidate = (
  snap: ScFenSnapshot,
  candidate: Candidate,
  color: PieceColor,
): StrategicResult | null => {
  try {
    let next: ScFenSnapshot = { ...snap, queue: snap.queue ?? { actions: [] } };
    for (const action of candidate.actions) {
      next = addScAction({ snapshot: next, action }).snapshot;
    }
    return candidate.spendMinerals
      ? { snapshot: next, spendMinerals: { color, amount: candidate.spendMinerals } }
      : { snapshot: next };
  } catch (e) {
    if (e instanceof AddScActionError) return null;
    throw e;
  }
};

/**
 * Decide one plan for an open planning window (our side = `ctx.color`, default
 * black). Returns the input snapshot untouched when our side already queued,
 * the phase is not P, or no action scores above nothing.
 */
export const strategicAdjutant = (
  snap: ScFenSnapshot,
  ctx?: StrategicAdjutantContext,
): StrategicResult => {
  const built = strategicCandidates(snap, ctx);
  if (!built) return { snapshot: snap };
  for (const chosen of built.candidates) {
    const result = applyCandidate(snap, chosen, built.us);
    if (result) return result;
  }
  return { snapshot: snap };
};