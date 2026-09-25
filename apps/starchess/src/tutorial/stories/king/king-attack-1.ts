// SPEC: _spec/apps/starchess/architecture/storybook-projection.puml
import type { TutorialStoryScript } from "~/tutorial/tutorialScript";

export const kingAttack1 = {
  id: "king-attack-1",
  title: "King Attack #1",
  board: {
    scfen: "SCFEN|kn1Q4/ppp5/8/8/3n4/8/r4P1P/1R4KB|11|32|P|G:20:22|B:4:6|Q:w:;b:C=b8d7,B=spiderMine:b8:b8|S:a2b1|M:w:;b:c6d4",
    stored: 4,
    endTurnAfterQueue: "first",
    choreography: "kingAttackTankCounter",
    /*
     * Timer on, like every other King lesson. This seed's black gas reads
     * 0 (spent on its queued mine), so turn-open refills it and moves the
     * SCFEN off the seed on mount — which used to retire the opening line
     * unread, and was why the timer was disabled here. `holdTutorialLine`
     * now re-baselines when turn-open checks land, so the line survives.
     */
    docs: "Enemy CC on a8 (HP 2) is smothered by a7/b7/b8, and b7 is the choke point every remaining line shares. Black's own queued turn opens rank 8 for free: nb8→d7 leaves the back rank and uncovers the fogged Qd8. One shot supplies the rest — Rb1 siege-fires b7 (without vacating), which simultaneously clears the h1-a8 diagonal for the x-raying Bh1. Two checkers at the turn-12 open take HP 2 to 0. Leave b7 alive and only the Ship connects (2→1); `kingAttackTankCounter` then deploys a Siege Tank onto b8 and shoots the Ship, which `restartWhen` reads as a retry. The choke point is a **Marine** — the enemy tank is dug in on a2 instead, where its rank-2 ray stops at the f2 marine and never reaches Kg1. Enemy mines sit on c6 and d4 (black's third lands on b8 from its own queued `spiderMine`, which is the side's cap): c6 is planted *on* the h1-a8 diagonal on purpose — mines are not FEN pieces, so they neither block the Bishop's check nor get spent by it (`starchess-core` `mine/mineChecks.test.ts`).",
  },
  comment: "Your Ship and Mecha are concealed by the fog! \n\n Aim your tank at b7 to open the line for your Mecha.",
  emotion: "watching--left",
  completeWhen: { kind: "lives", enemy: 0 },
  restartWhen: { kind: "lost", pieces: ["Q"] },
  beats: [
    {
      when: { kind: "lost", pieces: ["Q"] },
      say: "Bruh",
      emotion: "watching",
    },
    {
      /**
       * HP 0 — *both* checkers connected in the same pass, which is the
       * only outcome "stacked" describes. This is `completeWhen`'s gate
       * too: the line lands on the completing board, so the success
       * bubble inherits it (see `bubbleMessage` in TutorialScreen).
       */
      when: { kind: "lives", enemy: 0 },
      say: "Stacked damage!",
      emotion: "happy",
    },
    {
      /**
       * HP 1 — only the Ship connected. Keeps this beat voiced: once the
       * board has moved off its baseline `holdTutorialLine` will not
       * revive the opening line, so with no reaction here the bubble goes
       * empty until the counterattack takes the Ship.
       */
      when: { kind: "lives", enemy: 1 },
      say: "One attacker only. \nClear b7 so your Mecha fires too. \n\nIf your Ship dies, the Mecha will lose vision!",
      emotion: "thinking",
    },
    /*
     * The tank's target, plus the two lines that take the a8 CC from HP 2
     * to 0: the Ship's rank-8 shot once nb8→d7 vacates the back rank, and
     * the Bishop's h1-a8 diagonal once the tank clears b7. Both lines run
     * *through* fog, which is why a ring alone could not make the point.
     */
    {
      mark: {
        squares: ["b7"],
        arrows: [
          { from: "b1", to: "b7" },
          { from: "h1", to: "a8" },
          { from: "d8", to: "a8" },
        ],
      },
    },
  ],
} satisfies TutorialStoryScript;
