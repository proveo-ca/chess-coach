import { describe, expect, it } from "vitest";

import {
  TUTORIAL_SCRIPT,
  adjacentTutorialStoryId,
  holdTutorialLine,
  lessonBoard,
  lessonEndMessageMs,
  matchesTutorialCompleteWhen,
  parseTutorialSection,
  resolveTutorialHints,
  resolveTutorialLine,
  resolveTutorialStoryId,
  tutorialPath,
  tutorialStory,
} from "~/tutorial/tutorialScript";
import {
  FOG_MOVE_KING_START_SCFEN,
  FOG_MOVE_PAWN_START_SCFEN,
  FOG_MOVE_KNIGHT_START_SCFEN,
} from "~/demos/fogMoveSamples";

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
    expect(TUTORIAL_SCRIPT[3]!.stories).toHaveLength(4);
    expect(TUTORIAL_SCRIPT[3]!.stories.map((s) => s.id)).toEqual([
      "king-hunt",
      "king-defense",
      "king-defense-2",
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

  it("fog completeWhen does not match seed SCFEN but matches post-goal boards", () => {
    const king = tutorialStory("fog", "king")!.completeWhen;
    const pawn = tutorialStory("fog", "pawn")!.completeWhen;
    const knight = tutorialStory("fog", "knight")!.completeWhen;
    expect(matchesTutorialCompleteWhen(king, FOG_MOVE_KING_START_SCFEN)).toBe(
      false,
    );
    expect(
      matchesTutorialCompleteWhen(
        king,
        "SCFEN|7k/7p/8/4K3/8/8/8/8|1|33|P|G:11:11|Q:w:;b:",
      ),
    ).toBe(true);
    expect(matchesTutorialCompleteWhen(pawn, FOG_MOVE_PAWN_START_SCFEN)).toBe(
      false,
    );
    expect(
      matchesTutorialCompleteWhen(
        pawn,
        "SCFEN|3Q4/8/8/8/8/8/8/K7|2|33|P|G:11:11|Q:w:;b:",
      ),
    ).toBe(true);
    expect(
      matchesTutorialCompleteWhen(knight, FOG_MOVE_KNIGHT_START_SCFEN),
    ).toBe(false);
    expect(
      matchesTutorialCompleteWhen(
        knight,
        "SCFEN|7k/7p/8/6N1/8/8/8/K7|2|33|P|G:00:11|Q:w:;b:",
      ),
    ).toBe(true);
  });

  it("ship completeWhen/restartWhen gate on the turn-21 tier-3 seed", () => {
    const ship = tutorialStory("specials", "ship")!;
    const seed = lessonBoard("specials", "ship").scfen;
    // Tactical Jump costs 3 gas → tier-3 seed at turn 21. The seed must never
    // auto-advance (queen on board, turn 21) nor restart (queen on board).
    expect(matchesTutorialCompleteWhen(ship.completeWhen, seed)).toBe(false);
    expect(matchesTutorialCompleteWhen(ship.restartWhen, seed)).toBe(false);
    // Survived the Charon (warped): turn 22, queen still on board → advance.
    expect(
      matchesTutorialCompleteWhen(
        ship.completeWhen,
        "SCFEN|k6b/8/8/8/8/8/8/Q6K|22|33|P|G:33:33|Q:w:;b:",
      ),
    ).toBe(true);
    // Died: turn 22, no queen → restart; turn-21 no-queen board must not.
    expect(
      matchesTutorialCompleteWhen(
        ship.restartWhen,
        "SCFEN|k6b/8/8/8/8/8/8/K7|22|33|P|G:33:33|Q:w:;b:",
      ),
    ).toBe(true);
    expect(
      matchesTutorialCompleteWhen(
        ship.restartWhen,
        "SCFEN|k6b/8/8/8/8/8/8/K7|21|33|P|G:31:33|Q:w:;b:",
      ),
    ).toBe(false);
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
      "hoverbike",
      "mecha",
      "ship",
      "tank",
    ]);
  });

  it("returns the story comment by default", () => {
    const line = resolveTutorialLine({ stageId: "fog", storyId: "king" });
    expect(line.comment).toMatch(/pieces move the same as Chess/i);
    expect(line.source).toBe("intro");
  });

  it("overrides with a review-phase reaction", () => {
    const line = resolveTutorialLine({
      stageId: "resolve",
      storyId: "combat-chain",
      reviewPhase: "intent",
    });
    expect(line.comment).toMatch(/promises/i);
    expect(line.emotion).toBe("watching");
    expect(line.source).toBe("reaction");
  });

  it("overrides with chess-skin reaction on fog stories", () => {
    const line = resolveTutorialLine({
      stageId: "fog",
      storyId: "mine",
      chessSkin: true,
    });
    expect(line.comment).toMatch(/lantern/i);
    expect(line.source).toBe("reaction");
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
      source: "reaction",
    });
    expect(
      resolveTutorialLine({
        stageId: "fog",
        storyId: "pawn",
        scfen: on4,
      }).comment,
    ).toMatch(/fog of war clears/i);
  });

  it("holdTutorialLine keeps intro only before action, then sticks reactions", () => {
    const seed =
      "SCFEN|7k/6p1/8/8/3B4/8/8/K7|0|33|P|G:11:11|Q:w:;b:";
    const key = "fog|bishop";
    let hold = { lessonKey: "", introDone: false as boolean };
    const intro = resolveTutorialLine({
      stageId: "fog",
      storyId: "bishop",
      scfen: seed,
    });
    let step = holdTutorialLine(hold, key, intro, { scfen: seed });
    hold = step.hold;
    expect(step.line.comment).toMatch(/capture just like Chess/i);
    expect(step.line.source).toBe("intro");

    const duringResolve = resolveTutorialLine({
      stageId: "fog",
      storyId: "bishop",
      scfen: seed,
      reviewPhase: "resolve",
    });
    step = holdTutorialLine(hold, key, duringResolve, {
      scfen: seed,
      reviewPhase: "resolve",
    });
    hold = step.hold;
    expect(step.line.comment).toMatch(/pawn blocks/i);

    // Resolve ends — no reaction match; must NOT bounce to intro.
    step = holdTutorialLine(
      hold,
      key,
      resolveTutorialLine({ stageId: "fog", storyId: "bishop", scfen: seed }),
      { scfen: seed, reviewPhase: "intent" },
    );
    expect(step.line.comment).toMatch(/pawn blocks/i);
    expect(step.line.source).toBe("reaction");
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
    ).toEqual({
      comment: "Now move to g5",
      emotion: "watching",
      source: "reaction",
    });
    expect(
      resolveTutorialLine({ stageId: "fog", storyId: "knight", scfen: onG5 }),
    ).toEqual({
      comment: "Did you see that?!",
      emotion: "shocked",
      source: "reaction",
    });
  });

  it("fires specials/marine cheer when gas is queued before or after move", () => {
    const gasOnly =
      "SCFEN|7k/8/8/8/8/4P3/3P4/4K3|1|33|P|G:01:11|Q:w:B=pawnDouble:d2:d3;b:";
    const gasThenMove =
      "SCFEN|7k/8/8/8/8/4P3/3P4/4K3|1|33|P|G:01:11|Q:w:B=pawnDouble:d2:d3,C=d3d4;b:";
    const moveThenGas =
      "SCFEN|7k/8/8/8/8/4P3/3P4/4K3|1|33|P|G:01:11|Q:w:C=d2d4,F=pawnDouble:d2:d3;b:";
    const moveOnly =
      "SCFEN|7k/8/8/8/8/4P3/3P4/4K3|1|33|P|G:11:11|Q:w:C=d2d4;b:";
    for (const scfen of [gasOnly, gasThenMove, moveThenGas]) {
      expect(
        resolveTutorialLine({
          stageId: "specials",
          storyId: "marine",
          scfen,
        }),
      ).toEqual({
        comment: "Oh, yeah!",
        emotion: "watching",
        source: "reaction",
      });
    }
    expect(
      resolveTutorialLine({
        stageId: "specials",
        storyId: "marine",
        scfen: moveOnly,
      }).comment,
    ).toMatch(/gas canister/i);

    const complete = tutorialStory("specials", "marine")!.completeWhen;
    expect(complete).toMatchObject({
      kind: "queue",
      classical: true,
      specialKind: "pawnDouble",
    });
    expect(
      matchesTutorialCompleteWhen(complete, {
        queue: [{ timing: "B", kind: "pawnDouble" }],
      }),
    ).toBe(false);
    expect(
      matchesTutorialCompleteWhen(complete, {
        queue: [{ timing: "C", kind: "classical" }],
      }),
    ).toBe(false);
    expect(
      matchesTutorialCompleteWhen(complete, {
        queue: [
          { timing: "B", kind: "pawnDouble" },
          { timing: "C", kind: "classical" },
        ],
      }),
    ).toBe(true);
    expect(
      matchesTutorialCompleteWhen(complete, {
        queue: [
          { timing: "C", kind: "classical" },
          { timing: "F", kind: "pawnDouble" },
        ],
      }),
    ).toBe(true);
  });

  it("gates king-hunt-live intro + intent tip to display turn 1", () => {
    expect(
      resolveTutorialLine({
        stageId: "king",
        storyId: "king-hunt-live",
        turn: 1,
      }),
    ).toEqual({
      comment: "The enemy King is overextended. \nPunish it!",
      emotion: "happy",
      source: "intro",
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
        "The enemy King is overextended. \nPunish it!. \nDeploy more units.",
      emotion: "watching",
      source: "reaction",
    });
    expect(
      resolveTutorialLine({
        stageId: "king",
        storyId: "king-hunt-live",
        turn: 2,
      }),
    ).toEqual({
      comment: "Prioritize planting mines with your hoverbike!",
      emotion: "watching",
      source: "reaction",
    });
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
      source: "reaction",
    });
    expect(
      resolveTutorialLine({ stageId: "king", storyId: "king-hunt", scfen: at1 }),
    ).toEqual({
      comment: "Another hit and it's done",
      emotion: "thinking",
      source: "reaction",
    });
    expect(
      resolveTutorialLine({
        stageId: "king",
        storyId: "king-hunt",
        scfen: allyDead,
      }),
    ).toEqual({
      comment:
        "We're observing live combat! \nA Command Center crumbles after 3 attacks.",
      emotion: "watching",
      source: "intro",
    });
    expect(
      resolveTutorialLine({
        stageId: "king",
        storyId: "king-hunt-live",
        scfen: allyDead,
      }),
    ).toEqual({
      comment: "Oh no! Give it another try, it's a lot to process",
      emotion: "shocked",
      action: { kind: "retryLesson", label: "Retry lesson" },
      source: "reaction",
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
      source: "reaction",
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
      comment:
        "Stop the enemy pawns! \nKeep a guard in g1 for your Command Center.",
      emotion: "shocked",
      source: "reaction",
    });
    expect(
      resolveTutorialLine({
        stageId: "king",
        storyId: "king-hunt-live",
        scfen: oneEnemyPawn,
      }),
    ).toEqual({
      comment: "The enemy King is overextended. \nPunish it!",
      emotion: "happy",
      source: "intro",
    });
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
      source: "reaction",
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
      source: "reaction",
    });
    expect(
      resolveTutorialLine({
        stageId: "king",
        storyId: "king-hunt-live",
        scfen: marineRank4Hp3,
      }),
    ).toEqual({
      comment: "The enemy King is overextended. \nPunish it!",
      emotion: "happy",
      source: "intro",
    });
  });

  it("handles king-defense-2 script completeWhen and coach reactions", () => {
    const story = tutorialStory("king", "king-defense-2");
    expect(story).toBeDefined();
    expect(story!.title).toBe("King Defense II");

    const complete = story!.completeWhen;
    const initial =
      "SCFEN|7k/8/8/8/8/8/6bq/6BK|11|33|P|G:22:22|B:1:1|Q:w:;b:";
    const mechaDeadShipAlive =
      "SCFEN|7k/8/8/8/8/8/7q/6BK|11|33|P|G:22:22|B:1:1|Q:w:;b:";
    const bothDead =
      "SCFEN|7k/8/8/8/8/8/8/6BK|11|33|P|G:22:22|B:1:1|Q:w:;b:";

    expect(matchesTutorialCompleteWhen(complete, initial)).toBe(false);
    expect(matchesTutorialCompleteWhen(complete, mechaDeadShipAlive)).toBe(false);
    expect(matchesTutorialCompleteWhen(complete, bothDead)).toBe(true);

    const checkChipScfen =
      "SCFEN|7k/8/8/8/8/8/6bq/6BK|11|13|P|G:22:22|B:1:1|Q:w:;b:";
    expect(
      resolveTutorialLine({
        stageId: "king",
        storyId: "king-defense-2",
        scfen: checkChipScfen,
      }),
    ).toEqual({
      comment:
        "Cornered! Crush the enemy mecha by deploying a Marine onto its square.",
      emotion: "shocked",
      source: "reaction",
    });

    const turn12Scfen =
      "SCFEN|7k/8/8/8/8/8/6bq/6BK|12|13|P|G:22:22|B:1:1|Q:w:;b:";
    expect(
      resolveTutorialLine({
        stageId: "king",
        storyId: "king-defense-2",
        scfen: turn12Scfen,
      }).comment,
    ).not.toBe(
      "Cornered! Crush the enemy mecha by deploying a Marine onto its square.",
    );

    const spawnQueuedScfen =
      "SCFEN|7k/8/8/8/8/8/6bq/6BK|11|13|P|G:22:22|B:0:1|Q:w:B=spawn:h1:g2:p;b:";
    expect(
      resolveTutorialLine({
        stageId: "king",
        storyId: "king-defense-2",
        scfen: spawnQueuedScfen,
      }),
    ).toEqual({
      comment: "Now, queue an attack on that ship with your Command Center",
      emotion: "watching",
      source: "reaction",
    });
  });

  it("grants a closing line reading time, and none when there is no line", () => {
    // Silence → the objective modal takes the bubble on the same beat.
    expect(lessonEndMessageMs("")).toBe(0);
    expect(lessonEndMessageMs("   \n ")).toBe(0);
    // Short quip still registers (floor), long line stays bounded (ceiling).
    expect(lessonEndMessageMs("Did you see that?!")).toBe(1200);
    expect(lessonEndMessageMs("one two three four five six")).toBe(1800);
    expect(
      lessonEndMessageMs(
        "This is the immobile rook mode; it has the biggest range. \nIt reveals the entire board when in the center!",
      ),
    ).toBe(4000);
  });

  it("gives every lesson closing line a hold shorter than the tutorial's patience", () => {
    for (const stage of TUTORIAL_SCRIPT) {
      for (const story of stage.stories) {
        for (const r of story.reactions ?? []) {
          const ms = lessonEndMessageMs(r.comment);
          expect(ms).toBeGreaterThan(0);
          expect(ms).toBeLessThanOrEqual(4000);
        }
      }
    }
  });
});
