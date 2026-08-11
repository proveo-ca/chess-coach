import { formatScFen } from "@chess-coach/starchess-core";
import type { Meta, StoryObj } from "storybook-solidjs-vite";

import { buildReviewHistory } from "~/app/reviewHistory";
import {
  COLLISION_ALLY_BLOCK_SCENARIO,
  COLLISION_KNIGHT_SPEED_SCENARIO,
  COLLISION_PATH_BLOCK_SCENARIO,
  COLLISION_SAME_SQUARE_SCENARIO,
} from "~/demos/collisionRaces";
import type { FogEdgeScenario } from "~/types/demos";
import { ReviewScreen } from "~/screens/ReviewScreen";
import { addMatchRecord } from "~/store/matchHistoryStore";
import type { StarChessGameRecord } from "~/types/review";

/**
 * Collision races as plain ReviewScreen + pre-loaded SCFEN history
 * (same path as `/review/:id`).
 * // SPEC: _spec/apps/starchess/demos.puml, _spec/packages/starchess-core/resolve.puml
 */

const recordFromScenario = (
  id: string,
  scenario: FogEdgeScenario,
  label: string,
): StarChessGameRecord => {
  const history = buildReviewHistory({
    start: scenario.plies[0]!,
    steps: scenario.steps,
    startCaption: scenario.startCaption,
    queueStep: scenario.queueStep,
  });
  return {
    id,
    startedAt: "2026-08-10T12:00:00.000Z",
    endedAt: "2026-08-10T12:05:00.000Z",
    result: "win",
    map: "eclipse",
    playerColor: "w",
    playerName: label,
    scfens: history.settledSnapshots.map((s) => formatScFen(s)),
    resolves: [...history.settledResolves],
  };
};

const meta = {
  title: "StarChess/Collision",
  parameters: {
    layout: "fullscreen",
    docs: {
      description: {
        component:
          "Collision races via ReviewScreen DualNav (pre-loaded match history). Path block discovers the first enemy; same-square race → both die; knight vs gas-flee + bishop race → both die.",
      },
    },
  },
} satisfies Meta;

export default meta;
type Story = StoryObj;

const storyOf = (id: string, scenario: FogEdgeScenario, label: string): Story => ({
  name: label,
  parameters: {
    layout: "fullscreen",
    route: `/review/${id}`,
    docs: {
      description: {
        story: scenario.startCaption,
      },
    },
  },
  render: () => {
    // Seed before ReviewScreen mounts (same pattern as Screens/Review stories).
    addMatchRecord(recordFromScenario(id, scenario, label));
    return <ReviewScreen />;
  },
});

export const PathBlockDiscoveredPawn = storyOf(
  "storybook-collision-path-block",
  {
    ...COLLISION_PATH_BLOCK_SCENARIO,
    reviewLabel: "Path block",
  },
  "Path block · discovered pawn",
);

export const AllyBlockTruncate = storyOf(
  "storybook-collision-ally-block",
  {
    ...COLLISION_ALLY_BLOCK_SCENARIO,
    reviewLabel: "Ally block",
    visionMode: "observer",
    fog: false,
  },
  "Ally block · truncate",
);

export const SameSquareBishops = storyOf(
  "storybook-collision-same-square",
  {
    ...COLLISION_SAME_SQUARE_SCENARIO,
    reviewLabel: "Same square",
    visionMode: "observer",
    fog: false,
  },
  "Same square · bishops 1 vs 3",
);

export const KnightSpeed = storyOf(
  "storybook-collision-knight-speed",
  {
    ...COLLISION_KNIGHT_SPEED_SCENARIO,
    reviewLabel: "Knight speed",
    visionMode: "observer",
    fog: false,
  },
  "Knight speed · gas pawn + bishop",
);
