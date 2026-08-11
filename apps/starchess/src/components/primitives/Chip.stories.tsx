import type { Meta, StoryObj } from "storybook-solidjs-vite";

import { Chip } from "~/components/primitives/Chip";

const meta = {
  title: "Primitives/Chip",
  component: Chip,
  args: {
    children: "Turn 3",
  },
} satisfies Meta<typeof Chip>;

export default meta;
type Story = StoryObj<typeof meta>;

export const Default: Story = {};

export const Tones: Story = {
  render: () => (
    <div style={{ display: "inline-flex", gap: "8px", "flex-wrap": "wrap" }}>
      <Chip>Turn 1</Chip>
      <Chip size="sm" tone="before">
        B mine a4
      </Chip>
      <Chip size="sm" tone="classical" onRemove={() => undefined} removeLabel="Remove">
        C e2→e4
      </Chip>
      <Chip size="sm" tone="after">
        F siege
      </Chip>
      <Chip size="sm" tone="muted">
        C —
      </Chip>
    </div>
  ),
};
