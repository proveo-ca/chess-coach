import type { Meta, StoryObj } from "storybook-solidjs-vite";

import { NerdModePrompt } from "~/starchess/NerdModePrompt";
import { setPlayerName } from "~/store/settingsStore";
import { setNerdModeUnlocked } from "~/starchess/identity";

const meta = {
  title: "Features/NerdModePrompt",
  component: NerdModePrompt,
  parameters: { layout: "fullscreen" },
  render: () => {
    setNerdModeUnlocked(false);
    setPlayerName("Kerrigan");
    return <NerdModePrompt />;
  },
} satisfies Meta<typeof NerdModePrompt>;

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
