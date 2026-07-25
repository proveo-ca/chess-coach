import type { Meta, StoryObj } from "storybook-solidjs-vite";

import { CoachPanel } from "~/components/features/CoachPanel";
import { setAdvice, setHoverBlunder, setPendingTravel } from "~/store/coachStore";
import { setFooterFloat } from "~/store/viewportLayoutStore";

const prepareAdvice = () => {
  setFooterFloat(false);
  setHoverBlunder(false);
  setPendingTravel(null);
  setAdvice("Control the center with e4, then develop Nf3 before moving the queen.");
};

const meta = {
  title: "Features/CoachPanel",
  component: CoachPanel,
  parameters: { layout: "centered" },
  render: () => {
    prepareAdvice();
    return <CoachPanel />;
  },
} satisfies Meta<typeof CoachPanel>;

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

export const BlunderExplanation: Story = {
  render: () => {
    setFooterFloat(false);
    setAdvice("After g4, Qh4# ends the game immediately.");
    setPendingTravel(null);
    setHoverBlunder(true, "rnb1kbnr/pppp1ppp/8/4p3/6Pq/5P2/PPPPP2P/RNBQKBNR w KQkq - 1 3", "g4");
    return <CoachPanel />;
  },
};
