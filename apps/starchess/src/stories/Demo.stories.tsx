import type { Meta, StoryObj } from "storybook-solidjs-vite";

import { CombatChainDemo } from "~/demos/CombatChainDemo";
import { FogEdgeDemo } from "~/demos/FogEdgeDemo";
import { KingHuntDemo } from "~/demos/KingHuntDemo";
import { PROMOTION_MINE_SCENARIO, PROMOTION_SCENARIO } from "~/demos/reviewSamples";

/**
 * Stories mount SCFEN demos / fixtures only — no queue / resolve logic here.
 * Every demo is a DualNav observer review. GasDeploy specials live under
 * StarChess/Special Moves.
 */
const meta = {
  title: "StarChess/Demo",
  parameters: {
    layout: "fullscreen",
    docs: {
      description: {
        component:
          "Review DualNav demos: Combat Chain / King Hunt / Promotion = observer DualNav. Every board mounts on Screen grid.",
      },
    },
  },
} satisfies Meta;

export default meta;
type Story = StoryObj;

export const CombatChain: Story = {
  name: "Combat Chain",
  parameters: {
    layout: "fullscreen",
    docs: {
      description: {
        story:
          "SCFEN + engine: each arrow = one turn = White & Black classical via addScAction → endScTurn. 1. d2-d4 & Be8-c6 · 2. d4xe5 & Nf6-e4 · 3. Rc3xc6 & Ne4xc3. Tank starts c3 (tank — siege cannot relocate). Captures = attack → death → occupy.",
      },
    },
  },
  render: () => <CombatChainDemo />,
};

export const KingHunt: Story = {
  name: "King Hunt",
  parameters: {
    docs: {
      description: {
        story:
          "Fog = side vision only; attack rays unlimited. Tank starts on g6. DualNav review with combat VFX.",
      },
    },
  },
  render: () => <KingHuntDemo />,
};

export const Promotion: Story = {
  name: "Promotion",
  render: () => <FogEdgeDemo scenario={PROMOTION_SCENARIO} />,
};

export const PromotionMine: Story = {
  name: "Promotion × mine",
  render: () => <FogEdgeDemo scenario={PROMOTION_MINE_SCENARIO} />,
};
