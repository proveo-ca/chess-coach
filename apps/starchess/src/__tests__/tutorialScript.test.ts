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
import type { TutorialLine, TutorialSectionId } from "~/types/tutorial";
import {
  FOG_MOVE_KING_START_SCFEN,
  FOG_MOVE_PAWN_START_SCFEN,
  FOG_MOVE_KNIGHT_START_SCFEN,
} from "~/demos/fogMoveSamples";

const storyOf = (stageId: TutorialSectionId, storyId: string) => {
  const story = tutorialStory(stageId, storyId);
  if (!story) throw new Error(`No tutorial story ${stageId}/${storyId}`);
  return story;
};

/** One scripted overlay line — the reaction shape the config declares. */
type ScriptedReaction = NonNullable<ReturnType<typeof storyOf>["reactions"]>[number];

/**
 * Labels a story's reactions in resolver order (first match wins). Tests then say
 * *which* scripted line should show — `r.checked`, `r.cornered` — instead of
 * quoting it. Copy edits stay in `tutorialScript.config.ts`; a reorder or a new
 * reaction trips the length guard here, because both change what the player sees.
 */
const namedReactions = <N extends string>(
  stageId: TutorialSectionId,
  storyId: string,
  ...names: readonly N[]
): Record<N, ScriptedReaction> => {
  const list = storyOf(stageId, storyId).reactions ?? [];
  if (list.length !== names.length) {
    throw new Error(
      `${stageId}/${storyId} has ${list.length} reactions, named ${names.length}: ${names.join(", ")}`,
    );
  }
  return Object.fromEntries(names.map((n, i) => [n, list[i]!])) as Record<
    N,
    ScriptedReaction
  >;
};

/** The scripted reaction claimed the bubble — its text, emotion, and CTA. */
const expectReaction = (line: TutorialLine, reaction: ScriptedReaction) => {
  expect(line.source).toBe("reaction");
  expect(line.comment).toBe(reaction.comment);
  if (reaction.emotion) expect(line.emotion).toBe(reaction.emotion);
  expect(line.action).toEqual(reaction.action);
};

/** No reaction matched — the story's own opening line is showing. */
const expectIntro = (
  line: TutorialLine,
  stageId: TutorialSectionId,
  storyId: string,
) => {
  const story = storyOf(stageId, storyId);
  expect(line.source).toBe("intro");
  expect(line.comment).toBe(story.comment);
  expect(line.emotion).toBe(story.emotion);
};

