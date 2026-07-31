import type { Meta, StoryObj } from "storybook-solidjs-vite";

import { KingSpawnDemo } from "~/broodwar/specials/KingSpawnDemo";
import { KnightMineDemo } from "~/broodwar/specials/KnightMineDemo";

/**
 * Brood War specials via GasDeploy. Command Center deploy + Vulture spider mine;
 * other unit specials are deferred (FEN-illegal). Activation lives in piece hooks.
 */
const meta = {
  title: "Screens/Nerd/Brood War/Special Moves",
  parameters: {
    layout: "centered",
    docs: {
      description: {
        component:
          "Drag a vespene canister from GasDeploy onto a unit. Command Center: SpawnModal → deploy adjacent. Vulture: stack order (special+move or move+special) sets before/after timing; completing both auto-submits. Specials are piece-owned hooks — not story logic.",
      },
    },
  },
} satisfies Meta;

export default meta;
type Story = StoryObj;

export const KingSpawn: Story = {
  name: "Command Center",
  parameters: {
    docs: {
      description: {
        story:
          "1. Drag gas onto the command center on d4 → SpawnModal. 2. Pick a unit. 3. Tap an adjacent empty square — 500ms deploy drop, then FEN/fog update.",
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
