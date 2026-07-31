import type { Meta, StoryObj } from "storybook-solidjs-vite";

import { NerdScreen } from "~/screens/NerdScreen";

/**
 * Fog of war vision samples + interactive board (move with Brood War chrome).
 * Move L-path / attack / death VFX demos live in the sibling animation folders.
 */
const meta = {
  title: "Screens/Nerd/Brood War/Fog of War and Move Animations",
  component: NerdScreen,
  parameters: {
    layout: "fullscreen",
    route: "/broodwar",
    docs: {
      description: {
        component:
          "Cumulative fog per unit type on NerdScreen. Move L-path / slides come from `BroodWarChessBoard` (not shared ChessBoard). Attack / Death / Deploy folders cover combat VFX; Demo → Combat Chain covers simultaneous resolve.",
      },
    },
  },
  args: {
    boardVariant: "eclipse",
    broodWarMode: true,
  },
} satisfies Meta<typeof NerdScreen>;

export default meta;
type Story = StoryObj<typeof meta>;

export const King: Story = {
  args: {
    startingFen: "7k/7p/8/8/3K4/8/8/8 w - - 0 1",
  },
};

export const Pawn: Story = {
  args: {
    startingFen: "7k/8/8/8/3P4/8/8/K7 w - - 0 1",
  },
  parameters: {
    docs: {
      description: {
        story:
          "Cumulative white vision: pawn wedge on d4 unioned with the corner king on a1.",
      },
    },
  },
};

export const Knight: Story = {
  args: {
    startingFen: "7k/7p/8/8/3N4/8/8/K7 w - - 0 1",
  },
};

export const Bishop: Story = {
  args: {
    startingFen: "7k/1q6/8/8/3B4/8/8/K7 w - - 0 1",
  },
  parameters: {
    docs: {
      description: {
        story:
          "Cumulative white vision (bishop 5×5 + king). Remote queen on b7 shows through fog without clearing its tile.",
      },
    },
  },
};

export const RookTankMode: Story = {
  name: "Rook (tank mode)",
  args: {
    startingFen: "7k/8/8/8/3R4/8/8/K7 w - - 0 1",
    rookMode: "tank",
  },
  parameters: {
    docs: {
      description: {
        story:
          "Tank mode (packed): side treads, compact dome, 5×5 vision, can move.",
      },
    },
  },
};

export const RookSiegeMode: Story = {
  name: "Rook (siege mode)",
  args: {
    startingFen: "7k/8/8/8/3R4/8/8/K7 w - - 0 1",
    rookMode: "siege",
  },
  parameters: {
    docs: {
      description: {
        story:
          "Siege mode (unpacked trebuchet): outriggers, raised boom, 9×9 vision, cannot move.",
      },
    },
  },
};

export const Queen: Story = {
  args: {
    startingFen: "7k/8/8/8/3Q4/8/8/K7 w - - 0 1",
  },
  parameters: {
    docs: {
      description: {
        story: "Queen vision: centered 7×7.",
      },
    },
  },
};
