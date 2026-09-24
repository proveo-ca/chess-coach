import type { Meta } from "storybook-solidjs-vite";

import { lessonStory } from "~/stories/project";

/**
 * GasDeploy specials — projected from the `specials` stage of the tutorial
 * catalog. Specials arm and queue in the live screen; no Storybook arm logic.
 */
const meta = {
  title: "StarChess/Special Moves",
  parameters: {
    layout: "fullscreen",
    docs: {
      description: {
        component:
          "Drag vespene canisters from GasDeploy onto a unit. Marine: 1-gas Extra Step, moves 1 extra square forward. Command Center: DeployModal → deploy adjacent. Hoverbike: spider mine. Siege Tank: toggle packed ↔ unpacked. Mecha: 2-gas Charon Booster Missiles, then click the revealed BattleShip. BattleShip: 3-gas Tactical Jump, then click a visible empty square. End to resolve.",
      },
    },
  },
} satisfies Meta;

export default meta;

export const Marine = lessonStory("specials", "marine");
export const CommandCenter = lessonStory("specials", "cc");
export const Hoverbike = lessonStory("specials", "hoverbike");
export const Mecha = lessonStory("specials", "mecha");
export const BattleShip = lessonStory("specials", "ship");
export const SiegeTank = lessonStory("specials", "tank");
