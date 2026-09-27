import {
  addScAction,
  beginScTurn,
  formatScFen,
  parseScFen,
  type ScFenSnapshot,
} from "@chess-coach/starchess-core";
import { describe, expect, it } from "vitest";

import type { TutorialLineHold } from "~/types/tutorial";
import {
  holdTutorialLine,
  matchesTutorialCompleteWhen,
  resolveTutorialHint,
  resolveTutorialLine,
  tutorialStory,
} from "~/tutorial/tutorialScript";
import { beatSpecificity, pickBeat } from "~/tutorial/when";

const story = tutorialStory("live-play", "live-play-attack-4")!;

const openedSeed = (): ScFenSnapshot => beginScTurn(parseScFen(story.board!.scfen)).next;

const lineFor = (snap: ScFenSnapshot) =>
  resolveTutorialLine({
    stageId: "live-play",
    storyId: "live-play-attack-4",
    scfen: formatScFen(snap),
    reviewPhase: "intent",
  }).comment;

describe("live-play-attack-4 narration", () => {
  it("opens on the intro, not the turn-13 line", () => {
    expect(lineFor(openedSeed())).toBe(story.comment);
  });

  it("answers the queued e2→e3 Tank move after turn-open", () => {
    const { snapshot } = addScAction({
      snapshot: openedSeed(),
      action: { timing: "C", kind: "classical", color: "w", from: "e2", to: "e3" },
    });
    expect(lineFor(snapshot)).toBe("Now siege it up with gas.");
  });
});

describe("beat selection ignores array order", () => {
  const p1 = "3r4/pkppp3/npb5/4P3/3P4/N2B1P2/2PNR3/4K3";
  const p2 = "3r4/pkppp3/1pb5/2n1PP2/3P4/N1PBR3/3N4/4K3";
  const p3 = "3r4/pkppp3/2b5/1pP1PP2/8/2P1RP2/3NP3/4K3";
  const black = "b:B=spiderMine:a6:a6,C=a6c5";
  const boards = [
    `SCFEN|${p1}|12|33|P|G:21:22|M:w:b1|S:d8|Q:w:;${black}`,
    `SCFEN|${p1}|12|33|P|G:21:22|M:w:b1|S:d8|Q:w:C=e2e3;${black}`,
    `SCFEN|${p1}|12|33|P|G:11:22|M:w:b1|S:d8|Q:w:C=e2e3,F=siegeMode:e2;${black}`,
    `SCFEN|${p2}|13|33|P|G:22:22|M:w:b1|S:d8e3|Q:w:;b:`,
    `SCFEN|${p2}|13|33|P|G:22:22|M:w:b1|S:d8e3|Q:w:C=d4c5;b:`,
    `SCFEN|${p2}|13|33|P|G:12:22|M:w:b1|S:d8e3|Q:w:C=d4c5,B=spiderMine:a3:a3;b:`,
    `SCFEN|${p3}|14|33|P|G:22:22|M:w:a3b1|S:d8e3|Q:w:;b:`,
    `SCFEN|${p3}|14|33|P|G:22:22|M:w:a3b1|S:d8e3|Q:w:C=a3c2;b:`,
    `SCFEN|${p3}|14|33|P|G:12:22|M:w:a3b1|S:d8e3|Q:w:C=a3c2,B=stimStep:f3:f4;b:`,
  ];
  const beats = story.beats!;
  const reversed = [...beats].reverse();

  it.each(boards)("live-play-attack-4 picks the same say and mark reversed: %s", (scfen) => {
    const ctx = { scfen, reviewPhase: "intent" as const };
    expect(pickBeat(reversed, "say", ctx)).toBe(pickBeat(beats, "say", ctx));
    expect(resolveTutorialHint(reversed, ctx)).toEqual(resolveTutorialHint(beats, ctx));
  });

  it("the queued reply outranks its turn's opener", () => {
    const ctx = { scfen: boards[4]!, reviewPhase: "intent" as const };
    expect(pickBeat(beats, "say", ctx)?.say).toBe("Use gas. \n\nGuard that back alley with a trap.");
    expect(beatSpecificity(pickBeat(beats, "say", ctx)!)).toBe(2);
  });

  it("gates `turn:` on the SCFEN turn field", () => {
    const beat = { turn: 13, say: "x" };
    expect(pickBeat([beat], "say", { scfen: boards[3]! })).toBe(beat);
    expect(pickBeat([beat], "say", { scfen: boards[6]! })).toBeUndefined();
    expect(pickBeat([beat], "say", {})).toBeUndefined();
  });
});

