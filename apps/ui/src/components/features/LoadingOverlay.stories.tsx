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

export const Desktop: Story = {
  globals: { viewport: { value: "desktop", isRotated: false } },
};

export const Mobile: Story = {
  globals: { viewport: { value: "mobile", isRotated: false } },
};

export const Dynamic: Story = {
  globals: { viewport: { value: "dynamic", isRotated: false } },
};
