import type { Meta, StoryObj } from "storybook-solidjs-vite";

import { FogVisionDemo } from "~/presentation/animations/components/FogVisionDemo";
import { StaticScfenBoard } from "~/presentation/board/components/StaticScfenBoard";
import {
  GAS_USED_FOG_FIXTURE,
  OPEN_BOARD_FIXTURE,
} from "~/stories/fixtures/scenarios";

/**
 * Static SCFEN board samples — always on Screen grid; no live match / DualNav.
 */
const meta = {
  title: "StarChess/Board",
  parameters: { layout: "fullscreen" },
} satisfies Meta;

export default meta;
type Story = StoryObj;

export const FogReveal: Story = {
  name: "Fog + gas-used (no pierce)",
  render: () => (
    <FogVisionDemo
      scfen={GAS_USED_FOG_FIXTURE.scfen}
      caption={GAS_USED_FOG_FIXTURE.caption}
    />
  ),
};

export const OpenBoard: Story = {
  name: "Open (no fog)",
  render: () => (
    <StaticScfenBoard
      scfen={OPEN_BOARD_FIXTURE.scfen}
      fog={OPEN_BOARD_FIXTURE.fog}
      visionMode={OPEN_BOARD_FIXTURE.visionMode}
      caption="Open board · no fog"
    />
  ),
};
