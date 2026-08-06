import type { Meta, StoryObj } from "storybook-solidjs-vite";
import { onMount } from "solid-js";

import { createMatchStore, MatchStoreProvider } from "~/app/MatchStoreContext";
import { createMatchStateFromScfen } from "~/app/matchReducer";
import { Sidebar } from "~/components/features/Sidebar";
import {
  ANALYSIS_CAPABILITIES,
  LIVE_CAPABILITIES,
  setCapabilities,
} from "~/store/capabilitiesStore";
import { NERD_STARTING_SCFEN } from "~/stories/fixtures/seeds";

function SidebarHarness(props: { flipBoard: boolean }) {
  const store = createMatchStore({
    initial: createMatchStateFromScfen(NERD_STARTING_SCFEN, 1),
  });
  onMount(() =>
    setCapabilities(
      props.flipBoard ? ANALYSIS_CAPABILITIES : LIVE_CAPABILITIES,
    ),
  );
  return (
    <MatchStoreProvider store={store}>
      <Sidebar />
    </MatchStoreProvider>
  );
}

const meta = {
  title: "Features/Sidebar",
  component: Sidebar,
  parameters: { layout: "centered" },
} satisfies Meta<typeof Sidebar>;

export default meta;
type Story = StoryObj<typeof meta>;

export const Live: Story = {
  render: () => <SidebarHarness flipBoard={false} />,
  globals: { viewport: { value: "desktop", isRotated: false } },
};

export const WithFlip: Story = {
  render: () => <SidebarHarness flipBoard={true} />,
  globals: { viewport: { value: "desktop", isRotated: false } },
};
