// SPEC: _spec/apps/starchess/architecture/storybook-projection.puml
import type {TutorialStoryScript} from "~/tutorial/tutorialScript";
import {and, not} from "~/tutorial/when";

export const livePlayAttack2 = {
  id: "live-play-attack-2",
  title: "King Attack #2",
  board: {
    scfen: "SCFEN|8/7Q/8/4p3/3bkn2/8/2b2R2/7K|21|33|P|G:33:33|B:0:3|Q:w:;b:|S:f2",
    stored: 0,
    opponent: "adjutant",
    docs: "A BattleShip and a dug-in Siege Tank against a five-unit escort, one of them a Mecha parked on c2. Turn 21 = tier-3 gas, so Tactical Jump (3 vespene) is affordable every turn — the whole point of the lesson. Qh7 already bears on the ke4 diagonal, so the opening turn chips it 3→2 for free; the coached opener is Tactical Jump h7→h4 (no Move is left to stack on it), and the next turn Rf2xf4 takes the Hoverbike; the adjutant answers by deploying and shooting at the ship, so one that sits still dies early. Rf2 is immobile but owns the f-file and rank 2, which covers the nf4 flank and the approach to Kh1. White holds 0 minerals and cannot deploy: keep re-checking the Command Center from a fresh angle, and jump out when the escort closes.",
  },
  comment: "Juke this army with your ship! \nGas it up to escape danger.",
  emotion: "happy",
  completeWhen: {kind: "lives", enemy: 0},
  restartWhen: {kind: "lost", pieces: ["Q"]},
  beats: [
    {
      when: {kind: "lost", pieces: ["Q"]},
      say: "Bruh",
      emotion: "watching",
    },
    {
      when: {kind: "lives", own: 0},
      say: "They went around your ship and took the base. \nGive it another run.",
      emotion: "shocked",
      action: {
        kind: "retryLesson",
        label: "Retry lesson",
      },
    },
    {
      when: {kind: "scfen", re: /SCFEN\|[^|]+\|21\|.*tacticalJump:/},
      say: "Clear the path by blowing the Hoverbike with your Tank",
      emotion: "scanning",
      mark: {
        squares: ["f2"], arrows: [
          {from: "f2", to: "f4"},
          {from: "h4", to: "e4", tone: "alert"},
        ]
      },
    },
    {
      turn: 22,
      when: and(
        {kind: "board", at: {f2: "R", f4: "n"}, notQueuedOnto: "f4"},
        not({kind: "scfen", re: /tacticalJump:/}),
      ),
      say: "Your tank can take out that Hoverbike",
      emotion: "thinking",
      mark: {squares: ["f4"], arrows: [{from: "f2", to: "f4"}]},
    },
    {
      say: "Juke this army with your ship! \nGas it up to escape danger.",
      emotion: "happy",
    },
    {
      when: {kind: "scfen", re: /SCFEN\|[^|]+\|21\|.*tacticalJump:/},
      mark: {},
    },
    {
      when: {kind: "targeting", targetingKind: "tacticalJump"},
      mark: {squares: ["h4"], fromBattleShip: true, arrows: [{from: "h7", to: "h4"}]},
    },
    {
      turn: 21,
      mark: {squares: ["h4"], gasSquares: ["h7"], fromBattleShip: true, arrows: [{from: "h7", to: "h4"}]},
    },
    {
      when: {kind: "shipJuke"},
      mark: {},
    },
  ],
} satisfies TutorialStoryScript;
