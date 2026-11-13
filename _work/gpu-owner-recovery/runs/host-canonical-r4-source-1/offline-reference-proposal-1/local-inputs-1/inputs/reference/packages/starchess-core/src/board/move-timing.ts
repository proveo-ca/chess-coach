// SPEC: _spec/packages/starchess-core/move-timing.puml
import type { Square } from "chess.js";

import { rayBetween } from "./mines";
import type { ScPiece } from "./placement";

/**
 * The move phase is simultaneous, so "who was on that square first" is a
 * question of travel time. One tick is half a classical square: a Hoverbike
 * covers a square per tick, everything else takes two. The app's move VFX
 * reads these same numbers (`apps/starchess` `moveTiming.ts`), so a collision
 * happens on screen exactly where the rules put it.
 */
export const squareTicks = (piece: ScPiece["type"]): number => (piece === "n" ? 1 : 2);

/**
 * Leapers are airborne between origin and landing: they hold no square in
 * between, so nothing can meet them mid-flight.
 */
export const movesAirborne = (piece: ScPiece["type"]): boolean =>
  piece === "n" || piece === "k" || piece === "p";

/** Squares of travel: the Hoverbike flies its L (|df| + |dr|), the rest Chebyshev. */
export const travelSquares = (from: Square, to: Square, piece: ScPiece["type"]): number => {
  const df = Math.abs(to.charCodeAt(0) - from.charCodeAt(0));
  const dr = Math.abs(Number(to[1]) - Number(from[1]));
  return Math.max(1, piece === "n" ? df + dr : Math.max(df, dr));
};

/** Ticks from departure to touchdown. */
export const travelTicks = (from: Square, to: Square, piece: ScPiece["type"]): number =>
  travelSquares(from, to, piece) * squareTicks(piece);

export type TimedStep = { at: Square; enter: number };

/**
 * A mover's schedule. Each step is held from its `enter` tick until the next
 * step's; the last is held for good. The origin is never held — every mover
 * leaves on tick 0. `until` ends the mover early: a mine that detonates on its
 * landing takes it off the board the tick it touches down.
 */
export type TimedMover = {
  steps: readonly TimedStep[];
  until?: number;
};

export const timedMover = (
  from: Square,
  to: Square,
  piece: ScPiece["type"],
  opts?: { diesOnLanding?: boolean },
): TimedMover => {
  const per = squareTicks(piece);
  const steps: TimedStep[] = movesAirborne(piece)
    ? [{ at: to, enter: travelTicks(from, to, piece) }]
    : [...rayBetween(from, to), to].map((at, i) => ({ at, enter: (i + 1) * per }));
  const landing = steps[steps.length - 1]!.enter;
  return { steps, ...(opts?.diesOnLanding ? { until: landing } : {}) };
};

const stepAt = (m: TimedMover, tick: number): TimedStep | null => {
  if (m.until != null && tick > m.until) return null;
  let held: TimedStep | null = null;
  for (const s of m.steps) {
    if (s.enter > tick) break;
    held = s;
  }
  return held;
};

/**
 * Where two movers meet. `first` names whoever held `at` before the other
 * arrived (`both` when they entered on the same tick, or passed through each
 * other head-on). A swap has no square of its own — the pair crosses mid-edge —
 * so it is reported on the lower-named of the two, which only places the VFX:
 * both units die either way.
 */
export type MoverContact = {
  at: Square;
  tick: number;
  first: "a" | "b" | "both";
};

export const moverContact = (a: TimedMover, b: TimedMover): MoverContact | null => {
  const end = Math.max(
    a.steps[a.steps.length - 1]!.enter,
    b.steps[b.steps.length - 1]!.enter,
  );
  for (let tick = 1; tick <= end; tick++) {
    const sa = stepAt(a, tick);
    const sb = stepAt(b, tick);
    if (!sa || !sb) continue;
    if (sa.at === sb.at) {
      const first = sa.enter < sb.enter ? "a" : sb.enter < sa.enter ? "b" : "both";
      return { at: sa.at, tick, first };
    }
    const pa = stepAt(a, tick - 1);
    const pb = stepAt(b, tick - 1);
    if (pa && pb && pa.at === sb.at && pb.at === sa.at && pa.at !== sa.at) {
      return { at: sa.at < sb.at ? sa.at : sb.at, tick, first: "both" };
    }
  }
  return null;
};
