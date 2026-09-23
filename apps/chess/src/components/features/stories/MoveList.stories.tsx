import type { Meta, StoryObj } from "storybook-solidjs-vite";

import { MoveList } from "~/components/features/MoveList";
import { setDifficulty } from "~/store/settingsStore";
import type { GameAnalysis } from "~/types/analysis";
import type { GameRecord } from "~/types/game";

const game = {
  id: "storybook-italian-game",
  startedAt: "2026-07-25T12:00:00.000Z",
  endedAt: null,
  result: "ongoing",
  pgn: "1. e4 e5 2. Nf3 Nc6 3. Bc4 Nf6 4. d3 Bc5",
  startingFen: "rnbqkbnr/pppppppp/8/8/8/8/PPPPPPPP/RNBQKBNR w KQkq - 0 1",
  playerColor: "w",
  difficulty: "advanced",
  playerName: "Knight Owl",
  opponentName: "Selena",
  moves: [
    { san: "e4", hasPressedHint: false, isAI: false },
    { san: "e5", hasPressedHint: false, isAI: true },
    { san: "Nf3", hasPressedHint: true, isAI: false },
    { san: "Nc6", hasPressedHint: false, isAI: true },
    { san: "Bc4", hasPressedHint: false, isAI: false },
    { san: "Nf6", hasPressedHint: false, isAI: true },
    { san: "d3", hasPressedHint: false, isAI: false },
    { san: "Bc5", hasPressedHint: false, isAI: true },
  ],
} satisfies GameRecord;

const analysis = {
  cpDeltas: [8, null, 3, null, -230, null, -72, null],
  wasBestMoves: [true, false, true, false, false, false, false, false],
  bestMoveUcis: ["e2e4", null, "g1f3", null, "f1b5", null, "d2d4", null],
  loading: false,
} satisfies GameAnalysis;

const meta = {
  title: "Features/MoveList",
  component: MoveList,
  parameters: { layout: "centered" },
  args: { game, analysis, activePly: 4 },
  render: (args) => {
    setDifficulty("advanced");
    return <MoveList {...args} />;
  },
} satisfies Meta<typeof MoveList>;

export default meta;
type Story = StoryObj<typeof meta>;

/** Switch Desktop / Mobile / Dynamic via the Storybook viewport toolbar. */
export const Default: Story = {
};

export const Empty: Story = {
  args: { game: null, analysis: undefined, activePly: null },
};
