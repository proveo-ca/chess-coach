// SPEC: _spec/apps/starchess/architecture/storybook-projection.puml
import type { TutorialStoryScript } from "~/tutorial/tutorialScript";

export const rookTank = {
  id: "rook-tank",
  title: "Rook (tank)",
  board: {
    scfen: "SCFEN|7k/3p4/8/8/3R4/8/8/K7|0|33|P|G:11:11|Q:w:;b:",
    stored: 4,
    tankMode: "tank",
    endTurnAfterQueue: "first",
    armTimer: false,
    docs: "Tank Rd4\u2192d8 into fog. End: discover d7 \u2192 Rxd7.",
  },
  comment: "This is a rook, it would also capture if it wasn't for the fog...",
  emotion: "watching",
  completeWhen: {
    kind: "scfen",
    re: /SCFEN\|[^|]+\|[1-9]/,
  },
  beats: [
    {
      when: { kind: "reviewPhase", phase: "resolve" },
      say: "Reveal pawn on d7, capture.",
      emotion: "happy",
    },
    {
      mark: { squares: ["d8"], arrows: [{ from: "d4", to: "d8" }] },
    },
  ],
} satisfies TutorialStoryScript;
