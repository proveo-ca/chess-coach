import type { Meta, StoryObj } from "storybook-solidjs-vite";

import { StarChessScenarioHarness } from "~/stories/StarChessScenarioHarness";
import { COMBAT_CHAIN_START_SCFEN } from "~/stories/fixtures/seeds";

const meta = {
  title: "StarChess/Harness",
  parameters: {
    layout: "fullscreen",
    docs: {
      description: {
        component: "StarChessScenarioHarness — single production command path for demos.",
      },
    },
  },
} satisfies Meta;

export default meta;
type Story = StoryObj;

export const QueueAndEnd: Story = {
  name: "Queue then End",
  render: () => (
    <StarChessScenarioHarness
      fixture={{
        scfen: COMBAT_CHAIN_START_SCFEN,
        fast: true,
        queue: [
          { timing: "C", kind: "classical", color: "w", from: "d2", to: "d4" },
          { timing: "C", kind: "classical", color: "b", from: "e8", to: "c6" },
        ],
        autoEnd: true,
      }}
    />
  ),
};
