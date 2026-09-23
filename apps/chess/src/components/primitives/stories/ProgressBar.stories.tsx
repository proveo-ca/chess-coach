import type { Meta, StoryObj } from "storybook-solidjs-vite";

import { ProgressBar } from "@chess-coach/ui-web/primitives/ProgressBar";

const meta = {
  title: "Primitives/ProgressBar",
  component: ProgressBar,
  args: {
    progress: 62,
    text: "Analyzing move 31 of 50",
  },
  argTypes: {
    progress: { control: { type: "range", min: 0, max: 100, step: 1 } },
  },
} satisfies Meta<typeof ProgressBar>;

export default meta;
type Story = StoryObj<typeof meta>;

export const InProgress: Story = {};

export const Starting: Story = {
  args: { progress: 4, text: "Starting engine…" },
};

export const Complete: Story = {
  args: { progress: 100, text: "Analysis complete" },
};

export const ClampedOverflow: Story = {
  args: { progress: 135, text: "Values above 100 are clamped" },
};
