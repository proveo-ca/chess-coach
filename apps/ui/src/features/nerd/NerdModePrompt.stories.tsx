import type { Meta, StoryObj } from "storybook-solidjs-vite";

import { NerdModePrompt } from "~/features/nerd/NerdModePrompt";
import { setNerdModeUnlocked } from "~/features/nerd/identity";
import { commitPlayerNameCheck } from "~/features/nerd/nameCommit";
import { setPlayerName } from "~/store/settingsStore";

const meta = {
  title: "Features/NerdModePrompt",
  component: NerdModePrompt,
  parameters: { layout: "fullscreen" },
  render: () => {
    setNerdModeUnlocked(false);
    setPlayerName("Kerrigan");
    commitPlayerNameCheck();
    return <NerdModePrompt />;
  },
} satisfies Meta<typeof NerdModePrompt>;

export default meta;
type Story = StoryObj<typeof meta>;

/** Switch Desktop / Mobile / Dynamic via the Storybook viewport toolbar. */
export const Default: Story = {
};

