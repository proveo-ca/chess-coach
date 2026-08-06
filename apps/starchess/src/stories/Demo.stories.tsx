import type { Meta, StoryObj } from "storybook-solidjs-vite";

import { CombatChainDemo } from "~/demos/CombatChainDemo";
import { FogEdgeDemo } from "~/demos/FogEdgeDemo";
import { KingHuntDemo } from "~/demos/KingHuntDemo";
import { KingHuntLiveScreen } from "~/demos/KingHuntLiveScreen";
import {
  GAS_STEP_SCENARIO,
  PROMOTION_MINE_SCENARIO,
  PROMOTION_SCENARIO,
} from "~/demos/reviewSamples";
import { FogVisionDemo } from "~/presentation/animations/FogVisionDemo";
import { GAS_USED_FOG_FIXTURE } from "~/stories/fixtures/scenarios";

/**
 * Stories mount SCFEN demos / fixtures only — no queue / resolve logic here.
 * Non-live = DualNav observer review. Live = King Hunt (live) only.
 */
const meta = {
  title: "StarChess/Demo",
  parameters: {
    layout: "centered",
    docs: {
      description: {
        component:
          "Review DualNav demos + one live seed. Combat Chain / King Hunt / Promotion / Gas = observer DualNav. King Hunt (live) = ResourceBar / TurnBar / GasDeploy + adjutant.",
      },
    },
  },
} satisfies Meta;

export default meta;
type Story = StoryObj;

export const CombatChain: Story = {
  name: "Combat Chain",
  parameters: {
    layout: "centered",
    docs: {
      description: {
        story:
          "SCFEN + engine: each arrow = one turn = White & Black classical via addScMove → endScTurn. 1. d2-d4 & Be8-c6 · 2. d4xe5 & Nf6-e4 · 3. Rc3xc6 & Ne4xc3. Rook starts c3 (tank — siege cannot relocate). Captures = attack → death → occupy.",
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

export const KingHuntLive: Story = {
  name: "King Hunt (live)",
  parameters: {
    layout: "fullscreen",
    docs: {
      description: {
        story:
          "Ownership flipped vs King Hunt: White hunter (Kh1, Nc5, Bh2) vs black king e4. Adjutant auto-plays black. ResourceBar + TurnBar + GasDeploy; eclipse board + combat VFX.",
      },
    },
  },
  render: () => <KingHuntLiveScreen />,
};

export const Promotion: Story = {
  name: "Promotion",
  render: () => <FogEdgeDemo scenario={PROMOTION_SCENARIO} />,
};

export const PromotionMine: Story = {
  name: "Promotion × mine",
  render: () => <FogEdgeDemo scenario={PROMOTION_MINE_SCENARIO} />,
};

export const GasStep: Story = {
  name: "Gas step",
  render: () => <FogEdgeDemo scenario={GAS_STEP_SCENARIO} />,
};

export const GasUsedFog: Story = {
  name: "Gas-used fog reveal",
  render: () => (
    <FogVisionDemo
      scfen={GAS_USED_FOG_FIXTURE.scfen}
      caption={GAS_USED_FOG_FIXTURE.caption}
    />
  ),
};
