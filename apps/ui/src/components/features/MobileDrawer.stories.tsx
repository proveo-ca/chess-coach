import type { Meta, StoryObj } from "storybook-solidjs-vite";

import { MobileDrawer, openMobileDrawer } from "~/components/features/MobileDrawer";
import { IconButton } from "~/components/primitives/IconButton";
import { HamburgerIcon } from "~/components/primitives/icons";
import { setStorybookCapabilities } from "~/screens/storybookCapabilities";
import { COACH_CAPABILITIES } from "~/store/capabilitiesStore";
import { setShowCredits, setShowNewGame } from "~/store/coachStore";
import { addMoveSan, resetGame } from "~/store/gameStore";
import { setColorPref, setImLost, setPlayerIdentity, setPlayerName } from "~/store/settingsStore";

const meta = {
  title: "Features/MobileDrawer",
  component: MobileDrawer,
  parameters: { layout: "fullscreen" },
  render: () => {
    setStorybookCapabilities(COACH_CAPABILITIES);
    setColorPref("w");
    setPlayerName("Knight Owl");
    setPlayerIdentity("Human");
    setImLost(false);
    setShowCredits(false);
    setShowNewGame(false);
    resetGame();
    addMoveSan("e4");
    addMoveSan("e5");
    return (
      <>
        <div style={{ padding: "0.75rem" }}>
          <IconButton type="button" onClick={openMobileDrawer} aria-label="Open menu">
            <HamburgerIcon />
          </IconButton>
        </div>
        <MobileDrawer />
      </>
    );
  },
} satisfies Meta<typeof MobileDrawer>;

export default meta;
type Story = StoryObj<typeof meta>;

export const Mobile: Story = {
  globals: { viewport: { value: "mobile", isRotated: false } },
};

export const Dynamic: Story = {
  globals: { viewport: { value: "dynamic", isRotated: false } },
};
