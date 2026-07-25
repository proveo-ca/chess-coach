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

export const Desktop: Story = {
  globals: { viewport: { value: "desktop", isRotated: false } },
};

export const Mobile: Story = {
  globals: { viewport: { value: "mobile", isRotated: false } },
};

export const Dynamic: Story = {
  globals: { viewport: { value: "dynamic", isRotated: false } },
};

export const TacticalPosition: Story = {
  globals: { viewport: { value: "desktop", isRotated: false } },
  render: () => {
    loadFen(TACTICAL_FEN);
    return <AnalysisScreen />;
  },
};
