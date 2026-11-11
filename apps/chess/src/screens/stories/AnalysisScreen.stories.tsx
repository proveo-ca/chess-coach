import type { Meta, StoryObj } from "storybook-solidjs-vite";

import { AnalysisScreen } from "~/screens/AnalysisScreen";
import { loadFen } from "~/store/gameStore";

const TACTICAL_FEN = "r1bq1rk1/ppp2ppp/2np1n2/8/2B1P3/2N2N2/PPP2PPP/R1BQ1RK1 w - - 0 9";

const meta = {
  title: "Screens/Analysis",
  component: AnalysisScreen,
  parameters: {
    layout: "fullscreen",
    route: "/analysis",
    controls: { disable: true },
  },
} satisfies Meta<typeof AnalysisScreen>;

export default meta;
type Story = StoryObj<typeof meta>;

/** Switch Desktop / Mobile / Dynamic via the Storybook viewport toolbar. */
export const Default: Story = {};

export const TacticalPosition: Story = {
  render: () => {
    loadFen(TACTICAL_FEN);
    return <AnalysisScreen />;
  },
};
