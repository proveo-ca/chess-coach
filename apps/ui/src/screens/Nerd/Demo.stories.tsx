import type { Meta, StoryObj } from "storybook-solidjs-vite";

import { NerdCombatDemo } from "~/screens/nerdDemo/NerdCombatDemo";

/**
 * Brood War combat as a 3-turn review: arrow keys / nav step turns.
 * Forward plays that turn’s VFX; back jumps to the prior position.
 *
 * Start: P d2, R c3, K e1; p e5, B e8, N f6, k f8
 * 1. d2-d4 & Be8-c6
 * 2. d4xe5 & Nf6-e4
 * 3. Rc3xc6 & Ne4xc3
 */
const meta = {
  title: "Screens/Nerd/Demo",
  parameters: {
    layout: "centered",
    docs: {
      description: {
        component:
          "Review-style Brood War demo: three turns, stepped with arrows. Captures = attack → death → occupy. Fog of war on.",
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
          "Review 3 turns with ←/→. Captures call death on the victim (tank on c3 dies via Ne4xc3). 1. d2-d4 & Be8-c6 · 2. d4xe5 & Nf6-e4 · 3. Rc3xc6 & Ne4xc3.",
      },
    },
  },
  render: () => <NerdCombatDemo />,
};
