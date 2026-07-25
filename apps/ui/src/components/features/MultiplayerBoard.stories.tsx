import type { Meta, StoryObj } from "storybook-solidjs-vite";

import { MultiplayerBoard } from "~/components/features/MultiplayerBoard";
import { setStorybookCapabilities } from "~/screens/storybookCapabilities";
import { LAN_PLAYER_CAPABILITIES } from "~/store/capabilitiesStore";
import { addMoveSan, resetGame } from "~/store/gameStore";
import { setDraw } from "~/store/roomStore";
import { setActivePlayerColor, setColorPref, setImLost } from "~/store/settingsStore";

const prepareBoard = () => {
  setStorybookCapabilities({ ...LAN_PLAYER_CAPABILITIES, readOnly: false });
  setColorPref("w");
  setActivePlayerColor("w");
  setImLost(false);
  resetGame();
  addMoveSan("e4");
  addMoveSan("e5");
  addMoveSan("Nf3");
  addMoveSan("Nc6");
  setDraw({ by: "b", status: "pending" });
};

const meta = {
  title: "Features/MultiplayerBoard",
  component: MultiplayerBoard,
  parameters: { layout: "centered" },
  args: {
    showEval: true,
    evalScore: { kind: "cp", value: 85 },
    onDrawBubbleClick: () => undefined,
  },
  render: (args) => {
    prepareBoard();
    return <MultiplayerBoard {...args} />;
  },
} satisfies Meta<typeof MultiplayerBoard>;

export default meta;
type Story = StoryObj<typeof meta>;

export const Desktop: Story = {
  globals: { viewport: { value: "desktop", isRotated: false } },
};

export const Mobile: Story = {
  globals: { viewport: { value: "mobile", isRotated: false } },
};

export const Dynamic: Story = {
  args: { evalScore: { kind: "mate", value: 3 } },
  globals: { viewport: { value: "dynamic", isRotated: false } },
};
