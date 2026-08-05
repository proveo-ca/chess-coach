import type { Meta, StoryObj } from "storybook-solidjs-vite";

import { BishopCharonDemo } from "~/starchess/specials/BishopCharonDemo";
import { KingSpawnDemo } from "~/starchess/specials/KingSpawnDemo";
import { KnightMineDemo } from "~/starchess/specials/KnightMineDemo";
import { MarineDoubleDemo } from "~/starchess/specials/MarineDoubleDemo";
import { QueenTacticalJumpDemo } from "~/starchess/specials/QueenTacticalJumpDemo";
import { RookSiegeDemo } from "~/starchess/specials/RookSiegeDemo";

/**
 * StarChess specials via GasDeploy. Command Center deploy, Vulture spider mine,
 * Marine extra step, Siege Tank mode toggle. Activation lives in piece hooks.
 */
const meta = {
  title: "Screens/Nerd/StarChess/Special Moves",
  parameters: {
    layout: "centered",
    docs: {
      description: {
        component:
          "Drag vespene canisters from GasDeploy onto a unit. Marine: start-rank doubles are free (no gas); otherwise 1 gas. Command Center: DeployModal → deploy adjacent. Vulture: stack order. Siege Tank: toggle packed ↔ unpacked. Goliath: 2 gas arms Charon Booster Missiles, then click the revealed queen. Battlecruiser: 2 gas arms Tactical Jump, then click a visible empty square.",
      },
    },
  },
} satisfies Meta;

export default meta;
type Story = StoryObj;

export const MarineDouble: Story = {
  name: "Marine",
  parameters: {
    docs: {
      description: {
        story:
          "d2 can classical-double for free (canister unused). Gas on a pawn moves only 1 extra square forward (no d2→d6).",
      },
    },
  },
  render: () => <MarineDoubleDemo />,
};

export const KingSpawn: Story = {
  name: "Command Center",
  parameters: {
    docs: {
      description: {
        story:
          "1. Drag gas onto the command center on d4 → DeployModal. 2. Pick a unit. 3. Tap an adjacent empty square — 500ms deploy drop, then FEN/fog update.",
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
          "Assert stack order: special+move (gas on d4, then move the knight — mine stays on origin) or move+special (move first, then gas — mine under the new square). Knight L-path comes from `StarChessChessBoard`, not this story.",
      },
    },
  },
  render: () => <KnightMineDemo />,
};

export const BishopCharon: Story = {
  name: "Goliath",
  parameters: {
    docs: {
      description: {
        story:
          "Charon Booster Missiles costs 2 vespene: drag the two-canister drop onto the Goliath to arm targeting (no auto-fire), then click the highlighted enemy queen on the diagonal. Twin homing missiles ignore blockers; impact at 250ms, then the queen death + FEN commit.",
      },
    },
  },
  render: () => <BishopCharonDemo />,
};

export const QueenTacticalJump: Story = {
  name: "Battlecruiser",
  parameters: {
    docs: {
      description: {
        story:
          "Tactical Jump costs 2 vespene: drag the two-canister drop onto the Battlecruiser to arm targeting, then click a highlighted visible empty square. The queen teleports through blockers (attacks on her are ignored): 200ms stretched-thin light travel facing the jump, 50ms appear burst, green back thrusters, and twin trails fading over 1000ms.",
      },
    },
  },
  render: () => <QueenTacticalJumpDemo />,
};

export const RookSiege: Story = {
  name: "Siege Tank",
  parameters: {
    docs: {
      description: {
        story:
          "Two Siege Tanks: d4 starts packed (tank), f4 starts sieged. Drag gas onto either to toggle with pack↔unpack animation. Siege: 9×9 vision, immobile. Tank: 5×5 vision, can move.",
      },
    },
  },
  render: () => <RookSiegeDemo />,
};
