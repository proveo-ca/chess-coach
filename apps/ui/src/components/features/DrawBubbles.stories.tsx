import type { Meta, StoryObj } from "storybook-solidjs-vite";

import { DrawBubbles } from "~/components/features/DrawBubbles";
import { resetGame } from "~/store/gameStore";
import { setDraw } from "~/store/roomStore";
import { setActivePlayerColor, setColorPref } from "~/store/settingsStore";

const BoardSurface = () => (
  <div
    style={{
      position: "relative",
      width: "var(--board-size)",
      height: "var(--board-size)",
      background: "repeating-conic-gradient(#e8edf3 0 25%, #66809a 0 50%) 0 / 25% 25%",
    }}
  >
    <DrawBubbles onOfferClick={() => undefined} />
  </div>
);

const prepare = (status: "pending" | "declined" | "agreed") => {
  setColorPref("w");
  setActivePlayerColor("w");
  resetGame();
  setDraw({ by: "b", status });
};

const meta = {
  title: "Features/DrawBubbles",
  component: DrawBubbles,
  parameters: { layout: "centered" },
  render: () => {
    prepare("pending");
    return <BoardSurface />;
  },
} satisfies Meta<typeof DrawBubbles>;

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

export const Declined: Story = {
  render: () => {
    prepare("declined");
    return <BoardSurface />;
  },
};

export const Agreed: Story = {
  render: () => {
    prepare("agreed");
    return <BoardSurface />;
  },
};
