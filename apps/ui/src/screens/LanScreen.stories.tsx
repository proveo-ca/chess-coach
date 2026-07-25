import type { Meta, StoryObj } from "storybook-solidjs-vite";

import { LanScreen } from "~/screens/LanScreen";
import {
  applySnapshot,
  setConnectionStatus,
  setMyPeerId,
  setRole,
  setSeat,
} from "~/store/roomStore";
import { setPlayerName } from "~/store/settingsStore";

const STARTING_FEN = "rnbqkbnr/pppppppp/8/8/8/8/PPPPPPPP/RNBQKBNR w KQkq - 0 1";

const renderLobby = () => {
  setPlayerName("Alex");
  return <LanScreen />;
};

const meta = {
  title: "Screens/Lan",
  component: LanScreen,
  parameters: {
    layout: "fullscreen",
    route: "/lan",
  },
} satisfies Meta<typeof LanScreen>;

export default meta;
type Story = StoryObj<typeof meta>;

export const Desktop: Story = {
  globals: { viewport: { value: "desktop", isRotated: false } },
  render: renderLobby,
};

export const Mobile: Story = {
  globals: { viewport: { value: "mobile", isRotated: false } },
  render: renderLobby,
};

export const Dynamic: Story = {
  globals: { viewport: { value: "dynamic", isRotated: false } },
  render: renderLobby,
};

export const GameInProgress: Story = {
  globals: { viewport: { value: "desktop", isRotated: false } },
  render: renderLobby,
  play: () => {
    setRole("host");
    setSeat("player");
    setMyPeerId("local-player");
    setConnectionStatus("connected");
    applySnapshot({
      players: [
        {
          peerId: "local-player",
          identity: { name: "Alex" },
          color: "w",
          ready: true,
        },
        {
          peerId: "remote-player",
          identity: { name: "Morgan" },
          color: "b",
          ready: true,
        },
      ],
      observers: [],
      started: true,
      gameOver: null,
      draw: null,
      timeControl: 300,
      clocks: { w: 287_000, b: 294_000 },
      fen: STARTING_FEN,
    });
  },
};
