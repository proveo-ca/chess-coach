import type { Meta, StoryObj } from "storybook-solidjs-vite";

import { CountdownRing } from "~/components/primitives/CountdownRing";

const meta = {
  title: "Primitives/CountdownRing",
  component: CountdownRing,
  args: {
    progress: 0.7,
    children: 7,
    "aria-label": "7 seconds remaining",
  },
} satisfies Meta<typeof CountdownRing>;

export default meta;
type Story = StoryObj<typeof meta>;

export const Default: Story = {};

export const Levels: Story = {
  render: () => (
    <div style={{ display: "inline-flex", gap: "16px", "align-items": "center" }}>
      <CountdownRing progress={1} aria-label="10 seconds">
        10
      </CountdownRing>
      <CountdownRing progress={0.5} aria-label="5 seconds">
        5
      </CountdownRing>
      <CountdownRing progress={0.1} aria-label="1 second">
        1
      </CountdownRing>
      <CountdownRing progress={0} aria-label="0 seconds">
        0
      </CountdownRing>
    </div>
  ),
};
