import type { Meta, StoryObj } from "storybook-solidjs-vite";

import { CombatChainDemo } from "~/demos/CombatChainDemo";
import { FogEdgeDemo } from "~/demos/FogEdgeDemo";
import { KingHuntDemo } from "~/demos/KingHuntDemo";
import { PROMOTION_MINE_SCENARIO, PROMOTION_SCENARIO } from "~/demos/reviewSamples";
import { VERMEER_LIVE_SAMPLE } from "~/demos/samples";
import { lessonStory, sampleStory } from "~/stories/project";

/**
 * Stories mount SCFEN demos / fixtures only — no queue / resolve logic here.
 * Non-live = DualNav observer review. Live = King Hunt (live) + Vermeer (live).
 * GasDeploy specials live under StarChess/Special Moves.
 */
const meta = {
  title: "StarChess/Demo",
  parameters: {
    layout: "fullscreen",
    docs: {
      description: {
        component:
          "Review DualNav demos + live seeds. Combat Chain / King Hunt / Promotion = observer DualNav. King Hunt (live) uses ResourceBar / TurnBarSidebar / GasDeploy; Vermeer (live) uses ResourceBar / TurnBar / GasDeploy. Both use an adjutant. Every board mounts on Screen grid.",
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
          "SCFEN + engine: each arrow = one turn = White & Black classical via addScAction → endScTurn. 1. d2-d4 & Be8-c6 · 2. d4xe5 & Nf6-e4 · 3. Rc3xc6 & Ne4xc3. Rook starts c3 (tank — siege cannot relocate). Captures = attack → death → occupy.",
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
  ...lessonStory("king", "king-hunt-live", { shell: "eclipse", turnChrome: "sidebar" }),
  name: "King Hunt (live)",
  parameters: {
    layout: "fullscreen",
    docs: {
      description: {
        story:
          "Ownership flipped vs King Hunt: White hunter (Kh1, Nc5, Bh2) vs black king e4. Adjutant auto-plays black. ResourceBar + shared BoardSideRail (live TurnBarSidebar + SideRailTools) + GasDeploy; eclipse board + combat VFX.",
      },
    },
  },
};

export const VermeerLive: Story = sampleStory(VERMEER_LIVE_SAMPLE, {
  name: "Vermeer (live)",
  docs:
    "Classic live opening on Vermeer terrain: each side 1 king + 4 pawns (same SCFEN as Maps \u2192 Vermeer). You pick team via story controls; adjutant plays the opposite color. ResourceBar / TurnBar / GasDeploy + fog + combat VFX.",
  boardVariant: "vermeer",
  shell: "vermeer",
});

export const VermeerLiveTurnSidebar: Story = sampleStory(VERMEER_LIVE_SAMPLE, {
  name: "Vermeer (live) \u00b7 turn sidebar",
  docs:
    "Experimental variation: TurnBarSidebar (vertical) sits in the board side rail; ResourceBar stays on top. Horizontal TurnBar is unchanged and unused here.",
  boardVariant: "vermeer",
  shell: "vermeer",
  turnChrome: "sidebar",
});

export const Promotion: Story = {
  name: "Promotion",
  render: () => <FogEdgeDemo scenario={PROMOTION_SCENARIO} />,
};

export const PromotionMine: Story = {
  name: "Promotion × mine",
  render: () => <FogEdgeDemo scenario={PROMOTION_MINE_SCENARIO} />,
};
