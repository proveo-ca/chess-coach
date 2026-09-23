import type { Meta, StoryObj } from "storybook-solidjs-vite";

import { Select } from "~/components/primitives/Select";

const options = (
  <>
    <option value="intermediate">Intermediate</option>
    <option value="advanced">Advanced</option>
    <option value="expert">Expert</option>
  </>
);

const meta = {
  title: "Primitives/Select",
  component: Select,
  args: {
    children: options,
    value: "advanced",
    "aria-label": "Coach difficulty",
  },
} satisfies Meta<typeof Select>;

export default meta;
type Story = StoryObj<typeof meta>;

export const Default: Story = {};

export const Intermediate: Story = {
  args: { value: "intermediate" },
};

export const Disabled: Story = {
  args: { disabled: true },
};
