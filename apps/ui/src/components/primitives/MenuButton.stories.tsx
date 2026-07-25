import type { Meta, StoryObj } from "storybook-solidjs-vite";

import { MenuButton } from "~/components/primitives/MenuButton";

const meta = {
  title: "Primitives/MenuButton",
  component: MenuButton,
  args: {
    children: "Play against the coach",
    primary: false,
  },
} satisfies Meta<typeof MenuButton>;

export default meta;
type Story = StoryObj<typeof meta>;

export const Default: Story = {};

export const Primary: Story = {
  args: { primary: true },
};

export const Disabled: Story = {
  args: { children: "Continue game", disabled: true },
};

export const NavigationLink: Story = {
  args: {
    children: "Review games",
    href: "/review",
  },
};

export const MenuStack: Story = {
  render: () => (
    <div style={{ display: "grid", gap: "12px", width: "320px" }}>
      <MenuButton primary>New game</MenuButton>
      <MenuButton href="/analysis">Analyze position</MenuButton>
      <MenuButton href="/settings">Settings</MenuButton>
    </div>
  ),
};
