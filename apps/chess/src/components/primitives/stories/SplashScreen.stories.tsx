import type { Meta, StoryObj } from "storybook-solidjs-vite";

import { SplashScreen } from "@chess-coach/ui-web/primitives/SplashScreen";

const avatar = (
  <div
    aria-label="Coach avatar placeholder"
    style={{
      display: "grid",
      "place-items": "center",
      width: "96px",
      height: "96px",
      "border-radius": "50%",
      background: "var(--primary-color, #7561ff)",
      color: "white",
      "font-size": "40px",
    }}
  >
    ♞
  </div>
);

const meta = {
  title: "Primitives/SplashScreen",
  component: SplashScreen,
  args: {
    title: "Chess Coach",
    avatar,
    children: <p>Choose how you would like to play.</p>,
  },
} satisfies Meta<typeof SplashScreen>;

export default meta;
type Story = StoryObj<typeof meta>;

export const Default: Story = {};

export const WideLobby: Story = {
  args: {
    title: "Local multiplayer",
    wide: true,
    children: (
      <div style={{ display: "grid", gap: "12px", width: "100%" }}>
        <div>1. Share the invite with your opponent</div>
        <div>2. Wait for both players to connect</div>
        <div>3. Start the match</div>
      </div>
    ),
  },
};

export const FullscreenLoading: Story = {
  args: {
    title: "Preparing your coach…",
    fullscreen: true,
    style: { background: "rgba(10, 12, 18, 0.94)" },
    children: <p>Loading the chess engine</p>,
  },
};
