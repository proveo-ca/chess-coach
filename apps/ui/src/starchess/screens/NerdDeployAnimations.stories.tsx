import type { Meta, StoryObj } from "storybook-solidjs-vite";

import { DeployBoardDemo } from "~/starchess/animations/DeployBoardDemo";

/**
 * Command Center deploy VFX: putting a unit on the board triggers auto-deploy
 * on StarChessBoard (`DeployAnimation`). Occupancy updates immediately;
 * the board piece is hidden while the drop plays ({@link DEPLOY_MS}).
 */
const meta = {
  title: "Screens/Nerd/StarChess/Deploy Animations",
  parameters: {
    layout: "centered",
    docs: {
      description: {
        component:
          "Humanoid (marine/goliath): 200ms drop + 300ms crouch. Mechanoid (vulture/tank/battlecruiser): 200ms drop + 300ms thrust brake. Total 500ms; board occupancy appears first, piece hidden until the cue ends.",
      },
    },
  },
} satisfies Meta;

export default meta;
type Story = StoryObj;

export const Marine: Story = {
  name: "Marine",
  render: () => <DeployBoardDemo piece="p" />,
};

export const Goliath: Story = {
  name: "Goliath",
  render: () => <DeployBoardDemo piece="b" />,
};

export const Vulture: Story = {
  name: "Vulture",
  render: () => <DeployBoardDemo piece="n" />,
};

export const Tank: Story = {
  name: "Tank",
  render: () => <DeployBoardDemo piece="r" />,
};

export const Battlecruiser: Story = {
  name: "Battlecruiser",
  render: () => <DeployBoardDemo piece="q" />,
};
