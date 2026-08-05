import type { Meta, StoryObj } from "storybook-solidjs-vite";

import { KingHuntDemo } from "~/starchess/animations/KingHuntDemo";
import {
  KING_HUNT_LIVE_START_SCFEN,
  queueKingHuntLiveOpponent,
} from "~/starchess/demos/kingHunt";
import { NerdCombatDemo } from "~/starchess/screens/nerdDemo/NerdCombatDemo";
import { NerdScreen } from "~/starchess/screens/NerdScreen";

/**
 * Stories mount SCFEN demos / live seeds only — no queue / resolve logic here.
 */
const meta = {
  title: "Screens/Nerd/StarChess/Demo",
  parameters: {
    layout: "centered",
    docs: {
      description: {
        component:
          "Review-style StarChess demos + one live seed. Combat Chain = turn shape. King Hunt = DualNav hunt. King Hunt (live) = ownership-flipped SCFEN with ResourceBar / TurnBar / End.",
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
          "SCFEN + engine: each arrow = one turn = White & Black classical via addScMove → endScTurn. 1. d2-d4 & Be8-c6 · 2. d4xe5 & Nf6-e4 · 3. Rc3xc6 & Ne4xc3. Rook starts c3 (tank — siege cannot relocate). Captures = attack → death → occupy.",
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
          "Fog = side vision only; attack rays unlimited. Tank starts on g6. Turn 0: Nc5+ · siege g6 + Bg1 · then Bg1+ via siege vision · sieged Rg6+ lethal.",
      },
    },
  },
  render: () => <KingHuntDemo />,
};

export const KingHuntLive: Story = {
  name: "King Hunt (live)",
  parameters: {
    layout: "fullscreen",
    route: "/starchess",
    docs: {
      description: {
        story:
          "Ownership flipped vs King Hunt: White hunter (Ka8, Nc5, Bh2 — deploy the tank) vs black king e4. Enemy auto-queues DualNav flee (e4→d5→c5→c6); on c5 deploys marine → gas-double → promotes. 5 minerals; ResourceBar + TurnBar; queue into End. Nc5 legally checks ke4 — first End chips HP before flee.",
      },
    },
  },
  render: () => (
    <NerdScreen
      boardVariant="eclipse"
      starChessMode
      startingScfen={KING_HUNT_LIVE_START_SCFEN}
      startingStoredMaterial={5}
      autoQueueOpponent={queueKingHuntLiveOpponent}
    />
  ),
};
