import type { Meta, StoryObj } from "storybook-solidjs-vite";

import { ChevronNav } from "@chess-coach/ui-web/primitives/ChevronNav";
import { Label } from "@chess-coach/ui-web/primitives/Label";
import { ScreenBackNav } from "~/components/primitives/ScreenBackNav";

const meta = {
  title: "Primitives/ScreenBackNav",
  component: ScreenBackNav,
  parameters: { layout: "fullscreen" },
  decorators: [
    (Story) => (
      <div style={{ width: "min(32rem, 100%)", margin: "2rem auto", padding: "0 1rem" }}>
        <Story />
      </div>
    ),
  ],
} satisfies Meta<typeof ScreenBackNav>;

export default meta;
type Story = StoryObj<typeof meta>;

export const BackOnly: Story = {
  args: {
    onBack: () => undefined,
    children: <Label variant="title">Solo Analysis</Label>,
  },
};

export const WithShare: Story = {
  render: () => (
    <ScreenBackNav
      onBack={() => undefined}
      trailing={
        <ChevronNav direction="forward" onClick={() => undefined} aria-label="Share">
          Share
        </ChevronNav>
      }
    >
      <Label variant="title">Win (White)</Label>
    </ScreenBackNav>
  ),
};
