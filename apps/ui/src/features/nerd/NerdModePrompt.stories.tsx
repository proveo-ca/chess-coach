import type { Meta, StoryObj } from "storybook-solidjs-vite";

import { NerdModePrompt } from "~/features/nerd/NerdModePrompt";
import { setNerdModeUnlocked } from "~/features/nerd/identity";
import { setPlayerName } from "~/store/settingsStore";

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
