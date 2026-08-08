import type { Meta, StoryObj } from "storybook-solidjs-vite";

import { Button } from "~/components/primitives/Button";

const meta = {
  title: "Primitives/Button",
  component: Button,
  args: {
    children: "Analyze game",
    primary: false,
    disabled: false,
  },
} satisfies Meta<typeof Button>;

export default meta;
type Story = StoryObj<typeof meta>;

export const Default: Story = {};

export const Primary: Story = {
  args: { primary: true },
};

export const Disabled: Story = {
  args: { disabled: true },
};

export const InternalLink: Story = {
  args: {
    children: "Open analysis",
    href: "/analysis",
  },
};

export const Variants: Story = {
  render: () => (
    <div style={{ display: "flex", gap: "12px", "align-items": "center", "flex-wrap": "wrap" }}>
      <Button>Secondary action</Button>
      <Button primary>Primary action</Button>
      <Button disabled>Unavailable</Button>
      <Button href="/review">Review link</Button>
      <Button variant="neon">Stay</Button>
      <Button variant="neon" primary>
        Leave
      </Button>
    </div>
  ),
};

export const Neon: Story = {
  args: { variant: "neon", children: "Stay" },
};

export const NeonPrimary: Story = {
  args: { variant: "neon", primary: true, children: "Start" },
};
