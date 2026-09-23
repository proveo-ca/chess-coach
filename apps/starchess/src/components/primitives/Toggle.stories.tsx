import { createSignal } from "solid-js";
import type { Meta, StoryObj } from "storybook-solidjs-vite";

import { Toggle } from "@chess-coach/ui-web/primitives/Toggle";

const meta = {
  title: "Primitives/Toggle",
  component: Toggle,
  args: {
    checked: true,
    label: "StarChess skin",
    onChange: () => undefined,
  },
} satisfies Meta<typeof Toggle>;

export default meta;
type Story = StoryObj<typeof meta>;

export const Interactive: Story = {
  render: (args) => {
    const [checked, setChecked] = createSignal(args.checked);
    return <Toggle {...args} checked={checked()} onChange={setChecked} />;
  },
};

export const Off: Story = {
  args: { checked: false },
};

export const WithoutLabel: Story = {
  args: { checked: true, label: undefined },
};