describe("turn 2 Hoverbike warning", () => {
  const base = "SCFEN|3r4/pkppp3/npb5/2N1P3/3P4/N2BRP2/2P5/4K3|13|33|P|G:21:22|M:w:b1|Q:w:;b:";
  const at = (scfen: string) =>
    resolveTutorialLine({ stageId: "live-play", storyId: "live-play-attack-4", scfen, reviewPhase: "intent" })
      .comment;
  const sieged = base.replace("|Q:w:", "|S:d8e3|Q:w:");
  const mobile = base.replace("|Q:w:", "|S:d8|Q:w:");

  it("claims full vision only with the Tank dug in on e3", () => {
    expect(at(sieged)).toBe(
      "I knew it, nowhere to hide with full vision. \n\nThat Hoverbike is a risk to our default location CC. Get it!",
    );
    expect(at(mobile)).toBe("That Hoverbike is a risk to our default location CC. Get it!");
  });

  it("still yields to a queued reply, and keeps the same marks", () => {
    expect(at(sieged.replace("Q:w:;", "Q:w:C=d4c5;"))).toMatch(/^Use gas/);
    expect(resolveTutorialHint(story.beats, { scfen: sieged }).arrows).toEqual(
      resolveTutorialHint(story.beats, { scfen: mobile }).arrows,
    );
  });
});

describe("coach hands over after the scripted turns", () => {
  const at = (turn: number) =>
    story.board!.scfen.replace(/^(SCFEN\|[^|]+\|)\d+\|/, `$1${turn}|`);

  it("hides from turn 16, after the last scripted beat", () => {
    expect(matchesTutorialCompleteWhen(story.hideCoachWhen, at(15))).toBe(false);
    expect(matchesTutorialCompleteWhen(story.hideCoachWhen, at(16))).toBe(true);
    expect(matchesTutorialCompleteWhen(story.hideCoachWhen, at(23))).toBe(true);
  });

  it("says its own farewell and leaves hints up through relative turn 7", () => {
    expect(story.coachFarewell).toBe("Ok I'll let you play. \n\nHere are some hints");
    expect(story.coachFarewellMs).toBe(3000);
    const hintAt = (turn: number) => resolveTutorialHint(story.beats, { scfen: at(turn) });
    for (const turn of [16, 17, 18]) {
      expect(hintAt(turn).squares).toEqual(["e4", "d6"]);
      expect(hintAt(turn).arrows).toEqual([
        { from: "e2", to: "a6" },
        { from: "d2", to: "e4", via: "d4" },
        { from: "e4", to: "d6", via: "e6" },
        { from: "d6", to: "b7", via: "b6", tone: "alert" },
        { from: "f4", to: "f8" },
        { from: "b3", to: "b7" },
      ]);
    }
    expect(hintAt(19).arrows).not.toContainEqual({ from: "f4", to: "f8" });
  });

  it("comes back out on a loss with a retry", () => {
    const lost = at(18).replace(/\|33\|/, "|03|");
    const line = resolveTutorialLine({ stageId: "live-play", storyId: "live-play-attack-4", scfen: lost });
    expect(line).toMatchObject({
      comment: "What happened here?",
      emotion: "shocked",
      action: { kind: "retryLesson" },
    });
  });
});

describe("take out the attacker", () => {
  const deploy = "SCFEN|k7/8/8/8/8/5n2/5P2/4K3|13|33|P|G:11:11|B:3:3|Q:w:;b:";
  const capture = "SCFEN|k4R2/8/8/8/8/5n2/5P2/4K3|13|33|P|G:11:11|B:0:3|Q:w:;b:";
  const evade = "SCFEN|k7/8/8/8/8/5n2/5P2/4K3|13|33|P|G:11:11|B:0:3|Q:w:;b:";
  const line = (scfen: string) =>
    resolveTutorialLine({ stageId: "live-play", storyId: "live-play-attack-4", scfen, reviewPhase: "intent" })
      .comment;
  const hint = (scfen: string) => resolveTutorialHint(story.beats, { scfen, reviewPhase: "intent" });

  it("1. deploys a unit on an empty square that hits the attacker, then attacks with it", () => {
    expect(line(deploy)).toBe(
      "Our Command Center is under fire! \n\nDeploy a Marine on e2 to take out the attacker.",
    );
    expect(hint(deploy)).toMatchObject({ squares: ["e2"], gasSquares: ["e1"], alertSquares: ["f3"] });
    expect(hint(deploy).arrows).toContainEqual({ from: "e2", to: "f3" });
    const deployed = deploy.replace("G:11:11", "G:01:11").replace("Q:w:;", "Q:w:B=deploy:e1:e2:p;");
    expect(line(deployed)).toBe("Now take out the attacker with that Marine!");
    expect(hint(deployed)).toMatchObject({ squares: ["e2"], gasSquares: [] });
    expect(line(deployed.replace(";b:", ",C=e2f3;b:"))).toBe("That should do it. End your turn!");
  });

  it("2. captures with a unit already on the board", () => {
    expect(line(capture)).toBe("Take out the attacker with your Tank!");
    expect(hint(capture).squares).toEqual(["f8"]);
    expect(hint(capture).arrows).toContainEqual({ from: "f8", to: "f3" });
  });

  it("3. moves the Command Center when nothing reaches the attacker", () => {
    expect(line(evade)).toBe("Nothing reaches the attacker. Move your Command Center out of danger!");
    expect(hint(evade).squares).toEqual(["d1"]);
    expect(hint(evade).arrows).toContainEqual({ from: "e1", to: "d1" });
  });
});

