import { formatScFen } from "@chess-coach/starchess-core";
import type { Meta, StoryObj } from "storybook-solidjs-vite";

import { buildReviewHistory } from "~/app/reviewHistory";
import {
  COMBAT_CHAIN_PLY_SC,
  COMBAT_CHAIN_STEPS,
  queueCombatChainStep,
} from "~/demos/combatChain";
import { ReviewScreen } from "~/screens/ReviewScreen.tsx";
import { NERD_STARTING_SCFEN } from "~/stories/fixtures/seeds";
import { addMatchRecord } from "~/store/matchHistoryStore";
import type { StarChessGameRecord } from "~/types/review";

const COMBAT_HISTORY = buildReviewHistory({
  start: COMBAT_CHAIN_PLY_SC[0]!,
  steps: COMBAT_CHAIN_STEPS,
  startCaption: "Start · tank on c3",
  queueStep: (snap, i) => queueCombatChainStep(snap, COMBAT_CHAIN_STEPS[i]!),
});

const REVIEW_ID = "storybook-combat";

/** Blue wins on two dates + one Red loss — exercises color + date filters. */
const games = [
  {
    id: REVIEW_ID,
    startedAt: "2026-08-08T10:00:00.000Z",
    endedAt: "2026-08-08T10:18:00.000Z",
    result: "win",
    map: "eclipse",
    playerColor: "w",
    playerName: "Alex",
    scfens: COMBAT_HISTORY.settledSnapshots.map((s) => formatScFen(s)),
    resolves: [...COMBAT_HISTORY.settledResolves],
  },
  {
    id: "storybook-blue-earlier",
    startedAt: "2026-08-01T12:00:00.000Z",
    endedAt: "2026-08-01T12:08:00.000Z",
    result: "draw",
    map: "butter",
    playerColor: "w",
    playerName: "Alex",
    scfens: [NERD_STARTING_SCFEN],
    resolves: [],
  },
  {
    id: "storybook-red",
    startedAt: "2026-08-05T15:00:00.000Z",
    endedAt: "2026-08-05T15:22:00.000Z",
    result: "loss",
    map: "vermeer",
    playerColor: "b",
    playerName: "Alex",
    scfens: [NERD_STARTING_SCFEN],
    resolves: [],
  },
] satisfies StarChessGameRecord[];

const seedHistory = () => {
  for (const game of games) addMatchRecord(game);
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

/** List view with Playing as + date filters (no Review title). */
export const Default: Story = {
  render: () => {
    seedHistory();
    return <ReviewScreen />;
  },
};

/** Game `/:id` DualNav replay. */
export const GameDetail: Story = {
  parameters: { route: `/review/${REVIEW_ID}` },
  render: () => {
    seedHistory();
    return <ReviewScreen />;
  },
};
