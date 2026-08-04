import type { Meta, StoryObj } from "storybook-solidjs-vite";

import { KingHuntDemo } from "~/starchess/animations/KingHuntDemo";
import { KING_HUNT_LIVE_START_SCFEN } from "~/starchess/demos/kingHunt";
import { NerdCombatDemo } from "~/screens/nerdDemo/NerdCombatDemo";
import { NerdScreen } from "~/screens/NerdScreen";

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
          "SCFEN + engine DualNav: checks + walk-into-check. HP via endScTurn (3→2→1→0): 0. Nc5+ · 1. Kd5 & Bh2→Bg1 · 2. Kxc5 & Rg7→Rg6 · 3. Kc6 & Bg1→c5 · 4. Rg6+. Tank on g7.",
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
          "Ownership flipped vs King Hunt: White hunter (Ka8, Nc5, Bh2, Rg7 tank) vs black king e4. ResourceBar + TurnBar; queue into End. Nc5 checks ke4 — king-shot resolves in the attack phase (beginning of classical resolve). Play the hunt: knight check → bishop → tank on the g-file → siege.",
      },
    },
  },
  render: () => (
    <NerdScreen boardVariant="eclipse" starChessMode startingScfen={KING_HUNT_LIVE_START_SCFEN} />
  ),
};
