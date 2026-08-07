import type { Meta, StoryObj } from "storybook-solidjs-vite";

import { FogEdgeDemo } from "~/demos/FogEdgeDemo";
import { FOG_EDGE_BISHOP_SCENARIO } from "~/demos/fogEdgeBishop";
import { FOG_EDGE_ROOK_TANK_SCENARIO } from "~/demos/fogEdgeRookTank";
import {
  FOG_MOVE_KING_SCENARIO,
  FOG_MOVE_KNIGHT_SCENARIO,
  FOG_MOVE_PAWN_SCENARIO,
  FOG_MOVE_QUEEN_SCENARIO,
} from "~/demos/fogMoveSamples";
import { AttackBoardDemo } from "~/presentation/animations/AttackBoardDemo";
import { SpiderMineFogDemo } from "~/presentation/animations/SpiderMineFogDemo";

/**
 * Stories feed SCFEN scenario packages only — no queue / resolve / combat logic here.
 * // SPEC: _spec/apps/ui/starchess/demos.puml, _spec/apps/ui/starchess/resolve.puml
 */
const meta = {
  title: "StarChess/Fog of War and Move Animations",
  parameters: {
    layout: "fullscreen",
    docs: {
      description: {
        component:
          "DualNav asserts **intent → resolve**: dashed ghost on `intentTo` (unit stays on `from`), then End-style combat resolve (slide + progressive fog). Bishop / Rook (tank) also assert fog-edge move collision. Siege rook demo cycles HE battery attacks on adjacent squares. Spider Mine fog: `M:` own-square vision.",
      },
    },
  },
} satisfies Meta;

export default meta;
type Story = StoryObj;

export const King: Story = {
  render: () => <FogEdgeDemo scenario={FOG_MOVE_KING_SCENARIO} />,
  parameters: {
    docs: {
      description: {
        story:
          "Kd4→e5. First forward: ghost on e5, king stays on d4. Second: resolve slide + progressive fog.",
      },
    },
  },
};

export const Pawn: Story = {
  render: () => <FogEdgeDemo scenario={FOG_MOVE_PAWN_SCENARIO} />,
  parameters: {
    docs: {
      description: {
        story:
          "Cumulative vision (pawn ∧ king). Pd4→d5: intent ghost then resolve hop.",
      },
    },
  },
};

export const Knight: Story = {
  render: () => <FogEdgeDemo scenario={FOG_MOVE_KNIGHT_SCENARIO} />,
  parameters: {
    docs: {
      description: {
        story: "Nd4→e6: intent ghost on e6, then L-path resolve + fog.",
      },
    },
  },
};

export const Bishop: Story = {
  render: () => <FogEdgeDemo scenario={FOG_EDGE_BISHOP_SCENARIO} />,
  parameters: {
    docs: {
      description: {
        story:
          "Fog overrides FEN: queue Bd4→h8 onto a hidden king. Resolve discovers g7 → Bxg7 (king spared).",
      },
    },
  },
};

export const RookTankMode: Story = {
  name: "Rook (tank mode)",
  render: () => <FogEdgeDemo scenario={FOG_EDGE_ROOK_TANK_SCENARIO} />,
  parameters: {
    docs: {
      description: {
        story:
          "SCFEN-legal intent Rd4→d8. Resolve: approach → discover d7 → Rxd7 occupy.",
      },
    },
  },
};

export const RookSiegeMode: Story = {
  name: "Rook (siege mode)",
  render: () => <AttackBoardDemo piece="r" rookMode="siege" />,
  parameters: {
    docs: {
      description: {
        story:
          "Siege mode (unpacked trebuchet): cycles HE battery attacks on adjacent targets — hatch stays packed, boom + smoke on impact.",
      },
    },
  },
};

export const Queen: Story = {
  render: () => <FogEdgeDemo scenario={FOG_MOVE_QUEEN_SCENARIO} />,
  parameters: {
    docs: {
      description: {
        story: "Qd4→d6: intent ghost on d6, then resolve slide + fog.",
      },
    },
  },
};

export const SpiderMine: Story = {
  name: "Spider Mine",
  render: () => <SpiderMineFogDemo />,
  parameters: {
    docs: {
      description: {
        story:
          "SCFEN `M:w:a4` — vision is only the mine’s own square for the owning side (fog veil).",
      },
    },
  },
};
