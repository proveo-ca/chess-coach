import type { Meta, StoryObj } from "storybook-solidjs-vite";

import { DualNavButton } from "@chess-coach/ui-web/primitives/DualNavButton";

const meta = {
  title: "Primitives/DualNavButton",
  component: DualNavButton,
  args: {
    label: "Move 12 of 24",
    onBack: () => undefined,
    onForward: () => undefined,
    backDisabled: false,
    forwardDisabled: false,
  },
} satisfies Meta<typeof DualNavButton>;

export default meta;
type Story = StoryObj<typeof meta>;

export const Default: Story = {};

export const AtBeginning: Story = {
  args: { label: "Starting position", backDisabled: true },
};

export const ReplayInline: Story = {
  args: {
    label: undefined,
    inline: true,
    inverted: true,
    showBackToLive: true,
    onBackToLive: () => undefined,
  },
};
