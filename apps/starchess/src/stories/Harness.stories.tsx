import type { Meta, StoryObj } from "storybook-solidjs-vite";

import { FogEdgeDemo } from "~/demos/FogEdgeDemo";
import { QUEUE_AND_END_SCENARIO } from "~/demos/reviewSamples";

/**
 * DualNav observer review of a single End (both sides queued).
 * Stories feed the SCFEN scenario package only.
 */
const meta = {
  title: "StarChess/Harness",
  parameters: {
    layout: "fullscreen",
    docs: {
      description: {
        component:
          "Queue-then-End as DualNav observer review (not a live match store).",
      },
    },
  },
} satisfies Meta;

export default meta;
type Story = StoryObj;

export const QueueAndEnd: Story = {
  name: "Queue then End",
  render: () => <FogEdgeDemo scenario={QUEUE_AND_END_SCENARIO} />,
};
