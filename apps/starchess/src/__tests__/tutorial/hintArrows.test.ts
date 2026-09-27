import { describe, expect, it } from "vitest";

import { knightVia } from "~/tutorial/lessonTactics";
import { completedLessonBeats, resolveTutorialHint, tutorialStory } from "~/tutorial/tutorialScript";
import type { TutorialBeat } from "~/types/tutorial";

describe("resolveTutorialHint", () => {
  const beats: readonly TutorialBeat[] = [
    {
      when: { kind: "scfen", re: /\|9\|/ },
      mark: { arrows: [{ from: "a1", to: "a2" }] },
    },
    { mark: { squares: ["b7"], arrows: [{ from: "h1", to: "a8" }] } },
  ];

  it("is empty when a lesson declares no beats", () => {
    expect(resolveTutorialHint(undefined, { scfen: "SCFEN|8/8|1|" })).toEqual({
      squares: [],
      alertSquares: [],
      gasSquares: [],
      arrows: [],
      cancelQueued: null,
    });
  });

  it("carries gas hints from the mark in force", () => {
    const hint = resolveTutorialHint([{ mark: { gasSquares: ["e1"] } }], {
      scfen: "SCFEN|8/8|1|",
    });
    expect(hint.gasSquares).toEqual(["e1"]);
    expect(hint.squares).toEqual([]);
  });

  it("falls back to the unconditional step", () => {
    expect(resolveTutorialHint(beats, { scfen: "SCFEN|8/8|1|" }).arrows).toEqual([
      { from: "h1", to: "a8" },
    ]);
  });

  it("prefers a matching `when` step", () => {
    expect(resolveTutorialHint(beats, { scfen: "SCFEN|8/8|9|" }).arrows).toEqual([
      { from: "a1", to: "a2" },
    ]);
  });

  it("takes squares and arrows from the same step", () => {
    // The turn-9 step declares arrows only — its (absent) squares must win over
    // the fallback's `b7`, or a lesson could show two beats at once.
    expect(resolveTutorialHint(beats, { scfen: "SCFEN|8/8|9|" }).squares).toEqual([]);
    expect(resolveTutorialHint(beats, { scfen: "SCFEN|8/8|1|" }).squares).toEqual(["b7"]);
  });
});

describe("king-attack-1 hint lines", () => {
  const beats = tutorialStory("live-play", "live-play-attack-1")?.beats;

  it("draws the Tank shot at b7, Bishop x-ray, and Ship's rank-8 shot at a8", () => {
    expect(resolveTutorialHint(beats, { scfen: undefined }).arrows).toEqual([
      { from: "b1", to: "b7" },
      { from: "h1", to: "a8" },
      { from: "d8", to: "a8" },
    ]);
  });

  it("keeps the b7 tank target ring", () => {
    expect(resolveTutorialHint(beats, { scfen: undefined }).squares).toEqual(["b7"]);
  });
});

describe("specials gas hints", () => {
  const hintAt = (storyId: string, scfen?: string, targetingKind?: string) => {
    const story = tutorialStory("specials", storyId)!;
    return resolveTutorialHint(story.beats, {
      scfen: scfen ?? story.board!.scfen,
      ...(targetingKind ? { targetingKind } : {}),
    });
  };

  it.each([
    ["cc", ["e1"]],
    ["hoverbike", ["d4"]],
    ["mecha", ["d4"]],
    ["tank", ["f4"]],
    ["ship", ["a1"]],
  ])("%s opens on a gas hint over the unit to gas", (storyId, squares) => {
    expect(hintAt(storyId).gasSquares).toEqual(squares);
  });

  it("marine points the canister at the ghost once the move is queued", () => {
    const moved = "SCFEN|7k/8/8/8/8/4P3/3P4/4K3|1|33|P|G:11:11|Q:w:C=d2d4;b:";
    expect(hintAt("marine", moved).gasSquares).toEqual(["d4"]);
    const gassed = "SCFEN|7k/8/8/8/8/4P3/3P4/4K3|1|33|P|G:01:11|Q:w:C=d2d4,F=stimStep:d4;b:";
    expect(hintAt("marine", gassed).gasSquares).toEqual([]);
  });

  it("tank: move-then-siege on d4, unsiege-then-move on f4", () => {
    const seed = tutorialStory("specials", "tank")!.board!.scfen;
    expect(hintAt("tank").arrows).toEqual([{ from: "d4", to: "d8" }]);
    const moved = seed.replace("Q:w:;", "Q:w:C=d4d8;");
    expect(hintAt("tank", moved).gasSquares).toEqual(["d8"]);
    const unsieged = seed.replace("Q:w:;", "Q:w:B=siegeMode:f4;");
    expect(hintAt("tank", unsieged)).toMatchObject({
      gasSquares: [],
      squares: ["h4"],
      arrows: [{ from: "f4", to: "h4" }],
    });
  });

  it("the canister leaves once the special is being aimed", () => {
    expect(hintAt("cc", undefined, "deploy").gasSquares).toEqual([]);
    expect(hintAt("ship", undefined, "tacticalJump").gasSquares).toEqual([]);
    expect(hintAt("mecha", undefined, "charonMissiles").squares).toEqual(["h8"]);
  });
});

