import { onCleanup } from "solid-js";
import type { Meta, StoryObj } from "storybook-solidjs-vite";

import { OpponentCaptures, PlayerCaptures } from "~/components/atoms/CapturedPieces";
import { Screen } from "~/components/primitives/Screen";
import { loadFen } from "~/store/gameStore";
import { setActivePlayerColor } from "~/store/settingsStore";
import { exitTravel } from "~/store/travelStore";

const STARTING_FEN = "rnbqkbnr/pppppppp/8/8/8/8/PPPPPPPP/RNBQKBNR w KQkq - 0 1";
const CAPTURES_FEN = "rnbqkbnr/ppp2ppp/8/8/8/8/PPP2PPP/RNBQKBN1 w Qkq - 0 1";

const meta = {
  title: "Atoms/CapturedPieces",
  component: OpponentCaptures,
  parameters: { layout: "fullscreen" },
} satisfies Meta<typeof OpponentCaptures>;

export default meta;
type Story = StoryObj<typeof meta>;

const boardPlaceholder = {
  width: "var(--board-size)",
  height: "var(--board-size)",
  "background-color": "var(--board-dark, #b58863)",
  "background-image":
    "linear-gradient(45deg, var(--board-light, #f0d9b5) 25%, transparent 25%), linear-gradient(-45deg, var(--board-light, #f0d9b5) 25%, transparent 25%), linear-gradient(45deg, transparent 75%, var(--board-light, #f0d9b5) 75%), linear-gradient(-45deg, transparent 75%, var(--board-light, #f0d9b5) 75%)",
  "background-size": "calc(var(--board-size) / 4) calc(var(--board-size) / 4)",
  "background-position": "0 0, 0 calc(var(--board-size) / 8), calc(var(--board-size) / 8) calc(var(--board-size) / -8), calc(var(--board-size) / -8) 0",
} as const;

/**
 * Mounted like Coach / Analysis / Review / LAN: top Header + bottom Footer
 * around a board-sized column so top-left / bottom-right alignment is visible.
 */
export const OnScreen: Story = {
  name: "On Screen (top-left · bottom-right)",
  render: () => {
    exitTravel();
    setActivePlayerColor("w");
    loadFen(CAPTURES_FEN);
    onCleanup(() => loadFen(STARTING_FEN));

    return (
      <Screen>
        <Screen.Header>
          <OpponentCaptures />
        </Screen.Header>
        <Screen.BoardArea>
          <Screen.BoardColumn>
            <div style={boardPlaceholder} aria-hidden="true" />
          </Screen.BoardColumn>
          <aside style={{ width: "var(--sidebar-width)", "min-height": "4rem" }} />
        </Screen.BoardArea>
        <Screen.Footer>
          <PlayerCaptures />
        </Screen.Footer>
      </Screen>
    );
  },
};

export const BothPlayers: Story = {
  parameters: { layout: "centered" },
  render: () => {
    exitTravel();
    setActivePlayerColor("w");
    loadFen(CAPTURES_FEN);
    onCleanup(() => loadFen(STARTING_FEN));

    return (
      <div style={{ width: "22rem", display: "grid", gap: "1.5rem" }}>
        <div>
          <small>Opponent captures (top-left)</small>
          <OpponentCaptures />
        </div>
        <div>
          <small>Player captures (bottom-right)</small>
          <PlayerCaptures />
        </div>
      </div>
    );
  },
};
