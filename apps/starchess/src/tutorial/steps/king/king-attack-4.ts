// SPEC: _spec/apps/starchess/architecture/storybook-projection.puml
import type { TutorialStoryScript } from "~/tutorial/tutorialScript";
import { and, or, queued } from "~/tutorial/when";

export const kingAttack4 = {
  id: "king-attack-4",
  title: "Turtled Opponent",
  board: {
    scfen:
      "SCFEN|3r4/pkppp3/npb5/4P3/3P4/N2B1P2/2PNR3/4K3|12|33|P|G:21:22|M:w:b1|S:d8|Q:w:;b:B=spiderMine:a6:a6,C=a6c5",
    stored: 3,
    opponent: "adjutant",
    choreography: "turtledOpeningScript",
    docs: "Enemy Command Center on b7, Siege Tank sieged on d8, Marines on a7/b6/c7/d7/e7, Mecha on c6, Hoverbike on a6 — a fully turtled defense. Ally Command Center on e1, Marines on c2/d4/e5/f3, Hoverbikes on a3/d2, mobile Siege Tank on e2, Mecha on d3, a Mine on b1. Turn 12 (relative turn 1), 3 minerals each side. Scripted: the a6 Hoverbike mines its own square then rides to c5 (turn 1); it then threatens the ally Command Center via c5->d3, dying to its own move if not captured first (turn 2); the enemy deploys a Tank on a6, pushes its b-file Marine, and rides the Tank a6->a1 — running into the ally's own a3 mine if the Hoverbike there has already moved (turn 3). Turn 4 onward hands off to the naive Adjutant.",
  },
  comment: "Uncontested center stinks of rat to me... \n\n Centralize your tank.",
  emotion: "thinking",
  completeWhen: { kind: "lives", enemy: 0 },
  restartWhen: { kind: "lives", own: 0 },
  beats: [
    {
      turn: 12,
      mark: { squares: ["e2"], arrows: [{ from: "e2", to: "e3" }] },
    },
    {
      // Turn 1, move queued (siege not yet).
      turn: 12,
      when: queued("C=e2e3"),
      say: "Now siege it up with gas.",
      emotion: "thinking",
      mark: { squares: ["e3"] },
    },
    {
      // Turn 1 (relative), most advanced state: move and siege queued.
      turn: 12,
      when: and(queued("C=e2e3"), or(queued("B=siegeMode:e2"), queued("F=siegeMode:e2"))),
      say: "Use gas. \n\nMove this Marine from c2 to c3.",
      emotion: "thinking",
      mark: { squares: ["c2"], arrows: [{ from: "c2", to: "c3" }] },
    },
    {
      turn: 13,
      say: "I knew it, nowhere to hide with full vision. \n\nThat Hoverbike is a risk to our default location CC. Get it!",
      emotion: "thinking",
      mark: {
        squares: ["c5", "d4"],
        alertSquares: ["d3"],
        arrows: [
          { from: "c5", to: "d3", via: "c3" },
          { from: "d3", to: "e1", via: "d1", tone: "alert" },
          { from: "d4", to: "c5" },
        ],
      },
    },
    {
      // Turn 2, attack queued only.
      turn: 13,
      when: queued("C=d4c5"),
      say: "Use gas. \n\nGuard that back alley with a trap.",
      emotion: "thinking",
      mark: { squares: ["a3"] },
    },
    {
      // Turn 2, both queued.
      turn: 13,
      when: and(queued("C=d4c5"), or(queued("B=spiderMine:a3"), queued("F=spiderMine:a3"))),
      say: "Deploy a Marine dropping gas on the Command Center.",
      emotion: "thinking",
      mark: { squares: ["e2"] },
    },
    {
      turn: 14,
      say: "Good job! \n\nHold the C file, as A and B already have mines",
      emotion: "happy",
      mark: { squares: ["c2"], arrows: [{ from: "a3", to: "c2" }] },
    },
    {
      // Turn 1 (relative), most advanced state: move and siege queued.
      turn: 14,
      when: and(queued("C=a3c2")),
      say: "Use gas. \n\nMove this Marine from f3 to f4.",
      emotion: "thinking",
      mark: { squares: ["f3"], arrows: [{ from: "f3", to: "f4" }] },
    },
    {
      // Turn 3, Hoverbike move queued only.
      turn: 14,
      when: and(queued("C=a3c2"), or(queued("B=stimStep:f3"), queued("F=stimStep:f3"))),
      say: "Force this rat to move with a Tank. \n\nUnsiege it first with gas.",
      emotion: "happy",
      mark: { squares: ["e3"], alertSquares: ["b7"] },
    },
    {
      // Turn 4 (relative), siege in opponent's face
      turn: 15,
      say: "Use gas. \n\nMove the Marine out of the way.",
      emotion: "thinking",
      mark: { squares: ["c3"], arrows: [{ from: "c3", to: "c4" }] },
    },
    {
      turn: 15,
      when: queued("B=stimStep:c3"),
      say: "Now point the Tank at the enemy CC.",
      emotion: "happy",
      mark: {
        squares: ["b3"],
        arrows: [
          { from: "e3", to: "b3" },
          { from: "b3", to: "b7", tone: "alert" },
        ],
      },
    },
    {
      turn: 15,
      when: and(queued("B=stimStep:c3"), queued("C=e3b3")),
      say: "Siege it up with gas in that Tank ghost!",
      emotion: "thinking",
      mark: { squares: ["b3"] },
    },
    {
      turn: 16,
      mark: { squares: [] },
    },
  ],
} satisfies TutorialStoryScript;
