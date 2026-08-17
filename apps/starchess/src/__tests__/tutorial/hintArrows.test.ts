import { describe, expect, it } from "vitest";

import {
  resolveTutorialArrows,
  resolveTutorialHints,
  tutorialStory,
} from "~/tutorial/tutorialScript";
import type { TutorialBoardHint } from "~/types/tutorial";

describe("resolveTutorialArrows", () => {
  const hints: readonly TutorialBoardHint[] = [
    {
      when: { kind: "scfen", re: /\|9\|/ },
      arrows: [{ from: "a1", to: "a2" }],
    },
    { squares: ["b7"], arrows: [{ from: "h1", to: "a8" }] },
  ];

  it("is empty when a lesson declares no hints", () => {
    expect(resolveTutorialArrows(undefined, "SCFEN|8/8|1|")).toEqual([]);
  });

  it("falls back to the unconditional step", () => {
    expect(resolveTutorialArrows(hints, "SCFEN|8/8|1|")).toEqual([
      { from: "h1", to: "a8" },
    ]);
  });

  it("prefers a matching `when` step", () => {
    expect(resolveTutorialArrows(hints, "SCFEN|8/8|9|")).toEqual([
      { from: "a1", to: "a2" },
    ]);
  });

  it("takes squares and arrows from the same step", () => {
    // The turn-9 step declares arrows only — its (absent) squares must win over
    // the fallback's `b7`, or a lesson could show two beats at once.
    expect(resolveTutorialHints(hints, "SCFEN|8/8|9|")).toEqual([]);
    expect(resolveTutorialHints(hints, "SCFEN|8/8|1|")).toEqual(["b7"]);
  });
});

describe("king-attack-1 hint lines", () => {
  const hints = tutorialStory("king", "king-attack-1")?.hints;

  it("draws the Bishop x-ray and the Ship's rank-8 shot at a8", () => {
    expect(resolveTutorialArrows(hints, undefined)).toEqual([
      { from: "h1", to: "a8" },
      { from: "d8", to: "a8" },
    ]);
  });

  it("keeps the b7 tank target ring", () => {
    expect(resolveTutorialHints(hints, undefined)).toEqual(["b7"]);
  });
});
