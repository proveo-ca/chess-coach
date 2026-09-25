// SPEC: _spec/apps/starchess/architecture/storybook-projection.puml
import type { TutorialStoryScript } from "~/tutorial/tutorialScript";

export const kingAttack2 = {
  id: "king-attack-2",
  title: "King Attack #2",
  board: {
    scfen: "SCFEN|8/7Q/8/4p3/3bkn2/8/2b2R2/7K|21|33|P|G:33:33|B:0:3|Q:w:;b:|S:f2",
    stored: 0,
    opponent: "adjutant",
    docs: "A BattleShip and a dug-in Siege Tank against a five-unit escort, one of them a Mecha parked on c2. Turn 21 = tier-3 gas, so Tactical Jump (3 vespene) is affordable every turn — the whole point of the lesson. Qh7 already bears on the ke4 diagonal, so the opening turn chips it 3→2 for free; the coached opener is Tactical Jump h7→d2 stacked with the classical Qd2xc2 that takes the Mecha; the adjutant answers by deploying and shooting at the ship, so one that sits still dies early. Rf2 is immobile but owns the f-file and rank 2, which covers the nf4 flank and the approach to Kh1. White holds 0 minerals and cannot deploy: keep re-checking the Command Center from a fresh angle, and jump out when the escort closes.",
  },
  comment: "Juke this army with your ship! \nGas it up to escape danger.",
  emotion: "happy",
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
       * Losing the Command Center is not the lesson's retry gate, so
       * nothing would remount it — offer the CTA the way King Attack #3
       * does, or the player is stranded on a terminal board.
       */
      when: { kind: "lives", own: 0 },
      say: "They went around your ship and took the base. \nGive it another run.",
      emotion: "shocked",
      action: {
        kind: "retryLesson",
        label: "Retry lesson",
      },
    },
    {
      /**
       * Jumped to d2 on the opening turn, Attack/Move still open — the
       * Mecha on c2 is one square away. A warp queues on `B`, so it
       * resolves before the classical and the ship takes from d2.
       */
      when: {
        kind: "scfen",
        re: /SCFEN\|[^|]+\|21\|(?!.*Q:w:[^;]*C=).*tacticalJump:h7:d2/,
      },
      say: "Now queue a move from d2 to c2 \nand take out that Mecha!",
      emotion: "thinking",
    },
    {
      /**
       * Tactical Jump confirmed anywhere else on the opening turn — the
       * wire carries `B=tacticalJump:` and the turn field still reads 21.
       * Point at the flank the dug-in tank already covers.
       */
      when: { kind: "scfen", re: /SCFEN\|[^|]+\|21\|.*tacticalJump:/ },
      say: "Your tank can take out that Hoverbike",
      emotion: "thinking",
    },
    {
      /**
       * Catch-all, and it has to exist. Qh7 already checks ke4, so the
       * turn-open resolve runs on mount — `holdTutorialLine` sees
       * `timelineActive` and retires the opening line before it is read,
       * leaving an empty bubble. Same copy as `comment` on purpose: the
       * intro still feeds the objective, this keeps it on screen.
       */
      say: "Juke this army with your ship! \nGas it up to escape danger.",
      emotion: "happy",
    },
    {
      when: {
        kind: "scfen",
        re: /SCFEN\|[^|]+\|21\|(?!.*Q:w:[^;]*C=).*tacticalJump:h7:d2/,
      },
      mark: { squares: ["c2"], arrows: [{ from: "d2", to: "c2" }] },
    },
    {
      // Jump and capture both queued — nothing left to point at.
      when: { kind: "scfen", re: /SCFEN\|[^|]+\|21\|.*tacticalJump:h7:d2/ },
      mark: {},
    },
    {
      when: { kind: "scfen", re: /SCFEN\|[^|]+\|21\|.*tacticalJump:/ },
      mark: { squares: ["f4"], arrows: [{ from: "f2", to: "f4" }] },
    },
    {
      when: { kind: "scfen", re: /SCFEN\|[^|]+\|21\|.*\|G:0/ },
      mark: { squares: ["f4"], arrows: [{ from: "f2", to: "f4" }] },
    },
    {
      when: { kind: "scfen", re: /SCFEN\|[^|]+\|21\|/ },
      mark: { squares: ["d2"], fromBattleShip: true, arrows: [{ from: "h7", to: "d2" }] },
    },
    {
      // After the scripted opener, the next jump is read from wherever
      // the ship stands — lit, empty, unattacked, re-checking if it can.
      when: { kind: "shipJuke" },
      mark: {},
    },
  ],
} satisfies TutorialStoryScript;
