import type { Meta, StoryObj } from "storybook-solidjs-vite";

import { ChessBoard } from "~/components/features/ChessBoard";
import { setStorybookCapabilities } from "~/screens/storybookCapabilities";
import { NERD_CAPABILITIES } from "~/store/capabilitiesStore";
import { addMoveSan, resetGame } from "~/store/gameStore";
import {
  setActivePlayerColor,
  setColorPref,
  setImLost,
  setNerdModeUnlocked,
  setNerdPieceSet,
  setOpponentIdentity,
  setPlayerIdentity,
} from "~/store/settingsStore";

/**
 * Reference board: cburnett (white) vs nerd (black) after 1.e4 —
 * compare weights / height / negative space against Lichess cburnett.
 * Uses plain {@link ChessBoard} (not StarChess) so nerd rooks stay static
 * siege `*R.svg` — InlineRook is StarChess / GasDeploy only.
 */
const prepareReferenceBoard = () => {
  setStorybookCapabilities({
    ...NERD_CAPABILITIES,
    readOnly: false,
    // Per-side piece sets: white = cburnett, black = nerd.
    opponentUsesPlayerPieceSet: false,
  });
  setNerdModeUnlocked(true);
  setNerdPieceSet("nerd");
  setImLost(false);
  setPlayerIdentity("Human"); // → cburnett
  setOpponentIdentity("Nerd"); // → nerd
  setColorPref("w");
  setActivePlayerColor("w");
  resetGame();
  addMoveSan("e4");
};

const meta = {
  title: "Screens/Nerd/Piece Sets",
  component: ChessBoard,
  parameters: {
    layout: "centered",
    docs: {
      description: {
        component:
          "Piece-set reference: cburnett on white, nerd on black (`public/pieces/nerd/`). Use for height / weight / negative-space harmony checks.",
      },
    },
  },
} satisfies Meta<typeof ChessBoard>;

export default meta;
type Story = StoryObj<typeof meta>;

export const Current: Story = {
  name: "Current",
  render: () => {
    prepareReferenceBoard();
    return <ChessBoard />;
  },
  globals: { viewport: { value: "desktop", isRotated: false } },
};
