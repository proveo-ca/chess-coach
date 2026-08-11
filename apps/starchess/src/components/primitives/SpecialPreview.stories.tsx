import type { Meta, StoryObj } from "storybook-solidjs-vite";

import { SpecialPreview } from "~/components/primitives/SpecialPreview";

const meta = {
  title: "Primitives/SpecialPreview",
  component: SpecialPreview,
  args: {
    unit: "Hoverbike",
    name: "Spider Mine",
    description: "Spawns a mine that explodes on collision.",
  },
} satisfies Meta<typeof SpecialPreview>;

export default meta;
type Story = StoryObj<typeof meta>;

export const Default: Story = {};
