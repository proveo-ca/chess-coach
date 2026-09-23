import { describe, expect, it } from "vitest";

import { resolveTutorialHint, tutorialStory } from "~/tutorial/tutorialScript";
import type { TutorialBoardHint } from "~/types/tutorial";

describe("resolveTutorialHint", () => {
  const hints: readonly TutorialBoardHint[] = [
    {
      when: { kind: "scfen", re: /\|9\|/ },
      arrows: [{ from: "a1", to: "a2" }],
    },
    { squares: ["b7"], arrows: [{ from: "h1", to: "a8" }] },
  ];

  it("is empty when a lesson declares no hints", () => {
    expect(resolveTutorialHint(undefined, { scfen: "SCFEN|8/8|1|" })).toEqual({
      squares: [],
      alertSquares: [],
      arrows: [],
    });
  });

  it("falls back to the unconditional step", () => {
    expect(resolveTutorialHint(hints, { scfen: "SCFEN|8/8|1|" }).arrows).toEqual([
      { from: "h1", to: "a8" },
    ]);
  });

  it("prefers a matching `when` step", () => {
    expect(resolveTutorialHint(hints, { scfen: "SCFEN|8/8|9|" }).arrows).toEqual([
      { from: "a1", to: "a2" },
    ]);
  });

  it("takes squares and arrows from the same step", () => {
    // The turn-9 step declares arrows only — its (absent) squares must win over
    // the fallback's `b7`, or a lesson could show two beats at once.
    expect(resolveTutorialHint(hints, { scfen: "SCFEN|8/8|9|" }).squares).toEqual([]);
    expect(resolveTutorialHint(hints, { scfen: "SCFEN|8/8|1|" }).squares).toEqual(["b7"]);
  });
});

describe("king-attack-1 hint lines", () => {
  const hints = tutorialStory("king", "king-attack-1")?.hints;

  it("draws the Tank shot at b7, Bishop x-ray, and Ship's rank-8 shot at a8", () => {
    expect(resolveTutorialHint(hints, { scfen: undefined }).arrows).toEqual([
      { from: "b1", to: "b7" },
      { from: "h1", to: "a8" },
      { from: "d8", to: "a8" },
    ]);
  });

  it("keeps the b7 tank target ring", () => {
    expect(resolveTutorialHint(hints, { scfen: undefined }).squares).toEqual(["b7"]);
  });
});
