import { onCleanup } from "solid-js";
import type { Meta, StoryObj } from "storybook-solidjs-vite";

import { MatrixOverlay } from "@chess-coach/ui-web/atoms/MatrixOverlay";

const meta = {
  title: "Atoms/MatrixOverlay",
  component: MatrixOverlay,
  parameters: { layout: "fullscreen" },
} satisfies Meta<typeof MatrixOverlay>;

export default meta;
type Story = StoryObj<typeof meta>;

export const BinaryRain: Story = {
  render: () => {
    const originalRandom = Math.random;
    let seed = 17;
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
      <div style={{ height: "100vh", background: "#050807", color: "#d8ffe7", padding: "2rem" }}>
        <MatrixOverlay density={32} maxDrops={32} color="#35ff7a" />
        <h2 style={{ position: "relative", "z-index": 1 }}>Matrix overlay</h2>
      </div>
    );
  },
};
