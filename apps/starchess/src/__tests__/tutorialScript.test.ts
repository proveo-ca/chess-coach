import {
  addScAction,
  adjutant,
  beginScTurn,
  endScTurn,
  formatScFen,
  collectLegalCCChecks,
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
  nextAlertLatch,
  nextBattleShipWatch,
  resolveTutorialHint,
  resolveTutorialLine,
  resolveTutorialStoryId,
  tutorialPath,
  tutorialStage,
  tutorialStory,
} from "~/tutorial/tutorialScript";
import { availableTrajectories, coveredEnemyShips } from "~/tutorial/lessonTactics";
import type {
  AttackTrajectory,
  SquareCovers,
  TutorialBeat,
  TutorialLine,
  TutorialSectionId,
} from "~/types/tutorial";
import type { ReviewTurnPhase } from "~/types/review";
import {
  FOG_MOVE_KING_START_SCFEN,
  FOG_MOVE_PAWN_START_SCFEN,
  FOG_MOVE_KNIGHT_START_SCFEN,
} from "~/demos/fogMoveSamples";
import {
  occupancyForQueuedMoves,
  pieceAtQueuedSquare,
} from "~/presentation/specials/planning/occupancy";

/**
 * Positional shorthand over {@link resolveTutorialHint} — the board cases below
 * read one mark kind per assertion.
 */
const hintMarks = (
  hints: readonly TutorialBeat[] | undefined,
  scfen: string | undefined,
  covers?: SquareCovers,
  trajectories?: AttackTrajectory[],
  query?: { reviewPhase?: ReviewTurnPhase; turn?: number },
) => resolveTutorialHint(hints, { scfen, covers, trajectories, ...query });
const hintSquares = (...a: Parameters<typeof hintMarks>) => hintMarks(...a).squares;
const hintAlerts = (...a: Parameters<typeof hintMarks>) => hintMarks(...a).alertSquares;
const hintArrows = (...a: Parameters<typeof hintMarks>) => hintMarks(...a).arrows;
const hintGas = (...a: Parameters<typeof hintMarks>) => hintMarks(...a).gasSquares;

const storyOf = (stageId: TutorialSectionId, storyId: string) => {
  const story = tutorialStory(stageId, storyId);
  if (!story) throw new Error(`No tutorial story ${stageId}/${storyId}`);
  return story;
};

/** One scripted overlay line — a `say`-carrying beat. */
type ScriptedReaction = TutorialBeat & { say: string };

/** A story's beats that carry a coach line, in resolver order (first match wins). */
const sayBeats = (stageId: TutorialSectionId, storyId: string): ScriptedReaction[] =>
  (storyOf(stageId, storyId).beats ?? []).filter(
    (b): b is ScriptedReaction => b.say != null,
  );

/**
 * Labels a story's say-beats in resolver order (first match wins). Tests then say
 * *which* scripted line should show — `r.checked`, `r.cornered` — instead of
 * quoting it. Copy edits stay in `tutorialScript.config.ts`; a reorder or a new
 * beat trips the length guard here, because both change what the player sees.
 */
