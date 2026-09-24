import type { Meta, StoryObj } from "storybook-solidjs-vite";

import {
  DebugControls,
  debugHistoryOverlay,
  debugLightSpeedOverlay,
} from "~/components/atoms/DebugControls";

const meta = {
  title: "Atoms/DebugControls",
  component: DebugControls,
  parameters: { layout: "centered" },
  args: { forceVisible: true },
} satisfies Meta<typeof DebugControls>;

export default meta;
type Story = StoryObj<typeof meta>;

export const DebugState: Story = {
  render: (args) => (
    <div style={{ width: "36rem", "max-width": "90vw" }}>
      <DebugControls {...args} />
      <dl>
        <dt>History overlay signal</dt>
        <dd>{debugHistoryOverlay() ? "on" : "off"}</dd>
        <dt>Light-speed overlay signal</dt>
        <dd>{debugLightSpeedOverlay() ? "on" : "off"}</dd>
      </dl>
      <small>The controls themselves appear only in a debug build.</small>
    </div>
  ),
};
