import { onCleanup } from "solid-js";
import type { Meta, StoryObj } from "storybook-solidjs-vite";

import { OpponentCaptures, PlayerCaptures } from "~/components/atoms/CapturedPieces";
import { loadFen } from "~/store/gameStore";
import { setActivePlayerColor } from "~/store/settingsStore";
import { exitTravel } from "~/store/travelStore";

const STARTING_FEN = "rnbqkbnr/pppppppp/8/8/8/8/PPPPPPPP/RNBQKBNR w KQkq - 0 1";
const CAPTURES_FEN = "rnb1kbnr/ppp2ppp/8/8/8/8/PPP2PPP/RNBQKBN1 w Qkq - 0 1";

const meta = {
  title: "Atoms/CapturedPieces",
  component: OpponentCaptures,
  parameters: { layout: "centered" },
} satisfies Meta<typeof OpponentCaptures>;

export default meta;
type Story = StoryObj<typeof meta>;

export const BothPlayers: Story = {
  render: () => {
    exitTravel();
    setActivePlayerColor("w");
    loadFen(CAPTURES_FEN);
    onCleanup(() => loadFen(STARTING_FEN));

    return (
      <div style={{ width: "22rem", display: "grid", gap: "1.5rem" }}>
        <div>
          <small>Opponent captures</small>
          <OpponentCaptures />
        </div>
        <div>
          <small>Player captures</small>
          <PlayerCaptures />
        </div>
      </div>
    );
  },
};
