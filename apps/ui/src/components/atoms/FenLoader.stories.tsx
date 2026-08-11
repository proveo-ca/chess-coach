import type { Meta, StoryObj } from "storybook-solidjs-vite";

import { FenLoader } from "~/components/atoms/FenLoader";

const meta = {
  title: "Atoms/FenLoader",
  component: FenLoader,
  parameters: { layout: "centered" },
} satisfies Meta<typeof FenLoader>;

export default meta;
type Story = StoryObj<typeof meta>;

export const Default: Story = {};

export const WithAdjacentControls: Story = {
  args: {
    leading: <span style={{ "white-space": "nowrap" }}>Analysis</span>,
    trailing: <span style={{ "white-space": "nowrap" }}>White to move</span>,
  },
};
