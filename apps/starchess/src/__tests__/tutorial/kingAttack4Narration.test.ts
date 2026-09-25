import {
  addScAction,
  beginScTurn,
  formatScFen,
  parseScFen,
  type ScFenSnapshot,
} from "@chess-coach/starchess-core";
import { describe, expect, it } from "vitest";

import { resolveTutorialLine, tutorialStory } from "~/tutorial/tutorialScript";

const story = tutorialStory("king", "king-attack-4")!;

const openedSeed = (): ScFenSnapshot => beginScTurn(parseScFen(story.board!.scfen)).next;

const lineFor = (snap: ScFenSnapshot) =>
  resolveTutorialLine({
    stageId: "king",
    storyId: "king-attack-4",
    scfen: formatScFen(snap),
    turn: snap.turn + 1,
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
