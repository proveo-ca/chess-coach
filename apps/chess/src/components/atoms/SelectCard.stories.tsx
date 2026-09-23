import type { Meta, StoryObj } from "storybook-solidjs-vite";

import { ColorSwatch } from "~/components/atoms/ColorSwatch";
import { SelectCard } from "~/components/atoms/SelectCard";
import { Button } from "~/components/primitives/Button";

const meta = {
  title: "Atoms/SelectCard",
  component: SelectCard,
  args: {
    label: "White",
    children: <span>Seat available</span>,
  },
  parameters: { layout: "centered" },
} satisfies Meta<typeof SelectCard>;

export default meta;
type Story = StoryObj<typeof meta>;

export const SelectableSeats: Story = {
  render: () => (
    <div style={{ display: "flex", gap: "1rem" }}>
      <SelectCard label="White" selected onClick={() => undefined}>
        <ColorSwatch color="w" size="md" />
        <strong>Ada</strong>
      </SelectCard>
      <SelectCard label="Black" onClick={() => undefined}>
        <ColorSwatch color="b" size="md" />
        <strong>Grace</strong>
      </SelectCard>
    </div>
  ),
};

export const StaticActionCard: Story = {
  render: () => (
    <SelectCard label="Spectate">
      <span>Watch the current game</span>
      <Button type="button">Join</Button>
    </SelectCard>
  ),
};
