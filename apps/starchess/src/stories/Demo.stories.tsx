import type { Meta, StoryObj } from "storybook-solidjs-vite";

import {
  StarChessScenarioHarness,
} from "~/stories/StarChessScenarioHarness";
import {
  COMBAT_CHAIN_START_SCFEN,
  GAS_STEP_SCFEN,
  GAS_USED_FOG_SCFEN,
  KING_HUNT_LIVE_START_SCFEN,
  PROMOTION_CLEAN_SCFEN,
  PROMOTION_MINE_SCFEN,
} from "~/stories/fixtures/seeds";

const meta = {
  title: "StarChess/Demo",
  parameters: {
    layout: "fullscreen",
    docs: {
      description: {
        component:
          "Standalone StarChess scenarios — fixtures + production match commands only.",
      },
    },
  },
} satisfies Meta;

export default meta;
type Story = StoryObj;

export const CombatChain: Story = {
  name: "Combat Chain",
  render: () => (
    <StarChessScenarioHarness
      fixture={{
        scfen: COMBAT_CHAIN_START_SCFEN,
        queue: [
          { timing: "C", kind: "classical", color: "w", from: "d2", to: "d4" },
          { timing: "C", kind: "classical", color: "b", from: "e8", to: "c6" },
        ],
      }}
    />
  ),
};

export const KingHuntLive: Story = {
  name: "King Hunt (live)",
  render: () => (
    <StarChessScenarioHarness
      fixture={{ scfen: KING_HUNT_LIVE_START_SCFEN, stored: 1 }}
    />
  ),
};

export const Promotion: Story = {
  name: "Promotion",
  render: () => (
    <StarChessScenarioHarness
      fixture={{
        scfen: PROMOTION_CLEAN_SCFEN,
        fog: false,
        fast: true,
        queue: [
          {
            timing: "C",
            kind: "classical",
            color: "w",
            from: "e7",
            to: "e8",
            promotion: "q",
          },
        ],
        autoEnd: true,
      }}
    />
  ),
};

export const PromotionMine: Story = {
  name: "Promotion × mine",
  render: () => (
    <StarChessScenarioHarness
      fixture={{
        scfen: PROMOTION_MINE_SCFEN,
        fog: false,
        fast: true,
        queue: [
          {
            timing: "C",
            kind: "classical",
            color: "w",
            from: "e7",
            to: "e8",
            promotion: "q",
          },
        ],
        autoEnd: true,
      }}
    />
  ),
};

export const GasStep: Story = {
  name: "Gas step",
  render: () => (
    <StarChessScenarioHarness
      fixture={{
        scfen: GAS_STEP_SCFEN,
        fog: false,
        queue: [
          { timing: "B", kind: "pawnDouble", color: "w", from: "e2", to: "e3" },
        ],
      }}
    />
  ),
};

export const GasUsedFog: Story = {
  name: "Gas-used fog reveal",
  render: () => (
    <StarChessScenarioHarness fixture={{ scfen: GAS_USED_FOG_SCFEN }} />
  ),
};
