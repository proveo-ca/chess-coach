import type { Meta, StoryObj } from "storybook-solidjs-vite";

import { Credits } from "~/components/features/Credits";

const meta = {
  title: "Features/Credits",
  component: Credits,
  args: { open: true, onClose: () => undefined },
  parameters: { layout: "fullscreen" },
} satisfies Meta<typeof Credits>;

export default meta;
type Story = StoryObj<typeof meta>;

export const Open: Story = {};
