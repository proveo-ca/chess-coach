import type { Meta, StoryObj } from "storybook-solidjs-vite";

import { StarChessScenarioHarness } from "~/stories/StarChessScenarioHarness";
import { GAS_USED_FOG_SCFEN, COMBAT_CHAIN_START_SCFEN } from "~/stories/fixtures/seeds";

const meta = {
  title: "StarChess/Board",
  parameters: { layout: "centered" },
} satisfies Meta;

export default meta;
type Story = StoryObj;

export const FogReveal: Story = {
  name: "Fog + gas-used reveal",
  render: () => (
    <div style={{ width: "420px" }}>
      <StarChessScenarioHarness fixture={{ scfen: GAS_USED_FOG_SCFEN }} />
    </div>
  ),
};

export const OpenBoard: Story = {
  name: "Open (no fog)",
  render: () => (
    <div style={{ width: "420px" }}>
      <StarChessScenarioHarness
        fixture={{ scfen: COMBAT_CHAIN_START_SCFEN, fog: false }}
      />
    </div>
  ),
};
