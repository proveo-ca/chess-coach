import type { Meta, StoryObj } from "storybook-solidjs-vite";

import { GasDeployScenarioScreen } from "~/demos/GasDeployScenarioScreen";
import { GAS_DEPLOY_FIXTURES } from "~/stories/fixtures/scenarios";

/**
 * Stories mount SCFEN fixtures on MatchStore + StarChessScreen only.
 * GasDeploy specials arm/queue in the live screen — no Storybook arm logic.
 */
const meta = {
  title: "StarChess/Special Moves",
  parameters: {
    layout: "fullscreen",
    docs: {
      description: {
        component:
          "Drag vespene canisters from GasDeploy onto a unit. Marine: start-rank doubles are free (no gas); otherwise 1 gas. Command Center: DeployModal → deploy adjacent. Vulture: spider mine. Siege Tank: toggle packed ↔ unpacked. Goliath: 2-gas Charon Booster Missiles, then click the revealed queen. Battlecruiser: 2-gas Tactical Jump, then click a visible empty square. End to resolve.",
      },
    },
  },
} satisfies Meta;

export default meta;
type Story = StoryObj;

export const Marine: Story = {
  name: "Marine",
  parameters: {
    docs: {
      description: {
        story:
          "d2 can classical-double for free (canister unused). Gas on a pawn queues a 1-square StarChess step · End to resolve.",
      },
    },
  },
  render: () => (
    <GasDeployScenarioScreen
      scfen={GAS_DEPLOY_FIXTURES.marine.scfen}
      stored={GAS_DEPLOY_FIXTURES.marine.stored}
    />
  ),
};

export const CommandCenter: Story = {
  name: "Command Center",
  parameters: {
    docs: {
      description: {
        story:
          "1. Drag gas onto the command center on d4 → DeployModal. 2. Pick a unit. 3. Tap an adjacent empty square — queued spawn · End to drop.",
      },
    },
  },
  render: () => (
    <GasDeployScenarioScreen
      scfen={GAS_DEPLOY_FIXTURES.commandCenter.scfen}
      stored={GAS_DEPLOY_FIXTURES.commandCenter.stored}
    />
  ),
};

export const Vulture: Story = {
  name: "Vulture",
  parameters: {
    docs: {
      description: {
        story:
          "Drag gas onto the knight to queue a Spider Mine on its square · End to drop. Stack order: gas then move, or move then gas.",
      },
    },
  },
  render: () => (
    <GasDeployScenarioScreen
      scfen={GAS_DEPLOY_FIXTURES.vulture.scfen}
      stored={GAS_DEPLOY_FIXTURES.vulture.stored}
    />
  ),
};

export const Goliath: Story = {
  name: "Goliath",
  parameters: {
    docs: {
      description: {
        story:
          "Charon Booster Missiles costs 2 vespene: drag onto the Goliath to arm targeting, click the highlighted enemy queen, then End to fire.",
      },
    },
  },
  render: () => (
    <GasDeployScenarioScreen
      scfen={GAS_DEPLOY_FIXTURES.goliath.scfen}
      stored={GAS_DEPLOY_FIXTURES.goliath.stored}
    />
  ),
};

export const Battlecruiser: Story = {
  name: "Battlecruiser",
  parameters: {
    docs: {
      description: {
        story:
          "Tactical Jump costs 2 vespene: drag onto the Battlecruiser to arm targeting, click a highlighted visible empty square, then End to resolve.",
      },
    },
  },
  render: () => (
    <GasDeployScenarioScreen
      scfen={GAS_DEPLOY_FIXTURES.battlecruiser.scfen}
      stored={GAS_DEPLOY_FIXTURES.battlecruiser.stored}
    />
  ),
};

export const SiegeTank: Story = {
  name: "Siege Tank",
  parameters: {
    docs: {
      description: {
        story:
          "Two Siege Tanks: d4 starts packed (tank), f4 starts sieged (S:f4). Drag gas onto either to queue a toggle · End to pack/unpack.",
      },
    },
  },
  render: () => (
    <GasDeployScenarioScreen
      scfen={GAS_DEPLOY_FIXTURES.siegeTank.scfen}
      stored={GAS_DEPLOY_FIXTURES.siegeTank.stored}
    />
  ),
};
