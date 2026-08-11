import type { Meta, StoryObj } from "storybook-solidjs-vite";

import { HistoryOverlay } from "~/components/primitives/HistoryOverlay";

const meta = {
  title: "Primitives/HistoryOverlay",
  component: HistoryOverlay,
  parameters: { layout: "fullscreen" },
  decorators: [
    (Story) => (
      <div
        style={{
          "min-height": "100vh",
          display: "grid",
          "place-items": "center",
          background:
            "linear-gradient(45deg, #d9b77d 25%, #76533a 25%, #76533a 50%, #d9b77d 50%, #d9b77d 75%, #76533a 75%)",
          "background-size": "96px 96px",
        }}
      >
        <div
          style={{
            padding: "20px",
            background: "var(--surface-color, #24262d)",
            color: "white",
            "border-radius": "8px",
          }}
        >
          Board shown behind replay overlay
        </div>
        <Story />
      </div>
    ),
  ],
  args: { active: true },
} satisfies Meta<typeof HistoryOverlay>;

export default meta;
type Story = StoryObj<typeof meta>;

export const Active: Story = {};

export const Inactive: Story = {
  args: { active: false },
};
