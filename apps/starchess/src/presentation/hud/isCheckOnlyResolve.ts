/**
 * Turn-open check plies from {@link beginScTurn} `asResolve` have attacks only —
 * no classical / B / F / path-reveal. Used to chain check+End in one DualNav arrow.
 */
import type { EndScTurnResult } from "@chess-coach/starchess-core";

export const isCheckOnlyResolve = (r: EndScTurnResult): boolean =>
  r.resolved.moves.length === 0 &&
  r.bMoves.length === 0 &&
  r.fMoves.length === 0 &&
  r.resolved.pathRevealAttacks.length === 0 &&
  r.resolved.promotions.length === 0;

/** Settled index is a turn boundary (idle DualNav cursor). */
export const isTurnStartIndex = (
  index: number,
  settledResolves: readonly EndScTurnResult[],
): boolean => {
  if (index <= 0) return true;
  const prev = settledResolves[index - 1];
  if (!prev) return true;
  return !isCheckOnlyResolve(prev);
};

/** Previous turn-start index for Back seek. */
export const previousTurnStartIndex = (
  from: number,
  settledResolves: readonly EndScTurnResult[],
): number => {
  for (let i = from - 1; i >= 0; i--) {
    if (isTurnStartIndex(i, settledResolves)) return i;
  }
  return 0;
};
