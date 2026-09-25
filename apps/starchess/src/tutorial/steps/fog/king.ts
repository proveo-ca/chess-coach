// SPEC: _spec/apps/starchess/architecture/storybook-projection.puml
import type { TutorialStoryScript } from "~/tutorial/tutorialScript";

export const king = {
  id: "king",
  title: "King",
  board: {
    scfen: "SCFEN|7k/7p/8/8/3K4/8/8/8|0|33|P|G:11:11|Q:w:;b:",
    stored: 4,
    endTurnAfterQueue: "first",
    armTimer: false,
    docs: "Kd4 live. Queue Kd4\u2192e5, End \u2014 slide + progressive fog.",
  },
  comment: "StarChess units move like Chess pieces. \n...But the board has fog. \n\nTry moving your King, watch the fog follow.",
  emotion: "watching",
  // Turn counter off 0 — the board only leaves turn 0 once a queued move
  // has resolved, and the lone white King is the only thing that can
  // queue one. So this is "any King move, judged after resolve".
  completeWhen: {
    kind: "scfen",
    re: /SCFEN\|[^|]+\|[1-9]/,
  },
  beats: [
    {
      mark: { squares: ["c3"], arrows: [{ from: "d4", to: "c3" }] },
    },
  ],
} satisfies TutorialStoryScript;
