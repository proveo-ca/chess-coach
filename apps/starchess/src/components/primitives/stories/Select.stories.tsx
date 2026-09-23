import type { Meta, StoryObj } from "storybook-solidjs-vite";

import { Select } from "@chess-coach/ui-web/primitives/Select";

const meta = {
  title: "Primitives/Select",
  component: Select,
  args: {
    children: (
      <>
        <option value="a">Option A</option>
        <option value="b">Option B</option>
      </>
    ),
  },
} satisfies Meta<typeof Select>;

export default meta;
type Story = StoryObj<typeof meta>;

export const Default: Story = {};

export const Neon: Story = {
  args: {
    variant: "neon",
    disabled: true,
    children: <option value="adjutant">Adjutant (Script)</option>,
  },
};
