import type { Meta, StoryObj } from "storybook-solidjs-vite";
import { createSignal } from "solid-js";

import { SplitButton } from "~/components/primitives/SplitButton";

const ELO = [
  { value: "intermediate", label: "1100 elo" },
  { value: "advanced", label: "1600 elo" },
  { value: "expert", label: "2200 elo" },
] as const;

const meta = {
  title: "Primitives/SplitButton",
  component: SplitButton,
  render: (args) => {
    const [value, setValue] = createSignal(args.value);
    return (
      <div style={{ width: "280px" }}>
        <SplitButton {...args} value={value()} onChange={setValue} />
      </div>
    );
  },
  args: {
    children: "Play with Selena",
    primary: true,
    selectLabel: "Difficulty",
    value: "intermediate",
    options: ELO,
    onChange: () => {},
  },
} satisfies Meta<typeof SplitButton<string>>;

export default meta;
type Story = StoryObj<typeof meta>;

export const Default: Story = {};

export const Secondary: Story = {
  args: { primary: false },
};

export const Disabled: Story = {
  args: { disabled: true },
};

/** Wider select for longer qualifiers. */
export const EvenSplit: Story = {
  args: { children: "Start", class: undefined },
  render: (args) => {
    const [value, setValue] = createSignal(args.value);
    return (
      <div style={{ width: "280px", "--split-ratio": "1fr 1fr" }}>
        <SplitButton {...args} value={value()} onChange={setValue} />
      </div>
    );
  },
};
