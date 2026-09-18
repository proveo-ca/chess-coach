import type { Meta, StoryObj } from "storybook-solidjs-vite";

import {
  COLLISION_ALLY_BLOCK_SCENARIO,
  COLLISION_KNIGHT_SPEED_SCENARIO,
  COLLISION_PATH_BLOCK_SCENARIO,
  COLLISION_SAME_SQUARE_SCENARIO,
} from "~/demos/collisionRaces";
import { ReviewScreen } from "~/screens/ReviewScreen";
import { CrushBoardDemo } from "~/presentation/animations/components/CrushBoardDemo";
import { recordFromScenario, seedMatchHistory } from "~/stories/project";
import type { FogEdgeScenario } from "~/types/demos";

/**
 * Collision races as plain ReviewScreen + pre-loaded SCFEN history
 * (same path as `/review/:id`).
 * // SPEC: _spec/apps/starchess/demos.puml, _spec/packages/starchess-core/resolve.puml
 */

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
  beforeEach: seedMatchHistory(recordFromScenario(id, scenario, label)),
  render: () => <ReviewScreen />,
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

/**
 * Ally deploy-crush · white Marine drops onto black Hoverbike (d4).
 * Store-free `AnimationStage` loop: idle → deploy at t0 + crush death at
 * +100ms → landed. Deploy hull must paint above the death boom
 * (Deploy z37 > Death z35) — layered compose, never switching clips.
 * // SPEC: _spec/apps/starchess/architecture/composite-vfx-stack.puml
 */
export const DeployCrushEnemy: Story = {
  name: "Deploy crush · ally Marine vs enemy Hoverbike",
  parameters: {
    layout: "fullscreen",
    docs: {
      description: {
        story:
          "Loop · white pawn deploys onto black knight d4 · death starts 100ms into the 500ms drop · assert deploy hull above death boom via ffmpeg.",
      },
    },
  },
  render: () => <CrushBoardDemo />,
};
