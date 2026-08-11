import type { Meta, StoryObj } from "storybook-solidjs-vite";

import { EvalBar } from "~/components/primitives/EvalBar";

const meta = {
  title: "Primitives/EvalBar",
  component: EvalBar,
  parameters: {
    layout: "centered",
    controls: { disable: true },
  },
  decorators: [
    (Story) => (
      <div
        style={{
          position: "relative",
          width: "var(--board-size)",
          height: "var(--board-size)",
          "margin-left": "3rem",
        }}
      >
        <Story />
      </div>
    ),
  ],
  args: {
    score: { kind: "cp", value: 235 },
    turn: "w",
    isFlipped: false,
    maxPawns: 10,
  },
} satisfies Meta<typeof EvalBar>;

export default meta;
type Story = StoryObj<typeof meta>;

export const WhiteAdvantage: Story = {};

export const BlackAdvantage: Story = {
  args: { score: { kind: "cp", value: -480 } },
};

export const Mate: Story = {
  args: { score: { kind: "mate", value: 3 } },
};

export const Flipped: Story = {
  args: { score: { kind: "cp", value: 235 }, isFlipped: true },
};
