import type { Meta, StoryObj } from "storybook-solidjs-vite";

import { DeathBoardDemo } from "~/broodwar/animations/DeathBoardDemo";

/**
 * Brood War death VFX via ChessBoard `deathCues` → `DeathAnimation`.
 */
const meta = {
  title: "Screens/Nerd/Brood War/Death Animations",
  parameters: {
    layout: "centered",
    docs: {
      description: {
        component:
          "Production death layer on ChessBoard. Every cue finishes in 500ms. Pawn: outward bubble + shred; others: boom + shards.",
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
        story: "Siege tank boom; hull panels and twin cannons scatter.",
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
  name: "King Shatter",
  parameters: {
    docs: {
      description: {
        story: "Command center boom; foundation, bays, deck, and hub fly apart.",
      },
    },
  },
  render: () => <DeathBoardDemo piece="k" />,
};
