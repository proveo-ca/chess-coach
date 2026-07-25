import type { Meta, StoryObj } from "storybook-solidjs-vite";

import { IconButton } from "~/components/primitives/IconButton";
import { CogIcon, FlipBoardIcon, HintIcon } from "~/components/primitives/icons";

const meta = {
  title: "Primitives/IconButton",
  component: IconButton,
  args: {
    children: <HintIcon size={24} />,
    "aria-label": "Show hint",
  },
} satisfies Meta<typeof IconButton>;

export default meta;
type Story = StoryObj<typeof meta>;

export const IconOnly: Story = {};

export const LabelOnTop: Story = {
  args: {
    children: <FlipBoardIcon size={24} />,
    label: "Flip",
    "aria-label": "Flip board",
  },
};

export const LabelOnBottom: Story = {
  args: {
    children: <CogIcon size={24} />,
    label: "Settings",
    labelPosition: "bottom",
    "aria-label": "Open settings",
  },
};

export const Link: Story = {
  args: {
    children: <CogIcon size={24} />,
    label: "Settings",
    href: "/settings",
    "aria-label": "Open settings",
  },
};
