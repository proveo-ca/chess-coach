import type { Meta, StoryObj } from "storybook-solidjs-vite";

import { FogEdgeDemo } from "~/demos/FogEdgeDemo";
import {
  ATTACK_MINE_SCENARIO,
  PATH_COLLIDE_ALLY_MINE_SCENARIO,
  PATH_COLLIDE_SCENARIO,
  PROMOTION_ONTO_MINE_SCENARIO,
} from "~/demos/spiderMineScenarios";

/**
 * Stories mount SCFEN demos only — no queue / resolve / combat logic here.
 * Restored from apps/chess `SpiderMines.stories` @ 4340996; DualNav via FogEdgeDemo.
 * Mine fog vision lives under Fog of War and Move Animations.
 * Promotion × mine mirrors `packages/starchess-core/src/__tests__/mine/minePathContact.test.ts`.
 * // SPEC: _spec/apps/starchess/demos.puml
 */
const meta = {
  title: "StarChess/Spider Mines",
  parameters: {
    layout: "fullscreen",
    docs: {
      description: {
        component:
          "SCFEN-driven Attack (mine) / path-collide DualNav → combat bus. Promotion × mine is the core package walk-over case. Mine fog vision: Fog of War → Spider Mine.",
      },
    },
  },
} satisfies Meta;

export default meta;
type Story = StoryObj;

export const AttackPathCollide: Story = {
  name: "Attack (path collide)",
  render: () => <FogEdgeDemo scenario={PATH_COLLIDE_SCENARIO} />,
  parameters: {
    docs: {
      description: {
        story:
          "2 parallel SCFEN turns (8 actions): T1 Nb mine+c5 & spawn rook→a1; T2 Nb mine+e4 & Ra1→a8 chase-boom (siege F skipped).",
      },
    },
  },
};

export const AttackPathCollideAllyMine: Story = {
  name: "Attack (path collide · ally mine)",
  render: () => <FogEdgeDemo scenario={PATH_COLLIDE_ALLY_MINE_SCENARIO} />,
  parameters: {
    docs: {
      description: {
        story:
          "Sides flipped: T1 Nw mine+c5 & black spawn rook→a8; T2 Nw mine+e4 & ra8→a1 over ally a4 mine chase-boom (siege F skipped).",
      },
    },
  },
};

export const AttackMine: Story = {
  name: "Attack (mine)",
  render: () => <FogEdgeDemo scenario={ATTACK_MINE_SCENARIO} />,
  parameters: {
    docs: {
      description: {
        story:
          "SCFEN classical Nd1→c3: engine attack clears the hostile mine, then occupy. DualNav / arrows. Same case as `promotionMine.test.ts` knight attack-clear.",
      },
    },
  },
};

export const PromotionMine: Story = {
  name: "Promotion × mine",
  render: () => <FogEdgeDemo scenario={PROMOTION_ONTO_MINE_SCENARIO} />,
  parameters: {
    docs: {
      description: {
        story:
          "From `packages/starchess-core/src/__tests__/mine/minePathContact.test.ts`: Pe7→e8=Q onto black mine e8 — walk-over blast, no queen deploy.",
      },
    },
  },
};
