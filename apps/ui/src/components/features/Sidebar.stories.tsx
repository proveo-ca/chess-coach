import type { Meta, StoryObj } from "storybook-solidjs-vite";

import { Sidebar } from "~/components/features/Sidebar";
import { setStorybookCapabilities } from "~/screens/storybookCapabilities";
import { COACH_CAPABILITIES } from "~/store/capabilitiesStore";
import { setShowNewGame, setShowSettings } from "~/store/coachStore";
import { addMoveSan, resetGame } from "~/store/gameStore";
import { setColorPref } from "~/store/settingsStore";

const meta = {
  title: "Features/Sidebar",
  component: Sidebar,
  parameters: { layout: "fullscreen" },
  render: () => {
    setStorybookCapabilities(COACH_CAPABILITIES);
    setColorPref("w");
    setShowNewGame(false);
    setShowSettings(false);
    resetGame();
    addMoveSan("e4");
    addMoveSan("e5");
    return <Sidebar />;
  },
} satisfies Meta<typeof Sidebar>;

export default meta;
type Story = StoryObj<typeof meta>;

/** Switch Desktop / Mobile / Dynamic via the Storybook viewport toolbar. */
export const Default: Story = {
};
