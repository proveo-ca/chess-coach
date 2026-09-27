// SPEC: _spec/apps/starchess/architecture/storybook-projection.puml
import type { TutorialStoryScript } from "~/tutorial/tutorialScript";

export const queen = {
  id: "queen",
  title: "Queen",
  board: {
    scfen: "SCFEN|7k/r4ppp/8/8/3Q4/8/PPb5/K7|0|33|P|G:11:11|Q:w:;b:|S:a7",
    stored: 4,
    tankMode: "siege",
    endTurnAfterQueue: "first",
    armTimer: false,
    docs: "Black tank dug in on a7, sighted on white Pa2 with Ka1 behind; black mecha c2 spots. Queue Qd4xa7, End.",
  },
  comment: "The Queen has maximum mobility. Capture the threat in a7.",
  emotion: "shocked",
  completeWhen: { kind: "lost", pieces: ["r"] },
  beats: [
    {
      when: { kind: "lost", pieces: ["r"] },
      say: "No more threats!",
      emotion: "happy",
    },
    {
      mark: { squares: ["a7"], arrows: [{ from: "d4", to: "a7" }] },
    },
  ],
} satisfies TutorialStoryScript;
