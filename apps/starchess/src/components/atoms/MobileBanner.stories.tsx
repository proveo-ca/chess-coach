import type { Meta, StoryObj } from "storybook-solidjs-vite";

import { MobileBanner } from "~/components/atoms/MobileBanner";
import { Button } from "~/components/primitives/Button";
import { CountdownRing } from "~/components/primitives/CountdownRing";

/**
 * Dynamic strip — three slots (floating docks are bottom-right, outside it):
 *   Back (4rem) · resources (1fr) · turn (auto)
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

/** Live `/single` shape: fixed-width resources, slack left of End Turn. */
export const Default: Story = {
  args: {
    onBack: () => undefined,
    fixedResources: true,
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

/** Review-list variant: link Back (`href`) + filters, no turn slot. */
export const LinkBackWithFilters: Story = {
  args: {
    href: "/",
  },
  render: (args) => (
    <MobileBanner
      {...args}
      resources={
        <span style={{ opacity: 0.8, "font-size": "0.8rem", "white-space": "nowrap" }}>
          ▢ ▢&nbsp;&nbsp;‹ Aug 11, 2026 (1 / 3) ›
        </span>
      }
    />
  ),
};
