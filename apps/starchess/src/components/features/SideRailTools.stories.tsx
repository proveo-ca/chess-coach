import { onMount } from "solid-js";
import type { Meta, StoryObj } from "storybook-solidjs-vite";

import { createMatchStateFromScfen } from "~/app/matchReducer";
import { createMatchStore, MatchStoreProvider } from "~/app/MatchStoreContext";
import { SideRailTools } from "~/components/features/SideRailTools";
import {
  ANALYSIS_CAPABILITIES,
  LIVE_CAPABILITIES,
  setCapabilities,
} from "~/store/capabilitiesStore";
import { STAR_STARTING_SCFEN } from "~/stories/fixtures/seeds";

function SideRailToolsHarness(props: { flipBoard: boolean }) {
  const store = createMatchStore({
    initial: createMatchStateFromScfen(STAR_STARTING_SCFEN, 1),
  });
  onMount(() => setCapabilities(props.flipBoard ? ANALYSIS_CAPABILITIES : LIVE_CAPABILITIES));
  return (
    <MatchStoreProvider store={store}>
      <SideRailTools />
    </MatchStoreProvider>
  );
}

const meta = {
  title: "Features/Side Rail Tools",
  component: SideRailTools,
  parameters: { layout: "centered" },
} satisfies Meta<typeof SideRailTools>;

export default meta;
type Story = StoryObj<typeof meta>;

export const Live: Story = {
  render: () => <SideRailToolsHarness flipBoard={false} />,
  globals: { viewport: { value: "desktop", isRotated: false } },
};

export const WithFlip: Story = {
  render: () => <SideRailToolsHarness flipBoard={true} />,
  globals: { viewport: { value: "desktop", isRotated: false } },
};
