import type { Meta, StoryObj } from "storybook-solidjs-vite";

import { GameOverBanner } from "~/components/features/GameOverBanner";
import { Button } from "~/components/primitives/Button";

const meta = {
  title: "Features/GameOverBanner",
  component: GameOverBanner,
  parameters: { layout: "centered" },
  args: {
    open: true,
    heading: "Checkmate",
    detail: "White wins.",
    children: (
      <>
        <Button primary>Another Game</Button>
        <Button>Review Game</Button>
      </>
    ),
  },
  render: (args) => (
    <div
      style={{
        position: "relative",
        width: "var(--board-size)",
        height: "var(--board-size)",
        background:
          "repeating-conic-gradient(var(--surface-color) 0 25%, var(--panel-bg) 0 50%) 0 / 25% 25%",
      }}
    >
      <GameOverBanner {...args}>{args.children}</GameOverBanner>
    </div>
  ),
} satisfies Meta<typeof GameOverBanner>;

export default meta;
type Story = StoryObj<typeof meta>;

/** Switch Desktop / Mobile / Dynamic via the Storybook viewport toolbar. */
export const Default: Story = {};

export const Draw: Story = {
  args: { heading: "Draw", detail: "Draw by repetition." },
};
