import type { Meta, StoryObj } from "storybook-solidjs-vite";

import { StarChessMobileBanner as MobileBanner } from "@chess-coach/ui-web/atoms/StarChessMobileBanner";
import { StarChessMobileSubBanner as MobileSubBanner } from "@chess-coach/ui-web/atoms/StarChessMobileSubBanner";
import { Button } from "@chess-coach/ui-web/primitives/Button";
import { CountdownRing } from "@chess-coach/ui-web/primitives/CountdownRing";

const meta = {
  title: "Atoms/MobileBanner",
  component: MobileBanner,
  parameters: {
    layout: "fullscreen",
    viewport: { defaultViewport: "mobile" },
  },
} satisfies Meta<typeof MobileBanner>;

export default meta;
type Story = StoryObj<typeof meta>;

export const Default: Story = {
  args: { onBack: () => undefined, title: "You vs Adjutant" },
};

export const ResultTitle: Story = {
  args: { onBack: () => undefined, title: "Win (Blue)", titleColor: "win" },
};

export const LinkBack: Story = {
  args: { href: "/", title: "Review" },
};

export const WithSubBanner: Story = {
  args: { onBack: () => undefined, title: "King Attack #1" },
  render: (args) => (
    <>
      <MobileBanner {...args} />
      <MobileSubBanner>
        <span style={{ opacity: 0.8, "font-size": "0.8rem", "white-space": "nowrap" }}>
          ⬡ 3&nbsp;&nbsp;☁ 1&nbsp;&nbsp;☰ 8/10
        </span>
        <span style={{ display: "inline-flex", "align-items": "center", gap: "0.35rem" }}>
          <CountdownRing progress={0.6} aria-label="6 seconds remaining">
            6
          </CountdownRing>
          <Button data-testid="turn-end">End Turn</Button>
        </span>
      </MobileSubBanner>
    </>
  ),
};
