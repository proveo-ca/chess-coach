// SPEC: _spec/resolution-primitives.puml
import { rayBetween } from "./mines";
import type { ScPiece, Square } from "./types";

export const squareTicks = (piece: ScPiece["type"]): number => piece === "n" ? 1 : 2;
export const movesAirborne = (piece: ScPiece["type"]): boolean => piece === "n" || piece === "k" || piece === "p";
export const travelSquares = (from: Square, to: Square, piece: ScPiece["type"]): number => {
  const df = Math.abs(to.charCodeAt(0) - from.charCodeAt(0));
  const dr = Math.abs(Number(to[1]) - Number(from[1]));
  return Math.max(1, piece === "n" ? df + dr : Math.max(df, dr));
};
export const travelTicks = (from: Square, to: Square, piece: ScPiece["type"]): number => travelSquares(from, to, piece) * squareTicks(piece);
export type TimedStep = { at: Square; enter: number };
export type TimedMover = { steps: readonly TimedStep[]; until?: number };

export const timedMover = (from: Square, to: Square, piece: ScPiece["type"], opts?: { diesOnLanding?: boolean }): TimedMover => {
  const steps: TimedStep[] = movesAirborne(piece)
    ? [{ at: to, enter: travelTicks(from, to, piece) }]
    : [...rayBetween(from, to), to].map((at, index) => ({ at, enter: (index + 1) * squareTicks(piece) }));
  const landing = steps[steps.length - 1]!.enter;
  return { steps, ...(opts?.diesOnLanding ? { until: landing } : {}) };
};

const stepAt = (mover: TimedMover, tick: number): TimedStep | null => {
  if (mover.until != null && tick > mover.until) return null;
  let held: TimedStep | null = null;
  for (const step of mover.steps) {
    if (step.enter > tick) break;
    held = step;
  }
  return held;
};

export type MoverContact = { at: Square; tick: number; first: "a" | "b" | "both" };
export const moverContact = (a: TimedMover, b: TimedMover): MoverContact | null => {
  const end = Math.max(a.steps[a.steps.length - 1]!.enter, b.steps[b.steps.length - 1]!.enter);
  for (let tick = 1; tick <= end; tick++) {
    const sa = stepAt(a, tick), sb = stepAt(b, tick);
    if (!sa || !sb) continue;
    if (sa.at === sb.at) return { at: sa.at, tick, first: sa.enter < sb.enter ? "a" : sb.enter < sa.enter ? "b" : "both" };
    const pa = stepAt(a, tick - 1), pb = stepAt(b, tick - 1);
    if (pa && pb && pa.at === sb.at && pb.at === sa.at && pa.at !== sa.at) {
      return { at: sa.at < sb.at ? sa.at : sb.at, tick, first: "both" };
    }
  }
  return null;
};
