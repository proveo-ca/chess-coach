import { onCleanup } from "solid-js";
import type { Meta, StoryObj } from "storybook-solidjs-vite";

import { ChessBoardArrow } from "~/components/atoms/ChessBoardArrow";
import { activePlayerColor, setActivePlayerColor } from "~/store/settingsStore";

const meta = {
  title: "Atoms/ChessBoardArrow",
  component: ChessBoardArrow,
  args: {
    from: "g1",
    to: "f3",
    color: "#7dd17d",
    id: "storybook-future-best-move",
  },
  parameters: { layout: "centered" },
} satisfies Meta<typeof ChessBoardArrow>;

export default meta;
type Story = StoryObj<typeof meta>;

const boardStyle = {
  position: "relative",
  width: "28rem",
  height: "28rem",
  "max-width": "85vw",
  "max-height": "85vw",
  background:
    "conic-gradient(from 90deg, #779556 25%, #ebecd0 0 50%, #779556 0 75%, #ebecd0 0) 0 0 / 25% 25%",
} as const;

export const FutureBestMove: Story = {
  parameters: {
    docs: { description: { story: "Green points forward to the best move from this position." } },
  },
  render: (args) => {
    const previous = activePlayerColor();
    setActivePlayerColor("w");
    onCleanup(() => setActivePlayerColor(previous));
    return (
      <div style={boardStyle}>
        <ChessBoardArrow {...args} />
      </div>
    );
  },
};

export const CorrectiveBestMove: Story = {
  args: {
    id: "storybook-corrective-best-move",
    from: "d2",
    to: "d4",
    color: "#76b3e1",
  },
  parameters: {
    docs: {
      description: {
        story: "Blue shows the move that should have been played after reviewing a completed move.",
      },
    },
  },
  render: (args) => {
    const previous = activePlayerColor();
    setActivePlayerColor("w");
    onCleanup(() => setActivePlayerColor(previous));
    return (
      <div style={boardStyle}>
        <ChessBoardArrow {...args} />
      </div>
    );
  },
};
