import type { Meta, StoryObj } from "storybook-solidjs-vite";

import { FogVisionDemo } from "~/presentation/animations/FogVisionDemo";
import { StaticScfenBoard } from "~/presentation/board/StaticScfenBoard";
import {
  GAS_USED_FOG_FIXTURE,
  OPEN_BOARD_FIXTURE,
} from "~/stories/fixtures/scenarios";

/**
 * Static SCFEN board samples — no live match store / DualNav.
 */
const meta = {
  title: "StarChess/Board",
  parameters: { layout: "centered" },
} satisfies Meta;

export default meta;
type Story = StoryObj;

export const FogReveal: Story = {
  name: "Fog + gas-used reveal",
  render: () => (
    <div style={{ width: "420px" }}>
      <FogVisionDemo
        scfen={GAS_USED_FOG_FIXTURE.scfen}
        caption={GAS_USED_FOG_FIXTURE.caption}
      />
    </div>
  ),
};

export const OpenBoard: Story = {
  name: "Open (no fog)",
  render: () => (
    <StaticScfenBoard
      scfen={OPEN_BOARD_FIXTURE.scfen}
      fog={OPEN_BOARD_FIXTURE.fog}
      visionMode={OPEN_BOARD_FIXTURE.visionMode}
      width="420px"
    />
  ),
};
