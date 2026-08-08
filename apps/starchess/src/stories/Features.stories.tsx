import type { Meta, StoryObj } from "storybook-solidjs-vite";

import { GasDeployScenarioScreen } from "~/demos/GasDeployScenarioScreen";
import { GasDeploy } from "~/presentation/features/GasDeploy";
import {
  createMatchStore,
  MatchStoreProvider,
} from "~/app/MatchStoreContext";
import { createMatchStateFromScfen } from "~/app/matchReducer";
import { GAS_DEPLOY_FIXTURES } from "~/stories/fixtures/scenarios";

const meta = {
  title: "Features/GasDeploy",
  parameters: {
    layout: "centered",
    docs: {
      description: {
        component:
          "Footer vespene rack — drag a canister onto a friendly unit to arm its special.",
      },
    },
  },
} satisfies Meta;

export default meta;
type Story = StoryObj;

export const RackOnly: Story = {
  name: "Rack",
  render: () => {
    const store = createMatchStore({
      initial: createMatchStateFromScfen(
        GAS_DEPLOY_FIXTURES.fullArmy.scfen,
        GAS_DEPLOY_FIXTURES.fullArmy.stored,
      ),
      autoArmTimer: false,
    });
    return (
      <MatchStoreProvider store={store}>
        <div style={{ padding: "2rem", width: "24rem" }}>
          <GasDeploy />
        </div>
      </MatchStoreProvider>
    );
  },
};

export const OnBoard: Story = {
  name: "On board (Command Center)",
  parameters: { layout: "fullscreen" },
  render: () => (
    <GasDeployScenarioScreen
      scfen={GAS_DEPLOY_FIXTURES.commandCenter.scfen}
      stored={GAS_DEPLOY_FIXTURES.commandCenter.stored}
    />
  ),
};
