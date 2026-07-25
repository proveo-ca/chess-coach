import type { Meta, StoryObj } from "storybook-solidjs-vite";

import { Credits } from "~/components/atoms/Credits";

const meta = {
  title: "Atoms/Credits",
  component: Credits,
  args: { open: true, onClose: () => undefined },
  parameters: { layout: "fullscreen" },
} satisfies Meta<typeof Credits>;

export default meta;
type Story = StoryObj<typeof meta>;

export const Open: Story = {};
