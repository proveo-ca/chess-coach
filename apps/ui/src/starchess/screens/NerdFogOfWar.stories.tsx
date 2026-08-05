import type { Meta, StoryObj } from "storybook-solidjs-vite";

import { FogEdgeDemo } from "~/starchess/animations/FogEdgeDemo";
import {
  FogVisionDemo,
  FOG_SIEGE_ROOK_SCFEN,
} from "~/starchess/animations/FogVisionDemo";
import { FOG_EDGE_BISHOP_SCENARIO } from "~/starchess/demos/fogEdgeBishop";
import { FOG_EDGE_ROOK_TANK_SCENARIO } from "~/starchess/demos/fogEdgeRookTank";
import {
  FOG_MOVE_KING_SCENARIO,
  FOG_MOVE_KNIGHT_SCENARIO,
  FOG_MOVE_PAWN_SCENARIO,
  FOG_MOVE_QUEEN_SCENARIO,
} from "~/starchess/demos/fogMoveSamples";

/**
 * Stories feed SCFEN scenario packages only — no queue / resolve / combat logic here.
 * // SPEC: _spec/apps/ui/starchess/demos.puml, _spec/apps/ui/starchess/resolve.puml
 */
const meta = {
  title: "Screens/Nerd/StarChess/Fog of War and Move Animations",
  parameters: {
    layout: "fullscreen",
    docs: {
      description: {
        component:
          "DualNav asserts **intent → resolve**: dashed ghost on `intentTo` (unit stays on `from`), then End-style combat resolve (slide + progressive fog). Bishop / Rook (tank) also assert fog-edge move collision. Siege rook stays a static vision sample (cannot relocate).",
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
  render: () => (
    <FogVisionDemo
      scfen={FOG_SIEGE_ROOK_SCFEN}
      rookMode="siege"
      caption="Siege · SCFEN Rd4 · 9×9 vision, immobile (vision sample)"
    />
  ),
  parameters: {
    docs: {
      description: {
        story:
          "Siege mode (unpacked trebuchet): outriggers, raised boom, 9×9 vision, cannot move — static SCFEN vision sample.",
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
