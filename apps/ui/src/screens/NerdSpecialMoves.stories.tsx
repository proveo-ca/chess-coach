import type { Meta, StoryObj } from "storybook-solidjs-vite";

import { KingSpawnDemo } from "~/broodwar/specials/KingSpawnDemo";
import { KnightMineDemo } from "~/broodwar/specials/KnightMineDemo";
import { MarineDoubleDemo } from "~/broodwar/specials/MarineDoubleDemo";
import { RookSiegeDemo } from "~/broodwar/specials/RookSiegeDemo";

/**
 * Brood War specials via GasDeploy. Command Center deploy, Vulture spider mine,
 * Marine double-step, Siege Tank mode toggle. Activation lives in piece hooks.
 */
const meta = {
  title: "Screens/Nerd/Brood War/Special Moves",
  parameters: {
    layout: "centered",
    docs: {
      description: {
        component:
          "Drag a vespene canister from GasDeploy onto a unit. Marine: start-rank doubles are free (no gas); otherwise 1 gas. Command Center: DeployModal → deploy adjacent. Vulture: stack order. Siege Tank: toggle packed ↔ unpacked.",
      },
    },
  },
} satisfies Meta;

export default meta;
type Story = StoryObj;

export const MarineDouble: Story = {
  name: "Marine",
  parameters: {
    docs: {
      description: {
        story:
          "d2 can classical-double for free (canister unused). e3 needs 1 gas for a Brood War double-step anytime.",
      },
    },
  },
  render: () => <MarineDoubleDemo />,
};

export const KingSpawn: Story = {
  name: "Command Center",
  parameters: {
    docs: {
      description: {
        story:
          "1. Drag gas onto the command center on d4 → DeployModal. 2. Pick a unit. 3. Tap an adjacent empty square — 500ms deploy drop, then FEN/fog update.",
      },
    },
  },
  render: () => <KingSpawnDemo />,
};

export const KnightMine: Story = {
  name: "Vulture",
  parameters: {
    docs: {
      description: {
        story:
          "Assert stack order: special+move (gas on d4, then move the knight — mine stays on origin) or move+special (move first, then gas — mine under the new square). Knight L-path comes from `BroodWarChessBoard`, not this story.",
      },
    },
  },
  render: () => <KnightMineDemo />,
};

export const RookSiege: Story = {
  name: "Siege Tank",
  parameters: {
    docs: {
      description: {
        story:
          "Two Siege Tanks: d4 starts packed (tank), f4 starts sieged. Drag gas onto either to toggle with pack↔unpack animation. Siege: 9×9 vision, immobile. Tank: 5×5 vision, can move.",
      },
    },
  },
  render: () => <RookSiegeDemo />,
};
