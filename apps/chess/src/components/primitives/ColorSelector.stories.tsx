import { createSignal } from "solid-js";
import type { Meta, StoryObj } from "storybook-solidjs-vite";

import { ColorSelector } from "~/components/primitives/ColorSelector";

const meta = {
  title: "Primitives/ColorSelector",
  component: ColorSelector,
  args: {
    value: "random",
    hideRandom: false,
    onChange: () => undefined,
  },
} satisfies Meta<typeof ColorSelector>;

export default meta;
type Story = StoryObj<typeof meta>;

export const Interactive: Story = {
  render: (args) => {
    const [value, setValue] = createSignal(args.value);
    return <ColorSelector {...args} value={value()} onChange={setValue} />;
  },
};

export const WhiteSelected: Story = {
  args: { value: "w" },
};

export const WithoutRandom: Story = {
  args: { value: "b", hideRandom: true },
};
