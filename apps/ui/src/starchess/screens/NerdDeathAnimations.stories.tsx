import type { Meta, StoryObj } from "storybook-solidjs-vite";

import { DeathBoardDemo } from "~/starchess/animations/DeathBoardDemo";

/**
 * StarChess death VFX via ChessBoard `deathCues` → `DeathAnimation`.
 * King HP hunt lives under Screens/Nerd/StarChess/Demo → King Hunt.
 */
const meta = {
  title: "Screens/Nerd/StarChess/Death Animations",
  parameters: {
    layout: "centered",
    docs: {
      description: {
        component:
          "Production death layer on ChessBoard. Every cue finishes in 500ms. Pawn: outward bubble + shred; king: rubble collapse; others: boom + shards. For the 3-HP hunt narrative see Screens/Nerd/StarChess/Demo → King Hunt.",
      },
    },
  },
} satisfies Meta;

export default meta;
type Story = StoryObj;

export const PawnBubble: Story = {
  name: "Pawn Bubble",
  parameters: {
    docs: {
      description: {
        story: "Marine: soap-film expands while helmet/body/gun shards rip apart.",
      },
    },
  },
  render: () => <DeathBoardDemo piece="p" />,
};

export const KnightShatter: Story = {
  name: "Knight Shatter",
  parameters: {
    docs: {
      description: {
        story: "Vulture boom; nacelles / body / rider shards fly off-screen.",
      },
    },
  },
  render: () => <DeathBoardDemo piece="n" />,
};

export const BishopShatter: Story = {
  name: "Bishop Shatter",
  parameters: {
    docs: {
      description: {
        story: "Goliath boom; legs, cockpit, and both gatlings peel away.",
      },
    },
  },
  render: () => <DeathBoardDemo piece="b" />,
};

export const RookShatter: Story = {
  name: "Rook Shatter",
  parameters: {
    docs: {
      description: {
        story:
          "Siege Tank boom side-by-side: c4 tank (tracks + twin tubes) and e4 siege (wedge armor + filled twins) shatter together.",
      },
    },
  },
  render: () => <DeathBoardDemo piece="r" />,
};

export const QueenShatter: Story = {
  name: "Queen Shatter",
  parameters: {
    docs: {
      description: {
        story: "Battlecruiser boom; jets, spine, and hammerhead fling outward.",
      },
    },
  },
  render: () => <DeathBoardDemo piece="q" />,
};

export const KingShatter: Story = {
  name: "King Rubble",
  parameters: {
    docs: {
      description: {
        story:
          "Command center collapses into rubble (`destroyed` + collapse) — parts drop down, no outward shatter.",
      },
    },
  },
  render: () => <DeathBoardDemo piece="k" />,
};