const namedReactions = <N extends string>(
  stageId: TutorialSectionId,
  storyId: string,
  ...names: readonly N[]
): Record<N, ScriptedReaction> => {
  const list = sayBeats(stageId, storyId);
  if (list.length !== names.length) {
    throw new Error(
      `${stageId}/${storyId} has ${list.length} say-beats, named ${names.length}: ${names.join(", ")}`,
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
  expect(line.comment).toBe(reaction.say);
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
  const FOG_HOVERBIKE = namedReactions("fog", "knight", "sawIt", "moveToG5");
  const FOG_MECHA = namedReactions("fog", "bishop", "ccOnFire", "marineBlocks");
  const KING_HUNT = namedReactions(
    "resolve",
    "king-hunt",
    "sectionEnd",
    "checked",
    "shouldHaveDeployed",
    "enemyDown",
  );
  const KING_ATTACK_3 = namedReactions(
    "live-play",
    "live-play-attack-3",
    "ownCcDead",
    "enemyDown",
    "shipSniped",
    "ccMoved",
    "promotionChoice",
    "mechaThreat",
    "attackF3Queued",
    "mechaDeployReady",
    "goGetEm",
    "f3Marine",
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
    "tankSiege",
    "deployG2",
    "gasReminder",
    "pushH2",
    "pushH3",
    "pushH4",
    "guardG1",
    "oneMoreCheck",
    "checked",
    "oneMoreHit",
    "centralize",
    "gasOnMarine",
    "queuedReview",
    "intentTipTurn1",
    "minesTipTurn2",
    "ccPressureFallback",
  );
  const KING_ATTACK_4 = namedReactions(
    "live-play",
    "live-play-attack-4",
    "ownCcDead",
    "enemyDown",
    "stopRunner",
    "ccThreat",
    "offScriptTurn12",
    "offScriptTurn13",
    "offScriptTurn14",
    "offScriptTurn15",
    "siegeTank",
    "gasMarine",
    "hoverbikeThreat",
    "guardAlley",
    "deployBoth",
    "fullVision",
    "goodJob",
    "pushF3",
    "unsiegeTank",
    "clearMarine",
    "pointAtCC",
    "siegeGhost",
    "ccDeployFallback",
    "ccPressureFallback",
  );

  it("covers four stages with the expected story counts", () => {
    expect(TUTORIAL_SCRIPT.map((s) => s.id)).toEqual([
      "fog",
      "specials",
      "resolve",
      "live-play",
    ]);
    expect(TUTORIAL_SCRIPT[0]!.stories).toHaveLength(8);
    expect(TUTORIAL_SCRIPT[1]!.stories).toHaveLength(6);
    expect(TUTORIAL_SCRIPT[2]!.stories).toHaveLength(2);
    expect(TUTORIAL_SCRIPT[2]!.stories.map((s) => s.id)).toEqual([
      "combat-chain",
      "king-hunt",
    ]);
    expect(TUTORIAL_SCRIPT[3]!.stories).toHaveLength(10);
    expect(TUTORIAL_SCRIPT[3]!.stories.map((s) => s.id)).toEqual([
      "live-play-defense-1",
      "live-play-defense-2",
      "live-play-defense-3",
      "live-play-defense-4",
      "live-play-defense-5",
      "live-play-defense-6",
      "live-play-attack-1",
      "live-play-attack-2",
      "live-play-attack-3",
      "live-play-attack-4",
    ]);
  });

  it("builds deep links from stage + story ids", () => {
    expect(tutorialPath("fog", "king")).toBe("/tutorial/fog/king");
    expect(tutorialPath("specials", "marine")).toBe("/tutorial/specials/marine");
    expect(tutorialPath("resolve")).toBe("/tutorial/resolve/combat-chain");
    expect(tutorialPath("live-play", "live-play-attack-3")).toBe(
      "/tutorial/live-play/live-play-attack-3",
    );
    expect(tutorialPath("live-play", "live-play-attack-4")).toBe(
      "/tutorial/live-play/live-play-attack-4",
    );
  });

  it("live-play-attack-4 seeds the turtled position with 3 minerals each and a live opponent", () => {
    const story = storyOf("live-play", "live-play-attack-4");
    const seed = lessonBoard("live-play", "live-play-attack-4").scfen;
    const snap = parseScFen(seed);
    expect(snap.turn).toBe(12);
    expect(snap.ccLives).toEqual({ w: 3, b: 3 });
    expect(snap.mines).toEqual([{ color: "w", at: "b1" }]);
    expect(snap.siegedTanks).toEqual(["d8"]);
    const map = placementToMap(snap.placement);
    expect(map.size).toBe(18);
    expect(map.get("b7")).toEqual({ color: "b", type: "k" });
    expect(map.get("e1")).toEqual({ color: "w", type: "k" });
    expect(map.get("d2")).toEqual({ color: "w", type: "n" });
    expect(map.get("e2")).toEqual({ color: "w", type: "r" });
    expect(map.get("a6")).toEqual({ color: "b", type: "n" });
    expect(map.get("d7")).toEqual({ color: "b", type: "p" });
    expect(map.get("e7")).toEqual({ color: "b", type: "p" });
    expect(story.board?.stored).toBe(3);
    expect(story.board?.opponent).toBe("adjutant");
    expect(matchesTutorialCompleteWhen(story.completeWhen, seed)).toBe(false);
    expect(
      matchesTutorialCompleteWhen(
        story.completeWhen,
        "SCFEN|3r4/pkppp3/npb5/4P3/3P1P2/N1PB4/3NR3/4K3|12|30|P|G:21:22|M:w:b1|S:d8|Q:w:;b:B=spiderMine:a6:a6,C=a6c5",
      ),
    ).toBe(true);
  });

  it("live-play-attack-4's opening is scripted: the enemy Hoverbike mines a6 then rides to c5", () => {
    const seed = lessonBoard("live-play", "live-play-attack-4").scfen;
    const snap = parseScFen(seed);
    const black = snap.queue?.actions.filter((a) => a.color === "b") ?? [];
    expect(black).toEqual([
      expect.objectContaining({ kind: "spiderMine", from: "a6", to: "a6" }),
      expect.objectContaining({ kind: "classical", from: "a6", to: "c5" }),
    ]);
    const result = endScTurn(snap);
    expect(result.next.mines).toContainEqual({ color: "b", at: "a6" });
    const map = placementToMap(result.next.placement);
    expect(map.get("c5")).toEqual({ color: "b", type: "n" });
    expect(map.get("a6")).toBeUndefined();
  });

  it("live-play-attack-4 turn 1: centralize, siege, then gas the c-file Marine", () => {
    const story = storyOf("live-play", "live-play-attack-4");
    const seed = lessonBoard("live-play", "live-play-attack-4").scfen;
    const lineFor = (scfen: string) =>
      resolveTutorialLine({ stageId: "live-play", storyId: "live-play-attack-4", scfen });

    expectIntro(lineFor(seed), "live-play", "live-play-attack-4");
    expect(hintSquares(story.beats, seed)).toEqual(["e2"]);
    expect(hintArrows(story.beats, seed)).toEqual([{ from: "e2", to: "e3" }]);

    const moveQueued = seed.replace("Q:w:;", "Q:w:C=e2e3;");
    expectReaction(lineFor(moveQueued), KING_ATTACK_4.siegeTank);
    expect(hintGas(story.beats, moveQueued)).toEqual(["e3"]);

    const bothQueued = seed.replace("G:21:", "G:11:").replace("Q:w:;", "Q:w:C=e2e3,F=siegeMode:e2;");
    expectReaction(lineFor(bothQueued), KING_ATTACK_4.gasMarine);
    expect(hintGas(story.beats, bothQueued)).toEqual(["c2"]);
    expect(hintArrows(story.beats, bothQueued)).toEqual([{ from: "c2", to: "c3" }]);
  });

  it("live-play-attack-4 turn 2: capture the Hoverbike, mine a3, deploy a Mecha", () => {
    const story = storyOf("live-play", "live-play-attack-4");
    const placement = "3r4/pkppp3/1pb5/2n1PP2/3P4/N1PBR3/3N4/4K3";
    const lineFor = (scfen: string) =>
      resolveTutorialLine({ stageId: "live-play", storyId: "live-play-attack-4", scfen });

    const nothing = `SCFEN|${placement}|13|33|P|G:22:22|M:w:b1|S:d8e3|Q:w:;b:`;
    expectReaction(lineFor(nothing), KING_ATTACK_4.fullVision);
    expect(hintSquares(story.beats, nothing)).toEqual(["c5", "d4"]);
    expect(hintAlerts(story.beats, nothing)).toEqual(["d3"]);
    expect(hintArrows(story.beats, nothing)).toEqual([
      { from: "c5", to: "d3", via: "c3" },
      { from: "d3", to: "e1", via: "d1", tone: "alert" },
      { from: "d4", to: "c5" },
    ]);
    expectReaction(lineFor(nothing.replace("S:d8e3", "S:d8")), KING_ATTACK_4.hoverbikeThreat);

    const attackOnly = `SCFEN|${placement}|13|33|P|G:22:22|M:w:b1|S:d8e3|Q:w:C=d4c5;b:`;
    expectReaction(lineFor(attackOnly), KING_ATTACK_4.guardAlley);
    expect(hintGas(story.beats, attackOnly)).toEqual(["a3"]);

    const bothQueued = `SCFEN|${placement}|13|33|P|G:12:22|M:w:b1|S:d8e3|Q:w:C=d4c5,B=spiderMine:a3:a3;b:`;
    expectReaction(lineFor(bothQueued), KING_ATTACK_4.deployBoth);
    expect(KING_ATTACK_4.deployBoth.say).toBe("Deploy a Mecha dropping gas on the Command Center.");
    expect(hintSquares(story.beats, bothQueued)).toEqual(["e2"]);
    expect(hintGas(story.beats, bothQueued)).toEqual(["e1"]);
  });

  it("live-play-attack-4 turn 3: relocate the Hoverbike, push f3, then unsiege the Tank", () => {
    const story = storyOf("live-play", "live-play-attack-4");
    const placement = "3r4/pkppp3/2b5/1pP1PP2/8/2P1RP2/3NP3/4K3";
    const lineFor = (scfen: string) =>
      resolveTutorialLine({ stageId: "live-play", storyId: "live-play-attack-4", scfen });

    const nothing = `SCFEN|${placement}|14|33|P|G:22:22|M:w:a3b1|S:d8e3|Q:w:;b:`;
    expectReaction(lineFor(nothing), KING_ATTACK_4.goodJob);
    expect(hintSquares(story.beats, nothing)).toEqual(["c2"]);

    const moveOnly = `SCFEN|${placement}|14|33|P|G:22:22|M:w:a3b1|S:d8e3|Q:w:C=a3c2;b:`;
    expectReaction(lineFor(moveOnly), KING_ATTACK_4.pushF3);
    expect(hintGas(story.beats, moveOnly)).toEqual(["f3"]);
    expect(hintArrows(story.beats, moveOnly)).toEqual([{ from: "f3", to: "f4" }]);

    const pushed = `SCFEN|${placement}|14|33|P|G:12:22|M:w:a3b1|S:d8e3|Q:w:C=a3c2,B=stimStep:f3:f4;b:`;
    expectReaction(lineFor(pushed), KING_ATTACK_4.unsiegeTank);
    expect(hintGas(story.beats, pushed)).toEqual(["e3"]);
    expect(hintAlerts(story.beats, pushed)).toEqual(["b7"]);
  });

  it("fog completeWhen does not match seed SCFEN but matches post-goal boards", () => {
    const commandCenter = storyOf("fog", "king").completeWhen;
    const marine = storyOf("fog", "pawn").completeWhen;
    const hoverbike = storyOf("fog", "knight").completeWhen;
    expect(matchesTutorialCompleteWhen(commandCenter, FOG_MOVE_KING_START_SCFEN)).toBe(
      false,
    );
    expect(
      matchesTutorialCompleteWhen(
        commandCenter,
        "SCFEN|7k/7p/8/4K3/8/8/8/8|1|33|P|G:11:11|Q:w:;b:",
      ),
    ).toBe(true);
    expect(matchesTutorialCompleteWhen(marine, FOG_MOVE_PAWN_START_SCFEN)).toBe(
      false,
    );
    expect(
      matchesTutorialCompleteWhen(
        marine,
        "SCFEN|3Q4/8/8/8/8/8/8/K7|2|33|P|G:11:11|Q:w:;b:",
      ),
    ).toBe(true);
    expect(
      matchesTutorialCompleteWhen(hoverbike, FOG_MOVE_KNIGHT_START_SCFEN),
    ).toBe(false);
    expect(
      matchesTutorialCompleteWhen(
        hoverbike,
        "SCFEN|7k/7p/8/6N1/8/8/8/K7|2|33|P|G:00:11|Q:w:;b:",
      ),
    ).toBe(true);
  });

  it("ship closes Special Moves on a CTA and restarts on the turn-21 tier-3 seed", () => {
    const ship = storyOf("specials", "ship");
    const seed = lessonBoard("specials", "ship").scfen;
    expect(ship.completeWhen).toBeUndefined();
    const at = (scfen: string) =>
      resolveTutorialLine({ stageId: "specials", storyId: "ship", scfen, reviewPhase: "intent" });
    expect(at(seed).action).toBeUndefined();
    expect(matchesTutorialCompleteWhen(ship.restartWhen, seed)).toBe(false);
    expect(at("SCFEN|k6b/8/8/8/8/8/8/Q6K|22|33|P|G:33:33|Q:w:;b:").action).toEqual({
      kind: "goSection",
      section: "resolve",
      label: "Next Section",
    });
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
    expect(adjacentTutorialStoryId("specials", "ship", 1, { wrap: true })).toBe(
      "cc",
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
      "cc",
      "marine",
      "hoverbike",
      "mecha",
      "tank",
      "ship",
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
      "firstIntent",
      "tankIntent",
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
    expectReaction(step.line, FOG_MECHA.marineBlocks);

    // Resolve ends — no reaction match; must NOT bounce to intro.
    step = holdTutorialLine(
      hold,
      key,
      resolveTutorialLine({ stageId: "fog", storyId: "bishop", scfen: seed }),
      { scfen: seed, reviewPhase: "intent" },
    );
    expectReaction(step.line, FOG_MECHA.marineBlocks);
  });

  it("holdTutorialLine keeps the intro across turn-open bookkeeping", () => {
    const seed = lessonBoard("live-play", "live-play-attack-1").scfen;
    const seedSnap = parseScFen(seed);
    const openedSnap = beginScTurn(seedSnap).next;
    const opened = formatScFen(openedSnap);
    expect(seedSnap.gas).toEqual({ w: 2, b: 0 });
    expect(openedSnap.gas).toEqual({ w: 2, b: 1 });
    expect(() => parseScFen(opened)).not.toThrow();
    expect(opened).not.toBe(seed);

    const key = "live-play|live-play-attack-1";
    const lineFor = (scfen: string) =>
      resolveTutorialLine({
        stageId: "live-play",
        storyId: "live-play-attack-1",
        scfen,
      });

    // Mount: the pre-turn-open seed is the baseline, intro on screen.
    let step = holdTutorialLine(
      { lessonKey: "", introDone: false },
      key,
      lineFor(seed),
      { scfen: seed, turnStartChecksApplied: false },
    );
    expectIntro(step.line, "live-play", "live-play-attack-1");

    // Turn-open lands: the SCFEN moved, but no one played a move — the line
    // must survive, and the opened board becomes the new baseline.
    step = holdTutorialLine(step.hold, key, lineFor(opened), {
      scfen: opened,
      turnStartChecksApplied: true,
    });
    expectIntro(step.line, "live-play", "live-play-attack-1");
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
    const seed = lessonBoard("live-play", "live-play-attack-1").scfen;
    const key = "live-play|live-play-attack-1";
    const line = resolveTutorialLine({
      stageId: "live-play",
      storyId: "live-play-attack-1",
      scfen: seed,
    });

    const mounted = holdTutorialLine({ lessonKey: "", introDone: false }, key, line, {
      scfen: seed,
    });
    expect(mounted.hold.checksApplied).toBeUndefined();
    expectIntro(mounted.line, "live-play", "live-play-attack-1");

    const moved = holdTutorialLine(mounted.hold, key, line, {
      scfen: seed.replace("|G:20:22|", "|G:21:22|"),
    });
    expect(moved.hold.introDone).toBe(true);
    expect(moved.line.comment).toBe("");
  });

  it("arms the planning timer on every King lesson", () => {
    // Stage 4 teaches under clock pressure — a lesson with `armTimer: false`
    // leaves the sidebar gauge parked at 0, which reads as a broken timer.
    const commandCenter = tutorialStage("live-play");
    expect(
      commandCenter.stories
        .filter((s) => s.board?.armTimer === false)
        .map((s) => s.id),
    ).toEqual([]);
  });

  it("draws a green arrow from the unit to each attack or move ring", () => {
    const arrows = (stage: TutorialSectionId, story: string, scfen?: string) =>
      hintArrows(
        storyOf(stage, story).beats,
        scfen ?? lessonBoard(stage, story).scfen,
      );
    expect(arrows("fog", "king")).toEqual([{ from: "d4", to: "c3" }]);
    expect(arrows("fog", "pawn")).toEqual([{ from: "d4", to: "d8" }]);
    expect(arrows("fog", "bishop")).toEqual([{ from: "d4", to: "h8" }]);
    expect(arrows("fog", "rook-tank")).toEqual([{ from: "d4", to: "d8" }]);
    expect(arrows("fog", "rook-siege")).toEqual([{ from: "d4", to: "h4" }]);
    expect(arrows("fog", "mine")).toEqual([{ from: "e2", to: "e4" }]);
    expect(arrows("specials", "marine")).toEqual([{ from: "d2", to: "d4" }]);
    expect(arrows("specials", "mecha")).toEqual([{ from: "d4", to: "h8" }]);
    expect(arrows("live-play", "live-play-defense-1")).toEqual([{ from: "e1", to: "f2" }]);
    expect(arrows("live-play", "live-play-defense-2")).toEqual([{ from: "h1", to: "g2" }]);
    expect(arrows("live-play", "live-play-defense-4")).toEqual([
      { from: "e5", to: "h2" },
      { from: "f1", to: "h2", via: "f2" },
    ]);
    expect(arrows("live-play", "live-play-defense-5")).toEqual([
      { from: "c2", to: "c3" },
      { from: "b4", to: "d2" },
    ]);
    expect(arrows("live-play", "live-play-attack-1")).toEqual([
      { from: "b1", to: "b7" },
      { from: "h1", to: "a8" },
      { from: "d8", to: "a8" },
    ]);
    expect(arrows("live-play", "live-play-attack-2")).toEqual([{ from: "h7", to: "h4" }]);
  });

  it("marks fog/knight hops e6 then g5 from SCFEN hints", () => {
    const hints = storyOf("fog", "knight").beats;
    const start = "SCFEN|7k/7p/8/8/3N4/8/8/K7|0|33|P|G:11:11|Q:w:;b:";
    const onE6 = "SCFEN|7k/7p/4N3/8/8/8/8/K7|0|33|P|G:11:11|Q:w:;b:";
    // Live resolve encodes Ng5 as `6N1` (not `5N2`).
    const onG5 = "SCFEN|7k/7p/8/6N1/8/8/8/K7|2|33|P|G:00:11|Q:w:;b:";
    expect(hintSquares(hints, start)).toEqual(["e6"]);
    expect(hintArrows(hints, start)).toEqual([
      { from: "d4", to: "e6", via: "d6" },
    ]);
    // On e6 the next hop is green; the corner it is about to reveal is red.
    expect(hintSquares(hints, onE6)).toEqual(["g5"]);
    expect(hintArrows(hints, onE6)).toEqual([
      { from: "e6", to: "g5", via: "g6" },
    ]);
    expect(hintAlerts(hints, onE6)).toEqual(["h8"]);
    expect(hintSquares(hints, onG5)).toEqual([]);
    expectReaction(
      resolveTutorialLine({ stageId: "fog", storyId: "knight", scfen: onE6 }),
      FOG_HOVERBIKE.moveToG5,
    );
    expectReaction(
      resolveTutorialLine({ stageId: "fog", storyId: "knight", scfen: onG5 }),
      FOG_HOVERBIKE.sawIt,
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
    expectReaction(line({ scfen: seed, targetingKind: "charonMissiles" }), r.arming);

    // 3 — target clicked: the snipe is on the queue and targeting has cleared.
    const queued =
      "SCFEN|k6q/8/4P3/4p3/3B4/8/8/K7|11|33|P|G:02:22|B:0:3|Q:w:B=charonMissiles:d4:h8;b:";
    expectReaction(line({ scfen: queued }), r.snipeQueued);

    // A different armed special must not borrow the Mecha's line.
    expectIntro(line({ scfen: seed, targetingKind: "tacticalJump" }), "specials", "mecha");

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
      "mineGuard",
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
    expectReaction(line(`${t1}B=spiderMine:d4:d4;b:`), r.mineQueued);
    // 3 — turn 2 opens: move first this time.
    expectReaction(line(`${t2};b:`), r.newTurnMove);
    // 4 — move queued on turn 2: now the canister.
    expectReaction(line(`${t2}C=e4f6;b:`), r.gasThenMove);

    // Off-script orders still coach rather than going silent.
    expectReaction(line(`${t1}C=d4e6;b:`), r.gasStillNeeded);
    expectReaction(line(`${t2}B=spiderMine:e4:e4;b:`), r.newTurnMove);

    const hints = storyOf("specials", "hoverbike").beats;
    expect(hintGas(hints, `${t1};b:`)).toEqual(["d4"]);
    expect(hintSquares(hints, `${t1}B=spiderMine:d4:d4;b:`)).toEqual(["c2"]);
    expect(hintArrows(hints, `${t1}B=spiderMine:d4:d4;b:`)).toEqual([
      { from: "d4", to: "c2", via: "d2" },
    ]);
    const onC2 = "SCFEN|4k3/8/8/8/8/8/2N5/4K3|2|33|P|G:11:11|M:w:d4|Q:w:;b:";
    expect(hintSquares(hints, onC2)).toEqual(["a1"]);
    expect(hintArrows(hints, onC2)).toEqual([{ from: "c2", to: "a1", via: "a2" }]);

    // Both mines down: ring them, draw the hops, and count the files guarded.
    const done = "SCFEN|4k3/8/8/8/8/8/8/N3K3|3|33|P|G:11:11|M:w:d4a1|Q:w:;b:";
    const closing = line(done);
    expect(closing.source).toBe("reaction");
    expect(closing.comment).toBe("1 unit guarding 4 promoting files!");
    expect(hintSquares(hints, done)).toEqual(["d4", "a1"]);
    expect(hintArrows(hints, done)).toEqual([
      { from: "a1", to: "b3", via: "a3" },
      { from: "a1", to: "c2", via: "c1" },
    ]);
    // Off-route mines still close the lesson, with an honest count.
    // (gas-then-move on turn 2 lays the second mine on c2, not a1: b–d only).
    expect(line("SCFEN|4k3/8/8/8/8/8/8/N3K3|3|33|P|G:11:11|M:w:d4c2|Q:w:;b:").comment).toBe(
      "1 unit guarding 3 promoting files!",
    );

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
      `SCFEN|r6k/8/8/8/8/8/8/4K3|2|${lives}|P|G:01:11|Q:w:;b:`;
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
      hintSquares(tutorialStory("specials", "marine")?.beats, scfen);
    const gas = (scfen: string) =>
      hintGas(tutorialStory("specials", "marine")?.beats, scfen);
    // 1 — seed: move first, d4 ring; the queued classical holds the opener.
    expectIntro(line(`${t1};b:`), "specials", "marine");
    expect(hints(`${t1};b:`)).toEqual(["d4"]);
    expectReaction(line(`${t1}C=d2d4;b:`), r.moveQueued);
    expect(gas(`${t1}C=d2d4;b:`)).toEqual(["d4"]);
    // Gas on turn 1 cheers without leaving the window.
    expectReaction(line(`${t1}B=stimStep:d2:d3;b:`), r.gasCheer);
    expectReaction(line(`${t1}C=d2d4,F=stimStep:d2:d3;b:`), r.gasCheer);
    expectReaction(line(`${t2};b:`), r.slipAway);
    expect(gas(`${t2};b:`)).toEqual(["e3"]);
    // Gas queued on e3 — the ghost beat wins over the turn beat, e5 ring.
    expectReaction(line(`${t2}B=stimStep:e3:e4;b:`), r.gasGhost);
    expect(hints(`${t2}B=stimStep:e3:e4;b:`)).toEqual(["e5"]);
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
        "SCFEN|7k/8/8/8/3P4/4P3/8/4K3|2|33|P|G:11:11|B:0:3|Q:w:B=stimStep:e3:e4,C=e4e5;b:",
      ),
    ).toBe(false);
    expect(
      matchesTutorialCompleteWhen(
        complete,
        "SCFEN|7k/8/8/8/8/4P3/3P4/4K3|3|33|P|G:11:11|Q:w:;b:",
      ),
    ).toBe(true);
  });

  it("gates king-attack-3 intent tip to the seed turn's intent phase", () => {
    expect(
      resolveTutorialLine({
        stageId: "live-play",
        storyId: "live-play-attack-3",
        scfen: lessonBoard("live-play", "live-play-attack-3").scfen,
      }).comment,
    ).not.toBe(KING_ATTACK_3.intentTipTurn1.say);
    expectReaction(
      resolveTutorialLine({
        stageId: "live-play",
        storyId: "live-play-attack-3",
        scfen: lessonBoard("live-play", "live-play-attack-3").scfen,
        reviewPhase: "intent",
      }),
      KING_ATTACK_3.intentTipTurn1,
    );
    expectReaction(
      resolveTutorialLine({
        stageId: "live-play",
        storyId: "live-play-attack-3",
        scfen: "SCFEN|8/8/8/8/4k3/5P2/6P1/4N1BK|1|33|P|G:11:11|Q:w:;b:",
      }),
      KING_ATTACK_3.minesTipTurn2,
    );
    expectReaction(
      resolveTutorialLine({
        stageId: "live-play",
        storyId: "live-play-attack-3",
        scfen: "SCFEN|8/8/8/8/4k3/5P2/6P1/4N1BK|1|33|P|G:01:11|Q:w:;b:",
      }),
      KING_ATTACK_3.ccPressureFallback,
    );
  });

  it("marks the last-seen Command Center during turn-1 resolve", () => {
    const story = storyOf("live-play", "live-play-attack-3");
    const scfen =
      "SCFEN|8/8/8/8/4k3/5p2/6P1/4N1BK|0|33|P|G:11:11|B:3:3|Q:w:C=g2f3;b:";
    const line = resolveTutorialLine({
      stageId: "live-play",
      storyId: "live-play-attack-3",
      scfen,
      reviewPhase: "resolve",
    });
    expectReaction(line, KING_ATTACK_3.ccMoved);
    expect(line.transient).toBe(true);
    const query = { reviewPhase: "resolve" as const };
    expect(hintAlerts(story.beats, scfen, undefined, undefined, query)).toEqual([
      "d5",
    ]);
    expect(hintSquares(story.beats, scfen, undefined, undefined, query)).toEqual([]);
    expect(hintArrows(story.beats, scfen, undefined, undefined, query)).toEqual([]);
    expect(
      hintAlerts(story.beats, scfen, undefined, undefined, {
        reviewPhase: "intent",
        turn: 1,
      }),
    ).toEqual([]);
  });

  it("keeps a fog alert after the beat that set it", () => {
    let latch = nextAlertLatch({ squares: [] }, ["h8"]);
    expect(latch.squares).toEqual(["h8"]);
    latch = nextAlertLatch(latch, []);
    expect(latch.squares).toEqual(["h8"]);
  });

  it("moves a king-attack alert only when the Command Center is seen", () => {
    let latch = nextAlertLatch({ squares: [] }, ["d5"], {
      followCC: true,
      ccAt: "e4",
      ccVisible: false,
    });
    expect(latch.squares).toEqual(["d5"]);
    expect(latch.ccAt).toBe("d5");
    // Still-fogged destination: the ring stays on the last sighting.
    latch = nextAlertLatch(latch, [], {
      followCC: true,
      ccAt: "c5",
      ccVisible: false,
    });
    expect(latch.squares).toEqual(["d5"]);
    // A visible origin during the scripted sighting does not pull the ring back.
    const held = nextAlertLatch(latch, ["d5"], {
      followCC: true,
      ccAt: "e4",
      ccVisible: true,
    });
    expect(held.squares).toEqual(["d5"]);
    latch = nextAlertLatch(latch, [], {
      followCC: true,
      ccAt: "c5",
      ccVisible: true,
    });
    expect(latch.squares).toEqual(["c5"]);
  });

  it("fires king-hunt lines from white/black ccLives digits in SCFEN", () => {
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
    expectReaction(
      resolveTutorialLine({
        stageId: "resolve",
        storyId: "king-hunt",
        scfen: allyDead,
      }),
      KING_HUNT.sectionEnd,
    );
    // Live lesson: the same board offers a retry CTA instead.
    expectReaction(
      resolveTutorialLine({
        stageId: "live-play",
        storyId: "live-play-attack-3",
        scfen: allyDead,
      }),
      KING_ATTACK_3.ownCcDead,
    );
    expect(KING_ATTACK_3.ownCcDead.action).toMatchObject({
      kind: "retryLesson",
    });
    expectReaction(
      resolveTutorialLine({
        stageId: "live-play",
        storyId: "live-play-attack-3",
        scfen: enemyDead,
      }),
      KING_ATTACK_3.enemyDown,
    );
  });

  it("fires king-attack-3 push lines with the guard beat", () => {
    const oneEnemyMarine = "SCFEN|8/1p6/8/4k3/8/8/8/6BK|2|33|P|G:11:11|Q:w:;b:";
    const marineRank5Hp3 = "SCFEN|8/8/8/4k1P1/8/8/8/6BK|2|33|P|G:11:11|Q:w:;b:";
    const marineRank5Hp1 = "SCFEN|8/8/8/4k1P1/8/8/8/6BK|2|13|P|G:11:11|Q:w:;b:";
    const marineRank4Hp3 = "SCFEN|8/8/8/4k3/6P1/8/8/6BK|2|33|P|G:11:11|Q:w:;b:";
    const lineFor = (scfen: string) =>
      resolveTutorialLine({
        stageId: "live-play",
        storyId: "live-play-attack-3",
        scfen,
      });
    expectReaction(lineFor(oneEnemyMarine), KING_ATTACK_3.ccPressureFallback);
    expectReaction(lineFor(marineRank5Hp3), KING_ATTACK_3.ccPressureFallback);
    expectReaction(lineFor(marineRank5Hp1), KING_ATTACK_3.oneMoreHit);
    expectReaction(lineFor(marineRank4Hp3), KING_ATTACK_3.ccPressureFallback);
  });

  it("rings and arrows whichever unit already pressures the enemy Command Center", () => {
    const story = storyOf("live-play", "live-play-attack-3");
    const pressuring = "SCFEN|8/8/8/8/2k5/8/B7/7K|5|33|P|G:11:11|Q:w:;b:";
    expectReaction(
      resolveTutorialLine({ stageId: "live-play", storyId: "live-play-attack-3", scfen: pressuring }),
      KING_ATTACK_3.ccPressureFallback,
    );
    expect(hintSquares(story.beats, pressuring)).toEqual(["a2"]);
    expect(hintArrows(story.beats, pressuring)).toEqual([{ from: "a2", to: "c4" }]);

    // Blocked ray: same fallback line, but nothing to ring.
    const blocked = "SCFEN|8/8/8/8/2k5/1R6/B7/7K|5|33|P|G:11:11|Q:w:;b:";
    expectReaction(
      resolveTutorialLine({ stageId: "live-play", storyId: "live-play-attack-3", scfen: blocked }),
      KING_ATTACK_3.ccPressureFallback,
    );
    expect(hintSquares(story.beats, blocked)).toEqual([]);
    expect(hintArrows(story.beats, blocked)).toEqual([]);
  });

  it("fires king-attack-3 threat lines with matching rings", () => {
    const story = storyOf("live-play", "live-play-attack-3");
    const intent = { reviewPhase: "intent" as const };
    const lineFor = (scfen: string, reviewPhase: "intent" | "check" | "resolve" = "intent") =>
      resolveTutorialLine({
        stageId: "live-play",
        storyId: "live-play-attack-3",
        scfen,
        reviewPhase,
      });
    const f3 =
      "SCFEN|8/8/8/8/4k3/5p2/6P1/4N1BK|1|33|P|G:11:11|Q:w:;b:";
    expectReaction(lineFor(f3), KING_ATTACK_3.f3Marine);
    expect(hintSquares(story.beats, f3)).toEqual(["f3"]);
    expect(hintArrows(story.beats, f3)).toEqual([{ from: "g2", to: "f3" }]);
    const mechaReady =
      "SCFEN|8/8/8/8/4k3/5p2/6P1/4N1BK|1|33|P|G:11:11|B:3:3|Q:w:;b:";
    expectReaction(lineFor(mechaReady), KING_ATTACK_3.attackF3Queued);
    expect(KING_ATTACK_3.attackF3Queued.say).toBe("Stop that Marine in f3 from promoting!");
    expect(hintSquares(story.beats, mechaReady, undefined, undefined, intent)).toEqual([
      "g2",
    ]);
    expect(hintArrows(story.beats, mechaReady, undefined, undefined, intent)).toEqual([
      { from: "g2", to: "f3" },
    ]);
    expectReaction(lineFor(mechaReady, "resolve"), KING_ATTACK_3.f3Marine);
    const f3attack =
      "SCFEN|8/8/8/8/4k3/5p2/6P1/4N1BK|1|33|P|G:11:11|B:3:3|Q:w:C=g2f3;b:";
    expectReaction(lineFor(f3attack), KING_ATTACK_3.mechaDeployReady);
    expect(hintSquares(story.beats, f3attack, undefined, undefined, intent)).toEqual(["g2"]);
    expect(hintArrows(story.beats, f3attack, undefined, undefined, intent)).toEqual([
      { from: "g2", to: "a8" },
    ]);
    expect(hintGas(story.beats, f3attack, undefined, undefined, intent)).toEqual(["h1"]);
    const f3short =
      "SCFEN|8/8/8/8/4k3/5p2/6P1/4N1BK|1|33|P|G:11:11|B:2:3|Q:w:C=g2f3;b:";
    expectReaction(lineFor(f3short), KING_ATTACK_3.deployG2);
    expect(hintSquares(story.beats, f3short, undefined, undefined, intent)).toEqual(["g2"]);
    expect(hintAlerts(story.beats, f3short)).toEqual([]);
    expect(hintArrows(story.beats, f3short, undefined, undefined, intent)).toEqual([]);
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
    expectReaction(lineFor(f3live), KING_ATTACK_3.mechaDeployReady);
    expect(hintArrows(story.beats, f3live, undefined, undefined, intent)).toEqual([
      { from: "g2", to: "a8" },
    ]);
    const f3bikeAttack =
      "SCFEN|8/8/8/8/4k3/5p2/6P1/4N1BK|1|33|P|G:11:11|B:0:3|Q:w:C=e1f3;b:";
    expect(lineFor(f3bikeAttack).comment).toBe(
      "Keep pushing your g-file Marine by dropping gas on it",
    );
    expect(hintGas(story.beats, f3bikeAttack, undefined, undefined, intent)).toEqual([
      "g2",
    ]);
    const promoRank2 =
      "SCFEN|8/8/8/8/4k3/5P2/4p2/4N1BK|1|33|P|G:11:11|Q:w:;b:";
    expectReaction(lineFor(promoRank2), KING_ATTACK_3.f3Marine);
    expect(hintSquares(story.beats, promoRank2)).toEqual(["e2"]);
    expect(hintArrows(story.beats, promoRank2)).toEqual([{ from: "f3", to: "e2" }]);
    const otherFile =
      "SCFEN|8/8/8/p7/8/2p5/8/4K3|1|33|P|G:11:11|Q:w:;b:";
    // c3 sits in the fog of a lone e1 King — the coach cannot call it.
    expect(lineFor(otherFile).comment).not.toBe(KING_ATTACK_3.f3Marine.say);
    expect(hintArrows(story.beats, otherFile)).toEqual([]);
    const otherFileSeen =
      "SCFEN|8/8/8/p7/8/2p5/3K4/8|1|33|P|G:11:11|Q:w:;b:";
    expectReaction(lineFor(otherFileSeen), KING_ATTACK_3.f3Marine);
    expect(hintSquares(story.beats, otherFileSeen)).toEqual(["c3"]);
    expect(hintArrows(story.beats, otherFileSeen)).toEqual([
      { from: "d2", to: "c3" },
    ]);
    // An Attack/Move already queued has spent the stop — no nag.
    const f3moveQueued =
      "SCFEN|8/8/8/8/4k3/5p2/6P1/4N1BK|1|33|P|G:11:11|Q:w:C=e1d3;b:";
    expect(lineFor(f3moveQueued).comment).not.toBe(KING_ATTACK_3.f3Marine.say);
    expect(hintArrows(story.beats, f3moveQueued)).toEqual([]);
    const gasQueuedNoThreat =
      "SCFEN|8/8/8/8/4k3/5P2/6P1/4N1BK|1|33|P|G:11:11|B:0:3|Q:w:B=stimStep:h2:h3;b:";
    expectReaction(lineFor(gasQueuedNoThreat), KING_ATTACK_3.queuedReview);
    const g1ship =
      "SCFEN|8/8/8/8/4k3/K4P2/6P1/4N1q1|1|33|P|G:11:11|Q:w:;b:";
    expectReaction(lineFor(g1ship), KING_ATTACK_3.g1Ship);
    expect(hintSquares(story.beats, g1ship)).toEqual(["g1"]);
    const g1crush =
      "SCFEN|8/8/8/8/4k3/K4P2/6P1/4N1q1|1|33|P|G:11:11|B:0:3|Q:w:B=deploy:h1:g1:n;b:";
    expectReaction(lineFor(g1crush), KING_ATTACK_3.queuedReview);
    expect(hintSquares(story.beats, g1crush)).toEqual(["c2"]);
    expect(hintArrows(story.beats, g1crush)).toEqual([{ from: "e1", to: "c2", via: "c1" }]);
    const e1ship =
      "SCFEN|8/8/8/8/4k3/5P2/6P1/4q1BK|1|33|P|G:11:11|Q:w:;b:";
    expectReaction(lineFor(e1ship), KING_ATTACK_3.e1Ship);
    expect(hintSquares(story.beats, e1ship)).toEqual(["g2", "e1"]);
    const e1handled =
      "SCFEN|8/8/8/8/4k3/5P2/6P1/4q1BK|1|33|P|G:11:11|B:0:3|Q:w:C=g2e1;b:";
    expect(lineFor(e1handled).comment).toBe(
      "Keep pushing your f-file Marine by dropping gas on it",
    );
    expect(hintGas(story.beats, e1handled, undefined, undefined, intent)).toEqual([
      "f3",
    ]);
    const f1ship =
      "SCFEN|8/8/8/8/4k3/5P2/6P1/4NqBK|1|33|P|G:11:11|Q:w:;b:";
    expectReaction(lineFor(f1ship), KING_ATTACK_3.f1Ship);
    expect(hintSquares(story.beats, f1ship)).toEqual(["h2", "f1"]);
    const hp1 =
      "SCFEN|8/8/8/8/4k3/5P2/6P1/4N1BK|1|31|P|G:11:11|Q:w:;b:";
    expectReaction(
      resolveTutorialLine({
        stageId: "live-play",
        storyId: "live-play-attack-3",
        scfen: hp1,
        reviewPhase: "check",
      }),
      KING_ATTACK_3.oneMoreCheck,
    );
    expectReaction(
      resolveTutorialLine({
        stageId: "live-play",
        storyId: "live-play-attack-3",
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
        stageId: "live-play",
        storyId: "live-play-attack-3",
        scfen: hp1,
        reviewPhase: "check",
      }),
      { scfen: hp1, reviewPhase: "check" },
    );
    expect(cheerHold.line.comment).toBe(KING_ATTACK_3.oneMoreCheck.say);
    expect(cheerHold.line.transient).toBe(true);
    expect(cheerHold.hold.sticky).toBeUndefined();
    expect(cheerHold.hold.introDone).toBe(false);
    const spot =
      "SCFEN|8/8/8/3k4/1n6/5P2/6P1/4N1BK|1|33|P|G:11:11|Q:w:;b:";
    expectReaction(lineFor(spot), KING_ATTACK_3.d5b4spot);
    expect(hintSquares(story.beats, spot)).toEqual(["b4"]);
    const h2 =
      "SCFEN|8/8/8/8/4k3/5P2/7P/4N1BK|1|33|P|G:11:11|Q:w:;b:";
    expectReaction(lineFor(h2), KING_ATTACK_3.pushH2);
    const h2AndG2 =
      "SCFEN|8/8/8/8/4k3/5P2/6PP/4N1BK|1|33|P|G:11:11|B:1:3|Q:w:;b:";
    expectReaction(lineFor(h2AndG2), KING_ATTACK_3.pushH2);
    expect(KING_ATTACK_3.pushH2.say).toBe("Move your h-file Marine from h2 to h4.");
    expect(hintSquares(story.beats, h2AndG2, undefined, undefined, intent)).toEqual(["h2"]);
    expect(hintArrows(story.beats, h2AndG2, undefined, undefined, intent)).toEqual([
      { from: "h2", to: "h4" },
    ]);
    const h2Attacker =
      "SCFEN|8/8/8/8/4k3/5p2/6PP/4N1BK|1|33|P|G:11:11|B:1:3|Q:w:;b:";
    expectReaction(lineFor(h2Attacker), KING_ATTACK_3.f3Marine);
    expect(hintSquares(story.beats, h2Attacker, undefined, undefined, intent)).toEqual([
      "f3",
    ]);
    expect(hintArrows(story.beats, h2Attacker, undefined, undefined, intent)).toEqual([
      { from: "g2", to: "f3" },
    ]);
    const h2DoubleQueued =
      "SCFEN|8/8/8/8/4k3/5p2/6PP/4N1BK|1|33|P|G:11:11|B:1:3|Q:w:C=h2h4;b:";
    expectReaction(lineFor(h2DoubleQueued), KING_ATTACK_3.gasReminder);
    expect(KING_ATTACK_3.gasReminder.say).toBe(
      "Keep pushing your h-file Marine by dropping gas on it",
    );
    expect(hintGas(story.beats, h2DoubleQueued, undefined, undefined, intent)).toEqual([
      "h4",
    ]);
    expect(hintArrows(story.beats, h2DoubleQueued, undefined, undefined, intent)).toEqual(
      [],
    );
    const h2Replaced =
      "SCFEN|8/8/8/8/4k3/5P2/6PP/4N1BK|1|33|P|G:01:11|B:0:3|Q:w:B=deploy:h1:g2:p;b:";
    expectReaction(lineFor(h2Replaced), KING_ATTACK_3.pushH2);
    expectReaction(lineFor(h2, "resolve"), KING_ATTACK_3.minesTipTurn2);
    expect(hintSquares(story.beats, h2, undefined, undefined, intent)).toEqual(["h2"]);
    expect(hintArrows(story.beats, h2, undefined, undefined, intent)).toEqual([
      { from: "h2", to: "h4" },
    ]);
    const h2gas =
      "SCFEN|8/8/8/8/4k3/5P2/7P/4N1BK|1|33|P|G:01:11|Q:w:;b:";
    expectReaction(lineFor(h2gas), KING_ATTACK_3.pushH2);
    const h2queued =
      "SCFEN|8/8/8/8/4k3/5P2/7P/4N1BK|0|33|P|G:11:11|B:0:3|Q:w:C=h2h3;b:";
    expectReaction(lineFor(h2queued), KING_ATTACK_3.gasReminder);
    expect(hintGas(story.beats, h2queued, undefined, undefined, intent)).toEqual(["h2"]);
    const h2h4queued = h2queued.replace("C=h2h3", "C=h2h4");
    expect(hintGas(story.beats, h2h4queued, undefined, undefined, intent)).toEqual(["h4"]);
    const h3 =
      "SCFEN|8/8/8/8/4k3/7P/6P1/4N1BK|1|33|P|G:11:11|Q:w:;b:";
    expectReaction(lineFor(h3), KING_ATTACK_3.pushH3);
    expect(hintGas(story.beats, h3, undefined, undefined, intent)).toEqual(["h3"]);
    expect(hintArrows(story.beats, h3, undefined, undefined, intent)).toEqual([
      { from: "h3", to: "h5" },
    ]);
    const h3queued =
      "SCFEN|8/8/8/8/4k3/7P/6P1/4N1BK|1|33|P|G:11:11|B:0:3|Q:w:C=h3h4;b:";
    expectReaction(lineFor(h3queued), KING_ATTACK_3.gasOnMarine);
    expect(hintGas(story.beats, h3queued, undefined, undefined, intent)).toEqual(["h3"]);
    const h4 =
      "SCFEN|8/8/8/8/7P/5P2/6P1/4N1BK|1|33|P|G:11:11|Q:w:;b:";
    expectReaction(lineFor(h4), KING_ATTACK_3.pushH4);
    expect(hintGas(story.beats, h4, undefined, undefined, intent)).toEqual(["h4"]);
    expect(hintArrows(story.beats, h4, undefined, undefined, intent)).toEqual([
      { from: "h4", to: "h6" },
    ]);
    const h4queued =
      "SCFEN|8/8/8/8/7P/5P2/6P1/4N1BK|1|33|P|G:11:11|B:0:3|Q:w:C=h4h5;b:";
    expectReaction(lineFor(h4queued), KING_ATTACK_3.gasOnMarine);
    expect(hintGas(story.beats, h4queued, undefined, undefined, intent)).toEqual(["h4"]);
    const h6 =
      "SCFEN|8/8/7P/8/4k3/5P2/6P1/4N1BK|1|33|P|G:11:11|Q:w:;b:";
    expectReaction(lineFor(h6), KING_ATTACK_3.promotionChoice);
    expect(hintGas(story.beats, h6, undefined, undefined, intent)).toEqual(["h6"]);
    const h6gassed = h6.replace("G:11:11", "G:01:11").replace("Q:w:;", "Q:w:B=stimStep:h6:h7;");
    expect(hintSquares(story.beats, h6gassed, undefined, undefined, intent)).toEqual(["h8"]);
    expect(hintArrows(story.beats, h6gassed, undefined, undefined, intent)).toEqual([
      { from: "h7", to: "h8" },
    ]);
    const h7 =
      "SCFEN|8/7P/8/8/4k3/5P2/6P1/4N1BK|1|33|P|G:11:11|Q:w:;b:";
    expectReaction(lineFor(h7), KING_ATTACK_3.promotionChoice);
    expect(KING_ATTACK_3.promotionChoice.say).toBe(
      "Choose your promotion wisely: \nBattleShip, risk getting sniped \nTank, worse but harder to hit",
    );
    expect(KING_ATTACK_3.promotionChoice.emotion).toBe("thinking");
    expect(hintGas(story.beats, h7, undefined, undefined, intent)).toEqual(["h7"]);
    const h7spent =
      "SCFEN|8/7P/8/8/4k3/5P2/6P1/4N1BK|1|33|P|G:01:11|Q:w:;b:";
    expectReaction(lineFor(h7spent), KING_ATTACK_3.promotionChoice);
    const allyOnBackRank =
      "SCFEN|8/8/8/8/8/8/3p4/5N2|1|33|P|G:11:11|Q:w:;b:";
    expectReaction(lineFor(allyOnBackRank), KING_ATTACK_3.f3Marine);
    expect(hintSquares(story.beats, allyOnBackRank)).toEqual(["d2"]);
    expect(hintArrows(story.beats, allyOnBackRank)).toEqual([{ from: "f1", to: "d2" }]);
    const enemyNotHigher =
      "SCFEN|8/8/8/3p4/8/5P2/8/8|1|33|P|G:11:11|Q:w:;b:";
    expectReaction(lineFor(enemyNotHigher), KING_ATTACK_3.minesTipTurn2);
    const guard =
      "SCFEN|8/8/8/6p1/8/5P2/8/8|1|33|P|G:11:11|Q:w:;b:";
    expectReaction(lineFor(guard), KING_ATTACK_3.guardG1);
    expect(hintSquares(story.beats, guard)).toEqual(["g1"]);
    expect(hintArrows(story.beats, guard)).toEqual([
      { from: "a1", to: "h1" },
    ]);
    const guardQueued =
      "SCFEN|8/8/8/8/4k3/5P2/6P1/4N3|1|33|P|G:11:11|B:0:3|Q:w:B=deploy:h1:g1:n;b:";
    expectReaction(lineFor(guardQueued), KING_ATTACK_3.queuedReview);
    expect(hintSquares(story.beats, guardQueued)).toEqual(["c2"]);
    expect(hintArrows(story.beats, guardQueued)).toEqual([{ from: "e1", to: "c2", via: "c1" }]);
    const planQueued =
      "SCFEN|8/8/8/8/4k3/5P2/6P1/4N1BK|1|33|P|G:11:11|B:0:3|Q:w:C=e1c2;b:";
    expect(lineFor(planQueued).comment).toBe(
      "Keep pushing your f-file Marine by dropping gas on it",
    );
    expect(hintGas(story.beats, planQueued, undefined, undefined, intent)).toEqual([
      "f3",
    ]);
    const centralized =
      "SCFEN|8/8/8/8/4k3/5P2/6P1/4N1BK|0|33|P|G:01:11|B:0:3|Q:w:;b:";
    expectReaction(lineFor(centralized), KING_ATTACK_3.centralize);
    expect(hintSquares(story.beats, centralized)).toEqual(["c2"]);
  });

  it("spends gas on empty g2 then the marine, leaving h2 empty, and coaches the promotion", () => {
    const story = storyOf("live-play", "live-play-attack-3");
    const intent = { reviewPhase: "intent" as const };
    const lineFor = (scfen: string, reviewPhase: "intent" | "resolve" = "intent") =>
      resolveTutorialLine({
        stageId: "live-play",
        storyId: "live-play-attack-3",
        scfen,
        reviewPhase,
      });
    const bothOpen =
      "SCFEN|8/8/8/8/4k3/5P2/8/4N1BK|12|33|P|G:21:22|B:2:2|Q:w:C=e1c2;b:";
    expectReaction(lineFor(bothOpen), KING_ATTACK_3.deployG2);
    expect(hintSquares(story.beats, bothOpen, undefined, undefined, intent)).toEqual([
      "g2",
    ]);
    const g2Queued =
      "SCFEN|8/8/8/8/4k3/5P2/8/4N1BK|12|33|P|G:11:22|B:1:2|Q:w:C=e1c2,F=deploy:h1:g2:p;b:";
    expect(lineFor(g2Queued).comment).toBe(
      "Keep pushing your f-file Marine by dropping gas on it",
    );
    expect(hintGas(story.beats, g2Queued, undefined, undefined, intent)).toEqual([
      "f3",
    ]);
    const broke =
      "SCFEN|8/8/8/8/4k3/5P2/8/4N1BK|12|33|P|G:21:22|B:0:2|Q:w:C=e1c2;b:";
    expect(lineFor(broke).comment).toBe(
      "Keep pushing your f-file Marine by dropping gas on it",
    );
    const leftover =
      "SCFEN|8/8/8/8/4k3/5P2/7P/4N1BK|12|33|P|G:11:22|B:1:2|Q:w:C=e1c2,F=deploy:h1:g2:p;b:";
    expect(lineFor(leftover).comment).toBe(
      "Keep pushing your f-file Marine by dropping gas on it",
    );
    expect(hintGas(story.beats, leftover, undefined, undefined, intent)).toEqual([
      "f3",
    ]);
    const charge =
      "SCFEN|7Q/8/8/3k4/8/8/8/4N1BK|12|33|P|G:11:11|Q:w:;b:";
    expectReaction(lineFor(charge), KING_ATTACK_3.goGetEm);
    expect(KING_ATTACK_3.goGetEm.say).toBe("Go get 'em!");
    expect(hintArrows(story.beats, charge, undefined, undefined, intent)).toEqual([
      { from: "h8", to: "d8" },
      { from: "d8", to: "d5", tone: "alert" },
    ]);
    const chargeOverDeploy =
      "SCFEN|7Q/8/8/3k4/8/8/8/4N1BK|12|33|P|G:11:11|B:3:3|Q:w:;b:";
    const chargeTraj = availableTrajectories(chargeOverDeploy, "w");
    expect(chargeTraj).toEqual([{ key: "deploy-b-g2-d5", from: "g2", to: "d5" }]);
    expectReaction(
      resolveTutorialLine({
        stageId: "live-play",
        storyId: "live-play-attack-3",
        scfen: chargeOverDeploy,
        reviewPhase: "intent",
        trajectories: chargeTraj,
      }),
      KING_ATTACK_3.goGetEm,
    );
    expect(
      hintArrows(story.beats, chargeOverDeploy, undefined, chargeTraj, intent),
    ).toEqual([
      { from: "h8", to: "d8" },
      { from: "d8", to: "d5", tone: "alert" },
    ]);
    const mechaOnG2 =
      "SCFEN|8/8/8/8/4k3/8/6B1/4N1BK|1|33|P|G:11:11|Q:w:;b:";
    expectReaction(lineFor(mechaOnG2), KING_ATTACK_3.mechaThreat);
    expect(KING_ATTACK_3.mechaThreat.say).toBe(
      "Threat that Command Center with your Mecha",
    );
    expect(KING_ATTACK_3.mechaThreat.emotion).toBe("thinking");
    expect(hintArrows(story.beats, mechaOnG2, undefined, undefined, intent)).toEqual([
      { from: "g2", to: "a8" },
    ]);
    expect(
      hintArrows(story.beats, charge, undefined, undefined, { reviewPhase: "resolve" }),
    ).toEqual([]);
    const tankOnH8 =
      "SCFEN|7R/8/8/3k4/8/8/8/4N1BK|12|33|P|G:11:11|Q:w:;b:";
    expectReaction(lineFor(tankOnH8), KING_ATTACK_3.goGetEm);
    const chargeQueued =
      "SCFEN|7Q/8/8/3k4/8/8/8/4N1BK|12|33|P|G:11:11|B:0:2|Q:w:C=e1c2;b:";
    expectReaction(lineFor(chargeQueued), KING_ATTACK_3.queuedReview);
    const closeMarine =
      "SCFEN|7Q/8/8/3k4/8/5p2/8/4N1BK|12|33|P|G:11:11|Q:w:;b:";
    expectReaction(lineFor(closeMarine), KING_ATTACK_3.goGetEm);
    expect(hintArrows(story.beats, closeMarine, undefined, undefined, intent)).toEqual([
      { from: "h8", to: "d8" },
      { from: "d8", to: "d5", tone: "alert" },
    ]);
    const backRankShip =
      "SCFEN|7Q/8/8/3k4/8/8/8/4q1BK|12|33|P|G:11:11|Q:w:;b:";
    expectReaction(lineFor(backRankShip), KING_ATTACK_3.e1Ship);
    const tank =
      "SCFEN|8/8/8/3k3R/8/8/8/4N1BK|12|33|P|G:11:11|Q:w:;b:";
    expectReaction(lineFor(tank), KING_ATTACK_3.tankSiege);
    expect(KING_ATTACK_3.tankSiege.say).toBe(
      "Drop Gas on it to siege for bigger range",
    );
    const tankToD8 =
      "SCFEN|7R/8/8/3k4/8/8/8/4N1BK|12|33|P|G:11:11|Q:w:C=h8d8;b:";
    expectReaction(lineFor(tankToD8), KING_ATTACK_3.tankSiege);
    expect(hintGas(story.beats, tankToD8, undefined, undefined, intent)).toEqual([
      "h8",
    ]);
    const tankToH5 =
      "SCFEN|7R/8/8/3k4/8/8/8/4N1BK|12|33|P|G:11:11|Q:w:C=h8h5;b:";
    expectReaction(lineFor(tankToH5), KING_ATTACK_3.tankSiege);
    expect(hintGas(story.beats, tankToH5, undefined, undefined, intent)).toEqual([
      "h8",
    ]);
    const tankSiegeQueued =
      "SCFEN|7R/8/8/3k4/8/8/8/4N1BK|12|33|P|G:11:11|Q:w:C=h8d8,F=siegeMode:h8;b:";
    expect(lineFor(tankSiegeQueued).comment).not.toBe(KING_ATTACK_3.tankSiege.say);
    const tankToD8Dry =
      "SCFEN|7R/8/8/3k4/8/8/8/4N1BK|12|33|P|G:01:11|Q:w:C=h8d8;b:";
    expect(lineFor(tankToD8Dry).comment).not.toBe(KING_ATTACK_3.tankSiege.say);
    const shipToD8 =
      "SCFEN|7Q/8/8/3k4/8/8/8/4N1BK|12|33|P|G:11:11|Q:w:C=h8d8;b:";
    expect(lineFor(shipToD8).comment).not.toBe(KING_ATTACK_3.tankSiege.say);
    expect(KING_ATTACK_3.tankSiege.emotion).toBe("scanning");
    expect(hintGas(story.beats, tank, undefined, undefined, intent)).toEqual(["h5"]);
    const sieged =
      "SCFEN|8/8/8/3k3R/8/8/8/4N1BK|12|33|P|G:11:11|Q:w:;b:|S:h5";
    expect(lineFor(sieged).comment).not.toBe(KING_ATTACK_3.tankSiege.say);
    const tankDry =
      "SCFEN|8/8/8/3k3R/8/8/8/4N1BK|12|33|P|G:01:11|Q:w:;b:";
    expect(lineFor(tankDry).comment).not.toBe(KING_ATTACK_3.tankSiege.say);
    expectReaction(
      resolveTutorialLine({
        stageId: "live-play",
        storyId: "live-play-attack-3",
        scfen: charge,
        reviewPhase: "resolve",
        shipSniped: true,
      }),
      KING_ATTACK_3.shipSniped,
    );
    expect(KING_ATTACK_3.shipSniped.transient).toBe(true);
    let watch = nextBattleShipWatch(
      { onH8: false, sniped: false },
      { onH8: true, alive: true, reviewPhase: "intent" },
    );
    watch = nextBattleShipWatch(watch, { onH8: false, alive: true, reviewPhase: "intent" });
    expect(watch).toEqual({ onH8: false, sniped: false });
    watch = nextBattleShipWatch(
      { onH8: true, sniped: false },
      { onH8: false, alive: false, reviewPhase: "resolve" },
    );
    expect(watch.sniped).toBe(true);
    watch = nextBattleShipWatch(watch, { onH8: false, alive: false, reviewPhase: "resolve" });
    expect(watch.sniped).toBe(true);
    watch = nextBattleShipWatch(watch, { onH8: false, alive: false, reviewPhase: "intent" });
    expect(watch).toEqual({ onH8: false, sniped: false });
  });

  it("fires king-attack-3 take-it lines when a unit already covers the ship", () => {
    const story = storyOf("live-play", "live-play-attack-3");
    const lineFor = (scfen: string) =>
      resolveTutorialLine({
        stageId: "live-play",
        storyId: "live-play-attack-3",
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
          stageId: "live-play",
          storyId: "live-play-attack-3",
          scfen,
          covers,
        }),
        reaction,
      );
      expect(hintSquares(story.beats, scfen, covers)).toEqual(ring);
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
    expect(hintGas(story.beats, b4post)).toEqual(["c2"]);
    const b4contested =
      "SCFEN|8/8/8/3k4/1n6/5P2/2N3P1/4N1BK|1|33|P|G:11:11|Q:w:;b:";
    expectReaction(lineFor(b4contested), KING_ATTACK_3.mineC2);
    expect(hintGas(story.beats, b4contested)).toEqual(["c2"]);
    const b4mined =
      "SCFEN|8/8/8/3k4/8/5P2/2N3P1/4N1BK|1|33|P|G:01:11|B:0:3|Q:w:B=spiderMine:c2:c3;b:";
    expectReaction(lineFor(b4mined), KING_ATTACK_3.b4attack);
    expect(hintSquares(story.beats, b4mined)).toEqual(["b4"]);
    const intent = { reviewPhase: "intent" as const };
    expect(hintSquares(story.beats, b4mined, undefined, undefined, intent)).toEqual([
      "b4",
    ]);
    expect(hintArrows(story.beats, b4mined, undefined, undefined, intent)).toEqual([
      { from: "c2", to: "b4", via: "c4" },
      { from: "b4", to: "d5", via: "d4", tone: "alert" },
    ]);
    expect(
      hintArrows(story.beats, b4mined, undefined, undefined, {
        reviewPhase: "resolve",
      }),
    ).toEqual([]);
    expect(hintArrows(story.beats, b4post, undefined, undefined, intent)).toEqual([]);
    const b4noCc =
      "SCFEN|8/8/8/8/4k3/5P2/2N3P1/4N1BK|1|33|P|G:11:11|Q:w:;b:";
    expectReaction(lineFor(b4noCc), KING_ATTACK_3.minesTipTurn2);
    const b4noBike =
      "SCFEN|8/8/8/3k4/8/5P2/6P1/4N1BK|1|33|P|G:11:11|Q:w:;b:";
    expectReaction(lineFor(b4noBike), KING_ATTACK_3.minesTipTurn2);
  });

  it("prefers the funded g2 Mecha diagonal over the mine-first post", () => {
    const story = storyOf("live-play", "live-play-attack-3");
    const traj = (placement: string, bank: string) => {
      const scfen = `SCFEN|${placement}|1|33|P|G:11:11|${bank}|Q:w:;b:`;
      return { scfen, trajectories: availableTrajectories(scfen, "w") };
    };
    const funded = traj("8/8/8/3k4/8/5P2/2N4P/4N1BK", "B:3:3");
    expect(funded.trajectories).toEqual([{ key: "deploy-b-g2-d5", from: "g2", to: "d5" }]);
    expectReaction(
      resolveTutorialLine({
        stageId: "live-play",
        storyId: "live-play-attack-3",
        scfen: funded.scfen,
        trajectories: funded.trajectories,
      }),
      KING_ATTACK_3.deployMecha,
    );
    expect(
      hintSquares(story.beats, funded.scfen, undefined, funded.trajectories),
    ).toEqual(["g2", "d5"]);
    expect(
      hintArrows(story.beats, funded.scfen, undefined, funded.trajectories),
    ).toEqual([{ from: "g2", to: "d5" }]);
    const broke = traj("8/8/8/3k4/8/5P2/2N3P1/4N1BK", "B:2:3");
    expect(broke.trajectories).toEqual([]);
    expectReaction(
      resolveTutorialLine({
        stageId: "live-play",
        storyId: "live-play-attack-3",
        scfen: broke.scfen,
        trajectories: broke.trajectories,
      }),
      KING_ATTACK_3.mineC2,
    );
    expect(
      hintGas(story.beats, broke.scfen, undefined, broke.trajectories),
    ).toEqual(["c2"]);
  });

  it("holds the king-defense CC warning only while the Mecha is alive", () => {
    const r = namedReactions(
      "live-play",
      "live-play-defense-1",
      "mechaDown",
      "attackTheMecha",
      "ccUnderAttack",
    );
    const lineFor = (scfen: string) =>
      resolveTutorialLine({ stageId: "live-play", storyId: "live-play-defense-1", scfen });
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
      "SCFEN|7k/8/8/8/8/8/7b/4K3|1|23|P|G:11:11|B:2:3|Q:w:B=deploy:e1:f2:p;b:";
    expectReaction(lineFor(spawnQueued), r.attackTheMecha);
  });

  it("handles king-defense-2 script completeWhen and coach reactions", () => {
    const r = namedReactions(
      "live-play",
      "live-play-defense-2",
      "attackTheShip",
      "cornered",
    );
    const complete = storyOf("live-play", "live-play-defense-2").completeWhen;
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
        stageId: "live-play",
        storyId: "live-play-defense-2",
        scfen: checkChipScfen,
      }),
      r.cornered,
    );

    // Same chip one turn later: the tip is gated to turn 11, so nothing shows.
    const turn12Scfen =
      "SCFEN|7k/8/8/8/8/8/6bq/6BK|12|13|P|G:22:22|B:1:1|Q:w:;b:";
    const turn12 = resolveTutorialLine({
      stageId: "live-play",
      storyId: "live-play-defense-2",
      scfen: turn12Scfen,
    });
    expect(turn12.comment).not.toBe(r.cornered.say);
    expectIntro(turn12, "live-play", "live-play-defense-2");

    const spawnQueuedScfen =
      "SCFEN|7k/8/8/8/8/8/6bq/6BK|11|13|P|G:22:22|B:0:1|Q:w:B=deploy:h1:g2:p;b:";
    expectReaction(
      resolveTutorialLine({
        stageId: "live-play",
        storyId: "live-play-defense-2",
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
    storyId: "live-play-defense-3" | "live-play-defense-4" | "live-play-attack-1",
    actions: readonly ScActionInput[],
  ): { afterResolve: string; afterNextTurnOpen: string } => {
    const seed = refillTurnGas(parseScFen(lessonBoard("live-play", storyId).scfen));
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
      "live-play",
      "live-play-defense-3",
      "ownCcDead",
      "shootTheHoverbike",
    );
    const { completeWhen: complete, restartWhen: restart } = storyOf(
      "live-play",
      "live-play-defense-3",
    );
    const seed = lessonBoard("live-play", "live-play-defense-3").scfen;

    // Neither gate may fire on the seed, or the lesson resolves before it starts.
    expect(matchesTutorialCompleteWhen(complete, seed)).toBe(false);
    expect(matchesTutorialCompleteWhen(restart, seed)).toBe(false);

    // Gas the f2 marine onto f3 (resolves before the attack phase), then shoot e4.
    const solved = playLesson("live-play-defense-3", [
      { timing: "B", kind: "stimStep", color: "w", from: "f2", to: "f3" },
      { timing: "C", kind: "classical", color: "w", from: "f3", to: "e4" },
    ]);
    expect(matchesTutorialCompleteWhen(complete, solved.afterResolve)).toBe(true);
    expect(matchesTutorialCompleteWhen(restart, solved.afterResolve)).toBe(false);
    expect(matchesTutorialCompleteWhen(restart, solved.afterNextTurnOpen)).toBe(
      false,
    );

    // Idle: nf2 lands, then checks h1 at the next turn open — CC at HP 1 dies.
    const idle = playLesson("live-play-defense-3", []);
    expect(matchesTutorialCompleteWhen(complete, idle.afterResolve)).toBe(false);
    expect(matchesTutorialCompleteWhen(restart, idle.afterNextTurnOpen)).toBe(true);
    expect(matchesTutorialCompleteWhen(complete, idle.afterNextTurnOpen)).toBe(
      false,
    );

    // Gas without the shot is not a solve — the hoverbike just walks onto f2.
    const gasOnly = playLesson("live-play-defense-3", [
      { timing: "B", kind: "stimStep", color: "w", from: "f2", to: "f3" },
    ]);
    expect(matchesTutorialCompleteWhen(complete, gasOnly.afterResolve)).toBe(false);
    expect(matchesTutorialCompleteWhen(restart, gasOnly.afterNextTurnOpen)).toBe(
      true,
    );

    // Ship-lesson failure shape: the death line holds the bubble while
    // `restartWhen` draws the Retry countdown, so the player reads *why* first.
    expectReaction(
      resolveTutorialLine({
        stageId: "live-play",
        storyId: "live-play-defense-3",
        scfen: idle.afterNextTurnOpen,
      }),
      r.ownCcDead,
    );
  });

  it("king-defense-3 moves its line and hint once the marine is gassed", () => {
    const r = namedReactions(
      "live-play",
      "live-play-defense-3",
      "ownCcDead",
      "shootTheHoverbike",
    );
    const hints = storyOf("live-play", "live-play-defense-3").beats;
    const seed = lessonBoard("live-play", "live-play-defense-3").scfen;
    const gasQueued =
      "SCFEN|k7/8/8/8/4n3/8/4PP1P/7K|1|13|P|G:01:11|B:0:3|Q:w:B=stimStep:f2:f3;b:C=e4f2";

    expectIntro(
      resolveTutorialLine({
        stageId: "live-play",
        storyId: "live-play-defense-3",
        scfen: seed,
      }),
      "live-play",
      "live-play-defense-3",
    );
    expectReaction(
      resolveTutorialLine({
        stageId: "live-play",
        storyId: "live-play-defense-3",
        scfen: gasQueued,
      }),
      r.shootTheHoverbike,
    );

    expect(hintGas(hints, seed)).toEqual(["f2"]);
    expect(hintSquares(hints, gasQueued)).toEqual(["e4"]);

    // The solve is only *clickable* if the board projects the gassed marine onto
    // f3 and offers e4 from there — the same two helpers `useBoardInput` uses to
    // select a piece and fill `legalDests`.
    const snap = parseScFen(gasQueued);
    const raw = placementToMap(snap.placement);
    const { map, siegedTanks } = occupancyForQueuedMoves(raw, "w", true, snap);
    expect(pieceAtQueuedSquare(raw, "f3", "w", snap.queue?.actions)).toEqual({
      type: "p",
      color: "w",
    });
    expect(
      scMovesFrom(map, "f3", "w", { siegedTanks }).map((m) => m.to),
    ).toContain("e4");
  });

  it("king-defense-4 completes on the h2 collision and restarts when idle", () => {
    const r = namedReactions("live-play", "live-play-defense-4", "ownCcDead");
    const story = storyOf("live-play", "live-play-defense-4");
    const { completeWhen: complete, restartWhen: restart } = story;
    const seed = lessonBoard("live-play", "live-play-defense-4").scfen;

    expect(matchesTutorialCompleteWhen(complete, seed)).toBe(false);
    expect(matchesTutorialCompleteWhen(restart, seed)).toBe(false);
    expect(hintSquares(story.beats, seed)).toEqual(["h2"]);

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
        stageId: "live-play",
        storyId: "live-play-defense-4",
        scfen: seed,
      }),
      "live-play",
      "live-play-defense-4",
    );

    // Both movers land on h2 in the move phase → both die, tile empty.
    const solved = playLesson("live-play-defense-4", [
      { timing: "C", kind: "classical", color: "w", from: "e5", to: "h2" },
    ]);
    expect(matchesTutorialCompleteWhen(complete, solved.afterResolve)).toBe(true);
    expect(matchesTutorialCompleteWhen(restart, solved.afterResolve)).toBe(false);
    expect(matchesTutorialCompleteWhen(restart, solved.afterNextTurnOpen)).toBe(
      false,
    );

    // Idle: the tank reaches h2 and checks the HP-1 CC at the next turn open.
    const idle = playLesson("live-play-defense-4", []);
    expect(matchesTutorialCompleteWhen(complete, idle.afterResolve)).toBe(false);
    expect(matchesTutorialCompleteWhen(restart, idle.afterNextTurnOpen)).toBe(true);
    expect(matchesTutorialCompleteWhen(complete, idle.afterNextTurnOpen)).toBe(
      false,
    );
    expectReaction(
      resolveTutorialLine({
        stageId: "live-play",
        storyId: "live-play-defense-4",
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
      "live-play",
      "live-play-attack-1",
      "shipDown",
      "stackedDamage",
      "halfHit",
    );
    const story = storyOf("live-play", "live-play-attack-1");
    const seed = lessonBoard("live-play", "live-play-attack-1").scfen;
    const seedSnap = parseScFen(seed);

    // Seed must be inert: no gate fires, and turn-open chips nobody.
    expect(matchesTutorialCompleteWhen(story.completeWhen, seed)).toBe(false);
    expect(matchesTutorialCompleteWhen(story.restartWhen, seed)).toBe(false);
    expect(beginScTurn(seedSnap).changed).toBe(false);
    expect(hintSquares(story.beats, seed)).toEqual(["b7"]);

    // Seed furniture the geometry below leans on: a Marine (not a tank) on the
    // b7 choke point, a dug-in enemy tank on a2, and enemy mines on c6/d4.
    // c6 sits *on* the h1-a8 diagonal — mines are not FEN pieces, so the
    // Bishop's line must read straight through it (core: mine/mineChecks).
    const seedMap = placementToMap(seedSnap.placement);
    expect(seedMap.get("b7")).toEqual({ type: "p", color: "b" });
    expect(seedMap.get("a2")).toEqual({ type: "r", color: "b" });
    expect(seedSnap.siegedTanks).toEqual(["a2", "b1"]);
    expect(seedSnap.mines).toEqual([
      { color: "b", at: "c6" },
      { color: "b", at: "d4" },
    ]);
    expect(rayBetween("h1", "a8")).toContain("c6");

    // White must be able to *see* a8 or `collectLegalCCChecks` never fires —
    // only the back-rank ship reaches that far, so this is load-bearing.
    expect(getSideVision(seedSnap.placement, "w").litSquares.has("a8")).toBe(true);
    expect(
      collectLegalCCChecks(seedSnap.placement).filter((c) => c.color === "w"),
    ).toEqual([]);

    // Solve: one shot. Rb1 siege-fires b7 without vacating, which clears the
    // choke point the h1-a8 diagonal shares with everything else.
    const solved = playLesson("live-play-attack-1", [
      { timing: "C", kind: "classical", color: "w", from: "b1", to: "b7" },
    ]);
    const opened = parseScFen(solved.afterNextTurnOpen);
    expect(
      collectLegalCCChecks(parseScFen(solved.afterResolve).placement)
        .filter((c) => c.color === "w")
        .map((c) => `${c.piece}${c.from}`),
    ).toEqual(["qd8", "bh1"]);
    // The Bishop shot through the c6 mine: the mine neither blocked the line
    // nor was spent by it (only a capture *on* the tile spends a mine).
    expect(parseScFen(solved.afterResolve).mines).toEqual(
      expect.arrayContaining([{ color: "b", at: "c6" }]),
    );
    // Two checkers vs HP 2 — dead at the open, before Black plans turn 12.
    expect(opened.ccLives).toEqual({ w: 3, b: 0 });
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
        stageId: "live-play",
        storyId: "live-play-attack-1",
        scfen: solved.afterNextTurnOpen,
      }),
      r.stackedDamage,
    );

    // Leaving b7 alive costs the mecha: Black's own hoverbike still uncovers the
    // ship, so one checker lands and the CC survives on 1 — the branch where the
    // `kingAttackTankCounter` counterattack gets to happen at all.
    const idle = playLesson("live-play-attack-1", []);
    const survived = parseScFen(idle.afterNextTurnOpen);
    expect(
      collectLegalCCChecks(parseScFen(idle.afterResolve).placement)
        .filter((c) => c.color === "w")
        .map((c) => `${c.piece}${c.from}`),
    ).toEqual(["qd8"]);
    expect(survived.ccLives).toEqual({ w: 3, b: 1 });
    expect(survived.phase).toBe("P");
    expectReaction(
      resolveTutorialLine({
        stageId: "live-play",
        storyId: "live-play-attack-1",
        scfen: idle.afterNextTurnOpen,
      }),
      r.halfHit,
    );
    // ...and it is *not* the stacked line: one checker connected, not two.
    expect(r.halfHit.say).not.toBe(r.stackedDamage.say);

    // Black's turn 12 (what the choreography queues): deploy a tank onto the
    // square its hoverbike left, and shoot the BattleShip. Attacks resolve
    // before moves, so the ship cannot be walked out of it — `restartWhen`
    // fires and the player is sent back to turn 11.
    let counter = refillTurnGas(survived);
    for (const action of [
      { timing: "B", kind: "deploy", color: "b", from: "a8", to: "b8", unit: "r" },
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
        stageId: "live-play",
        storyId: "live-play-attack-1",
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
      "live-play",
      "live-play-attack-2",
      "shipDown",
      "ownCcDead",
      "juked",
      "tankCanKillHoverbike",
      "jukeTip",
    );
    const story = storyOf("live-play", "live-play-attack-2");
    const board = lessonBoard("live-play", "live-play-attack-2");
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
    expect(r.jukeTip.say).toBe(story.comment);
    expectReaction(
      resolveTutorialLine({
        stageId: "live-play",
        storyId: "live-play-attack-2",
        scfen: seed,
      }),
      r.jukeTip,
    );

    // Standing check on the long diagonal — the opening turn costs Black 1 HP.
    const opened = beginScTurn(snap);
    expect(
      collectLegalCCChecks(snap.placement).map((c) => `${c.piece}${c.from}`),
    ).toEqual(["qh7"]);
    expect(opened.next.ccLives).toEqual({ w: 3, b: 2 });

    // The adjutant's reply: deploy onto f5 and shoot the ship where it sits.
    const reply = adjutant(opened.next, { color: "b", storedFor: () => 3 });
    const queued = reply.snapshot.queue?.actions ?? [];
    expect(queued.some((a) => a.timing === "B" && a.kind === "deploy")).toBe(true);
    expect(
      queued.some((a) => a.timing === "C" && a.to === "h7"),
      "adjutant must punish a ship left on h7",
    ).toBe(true);

    const warpQueued =
      "SCFEN|8/7Q/8/4p3/3bkn2/8/5R2/7K|21|32|P|G:03:33|B:0:3|Q:w:B=tacticalJump:h7:h4;b:|S:f2";
    expectReaction(
      resolveTutorialLine({
        stageId: "live-play",
        storyId: "live-play-attack-2",
        scfen: warpQueued,
      }),
      r.juked,
    );
    expect(hintSquares(story.beats, warpQueued)).toEqual(["f2"]);
    expect(hintArrows(story.beats, warpQueued)).toEqual([
      { from: "f2", to: "f4" },
      { from: "h4", to: "e4", tone: "alert" },
    ]);
    expect(hintSquares(story.beats, seed)).toEqual(["h4"]);
    expect(hintGas(story.beats, seed)).toEqual(["h7"]);
    expect(hintArrows(story.beats, seed)).toEqual([{ from: "h7", to: "h4" }]);
    const nextTurn =
      "SCFEN|8/8/8/4p3/3bkn1Q/8/5R2/7K|22|32|P|G:33:33|B:0:3|Q:w:;b:|S:f2";
    expectReaction(
      resolveTutorialLine({ stageId: "live-play", storyId: "live-play-attack-2", scfen: nextTurn }),
      r.tankCanKillHoverbike,
    );
    expect(hintSquares(story.beats, nextTurn)).toEqual(["f4"]);
    expect(hintArrows(story.beats, nextTurn)).toEqual([{ from: "f2", to: "f4" }]);
    expect(hintSquares(story.beats, nextTurn.replace("Q:w:;", "Q:w:C=f2f4;"))).not.toEqual(["f4"]);
    const jumped =
      "SCFEN|8/3Q4/8/4p3/3bkn2/8/5R2/7K|21|33|P|G:33:33|Q:w:;b:|S:f2";
    expect(hintArrows(story.beats, jumped)).toEqual([{ from: "d7", to: "h4" }]);
    expect(hintArrows(story.beats, jumped.replace("|21|", "|22|").replace("3bkn2", "3bk3"))).toEqual([
      { from: "d7", to: "a8" },
    ]);
    const tookMecha =
      "SCFEN|8/8/8/4p3/3bk3/8/2Q2R2/7K|22|32|P|G:33:33|B:0:3|Q:w:;b:|S:f2";
    expect(hintSquares(story.beats, tookMecha)).toEqual(["b1"]);
    expect(hintArrows(story.beats, tookMecha)).toEqual([{ from: "c2", to: "b1" }]);
    // No three canisters, no jump to suggest.
    expect(hintSquares(story.beats, tookMecha.replace("G:33:", "G:03:"))).toEqual([]);
    expect(hintSquares(story.beats, seed.replace("|33|", "|32|"))).toEqual([
      "h4",
    ]);
    expect(
      // A jump already queued: nothing left to suggest.
      hintSquares(story.beats, warpQueued.replace("|21|", "|22|")),
    ).toEqual([]);
    expect(
      resolveTutorialLine({
        stageId: "live-play",
        storyId: "live-play-attack-2",
        scfen: warpQueued.replace("|21|", "|22|"),
      }).comment,
    ).toBe(r.jukeTip.say);

    // Losing the ship restarts; losing the CC only ever offers a manual retry,
    // so that reaction has to carry the CTA or the board is a dead end.
    const shipGone = "SCFEN|8/8/8/4p3/3bkn2/8/8/7K|22|33|P|G:33:33|B:0:3|Q:w:;b:";
    expect(matchesTutorialCompleteWhen(story.restartWhen, shipGone)).toBe(true);
    expectReaction(
      resolveTutorialLine({
        stageId: "live-play",
        storyId: "live-play-attack-2",
        scfen: shipGone,
      }),
      r.shipDown,
    );
    expect(r.ownCcDead.action).toMatchObject({ kind: "retryLesson" });
    expect(hintSquares(story.beats, shipGone)).toEqual([]);
    const ccGone = "SCFEN|8/7Q/8/4p3/3bkn2/8/8/8|22|03|P|G:33:33|B:0:3|Q:w:;b:";
    expect(matchesTutorialCompleteWhen(story.restartWhen, ccGone)).toBe(false);
    expectReaction(
      resolveTutorialLine({
        stageId: "live-play",
        storyId: "live-play-attack-2",
        scfen: ccGone,
      }),
      r.ownCcDead,
    );
    expect(hintSquares(story.beats, ccGone)).toEqual([]);
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
        for (const b of story.beats ?? []) {
          if (b.say == null) continue;
          const ms = lessonEndMessageMs(b.say);
          expect(ms).toBeGreaterThan(0);
          expect(ms).toBeLessThanOrEqual(4000);
        }
      }
    }
  });
});
