import type { Meta, StoryObj } from "storybook-solidjs-vite";

import { PlayerNameField } from "~/components/features/PlayerNameField";
import { setPlayerName } from "~/store/settingsStore";

const meta = {
  title: "Features/PlayerNameField",
  component: PlayerNameField,
  parameters: { layout: "centered" },
  render: (args) => {
    setPlayerName("Knight Owl");
    return <PlayerNameField {...args} />;
  },
} satisfies Meta<typeof PlayerNameField>;

export default meta;
type Story = StoryObj<typeof meta>;

/** Switch Desktop / Mobile / Dynamic via the Storybook viewport toolbar. */
export const Default: Story = {
  args: { id: "storybook-player-name" },
};
