import {
  addScAction,
  beginScTurn,
  formatScFen,
  parseScFen,
  type ScFenSnapshot,
} from "@chess-coach/starchess-core";
import { describe, expect, it } from "vitest";

import { resolveTutorialHint, resolveTutorialLine, tutorialStory } from "~/tutorial/tutorialScript";
import { beatSpecificity, pickBeat } from "~/tutorial/when";

const story = tutorialStory("king", "king-attack-4")!;

const openedSeed = (): ScFenSnapshot => beginScTurn(parseScFen(story.board!.scfen)).next;

const lineFor = (snap: ScFenSnapshot) =>
  resolveTutorialLine({
    stageId: "king",
    storyId: "king-attack-4",
    scfen: formatScFen(snap),
    reviewPhase: "intent",
  }).comment;

describe("king-attack-4 narration", () => {
  it("opens on the intro, not the turn-13 line", () => {
    expect(lineFor(openedSeed())).toBe(story.comment);
  });

  it("answers the queued e2→e4 Tank move after turn-open", () => {
    const { snapshot } = addScAction({
      snapshot: openedSeed(),
      action: { timing: "C", kind: "classical", color: "w", from: "e2", to: "e4" },
    });
    expect(lineFor(snapshot)).toBe("Now siege it up with gas.");
  });
});

describe("beat selection ignores array order", () => {
  const p1 = "3r4/pkppp3/npb5/4P3/3P4/N2B1P2/2PNR3/4K3";
  const p2 = "3r4/pkppp3/1pb5/2n1PP2/3PR3/N1PB4/3N4/4K3";
  const p3 = "3r4/pkppp3/2b5/1pP1PP2/4R3/2P5/3NP3/4K3";
  const black = "b:B=spiderMine:a6:a6,C=a6c5";
  const boards = [
    `SCFEN|${p1}|12|33|P|G:21:22|M:w:b1|S:d8|Q:w:;${black}`,
    `SCFEN|${p1}|12|33|P|G:21:22|M:w:b1|S:d8|Q:w:C=e2e4;${black}`,
    `SCFEN|${p1}|12|33|P|G:11:22|M:w:b1|S:d8|Q:w:C=e2e4,B=siegeMode:e2;${black}`,
    `SCFEN|${p2}|13|33|P|G:22:22|M:w:b1|S:d8e4|Q:w:;b:`,
    `SCFEN|${p2}|13|33|P|G:22:22|M:w:b1|S:d8e4|Q:w:C=d4c5;b:`,
    `SCFEN|${p2}|13|33|P|G:12:22|M:w:b1|S:d8e4|Q:w:C=d4c5,B=spiderMine:a3:a3;b:`,
    `SCFEN|${p3}|14|33|P|G:22:22|M:w:a3b1|S:d8|Q:w:;b:`,
    `SCFEN|${p3}|14|33|P|G:22:22|M:w:a3b1|S:d8|Q:w:C=a3c2;b:`,
    `SCFEN|${p3}|14|33|P|G:12:22|M:w:a3b1|S:d8|Q:w:C=a3c2,B=siegeMode:e4;b:`,
  ];
  const beats = story.beats!;
  const reversed = [...beats].reverse();

  it.each(boards)("king-attack-4 picks the same say and mark reversed: %s", (scfen) => {
    const ctx = { scfen, reviewPhase: "intent" as const };
    expect(pickBeat(reversed, "say", ctx)).toBe(pickBeat(beats, "say", ctx));
    expect(resolveTutorialHint(reversed, ctx)).toEqual(resolveTutorialHint(beats, ctx));
  });

  it("the queued reply outranks its turn's opener", () => {
    const ctx = { scfen: boards[4]!, reviewPhase: "intent" as const };
    expect(pickBeat(beats, "say", ctx)?.say).toBe("Guard that back alley with a trap.");
    expect(beatSpecificity(pickBeat(beats, "say", ctx)!)).toBe(2);
  });

  it("gates `turn:` on the SCFEN turn field", () => {
    const beat = { turn: 13, say: "x" };
    expect(pickBeat([beat], "say", { scfen: boards[3]! })).toBe(beat);
    expect(pickBeat([beat], "say", { scfen: boards[6]! })).toBeUndefined();
    expect(pickBeat([beat], "say", {})).toBeUndefined();
  });
});
