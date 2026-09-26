// SPEC: _spec/apps/starchess/architecture/storybook-projection.puml
import type { TutorialStoryScript } from "~/tutorial/tutorialScript";

export const tank = {
  id: "tank",
  title: "Siege Tank",
  board: {
    scfen: "SCFEN|7k/5p2/6p1/7p/3R1R2/8/8/K7|11|33|P|G:22:22|Q:w:;b:|S:f4",
    stored: 12,
    endTurnAfterQueue: "moveAndSpecial",
    armTimer: false,
    docs: "Two Siege Tanks: d4 starts packed (tank), f4 starts sieged (S:f4). Enemy Marines g6/h5. Two routes: move d4\u2192d8 then gas the ghost to siege it there, or gas f4 to unsiege then move f4\u2192h4 \u00b7 End to resolve.",
  },
  comment: "The tank has 2 modes: sieged and mobile. \nGas can change the mode. \nTry stacking mode change with a move!",
  emotion: "happy",
  completeWhen: {
    kind: "queue",
    classical: true,
    specialKind: "siegeMode",
  },
  beats: [
    {
      when: { kind: "scfen", re: /Q:w:;/ },
      mark: { gasSquares: ["f4"], arrows: [{ from: "d4", to: "d8" }] },
    },
    {
      when: { kind: "scfen", re: /^(?=.*Q:w:[^;]*C=d4d8)(?!.*[BF]=siegeMode:)/ },
      mark: { gasSquares: ["d8"] },
    },
    {
      when: { kind: "scfen", re: /^(?=.*[BF]=siegeMode:f4)(?!.*Q:w:[^;]*C=)/ },
      mark: { squares: ["h4"], arrows: [{ from: "f4", to: "h4" }] },
    },
    {
      mark: {},
    },
  ],
} satisfies TutorialStoryScript;
