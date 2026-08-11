import { describe, expect, it } from "vitest";

import { buildReviewHistory } from "~/app/reviewHistory";
import { KING_HUNT_PLY_SC, KING_HUNT_STEPS, queueKingHuntStep } from "~/demos/kingHunt";
import { isCheckOnlyResolve } from "~/presentation/hud/isCheckOnlyResolve";
import {
  boardIndexForBeat,
  buildTypewriterBeats,
  endPlayIndexForTurn,
  endResultAt,
} from "~/tutorial/typewriterBeats";

describe("typewriterBeats board indices (king-hunt checks)", () => {
  const history = buildReviewHistory({
    start: KING_HUNT_PLY_SC[0]!,
    steps: KING_HUNT_STEPS,
    startCaption: "Start",
    queueStep: (snap, i) => queueKingHuntStep(snap, KING_HUNT_STEPS[i]!),
  });

  it("pairs check-only plies with End resolves like DualNav", () => {
    const resolves = history.settledResolves;
    expect(resolves.length).toBeGreaterThan(0);
    expect(isCheckOnlyResolve(resolves[0]!)).toBe(true);
    expect(endResultAt(resolves, 0)).toBe(resolves[1]!);
    expect(endPlayIndexForTurn(0, resolves)).toBe(1);
  });

  it("keeps intent/resolve on post-check boards (no pull-back to turn start)", () => {
    const resolves = history.settledResolves;
    const beats = buildTypewriterBeats(resolves);
    const firstTurn = beats.filter((b) => b.resolveIndex === 0);
    expect(firstTurn.map((b) => b.kind)).toEqual(["turn", "check", "intent", "resolve"]);

    const turn = firstTurn.find((b) => b.kind === "turn")!;
    const check = firstTurn.find((b) => b.kind === "check")!;
    const intent = firstTurn.find((b) => b.kind === "intent")!;
    const resolve = firstTurn.find((b) => b.kind === "resolve")!;

    expect(boardIndexForBeat(turn, resolves)).toBe(0);
    expect(boardIndexForBeat(check, resolves)).toBe(0);
    expect(boardIndexForBeat(intent, resolves)).toBe(1);
    expect(boardIndexForBeat(resolve, resolves)).toBe(2);
  });
});
