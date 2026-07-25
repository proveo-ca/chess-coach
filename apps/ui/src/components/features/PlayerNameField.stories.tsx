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

export const Desktop: Story = {
  args: { id: "storybook-player-name-desktop" },
  globals: { viewport: { value: "desktop", isRotated: false } },
};

export const Mobile: Story = {
  args: { id: "storybook-player-name-mobile" },
  globals: { viewport: { value: "mobile", isRotated: false } },
};

export const Dynamic: Story = {
  args: { id: "storybook-player-name-dynamic" },
  globals: { viewport: { value: "dynamic", isRotated: false } },
};
