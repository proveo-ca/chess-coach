import type { Meta, StoryObj } from "storybook-solidjs-vite";

import { MobileBanner } from "~/components/atoms/MobileBanner";

const meta = {
  title: "Atoms/MobileBanner",
  component: MobileBanner,
  parameters: { layout: "fullscreen" },
  args: {
    title: "Solo Analysis",
    onMenu: () => undefined,
  },
} satisfies Meta<typeof MobileBanner>;

export default meta;
type Story = StoryObj<typeof meta>;

/** Switch Desktop / Mobile / Dynamic via the Storybook viewport toolbar. */
export const Default: Story = {};
