import type { Meta, StoryObj } from "storybook-solidjs-vite";

import { MenuScreen } from "~/screens/MenuScreen";
import { setShowCredits } from "~/store/coachStore";
import { setDifficulty, setPlayerIdentity, setPlayerName } from "~/store/settingsStore";
import { setNerdModeUnlocked } from "~/features/nerd/identity";

const seedMenu = (creditsOpen = false) => {
  setPlayerName("Alex");
  setPlayerIdentity("Human");
  setDifficulty("intermediate");
  setNerdModeUnlocked(false);
  setShowCredits(creditsOpen);
};

const meta = {
  title: "Screens/Menu",
  component: MenuScreen,
  parameters: {
    layout: "fullscreen",
    route: "/",
  },
} satisfies Meta<typeof MenuScreen>;

export default meta;
type Story = StoryObj<typeof meta>;

/** Switch Desktop / Mobile / Dynamic via the Storybook viewport toolbar. */
export const Default: Story = {
  render: () => {
    seedMenu();
    return <MenuScreen />;
  },
};

export const CreditsOpen: Story = {
  render: () => {
    seedMenu(true);
    return <MenuScreen />;
  },
};
