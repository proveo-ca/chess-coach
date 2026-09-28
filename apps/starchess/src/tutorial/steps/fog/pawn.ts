// SPEC: _spec/apps/starchess/architecture/storybook-projection.puml
import type { TutorialStoryScript } from "~/tutorial/tutorialScript";

export const pawn = {
  id: "pawn",
  title: "Pawn",
  board: {
    // Kc3, where the previous lesson's hint sends him \u2014 the pawn lesson
    // picks the King up where the King lesson left him.
    scfen: "SCFEN|7k/8/8/8/3P4/2K5/8/8|0|33|P|G:11:11|Q:w:;b:",
    stored: 4,
    endTurnAfterQueue: "first",
    armTimer: false,
    docs: "Pd4 + Kc3 cumulative vision. Queue Pd4\u2192d5, End.",
  },
  comment: "With each piece having vision, slowly the fog of war clears.",
  emotion: "idle",
  completeWhen: {
    kind: "scfen",
    re: /SCFEN\|[^|/]*[NBRQ]/,
  },
  beats: [
    {
      when: { kind: "scfen", re: /SCFEN\|[^/]*\/[^/]*P/ },
      say: "Go ahead promote. See how the pieces look!",
      emotion: "happy",
    },
    {
      when: { kind: "pawnStep" },
      mark: {},
    },
  ],
} satisfies TutorialStoryScript;
