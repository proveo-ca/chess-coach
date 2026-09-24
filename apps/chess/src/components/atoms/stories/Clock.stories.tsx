import { onCleanup } from "solid-js";
import type { Meta, StoryObj } from "storybook-solidjs-vite";

import { Clock } from "~/components/atoms/Clock";
import { reset, setClocks, setStarted, setTimeControl } from "~/store/roomStore";

const meta = {
  title: "Atoms/Clock",
  component: Clock,
  args: { color: "w" },
  parameters: { layout: "centered" },
} satisfies Meta<typeof Clock>;

export default meta;
type Story = StoryObj<typeof meta>;

export const BothPlayers: Story = {
  render: () => {
    setTimeControl(300);
    setClocks({ w: 185_000, b: 242_000 });
    setStarted(false);
    onCleanup(reset);

    return (
      <div style={{ display: "flex", gap: "1rem" }}>
        <Clock color="w" />
        <Clock color="b" />
      </div>
    );
  },
};
