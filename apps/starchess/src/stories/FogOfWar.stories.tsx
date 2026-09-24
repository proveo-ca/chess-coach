import type { Meta } from "storybook-solidjs-vite";

import { lessonStory, type ProjectionChrome } from "~/stories/project";

/**
 * Live player-fog lessons — projected from the `fog` stage of the tutorial
 * catalog. Seeds, titles, and descriptions all come from
 * `tutorial/tutorialScript.config.ts`; this file only picks the ids.
 */
const meta = {
  title: "StarChess/Fog of War and Move Animations",
  parameters: {
    layout: "fullscreen",
    docs: {
      description: {
        component:
          "Live MatchStore + player fog. Queue a move, End to resolve — fog expands with your pieces. SideRailTools shows HOME only.",
      },
    },
  },
} satisfies Meta;

export default meta;

/** Same chrome the tutorial gives a fog lesson, minus the coach furniture. */
const FOG: ProjectionChrome = {
  fog: true,
  tutorial: true,
  hideResources: true,
  turnChrome: "sidebar",
};

export const CommandCenter = lessonStory("fog", "king", FOG);
export const Marine = lessonStory("fog", "pawn", FOG);
export const Hoverbike = lessonStory("fog", "knight", FOG);
export const Mecha = lessonStory("fog", "bishop", FOG);
export const PackedTankMode = lessonStory("fog", "rook-tank", FOG);
export const SiegedTankMode = lessonStory("fog", "rook-siege", FOG);
export const BattleShip = lessonStory("fog", "queen", FOG);
export const SpiderMine = lessonStory("fog", "mine", FOG);
