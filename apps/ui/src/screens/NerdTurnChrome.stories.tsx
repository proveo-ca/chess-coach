import type { Meta, StoryObj } from "storybook-solidjs-vite";

import { resetBroodWarEconomy, startPlanningTimer } from "~/broodwar/broodWarStore";
import { ResourceBar } from "~/components/primitives/ResourceBar";
import { TurnBar } from "~/components/primitives/TurnBar";

const meta = {
  title: "Screens/Nerd/Brood War/Turn Chrome",
  parameters: {
    layout: "centered",
    docs: {
      description: {
        component:
          "ResourceBar (top) + TurnBar (bottom) replace captured pieces in Brood War. TurnBar: End + 10s circular gauge.",
      },
    },
  },
} satisfies Meta;

export default meta;
type Story = StoryObj;

export const ResourceAndTurn: Story = {
  name: "ResourceBar + TurnBar",
  render: () => {
    resetBroodWarEconomy({
      turn: 1,
      white: { stored: 12, deployed: 4 },
      startTimer: false,
    });
    startPlanningTimer();
    return (
      <div style={{ width: "360px", display: "flex", "flex-direction": "column", gap: "12px" }}>
        <ResourceBar />
        <TurnBar autoStart={false} onEnd={() => undefined} />
      </div>
    );
  },
};
