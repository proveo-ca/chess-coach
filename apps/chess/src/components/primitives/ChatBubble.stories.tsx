import type { Meta, StoryObj } from "storybook-solidjs-vite";

import { ChatBubble } from "@chess-coach/ui-web/primitives/ChatBubble";

const meta = {
  title: "Primitives/ChatBubble",
  component: ChatBubble,
  args: {
    children: "That knight fork wins the queen!",
    exiting: false,
  },
} satisfies Meta<typeof ChatBubble>;

export default meta;
type Story = StoryObj<typeof meta>;

export const Message: Story = {};

export const Interactive: Story = {
  args: {
    children: "Click for the full explanation",
    label: "Explain the coach message",
    onClick: () => undefined,
  },
};

export const Exiting: Story = {
  args: { exiting: true },
};