describe("completed lessons", () => {
  const hoverbike = tutorialStory("specials", "hoverbike")!.beats;
  const done = "SCFEN|4k3/8/8/8/8/8/8/N3K3|3|33|P|G:11:11|M:w:d4a1|Q:w:;b:";

  it("keep the hoverbike's closing mine-guard picture", () => {
    expect(resolveTutorialHint(completedLessonBeats(hoverbike), { scfen: done })).toMatchObject({
      squares: ["d4", "a1"],
      arrows: [
        { from: "a1", to: "b3", via: "a3" },
        { from: "a1", to: "c2", via: "c1" },
      ],
    });
  });

  it("drop every non-final hint", () => {
    const queen = tutorialStory("fog", "queen")!;
    expect(
      resolveTutorialHint(completedLessonBeats(queen.beats), { scfen: queen.board!.scfen }),
    ).toEqual({ squares: [], alertSquares: [], gasSquares: [], arrows: [], cancelQueued: null });
  });
});

describe("live-play gas hints", () => {
  const hintAt = (storyId: string, scfen?: string) => {
    const story = tutorialStory("live-play", storyId)!;
    return resolveTutorialHint(story.beats, { scfen: scfen ?? story.board!.scfen });
  };

  it.each([
    ["live-play-defense-1", ["e1"]],
    ["live-play-defense-2", ["h1"]],
    ["live-play-defense-3", ["f2"]],
    ["live-play-defense-5", ["c2"]],
    ["live-play-attack-2", ["h7"]],
  ])("%s opens on a gas hint over the unit to gas", (storyId, squares) => {
    expect(hintAt(storyId).gasSquares).toEqual(squares);
  });

  it("defense-1 drops the canister while the deploy square is picked or queued", () => {
    const story = tutorialStory("live-play", "live-play-defense-1")!;
    const seed = story.board!.scfen;
    const aiming = resolveTutorialHint(story.beats, { scfen: seed, targetingKind: "deploy" });
    expect(aiming).toMatchObject({ gasSquares: [], squares: ["f2"] });
    const queued = seed.replace("Q:w:;", "Q:w:B=deploy:e1:f2:p;");
    expect(hintAt("live-play-defense-1", queued).gasSquares).toEqual([]);
  });

  it("defense-6 points the canister at the Mecha ghost", () => {
    const seed = tutorialStory("live-play", "live-play-defense-6")!.board!.scfen;
    const moved = seed.replace("Q:w:;", "Q:w:C=e4g2;");
    expect(hintAt("live-play-defense-6", moved)).toMatchObject({
      gasSquares: ["g2"],
      squares: ["f1"],
    });
  });
});

describe("Hoverbike arrows bend at the L corner", () => {
  it("knightVia takes the long leg first, like the scripted arrows", () => {
    expect(knightVia("d4", "c2")).toBe("d2");
    expect(knightVia("c2", "a1")).toBe("a2");
    expect(knightVia("d4", "d6")).toBeUndefined();
  });

  it("ccPressure draws a Hoverbike's line as an L", () => {
    const scfen = "SCFEN|8/8/8/3k4/8/2N5/8/4K3|1|33|P|G:11:11|Q:w:;b:";
    const hint = resolveTutorialHint([{ when: { kind: "ccPressure" }, mark: {} }], { scfen });
    expect(hint.arrows).toEqual([{ from: "c3", to: "d5", via: "c5" }]);
  });
});
