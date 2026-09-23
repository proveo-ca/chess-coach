import type { Meta, StoryObj } from "storybook-solidjs-vite";

import { ChessBoard } from "~/components/features/ChessBoard";
import { Button } from "@chess-coach/ui-web/primitives/Button";
import { setStorybookCapabilities } from "~/screens/storybookCapabilities";
import { LAN_PLAYER_CAPABILITIES } from "~/store/capabilitiesStore";
import { addMoveSan, resetGame } from "~/store/gameStore";
import {
  setActivePlayerColor,
  setColorPref,
  setImLost,
  setOpponentIdentity,
  setPlayerIdentity,
} from "~/store/settingsStore";

const prepareBoard = (moves = ["e4", "e5", "Nf3", "Nc6", "Bc4"]) => {
  setStorybookCapabilities({ ...LAN_PLAYER_CAPABILITIES, readOnly: false });
  setColorPref("w");
  setActivePlayerColor("w");
  setPlayerIdentity("Human");
  setOpponentIdentity("Cat");
  setImLost(false);
  resetGame();
  moves.forEach(addMoveSan);
};

const meta = {
  title: "Features/ChessBoard",
  component: ChessBoard,
  parameters: { layout: "centered" },
  render: (args) => {
    prepareBoard();
    return <ChessBoard {...args} />;
  },
} satisfies Meta<typeof ChessBoard>;

export default meta;
type Story = StoryObj<typeof meta>;

/** Switch Desktop / Mobile / Dynamic via the Storybook viewport toolbar. */
export const Default: Story = {
};

export const WithReviewActions: Story = {
  args: {
    gameOverActions: (
      <>
        <Button primary>Another Game</Button>
        <Button>Replay Review</Button>
      </>
    ),
  },
  render: (args) => {
    prepareBoard(["f3", "e5", "g4", "Qh4#"]);
    return <ChessBoard {...args} />;
  },
};
