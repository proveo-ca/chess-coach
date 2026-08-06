import type { Meta, StoryObj } from "storybook-solidjs-vite";

import { KingHuntDemo } from "~/starchess/animations/KingHuntDemo";
import { adjutant } from "~/starchess/demos/adjutant";
import { KING_HUNT_LIVE_START_SCFEN } from "~/starchess/demos/kingHunt";
import { NerdCombatDemo } from "~/starchess/screens/nerdDemo/NerdCombatDemo";
import { NerdScreen } from "~/starchess/screens/NerdScreen";
import { starChessEconomies } from "~/starchess/starChessStore";

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
          "Ownership flipped vs King Hunt: White hunter (Kh1, Nc5, Bh2 — the Charon bishop) vs black king e4. Enemy adjutant (defensive commander) auto-plays: protects the King first (flees, blocks or captures the checker), claims center, develops marines toward promotion, then holds a checking ray on the white king with the promoted queen. Starts on 1 stored mineral and spawns from turn income (1/turn). ResourceBar + TurnBar; queue into End. Nc5 legally checks ke4 — first End chips HP before the flee lands.",
      },
    },
  },
  render: () => (
    <NerdScreen
      boardVariant="eclipse"
      starChessMode
      startingScfen={KING_HUNT_LIVE_START_SCFEN}
      startingStoredMaterial={1}
      autoQueueOpponent={(snap) =>
        adjutant(snap, {
          storedFor: (color) => starChessEconomies()[color].stored,
        })
      }
    />
  ),
};
