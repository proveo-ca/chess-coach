// SPEC: _spec/apps/starchess/architecture/storybook-projection.puml
import type { TutorialStoryScript } from "~/tutorial/tutorialScript";

export const bishop = {
  id: "bishop",
  title: "Bishop",
  board: {
    scfen: "SCFEN|7k/6p1/8/8/3B4/8/8/K7|0|33|P|G:11:11|Q:w:;b:",
    stored: 4,
    endTurnAfterQueue: "first",
    armTimer: false,
    docs: "Bd4 into fog toward h8. End discovers g7 \u2192 Bxg7 (king spared).",
  },
  comment: "Units capture just like Chess, if it wasn't for the fog...",
  emotion: "thinking",
  completeWhen: {
    kind: "scfen",
    re: /SCFEN\|7k\/6B1\/.*\|32\|/,
  },
  beats: [
    {
      when: { kind: "scfen", re: /SCFEN\|7k\/6B1\/.*\|32\|/ },
      say: "...Did you just set that King on fire? \n\nI'll explain that later.",
      emotion: "thinking",
    },
    {
      when: { kind: "reviewPhase", phase: "resolve" },
      say: "A pawn blocks your way!?",
      emotion: "shocked",
    },
    {
      mark: { squares: ["h8"], arrows: [{ from: "d4", to: "h8" }] },
    },
  ],
} satisfies TutorialStoryScript;
