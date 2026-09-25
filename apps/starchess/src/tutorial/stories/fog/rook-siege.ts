// SPEC: _spec/apps/starchess/architecture/storybook-projection.puml
import type { TutorialStoryScript } from "~/tutorial/tutorialScript";

export const rookSiege = {
  id: "rook-siege",
  title: "Rook (siege)",
  board: {
    scfen: "SCFEN|7k/3p4/8/8/p2R3p/8/3p4/K7|0|33|P|G:11:11|Q:w:;b:|S:d4",
    stored: 4,
    tankMode: "siege",
    endTurnAfterQueue: "first",
    armTimer: false,
    objective: "Keep your siege tank on d4 alive — reduce the enemy to 1 pawn.",
    choreography: "siegeFocusCounter",
    docs: "Siege rook on d4 \u2014 immobile 9\u00d79 vision. Fire any square on the cross: empty ground still takes HE, and the first unit in the way intercepts.",
  },
  comment: "The rook has 2 modes, mobile and immobile. \n\n Prevent pawns from promoting!",
  emotion: "scanning",
  // Win when at most one black pawn remains — the d2
  // promotion 4→3 alone must not win. Lose when S:d4 is
  // gone. `endTurnAfterQueue: "first"` ends on one action,
  // so the player kills one highlighted pawn per turn.
  completeWhen: {
    kind: "scfen",
    re: /SCFEN\|(?!(?:[^|]*p){2})/,
  },
  restartWhen: {
    kind: "scfen",
    re: /^(?!.*\|S:[^|]*d4)/,
  },
  beats: [
    {
      when: { kind: "lost", pieces: ["p"] },
      say: "The rook has 2 modes, mobile and immobile. \n\n Prevent pawns from promoting!",
      emotion: "happy",
    },
    {
      when: { kind: "scfen", re: /SCFEN\|[^|]*q[^|]*\|/ },
      say: "It slipped away!",
      emotion: "shocked",
    },
    {
      when: { kind: "scfen", re: /SCFEN\|[^|]+\|(?:[3-9]|\d\d+)\|/ },
      mark: { squares: ["d7"], arrows: [{ from: "d4", to: "d7" }] },
    },
    {
      turn: 3,
      mark: { squares: ["d1"], arrows: [{ from: "d4", to: "d1" }] },
    },
    {
      turn: 2,
      mark: { squares: ["d2"], arrows: [{ from: "d4", to: "d2" }] },
    },
    {
      mark: { squares: ["h4"], arrows: [{ from: "d4", to: "h4" }] },
    },
  ],
} satisfies TutorialStoryScript;
