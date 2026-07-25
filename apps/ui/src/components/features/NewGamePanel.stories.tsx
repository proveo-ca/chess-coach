import type { Meta, StoryObj } from "storybook-solidjs-vite";

import { NewGamePanel } from "~/components/features/NewGamePanel";
import {
  setColorPref,
  setDifficulty,
  setImLost,
  setNerdModeUnlocked,
  setPlayerIdentity,
  setPlayerName,
} from "~/store/settingsStore";

const meta = {
  title: "Features/NewGamePanel",
  component: NewGamePanel,
  parameters: { layout: "centered" },
  render: () => {
    setPlayerName("Forking Fantastic");
    setColorPref("random");
    setDifficulty("advanced");
    setNerdModeUnlocked(true);
    setPlayerIdentity("Dog");
    setImLost(false);
    return <NewGamePanel />;
  },
} satisfies Meta<typeof NewGamePanel>;

export default meta;
type Story = StoryObj<typeof meta>;

export const Desktop: Story = {
  globals: { viewport: { value: "desktop", isRotated: false } },
};

export const Mobile: Story = {
  globals: { viewport: { value: "mobile", isRotated: false } },
};

export const Dynamic: Story = {
  globals: { viewport: { value: "dynamic", isRotated: false } },
};
