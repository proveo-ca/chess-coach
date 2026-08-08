import type { Meta, StoryObj } from "storybook-solidjs-vite";

import { FOG_EDGE_BISHOP_START_SCFEN } from "~/demos/fogEdgeBishop";
import { FOG_EDGE_ROOK_TANK_START_SCFEN } from "~/demos/fogEdgeRookTank";
import { FogLiveScenarioScreen } from "~/demos/FogLiveScenarioScreen";
import {
  FOG_MOVE_KING_START_SCFEN,
  FOG_MOVE_KNIGHT_START_SCFEN,
  FOG_MOVE_PAWN_START_SCFEN,
  FOG_MOVE_QUEEN_START_SCFEN,
} from "~/demos/fogMoveSamples";
import { FOG_SIEGE_ROOK_SCFEN } from "~/presentation/animations/FogVisionDemo";

/** Own-square mine vision — live player fog. */
const FOG_MINE_LIVE_SCFEN = "SCFEN|7k/8/8/8/8/8/8/4K3|0|33|P|G:11:11|M:w:a4|Q:w:;b:";

/** Siege rook on d4 (immobile 9×9) — live. */
const FOG_SIEGE_LIVE_SCFEN = `${FOG_SIEGE_ROOK_SCFEN}|S:d4`;

/**
 * Live player-fog lessons — HOME-only sidebar, no DualNav.
 * // SPEC: _spec/apps/starchess/demos.puml, _spec/packages/starchess-core/resolve.puml
 */
const meta = {
  title: "StarChess/Fog of War and Move Animations",
  parameters: {
    layout: "fullscreen",
    docs: {
      description: {
        component:
          "Live MatchStore + player fog. Queue a move, End to resolve — fog expands with your pieces. SideRailTools shows HOME only.",
      },
    },
  },
} satisfies Meta;

export default meta;
type Story = StoryObj;

export const King: Story = {
  render: () => <FogLiveScenarioScreen scfen={FOG_MOVE_KING_START_SCFEN} />,
  parameters: {
    docs: {
      description: {
        story: "Kd4 live. Queue Kd4→e5, End — slide + progressive fog.",
      },
    },
  },
};

export const Pawn: Story = {
  render: () => <FogLiveScenarioScreen scfen={FOG_MOVE_PAWN_START_SCFEN} />,
  parameters: {
    docs: {
      description: {
        story: "Pd4 + Ka1 cumulative vision. Queue Pd4→d5, End.",
      },
    },
  },
};

export const Knight: Story = {
  render: () => <FogLiveScenarioScreen scfen={FOG_MOVE_KNIGHT_START_SCFEN} />,
  parameters: {
    docs: {
      description: {
        story: "Nd4 live. Queue Nd4→e6, End — L-path + fog.",
      },
    },
  },
};

export const Bishop: Story = {
  render: () => <FogLiveScenarioScreen scfen={FOG_EDGE_BISHOP_START_SCFEN} />,
  parameters: {
    docs: {
      description: {
        story: "Bd4 into fog toward h8. End discovers g7 → Bxg7 (king spared).",
      },
    },
  },
};

export const RookTankMode: Story = {
  name: "Rook (tank mode)",
  render: () => <FogLiveScenarioScreen scfen={FOG_EDGE_ROOK_TANK_START_SCFEN} rookTank />,
  parameters: {
    docs: {
      description: {
        story: "Tank Rd4→d8 into fog. End: discover d7 → Rxd7.",
      },
    },
  },
};

export const RookSiegeMode: Story = {
  name: "Rook (siege mode)",
  render: () => <FogLiveScenarioScreen scfen={FOG_SIEGE_LIVE_SCFEN} rookSiege />,
  parameters: {
    docs: {
      description: {
        story:
          "Siege rook on d4 — immobile 9×9 vision. Explore fog; siege HE when you capture adjacent.",
      },
    },
  },
};

export const Queen: Story = {
  render: () => <FogLiveScenarioScreen scfen={FOG_MOVE_QUEEN_START_SCFEN} />,
  parameters: {
    docs: {
      description: {
        story: "Qd4 live. Queue Qd4→d6, End — slide + fog.",
      },
    },
  },
};

export const SpiderMine: Story = {
  name: "Spider Mine",
  render: () => <FogLiveScenarioScreen scfen={FOG_MINE_LIVE_SCFEN} />,
  parameters: {
    docs: {
      description: {
        story: "Live `M:w:a4` — mine lights only its own square under player fog.",
      },
    },
  },
};
