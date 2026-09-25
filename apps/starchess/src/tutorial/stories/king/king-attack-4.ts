// SPEC: _spec/apps/starchess/architecture/storybook-projection.puml
import type { TutorialStoryScript } from "~/tutorial/tutorialScript";
import { and, or, queued } from "~/tutorial/when";

export const kingAttack4 = {
  id: "king-attack-4",
  title: "Turtled Opponent",
  board: {
    scfen:
      "SCFEN|3r4/pkppp3/npb5/4P3/3P1P2/N1PB4/3NR3/4K3|12|33|P|G:21:22|M:w:b1|S:d8|Q:w:;b:B=spiderMine:a6:a6,C=a6c5",
    stored: 3,
    opponent: "adjutant",
    choreography: "turtledOpeningScript",
    docs: "Enemy Command Center on b7, Siege Tank sieged on d8, Marines on a7/b6/c7/d7/e7, Mecha on c6, Hoverbike on a6 — a fully turtled defense. Ally Command Center on e1, Marines on c3/d4/e5/f4, Hoverbikes on a3/d2, mobile Siege Tank on e2, Mecha on d3, a Mine on b1. Turn 12 (relative turn 1), 3 minerals each side. Scripted: the a6 Hoverbike mines its own square then rides to c5 (turn 1); it then threatens the ally Command Center via c5->d3, dying to its own move if not captured first (turn 2); the enemy deploys a Tank on a6, pushes its b-file Marine, and rides the Tank a6->a1 — running into the ally's own a3 mine if the Hoverbike there has already moved (turn 3). Turn 4 onward hands off to the naive Adjutant.",
  },
  comment: "Uncontested center stinks of rat to me... \n\n Centralize your tank.",
  emotion: "thinking",
  completeWhen: { kind: "lives", enemy: 0 },
  restartWhen: { kind: "lives", own: 0 },
  beats: [
    {
      // Turn 1 (relative), most advanced state: siege queued.
      when: and(
        { kind: "scfen", re: /SCFEN\|[^|]+\|12\|/ },
        or(queued("B=siegeMode:e2"), queued("F=siegeMode:e2")),
      ),
      say: "Move this Marine from f4 to f5.",
      emotion: "thinking",
    },
    {
      // Turn 1, move queued (siege not yet).
      when: and({ kind: "scfen", re: /SCFEN\|[^|]+\|12\|/ }, queued("C=e2e4")),
      say: "Now siege it up with gas.",
      emotion: "thinking",
    },
    {
      // Turn 2, both queued.
      when: and(
        { kind: "scfen", re: /SCFEN\|[^|]+\|13\|/ },
        queued("C=d4c5"),
        or(queued("B=spiderMine:a3"), queued("F=spiderMine:a3")),
      ),
      say: "Deploy a Marine",
      emotion: "thinking",
    },
    {
      // Turn 2, attack queued only.
      when: and({ kind: "scfen", re: /SCFEN\|[^|]+\|13\|/ }, queued("C=d4c5")),
      say: "Guard that back alley with a trap.",
      emotion: "thinking",
    },
    {
      turn: 13,
      say: "I knew it, nowhere to hide with full vision. \n\nThat Hoverbike is a risk to our default location CC.",
      emotion: "thinking",
    },
    {
      // Turn 3, both queued: Hoverbike relocated and the Tank unsieged.
      when: and(
        { kind: "scfen", re: /SCFEN\|[^|]+\|14\|/ },
        queued("C=a3c2"),
        or(queued("B=siegeMode:e4"), queued("F=siegeMode:e4")),
      ),
      say: "Now point it at the enemy CC.",
      emotion: "happy",
    },
    {
      // Turn 3, Hoverbike move queued only.
      when: and({ kind: "scfen", re: /SCFEN\|[^|]+\|14\|/ }, queued("C=a3c2")),
      say: "Force this rat to move with a sieged Tank. \n\nUnsiege your tank.",
      emotion: "happy",
    },
    {
      turn: 14,
      say: "Good job! \n\nHold the C file, as A and B already have mines",
      emotion: "happy",
    },
    {
      when: and(
        { kind: "scfen", re: /SCFEN\|[^|]+\|12\|/ },
        or(queued("B=siegeMode:e2"), queued("F=siegeMode:e2")),
      ),
      mark: { squares: ["f5"], arrows: [{ from: "f4", to: "f5" }] },
    },
    {
      when: and({ kind: "scfen", re: /SCFEN\|[^|]+\|12\|/ }, queued("C=e2e4")),
      mark: { squares: ["e4"] },
    },
    {
      when: { kind: "scfen", re: /SCFEN\|[^|]+\|12\|/ },
      mark: { squares: ["e2"], arrows: [{ from: "e2", to: "e4" }] },
    },
    {
      when: and(
        { kind: "scfen", re: /SCFEN\|[^|]+\|13\|/ },
        queued("C=d4c5"),
        or(queued("B=spiderMine:a3"), queued("F=spiderMine:a3")),
      ),
      mark: { squares: ["e2"] },
    },
    {
      when: and({ kind: "scfen", re: /SCFEN\|[^|]+\|13\|/ }, queued("C=d4c5")),
      mark: { squares: ["a3"] },
    },
    {
      when: { kind: "scfen", re: /SCFEN\|[^|]+\|13\|/ },
      mark: {
        squares: ["c5", "d4"],
        alertSquares: ["d3"],
        arrows: [
          { from: "c5", to: "d3" },
          { from: "d3", to: "e1", tone: "alert" },
          { from: "d4", to: "c5" },
        ],
      },
    },
    {
      when: and(
        { kind: "scfen", re: /SCFEN\|[^|]+\|14\|/ },
        queued("C=a3c2"),
        or(queued("B=siegeMode:e4"), queued("F=siegeMode:e4")),
      ),
      mark: {
        squares: ["b4"],
        arrows: [
          { from: "e4", to: "b4" },
          { from: "b4", to: "b7", tone: "alert" },
        ],
      },
    },
    {
      when: and({ kind: "scfen", re: /SCFEN\|[^|]+\|14\|/ }, queued("C=a3c2")),
      mark: { squares: ["e4"], alertSquares: ["b7"] },
    },
    {
      when: { kind: "scfen", re: /SCFEN\|[^|]+\|14\|/ },
      mark: { squares: ["c2"], arrows: [{ from: "a3", to: "c2" }] },
    },
    {
      mark: { squares: [] },
    },
  ],
} satisfies TutorialStoryScript;
