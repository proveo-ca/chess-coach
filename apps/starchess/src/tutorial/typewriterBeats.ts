/**
 * Typewriter beats for tutorial review — Turn → Check → Intent → Resolve.
 */
import type { EndScTurnResult } from "@chess-coach/starchess-core";

import { isCheckOnlyResolve, isTurnStartIndex } from "~/presentation/hud/isCheckOnlyResolve";
import type { TypewriterBeat } from "~/types/tutorial";

export type { TypewriterBeat } from "~/types/tutorial";

export const endResultAt = (
  resolves: readonly EndScTurnResult[],
  index: number,
): EndScTurnResult | null => {
  const first = resolves[index];
  if (!first) return null;
  if (isCheckOnlyResolve(first) && resolves[index + 1]) return resolves[index + 1]!;
  if (isCheckOnlyResolve(first)) return null;
  return first;
};

/**
 * Settled index DualNav uses to play the End resolve for this turn start.
 * After a check-only ply, TIMELINE_DONE advances to `resolveIndex + 1` — End plays there.
 */
export const endPlayIndexForTurn = (
  resolveIndex: number,
  resolves: readonly EndScTurnResult[],
): number => {
  const first = resolves[resolveIndex];
  return first && isCheckOnlyResolve(first) ? resolveIndex + 1 : resolveIndex;
};

/**
 * Settled snapshot index to display for a typewriter beat (DualNav-aligned).
 * Intent stays on the post-check board; completed Resolve sits on the post-End board.
 */
export const boardIndexForBeat = (
  beat: TypewriterBeat,
  resolves: readonly EndScTurnResult[],
): number => {
  if (beat.kind === "turn" || beat.kind === "check") return beat.resolveIndex;
  const endPlay = endPlayIndexForTurn(beat.resolveIndex, resolves);
  if (beat.kind === "intent") return endPlay;
  return endPlay + 1;
};

/** Flat typewriter beats: Turn N → Check → Intent → Resolve per turn. */
export const buildTypewriterBeats = (resolves: readonly EndScTurnResult[]): TypewriterBeat[] => {
  const beats: TypewriterBeat[] = [];
  let turn = 0;
  let i = 0;
  while (i < resolves.length) {
    if (!isTurnStartIndex(i, resolves)) {
      i += 1;
      continue;
    }
    const first = resolves[i];
    const end = endResultAt(resolves, i);
    if (!end && !(first && isCheckOnlyResolve(first))) {
      i += 1;
      continue;
    }
    turn += 1;
    beats.push({
      kind: "turn",
      turn,
      resolveIndex: i,
      text: `Turn ${turn}`,
    });
    beats.push({
      kind: "check",
      resolveIndex: i,
      hasCheck: !!(first && isCheckOnlyResolve(first)),
      text: "Check",
    });
    if (end) {
      beats.push({ kind: "intent", resolveIndex: i, text: "Intent" });
      beats.push({ kind: "resolve", resolveIndex: i, text: "Resolve" });
    }
    if (first && isCheckOnlyResolve(first)) {
      i += end ? 2 : 1;
    } else {
      i += 1;
    }
  }
  return beats;
};
