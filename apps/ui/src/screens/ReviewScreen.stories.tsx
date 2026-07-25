import type { Meta, StoryObj } from "storybook-solidjs-vite";

import { ReviewScreen } from "~/screens/ReviewScreen";
import { getExpectedReviewId, importGameRecord } from "~/store/gameHistoryStore";
import type { GameRecord } from "~/types/game";

const STARTING_FEN = "rnbqkbnr/pppppppp/8/8/8/8/PPPPPPPP/RNBQKBNR w KQkq - 0 1";

const games = [
  {
    id: "storybook-e4",
    startedAt: "2026-07-25T10:00:00.000Z",
    endedAt: "2026-07-25T10:18:00.000Z",
    result: "win",
    pgn: "1. e4 e5 2. Nf3 Nc6 3. Bb5 a6 1-0",
    startingFen: STARTING_FEN,
    playerColor: "w",
    difficulty: "intermediate",
    playerRace: "Human",
    opponentRace: "Cat",
    playerName: "Alex",
    opponentName: "Selena",
    moves: [
      { san: "e4", hasPressedHint: false, isAI: false },
      { san: "e5", hasPressedHint: false, isAI: true },
      { san: "Nf3", hasPressedHint: true, isAI: false },
      { san: "Nc6", hasPressedHint: false, isAI: true },
      { san: "Bb5", hasPressedHint: false, isAI: false },
      { san: "a6", hasPressedHint: false, isAI: true },
    ],
  },
  {
    id: "storybook-d4",
    startedAt: "2026-07-25T12:00:00.000Z",
    endedAt: "2026-07-25T12:24:00.000Z",
    result: "draw",
    pgn: "1. d4 d5 2. c4 e6 1/2-1/2",
    startingFen: STARTING_FEN,
    playerColor: "w",
    difficulty: "advanced",
    playerRace: "Dog",
    opponentRace: "Cat",
    playerName: "Alex",
    opponentName: "Selena",
    moves: [
      { san: "d4", hasPressedHint: false, isAI: false },
      { san: "d5", hasPressedHint: false, isAI: true },
      { san: "c4", hasPressedHint: false, isAI: false },
      { san: "e6", hasPressedHint: false, isAI: true },
    ],
  },
] satisfies GameRecord[];

const reviewId = getExpectedReviewId(games[0].pgn, games[0].startingFen);

const seedHistory = () => {
  for (const game of games) importGameRecord(game);
};

const meta = {
  title: "Screens/Review",
  component: ReviewScreen,
  parameters: {
    layout: "fullscreen",
    route: "/review",
  },
} satisfies Meta<typeof ReviewScreen>;

export default meta;
type Story = StoryObj<typeof meta>;

export const Desktop: Story = {
  globals: { viewport: { value: "desktop", isRotated: false } },
  render: () => {
    seedHistory();
    return <ReviewScreen />;
  },
};

export const Mobile: Story = {
  globals: { viewport: { value: "mobile", isRotated: false } },
  render: () => {
    seedHistory();
    return <ReviewScreen />;
  },
};

export const Dynamic: Story = {
  globals: { viewport: { value: "dynamic", isRotated: false } },
  render: () => {
    seedHistory();
    return <ReviewScreen />;
  },
};

export const GameDetail: Story = {
  globals: { viewport: { value: "desktop", isRotated: false } },
  parameters: { route: `/review/${reviewId}` },
  render: () => {
    seedHistory();
    return <ReviewScreen />;
  },
};
