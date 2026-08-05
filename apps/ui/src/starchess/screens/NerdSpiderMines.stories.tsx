import type { Meta, StoryObj } from "storybook-solidjs-vite";

import { AttackMineDemo } from "~/starchess/animations/AttackMineDemo";
import { PathCollideAllyMineDemo } from "~/starchess/animations/PathCollideAllyMineDemo";
import { PathCollideDemo } from "~/starchess/animations/PathCollideDemo";
import { SpiderMineFogDemo } from "~/starchess/animations/SpiderMineFogDemo";

/**
 * Stories mount SCFEN demos only — no queue / resolve / combat logic here.
 * Engine + combat bus live under `demos/*` + DualNav harnesses.
 */
const meta = {
  title: "Screens/Nerd/StarChess/Spider Mines",
  parameters: {
    layout: "fullscreen",
    docs: {
      description: {
        component:
          "SCFEN-driven: Fog presents `M:`; Attack (mine) and Attack (path collide) DualNav `endScTurn` → combat bus.",
      },
    },
  },
} satisfies Meta;

export default meta;

export const Fog: StoryObj = {
  render: () => <SpiderMineFogDemo />,
  parameters: {
    docs: {
      description: {
        story: "SCFEN `M:w:a4` — vision is only the mine’s own square for the owning side.",
      },
    },
  },
};

export const AttackPathCollide: StoryObj = {
  name: "Attack (path collide)",
  render: () => <PathCollideDemo />,
  parameters: {
    docs: {
      description: {
        story:
          "2 parallel SCFEN turns (8 actions): T1 Nb mine+c5 & spawn rook→a1; T2 Nb mine+e4 & Ra1→a8 chase-boom (siege F skipped).",
      },
    },
  },
};

export const AttackPathCollideAllyMine: StoryObj = {
  name: "Attack (path collide · ally mine)",
  render: () => <PathCollideAllyMineDemo />,
  parameters: {
    docs: {
      description: {
        story:
          "Sides flipped: T1 Nw mine+c5 & black spawn rook→a8; T2 Nw mine+e4 & ra8→a1 over ally a4 mine chase-boom (siege F skipped).",
      },
    },
  },
};

export const AttackMine: StoryObj = {
  name: "Attack (mine)",
  render: () => <AttackMineDemo />,
  parameters: {
    docs: {
      description: {
        story:
          "SCFEN classical Nd1→c3: engine attack clears the hostile mine, then occupy. DualNav / arrows.",
      },
    },
  },
};
