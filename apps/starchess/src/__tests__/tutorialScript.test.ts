import {
  addScAction,
  adjutant,
  beginScTurn,
  endScTurn,
  formatScFen,
  collectLegalKingChecks,
  getSideVision,
  getUnitVision,
  parseScFen,
  placementToMap,
  rayBetween,
  refillTurnGas,
  scMovesFrom,
  type ScActionInput,
} from "@chess-coach/starchess-core";
import { describe, expect, it } from "vitest";

import {
  TUTORIAL_SCRIPT,
  adjacentTutorialStoryId,
  holdTutorialLine,
  lessonBoard,
  lessonEndMessageMs,
  matchesTutorialCompleteWhen,
  parseTutorialSection,
  resolveTutorialArrows,
  resolveTutorialHints,
  resolveTutorialLine,
  resolveTutorialStoryId,
  tutorialPath,
  tutorialStage,
  tutorialStory,
} from "~/tutorial/tutorialScript";
import { availableTrajectories, coveredEnemyShips } from "~/tutorial/lessonTactics";
import type { TutorialLine, TutorialSectionId } from "~/types/tutorial";
import {
  FOG_MOVE_KING_START_SCFEN,
  FOG_MOVE_PAWN_START_SCFEN,
  FOG_MOVE_KNIGHT_START_SCFEN,
} from "~/demos/fogMoveSamples";
import {
  occupancyForQueuedMoves,
  pieceAtQueuedSquare,
} from "~/presentation/specials/planning/occupancy";

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
    "resolve",
    "king-hunt",
    "checked",
    "shouldHaveDeployed",
    "enemyDown",
  );
  const KING_ATTACK_3 = namedReactions(
    "king",
    "king-attack-3",
    "ownCcDead",
    "enemyDown",
    "attackF3Queued",
    "f3Marine",
    "promoThreat",
    "e1n",
    "e1k",
    "e1r",
    "e1b",
    "f1n",
    "f1k",
    "f1r",
    "f1b",
    "g1n",
    "g1k",
    "g1r",
    "g1b",
    "deployMecha",
    "mineC2",
    "b4attack",
    "g1Ship",
    "e1Ship",
    "f1Ship",
    "d5b4spot",
    "gasReminder",
    "pushH2",
    "pushH3",
    "pushH4",
    "pushH7",
    "guardG1",
    "oneMoreCheck",
    "checked",
    "oneMoreHit",
    "centralize",
    "queuedReview",
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
    expect(TUTORIAL_SCRIPT[2]!.stories).toHaveLength(2);
    expect(TUTORIAL_SCRIPT[2]!.stories.map((s) => s.id)).toEqual([
      "combat-chain",
      "king-hunt",
    ]);
    expect(TUTORIAL_SCRIPT[3]!.stories).toHaveLength(9);
    expect(TUTORIAL_SCRIPT[3]!.stories.map((s) => s.id)).toEqual([
      "king-defense",
      "king-defense-2",
      "king-defense-3",
      "king-defense-4",
      "king-defense-5",
      "king-defense-6",
      "king-attack-1",
      "king-attack-2",
      "king-attack-3",
    ]);
  });

  it("builds deep links from stage + story ids", () => {
    expect(tutorialPath("fog", "king")).toBe("/tutorial/fog/king");
    expect(tutorialPath("specials", "marine")).toBe("/tutorial/specials/marine");
    expect(tutorialPath("resolve")).toBe("/tutorial/resolve/combat-chain");
    expect(tutorialPath("king", "king-attack-3")).toBe(
      "/tutorial/king/king-attack-3",
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

  it("keeps the story's own line when the skin flips to Chess", () => {
    // Fog lessons play the skin toggle themselves on open (TutorialScreen's
    // demo), so a skin-keyed reaction would fire on every load and bury the
    // lesson's instruction. No fog story carries one.
    for (const storyId of ["king", "mine"] as const) {
      expectIntro(
        resolveTutorialLine({ stageId: "fog", storyId, chessSkin: true }),
        "fog",
        storyId,
      );
    }
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

  it("holdTutorialLine keeps the intro across turn-open bookkeeping", () => {
    // Turn-open refills gas and applies standing check damage, so on a seed
    // whose gas is mid-turn the SCFEN moves on mount with no player input.
    // king/king-attack-1 is that seed: Black's gas reads 0, spent on its queued
    // mine, and turn-open puts it back to 2. Arming the planning timer used to
    // retire the opening line unread, which is why the timer was disabled here.
    const seed = lessonBoard("king", "king-attack-1").scfen;
    const seedSnap = parseScFen(seed);
    const openedSnap = beginScTurn(seedSnap).next;
    // The wire the narration store publishes once turn-open lands. Note it is
    // not re-parseable: `refillTurnGas` hands Black back gas its queued mine
    // already spent, so the string trips `assertQueueGas`. That is the rules
    // engine's business — what matters here is that the wire *moved*.
    const opened = formatScFen(openedSnap);
    expect(seedSnap.gas).toEqual({ w: 2, b: 0 });
    expect(openedSnap.gas).toEqual({ w: 2, b: 2 });
    expect(opened).not.toBe(seed);

    const key = "king|king-attack-1";
    const lineFor = (scfen: string) =>
      resolveTutorialLine({
        stageId: "king",
        storyId: "king-attack-1",
        scfen,
      });

    // Mount: the pre-turn-open seed is the baseline, intro on screen.
    let step = holdTutorialLine(
      { lessonKey: "", introDone: false },
      key,
      lineFor(seed),
      { scfen: seed, turnStartChecksApplied: false },
    );
    expectIntro(step.line, "king", "king-attack-1");

    // Turn-open lands: the SCFEN moved, but no one played a move — the line
    // must survive, and the opened board becomes the new baseline.
    step = holdTutorialLine(step.hold, key, lineFor(opened), {
      scfen: opened,
      turnStartChecksApplied: true,
    });
    expectIntro(step.line, "king", "king-attack-1");
    expect(step.hold.baselineScfen).toBe(opened);

    // Queueing an actual action moves the board for real, and that still
    // retires the intro — the re-baseline must not swallow a player's move.
    const played = formatScFen(
      addScAction({
        snapshot: openedSnap,
        action: {
          timing: "C",
          kind: "classical",
          color: "w",
          from: "g1",
          to: "f1",
        } satisfies ScActionInput,
      }).snapshot,
    );
    expect(played).not.toBe(opened);
    step = holdTutorialLine(step.hold, key, lineFor(opened), {
      scfen: played,
      turnStartChecksApplied: true,
    });
    expect(step.hold.introDone).toBe(true);
    expect(step.line.comment).toBe("");

    // A later turn re-opens too. That flip must NOT re-baseline: the intro is
    // spent, and reviving it would bounce the bubble back to the opening line.
    const revived = holdTutorialLine(step.hold, key, lineFor(opened), {
      scfen: played,
      turnStartChecksApplied: false,
    });
    const reopened = holdTutorialLine(revived.hold, key, lineFor(opened), {
      scfen: played,
      turnStartChecksApplied: true,
    });
    expect(reopened.hold.baselineScfen).toBe(opened);
    expect(reopened.line.comment).toBe("");
  });

  it("no-ops for hosts that do not report turn-open", () => {
    // The review / typewriter hosts publish narration without the flag. They
    // must keep the pre-existing "any SCFEN move retires the intro" behavior.
    const seed = lessonBoard("king", "king-attack-1").scfen;
    const key = "king|king-attack-1";
    const line = resolveTutorialLine({
      stageId: "king",
      storyId: "king-attack-1",
      scfen: seed,
    });

    const mounted = holdTutorialLine({ lessonKey: "", introDone: false }, key, line, {
      scfen: seed,
    });
    expect(mounted.hold.checksApplied).toBeUndefined();
    expectIntro(mounted.line, "king", "king-attack-1");

    const moved = holdTutorialLine(mounted.hold, key, line, {
      scfen: seed.replace("|G:20:22|", "|G:21:22|"),
    });
    expect(moved.hold.introDone).toBe(true);
    expect(moved.line.comment).toBe("");
  });

  it("arms the planning timer on every King lesson", () => {
    // Stage 4 teaches under clock pressure — a lesson with `armTimer: false`
    // leaves the sidebar gauge parked at 0, which reads as a broken timer.
    const king = tutorialStage("king");
    expect(
      king.stories
        .filter((s) => s.board?.armTimer === false)
        .map((s) => s.id),
    ).toEqual([]);
  });

  it("marks fog/knight hops e6 then g5 from SCFEN hints", () => {
    const hints = storyOf("fog", "knight").hints;
    const start = "SCFEN|7k/7p/8/8/3N4/8/8/K7|0|33|P|G:11:11|Q:w:;b:";
    const onE6 = "SCFEN|7k/7p/4N3/8/8/8/8/K7|0|33|P|G:11:11|Q:w:;b:";
    // Live resolve encodes Ng5 as `6N1` (not `5N2`).
    const onG5 = "SCFEN|7k/7p/8/6N1/8/8/8/K7|2|33|P|G:00:11|Q:w:;b:";
    expect(resolveTutorialHints(hints, start)).toEqual(["e6"]);
    // On e6 the line also points at the corner the hop is about to reveal.
    expect(resolveTutorialHints(hints, onE6)).toEqual(["g5", "h8"]);
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

  it("separates specials/mecha arming from the queued snipe", () => {
    const r = namedReactions(
      "specials",
      "mecha",
      "shootsUpDown",
      "snipeQueued",
      "arming",
    );
    const seed = lessonBoard("specials", "mecha").scfen;
    const line = (ctx: { scfen?: string; targetingKind?: string | null }) =>
      resolveTutorialLine({ stageId: "specials", storyId: "mecha", ...ctx });

    // 1 — seed, nothing armed: the opener asks for the two canisters.
    expectIntro(line({ scfen: seed }), "specials", "mecha");

    // 2 — gas landed, no target picked. This lives only in UI targeting state,
    //     never in SCFEN, so the board still reads as the seed.
    expectReaction(line({ scfen: seed, targetingKind: "bishopSnipe" }), r.arming);

    // 3 — target clicked: the snipe is on the queue and targeting has cleared.
    const queued =
      "SCFEN|k6q/8/4P3/4p3/3B4/8/8/K7|11|33|P|G:02:22|B:0:3|Q:w:B=bishopSnipe:d4:h8;b:";
    expectReaction(line({ scfen: queued }), r.snipeQueued);

    // A different armed special must not borrow the Mecha's line.
    expectIntro(line({ scfen: seed, targetingKind: "queenWarp" }), "specials", "mecha");

    // Success is unchanged — the Mecha capturing the Marine on e5.
    const complete = storyOf("specials", "mecha").completeWhen;
    expect(matchesTutorialCompleteWhen(complete, seed)).toBe(false);
    expect(
      matchesTutorialCompleteWhen(
        complete,
        "SCFEN|k7/8/4P3/4B3/8/8/8/K7|12|33|P|G:02:22|Q:w:;b:",
      ),
    ).toBe(true);
  });

  it("walks specials/hoverbike through its four beats across two turns", () => {
    const r = namedReactions(
      "specials",
      "hoverbike",
      "gasThenMove",
      "newTurnMove",
      "mineQueued",
      "gasStillNeeded",
    );
    const t1 = "SCFEN|4k3/8/8/8/3N4/8/8/4K3|1|33|P|G:11:11|Q:w:";
    const t2 = "SCFEN|4k3/8/8/8/4N3/8/8/4K3|2|33|P|G:11:11|M:w:d4|Q:w:";
    const line = (scfen: string) =>
      resolveTutorialLine({ stageId: "specials", storyId: "hoverbike", scfen });

    // 1 — seed: the opener asks for gas.
    expectIntro(line(`${t1};b:`), "specials", "hoverbike");
    // 2 — gas queued on turn 1.
    expectReaction(line(`${t1}B=knightMine:d4:d4;b:`), r.mineQueued);
    // 3 — turn 2 opens: move first this time.
    expectReaction(line(`${t2};b:`), r.newTurnMove);
    // 4 — move queued on turn 2: now the canister.
    expectReaction(line(`${t2}C=e4f6;b:`), r.gasThenMove);

    // Off-script orders still coach rather than going silent.
    expectReaction(line(`${t1}C=d4e6;b:`), r.gasStillNeeded);
    expectReaction(line(`${t2}B=knightMine:e4:e4;b:`), r.newTurnMove);

    // Success stays "two mines resolved", and one mine is not enough.
    const complete = storyOf("specials", "hoverbike").completeWhen;
    expect(matchesTutorialCompleteWhen(complete, `${t2};b:`)).toBe(false);
    expect(
      matchesTutorialCompleteWhen(
        complete,
        "SCFEN|4k3/8/8/8/8/5N2/8/4K3|3|33|P|G:11:11|M:w:d4e4|Q:w:;b:",
      ),
    ).toBe(true);
  });

  it("defers King Damage on specials/cc only when the ENEMY CC is chipped", () => {
    const r = namedReactions("specials", "cc", "kingDamageLater");
    const at = (lives: string) =>
      `SCFEN|r6k/8/8/8/3K4/8/8/7R|2|${lives}|P|G:01:11|Q:w:;b:`;
    // SCFEN lives field is `<white><black>` — black is the enemy here.
    for (const lives of ["32", "22"]) {
      expectReaction(
        resolveTutorialLine({ stageId: "specials", storyId: "cc", scfen: at(lives) }),
        r.kingDamageLater,
      );
    }
    // Untouched enemy, our own CC chipped, or enemy already past 2: no line.
    for (const lives of ["33", "23", "31"]) {
      expectIntro(
        resolveTutorialLine({ stageId: "specials", storyId: "cc", scfen: at(lives) }),
        "specials",
        "cc",
      );
    }
  });

  it("walks specials/marine through move+gas, then gas+ghost across two turns", () => {
    const r = namedReactions(
      "specials",
      "marine",
      "gasGhost",
      "gasCheer",
      "slipAway",
      "moveQueued",
    );
    const t1 = "SCFEN|7k/8/8/8/8/4P3/3P4/4K3|1|33|P|G:11:11|Q:w:";
    const t2 = "SCFEN|7k/8/8/8/3P4/4P3/8/4K3|2|33|P|G:11:11|Q:w:";
    const line = (scfen: string) =>
      resolveTutorialLine({ stageId: "specials", storyId: "marine", scfen });
    const hints = (scfen: string) =>
      resolveTutorialHints(tutorialStory("specials", "marine")?.hints, scfen);
    // 1 — seed: move first, d4 ring; the queued classical holds the opener.
    expectIntro(line(`${t1};b:`), "specials", "marine");
    expect(hints(`${t1};b:`)).toEqual(["d4"]);
    expectReaction(line(`${t1}C=d2d4;b:`), r.moveQueued);
    expect(hints(`${t1}C=d2d4;b:`)).toEqual(["d4"]);
    // Gas on turn 1 cheers without leaving the window.
    expectReaction(line(`${t1}B=pawnDouble:d2:d3;b:`), r.gasCheer);
    expectReaction(line(`${t1}C=d2d4,F=pawnDouble:d2:d3;b:`), r.gasCheer);
    // 2 — second window: the slip-away teach, e3 ring.
    expectReaction(line(`${t2};b:`), r.slipAway);
    expect(hints(`${t2};b:`)).toEqual(["e3"]);
    // Gas queued on e3 — the ghost beat wins over the turn beat, e5 ring.
    expectReaction(line(`${t2}B=pawnDouble:e3:e4;b:`), r.gasGhost);
    expect(hints(`${t2}B=pawnDouble:e3:e4;b:`)).toEqual(["e5"]);
    // Off-script classical on turn 2 restates the gas ask.
    expectReaction(line(`${t2}C=e3e4;b:`), r.slipAway);
    // A King move is not a Marine move — no beat fires on it.
    expectIntro(
      resolveTutorialLine({
        stageId: "specials",
        storyId: "marine",
        scfen: "SCFEN|7k/8/8/8/8/4P3/3P4/4K3|1|33|P|G:11:11|B:0:3|Q:w:C=e1e2;b:",
      }),
      "specials",
      "marine",
    );
    // The lesson ends on the third window, not on a stacked queue.
    const complete = storyOf("specials", "marine").completeWhen;
    expect(
      matchesTutorialCompleteWhen(
        complete,
        "SCFEN|7k/8/8/8/3P4/4P3/8/4K3|2|33|P|G:11:11|B:0:3|Q:w:B=pawnDouble:e3:e4,C=e4e5;b:",
      ),
    ).toBe(false);
    expect(
      matchesTutorialCompleteWhen(
        complete,
        "SCFEN|7k/8/8/8/8/4P3/3P4/4K3|3|33|P|G:11:11|Q:w:;b:",
      ),
    ).toBe(true);
  });

  it("gates king-attack-3 intro + intent tip to display turn 1", () => {
    expectIntro(
      resolveTutorialLine({
        stageId: "king",
        storyId: "king-attack-3",
        turn: 1,
      }),
      "king",
      "king-attack-3",
    );
    expectReaction(
      resolveTutorialLine({
        stageId: "king",
        storyId: "king-attack-3",
        turn: 1,
        reviewPhase: "intent",
      }),
      KING_ATTACK_3.intentTipTurn1,
    );
    expectReaction(
      resolveTutorialLine({
        stageId: "king",
        storyId: "king-attack-3",
        scfen: "SCFEN|8/8/8/8/4k3/5P2/6P1/4N1BK|1|33|P|G:11:11|Q:w:;b:",
      }),
      KING_ATTACK_3.minesTipTurn2,
    );
    expectIntro(
      resolveTutorialLine({
        stageId: "king",
        storyId: "king-attack-3",
        scfen: "SCFEN|8/8/8/8/4k3/5P2/6P1/4N1BK|1|33|P|G:01:11|Q:w:;b:",
      }),
      "king",
      "king-attack-3",
    );
  });

  it("fires king-hunt lines from white/black kingLives digits in SCFEN", () => {
    const at2 = "SCFEN|k7/8/6r1/2n5/3K4/8/7b/8|1|23|P|G:11:11|Q:w:;b:";
    const at1 = "SCFEN|k7/8/6r1/2n5/2K5/8/7b/8|2|13|P|G:11:11|Q:w:;b:";
    const allyDead = "SCFEN|k7/8/6r1/2n5/2K5/8/7b/8|3|03|P|G:11:11|Q:w:;b:";
    const enemyDead = "SCFEN|8/8/8/2N5/4k3/8/7B/7K|2|30|P|G:11:11|Q:w:;b:";
    expectReaction(
      resolveTutorialLine({ stageId: "resolve", storyId: "king-hunt", scfen: at2 }),
      KING_HUNT.checked,
    );
    expectReaction(
      resolveTutorialLine({ stageId: "resolve", storyId: "king-hunt", scfen: at1 }),
      KING_HUNT.shouldHaveDeployed,
    );
    // Observer lesson: an ally CC dying has no line of its own, so the intro holds.
    expectIntro(
      resolveTutorialLine({
        stageId: "resolve",
        storyId: "king-hunt",
        scfen: allyDead,
      }),
      "resolve",
      "king-hunt",
    );
    // Live lesson: the same board offers a retry CTA instead.
    expectReaction(
      resolveTutorialLine({
        stageId: "king",
        storyId: "king-attack-3",
        scfen: allyDead,
      }),
      KING_ATTACK_3.ownCcDead,
    );
    expect(KING_ATTACK_3.ownCcDead.action).toMatchObject({
      kind: "retryLesson",
    });
    expectReaction(
      resolveTutorialLine({
        stageId: "king",
        storyId: "king-attack-3",
        scfen: enemyDead,
      }),
      KING_ATTACK_3.enemyDown,
    );
  });

  it("fires king-attack-3 push lines with the guard beat", () => {
    const oneEnemyPawn = "SCFEN|8/1p6/8/4k3/8/8/8/6BK|2|33|P|G:11:11|Q:w:;b:";
    const marineRank5Hp3 = "SCFEN|8/8/8/4k1P1/8/8/8/6BK|2|33|P|G:11:11|Q:w:;b:";
    const marineRank5Hp1 = "SCFEN|8/8/8/4k1P1/8/8/8/6BK|2|13|P|G:11:11|Q:w:;b:";
    const marineRank4Hp3 = "SCFEN|8/8/8/4k3/6P1/8/8/6BK|2|33|P|G:11:11|Q:w:;b:";
    const lineFor = (scfen: string) =>
      resolveTutorialLine({
        stageId: "king",
        storyId: "king-attack-3",
        scfen,
      });
    expectIntro(lineFor(oneEnemyPawn), "king", "king-attack-3");
    expectIntro(lineFor(marineRank5Hp3), "king", "king-attack-3");
    expectReaction(lineFor(marineRank5Hp1), KING_ATTACK_3.oneMoreHit);
    expectIntro(lineFor(marineRank4Hp3), "king", "king-attack-3");
  });

  it("fires king-attack-3 threat lines with matching rings", () => {
    const story = storyOf("king", "king-attack-3");
    const lineFor = (scfen: string) =>
      resolveTutorialLine({
        stageId: "king",
        storyId: "king-attack-3",
        scfen,
      });
    const f3 =
      "SCFEN|8/8/8/8/4k3/5p2/6P1/4N1BK|1|33|P|G:11:11|Q:w:;b:";
    expectReaction(lineFor(f3), KING_ATTACK_3.f3Marine);
    expect(resolveTutorialHints(story.hints, f3)).toEqual(["f3"]);
    const f3attack =
      "SCFEN|8/8/8/8/4k3/5p2/6P1/4N1BK|1|33|P|G:11:11|B:0:3|Q:w:C=g2f3;b:";
    expectReaction(lineFor(f3attack), KING_ATTACK_3.attackF3Queued);
    expect(resolveTutorialHints(story.hints, f3attack)).toEqual(["g2"]);
    expect(resolveTutorialArrows(story.hints, f3attack)).toEqual([
      { from: "g2", to: "a8" },
    ]);
    // The live encoder, not a hand-built wire: queueing g2×f3 must be the
    // same beat the bubble and the arrow both read.
    const f3live = formatScFen(
      addScAction({
        snapshot: parseScFen(
          "SCFEN|8/8/8/8/4k3/5p2/6P1/4N1BK|1|33|P|G:11:11|B:3:3|Q:w:;b:",
        ),
        action: {
          timing: "C",
          kind: "classical",
          color: "w",
          from: "g2",
          to: "f3",
        } satisfies ScActionInput,
      }).snapshot,
    );
    expectReaction(lineFor(f3live), KING_ATTACK_3.attackF3Queued);
    expect(resolveTutorialArrows(story.hints, f3live)).toEqual([
      { from: "g2", to: "a8" },
    ]);
    const f3bikeAttack =
      "SCFEN|8/8/8/8/4k3/5p2/6P1/4N1BK|1|33|P|G:11:11|B:0:3|Q:w:C=e1f3;b:";
    expectReaction(lineFor(f3bikeAttack), KING_ATTACK_3.queuedReview);
    expect(resolveTutorialHints(story.hints, f3bikeAttack)).toEqual(["c2"]);
    const promoRank2 =
      "SCFEN|8/8/8/8/4k3/5P2/4p2/4N1BK|1|33|P|G:11:11|Q:w:;b:";
    expectReaction(lineFor(promoRank2), KING_ATTACK_3.promoThreat);
    expect(resolveTutorialHints(story.hints, promoRank2)).toEqual(["c2"]);
    const gasQueuedNoThreat =
      "SCFEN|8/8/8/8/4k3/5P2/6P1/4N1BK|1|33|P|G:11:11|B:0:3|Q:w:B=pawnDouble:h2:h3;b:";
    expectReaction(lineFor(gasQueuedNoThreat), KING_ATTACK_3.queuedReview);
    const g1ship =
      "SCFEN|8/8/8/8/4k3/K4P2/6P1/4N1q1|1|33|P|G:11:11|Q:w:;b:";
    expectReaction(lineFor(g1ship), KING_ATTACK_3.g1Ship);
    expect(resolveTutorialHints(story.hints, g1ship)).toEqual(["g1"]);
    const g1crush =
      "SCFEN|8/8/8/8/4k3/K4P2/6P1/4N1q1|1|33|P|G:11:11|B:0:3|Q:w:B=spawn:h1:g1:n;b:";
    expectReaction(lineFor(g1crush), KING_ATTACK_3.queuedReview);
    expect(resolveTutorialHints(story.hints, g1crush)).toEqual(["c2"]);
    const e1ship =
      "SCFEN|8/8/8/8/4k3/5P2/6P1/4q1BK|1|33|P|G:11:11|Q:w:;b:";
    expectReaction(lineFor(e1ship), KING_ATTACK_3.e1Ship);
    expect(resolveTutorialHints(story.hints, e1ship)).toEqual(["g2", "e1"]);
    const e1handled =
      "SCFEN|8/8/8/8/4k3/5P2/6P1/4q1BK|1|33|P|G:11:11|B:0:3|Q:w:C=g2e1;b:";
    expectReaction(lineFor(e1handled), KING_ATTACK_3.queuedReview);
    expect(resolveTutorialHints(story.hints, e1handled)).toEqual(["c2"]);
    const f1ship =
      "SCFEN|8/8/8/8/4k3/5P2/6P1/4NqBK|1|33|P|G:11:11|Q:w:;b:";
    expectReaction(lineFor(f1ship), KING_ATTACK_3.f1Ship);
    expect(resolveTutorialHints(story.hints, f1ship)).toEqual(["h2", "f1"]);
    const hp1 =
      "SCFEN|8/8/8/8/4k3/5P2/6P1/4N1BK|1|31|P|G:11:11|Q:w:;b:";
    expectReaction(
      resolveTutorialLine({
        stageId: "king",
        storyId: "king-attack-3",
        scfen: hp1,
        reviewPhase: "check",
      }),
      KING_ATTACK_3.oneMoreCheck,
    );
    expectReaction(
      resolveTutorialLine({
        stageId: "king",
        storyId: "king-attack-3",
        scfen: hp1,
        reviewPhase: "resolve",
      }),
      KING_ATTACK_3.oneMoreCheck,
    );
    expectReaction(lineFor(hp1), KING_ATTACK_3.minesTipTurn2);
    const cheerHold = holdTutorialLine(
      { lessonKey: "", introDone: false },
      "king|king-attack-3",
      resolveTutorialLine({
        stageId: "king",
        storyId: "king-attack-3",
        scfen: hp1,
        reviewPhase: "check",
      }),
      { scfen: hp1, reviewPhase: "check" },
    );
    expect(cheerHold.line.comment).toBe(KING_ATTACK_3.oneMoreCheck.comment);
    expect(cheerHold.line.transient).toBe(true);
    expect(cheerHold.hold.sticky).toBeUndefined();
    expect(cheerHold.hold.introDone).toBe(false);
    const spot =
      "SCFEN|8/8/8/3k4/1n6/5P2/6P1/4N1BK|1|33|P|G:11:11|Q:w:;b:";
    expectReaction(lineFor(spot), KING_ATTACK_3.d5b4spot);
    expect(resolveTutorialHints(story.hints, spot)).toEqual(["b4"]);
    const h2 =
      "SCFEN|8/8/8/8/4k3/5P2/7P/4N1BK|1|33|P|G:11:11|Q:w:;b:";
    expectReaction(lineFor(h2), KING_ATTACK_3.pushH2);
    expect(resolveTutorialHints(story.hints, h2)).toEqual(["h4"]);
    const h2gas =
      "SCFEN|8/8/8/8/4k3/5P2/7P/4N1BK|1|33|P|G:01:11|Q:w:;b:";
    expectIntro(lineFor(h2gas), "king", "king-attack-3");
    const h2queued =
      "SCFEN|8/8/8/8/4k3/5P2/7P/4N1BK|0|33|P|G:11:11|B:0:3|Q:w:C=h2h3;b:";
    expectReaction(lineFor(h2queued), KING_ATTACK_3.gasReminder);
    expect(resolveTutorialHints(story.hints, h2queued)).toEqual(["h4"]);
    const h3 =
      "SCFEN|8/8/8/8/4k3/7P/6P1/4N1BK|1|33|P|G:11:11|Q:w:;b:";
    expectReaction(lineFor(h3), KING_ATTACK_3.pushH3);
    expect(resolveTutorialHints(story.hints, h3)).toEqual(["h5"]);
    const h3queued =
      "SCFEN|8/8/8/8/4k3/7P/6P1/4N1BK|1|33|P|G:11:11|B:0:3|Q:w:C=h3h4;b:";
    expectReaction(lineFor(h3queued), KING_ATTACK_3.queuedReview);
    expect(resolveTutorialHints(story.hints, h3queued)).toEqual(["c2"]);
    const h4 =
      "SCFEN|8/8/8/8/7P/5P2/6P1/4N1BK|1|33|P|G:11:11|Q:w:;b:";
    expectReaction(lineFor(h4), KING_ATTACK_3.pushH4);
    expect(resolveTutorialHints(story.hints, h4)).toEqual(["h6"]);
    const h4queued =
      "SCFEN|8/8/8/8/7P/5P2/6P1/4N1BK|1|33|P|G:11:11|B:0:3|Q:w:C=h4h5;b:";
    expectReaction(lineFor(h4queued), KING_ATTACK_3.queuedReview);
    expect(resolveTutorialHints(story.hints, h4queued)).toEqual(["c2"]);
    const h6 =
      "SCFEN|8/8/7P/8/4k3/5P2/6P1/4N1BK|1|33|P|G:11:11|Q:w:;b:";
    expectReaction(lineFor(h6), KING_ATTACK_3.minesTipTurn2);
    expect(resolveTutorialHints(story.hints, h6)).toEqual(["c2"]);
    const h7 =
      "SCFEN|8/7P/8/8/4k3/5P2/6P1/4N1BK|1|33|P|G:11:11|Q:w:;b:";
    expectReaction(lineFor(h7), KING_ATTACK_3.pushH7);
    expect(resolveTutorialHints(story.hints, h7)).toEqual(["h7"]);
    const h7spent =
      "SCFEN|8/7P/8/8/4k3/5P2/6P1/4N1BK|1|33|P|G:01:11|Q:w:;b:";
    expectIntro(lineFor(h7spent), "king", "king-attack-3");
    const guard =
      "SCFEN|8/8/8/8/4k3/5P2/6P1/4N3|1|33|P|G:11:11|Q:w:;b:";
    expectReaction(lineFor(guard), KING_ATTACK_3.guardG1);
    expect(resolveTutorialHints(story.hints, guard)).toEqual(["g1"]);
    expect(resolveTutorialArrows(story.hints, guard)).toEqual([
      { from: "a1", to: "h1" },
    ]);
    const guardQueued =
      "SCFEN|8/8/8/8/4k3/5P2/6P1/4N3|1|33|P|G:11:11|B:0:3|Q:w:B=spawn:h1:g1:n;b:";
    expectReaction(lineFor(guardQueued), KING_ATTACK_3.queuedReview);
    expect(resolveTutorialHints(story.hints, guardQueued)).toEqual(["c2"]);
    const planQueued =
      "SCFEN|8/8/8/8/4k3/5P2/6P1/4N1BK|1|33|P|G:11:11|B:0:3|Q:w:C=e1c2;b:";
    expectReaction(lineFor(planQueued), KING_ATTACK_3.queuedReview);
    expect(resolveTutorialHints(story.hints, planQueued)).toEqual(["c2"]);
    const centralized =
      "SCFEN|8/8/8/8/4k3/5P2/6P1/4N1BK|0|33|P|G:01:11|B:0:3|Q:w:;b:";
    expectReaction(lineFor(centralized), KING_ATTACK_3.centralize);
    expect(resolveTutorialHints(story.hints, centralized)).toEqual(["c2"]);
  });

  it("fires king-attack-3 take-it lines when a unit already covers the ship", () => {
    const story = storyOf("king", "king-attack-3");
    const lineFor = (scfen: string) =>
      resolveTutorialLine({
        stageId: "king",
        storyId: "king-attack-3",
        scfen,
      });
    const both = (placement: string) => {
      const scfen = `SCFEN|${placement}|1|33|P|G:11:11|Q:w:;b:`;
      const covers = coveredEnemyShips(scfen, "w");
      return { scfen, covers };
    };
    const check = (
      placement: string,
      reaction: (typeof KING_ATTACK_3)[keyof typeof KING_ATTACK_3],
      ring: string[],
    ) => {
      const { scfen, covers } = both(placement);
      expectReaction(
        resolveTutorialLine({
          stageId: "king",
          storyId: "king-attack-3",
          scfen,
          covers,
        }),
        reaction,
      );
      expect(resolveTutorialHints(story.hints, scfen, covers)).toEqual(ring);
    };
    check("8/8/8/8/4k3/5P2/2N3P1/4q1BK", KING_ATTACK_3.e1n, ["e1"]);
    check("8/8/8/8/4k3/5P2/6P1/3Kq1B1", KING_ATTACK_3.e1k, ["e1"]);
    check("8/8/8/8/4k3/5P2/4R1P1/4q1BK", KING_ATTACK_3.e1r, ["e1"]);
    check("8/8/8/8/4k3/5P2/3B2P1/4q1BK", KING_ATTACK_3.e1b, ["e1"]);
    check("8/8/8/8/4k3/5P2/6PN/4NqBK", KING_ATTACK_3.f1n, ["f1"]);
    check("8/8/8/8/4k3/5P2/4K1P1/4NqBK", KING_ATTACK_3.f1k, ["f1"]);
    check("8/8/8/8/4k3/5P2/5R2/4NqBK", KING_ATTACK_3.f1r, ["f1"]);
    check("8/8/8/8/4k3/5P2/4B1P1/4NqBK", KING_ATTACK_3.f1b, ["f1"]);
    check("8/8/8/8/4k3/K4P2/4N1P1/4N1q1", KING_ATTACK_3.g1n, ["g1"]);
    check("8/8/8/8/4k3/5P2/6P1/4N1qK", KING_ATTACK_3.g1k, ["g1"]);
    check("8/8/8/8/4k3/K4P2/6P1/5Rq1", KING_ATTACK_3.g1r, ["g1"]);
    check("8/8/8/8/4k3/K4P2/5BP1/4N1q1", KING_ATTACK_3.g1b, ["g1"]);
    check("8/8/8/8/4k3/5P2/2n4/4q1BK", KING_ATTACK_3.e1Ship, ["g2", "e1"]);
    const b4post =
      "SCFEN|8/8/8/3k4/8/5P2/2N3P1/4N1BK|1|33|P|G:11:11|Q:w:;b:";
    expectReaction(lineFor(b4post), KING_ATTACK_3.mineC2);
    expect(resolveTutorialHints(story.hints, b4post)).toEqual(["c2"]);
    const b4contested =
      "SCFEN|8/8/8/3k4/1n6/5P2/2N3P1/4N1BK|1|33|P|G:11:11|Q:w:;b:";
    expectReaction(lineFor(b4contested), KING_ATTACK_3.mineC2);
    expect(resolveTutorialHints(story.hints, b4contested)).toEqual(["c2"]);
    const b4mined =
      "SCFEN|8/8/8/3k4/8/5P2/2N3P1/4N1BK|1|33|P|G:01:11|B:0:3|Q:w:B=knightMine:c2:c3;b:";
    expectReaction(lineFor(b4mined), KING_ATTACK_3.b4attack);
    expect(resolveTutorialHints(story.hints, b4mined)).toEqual(["b4"]);
    const b4noCc =
      "SCFEN|8/8/8/8/4k3/5P2/2N3P1/4N1BK|1|33|P|G:11:11|Q:w:;b:";
    expectReaction(lineFor(b4noCc), KING_ATTACK_3.minesTipTurn2);
    const b4noBike =
      "SCFEN|8/8/8/3k4/8/5P2/6P1/4N1BK|1|33|P|G:11:11|Q:w:;b:";
    expectReaction(lineFor(b4noBike), KING_ATTACK_3.minesTipTurn2);
  });

  it("prefers the funded g2 Mecha diagonal over the mine-first post", () => {
    const story = storyOf("king", "king-attack-3");
    const traj = (placement: string, bank: string) => {
      const scfen = `SCFEN|${placement}|1|33|P|G:11:11|${bank}|Q:w:;b:`;
      return { scfen, trajectories: availableTrajectories(scfen, "w") };
    };
    const funded = traj("8/8/8/3k4/8/5P2/2N4P/4N1BK", "B:3:3");
    expect(funded.trajectories).toEqual([{ key: "deploy-b-g2-d5", from: "g2", to: "d5" }]);
    expectReaction(
      resolveTutorialLine({
        stageId: "king",
        storyId: "king-attack-3",
        scfen: funded.scfen,
        trajectories: funded.trajectories,
      }),
      KING_ATTACK_3.deployMecha,
    );
    expect(
      resolveTutorialHints(story.hints, funded.scfen, undefined, funded.trajectories),
    ).toEqual(["g2", "d5"]);
    expect(
      resolveTutorialArrows(story.hints, funded.scfen, undefined, funded.trajectories),
    ).toEqual([{ from: "g2", to: "d5" }]);
    const broke = traj("8/8/8/3k4/8/5P2/2N3P1/4N1BK", "B:2:3");
    expect(broke.trajectories).toEqual([]);
    expectReaction(
      resolveTutorialLine({
        stageId: "king",
        storyId: "king-attack-3",
        scfen: broke.scfen,
        trajectories: broke.trajectories,
      }),
      KING_ATTACK_3.mineC2,
    );
    expect(
      resolveTutorialHints(story.hints, broke.scfen, undefined, broke.trajectories),
    ).toEqual(["c2"]);
  });

  it("holds the king-defense CC warning only while the Mecha is alive", () => {
    const r = namedReactions(
      "king",
      "king-defense",
      "mechaDown",
      "attackTheMecha",
      "ccUnderAttack",
    );
    const lineFor = (scfen: string) =>
      resolveTutorialLine({ stageId: "king", storyId: "king-defense", scfen });
    // Mecha on h2, CC checked down to 2 HP — the advice is actionable.
    const checkedMechaAlive =
      "SCFEN|7k/8/8/8/8/8/7b/4K3|1|23|P|G:11:11|B:3:3|Q:w:;b:";
    // Same 2 HP, Mecha crushed: the panic line would tell the player to do what
    // they just did, so the win line retires it (reactions stick — only another
    // reaction can replace one).
    const checkedMechaDead =
      "SCFEN|7k/8/8/8/8/8/7P/4K3|1|23|P|G:11:11|B:3:3|Q:w:;b:";

    expectReaction(lineFor(checkedMechaAlive), r.ccUnderAttack);
    expectReaction(lineFor(checkedMechaDead), r.mechaDown);
    // A queued spawn still reads as the attack cue while the Mecha stands.
    const spawnQueued =
      "SCFEN|7k/8/8/8/8/8/7b/4K3|1|23|P|G:11:11|B:2:3|Q:w:B=spawn:e1:f2:p;b:";
    expectReaction(lineFor(spawnQueued), r.attackTheMecha);
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

  /**
   * King Defense III / IV are single-turn races against a pre-queued enemy
   * intent, so their gates are pinned against the **engine**, not against
   * hand-written SCFEN: `endScTurn` decides whether the solve line kills the
   * threat, and `beginScTurn` decides whether an idle turn costs the CC its last
   * HP. A hand-authored literal would keep passing after a resolve-order change.
   */
  const playLesson = (
    storyId: "king-defense-3" | "king-defense-4" | "king-attack-1",
    actions: readonly ScActionInput[],
  ): { afterResolve: string; afterNextTurnOpen: string } => {
    const seed = refillTurnGas(parseScFen(lessonBoard("king", storyId).scfen));
    let planned = seed;
    for (const action of actions) {
      planned = addScAction({ snapshot: planned, action }).snapshot;
    }
    const { next } = endScTurn(planned);
    return {
      afterResolve: formatScFen(next),
      afterNextTurnOpen: formatScFen(beginScTurn(next).next),
    };
  };

  it("king-defense-3 completes on the gas-then-shoot line and restarts when idle", () => {
    const r = namedReactions(
      "king",
      "king-defense-3",
      "ownCcDead",
      "shootTheHoverbike",
    );
    const { completeWhen: complete, restartWhen: restart } = storyOf(
      "king",
      "king-defense-3",
    );
    const seed = lessonBoard("king", "king-defense-3").scfen;

    // Neither gate may fire on the seed, or the lesson resolves before it starts.
    expect(matchesTutorialCompleteWhen(complete, seed)).toBe(false);
    expect(matchesTutorialCompleteWhen(restart, seed)).toBe(false);

    // Gas the f2 marine onto f3 (resolves before the attack phase), then shoot e4.
    const solved = playLesson("king-defense-3", [
      { timing: "B", kind: "pawnDouble", color: "w", from: "f2", to: "f3" },
      { timing: "C", kind: "classical", color: "w", from: "f3", to: "e4" },
    ]);
    expect(matchesTutorialCompleteWhen(complete, solved.afterResolve)).toBe(true);
    expect(matchesTutorialCompleteWhen(restart, solved.afterResolve)).toBe(false);
    expect(matchesTutorialCompleteWhen(restart, solved.afterNextTurnOpen)).toBe(
      false,
    );

    // Idle: nf2 lands, then checks h1 at the next turn open — CC at HP 1 dies.
    const idle = playLesson("king-defense-3", []);
    expect(matchesTutorialCompleteWhen(complete, idle.afterResolve)).toBe(false);
    expect(matchesTutorialCompleteWhen(restart, idle.afterNextTurnOpen)).toBe(true);
    expect(matchesTutorialCompleteWhen(complete, idle.afterNextTurnOpen)).toBe(
      false,
    );

    // Gas without the shot is not a solve — the hoverbike just walks onto f2.
    const gasOnly = playLesson("king-defense-3", [
      { timing: "B", kind: "pawnDouble", color: "w", from: "f2", to: "f3" },
    ]);
    expect(matchesTutorialCompleteWhen(complete, gasOnly.afterResolve)).toBe(false);
    expect(matchesTutorialCompleteWhen(restart, gasOnly.afterNextTurnOpen)).toBe(
      true,
    );

    // Ship-lesson failure shape: the death line holds the bubble while
    // `restartWhen` draws the Retry countdown, so the player reads *why* first.
    expectReaction(
      resolveTutorialLine({
        stageId: "king",
        storyId: "king-defense-3",
        scfen: idle.afterNextTurnOpen,
      }),
      r.ownCcDead,
    );
  });

  it("king-defense-3 moves its line and hint once the marine is gassed", () => {
    const r = namedReactions(
      "king",
      "king-defense-3",
      "ownCcDead",
      "shootTheHoverbike",
    );
    const hints = storyOf("king", "king-defense-3").hints;
    const seed = lessonBoard("king", "king-defense-3").scfen;
    const gasQueued =
      "SCFEN|k7/8/8/8/4n3/8/4PP1P/7K|1|13|P|G:01:11|B:0:3|Q:w:B=pawnDouble:f2:f3;b:C=e4f2";

    expectIntro(
      resolveTutorialLine({
        stageId: "king",
        storyId: "king-defense-3",
        scfen: seed,
      }),
      "king",
      "king-defense-3",
    );
    expectReaction(
      resolveTutorialLine({
        stageId: "king",
        storyId: "king-defense-3",
        scfen: gasQueued,
      }),
      r.shootTheHoverbike,
    );

    expect(resolveTutorialHints(hints, seed)).toEqual(["f2"]);
    expect(resolveTutorialHints(hints, gasQueued)).toEqual(["e4"]);

    // The solve is only *clickable* if the board projects the gassed marine onto
    // f3 and offers e4 from there — the same two helpers `useBoardInput` uses to
    // select a piece and fill `legalDests`.
    const snap = parseScFen(gasQueued);
    const raw = placementToMap(snap.placement);
    const { map, siegedRooks } = occupancyForQueuedMoves(raw, "w", true, snap);
    expect(pieceAtQueuedSquare(raw, "f3", "w", snap.queue?.actions)).toEqual({
      type: "p",
      color: "w",
    });
    expect(
      scMovesFrom(map, "f3", "w", { siegedRooks }).map((m) => m.to),
    ).toContain("e4");
  });

  it("king-defense-4 completes on the h2 collision and restarts when idle", () => {
    const r = namedReactions("king", "king-defense-4", "ownCcDead");
    const story = storyOf("king", "king-defense-4");
    const { completeWhen: complete, restartWhen: restart } = story;
    const seed = lessonBoard("king", "king-defense-4").scfen;

    expect(matchesTutorialCompleteWhen(complete, seed)).toBe(false);
    expect(matchesTutorialCompleteWhen(restart, seed)).toBe(false);
    expect(resolveTutorialHints(story.hints, seed)).toEqual(["h2"]);

    // The lesson only teaches the collision if the tank is *spotted but
    // unreachable*: the Nf1 hoverbike is the sole unit lighting e2, and e2 sits
    // off its move graph (f1 reaches d2/h2/e3/g3, never e2). If any white unit
    // could reach e2 the player would take a free capture instead of the trade.
    const placement = parseScFen(seed).placement;
    const map = placementToMap(placement);
    expect(getSideVision(placement, "w").litSquares.has("e2")).toBe(true);
    expect(getUnitVision(map, "f1").litSquares.has("e2")).toBe(true);
    for (const from of ["f1", "g1", "e5", "h1"] as const) {
      expect(
        scMovesFrom(map, from, "w").map((m) => m.to),
        `${from} must not reach the tank`,
      ).not.toContain("e2");
    }
    expectIntro(
      resolveTutorialLine({
        stageId: "king",
        storyId: "king-defense-4",
        scfen: seed,
      }),
      "king",
      "king-defense-4",
    );

    // Both movers land on h2 in the move phase → both die, tile empty.
    const solved = playLesson("king-defense-4", [
      { timing: "C", kind: "classical", color: "w", from: "e5", to: "h2" },
    ]);
    expect(matchesTutorialCompleteWhen(complete, solved.afterResolve)).toBe(true);
    expect(matchesTutorialCompleteWhen(restart, solved.afterResolve)).toBe(false);
    expect(matchesTutorialCompleteWhen(restart, solved.afterNextTurnOpen)).toBe(
      false,
    );

    // Idle: the tank reaches h2 and checks the HP-1 CC at the next turn open.
    const idle = playLesson("king-defense-4", []);
    expect(matchesTutorialCompleteWhen(complete, idle.afterResolve)).toBe(false);
    expect(matchesTutorialCompleteWhen(restart, idle.afterNextTurnOpen)).toBe(true);
    expect(matchesTutorialCompleteWhen(complete, idle.afterNextTurnOpen)).toBe(
      false,
    );
    expectReaction(
      resolveTutorialLine({
        stageId: "king",
        storyId: "king-defense-4",
        scfen: idle.afterNextTurnOpen,
      }),
      r.ownCcDead,
    );
  });

  /**
   * King Attack #1 is a two-turn kill, and every step of it is geometry the
   * config cannot state: the enemy CC on a8 has exactly three lines in (rank 8,
   * the a-file, the h1–a8 diagonal) and *black's own* queued turn opens two of
   * them. Pin the whole arc against the engine — a resolve-order or vision
   * change that costs a checker turns this lesson into a dead end, and only the
   * HP arithmetic would show it.
   */
  it("king-attack-1 kills the HP-2 CC with two checkers at the turn-12 open", () => {
    const r = namedReactions(
      "king",
      "king-attack-1",
      "shipDown",
      "stackedDamage",
      "halfHit",
    );
    const story = storyOf("king", "king-attack-1");
    const seed = lessonBoard("king", "king-attack-1").scfen;
    const seedSnap = parseScFen(seed);

    // Seed must be inert: no gate fires, and turn-open chips nobody.
    expect(matchesTutorialCompleteWhen(story.completeWhen, seed)).toBe(false);
    expect(matchesTutorialCompleteWhen(story.restartWhen, seed)).toBe(false);
    expect(beginScTurn(seedSnap).changed).toBe(false);
    expect(resolveTutorialHints(story.hints, seed)).toEqual(["b7"]);

    // Seed furniture the geometry below leans on: a Marine (not a tank) on the
    // b7 choke point, a dug-in enemy tank on a2, and enemy mines on c6/d4.
    // c6 sits *on* the h1-a8 diagonal — mines are not FEN pieces, so the
    // Bishop's line must read straight through it (core: mine/mineChecks).
    const seedMap = placementToMap(seedSnap.placement);
    expect(seedMap.get("b7")).toEqual({ type: "p", color: "b" });
    expect(seedMap.get("a2")).toEqual({ type: "r", color: "b" });
    expect(seedSnap.siegedRooks).toEqual(["a2", "b1"]);
    expect(seedSnap.mines).toEqual([
      { color: "b", at: "c6" },
      { color: "b", at: "d4" },
    ]);
    expect(rayBetween("h1", "a8")).toContain("c6");

    // White must be able to *see* a8 or `collectLegalKingChecks` never fires —
    // only the back-rank ship reaches that far, so this is load-bearing.
    expect(getSideVision(seedSnap.placement, "w").litSquares.has("a8")).toBe(true);
    expect(
      collectLegalKingChecks(seedSnap.placement).filter((c) => c.color === "w"),
    ).toEqual([]);

    // Solve: one shot. Rb1 siege-fires b7 without vacating, which clears the
    // choke point the h1-a8 diagonal shares with everything else.
    const solved = playLesson("king-attack-1", [
      { timing: "C", kind: "classical", color: "w", from: "b1", to: "b7" },
    ]);
    const opened = parseScFen(solved.afterNextTurnOpen);
    expect(
      collectLegalKingChecks(parseScFen(solved.afterResolve).placement)
        .filter((c) => c.color === "w")
        .map((c) => `${c.piece}${c.from}`),
    ).toEqual(["qd8", "bh1"]);
    // The Bishop shot through the c6 mine: the mine neither blocked the line
    // nor was spent by it (only a capture *on* the tile spends a mine).
    expect(parseScFen(solved.afterResolve).mines).toEqual(
      expect.arrayContaining([{ color: "b", at: "c6" }]),
    );
    // Two checkers vs HP 2 — dead at the open, before Black plans turn 12.
    expect(opened.kingLives).toEqual({ w: 3, b: 0 });
    expect(opened.phase).toBe("O");
    expect(matchesTutorialCompleteWhen(story.completeWhen, solved.afterNextTurnOpen))
      .toBe(true);
    expect(matchesTutorialCompleteWhen(story.restartWhen, solved.afterNextTurnOpen))
      .toBe(false);
    // "Stacked damage!" is the line for *two* checkers, so it must land on the
    // same board `completeWhen` fires on — that is the line the success bubble
    // shows next to `Next lesson →`.
    expectReaction(
      resolveTutorialLine({
        stageId: "king",
        storyId: "king-attack-1",
        scfen: solved.afterNextTurnOpen,
      }),
      r.stackedDamage,
    );

    // Leaving b7 alive costs the mecha: Black's own hoverbike still uncovers the
    // ship, so one checker lands and the CC survives on 1 — the branch where the
    // `kingAttackTankCounter` counterattack gets to happen at all.
    const idle = playLesson("king-attack-1", []);
    const survived = parseScFen(idle.afterNextTurnOpen);
    expect(
      collectLegalKingChecks(parseScFen(idle.afterResolve).placement)
        .filter((c) => c.color === "w")
        .map((c) => `${c.piece}${c.from}`),
    ).toEqual(["qd8"]);
    expect(survived.kingLives).toEqual({ w: 3, b: 1 });
    expect(survived.phase).toBe("P");
    expectReaction(
      resolveTutorialLine({
        stageId: "king",
        storyId: "king-attack-1",
        scfen: idle.afterNextTurnOpen,
      }),
      r.halfHit,
    );
    // ...and it is *not* the stacked line: one checker connected, not two.
    expect(r.halfHit.comment).not.toBe(r.stackedDamage.comment);

    // Black's turn 12 (what the choreography queues): deploy a tank onto the
    // square its hoverbike left, and shoot the BattleShip. Attacks resolve
    // before moves, so the ship cannot be walked out of it — `restartWhen`
    // fires and the player is sent back to turn 11.
    let counter = refillTurnGas(survived);
    for (const action of [
      { timing: "B", kind: "spawn", color: "b", from: "a8", to: "b8", unit: "r" },
      { timing: "C", kind: "classical", color: "b", from: "b8", to: "d8" },
    ] as ScActionInput[]) {
      counter = addScAction({ snapshot: counter, action }).snapshot;
    }
    const lost = endScTurn(counter, { skipTurnStartChecks: true }).next;
    const shipLost = formatScFen(lost);
    // `Q` still appears in the wire as the queue marker — only the placement
    // says whether the BattleShip lived, which is what `restartWhen` reads.
    expect(lost.placement).not.toMatch(/Q/);
    expect(matchesTutorialCompleteWhen(story.restartWhen, shipLost)).toBe(true);
    expectReaction(
      resolveTutorialLine({
        stageId: "king",
        storyId: "king-attack-1",
        scfen: shipLost,
      }),
      r.shipDown,
    );
  });

  /**
   * King Attack #2 hands the player one BattleShip, no minerals, and a live
   * adjutant. Two facts carry the lesson and neither is visible in the config:
   * Qh7 already bears on ke4 (so the opening turn chips for free and the player
   * learns what re-checking is worth), and the adjutant answers a stationary
   * ship by deploying onto f5 and shooting h7 — that punish is why "juke" and
   * the tier-3 Tactical Jump budget are the lesson.
   */
  it("king-attack-2 opens on a free check and is punished for standing still", () => {
    const r = namedReactions(
      "king",
      "king-attack-2",
      "shipDown",
      "ownCcDead",
      "tankCanKillHoverbike",
      "jukeTip",
    );
    const story = storyOf("king", "king-attack-2");
    const board = lessonBoard("king", "king-attack-2");
    const seed = board.scfen;
    const snap = parseScFen(seed);

    expect(board.opponent).toBe("adjutant");
    // No minerals for White: the ship is the whole army, so it cannot trade.
    expect(snap.stored).toEqual({ w: 0, b: 3 });
    // Tier-3 turn, or Tactical Jump (3 vespene) is unaffordable and the
    // "gas it up" half of the coach line is a lie.
    expect(snap.gasIncome).toEqual({ w: 3, b: 3 });
    expect(matchesTutorialCompleteWhen(story.completeWhen, seed)).toBe(false);
    expect(matchesTutorialCompleteWhen(story.restartWhen, seed)).toBe(false);
    // The opening check resolves on mount, so `holdTutorialLine` retires the
    // intro — the catch-all reaction is what actually reaches the bubble, and
    // it has to carry the same line or the lesson ships with no instructions.
    expect(r.jukeTip.comment).toBe(story.comment);
    expectReaction(
      resolveTutorialLine({
        stageId: "king",
        storyId: "king-attack-2",
        scfen: seed,
      }),
      r.jukeTip,
    );

    // Standing check on the long diagonal — the opening turn costs Black 1 HP.
    const opened = beginScTurn(snap);
    expect(
      collectLegalKingChecks(snap.placement).map((c) => `${c.piece}${c.from}`),
    ).toEqual(["qh7"]);
    expect(opened.next.kingLives).toEqual({ w: 3, b: 2 });

    // The adjutant's reply: deploy onto f5 and shoot the ship where it sits.
    const reply = adjutant(opened.next, { color: "b", storedFor: () => 3 });
    const queued = reply.snapshot.queue?.actions ?? [];
    expect(queued.some((a) => a.timing === "B" && a.kind === "spawn")).toBe(true);
    expect(
      queued.some((a) => a.timing === "C" && a.to === "h7"),
      "adjutant must punish a ship left on h7",
    ).toBe(true);

    // Confirming the Tactical Jump on turn 21 hands the bubble to the tank tip
    // and rings the hoverbike. Both halves are load-bearing: the turn field
    // scopes it to the opening turn, `queenWarp:` to a *confirmed* jump.
    const warpQueued =
      "SCFEN|8/7Q/8/4p3/3bkn2/8/5R2/7K|21|32|P|G:03:33|B:0:3|Q:w:B=queenWarp:h7:d7;b:|S:f2";
    expectReaction(
      resolveTutorialLine({
        stageId: "king",
        storyId: "king-attack-2",
        scfen: warpQueued,
      }),
      r.tankCanKillHoverbike,
    );
    expect(resolveTutorialHints(story.hints, warpQueued)).toEqual(["f4"]);
    const gasSet =
      "SCFEN|8/7Q/8/4p3/3bkn2/8/5R2/7K|21|32|P|G:03:33|B:0:3|Q:w:;b:|S:f2";
    expect(resolveTutorialHints(story.hints, gasSet)).toEqual(["f4"]);
    expect(resolveTutorialHints(story.hints, seed)).toEqual(["g2"]);
    expect(resolveTutorialHints(story.hints, seed.replace("|33|", "|32|"))).toEqual([
      "g2",
    ]);
    expect(
      resolveTutorialHints(story.hints, warpQueued.replace("|21|", "|22|")),
    ).toEqual(["c2"]);
    expect(
      resolveTutorialLine({
        stageId: "king",
        storyId: "king-attack-2",
        scfen: warpQueued.replace("|21|", "|22|"),
      }).comment,
    ).toBe(r.jukeTip.comment);

    // Losing the ship restarts; losing the CC only ever offers a manual retry,
    // so that reaction has to carry the CTA or the board is a dead end.
    const shipGone = "SCFEN|8/8/8/4p3/3bkn2/8/8/7K|22|33|P|G:33:33|B:0:3|Q:w:;b:";
    expect(matchesTutorialCompleteWhen(story.restartWhen, shipGone)).toBe(true);
    expectReaction(
      resolveTutorialLine({
        stageId: "king",
        storyId: "king-attack-2",
        scfen: shipGone,
      }),
      r.shipDown,
    );
    expect(r.ownCcDead.action).toMatchObject({ kind: "retryLesson" });
    expect(resolveTutorialHints(story.hints, shipGone)).toEqual([]);
    const ccGone = "SCFEN|8/7Q/8/4p3/3bkn2/8/8/8|22|03|P|G:33:33|B:0:3|Q:w:;b:";
    expect(matchesTutorialCompleteWhen(story.restartWhen, ccGone)).toBe(false);
    expectReaction(
      resolveTutorialLine({
        stageId: "king",
        storyId: "king-attack-2",
        scfen: ccGone,
      }),
      r.ownCcDead,
    );
    expect(resolveTutorialHints(story.hints, ccGone)).toEqual([]);
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
