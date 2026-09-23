import type { Meta, StoryObj } from "storybook-solidjs-vite";

import { BoardControls } from "~/components/features/BoardControls";
import { CoachEmotionIcon } from "@chess-coach/ui-web/primitives/CoachEmotionIcon";
import { setStorybookCapabilities } from "~/screens/storybookCapabilities";
import { COACH_CAPABILITIES } from "~/store/capabilitiesStore";
import { addMoveSan, resetGame } from "~/store/gameStore";
import { setColorPref } from "~/store/settingsStore";

const meta = {
  title: "Features/BoardControls",
  component: BoardControls,
  parameters: { layout: "fullscreen" },
  args: {
    center: <CoachEmotionIcon emotion="happy" size={48} title="Coach Selena" />,
    centerOverflow: true,
  },
  render: (args) => {
    setStorybookCapabilities(COACH_CAPABILITIES);
    setColorPref("w");
    resetGame();
    addMoveSan("e4");
    addMoveSan("e5");
    return (
      <div style={{ padding: "1rem 0" }}>
        <BoardControls {...args} />
      </div>
    );
  },
} satisfies Meta<typeof BoardControls>;

export default meta;
type Story = StoryObj<typeof meta>;

/** Switch Desktop / Mobile / Dynamic via the Storybook viewport toolbar. */
export const Default: Story = {
};

