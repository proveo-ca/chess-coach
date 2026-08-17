import type { Meta, StoryObj } from "storybook-solidjs-vite";

import { MenuScreen } from "~/screens/MenuScreen";
import { setShowCredits } from "~/store/coachStore";
import { setDifficulty, setPlayerIdentity, setPlayerName } from "~/store/settingsStore";
import { setIsNerd, setNerdModeUnlocked } from "~/features/nerd/identity";

/** `isNerd` is persisted, so every story states it — else one leaks into the next. */
const seedMenu = (creditsOpen = false, nerd = false) => {
  setPlayerName("Alex");
  setPlayerIdentity("Human");
  setDifficulty("intermediate");
  setNerdModeUnlocked(false);
  setIsNerd(nerd);
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

/** `isNerd` — StarChess shortcut under Play with Selena, in that app's neon. */
export const Nerd: Story = {
  name: "Nerd (Play StarChess)",
  render: () => {
    seedMenu(false, true);
    return <MenuScreen />;
  },
};
