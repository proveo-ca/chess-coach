import type { Meta, StoryObj } from "storybook-solidjs-vite";

import { TeamFrame } from "@chess-coach/ui-web/primitives/TeamFrame";

const meta = {
  title: "Primitives/TeamFrame",
  component: TeamFrame,
  args: {
    teamColor: "#3b7dd8",
    children: (
      <div style={{ padding: "12px 16px", "font-family": "IBM Plex Sans, sans-serif" }}>
        Team chrome
      </div>
    ),
  },
} satisfies Meta<typeof TeamFrame>;

export default meta;
type Story = StoryObj<typeof meta>;

export const White: Story = {};

export const Black: Story = {
  args: {
    teamColor: "#c43c3c",
    children: (
      <div style={{ padding: "12px 16px", "font-family": "IBM Plex Sans, sans-serif" }}>
        Black team
      </div>
    ),
  },
};
