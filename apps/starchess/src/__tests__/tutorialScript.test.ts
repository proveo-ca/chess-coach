import { describe, expect, it } from "vitest";

import {
  TUTORIAL_SCRIPT,
  adjacentTutorialStoryId,
  parseTutorialSection,
  resolveTutorialHints,
  resolveTutorialLine,
  resolveTutorialStoryId,
  tutorialPath,
  tutorialStory,
} from "~/tutorial/tutorialScript";

describe("tutorialScript", () => {
  it("covers four stages with the expected story counts", () => {
    expect(TUTORIAL_SCRIPT.map((s) => s.id)).toEqual([
      "fog",
      "specials",
      "resolve",
      "king",
    ]);
    expect(TUTORIAL_SCRIPT[0]!.stories).toHaveLength(8);
    expect(TUTORIAL_SCRIPT[1]!.stories).toHaveLength(6);
    expect(TUTORIAL_SCRIPT[2]!.stories).toHaveLength(1);
    expect(TUTORIAL_SCRIPT[3]!.stories).toHaveLength(2);
    expect(TUTORIAL_SCRIPT[3]!.stories.map((s) => s.id)).toEqual([
      "king-hunt",
      "king-hunt-live",
    ]);
  });

  it("builds deep links from stage + story ids", () => {
    expect(tutorialPath("fog", "king")).toBe("/tutorial/fog/king");
    expect(tutorialPath("specials", "marine")).toBe("/tutorial/specials/marine");
    expect(tutorialPath("resolve")).toBe("/tutorial/resolve/combat-chain");
    expect(tutorialPath("king", "king-hunt-live")).toBe(
      "/tutorial/king/king-hunt-live",
    );
  });

  it("canonicalizes section aliases and unknown stories", () => {
    expect(parseTutorialSection("special-moves")).toBe("specials");
    expect(parseTutorialSection(undefined)).toBe("fog");
    expect(resolveTutorialStoryId("fog", undefined)).toBe("king");
    expect(resolveTutorialStoryId("fog", "nope")).toBe("king");
    expect(resolveTutorialStoryId("fog", "pawn")).toBe("pawn");
  });

  it("walks adjacent stories linearly or wrapping", () => {
    expect(adjacentTutorialStoryId("fog", "king", 1)).toBe("pawn");
    expect(adjacentTutorialStoryId("fog", "king", -1)).toBeNull();
    expect(adjacentTutorialStoryId("fog", "mine", 1)).toBeNull();
    expect(adjacentTutorialStoryId("specials", "tank", 1, { wrap: true })).toBe(
      "marine",
    );
  });

  it("keeps FOG / SPECIAL lesson fixtures aligned with script story ids", () => {
    const fogIds = TUTORIAL_SCRIPT.find((s) => s.id === "fog")!.stories.map(
      (s) => s.id,
    );
    const specialIds = TUTORIAL_SCRIPT.find(
      (s) => s.id === "specials",
    )!.stories.map((s) => s.id);
    expect(fogIds).toEqual([
      "king",
      "pawn",
      "knight",
      "bishop",
      "rook-tank",
      "rook-siege",
      "queen",
      "mine",
    ]);
    expect(specialIds).toEqual([
      "marine",
      "cc",
      "vulture",
      "goliath",
      "bc",
      "tank",
    ]);
  });

  it("returns the story comment by default", () => {
    const line = resolveTutorialLine({ stageId: "fog", storyId: "king" });
    expect(line.comment).toMatch(/pieces move the same as Chess/i);
  });

  it("overrides with a review-phase reaction", () => {
    const line = resolveTutorialLine({
      stageId: "resolve",
      storyId: "combat-chain",
      reviewPhase: "intent",
    });
    expect(line.comment).toMatch(/promises/i);
    expect(line.emotion).toBe("watching");
  });

  it("overrides with chess-skin reaction on fog stories", () => {
    const line = resolveTutorialLine({
      stageId: "fog",
      storyId: "mine",
      chessSkin: true,
    });
    expect(line.comment).toMatch(/lantern/i);
  });

  it("fires the fog/pawn 7th-rank promote tease via SCFEN regex", () => {
    const on7 =
      "SCFEN|7k/3P4/8/8/8/8/8/K7|0|33|P|G:11:11|Q:w:;b:";
    const on4 =
      "SCFEN|7k/8/8/8/3P4/8/8/K7|0|33|P|G:11:11|Q:w:;b:";
    expect(
      resolveTutorialLine({
        stageId: "fog",
        storyId: "pawn",
        scfen: on7,
      }),
    ).toEqual({
      comment: "Go ahead promote. See how the pieces look!",
      emotion: "happy",
    });
    expect(
      resolveTutorialLine({
        stageId: "fog",
        storyId: "pawn",
        scfen: on4,
      }).comment,
    ).toMatch(/fog of war clears/i);
  });

  it("marks fog/knight hops e6 then g5 from SCFEN hints", () => {
    const hints = tutorialStory("fog", "knight")!.hints;
    const start =
      "SCFEN|7k/7p/8/8/3N4/8/8/K7|0|33|P|G:11:11|Q:w:;b:";
    const onE6 =
      "SCFEN|7k/7p/4N3/8/8/8/8/K7|0|33|P|G:11:11|Q:w:;b:";
    // Live resolve encodes Ng5 as `6N1` (not `5N2`).
    const onG5 =
      "SCFEN|7k/7p/8/6N1/8/8/8/K7|2|33|P|G:00:11|Q:w:;b:";
    expect(resolveTutorialHints(hints, start)).toEqual(["e6"]);
    expect(resolveTutorialHints(hints, onE6)).toEqual(["g5"]);
    expect(resolveTutorialHints(hints, onG5)).toEqual([]);
    expect(
      resolveTutorialLine({ stageId: "fog", storyId: "knight", scfen: onE6 }),
    ).toEqual({ comment: "Now move to g5", emotion: "watching" });
    expect(
      resolveTutorialLine({ stageId: "fog", storyId: "knight", scfen: onG5 }),
    ).toEqual({ comment: "Did you see that?!", emotion: "shocked" });
  });

  it("fires specials/marine cheer when gas pawnDouble is queued", () => {
    const gasOnly =
      "SCFEN|7k/8/8/8/8/4P3/3P4/4K3|1|33|P|G:01:11|Q:w:B=pawnDouble:d2:d3;b:";
    expect(
      resolveTutorialLine({
        stageId: "specials",
        storyId: "marine",
        scfen: gasOnly,
      }),
    ).toEqual({ comment: "Oh, yeah!", emotion: "watching" });
  });

  it("gates king-hunt-live intro + intent tip to display turn 1", () => {
    expect(
      resolveTutorialLine({
        stageId: "king",
        storyId: "king-hunt-live",
        turn: 1,
      }),
    ).toEqual({
      comment:
        "Final test: Hunt the stranded Command Center. \nMake me proud!",
      emotion: "happy",
    });
    expect(
      resolveTutorialLine({
        stageId: "king",
        storyId: "king-hunt-live",
        turn: 1,
        reviewPhase: "intent",
      }),
    ).toEqual({
      comment:
        "Queue your intent: \nProtect the Hoverbike with your Mecha. \nDeploy more units.",
      emotion: "watching",
    });
    expect(
      resolveTutorialLine({
        stageId: "king",
        storyId: "king-hunt-live",
        turn: 2,
        reviewPhase: "intent",
      }),
    ).toEqual({ comment: "", emotion: "happy" });
  });

  it("fires king-hunt lines from white/black kingLives digits in SCFEN", () => {
    const at2 =
      "SCFEN|k7/8/6r1/2n5/3K4/8/7b/8|1|23|P|G:11:11|Q:w:;b:";
    const at1 =
      "SCFEN|k7/8/6r1/2n5/2K5/8/7b/8|2|13|P|G:11:11|Q:w:;b:";
    const allyDead =
      "SCFEN|k7/8/6r1/2n5/2K5/8/7b/8|3|03|P|G:11:11|Q:w:;b:";
    const enemyDead =
      "SCFEN|8/8/8/2N5/4k3/8/7B/7K|2|30|P|G:11:11|Q:w:;b:";
    expect(
      resolveTutorialLine({ stageId: "king", storyId: "king-hunt", scfen: at2 }),
    ).toEqual({
      comment: "Checked, a fire represents the damage.",
      emotion: "shocked",
    });
    expect(
      resolveTutorialLine({ stageId: "king", storyId: "king-hunt", scfen: at1 }),
    ).toEqual({
      comment: "Another hit and it's done",
      emotion: "thinking",
    });
    expect(
      resolveTutorialLine({
        stageId: "king",
        storyId: "king-hunt",
        scfen: allyDead,
      }),
    ).toEqual({
      comment: "Oh no! Give it another try, it's a lot to process",
      emotion: "shocked",
      action: { kind: "retryLesson", label: "Retry lesson" },
    });
    expect(
      resolveTutorialLine({
        stageId: "king",
        storyId: "king-hunt-live",
        scfen: enemyDead,
      }),
    ).toEqual({
      comment: "Thinking the same thing",
      emotion: "happy",
    });
  });

  it("fires king-hunt-live tips for enemy pawns and Marine on rank 5", () => {
    const twoEnemyPawns =
      "SCFEN|8/1p1p4/8/4k3/8/8/8/7K|2|33|P|G:11:11|Q:w:;b:";
    const oneEnemyPawn =
      "SCFEN|8/1p6/8/4k3/8/8/8/7K|2|33|P|G:11:11|Q:w:;b:";
    const marineRank5Hp3 =
      "SCFEN|8/8/8/4k1P1/8/8/8/7K|2|33|P|G:11:11|Q:w:;b:";
    const marineRank5Hp1 =
      "SCFEN|8/8/8/4k1P1/8/8/8/7K|2|13|P|G:11:11|Q:w:;b:";
    const marineRank4Hp3 =
      "SCFEN|8/8/8/4k3/6P1/8/8/7K|2|33|P|G:11:11|Q:w:;b:";
    expect(
      resolveTutorialLine({
        stageId: "king",
        storyId: "king-hunt-live",
        scfen: twoEnemyPawns,
      }),
    ).toEqual({
      comment: "Stop the enemy pawns! \nRemember the Hoverbike's mines",
      emotion: "shocked",
    });
    expect(
      resolveTutorialLine({
        stageId: "king",
        storyId: "king-hunt-live",
        scfen: oneEnemyPawn,
      }),
    ).toEqual({ comment: "", emotion: "happy" });
    expect(
      resolveTutorialLine({
        stageId: "king",
        storyId: "king-hunt-live",
        scfen: marineRank5Hp3,
      }),
    ).toEqual({
      comment:
        "Yes, keep pushing your Marine. \nRemember Gas gives you an extra step!",
      emotion: "happy",
    });
    expect(
      resolveTutorialLine({
        stageId: "king",
        storyId: "king-hunt-live",
        scfen: marineRank5Hp1,
      }),
    ).toEqual({
      comment: "Another hit and it's done",
      emotion: "thinking",
    });
    expect(
      resolveTutorialLine({
        stageId: "king",
        storyId: "king-hunt-live",
        scfen: marineRank4Hp3,
      }),
    ).toEqual({ comment: "", emotion: "happy" });
  });
});
