import type { Meta, StoryObj } from "storybook-solidjs-vite";

import { Label } from "~/components/primitives/Label";

const meta = {
  title: "Primitives/Label",
  component: Label,
  args: {
    children: "Position evaluated",
    variant: "muted",
  },
  argTypes: {
    variant: { control: "select", options: ["muted", "caption", "section", "title"] },
    color: { control: "select", options: [undefined, "win", "loss", "draw"] },
  },
} satisfies Meta<typeof Label>;

export default meta;
type Story = StoryObj<typeof meta>;

export const Default: Story = {};

export const Variants: Story = {
  render: () => (
    <div style={{ display: "grid", gap: "12px" }}>
      <Label variant="title">Game analysis</Label>
      <Label variant="section">Opening accuracy</Label>
      <Label variant="caption">12 moves reviewed</Label>
      <Label variant="muted">No mistakes found</Label>
      <Label color="win">White wins</Label>
      <Label color="draw">Draw</Label>
      <Label color="loss">Black wins</Label>
    </div>
  ),
};
