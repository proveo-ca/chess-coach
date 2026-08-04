import type { Meta, StoryObj } from "storybook-solidjs-vite";

import { AttackBoardDemo } from "~/starchess/animations/AttackBoardDemo";
import { ANIM_BY_PIECE } from "~/starchess/animations/attackAnim";

/**
 * StarChess attack VFX via ChessBoard `attackCue` → `AttackAnimation`.
 */
const meta = {
  title: "Screens/Nerd/StarChess/Attack Animations",
  parameters: {
    layout: "centered",
    docs: {
      description: {
        component:
          "Production attack layer on ChessBoard. Each story cycles legal vectors: idle (board piece), then `attackCue` with `data-attack-anim`. Classical SVGs under `public/pieces/nerd/` remain for classical chess.",
      },
    },
  },
} satisfies Meta;

export default meta;
type Story = StoryObj;

export const PawnRifle: Story = {
  name: "Pawn Rifle",
  parameters: {
    docs: {
      description: {
        story: `Marine rifle (\`${ANIM_BY_PIECE.p}\`). White on d4 (back/helmet up-board) and opposing black on d6 (front glass down-board).`,
      },
    },
  },
  render: () => <AttackBoardDemo piece="p" />,
};

export const KnightFrag: Story = {
  name: "Knight Frag",
  parameters: {
    docs: {
      description: {
        story: `Vulture frag (\`${ANIM_BY_PIECE.n}\`). L-path grenade to target.`,
      },
    },
  },
  render: () => <AttackBoardDemo piece="n" />,
};

export const BishopGatlings: Story = {
  name: "Bishop Gatlings",
  parameters: {
    docs: {
      description: {
        story: `Goliath gatlings (\`${ANIM_BY_PIECE.b}\`). Hull fixed; guns aim.`,
      },
    },
  },
  render: () => <AttackBoardDemo piece="b" />,
};

export const RookBatteryTank: Story = {
  name: "Rook (tank mode)",
  parameters: {
    docs: {
      description: {
        story: `Siege Tank tank-mode dual battery (\`${ANIM_BY_PIECE.r}\`). King-style black tubes + muzzle flashes — no HE impact.`,
      },
    },
  },
  render: () => <AttackBoardDemo piece="r" rookMode="tank" />,
};

export const RookBatterySiege: Story = {
  name: "Rook (siege mode)",
  parameters: {
    docs: {
      description: {
        story: `Sieged Tank shock cannon (\`${ANIM_BY_PIECE.r}\`). Aims local +x at the target; HE impact on the hit square.`,
      },
    },
  },
  render: () => <AttackBoardDemo piece="r" rookMode="siege" />,
};

export const QueenLaser: Story = {
  name: "Queen Laser",
  parameters: {
    docs: {
      description: {
        story: `Battlecruiser laser (\`${ANIM_BY_PIECE.q}\`). Bolt + star burst.`,
      },
    },
  },
  render: () => <AttackBoardDemo piece="q" />,
};

export const KingDualCannon: Story = {
  name: "King Dual Cannon",
  parameters: {
    docs: {
      description: {
        story: `Command center dual cannons (\`${ANIM_BY_PIECE.k}\`). Hat flip + fire.`,
      },
    },
  },
  render: () => <AttackBoardDemo piece="k" />,
};
