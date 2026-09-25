// SPEC: _spec/apps/starchess/architecture/storybook-projection.puml
import type { TutorialStoryScript } from "~/tutorial/tutorialScript";

export const tank = {
  id: "tank",
  title: "Siege Tank",
  board: {
    scfen: "SCFEN|7k/5p2/8/8/3R1R2/8/8/K7|11|33|P|G:22:22|Q:w:;b:|S:f4",
    stored: 12,
    endTurnAfterQueue: "moveAndSpecial",
    armTimer: false,
    docs: "Two Siege Tanks: d4 starts packed (tank), f4 starts sieged (S:f4). Drag gas onto either to queue a toggle \u00b7 End to pack/unpack. Capture the f7 pawn with the sieged tank (Cf4f7) to see the siege HE attack (not tank twins).",
  },
  comment: "The tank has 2 modes: sieged and mobile. \nGas can change the mode. \nTry stacking mode change with a move!",
  emotion: "happy",
  completeWhen: {
    kind: "queue",
    classical: true,
    specialKind: "siegeMode",
  },
} satisfies TutorialStoryScript;
