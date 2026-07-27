import type { Meta, StoryObj } from "storybook-solidjs-vite";

import { KingSpawnDemo } from "~/broodwar/specials/KingSpawnDemo";
import { KnightMineDemo } from "~/broodwar/specials/KnightMineDemo";

/**
 * Brood War specials (long-press). King spawn + knight spider mine only for now;
 * other unit specials are deferred (FEN-illegal).
 */
const meta = {
  title: "Screens/Nerd/Brood War/Special Moves",
  parameters: {
    layout: "centered",
    docs: {
      description: {
        component:
          "Long-press specials. King: SpawnModal + ResourceBar → deploy adjacent. Knight: spider mine under the knight; timing before/after the classical move.",
      },
    },
  },
} satisfies Meta;

export default meta;
type Story = StoryObj;

export const KingSpawn: Story = {
  name: "King",
  parameters: {
    docs: {
      description: {
        story:
          "1. Long-press king on d4 → SpawnModal (ResourceBar + pawn-first choices). 2. Pick a unit. 3. Tap an adjacent empty square to deploy.",
      },
    },
  },
  render: () => <KingSpawnDemo />,
};

export const KnightMine: Story = {
  name: "Knight",
  parameters: {
    docs: {
      description: {
        story:
          "1. Long-press knight on d4 to queue a spider mine. 2. Choose Before move (mine on d4, then move) or After move (move, then mine on e6). 3. Optional: tap e6 to queue the jump. 4. Resolve.",
      },
    },
  },
  render: () => <KnightMineDemo />,
};
