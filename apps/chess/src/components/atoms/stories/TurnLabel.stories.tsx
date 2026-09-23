import { onCleanup } from "solid-js";
import type { Meta, StoryObj } from "storybook-solidjs-vite";

import { TurnLabel } from "~/components/atoms/TurnLabel";
import { loadGame, resetGame, setViewIndex } from "~/store/gameStore";
import { exitTravel } from "~/store/travelStore";

const STARTING_FEN = "rnbqkbnr/pppppppp/8/8/8/8/PPPPPPPP/RNBQKBNR w KQkq - 0 1";

const meta = {
  title: "Atoms/TurnLabel",
  component: TurnLabel,
  parameters: { layout: "centered" },
} satisfies Meta<typeof TurnLabel>;

export default meta;
type Story = StoryObj<typeof meta>;

export const ReplayingBlackMove: Story = {
  render: () => {
    exitTravel();
    loadGame({ pgn: "1. e4 e5 2. Nf3 Nc6", startingFen: STARTING_FEN });
    setViewIndex(1);
    onCleanup(() => resetGame(STARTING_FEN));
    return <TurnLabel />;
  },
};
