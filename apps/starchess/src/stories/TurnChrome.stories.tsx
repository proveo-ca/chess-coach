import type { Meta, StoryObj } from "storybook-solidjs-vite";

import { GasDeployScenarioScreen } from "~/demos/GasDeployScenarioScreen";
import { VermeerLiveScreen } from "~/demos/VermeerLiveScreen";
import { ResourceBar } from "~/presentation/hud/ResourceBar";
import { TurnBar } from "~/presentation/hud/TurnBar";
import {
  createMatchStore,
  MatchStoreProvider,
} from "~/app/MatchStoreContext";
import { createMatchStateFromScfen } from "~/app/matchReducer";
import { GAS_DEPLOY_FIXTURES } from "~/stories/fixtures/scenarios";

/**
 * Turn chrome + full-army GasDeploy. Stories mount fixtures / chrome only.
 */
const meta = {
  title: "StarChess/Turn Chrome",
  parameters: {
    layout: "centered",
    docs: {
      description: {
        component:
          "Stacked above the board (replaces captured pieces): ResourceBar (minerals, vespene, deploy), then TurnBar (queue chips + End + 10s gauge) underneath so chips grow height without shifting the board horizontally. GasDeploy: drag vespene onto a unit for specials. TurnBarSidebar is an experimental vertical rail variation.",
      },
    },
  },
} satisfies Meta;

export default meta;
type Story = StoryObj;

export const ResourceAndTurn: Story = {
  name: "ResourceBar + TurnBar",
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
        <div
          style={{
            width: "420px",
            display: "flex",
            "flex-direction": "column",
            "align-items": "stretch",
            gap: "6px",
          }}
        >
          <ResourceBar />
          <TurnBar autoStart={false} resolveOnEnd={false} onEnd={() => undefined} />
        </div>
      </MatchStoreProvider>
    );
  },
};

export const TurnSidebarRail: Story = {
  name: "TurnBarSidebar (vertical)",
  parameters: {
    layout: "fullscreen",
    docs: {
      description: {
        story:
          "Experimental vertical turn chrome in the live side rail (same as `/starchess/single`). Horizontal TurnBar stays unused.",
      },
    },
  },
  render: () => <VermeerLiveScreen turnChrome="sidebar" />,
};

export const GasDeploy: Story = {
  parameters: {
    layout: "fullscreen",
    docs: {
      description: {
        story:
          "Full army + GasDeploy: pawn / knight / bishop / rook / queen / king specials. Controls → gas (1–3). End to resolve queued actions.",
      },
    },
  },
  args: {
    gas: 3,
  },
  argTypes: {
    gas: {
      control: { type: "inline-radio" },
      options: [1, 2, 3],
      description: "Remaining vespene canisters (turn 21 capacity = 3)",
    },
  },
  render: (args) => (
    <GasDeployScenarioScreen
      scfen={GAS_DEPLOY_FIXTURES.fullArmy.scfen}
      stored={GAS_DEPLOY_FIXTURES.fullArmy.stored}
      gas={Number((args as { gas?: number }).gas) || 3}
    />
  ),
};
