// SPEC: _spec/apps/starchess/architecture/storybook-projection.puml
import type { TutorialStoryScript } from "~/tutorial/tutorialScript";

export const knight = {
  id: "knight",
  title: "Knight",
  board: {
    scfen: "SCFEN|7k/7p/8/8/3N4/8/8/K7|0|33|P|G:11:11|Q:w:;b:",
    stored: 4,
    alertLatch: "sticky",
    endTurnAfterQueue: "first",
    armTimer: false,
    docs: "Nd4 live. Queue Nd4\u2192e6, End \u2014 L-path + fog.",
  },
  comment: "The Knight now rides a Hoverbike! As it moves, it clears the fog.",
  emotion: "watching",
  completeWhen: {
    kind: "scfen",
    re: /SCFEN\|(?:[^/]*\/){3}6N1/,
  },
  beats: [
    {
      when: { kind: "scfen", re: /SCFEN\|(?:[^/]*\/){3}6N1/ },
      say: "Did you see that?!",
      emotion: "shocked",
    },
    {
      when: { kind: "scfen", re: /SCFEN\|(?:[^/]*\/){2}4N3/ },
      say: "Now move to g5. \nPay attention to the h8 corner!",
      emotion: "watching",
    },
    {
      when: { kind: "scfen", re: /SCFEN\|(?:[^/]*\/){3}6N1/ },
      mark: { squares: [] },
    },
    {
      when: { kind: "scfen", re: /SCFEN\|(?:[^/]*\/){2}4N3/ },
      mark: {
        squares: ["g5"],
        alertSquares: ["h8"],
        arrows: [{ from: "e6", to: "g5", via: "g6" }],
      },
    },
    {
      mark: { squares: ["e6"], arrows: [{ from: "d4", to: "e6", via: "d6" }] },
    },
  ],
} satisfies TutorialStoryScript;
