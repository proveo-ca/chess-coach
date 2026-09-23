import type { Meta, StoryObj } from "storybook-solidjs-vite";

import { MobileDrawer, openMobileDrawer } from "~/components/features/MobileDrawer";
import { IconButton } from "@chess-coach/ui-web/primitives/IconButton";
import { HamburgerIcon } from "@chess-coach/ui-web/primitives/icons";
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

/** Switch Desktop / Mobile / Dynamic via the Storybook viewport toolbar. */
export const Default: Story = {
};

