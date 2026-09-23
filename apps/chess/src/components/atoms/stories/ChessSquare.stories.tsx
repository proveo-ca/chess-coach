import type { Meta, StoryObj } from "storybook-solidjs-vite";

import { ChessSquare } from "~/components/atoms/ChessSquare";

const meta = {
  title: "Atoms/ChessSquare",
  component: ChessSquare,
  args: {
    square: "e4",
    piece: { type: "n", color: "b" },
    pieceSet: "cburnett",
    isLight: true,
    isSelected: false,
    isHovered: false,
    isValidMove: false,
    isAdviceHovered: false,
    isDragging: false,
    isInvalid: false,
    showRank: "4",
    showFile: "e",
    onClick: () => undefined,
    onMouseEnter: () => undefined,
    onDragStart: () => undefined,
    onDragEnter: () => undefined,
    onDragOver: () => undefined,
    onDrop: () => undefined,
    lastMove: null,
    animationQueue: [],
    flipped: false,
    isCheck: false,
    isCheckmate: false,
    isStalemate: false,
  },
  decorators: [
    (Story) => (
      <div style="--square-size: 7rem;">
        <Story />
      </div>
    ),
  ],
  parameters: { layout: "centered" },
} satisfies Meta<typeof ChessSquare>;

export default meta;
type Story = StoryObj<typeof meta>;

export const Occupied: Story = {};

export const Selected: Story = {
  args: { isSelected: true, lastMove: { from: "g8", to: "e7" }, square: "e7" },
};

export const ValidDestination: Story = {
  args: { piece: null, isLight: false, isValidMove: true, showRank: false, showFile: false },
};

export const Capture: Story = {
  args: { isLight: false, isValidMove: true },
};

export const Checkmate: Story = {
  args: { piece: { type: "k", color: "b" }, isCheckmate: true },
};
