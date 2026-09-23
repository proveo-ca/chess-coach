import type { Meta, StoryObj } from "storybook-solidjs-vite";

import { GameHistoryList } from "~/components/atoms/GameHistoryList";
import type { GameRecord } from "~/types/game";

const makeGame = (
  id: string,
  result: GameRecord["result"],
  startedAt: string,
  moves: string[],
): GameRecord => ({
  id,
  startedAt,
  endedAt: result === "ongoing" ? null : startedAt,
  result,
  pgn: "",
  startingFen: "rnbqkbnr/pppppppp/8/8/8/8/PPPPPPPP/RNBQKBNR w KQkq - 0 1",
  playerColor: id === "game-2" ? "b" : "w",
  difficulty: "advanced",
  playerName: "Ada",
  opponentName: "Selena",
  moves: moves.map((san, index) => ({
    san,
    hasPressedHint: false,
    isAI: index % 2 === 1,
  })),
});

const games = [
  makeGame("game-1", "win", "2026-07-25T12:00:00.000Z", ["e4", "e5", "Nf3", "Nc6"]),
  makeGame("game-2", "loss", "2026-07-24T12:00:00.000Z", ["d4", "d5", "c4", "e6"]),
  makeGame("game-3", "draw", "2026-07-23T12:00:00.000Z", ["Nf3", "d5"]),
  makeGame("game-4", "ongoing", "2026-07-22T12:00:00.000Z", []),
];

const meta = {
  title: "Atoms/GameHistoryList",
  component: GameHistoryList,
  args: { games, activeId: "game-2" },
  parameters: { layout: "centered" },
} satisfies Meta<typeof GameHistoryList>;

export default meta;
type Story = StoryObj<typeof meta>;

export const Results: Story = {
  decorators: [
    (Story) => (
      <div style={{ width: "28rem", "max-width": "90vw" }}>
        <Story />
      </div>
    ),
  ],
};

export const Empty: Story = {
  args: { games: [], activeId: undefined },
};
