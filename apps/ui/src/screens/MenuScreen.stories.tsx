import type { Meta, StoryObj } from "storybook-solidjs-vite";

import { MenuScreen } from "~/screens/MenuScreen";
import { setShowCredits } from "~/store/coachStore";
import {
  setDifficulty,
  setNerdModeUnlocked,
  setPlayerIdentity,
  setPlayerName,
} from "~/store/settingsStore";

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

export const Desktop: Story = {
  globals: { viewport: { value: "desktop", isRotated: false } },
  render: () => {
    seedMenu();
    return <MenuScreen />;
  },
};

export const Mobile: Story = {
  globals: { viewport: { value: "mobile", isRotated: false } },
  render: () => {
    seedMenu();
    return <MenuScreen />;
  },
};

export const Dynamic: Story = {
  globals: { viewport: { value: "dynamic", isRotated: false } },
  render: () => {
    seedMenu();
    return <MenuScreen />;
  },
};

export const CreditsOpen: Story = {
  globals: { viewport: { value: "desktop", isRotated: false } },
  render: () => {
    seedMenu(true);
    return <MenuScreen />;
  },
};