describe("off-script orders", () => {
  const seed = story.board!.scfen;
  const line = (scfen: string) =>
    resolveTutorialLine({ stageId: "live-play", storyId: "live-play-attack-4", scfen, reviewPhase: "intent" })
      .comment;

  it("points at the wrong queued action and asks to cancel it", () => {
    const wrong = seed.replace("Q:w:;", "Q:w:C=e2e4;");
    expect(line(wrong)).toBe("Hmmm that's not right, cancel the queued action.");
    expect(resolveTutorialHint(story.beats, { scfen: wrong, reviewPhase: "intent" })).toMatchObject({
      cancelQueued: "C=e2e4",
      squares: [],
      arrows: [],
    });
  });

  it("lets go of the line once the wrong action is cancelled", () => {
    const key = "live-play|live-play-attack-4|0";
    const step = (hold: TutorialLineHold, scfen: string) => {
      const ctx = { stageId: "live-play" as const, storyId: "live-play-attack-4", scfen, reviewPhase: "intent" as const };
      return holdTutorialLine(hold, key, resolveTutorialLine(ctx), ctx);
    };
    let s = step({ lessonKey: "", introDone: false }, seed);
    const opening = s.line.comment;
    s = step(s.hold, seed.replace("Q:w:;", "Q:w:C=e2e4;"));
    expect(s.line.comment).toBe("Hmmm that's not right, cancel the queued action.");
    s = step(s.hold, seed);
    expect(s.line.comment).not.toBe("Hmmm that's not right, cancel the queued action.");
    expect(s.line.comment).toBe(opening);
  });

  it("minds the order: gas on the Tank before its move is out of place", () => {
    const hint = (scfen: string) => resolveTutorialHint(story.beats, { scfen, reviewPhase: "intent" });
    const gasFirst = seed.replace("G:21:", "G:11:").replace("Q:w:;", "Q:w:B=siegeMode:e2,C=e2e3;");
    expect(line(gasFirst)).toBe("Hmmm that's not right, cancel the queued action.");
    expect(hint(gasFirst).cancelQueued).toBe("B=siegeMode:e2");
    const inOrder = seed.replace("G:21:", "G:11:").replace("Q:w:;", "Q:w:C=e2e3,B=siegeMode:e2;");
    expect(hint(inOrder).cancelQueued).toBeNull();
    const third = seed
      .replace("G:21:", "G:01:")
      .replace("Q:w:;", "Q:w:C=e2e3,B=siegeMode:e2,B=stimStep:c2:c3;");
    expect(hint(third).cancelQueued).toBeNull();
  });

  it("skips the correction once the game is off-script (CC under fire)", () => {
    const defend = "SCFEN|k7/8/8/8/8/5n2/5P2/4K3|13|33|P|G:01:11|B:2:3|Q:w:B=deploy:e1:e2:p,C=e2f3;b:";
    expect(line(defend)).not.toBe("Hmmm that's not right, cancel the queued action.");
    expect(resolveTutorialHint(story.beats, { scfen: defend, reviewPhase: "intent" }).cancelQueued).toBeNull();
  });

  it("stays quiet while the queue follows the script", () => {
    const right = seed.replace("Q:w:;", "Q:w:C=e2e3;");
    expect(line(right)).toBe("Now siege it up with gas.");
    expect(resolveTutorialHint(story.beats, { scfen: right, reviewPhase: "intent" }).cancelQueued).toBeNull();
  });
});
