// SPEC: _spec/apps/starchess/architecture/storybook-projection.puml
import type { TutorialStoryScript } from "~/tutorial/tutorialScript";

export const mecha = {
  id: "mecha",
  title: "Mecha",
  board: {
    scfen: "SCFEN|k6q/8/4P3/4p3/3B4/8/8/K7|11|33|P|G:22:22|Q:w:;b:",
    stored: 4,
    endTurnAfterQueue: "moveAndSpecial",
    armTimer: false,
    docs: "Charon Booster Missiles costs 2 vespene: drag onto the Mecha to arm targeting, click the highlighted enemy queen, then End to fire.",
  },
  comment: "Mecha can see BattleShips anywhere in the board! \nGas your Mecha, it will cost 2 gas canisters.",
  emotion: "thinking",
  completeWhen: {
    kind: "scfen",
    re: /SCFEN\|(?:[^/]*\/){3}4B3/,
  },
  beats: [
    {
      when: { kind: "scfen", re: /SCFEN\|(?:[^/]*\/){3}4B3/ },
      say: "It shoots up and down!",
      emotion: "happy",
    },
    {
      // Snipe is on the queue — targeting has already cleared, so this
      // and the arming beat below are mutually exclusive.
      when: { kind: "scfen", re: /charonMissiles:/ },
      say: "You still have the classical Chess move/capture available. Order your Mecha to capture that Marine and let the turn finish.",
      emotion: "watching",
    },
    {
      // Gas landed, no target picked yet — live UI targeting state, which
      // never reaches SCFEN. `targetingKind` is what makes it trackable.
      when: { kind: "targeting", targetingKind: "charonMissiles" },
      say: "Now aim the ship to complete your intention!",
      emotion: "scanning",
    },
    {
      when: { kind: "scfen", re: /charonMissiles:/ },
      mark: { squares: ["e5"], arrows: [{ from: "d4", to: "e5" }] },
    },
    {
      mark: { squares: ["h8"], arrows: [{ from: "d4", to: "h8" }] },
    },
  ],
} satisfies TutorialStoryScript;
