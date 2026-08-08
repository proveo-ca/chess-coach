import type { Meta, StoryObj } from "storybook-solidjs-vite";

import { ChevronNav } from "~/components/primitives/ChevronNav";
import { PanelTitle } from "~/components/primitives/PanelTitle";
import { ScreenBackNav } from "~/components/primitives/ScreenBackNav";

const meta = {
  title: "Primitives/PanelTitle",
  component: PanelTitle,
  parameters: { layout: "centered" },
} satisfies Meta<typeof PanelTitle>;

export default meta;
type Story = StoryObj<typeof meta>;

export const Review: Story = {
  args: { children: "Review" },
};

export const InBackNav: Story = {
  args: { children: "Review" },
  render: () => (
    <div style={{ width: "min(28rem, 90vw)" }}>
      <ScreenBackNav href="/" data-testid="demo-back">
        <PanelTitle>Review</PanelTitle>
      </ScreenBackNav>
    </div>
  ),
};

export const WithShare: Story = {
  args: { children: "Victory" },
  render: () => (
    <div style={{ width: "min(28rem, 90vw)" }}>
      <ScreenBackNav
        onBack={() => undefined}
        trailing={
          <ChevronNav direction="forward" onClick={() => undefined}>
            Share
          </ChevronNav>
        }
      >
        <PanelTitle>Victory</PanelTitle>
      </ScreenBackNav>
    </div>
  ),
};
