import { onCleanup } from "solid-js";
import type { Meta, StoryObj } from "storybook-solidjs-vite";

import { LightSpeedOverlay } from "@chess-coach/ui-web/atoms/LightSpeedOverlay";

const meta = {
  title: "Atoms/LightSpeedOverlay",
  component: LightSpeedOverlay,
  args: {
    active: true,
    beamCount: 24,
    baseDuration: 1.2,
    maxDelay: 0.35,
    durationVariance: 0.1,
  },
  parameters: { layout: "fullscreen" },
} satisfies Meta<typeof LightSpeedOverlay>;

export default meta;
type Story = StoryObj<typeof meta>;

export const Active: Story = {
  render: (args) => {
    const originalRandom = Math.random;
    let seed = 29;
    Math.random = () => {
      seed = (seed * 48_271) % 2_147_483_647;
      return seed / 2_147_483_647;
    };
    queueMicrotask(() => {
      Math.random = originalRandom;
    });
    onCleanup(() => {
      Math.random = originalRandom;
    });

    return (
      <div style={{ height: "100vh", background: "#050811" }}>
        <LightSpeedOverlay {...args} />
      </div>
    );
  },
};

export const Inactive: Story = {
  args: { active: false },
};
