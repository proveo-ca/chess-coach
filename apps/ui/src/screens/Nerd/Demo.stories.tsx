import type { Meta, StoryObj } from "storybook-solidjs-vite";

import { KingHuntDemo } from "~/broodwar/animations/KingHuntDemo";
import { NerdCombatDemo } from "~/screens/nerdDemo/NerdCombatDemo";

/**
 * Brood War narrative demos: combat chain (simultaneous attack→move) and
 * king HP hunt (into-fire + Option A). Arrow keys / nav step turns.
 */
const meta = {
  title: "Screens/Nerd/Brood War/Demo",
  parameters: {
    layout: "centered",
    docs: {
      description: {
        component:
          "Review-style Brood War demos. Combat Chain = BWFEN turn shape (W & B). King Hunt adds checks + walk-into-check (FEN-illegal, BWFEN-legal). Fog on.",
      },
    },
  },
} satisfies Meta;

export default meta;
type Story = StoryObj;

export const CombatChain: Story = {
  name: "Combat Chain",
  parameters: {
    docs: {
      description: {
        story:
          "BWFEN reference: each arrow = one turn = White & Black classical. 1. d2-d4 & Be8-c6 · 2. d4xe5 & Nf6-e4 · 3. Rc3xc6 & Ne4xc3. Rook starts c3 (siege). Captures = attack → death → occupy.",
      },
    },
  },
  render: () => <NerdCombatDemo />,
};

export const KingHunt: Story = {
  name: "King Hunt",
  parameters: {
    docs: {
      description: {
        story:
          "Combat Chain grammar + checks + walk-into-check. HP via broodWarStore (3→2→1→0): 0. Nc5+ · 1. Kd5 & Bh2→Bg1 · 2. Kxc5 & Rf7→Rf6 · 3. Kc6 & Bg1→c5 · 4. Rf6+. Rook starts f7 (siege).",
      },
    },
  },
  render: () => <KingHuntDemo />,
};
