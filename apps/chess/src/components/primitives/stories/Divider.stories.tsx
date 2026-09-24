import type { Meta, StoryObj } from "storybook-solidjs-vite";

import { Divider } from "@chess-coach/ui-web/primitives/Divider";

const meta = {
  title: "Primitives/Divider",
  component: Divider,
  decorators: [
    (Story) => (
      <div style={{ width: "360px" }}>
        <Story />
      </div>
    ),
  ],
} satisfies Meta<typeof Divider>;

export default meta;
type Story = StoryObj<typeof meta>;

export const Default: Story = {};

export const BetweenSections: Story = {
  render: () => (
    <div style={{ display: "grid", gap: "16px" }}>
      <span>Game controls</span>
      <Divider />
      <span>Display settings</span>
    </div>
  ),
};
