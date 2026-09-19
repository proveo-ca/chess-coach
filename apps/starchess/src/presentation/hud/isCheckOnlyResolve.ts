/**
 * Turn-open check plies from {@link beginScTurn} `asResolve` have **attacks only** —
 * no classical / B / F / path-reveal / spawn. Used to chain check+End in one DualNav arrow.
 *
 * Spawn-only (and other special-only) Ends must NOT match: they have empty `bMoves`
 * (only pawnDouble fills bMoves) but still spend minerals / place units.
 *
 * Only attacks that hit a unit count: a victimless siege `shelling` (HE on empty
 * ground) and a `mineBlast` that merely *cleared* a mine (no victim) are fire
 * missions, not checks — a sieged tank shelling an empty cross square must not
 * light the TurnBar check chip, chain DualNav plies, or narrate `hasCheck`.
 * Real check plies only ever emit `kingShot` or blocker-collision `capture`.
 */
import type { EndScTurnResult } from "@chess-coach/starchess-core";

const hitsUnit = (a: EndScTurnResult["resolved"]["attacks"][number]): boolean => {
  if (a.kind === "shelling") return false;
  if (a.kind === "mineBlast") return !!a.victim;
  return true;
};

export const isCheckOnlyResolve = (r: EndScTurnResult): boolean =>
  r.resolved.attacks.some(hitsUnit) &&
  r.resolved.moves.length === 0 &&
  r.bMoves.length === 0 &&
  r.fMoves.length === 0 &&
  r.resolved.pathRevealAttacks.length === 0 &&
  r.resolved.promotions.length === 0 &&
  r.events.every((e) => e.phase === "attack");

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
