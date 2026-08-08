import type { Meta, StoryObj } from "storybook-solidjs-vite";

import { Settings, SettingsPanel } from "~/components/features/Settings";
import { setImLost, setPlayerIdentity, setPlayerName } from "~/store/settingsStore";
import { setNerdModeUnlocked } from "~/features/nerd/identity";

const prepareSettings = () => {
  setPlayerName("Castle Crusher");
  setNerdModeUnlocked(true);
  setPlayerIdentity("Cat");
  setImLost(false);
};

const meta = {
  title: "Features/Settings",
  component: Settings,
  parameters: { layout: "fullscreen" },
  args: {
    open: true,
    onClose: () => undefined,
  },
  render: (args) => {
    prepareSettings();
    return <Settings {...args} />;
  },
} satisfies Meta<typeof Settings>;

export default meta;
type Story = StoryObj<typeof meta>;

/** Switch Desktop / Mobile / Dynamic via the Storybook viewport toolbar. */
export const Default: Story = {
};

export const InlinePanel: Story = {
  render: () => {
    prepareSettings();
    return (
      <div style={{ width: "min(28rem, calc(100vw - 2rem))", margin: "2rem auto" }}>
        <SettingsPanel />
      </div>
    );
  },
};