describe("tutorialScript", () => {
  const FOG_KNIGHT = namedReactions("fog", "knight", "sawIt", "moveToG5");
  const FOG_BISHOP = namedReactions("fog", "bishop", "kingOnFire", "pawnBlocks");
  const KING_HUNT = namedReactions(
    "king",
    "king-hunt",
    "checked",
    "shouldHaveDeployed",
    "enemyDown",
  );
  const KING_HUNT_LIVE = namedReactions(
    "king",
    "king-hunt-live",
    "ownCcDead",
    "enemyDown",
    "stopEnemyPawns",
    "pushMarine",
    "checked",
    "oneMoreHit",
    "intentTipTurn1",
    "minesTipTurn2",
  );

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
    const king = storyOf("fog", "king").completeWhen;
    const pawn = storyOf("fog", "pawn").completeWhen;
    const knight = storyOf("fog", "knight").completeWhen;
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
    const ship = storyOf("specials", "ship");
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
    expectIntro(
      resolveTutorialLine({ stageId: "fog", storyId: "king" }),
      "fog",
      "king",
    );
  });

  it("overrides with a review-phase reaction", () => {
    const r = namedReactions(
      "resolve",
      "combat-chain",
      "checkPhase",
      "intentPhase",
      "resolvePhase",
      "timelinePlaying",
    );
    expectReaction(
      resolveTutorialLine({
        stageId: "resolve",
        storyId: "combat-chain",
        reviewPhase: "intent",
      }),
      r.intentPhase,
    );
  });

  it("overrides with chess-skin reaction on fog stories", () => {
    const r = namedReactions("fog", "mine", "chessSkin");
    expectReaction(
      resolveTutorialLine({
        stageId: "fog",
        storyId: "mine",
        chessSkin: true,
      }),
      r.chessSkin,
    );
  });

  it("fires the fog/pawn 7th-rank promote tease via SCFEN regex", () => {
    const r = namedReactions("fog", "pawn", "promoteTease");
    const on7 = "SCFEN|7k/3P4/8/8/8/8/8/K7|0|33|P|G:11:11|Q:w:;b:";
    const on4 = "SCFEN|7k/8/8/8/3P4/8/8/K7|0|33|P|G:11:11|Q:w:;b:";
    expectReaction(
      resolveTutorialLine({ stageId: "fog", storyId: "pawn", scfen: on7 }),
      r.promoteTease,
    );
    expectIntro(
      resolveTutorialLine({ stageId: "fog", storyId: "pawn", scfen: on4 }),
      "fog",
      "pawn",
    );
  });

  it("holdTutorialLine keeps intro only before action, then sticks reactions", () => {
    const seed = "SCFEN|7k/6p1/8/8/3B4/8/8/K7|0|33|P|G:11:11|Q:w:;b:";
    const key = "fog|bishop";
    let hold = { lessonKey: "", introDone: false as boolean };
    const intro = resolveTutorialLine({
      stageId: "fog",
      storyId: "bishop",
      scfen: seed,
    });
    let step = holdTutorialLine(hold, key, intro, { scfen: seed });
    hold = step.hold;
    expectIntro(step.line, "fog", "bishop");

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
    expectReaction(step.line, FOG_BISHOP.pawnBlocks);

    // Resolve ends — no reaction match; must NOT bounce to intro.
    step = holdTutorialLine(
      hold,
      key,
      resolveTutorialLine({ stageId: "fog", storyId: "bishop", scfen: seed }),
      { scfen: seed, reviewPhase: "intent" },
    );
    expectReaction(step.line, FOG_BISHOP.pawnBlocks);
  });

  it("marks fog/knight hops e6 then g5 from SCFEN hints", () => {
    const hints = storyOf("fog", "knight").hints;
    const start = "SCFEN|7k/7p/8/8/3N4/8/8/K7|0|33|P|G:11:11|Q:w:;b:";
    const onE6 = "SCFEN|7k/7p/4N3/8/8/8/8/K7|0|33|P|G:11:11|Q:w:;b:";
    // Live resolve encodes Ng5 as `6N1` (not `5N2`).
    const onG5 = "SCFEN|7k/7p/8/6N1/8/8/8/K7|2|33|P|G:00:11|Q:w:;b:";
    expect(resolveTutorialHints(hints, start)).toEqual(["e6"]);
    expect(resolveTutorialHints(hints, onE6)).toEqual(["g5"]);
    expect(resolveTutorialHints(hints, onG5)).toEqual([]);
    expectReaction(
      resolveTutorialLine({ stageId: "fog", storyId: "knight", scfen: onE6 }),
      FOG_KNIGHT.moveToG5,
    );
    expectReaction(
      resolveTutorialLine({ stageId: "fog", storyId: "knight", scfen: onG5 }),
      FOG_KNIGHT.sawIt,
    );
  });

  it("fires specials/marine cheer when gas is queued before or after move", () => {
    const r = namedReactions("specials", "marine", "gasQueued");
    const gasOnly =
      "SCFEN|7k/8/8/8/8/4P3/3P4/4K3|1|33|P|G:01:11|Q:w:B=pawnDouble:d2:d3;b:";
    const gasThenMove =
      "SCFEN|7k/8/8/8/8/4P3/3P4/4K3|1|33|P|G:01:11|Q:w:B=pawnDouble:d2:d3,C=d3d4;b:";
    const moveThenGas =
      "SCFEN|7k/8/8/8/8/4P3/3P4/4K3|1|33|P|G:01:11|Q:w:C=d2d4,F=pawnDouble:d2:d3;b:";
    const moveOnly =
      "SCFEN|7k/8/8/8/8/4P3/3P4/4K3|1|33|P|G:11:11|Q:w:C=d2d4;b:";
    for (const scfen of [gasOnly, gasThenMove, moveThenGas]) {
      expectReaction(
        resolveTutorialLine({
          stageId: "specials",
          storyId: "marine",
          scfen,
        }),
        r.gasQueued,
      );
    }
    expectIntro(
      resolveTutorialLine({
        stageId: "specials",
        storyId: "marine",
        scfen: moveOnly,
      }),
      "specials",
      "marine",
    );

    const complete = storyOf("specials", "marine").completeWhen;
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
    expectIntro(
      resolveTutorialLine({
        stageId: "king",
        storyId: "king-hunt-live",
        turn: 1,
      }),
      "king",
      "king-hunt-live",
    );
    expectReaction(
      resolveTutorialLine({
        stageId: "king",
        storyId: "king-hunt-live",
        turn: 1,
        reviewPhase: "intent",
      }),
      KING_HUNT_LIVE.intentTipTurn1,
    );
    expectReaction(
      resolveTutorialLine({
        stageId: "king",
        storyId: "king-hunt-live",
        turn: 2,
      }),
      KING_HUNT_LIVE.minesTipTurn2,
    );
  });

  it("fires king-hunt lines from white/black kingLives digits in SCFEN", () => {
    const at2 = "SCFEN|k7/8/6r1/2n5/3K4/8/7b/8|1|23|P|G:11:11|Q:w:;b:";
    const at1 = "SCFEN|k7/8/6r1/2n5/2K5/8/7b/8|2|13|P|G:11:11|Q:w:;b:";
    const allyDead = "SCFEN|k7/8/6r1/2n5/2K5/8/7b/8|3|03|P|G:11:11|Q:w:;b:";
    const enemyDead = "SCFEN|8/8/8/2N5/4k3/8/7B/7K|2|30|P|G:11:11|Q:w:;b:";
    expectReaction(
      resolveTutorialLine({ stageId: "king", storyId: "king-hunt", scfen: at2 }),
      KING_HUNT.checked,
    );
    expectReaction(
      resolveTutorialLine({ stageId: "king", storyId: "king-hunt", scfen: at1 }),
      KING_HUNT.shouldHaveDeployed,
    );
    // Observer lesson: an ally CC dying has no line of its own, so the intro holds.
    expectIntro(
      resolveTutorialLine({
        stageId: "king",
        storyId: "king-hunt",
        scfen: allyDead,
      }),
      "king",
      "king-hunt",
    );
    // Live lesson: the same board offers a retry CTA instead.
    expectReaction(
      resolveTutorialLine({
        stageId: "king",
        storyId: "king-hunt-live",
        scfen: allyDead,
      }),
      KING_HUNT_LIVE.ownCcDead,
    );
    expect(KING_HUNT_LIVE.ownCcDead.action).toMatchObject({
      kind: "retryLesson",
    });
    expectReaction(
      resolveTutorialLine({
        stageId: "king",
        storyId: "king-hunt-live",
        scfen: enemyDead,
      }),
      KING_HUNT_LIVE.enemyDown,
    );
  });

  it("fires king-hunt-live tips for enemy pawns and Marine on rank 5", () => {
    const twoEnemyPawns = "SCFEN|8/1p1p4/8/4k3/8/8/8/7K|2|33|P|G:11:11|Q:w:;b:";
    const oneEnemyPawn = "SCFEN|8/1p6/8/4k3/8/8/8/7K|2|33|P|G:11:11|Q:w:;b:";
    const marineRank5Hp3 = "SCFEN|8/8/8/4k1P1/8/8/8/7K|2|33|P|G:11:11|Q:w:;b:";
    const marineRank5Hp1 = "SCFEN|8/8/8/4k1P1/8/8/8/7K|2|13|P|G:11:11|Q:w:;b:";
    const marineRank4Hp3 = "SCFEN|8/8/8/4k3/6P1/8/8/7K|2|33|P|G:11:11|Q:w:;b:";
    const lineFor = (scfen: string) =>
      resolveTutorialLine({
        stageId: "king",
        storyId: "king-hunt-live",
        scfen,
      });
    expectReaction(lineFor(twoEnemyPawns), KING_HUNT_LIVE.stopEnemyPawns);
    expectIntro(lineFor(oneEnemyPawn), "king", "king-hunt-live");
    expectReaction(lineFor(marineRank5Hp3), KING_HUNT_LIVE.pushMarine);
    expectReaction(lineFor(marineRank5Hp1), KING_HUNT_LIVE.oneMoreHit);
    expectIntro(lineFor(marineRank4Hp3), "king", "king-hunt-live");
  });

  it("handles king-defense-2 script completeWhen and coach reactions", () => {
    const r = namedReactions(
      "king",
      "king-defense-2",
      "attackTheShip",
      "cornered",
    );
    const complete = storyOf("king", "king-defense-2").completeWhen;
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
    expectReaction(
      resolveTutorialLine({
        stageId: "king",
        storyId: "king-defense-2",
        scfen: checkChipScfen,
      }),
      r.cornered,
    );

    // Same chip one turn later: the tip is gated to turn 11, so nothing shows.
    const turn12Scfen =
      "SCFEN|7k/8/8/8/8/8/6bq/6BK|12|13|P|G:22:22|B:1:1|Q:w:;b:";
    const turn12 = resolveTutorialLine({
      stageId: "king",
      storyId: "king-defense-2",
      scfen: turn12Scfen,
    });
    expect(turn12.comment).not.toBe(r.cornered.comment);
    expectIntro(turn12, "king", "king-defense-2");

    const spawnQueuedScfen =
      "SCFEN|7k/8/8/8/8/8/6bq/6BK|11|13|P|G:22:22|B:0:1|Q:w:B=spawn:h1:g2:p;b:";
    expectReaction(
      resolveTutorialLine({
        stageId: "king",
        storyId: "king-defense-2",
        scfen: spawnQueuedScfen,
      }),
      r.attackTheShip,
    );
  });

  it("grants a closing line reading time, and none when there is no line", () => {
    // Silence → the objective modal takes the bubble on the same beat.
    expect(lessonEndMessageMs("")).toBe(0);
    expect(lessonEndMessageMs("   \n ")).toBe(0);
    // Short quip still registers (floor), long line stays bounded (ceiling).
    expect(lessonEndMessageMs("one two three")).toBe(1200);
    expect(lessonEndMessageMs("one two three four five six")).toBe(1800);
    const twentyWords = Array.from({ length: 20 }, (_, i) => `word${i}`).join(
      " ",
    );
    expect(lessonEndMessageMs(twentyWords)).toBe(4000);
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
