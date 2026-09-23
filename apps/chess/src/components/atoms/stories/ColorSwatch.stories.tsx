import type { Meta, StoryObj } from "storybook-solidjs-vite";

import { ColorSwatch } from "@chess-coach/ui-web/atoms/ColorSwatch";

const meta = {
  title: "Atoms/ColorSwatch",
  component: ColorSwatch,
  args: { color: "w" },
  parameters: { layout: "centered" },
} satisfies Meta<typeof ColorSwatch>;

export default meta;
type Story = StoryObj<typeof meta>;

export const ColorsAndSizes: Story = {
  render: () => (
    <div style={{ display: "flex", gap: "1rem", "align-items": "center" }}>
      <ColorSwatch color="w" />
      <ColorSwatch color="b" />
      <ColorSwatch color="w" size="md" />
      <ColorSwatch color="b" size="md" />
    </div>
  ),
};
