import type { Meta, StoryObj } from "storybook-solidjs-vite";

import { ChessBoard } from "~/components/features/ChessBoard";
import { setStorybookCapabilities } from "~/screens/storybookCapabilities";
import { LAN_PLAYER_CAPABILITIES } from "~/store/capabilitiesStore";
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
import type { NerdPieceSet } from "~/types/settings";

/**
 * Compare every Nerd skin to Cburnett (Human): black Nerd bottom, white
 * Cburnett top, after 1.e4. Variants are scale/translate wrappers of
 * `public/pieces/nerd/` aimed at Cburnett’s content box.
 */
const prepareMatchup = (nerdSet: NerdPieceSet) => {
  setStorybookCapabilities({ ...LAN_PLAYER_CAPABILITIES, readOnly: false });
  setNerdModeUnlocked(true);
  setNerdPieceSet(nerdSet);
  setPlayerIdentity("Nerd");
  setOpponentIdentity("Human"); // cburnett
  setImLost(false);
  setColorPref("b");
  setActivePlayerColor("b");
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
          "Nerd (bottom) vs Cburnett (top). All variants share the 4-swatch army " +
          "palette (#222 / #555 / team / #fff); only framing differs " +
          "(height / padding / weight).",
      },
    },
  },
} satisfies Meta<typeof ChessBoard>;

export default meta;
type Story = StoryObj<typeof meta>;

export const Current: Story = {
  name: "Current vs Cburnett (= harmonic spaces)",
  render: () => {
    prepareMatchup("nerd");
    return <ChessBoard />;
  },
  globals: { viewport: { value: "desktop", isRotated: false } },
};

export const StandardHeight: Story = {
  name: "Standard height vs Cburnett",
  render: () => {
    prepareMatchup("nerd-height");
    return <ChessBoard />;
  },
  globals: { viewport: { value: "desktop", isRotated: false } },
};

export const HarmonicNegativeSpaces: Story = {
  name: "Harmonic negative spaces vs Cburnett",
  render: () => {
    prepareMatchup("nerd-space");
    return <ChessBoard />;
  },
  globals: { viewport: { value: "desktop", isRotated: false } },
};

export const MatchedVisualWeight: Story = {
  name: "Matched visual weight vs Cburnett",
  render: () => {
    prepareMatchup("nerd-weight");
    return <ChessBoard />;
  },
  globals: { viewport: { value: "desktop", isRotated: false } },
};
