import type { Meta, StoryObj } from "storybook-solidjs-vite";

import { PromotionModal } from "~/components/primitives/PromotionModal";

const meta = {
  title: "Primitives/PromotionModal",
  component: PromotionModal,
  decorators: [
    (Story) => (
      <div style={{ position: "relative", "min-height": "320px" }}>
        <Story />
      </div>
    ),
  ],
  args: {
    pending: { color: "w" as const, from: "e7", to: "e8" },
    onSelect: () => undefined,
    onCancel: () => undefined,
  },
} satisfies Meta<typeof PromotionModal>;

export default meta;
type Story = StoryObj<typeof meta>;

export const WhitePieces: Story = {};

export const BlackPieces: Story = {
  args: { pending: { color: "b", from: "e2", to: "e1" } },
};

export const Closed: Story = {
  args: { pending: null },
};
