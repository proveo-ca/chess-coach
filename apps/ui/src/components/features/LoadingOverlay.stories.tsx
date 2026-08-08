import type { Meta, StoryObj } from "storybook-solidjs-vite";

import { LoadingOverlay } from "~/components/features/LoadingOverlay";
import { setLlmProgress } from "~/store/coachStore";

const meta = {
  title: "Features/LoadingOverlay",
  component: LoadingOverlay,
  parameters: {
    layout: "fullscreen",
    storyState: { coach: { ready: false } },
  },
  render: () => {
    setLlmProgress(62, "Loading coaching model…");
    return <LoadingOverlay />;
  },
} satisfies Meta<typeof LoadingOverlay>;

export default meta;
type Story = StoryObj<typeof meta>;

/** Switch Desktop / Mobile / Dynamic via the Storybook viewport toolbar. */
export const Default: Story = {
};

