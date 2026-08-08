import type { Meta, StoryObj } from "storybook-solidjs-vite";

import { MobileBanner } from "~/components/atoms/MobileBanner";
import { Button } from "~/components/primitives/Button";
import { CountdownRing } from "~/components/primitives/CountdownRing";

/**
 * Dynamic live strip — three slots (gas is bottom-right outside the banner):
 *   Back (4rem) · resources (1fr) · turn (1fr)
 * Switch viewport to **Dynamic** (560×420).
 */
const meta = {
  title: "Atoms/MobileBanner",
  component: MobileBanner,
  parameters: {
    layout: "fullscreen",
  },
} satisfies Meta<typeof MobileBanner>;

export default meta;
type Story = StoryObj<typeof meta>;

export const Default: Story = {
  args: {
    onBack: () => undefined,
  },
  render: (args) => (
    <MobileBanner
      {...args}
      resources={
        <span style={{ opacity: 0.8, "font-size": "0.8rem", "white-space": "nowrap" }}>
          ⬡ 3&nbsp;&nbsp;☁ 1&nbsp;&nbsp;☰ 8/10
        </span>
      }
      turn={
        <span
          style={{
            display: "inline-flex",
            "align-items": "center",
            gap: "0.35rem",
          }}
        >
          <CountdownRing progress={0.6} aria-label="6 seconds remaining">
            6
          </CountdownRing>
          <Button data-testid="turn-end">End Turn</Button>
        </span>
      }
    />
  ),
};
