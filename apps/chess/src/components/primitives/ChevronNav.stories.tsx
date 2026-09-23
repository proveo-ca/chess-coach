import type { Meta, StoryObj } from "storybook-solidjs-vite";

import { ChevronNav } from "~/components/primitives/ChevronNav";

const meta = {
  title: "Primitives/ChevronNav",
  component: ChevronNav,
  parameters: { layout: "centered" },
} satisfies Meta<typeof ChevronNav>;

export default meta;
type Story = StoryObj<typeof meta>;

export const Back: Story = {
  args: {
    direction: "back",
    children: "Back",
    href: "/",
    "aria-label": "Back",
  },
};

export const Share: Story = {
  args: {
    direction: "forward",
    children: "Share",
    onClick: () => undefined,
    "aria-label": "Share",
  },
};
